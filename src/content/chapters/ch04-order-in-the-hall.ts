import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch04-order-in-the-hall",
	order: 4,
	world: "The Starport Docks",
	tier: "novice",
	track: "query",
	title: "Order in the Hall",
	subtitle: "ORDER BY, NULLS FIRST/LAST, LIMIT, OFFSET, DISTINCT and collations",
	emoji: "🏆",
	datasetId: "starport",
	concepts: ["order-by", "limit-offset", "distinct", "collation-sorting"],
	prerequisites: ["ch03-the-void"],
	lesson: [
		{
			kind: "explain",
			title: "Sort rows with ORDER BY",
			body: "A table is a *set* of rows: without instructions, the database returns them in whatever order is convenient, and that order can change.\n\n**ORDER BY** sorts the result:\n```sql\nSELECT name, credits\nFROM pilots\nORDER BY credits DESC;\n```\n`ASC` (smallest first) is the default, `DESC` reverses it.",
		},
		{
			kind: "example",
			title: "Several sort keys",
			body: "Ties on the first key are broken by the next one. Each key has its own direction: here credits go down, names go up. Notice Lumen (NULL credits) at the **top**: in DESC order NULLs come first.",
			sql: "SELECT name, credits\nFROM pilots\nORDER BY credits DESC, name ASC;",
		},
		{
			kind: "explain",
			title: "NULLS FIRST and NULLS LAST",
			body: "By default NULL sorts as *larger than every value*: last in ASC, **first** in DESC. Choose explicitly:\n```sql\nORDER BY credits DESC NULLS LAST\n```",
		},
		{
			kind: "quiz",
			question:
				"`ORDER BY rank, credits DESC`: which direction is used for `rank`?",
			choices: [
				"DESC, like credits",
				"ASC, the default",
				"Random, since no direction is given",
				"It is an error",
			],
			answerIndex: 1,
			explanation:
				"A direction applies only to the key it follows. `rank` gets the default ASC, `credits` is DESC.",
		},
		{
			kind: "explain",
			title: "LIMIT and OFFSET",
			body: "`LIMIT n` keeps the first n rows, `OFFSET k` skips k rows first. Page 3 with 5 rows per page is `LIMIT 5 OFFSET 10`.\n\nWithout ORDER BY, *first* is not defined, so always sort first.\n\nTo keep rows tied with the last one: `FETCH FIRST 3 ROWS WITH TIES`.",
		},
		{
			kind: "example",
			title: "Top 3 with LIMIT",
			body: "ORDER BY sorts the rows, then LIMIT keeps the first 3.",
			sql: "SELECT name, credits\nFROM pilots\nWHERE credits IS NOT NULL\nORDER BY credits DESC\nLIMIT 3;",
		},
		{
			kind: "example",
			title: "Remove duplicates with DISTINCT",
			body: "`SELECT DISTINCT` removes duplicate **rows** from the result. With several columns, the *combination* must repeat to be removed.",
			sql: "SELECT DISTINCT species\nFROM pilots;",
		},
		{
			kind: "explain",
			title: "Collations and text order",
			body: "Text order depends on the **collation**. This database uses `C`: plain byte order, so **every capital letter comes before every lower-case one**, and accented letters come after `z`:\n\n`Zed` < `ace` < `zigzag` < `Étoile`\n\nFor dictionary order, ask for another collation:\n```sql\nORDER BY callsign COLLATE \"unicode\"\n```",
		},
		{
			kind: "example",
			title: "Byte order vs dictionary order",
			body: "This sorts the callsigns with the `unicode` collation. Compare with a plain `ORDER BY callsign`.",
			sql: "SELECT callsign\nFROM pilots\nWHERE callsign IS NOT NULL\nORDER BY callsign COLLATE \"unicode\";",
		},
		{
			kind: "try",
			title: "Three longest routes",
			prompt:
				"Return the **from_planet_id**, **to_planet_id** and **distance_ly** of the **3 longest** routes, longest first.",
			starterSql:
				"SELECT from_planet_id, to_planet_id, distance_ly\nFROM routes\nORDER BY distance_ly\nLIMIT 3;",
			solutionSql:
				"SELECT from_planet_id, to_planet_id, distance_ly FROM routes ORDER BY distance_ly DESC LIMIT 3;",
			check: { type: "result", orderMatters: true },
			hints: [
				"The starter sorts the wrong way round, so it returns the 3 shortest.",
				"Add DESC after the sort key.",
			],
		},
	],
	exercises: [
		{
			id: "ch04-ex01",
			title: "Planets A to Z",
			prompt: "Return the **name** of every planet, sorted by name **A to Z**.",
			difficulty: 1,
			kind: "query",
			concepts: ["order-by"],
			solutionSql: "SELECT name FROM planets ORDER BY name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Sorting is a separate clause at the end of the query.",
				"ORDER BY name (ascending is the default).",
				"SELECT name FROM planets ORDER BY name;",
			],
			explanation:
				"`ORDER BY name` sorts ascending. Note that *Éclat* is at the very end: in the `C` collation accented letters come after z. Collations are covered later in this chapter.",
		},
		{
			id: "ch04-ex02",
			title: "Credits descending, NULLs last",
			prompt:
				"Return every pilot's **name** and **credits**, richest first. Pilots with **unknown** credits go at the **very end**. Break ties by **name A to Z**.",
			difficulty: 2,
			kind: "query",
			concepts: ["order-by"],
			starterSql: "SELECT name, credits\nFROM pilots\nORDER BY credits DESC;",
			solutionSql:
				"SELECT name, credits FROM pilots ORDER BY credits DESC NULLS LAST, name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Run the starter: which row is on top? And which comes first between Ada and Mira?",
				"In DESC order NULLs come first unless you say otherwise; ties need a second key.",
				"ORDER BY credits DESC NULLS LAST, name",
			],
			explanation:
				"`NULLS LAST` overrides the default (NULLs first in DESC). The second key `name` decides between Ada and Mira, Bram and Fizzik, Hana and Rhea.\n\n**Pitfall:** `ORDER BY credits DESC, name DESC` would also flip the names.",
		},
		{
			id: "ch04-ex03",
			title: "Top 3 known gravity",
			prompt:
				"Return the **name** and **gravity** of the **3** planets with the **highest known** gravity, strongest first.",
			difficulty: 2,
			kind: "query",
			concepts: ["limit-offset", "order-by"],
			starterSql: "SELECT name, gravity\nFROM planets\nORDER BY gravity DESC\nLIMIT 3;",
			solutionSql:
				"SELECT name, gravity FROM planets WHERE gravity IS NOT NULL ORDER BY gravity DESC LIMIT 3;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Run the starter: Hollow Moon is first, and its gravity is NULL.",
				"Exclude the NULL gravity, with a WHERE or with NULLS LAST.",
				"ORDER BY gravity DESC NULLS LAST LIMIT 3",
			],
			explanation:
				"LIMIT cuts *after* sorting, so the NULL placement matters: in DESC order the NULL gravity sorts first and takes one of the 3 rows. Filter it out or use `NULLS LAST`.",
		},
		{
			id: "ch04-ex04",
			title: "Second page of 5",
			prompt:
				"Return the **name** of the ships on **page 2**: ships sorted by name, 5 per page.",
			difficulty: 2,
			kind: "query",
			concepts: ["limit-offset"],
			solutionSql: "SELECT name FROM ships ORDER BY name LIMIT 5 OFFSET 5;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Page 2 starts after the 5 ships of page 1.",
				"OFFSET skips rows, LIMIT keeps rows.",
				"ORDER BY name LIMIT 5 OFFSET 5",
			],
			explanation:
				"Page p with s rows per page is `LIMIT s OFFSET (p - 1) * s`. Ship names are unique, so the order is fully determined.\n\n**Note:** deep OFFSETs get slow on big tables (the skipped rows are still read). World 10 shows the faster *keyset* pagination.",
		},
		{
			id: "ch04-ex05",
			title: "Distinct species",
			prompt: "Return each **species** of the pilots **once**.",
			difficulty: 1,
			kind: "query",
			concepts: ["distinct"],
			starterSql: "SELECT species\nFROM pilots;",
			solutionSql: "SELECT DISTINCT species FROM pilots;",
			check: { type: "result" },
			hints: [
				"The starter repeats Human again and again.",
				"One keyword after SELECT removes duplicate rows.",
				"SELECT DISTINCT species FROM pilots;",
			],
			explanation:
				"`DISTINCT` collapses identical rows: 24 pilots, 4 species. `GROUP BY species` (World 2) gives the same rows and can also count them.",
		},
		{
			id: "ch04-ex06",
			title: "Distinct species and rank pairs",
			prompt:
				"Return each different combination of **species** and **rank** found among pilots, once each.",
			difficulty: 2,
			kind: "query",
			concepts: ["distinct"],
			solutionSql: "SELECT DISTINCT species, rank FROM pilots;",
			check: { type: "result" },
			hints: [
				"DISTINCT works on whole rows, not on a single column.",
				"Select both columns after DISTINCT.",
				"SELECT DISTINCT species, rank FROM pilots;",
			],
			explanation:
				"`DISTINCT` applies to the **whole** selected row: two Human captains collapse, a Human captain and a Zorblax captain don't.\n\n**Misconception:** `DISTINCT(species), rank` does not mean *distinct species only*; the parentheses change nothing.",
		},
		{
			id: "ch04-ex07",
			title: "Biggest holds, ties included",
			prompt:
				"Return the **name** and **cargo_capacity** of the ships with the **2** largest **known** cargo capacities, **including every ship tied** with the last one.",
			difficulty: 3,
			kind: "query",
			concepts: ["limit-offset", "order-by"],
			starterSql:
				"SELECT name, cargo_capacity\nFROM ships\nORDER BY cargo_capacity DESC NULLS LAST\nLIMIT 2;",
			solutionSql:
				"SELECT name, cargo_capacity FROM ships ORDER BY cargo_capacity DESC NULLS LAST FETCH FIRST 2 ROWS WITH TIES;",
			check: { type: "result" },
			hints: [
				"Three ships share a capacity of 900. LIMIT 2 keeps only one of them.",
				"The standard syntax FETCH FIRST n ROWS has a WITH TIES option.",
				"ORDER BY cargo_capacity DESC NULLS LAST FETCH FIRST 2 ROWS WITH TIES",
			],
			explanation:
				"`WITH TIES` keeps going while rows tie with the last kept row: Silent Vow (1200) plus the three ships with 900. It requires an ORDER BY, which defines what a tie is.\n\n**Pitfall:** `LIMIT 2` picks one of the tied ships arbitrarily.",
		},
		{
			id: "ch04-ex08",
			title: "Sort with a unicode collation",
			prompt:
				"Return every **known callsign** sorted in **dictionary order**: case does not split the list, and accented letters sort with their base letter (`Étoile` right after `ace`).",
			difficulty: 3,
			kind: "query",
			concepts: ["collation-sorting", "order-by"],
			starterSql:
				"SELECT callsign\nFROM pilots\nWHERE callsign IS NOT NULL\nORDER BY callsign;",
			solutionSql:
				'SELECT callsign FROM pilots WHERE callsign IS NOT NULL ORDER BY callsign COLLATE "unicode";',
			check: { type: "result", orderMatters: true },
			hints: [
				"The database collation is C: pure byte order.",
				"You can choose another collation just for the sort.",
				'ORDER BY callsign COLLATE "unicode"',
			],
			explanation:
				"`COLLATE \"unicode\"` sorts like a dictionary: *ace, Étoile, fizz, Halo...*. The data is unchanged, only the comparison rule differs.\n\n**Pitfall:** `ORDER BY lower(callsign)` fixes the case problem but still puts É after z.",
		},
		{
			id: "ch04-ex09",
			title: "Boss: The Hall of Fame",
			story: "Combines WHERE, a two key ORDER BY and OFFSET pagination.",
			prompt:
				"Return the **name**, **callsign** and **credits** of the pilots on **page 3**:\n\n- only pilots **with a callsign**;\n- sorted by **credits, highest first**, ties broken by **name A to Z**;\n- 5 pilots per page (page 1 = the 5 richest).",
			difficulty: 4,
			kind: "query",
			concepts: ["order-by", "limit-offset", "null-basics", "where-comparison"],
			solutionSql:
				"SELECT name, callsign, credits\nFROM pilots\nWHERE callsign IS NOT NULL\nORDER BY credits DESC, name\nLIMIT 5 OFFSET 10;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Build it clause by clause: WHERE, then ORDER BY, then the page.",
				"Page 3 skips the first two pages (10 pilots). Ties on credits need name as a second key.",
				"WHERE callsign IS NOT NULL ORDER BY credits DESC, name LIMIT 5 OFFSET 10",
			],
			explanation:
				"The clauses run in a logical order: FROM, WHERE, then ORDER BY, then OFFSET/LIMIT. That is why the page is cut *after* the filter and the sort.\n\nThe name tie breaker matters here: Bram and Fizzik both have 12,500.50 credits, so do Hana and Rhea (9,100).",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch04-pr01",
			title: "Commodities by price",
			prompt:
				"Return the **name** and **base_price** of every commodity, **cheapest first**, ties broken by **name A to Z**. Commodities without a price come last.",
			difficulty: 1,
			kind: "query",
			concepts: ["order-by"],
			solutionSql:
				"SELECT name, base_price FROM commodities ORDER BY base_price, name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Two sort keys.",
				"In ASC order NULLs are already last.",
				"ORDER BY base_price, name",
			],
			explanation:
				"Dragon Pepper and Hydroponic Rice both cost 30.50; the name decides. Star Charts (NULL) is last by default in ascending order.",
		},
		{
			id: "ch04-pr02",
			title: "Discovery date descending, NULLs last",
			prompt:
				"Return the **name** and **discovered_on** of every planet, **most recently discovered first**; planets with an unknown date go **last**.",
			difficulty: 2,
			kind: "query",
			concepts: ["order-by"],
			solutionSql:
				"SELECT name, discovered_on FROM planets ORDER BY discovered_on DESC NULLS LAST;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Newest first is descending.",
				"In DESC order NULLs come first unless you ask otherwise.",
				"ORDER BY discovered_on DESC NULLS LAST",
			],
			explanation: "Without `NULLS LAST`, Hollow Moon would top the list.",
		},
		{
			id: "ch04-pr03",
			title: "Five most recent trades",
			prompt:
				"Return the **id** and **traded_at** of the **5 most recent** trades, most recent first.",
			difficulty: 1,
			kind: "query",
			concepts: ["limit-offset"],
			solutionSql: "SELECT id, traded_at FROM trades ORDER BY traded_at DESC LIMIT 5;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Sort by time, newest first.",
				"Then keep 5 rows.",
				"ORDER BY traded_at DESC LIMIT 5",
			],
			explanation: "Sort first, then limit. Without ORDER BY, LIMIT 5 returns 5 arbitrary trades.",
		},
		{
			id: "ch04-pr04",
			title: "Second longest route",
			prompt:
				"Return the **from_planet_id**, **to_planet_id** and **distance_ly** of the **second longest** route.",
			difficulty: 2,
			kind: "query",
			concepts: ["limit-offset"],
			solutionSql:
				"SELECT from_planet_id, to_planet_id, distance_ly FROM routes ORDER BY distance_ly DESC LIMIT 1 OFFSET 1;",
			check: { type: "result" },
			hints: [
				"Sort longest first, skip one, keep one.",
				"OFFSET 1 skips the longest one.",
				"ORDER BY distance_ly DESC LIMIT 1 OFFSET 1",
			],
			explanation:
				"`LIMIT 1 OFFSET 1` is the classic *second highest* trick. It is only safe when there is no tie for first place, as here.",
		},
		{
			id: "ch04-pr05",
			title: "Distinct non NULL hazards",
			prompt: "Return each **known** route hazard **once**.",
			difficulty: 2,
			kind: "query",
			concepts: ["distinct"],
			solutionSql: "SELECT DISTINCT hazard FROM routes WHERE hazard IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"Remove duplicates, and remove the routes with a NULL hazard.",
				"DISTINCT plus a WHERE ... IS NOT NULL.",
				"SELECT DISTINCT hazard FROM routes WHERE hazard IS NOT NULL;",
			],
			explanation: "Three distinct hazards: asteroids, ion storms and pirates.",
		},
		{
			id: "ch04-pr06",
			title: "Categories, NULL included",
			prompt:
				"Return each commodity **category** once, **including** the missing category (it should appear as one NULL row).",
			difficulty: 2,
			kind: "query",
			concepts: ["distinct", "null-basics"],
			solutionSql: "SELECT DISTINCT category FROM commodities;",
			check: { type: "result" },
			hints: [
				"No filter this time.",
				"DISTINCT treats all NULLs as one group.",
				"SELECT DISTINCT category FROM commodities;",
			],
			explanation:
				"For DISTINCT, two NULLs count as duplicates, even though `NULL = NULL` is unknown. You get 7 rows, one of them NULL.",
		},
		{
			id: "ch04-pr07",
			title: "Planets in dictionary order",
			prompt:
				"Return the **name** of every planet in **dictionary order**, with `Éclat` sorted among the E's (right after Cinderfall).",
			difficulty: 2,
			kind: "query",
			concepts: ["collation-sorting"],
			starterSql: "SELECT name\nFROM planets\nORDER BY name;",
			solutionSql: 'SELECT name FROM planets ORDER BY name COLLATE "unicode";',
			check: { type: "result", orderMatters: true },
			hints: [
				"Byte order puts É after every plain letter.",
				"Pick a dictionary collation for the sort key.",
				'ORDER BY name COLLATE "unicode"',
			],
			explanation:
				"`COLLATE \"unicode\"` uses the Unicode collation algorithm: accents are secondary differences, so É sorts with E.",
		},
	],
};

export default chapter;
