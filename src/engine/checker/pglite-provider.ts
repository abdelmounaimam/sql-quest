/**
 * SandboxProvider backed by PGlite. Runs in a Web Worker (browser) and in Node
 * (vitest). Never import this module during SSR.
 *
 * Caches:
 *  - one base DB per dataset (dataset setupSql applied once),
 *  - an LRU of "exercise base" DBs (dataset + exercise setupSql),
 *  - every sandbox is a clone() of an exercise base and must be closed.
 */
import {
	type Extension,
	PGlite,
	type PGliteInterface,
} from "@electric-sql/pglite";
import type { ExtensionName } from "#/content/types";
import { toResultTable } from "./checker";
import { splitStatements } from "./split";
import type {
	RawField,
	RawResult,
	ResultTable,
	Sandbox,
	SandboxProvider,
} from "./types";

/**
 * Raw text parsers: keep Postgres's own text output (psql-like) for types the
 * JS driver would mangle (timestamptz -> Date loses the offset, json loses
 * duplicate keys / key order, int8 loses precision). jsonb stays parsed: its
 * text form is canonical anyway, and objects render nicely.
 */
const identity = (x: string) => x;
export const RAW_TEXT_PARSERS: Record<number, (x: string) => unknown> = {
	20: identity, // int8
	114: identity, // json
	1082: identity, // date
	1083: identity, // time
	1114: identity, // timestamp
	1184: identity, // timestamptz
	1186: identity, // interval
	1266: identity, // timetz
	1700: identity, // numeric
	1182: identity, // date[]
	1115: identity, // timestamp[]
	1185: identity, // timestamptz[]
	1016: identity, // int8[]
	1231: identity, // numeric[]
};

/** Errors are thrown per statement: shift `position` to the full script offset. */
function shiftErrorPosition(err: unknown, offset: number): unknown {
	if (!err || typeof err !== "object" || offset === 0) return err;
	const e = err as { position?: string | number };
	if (e.position === undefined || e.position === null || e.position === "")
		return err;
	const pos = Number(e.position);
	if (!Number.isFinite(pos)) return err;
	try {
		e.position = String(pos + offset);
		return err;
	} catch {
		return Object.assign(Object.create(Object.getPrototypeOf(err)), err, {
			position: String(pos + offset),
		});
	}
}

export interface DatasetSource {
	id: string;
	setupSql: string;
	extensions?: ExtensionName[];
}

export interface DatasetRegistry {
	getDataset(id: string): DatasetSource | undefined;
}

type ExtensionLoader = () => Promise<Extension>;

const EXTENSION_LOADERS: Record<ExtensionName, ExtensionLoader> = {
	vector: async () => (await import("@electric-sql/pglite-pgvector")).vector,
	pg_trgm: async () =>
		(await import("@electric-sql/pglite/contrib/pg_trgm")).pg_trgm,
	hstore: async () =>
		(await import("@electric-sql/pglite/contrib/hstore")).hstore,
	ltree: async () => (await import("@electric-sql/pglite/contrib/ltree")).ltree,
	citext: async () =>
		(await import("@electric-sql/pglite/contrib/citext")).citext,
	cube: async () => (await import("@electric-sql/pglite/contrib/cube")).cube,
	earthdistance: async () =>
		(await import("@electric-sql/pglite/contrib/earthdistance")).earthdistance,
	fuzzystrmatch: async () =>
		(await import("@electric-sql/pglite/contrib/fuzzystrmatch")).fuzzystrmatch,
	pgcrypto: async () =>
		(await import("@electric-sql/pglite/contrib/pgcrypto")).pgcrypto,
	tablefunc: async () =>
		(await import("@electric-sql/pglite/contrib/tablefunc")).tablefunc,
	unaccent: async () =>
		(await import("@electric-sql/pglite/contrib/unaccent")).unaccent,
	"uuid-ossp": async () =>
		(await import("@electric-sql/pglite/contrib/uuid_ossp")).uuid_ossp,
	btree_gin: async () =>
		(await import("@electric-sql/pglite/contrib/btree_gin")).btree_gin,
	btree_gist: async () =>
		(await import("@electric-sql/pglite/contrib/btree_gist")).btree_gist,
	intarray: async () =>
		(await import("@electric-sql/pglite/contrib/intarray")).intarray,
	seg: async () => (await import("@electric-sql/pglite/contrib/seg")).seg,
	isn: async () => (await import("@electric-sql/pglite/contrib/isn")).isn,
};

