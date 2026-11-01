/**
 * SQL as tiles: the tokenizer behind the word bank and the keyboard
 * suggestion strip. Pure functions, no DOM.
 */

export type TokenKind =
	| "keyword"
	| "function"
	| "string"
	| "number"
	| "punct"
	| "operator"
	| "ident";

export interface Tile {
	id: string;
	text: string;
	kind: TokenKind;
}

const KEYWORDS = new Set(
	`select from where and or not null is in like ilike between as on join left right full inner outer cross natural
	group by order having limit offset distinct all union intersect except asc desc nulls first last case when then else end
	insert into values update set delete returning create table drop alter add column primary key foreign references unique
	check default constraint index view with recursive exists any some true false begin commit rollback savepoint release
	transaction explain analyze over partition rows range preceding following current row window filter within lateral
	using conflict do nothing cascade restrict if only materialized truncate vacuum grant revoke to of for share no action
	interval date time timestamp boolean integer int bigint smallint text varchar char numeric decimal real double precision
	serial bigserial jsonb json uuid array generated always identity stored temp temporary similar escape collate fetch next`
		.split(/\s+/)
		.filter(Boolean),
);

/** Keyword runs that read as one tile ("GROUP BY", "IS NOT NULL"). */
const PHRASES: string[][] = [
	["is", "not", "null"],
	["is", "null"],
	["is", "not", "distinct", "from"],
	["is", "distinct", "from"],
	["not", "null"],
	["group", "by"],
	["order", "by"],
	["partition", "by"],
	["left", "outer", "join"],
	["left", "join"],
	["right", "join"],
	["full", "outer", "join"],
	["full", "join"],
	["inner", "join"],
	["cross", "join"],
	["natural", "join"],
	["union", "all"],
	["insert", "into"],
	["delete", "from"],
	["primary", "key"],
	["foreign", "key"],
	["create", "table"],
	["create", "index"],
	["create", "view"],
	["alter", "table"],
	["drop", "table"],
	["on", "conflict"],
	["do", "nothing"],
	["not", "exists"],
	["not", "in"],
	["not", "like"],
	["nulls", "first"],
	["nulls", "last"],
	["double", "precision"],
];

/** Clauses that start a new line when tiles are rendered. */
const CLAUSES = new Set([
	"FROM",
	"WHERE",
	"GROUP BY",
	"HAVING",
	"ORDER BY",
	"LIMIT",
	"OFFSET",
	"JOIN",
	"LEFT JOIN",
	"LEFT OUTER JOIN",
	"RIGHT JOIN",
	"FULL JOIN",
	"FULL OUTER JOIN",
	"INNER JOIN",
	"CROSS JOIN",
	"NATURAL JOIN",
	"UNION",
	"UNION ALL",
	"INTERSECT",
	"EXCEPT",
	"VALUES",
	"SET",
	"RETURNING",
	"ON CONFLICT",
	"WINDOW",
]);

const RAW =
	/\$([A-Za-z_]\w*)?\$[\s\S]*?\$\1\$|[Ee]?'(?:[^']|'')*'?|"[^"]*"?|[A-Za-z_][A-Za-z0-9_$]*(?:\.(?:[A-Za-z_][A-Za-z0-9_$]*|\*))*\(?|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|<=>|<->|<#>|<<=|>>=|-\|-|->>|#>>|::|->|#>|#-|=>|@>|<@|@\?|@@|<<|>>|\?\||\?&|<>|<=|>=|!=|\|\||&&|~~\*|!~~|~~|!~\*|!~|~\*|[^\s]/g;

