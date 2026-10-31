/**
 * Static guard against statements a learner sandbox must never run.
 * Comments, string literals, dollar-quoted bodies and quoted identifiers are
 * blanked first so that `SELECT 'copy x to program'` stays allowed.
 */

/** Replace comments and literals with spaces (keeps offsets stable). */
export function stripSqlLiterals(sql: string): string {
	let out = "";
	let i = 0;
	const n = sql.length;
	while (i < n) {
		const ch = sql[i];
		const next = sql[i + 1];
		// -- line comment
		if (ch === "-" && next === "-") {
			while (i < n && sql[i] !== "\n") {
				out += " ";
				i++;
			}
			continue;
		}
		// /* block comment */ (nestable in Postgres)
		if (ch === "/" && next === "*") {
			let depth = 0;
			while (i < n) {
				if (sql[i] === "/" && sql[i + 1] === "*") {
					depth++;
					out += "  ";
					i += 2;
					continue;
				}
				if (sql[i] === "*" && sql[i + 1] === "/") {
					depth--;
					out += "  ";
					i += 2;
					if (depth === 0) break;
					continue;
				}
				out += sql[i] === "\n" ? "\n" : " ";
				i++;
			}
			continue;
		}
		// 'string' (with '' escapes; E'' strings with backslash escapes)
		if (ch === "'") {
			const isE = i > 0 && /[eE]/.test(sql[i - 1]);
			out += " ";
			i++;
			while (i < n) {
				if (isE && sql[i] === "\\") {
					out += "  ";
					i += 2;
					continue;
				}
				if (sql[i] === "'") {
					if (sql[i + 1] === "'") {
						out += "  ";
						i += 2;
						continue;
					}
					out += " ";
					i++;
					break;
				}
				out += sql[i] === "\n" ? "\n" : " ";
				i++;
			}
			continue;
		}
		// "quoted identifier" -> keep a neutral identifier placeholder
		if (ch === '"') {
			out += " ";
			i++;
			while (i < n) {
				if (sql[i] === '"') {
					if (sql[i + 1] === '"') {
						out += "  ";
						i += 2;
						continue;
					}
					out += " ";
					i++;
					break;
				}
				out += "x";
				i++;
			}
			continue;
		}
		// $tag$ dollar quoting $tag$
		if (ch === "$") {
			const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
			if (m) {
				const tag = m[0];
				const end = sql.indexOf(tag, i + tag.length);
				const stop = end < 0 ? n : end + tag.length;
				for (let k = i; k < stop; k++) out += sql[k] === "\n" ? "\n" : " ";
				i = stop;
				continue;
			}
		}
		out += ch;
		i++;
	}
	return out;
}

const RULES: Array<{ re: RegExp; reason: string }> = [
	{
		re: /(^|;)\s*copy\b/i,
		reason:
			"COPY reads or writes server files and programs, so it is disabled in the sandbox.",
	},
	{
		re: /\balter\s+system\b/i,
		reason: "ALTER SYSTEM changes server configuration and is disabled.",
	},
	{
		re: /\b(create|drop|alter)\s+database\b/i,
		reason: "Creating, altering or dropping databases is disabled.",
	},
	{
		re: /\b(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|pg_file_write)\s*\(/i,
		reason: "Server file access functions are disabled.",
	},
	{
		re: /\bdblink\w*\s*\(/i,
		reason: "dblink connections are disabled.",
	},
	{
		re: /\bset\s+(local\s+|session\s+)?(role|session\s+authorization)\b/i,
		reason: "Switching roles is disabled in the sandbox.",
	},
	{
		re: /\breset\s+(role|session\s+authorization)\b/i,
		reason: "Switching roles is disabled in the sandbox.",
	},
	{
		re: /(^|;)\s*load\b/i,
		reason: "LOAD (loading shared libraries) is disabled.",
	},
	{
		re: /\bcreate\s+(or\s+replace\s+)?(trusted\s+)?(procedural\s+)?language\b/i,
		reason: "Creating procedural languages is disabled.",
	},
];

/** Returns a human reason when the SQL contains a forbidden statement, else null. */
export function findForbidden(sql: string): string | null {
	const code = stripSqlLiterals(sql);
	for (const rule of RULES) {
		if (rule.re.test(code)) return rule.reason;
	}
	return null;
}
