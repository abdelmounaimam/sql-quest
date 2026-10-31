import { type CompareResult, compareTables } from "./compare";
import {
	classifyError,
	describeSqlstate,
	nearToken,
	toSqlErrorInfo,
} from "./errors";
import { findForbidden } from "./forbidden";
import { toDisplayValue } from "./normalize";
import type {
	ErrorType,
	JudgeInput,
	JudgeOptions,
	RawResult,
	ResultTable,
	RunInput,
	RunOutcome,
	Sandbox,
	SandboxProvider,
	SqlErrorInfo,
	Verdict,
} from "./types";

const DEFAULT_DISPLAY_LIMIT = 500;

const now = () =>
	typeof performance !== "undefined" ? performance.now() : Date.now();

/** Full (untruncated) display table from a raw result. */
export function toResultTable(raw: RawResult): ResultTable {
	const columns = raw.fields.map((f) => ({
		name: f.name,
		dataTypeID: f.dataTypeID,
		...(f.typeName ? { typeName: f.typeName } : {}),
	}));
	const rows = raw.rows.map((row) =>
		row.map((cell, i) => toDisplayValue(cell, raw.fields[i]?.typeName)),
	);
	const table: ResultTable = { columns, rows, rowCount: rows.length };
	if (raw.command) table.command = raw.command;
	if (typeof raw.affectedRows === "number")
		table.affectedRows = raw.affectedRows;
	return table;
}

function truncate(table: ResultTable, limit: number): ResultTable {
	if (table.rows.length <= limit) return table;
	return { ...table, rows: table.rows.slice(0, limit), truncated: true };
}

/** Last result that returned columns (SELECT or ... RETURNING). */
function lastWithColumns(tables: ResultTable[]): ResultTable | undefined {
	for (let i = tables.length - 1; i >= 0; i--) {
		if (tables[i].columns.length > 0) return tables[i];
	}
	return undefined;
}

type ExecOutcome =
	| { ok: true; tables: ResultTable[] }
	| { ok: false; error: SqlErrorInfo };

async function execSafe(sandbox: Sandbox, sql: string): Promise<ExecOutcome> {
	try {
		const raw = await sandbox.exec(sql);
		return { ok: true, tables: raw.map(toResultTable) };
	} catch (err) {
		return { ok: false, error: toSqlErrorInfo(err, sql) };
	}
}

