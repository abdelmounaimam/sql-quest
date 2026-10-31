import {
	bucketKey,
	type Canon,
	canonEqual,
	canonicalize,
	DEFAULT_TOLERANCE,
} from "./normalize";
import type { DiffRow, ResultTable, TableDiff } from "./types";

export interface CompareOptions {
	orderMatters?: boolean;
	matchColumnNames?: boolean;
	tolerance?: number;
	/** Max rows kept per side in the returned diff (default 500). */
	displayLimit?: number;
}

export type CompareErrorType =
	| "wrong_column_count"
	| "wrong_column_names"
	| "wrong_row_count"
	| "wrong_order"
	| "wrong_values";

export interface CompareResult {
	equal: boolean;
	errorType?: CompareErrorType;
	diff: TableDiff;
	/** For wrong_column_names: 0-based index of the first differing column. */
	columnIndex?: number;
	/** Column indexes (expected side) involved in value differences, most frequent first. */
	suspectColumns: number[];
	expectedRows: number;
	gotRows: number;
	expectedColumns: number;
	gotColumns: number;
}

function rowsEqual(a: Canon[], b: Canon[], tol: number): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (!canonEqual(a[i], b[i], tol)) return false;
	}
	return true;
}

function changedCells(a: Canon[], b: Canon[], tol: number): number[] {
	const out: number[] = [];
	const n = Math.max(a.length, b.length);
	for (let i = 0; i < n; i++) {
		if (i >= a.length || i >= b.length || !canonEqual(a[i], b[i], tol))
			out.push(i);
	}
	return out;
}

/**
 * Multiset matching: returns for each expected row the index of its matched
 * got row (or -1), and vice versa.
 */
function multisetMatch(
	exp: Canon[][],
	got: Canon[][],
	tol: number,
): { expMatch: number[]; gotMatch: number[] } {
	const expMatch = new Array<number>(exp.length).fill(-1);
	const gotMatch = new Array<number>(got.length).fill(-1);
	const buckets = new Map<string, number[]>();
	exp.forEach((row, i) => {
		const k = bucketKey(row);
		const list = buckets.get(k);
		if (list) list.push(i);
		else buckets.set(k, [i]);
	});
	got.forEach((row, j) => {
		const list = buckets.get(bucketKey(row));
		if (!list) return;
		for (let p = 0; p < list.length; p++) {
			const i = list[p];
			if (rowsEqual(exp[i], row, tol)) {
				expMatch[i] = j;
				gotMatch[j] = i;
				list.splice(p, 1);
				return;
			}
		}
	});
	return { expMatch, gotMatch };
}

/** Pair unmatched rows by highest number of equal cells (for "changed" display). */
function pairUnmatched(
	exp: Canon[][],
	got: Canon[][],
	expIdx: number[],
	gotIdx: number[],
	tol: number,
): Array<[number, number]> {
	const pairs: Array<[number, number]> = [];
	const usedGot = new Set<number>();
	// Bound the work for very large diffs.
	const maxScan = 400;
	for (const i of expIdx.slice(0, maxScan)) {
		let best = -1;
		let bestScore = 0;
		for (const j of gotIdx.slice(0, maxScan)) {
			if (usedGot.has(j)) continue;
			if (exp[i].length !== got[j].length) continue;
			let score = 0;
			for (let c = 0; c < exp[i].length; c++) {
				if (canonEqual(exp[i][c], got[j][c], tol)) score++;
			}
			if (score > bestScore) {
				bestScore = score;
				best = j;
			}
		}
		if (best >= 0) {
			usedGot.add(best);
			pairs.push([i, best]);
		}
	}
	return pairs;
}

