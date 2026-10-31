import type { Chapter } from "../types";

// plan_json uses COSTS OFF (no estimates), so the estimate mission gets its own helper.
const ESTIMATED_ROWS = `CREATE FUNCTION estimated_rows(query text) RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE p json;
BEGIN
  EXECUTE 'EXPLAIN (FORMAT JSON) ' || query INTO p;
  RETURN (p -> 0 -> 'Plan' ->> 'Plan Rows')::numeric;
END $$;`;

const chapter: Chapter = {
	id: "ch37-reading-the-runes",
	order: 37,
	world: "The Clockwork Engine",
	tier: "adept",
	track: "performance",
	title: "Reading the Runes",
	subtitle: "EXPLAIN, plan nodes, estimates vs reality, and how tables get joined",
	emoji: "📖",
	datasetId: "dungeon",
	concepts: ["explain-basics", "explain-analyze", "scan-types", "join-algorithms"],
	prerequisites: ["ch18-the-grand-report", "ch28-cursed-designs"],
	lesson: [
		{
			kind: "explain",
			title: "The engine's runes",
			body: "Deep under the leaderboard ticks the Clockwork Engine, and `run_archive` (100 000 runs) is its heaviest gear. Before changing anything, read how a query runs:\n```sql\nEXPLAIN SELECT ...;\n```\nYou get the **plan**: a tree of nodes. Read it from the most indented line up: children feed their parent. Each node shows a **cost** (planner units, not milliseconds) and **rows**, an *estimate*.",
		},
		{
			kind: "example",
			title: "Your first rune",
			body: "One node: a **Seq Scan** reads every row and keeps those passing the **Filter**. The `rows=` estimate is close to 2900: the planner guesses from statistics, it has not counted anything.",
			sql: "EXPLAIN SELECT * FROM run_archive WHERE player_id = 7;",
		},
		{
			kind: "quiz",
			question:
				"A plan line says `Seq Scan on run_archive  (cost=0.00..3036.00 rows=2977 width=105)`. What does `0.00..3036.00` mean?",
			choices: [
				"The scan starts after 0 ms and finishes after 3036 ms",
				"The startup cost and the total cost, in the planner's own units",
				"Rows 0 to 3036 of the table are read",
				"3036 pages are read from disk",
			],
			answerIndex: 1,
			explanation:
				"Costs are abstract units (roughly: one sequential page read = 1). The first number is the cost before the first row comes out, the second the cost to return them all. They let the planner compare plans, they are not a stopwatch.",
		},
		{
			kind: "explain",
			title: "EXPLAIN ANALYZE: estimates meet reality",
			body: "`EXPLAIN ANALYZE` **runs** the query and adds what really happened: `actual rows`, `loops`, `Rows Removed by Filter`, and `Buffers` (8 kB pages touched).\n\nIn this browser engine timings are meaningless, so add `COSTS OFF, TIMING OFF` and trust rows and buffers.\n\nIt really runs: an `EXPLAIN ANALYZE DELETE` deletes. Wrap it in `BEGIN; ... ROLLBACK;`.",
		},
		{
			kind: "example",
			title: "Counting the southern runs",
			body: "The Seq Scan kept 10 000 rows and threw 90 000 away. Look at `Buffers: shared hit=1786`: to find 10% of the runs, the engine touched **every** page of the table.",
			sql: "EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)\nSELECT count(*) FROM run_archive WHERE region = 'sa';",
		},
		{
			kind: "explain",
			title: "Four ways to read a table",
			body: "- **Seq Scan**: every page, in order.\n- **Index Scan**: walk an index, then fetch each matching row.\n- **Index Only Scan**: the index alone answers.\n- **Bitmap Index Scan** + **Bitmap Heap Scan**: collect matches from an index first, then read their pages in order.\n\nThe helper `plan_nodes('<query>')` returns the node types as an array; `(plan_nodes('...'))[1]` is the top node.",
		},
		{
			kind: "example",
			title: "Three queries, three scans",
			body: "Surprise in the middle column: asking only for `id` lets the primary key index answer alone, an **Index Only Scan** you never asked for. Quotes inside the helper's text are doubled, as in any string.",
			sql: "SELECT plan_nodes('SELECT * FROM run_archive WHERE id = 7') AS by_key,\n       plan_nodes('SELECT id FROM run_archive WHERE id < 100') AS keys_only,\n       plan_nodes('SELECT * FROM run_archive WHERE score > 100') AS everything;",
		},
		{
			kind: "explain",
			title: "How two tables meet",
			body: "Three join algorithms:\n- **Nested Loop**: for each outer row, look up matches in the inner side. Great when the outer side is small and the inner side has an index.\n- **Hash Join**: build a hash table on the smaller input, stream the other. Great for big unsorted inputs.\n- **Merge Join**: walk two inputs already sorted on the key, like zipping two sorted lists.",
		},
		{
			kind: "quiz",
			question:
				"A plan shows a **Nested Loop**: 50 outer rows, and for each one a **Seq Scan** of all 100 000 archived runs. What is the real problem?",
			choices: [
				"Nested loops are always slow: force a hash join",
				"The inner side has no index on the join key, so it reads 5 million rows",
				"50 outer rows are too many for any join",
				"Nothing: Seq Scans are always the fastest",
			],
			answerIndex: 1,
			explanation:
				"A nested loop is the best join when each inner lookup is cheap, which means an index on the inner join key. With a Seq Scan inside, every loop rereads the table: 50 x 100 000 rows. Fix the inner side, don't blame the loop.",
		},
		{
			kind: "try",
			title: "Your turn: read a range",
			prompt:
				"Return the node types of the plan of `SELECT * FROM run_archive WHERE id BETWEEN 10 AND 20`, using `plan_nodes`.",
			starterSql: "SELECT plan_nodes('SELECT * FROM run_archive');",
			solutionSql:
				"SELECT plan_nodes('SELECT * FROM run_archive WHERE id BETWEEN 10 AND 20');",
			check: { type: "result" },
			hints: [
				"Put the whole query, WHERE clause included, inside the quotes.",
				"SELECT plan_nodes('SELECT * FROM run_archive WHERE id BETWEEN 10 AND 20');",
			],
		},
	],
	exercises: [
		{
			id: "ch37-ex01",
			title: "The first rune",
			story:
				"The season commissioner hands you a dusty plan scroll: \"Before you touch the Engine, tell me how it hunts the Sunken Crypt runs.\"",
			prompt:
				"Run `EXPLAIN` on `SELECT * FROM run_archive WHERE dungeon_id = 2`, then answer with **one row, one column**: the node type at the top of the plan, as text (for example `SELECT 'Hash Join';`).",
			difficulty: 1,
			kind: "query",
			concepts: ["explain-basics"],
			starterSql: "EXPLAIN SELECT * FROM run_archive WHERE dungeon_id = 2;",
			solutionSql: "SELECT 'Seq Scan';",
			check: { type: "result" },
			hints: [
				"Run the starter and look at the first words of the first line.",
				"The node type is the name before `on run_archive`, without the table name or the costs.",
				"Replace the starter with SELECT '...'; holding those two words.",
			],
			explanation:
				"Without an index on `dungeon_id`, the only way is a **Seq Scan** with a Filter: read all 100 000 rows, keep about 20 000.\n\n**Pitfall:** a Seq Scan is not a bug in itself. Reading a fifth of a table sequentially can beat jumping around an index. The plan tells you what happens, not whether it is bad.\n\n**Alternative:** `SELECT (plan_nodes('SELECT * FROM run_archive WHERE dungeon_id = 2'))[1];` reads the same rune with the helper.",
		},
		{
			id: "ch37-ex02",
			title: "The planner's guess",
			story:
				"The anti-cheat bot wants to know how many southern runs the Engine *expects* before it reads a single page.",
			prompt:
				"Run `EXPLAIN SELECT * FROM run_archive WHERE region = 'sa'` and answer with **one number**: the planner's **estimated** row count (the `rows=` value of the scan).",
			difficulty: 2,
			kind: "query",
			concepts: ["explain-basics"],
			setupSql: ESTIMATED_ROWS,
			starterSql: "EXPLAIN SELECT * FROM run_archive WHERE region = 'sa';",
			solutionSql: "SELECT estimated_rows('SELECT * FROM run_archive WHERE region = ''sa''');",
			check: { type: "result" },
			hints: [
				"The estimate sits inside the parentheses of the plan line.",
				"Not the cost, not the width: the number after `rows=`.",
				"Answer with SELECT <that number>; (it is an estimate, so it is rarely a round 10000). The mission's helper estimated_rows('<query>') can read it for you.",
			],
			explanation:
				"The planner never counts before planning: it multiplies the table size by the frequency of `'sa'` stored in the statistics gathered by `ANALYZE`. That sample is random, so the guess lands close to the true 10 000 without hitting it.\n\n**Pitfall:** answering with `count(*)` gives the truth, not the guess. Comparing the two is exactly what EXPLAIN ANALYZE is for.\n\n**Alternative:** this mission's helper `estimated_rows('<query>')` runs `EXPLAIN (FORMAT JSON)` and returns its `Plan Rows` field.",
		},
		{
			id: "ch37-ex03",
			title: "What really happened",
			story: "The commissioner wants facts, not guesses, about the runs still in progress.",
			prompt:
				"Use `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)` on `SELECT * FROM run_archive WHERE status = 'in_progress'`, then answer with one row: the scan's **actual rows** and its **Rows Removed by Filter**, in that order.",
			difficulty: 2,
			kind: "query",
			concepts: ["explain-analyze"],
			starterSql:
				"EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)\nSELECT * FROM run_archive WHERE status = 'in_progress';",
			solutionSql: "SELECT 2000, 98000;",
			check: { type: "result" },
			hints: [
				"Run the starter: the scan line shows `actual rows=...`.",
				"The line under the Filter tells how many rows were read and thrown away.",
				"SELECT <actual rows>, <rows removed>;",
			],
			explanation:
				"2 000 rows kept, 98 000 read for nothing: 98% wasted work. That ratio is the first thing to look for in an EXPLAIN ANALYZE, and the reason Index Forging (next chapter) exists.\n\n**Pitfall:** `rows=` in plain EXPLAIN is only the estimate. Only ANALYZE shows `actual rows`.",
		},
		{
			id: "ch37-ex04",
			title: "The rune that ate the archive",
			story:
				"An apprentice wanted to see how the Engine deletes abandoned runs. He ran the starter... and 10 000 runs vanished from the archive. Reset, then do it safely.",
			prompt:
				"Fix the starter so the commissioner still gets the **real execution numbers** of the DELETE (EXPLAIN **ANALYZE**), but the abandoned runs **survive**.",
			difficulty: 3,
			kind: "transaction",
			concepts: ["explain-analyze"],
			starterSql: "EXPLAIN ANALYZE DELETE FROM run_archive WHERE status = 'abandoned';",
			solutionSql:
				"BEGIN;\nEXPLAIN ANALYZE DELETE FROM run_archive WHERE status = 'abandoned';\nROLLBACK;",
			check: {
				type: "state",
				verifySql:
					"SELECT pg_stat_force_next_flush();\nSELECT (SELECT count(*) FROM run_archive WHERE status = 'abandoned') AS abandoned_left,\n       n_tup_del >= 10000 AS delete_really_ran\nFROM pg_stat_user_tables WHERE relname = 'run_archive';",
			},
			hints: [
				"EXPLAIN ANALYZE does not simulate: it executes the DELETE.",
				"Open a transaction before, and undo it after.",
				"BEGIN; then the EXPLAIN ANALYZE DELETE ...; then ROLLBACK;",
			],
			explanation:
				"Inside `BEGIN ... ROLLBACK` the DELETE runs for real (so the numbers are real), then the rollback undoes it. The statistics counter `n_tup_del` still remembers 10 000 deleted rows: that is how this check knows the plan ran.\n\n**Pitfall:** plain `EXPLAIN DELETE` is safe but shows only estimates; `EXPLAIN ANALYZE DELETE` without a transaction is a real DELETE.\n\n**Alternative:** `START TRANSACTION` and `ABORT` are synonyms.",
		},
		{
			id: "ch37-ex05",
			title: "Three keys, three doors",
			story: "The Engine has three ways into the archive. Predict which one each query takes.",
			prompt:
				"Answer with one row of three text columns: the scan node type the planner picks for\n\n1. `SELECT * FROM run_archive WHERE id = 42`\n2. `SELECT id FROM run_archive WHERE id < 100`\n3. `SELECT * FROM run_archive WHERE score > 5000`",
			difficulty: 2,
			kind: "query",
			concepts: ["scan-types"],
			starterSql: "SELECT 'Index Scan', 'Index Scan', 'Index Scan';",
			solutionSql:
				"SELECT (plan_nodes('SELECT * FROM run_archive WHERE id = 42'))[1],\n       (plan_nodes('SELECT id FROM run_archive WHERE id < 100'))[1],\n       (plan_nodes('SELECT * FROM run_archive WHERE score > 5000'))[1];",
			check: { type: "result" },
			hints: [
				"Only `id` has an index (the primary key). Check each query with plan_nodes.",
				"When every column the query needs is inside the index, the table can be skipped.",
				"Use (plan_nodes('...'))[1] for each, or type the three names you found.",
			],
			explanation:
				"`id = 42` walks the primary key then fetches the row (**Index Scan**). `SELECT id ... id < 100` needs nothing but the key, so the index answers alone (**Index Only Scan**). `score` has no index at all: **Seq Scan**.\n\n**Pitfall:** \"an index exists, so it is used\". An index only helps a query that filters or sorts on its columns.",
		},
		{
			id: "ch37-ex06",
			title: "Two bitmaps, one answer",
			story:
				"The previous engineer forged one index on `player_id` and another on `dungeon_id`. Watch what the planner does with both.",
			prompt:
				"Look at the plan of `SELECT * FROM run_archive WHERE player_id = 20 AND dungeon_id = 3`. Answer with one row: the **name of the node that combines the two bitmaps** (text), and the **number of Bitmap Index Scan nodes** in the plan.",
			difficulty: 2,
			kind: "query",
			concepts: ["scan-types"],
			setupSql:
				"CREATE INDEX run_archive_player_idx ON run_archive (player_id);\nCREATE INDEX run_archive_dungeon_idx ON run_archive (dungeon_id);",
			solutionSql: "SELECT 'BitmapAnd', 2;",
			check: { type: "result" },
			hints: [
				"SELECT plan_nodes('SELECT * FROM run_archive WHERE player_id = 20 AND dungeon_id = 3');",
				"Each index produces a bitmap of matching rows; a node between them combines the two.",
				"SELECT '<that node>', <how many Bitmap Index Scan>;",
			],
			explanation:
				"Each Bitmap Index Scan marks the pages holding matches; **BitmapAnd** keeps the pages present in both bitmaps; the Bitmap Heap Scan then reads only those pages. With `OR`, the node is a BitmapOr.\n\n**Pitfall:** believing two single-column indexes equal one index on both columns. It works, but both indexes are scanned in full for their value. Next chapter forges the better key.",
		},
		{
			id: "ch37-ex07",
			title: "Three handshakes",
			story:
				"The archive keeper indexed `run_archive(player_id)`. Now the Engine has a choice for every join.",
			prompt:
				"Answer with one row of three text columns: the **join node** the planner picks for\n\n1. `SELECT r.id, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id`\n2. the same query with `WHERE p.id = 7` added\n3. `SELECT r.id, a.score FROM runs r JOIN run_archive a ON a.id = r.id`",
			difficulty: 3,
			kind: "query",
			concepts: ["join-algorithms"],
			setupSql: "CREATE INDEX run_archive_player_idx ON run_archive (player_id);",
			starterSql: "SELECT 'Nested Loop', 'Nested Loop', 'Nested Loop';",
			solutionSql:
				"SELECT (plan_nodes('SELECT r.id, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id'))[1],\n       (plan_nodes('SELECT r.id, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id WHERE p.id = 7'))[1],\n       (plan_nodes('SELECT r.id, a.score FROM runs r JOIN run_archive a ON a.id = r.id'))[1];",
			check: { type: "result" },
			hints: [
				"Check each query with plan_nodes: the join is the top node.",
				"All runs: big unsorted input. One player: few outer rows and an index inside. Live runs by id: both sides can come out sorted.",
				"(plan_nodes('...'))[1] for each, or the three names you read.",
			],
			explanation:
				"All 100 000 runs: build a hash of 25 players, stream the archive (**Hash Join**). One player: one outer row, one index lookup (**Nested Loop**). The 50 live runs by id: the archive's primary key already delivers ids in order, so the planner sorts 50 rows and zips the two lists (**Merge Join**).\n\n**Pitfall:** \"Hash Join is the fast one\". Each algorithm wins in its own situation; the planner picks by estimated rows.",
		},
		{
			id: "ch37-ex08",
			title: "Boss: The Rune Reader",
			story:
				"The commissioner drops four rune scrolls on your desk. \"Before the Engine is overhauled, I want a report on every one of them, in one query.\"",
			prompt:
				"The starter lists four labelled queries. Return one row per query with:\n\n- **label**;\n- **top_node**: the node type at the top of its plan;\n- **join_node**: `Nested Loop`, `Hash Join` or `Merge Join` if the plan contains one, else NULL;\n- **uses_index**: true when any node of the plan has `Index` in its name.\n\nAn index on `run_archive(player_id)` already exists.",
			difficulty: 4,
			kind: "query",
			concepts: ["explain-basics", "scan-types", "join-algorithms"],
			setupSql: "CREATE INDEX run_archive_player_idx ON run_archive (player_id);",
			starterSql:
				"WITH runes(label, query) AS (VALUES\n  ('vault key',    'SELECT * FROM run_archive WHERE id = 4242'),\n  ('eu crowd',     'SELECT * FROM run_archive WHERE region = ''eu'''),\n  ('owl hunt',     'SELECT p.handle, r.score FROM players p JOIN run_archive r ON r.player_id = p.id WHERE p.id = 1'),\n  ('grand census', 'SELECT d.name, count(*) FROM dungeons d JOIN run_archive r ON r.dungeon_id = d.id GROUP BY d.name')\n)\nSELECT label, plan_nodes(query)\nFROM runes;",
			solutionSql:
				"WITH runes(label, query) AS (VALUES\n  ('vault key',    'SELECT * FROM run_archive WHERE id = 4242'),\n  ('eu crowd',     'SELECT * FROM run_archive WHERE region = ''eu'''),\n  ('owl hunt',     'SELECT p.handle, r.score FROM players p JOIN run_archive r ON r.player_id = p.id WHERE p.id = 1'),\n  ('grand census', 'SELECT d.name, count(*) FROM dungeons d JOIN run_archive r ON r.dungeon_id = d.id GROUP BY d.name')\n), plans AS (\n  SELECT label, plan_nodes(query) AS nodes FROM runes\n)\nSELECT label,\n       nodes[1] AS top_node,\n       CASE WHEN 'Nested Loop' = ANY (nodes) THEN 'Nested Loop'\n            WHEN 'Hash Join' = ANY (nodes) THEN 'Hash Join'\n            WHEN 'Merge Join' = ANY (nodes) THEN 'Merge Join'\n       END AS join_node,\n       array_to_string(nodes, ',') LIKE '%Index%' AS uses_index\nFROM plans;",
			check: { type: "result" },
			hints: [
				"Compute plan_nodes once per query in a CTE, then read the array in the outer SELECT.",
				"`nodes[1]` is the top node; `'Hash Join' = ANY (nodes)` tests membership; a CASE picks the join.",
				"For uses_index, glue the array into text with array_to_string(nodes, ',') and test LIKE '%Index%'.",
			],
			explanation:
				"The vault key is one Index Scan; the eu crowd (60% of runs) is a Seq Scan with no index at all; the owl hunt is a Nested Loop whose inner side uses the player index through a bitmap; the grand census aggregates a Hash Join of two Seq Scans. Reading these four shapes at a glance is the whole skill of this chapter.\n\n**Pitfall:** `nodes[2]` or a LIKE on `'%Join%'` alone misses the Nested Loop, whose name has no *Join*.\n\n**Alternative:** `EXISTS (SELECT 1 FROM unnest(nodes) n WHERE n LIKE '%Index%')` for uses_index.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch37-pr01",
			title: "A small guess",
			prompt:
				"Answer with one number: the **estimated rows** in the plan of `SELECT * FROM players`.",
			difficulty: 1,
			kind: "query",
			concepts: ["explain-basics"],
			solutionSql: "SELECT 25;",
			check: { type: "result" },
			hints: [
				"EXPLAIN SELECT * FROM players;",
				"Look for rows= in the scan line.",
				"SELECT <that number>;",
			],
			explanation:
				"25: on a small table ANALYZE reads every row, so the estimate is exact. On `run_archive` it samples, and the guesses get fuzzy.",
		},
		{
			id: "ch37-pr02",
			title: "Who sits on top",
			prompt:
				"Answer with the node type at the **top** of the plan of `SELECT count(*) FROM run_archive`, as text.",
			difficulty: 1,
			kind: "query",
			concepts: ["explain-basics"],
			solutionSql: "SELECT 'Aggregate';",
			check: { type: "result" },
			hints: [
				"EXPLAIN SELECT count(*) FROM run_archive;",
				"The least indented line is the top node; the scan feeds it.",
				"SELECT '<top node name>';",
			],
			explanation:
				"The Seq Scan produces 100 000 rows, the **Aggregate** above it eats them and returns one. Plans read bottom up: data flows from the leaves to the root.",
		},
		{
			id: "ch37-pr03",
			title: "The lazy merge",
			prompt:
				"Run `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT r.id, a.score FROM runs r JOIN run_archive a ON a.id = r.id;` and answer with one number: the **actual rows** produced by the Index Scan on `run_archive`.",
			difficulty: 2,
			kind: "query",
			concepts: ["explain-analyze", "join-algorithms"],
			solutionSql: "SELECT 51;",
			check: { type: "result" },
			hints: [
				"Find the line `Index Scan using run_archive_pkey on run_archive a`.",
				"Read its `actual rows=` value, not the one of the Merge Join.",
				"SELECT <that number>;",
			],
			explanation:
				"Only 51 of 100 000 rows! A Merge Join stops reading the archive as soon as it passes the largest id of the 50 live runs. Actual rows reveal work the estimates never show.",
		},
		{
			id: "ch37-pr04",
			title: "Pages for one key",
			prompt:
				"Run `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT * FROM run_archive WHERE id = 42;` and answer with the number of **shared hit** buffers of the Index Scan.",
			difficulty: 2,
			kind: "query",
			concepts: ["explain-analyze"],
			solutionSql: "SELECT 3;",
			check: { type: "result" },
			hints: [
				"Look under the Index Scan line for `Buffers:`.",
				"Take the number after `shared hit=` on the Index Scan, not the planning buffers.",
				"SELECT <that number>;",
			],
			explanation:
				"3 pages: the root of the B-tree, one leaf, and the table page holding the row. A Seq Scan for the same row touches 1786. Buffers are this world's stopwatch: they do not depend on the machine.",
		},
		{
			id: "ch37-pr05",
			title: "Crowds and corners",
			prompt:
				"An index on `run_archive(region)` exists. Answer with one row of two text columns: the **top node** of the plan of `SELECT * FROM run_archive WHERE region = 'eu'`, then of the same query with `region = 'sa'`.",
			difficulty: 2,
			kind: "query",
			concepts: ["scan-types"],
			setupSql: "CREATE INDEX run_archive_region_idx ON run_archive (region);",
			solutionSql:
				"SELECT (plan_nodes('SELECT * FROM run_archive WHERE region = ''eu'''))[1],\n       (plan_nodes('SELECT * FROM run_archive WHERE region = ''sa'''))[1];",
			check: { type: "result" },
			hints: [
				"About 60% of runs are eu, 10% are sa.",
				"Use plan_nodes on both queries.",
				"(plan_nodes('SELECT * FROM run_archive WHERE region = ''eu'''))[1], and the same for 'sa'.",
			],
			explanation:
				"`eu`: Seq Scan, because reading 60% of the rows through an index costs more than reading the table. `sa`: Bitmap Heap Scan, the index pays off for 10%. Same index, two verdicts: selectivity decides.",
		},
		{
			id: "ch37-pr06",
			title: "Forbidden handshakes",
			prompt:
				"Run `SET enable_hashjoin = off;` and `SET enable_nestloop = off;`, then answer with the **top node** of the plan of `SELECT r.id, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id`, as text.",
			difficulty: 2,
			kind: "query",
			concepts: ["join-algorithms"],
			solutionSql:
				"SET enable_hashjoin = off;\nSET enable_nestloop = off;\nSELECT (plan_nodes('SELECT r.id, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id'))[1];",
			check: { type: "result" },
			hints: [
				"With two of the three algorithms disabled, only one remains.",
				"Both inputs need sorting first: look for Sort nodes under it.",
				"(plan_nodes('SELECT r.id, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id'))[1]",
			],
			explanation:
				"**Merge Join**, with a Sort of 100 000 runs underneath: the price of zipping inputs that are not already ordered. `enable_*` settings are a lab tool for comparing plans, never a production fix.",
		},
		{
			id: "ch37-pr07",
			title: "One owl, one loop",
			prompt:
				"An index on `run_archive(player_id)` exists. Answer with the **top node** of the plan of `SELECT p.handle, r.score FROM players p JOIN run_archive r ON r.player_id = p.id WHERE p.handle = 'Lua'`, as text.",
			difficulty: 2,
			kind: "query",
			concepts: ["join-algorithms"],
			setupSql: "CREATE INDEX run_archive_player_idx ON run_archive (player_id);",
			solutionSql:
				"SELECT (plan_nodes('SELECT p.handle, r.score FROM players p JOIN run_archive r ON r.player_id = p.id WHERE p.handle = ''Lua'''))[1];",
			check: { type: "result" },
			hints: [
				"One player on the outer side, an index on the inner join key.",
				"That is the textbook case for one of the three algorithms.",
				"(plan_nodes('...'))[1] with the quotes around Lua doubled.",
			],
			explanation:
				"**Nested Loop**: one outer row (Lua), one index lookup for her runs. Drop the `player_id` index and the same query becomes a Hash Join over the whole archive.",
		},
	],
};

export default chapter;