async function loadExtensions(
	names: ExtensionName[] = [],
): Promise<Record<string, Extension>> {
	const out: Record<string, Extension> = {};
	for (const name of names) {
		const loader = EXTENSION_LOADERS[name];
		if (!loader) throw new Error(`Unknown PGlite extension "${name}"`);
		out[name.replace(/-/g, "_")] = await loader();
	}
	return out;
}

interface CachedDb {
	db: PGliteInterface;
	/** oid -> typname for this database (includes user types). */
	types: Map<number, string>;
}

async function readTypes(db: PGliteInterface): Promise<Map<number, string>> {
	const res = await db.query<[number, string]>(
		"select oid::int, typname::text from pg_type",
		[],
		{ rowMode: "array" },
	);
	return new Map(res.rows.map(([oid, name]) => [oid, name]));
}

function annotate(
	results: RawResult[],
	types: Map<number, string>,
): RawResult[] {
	return results.map((r) => ({
		rows: r.rows,
		fields: r.fields.map(
			(f): RawField => ({
				name: f.name,
				dataTypeID: f.dataTypeID,
				typeName: types.get(f.dataTypeID),
			}),
		),
		command: r.command,
		affectedRows: r.affectedRows,
	}));
}

export interface PGliteProvider extends SandboxProvider {
	/** The dataset base DB (do not mutate it, do not close it). */
	base(datasetId: string): Promise<PGliteInterface>;
	/** Type name for an oid as known by the dataset base. */
	typeName(datasetId: string, oid: number): Promise<string | undefined>;
	/** Drop cached DBs for one dataset (e.g. after content hot reload) or all. */
	invalidate(datasetId?: string): Promise<void>;
	dispose(): Promise<void>;
}

const EXERCISE_LRU_SIZE = 4;

export function createPGliteProvider(
	registry: DatasetRegistry,
): PGliteProvider {
	const bases = new Map<string, Promise<CachedDb>>();
	const exerciseBases = new Map<string, Promise<CachedDb>>();

	function baseFor(datasetId: string): Promise<CachedDb> {
		let p = bases.get(datasetId);
		if (!p) {
			const def = registry.getDataset(datasetId);
			if (!def)
				return Promise.reject(new Error(`Unknown dataset "${datasetId}"`));
			p = (async () => {
				const extensions = await loadExtensions(def.extensions);
				const db = await PGlite.create({ extensions });
				try {
					await db.exec(def.setupSql);
				} catch (err) {
					await db.close().catch(() => {});
					throw err;
				}
				return { db, types: await readTypes(db) };
			})();
			bases.set(datasetId, p);
			p.catch(() => bases.delete(datasetId));
		}
		return p;
	}

	function exerciseBaseFor(
		datasetId: string,
		setupSql?: string,
	): Promise<CachedDb> {
		if (!setupSql?.trim()) return baseFor(datasetId);
		const key = `${datasetId}\u0000${setupSql}`;
		const hit = exerciseBases.get(key);
		if (hit) {
			// refresh LRU position
			exerciseBases.delete(key);
			exerciseBases.set(key, hit);
			return hit;
		}
		const p = (async () => {
			const base = await baseFor(datasetId);
			const db = await base.db.clone();
			try {
				await db.exec(setupSql);
			} catch (err) {
				await db.close().catch(() => {});
				throw err;
			}
			return { db, types: await readTypes(db) };
		})();
		exerciseBases.set(key, p);
		p.catch(() => exerciseBases.delete(key));
		while (exerciseBases.size > EXERCISE_LRU_SIZE) {
			const oldestKey = exerciseBases.keys().next().value as string;
			const oldest = exerciseBases.get(oldestKey);
			exerciseBases.delete(oldestKey);
			oldest?.then((c) => c.db.close()).catch(() => {});
		}
		return p;
	}

	return {
		async open(datasetId, setupSql) {
			const src = await exerciseBaseFor(datasetId, setupSql);
			const db = await src.db.clone();
			let types = src.types;
			let closed = false;
			const sandbox: Sandbox = {
				async exec(sql) {
					const res: RawResult[] = [];
					for (const stmt of splitStatements(sql)) {
						try {
							const part = (await db.exec(stmt.text, {
								rowMode: "array",
								parsers: RAW_TEXT_PARSERS,
							})) as unknown as RawResult[];
							res.push(...part);
						} catch (err) {
							throw shiftErrorPosition(err, stmt.offset);
						}
					}
					// Learner DDL may have created types (CREATE TYPE ... AS ENUM).
					const unknown = res.some((r) =>
						r.fields.some((f) => !types.has(f.dataTypeID)),
					);
					if (unknown) types = await readTypes(db);
					return annotate(res, types);
				},
				async close() {
					if (closed) return;
					closed = true;
					await db.close();
				},
			};
			return sandbox;
		},
		async base(datasetId) {
			return (await baseFor(datasetId)).db;
		},
		async typeName(datasetId, oid) {
			return (await baseFor(datasetId)).types.get(oid);
		},
		async invalidate(datasetId) {
			const toClose: Promise<CachedDb>[] = [];
			for (const [k, p] of bases) {
				if (!datasetId || k === datasetId) {
					toClose.push(p);
					bases.delete(k);
				}
			}
			for (const [k, p] of exerciseBases) {
				if (!datasetId || k.startsWith(`${datasetId}\u0000`)) {
					toClose.push(p);
					exerciseBases.delete(k);
				}
			}
			await Promise.all(
				toClose.map((p) => p.then((c) => c.db.close()).catch(() => undefined)),
			);
		},
		async dispose() {
			await this.invalidate();
		},
	};
}

