import type { ErrorType, SqlErrorInfo } from "./types";

const SQLSTATE_NAMES: Record<string, string> = {
	"21000": "cardinality_violation",
	"22001": "string_data_right_truncation",
	"22003": "numeric_value_out_of_range",
	"22007": "invalid_datetime_format",
	"22008": "datetime_field_overflow",
	"22012": "division_by_zero",
	"22023": "invalid_parameter_value",
	"22P02": "invalid_text_representation",
	"23502": "not_null_violation",
	"23503": "foreign_key_violation",
	"23505": "unique_violation",
	"23514": "check_violation",
	"23P01": "exclusion_violation",
	"25P02": "in_failed_sql_transaction",
	"2BP01": "dependent_objects_still_exist",
	"40001": "serialization_failure",
	"40P01": "deadlock_detected",
	"42501": "insufficient_privilege",
	"42601": "syntax_error",
	"42602": "invalid_name",
	"42701": "duplicate_column",
	"42702": "ambiguous_column",
	"42703": "undefined_column",
	"42704": "undefined_object",
	"42710": "duplicate_object",
	"42725": "ambiguous_function",
	"42803": "grouping_error",
	"42804": "datatype_mismatch",
	"42809": "wrong_object_type",
	"42830": "invalid_foreign_key",
	"42883": "undefined_function",
	"42P01": "undefined_table",
	"42P07": "duplicate_table",
	"42P10": "invalid_column_reference",
	"42P18": "indeterminate_datatype",
	"42P20": "windowing_error",
	"57014": "query_canceled",
	P0001: "raise_exception",
};

/** Postgres condition name for a SQLSTATE, e.g. "23505" -> "unique_violation". */
export function sqlstateName(code: string | undefined): string | undefined {
	return code ? SQLSTATE_NAMES[code] : undefined;
}

/** "23505 (unique_violation)" or just the code. */
export function describeSqlstate(code: string | undefined): string {
	if (!code) return "an unknown error";
	const name = sqlstateName(code);
	return name ? `${code} (${name})` : code;
}

export function classifyError(code: string | undefined): ErrorType {
	switch (code) {
		case "42601":
			return "syntax";
		case "42P01":
			return "unknown_table";
		case "42703":
			return "unknown_column";
		case "42883":
			return "unknown_function";
		default:
			return "runtime";
	}
}

/** Convert a 1-based character offset into 1-based line and column. */
export function positionToLineColumn(
	sql: string,
	position: number,
): { line: number; column: number } {
	const before = sql.slice(0, Math.max(0, position - 1));
	const lines = before.split("\n");
	return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function toSqlErrorInfo(err: unknown, sql: string): SqlErrorInfo {
	if (err && typeof err === "object") {
		const e = err as {
			message?: unknown;
			code?: unknown;
			position?: unknown;
			hint?: unknown;
			detail?: unknown;
		};
		const info: SqlErrorInfo = {
			message: typeof e.message === "string" ? e.message : String(err),
		};
		if (typeof e.code === "string" && e.code) info.code = e.code;
		if (typeof e.hint === "string" && e.hint) info.hint = e.hint;
		if (typeof e.detail === "string" && e.detail) info.detail = e.detail;
		const pos =
			typeof e.position === "number"
				? e.position
				: typeof e.position === "string" && e.position
					? Number.parseInt(e.position, 10)
					: Number.NaN;
		if (Number.isFinite(pos) && pos > 0) {
			info.position = pos;
			const { line, column } = positionToLineColumn(sql, pos);
			info.line = line;
			info.column = column;
		}
		return info;
	}
	return { message: String(err) };
}

/** Token Postgres complained about, e.g. `syntax error at or near "selec"` -> "selec". */
export function nearToken(message: string): string | undefined {
	const m = /at or near "([^"]*)"/.exec(message);
	if (m) return m[1];
	if (/at end of input/.test(message)) return "end of input";
	return undefined;
}

