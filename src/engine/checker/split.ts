/**
 * Split a SQL script into statements, respecting quotes ('' and E'' with
 * backslash escapes), quoted identifiers, dollar quoting and comments
 * (line and nested block). Statements are run one by one because PGlite's
 * exec() wraps a batch in one implicit transaction (VACUUM, CALL with
 * COMMIT... fail there) and because per-statement offsets let us map error
 * positions back to the learner's text.
 */

export interface SqlStatement {
	/** Statement text without the trailing semicolon. */
	text: string;
	/** 0-based offset of `text` in the original script. */
	offset: number;
}

const DOLLAR_TAG = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/;

export function splitStatements(sql: string): SqlStatement[] {
	const out: SqlStatement[] = [];
	let start = 0;
	let i = 0;
	const n = sql.length;
	let hasCode = false;

	const push = (end: number) => {
		const raw = sql.slice(start, end);
		if (hasCode) {
			const lead = raw.length - raw.trimStart().length;
			out.push({ text: raw.trim(), offset: start + lead });
		}
		hasCode = false;
	};

	while (i < n) {
		const c = sql[i];
		const next = sql[i + 1];
		if (c === "-" && next === "-") {
			const nl = sql.indexOf("\n", i);
			i = nl === -1 ? n : nl + 1;
			continue;
		}
		if (c === "/" && next === "*") {
			let depth = 1;
			i += 2;
			while (i < n && depth > 0) {
				if (sql[i] === "/" && sql[i + 1] === "*") {
					depth++;
					i += 2;
				} else if (sql[i] === "*" && sql[i + 1] === "/") {
					depth--;
					i += 2;
				} else i++;
			}
			continue;
		}
		if (c === "'") {
			const escapes =
				i > 0 &&
				/[eE]/.test(sql[i - 1]) &&
				!/[A-Za-z0-9_]/.test(sql[i - 2] ?? "");
			hasCode = true;
			i++;
			while (i < n) {
				if (escapes && sql[i] === "\\") {
					i += 2;
					continue;
				}
				if (sql[i] === "'") {
					if (sql[i + 1] === "'") {
						i += 2;
						continue;
					}
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		if (c === '"') {
			hasCode = true;
			i++;
			while (i < n) {
				if (sql[i] === '"') {
					if (sql[i + 1] === '"') {
						i += 2;
						continue;
					}
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		if (c === "$" && !/[A-Za-z0-9_]/.test(sql[i - 1] ?? "")) {
			const m = DOLLAR_TAG.exec(sql.slice(i));
			if (m) {
				hasCode = true;
				const tag = m[0];
				const close = sql.indexOf(tag, i + tag.length);
				i = close === -1 ? n : close + tag.length;
				continue;
			}
		}
		if (c === ";") {
			push(i);
			i++;
			start = i;
			continue;
		}
		if (!/\s/.test(c)) hasCode = true;
		i++;
	}
	push(n);
	return out;
}