// ---------------------------------------------------------------------------
// Catalog introspection (schema explorer, autocomplete)
// ---------------------------------------------------------------------------

export type ColumnCategory =
	| "int"
	| "numeric"
	| "text"
	| "bool"
	| "date"
	| "timestamp"
	| "time"
	| "interval"
	| "json"
	| "vector"
	| "array"
	| "enum"
	| "range"
	| "uuid"
	| "other";

export interface CatalogColumn {
	name: string;
	/** format_type output, e.g. "numeric(10,2)", "vector(3)", "text[]". */
	dataType: string;
	udtName: string;
	category: ColumnCategory;
	nullable: boolean;
	defaultValue: string | null;
	isPrimaryKey: boolean;
	isUnique: boolean;
	references: { table: string; column: string } | null;
	enumLabels?: string[];
	vectorDim?: number;
}

export interface CatalogTable {
	name: string;
	kind: "table" | "view" | "matview";
	columns: CatalogColumn[];
	rowCount: number;
	sampleRows: ResultTable;
	/** Column name -> a few non-null sample JSON values. */
	jsonSamples: Record<string, unknown[]>;
}

export interface Catalog {
	datasetId: string;
	tables: CatalogTable[];
	enums: Record<string, string[]>;
	extensions: string[];
}

function categorize(
	udt: string,
	typcategory: string,
	typtype: string,
): ColumnCategory {
	if (typtype === "e") return "enum";
	if (typtype === "r" || typtype === "m") return "range";
	if (typcategory === "A") return "array";
	switch (udt) {
		case "int2":
		case "int4":
		case "int8":
			return "int";
		case "numeric":
		case "float4":
		case "float8":
		case "money":
			return "numeric";
		case "bool":
			return "bool";
		case "date":
			return "date";
		case "timestamp":
		case "timestamptz":
			return "timestamp";
		case "time":
		case "timetz":
			return "time";
		case "interval":
			return "interval";
		case "json":
		case "jsonb":
			return "json";
		case "vector":
		case "halfvec":
		case "sparsevec":
			return "vector";
		case "uuid":
			return "uuid";
		case "text":
		case "varchar":
		case "bpchar":
		case "citext":
		case "name":
			return "text";
	}
	if (typcategory === "S") return "text";
	if (typcategory === "N") return "numeric";
	return "other";
}

const quoteIdent = (s: string) => `"${s.replace(/"/g, '""')}"`;

type DbLike = Pick<PGliteInterface, "query">;

async function rowsOf<T extends unknown[]>(
	db: DbLike,
	sql: string,
	params: unknown[] = [],
): Promise<T[]> {
	const r = await db.query<T>(sql, params, { rowMode: "array" });
	return r.rows;
}

