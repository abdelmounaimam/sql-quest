/**
 * Value normalisation.
 *
 * Two layers:
 *  - toDisplayValue: turns raw PGlite cells into JSON-safe values that the UI
 *    can render and that survive postMessage / JSON round trips.
 *  - canonicalize + valuesEqual: a comparison form where numeric strings and
 *    numbers are the same, JSON key order does not matter, vectors are number
 *    arrays and timestamps are instants.
 */

const DATE_ONLY_TYPES = new Set(["date"]);
const TIMESTAMP_TYPES = new Set(["timestamp", "timestamptz"]);

function pad(n: number, w = 2): string {
	return String(n).padStart(w, "0");
}

function isUtcMidnight(d: Date): boolean {
	return (
		d.getUTCHours() === 0 &&
		d.getUTCMinutes() === 0 &&
		d.getUTCSeconds() === 0 &&
		d.getUTCMilliseconds() === 0
	);
}

function dateOnly(d: Date): string {
	return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function bytesToHex(bytes: Uint8Array): string {
	let out = "\\x";
	for (const b of bytes) out += b.toString(16).padStart(2, "0");
	return out;
}

/** JSON-safe display form of a raw cell. */
export function toDisplayValue(value: unknown, typeName?: string): unknown {
	if (value === null || value === undefined) return null;
	if (typeof value === "bigint") {
		const n = Number(value);
		return Number.isSafeInteger(n) ? n : value.toString();
	}
	if (typeof value === "number") {
		if (Number.isNaN(value)) return "NaN";
		if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
		return value;
	}
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return String(value);
		const base = typeName?.replace(/^_/, "");
		if (base && DATE_ONLY_TYPES.has(base)) return dateOnly(value);
		if (base && TIMESTAMP_TYPES.has(base)) return value.toISOString();
		return isUtcMidnight(value) ? dateOnly(value) : value.toISOString();
	}
	if (value instanceof Uint8Array) return bytesToHex(value);
	if (Array.isArray(value)) {
		const elemType = typeName?.startsWith("_") ? typeName.slice(1) : typeName;
		return value.map((v) => toDisplayValue(v, elemType));
	}
	if (typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = toDisplayValue(v);
		}
		return out;
	}
	return value;
}

/** Display string for a cell (grids, diffs). */
export function formatCell(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

// ---------------------------------------------------------------------------
// Comparison form
// ---------------------------------------------------------------------------

export type Canon =
	| null
	| number
	| string
	| boolean
	| Canon[]
	| { [key: string]: Canon };

const NUMERIC_RE = /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/;
const VECTOR_RE =
	/^\[\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?(\s*,\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?)*\s*\]$/;
const TIMESTAMP_RE =
	/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2}(\.\d+)?)?)(Z|[+-]\d{2}(:?\d{2})?)?$/;

function canonString(s: string): Canon {
	if (NUMERIC_RE.test(s)) return Number(s);
	if (VECTOR_RE.test(s)) {
		return s
			.slice(1, -1)
			.split(",")
			.map((x) => Number(x.trim()));
	}
	const m = TIMESTAMP_RE.exec(s);
	if (m) {
		let tz = m[5] ?? "Z";
		if (/^[+-]\d{2}$/.test(tz)) tz = `${tz}:00`;
		else if (/^[+-]\d{4}$/.test(tz)) tz = `${tz.slice(0, 3)}:${tz.slice(3)}`;
		const d = new Date(`${m[1]}T${m[2]}${tz}`);
		if (!Number.isNaN(d.getTime())) {
			return isUtcMidnight(d) ? dateOnly(d) : d.toISOString();
		}
	}
	return s;
}

/** Comparison form of a (raw or display) value. */
export function canonicalize(value: unknown): Canon {
	if (value === null || value === undefined) return null;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "boolean") return value;
	if (typeof value === "string") return canonString(value);
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return String(value);
		return isUtcMidnight(value) ? dateOnly(value) : value.toISOString();
	}
	if (value instanceof Uint8Array) return bytesToHex(value);
	if (Array.isArray(value)) return value.map(canonicalize);
	if (typeof value === "object") {
		const out: { [key: string]: Canon } = {};
		for (const k of Object.keys(value as object).sort()) {
			out[k] = canonicalize((value as Record<string, unknown>)[k]);
		}
		return out;
	}
	return String(value);
}

export const DEFAULT_TOLERANCE = 1e-6;

function numbersEqual(a: number, b: number, tol: number): boolean {
	if (a === b) return true;
	const diff = Math.abs(a - b);
	if (diff <= tol) return true;
	return diff <= tol * Math.max(Math.abs(a), Math.abs(b));
}

