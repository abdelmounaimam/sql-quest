import { describe, expect, it } from "vitest";
import { buildBank, render, suggest, tokenize, toTiles } from "./sql-tokens";

const schema = {
	planets: ["id", "name", "population"],
	pilots: ["id", "name", "rank", "faction_id"],
	factions: ["id", "name"],
};

describe("tokenize/render", () => {
	it("merges phrases, keeps functions and qualified names", () => {
		expect(
			tokenize(
				"select p.name, count(*) from pilots p where rank is not null group by p.name order by 2 desc;",
			),
		).toEqual([
			"SELECT",
			"p.name",
			",",
			"count(",
			"*",
			")",
			"FROM",
			"pilots",
			"p",
			"WHERE",
			"rank",
			"IS NOT NULL",
			"GROUP BY",
			"p.name",
			"ORDER BY",
			"2",
			"DESC",
			";",
		]);
	});
	it("renders tiles back to valid SQL, one clause per line", () => {
		const sql =
			"SELECT name, count(*) AS n FROM pilots WHERE rank = 'captain' GROUP BY name;";
		expect(render(tokenize(sql))).toBe(
			"SELECT name, count(*) AS n\nFROM pilots\nWHERE rank = 'captain'\nGROUP BY name;",
		);
	});
	it("keeps strings with spaces whole", () => {
		expect(tokenize("WHERE name = 'Hollow Moon'")).toContain("'Hollow Moon'");
	});
});

describe("buildBank", () => {
	it("contains every solution tile plus distractors, stable per seed", () => {
		const sol = "SELECT name FROM planets WHERE population > 100;";
		const a = buildBank(sol, "ex1", schema);
		const b = buildBank(sol, "ex1", schema);
		expect(a).toEqual(b);
		const texts = a?.map((t) => t.text) ?? [];
		for (const t of tokenize(sol)) expect(texts).toContain(t);
		expect(texts.length).toBeGreaterThan(tokenize(sol).length);
		// The solution can be rebuilt from the bank.
		const ids = toTiles(sol, a ?? []);
		expect(ids).not.toBeNull();
	});
	it("gives no bank for very long solutions", () => {
		expect(buildBank(Array(50).fill("SELECT 1;").join(" "), "x")).toBeNull();
	});
});

describe("suggest", () => {
	it("starts with statement keywords", () => {
		expect(suggest("", { schema }).items[0]).toBe("SELECT");
	});
	it("offers tables after FROM, filtered by the partial word", () => {
		expect(suggest("SELECT * FROM ", { schema }).items).toEqual([
			"planets",
			"pilots",
			"factions",
		]);
		const s = suggest("SELECT * FROM pl", { schema });
		expect(s.partial).toBe("pl");
		expect(s.items).toEqual(["planets"]);
	});
	it("offers columns of the queried table in WHERE, then operators, then values", () => {
		expect(suggest("SELECT * FROM planets WHERE ", { schema }).items).toContain(
			"population",
		);
		expect(
			suggest("SELECT * FROM planets WHERE population ", { schema }).items,
		).toContain(">");
		expect(
			suggest("SELECT * FROM pilots WHERE rank = ", {
				schema,
				samples: { "pilots.rank": ["'captain'"] },
			}).items[0],
		).toBe("'captain'");
	});
	it("offers FROM after a selected column", () => {
		expect(suggest("SELECT name ", { schema }).items).toContain("FROM");
	});
});

describe("every solution in the course survives the word bank", () => {
	const chapters = import.meta.glob<{ default: unknown }>(
		"../content/chapters/ch*.ts",
		{ eager: true },
	);
	type Ex = { id: string; solutionSql: string };
	const sols: Ex[] = [];
	for (const m of Object.values(chapters)) {
		const c = (m.default ?? Object.values(m)[0]) as {
			id: string;
			lesson?: { kind: string; solutionSql?: string }[];
			exercises?: Ex[];
			practice?: Ex[];
		};
		for (const e of [...(c.exercises ?? []), ...(c.practice ?? [])])
			sols.push(e);
		(c.lesson ?? []).forEach((s, i) => {
			if (s.kind === "try" && s.solutionSql)
				sols.push({ id: `${c.id}-try${i}`, solutionSql: s.solutionSql });
		});
	}
	const strip = (sql: string) =>
		sql
			.replace(/--[^\n]*/g, " ")
			.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, " ")
			.replace(/'(?:[^']|'')*'/g, " ");
	const opRuns = (sql: string) =>
		strip(sql).match(/[<>=!@#?&|~\-+/%^:$]{2,}/g) ?? [];

	it("finds the course content", () => {
		expect(sols.length).toBeGreaterThan(300);
	});
	it.each(
		sols.map((e) => [e.id, e.solutionSql]),
	)("%s keeps multi-character operators and literals intact", (_id, sql) => {
		const out = render(tokenize(sql));
		for (const op of opRuns(sql)) expect(strip(out)).toContain(op);
		// Strings and dollar-quoted bodies come back byte for byte.
		for (const lit of sql
			.replace(/--[^\n]*/g, "")
			.match(/\$(\w*)\$[\s\S]*?\$\1\$|'(?:[^']|'')*'/g) ?? [])
			expect(out).toContain(lit);
	});
});