export async function introspectCatalog(
	provider: PGliteProvider,
	datasetId: string,
	opts: { sampleRows?: number } = {},
): Promise<Catalog> {
	const db = await provider.base(datasetId);
	const sampleLimit = opts.sampleRows ?? 5;

	const cols = await rowsOf<
		[
			string,
			string,
			number,
			string,
			string,
			string,
			string,
			boolean,
			string | null,
		]
	>(
		db,
		`select c.relname::text, c.relkind::text, a.attnum::int, a.attname::text,
		        format_type(a.atttypid, a.atttypmod), t.typname::text,
		        coalesce(et.typcategory, t.typcategory)::text || '|' || coalesce(et.typtype, t.typtype)::text || '|' || t.typcategory::text,
		        not a.attnotnull, pg_get_expr(d.adbin, d.adrelid)
		   from pg_class c
		   join pg_namespace n on n.oid = c.relnamespace
		   join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
		   join pg_type t on t.oid = a.atttypid
		   left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
		   left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
		  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
		  order by c.relname, a.attnum`,
	);

	const cons = await rowsOf<
		[string, string, number[], string | null, number[] | null]
	>(
		db,
		`select c.conrelid::regclass::text, c.contype::text, c.conkey::int[],
		        case when c.confrelid <> 0 then c.confrelid::regclass::text end, c.confkey::int[]
		   from pg_constraint c
		   join pg_namespace n on n.oid = c.connamespace
		  where n.nspname = 'public' and c.contype in ('p', 'f', 'u')`,
	);

	const enumRows = await rowsOf<[string, string[]]>(
		db,
		`select t.typname::text, array_agg(e.enumlabel::text order by e.enumsortorder)
		   from pg_enum e join pg_type t on t.oid = e.enumtypid
		  group by t.typname`,
	);
	const enums: Record<string, string[]> = Object.fromEntries(enumRows);

	const extRows = await rowsOf<[string]>(
		db,
		"select extname::text from pg_extension where extname <> 'plpgsql' order by 1",
	);

	// attnum lookup per table
	const attByTable = new Map<string, Map<number, string>>();
	for (const [table, , attnum, name] of cols) {
		let m = attByTable.get(table);
		if (!m) {
			m = new Map();
			attByTable.set(table, m);
		}
		m.set(attnum, name);
	}
	const unq = (s: string) => s.replace(/^"|"$/g, "").replace(/^public\./, "");

	const pk = new Set<string>();
	const uniq = new Set<string>();
	const fks = new Map<string, { table: string; column: string }>();
	for (const [rawTable, type, conkey, rawFTable, confkey] of cons) {
		const table = unq(rawTable);
		const names = attByTable.get(table);
		if (!names) continue;
		if (type === "p")
			for (const k of conkey) pk.add(`${table}.${names.get(k)}`);
		if (type === "u" && conkey.length === 1)
			uniq.add(`${table}.${names.get(conkey[0])}`);
		if (type === "f" && rawFTable && confkey) {
			const ftable = unq(rawFTable);
			const fnames = attByTable.get(ftable);
			conkey.forEach((k, i) => {
				fks.set(`${table}.${names.get(k)}`, {
					table: ftable,
					column: fnames?.get(confkey[i]) ?? "?",
				});
			});
		}
	}

	const tablesMap = new Map<string, CatalogTable>();
	for (const [
		table,
		relkind,
		,
		name,
		dataType,
		udt,
		catInfo,
		nullable,
		def,
	] of cols) {
		let t = tablesMap.get(table);
		if (!t) {
			t = {
				name: table,
				kind: relkind === "v" ? "view" : relkind === "m" ? "matview" : "table",
				columns: [],
				rowCount: 0,
				sampleRows: { columns: [], rows: [], rowCount: 0 },
				jsonSamples: {},
			};
			tablesMap.set(table, t);
		}
		const [elemCategory, elemTyptype, ownCategory] = catInfo.split("|");
		const category =
			ownCategory === "A"
				? "array"
				: categorize(udt, elemCategory, elemTyptype);
		const key = `${table}.${name}`;
		const col: CatalogColumn = {
			name,
			dataType,
			udtName: udt,
			category,
			nullable,
			defaultValue: def,
			isPrimaryKey: pk.has(key),
			isUnique: uniq.has(key),
			references: fks.get(key) ?? null,
		};
		const enumName = udt.replace(/^_/, "");
		if (enums[enumName]) col.enumLabels = enums[enumName];
		const dim = /^(vector|halfvec|sparsevec)\((\d+)\)/.exec(dataType);
		if (dim) col.vectorDim = Number(dim[2]);
		t.columns.push(col);
	}

	for (const t of tablesMap.values()) {
		const ident = quoteIdent(t.name);
		const [[count]] = await rowsOf<[number]>(
			db,
			`select count(*)::int from ${ident}`,
		);
		t.rowCount = count;
		const sample = (await db.query(
			`select * from ${ident} limit ${sampleLimit}`,
			[],
			{
				rowMode: "array",
				parsers: RAW_TEXT_PARSERS,
			},
		)) as unknown as RawResult;
		const types = new Map<number, string>();
		for (const f of sample.fields) {
			const tn = await provider.typeName(datasetId, f.dataTypeID);
			if (tn) types.set(f.dataTypeID, tn);
		}
		t.sampleRows = toResultTable(annotate([sample], types)[0]);
		for (const c of t.columns) {
			if (c.category !== "json") continue;
			const vals = await rowsOf<[unknown]>(
				db,
				`select ${quoteIdent(c.name)} from ${ident} where ${quoteIdent(c.name)} is not null limit 3`,
			);
			t.jsonSamples[c.name] = vals.map(([v]) => v);
		}
	}

	return {
		datasetId,
		tables: [...tablesMap.values()],
		enums,
		extensions: extRows.map(([e]) => e),
	};
}