/** Deep equality on canonical values with numeric tolerance. */
export function canonEqual(
	a: Canon,
	b: Canon,
	tol = DEFAULT_TOLERANCE,
): boolean {
	if (a === null || b === null) return a === b;
	if (typeof a === "number" && typeof b === "number")
		return numbersEqual(a, b, tol);
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!canonEqual(a[i], b[i], tol)) return false;
		}
		return true;
	}
	if (typeof a === "object" && typeof b === "object") {
		const ka = Object.keys(a);
		const kb = Object.keys(b);
		if (ka.length !== kb.length) return false;
		for (const k of ka) {
			if (!(k in b)) return false;
			if (!canonEqual(a[k], b[k], tol)) return false;
		}
		return true;
	}
	return a === b;
}

/** Convenience: equality of two raw/display values. */
export function valuesEqual(
	a: unknown,
	b: unknown,
	tol = DEFAULT_TOLERANCE,
): boolean {
	return canonEqual(canonicalize(a), canonicalize(b), tol);
}

/**
 * Bucket key for a canonical row: everything except numbers, so rows that may
 * be equal under tolerance always share a bucket.
 */
export function bucketKey(row: Canon[]): string {
	return JSON.stringify(row, (_k, v) => (typeof v === "number" ? "#" : v));
}

// ---------------------------------------------------------------------------
// Strict types (Check.strictTypes)
// ---------------------------------------------------------------------------

/**
 * Type family of a Postgres type name (pg_type.typname) for strict checks.
 * Choices (documented in the content contract):
 *  - int2 / int4 / int8 are one family ("integer"): count(*) is bigint,
 *    learners should not fail on int vs bigint.
 *  - numeric (and money) is "decimal", float4 / float8 is "float": exact vs
 *    approximate numbers are different types, which is the point of the
 *    World 8 type lessons.
 *  - text, varchar, bpchar, name, citext are "text".
 *  - date, time(tz), timestamp, timestamptz and interval are each their own
 *    family (timestamp vs timestamptz matters).
 *  - json and jsonb are "json"; arrays are "<element family>[]"; anything
 *    else (enums, ranges, domains, vector...) is its own type name.
 */
const FAMILY: Record<string, string> = {
	int2: "integer",
	int4: "integer",
	int8: "integer",
	numeric: "decimal",
	money: "decimal",
	float4: "float",
	float8: "float",
	text: "text",
	varchar: "text",
	bpchar: "text",
	name: "text",
	citext: "text",
	bool: "boolean",
	date: "date",
	time: "time",
	timetz: "time",
	timestamp: "timestamp",
	timestamptz: "timestamptz",
	interval: "interval",
	json: "json",
	jsonb: "json",
	uuid: "uuid",
	bytea: "bytea",
};

export function typeFamily(typeName: string | undefined): string | undefined {
	if (!typeName) return undefined;
	if (typeName.startsWith("_")) {
		const el = typeFamily(typeName.slice(1));
		return el ? `${el}[]` : undefined;
	}
	return FAMILY[typeName] ?? typeName;
}

const PRETTY: Record<string, string> = {
	int2: "smallint",
	int4: "integer",
	int8: "bigint",
	float4: "real",
	float8: "double precision",
	bpchar: "char",
	varchar: "varchar",
	bool: "boolean",
	timestamptz: "timestamptz",
	timetz: "timetz",
};

/** Human name of a pg type name (int4 -> integer, _text -> text[]). */
export function prettyType(typeName: string | undefined): string {
	if (!typeName) return "unknown";
	if (typeName.startsWith("_")) return `${prettyType(typeName.slice(1))}[]`;
	return PRETTY[typeName] ?? typeName;
}

/** JSON values compared without coercion: "25" stays a string. */
function canonJsonStrict(value: unknown): Canon {
	if (value === null || value === undefined) return null;
	if (typeof value === "number" || typeof value === "boolean") return value;
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(canonJsonStrict);
	if (typeof value === "object") {
		const out: { [key: string]: Canon } = {};
		for (const k of Object.keys(value as object).sort()) {
			out[k] = canonJsonStrict((value as Record<string, unknown>)[k]);
		}
		return out;
	}
	return String(value);
}

/**
 * Comparison form that respects the column type: numeric-looking strings
 * become numbers only in number columns (int8 / numeric arrive as text);
 * text columns keep strings as they are; json keeps "25" distinct from 25.
 */
export function canonicalizeTyped(
	value: unknown,
	typeName: string | undefined,
): Canon {
	const fam = typeFamily(typeName);
	if (value === null || value === undefined) return null;
	if (fam === undefined) return canonicalize(value);
	const base = fam.replace(/(\[\])+$/, "");
	if (Array.isArray(value)) {
		const el = typeName?.startsWith("_") ? typeName.slice(1) : typeName;
		return value.map((v) => canonicalizeTyped(v, el));
	}
	if (base === "json") {
		// json (not jsonb) arrives as raw text; jsonb arrives parsed, where a
		// JS string is a JSON string scalar ("7") and must stay one.
		if (typeof value === "string" && typeName === "json") {
			try {
				return canonJsonStrict(JSON.parse(value));
			} catch {
				return value;
			}
		}
		return canonJsonStrict(value);
	}
	if (base === "text" || base === "uuid" || base === "bytea") {
		return typeof value === "string" ? value : canonicalize(value);
	}
	return canonicalize(value);
}
