/**
 * Pure checker API (safe to import anywhere, including SSR).
 * The PGlite-backed provider lives in ./pglite-provider and must only be
 * imported from the Web Worker or from tests.
 */
export {
	judge,
	runSql,
	timeoutRunOutcome,
	timeoutVerdict,
	toResultTable,
} from "./checker";
export {
	type CompareErrorType,
	type CompareOptions,
	type CompareResult,
	compareTables,
} from "./compare";
export {
	classifyError,
	describeSqlstate,
	nearToken,
	positionToLineColumn,
	sqlstateName,
	toSqlErrorInfo,
} from "./errors";
export { findForbidden, stripSqlLiterals } from "./forbidden";
export {
	type Canon,
	canonEqual,
	canonicalize,
	DEFAULT_TOLERANCE,
	formatCell,
	toDisplayValue,
	valuesEqual,
} from "./normalize";
export { type SqlStatement, splitStatements } from "./split";
export type * from "./types";