/** First double-quoted name in a Postgres message, e.g. `column "x" does not exist` -> "x". */
function quotedName(message: string): string | undefined {
	return /"([^"]+)"/.exec(message)?.[1];
}

/**
 * Plain advice for a failed query, written for a learner: no SQLSTATE, no
 * line or column (the sheet quotes the line itself). Undefined when Postgres's
 * own message is already the best thing to show.
 */
export function sqlErrorAdvice(error: SqlErrorInfo): string | undefined {
	const msg = error.message;
	const name = quotedName(msg);
	switch (error.code) {
		case "42601": {
			const token = nearToken(msg);
			if (token === "end of input")
				return "The query stops too early: something is missing at the end, such as a value, a closing parenthesis or a closing quote.";
			if (token !== undefined)
				return `Postgres could not read the query at "${token}". Check the spelling, the commas and the parentheses just before it.`;
			return "Postgres could not read the query. Check the spelling, the commas and the parentheses.";
		}
		case "42702":
			return name
				? `More than one table in the query has a column called "${name}". Say which one you mean by putting the table name or its alias in front, like t.${name}.`
				: "Several tables in the query have a column with this name. Put the table name or its alias in front of it.";
		case "42P01": {
			const missing = /missing FROM-clause entry for table "([^"]+)"/.exec(msg);
			if (missing)
				return `"${missing[1]}" is used in front of a column, but no table in FROM or JOIN has that name or alias. Give the table that alias (FROM table_name ${missing[1]}) or fix the name.`;
			return name
				? `There is no table called "${name}". Check the spelling against the schema.`
				: "One of the tables does not exist. Check the spelling against the schema.";
		}
		case "42703": {
			const col = /column "?([^"\s]+)"? does not exist/.exec(msg)?.[1] ?? name;
			if (col?.includes("."))
				return `There is no column "${col}". Check the column name, and that the alias in front of it belongs to the right table.`;
			return col
				? `None of the tables in the query has a column called "${col}". Check the spelling in the schema. If it is a text value, put it in single quotes: '${col}'.`
				: "One of the columns does not exist. Check the spelling in the schema.";
		}
		case "42803":
			return name
				? `"${name}" is in SELECT but neither in GROUP BY nor inside an aggregate such as COUNT or SUM. Add it to GROUP BY, or aggregate it.`
				: "Every column in SELECT must be in GROUP BY or inside an aggregate such as COUNT or SUM.";
		case "42883":
			return "No function matches this name with these argument types. Check the spelling, or cast the argument to the type the function expects.";
		case "42804": {
			const clause = /argument of ([A-Z/]+) must be type boolean/.exec(
				msg,
			)?.[1];
			if (clause)
				return `${clause.replace("JOIN/ON", "ON")} needs a condition that is true or false, such as price > 10, not a plain value.`;
			return "A value has the wrong type here. Check what you compare or combine, and cast one side if needed.";
		}
		case "22P02":
			return "A value could not be read as the type expected here, for example text where a number is expected. Check the quotes and the casts.";
		case "22012":
			return "A division by zero happened on at least one row. Leave those rows out, or turn the 0 into NULL before dividing.";
		case "21000":
			return "A subquery used as a single value returned more than one row. Make it return one row, or use IN instead of =.";
		case "23502":
			return name
				? `"${name}" cannot be empty here (NOT NULL): give it a value.`
				: "A column that cannot be empty (NOT NULL) got no value.";
		case "23505":
			return "A row with this value already exists, and the column must stay unique.";
		case "23503":
			return "This value points to a row that does not exist in the other table (foreign key), or a row still points to the one you change.";
		case "23514":
			return "A value breaks a CHECK rule of the table.";
		default:
			return undefined;
	}
}

/** The source line an error points at, with the 1-based column inside it. */
export function errorLineOf(
	sql: string,
	error: SqlErrorInfo,
): { line: number; text: string; column: number } | undefined {
	if (!error.line) return undefined;
	const text = sql.split("\n")[error.line - 1];
	if (text === undefined || !text.trim()) return undefined;
	return { line: error.line, text, column: error.column ?? 1 };
}
