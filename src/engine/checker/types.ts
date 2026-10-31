import type { Check } from "#/content/types";

/** A column as returned by the SQL engine. */
export interface RawField {
	name: string;
	dataTypeID: number;
	/** Resolved from pg_type when the provider knows it (e.g. "int4", "vector"). */
	typeName?: string;
}

/** One statement result, PGlite `exec(sql, { rowMode: 'array' })` shape. */
export interface RawResult {
	rows: unknown[][];
	fields: RawField[];
	command?: string;
	affectedRows?: number;
}

/** Outcome of one statement of a learner script (the per-statement log). */
export interface StatementOutcome {
	/** 0-based statement index in the script. */
	index: number;
	/** Statement text, trimmed, at most 200 characters. */
	sql: string;
	/** 0-based offset of the statement in the full script. */
	offset: number;
	ok: boolean;
	/** Command tag (SELECT, INSERT, BEGIN, ROLLBACK...) when it succeeded. */
	command?: string;
	/** Rows returned (SELECT / RETURNING) or affected (DML). */
	rowCount?: number;
	/** Error with line/column relative to the full script. */
	error?: SqlErrorInfo;
	/** True for statements skipped because the transaction was aborted (25P02). */
	aborted?: boolean;
}

/**
 * psql-style script run (no ON_ERROR_STOP): outside a transaction block the
 * first error stops the script; inside BEGIN ... the following statements
 * fail with 25P02 until ROLLBACK / ROLLBACK TO SAVEPOINT recovers.
 */
export interface ScriptOutcome {
	/** Results of the statements that succeeded, in order. */
	results: RawResult[];
	statements: StatementOutcome[];
	/**
	 * The error that ended the script unrecovered (first error of an aborted
	 * transaction that was never rolled back, or an error outside a
	 * transaction). Position already shifted to the full script.
	 */
	error?: unknown;
}

/** A sandboxed, throwaway database. */
export interface Sandbox {
	/** Runs one or many statements, returns one RawResult per statement. Throws a SqlErrorLike on an unrecovered failure. */
	exec(sql: string): Promise<RawResult[]>;
	/** Same run, never throws for SQL errors: results + per-statement log. */
	execScript?(sql: string): Promise<ScriptOutcome>;
	close(): Promise<void>;
}

/** Opens fresh sandboxes: a clone of the dataset base DB with `setupSql` applied. */
export interface SandboxProvider {
	open(datasetId: string, setupSql?: string): Promise<Sandbox>;
}

/** Shape of errors thrown by PGlite (DatabaseError). */
export interface SqlErrorLike {
	message: string;
	code?: string;
	position?: string | number;
	hint?: string;
	detail?: string;
}

export type ErrorType =
	| "empty"
	| "forbidden"
	| "syntax"
	| "unknown_table"
	| "unknown_column"
	| "unknown_function"
	| "runtime"
	| "timeout"
	| "no_result"
	| "wrong_column_count"
	| "wrong_column_names"
	| "wrong_row_count"
	| "wrong_values"
	| "wrong_types"
	| "wrong_order"
	| "wrong_final_state"
	| "expected_error"
	| "wrong_error"
	| "internal";

export interface SqlErrorInfo {
	code?: string;
	message: string;
	hint?: string;
	detail?: string;
	/** 1-based character offset in the learner SQL, when Postgres reports one. */
	position?: number;
	/** 1-based line / column derived from position. */
	line?: number;
	column?: number;
}

/** Display-ready table. Cells are normalised to JSON-safe values (string | number | boolean | null | arrays | objects). */
export interface ResultTable {
	columns: { name: string; typeName?: string; dataTypeID: number }[];
	rows: unknown[][];
	rowCount: number;
	command?: string;
	affectedRows?: number;
	/** True when rows were cut to the display limit. */
	truncated?: boolean;
}

export type DiffRowStatus = "match" | "missing" | "extra" | "moved" | "changed";

export interface DiffRow {
	status: DiffRowStatus;
	cells: unknown[];
	/** For "changed" rows in ordered comparisons: column indexes that differ. */
	changedCells?: number[];
}

export interface TableDiff {
	columns: string[];
	/** Expected side, each row tagged (match | missing | moved | changed). */
	expected: DiffRow[];
	/** Learner side, each row tagged (match | extra | moved | changed). */
	got: DiffRow[];
	missingCount: number;
	extraCount: number;
}

export interface Verdict {
	pass: boolean;
	errorType?: ErrorType;
	/** Short headline, e.g. "Wrong row count". */
	title: string;
	/** Friendly explanation of what went wrong (or right). */
	message: string;
	sqlError?: SqlErrorInfo;
	/** Every statement result from the learner run (empty when it failed). */
	learnerResults: ResultTable[];
	/** The last result that has columns (what the grid shows). */
	learnerLast?: ResultTable;
	/** Expected result of the reference solution (result checks). */
	expected?: ResultTable;
	/** Row-level diff for result checks. */
	diff?: TableDiff;
	/** For state checks: verifySql output on both sides and its diff. */
	stateExpected?: ResultTable;
	stateGot?: ResultTable;
	stateDiff?: TableDiff;
	/** Per-statement log of the learner script (empty when it did not run). */
	statements: StatementOutcome[];
	durationMs: number;
}

export interface RunOutcome {
	ok: boolean;
	results: ResultTable[];
	last?: ResultTable;
	error?: SqlErrorInfo;
	errorType?: ErrorType;
	/** Per-statement log of the script (empty when it did not run). */
	statements: StatementOutcome[];
	durationMs: number;
}

export interface JudgeInput {
	datasetId: string;
	/** Exercise setupSql, applied after the dataset setup. */
	setupSql?: string;
	solutionSql: string;
	check: Check;
	learnerSql: string;
}

export interface RunInput {
	datasetId: string;
	setupSql?: string;
	sql: string;
}

export interface JudgeOptions {
	/** Max rows kept in display tables (default 500). Comparison always uses all rows. */
	displayLimit?: number;
}
