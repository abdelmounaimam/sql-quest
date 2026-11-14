import type { Chapter } from "../types";

const PILOT_CREDITS = "SELECT id, credits FROM pilots ORDER BY id;";
const SHIP_HULLS = "SELECT id, hull_integrity FROM ships ORDER BY id;";
const ROUTES_STATE =
	"SELECT from_planet_id, to_planet_id, distance_ly, hazard FROM routes ORDER BY from_planet_id, to_planet_id;";

const chapter: Chapter = {
	id: "ch20-reforging-and-banishing",
	order: 20,
	world: "The Forge",
	tier: "apprentice",
	track: "mutation",
	title: "Reforging and Banishing",
	subtitle: "UPDATE, UPDATE ... FROM, DELETE, DELETE ... USING and TRUNCATE",
	emoji: "🔥",
	datasetId: "starport",
	concepts: ["update-basic", "update-from", "delete-basic", "delete-using", "truncate"],
	prerequisites: ["ch19-forging-rows", "ch10-outer-gates-and-mirrors"],
	lesson: [
		{
			kind: "explain",
			title: "UPDATE: change existing rows",
			body: "`UPDATE` changes rows that already exist:\n```sql\nUPDATE ships\nSET hull_integrity = 80\nWHERE id = 6;\n```\nThe WHERE clause selects the rows; **no WHERE means every row**. A safe habit: write the `SELECT ... WHERE` first, check that it returns exactly the rows you mean, then turn it into the UPDATE.",
		},
		{
			kind: "example",
			title: "UPDATE with RETURNING",
			body: "RETURNING also works on UPDATE: it shows the rows as they are **after** the change.",
			sql: "UPDATE ships\nSET hull_integrity = 80\nWHERE id = 6\nRETURNING name, hull_integrity;",
		},
		{
			kind: "quiz",
			question:
				"To reset the credits and reputation of pilot 9, you run `UPDATE pilots SET credits = 0 AND reputation = 0 WHERE id = 9;` What happens?",
			choices: [
				"Both columns are set to 0",
				"Only credits is set to 0",
				"It fails: `0 AND reputation = 0` is one boolean expression assigned to credits (42804)",
				"It updates every pilot",
			],
			answerIndex: 2,
			explanation:
				"After `SET credits =` everything up to the next comma is **one expression**: `0 AND (reputation = 0)`, which is not a valid value for a number column. Separate assignments with commas: `SET credits = 0, reputation = 0`.",
		},
		{
			kind: "explain",
			title: "SET reads the old row",
			body: "Expressions on the right side see the row **before** the update:\n```sql\nSET credits = credits + 100\nSET min_rep = max_rep, max_rep = min_rep  -- a real swap\n```\nArithmetic with NULL returns NULL: NULL plus 100 is still NULL.",
		},
		{
			kind: "explain",
			title: "UPDATE ... FROM",
			body: "When the rows to change or the new values depend on another table, add that table with **FROM** and put the join condition in WHERE:\n```sql\nUPDATE pilots p\nSET credits = p.credits + 10\nFROM factions f\nWHERE f.id = p.faction_id\n  AND f.name = 'Void Monks';\n```\nDo **not** repeat the target table in FROM. If several source rows match one target row, PostgreSQL updates it once using an arbitrary one of them: aggregate first.",
		},
		{
			kind: "example",
			title: "UPDATE ... FROM with a join on ships",
			body: "The pilot of the ship named Night Fang loses 50 reputation. The ship is found by name through the join.",
			sql: "UPDATE pilots p\nSET reputation = p.reputation - 50\nFROM ships s\nWHERE s.pilot_id = p.id\n  AND s.name = 'Night Fang'\nRETURNING p.name, p.reputation;",
		},
		{
			kind: "explain",
			title: "DELETE: remove rows",
			body: "```sql\nDELETE FROM seizures WHERE id = 4;\n```\nSame rule: **no WHERE deletes every row**. To select the rows through a join, use **USING**:\n```sql\nDELETE FROM trades t\nUSING ships s\nWHERE s.id = t.ship_id AND s.name = 'Tusker';\n```\nForeign keys protect referenced rows: deleting a pilot that rows in `ships` still reference fails with **23503**.",
		},
		{
			kind: "explain",
			title: "TRUNCATE",
			body: "`TRUNCATE trades;` removes all rows of the table at once, much faster than DELETE on large tables. `RESTART IDENTITY` also resets its id sequence.\n\nIf another table references it with a foreign key, TRUNCATE fails (**0A000**). `CASCADE` would empty those tables too, which is rarely what you want.",
		},
		{
			kind: "try",
			title: "Try it: update one row",
			prompt: "Set the rank of **Wren Calloway** (pilot **22**) to **ensign**. No other row changes.",
			starterSql: "UPDATE pilots\nSET rank = 'ensign';",
			solutionSql: "UPDATE pilots SET rank = 'ensign' WHERE id = 22;",
			check: { type: "state", verifySql: "SELECT id, rank FROM pilots ORDER BY id;" },
			hints: [
				"Run the starter, then look at every pilot's rank: all of them changed.",
				"Add WHERE id = 22.",
			],
		},
	],
	exercises: [
		{
			id: "ch20-ex01",
			title: "Add credits to cadets",
			prompt:
				"Add **100** credits to every pilot whose rank is **cadet**. A cadet whose credits are unknown (NULL) keeps NULL.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["update-basic"],
			solutionSql: "UPDATE pilots SET credits = credits + 100 WHERE rank = 'cadet';",
			check: { type: "state", verifySql: PILOT_CREDITS },
			hints: [
				"First `SELECT name, credits FROM pilots WHERE rank = 'cadet';`",
				"SET can use the current value of the column.",
				"UPDATE pilots SET credits = credits + 100 WHERE rank = 'cadet';",
			],
			explanation:
				"`credits + 100` reads each cadet's own value. Lumen's NULL stays NULL because NULL + 100 is NULL, which is what the prompt asks.\n\n**Pitfall:** `COALESCE(credits, 0) + 100` would give Lumen 100 credits.",
		},
		{
			id: "ch20-ex02",
			title: "Fix: UPDATE without WHERE",
			prompt:
				"Fix the UPDATE: set `hull_integrity` to **100** only for ships whose hull integrity is **below 30**.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["update-basic"],
			starterSql: "UPDATE ships\nSET hull_integrity = 100;",
			solutionSql: "UPDATE ships SET hull_integrity = 100 WHERE hull_integrity < 30;",
			check: { type: "state", verifySql: SHIP_HULLS },
			hints: [
				"How many rows did the starter change? How many should it?",
				"An UPDATE without WHERE changes every row.",
				"Add WHERE hull_integrity < 30.",
			],
			explanation:
				"Only Fizzbang, Jackpot and 100% Legit change. Ships with a NULL hull integrity are not *below 30*, so they are not changed.\n\n**Pitfall:** a missing WHERE is one of the most costly mistakes in SQL. In practice, run the SELECT first or work inside a transaction you can roll back (transactions are covered in *The Pact*).",
		},
		{
			id: "ch20-ex03",
			title: "Update pilots of a faction by name",
			prompt:
				"Add **500** credits to every pilot of the faction named **Azure Navy**. Use `UPDATE ... FROM factions` to find them by name.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["update-from"],
			solutionSql:
				"UPDATE pilots p\nSET credits = p.credits + 500\nFROM factions f\nWHERE f.id = p.faction_id\n  AND f.name = 'Azure Navy';",
			check: { type: "state", verifySql: PILOT_CREDITS },
			hints: [
				"Which column of pilots references factions?",
				"UPDATE pilots p SET ... FROM factions f WHERE f.id = p.faction_id AND ...",
				"... WHERE f.id = p.faction_id AND f.name = 'Azure Navy';",
			],
			explanation:
				"FROM adds `factions` to the UPDATE; the WHERE joins it to each pilot and keeps the Azure Navy row. Five pilots are updated.\n\n**Pitfall:** without the join condition `f.id = p.faction_id`, every pilot matches the Azure Navy row and is updated.\n\n**Alternative:** `WHERE faction_id IN (SELECT id FROM factions WHERE name = 'Azure Navy')`.",
		},
		{
			id: "ch20-ex04",
			title: "Set prices from an aggregated subquery",
			prompt:
				"Set the `base_price` of each commodity to the **average unit_price of its sell trades** (trades with an unknown price are ignored). Commodities with no sell trade at a known price keep their current base_price.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["update-from"],
			solutionSql:
				"UPDATE commodities c\nSET base_price = s.avg_price\nFROM (\n  SELECT commodity_id, avg(unit_price) AS avg_price\n  FROM trades\n  WHERE side = 'sell' AND unit_price IS NOT NULL\n  GROUP BY commodity_id\n) AS s\nWHERE s.commodity_id = c.id;",
			check: {
				type: "state",
				verifySql: "SELECT id, base_price FROM commodities ORDER BY id;",
			},
			hints: [
				"First write a SELECT giving one row per commodity_id with its average sell price.",
				"Joining `trades` directly gives several rows per commodity, and PostgreSQL would use an arbitrary one. Put the grouped SELECT in FROM as a derived table.",
				"UPDATE commodities c SET base_price = s.avg_price FROM (SELECT commodity_id, avg(unit_price) AS avg_price FROM trades WHERE side = 'sell' GROUP BY commodity_id) s WHERE s.commodity_id = c.id;",
			],
			explanation:
				"The derived table has exactly one row per commodity, so each target row gets one well defined value. `avg` skips the NULL price of trade 37, and `numeric(10,2)` rounds values such as 13.75 to cents when storing them.\n\n**Pitfall:** `FROM trades t WHERE t.commodity_id = c.id AND t.side = 'sell'` runs without error but sets Water Ice to *one* of its sell prices, whichever is found first.",
		},
		{
			id: "ch20-ex05",
			title: "Delete rows with a NULL column",
			prompt: "Delete every seizure whose **fine** is unknown (NULL).",
			difficulty: 1,
			kind: "mutation",
			concepts: ["delete-basic"],
			solutionSql: "DELETE FROM seizures WHERE fine IS NULL;",
			check: { type: "state", verifySql: "SELECT id FROM seizures ORDER BY id;" },
			hints: [
				"Which seizures have no fine? SELECT them first.",
				"NULL is tested with IS NULL, never with = NULL.",
				"DELETE FROM seizures WHERE fine IS NULL;",
			],
			explanation:
				"Seizures 3 and 5 are deleted; the six with a fine remain.\n\n**Pitfall:** `WHERE fine = NULL` is never true, so it deletes nothing and gives no error. The opposite mistake, forgetting the WHERE, deletes every row.",
		},
		{
			id: "ch20-ex06",
			title: "Delete trades with DELETE ... USING",
			prompt:
				"Delete every trade made by a ship whose pilot is named **Jax O'Hara**. Use `DELETE ... USING` to find the ships and the pilot by name.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["delete-using"],
			solutionSql:
				"DELETE FROM trades t\nUSING ships s, pilots p\nWHERE s.id = t.ship_id\n  AND p.id = s.pilot_id\n  AND p.name = 'Jax O''Hara';",
			check: { type: "state", verifySql: "SELECT id FROM trades ORDER BY id;" },
			hints: [
				"`trades` references the ship, `ships` references the pilot: two joins.",
				"DELETE FROM trades t USING ships s, pilots p WHERE ... the two join conditions ... AND the name.",
				"... AND p.name = 'Jax O''Hara' (double the apostrophe).",
			],
			explanation:
				"USING lists the extra tables, WHERE joins and filters them. This pilot has two ships, Jackpot and 100% Legit: trades 9, 33 and 37 are deleted.\n\n**Pitfall:** forgetting one join condition turns the USING into a cross join and deletes many more trades.\n\n**Alternative:** `WHERE ship_id IN (SELECT s.id FROM ships s JOIN pilots p ON p.id = s.pilot_id WHERE p.name = 'Jax O''Hara')`.",
		},
		{
			id: "ch20-ex07",
			title: "DELETE blocked by a foreign key",
			prompt:
				"Write the DELETE that removes pilot **Bram Kettle** (id **2**). It must **fail**: rows in `ships` and `pilots` (as mentor) still reference this pilot. Run it and read the error code.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["delete-basic"],
			solutionSql: "DELETE FROM pilots WHERE id = 2;",
			check: { type: "error", sqlstate: "23503" },
			hints: [
				"A plain DELETE with a WHERE on the id or the name.",
				"Other rows reference this pilot through foreign keys: ships.pilot_id and pilots.mentor_id.",
				"DELETE FROM pilots WHERE id = 2;",
			],
			explanation:
				"23503 is a **foreign key violation**: deleting this pilot would leave the ships Rusty Bucket and Second Wind and two mentored pilots referencing a missing row. The DETAIL line names the referencing table.\n\n**Pitfall:** \"fixing\" it by dropping the constraint. The correct approach is to reassign or delete the referencing rows first, or to define the key with an ON DELETE action (covered in *Binding Laws*).",
		},
		{
			id: "ch20-ex08",
			title: "TRUNCATE and reset the sequence",
			prompt:
				"Empty the `trades` table **and** reset its id numbering, so the next trade inserted gets id **1**.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["truncate"],
			solutionSql: "TRUNCATE trades RESTART IDENTITY;",
			check: {
				type: "state",
				verifySql:
					"SELECT (SELECT count(*) FROM trades) AS rows_left, nextval(pg_get_serial_sequence('trades', 'id')) AS next_id;",
			},
			hints: [
				"Emptying is one keyword; resetting the numbering is an option of it.",
				"TRUNCATE has a RESTART IDENTITY option.",
				"TRUNCATE trades RESTART IDENTITY;",
			],
			explanation:
				"TRUNCATE removes all rows at once and `RESTART IDENTITY` resets the sequence to its start value. No table references `trades`, so no CASCADE is needed.\n\n**Pitfall:** `DELETE FROM trades;` or a plain `TRUNCATE trades;` empties the table but the next trade would still get id 41.",
		},
		{
			id: "ch20-ex09",
			title: "Boss: The Smugglers' Reckoning",
			story:
				"Combines UPDATE ... FROM over an aggregated derived table, DELETE ... USING and an UPDATE with two NULL tests.",
			prompt:
				"Run these three changes, in this order:\n\n1. Every pilot whose ships were seized **at least twice in total** loses **200** reputation (once, however many seizures).\n2. Delete the seizures of the commodity named **Glow Shrooms** made **before 2077-01-01**.\n3. Every ship whose hull integrity is **unknown** and that **has a pilot** gets hull integrity **50**.",
			difficulty: 5,
			kind: "mutation",
			concepts: ["update-from", "delete-using", "update-basic"],
			solutionSql:
				"UPDATE pilots p\nSET reputation = p.reputation - 200\nFROM (\n  SELECT s.pilot_id\n  FROM seizures z\n  JOIN ships s ON s.id = z.ship_id\n  GROUP BY s.pilot_id\n  HAVING count(*) >= 2\n) AS repeat_offenders\nWHERE repeat_offenders.pilot_id = p.id;\n\nDELETE FROM seizures z\nUSING commodities c\nWHERE c.id = z.commodity_id\n  AND c.name = 'Glow Shrooms'\n  AND z.seized_at < '2077-01-01';\n\nUPDATE ships\nSET hull_integrity = 50\nWHERE hull_integrity IS NULL\n  AND pilot_id IS NOT NULL;",
			check: {
				type: "state",
				verifySql:
					"SELECT 'pilot' AS kind, id, reputation::numeric AS value FROM pilots\nUNION ALL SELECT 'seizure', id, NULL FROM seizures\nUNION ALL SELECT 'ship', id, hull_integrity FROM ships\nORDER BY 1, 2;",
			},
			hints: [
				"Three statements. For change 1, first write a SELECT of the pilot ids with at least 2 seizures across their ships.",
				"Change 1 needs GROUP BY pilot_id HAVING count(*) >= 2 in a derived table, joined with UPDATE ... FROM. Change 2 is DELETE ... USING commodities. Change 3 needs two NULL tests.",
				"Change 3: UPDATE ships SET hull_integrity = 50 WHERE hull_integrity IS NULL AND pilot_id IS NOT NULL;",
			],
			explanation:
				"Cyra (3 seizures on Black Lotus) and Jax (2 on Jackpot) lose 200; seizures 1, 3 and 7 are deleted; Night Fang and Silent Vow get a hull integrity of 50, while Ghost Ship (no pilot) keeps NULL.\n\n**Pitfall:** joining `seizures` directly into the UPDATE without grouping penalizes every pilot with even **one** seizure (an UPDATE changes each row once, it never subtracts twice), so Nox, Sable and Fizzik would be updated by mistake.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch20-pr01",
			title: "Double a column for one model",
			prompt: "Double the `cargo_capacity` of every ship whose model is **Courier Mk II**.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["update-basic"],
			solutionSql:
				"UPDATE ships SET cargo_capacity = cargo_capacity * 2 WHERE model = 'Courier Mk II';",
			check: { type: "state", verifySql: "SELECT id, cargo_capacity FROM ships ORDER BY id;" },
			hints: [
				"SET can compute from the current value.",
				"cargo_capacity * 2",
				"UPDATE ships SET cargo_capacity = cargo_capacity * 2 WHERE model = 'Courier Mk II';",
			],
			explanation:
				"Four ships go from 40 to 80.\n\n**Pitfall:** `SET cargo_capacity = 80` happens to work with the current data, but is wrong as soon as one of these ships has another capacity.",
		},
		{
			id: "ch20-pr02",
			title: "Swap two columns in one UPDATE",
			prompt:
				"The tier **outlaw** in `reputation_tiers` has its bounds reversed (min_rep is -1, max_rep is -1000). Swap `min_rep` and `max_rep` of that tier in **one** UPDATE, so it reads -1000 to -1 again.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["update-basic"],
			setupSql: "UPDATE reputation_tiers SET min_rep = -1, max_rep = -1000 WHERE tier = 'outlaw';",
			solutionSql:
				"UPDATE reputation_tiers SET min_rep = max_rep, max_rep = min_rep WHERE tier = 'outlaw';",
			check: {
				type: "state",
				verifySql: "SELECT tier, min_rep, max_rep FROM reputation_tiers ORDER BY tier;",
			},
			hints: [
				"In a programming language you would need a temporary variable. In SQL you do not.",
				"Every expression in SET sees the row as it was before the UPDATE.",
				"SET min_rep = max_rep, max_rep = min_rep",
			],
			explanation:
				"All right hand sides are evaluated on the **old** row, then assigned together, so the two values swap correctly.\n\n**Pitfall:** expecting the assignments to run one after another (which would give the same value twice).",
		},
		{
			id: "ch20-pr03",
			title: "Update pilots by faction founding year",
			prompt:
				"Every pilot of a faction **founded before 2050** gains **50** reputation. Use `UPDATE ... FROM factions`.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["update-from"],
			solutionSql:
				"UPDATE pilots p\nSET reputation = p.reputation + 50\nFROM factions f\nWHERE f.id = p.faction_id\n  AND f.founded_year < 2050;",
			check: { type: "state", verifySql: "SELECT id, reputation FROM pilots ORDER BY id;" },
			hints: [
				"The founding year is in factions.",
				"FROM factions f WHERE f.id = p.faction_id AND ...",
				"... AND f.founded_year < 2050;",
			],
			explanation:
				"Solar Concord, Void Monks and Azure Navy qualify. Pilots with a NULL faction_id never match the join.\n\n**Pitfall:** `<= 2050` would include a faction founded in 2050 (none in the current data, but the rule says *before*).",
		},
		{
			id: "ch20-pr04",
			title: "Fix: target table repeated in FROM",
			prompt:
				"Fix the UPDATE: set `hull_integrity` to **100** only for ships flown by a pilot of rank **admiral**.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["update-from"],
			starterSql:
				"UPDATE ships\nSET hull_integrity = 100\nFROM ships s\nJOIN pilots p ON p.id = s.pilot_id\nWHERE p.rank = 'admiral';",
			solutionSql:
				"UPDATE ships s\nSET hull_integrity = 100\nFROM pilots p\nWHERE p.id = s.pilot_id\n  AND p.rank = 'admiral';",
			check: { type: "state", verifySql: SHIP_HULLS },
			hints: [
				"The starter mentions `ships` twice. Are they the same rows?",
				"The `ships s` in FROM is a second copy, not linked to the ships being updated: every target row matches.",
				"UPDATE ships s SET hull_integrity = 100 FROM pilots p WHERE p.id = s.pilot_id AND p.rank = 'admiral';",
			],
			explanation:
				"The target table is already in scope; FROM only lists the **other** tables. Now only Starling and Halo's Edge are updated.\n\n**Pitfall:** repeating the target in FROM creates an unrelated copy, a self cross join, so the WHERE never restricts the rows being updated.",
		},
		{
			id: "ch20-pr05",
			title: "Delete rows by a column value",
			prompt: "Delete every route whose hazard is **pirates**.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["delete-basic"],
			solutionSql: "DELETE FROM routes WHERE hazard = 'pirates';",
			check: { type: "state", verifySql: ROUTES_STATE },
			hints: [
				"SELECT the matching routes first.",
				"DELETE FROM routes WHERE ...",
				"DELETE FROM routes WHERE hazard = 'pirates';",
			],
			explanation:
				"Two routes are deleted: Mirage → Rust Gulch and Rust Gulch → Cinderfall.\n\n**Pitfall:** a DELETE without WHERE would delete every route.",
		},
		{
			id: "ch20-pr06",
			title: "Fix: DELETE with = NULL",
			prompt: "Fix the DELETE: remove every route whose **hazard** is unknown (NULL).",
			difficulty: 2,
			kind: "mutation",
			concepts: ["delete-basic"],
			starterSql: "DELETE FROM routes\nWHERE hazard = NULL;",
			solutionSql: "DELETE FROM routes WHERE hazard IS NULL;",
			check: { type: "state", verifySql: ROUTES_STATE },
			hints: [
				"How many rows did the starter delete?",
				"`= NULL` is never true.",
				"WHERE hazard IS NULL",
			],
			explanation:
				"`IS NULL` matches the nine routes with a NULL hazard.\n\n**Pitfall:** `= NULL` deletes nothing and raises no error, which makes it as hard to notice as a missing WHERE.",
		},
		{
			id: "ch20-pr07",
			title: "Delete manifest lines by ship model",
			prompt:
				"Delete every manifest line logged by a ship whose model is **Viper X**. Use `DELETE ... USING ships`.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["delete-using"],
			solutionSql:
				"DELETE FROM manifest_lines m\nUSING ships s\nWHERE s.id = m.ship_id\n  AND s.model = 'Viper X';",
			check: { type: "state", verifySql: "SELECT id FROM manifest_lines ORDER BY id;" },
			hints: [
				"manifest_lines.ship_id references ships.",
				"DELETE FROM manifest_lines m USING ships s WHERE s.id = m.ship_id AND ...",
				"... AND s.model = 'Viper X';",
			],
			explanation:
				"Lines 3, 6 and 12 belong to Black Lotus, Ace of Wings and Night Fang.\n\n**Pitfall:** without `s.id = m.ship_id`, the existence of any Viper X ship makes **every** line match.",
		},
		{
			id: "ch20-pr08",
			title: "TRUNCATE blocked by foreign keys",
			prompt:
				"Try to empty the `ships` table with TRUNCATE (no options). It must **fail**: write it and read the error code.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["truncate"],
			solutionSql: "TRUNCATE ships;",
			check: { type: "error", sqlstate: "0A000" },
			hints: [
				"Just the TRUNCATE statement.",
				"trades, seizures and manifest_lines reference ships through foreign keys.",
				"TRUNCATE ships;",
			],
			explanation:
				"0A000 (*feature not supported*): TRUNCATE does not check rows one by one, so it refuses to empty a table that other tables reference.\n\n**Pitfall:** adding CASCADE \"to make it work\" also empties trades, seizures and manifest_lines.",
		},
	],
};

export default chapter;