/** Rows of one table for the schema explorer "peek". */
export async function peekTable(
	provider: PGliteProvider,
	datasetId: string,
	table: string,
	limit = 50,
): Promise<ResultTable> {
	const db = await provider.base(datasetId);
	const raw = (await db.query(
		`select * from ${quoteIdent(table)} limit ${Math.max(1, Math.min(1000, limit))}`,
		[],
		{ rowMode: "array", parsers: RAW_TEXT_PARSERS },
	)) as unknown as RawResult;
	const types = new Map<number, string>();
	for (const f of raw.fields) {
		const tn = await provider.typeName(datasetId, f.dataTypeID);
		if (tn) types.set(f.dataTypeID, tn);
	}
	return toResultTable(annotate([raw], types)[0]);
}

const COMMON_FUNCTIONS = [
	"count",
	"sum",
	"avg",
	"min",
	"max",
	"coalesce",
	"nullif",
	"greatest",
	"least",
	"lower",
	"upper",
	"length",
	"trim",
	"substring",
	"concat",
	"concat_ws",
	"replace",
	"split_part",
	"left",
	"right",
	"position",
	"string_agg",
	"array_agg",
	"jsonb_agg",
	"json_agg",
	"jsonb_build_object",
	"json_build_object",
	"jsonb_array_elements",
	"jsonb_each",
	"jsonb_object_keys",
	"jsonb_set",
	"jsonb_path_query",
	"to_jsonb",
	"row_number",
	"rank",
	"dense_rank",
	"lag",
	"lead",
	"first_value",
	"last_value",
	"ntile",
	"percent_rank",
	"cume_dist",
	"now",
	"current_date",
	"date_trunc",
	"date_part",
	"extract",
	"age",
	"to_char",
	"to_date",
	"to_timestamp",
	"make_date",
	"make_interval",
	"generate_series",
	"round",
	"floor",
	"ceil",
	"abs",
	"random",
	"power",
	"sqrt",
	"mod",
	"unnest",
	"array_length",
	"cardinality",
	"array_position",
	"array_remove",
	"array_append",
	"regexp_replace",
	"regexp_match",
	"regexp_matches",
	"format",
	"md5",
	"gen_random_uuid",
	"bool_and",
	"bool_or",
	"every",
	"percentile_cont",
	"percentile_disc",
	"mode",
	"stddev",
	"variance",
	"corr",
	"l2_distance",
	"cosine_distance",
	"inner_product",
	"vector_dims",
	"vector_norm",
	"l2_normalize",
	"similarity",
	"word_similarity",
	"levenshtein",
	"soundex",
	"to_tsvector",
	"to_tsquery",
	"plainto_tsquery",
	"websearch_to_tsquery",
	"ts_rank",
	"pg_typeof",
	"nextval",
	"currval",
	"setval",
];

/** Function names for autocomplete: common ones first, then user-defined, then other callable names. */
export async function functionNames(
	provider: PGliteProvider,
	datasetId: string,
	limit = 400,
): Promise<string[]> {
	const db = await provider.base(datasetId);
	const rows = await rowsOf<[string, string]>(
		db,
		`select distinct p.proname::text, n.nspname::text
		   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
		  where n.nspname in ('pg_catalog', 'public')
		    and p.prokind in ('f', 'a', 'w')
		    and p.prorettype <> 'internal'::regtype
		    and p.prorettype <> 'trigger'::regtype
		    and p.proname !~ '^(_|pg_|ts_debug|binary_upgrade)'
		    and p.proname !~ '(in|out|recv|send|support|handler|typmod_in|typmod_out|_cmp|_eq|_ne|_lt|_le|_gt|_ge)$'`,
	);
	const available = new Set(rows.map(([n]) => n));
	const userDefined = rows.filter(([, ns]) => ns === "public").map(([n]) => n);
	const out: string[] = [];
	const seen = new Set<string>();
	const push = (n: string) => {
		if (!seen.has(n) && out.length < limit) {
			seen.add(n);
			out.push(n);
		}
	};
	for (const f of COMMON_FUNCTIONS) if (available.has(f)) push(f);
	for (const f of userDefined.sort()) push(f);
	for (const f of [...available].sort(
		(a, b) => a.length - b.length || a.localeCompare(b),
	))
		push(f);
	return out;
}
