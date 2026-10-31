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
