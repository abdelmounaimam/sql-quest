import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch03-the-void",
	order: 3,
	world: "The Starport Docks",
	tier: "novice",
	track: "query",
	title: "The Void",
	subtitle: "NULL, IS NULL, three valued logic, IS DISTINCT FROM, COALESCE and NULLIF",
	emoji: "🕳️",
	datasetId: "starport",
	concepts: [
		"null-basics",
		"three-valued-logic",
		"is-distinct-from",
		"coalesce-nullif",
	],
	prerequisites: ["ch02-sifting-the-ledger"],
	lesson: [
		{
			kind: "explain",
			title: "What NULL means",
			body: "**NULL** marks a missing or unknown value. It is **not** 0 and **not** empty text. In the `planets` table:\n\n- Mirage has a `population` of `0`: a known value.\n- Obsidian Reach has a `population` of `NULL`: the value is unknown.\n\nIn the result grid NULL shows as an empty, greyed cell.",
		},
		{
			kind: "example",
			title: "Test for NULL with IS NULL",
			body: "Pilots with no faction have a NULL `faction_id`. Test it with **IS NULL**.",
			sql: "SELECT name, faction_id\nFROM pilots\nWHERE faction_id IS NULL;",
		},
		{
			kind: "quiz",
			question:
				"What does `SELECT name FROM pilots WHERE faction_id = NULL;` return?",
			choices: [
				"The pilots with no faction, same as IS NULL",
				"No rows at all",
				"Every pilot",
				"An error",
			],
			answerIndex: 1,
			explanation:
				"Comparing anything with NULL gives *unknown*, never true, so WHERE keeps nothing. No error is raised. Always write `IS NULL` or `IS NOT NULL`.",
		},
		{
			kind: "explain",
			title: "Three valued logic",
			body: "With NULL around, a condition has **three** possible outcomes: TRUE, FALSE or **UNKNOWN**. WHERE keeps only TRUE.\n\n| expression | result |\n|---|---|\n| `NULL = NULL` | unknown |\n| `NULL <> 2` | unknown |\n| `NULL OR TRUE` | **true** |\n| `NULL AND FALSE` | **false** |\n| `NOT unknown` | unknown |",
		},
		{
			kind: "example",
			title: "Evaluate NULL expressions",
			body: "A SELECT without FROM evaluates expressions once. Unknown shows up as NULL.",
			sql: "SELECT NULL = NULL AS null_eq_null,\n       NULL OR TRUE  AS null_or_true,\n       NULL AND FALSE AS null_and_false,\n       NOT (NULL = 1) AS not_unknown;",
		},
		{
			kind: "explain",
			title: "Rows dropped by <> and how to keep them",
			body: "`WHERE faction_id <> 2` looks like *every pilot outside faction 2*, but for pilots with a NULL `faction_id`, `NULL <> 2` is unknown, so those rows are dropped.\n\nTwo fixes:\n```sql\nWHERE faction_id <> 2 OR faction_id IS NULL\nWHERE faction_id IS DISTINCT FROM 2\n```\n`IS DISTINCT FROM` is a NULL-safe `<>`: it always answers true or false.",
		},
		{
			kind: "explain",
			title: "COALESCE and NULLIF",
			body: "`COALESCE(a, b, ...)` returns the first argument that is not NULL:\n```sql\nCOALESCE(callsign, 'no callsign')\n```\n`NULLIF(a, b)` does the reverse: it returns NULL when `a = b`, else `a`. Useful to turn a placeholder value like `''` into a real NULL.",
		},
		{
			kind: "example",
			title: "Replace NULL with COALESCE",
			body: "Every NULL callsign is replaced by a placeholder; real callsigns are untouched.",
			sql: "SELECT name, COALESCE(callsign, '(none)') AS radio\nFROM pilots;",
		},
		{
			kind: "try",
			title: "Planets with a NULL sector",
			prompt:
				"Return the **name** of every planet whose **sector** is unknown.",
			starterSql: "SELECT name\nFROM planets\nWHERE sector = NULL;",
			solutionSql: "SELECT name FROM planets WHERE sector IS NULL;",
			check: { type: "result" },
			hints: [
				"Run the starter: `= NULL` never matches.",
				"WHERE sector IS NULL",
			],
		},
	],
	exercises: [
		{
			id: "ch03-ex01",
			title: "Pilots without a faction",
			prompt: "Return the **name** of every pilot who has **no faction**.",
			difficulty: 1,
			kind: "query",
			concepts: ["null-basics"],
			starterSql: "SELECT name\nFROM pilots\nWHERE faction_id = NULL;",
			solutionSql: "SELECT name FROM pilots WHERE faction_id IS NULL;",
			check: { type: "result" },
			hints: [
				"The starter returns nothing. Why can't `= NULL` ever be true?",
				"Missing values are tested with a special operator.",
				"WHERE faction_id IS NULL",
			],
			explanation:
				"`IS NULL` is the only way to ask *is this missing?*. `= NULL` compares with an unknown value, so the answer is unknown and the row is dropped.",
		},
		{
			id: "ch03-ex02",
			title: "Planets with a known population",
			prompt:
				"Return the **name** and **population** of every planet whose population is **known** (zero counts as known).",
			difficulty: 1,
			kind: "query",
			concepts: ["null-basics"],
			solutionSql:
				"SELECT name, population FROM planets WHERE population IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"Known means not missing.",
				"There is a negated form of IS NULL.",
				"WHERE population IS NOT NULL",
			],
			explanation:
				"`IS NOT NULL` keeps Mirage (population 0): zero is a real, known number. `population > 0` would wrongly drop it.",
		},
		{
			id: "ch03-ex03",
			title: "Population zero or unknown",
			prompt:
				"Return the **name** of every planet whose population is **0** or **unknown**.",
			difficulty: 2,
			kind: "query",
			concepts: ["null-basics"],
			solutionSql:
				"SELECT name FROM planets WHERE population = 0 OR population IS NULL;",
			check: { type: "result" },
			hints: [
				"Two different situations: a real zero and a missing value.",
				"Each needs its own test, joined by OR.",
				"WHERE population = 0 OR population IS NULL",
			],
			explanation:
				"0 and NULL are different facts, so they need different tests. `COALESCE(population, 0) = 0` is an equivalent single condition.",
		},
		{
			id: "ch03-ex04",
			title: "Not faction 2, NULL included",
			prompt:
				"Return the **name** of every pilot whose `faction_id` is **not 2**, including pilots with **no faction**.",
			difficulty: 2,
			kind: "query",
			concepts: ["three-valued-logic"],
			starterSql: "SELECT name\nFROM pilots\nWHERE faction_id <> 2;",
			solutionSql:
				"SELECT name FROM pilots WHERE faction_id <> 2 OR faction_id IS NULL;",
			check: { type: "result" },
			hints: [
				"Run the starter and look for Dax, Lumen, Quill and Xyla. Why are they missing?",
				"For a pilot with a NULL `faction_id`, `NULL <> 2` is unknown, and WHERE drops unknown rows.",
				"Add `OR faction_id IS NULL`.",
			],
			explanation:
				"WHERE keeps TRUE only. `NULL <> 2` is UNKNOWN, so pilots with no faction are dropped without any error. Adding `OR faction_id IS NULL` brings them back (`UNKNOWN OR TRUE` is TRUE).\n\n**Alternative:** `WHERE faction_id IS DISTINCT FROM 2`.",
		},
		{
			id: "ch03-ex05",
			title: "Category not food, NULL included",
			prompt:
				"Return the **name** and **category** of every commodity whose category is **not food**, including the commodity with **no category**. Use `IS DISTINCT FROM`.",
			difficulty: 2,
			kind: "query",
			concepts: ["is-distinct-from"],
			solutionSql:
				"SELECT name, category FROM commodities WHERE category IS DISTINCT FROM 'food';",
			check: { type: "result" },
			hints: [
				"`category <> 'food'` would drop Comet Tea.",
				"IS DISTINCT FROM is a NULL-safe not-equal.",
				"WHERE category IS DISTINCT FROM 'food'",
			],
			explanation:
				"`IS DISTINCT FROM` treats NULL as an ordinary value: NULL is distinct from 'food', so Comet Tea is kept. Its opposite, `IS NOT DISTINCT FROM`, is a NULL-safe `=`.",
		},
		{
			id: "ch03-ex06",
			title: "Default text for NULL callsigns",
			prompt:
				"Return every pilot's **name** and **callsign**, showing the text **no callsign** when the callsign is missing.",
			difficulty: 2,
			kind: "query",
			concepts: ["coalesce-nullif"],
			starterSql: "SELECT name, callsign\nFROM pilots;",
			solutionSql:
				"SELECT name, COALESCE(callsign, 'no callsign') AS callsign FROM pilots;",
			check: { type: "result" },
			hints: [
				"You need a fallback value for NULL.",
				"COALESCE returns its first non-NULL argument.",
				"COALESCE(callsign, 'no callsign')",
			],
			explanation:
				"`COALESCE(callsign, 'no callsign')` keeps real callsigns and replaces the NULLs. The fallback must have a compatible type: text for text.",
		},
		{
			id: "ch03-ex07",
			title: "Default 0 for NULL credits",
			prompt:
				"Return every pilot's **name** and **credits**, showing **0** for pilots whose credits are unknown.",
			difficulty: 2,
			kind: "query",
			concepts: ["coalesce-nullif"],
			solutionSql: "SELECT name, COALESCE(credits, 0) AS credits FROM pilots;",
			check: { type: "result" },
			hints: [
				"Only one pilot has unknown credits.",
				"Same COALESCE as in the previous exercise, with a number.",
				"COALESCE(credits, 0)",
			],
			explanation:
				"Lumen's NULL credits now read 0.\n\n**Pitfall:** this hides the difference between *zero* and *unknown*, so only do it when the report really means that.",
		},
		{
			id: "ch03-ex08",
			title: "Turn empty text into NULL",
			prompt:
				"Return the **id** and the **raw** text of every manifest line, turning **empty text** (`''`) into NULL.",
			difficulty: 3,
			kind: "query",
			concepts: ["coalesce-nullif", "null-basics"],
			solutionSql: "SELECT id, NULLIF(raw, '') AS raw FROM manifest_lines;",
			check: { type: "result" },
			hints: [
				"Find the function that returns NULL when two values are equal.",
				"NULLIF(a, b) gives NULL if a = b, else a.",
				"NULLIF(raw, '')",
			],
			explanation:
				"`NULLIF(raw, '')` turns line 8 into a real NULL while line 12 stays NULL. `''` is a known value (empty text): Postgres never confuses the two.",
		},
		{
			id: "ch03-ex09",
			title: "Boss: Into the Void",
			story: "Combines IS NULL, IS DISTINCT FROM and COALESCE in one query.",
			prompt:
				"Return the **name**, **model** and **hull_integrity** of every ship such that:\n\n- its hull integrity is **below 50** or **unknown**, and\n- its pilot is **not pilot 9** (ships without a pilot stay in).\n\nShow the model as **unregistered** when it is missing.",
			difficulty: 4,
			kind: "query",
			concepts: ["null-basics", "three-valued-logic", "is-distinct-from", "coalesce-nullif"],
			solutionSql:
				"SELECT name, COALESCE(model, 'unregistered') AS model, hull_integrity\nFROM ships\nWHERE (hull_integrity < 50 OR hull_integrity IS NULL)\n  AND pilot_id IS DISTINCT FROM 9;",
			check: { type: "result" },
			hints: [
				"There are three NULL cases: the hull test, the pilot test, and the model display.",
				"`hull_integrity < 50` misses NULL hulls; `pilot_id <> 9` misses ships with a NULL pilot.",
				"WHERE (hull_integrity < 50 OR hull_integrity IS NULL) AND pilot_id IS DISTINCT FROM 9, with COALESCE on model.",
			],
			explanation:
				"Each NULL needs its own handling: `IS NULL` keeps NULL hulls, `IS DISTINCT FROM` keeps ships with no pilot, `COALESCE` labels the Ghost Ship's missing model.\n\n**Pitfall:** with `pilot_id <> 9`, Old Faithful and the Ghost Ship are dropped, and no error is raised.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch03-pr01",
			title: "Ships without a pilot",
			prompt: "Return the **name** of every ship that has **no pilot**.",
			difficulty: 1,
			kind: "query",
			concepts: ["null-basics"],
			solutionSql: "SELECT name FROM ships WHERE pilot_id IS NULL;",
			check: { type: "result" },
			hints: [
				"No pilot means pilot_id is NULL.",
				"Use IS NULL, not = NULL.",
				"WHERE pilot_id IS NULL",
			],
			explanation: "Two ships have a NULL `pilot_id`: Old Faithful and the Ghost Ship.",
		},
		{
			id: "ch03-pr02",
			title: "Seizures with a NULL fine",
			prompt:
				"Return the **id** and **ship_id** of every seizure whose **fine** is still unknown.",
			difficulty: 1,
			kind: "query",
			concepts: ["null-basics"],
			solutionSql: "SELECT id, ship_id FROM seizures WHERE fine IS NULL;",
			check: { type: "result" },
			hints: [
				"A pending fine is stored as NULL.",
				"Test with IS NULL.",
				"WHERE fine IS NULL",
			],
			explanation: "Two seizures have a NULL fine: 3 and 5.",
		},
		{
			id: "ch03-pr03",
			title: "NOT does not catch NULL",
			prompt:
				"Return the **name** and **gravity** of every planet whose gravity is **not above 1.00**, including planets whose gravity is **unknown**.",
			difficulty: 2,
			kind: "query",
			concepts: ["three-valued-logic"],
			starterSql: "SELECT name, gravity\nFROM planets\nWHERE NOT gravity > 1.00;",
			solutionSql:
				"SELECT name, gravity FROM planets WHERE gravity <= 1.00 OR gravity IS NULL;",
			check: { type: "result" },
			hints: [
				"Run the starter. Is Hollow Moon there?",
				"`NOT unknown` is still unknown.",
				"WHERE gravity <= 1.00 OR gravity IS NULL",
			],
			explanation:
				"`NOT (NULL > 1)` is `NOT unknown`, which is unknown, so the row is dropped. NOT does not rescue NULLs: only IS NULL does.",
		},
		{
			id: "ch03-pr04",
			title: "Motto not equal, NULL included",
			prompt:
				"Return the **name** of every faction whose motto is **not** `Shields up`, including factions with **no motto**.",
			difficulty: 2,
			kind: "query",
			concepts: ["three-valued-logic"],
			solutionSql:
				"SELECT name FROM factions WHERE motto <> 'Shields up' OR motto IS NULL;",
			check: { type: "result" },
			hints: [
				"The Void Monks have a NULL motto. Does `<>` keep that row?",
				"Add a second test for the missing motto.",
				"WHERE motto <> 'Shields up' OR motto IS NULL",
			],
			explanation:
				"The Void Monks row needs the extra `IS NULL` test. `motto IS DISTINCT FROM 'Shields up'` is the compact version.",
		},
		{
			id: "ch03-pr05",
			title: "Home planet not 1, NULL included",
			prompt:
				"Return the **name** of every pilot whose home planet is **not planet 1**, including pilots with **no home planet**. Use `IS DISTINCT FROM`.",
			difficulty: 2,
			kind: "query",
			concepts: ["is-distinct-from"],
			solutionSql:
				"SELECT name FROM pilots WHERE home_planet_id IS DISTINCT FROM 1;",
			check: { type: "result" },
			hints: [
				"Lumen has a NULL home_planet_id.",
				"IS DISTINCT FROM never returns unknown.",
				"WHERE home_planet_id IS DISTINCT FROM 1",
			],
			explanation:
				"`IS DISTINCT FROM 1` is true for NULL, so Lumen is kept. With `<> 1` Lumen would be dropped.",
		},
		{
			id: "ch03-pr06",
			title: "Default text for NULL mottos",
			prompt:
				"Return every faction's **name** and **motto**, showing **(silence)** when the motto is missing.",
			difficulty: 1,
			kind: "query",
			concepts: ["coalesce-nullif"],
			solutionSql:
				"SELECT name, COALESCE(motto, '(silence)') AS motto FROM factions;",
			check: { type: "result" },
			hints: [
				"Provide a fallback for NULL.",
				"COALESCE(value, fallback)",
				"COALESCE(motto, '(silence)')",
			],
			explanation: "COALESCE leaves the five real mottos untouched.",
		},
		{
			id: "ch03-pr07",
			title: "Turn zero into NULL",
			prompt:
				"Return every pilot's **name** and **credits**, but show **NULL** instead of **0** for pilots with zero credits.",
			difficulty: 2,
			kind: "query",
			concepts: ["coalesce-nullif"],
			solutionSql: "SELECT name, NULLIF(credits, 0) AS credits FROM pilots;",
			check: { type: "result" },
			hints: [
				"You want the reverse of COALESCE.",
				"NULLIF(a, b) returns NULL when a equals b.",
				"NULLIF(credits, 0)",
			],
			explanation:
				"`NULLIF(credits, 0)` is a classic guard before dividing: `x / NULLIF(y, 0)` returns NULL instead of a division-by-zero error.",
		},
	],
};

export default chapter;