function rankColumns(counts: Map<number, number>): number[] {
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

export function compareTables(
	expected: ResultTable,
	got: ResultTable,
	options: CompareOptions = {},
): CompareResult {
	const tol = options.tolerance ?? DEFAULT_TOLERANCE;
	const limit = options.displayLimit ?? 500;
	const exp = expected.rows.map((r) => r.map(canonicalize));
	const gt = got.rows.map((r) => r.map(canonicalize));
	const expectedColumns = expected.columns.length;
	const gotColumns = got.columns.length;

	const expStatus: DiffRow[] = expected.rows.map((cells) => ({
		status: "match",
		cells,
	}));
	const gotStatus: DiffRow[] = got.rows.map((cells) => ({
		status: "match",
		cells,
	}));

	let missingCount = 0;
	let extraCount = 0;
	const colCounts = new Map<number, number>();
	let multisetEqual = false;

	if (options.orderMatters) {
		const { expMatch, gotMatch } = multisetMatch(exp, gt, tol);
		missingCount = expMatch.filter((m) => m < 0).length;
		extraCount = gotMatch.filter((m) => m < 0).length;
		multisetEqual =
			missingCount === 0 && extraCount === 0 && exp.length === gt.length;
		if (multisetEqual) {
			for (let i = 0; i < exp.length; i++) {
				if (!rowsEqual(exp[i], gt[i], tol)) {
					expStatus[i].status = "moved";
					gotStatus[i].status = "moved";
				}
			}
		} else {
			const n = Math.min(exp.length, gt.length);
			for (let i = 0; i < n; i++) {
				if (rowsEqual(exp[i], gt[i], tol)) continue;
				if (expMatch[i] >= 0) {
					expStatus[i].status = "moved";
				} else {
					const cells = changedCells(exp[i], gt[i], tol);
					expStatus[i].status = "changed";
					expStatus[i].changedCells = cells;
					for (const c of cells) colCounts.set(c, (colCounts.get(c) ?? 0) + 1);
				}
				if (gotMatch[i] >= 0) {
					gotStatus[i].status = "moved";
				} else {
					gotStatus[i].status = "changed";
					gotStatus[i].changedCells = changedCells(exp[i], gt[i], tol);
				}
			}
			for (let i = n; i < exp.length; i++)
				expStatus[i].status = expMatch[i] >= 0 ? "moved" : "missing";
			for (let j = n; j < gt.length; j++)
				gotStatus[j].status = gotMatch[j] >= 0 ? "moved" : "extra";
		}
	} else {
		const { expMatch, gotMatch } = multisetMatch(exp, gt, tol);
		const expUn: number[] = [];
		const gotUn: number[] = [];
		expMatch.forEach((m, i) => {
			if (m < 0) {
				expStatus[i].status = "missing";
				expUn.push(i);
			}
		});
		gotMatch.forEach((m, j) => {
			if (m < 0) {
				gotStatus[j].status = "extra";
				gotUn.push(j);
			}
		});
		missingCount = expUn.length;
		extraCount = gotUn.length;
		multisetEqual = missingCount === 0 && extraCount === 0;
		if (!multisetEqual && expectedColumns === gotColumns) {
			for (const [i, j] of pairUnmatched(exp, gt, expUn, gotUn, tol)) {
				const cells = changedCells(exp[i], gt[j], tol);
				expStatus[i].status = "changed";
				expStatus[i].changedCells = cells;
				gotStatus[j].status = "changed";
				gotStatus[j].changedCells = cells;
				for (const c of cells) colCounts.set(c, (colCounts.get(c) ?? 0) + 1);
			}
		}
	}

	const diff: TableDiff = {
		columns: expected.columns.map((c) => c.name),
		expected: expStatus.slice(0, limit),
		got: gotStatus.slice(0, limit),
		missingCount,
		extraCount,
	};

	const base = {
		diff,
		suspectColumns: rankColumns(colCounts),
		expectedRows: exp.length,
		gotRows: gt.length,
		expectedColumns,
		gotColumns,
	};

	if (expectedColumns !== gotColumns) {
		return { ...base, equal: false, errorType: "wrong_column_count" };
	}
	if (options.matchColumnNames) {
		for (let i = 0; i < expectedColumns; i++) {
			if (expected.columns[i].name !== got.columns[i].name) {
				return {
					...base,
					equal: false,
					errorType: "wrong_column_names",
					columnIndex: i,
				};
			}
		}
	}
	if (exp.length !== gt.length) {
		return { ...base, equal: false, errorType: "wrong_row_count" };
	}
	if (!multisetEqual) {
		return { ...base, equal: false, errorType: "wrong_values" };
	}
	if (options.orderMatters) {
		const ordered = exp.every((row, i) => rowsEqual(row, gt[i], tol));
		if (!ordered) return { ...base, equal: false, errorType: "wrong_order" };
	}
	return { ...base, equal: true };
}
