import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch10-outer-gates-and-mirrors",
	order: 10,
	world: "The Jump Gates",
	tier: "adept",
	track: "query",
	title: "Outer Gates and Mirrors",
	subtitle:
		"LEFT, FULL and self joins, joins on ranges, and the fan-out that inflates your sums",
	emoji: "🪞",
	datasetId: "starport",
	concepts: [
		"left-join",
		"right-full-join",
		"self-join",
		"cross-join",
		"non-equi-join",
		"join-fanout",
	],
	prerequisites: ["ch09-two-tables-meet"],
	lesson: [
		{
			kind: "explain",
			title: "Nobody left behind",
			body: "An inner join drops rows without a partner. **LEFT JOIN** keeps every row of the **left** table (the one before the keyword), and fills the right side with **NULL** when nothing matches:\n```sql\nFROM factions f\nLEFT JOIN pilots p ON p.faction_id = f.id\n```\nEvery faction appears at least once, even one with no pilots at all.",
		},
		{
			kind: "example",
			title: "The empty guild hall",
			body: "Scroll to the Lantern Guild: one row, and its pilot is NULL. An inner join would have hidden it completely.",
			sql: "SELECT f.name AS faction, p.name AS pilot\nFROM factions f\nLEFT JOIN pilots p ON p.faction_id = f.id\nORDER BY f.name;",
		},
		{
			kind: "quiz",
			question:
				"`FROM factions f LEFT JOIN pilots p ON p.faction_id = f.id WHERE p.rank = 'captain'`: does the Lantern Guild (no pilots) appear?",
			choices: [
				"Yes, LEFT JOIN always keeps every faction",
				"No: WHERE runs after the join, and `NULL = 'captain'` is not true",
				"Yes, with a NULL rank",
				"It is a syntax error",
			],
			answerIndex: 1,
			explanation:
				"WHERE filters the joined rows, and the NULL-filled row fails the test: the LEFT JOIN quietly becomes an inner join. Put conditions on the right table **in the ON clause**: `ON p.faction_id = f.id AND p.rank = 'captain'`.",
		},
		{
			kind: "explain",
			title: "Counting the empty side",
			body: "After a LEFT JOIN, an empty faction still produces **one row** (full of NULLs). So:\n\n- `count(*)` counts that row: **1** pilot for the Lantern Guild. Wrong!\n- `count(p.id)` counts non-NULL ids: **0**. Right.\n\nAlways count a column of the right table, ideally its key.",
		},
		{
			kind: "explain",
			title: "RIGHT and FULL",
			body: "`A RIGHT JOIN B` keeps every row of **B**: it is just `B LEFT JOIN A` written backwards. Most people swap the tables and stick to LEFT.\n\n`FULL JOIN` keeps unmatched rows from **both** sides:\n```sql\nFROM planets pl\nFULL JOIN factions f ON f.homeworld_id = pl.id\n```\nPlanets with no faction and factions with no homeworld both survive, NULL on the missing side.",
		},
		{
			kind: "example",
			title: "Mirror, mirror: a self join",
			body: "A table can meet **itself**. `mentor_id` points at another pilot, so join pilots to pilots under two aliases. LEFT keeps the self-taught pilots, with a NULL mentor.",
			sql: "SELECT p.name AS pilot, m.name AS mentor\nFROM pilots p\nLEFT JOIN pilots m ON m.id = p.mentor_id;",
		},
		{
			kind: "explain",
			title: "Gates that are not '='",
			body: "ON accepts **any** condition. A pilot gets the tier whose range holds their reputation:\n```sql\nJOIN reputation_tiers t\n  ON p.reputation BETWEEN t.min_rep AND t.max_rep\n```\nThat is a **non-equi join**. Mind the bounds: BETWEEN includes both ends.\n\n`CROSS JOIN` has no condition at all: every row with every row. Useful on purpose (a schedule grid), a disaster by accident.",
		},
		{
			kind: "example",
			title: "Fan-out: where did 6 rows come from?",
			body: "Black Lotus has **2** trades and **3** seizures. Join both children to the ship and each trade pairs with each seizure: 2 × 3 = **6** rows. Any sum over this would count every fine twice.",
			sql: "SELECT s.name, t.id AS trade, z.id AS seizure, z.fine\nFROM ships s\nJOIN trades t ON t.ship_id = s.id\nJOIN seizures z ON z.ship_id = s.id\nWHERE s.name = 'Black Lotus';",
		},
		{
			kind: "explain",
			title: "The cure: total first, join after",
			body: "Aggregate each child table **on its own**, in a subquery in FROM, so it has one row per ship. Then join the totals:\n```sql\nFROM ships s\nLEFT JOIN (SELECT ship_id, sum(fine) AS fines\n           FROM seizures GROUP BY ship_id) z\n       ON z.ship_id = s.id\n```\nOne row per ship on each side means nothing can multiply. (Subqueries get a full chapter next world.)",
		},
		{
			kind: "try",
			title: "Your turn: no ship left behind",
			prompt:
				"Return every ship's **name** and its **pilot's name**, keeping ships without a pilot (their pilot shows as NULL).",
			starterSql:
				"SELECT s.name, p.name\nFROM ships s\nJOIN pilots p ON p.id = s.pilot_id;",
			solutionSql:
				"SELECT s.name, p.name FROM ships s LEFT JOIN pilots p ON p.id = s.pilot_id;",
			check: { type: "result" },
			hints: [
				"The starter returns 19 rows. Old Faithful and the Ghost Ship are missing.",
				"Change JOIN to LEFT JOIN: ships is on the left, so every ship stays.",
			],
		},
	],
	exercises: [
		{
			id: "ch10-ex01",
			title: "Roll call of the factions",
			story:
				"The Harbor Master counts members per faction. The new Lantern Guild insists it must be on the list, even with nobody in it.",
			prompt:
				"Return every faction's **name** and its **number of pilots**. Factions with no pilots show **0**.",
			difficulty: 2,
			kind: "query",
			concepts: ["left-join"],
			starterSql:
				"SELECT f.name, count(*)\nFROM factions f\nJOIN pilots p ON p.faction_id = f.id\nGROUP BY f.name;",
			solutionSql:
				"SELECT f.name, count(p.id) AS pilots\nFROM factions f\nLEFT JOIN pilots p ON p.faction_id = f.id\nGROUP BY f.id, f.name;",
			check: { type: "result" },
			hints: [
				"Run the starter: one faction is missing. Then think about what it would count.",
				"LEFT JOIN keeps the empty faction; count a column from pilots so the NULL row counts as 0.",
				"FROM factions f LEFT JOIN pilots p ON p.faction_id = f.id ... count(p.id)",
			],
			explanation:
				"The LEFT JOIN keeps the Lantern Guild as one row with NULL pilot columns, and `count(p.id)` skips that NULL: 0.\n\n**Pitfall:** `count(*)` counts the NULL-filled row too and reports **1** pilot for an empty guild.",
		},
		{
			id: "ch10-ex02",
			title: "The vanishing ships",
			story:
				"The yearly report should list every ship with its number of trades in 2077. Half the fleet is missing from it, and the analyst swears he used a LEFT JOIN.",
			prompt:
				"Fix the query: return every ship's **name** and its **number of trades in 2077** (from 1 January 2077 included to 1 January 2078 excluded). Ships with no 2077 trade show **0**.",
			difficulty: 3,
			kind: "query",
			concepts: ["left-join"],
			starterSql:
				"SELECT s.name, count(t.id) AS trades_2077\nFROM ships s\nLEFT JOIN trades t ON t.ship_id = s.id\nWHERE t.traded_at >= '2077-01-01' AND t.traded_at < '2078-01-01'\nGROUP BY s.id, s.name;",
			solutionSql:
				"SELECT s.name, count(t.id) AS trades_2077\nFROM ships s\nLEFT JOIN trades t\n  ON t.ship_id = s.id\n AND t.traded_at >= '2077-01-01' AND t.traded_at < '2078-01-01'\nGROUP BY s.id, s.name;",
			check: { type: "result" },
			hints: [
				"Run the starter: 12 ships instead of 21. Which rows does the WHERE throw away?",
				"For a ship without 2077 trades, `t.traded_at` is NULL after the join, and WHERE drops it. Filter the trades before they are joined.",
				"Move the date conditions into the ON clause: ON t.ship_id = s.id AND t.traded_at >= ...",
			],
			explanation:
				"Conditions in ON decide **which trades get attached**; the LEFT JOIN still keeps every ship. Conditions in WHERE run afterwards and delete the NULL-filled rows, which turns the LEFT JOIN back into an inner join.\n\n**Pitfall:** `WHERE t.traded_at >= '2077-01-01' OR t.id IS NULL` looks like a fix but drops ships that traded only in 2076 (Rusty Bucket, Ace of Wings...).",
		},
		{
			id: "ch10-ex03",
			title: "Dust on the shelves",
			story:
				"The quartermaster wants to stop stocking goods nobody ever trades.",
			prompt:
				"Return the **name** of every commodity that has **never been traded**. Use a LEFT JOIN.",
			difficulty: 2,
			kind: "query",
			concepts: ["left-join"],
			solutionSql:
				"SELECT c.name\nFROM commodities c\nLEFT JOIN trades t ON t.commodity_id = c.id\nWHERE t.id IS NULL;",
			check: { type: "result" },
			hints: [
				"Keep every commodity, then look for the ones that found no trade.",
				"After a LEFT JOIN, a row without partner has NULL in every trade column, including the trade's key.",
				"LEFT JOIN trades t ON t.commodity_id = c.id WHERE t.id IS NULL",
			],
			explanation:
				"This is the **anti-join** pattern: keep everything, then keep only rows whose partner is missing. Test the right table's **key** (`t.id`), which is never NULL in a real trade.\n\n**Pitfall:** `WHERE t.unit_price IS NULL` also catches trade 37, whose price was lost in a solar flare, and wrongly lists Hydroponic Rice.\n\n**Alternative:** `WHERE NOT EXISTS (...)`, coming in the Nested Catacombs.",
		},
		{
			id: "ch10-ex04",
			title: "Both sides of the map",
			story:
				"The cartographers want one sheet with every planet and every faction homeworld claim, nothing left out on either side.",
			prompt:
				"Return the **planet name** and the **name of the faction** whose homeworld it is. Keep planets that are **nobody's homeworld** (faction NULL) and factions with **no homeworld** (planet NULL).",
			difficulty: 3,
			kind: "query",
			concepts: ["right-full-join"],
			solutionSql:
				"SELECT pl.name AS planet, f.name AS faction\nFROM planets pl\nFULL JOIN factions f ON f.homeworld_id = pl.id;",
			check: { type: "result" },
			hints: [
				"A LEFT JOIN from planets loses the Lantern Guild; from factions it loses seven planets.",
				"You need the join that keeps unmatched rows from both sides.",
				"FROM planets pl FULL JOIN factions f ON f.homeworld_id = pl.id",
			],
			explanation:
				"`FULL JOIN` = LEFT and RIGHT at once: 5 matched pairs, 7 lonely planets, 1 lonely faction, 13 rows.\n\n**Pitfall:** a WHERE on either table (`WHERE f.founded_year > 2000`) would silently drop the NULL side again, exactly like with LEFT JOIN.",
		},
		{
			id: "ch10-ex05",
			title: "Who trained you?",
			story:
				"The academy is printing lineage cards: every pilot with the name of their mentor.",
			prompt:
				"Return every pilot's **name** and the **name of their mentor**. Pilots without a mentor stay, with a NULL mentor.",
			difficulty: 2,
			kind: "query",
			concepts: ["self-join"],
			solutionSql:
				"SELECT p.name AS pilot, m.name AS mentor\nFROM pilots p\nLEFT JOIN pilots m ON m.id = p.mentor_id;",
			check: { type: "result" },
			hints: [
				"The mentor is also a pilot: the same table plays two roles.",
				"Two aliases of pilots: one for the apprentice, one for the mentor. Keep self-taught pilots.",
				"FROM pilots p LEFT JOIN pilots m ON m.id = p.mentor_id",
			],
			explanation:
				"`m` is a second copy of pilots, matched on the apprentice's `mentor_id`. LEFT keeps the 7 self-taught pilots.\n\n**Pitfall:** `ON m.mentor_id = p.id` reverses the roles: it lists each pilot with their **apprentices** instead.",
		},
		{
			id: "ch10-ex06",
			title: "Two jumps away",
			story:
				"Pilots love two-jump trips: out through one hyperlane, on through a second. A trip that just comes back home does not count.",
			prompt:
				"Return the **start**, **middle** and **end** planet ids of every two-hop route: a route from start to middle followed by a route from middle to end, where the **end is not the start**.",
			difficulty: 3,
			kind: "query",
			concepts: ["self-join"],
			solutionSql:
				"SELECT a.from_planet_id AS start, a.to_planet_id AS middle, b.to_planet_id AS finish\nFROM routes a\nJOIN routes b ON b.from_planet_id = a.to_planet_id\nWHERE b.to_planet_id <> a.from_planet_id;",
			check: { type: "result" },
			hints: [
				"Use routes twice: the first hop and the second hop.",
				"The second hop starts where the first one ends.",
				"JOIN routes b ON b.from_planet_id = a.to_planet_id WHERE b.to_planet_id <> a.from_planet_id",
			],
			explanation:
				"Chaining a table to itself on `end of hop 1 = start of hop 2` builds paths. 17 trips remain once the round trips (1 → 2 → 1 and friends) are removed.\n\n**Pitfall:** forgetting the `<>` filter keeps 6 pointless round trips. For paths of any length you will need recursion: see the Endless Stair.",
		},
		{
			id: "ch10-ex07",
			title: "Titles by reputation",
			story:
				"Each pilot's badge shows a title from the reputation table. The brackets include both of their bounds.",
			prompt:
				"Return every pilot's **name** and their reputation **tier**: the tier whose `min_rep` to `max_rep` range, **both bounds included**, contains the pilot's reputation.",
			difficulty: 2,
			kind: "query",
			concepts: ["non-equi-join"],
			solutionSql:
				"SELECT p.name, t.tier\nFROM pilots p\nJOIN reputation_tiers t ON p.reputation BETWEEN t.min_rep AND t.max_rep;",
			check: { type: "result" },
			hints: [
				"There is no tier id in pilots. What connects a pilot to a tier?",
				"Join on a range test instead of an equality.",
				"JOIN reputation_tiers t ON p.reputation BETWEEN t.min_rep AND t.max_rep",
			],
			explanation:
				"Each reputation falls in exactly one bracket, so each pilot gets exactly one row.\n\n**Pitfall:** `p.reputation > t.min_rep AND p.reputation < t.max_rep` drops everyone sitting on a bound, like Lumen and Umbra-3 at exactly 0. Overlapping brackets would be the opposite bug: duplicate rows.",
		},
		{
			id: "ch10-ex08",
			title: "Docking grid",
			story:
				"The dock chief plans test dockings: every heavy hauler must try every spaceport where gravity will not crush its landing gear.",
			prompt:
				"Return the **ship name** and **planet name** of every pairing between a ship with a **cargo capacity of 900 or more** and a planet that **has a spaceport** and a **gravity of 1.00 or less**.",
			difficulty: 2,
			kind: "query",
			concepts: ["cross-join"],
			solutionSql:
				"SELECT s.name AS ship, pl.name AS planet\nFROM ships s\nCROSS JOIN planets pl\nWHERE s.cargo_capacity >= 900\n  AND pl.has_spaceport AND pl.gravity <= 1.00;",
			check: { type: "result" },
			hints: [
				"There is no relationship between these ships and planets: you want every combination.",
				"CROSS JOIN pairs every row with every row; filter both sides in WHERE.",
				"FROM ships s CROSS JOIN planets pl WHERE s.cargo_capacity >= 900 AND pl.has_spaceport AND pl.gravity <= 1.00",
			],
			explanation:
				"4 haulers × 5 gentle spaceports = 20 pairings. CROSS JOIN is the honest way to ask for every combination.\n\n**Pitfall:** the same product happens by accident when a comma join forgets its WHERE condition. On big tables that is millions of rows.",
		},
		{
			id: "ch10-ex09",
			title: "Boss: The Broken Gate",
			story:
				"The Harbor Master's faction report is broken: the Crimson Syndicate shows 10 pilots when it has 4, its sales and seizures are inflated, and empty factions show blanks. Repair the gate before the council meets.",
			prompt:
				"Fix the report. For **every faction** (all 6), return:\n\n1. the faction **name**\n2. the number of its **pilots**\n3. the number of **ships** flown by its pilots\n4. the total **sales value** of those ships: `qty * unit_price` over their trades with side `sell`\n5. the total **qty seized** from those ships\n\nShow **0**, not NULL, wherever there is nothing to count or add.",
			difficulty: 5,
			kind: "query",
			concepts: ["join-fanout", "left-join"],
			starterSql:
				"SELECT f.name, count(p.id) AS pilots, count(s.id) AS ships,\n       sum(t.qty * t.unit_price) AS sales, sum(z.qty) AS seized\nFROM factions f\nLEFT JOIN pilots p ON p.faction_id = f.id\nLEFT JOIN ships s ON s.pilot_id = p.id\nLEFT JOIN trades t ON t.ship_id = s.id AND t.side = 'sell'\nLEFT JOIN seizures z ON z.ship_id = s.id\nGROUP BY f.id, f.name;",
			solutionSql:
				"SELECT f.name,\n       count(DISTINCT p.id) AS pilots,\n       count(DISTINCT s.id) AS ships,\n       COALESCE(sum(ts.sales), 0) AS sales,\n       COALESCE(sum(zs.seized), 0) AS seized\nFROM factions f\nLEFT JOIN pilots p ON p.faction_id = f.id\nLEFT JOIN ships s ON s.pilot_id = p.id\nLEFT JOIN (SELECT ship_id, sum(qty * unit_price) AS sales\n           FROM trades WHERE side = 'sell' GROUP BY ship_id) ts ON ts.ship_id = s.id\nLEFT JOIN (SELECT ship_id, sum(qty) AS seized\n           FROM seizures GROUP BY ship_id) zs ON zs.ship_id = s.id\nGROUP BY f.id, f.name;",
			check: { type: "result" },
			hints: [
				"Run the starter on Crimson Syndicate: every trade of a ship pairs with every seizure of that ship, and every ship repeats its pilot.",
				"Total the trades per ship and the seizures per ship in two subqueries in FROM (one row per ship each), then join those totals. Count pilots and ships with DISTINCT.",
				"LEFT JOIN (SELECT ship_id, sum(qty * unit_price) AS sales FROM trades WHERE side = 'sell' GROUP BY ship_id) ts ON ts.ship_id = s.id, same for seizures, then COALESCE(sum(...), 0).",
			],
			explanation:
				"Pre-aggregating gives one row per ship for sales and one for seizures, so joining them cannot multiply anything; `count(DISTINCT ...)` undoes the repetition of pilots across their ships, and `COALESCE` turns empty sums into 0. Crimson: 4 pilots, 5 ships, 17765.00 sold, 26 units seized.\n\n**Pitfall:** `sum(DISTINCT z.qty)` looks like a quick fix but adds each *value* once: two different seizures of 1 unit count as one, so Crimson shows 25.\n\n**Alternative:** one CTE per child table (Nested Catacombs), or correlated subqueries in SELECT.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch10-pr01",
			title: "Quiet ports",
			prompt:
				"Return every planet's **name** and its **number of trades**, with **0** for planets where nothing was ever traded.",
			difficulty: 2,
			kind: "query",
			concepts: ["left-join"],
			solutionSql:
				"SELECT pl.name, count(t.id) AS trades\nFROM planets pl\nLEFT JOIN trades t ON t.planet_id = pl.id\nGROUP BY pl.id, pl.name;",
			check: { type: "result" },
			hints: [
				"Hollow Moon saw no trade but must be listed.",
				"LEFT JOIN from planets, then count a trades column.",
				"count(t.id), not count(*)",
			],
			explanation:
				"`count(t.id)` gives Hollow Moon 0. With `count(*)` it would get 1, for the NULL-filled row.",
		},
		{
			id: "ch10-pr02",
			title: "Grounded pilots",
			prompt:
				"Return the **name** of every pilot who flies **no ship**. Use a LEFT JOIN.",
			difficulty: 2,
			kind: "query",
			concepts: ["left-join"],
			solutionSql:
				"SELECT p.name\nFROM pilots p\nLEFT JOIN ships s ON s.pilot_id = p.id\nWHERE s.id IS NULL;",
			check: { type: "result" },
			hints: [
				"Keep every pilot, then keep the ones with no ship attached.",
				"Test a column of ships that is never NULL for a real ship: its key.",
				"LEFT JOIN ships s ON s.pilot_id = p.id WHERE s.id IS NULL",
			],
			explanation:
				"Seven pilots are grounded. Testing `s.hull_integrity IS NULL` instead would also list Nox and Umbra-3, whose ships simply were never inspected.",
		},
		{
			id: "ch10-pr03",
			title: "The backwards gate",
			story:
				"A clerk wrote a RIGHT JOIN to list every commodity with its seizures, but only seized goods show up.",
			prompt:
				"Fix the query: return every commodity's **name** and the **id** of each of its seizures, keeping commodities that were **never seized** (id NULL).",
			difficulty: 2,
			kind: "query",
			concepts: ["right-full-join"],
			starterSql:
				"SELECT c.name, z.id\nFROM commodities c\nRIGHT JOIN seizures z ON z.commodity_id = c.id;",
			solutionSql:
				"SELECT c.name, z.id\nFROM commodities c\nLEFT JOIN seizures z ON z.commodity_id = c.id;",
			check: { type: "result" },
			hints: [
				"RIGHT JOIN keeps every row of the table on the right of the keyword. Which one is that?",
				"You want every commodity kept: commodities must be the preserved side.",
				"Use LEFT JOIN here (or swap the tables around RIGHT JOIN).",
			],
			explanation:
				"`A RIGHT JOIN B` preserves B, here the seizures, which all have a commodity anyway. `commodities LEFT JOIN seizures` preserves the commodities: 21 rows.",
		},
		{
			id: "ch10-pr04",
			title: "Kindred spirits",
			prompt:
				"Return each **pair of pilot names** sharing the same **species**, for every species except Human. List each pair **once** (not also in mirrored order), never a pilot with themselves, the pilot with the **smaller id first**.",
			difficulty: 3,
			kind: "query",
			concepts: ["self-join"],
			solutionSql:
				"SELECT a.name, b.name\nFROM pilots a\nJOIN pilots b ON b.species = a.species AND a.id < b.id\nWHERE a.species <> 'Human';",
			check: { type: "result" },
			hints: [
				"Join pilots to pilots on species.",
				"`a.id <> b.id` still gives each pair twice (A,B and B,A).",
				"ON b.species = a.species AND a.id < b.id",
			],
			explanation:
				"`a.id < b.id` removes both the self pairs and the mirrored duplicates: 9 pairs instead of 18.",
		},
		{
			id: "ch10-pr05",
			title: "Two-way lanes",
			prompt:
				"Return the **from_planet_id** and **to_planet_id** of every route that also exists in the **opposite direction**, listing each such lane once, with the **smaller planet id first**.",
			difficulty: 3,
			kind: "query",
			concepts: ["self-join"],
			solutionSql:
				"SELECT a.from_planet_id, a.to_planet_id\nFROM routes a\nJOIN routes b ON b.from_planet_id = a.to_planet_id AND b.to_planet_id = a.from_planet_id\nWHERE a.from_planet_id < a.to_planet_id;",
			check: { type: "result" },
			hints: [
				"Look for a second route whose ends are swapped.",
				"Match b.from with a.to and b.to with a.from, then keep one direction.",
				"... WHERE a.from_planet_id < a.to_planet_id",
			],
			explanation:
				"Three lanes run both ways: between planets 1 and 2, 3 and 8, 4 and 7. Without the final filter each would appear twice.",
		},
		{
			id: "ch10-pr06",
			title: "Badge printing",
			prompt:
				"Return every combination of reputation **tier** and **faction name**, for factions **founded before 2050**.",
			difficulty: 1,
			kind: "query",
			concepts: ["cross-join"],
			solutionSql:
				"SELECT t.tier, f.name\nFROM reputation_tiers t\nCROSS JOIN factions f\nWHERE f.founded_year < 2050;",
			check: { type: "result" },
			hints: [
				"Every tier with every faction: no condition links them.",
				"CROSS JOIN, then filter the factions.",
				"FROM reputation_tiers t CROSS JOIN factions f WHERE f.founded_year < 2050",
			],
			explanation: "5 tiers × 3 old factions = 15 badge templates.",
		},
		{
			id: "ch10-pr07",
			title: "Price gougers",
			prompt:
				"Return the **trade id**, the **commodity name**, the **unit_price** and the commodity's **base_price** for every trade whose unit price is **more than 10% above** the base price (strictly more than `base_price * 1.1`).",
			difficulty: 2,
			kind: "query",
			concepts: ["non-equi-join"],
			solutionSql:
				"SELECT t.id, c.name, t.unit_price, c.base_price\nFROM trades t\nJOIN commodities c ON c.id = t.commodity_id AND t.unit_price > c.base_price * 1.1;",
			check: { type: "result" },
			hints: [
				"Join trades to commodities, then compare the two prices.",
				"An ON clause can mix an equality and an inequality.",
				"ON c.id = t.commodity_id AND t.unit_price > c.base_price * 1.1",
			],
			explanation:
				"The inequality can live in ON or in WHERE for an inner join; the result is the same. Trade 37 (unknown price) is excluded either way: NULL > anything is unknown.",
		},
		{
			id: "ch10-pr08",
			title: "Fines on repeat",
			story:
				"Customs reports 35000 in fines for Jackpot. The real figure is 17500. Someone left an old join in the query.",
			prompt:
				"Fix the query: return the **name** and **total fines** of every ship that was seized at least once (a ship whose fines are all pending shows NULL).",
			difficulty: 2,
			kind: "query",
			concepts: ["join-fanout"],
			starterSql:
				"SELECT s.name, sum(z.fine) AS fines\nFROM ships s\nJOIN seizures z ON z.ship_id = s.id\nJOIN trades t ON t.ship_id = s.id\nGROUP BY s.id, s.name;",
			solutionSql:
				"SELECT s.name, sum(z.fine) AS fines\nFROM ships s\nJOIN seizures z ON z.ship_id = s.id\nGROUP BY s.id, s.name;",
			check: { type: "result" },
			hints: [
				"Jackpot has 2 seizures and 2 trades. How many rows does the join give it?",
				"The trades are not needed for this report, and they multiply every fine.",
				"Remove the JOIN trades line.",
			],
			explanation:
				"Each seizure row was repeated once per trade of the same ship. Joining a table you do not need is the most common source of fan-out.",
		},
		{
			id: "ch10-pr09",
			title: "Two ledgers, one line",
			prompt:
				"Return every ship's **name**, its **number of trades** and its **number of seizures**, with **0** where there are none.",
			difficulty: 3,
			kind: "query",
			concepts: ["join-fanout"],
			solutionSql:
				"SELECT s.name, count(DISTINCT t.id) AS trades, count(DISTINCT z.id) AS seizures\nFROM ships s\nLEFT JOIN trades t ON t.ship_id = s.id\nLEFT JOIN seizures z ON z.ship_id = s.id\nGROUP BY s.id, s.name;",
			check: { type: "result" },
			hints: [
				"Black Lotus has 2 trades and 3 seizures. A plain double join gives it 6 of each.",
				"Count distinct keys, or total each table in its own subquery before joining.",
				"count(DISTINCT t.id), count(DISTINCT z.id)",
			],
			explanation:
				"`count(DISTINCT key)` is safe for counting because keys are unique. It does **not** work for sums of values: for those, pre-aggregate each child first.",
		},
	],
};

export default chapter;
