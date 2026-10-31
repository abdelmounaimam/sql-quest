import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch14-the-endless-stair",
	order: 14,
	world: "The Nested Catacombs",
	tier: "expert",
	track: "query",
	title: "The Endless Stair",
	subtitle:
		"Recursive CTEs: climb mentor lineages, quest chains and portal graphs without falling into loops",
	emoji: "🌀",
	datasetId: "guild",
	concepts: ["recursive-cte", "recursive-graph-walks"],
	prerequisites: ["ch13-unions-and-named-spells"],
	lesson: [
		{
			kind: "explain",
			title: "A spell that calls itself",
			body: "`WITH RECURSIVE` builds a result step by step:\n```sql\nWITH RECURSIVE steps(n) AS (\n  SELECT 1                 -- anchor: the first rows\n  UNION ALL\n  SELECT n + 1 FROM steps  -- recursive member\n  WHERE n < 5\n)\nSELECT n FROM steps;\n```\nThe anchor runs once. Then the recursive member runs on the rows produced **by the previous step** only, again and again, until a step produces **no new row**.",
		},
		{
			kind: "example",
			title: "Counting down the stair",
			body: "Each step reads the previous row (n) and makes the next one (n + 1). At n = 5 the WHERE stops producing rows, and the recursion ends.",
			sql: "WITH RECURSIVE steps(n) AS (\n  SELECT 1\n  UNION ALL\n  SELECT n + 1 FROM steps WHERE n < 5\n)\nSELECT n FROM steps;",
		},
		{
			kind: "explain",
			title: "Trees hidden in a column",
			body: "A column that points at a row of the **same table** stores a tree:\n\n- `heroes.mentor_id`: who trained whom\n- `quests.prerequisite_quest_id`: what you must finish first\n- `skill_tree.parent_id`: which skill unlocks which\n\nA self join climbs **one** level. A recursive CTE climbs **as many as needed**: anchor on the starting row, then join the table to the previous step.",
		},
		{
			kind: "example",
			title: "Climbing a lineage",
			body: "Start at Eskil (hero 14), then repeatedly fetch the mentor of the previous hero. The `depth` column counts the steps up to Aldric, who has no mentor: there the join finds nothing, and the climb stops.",
			sql: "WITH RECURSIVE up AS (\n  SELECT id, name, mentor_id, 0 AS depth\n  FROM heroes WHERE id = 14\n  UNION ALL\n  SELECT h.id, h.name, h.mentor_id, up.depth + 1\n  FROM heroes h\n  JOIN up ON h.id = up.mentor_id\n)\nSELECT name, depth FROM up;",
		},
		{
			kind: "quiz",
			question: "What makes a recursive CTE stop?",
			choices: [
				"A step that produces no new rows",
				"The LIMIT of the final SELECT",
				"Postgres stops automatically after 100 steps",
				"UNION ALL notices it has seen a row before",
			],
			answerIndex: 0,
			explanation:
				"Recursion ends only when a step returns nothing. There is no built-in step limit, and UNION ALL never checks for repeats. In this app a query that never ends is killed by the watchdog, so always make sure your walk runs out of rows.",
		},
		{
			kind: "explain",
			title: "Walking down, keeping the trail",
			body: "To go **down** a tree, join on the other side: `h.mentor_id = d.id`. Carry extra columns along the way:\n```sql\nSELECT h.id, d.depth + 1, d.path || h.id\nFROM heroes h JOIN d ON h.mentor_id = d.id\n```\n`path` is an **array** of the ids visited so far (`ARRAY[1]` in the anchor). It tells you the route, and soon it will save you from loops.",
		},
		{
			kind: "explain",
			title: "Graphs bite back: cycles",
			body: "Portals go Highmoor → Mistwood → Highmoor → ... A walk on a graph with **cycles** never runs out of rows. Three guards:\n\n- path check: `WHERE NOT p.to_region = ANY (w.path)`\n- the `CYCLE` clause: `CYCLE region SET is_cycle USING route`, which marks the row that closes a loop and stops there\n- a depth limit: `WHERE w.hops < 10`\n\nNo guard, no end.",
		},
		{
			kind: "example",
			title: "The CYCLE clause at work",
			body: "Walk from Highmoor through every portal. `CYCLE region` remembers the regions of each route and flags the row where one comes back: those rows are not expanded further. The eight flagged rows are the eight ways back home.",
			sql: "WITH RECURSIVE walk(region) AS (\n  SELECT 'Highmoor'::text\n  UNION ALL\n  SELECT p.to_region\n  FROM walk w JOIN portals p ON p.from_region = w.region\n) CYCLE region SET is_cycle USING route\nSELECT region, is_cycle, route\nFROM walk\nWHERE is_cycle;",
		},
		{
			kind: "try",
			title: "Your turn: the road to the Ash Wyrm",
			prompt:
				"Quest 4 (Embers of the Ash Wyrm) requires another quest, which requires another... Return the **id** and **title** of **every quest required before quest 4**, directly or indirectly (quest 4 itself excluded).",
			starterSql:
				"SELECT id, title\nFROM quests\nWHERE id = (SELECT prerequisite_quest_id FROM quests WHERE id = 4);",
			solutionSql:
				"WITH RECURSIVE req AS (SELECT prerequisite_quest_id AS id FROM quests WHERE id = 4 UNION ALL SELECT q.prerequisite_quest_id FROM quests q JOIN req ON q.id = req.id WHERE q.prerequisite_quest_id IS NOT NULL) SELECT q.id, q.title FROM req JOIN quests q ON q.id = req.id;",
			check: { type: "result" },
			hints: [
				"The starter only climbs one step (quest 13). Ashen Pass has a prerequisite too.",
				"Anchor: the prerequisite of quest 4. Recursive member: the prerequisite of the previous quest, while it is not NULL. Then join the ids to quests for the titles.",
			],
		},
	],
	exercises: [
		{
			id: "ch14-ex01",
			title: "Counting stones",
			story:
				"The stair to the lower catacombs has ten steps, and the generate_series rune is broken.",
			prompt:
				"Return the numbers **1 to 10** in one column, using a **recursive CTE** (no generate_series).",
			difficulty: 1,
			kind: "query",
			concepts: ["recursive-cte"],
			solutionSql:
				"WITH RECURSIVE n(x) AS (\n  SELECT 1\n  UNION ALL\n  SELECT x + 1 FROM n WHERE x < 10\n)\nSELECT x FROM n;",
			check: { type: "result" },
			hints: [
				"Anchor: the first number. Recursive member: the next number from the previous one.",
				"Stop with a WHERE in the recursive member, so it produces nothing after 10.",
				"WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 10) SELECT x FROM n",
			],
			explanation:
				"The WHERE is the brake: when x reaches 10 the next step returns no row and the recursion stops.\n\n**Pitfall:** `WHERE x <= 10` lets one more step through and returns 11 too. Off-by-one errors love recursion.",
		},
		{
			id: "ch14-ex02",
			title: "Eskil's lineage",
			story:
				"Young Eskil Brightspear (hero 14) wants to know who trained his trainer, and so on up to the founder.",
			prompt:
				"Return the **name** and **depth** of Eskil and each of his ancestors in the mentor chain: Eskil at depth **0**, his mentor at depth **1**, and so on to the top.",
			difficulty: 2,
			kind: "query",
			concepts: ["recursive-cte"],
			solutionSql:
				"WITH RECURSIVE up AS (\n  SELECT id, name, mentor_id, 0 AS depth\n  FROM heroes WHERE id = 14\n  UNION ALL\n  SELECT h.id, h.name, h.mentor_id, up.depth + 1\n  FROM heroes h\n  JOIN up ON h.id = up.mentor_id\n)\nSELECT name, depth FROM up;",
			check: { type: "result" },
			hints: [
				"Anchor: hero 14 with depth 0.",
				"Each step fetches the hero whose id is the previous hero's mentor_id.",
				"... UNION ALL SELECT h.id, h.name, h.mentor_id, up.depth + 1 FROM heroes h JOIN up ON h.id = up.mentor_id",
			],
			explanation:
				"Eskil, Dagny, Cedric, Brynja, then Aldric at depth 4. Aldric's mentor_id is NULL, the join finds nobody, and the climb ends.\n\n**Pitfall:** `JOIN up ON h.mentor_id = up.id` walks **down** instead: Eskil has no apprentices, so you only get Eskil.",
		},
		{
			id: "ch14-ex03",
			title: "Aldric's legacy",
			story:
				"Aldric Stormborn (hero 1) trained a few heroes, who trained others in turn. He wants to see his whole legacy.",
			prompt:
				"Return the **name** and **depth** of every hero trained by Aldric **directly or indirectly** (his apprentices at depth **1**, theirs at depth **2**, ...). Aldric himself is **not** listed.",
			difficulty: 3,
			kind: "query",
			concepts: ["recursive-cte"],
			solutionSql:
				"WITH RECURSIVE down AS (\n  SELECT id, name, 0 AS depth\n  FROM heroes WHERE id = 1\n  UNION ALL\n  SELECT h.id, h.name, d.depth + 1\n  FROM heroes h\n  JOIN down d ON h.mentor_id = d.id\n)\nSELECT name, depth FROM down WHERE depth > 0;",
			check: { type: "result" },
			hints: [
				"Walk down: each step finds the heroes whose mentor is in the previous step.",
				"Start from Aldric at depth 0 and filter him out at the end, or start directly from his apprentices at depth 1.",
				"JOIN down d ON h.mentor_id = d.id ... SELECT name, depth FROM down WHERE depth > 0",
			],
			explanation:
				"Eleven heroes descend from Aldric, down to Eskil and Mabel at depth 4.\n\n**Pitfall:** anchoring on `WHERE mentor_id IS NULL` starts from **every** founder and wanderer, mixing Morwen's and Nyx's lines into Aldric's legacy.",
		},
		{
			id: "ch14-ex04",
			title: "The scroll that was too short",
			story:
				"The scribe writes skill paths like `Mage Arts > Fire Magic > Fireball`. To save ink he declared the path as `varchar(40)`, and now the spell refuses to run.",
			prompt:
				"Fix the query: return the **name** and full **path** of every skill of the **mage** tree, the path being the names from the root down to the skill, joined by ` > `.",
			difficulty: 3,
			kind: "query",
			concepts: ["recursive-cte"],
			starterSql:
				"WITH RECURSIVE tree AS (\n  SELECT id, name, name::varchar(40) AS path\n  FROM skill_tree\n  WHERE parent_id IS NULL AND class = 'mage'\n  UNION ALL\n  SELECT s.id, s.name, t.path || ' > ' || s.name\n  FROM skill_tree s\n  JOIN tree t ON s.parent_id = t.id\n)\nSELECT name, path FROM tree;",
			solutionSql:
				"WITH RECURSIVE tree AS (\n  SELECT id, name, name AS path\n  FROM skill_tree\n  WHERE parent_id IS NULL AND class = 'mage'\n  UNION ALL\n  SELECT s.id, s.name, t.path || ' > ' || s.name\n  FROM skill_tree s\n  JOIN tree t ON s.parent_id = t.id\n)\nSELECT name, path FROM tree;",
			check: { type: "result" },
			hints: [
				"Read the error: column 2 has type character varying(40) in the anchor but another type overall (42804).",
				"The anchor fixes the column types. The recursive member's `||` produces plain text, which does not match varchar(40).",
				"Drop the cast (`name AS path`) or cast to text: `name::text AS path`.",
			],
			explanation:
				"A recursive CTE's column types are decided by the anchor, and every step must produce exactly those types. Concatenation returns unbounded text, so a `varchar(40)` anchor cannot hold it.\n\n**Pitfall:** the same error appears when the anchor uses a literal or an `int` and the recursive member a `bigint` or `numeric`: cast the anchor to the type the recursion produces.",
		},
		{
			id: "ch14-ex05",
			title: "Doors that open",
			story:
				"Finishing *Rats in the Cellar* (quest 1) unlocks other quests, which unlock others. The quest master wants the whole cascade.",
			prompt:
				"Return the **id**, **title** and **steps** of every quest unlocked, directly or indirectly, by **quest 1** (steps = **1** for quests that require quest 1 itself, **2** for the next level...). Sort by **steps**, then by **id**.",
			difficulty: 2,
			kind: "query",
			concepts: ["recursive-cte"],
			solutionSql:
				"WITH RECURSIVE unlocked AS (\n  SELECT id, title, 1 AS steps\n  FROM quests WHERE prerequisite_quest_id = 1\n  UNION ALL\n  SELECT q.id, q.title, u.steps + 1\n  FROM quests q\n  JOIN unlocked u ON q.prerequisite_quest_id = u.id\n)\nSELECT id, title, steps FROM unlocked\nORDER BY steps, id;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Anchor: the quests whose prerequisite is quest 1.",
				"Recursive member: the quests whose prerequisite is a quest of the previous step.",
				"JOIN unlocked u ON q.prerequisite_quest_id = u.id, then ORDER BY steps, id",
			],
			explanation:
				"The Goblin Toll Bridge opens first, then the Siege of Highmoor Keep and the Bandit King. The tie at step 2 needs the id tie breaker.\n\n**Pitfall:** anchoring on quest 1 itself with steps 1 shifts every count by one.",
		},
		{
			id: "ch14-ex06",
			title: "The guard that guards nothing",
			story:
				"The scribe's portal walk from Highmoor once ran forever. He added a path guard, and now it never leaves home: it only returns Highmoor.",
			prompt:
				"Fix the query: return every **region** reachable from **Highmoor** through the portals, **Highmoor included**, each region **once**.",
			difficulty: 3,
			kind: "query",
			concepts: ["recursive-graph-walks"],
			starterSql:
				"WITH RECURSIVE walk(region, path) AS (\n  SELECT 'Highmoor'::text, ARRAY['Highmoor']\n  UNION ALL\n  SELECT p.to_region, w.path || p.to_region\n  FROM walk w\n  JOIN portals p ON p.from_region = w.region\n  WHERE NOT w.region = ANY (w.path)\n)\nSELECT DISTINCT region FROM walk;",
			solutionSql:
				"WITH RECURSIVE walk(region, path) AS (\n  SELECT 'Highmoor'::text, ARRAY['Highmoor']\n  UNION ALL\n  SELECT p.to_region, w.path || p.to_region\n  FROM walk w\n  JOIN portals p ON p.from_region = w.region\n  WHERE NOT p.to_region = ANY (w.path)\n)\nSELECT DISTINCT region FROM walk;",
			check: { type: "result" },
			hints: [
				"The current region is always in its own path. What does `NOT w.region = ANY (w.path)` therefore say?",
				"The guard must test the region you are about to **enter**, not the one you stand in.",
				"WHERE NOT p.to_region = ANY (w.path)",
			],
			explanation:
				"The guard refuses a step into a region already on the route, so every walk ends and every reachable region shows up. DISTINCT then lists each region once (Frostspire is reached by five different routes).\n\n**Pitfall:** without any guard the walk loops between Highmoor and Mistwood forever: in the app the watchdog kills it.\n\n**Alternative:** `CYCLE region SET is_cycle USING route`, or a plain `UNION` on a one-column CTE, which stops as soon as no new region appears.",
		},
		{
			id: "ch14-ex07",
			title: "The cheapest road north",
			story:
				"Morwen must reach Frostspire from Highmoor and pays every portal toll herself. She wants the cheapest route, not the shortest.",
			prompt:
				"Return **one value**: the **lowest total toll** to travel from **Highmoor** to **Frostspire** through the portals.",
			difficulty: 4,
			kind: "query",
			concepts: ["recursive-graph-walks"],
			solutionSql:
				"WITH RECURSIVE walk(region, path, cost) AS (\n  SELECT 'Highmoor'::text, ARRAY['Highmoor'], 0\n  UNION ALL\n  SELECT p.to_region, w.path || p.to_region, w.cost + p.toll\n  FROM walk w\n  JOIN portals p ON p.from_region = w.region\n  WHERE NOT p.to_region = ANY (w.path)\n)\nSELECT min(cost) AS toll\nFROM walk\nWHERE region = 'Frostspire';",
			check: { type: "result" },
			hints: [
				"Enumerate every loop-free route from Highmoor, carrying the total toll so far.",
				"Add `cost + p.toll` at each step and keep a path array as the cycle guard. Then look at the routes that end in Frostspire.",
				"... WHERE NOT p.to_region = ANY (w.path)) SELECT min(cost) FROM walk WHERE region = 'Frostspire'",
			],
			explanation:
				"Five loop-free routes reach Frostspire; the cheapest goes Highmoor → Mistwood → Saltmarsh → Frostspire for 10 + 8 + 30 = 48.\n\n**Pitfall:** the route with the fewest portals (Highmoor → Deepforge → Frostspire) costs 55. Fewest hops is not lowest cost.\n\n**Note:** enumerating every path is fine on a small map; on big graphs it explodes, and real route planners use smarter algorithms.",
		},
		{
			id: "ch14-ex08",
			title: "Whispers travel",
			story:
				"Finn (hero 8) loves gossip. Every rumor he tells is passed on by its listeners, who tell their own listeners. Some rumors come back to Finn himself.",
			prompt:
				"Return the **id** and **name** of every hero who eventually hears something that started with **hero 8**: follow `rumors` from teller to listener, as far as it goes. Hero 8 himself is **not** listed.",
			difficulty: 3,
			kind: "query",
			concepts: ["recursive-graph-walks"],
			solutionSql:
				"WITH RECURSIVE reach(id) AS (\n  SELECT listener_id FROM rumors WHERE teller_id = 8\n  UNION\n  SELECT r.listener_id\n  FROM rumors r\n  JOIN reach ON r.teller_id = reach.id\n)\nSELECT h.id, h.name\nFROM reach\nJOIN heroes h ON h.id = reach.id\nWHERE h.id <> 8;",
			check: { type: "result" },
			hints: [
				"Anchor: Finn's direct listeners. Recursive member: the listeners of the previous step's heroes.",
				"Rumors come back to Finn, so the walk has a cycle. With a one-column CTE, `UNION` (not ALL) stops when no new hero appears.",
				"WITH RECURSIVE reach(id) AS (SELECT listener_id FROM rumors WHERE teller_id = 8 UNION SELECT r.listener_id FROM rumors r JOIN reach ON r.teller_id = reach.id) ...",
			],
			explanation:
				"`UNION` in a recursive CTE discards rows already produced, so when Finn reappears he adds nothing new and the walk ends. Five heroes hear the gossip.\n\n**Pitfall:** `UNION ALL` here never stops: 8 → 10 → 28 → 8 → 10 ... forever.\n\n**Alternative:** UNION ALL with a path array and `NOT r.listener_id = ANY (path)`, then DISTINCT.",
		},
		{
			id: "ch14-ex09",
			title: "Boss: Depths of the Catacombs",
			story:
				"Aldric fears that some of his heirs have never earned their keep. He wants the names, how deep in his line they sit, and who was supposed to train them.",
			prompt:
				"Among **Aldric (hero 1) and every hero descending from him** through the mentor chain, return those who **never completed a quest**:\n\n1. **name**\n2. **depth** (Aldric 0, his apprentices 1, ...)\n3. the **name of their direct mentor**",
			difficulty: 5,
			kind: "query",
			concepts: ["recursive-cte", "anti-join", "cte-basics"],
			solutionSql:
				"WITH RECURSIVE lineage AS (\n  SELECT id, name, mentor_id, 0 AS depth\n  FROM heroes WHERE id = 1\n  UNION ALL\n  SELECT h.id, h.name, h.mentor_id, l.depth + 1\n  FROM heroes h\n  JOIN lineage l ON h.mentor_id = l.id\n)\nSELECT l.name, l.depth, m.name AS mentor\nFROM lineage l\nLEFT JOIN heroes m ON m.id = l.mentor_id\nWHERE NOT EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.hero_id = l.id);",
			check: { type: "result" },
			hints: [
				"Three steps: walk down from Aldric with depth, drop everyone who has a completion, then fetch the mentor's name.",
				"A recursive CTE for the lineage, NOT EXISTS against quest_completions, and a self join on heroes for the mentor (LEFT, since Aldric has none).",
				"WITH RECURSIVE lineage AS (SELECT id, name, mentor_id, 0 AS depth FROM heroes WHERE id = 1 UNION ALL ...) SELECT l.name, l.depth, m.name FROM lineage l LEFT JOIN heroes m ON m.id = l.mentor_id WHERE NOT EXISTS (...)",
			],
			explanation:
				"Tamsin (depth 3, trained by Hilde) and Mabel (depth 4, trained by Odo) have never finished a quest. The recursive CTE draws the family tree, the anti-join filters it, the self join names the mentors.\n\n**Pitfall:** anchoring on every hero without a mentor pulls in idle wanderers like lyra and Bors, who are no kin of Aldric.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch14-pr01",
			title: "Doubling runes",
			prompt:
				"Return every **power of 2** from **1** up to the largest one **below 1000**, using a recursive CTE.",
			difficulty: 1,
			kind: "query",
			concepts: ["recursive-cte"],
			solutionSql:
				"WITH RECURSIVE p(x) AS (\n  SELECT 1\n  UNION ALL\n  SELECT x * 2 FROM p WHERE x * 2 < 1000\n)\nSELECT x FROM p;",
			check: { type: "result" },
			hints: [
				"Start at 1, double at each step.",
				"Stop before producing a value of 1000 or more.",
				"SELECT x * 2 FROM p WHERE x * 2 < 1000",
			],
			explanation:
				"1, 2, 4, ... 512: ten rows. Testing `x < 1000` instead would let 1024 through, because the test runs on the previous value.",
		},
		{
			id: "ch14-pr02",
			title: "Branches of fire",
			prompt:
				"Return the **name** and **depth** of every skill below **Fire Magic** (skill 2) in the skill tree: its children at depth **1**, grandchildren at depth **2**. Fire Magic itself is not listed.",
			difficulty: 2,
			kind: "query",
			concepts: ["recursive-cte"],
			solutionSql:
				"WITH RECURSIVE sub AS (\n  SELECT id, name, 1 AS depth FROM skill_tree WHERE parent_id = 2\n  UNION ALL\n  SELECT s.id, s.name, sub.depth + 1\n  FROM skill_tree s JOIN sub ON s.parent_id = sub.id\n)\nSELECT name, depth FROM sub;",
			check: { type: "result" },
			hints: [
				"Anchor: the skills whose parent is 2, at depth 1.",
				"Then the children of the previous step.",
				"JOIN sub ON s.parent_id = sub.id",
			],
			explanation: "Fireball and Flame Shield at depth 1, Meteor at depth 2.",
		},
		{
			id: "ch14-pr03",
			title: "Mabel's roots",
			prompt:
				"Return the **name** and **depth** of **Mabel Crumb** (hero 30, depth **0**) and of each ancestor in her mentor chain.",
			difficulty: 2,
			kind: "query",
			concepts: ["recursive-cte"],
			solutionSql:
				"WITH RECURSIVE up AS (\n  SELECT id, name, mentor_id, 0 AS depth FROM heroes WHERE id = 30\n  UNION ALL\n  SELECT h.id, h.name, h.mentor_id, up.depth + 1\n  FROM heroes h JOIN up ON h.id = up.mentor_id\n)\nSELECT name, depth FROM up;",
			check: { type: "result" },
			hints: [
				"Same climb as Eskil's, from another hero.",
				"Join each step to the mentor of the previous hero.",
				"JOIN up ON h.id = up.mentor_id",
			],
			explanation: "Mabel, Odo, Hilde, Ælfric and Aldric: the cleric line of the Silver Dragon.",
		},
		{
			id: "ch14-pr04",
			title: "Out of the Shadowfell",
			prompt:
				"Return every **region** reachable from **Shadowfell** through the portals (Shadowfell itself excluded) and the **smallest number of portals** needed to get there.",
			difficulty: 3,
			kind: "query",
			concepts: ["recursive-graph-walks"],
			solutionSql:
				"WITH RECURSIVE walk(region, path, hops) AS (\n  SELECT 'Shadowfell'::text, ARRAY['Shadowfell'], 0\n  UNION ALL\n  SELECT p.to_region, w.path || p.to_region, w.hops + 1\n  FROM walk w JOIN portals p ON p.from_region = w.region\n  WHERE NOT p.to_region = ANY (w.path)\n)\nSELECT region, min(hops) AS hops\nFROM walk\nWHERE region <> 'Shadowfell'\nGROUP BY region;",
			check: { type: "result" },
			hints: [
				"Walk from Shadowfell with a hop counter and a cycle guard.",
				"Several routes reach the same region: keep the minimum per region.",
				"... SELECT region, min(hops) FROM walk WHERE region <> 'Shadowfell' GROUP BY region",
			],
			explanation:
				"Shadowfell has one way out (to Ashlands, 1 portal), and from there the whole realm opens up within 3 portals. Nothing ever leads back into Shadowfell.",
		},
		{
			id: "ch14-pr05",
			title: "Ways home",
			prompt:
				"How many different round trips leave **Highmoor** and come back to **Highmoor** without passing through any other region twice? Walk the portals with the **CYCLE** clause and return that **number**.",
			difficulty: 3,
			kind: "query",
			concepts: ["recursive-graph-walks"],
			solutionSql:
				"WITH RECURSIVE walk(region) AS (\n  SELECT 'Highmoor'::text\n  UNION ALL\n  SELECT p.to_region\n  FROM walk w JOIN portals p ON p.from_region = w.region\n) CYCLE region SET is_cycle USING route\nSELECT count(*) AS round_trips\nFROM walk\nWHERE is_cycle AND region = 'Highmoor';",
			check: { type: "result" },
			hints: [
				"`CYCLE region SET is_cycle USING route` goes right after the closing parenthesis of the CTE.",
				"A round trip is a row flagged as a cycle whose region is Highmoor.",
				"... ) CYCLE region SET is_cycle USING route SELECT count(*) FROM walk WHERE is_cycle AND region = 'Highmoor'",
			],
			explanation:
				"Eight round trips, from the short Highmoor → Mistwood → Highmoor to the grand tour through all six regions. The CYCLE clause stops each route on the row that repeats a region, so the walk always ends.",
		},
	],
};

export default chapter;
