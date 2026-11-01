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
	/**
	 * Long solutions are built one part at a time: the bank only shows the
	 * tiles of the first part that still has tiles to place. -1: always shown.
	 */
	page?: number;
	/** From the starter only (a word to fix): matched last by toTiles. */
	spare?: boolean;
	/** A distractor: not part of the reference solution. */
	decoy?: boolean;
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

/**
 * Keyword runs that read as one tile ("GROUP BY", "IS NOT NULL"). For the
 * same first word, longer phrases come first.
 */
const PHRASES: string[][] = [
	["is", "not", "distinct", "from"],
	["is", "distinct", "from"],
	["is", "not", "null"],
	["is", "null"],
	["not", "null"],
	["not", "exists"],
	["not", "in"],
	["not", "like"],
	["not", "ilike"],
	["not", "between"],
	["group", "by"],
	["order", "by"],
	["partition", "by"],
	["left", "outer", "join"],
	["left", "join"],
	["right", "outer", "join"],
	["right", "join"],
	["full", "outer", "join"],
	["full", "join"],
	["inner", "join"],
	["cross", "join"],
	["natural", "join"],
	["union", "all"],
	["insert", "into"],
	["delete", "from"],
	["merge", "into"],
	["primary", "key"],
	["foreign", "key"],
	["create", "or", "replace"],
	["create", "unique", "index"],
	["create", "materialized", "view"],
	["create", "table"],
	["create", "index"],
	["create", "view"],
	["alter", "table"],
	["alter", "column"],
	["drop", "table"],
	["drop", "index"],
	["drop", "view"],
	["drop", "column"],
	["drop", "constraint"],
	["drop", "not", "null"],
	["add", "column"],
	["add", "constraint"],
	["set", "not", "null"],
	["on", "conflict"],
	["on", "delete", "cascade"],
	["on", "delete", "set", "null"],
	["on", "delete", "restrict"],
	["on", "update", "cascade"],
	["do", "nothing"],
	["do", "update", "set"],
	["when", "not", "matched"],
	["when", "matched"],
	["if", "not", "exists"],
	["if", "exists"],
	["nulls", "first"],
	["nulls", "last"],
	["double", "precision"],
	["fetch", "first"],
	["fetch", "next"],
	["rows", "with", "ties"],
	["rows", "only"],
	["row", "only"],
	["unbounded", "preceding"],
	["unbounded", "following"],
	["current", "row"],
	["within", "group"],
	["at", "time", "zone"],
	["distinct", "on"],
	["default", "values"],
	["generated", "always", "as", "identity"],
	["generated", "always", "as"],
	["for", "update"],
	["for", "share"],
	["skip", "locked"],
	["start", "transaction"],
	["isolation", "level"],
	["repeatable", "read"],
	["read", "committed"],
];
const PHRASE_TEXT = new Set(PHRASES.map((p) => p.join(" ").toUpperCase()));

/** Clauses that start a new line when tiles are rendered. */
const CLAUSES = new Set([
	"SELECT",
	"FROM",
	"WHERE",
	"GROUP BY",
	"HAVING",
	"ORDER BY",
	"LIMIT",
	"OFFSET",
	"FETCH FIRST",
	"FETCH NEXT",
	"JOIN",
	"LEFT JOIN",
	"LEFT OUTER JOIN",
	"RIGHT JOIN",
	"RIGHT OUTER JOIN",
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
	"DO UPDATE SET",
	"WHEN MATCHED",
	"WHEN NOT MATCHED",
	"WINDOW",
]);

const RAW =
	/\$([A-Za-z_]\w*)?\$[\s\S]*?\$\1\$|[Ee]?'(?:[^']|'')*'?|"[^"]*"?|[A-Za-z_][A-Za-z0-9_$]*(?:\.(?:[A-Za-z_][A-Za-z0-9_$]*|\*))*\(?|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|<=>|<->|<#>|<<=|>>=|-\|-|->>|#>>|::|->|#>|#-|=>|@>|<@|@\?|@@|<<|>>|\?\||\?&|<>|<=|>=|!=|\|\||&&|~~\*|!~~|~~|!~\*|!~|~\*|[^\s]/g;

