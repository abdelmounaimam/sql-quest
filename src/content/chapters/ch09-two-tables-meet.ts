import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch09-two-tables-meet",
	order: 9,
	world: "The Jump Gates",
	tier: "apprentice",
	track: "query",
	title: "Two Tables Meet",
	subtitle: "Primary keys, foreign keys, INNER JOIN, table aliases and USING",
	emoji: "🔗",
	datasetId: "starport",
	concepts: [
		"keys-and-relationships-intro",
		"table-aliases",
		"inner-join",
		"multi-table-join",
		"join-using-natural",
	],
	prerequisites: ["ch08-tally-the-loot"],
	lesson: [
		{
			kind: "explain",
			title: "Primary keys and foreign keys",
			body: "So far every query read one table. A relational database stores related facts in **separate tables** and links them with ids:\n\n- `pilots.id` is a **primary key**: it identifies exactly one row of `pilots`.\n- `ships.pilot_id` is a **foreign key**: it stores the `id` of the pilot of the ship.\n\nLink tables by ids, not by names. Names can repeat or change; a key is unique and stable.",
		},
		{
			kind: "example",
			title: "A foreign key is just a number",
			body: "The `ships` table stores a pilot **id**, not a name. Note that two ships have `pilot_id` 2, and two ships have a NULL `pilot_id`.",
			sql: "SELECT id, name, pilot_id\nFROM ships;",
		},
		{
			kind: "explain",
			title: "JOIN ... ON",
			body: "`JOIN` pairs each row of one table with the rows of another **where the ON condition is true**:\n```sql\nFROM ships s\nJOIN pilots p ON p.id = s.pilot_id\n```\n`s` and `p` are **table aliases**: short names you use to say which table a column comes from.\n\nRows without a match are **left out**: an INNER JOIN keeps matching pairs only.",
		},
		{
			kind: "example",
			title: "Joining ships to pilots",
			body: "`ships` has 21 rows, but the result has only 19. Old Faithful and the Ghost Ship have a NULL `pilot_id`, so the join has nothing to pair them with. LEFT JOIN, covered in the next chapter, keeps them.",
			sql: "SELECT s.name AS ship, p.name AS pilot\nFROM ships s\nJOIN pilots p ON p.id = s.pilot_id;",
		},
		{
			kind: "quiz",
			question:
				"What happens with `SELECT name FROM ships JOIN pilots ON pilots.id = ships.pilot_id;`?",
			choices: [
				"It returns the ship names, because ships comes first",
				"It returns the pilot names, because pilots is joined last",
				"It fails: column reference \"name\" is ambiguous (42702)",
				"It returns both names in one column",
			],
			answerIndex: 2,
			explanation:
				"Both tables have a `name` column and Postgres refuses to guess. Qualify every shared column with its table or alias: `s.name`, `p.name`.",
		},
		{
			kind: "explain",
			title: "Joining more than two tables",
			body: "A trade points at a ship, a planet and a commodity. Add **one JOIN per table, each with its own ON**:\n```sql\nFROM trades t\nJOIN commodities c ON c.id = t.commodity_id\nJOIN planets pl ON pl.id = t.planet_id\n```\nForget an ON (or write a comma join without its WHERE) and every row pairs with every row: a cartesian product.",
		},
		{
			kind: "example",
			title: "Three tables in one query",
			body: "Each trade, with its commodity name and planet name. The same 40 rows, now with names instead of ids.",
			sql: "SELECT t.id, c.name AS commodity, pl.name AS planet\nFROM trades t\nJOIN commodities c ON c.id = t.commodity_id\nJOIN planets pl ON pl.id = t.planet_id;",
		},
		{
			kind: "explain",
			title: "USING and NATURAL JOIN",
			body: "When both columns have the **same name**, `USING` is a shortcut, and the shared column appears only once:\n```sql\nseizures JOIN trades USING (ship_id, commodity_id)\n```\n`NATURAL JOIN` goes further: it joins on **every** column with the same name. `seizures` and `trades` also share `id` and `qty`, so a natural join requires equal ids and equal quantities, and returns nothing. Avoid NATURAL.",
		},
		{
			kind: "try",
			title: "Try it: ship and pilot rank",
			prompt:
				"Return each ship's **name** and the **rank** of its pilot, for every ship that has a pilot.",
			starterSql: "SELECT name, rank\nFROM ships\nJOIN pilots ON ...;",
			solutionSql:
				"SELECT s.name, p.rank FROM ships s JOIN pilots p ON p.id = s.pilot_id;",
			check: { type: "result" },
			hints: [
				"The ship stores `pilot_id`; the pilot's own key is `pilots.id`.",
				"FROM ships s JOIN pilots p ON p.id = s.pilot_id, then SELECT s.name, p.rank",
			],
		},
	],
	exercises: [
		{
			id: "ch09-ex01",
			title: "Ships with their pilot",
			prompt:
				"Return the **ship name** and the **pilot name** for every ship that has a pilot.",
			difficulty: 1,
			kind: "query",
			concepts: ["inner-join"],
			starterSql: "SELECT s.name, ...\nFROM ships s\nJOIN pilots p ON ...;",
			solutionSql:
				"SELECT s.name AS ship, p.name AS pilot\nFROM ships s\nJOIN pilots p ON p.id = s.pilot_id;",
			check: { type: "result" },
			hints: [
				"Which column of ships points at a pilot, and which column of pilots identifies one?",
				"Join on the key: the ship's `pilot_id` must equal the pilot's `id`.",
				"FROM ships s JOIN pilots p ON p.id = s.pilot_id",
			],
			explanation:
				"`ON p.id = s.pilot_id` follows the foreign key from each ship to exactly one pilot. The two ships with a NULL `pilot_id` have no match, so the inner join drops them.\n\n**Pitfall:** `ON p.id = s.id` also runs, but pairs ship 11 with pilot 11 (Lumen, who has no ship). Matching ids of *different things* is a silent bug.",
		},
		{
			id: "ch09-ex02",
			title: "Fix an ambiguous column",
			prompt:
				"Fix the query so it returns each pilot's **name** and their **faction name**, for pilots who belong to a faction.",
			difficulty: 2,
			kind: "query",
			concepts: ["table-aliases"],
			starterSql:
				"SELECT name, name\nFROM pilots\nJOIN factions ON pilots.faction_id = factions.id;",
			solutionSql:
				"SELECT p.name, f.name\nFROM pilots p\nJOIN factions f ON f.id = p.faction_id;",
			check: { type: "result" },
			hints: [
				"Run it and read the error: which column is ambiguous?",
				"Both tables have a `name`. Tell Postgres which table each one comes from.",
				"Give the tables aliases (`pilots p`, `factions f`) and select `p.name, f.name`.",
			],
			explanation:
				"`name` exists in both tables, so Postgres stops with 42702 instead of guessing. Prefixing with the alias removes the doubt.\n\n**Pitfall:** once you write `FROM pilots p`, the table is called `p` in that query: `pilots.name` then fails with *invalid reference to FROM-clause entry*.",
		},
		{
			id: "ch09-ex03",
			title: "Factions and their homeworld",
			prompt:
				"Return each faction's **name** and the **name of its homeworld planet**, for factions that have a homeworld.",
			difficulty: 2,
			kind: "query",
			concepts: ["keys-and-relationships-intro", "inner-join"],
			solutionSql:
				"SELECT f.name AS faction, pl.name AS homeworld\nFROM factions f\nJOIN planets pl ON pl.id = f.homeworld_id;",
			check: { type: "result" },
			hints: [
				"Find the foreign key in factions that points at planets.",
				"`factions.homeworld_id` stores a planet id.",
				"FROM factions f JOIN planets pl ON pl.id = f.homeworld_id",
			],
			explanation:
				"The foreign key `homeworld_id` leads to one planet per faction. The Lantern Guild has no homeworld (NULL never equals anything), so it drops out, as the task requires.\n\n**Pitfall:** `pl.id = f.id` pairs faction 6 with planet 6 (Mirage), which is not its homeworld.",
		},
		{
			id: "ch09-ex04",
			title: "Trades with commodity and planet names",
			prompt:
				"Return the **trade id**, the **commodity name** and the **planet name** of every trade.",
			difficulty: 2,
			kind: "query",
			concepts: ["multi-table-join"],
			starterSql:
				"SELECT t.id, c.name, pl.name\nFROM trades t\nJOIN commodities c ON c.id = t.commodity_id;",
			solutionSql:
				"SELECT t.id, c.name AS commodity, pl.name AS planet\nFROM trades t\nJOIN commodities c ON c.id = t.commodity_id\nJOIN planets pl ON pl.id = t.planet_id;",
			check: { type: "result" },
			hints: [
				"The starter uses an alias `pl` that never appears in FROM.",
				"Every table you read needs its own JOIN with its own ON.",
				"Add JOIN planets pl ON pl.id = t.planet_id",
			],
			explanation:
				"Each JOIN brings one table and one condition. Every trade has a commodity and a planet, so all 40 trades remain.\n\n**Pitfall:** `FROM trades t, commodities c, planets pl WHERE c.id = t.commodity_id` forgets the planet condition and returns 40 × 12 = 480 rows.",
		},
		{
			id: "ch09-ex05",
			title: "Join through an intermediate table",
			prompt:
				"Return the **trade id** and the **name of the pilot** of the ship that made the trade, for every trade.",
			difficulty: 3,
			kind: "query",
			concepts: ["multi-table-join"],
			solutionSql:
				"SELECT t.id, p.name AS pilot\nFROM trades t\nJOIN ships s ON s.id = t.ship_id\nJOIN pilots p ON p.id = s.pilot_id;",
			check: { type: "result" },
			hints: [
				"There is no pilot column in trades. Which table sits between a trade and a pilot?",
				"Follow the keys: trades.ship_id leads to ships, ships.pilot_id leads to pilots.",
				"FROM trades t JOIN ships s ON s.id = t.ship_id JOIN pilots p ON p.id = s.pilot_id",
			],
			explanation:
				"`ships` is the intermediate table: you join through it even though you select nothing from it.\n\n**Pitfall:** the shortcut `JOIN pilots p ON p.id = t.ship_id` runs without error but treats a ship id as a pilot id. Trade 11 (by ship 11, whose pilot is Mira) would show Lumen.",
		},
		{
			id: "ch09-ex06",
			title: "Replace NATURAL JOIN with USING",
			prompt:
				"Fix the query: return the **seizure id** and the **trade id** for every pair where the seizure and the trade have the **same ship** and the **same commodity**. Use `USING`.",
			difficulty: 3,
			kind: "query",
			concepts: ["join-using-natural"],
			starterSql:
				"SELECT z.id AS seizure, t.id AS trade\nFROM seizures z\nNATURAL JOIN trades t;",
			solutionSql:
				"SELECT z.id AS seizure, t.id AS trade\nFROM seizures z\nJOIN trades t USING (ship_id, commodity_id);",
			check: { type: "result" },
			hints: [
				"Run the starter: 0 rows. Which columns do the two tables have in common?",
				"NATURAL uses every shared column, including `id` and `qty`. You only want two of them.",
				"JOIN trades t USING (ship_id, commodity_id)",
			],
			explanation:
				"`USING (ship_id, commodity_id)` names exactly the columns to match. NATURAL also required `z.id = t.id` and `z.qty = t.qty`, which no pair satisfies.\n\n**Pitfall:** NATURAL JOIN changes meaning the day someone adds a column with a common name (`notes`, `created_at`). Spell out your join columns.\n\n**Alternative:** `ON t.ship_id = z.ship_id AND t.commodity_id = z.commodity_id`.",
		},
		{
			id: "ch09-ex07",
			title: "Join then filter on the joined table",
			prompt:
				"Return each pilot's **name**, the **name of their home planet** and that planet's **sector**, only for home planets whose sector is **known**.",
			difficulty: 2,
			kind: "query",
			concepts: ["inner-join"],
			solutionSql:
				"SELECT p.name, pl.name AS planet, pl.sector\nFROM pilots p\nJOIN planets pl ON pl.id = p.home_planet_id\nWHERE pl.sector IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"Join pilots to planets, then filter on the planet's sector.",
				"WHERE runs after the join, so it can use columns of both tables.",
				"... JOIN planets pl ON pl.id = p.home_planet_id WHERE pl.sector IS NOT NULL",
			],
			explanation:
				"Two pilots disappear for different reasons: Lumen has a NULL `home_planet_id` (the join drops the row), and Umbra-3's home planet, Hollow Moon, has a NULL sector (the WHERE drops it).\n\n**Pitfall:** without the WHERE, Umbra-3 stays with an empty sector: a join only removes rows that have no partner, it never checks the other columns of the matched row for you.",
		},
		{
			id: "ch09-ex08",
			title: "Boss: The Customs Cross-check",
			story:
				"Combines four joins along foreign keys, a WHERE on a boolean column and ORDER BY.",
			prompt:
				"For every trade of an **illegal** commodity (`legal` is false), return:\n\n1. **traded_at**\n2. the **pilot name** (pilot of the trading ship)\n3. the **commodity name**\n4. the **planet name**\n5. the trade **value** (`qty * unit_price`)\n\nSort by **traded_at**, oldest first.",
			difficulty: 4,
			kind: "query",
			concepts: [
				"multi-table-join",
				"inner-join",
				"table-aliases",
				"keys-and-relationships-intro",
			],
			solutionSql:
				"SELECT t.traded_at, p.name AS pilot, c.name AS commodity, pl.name AS planet,\n       t.qty * t.unit_price AS value\nFROM trades t\nJOIN ships s ON s.id = t.ship_id\nJOIN pilots p ON p.id = s.pilot_id\nJOIN commodities c ON c.id = t.commodity_id\nJOIN planets pl ON pl.id = t.planet_id\nWHERE NOT c.legal\nORDER BY t.traded_at;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Five tables: trades in the middle, then ships, pilots, commodities and planets around it.",
				"One JOIN per table, each following a foreign key. Filter on the commodity's `legal` column.",
				"... JOIN commodities c ON c.id = t.commodity_id ... WHERE NOT c.legal ORDER BY t.traded_at",
			],
			explanation:
				"Four joins follow four foreign keys, then WHERE keeps the illegal commodities and ORDER BY sorts by time. Sable Ironwood's two Antimatter Pods trades have the largest values.\n\n**Pitfall:** `WHERE c.category = 'contraband'` misses Antimatter Pods, which are illegal fuel. Filter on the rule (`legal`), not on a label that usually matches it.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch09-pr01",
			title: "Join on the key, not the name",
			prompt:
				"Return each ship's **name** and its pilot's **callsign**, for every ship that has a pilot (a pilot without a callsign shows an empty callsign).",
			difficulty: 1,
			kind: "query",
			concepts: ["keys-and-relationships-intro"],
			solutionSql:
				"SELECT s.name, p.callsign\nFROM ships s\nJOIN pilots p ON p.id = s.pilot_id;",
			check: { type: "result" },
			hints: [
				"Ship names and pilot names are different things. What really links a ship to its pilot?",
				"The foreign key `ships.pilot_id` holds a pilot's `id`.",
				"JOIN pilots p ON p.id = s.pilot_id",
			],
			explanation:
				"Keys are the only reliable link. Joining on names (`s.name = p.name`) finds nothing here, and on larger data it would pair a ship called *Jackpot* with any pilot whose name happened to match.",
		},
		{
			id: "ch09-pr02",
			title: "Use the alias after defining it",
			prompt:
				"Fix the query: return the **commodity name**, the seized **qty** and the **fine** of every seizure.",
			difficulty: 2,
			kind: "query",
			concepts: ["table-aliases"],
			starterSql:
				"SELECT commodities.name, z.qty, z.fine\nFROM commodities c\nJOIN seizures z ON z.commodity_id = c.id;",
			solutionSql:
				"SELECT c.name, z.qty, z.fine\nFROM commodities c\nJOIN seizures z ON z.commodity_id = c.id;",
			check: { type: "result" },
			hints: [
				"Read the error: it mentions a missing FROM-clause entry.",
				"After `FROM commodities c`, the table is only known as `c` in this query.",
				"SELECT c.name, z.qty, z.fine ...",
			],
			explanation:
				"An alias *replaces* the table name for the whole query. Use `c.name`, or drop the alias and use `commodities.name` everywhere.",
		},
		{
			id: "ch09-pr03",
			title: "Seizures with ship names",
			prompt:
				"Return the **seizure id** and the **name of the ship** it was taken from, for every seizure.",
			difficulty: 1,
			kind: "query",
			concepts: ["inner-join"],
			solutionSql:
				"SELECT z.id, s.name\nFROM seizures z\nJOIN ships s ON s.id = z.ship_id;",
			check: { type: "result" },
			hints: [
				"seizures.ship_id points at a ship.",
				"JOIN ships on the ship's id.",
				"FROM seizures z JOIN ships s ON s.id = z.ship_id",
			],
			explanation:
				"Every seizure has a ship (the column is NOT NULL), so all 8 rows come back. Black Lotus shows up three times: one row per seizure.",
		},
		{
			id: "ch09-pr04",
			title: "Join the same table twice",
			prompt:
				"Return the **name of the departure planet** and the **name of the arrival planet** of every route.",
			difficulty: 3,
			kind: "query",
			concepts: ["inner-join", "table-aliases"],
			solutionSql:
				"SELECT a.name AS from_planet, b.name AS to_planet\nFROM routes r\nJOIN planets a ON a.id = r.from_planet_id\nJOIN planets b ON b.id = r.to_planet_id;",
			check: { type: "result" },
			hints: [
				"A route references planets twice. Can one join give you two different planet names?",
				"Join planets two times, with two different aliases.",
				"JOIN planets a ON a.id = r.from_planet_id JOIN planets b ON b.id = r.to_planet_id",
			],
			explanation:
				"The same table can appear twice under two aliases, one per role. With a single join both columns would show the same planet.\n\n**Pitfall:** `ON pl.id = r.from_planet_id AND pl.id = r.to_planet_id` asks for a route from a planet to itself: zero rows.",
		},
		{
			id: "ch09-pr05",
			title: "Pilot, ship and faction",
			prompt:
				"Return the **pilot name**, the **ship name** and the **faction name** for every pilot who flies a ship and belongs to a faction.",
			difficulty: 2,
			kind: "query",
			concepts: ["multi-table-join"],
			solutionSql:
				"SELECT p.name AS pilot, s.name AS ship, f.name AS faction\nFROM pilots p\nJOIN ships s ON s.pilot_id = p.id\nJOIN factions f ON f.id = p.faction_id;",
			check: { type: "result" },
			hints: [
				"`pilots` is in the middle: ships reference pilots, and pilots reference a faction.",
				"Two joins, two ON conditions.",
				"JOIN ships s ON s.pilot_id = p.id JOIN factions f ON f.id = p.faction_id",
			],
			explanation:
				"Bram and Jax fly two ships each, so they appear twice. Pilots with a NULL faction_id (Dax, Quill) drop out: no faction to join.",
		},
		{
			id: "ch09-pr06",
			title: "Two qty columns with USING",
			prompt:
				"Using `JOIN ... USING (ship_id, commodity_id)` between seizures and trades, return the **ship_id**, the **commodity_id**, the **seized qty** and the **traded qty** of every matching pair.",
			difficulty: 2,
			kind: "query",
			concepts: ["join-using-natural"],
			solutionSql:
				"SELECT ship_id, commodity_id, z.qty AS seized, t.qty AS traded\nFROM seizures z\nJOIN trades t USING (ship_id, commodity_id);",
			check: { type: "result" },
			hints: [
				"With USING, the shared columns are merged into one: no prefix needed.",
				"`qty` is not in the USING list, so it exists twice and needs an alias prefix.",
				"SELECT ship_id, commodity_id, z.qty, t.qty FROM seizures z JOIN trades t USING (ship_id, commodity_id)",
			],
			explanation:
				"`USING` merges `ship_id` and `commodity_id` into single columns, while the two `qty` columns stay separate. A NATURAL JOIN would also have required equal quantities (and ids), so it would return nothing.",
		},
	],
};

export default chapter;