function stripComments(sql: string): string {
	return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

export function kindOf(tok: string): TokenKind {
	if (tok.startsWith("'") || tok.startsWith("$") || /^[Ee]'/.test(tok))
		return "string";
	if (/^\d/.test(tok)) return "number";
	if (tok.endsWith("(") && tok.length > 1) return "function";
	if (/^[A-Za-z]/.test(tok)) {
		const words = tok.toLowerCase().split(" ");
		if (words.every((w) => KEYWORDS.has(w))) return "keyword";
		return "ident";
	}
	if (/^[(),;.]$/.test(tok)) return "punct";
	return "operator";
}

/**
 * Split SQL into tiles: keywords uppercased and merged into phrases,
 * `count(` kept with its paren, qualified names (`p.name`) whole.
 */
export function tokenize(sql: string): string[] {
	const raw = stripComments(sql).match(RAW) ?? [];
	const out: string[] = [];
	for (let i = 0; i < raw.length; i++) {
		const lower = raw[i].toLowerCase();
		let merged = false;
		for (const p of PHRASES) {
			if (p[0] !== lower) continue;
			if (p.every((w, k) => raw[i + k]?.toLowerCase() === w)) {
				out.push(p.join(" ").toUpperCase());
				i += p.length - 1;
				merged = true;
				break;
			}
		}
		if (merged) continue;
		const t = raw[i];
		out.push(KEYWORDS.has(lower) ? t.toUpperCase() : t);
	}
	return out;
}

const NO_SPACE_BEFORE = new Set([",", ")", ";", "::", ".", "[", "]"]);
const NO_SPACE_AFTER = new Set(["(", "::", ".", "["]);

/**
 * For each token, whether it starts a new line: a clause keyword outside
 * parentheses (a subquery or function call stays on its line).
 */
export function lineStarts(tokens: string[]): boolean[] {
	let depth = 0;
	return tokens.map((t, i) => {
		const brk = i > 0 && depth === 0 && CLAUSES.has(t);
		if (t === "(" || (t.endsWith("(") && t.length > 1)) depth++;
		else if (t === ")") depth = Math.max(0, depth - 1);
		return brk;
	});
}

/** Tiles back to SQL, one top-level clause per line. */
export function render(tokens: string[]): string {
	const breaks = lineStarts(tokens);
	let s = "";
	let prev = "";
	tokens.forEach((t, i) => {
		if (!s) s = t;
		else if (breaks[i]) s += `\n${t}`;
		else if (
			NO_SPACE_BEFORE.has(t) ||
			NO_SPACE_AFTER.has(prev) ||
			prev.endsWith("(")
		)
			s += t;
		else s += ` ${t}`;
		prev = t;
	});
	return s;
}

export function startsClause(tok: string): boolean {
	return CLAUSES.has(tok);
}

const norm = (t: string) => (kindOf(t) === "keyword" ? t.toUpperCase() : t);

// ───────────────────────────── word bank

function hash(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function rng(seed: number) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Words that are easy to confuse with the right one. */
const LOOKALIKES: Record<string, string[]> = {
	WHERE: ["HAVING"],
	HAVING: ["WHERE"],
	AND: ["OR"],
	OR: ["AND"],
	ASC: ["DESC"],
	DESC: ["ASC"],
	"=": ["<>", ">"],
	"<>": ["="],
	">": ["<", ">="],
	"<": [">", "<="],
	">=": [">"],
	"<=": ["<"],
	"IS NULL": ["= NULL", "IS NOT NULL"],
	"IS NOT NULL": ["IS NULL", "<> NULL"],
	"LEFT JOIN": ["JOIN"],
	JOIN: ["LEFT JOIN"],
	"GROUP BY": ["ORDER BY"],
	"ORDER BY": ["GROUP BY"],
	"count(": ["sum("],
	"sum(": ["count(", "avg("],
	"avg(": ["sum("],
	"min(": ["max("],
	"max(": ["min("],
	LIKE: ["ILIKE", "="],
	ILIKE: ["LIKE"],
	"UNION ALL": ["UNION"],
	UNION: ["UNION ALL"],
	DISTINCT: ["ALL"],
	"*": [","],
};

/** Longest solution (in tiles) that still gets a word bank. */
export const WORD_BANK_MAX = 40;

/**
 * Duolingo-style bank: every tile of the reference solution plus a few
 * plausible distractors, shuffled the same way every time for an exercise.
 * Returns null when the solution is too long to build by tapping.
 */
export function buildBank(
	solutionSql: string,
	seed: string,
	schema?: Record<string, string[]>,
): Tile[] | null {
	const sol = tokenize(solutionSql);
	if (!sol.length || sol.length > WORD_BANK_MAX) return null;
	const rand = rng(hash(seed));
	const want = Math.min(8, Math.max(3, Math.round(sol.length * 0.3)));
	const have = new Set(sol.map(norm));
	const pool: string[] = [];
	for (const t of sol) for (const l of LOOKALIKES[norm(t)] ?? []) pool.push(l);
	if (schema) {
		const tables = Object.keys(schema);
		const used = tables.filter((t) => have.has(t));
		for (const t of used.length ? used : tables.slice(0, 2))
			for (const c of schema[t] ?? []) pool.push(c);
		for (const t of tables) pool.push(t);
	}
	const distractors: string[] = [];
	const shuffledPool = shuffle([...new Set(pool)], rand).sort(
		// Lookalikes first: they teach; then columns, then tables.
		(a, b) => Number(!!LOOKALIKES[b]) - Number(!!LOOKALIKES[a]),
	);
	for (const p of shuffledPool) {
		if (distractors.length >= want) break;
		if (have.has(norm(p)) || distractors.includes(p)) continue;
		distractors.push(p);
	}
	const tiles = [...sol, ...distractors].map((text, i) => ({
		id: `t${i}`,
		text,
		kind: kindOf(text),
	}));
	return shuffle(tiles, rand);
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

/** Map typed SQL onto bank tiles (in order), or null if a token has no tile. */
export function toTiles(sql: string, bank: Tile[]): string[] | null {
	const tokens = tokenize(sql);
	const free = [...bank];
	const ids: string[] = [];
	for (const t of tokens) {
		const i = free.findIndex((b) => norm(b.text) === norm(t));
		if (i < 0) return null;
		ids.push(free[i].id);
		free.splice(i, 1);
	}
	return ids;
}

// ───────────────────────────── keyboard suggestions

export interface SuggestContext {
	schema?: Record<string, string[]>;
	/** Sample values keyed by "table.column" and by bare "column". */
	samples?: Record<string, string[]>;
	functions?: string[];
}

export interface Suggestions {
	/** Partial word under the cursor that a pick replaces ("" when none). */
	partial: string;
	items: string[];
}

const COMMON_FUNCS = ["count(", "sum(", "avg(", "min(", "max(", "coalesce("];

/** What a learner most likely types next, given the SQL before the cursor. */
export function suggest(before: string, ctx: SuggestContext): Suggestions {
	const schema = ctx.schema ?? {};
	const tables = Object.keys(schema);
	const m = /[A-Za-z_][A-Za-z0-9_.]*$/.exec(before);
	const partial = m ? m[0] : "";
	const head = partial ? before.slice(0, -partial.length) : before;
	const toks = tokenize(head);
	const up = toks.map((t) => t.toUpperCase());
	const last = up.at(-1) ?? "";
	const lastRaw = toks.at(-1) ?? "";

	// Tables named in the query, plus aliases.
	const inQuery: string[] = [];
	const aliases: string[] = [];
	for (let i = 0; i < toks.length; i++) {
		if (
			!/^(FROM|JOIN|.* JOIN|UPDATE|INTO|DELETE FROM|INSERT INTO)$/.test(up[i])
		)
			continue;
		const t = toks[i + 1];
		if (t && schema[t]) {
			inQuery.push(t);
			let a = toks[i + 2];
			if (a?.toUpperCase() === "AS") a = toks[i + 3];
			if (a && /^[a-z_]\w*$/i.test(a) && kindOf(a) === "ident") aliases.push(a);
		}
	}
	const scope = inQuery.length ? inQuery : tables;
	const columns = [...new Set(scope.flatMap((t) => schema[t] ?? []))];
	const isColumn = (t: string) =>
		columns.includes(t) ||
		columns.includes(t.split(".").pop() ?? "") ||
		tables.some((x) => schema[x]?.includes(t.split(".").pop() ?? ""));

	let clause = "";
	for (let i = up.length - 1; i >= 0; i--) {
		if (
			/^(SELECT|FROM|WHERE|ON|GROUP BY|HAVING|ORDER BY|LIMIT|SET|VALUES|RETURNING|INSERT INTO|UPDATE|DELETE FROM|.*JOIN)$/.test(
				up[i],
			)
		) {
			clause = up[i].endsWith("JOIN") ? "JOIN" : up[i];
			break;
		}
	}

	const OPS = [
		"=",
		"<>",
		">",
		"<",
		">=",
		"<=",
		"IS NULL",
		"IS NOT NULL",
		"LIKE",
		"IN",
		"BETWEEN",
	];
	const valuesFor = (col: string) => {
		const bare = col.split(".").pop() ?? col;
		const keys = [col, ...inQuery.map((t) => `${t}.${bare}`), bare];
		for (const k of keys)
			if (ctx.samples?.[k]) return ctx.samples[k].slice(0, 6);
		return [];
	};
	const afterTable = [
		"WHERE",
		"JOIN",
		"LEFT JOIN",
		"ORDER BY",
		"GROUP BY",
		"LIMIT",
		"AS",
		";",
	];
	let items: string[] = [];

	if (!toks.length)
		items = [
			"SELECT",
			"WITH",
			"INSERT INTO",
			"UPDATE",
			"DELETE FROM",
			"CREATE TABLE",
		];
	else if (last === ";") items = ["SELECT", "INSERT INTO", "UPDATE"];
	else if (clause === "SELECT" || clause === "RETURNING") {
		if (
			last === "SELECT" ||
			last === "," ||
			last === "DISTINCT" ||
			last === "RETURNING"
		)
			items = [
				...(last === "SELECT" ? ["*", "DISTINCT"] : []),
				...columns,
				...COMMON_FUNCS,
			];
		else if (last === "AS") items = [];
		else if (lastRaw.endsWith("(")) items = ["*", ...columns, "DISTINCT"];
		else items = [",", "FROM", "AS", ")", "+", "-", "*", "/", "||"];
	} else if (
		clause === "FROM" ||
		clause === "JOIN" ||
		clause === "UPDATE" ||
		clause === "INSERT INTO" ||
		clause === "DELETE FROM"
	) {
		if (
			/^(FROM|JOIN|UPDATE|INSERT INTO|DELETE FROM)$/.test(last) ||
			last.endsWith(" JOIN") ||
			last === ","
		)
			items = tables;
		else if (clause === "JOIN" && schema[lastRaw])
			items = ["ON", "AS", "USING"];
		else if (clause === "UPDATE") items = ["SET"];
		else if (clause === "INSERT INTO") items = ["(", "VALUES", "SELECT"];
		else items = afterTable;
	} else if (clause === "WHERE" || clause === "ON" || clause === "HAVING") {
		if (/^(WHERE|ON|HAVING|AND|OR|NOT|\()$/.test(last))
			items = [
				...columns,
				"NOT",
				"(",
				...(clause === "HAVING" ? COMMON_FUNCS : []),
			];
		else if (isColumn(lastRaw) || lastRaw === ")") items = OPS;
		else if (/^(=|<>|!=|>|<|>=|<=|LIKE|ILIKE)$/.test(last)) {
			const col = toks.at(-2) ?? "";
			items =
				clause === "ON"
					? columns.flatMap((c) => [c])
					: [...valuesFor(col), ...columns];
		} else if (last === "IN") items = ["("];
		else
			items = [
				"AND",
				"OR",
				...(clause === "WHERE" ? ["ORDER BY", "GROUP BY", "LIMIT"] : []),
				...(clause === "ON" ? ["WHERE", "JOIN", "ORDER BY"] : []),
				")",
				";",
			];
	} else if (clause === "GROUP BY" || clause === "ORDER BY") {
		if (last === "GROUP BY" || last === "ORDER BY" || last === ",")
			items = columns;
		else if (clause === "ORDER BY") items = ["ASC", "DESC", ",", "LIMIT", ";"];
		else items = [",", "HAVING", "ORDER BY", ";"];
	} else if (clause === "LIMIT")
		items = last === "LIMIT" ? ["1", "3", "5", "10"] : ["OFFSET", ";"];
	else if (clause === "SET")
		items =
			last === "SET" || last === ","
				? columns
				: last === "="
					? []
					: [",", "WHERE", "RETURNING", ";"];
	else if (clause === "VALUES") items = ["(", ",", ")", ";"];

	if (
		aliases.length &&
		(clause === "SELECT" || clause === "WHERE" || clause === "ON")
	)
		items = [...items, ...aliases.map((a) => `${a}.`)];

	const p = partial.toLowerCase();
	const seen = new Set<string>();
	const out: string[] = [];
	for (const it of items) {
		if (p && !it.toLowerCase().startsWith(p)) continue;
		if (p && it.toLowerCase() === p) continue;
		if (seen.has(it)) continue;
		seen.add(it);
		out.push(it);
		if (out.length >= 14) break;
	}
	// Typing a word nothing matches: offer the closest columns and tables anywhere.
	if (p && !out.length)
		for (const it of [
			...tables,
			...Object.values(schema).flat(),
			...(ctx.functions ?? []).map((f) => `${f}(`),
		])
			if (it.toLowerCase().startsWith(p) && !seen.has(it)) {
				seen.add(it);
				out.push(it);
				if (out.length >= 10) break;
			}
	return { partial, items: out };
}
