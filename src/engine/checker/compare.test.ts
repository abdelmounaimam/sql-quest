import { describe, expect, it } from "vitest";
import { compareTables } from "./compare";
import { positionToLineColumn } from "./errors";
import { findForbidden, stripSqlLiterals } from "./forbidden";
import { canonicalize, toDisplayValue, valuesEqual } from "./normalize";
import type { ResultTable } from "./types";

const table = (cols: string[], rows: unknown[][]): ResultTable => ({
	columns: cols.map((name) => ({ name, dataTypeID: 25 })),
	rows,
	rowCount: rows.length,
});

describe("normalize", () => {
	it("formats dates and timestamps", () => {
		const d = new Date("2024-01-02T00:00:00.000Z");
		expect(toDisplayValue(d, "date")).toBe("2024-01-02");
		expect(toDisplayValue(d, "timestamptz")).toBe("2024-01-02T00:00:00.000Z");
		expect(toDisplayValue(d)).toBe("2024-01-02");
		expect(toDisplayValue(new Date("2024-01-02T10:30:00Z"))).toBe(
			"2024-01-02T10:30:00.000Z",
		);
	});

	it("handles bigint, NaN, bytes and nested arrays", () => {
		expect(toDisplayValue(42n)).toBe(42);
		expect(toDisplayValue(2n ** 70n)).toBe((2n ** 70n).toString());
		expect(toDisplayValue(Number.NaN)).toBe("NaN");
		expect(toDisplayValue(new Uint8Array([1, 255]))).toBe("\\x01ff");
		expect(toDisplayValue([[1, null]])).toEqual([[1, null]]);
	});

	it("treats numeric strings, numbers and tolerance alike", () => {
		expect(valuesEqual("1.50", 1.5)).toBe(true);
		expect(valuesEqual(0.1 + 0.2, 0.3)).toBe(true);
		expect(valuesEqual(1, 1.01)).toBe(false);
		expect(valuesEqual(1, 1.01, 0.05)).toBe(true);
		expect(valuesEqual(null, 0)).toBe(false);
		expect(valuesEqual(null, null)).toBe(true);
	});

	it("ignores json key order and parses vectors", () => {
		expect(
			valuesEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }),
		).toBe(true);
		expect(valuesEqual("[1,2,3]", "[1, 2, 3.0000000001]")).toBe(true);
		expect(canonicalize("[1,2]")).toEqual([1, 2]);
	});

	it("compares text timestamps with Date values", () => {
		expect(
			valuesEqual("2024-01-02 10:00:00+00", new Date("2024-01-02T10:00:00Z")),
		).toBe(true);
		expect(valuesEqual("2024-01-02", new Date("2024-01-02T00:00:00Z"))).toBe(
			true,
		);
	});
});

describe("compareTables", () => {
	const exp = table(
		["id", "name"],
		[
			[1, "a"],
			[2, "b"],
			[3, "c"],
		],
	);

	it("passes multisets in any order", () => {
		const got = table(
			["x", "y"],
			[
				[3, "c"],
				[1, "a"],
				[2, "b"],
			],
		);
		expect(compareTables(exp, got).equal).toBe(true);
	});

	it("detects wrong order when order matters", () => {
		const got = table(
			["id", "name"],
			[
				[3, "c"],
				[1, "a"],
				[2, "b"],
			],
		);
		const r = compareTables(exp, got, { orderMatters: true });
		expect(r.errorType).toBe("wrong_order");
		expect(r.diff.got.filter((d) => d.status === "moved").length).toBe(3);
	});

	it("detects wrong column count and names", () => {
		expect(compareTables(exp, table(["id"], [[1], [2], [3]])).errorType).toBe(
			"wrong_column_count",
		);
		const r = compareTables(exp, table(["id", "label"], exp.rows), {
			matchColumnNames: true,
		});
		expect(r.errorType).toBe("wrong_column_names");
		expect(r.columnIndex).toBe(1);
	});

	it("detects wrong row count with missing rows", () => {
		const r = compareTables(exp, table(["id", "name"], [[1, "a"]]));
		expect(r.errorType).toBe("wrong_row_count");
		expect(r.diff.missingCount).toBe(2);
	});

	it("pairs changed rows and points at the suspect column", () => {
		const r = compareTables(
			exp,
			table(
				["id", "name"],
				[
					[1, "a"],
					[2, "B"],
					[3, "c"],
				],
			),
		);
		expect(r.errorType).toBe("wrong_values");
		expect(r.suspectColumns[0]).toBe(1);
		const changed = r.diff.got.find((d) => d.status === "changed");
		expect(changed?.changedCells).toEqual([1]);
	});

	it("marks ordered changed rows", () => {
		const r = compareTables(
			exp,
			table(
				["id", "name"],
				[
					[1, "a"],
					[2, "z"],
					[3, "c"],
				],
			),
			{ orderMatters: true },
		);
		expect(r.errorType).toBe("wrong_values");
		expect(r.diff.expected[1]).toMatchObject({
			status: "changed",
			changedCells: [1],
		});
	});

	it("handles duplicates as a multiset", () => {
		const e = table(["v"], [[1], [1], [2]]);
		expect(compareTables(e, table(["v"], [[1], [2], [2]])).errorType).toBe(
			"wrong_values",
		);
		expect(compareTables(e, table(["v"], [[2], [1], [1]])).equal).toBe(true);
	});
});

describe("forbidden", () => {
	it("blocks dangerous statements", () => {
		expect(findForbidden("COPY t TO '/tmp/x'")).toMatch(/COPY/);
		expect(findForbidden("select 1; copy t from program 'ls'")).toMatch(/COPY/);
		expect(findForbidden("ALTER SYSTEM SET work_mem = '1GB'")).not.toBeNull();
		expect(findForbidden("drop database postgres")).not.toBeNull();
		expect(findForbidden("select pg_read_file('/etc/passwd')")).not.toBeNull();
		expect(findForbidden("set role postgres")).not.toBeNull();
		expect(findForbidden("LOAD 'plpgsql'")).not.toBeNull();
	});

	it("allows the same words inside literals, comments and identifiers", () => {
		expect(findForbidden("select 'copy t to program' as s")).toBeNull();
		expect(findForbidden("-- drop database x\nselect 1")).toBeNull();
		expect(findForbidden('select "copy" from t')).toBeNull();
		expect(findForbidden("select $$alter system$$")).toBeNull();
		expect(findForbidden("select copy_count from t")).toBeNull();
	});

	it("keeps offsets stable when stripping", () => {
		const sql = "select 'abc' -- x\nfrom t";
		expect(stripSqlLiterals(sql).length).toBe(sql.length);
	});
});

describe("errors", () => {
	it("maps positions to line and column", () => {
		expect(positionToLineColumn("select 1\nfrom nope", 15)).toEqual({
			line: 2,
			column: 6,
		});
	});
});
