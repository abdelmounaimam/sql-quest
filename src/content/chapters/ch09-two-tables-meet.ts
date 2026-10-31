import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch09-two-tables-meet",
	order: 9,
	world: "The Jump Gates",
	tier: "apprentice",
	track: "query",
	title: "Two Tables Meet",
	subtitle: "Primary keys, foreign keys and the INNER JOIN that follows them",
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
			title: "Keys are the gates",
			body: "Until now every query read one register. The Starport keeps facts in **separate tables** and links them with ids:\n\n- `pilots.id` is a **primary key**: it identifies exactly one pilot.\n- `ships.pilot_id` is a **foreign key**: it stores the id of the pilot who flies the ship.\n\nIds connect tables, not names. Names can repeat or change; an id never lies.",
		},
		{
			kind: "example",
			title: "A ship only knows a number",
			body: "The ships register stores a pilot **id**, not a name. Look closely: two ships point at pilot 2, and two ships point at nobody at all (NULL).",
			sql: "SELECT id, name, pilot_id\nFROM ships;",
		},
		{
			kind: "explain",
			title: "JOIN ... ON opens the gate",
			body: "`JOIN` pairs each row of one table with the rows of another **where the ON condition is true**:\n```sql\nFROM ships s\nJOIN pilots p ON p.id = s.pilot_id\n```\n`s` and `p` are **table aliases**: short nicknames you use to say which table a column comes from.\n\nRows without a partner simply **vanish**: an INNER JOIN keeps matches only.",
		},
		{
			kind: "example",
			title: "Ships meet their pilots",
			body: "21 ships in the register, but only 19 rows here. Old Faithful and the Ghost Ship have no pilot, so the join has nothing to pair them with. Remember them: they come back in the next chapter.",
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
			title: "Chains of gates",
			body: "A trade points at a ship, a planet and a commodity. Add **one JOIN per table, each with its own ON**:\n```sql\nFROM trades t\nJOIN commodities c ON c.id = t.commodity_id\nJOIN planets pl ON pl.id = t.planet_id\n```\nForget an ON (or write a comma join without its WHERE) and every row pairs with every row: a cartesian explosion.",
		},
		{
			kind: "example",
			title: "Three registers in one view",
			body: "Each trade, with the name of what was traded and where. Same 40 trades, now readable.",
			sql: "SELECT t.id, c.name AS commodity, pl.name AS planet\nFROM trades t\nJOIN commodities c ON c.id = t.commodity_id\nJOIN planets pl ON pl.id = t.planet_id;",
		},
		{
			kind: "explain",
			title: "USING, and the NATURAL trap",
			body: "When both columns have the **same name**, `USING` is a shortcut, and the shared column appears only once:\n```sql\nseizures JOIN trades USING (ship_id, commodity_id)\n```\n`NATURAL JOIN` goes further: it joins on **every** column with the same name. Seizures and trades also share `id` and `qty`, so a natural join demands equal ids and equal quantities, and finds nothing. Avoid NATURAL.",
		},
		{
			kind: "try",
			title: "Your turn: who flies what",
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
			title: "Names on the hull",
			story:
				"The Harbor Master wants a board by the gate: every piloted ship and who is at its helm.",
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
				"`ON p.id = s.pilot_id` follows the foreign key from each ship to exactly one pilot. The two pilotless ships have no partner, so the inner join drops them.\n\n**Pitfall:** `ON p.id = s.id` also runs, but pairs ship 11 with pilot 11 (Lumen, who has no ship). Matching ids of *different things* is a silent bug.",
		},
		{
			id: "ch09-ex02",
			title: "Static on two channels",
			story:
				"A clerk tried to list pilots with their faction, but the console answers with an error about a name.",
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
			title: "Homeworlds",
			story:
				"The Census Bureau maps every faction to the planet it calls home.",
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
				"The foreign key `homeworld_id` leads to one planet per faction. The Lantern Guild has no homeworld (NULL never equals anything), so it drops out, exactly as asked.\n\n**Pitfall:** `pl.id = f.id` pairs faction 6 with planet 6 (Mirage) even though nobody lives there.",
		},
		{
			id: "ch09-ex04",
			title: "The trade ledger, decoded",
			story:
				"The dock chief is tired of reading numbers. She wants words.",
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
				"Each JOIN brings one table and one condition. Every trade has a commodity and a planet, so all 40 trades survive.\n\n**Pitfall:** `FROM trades t, commodities c, planets pl WHERE c.id = t.commodity_id` forgets the planet condition and returns 40 × 12 = 480 rows.",
		},
		{
			id: "ch09-ex05",
			title: "Who signed the deal?",
			story:
				"A trade only records the ship. Customs wants the person.",
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
				"Walk the keys: trades.ship_id leads to ships, ships.pilot_id leads to pilots.",
				"FROM trades t JOIN ships s ON s.id = t.ship_id JOIN pilots p ON p.id = s.pilot_id",
			],
			explanation:
				"Ships are the bridge: you join through them even though you select nothing from them.\n\n**Pitfall:** the shortcut `JOIN pilots p ON p.id = t.ship_id` runs without error but treats a ship id as a pilot id. Trade 11 (by ship 11, flown by Mira) would be signed by Lumen.",
		},
		{
			id: "ch09-ex06",
			title: "Nature is a liar",
			story:
				"Customs wants to match each seizure with the trades of the same ship and the same commodity. The intern used a NATURAL JOIN and found... nothing.",
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
			title: "Sector of birth",
			story:
				"The academy groups recruits by the sector they grew up in. Uncharted sectors do not count.",
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
				"Two pilots disappear for different reasons: Lumen has no home planet (the join drops her), and Umbra-3 comes from the uncharted Hollow Moon (the WHERE drops it).\n\n**Pitfall:** without the WHERE, Umbra-3 stays with an empty sector: a join only removes rows that have no partner, it never checks the partner's other columns for you.",
		},
		{
			id: "ch09-ex08",
			title: "Boss: The Customs Cross-check",
			story:
				"Customs is closing the year. For every illegal shipment they want the full story: when, who, what, where, and how much it was worth.",
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
				"Four joins follow four foreign keys, then WHERE keeps the contraband and ORDER BY tells the story in time. Sable Ironwood's two Antimatter runs are the biggest catch.\n\n**Pitfall:** `WHERE c.category = 'contraband'` misses Antimatter Pods, which are illegal fuel. Filter on the rule (`legal`), not on a label that usually matches it.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch09-pr01",
			title: "Radio roll call",
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
				"Keys are the only reliable link. Joining on names (`s.name = p.name`) finds nothing here, and on a bigger station would pair a ship called *Jackpot* with anyone whose name happened to match.",
		},
		{
			id: "ch09-pr02",
			title: "Nicknames only",
			story:
				"A clerk gave the tables short nicknames, then kept using the long names anyway.",
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
			title: "Impound list",
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
			title: "Lane signs",
			story:
				"The gate painters need both ends of every hyperlane written in words.",
			prompt:
				"Return the **name of the departure planet** and the **name of the arrival planet** of every route.",
			difficulty: 3,
			kind: "query",
			concepts: ["inner-join", "table-aliases"],
			solutionSql:
				"SELECT a.name AS from_planet, b.name AS to_planet\nFROM routes r\nJOIN planets a ON a.id = r.from_planet_id\nJOIN planets b ON b.id = r.to_planet_id;",
			check: { type: "result" },
			hints: [
				"A route points at planets twice. Can one join give you two different planet names?",
				"Join planets two times, with two different aliases.",
				"JOIN planets a ON a.id = r.from_planet_id JOIN planets b ON b.id = r.to_planet_id",
			],
			explanation:
				"The same table can appear twice under two aliases, one per role. With a single join both columns would show the same planet.\n\n**Pitfall:** `ON pl.id = r.from_planet_id AND pl.id = r.to_planet_id` asks for a lane from a planet to itself: zero rows.",
		},
		{
			id: "ch09-pr05",
			title: "Crew cards",
			prompt:
				"Return the **pilot name**, the **ship name** and the **faction name** for every pilot who flies a ship and belongs to a faction.",
			difficulty: 2,
			kind: "query",
			concepts: ["multi-table-join"],
			solutionSql:
				"SELECT p.name AS pilot, s.name AS ship, f.name AS faction\nFROM pilots p\nJOIN ships s ON s.pilot_id = p.id\nJOIN factions f ON f.id = p.faction_id;",
			check: { type: "result" },
			hints: [
				"Pilots sit in the middle: ships point at them, they point at a faction.",
				"Two joins, two ON conditions.",
				"JOIN ships s ON s.pilot_id = p.id JOIN factions f ON f.id = p.faction_id",
			],
			explanation:
				"Bram and Jax fly two ships each, so they appear twice. Freelancers (Dax, Quill) drop out: no faction to join.",
		},
		{
			id: "ch09-pr06",
			title: "Matching manifests",
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
