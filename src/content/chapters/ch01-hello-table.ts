import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch01-hello-table",
	order: 1,
	world: "The Starport Docks",
	tier: "novice",
	track: "query",
	title: "Hello, Table",
	subtitle: "Your first SELECT: read the Starport's registers",
	emoji: "👋",
	datasetId: "starport",
	concepts: [
		"relational-model",
		"sql-statement-anatomy",
		"select-columns",
		"select-star",
		"column-aliases",
		"quotes-and-identifiers",
	],
	prerequisites: [],
	lesson: [
		{
			kind: "explain",
			title: "Welcome to the Starport",
			body: "The Starport keeps its records in **tables**. A table is like a register: every **row** is one thing (a planet, a pilot, a ship) and every **column** is one fact about it (a name, a population).\n\nYou talk to the database in **SQL**. Ask a question, and it answers with... a new table.",
		},
		{
			kind: "example",
			title: "Your very first query",
			body: "`SELECT *` means *every column*, `FROM planets` names the table. Press **Run** and meet the planets on the trade lanes.",
			sql: "SELECT * FROM planets;",
		},
		{
			kind: "explain",
			title: "Anatomy of a statement",
			body: "```sql\nSELECT name, sector   -- which columns\nFROM planets;        -- which table\n```\n\n- **SELECT** and **FROM** are *clauses*. Keywords don't care about case: `select` works too.\n- A **semicolon** ends the statement.\n- `--` starts a comment: the database ignores the rest of the line.",
		},
		{
			kind: "example",
			title: "Pick your columns",
			body: "List the columns you want, separated by **commas**. They come back in the order you write them.",
			sql: "SELECT name, sector FROM planets;",
		},
		{
			kind: "quiz",
			question:
				"The pilots table has columns `name`, `callsign` and `rank`. Which query returns only names and ranks?",
			choices: [
				"SELECT name rank FROM pilots;",
				"SELECT name, rank FROM pilots;",
				"SELECT name, rank, FROM pilots;",
				"SELECT * FROM pilots;",
			],
			answerIndex: 1,
			explanation:
				"Columns are separated by commas, with no comma before FROM. Careful: `SELECT name rank` is not an error! It returns one column of names *renamed* to rank.",
		},
		{
			kind: "explain",
			title: "Rename with AS, and the two kinds of quotes",
			body: "`AS` renames an output column: `SELECT name AS planet`.\n\nSQL has **two** quotes:\n- `'single'` quotes are **values** (text): `'Bay 7'`.\n- `\"double\"` quotes are **names** of columns or tables, needed for spaces or capitals: `AS \"Head Count\"`.\n\nA single quote inside text is doubled: `'Kepler''s Rest'`.",
		},
		{
			kind: "example",
			title: "Aliases in action",
			body: "Without double quotes, `Head Count` would be two words and `Planet` would become `planet` (names are folded to lower case).",
			sql: 'SELECT name AS "Planet", population AS "Head Count", \'charted\' AS status\nFROM planets;',
		},
		{
			kind: "try",
			title: "Your turn: the pilot roster",
			prompt:
				"Return the **name** and **species** of every pilot, in that column order.",
			starterSql: "SELECT \nFROM pilots;",
			solutionSql: "SELECT name, species FROM pilots;",
			check: { type: "result" },
			hints: [
				"Two columns, separated by a comma, between SELECT and FROM.",
				"SELECT name, species FROM pilots;",
			],
		},
	],
	exercises: [
		{
			id: "ch01-ex01",
			title: "Open the faction registry",
			story:
				"Your first shift at the Starport! The dock chief slides a terminal over: \"Show me every faction on file. All of it.\"",
			prompt: "Return **every column** of the `factions` table.",
			difficulty: 1,
			kind: "query",
			concepts: ["select-star", "relational-model"],
			starterSql: "SELECT * FROM ",
			solutionSql: "SELECT * FROM factions;",
			check: { type: "result" },
			hints: [
				"It is exactly the query from the lesson, with another table name.",
				"`*` means every column; the table is called factions.",
				"SELECT * FROM factions;",
			],
			explanation:
				"`SELECT *` expands to every column, in the table's own order. Perfect for exploring a table you don't know yet.\n\n**Pitfall:** in saved code, `*` silently changes meaning when someone adds a column, so prefer listing columns once you know what you need.",
		},
		{
			id: "ch01-ex02",
			title: "Roll call",
			story:
				"The tower needs to know who is flying today, and what to call them on the radio.",
			prompt:
				"Return the **name** and **callsign** of every pilot (name first).",
			difficulty: 1,
			kind: "query",
			concepts: ["select-columns"],
			starterSql: "SELECT \nFROM pilots;",
			solutionSql: "SELECT name, callsign FROM pilots;",
			check: { type: "result" },
			hints: [
				"You only want two columns of the pilots table.",
				"List the columns after SELECT, separated by a comma.",
				"SELECT name, callsign FROM ...;",
			],
			explanation:
				"`SELECT name, callsign` keeps just those two columns, in that order. Some callsigns are empty (NULL): we will meet NULL properly in *The Void*.\n\n**Pitfall:** column order matters to the checker here, because it compares columns by position.",
		},
		{
			id: "ch01-ex03",
			title: "Static on the line",
			story:
				"A junior clerk typed this query to list the ships, but the console only beeps angrily.",
			prompt:
				"Fix the query so it returns the **name** and **model** of every ship.",
			difficulty: 1,
			kind: "query",
			concepts: ["sql-statement-anatomy", "select-columns"],
			starterSql: "SELECT name, model, FROM ships;",
			solutionSql: "SELECT name, model FROM ships;",
			check: { type: "result" },
			hints: [
				"Run it and read the error: where does Postgres say the problem is?",
				"A comma separates two columns. What comes after the last one?",
				"Remove the comma just before FROM.",
			],
			explanation:
				"The comma before `FROM` tells Postgres another column is coming, so it chokes on `FROM` (*syntax error at or near \"FROM\"*, SQLSTATE 42601).\n\n**Tip:** when you see a syntax error, look just **before** the word Postgres points at.",
		},
		{
			id: "ch01-ex04",
			title: "Price tags",
			story:
				"The market board can only display columns called `item` and `price`.",
			prompt:
				"Return every commodity's `name` as a column called **item** and its `base_price` as a column called **price**.",
			difficulty: 1,
			kind: "query",
			concepts: ["column-aliases"],
			starterSql: "SELECT name, base_price\nFROM commodities;",
			solutionSql: "SELECT name AS item, base_price AS price FROM commodities;",
			check: { type: "result", matchColumnNames: true },
			hints: [
				"The values are right already; only the column titles must change.",
				"`expression AS new_name` renames an output column.",
				"SELECT name AS item, base_price AS ... FROM commodities;",
			],
			explanation:
				"`AS` only renames the column in the **result**: the table itself is untouched.\n\n**Alternative:** `AS` is optional (`SELECT name item`), but writing it makes the intent obvious and avoids the missing-comma trap.",
		},
		{
			id: "ch01-ex05",
			title: "The census report",
			story:
				"The Census Bureau is picky: their spreadsheet expects the titles `Planet` and `Head Count`, exactly like that.",
			prompt:
				'Return every planet\'s `name` titled **Planet** and its `population` titled **Head Count** (capital letters and the space included).',
			difficulty: 2,
			kind: "query",
			concepts: ["quotes-and-identifiers", "column-aliases"],
			starterSql: "SELECT name AS Planet, population AS Head Count\nFROM planets;",
			solutionSql:
				'SELECT name AS "Planet", population AS "Head Count" FROM planets;',
			check: { type: "result", matchColumnNames: true },
			hints: [
				"Run the starter: one alias is folded to lower case, the other breaks the query.",
				"Names with spaces or capitals must be wrapped in double quotes.",
				'... AS "Planet", population AS "Head Count" ...',
			],
			explanation:
				'Unquoted names are folded to lower case (`Planet` becomes `planet`) and stop at a space. Double quotes keep a name exactly as written.\n\n**Pitfall:** single quotes would not work: `AS \'Planet\'` is a syntax error, because single quotes are for *values*.',
		},
		{
			id: "ch01-ex06",
			title: "Cleared for launch",
			story:
				"Customs just cleared every ship in the yard. The board must show it next to each name.",
			prompt:
				"Return every ship's **name** and a second column containing the text **cleared** on every row.",
			difficulty: 2,
			kind: "query",
			concepts: ["quotes-and-identifiers", "select-columns"],
			starterSql: 'SELECT name, "cleared"\nFROM ships;',
			solutionSql: "SELECT name, 'cleared' AS status FROM ships;",
			check: { type: "result" },
			hints: [
				'Run the starter: Postgres thinks "cleared" is a column name.',
				"Text values use single quotes; double quotes are for names.",
				"SELECT name, 'cleared' FROM ships;",
			],
			explanation:
				"A literal like `'cleared'` is repeated on every row. With double quotes Postgres looks for a **column** called cleared and fails with *column \"cleared\" does not exist* (42703).\n\n**Tip:** give literal columns an alias (`AS status`), otherwise they are titled `?column?`.",
		},
		{
			id: "ch01-ex07",
			title: "One row per ship",
			story:
				"The shipyard wants a raw list of models to count spare parts, one line per ship, repeats included.",
			prompt:
				"Return only the **model** column of the `ships` table: one row per ship, duplicates and missing models included.",
			difficulty: 1,
			kind: "query",
			concepts: ["relational-model", "select-columns"],
			solutionSql: "SELECT model FROM ships;",
			check: { type: "result" },
			hints: [
				"Every query answers with a table. How many rows does ships have?",
				"Selecting one column keeps every row, it just hides the other columns.",
				"SELECT model FROM ships;",
			],
			explanation:
				"Selecting fewer columns never removes rows: you get 21 rows, with `Hauler 9` three times and one empty (NULL) model. Removing duplicates is a separate decision (`DISTINCT`, coming in *Order in the Hall*).",
		},
		{
			id: "ch01-ex08",
			title: "Boss: The Harbor Master's Board",
			story:
				"The Harbor Master wants a shiny departure board. \"Four columns, titled exactly like this, or I send you to scrub Hollow Moon.\"",
			prompt:
				"Return one row per ship with these columns, in this order and with these exact titles:\n\n| title | content |\n|---|---|\n| `Ship` | the ship's name |\n| `Model` | its model |\n| `Hold` | its cargo capacity |\n| `Dock` | the text `Bay 7` |",
			difficulty: 3,
			kind: "query",
			concepts: [
				"select-columns",
				"column-aliases",
				"quotes-and-identifiers",
				"sql-statement-anatomy",
			],
			solutionSql:
				'SELECT name AS "Ship", model AS "Model", cargo_capacity AS "Hold", \'Bay 7\' AS "Dock"\nFROM ships;',
			check: { type: "result", matchColumnNames: true },
			hints: [
				"Four columns: three come from the table, one is a text value.",
				"Titles with capitals need double quotes; the value Bay 7 needs single quotes.",
				'SELECT name AS "Ship", model AS "Model", cargo_capacity AS "Hold", \'Bay 7\' AS "Dock" FROM ...',
			],
			explanation:
				"Every tool of the chapter at once: a column list, aliases, double quotes for exact titles and single quotes for a value.\n\n**Pitfall:** `AS Ship` (no quotes) gives a column called `ship`, and the board would stay dark.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch01-pr01",
			title: "Sector by sector",
			prompt:
				"Return the **sector** column of every planet: one row per planet, repeats and unknown sectors included.",
			difficulty: 1,
			kind: "query",
			concepts: ["relational-model"],
			solutionSql: "SELECT sector FROM planets;",
			check: { type: "result" },
			hints: [
				"One column, one row per planet.",
				"Choosing columns does not remove rows.",
				"SELECT sector FROM planets;",
			],
			explanation:
				"12 planets, so 12 rows, even though several share a sector. A result is a table too, and tables can hold repeated values.",
		},
		{
			id: "ch01-pr02",
			title: "The silent comma",
			story: "This query runs without error, but the report has only one column.",
			prompt:
				"Fix it so it returns the **name** and the **motto** of every faction.",
			difficulty: 1,
			kind: "query",
			concepts: ["sql-statement-anatomy", "select-columns"],
			starterSql: "SELECT name motto\nFROM factions;",
			solutionSql: "SELECT name, motto FROM factions;",
			check: { type: "result" },
			hints: [
				"Look at the column title in the result of the starter.",
				"Without a comma, the second word becomes an alias of the first column.",
				"SELECT name, motto FROM factions;",
			],
			explanation:
				"`SELECT name motto` means `SELECT name AS motto`: one column of names wearing the wrong label. This is one of the sneakiest beginner bugs because nothing fails.",
		},
		{
			id: "ch01-pr03",
			title: "Shipyard inventory",
			prompt:
				"Return the **name**, **model** and **cargo_capacity** of every ship, in that order.",
			difficulty: 1,
			kind: "query",
			concepts: ["select-columns"],
			starterSql: "SELECT \nFROM ships;",
			solutionSql: "SELECT name, model, cargo_capacity FROM ships;",
			check: { type: "result" },
			hints: [
				"Three columns from the ships table.",
				"Separate them with commas.",
				"SELECT name, model, cargo_capacity FROM ships;",
			],
			explanation:
				"Columns come back in the order you list them, whatever their order in the table.",
		},
		{
			id: "ch01-pr04",
			title: "The evidence locker",
			prompt: "Return every column of the `seizures` table.",
			difficulty: 1,
			kind: "query",
			concepts: ["select-star"],
			solutionSql: "SELECT * FROM seizures;",
			check: { type: "result" },
			hints: [
				"There is a one-character shortcut for every column.",
				"SELECT * ...",
				"SELECT * FROM seizures;",
			],
			explanation:
				"`*` is the fastest way to discover a table. Listing all six columns by hand gives the same result.",
		},
		{
			id: "ch01-pr05",
			title: "Market labels",
			prompt:
				"Return every commodity's `name` titled **commodity** and its `unit` titled **sold_by**.",
			difficulty: 1,
			kind: "query",
			concepts: ["column-aliases"],
			starterSql: "SELECT name, unit\nFROM commodities;",
			solutionSql: "SELECT name AS commodity, unit AS sold_by FROM commodities;",
			check: { type: "result", matchColumnNames: true },
			hints: [
				"Keep the same two columns, rename both.",
				"Use AS after each column.",
				"SELECT name AS commodity, unit AS sold_by FROM commodities;",
			],
			explanation:
				"Lower-case names with underscores need no quotes. That is why snake_case is the usual style in SQL.",
		},
		{
			id: "ch01-pr06",
			title: "The captain's log",
			prompt:
				"Return every pilot's **name** and a second column containing the text **Captain's log** (with the apostrophe) on every row.",
			difficulty: 2,
			kind: "query",
			concepts: ["quotes-and-identifiers"],
			starterSql: "SELECT name, 'Captain's log'\nFROM pilots;",
			solutionSql: "SELECT name, 'Captain''s log' AS entry FROM pilots;",
			check: { type: "result" },
			hints: [
				"The apostrophe ends the text value too early.",
				"Inside single quotes, write a single quote twice.",
				"'Captain''s log'",
			],
			explanation:
				"`''` inside a text value means one apostrophe. Backslashes (`\\'`) do not escape quotes in standard SQL strings.",
		},
		{
			id: "ch01-pr07",
			title: "A title with a space",
			prompt:
				"Return every faction's `name` titled **Faction Name** (capital letters and the space included).",
			difficulty: 2,
			kind: "query",
			concepts: ["quotes-and-identifiers", "column-aliases"],
			solutionSql: 'SELECT name AS "Faction Name" FROM factions;',
			check: { type: "result", matchColumnNames: true },
			hints: [
				"An alias with a space must be quoted.",
				"Which quotes are for names?",
				'SELECT name AS "Faction Name" FROM factions;',
			],
			explanation:
				"Double quotes make an identifier exact: case and spaces are kept.",
		},
	],
};

export default chapter;
