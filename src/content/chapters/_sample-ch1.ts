import type { Chapter } from "../types";

/** DEV SAMPLE chapter 1: SELECT, WHERE, NULL, ORDER BY. */
const chapter: Chapter = {
	id: "_sample-ch1",
	order: 1,
	world: "Sample Shores",
	tier: "novice",
	track: "query",
	title: "First Contact",
	subtitle: "Read the bazaar's ledgers with SELECT, WHERE and ORDER BY",
	emoji: "🔭",
	datasetId: "_sample-starport",
	concepts: ["_select-basics", "_where-filter", "_null-checks", "_order-limit"],
	prerequisites: [],
	lesson: [
		{
			kind: "explain",
			title: "Ask the database a question",
			body: "Every query starts with **SELECT** (which columns) and **FROM** (which table).\n\n```sql\nSELECT name, species FROM traders;\n```\n\nThe database answers with a *result set*: a little table of rows.",
		},
		{
			kind: "example",
			title: "Peek at every column",
			body: "`*` means *all columns*. Press **Run** to see the whole planets table.",
			sql: "SELECT * FROM planets;",
		},
		{
			kind: "explain",
			title: "Keep only some rows",
			body: "**WHERE** filters rows. Only rows where the condition is *true* survive.\n\n```sql\nSELECT name FROM items WHERE price < 50;\n```\n\nText values go in single quotes: `WHERE sector = 'Core'`.",
		},
		{
			kind: "quiz",
			question: "Which query lists the planets with no measured gravity?",
			choices: [
				"SELECT name FROM planets WHERE gravity = NULL;",
				"SELECT name FROM planets WHERE gravity IS NULL;",
				"SELECT name FROM planets WHERE gravity = 0;",
				"SELECT name FROM planets WHERE NOT gravity;",
			],
			answerIndex: 1,
			explanation:
				"NULL is *unknown*, so `gravity = NULL` is never true. Use `IS NULL`.",
		},
		{
			kind: "example",
			title: "Sorting",
			body: "**ORDER BY** sorts the result. `DESC` puts the biggest first, **LIMIT** keeps the first rows.",
			sql: "SELECT name, credits FROM traders ORDER BY credits DESC, name LIMIT 3;",
		},
		{
			kind: "try",
			title: "Your turn: cheap goods",
			prompt:
				"List the **name** and **price** of every item that costs less than 50 credits.",
			starterSql: "SELECT name, price\nFROM items\nWHERE ",
			solutionSql: "SELECT name, price FROM items WHERE price < 50;",
			check: { type: "result" },
			hints: ["Compare the price column with a number.", "WHERE price < 50"],
		},
	],
	exercises: [
		{
			id: "_s1-ex01",
			title: "Roll call",
			story:
				"The harbour master wants to know who has a stall at the bazaar today.",
			prompt: "Return the **name** and **species** of every trader.",
			difficulty: 1,
			kind: "query",
			concepts: ["_select-basics"],
			starterSql: "SELECT ",
			solutionSql: "SELECT name, species FROM traders;",
			check: { type: "result" },
			hints: [
				"You need two columns from the traders table.",
				"List columns separated by a comma after SELECT.",
				"SELECT name, species FROM traders;",
			],
			explanation:
				"`SELECT name, species FROM traders` returns one row per trader. Row order is not guaranteed without ORDER BY, so the checker compares rows as a set here.",
		},
		{
			id: "_s1-ex02",
			title: "Rare finds",
			story: "A collector only cares about rare gear and weapons.",
			prompt:
				"Return the **name** and **price** of items whose rarity is `rare` and whose category is `gear` or `weapon`.",
			difficulty: 2,
			kind: "query",
			concepts: ["_where-filter"],
			solutionSql:
				"SELECT name, price FROM items WHERE rarity = 'rare' AND category IN ('gear', 'weapon');",
			check: { type: "result" },
			hints: [
				"Two conditions must both be true: combine them with AND.",
				"`category IN ('gear', 'weapon')` is shorter than two ORs.",
				"Careful with OR without parentheses: AND binds tighter than OR.",
			],
			explanation:
				"`rarity = 'rare' AND category IN ('gear','weapon')`. If you wrote `rarity = 'rare' AND category = 'gear' OR category = 'weapon'`, the AND is evaluated first and every weapon slips through.",
		},
		{
			id: "_s1-ex03",
			title: "The drifters",
			story: "Customs is chasing traders with no home planet.",
			prompt:
				"Return the **name** of every trader whose `planet_id` is unknown.",
			difficulty: 2,
			kind: "query",
			concepts: ["_null-checks", "_where-filter"],
			solutionSql: "SELECT name FROM traders WHERE planet_id IS NULL;",
			check: { type: "result" },
			hints: [
				"Unknown values are NULL.",
				"`= NULL` never matches anything.",
				"WHERE planet_id IS NULL",
			],
			explanation:
				"Comparisons with NULL yield NULL (not true), so you need the dedicated `IS NULL` predicate.",
		},
		{
			id: "_s1-ex04",
			title: "Leaderboard",
			story: "The guild posts the richest traders on the big holo screen.",
			prompt:
				"Return **name** and **credits** of the 5 richest traders, richest first. Break ties by name (A to Z).",
			difficulty: 3,
			kind: "query",
			concepts: ["_order-limit"],
			solutionSql:
				"SELECT name, credits FROM traders ORDER BY credits DESC, name ASC LIMIT 5;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Sort by credits, biggest first, then keep 5 rows.",
				"Two traders have 3100 credits: add a second sort key.",
				"ORDER BY credits DESC, name LIMIT 5",
			],
			explanation:
				"`ORDER BY credits DESC, name` makes the order deterministic even with ties, and `LIMIT 5` keeps the top five.",
		},
		{
			id: "_s1-boss",
			title: "Boss: The Auctioneer's Catalogue",
			story:
				"The Auctioneer slams her gavel: she needs her catalogue NOW, formatted exactly as she likes it.",
			prompt:
				"Return items that are **not** `common` and cost at most 800 credits, with two columns named exactly **item** (the item name) and **cost** (the price). Sort by cost descending, then by item name ascending.",
			difficulty: 4,
			kind: "query",
			concepts: ["_select-basics", "_where-filter", "_order-limit"],
			solutionSql:
				"SELECT name AS item, price AS cost FROM items WHERE rarity <> 'common' AND price <= 800 ORDER BY cost DESC, item;",
			check: { type: "result", orderMatters: true, matchColumnNames: true },
			hints: [
				"Rename columns with AS.",
				"`rarity <> 'common'` excludes the cheap stuff.",
				"Two items cost 310: sort them by name.",
			],
			explanation:
				"Aliases (`AS item`) rename output columns, and ORDER BY can reuse them. The tiebreaker on name makes the order stable.",
			boss: true,
		},
	],
	practice: [
		{
			id: "_s1-pr01",
			title: "Planet list",
			prompt: "Return the **name** and **sector** of every planet.",
			difficulty: 1,
			kind: "query",
			concepts: ["_select-basics"],
			solutionSql: "SELECT name, sector FROM planets;",
			check: { type: "result" },
			hints: ["Two columns from planets.", "SELECT name, sector FROM planets;"],
			explanation: "A plain projection: pick columns, name the table.",
		},
		{
			id: "_s1-pr02",
			title: "Item names only",
			prompt: "Return just the **name** of every item.",
			difficulty: 1,
			kind: "query",
			concepts: ["_select-basics"],
			solutionSql: "SELECT name FROM items;",
			check: { type: "result" },
			hints: ["One column.", "SELECT name FROM items;"],
			explanation: "One column, one row per item.",
		},
		{
			id: "_s1-pr03",
			title: "Core worlds",
			prompt: "Return the **name** of planets in the `Core` sector.",
			difficulty: 1,
			kind: "query",
			concepts: ["_where-filter"],
			solutionSql: "SELECT name FROM planets WHERE sector = 'Core';",
			check: { type: "result" },
			hints: ["Filter on sector.", "Text goes in single quotes: 'Core'."],
			explanation: "`WHERE sector = 'Core'` keeps the three core worlds.",
		},
		{
			id: "_s1-pr04",
			title: "Mid-range goods",
			prompt:
				"Return the **name** of items priced between 100 and 500 credits (inclusive).",
			difficulty: 2,
			kind: "query",
			concepts: ["_where-filter"],
			solutionSql: "SELECT name FROM items WHERE price BETWEEN 100 AND 500;",
			check: { type: "result" },
			hints: ["BETWEEN is inclusive on both ends."],
			explanation:
				"`BETWEEN 100 AND 500` equals `price >= 100 AND price <= 500`.",
		},
		{
			id: "_s1-pr05",
			title: "Unmeasured gravity",
			prompt: "Return the **name** of planets whose gravity is unknown.",
			difficulty: 1,
			kind: "query",
			concepts: ["_null-checks"],
			solutionSql: "SELECT name FROM planets WHERE gravity IS NULL;",
			check: { type: "result" },
			hints: ["Unknown means NULL.", "WHERE gravity IS NULL"],
			explanation: "`IS NULL` is the only way to match NULLs.",
		},
		{
			id: "_s1-pr06",
			title: "Gravity with a default",
			prompt:
				"Return **name** and gravity for every planet, showing `1.00` when gravity is unknown.",
			difficulty: 2,
			kind: "query",
			concepts: ["_null-checks"],
			solutionSql: "SELECT name, COALESCE(gravity, 1.00) FROM planets;",
			check: { type: "result" },
			hints: ["COALESCE returns its first non NULL argument."],
			explanation: "`COALESCE(gravity, 1.00)` swaps NULL for the default.",
		},
		{
			id: "_s1-pr07",
			title: "Cheapest three",
			prompt:
				"Return the **name** and **price** of the 3 cheapest items, cheapest first, ties by name.",
			difficulty: 2,
			kind: "query",
			concepts: ["_order-limit"],
			solutionSql:
				"SELECT name, price FROM items ORDER BY price, name LIMIT 3;",
			check: { type: "result", orderMatters: true },
			hints: ["ORDER BY price ascending.", "Two items cost 3.50: add name."],
			explanation: "Ascending is the default, LIMIT 3 keeps the first three.",
		},
		{
			id: "_s1-pr08",
			title: "Newest members",
			prompt:
				"Return the **name** of the 4 traders who joined most recently, newest first, ties by name.",
			difficulty: 2,
			kind: "query",
			concepts: ["_order-limit"],
			solutionSql:
				"SELECT name FROM traders ORDER BY joined_at DESC, name LIMIT 4;",
			check: { type: "result", orderMatters: true },
			hints: ["Sort on joined_at, newest first: DESC."],
			explanation:
				"Timestamps sort chronologically; DESC flips to newest first.",
		},
	],
};

export default chapter;