async function closeQuietly(sandbox: Sandbox | undefined) {
	if (!sandbox) return;
	try {
		await sandbox.close();
	} catch {
		// ignore: a closed or crashed sandbox is gone either way
	}
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ---------------------------------------------------------------------------
// Friendly texts
// ---------------------------------------------------------------------------

function errorTexts(
	type: ErrorType,
	error: SqlErrorInfo,
): { title: string; message: string } {
	const where =
		error.line !== undefined
			? ` on line ${error.line}, column ${error.column}`
			: "";
	const hint = error.hint ? ` Hint: ${error.hint}` : "";
	switch (type) {
		case "syntax": {
			const token = nearToken(error.message);
			const near =
				token === "end of input"
					? "at the end of your query"
					: token !== undefined
						? `near "${token}"`
						: "";
			return {
				title: "Syntax error",
				message:
					`Postgres could not parse your SQL ${near}${where}. Check spelling, commas and parentheses.${hint}`.replace(
						/\s+\./,
						".",
					),
			};
		}
		case "unknown_table":
			return {
				title: "Unknown table",
				message: `${capitalize(error.message)}${where}. Check the schema explorer for the exact table names.${hint}`,
			};
		case "unknown_column":
			return {
				title: "Unknown column",
				message: `${capitalize(error.message)}${where}. Check the column names (and the table alias) in the schema explorer.${hint}`,
			};
		case "unknown_function":
			return {
				title: "Unknown function",
				message: `${capitalize(error.message)}${where}. The name or the argument types do not match any function.${hint}`,
			};
		default:
			return {
				title: `Error ${describeSqlstate(error.code)}`,
				message: `${capitalize(error.message)}${where}.${hint}`.replace(
					/\.\.$/,
					".",
				),
			};
	}
}

function capitalize(s: string): string {
	return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function compareTexts(
	c: CompareResult,
	expected: ResultTable,
	got: ResultTable,
	what: "result" | "state",
): { title: string; message: string } {
	const subject = what === "result" ? "Your result" : "The final data";
	switch (c.errorType) {
		case "wrong_column_count":
			return {
				title: "Wrong number of columns",
				message: `${subject} has ${plural(c.gotColumns, "column")}, expected ${c.expectedColumns}.`,
			};
		case "wrong_column_names": {
			const i = c.columnIndex ?? 0;
			return {
				title: "Column names differ",
				message: `Column ${i + 1} differs: expected "${expected.columns[i]?.name}", got "${got.columns[i]?.name}". Use AS to rename it.`,
			};
		}
		case "wrong_row_count":
			return {
				title: "Wrong number of rows",
				message: `${subject} has ${plural(c.gotRows, "row")}, expected ${c.expectedRows}.${
					c.gotRows > c.expectedRows
						? " Maybe a filter is missing or a join duplicates rows."
						: " Maybe a filter is too strict or a join drops rows."
				}`,
			};
		case "wrong_order":
			return {
				title: "Right rows, wrong order",
				message:
					"All the right rows are there, but the order matters here. Check your ORDER BY (direction and tie breakers).",
			};
		case "wrong_values": {
			const col = c.suspectColumns[0];
			const colName = col !== undefined ? expected.columns[col]?.name : "";
			const differing = Math.max(c.diff.missingCount, c.diff.extraCount);
			return {
				title: "Wrong values",
				message: `Same shape, but ${plural(differing, "row")} differ${differing === 1 ? "s" : ""}${
					colName ? `. Look at column "${colName}"` : ""
				}.`,
			};
		}
		default:
			return { title: "Mismatch", message: `${subject} does not match.` };
	}
}

function baseVerdict(
	t0: number,
): Pick<Verdict, "learnerResults" | "durationMs"> {
	return { learnerResults: [], durationMs: Math.round(now() - t0) };
}

function preflight(
	sql: string,
): { type: ErrorType; title: string; message: string } | null {
	if (!sql.trim() || !stripsToCode(sql)) {
		return {
			type: "empty",
			title: "Nothing to run",
			message: "Write some SQL first, then run it.",
		};
	}
	const reason = findForbidden(sql);
	if (reason) {
		return { type: "forbidden", title: "Forbidden statement", message: reason };
	}
	return null;
}

function stripsToCode(sql: string): boolean {
	const noComments = sql
		.replace(/--[^\n]*/g, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/;/g, "");
	return noComments.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run learner SQL in a fresh sandbox (the "Run" button). */
export async function runSql(
	provider: SandboxProvider,
	input: RunInput,
	opts: JudgeOptions = {},
): Promise<RunOutcome> {
	const t0 = now();
	const limit = opts.displayLimit ?? DEFAULT_DISPLAY_LIMIT;
	const pre = preflight(input.sql);
	if (pre) {
		return {
			ok: false,
			results: [],
			errorType: pre.type,
			error: { message: pre.message },
			durationMs: Math.round(now() - t0),
		};
	}
	let sandbox: Sandbox | undefined;
	try {
		sandbox = await provider.open(input.datasetId, input.setupSql);
		const out = await execSafe(sandbox, input.sql);
		if (!out.ok) {
			return {
				ok: false,
				results: [],
				error: out.error,
				errorType: classifyError(out.error.code),
				durationMs: Math.round(now() - t0),
			};
		}
		const results = out.tables.map((t) => truncate(t, limit));
		return {
			ok: true,
			results,
			last: lastWithColumns(results),
			durationMs: Math.round(now() - t0),
		};
	} catch (err) {
		return {
			ok: false,
			results: [],
			errorType: "internal",
			error: toSqlErrorInfo(err, ""),
			durationMs: Math.round(now() - t0),
		};
	} finally {
		await closeQuietly(sandbox);
	}
}

/** Judge learner SQL against the reference solution. */
export async function judge(
	provider: SandboxProvider,
	input: JudgeInput,
	opts: JudgeOptions = {},
): Promise<Verdict> {
	const t0 = now();
	const limit = opts.displayLimit ?? DEFAULT_DISPLAY_LIMIT;
	const check = input.check;

	const pre = preflight(input.learnerSql);
	if (pre) {
		return {
			...baseVerdict(t0),
			pass: false,
			errorType: pre.type,
			title: pre.title,
			message: pre.message,
		};
	}

	let learnerBox: Sandbox | undefined;
	let solutionBox: Sandbox | undefined;
	try {
		learnerBox = await provider.open(input.datasetId, input.setupSql);
		const learner = await execSafe(learnerBox, input.learnerSql);
		const learnerResults = learner.ok
			? learner.tables.map((t) => truncate(t, limit))
			: [];
		const learnerLast = lastWithColumns(learnerResults);
		const learnerPart = { learnerResults, learnerLast };
		const done = (
			v: Omit<Verdict, "durationMs" | "learnerResults">,
		): Verdict => ({
			...learnerPart,
			...v,
			durationMs: Math.round(now() - t0),
		});

		// --- error checks -------------------------------------------------
		if (check.type === "error") {
			if (learner.ok) {
				return done({
					pass: false,
					errorType: "expected_error",
					title: "Expected an error",
					message: `Your SQL ran without error, but this mission wants it to fail with ${describeSqlstate(check.sqlstate)}.`,
				});
			}
			if (learner.error.code === check.sqlstate) {
				return done({
					pass: true,
					title: "Correct!",
					message: `Postgres refused it with ${describeSqlstate(check.sqlstate)}, exactly as expected: ${learner.error.message}.`,
					sqlError: learner.error,
				});
			}
			return done({
				pass: false,
				errorType: "wrong_error",
				title: "Wrong error",
				message: `Expected ${describeSqlstate(check.sqlstate)}, got ${describeSqlstate(learner.error.code)}: ${learner.error.message}.`,
				sqlError: learner.error,
			});
		}

		if (!learner.ok) {
			const type = classifyError(learner.error.code);
			return done({
				pass: false,
				errorType: type,
				...errorTexts(type, learner.error),
				sqlError: learner.error,
			});
		}

		// --- reference solution -------------------------------------------
		solutionBox = await provider.open(input.datasetId, input.setupSql);
		const solution = await execSafe(solutionBox, input.solutionSql);
		if (!solution.ok) {
			return done({
				pass: false,
				errorType: "internal",
				title: "Checker problem",
				message: `The reference solution failed (${solution.error.message}). This is a content bug, not your fault.`,
			});
		}

		const verdict: Omit<Verdict, "durationMs" | "learnerResults"> = {
			pass: true,
			title: "Correct!",
			message: "",
		};
		const messages: string[] = [];

		// --- result comparison ---------------------------------------------
		if (check.type === "result" || check.type === "result+state") {
			const expectedFull = lastWithColumns(solution.tables);
			if (!expectedFull) {
				return done({
					pass: false,
					errorType: "internal",
					title: "Checker problem",
					message:
						"The reference solution returns no rows to compare. This is a content bug, not your fault.",
				});
			}
			const gotFull = learner.ok ? lastWithColumns(learner.tables) : undefined;
			verdict.expected = truncate(expectedFull, limit);
			if (!gotFull) {
				return done({
					...verdict,
					pass: false,
					errorType: "no_result",
					title: "No result set",
					message:
						check.type === "result"
							? "Your last statement did not return rows. This mission expects a SELECT result."
							: "Your last statement did not return rows. This mission expects rows back (for example with RETURNING).",
				});
			}
			const cmp = compareTables(expectedFull, gotFull, {
				orderMatters: check.orderMatters,
				matchColumnNames: check.matchColumnNames,
				tolerance: check.type === "result" ? check.tolerance : undefined,
				displayLimit: limit,
			});
			verdict.diff = cmp.diff;
			if (!cmp.equal) {
				return done({
					...verdict,
					pass: false,
					errorType: cmp.errorType,
					...compareTexts(cmp, expectedFull, gotFull, "result"),
				});
			}
			messages.push(
				`Your result matches: ${plural(expectedFull.rowCount, "row")}${check.orderMatters ? " in the right order" : ""}.`,
			);
		}

		// --- state comparison ----------------------------------------------
		if (check.type === "state" || check.type === "result+state") {
			const expState = await execSafe(solutionBox, check.verifySql);
			if (!expState.ok) {
				return done({
					...verdict,
					pass: false,
					errorType: "internal",
					title: "Checker problem",
					message: `The state verification query failed on the reference solution (${expState.error.message}). This is a content bug, not your fault.`,
				});
			}
			const gotState = await execSafe(learnerBox, check.verifySql);
			const expTable =
				lastWithColumns(expState.tables) ?? expState.tables.at(-1);
			if (!expTable) {
				return done({
					...verdict,
					pass: false,
					errorType: "internal",
					title: "Checker problem",
					message:
						"The state verification query returns nothing. This is a content bug.",
				});
			}
			verdict.stateExpected = truncate(expTable, limit);
			if (!gotState.ok) {
				return done({
					...verdict,
					pass: false,
					errorType: "wrong_final_state",
					title: "Wrong final state",
					message: `After your SQL ran, the data could not even be checked: ${gotState.error.message}. Did a statement drop or rename something it should not?`,
				});
			}
			const gotTable =
				lastWithColumns(gotState.tables) ?? gotState.tables.at(-1);
			if (!gotTable) {
				return done({
					...verdict,
					pass: false,
					errorType: "wrong_final_state",
					title: "Wrong final state",
					message:
						"After your SQL ran, the data does not match the expected state.",
				});
			}
			verdict.stateGot = truncate(gotTable, limit);
			const cmp = compareTables(expTable, gotTable, {
				orderMatters: check.orderMatters,
				matchColumnNames: check.matchColumnNames,
				displayLimit: limit,
			});
			verdict.stateDiff = cmp.diff;
			if (!cmp.equal) {
				const detail = compareTexts(cmp, expTable, gotTable, "state").message;
				return done({
					...verdict,
					pass: false,
					errorType: "wrong_final_state",
					title: "Wrong final state",
					message: `After your SQL ran, the data does not match the expected state. ${detail}`,
				});
			}
			messages.push("The final state of the data matches.");
		}

		return done({ ...verdict, message: messages.join(" ") });
	} catch (err) {
		return {
			...baseVerdict(t0),
			pass: false,
			errorType: "internal",
			title: "Checker problem",
			message: `The sandbox failed: ${toSqlErrorInfo(err, "").message}`,
		};
	} finally {
		await closeQuietly(learnerBox);
		await closeQuietly(solutionBox);
	}
}

const timeoutText = (ms: number) =>
	`Your SQL ran for more than ${Math.round(ms / 100) / 10}s and was stopped. Look for an infinite recursive CTE, a missing join condition or a huge generate_series.`;

/** Verdict used by the worker client when it had to kill a runaway query. */
export function timeoutVerdict(ms: number): Verdict {
	return {
		pass: false,
		errorType: "timeout",
		title: "Too slow",
		message: timeoutText(ms),
		learnerResults: [],
		durationMs: ms,
	};
}

export function timeoutRunOutcome(ms: number): RunOutcome {
	return {
		ok: false,
		results: [],
		errorType: "timeout",
		error: { message: timeoutText(ms) },
		durationMs: ms,
	};
}
