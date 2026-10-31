import type { Chapter } from "../types";

const PLANETS_STATE =
	"SELECT name, sector, population, gravity, discovered_on, has_spaceport FROM planets ORDER BY name;";
const PILOTS_STATE =
	"SELECT name, callsign, species, rank, faction_id, home_planet_id, mentor_id, credits, reputation, joined_at FROM pilots ORDER BY name;";

const chapter: Chapter = {
	id: "ch19-forging-rows",
	order: 19,
	world: "The Forge",
	tier: "novice",
	track: "mutation",
	title: "Forging Rows",
	subtitle: "INSERT new pilots, planets and cargo, and get their ids back",
	emoji: "⚒️",
	datasetId: "starport",
	concepts: [
		"insert-basic",
		"insert-multi-row",
		"default-values",
		"returning-clause",
		"insert-select",
		"sequences",
	],
	prerequisites: ["ch08-tally-the-loot"],
	lesson: [
		{
			kind: "explain",
			title: "Welcome to the Forge",
			body: "Until now you only **read** the Starport's registers. The dock chief now hands you the hammer: you will **write** them.\n\n```sql\nINSERT INTO planets (name, sector)\nVALUES ('Nova Prime', 'Frontier');\n```\nName the table, list the columns, then give one value per column, **in the same order**. Text goes in single quotes. Every mission runs on a fresh copy of the Starport, so break things freely.",
		},
		{
			kind: "example",
			title: "A new world on the map",
			body: "Run it: the INSERT adds the row, the SELECT shows it. Look at the columns you did **not** mention: the id appeared by itself, `has_spaceport` is false, the rest is NULL.",
			sql: "INSERT INTO planets (name, sector)\nVALUES ('Nova Prime', 'Frontier');\n\nSELECT * FROM planets WHERE name = 'Nova Prime';",
		},
		{
			kind: "quiz",
			question:
				"A clerk writes `INSERT INTO planets (name, sector) VALUES ('Frontier', 'Nova Prime');`. What happens?",
			choices: [
				"Postgres notices the mix-up and swaps the values back",
				"An error: 'Frontier' is not a valid planet name",
				"A planet named Frontier in sector Nova Prime is created, without any warning",
				"Nothing is inserted",
			],
			answerIndex: 2,
			explanation:
				"Values are matched to columns **by position only**. Both are text, so Postgres happily stores the swap. Always read your VALUES against the column list.",
		},
		{
			kind: "explain",
			title: "Defaults: what you leave out",
			body: "A column you leave out gets its **DEFAULT**: `has_spaceport` defaults to `false`, `pilots.reputation` to `0`, ids come from a counter. Columns without a default get NULL.\n\nYou can also ask for it explicitly: `VALUES ('Dusk', DEFAULT)`.\n\n**Careful:** writing `NULL` is not the same as the default. On a NOT NULL column it fails with **23502**.",
		},
		{
			kind: "explain",
			title: "Many rows at once",
			body: "One INSERT can carry many rows, separated by commas:\n```sql\nINSERT INTO routes (from_planet_id, to_planet_id, distance_ly)\nVALUES (11, 2, 3.9),\n       (2, 11, 3.9);\n```\nThe statement is **all or nothing**: if one row breaks a rule, none of them is inserted.",
		},
		{
			kind: "example",
			title: "Get the new id back",
			body: "`RETURNING` makes the INSERT answer like a SELECT, with the values that were really stored. No need for a second query to discover the new id.",
			sql: "INSERT INTO factions (name, founded_year)\nVALUES ('Comet Riders', 2078)\nRETURNING id, name;",
		},
		{
			kind: "explain",
			title: "INSERT ... SELECT",
			body: "Instead of VALUES, feed the INSERT with a query:\n```sql\nINSERT INTO watchlist (pilot, credits)\nSELECT name, credits\nFROM pilots\nWHERE reputation < 0;\n```\nEvery row of the SELECT becomes a new row. Columns are matched **by position**, not by name, exactly like VALUES.",
		},
		{
			kind: "explain",
			title: "Sequences and gaps",
			body: "Ids come from a **sequence**, a counter that hands out the next number with `nextval`. It never takes a number back: a deleted row, a failed insert or a rollback leaves a **gap**.\n\nGaps are normal. Never reuse a missing id by hand: the sequence will hand it out later and collide (23505).\n\n`currval(...)` repeats the last number *this session* got; before any `nextval` it fails with **55000**.",
		},
		{
			kind: "try",
			title: "Your turn: Glimmerfall",
			prompt:
				"Register the planet **Glimmerfall** in sector **Frontier**. Leave every other column to its default.",
			starterSql:
				"INSERT INTO planets (name, sector)\nVALUES ('Frontier', 'Glimmerfall');",
			solutionSql:
				"INSERT INTO planets (name, sector) VALUES ('Glimmerfall', 'Frontier');",
			check: { type: "state", verifySql: PLANETS_STATE },
			hints: [
				"Run the starter, then `SELECT * FROM planets;`. Which column got which value?",
				"VALUES ('Glimmerfall', 'Frontier'): same order as the column list.",
			],
		},
	],
	exercises: [
		{
			id: "ch19-ex01",
			title: "A planet called Nova Prime",
			story:
				"The Census Bureau charted a new world and wants it on the registers before lunch.",
			prompt:
				"Register the planet **Nova Prime**: sector **Frontier**, population **12000**, gravity **0.88**. Every other column keeps its default.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["insert-basic"],
			solutionSql:
				"INSERT INTO planets (name, sector, population, gravity)\nVALUES ('Nova Prime', 'Frontier', 12000, 0.88);",
			check: { type: "state", verifySql: PLANETS_STATE },
			hints: [
				"Four columns to fill, the rest takes care of itself.",
				"INSERT INTO planets (name, sector, population, gravity) VALUES (...)",
				"VALUES ('Nova Prime', 'Frontier', 12000, 0.88)",
			],
			explanation:
				"Naming the four columns lets Postgres fill the others: a fresh id from the sequence, `has_spaceport = false`, NULL for the discovery date.\n\n**Pitfall:** listing the values in another order than the columns. Text into text never complains, so a swap is stored silently.\n\n**Alternative:** `has_spaceport` could be written explicitly as `DEFAULT` or `false`.",
		},
		{
			id: "ch19-ex02",
			title: "Moon Cheese",
			story:
				"A trader wants to sell Moon Cheese. The clerk's INSERT explodes with `invalid input syntax for type integer: \"Moon Cheese\"`.",
			prompt:
				"Fix the INSERT: add the commodity **Moon Cheese**, category **food**, base price **14.00**, **legal**, sold by the **wheel** (unit).",
			difficulty: 1,
			kind: "mutation",
			concepts: ["insert-basic"],
			starterSql:
				"INSERT INTO commodities\nVALUES ('Moon Cheese', 'food', 14.00, true, 'wheel');",
			solutionSql:
				"INSERT INTO commodities (name, category, base_price, legal, unit)\nVALUES ('Moon Cheese', 'food', 14.00, true, 'wheel');",
			check: {
				type: "state",
				verifySql:
					"SELECT name, category, base_price, legal, unit FROM commodities ORDER BY name;",
			},
			hints: [
				"Without a column list, the first value goes into the **first column** of the table. Which column is first?",
				"`id` comes first. Name the columns you are filling so the id is generated.",
				"INSERT INTO commodities (name, category, base_price, legal, unit) VALUES (...)",
			],
			explanation:
				"Without a column list, VALUES must match **every** column in table order, starting with `id`. With a list, you choose the columns and the id comes from the sequence.\n\n**Pitfall:** relying on column order. Even when it works today, a new column added tomorrow breaks the INSERT or, worse, shifts values silently.",
		},
		{
			id: "ch19-ex03",
			title: "Three new cadets",
			story:
				"The academy shuttle drops three cadets at the docks. The dock chief wants them registered in one go.",
			prompt:
				"In **one INSERT**, register three pilots: **Ivy Starling**, **Bo Ruckus** and **Mox**. All three are **Human** **cadet**s who joined at **2078-01-10 00:00 UTC**, with no faction and no callsign (other columns default).",
			difficulty: 2,
			kind: "mutation",
			concepts: ["insert-multi-row"],
			solutionSql:
				"INSERT INTO pilots (name, species, rank, joined_at)\nVALUES ('Ivy Starling', 'Human', 'cadet', '2078-01-10 00:00:00+00'),\n       ('Bo Ruckus',    'Human', 'cadet', '2078-01-10 00:00:00+00'),\n       ('Mox',          'Human', 'cadet', '2078-01-10 00:00:00+00');",
			check: { type: "state", verifySql: PILOTS_STATE },
			hints: [
				"`pilots` needs at least name, species, rank and joined_at (they are NOT NULL).",
				"One column list, then several parenthesised rows separated by commas.",
				"VALUES ('Ivy Starling', 'Human', 'cadet', '2078-01-10 00:00:00+00'), ('Bo Ruckus', ...), ('Mox', ...)",
			],
			explanation:
				"A multi-row VALUES sends the three cadets in one statement and one round trip. If one row had been invalid, none of the three would be registered.\n\n**Pitfall:** forgetting the comma between two rows is a syntax error (42601); forgetting `+00` stores the time in the session time zone (GMT here, so it works, but be explicit).",
		},
		{
			id: "ch19-ex04",
			title: "NULL is not the default",
			story:
				"The clerk's INSERT for Kip Lanyard fails with `null value in column \"reputation\" violates not-null constraint`. He swears he wanted the default.",
			prompt:
				"Fix the INSERT: register **Kip Lanyard**, a **Vulpine** **ensign** who joined at **2078-02-01 00:00 UTC**. His **reputation** must be the column's default and his **credits** unknown (NULL). Nothing else is set.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["default-values"],
			starterSql:
				"INSERT INTO pilots (name, species, rank, credits, reputation, joined_at)\nVALUES ('Kip Lanyard', 'Vulpine', 'ensign', NULL, NULL, '2078-02-01 00:00:00+00');",
			solutionSql:
				"INSERT INTO pilots (name, species, rank, joined_at)\nVALUES ('Kip Lanyard', 'Vulpine', 'ensign', '2078-02-01 00:00:00+00');",
			check: { type: "state", verifySql: PILOTS_STATE },
			hints: [
				"Which value did the clerk give reputation? Is that the default?",
				"An explicit NULL is a value. The default is used only when you leave the column out, or write DEFAULT.",
				"Drop reputation from the list, or write DEFAULT in its place.",
			],
			explanation:
				"`NULL` means *I know this is unknown*; it never triggers the default. Leaving the column out (or writing `DEFAULT`) gives reputation `0`. Credits has no default, so leaving it out stores NULL, which is what the mission wants.\n\n**Pitfall:** replacing NULL by `0` for credits. 0 means *broke*, NULL means *unknown*: different facts.",
		},
		{
			id: "ch19-ex05",
			title: "Dawn Treader's papers",
			story:
				"Dax Morrow buys a second courier. The Harbor Master needs the registration number for the paperwork, right now.",
			prompt:
				"Register the ship **Dawn Treader**: model **Courier Mk II**, pilot **4**, cargo capacity **40**. In the same statement, **return** its **id** and **name**.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["returning-clause"],
			solutionSql:
				"INSERT INTO ships (name, model, pilot_id, cargo_capacity)\nVALUES ('Dawn Treader', 'Courier Mk II', 4, 40)\nRETURNING id, name;",
			check: {
				type: "result+state",
				verifySql:
					"SELECT id, name, model, pilot_id, cargo_capacity, hull_integrity, launched_on FROM ships ORDER BY id;",
			},
			hints: [
				"First write the INSERT, then add one clause at its end.",
				"RETURNING works like a SELECT list on the inserted rows.",
				"... VALUES ('Dawn Treader', 'Courier Mk II', 4, 40) RETURNING id, name;",
			],
			explanation:
				"`RETURNING id, name` hands back the stored row, generated id included (22), with no second query.\n\n**Pitfall:** `SELECT max(id) FROM ships` afterwards. With two clerks inserting at the same time, the max may be the *other* clerk's ship.\n\n**Alternative:** RETURNING also works on UPDATE and DELETE, as you will see in the next chapter.",
		},
		{
			id: "ch19-ex06",
			title: "The contraband archive",
			story:
				"Customs keeps a separate archive of every forbidden good. The table `contraband_archive (commodity_id, name, base_price)` has just been created, empty.",
			prompt:
				"Copy every **illegal** commodity (`legal` is false) into `contraband_archive`: its **id** goes into `commodity_id`, plus its **name** and **base_price**.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["insert-select"],
			setupSql:
				"CREATE TABLE contraband_archive (commodity_id int, name text, base_price numeric);",
			solutionSql:
				"INSERT INTO contraband_archive (commodity_id, name, base_price)\nSELECT id, name, base_price\nFROM commodities\nWHERE NOT legal;",
			check: {
				type: "state",
				verifySql:
					"SELECT commodity_id, name, base_price FROM contraband_archive ORDER BY commodity_id, name;",
			},
			hints: [
				"First write the SELECT that lists the illegal commodities. Run it alone.",
				"Then put `INSERT INTO contraband_archive (commodity_id, name, base_price)` in front of it.",
				"... SELECT id, name, base_price FROM commodities WHERE NOT legal;",
			],
			explanation:
				"INSERT ... SELECT turns every row of the query into a new row: three illegal goods, one statement.\n\n**Pitfall:** filtering on `category = 'contraband'` misses the Antimatter Pods, illegal but filed under fuel. Filter on the rule (`legal`), not on a label.\n\n**Alternative:** `WHERE legal = false` is the same test.",
		},
		{
			id: "ch19-ex07",
			title: "Mind the gap",
			story:
				"This morning a clerk registered a test planet called Temp, then deleted it. Now the register jumps from 12 to... well, you'll see.",
			prompt:
				"Register the planet **Sable Spire** in sector **Frontier** (other columns default) and **return** its **id**.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["sequences"],
			setupSql:
				"INSERT INTO planets (name) VALUES ('Temp');\nDELETE FROM planets WHERE name = 'Temp';",
			solutionSql:
				"INSERT INTO planets (name, sector) VALUES ('Sable Spire', 'Frontier') RETURNING id;",
			check: {
				type: "result+state",
				verifySql: "SELECT id, name, sector FROM planets ORDER BY id;",
			},
			hints: [
				"Before inserting, guess the id. Then let RETURNING tell you the truth.",
				"Temp consumed id 13 and the sequence never gives a number back.",
				"Do not write the id yourself: INSERT ... VALUES ('Sable Spire', 'Frontier') RETURNING id;",
			],
			explanation:
				"Sable Spire gets **14**: id 13 was handed to Temp and burned for good. The sequence only moves forward, which keeps it fast and safe with many clerks at once.\n\n**Pitfall:** forcing `id = 13` to \"fill the hole\". It works once, then the sequence hands out 13 again some day and the insert fails with 23505. Gaps are harmless; ids are labels, not counts.",
		},
		{
			id: "ch19-ex08",
			title: "Boss: The New Arrivals",
			story:
				"A convoy lands at Bay 7. Customs left their list in the table `arrivals (name, species, rank, callsign, cleared)`. Only cleared pilots may register, and the Harbor Master hands out ids in alphabetical order, as tradition demands.",
			prompt:
				"In **one statement**, register every arrival whose `cleared` is true as a pilot, keeping their **name**, **species**, **rank** and **callsign**, with `joined_at` = **2078-03-01 00:00 UTC**. Every other column keeps its default. Ids must be handed out in **name order A to Z**. **Return** the new **id**, **name** and **callsign**.",
			difficulty: 4,
			kind: "mutation",
			concepts: ["insert-select", "returning-clause", "default-values", "sequences"],
			setupSql:
				"CREATE TABLE arrivals (name text, species text, rank text, callsign text, cleared boolean);\nINSERT INTO arrivals VALUES\n  ('Zara Flint',    'Vulpine', 'ensign',     'flint', true),\n  ('Ansel Grue',    'Human',   'cadet',      NULL,    true),\n  ('Moss',          'Zorblax', 'cadet',      'mossy', true),\n  ('Juno Vale',     'Human',   'lieutenant', 'juno',  false),\n  ('Kestrel Oduya', 'Human',   'captain',    'Kes',   true);",
			solutionSql:
				"INSERT INTO pilots (name, species, rank, callsign, joined_at)\nSELECT name, species, rank, callsign, '2078-03-01 00:00:00+00'\nFROM arrivals\nWHERE cleared\nORDER BY name\nRETURNING id, name, callsign;",
			check: {
				type: "result+state",
				verifySql:
					"SELECT id, name, callsign, species, rank, faction_id, credits, reputation, joined_at FROM pilots ORDER BY id;",
			},
			hints: [
				"Start with the SELECT: the cleared arrivals, sorted by name, plus the join date as a constant column.",
				"Then INSERT INTO pilots (name, species, rank, callsign, joined_at) in front of it, and RETURNING at the end.",
				"... SELECT name, species, rank, callsign, '2078-03-01 00:00:00+00' FROM arrivals WHERE cleared ORDER BY name RETURNING id, name, callsign;",
			],
			explanation:
				"The SELECT decides which rows come in and **in which order**, so `ORDER BY name` makes the sequence hand out 25 to Ansel, 26 to Kestrel, 27 to Moss and 28 to Zara. Reputation takes its default 0 and credits stays NULL.\n\n**Pitfall:** without ORDER BY, rows arrive in storage order (Zara first) and the ids land on the wrong pilots. Forgetting `WHERE cleared` lets Juno slip through Customs.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch19-pr01",
			title: "The Comet Riders",
			prompt:
				"Register the faction **Comet Riders**, founded in **2078**, with homeworld **Zephyria** (planet id 5) and no motto.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["insert-basic"],
			solutionSql:
				"INSERT INTO factions (name, founded_year, homeworld_id) VALUES ('Comet Riders', 2078, 5);",
			check: {
				type: "state",
				verifySql: "SELECT name, motto, founded_year, homeworld_id FROM factions ORDER BY name;",
			},
			hints: [
				"Three columns to fill: name, founded_year and homeworld_id.",
				"Leaving motto out stores NULL.",
				"INSERT INTO factions (name, founded_year, homeworld_id) VALUES ('Comet Riders', 2078, 5);",
			],
			explanation:
				"Motto has no default, so leaving it out stores NULL, like the silent Void Monks.\n\n**Pitfall:** writing the homeworld name instead of its id: `homeworld_id` is an integer key, so `'Zephyria'` fails with 22P02.",
		},
		{
			id: "ch19-pr02",
			title: "A two-way lane",
			prompt:
				"In **one INSERT**, open the lanes **11 → 2** and **2 → 11**, both **3.9** light years long, with no hazard.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["insert-multi-row"],
			solutionSql:
				"INSERT INTO routes (from_planet_id, to_planet_id, distance_ly)\nVALUES (11, 2, 3.9), (2, 11, 3.9);",
			check: {
				type: "state",
				verifySql:
					"SELECT from_planet_id, to_planet_id, distance_ly, hazard FROM routes ORDER BY from_planet_id, to_planet_id;",
			},
			hints: [
				"Two rows, one column list.",
				"Separate the rows with a comma.",
				"VALUES (11, 2, 3.9), (2, 11, 3.9)",
			],
			explanation:
				"Both lanes arrive together or not at all.\n\n**Pitfall:** giving the same pair twice would break the primary key (23505) and neither lane would be opened.",
		},
		{
			id: "ch19-pr03",
			title: "All or nothing",
			story:
				"A supplier sends three goods, but its catalogue lists a Water Ice the Starport already knows.",
			prompt:
				"In **one INSERT**, try to add the commodities **Ion Salt** (unit `sack`), **Star Anise** (unit `jar`) and **Water Ice** (unit `ton`). The statement must **fail** on the duplicate name: write it and watch the error code.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["insert-multi-row"],
			solutionSql:
				"INSERT INTO commodities (name, unit)\nVALUES ('Ion Salt', 'sack'), ('Star Anise', 'jar'), ('Water Ice', 'ton');",
			check: { type: "error", sqlstate: "23505" },
			hints: [
				"Write the three rows in one VALUES list.",
				"`commodities.name` is UNIQUE and Water Ice already exists.",
				"INSERT INTO commodities (name, unit) VALUES ('Ion Salt', 'sack'), ('Star Anise', 'jar'), ('Water Ice', 'ton');",
			],
			explanation:
				"23505 is a unique violation, and it cancels the **whole** statement: Ion Salt and Star Anise are not inserted either.\n\n**Pitfall:** believing the first two rows went in. Check with a SELECT: they did not. The next chapter's ON CONFLICT will let you skip the duplicates instead.",
		},
		{
			id: "ch19-pr04",
			title: "Ion Salt, by default",
			prompt:
				"Add the commodity **Ion Salt**: category **essentials**, base price **22.00**, unit **sack**. Write the `legal` column in your list and give it the keyword **DEFAULT**.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["default-values"],
			solutionSql:
				"INSERT INTO commodities (name, category, base_price, legal, unit)\nVALUES ('Ion Salt', 'essentials', 22.00, DEFAULT, 'sack');",
			check: {
				type: "state",
				verifySql:
					"SELECT name, category, base_price, legal, unit FROM commodities ORDER BY name;",
			},
			hints: [
				"Five columns in the list, five values.",
				"DEFAULT is a keyword, not a string: no quotes.",
				"VALUES ('Ion Salt', 'essentials', 22.00, DEFAULT, 'sack')",
			],
			explanation:
				"`DEFAULT` fetches the column's default, here `true`. It is handy in multi-row VALUES where some rows need a value and others the default.\n\n**Pitfall:** `'DEFAULT'` in quotes is a string and fails on a boolean column (22P02).",
		},
		{
			id: "ch19-pr05",
			title: "Deal value at once",
			prompt:
				"Record a trade: ship **13** sells **20** units of commodity **12** on planet **2** at **101.00** each, at **2078-01-05 10:00 UTC**. **Return** its **id** and its **value** (`qty * unit_price`).",
			difficulty: 2,
			kind: "mutation",
			concepts: ["returning-clause"],
			solutionSql:
				"INSERT INTO trades (ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at)\nVALUES (13, 2, 12, 'sell', 20, 101.00, '2078-01-05 10:00:00+00')\nRETURNING id, qty * unit_price AS value;",
			check: {
				type: "result+state",
				verifySql:
					"SELECT id, ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at FROM trades ORDER BY id;",
			},
			hints: [
				"Seven columns to fill; side is 'sell'.",
				"RETURNING accepts expressions, like a SELECT list.",
				"... RETURNING id, qty * unit_price AS value;",
			],
			explanation:
				"RETURNING evaluates expressions on the stored row: trade 41 is worth 2020.00.\n\n**Pitfall:** `RETURNING *` sends back eight columns instead of the two asked for.",
		},
		{
			id: "ch19-pr06",
			title: "Frontier watch",
			prompt:
				"The table `frontier_watch (planet)` is empty. Fill it with the **name** of every planet in sector **Frontier**.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["insert-select"],
			setupSql: "CREATE TABLE frontier_watch (planet text);",
			solutionSql:
				"INSERT INTO frontier_watch (planet)\nSELECT name FROM planets WHERE sector = 'Frontier';",
			check: { type: "state", verifySql: "SELECT planet FROM frontier_watch ORDER BY planet;" },
			hints: [
				"Write the SELECT of Frontier planet names first.",
				"Put INSERT INTO frontier_watch (planet) in front of it.",
				"INSERT INTO frontier_watch (planet) SELECT name FROM planets WHERE sector = 'Frontier';",
			],
			explanation:
				"Zephyria, Mirage and Rust Gulch are copied in one statement.\n\n**Pitfall:** running it twice copies them twice: INSERT ... SELECT does not know what is already there.",
		},
		{
			id: "ch19-pr07",
			title: "What did the counter say?",
			prompt:
				"Register a ship named **Firefly** (no other column). Then, in a second statement, **return** the number the ships id sequence just handed out, using `currval(pg_get_serial_sequence('ships', 'id'))`.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["sequences"],
			solutionSql:
				"INSERT INTO ships (name) VALUES ('Firefly');\nSELECT currval(pg_get_serial_sequence('ships', 'id'));",
			check: {
				type: "result+state",
				verifySql: "SELECT id, name FROM ships ORDER BY id;",
			},
			hints: [
				"Two statements, separated by a semicolon.",
				"`pg_get_serial_sequence('ships', 'id')` gives the sequence name; currval reads its last value for your session.",
				"SELECT currval(pg_get_serial_sequence('ships', 'id'));",
			],
			explanation:
				"The INSERT called `nextval` behind the scenes (22), so currval can repeat it. currval is per session: another clerk's inserts never change it.\n\n**Pitfall:** `SELECT max(id) FROM ships` gives the same number here, but not when other sessions insert at the same time.",
		},
		{
			id: "ch19-pr08",
			title: "Too early for currval",
			prompt:
				"In a fresh session, ask `currval(pg_get_serial_sequence('planets', 'id'))` without inserting anything first. It must **fail**: write it and read the error code.",
			difficulty: 2,
			kind: "query",
			concepts: ["sequences"],
			solutionSql: "SELECT currval(pg_get_serial_sequence('planets', 'id'));",
			check: { type: "error", sqlstate: "55000" },
			hints: [
				"Just the SELECT, nothing before it.",
				"currval only knows numbers this session obtained with nextval.",
				"SELECT currval(pg_get_serial_sequence('planets', 'id'));",
			],
			explanation:
				"55000 means *object not in prerequisite state*: the session never called nextval on that sequence, so it has nothing to repeat.\n\n**Pitfall:** using currval to guess the *next* id. Use RETURNING on the INSERT instead.",
		},
	],
};

export default chapter;