function stripComments(sql: string): string {
	return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

const isQuoted = (t: string) =>
	t.startsWith("'") ||
	t.startsWith('"') ||
	t.startsWith("$") ||
	/^[Ee]'/.test(t);

export function kindOf(tok: string): TokenKind {
	if (tok.startsWith("'") || tok.startsWith("$") || /^[Ee]'/.test(tok))
		return "string";
	if (/^\d/.test(tok)) return "number";
	// A cast glued to its type ("::INT") reads as a type name.
	if (tok.startsWith("::") && tok.length > 2) return "keyword";
	if (tok.endsWith("(") && tok.length > 1) return "function";
	if (/^[A-Za-z_][\w.]*\(\*?\)$/.test(tok)) return "function";
	if (tok.startsWith("(") && tok.length > 1) return "ident";
	if (/^[A-Za-z]/.test(tok)) {
		const up = tok.toUpperCase();
		if (PHRASE_TEXT.has(up)) return "keyword";
		if (up.split(" ").every((w) => KEYWORDS.has(w.toLowerCase())))
			return "keyword";
		return "ident";
	}
	if (/^[(),;.]$/.test(tok)) return "punct";
	return "operator";
}

const isIdent = (t: string | undefined) =>
	!!t && /^[A-Za-z_"]/.test(t) && kindOf(t) === "ident";
const isOpener = (t: string) => t === "(" || (t.endsWith("(") && t.length > 1);

/**
 * Glue runs that read as one word into one tile, so banks stay short:
 * `(stats).wis`, `tags[1]`, `::INT`, `count(*)`, `now()`.
 */
function chunk(toks: string[]): string[] {
	const out: string[] = [];
	for (let i = 0; i < toks.length; i++) {
		const t = toks[i];
		// Composite field access: ( col ) . field
		if (
			t === "(" &&
			isIdent(toks[i + 1]) &&
			toks[i + 2] === ")" &&
			toks[i + 3] === "." &&
			(isIdent(toks[i + 4]) || toks[i + 4] === "*")
		) {
			out.push(`(${toks[i + 1]}).${toks[i + 4]}`);
			i += 4;
			continue;
		}
		// Array subscript or slice: name [ 1 ] / name [ 1 : 2 ]
		if (t === "[" && out.length && isIdent(out.at(-1))) {
			let j = i + 1;
			while (
				j < toks.length &&
				j - i <= 4 &&
				toks[j] !== "]" &&
				toks[j] !== "," &&
				toks[j] !== "["
			)
				j++;
			if (toks[j] === "]" && j > i + 1) {
				out[out.length - 1] += toks.slice(i, j + 1).join("");
				i = j;
				continue;
			}
		}
		// Cast: :: type  (and :: type [ ])
		if (t === "::") {
			const ty = toks[i + 1];
			if (ty && /^[A-Za-z_]/.test(ty) && !ty.endsWith("(")) {
				let text = `::${ty}`;
				let k = i + 1;
				if (toks[k + 1] === "[" && toks[k + 2] === "]") {
					text += "[]";
					k += 2;
				}
				out.push(text);
				i = k;
				continue;
			}
		}
		// count(*) and calls with no arguments
		if (t.endsWith("(") && t.length > 1) {
			if (toks[i + 1] === ")") {
				out.push(`${t})`);
				i += 1;
				continue;
			}
			if (toks[i + 1] === "*" && toks[i + 2] === ")") {
				out.push(`${t}*)`);
				i += 2;
				continue;
			}
		}
		out.push(t);
	}
	return out;
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
	return chunk(out);
}

const NO_SPACE_BEFORE = new Set([",", ")", ";", "::", ".", "[", "]"]);
const NO_SPACE_AFTER = new Set(["(", "::", ".", "["]);

/** True when no space goes between `prev` and `t` ("count(" "*", "a" ","). */
export function glued(prev: string, t: string): boolean {
	return (
		NO_SPACE_BEFORE.has(t) ||
		t.startsWith("::") ||
		NO_SPACE_AFTER.has(prev) ||
		prev.endsWith("(")
	);
}

export interface LineInfo {
	/** The token starts a new line. */
	brk: boolean;
	/** Subquery depth of that line (indent steps). */
	indent: number;
}

/**
 * Where lines break when tiles are laid out: before each clause keyword
 * that is not inside a function call, after each `;`. Clauses of a
 * subquery are indented by its depth.
 */
export function layout(tokens: string[]): LineInfo[] {
	// One entry per open paren: true when it holds a subquery.
	const stack: boolean[] = [];
	return tokens.map((t, i) => {
		const prev = tokens[i - 1] ?? "";
		const inCall = stack.some((s) => !s);
		let brk = false;
		if (i > 0) {
			if (prev === ";") brk = true;
			else if (!inCall && CLAUSES.has(t))
				brk =
					!isOpener(prev) &&
					!(t === "SELECT" && /^(EXPLAIN|ANALYZE|AS)$/.test(prev)) &&
					!(t === "SET" && prev === "UPDATE");
		}
		const info = { brk, indent: brk ? stack.length : 0 };
		if (isOpener(t))
			stack.push(
				t === "(" && /^(SELECT|WITH|VALUES)$/.test(tokens[i + 1] ?? ""),
			);
		else if (t === ")") stack.pop();
		return info;
	});
}

/** For each token, whether it starts a new line. */
export function lineStarts(tokens: string[]): boolean[] {
	return layout(tokens).map((l) => l.brk);
}

/** Tiles back to SQL, one clause per line, subqueries indented. */
export function render(tokens: string[]): string {
	const lines = layout(tokens);
	let s = "";
	let prev = "";
	tokens.forEach((t, i) => {
		if (!s) s = t;
		else if (lines[i].brk) s += `\n${"  ".repeat(lines[i].indent)}${t}`;
		else if (glued(prev, t)) s += t;
		else s += ` ${t}`;
		prev = t;
	});
	return s;
}

export function startsClause(tok: string): boolean {
	return CLAUSES.has(tok);
}

/**
 * Comparison key: SQL folds unquoted words to one case, so `Count(` and
 * `count(` are the same tile; quoted text is compared as written.
 */
const canon = (t: string) => (isQuoted(t) ? t : t.toUpperCase());

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
	"!=": ["="],
	">": ["<", ">="],
	"<": [">", "<="],
	">=": [">"],
	"<=": ["<"],
	"IS NULL": ["= NULL", "IS NOT NULL"],
	"IS NOT NULL": ["IS NULL", "<> NULL"],
	"IS DISTINCT FROM": ["<>"],
	"IS NOT DISTINCT FROM": ["="],
	JOIN: ["LEFT JOIN"],
	"LEFT JOIN": ["JOIN", "RIGHT JOIN"],
	"RIGHT JOIN": ["LEFT JOIN"],
	"FULL JOIN": ["LEFT JOIN"],
	"CROSS JOIN": ["JOIN"],
	ON: ["USING"],
	"GROUP BY": ["ORDER BY"],
	"ORDER BY": ["GROUP BY"],
	"PARTITION BY": ["GROUP BY"],
	"COUNT(": ["sum("],
	"COUNT(*)": ["count("],
	"SUM(": ["count(", "avg("],
	"AVG(": ["sum("],
	"MIN(": ["max("],
	"MAX(": ["min("],
	"UPPER(": ["lower("],
	"LOWER(": ["upper("],
	"COALESCE(": ["nullif("],
	"NULLIF(": ["coalesce("],
	"ROW_NUMBER(": ["rank("],
	"ROW_NUMBER()": ["rank()"],
	"RANK(": ["dense_rank("],
	"RANK()": ["dense_rank()"],
	"DENSE_RANK(": ["rank("],
	"DENSE_RANK()": ["rank()"],
	"LAG(": ["lead("],
	"LEAD(": ["lag("],
	LIKE: ["ILIKE", "="],
	ILIKE: ["LIKE"],
	"NOT LIKE": ["NOT ILIKE"],
	IN: ["="],
	"NOT IN": ["NOT EXISTS"],
	EXISTS: ["IN"],
	"NOT EXISTS": ["NOT IN"],
	BETWEEN: ["IN"],
	"UNION ALL": ["UNION"],
	UNION: ["UNION ALL"],
	INTERSECT: ["EXCEPT"],
	EXCEPT: ["INTERSECT"],
	DISTINCT: ["ALL"],
	"DISTINCT ON": ["DISTINCT"],
	LIMIT: ["OFFSET"],
	OFFSET: ["LIMIT"],
	"ROWS WITH TIES": ["ROWS ONLY"],
	"ROWS ONLY": ["ROWS WITH TIES"],
	"*": [","],
	"->": ["->>"],
	"->>": ["->"],
	"#>": ["#>>"],
	"#>>": ["#>"],
	"@>": ["<@"],
	"<@": ["@>"],
	"&&": ["@>"],
	"<->": ["<=>"],
	"<=>": ["<->"],
	"<#>": ["<=>"],
	VALUES: ["SET"],
	COMMIT: ["ROLLBACK"],
	ROLLBACK: ["COMMIT"],
	"DO NOTHING": ["DO UPDATE SET"],
	"DO UPDATE SET": ["DO NOTHING"],
	"WHEN MATCHED": ["WHEN NOT MATCHED"],
	"WHEN NOT MATCHED": ["WHEN MATCHED"],
	USING: ["FROM"],
	"ON DELETE CASCADE": ["ON DELETE SET NULL"],
	"ON DELETE SET NULL": ["ON DELETE CASCADE"],
	"PRIMARY KEY": ["UNIQUE"],
	UNIQUE: ["PRIMARY KEY"],
};

/** Casts that are easy to mix up, by target type. */
const CAST_LOOKALIKES: Record<string, string[]> = {
	INT: ["::NUMERIC", "::TEXT"],
	INTEGER: ["::NUMERIC", "::TEXT"],
	BIGINT: ["::INT"],
	NUMERIC: ["::INT"],
	TEXT: ["::INT"],
	DATE: ["::TIMESTAMP", "::TEXT"],
	TIMESTAMP: ["::DATE"],
	TIMESTAMPTZ: ["::TIMESTAMP"],
	JSONB: ["::JSON", "::TEXT"],
	JSON: ["::JSONB"],
	BOOLEAN: ["::INT"],
	INTERVAL: ["::TEXT"],
};

/**
 * Chapter where a word is first taught: it is never offered as a
 * distractor before that (no HAVING in chapter 2).
 */
const TAUGHT_IN: Record<string, number> = {
	LIKE: 2,
	IN: 2,
	BETWEEN: 2,
	"IS NULL": 3,
	"IS NOT NULL": 3,
	"= NULL": 3,
	"<> NULL": 3,
	"IS DISTINCT FROM": 3,
	"ORDER BY": 4,
	ASC: 4,
	DESC: 4,
	LIMIT: 4,
	OFFSET: 4,
	DISTINCT: 4,
	ALL: 12,
	"ROWS ONLY": 4,
	"ROWS WITH TIES": 4,
	ILIKE: 6,
	"NOT ILIKE": 6,
	"UPPER(": 6,
	"LOWER(": 6,
	"COUNT(": 8,
	"SUM(": 8,
	"AVG(": 8,
	"MIN(": 8,
	"MAX(": 8,
	"GROUP BY": 8,
	HAVING: 8,
	JOIN: 9,
	USING: 9,
	"LEFT JOIN": 10,
	"RIGHT JOIN": 10,
	"FULL JOIN": 10,
	"CROSS JOIN": 10,
	"COALESCE(": 10,
	"NULLIF(": 10,
	"NOT IN": 11,
	EXISTS: 12,
	"NOT EXISTS": 12,
	UNION: 13,
	"UNION ALL": 13,
	INTERSECT: 13,
	EXCEPT: 13,
	"PARTITION BY": 15,
	"RANK(": 15,
	"RANK()": 15,
	"DENSE_RANK(": 15,
	"DENSE_RANK()": 15,
	"LAG(": 15,
	"LEAD(": 15,
	"DISTINCT ON": 16,
	SET: 20,
	COMMIT: 21,
	ROLLBACK: 21,
	"DO NOTHING": 22,
	"DO UPDATE SET": 22,
	"WHEN MATCHED": 22,
	"WHEN NOT MATCHED": 22,
	"PRIMARY KEY": 24,
	UNIQUE: 25,
	"ON DELETE CASCADE": 25,
	"ON DELETE SET NULL": 25,
	"::INT": 29,
	"::NUMERIC": 29,
	"::TEXT": 29,
	"::DATE": 29,
	"::TIMESTAMP": 29,
	"@>": 30,
	"<@": 30,
	"&&": 30,
	"->": 31,
	"->>": 31,
	"::JSON": 31,
	"::JSONB": 31,
	"#>": 32,
	"#>>": 32,
	"<->": 36,
	"<=>": 36,
	"<#>": 36,
};

/** Chapter number from an exercise id ("ch05-ex06", "ch07-calendars::try-2"). */
export function chapterOf(id: string): number | undefined {
	const m = /^ch(\d+)/.exec(id);
	return m ? Number(m[1]) : undefined;
}

/** Plausible wrong tiles for one solution tile. */
function lookalikesOf(t: string): string[] {
	const out = [...(LOOKALIKES[canon(t)] ?? [])];
	// "Head Count" (a quoted name) vs 'Head Count' (a string).
	if (t.startsWith('"') && t.length > 2) out.push(`'${t.slice(1, -1)}'`);
	// 'Kepler''s Rest' vs the broken 'Kepler's Rest'.
	if (t.startsWith("'") && t.slice(1, -1).includes("''"))
		out.push(`'${t.slice(1, -1).replaceAll("''", "'")}'`);
	if (t.startsWith("::")) {
		const ty = t.slice(2).toUpperCase();
		out.push(...(CAST_LOOKALIKES[ty] ?? (ty === "TEXT" ? [] : ["::TEXT"])));
	}
	const q = /^(excluded|new|old)\.(.+)$/i.exec(t);
	if (q)
		out.push(
			`${q[1].toLowerCase() === "excluded" ? "new" : "excluded"}.${q[2]}`,
		);
	return out;
}

/** Longest solution (in tiles, after chunking) that still gets a word bank. */
export const WORD_BANK_MAX = 130;
/** Above this many tiles the bank is split into parts built one at a time. */
const PAGE_FROM = 28;
/** Most solution tiles shown at once in a part. */
const PAGE_SIZE = 22;

/**
 * Split a long solution into parts at natural seams: statements first,
 * then top-level clauses, then top-level commas.
 */
function paginate(sol: string[]): number[] {
	if (sol.length <= PAGE_FROM) return sol.map(() => 0);
	const lines = layout(sol);
	const pieces: [number, number][] = [];
	let start = 0;
	let depth = 0;
	for (let i = 0; i < sol.length; i++) {
		const seam =
			i > start &&
			(sol[i - 1] === ";" ||
				(depth === 0 && (lines[i].brk || sol[i - 1] === ",")));
		if (seam) {
			pieces.push([start, i]);
			start = i;
		}
		if (isOpener(sol[i])) depth++;
		else if (sol[i] === ")") depth = Math.max(0, depth - 1);
	}
	pieces.push([start, sol.length]);
	// Pieces too long for one part are cut evenly.
	const cut: [number, number][] = [];
	for (const [a, b] of pieces) {
		const n = Math.ceil((b - a) / PAGE_SIZE);
		const step = Math.ceil((b - a) / n);
		for (let x = a; x < b; x += step) cut.push([x, Math.min(b, x + step)]);
	}
	const page = sol.map(() => 0);
	let p = 0;
	let size = 0;
	cut.forEach(([a, b], k) => {
		const len = b - a;
		const newStatement = k > 0 && sol[a - 1] === ";";
		if (size && (size + len > PAGE_SIZE || (newStatement && size >= 12))) {
			p++;
			size = 0;
		}
		for (let i = a; i < b; i++) page[i] = p;
		size += len;
	});
	// No tiny last part: fold it into the one before when that stays small.
	const last = page.filter((x) => x === p).length;
	if (p > 0 && last < 6 && page.filter((x) => x === p - 1).length + last <= 26)
		for (let i = 0; i < page.length; i++) if (page[i] === p) page[i] = p - 1;
	return page;
}

export interface BankOptions {
	/** Pre-filled SQL: its tiles are added so it can be laid out to start from. */
	starterSql?: string;
	/** Chapter of the exercise (defaults to the one in the seed). */
	chapter?: number;
}

/**
 * Duolingo-style bank: every tile of the reference solution plus a few
 * plausible distractors, shuffled the same way every time for an exercise.
 * The starter's tiles that the solution does not use are added too, so a
 * query to fix can be laid out and repaired. Returns null when the solution
 * is too long to build by tapping.
 */
export function buildBank(
	solutionSql: string,
	seed: string,
	schema?: Record<string, string[]>,
	opts: BankOptions = {},
): Tile[] | null {
	const sol = tokenize(solutionSql);
	if (!sol.length || sol.length > WORD_BANK_MAX) return null;
	const rand = rng(hash(seed));
	const chapter = opts.chapter ?? chapterOf(seed) ?? 99;
	const taught = (t: string) => (TAUGHT_IN[canon(t)] ?? 0) <= chapter;
	const have = new Set(sol.map(canon));

	// Starter tiles the solution does not need (what is to be fixed).
	const extra: string[] = [];
	if (opts.starterSql?.trim()) {
		const left = new Map<string, number>();
		for (const t of sol) left.set(canon(t), (left.get(canon(t)) ?? 0) + 1);
		for (const t of tokenize(opts.starterSql)) {
			const n = left.get(canon(t)) ?? 0;
			if (n > 0) left.set(canon(t), n - 1);
			else extra.push(t);
		}
		// A starter that shares little with the solution is not laid out.
		if (extra.length > 12) extra.length = 0;
	}
	// Laid out from a starter, the learner edits in any order: one part.
	const laidOut =
		!!opts.starterSql?.trim() &&
		(extra.length > 0 || sol.length > tokenize(opts.starterSql).length);
	const pageOf = laidOut ? sol.map(() => 0) : paginate(sol);
	const pages = Math.max(...pageOf) + 1;
	const taken = new Set([...have, ...extra.map(canon)]);

	// Columns of the tables the solution reads, and at most one related table.
	const colPool: string[] = [];
	let tablePick: string | null = null;
	if (schema) {
		const tables = Object.keys(schema);
		const used = tables.filter((t) => have.has(canon(t)));
		for (const t of used) for (const c of schema[t] ?? []) colPool.push(c);
		// Related: one table holds the other's key ("pilots.faction_id").
		const one = (t: string) => t.replace(/(e?s)$/, "");
		const linked = (a: string, b: string) =>
			(schema[a] ?? []).some((c) => c === `${one(b)}_id` || c === `${b}_id`);
		const related = tables.filter(
			(t) =>
				!used.includes(t) && used.some((u) => linked(u, t) || linked(t, u)),
		);
		if (used.length && related.length)
			tablePick = related[Math.floor(rand() * related.length)];
	}

	const want = (n: number) => {
		const base = pages > 1 ? 2 : n <= 6 ? 3 : n <= 20 ? 4 : 3;
		return Math.max(1, base - (pages > 1 ? 0 : Math.min(2, extra.length)));
	};
	const tiles: Tile[] = [];
	let id = 0;
	const add = (text: string, page: number, flag?: "spare" | "decoy") =>
		tiles.push({
			id: `t${id++}`,
			text,
			kind: kindOf(text),
			page,
			...(flag ? { [flag]: true } : {}),
		});
	let tableUsed = false;
	for (let p = 0; p < pages; p++) {
		const mine = sol.filter((_, i) => pageOf[i] === p);
		const looks = shuffle(
			[...new Set(mine.flatMap(lookalikesOf))].filter(
				(l) => taught(l) && !taken.has(canon(l)),
			),
			rand,
		);
		const cols = shuffle(
			[...new Set(colPool)].filter((c) => !taken.has(canon(c))),
			rand,
		);
		const n = want(mine.length);
		const picks: string[] = [];
		// Lookalikes first (they teach), then at most half columns, then a table.
		for (const l of looks) if (picks.length < n) picks.push(l);
		for (const c of cols)
			if (picks.length < n && picks.length < Math.max(1, Math.ceil(n / 2)) + 1)
				picks.push(c);
		if (
			picks.length < n &&
			tablePick &&
			!tableUsed &&
			!taken.has(canon(tablePick))
		) {
			picks.push(tablePick);
			tableUsed = true;
		}
		for (const x of picks) taken.add(canon(x));
		const group = shuffle(
			[
				...mine.map((t) => [t, false] as const),
				...picks.map((t) => [t, true] as const),
			],
			rand,
		);
		for (const [t, decoy] of group) add(t, p, decoy ? "decoy" : undefined);
	}
	// Starter leftovers: shown with the first part (always, when paged).
	for (const t of extra) add(t, pages > 1 ? -1 : 0, "spare");
	return pages === 1 ? shuffle(tiles, rand) : tiles;
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
	// Solution tiles first, starter leftovers only when nothing else fits.
	const free = [
		...bank.filter((b) => !b.spare),
		...bank.filter((b) => b.spare),
	];
	const ids: string[] = [];
	for (const t of tokens) {
		const i = free.findIndex((b) => canon(b.text) === canon(t));
		if (i < 0) return null;
		ids.push(free[i].id);
		free.splice(i, 1);
	}
	return ids;
}

/**
 * Where the learner starts in a pre-filled query: when the starter only
 * lacks tiles (a skeleton or a query to extend), the first gap to fill.
 * Null when tiles must be changed (a query to fix) or nothing is missing.
 */
export function firstGap(
	starterSql: string,
	solutionSql: string,
): number | null {
	const a = tokenize(starterSql).map(canon);
	const b = tokenize(solutionSql).map(canon);
	// a must be a subsequence of b.
	let j = 0;
	for (const t of b) if (j < a.length && t === a[j]) j++;
	if (j < a.length) return null;
	let k = 0;
	while (k < a.length && a[k] === b[k]) k++;
	return k < a.length ? k : null;
}

/** True when the pre-filled SQL has tiles that must go (a real fix). */
export function needsFix(starterSql: string, solutionSql: string): boolean {
	const left = new Map<string, number>();
	for (const t of tokenize(solutionSql))
		left.set(canon(t), (left.get(canon(t)) ?? 0) + 1);
	for (const t of tokenize(starterSql)) {
		const n = left.get(canon(t)) ?? 0;
		if (n <= 0) return true;
		left.set(canon(t), n - 1);
	}
	return false;
}

// ───────────────────────────── keyboard suggestions

export interface SuggestContext {
	schema?: Record<string, string[]>;
	/** Sample values keyed by "table.column" and by bare "column". */
	samples?: Record<string, string[]>;
	functions?: string[];
	/** SQL after the cursor, so aliases and tables named later still count. */
	after?: string;
	/** What the task is about, ranked first when nothing narrows it down. */
	task?: TaskHints;
}

export interface TaskHints {
	/** Tables the task works on. */
	tables: string[];
	/** Functions the task uses ("regexp_replace"). */
	functions: string[];
	/** Statement openers the task needs ("INSERT INTO", "WITH"). */
	starters: string[];
	/** Chapter, to keep statements not taught yet out of the strip. */
	chapter?: number;
}

/** Tables, functions and statements of the reference solution (and starter). */
export function taskHints(
	solutionSql: string,
	starterSql: string | undefined,
	schema: Record<string, string[]> | undefined,
	seed?: string,
): TaskHints {
	const toks = [
		...tokenize(solutionSql),
		...(starterSql ? tokenize(starterSql) : []),
	];
	const tables = Object.keys(schema ?? {}).filter((t) =>
		toks.some((x) => x === t || x.toLowerCase() === t),
	);
	const functions = [
		...new Set(
			toks
				.filter((t) => kindOf(t) === "function")
				.map((t) => t.replace(/\(.*$/, "").toLowerCase()),
		),
	];
	const starters: string[] = [];
	toks.forEach((t, i) => {
		if ((i === 0 || toks[i - 1] === ";") && STATEMENTS.includes(t))
			starters.push(t);
	});
	return {
		tables,
		functions,
		starters: [...new Set(starters)],
		chapter: seed ? chapterOf(seed) : undefined,
	};
}

export interface Suggestions {
	/** Partial word under the cursor that a pick replaces ("" when none). */
	partial: string;
	items: string[];
}

const STATEMENTS = [
	"SELECT",
	"WITH",
	"EXPLAIN",
	"INSERT INTO",
	"UPDATE",
	"DELETE FROM",
	"MERGE INTO",
	"BEGIN",
	"COMMIT",
	"ROLLBACK",
	"CREATE TABLE",
	"CREATE INDEX",
	"CREATE VIEW",
	"ALTER TABLE",
	"DROP TABLE",
];
/** Chapter where each statement opener is taught. */
const STATEMENT_FROM: Record<string, number> = {
	EXPLAIN: 37,
	"INSERT INTO": 19,
	UPDATE: 20,
	"DELETE FROM": 20,
	BEGIN: 21,
	COMMIT: 21,
	ROLLBACK: 21,
	"MERGE INTO": 22,
	"CREATE TABLE": 24,
	"ALTER TABLE": 25,
	"DROP TABLE": 24,
	"CREATE VIEW": 27,
	"CREATE INDEX": 38,
};

const COMMON_FUNCS = ["count(", "sum(", "avg(", "min(", "max(", "coalesce("];
/** Functions worth offering while typing (the catalog also lists internals). */
const KNOWN_FUNCS = new Set(
	`count sum avg min max coalesce nullif greatest least abs round ceil floor trunc mod power sqrt random
	length char_length lower upper initcap trim ltrim rtrim btrim substring substr left right replace concat concat_ws
	split_part position strpos reverse repeat lpad rpad format regexp_replace regexp_match regexp_matches regexp_split_to_table
	string_agg array_agg json_agg jsonb_agg json_build_object jsonb_build_object jsonb_object_agg to_json to_jsonb
	jsonb_array_elements jsonb_array_elements_text jsonb_each jsonb_each_text jsonb_typeof jsonb_set jsonb_path_query
	jsonb_path_exists jsonb_array_length array_length cardinality unnest array_position array_append array_remove
	now current_date date_trunc date_part extract age make_date make_interval to_char to_date to_timestamp
	generate_series row_number rank dense_rank percent_rank cume_dist ntile lag lead first_value last_value nth_value
	percentile_cont percentile_disc mode bool_and bool_or every stddev variance corr
	to_tsvector to_tsquery plainto_tsquery websearch_to_tsquery ts_rank ts_headline similarity
	gen_random_uuid md5 pg_typeof cast range lower_inc upper_inc isempty tstzrange daterange int4range numrange
	nextval currval setval pg_sleep txid_current`.split(/\s+/),
);

const TYPES = [
	"INT",
	"NUMERIC",
	"TEXT",
	"DATE",
	"TIMESTAMP",
	"TIMESTAMPTZ",
	"BOOLEAN",
	"BIGINT",
	"INTERVAL",
	"JSONB",
	"VARCHAR(",
	"NUMERIC(",
];
const CMP =
	/^(=|<>|!=|>|<|>=|<=|LIKE|ILIKE|NOT LIKE|NOT ILIKE|IS DISTINCT FROM|IS NOT DISTINCT FROM|@>|<@|&&|->>|->|\?|~|~\*)$/;
const CLAUSE_RE =
	/^(SELECT|FROM|WHERE|ON|USING|GROUP BY|HAVING|ORDER BY|PARTITION BY|LIMIT|OFFSET|SET|DO UPDATE SET|VALUES|RETURNING|INSERT INTO|UPDATE|DELETE FROM|MERGE INTO|ALTER TABLE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX|ON CONFLICT|WHEN MATCHED|WHEN NOT MATCHED|THEN|WITH|REFERENCES|.*JOIN)$/;
const KEYWORD_FALLBACK = [
	"SELECT",
	"FROM",
	"WHERE",
	"GROUP BY",
	"HAVING",
	"ORDER BY",
	"LIMIT",
	"OFFSET",
	"DISTINCT",
	"JOIN",
	"LEFT JOIN",
	"ON",
	"USING",
	"AND",
	"OR",
	"NOT",
	"NULL",
	"IS NULL",
	"IS NOT NULL",
	"BETWEEN",
	"LIKE",
	"ILIKE",
	"IN",
	"EXISTS",
	"CASE",
	"WHEN",
	"THEN",
	"ELSE",
	"END",
	"AS",
	"ASC",
	"DESC",
	"UNION",
	"UNION ALL",
	"EXCEPT",
	"INTERSECT",
	"OVER (",
	"PARTITION BY",
	"FILTER (",
	"RETURNING",
	"VALUES",
	"SET",
	"DEFAULT",
	"PRIMARY KEY",
	"REFERENCES",
	"NOT NULL",
	"UNIQUE",
	"CHECK (",
	"CONSTRAINT",
	"ON CONFLICT",
	"DO NOTHING",
	"DO UPDATE SET",
	"WHEN MATCHED",
	"WHEN NOT MATCHED",
	"TRUE",
	"FALSE",
	"INTERVAL",
	"ANALYZE",
];

/** The statement around the cursor: from the last `;` before to the next one after. */
function statementAround(before: string, after: string): string[] {
	const b = tokenize(before);
	const a = tokenize(after);
	const s = b.lastIndexOf(";");
	const e = a.indexOf(";");
	return [...b.slice(s + 1), ...(e < 0 ? a : a.slice(0, e))];
}

interface Frame {
	/** Tokens of this paren level; closed inner groups show as opener + ")". */
	toks: string[];
	/** The token that opened it ("(", "count("), "" at top level. */
	opener: string;
}

/** Nesting of the SQL before the cursor, innermost frame last. */
function frames(toks: string[]): Frame[] {
	const stack: Frame[] = [{ toks: [], opener: "" }];
	for (const t of toks) {
		const top = stack[stack.length - 1];
		if (isOpener(t)) {
			top.toks.push(t);
			stack.push({ toks: [], opener: t });
		} else if (t === ")" && stack.length > 1) {
			stack.pop();
			stack[stack.length - 1].toks.push(")");
		} else top.toks.push(t);
	}
	return stack;
}

/** What a learner most likely types next, given the SQL before the cursor. */
export function suggest(before: string, ctx: SuggestContext): Suggestions {
	const schema = ctx.schema ?? {};
	const task = ctx.task;
	const chapter = task?.chapter ?? 99;
	const m = /[A-Za-z_][A-Za-z0-9_.]*$/.exec(before);
	const partial = m ? m[0] : "";
	const head = partial ? before.slice(0, -partial.length) : before;
	const toks = tokenize(head);
	const stmt = statementAround(head, `${partial}${ctx.after ?? ""}`);

	// CTE names count as tables; their columns are the names they select.
	const ctes: Record<string, string[]> = {};
	stmt.forEach((t, i) => {
		if (
			stmt[i + 1] === "AS" &&
			stmt[i + 2] === "(" &&
			/^(WITH|RECURSIVE|,)$/.test(stmt[i - 1] ?? "") &&
			isIdent(t)
		) {
			const cols: string[] = [];
			let depth = 0;
			for (let k = i + 3; k < stmt.length; k++) {
				const x = stmt[k];
				if (isOpener(x)) depth++;
				else if (x === ")") {
					if (depth === 0) break;
					depth--;
				} else if (depth === 0 && x === "FROM") break;
				else if (
					depth === 0 &&
					(stmt[k + 1] === "," || stmt[k + 1] === "FROM") &&
					isIdent(x)
				)
					cols.push(x.split(".").pop() ?? x);
			}
			ctes[t] = cols;
		}
	});
	const colsOf = (t: string) => schema[t] ?? ctes[t] ?? [];
	const isTable = (t: string | undefined) => !!t && (t in schema || t in ctes);
	const tables = [...Object.keys(ctes), ...Object.keys(schema)];

	// Tables named in the statement, and alias → table.
	const inQuery: string[] = [];
	const alias: Record<string, string> = {};
	stmt.forEach((t, i) => {
		if (!isTable(t)) return;
		const prev = stmt[i - 1] ?? "";
		if (
			!/^(FROM|UPDATE|INSERT INTO|DELETE FROM|MERGE INTO|USING|REFERENCES|ALTER TABLE|ON|,|.*JOIN)$/.test(
				prev,
			)
		)
			return;
		if (!inQuery.includes(t)) inQuery.push(t);
		let a = stmt[i + 1];
		if (a === "AS") a = stmt[i + 2];
		if (a && /^[a-z_]\w*$/i.test(a) && isIdent(a) && !isTable(a)) alias[a] = t;
	});
	const focus = task?.tables.filter((t) => t in schema) ?? [];
	const scope = inQuery.length ? inQuery : focus.length ? focus : tables;
	const columns = [...new Set(scope.flatMap(colsOf))];
	const tableOrder = [
		...Object.keys(ctes),
		...focus,
		...Object.keys(schema).filter((t) => !focus.includes(t)),
	];
	const funcs = [
		...COMMON_FUNCS,
		...(task?.functions ?? []).map((f) => `${f}(`),
	];

	// "p." or "pilots.": that table's columns.
	if (partial.includes(".")) {
		const q = partial.slice(0, partial.lastIndexOf("."));
		const t = alias[q] ?? (isTable(q) ? q : (q.split(".").pop() ?? ""));
		const cols = colsOf(t);
		const items = cols.map((c) => `${q}.${c}`);
		return finish(partial, cols.length ? [...items, `${q}.*`] : [], ctx, task);
	}

	const stack = frames(toks);
	const frame = stack[stack.length - 1];
	const cur = frame.toks;
	const inParens = stack.length > 1;
	const last = cur.at(-1) ?? frame.opener;
	const prev = cur.length ? (cur.at(-2) ?? frame.opener) : "";
	const parentToks = stack.at(-2)?.toks ?? [];
	const beforeOpen = parentToks.at(-2) ?? "";

	// Clause around the cursor: the innermost frame first, then outwards
	// through plain parentheses (not past a subquery's own SELECT).
	let clause = "";
	let clauseAt = -1;
	for (let f = stack.length - 1; f >= 0 && !clause; f--) {
		const ft = stack[f].toks;
		for (let i = ft.length - 1; i >= 0; i--) {
			if (CLAUSE_RE.test(ft[i])) {
				clause = ft[i].endsWith("JOIN") ? "JOIN" : ft[i];
				if (f === stack.length - 1) clauseAt = i;
				break;
			}
		}
		if (ft[0] === "SELECT" || ft[0] === "WITH") break;
	}
	const sinceClause = clauseAt >= 0 ? cur.slice(clauseAt + 1) : cur;
	const target =
		inQuery[0] ?? focus[0] ?? (clause === "SET" ? tables[0] : undefined);
	const targetCols = target ? colsOf(target) : columns;

	const close = inParens ? [")"] : [];
	const end = inParens ? [")"] : [";"];
	const qualified = () => {
		// ON: qualified keys of every table in play, ids first.
		const out: string[] = [];
		const pairs = [
			...Object.entries(alias),
			...inQuery
				.filter((t) => !Object.values(alias).includes(t))
				.map((t) => [t, t] as const),
		];
		for (const [a, t] of pairs)
			for (const c of colsOf(t))
				if (c === "id" || c.endsWith("_id")) out.push(`${a}.${c}`);
		for (const [a, t] of pairs)
			for (const c of colsOf(t))
				if (!out.includes(`${a}.${c}`)) out.push(`${a}.${c}`);
		return out;
	};
	const aliasChips = Object.keys(alias).map((a) => `${a}.`);
	const valuesFor = (col: string) => {
		const bare = col.split(".").pop() ?? col;
		const t = alias[col.split(".")[0]];
		const keys = [
			...(t ? [`${t}.${bare}`] : []),
			col,
			...scope.map((x) => `${x}.${bare}`),
			bare,
		];
		for (const k of keys)
			if (ctx.samples?.[k]) return ctx.samples[k].slice(0, 6);
		return [];
	};

	let items: string[] = [];
	const startOfStatement =
		!toks.length ||
		last === ";" ||
		(frame.opener === "(" &&
			!cur.length &&
			/^(AS|IN|NOT IN|EXISTS|NOT EXISTS|ANY|ALL|FROM|.*JOIN|=|<>|>|<|>=|<=|UNION|UNION ALL|EXCEPT|INTERSECT)$/.test(
				beforeOpen,
			));

	if (startOfStatement && (!toks.length || last === ";")) {
		const gated = STATEMENTS.filter((s) => (STATEMENT_FROM[s] ?? 0) <= chapter);
		items = [...(task?.starters ?? []), ...gated];
	} else if (startOfStatement)
		items = [
			"SELECT",
			...(/^(IN|NOT IN|FROM)$/.test(beforeOpen) ? ["VALUES"] : []),
		];
	else if (last === "::") items = TYPES;
	else if (last === "CREATE")
		items = [
			"TABLE",
			"INDEX",
			"UNIQUE INDEX",
			"VIEW",
			"OR REPLACE",
			"FUNCTION",
		];
	else if (last === "DROP") items = ["TABLE", "INDEX", "VIEW", "FUNCTION"];
	else if (last === "IS")
		items = [
			"NULL",
			"NOT NULL",
			"TRUE",
			"FALSE",
			"DISTINCT FROM",
			"NOT DISTINCT FROM",
		];
	else if (
		last === "IN" ||
		last === "NOT IN" ||
		last === "EXISTS" ||
		last === "NOT EXISTS"
	)
		items = ["("];
	else if (last === "OVER") items = ["("];
	else if (
		/^over\($/i.test(frame.opener) ||
		(frame.opener === "(" && beforeOpen === "OVER")
	) {
		items =
			!cur.length || last === ","
				? ["PARTITION BY", "ORDER BY", ")"]
				: clause === "PARTITION BY" && !/^(PARTITION BY|,)$/.test(last)
					? ["ORDER BY", ",", ")"]
					: /^(PARTITION BY|ORDER BY|,)$/.test(last)
						? columns
						: ["DESC", "ASC", ",", ")", "ROWS BETWEEN"];
	} else if (
		frame.opener === "(" &&
		/^(CHECK|UNIQUE|PRIMARY KEY|FOREIGN KEY|ON CONFLICT)$/.test(beforeOpen)
	)
		items =
			!cur.length || last === ","
				? targetCols
				: [",", ")", ">", ">=", "<>", "IN", "AND"];
	else if (
		frame.opener === "(" &&
		isTable(beforeOpen) &&
		/^(INSERT INTO|ON|REFERENCES)$/.test(parentToks.at(-3) ?? "")
	)
		items = !cur.length || last === "," ? colsOf(beforeOpen) : [",", ")"];
	else if (
		frame.opener === "(" &&
		isIdent(beforeOpen) &&
		parentToks.at(-3) === "CREATE TABLE"
	) {
		// Column definitions.
		if (!cur.length || last === ",")
			items = [
				"id",
				"PRIMARY KEY (",
				"UNIQUE (",
				"CHECK (",
				"FOREIGN KEY (",
				"CONSTRAINT",
			];
		else if (isIdent(last) && (prev === "," || prev === "("))
			items = [...TYPES, "SERIAL", "GENERATED ALWAYS AS IDENTITY"];
		else if (last === "REFERENCES") items = tableOrder;
		else if (last === "DEFAULT") items = ["now()", "0", "TRUE", "FALSE", "''"];
		else
			items = [
				",",
				"PRIMARY KEY",
				"NOT NULL",
				"UNIQUE",
				"DEFAULT",
				"REFERENCES",
				"CHECK (",
				")",
			];
	} else if (
		frame.opener !== "(" &&
		frame.opener !== "" &&
		!clauseInFrame(cur)
	) {
		// Function arguments.
		items =
			!cur.length || last === ","
				? [
						...(/^count\($/i.test(frame.opener) ? ["*", "DISTINCT"] : []),
						...columns,
						...aliasChips,
						...funcs,
					]
				: [",", ")", "::", "||", "AS"];
	} else if (clause === "SELECT" || clause === "RETURNING") {
		if (/^(SELECT|,|DISTINCT|RETURNING)$/.test(last))
			items = [
				...(last === "SELECT"
					? ["*", "DISTINCT"]
					: last === "RETURNING"
						? ["*"]
						: []),
				...columns,
				...aliasChips,
				...funcs,
				...(chapter >= 7 ? ["CASE"] : []),
			];
		else if (last === "AS") items = [];
		else if (
			last === "CASE" ||
			last === "WHEN" ||
			last === "THEN" ||
			last === "ELSE"
		)
			items = last === "CASE" ? ["WHEN"] : columns;
		else if (sinceClause.includes("CASE") && !sinceClause.includes("END"))
			items = ["THEN", "WHEN", "ELSE", "END", "=", ">", "<", "AND"];
		else
			items = [
				...close,
				",",
				...(clause === "SELECT" ? ["FROM", "AS"] : ["AS", ";"]),
				"||",
				"+",
				"-",
				"*",
				"/",
				"::",
			];
	} else if (clause === "WITH") {
		items =
			last === "WITH"
				? ["RECURSIVE"]
				: isIdent(last)
					? ["AS"]
					: last === ")"
						? [",", "SELECT"]
						: [];
	} else if (
		/^(FROM|JOIN|UPDATE|INSERT INTO|DELETE FROM|MERGE INTO|USING|ALTER TABLE|CREATE INDEX|CREATE UNIQUE INDEX|CREATE TABLE|REFERENCES)$/.test(
			clause,
		)
	) {
		const named = sinceClause.filter((t) => t !== "AS");
		const tableJust = isTable(last);
		const aliasJust = !tableJust && isIdent(last) && isTable(prev);
		const afterName =
			tableJust || aliasJust || (prev === "AS" && isIdent(last));
		if (
			/^(FROM|UPDATE|INSERT INTO|DELETE FROM|MERGE INTO|ALTER TABLE|REFERENCES|,)$/.test(
				last,
			) ||
			last.endsWith("JOIN") ||
			(last === "USING" &&
				clause === "USING" &&
				sinceClause.length === 0 &&
				/MERGE INTO/.test(cur.join(" ")))
		)
			items = tableOrder;
		else if (clause === "CREATE TABLE") items = named.length ? ["(", "AS"] : [];
		else if (clause === "CREATE INDEX" || clause === "CREATE UNIQUE INDEX")
			items = named.length ? ["ON"] : [];
		else if (clause === "ALTER TABLE") {
			items = tableJust
				? [
						"ADD COLUMN",
						"DROP COLUMN",
						"ALTER COLUMN",
						"ADD CONSTRAINT",
						"RENAME COLUMN",
						"DROP CONSTRAINT",
					]
				: /^(DROP COLUMN|ALTER COLUMN|RENAME COLUMN)$/.test(last) && target
					? colsOf(target)
					: prev === "ALTER COLUMN"
						? ["TYPE", "SET NOT NULL", "DROP NOT NULL", "SET DEFAULT"]
						: prev === "ADD COLUMN" || last === "TYPE"
							? TYPES
							: prev === "ADD CONSTRAINT"
								? ["CHECK (", "UNIQUE (", "FOREIGN KEY (", "PRIMARY KEY ("]
								: [",", "NOT NULL", "DEFAULT", "REFERENCES", ";"];
		} else if (clause === "UPDATE")
			items = afterName ? ["SET", ...(tableJust ? ["AS"] : [])] : [];
		else if (clause === "INSERT INTO")
			items =
				last === ")"
					? ["VALUES", "SELECT"]
					: ["(", "VALUES", "SELECT", "DEFAULT VALUES"];
		else if (clause === "DELETE FROM")
			items = ["WHERE", "USING", "RETURNING", ";"];
		else if (clause === "MERGE INTO")
			items = ["USING", ...(tableJust ? ["AS"] : [])];
		else if (clause === "USING" && /MERGE INTO/.test(cur.join(" ")))
			items = ["ON", ...(tableJust ? ["AS"] : [])];
		else if (clause === "REFERENCES")
			items = ["(", "ON DELETE CASCADE", "ON DELETE SET NULL", ",", ")"];
		else if (clause === "JOIN" && afterName)
			items = ["ON", "USING", ...(tableJust ? ["AS"] : [])];
		else
			items = [
				...close,
				"WHERE",
				"JOIN",
				"LEFT JOIN",
				"GROUP BY",
				"ORDER BY",
				"LIMIT",
				",",
				...(tableJust ? ["AS"] : []),
				...end,
			];
	} else if (clause === "ON" && /CREATE( UNIQUE)? INDEX/.test(cur.join(" "))) {
		items = last === "ON" ? tableOrder : ["(", "USING"];
	} else if (
		clause === "USING" &&
		/CREATE( UNIQUE)? INDEX/.test(cur.join(" "))
	) {
		items = last === "USING" ? ["btree", "gin", "gist", "brin", "hnsw"] : ["("];
	} else if (clause === "WHERE" || clause === "ON" || clause === "HAVING") {
		// The predicate being written: tokens since the last AND / OR / NOT.
		let k = sinceClause.length;
		while (k > 0 && !/^(AND|OR|NOT)$/.test(sinceClause[k - 1])) k--;
		const pred = sinceClause.slice(k);
		const opAt = pred.findIndex(
			(t) =>
				CMP.test(t) ||
				/^(BETWEEN|NOT BETWEEN|IN|NOT IN|EXISTS|NOT EXISTS)$/.test(t),
		);
		const between = pred.includes("BETWEEN");
		const connectors = [
			...close,
			"AND",
			"OR",
			...(clause === "WHERE" ? ["ORDER BY", "GROUP BY", "LIMIT"] : []),
			...(clause === "ON" ? ["JOIN", "LEFT JOIN", "WHERE", "ORDER BY"] : []),
			...(clause === "HAVING" ? ["ORDER BY"] : []),
			...end,
		];
		if (!pred.length)
			items =
				clause === "ON"
					? qualified()
					: [
							...columns,
							...aliasChips,
							...(clause === "HAVING" ? COMMON_FUNCS : []),
							...(chapter >= 12 ? ["EXISTS", "NOT EXISTS"] : []),
							"NOT",
							"(",
						];
		else if (between && last === "BETWEEN") items = valuesFor(pred[0]);
		else if (between && last === "AND") items = valuesFor(pred[0]);
		else if (between && pred.at(-2) === "BETWEEN") items = ["AND"];
		else if (opAt < 0)
			items =
				clause === "ON"
					? ["=", "AND"]
					: [
							"=",
							"<>",
							">",
							"<",
							">=",
							"<=",
							"IS NULL",
							"IS NOT NULL",
							"IN",
							"LIKE",
							"BETWEEN",
							...(chapter >= 29 ? ["::"] : []),
						];
		else if (opAt === pred.length - 1) {
			const col = pred[0] ?? "";
			items =
				clause === "ON"
					? qualified()
					: [...valuesFor(col), ...columns, ...(chapter >= 11 ? ["("] : [])];
		} else items = connectors;
	} else if (
		clause === "GROUP BY" ||
		clause === "ORDER BY" ||
		clause === "PARTITION BY"
	) {
		if (/^(GROUP BY|ORDER BY|PARTITION BY|,)$/.test(last))
			items = [
				...columns,
				...aliasChips,
				...(clause === "ORDER BY" ? ["1", "2"] : []),
			];
		else if (clause === "ORDER BY")
			items = [
				...close,
				"DESC",
				"ASC",
				",",
				"LIMIT",
				"NULLS LAST",
				...(chapter >= 4 ? ["FETCH FIRST"] : []),
				...end,
			];
		else if (clause === "PARTITION BY") items = ["ORDER BY", ",", ")"];
		else items = [...close, ",", "HAVING", "ORDER BY", ...end];
	} else if (clause === "LIMIT" || clause === "OFFSET")
		items =
			last === clause
				? ["1", "3", "5", "10"]
				: [...(clause === "LIMIT" ? ["OFFSET"] : []), ...close, ...end];
	else if (clause === "SET" || clause === "DO UPDATE SET") {
		const setCols = targetCols;
		if (last === "SET" || last === "DO UPDATE SET" || last === ",")
			items = setCols;
		else if (isIdent(last) && /^(SET|DO UPDATE SET|,)$/.test(prev))
			items = ["="];
		else if (last === "=") {
			const col = prev;
			items = [
				...(clause === "DO UPDATE SET" ? [`EXCLUDED.${col}`] : []),
				col,
				...valuesFor(col),
				"DEFAULT",
				"NULL",
			];
		} else
			items = [
				",",
				"WHERE",
				"RETURNING",
				"+",
				"-",
				"||",
				...(clause === "SET" ? ["FROM"] : []),
				...end,
			];
	} else if (clause === "VALUES")
		items = last === "VALUES" ? ["("] : [",", "RETURNING", "ON CONFLICT", ";"];
	else if (clause === "ON CONFLICT")
		items =
			last === "ON CONFLICT"
				? ["(", "DO NOTHING"]
				: ["DO NOTHING", "DO UPDATE SET"];
	else if (clause === "WHEN MATCHED" || clause === "WHEN NOT MATCHED")
		items = ["THEN", "AND"];
	else if (clause === "THEN")
		items =
			last === "THEN"
				? ["UPDATE SET", "DELETE", "INSERT", "DO NOTHING"]
				: ["WHEN MATCHED", "WHEN NOT MATCHED", ";"];

	return finish(partial, items, ctx, task);
}

/** True when a clause keyword sits in this frame (a subquery, not a call). */
function clauseInFrame(toks: string[]): boolean {
	return toks.some((t) => /^(SELECT|FROM|WHERE)$/.test(t));
}

/** Filter by the partial word, dedupe, and fall back to any match. */
function finish(
	partial: string,
	items: string[],
	ctx: SuggestContext,
	task?: TaskHints,
): Suggestions {
	const schema = ctx.schema ?? {};
	const p = partial.toLowerCase();
	const seen = new Set<string>();
	const out: string[] = [];
	const push = (it: string, max: number) => {
		if (out.length >= max || seen.has(it)) return;
		if (p && (!it.toLowerCase().startsWith(p) || it.toLowerCase() === p))
			return;
		seen.add(it);
		out.push(it);
	};
	for (const it of items) push(it, 20);
	// Typing a word nothing matches: offer the closest names anywhere.
	if (p && !out.length) {
		const known = new Set([...(task?.functions ?? []), ...KNOWN_FUNCS]);
		for (const it of [
			...(task?.tables ?? []),
			...Object.keys(schema),
			...Object.values(schema).flat(),
			...[...known].map((f) => `${f}(`),
			...KEYWORD_FALLBACK,
			...TYPES,
		])
			push(it, 12);
	}
	return { partial, items: out };
}
