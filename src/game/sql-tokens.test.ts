import { describe, expect, it } from "vitest";
import {
	buildBank,
	firstGap,
	needsFix,
	render,
	suggest,
	taskHints,
	tokenize,
	toTiles,
} from "./sql-tokens";

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
			"count(*)",
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
	it("chunks pieces that read as one word", () => {
		expect(tokenize("SELECT (stats).wis, tags[1], amount::int, now()")).toEqual(
			[
				"SELECT",
				"(stats).wis",
				",",
				"tags[1]",
				",",
				"amount",
				"::INT",
				",",
				"now()",
			],
		);
		expect(
			tokenize("ORDER BY score DESC FETCH FIRST 2 ROWS WITH TIES"),
		).toEqual([
			"ORDER BY",
			"score",
			"DESC",
			"FETCH FIRST",
			"2",
			"ROWS WITH TIES",
		]);
		expect(tokenize("REFERENCES heroes (id) ON DELETE CASCADE")).toContain(
			"ON DELETE CASCADE",
		);
	});
	it("glues casts and parens, indents subqueries, breaks after ;", () => {
		expect(
			render(
				tokenize(
					"select '42'::int, count( p.id ) from pilots p where p.id in (select pilot_id from crews where x = 1); select 1",
				),
			),
		).toBe(
			"SELECT '42'::INT, count(p.id)\nFROM pilots p\nWHERE p.id IN (SELECT pilot_id\n  FROM crews\n  WHERE x = 1);\nSELECT 1",
		);
		// No clause break inside a function call.
		expect(render(tokenize("SELECT extract(year FROM d) FROM t"))).toBe(
			"SELECT extract(year FROM d)\nFROM t",
		);
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
	it("keeps distractors to words taught by the chapter", () => {
		const sol = "SELECT name FROM pilots WHERE rank = 'captain';";
		const early = buildBank(sol, "ch02-ex01", schema)?.map((t) => t.text);
		expect(early).not.toContain("HAVING");
		expect(early).not.toContain("planets");
	});
	it("adds the starter's wrong tiles so a query to fix can be laid out", () => {
		const sol = "SELECT name FROM pilots WHERE faction_id IS NULL;";
		const starter = "SELECT name FROM pilots WHERE faction_id = NULL;";
		const bank = buildBank(sol, "ch03-ex01", schema, { starterSql: starter });
		expect(toTiles(starter, bank ?? [])).not.toBeNull();
		expect(toTiles(sol, bank ?? [])).not.toBeNull();
		expect(needsFix(starter, sol)).toBe(true);
		expect(firstGap(starter, sol)).toBeNull();
		// A skeleton: the gap after SELECT is where tiles go first.
		expect(
			firstGap("SELECT\nFROM pilots;", "SELECT name, rank FROM pilots;"),
		).toBe(1);
		expect(
			needsFix("SELECT\nFROM pilots;", "SELECT name, rank FROM pilots;"),
		).toBe(false);
	});
	it("splits long solutions into parts of about 22 tiles", () => {
		const sol = `SELECT ${Array.from({ length: 20 }, (_, i) => `c${i}`).join(", ")} FROM pilots WHERE rank = 'x';`;
		const bank = buildBank(sol, "ch05-ex09", schema) ?? [];
		const pages = new Map<number, number>();
		for (const t of bank)
			pages.set(t.page ?? 0, (pages.get(t.page ?? 0) ?? 0) + 1);
		expect(pages.size).toBeGreaterThan(1);
		for (const n of pages.values()) expect(n).toBeLessThanOrEqual(28);
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
	const task = taskHints(
		"SELECT name FROM pilots;",
		undefined,
		schema,
		"ch09-ex01",
	);
	it("ranks the task's columns right after SELECT", () => {
		const s = suggest("SELECT ", { schema, task }).items;
		expect(s.slice(0, 3)).toEqual(["*", "DISTINCT", "id"]);
		expect(s).toContain("rank");
		expect(s).not.toContain("population");
	});
	it("resolves aliases, also when the FROM comes after the cursor", () => {
		expect(
			suggest("SELECT p.", { schema, after: " FROM pilots p" }).items,
		).toContain("p.rank");
	});
	it("offers ON after a joined table and its alias, then keys", () => {
		const s = "SELECT * FROM pilots p JOIN factions f ";
		expect(suggest(s, { schema }).items[0]).toBe("ON");
		const on = suggest(`${s}ON `, { schema }).items;
		expect(on[0]).toMatch(/\.(id|faction_id)$/);
		expect(on).not.toContain("NOT");
		expect(suggest(`${s}ON f.id = p.faction_id `, { schema }).items).toContain(
			"WHERE",
		);
	});
	it("walks a predicate: column, operator, value, then connectors", () => {
		const s = "SELECT * FROM pilots WHERE rank = 'x' ";
		expect(suggest(s, { schema }).items).toContain("AND");
		expect(suggest(s, { schema }).items).not.toContain("=");
		expect(
			suggest("SELECT * FROM pilots WHERE rank IS ", { schema }).items[0],
		).toBe("NULL");
	});
	it("knows DML and DDL positions", () => {
		expect(suggest("UPDATE pilots ", { schema }).items[0]).toBe("SET");
		expect(suggest("UPDATE pilots SET ", { schema }).items).toContain("rank");
		expect(suggest("UPDATE pilots SET rank ", { schema }).items).toEqual(["="]);
		expect(suggest("INSERT INTO pilots (", { schema }).items).toContain("name");
		expect(suggest("INSERT INTO pilots ", { schema }).items[0]).toBe("(");
		expect(suggest("DELETE FROM pilots ", { schema }).items[0]).toBe("WHERE");
		expect(suggest("CREATE INDEX idx ON ", { schema }).items).toContain(
			"pilots",
		);
		expect(suggest("CREATE INDEX idx ON pilots (", { schema }).items).toContain(
			"rank",
		);
		expect(suggest("ALTER TABLE pilots ", { schema }).items).toContain(
			"ADD COLUMN",
		);
		expect(suggest("SELECT x::", { schema }).items).toContain("INT");
		expect(suggest("MERGE INTO pilots p ", { schema }).items[0]).toBe("USING");
	});
	it("offers SELECT at a subquery and CTE names as tables", () => {
		expect(
			suggest("SELECT * FROM pilots WHERE id IN (", { schema }).items[0],
		).toBe("SELECT");
		expect(
			suggest("WITH top AS (SELECT name FROM pilots) SELECT * FROM ", {
				schema,
			}).items[0],
		).toBe("top");
		expect(
			suggest(
				"SELECT * FROM pilots WHERE id IN (SELECT pilot_id FROM crews) ",
				{ schema },
			).items,
		).toContain("AND");
	});
	it("keeps statements not taught yet out of the strip", () => {
		const early = suggest("", { schema, task: { ...task, chapter: 3 } }).items;
		expect(early).toContain("SELECT");
		expect(early).not.toContain("INSERT INTO");
	});
});

describe("every solution in the course survives the word bank", () => {
	const chapters = import.meta.glob<{ default: unknown }>(
		"../content/chapters/ch*.ts",
		{ eager: true },
	);
	type Ex = { id: string; solutionSql: string; starterSql?: string };
	const sols: Ex[] = [];
	for (const m of Object.values(chapters)) {
		const c = (m.default ?? Object.values(m)[0]) as {
			id: string;
			lesson?: { kind: string; solutionSql?: string; starterSql?: string }[];
			exercises?: Ex[];
			practice?: Ex[];
		};
		for (const e of [...(c.exercises ?? []), ...(c.practice ?? [])])
			sols.push(e);
		(c.lesson ?? []).forEach((s, i) => {
			if (s.kind === "try" && s.solutionSql)
				sols.push({
					id: `${c.id}-try${i}`,
					solutionSql: s.solutionSql,
					starterSql: s.starterSql,
				});
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
		sols.map((e) => [e.id, e.solutionSql, e.starterSql]),
	)("%s can be built from its bank, and laid out from its starter", (id, sql, starter) => {
		const bank = buildBank(sql, id, undefined, { starterSql: starter });
		if (!bank) return;
		const ids = toTiles(sql, bank);
		expect(ids).not.toBeNull();
		// Tiles render back to SQL that reads as the same tiles.
		const texts = (ids ?? []).map(
			(x) => bank.find((t) => t.id === x)?.text ?? "",
		);
		// SQL folds unquoted words, so `trigger` may come back as `TRIGGER`.
		const fold = (ts: string[]) =>
			ts.map((t) => (/^['"$]/.test(t) ? t : t.toUpperCase()));
		expect(fold(tokenize(render(texts)))).toEqual(fold(tokenize(sql)));
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
