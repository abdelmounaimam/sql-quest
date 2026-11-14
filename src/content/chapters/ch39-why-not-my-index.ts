import type { Chapter } from "../types";

const ESTIMATED_ROWS = `CREATE FUNCTION estimated_rows(query text) RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE p json;
BEGIN
  EXECUTE 'EXPLAIN (FORMAT JSON) ' || query INTO p;
  RETURN (p -> 0 -> 'Plan' ->> 'Plan Rows')::numeric;
END $$;`;

// A copy analyzed while it held only eu runs, then flooded with na runs.
// Under 30 000 rows, so ANALYZE reads every row and the estimates are exact.
const STALE_COPY = `${ESTIMATED_ROWS}
CREATE TABLE run_copy AS SELECT * FROM run_archive WHERE id <= 10000 AND region = 'eu';
ANALYZE run_copy;
INSERT INTO run_copy SELECT * FROM run_archive WHERE region = 'na';`;

const BOSS_STARTER = `SELECT 'march' AS label,
       (SELECT count(*) FROM run_archive
        WHERE extract(year FROM started_at) = 2025 AND extract(month FROM started_at) = 3) AS runs,
       plan_nodes('SELECT count(*) FROM run_archive WHERE extract(year FROM started_at) = 2025 AND extract(month FROM started_at) = 3') AS plan
UNION ALL
SELECT 'legends',
       (SELECT count(*) FROM run_archive WHERE score / 2 >= 2600),
       plan_nodes('SELECT count(*) FROM run_archive WHERE score / 2 >= 2600')
UNION ALL
SELECT 'owl twenty',
       (WITH all_runs AS MATERIALIZED (SELECT * FROM run_archive)
        SELECT count(*) FROM all_runs WHERE player_id = 20),
       plan_nodes('WITH all_runs AS MATERIALIZED (SELECT * FROM run_archive) SELECT count(*) FROM all_runs WHERE player_id = 20');`;

const BOSS_SOLUTION = `SELECT 'march' AS label,
       (SELECT count(*) FROM run_archive
        WHERE started_at >= '2025-03-01' AND started_at < '2025-04-01') AS runs,
       plan_nodes('SELECT count(*) FROM run_archive WHERE started_at >= ''2025-03-01'' AND started_at < ''2025-04-01''') AS plan
UNION ALL
SELECT 'legends',
       (SELECT count(*) FROM run_archive WHERE score >= 5200),
       plan_nodes('SELECT count(*) FROM run_archive WHERE score >= 5200')
UNION ALL
SELECT 'owl twenty',
       (SELECT count(*) FROM run_archive WHERE player_id = 20),
       plan_nodes('SELECT count(*) FROM run_archive WHERE player_id = 20');`;


const chapter: Chapter = {
	id: "ch39-why-not-my-index",
	order: 39,
	world: "The Clockwork Engine",
	tier: "expert",
	track: "performance",
	title: "Why Not My Index?",
	subtitle: "Sargable predicates, selectivity, pg_stats and ANALYZE, query rewrites, CTE materialization",
	emoji: "🧐",
	datasetId: "dungeon",
	concepts: ["sargability", "index-selection-reasons", "statistics", "query-rewriting", "cte-materialization"],
	prerequisites: ["ch38-index-forging"],
	lesson: [
		{
			kind: "explain",
			title: "Sargable predicates",
			body: "An index on `started_at` stores raw timestamps. With `WHERE started_at::date = '2025-06-01'`, Postgres must compute the cast for **every** row before comparing: the index cannot help.\n\nA predicate the index can serve is **sargable** (Search ARGument ABLE). Move the work to the constant side:\n```sql\nWHERE started_at >= '2025-06-01'\n  AND started_at <  '2025-06-02'\n```\nThe same problem applies to `score + 0 = 42` and `lower(region) = 'sa'`.",
		},
		{
			kind: "example",
			title: "Same result, two plans",
			body: "Both count the 288 rows of June 1st. The cast reads the whole table; the half-open range is answered by the index alone.",
			sql: "CREATE INDEX run_archive_started_idx ON run_archive (started_at);\nSELECT plan_nodes('SELECT count(*) FROM run_archive WHERE started_at::date = ''2025-06-01''') AS hidden,\n       plan_nodes('SELECT count(*) FROM run_archive WHERE started_at >= ''2025-06-01'' AND started_at < ''2025-06-02''') AS bare;",
		},
		{
			kind: "quiz",
			question:
				"You index `run_archive(region)`. `WHERE region = 'sa'` uses it, but `WHERE region = 'eu'` stays a Seq Scan. Why?",
			choices: [
				"The index is corrupt for eu: rebuild it",
				"60% of the runs are eu: reading the table in order is cheaper than jumping through the index",
				"Indexes only work on rare values by design",
				"The planner forgot the index: SET enable_seqscan = off to fix it",
			],
			answerIndex: 1,
			explanation:
				"The planner compares costs. Fetching 60 000 rows through an index means touching nearly every page anyway, in random order, so a Seq Scan is cheaper. Forcing the index with `enable_seqscan = off` makes the query slower, not faster.",
		},
		{
			kind: "explain",
			title: "Common reasons an index is not used",
			body: "When an index is not used, check:\n- **Selectivity**: too many rows match.\n- **Small table**: one page beats any index.\n- **Stale statistics**: the planner relies on old numbers.\n- **Type mismatch**: `seed = 3007215346.0` compares a bigint to a numeric, so the column gets converted.\n- **Operator**: a B-tree cannot serve `<>` or `LIKE '%Golem'`.\n- **Not sargable**: a function or arithmetic on the column.",
		},
		{
			kind: "explain",
			title: "Planner statistics",
			body: "`ANALYZE` samples each table and stores, per column, in `pg_stats`:\n- `n_distinct` (negative = a fraction of the rows, -1 = all different),\n- `most_common_vals` and their frequencies,\n- `histogram_bounds` for ranges,\n- `correlation`: how closely the physical order follows the column (1 = perfectly).\n\nNo autovacuum runs here, so after a large load you call `ANALYZE` yourself. `CREATE STATISTICS` describes correlated columns to the planner.",
		},
		{
			kind: "example",
			title: "Reading pg_stats",
			body: "`started_at` has correlation 1: rows are stored in time order (which is why BRIN works). `region` has 4 distinct values; its correlation is low, the regions are mixed on disk.",
			sql: "SELECT attname, n_distinct, round(correlation::numeric, 2) AS correlation,\n       most_common_vals\nFROM pg_stats\nWHERE tablename = 'run_archive'\n  AND attname IN ('region', 'status', 'started_at', 'player_id')\nORDER BY attname;",
		},
		{
			kind: "explain",
			title: "Rewriting queries",
			body: "The planner rewrites a lot by itself, but not everything:\n- `EXISTS` instead of `JOIN` + `DISTINCT` stops at the first match.\n- **Pre-aggregate** the large table, then join the small one.\n- A correlated subquery in SELECT is a hidden loop: one inner query per outer row.\n- Remove a `DISTINCT` or `ORDER BY` that is not needed.\n\nRule: compare the plans (and buffers) of both versions, never guess.",
		},
		{
			kind: "explain",
			title: "CTE materialization",
			body: "Since PostgreSQL 12, a CTE used once is **inlined**: the planner merges it into the main query, and outer filters reach the indexes inside.\n\n`WITH c AS MATERIALIZED (...)` forces the old behaviour: compute the CTE fully first, then filter its output. Useful to stop an expensive expression from running twice; harmful when it hides an index.",
		},
		{
			kind: "example",
			title: "Inlined vs materialized CTE",
			body: "Same lookup by id. Inlined: one Index Scan on the primary key. Materialized: the whole table is scanned into the CTE, then searched.",
			sql: "SELECT plan_nodes('WITH c AS (SELECT * FROM run_archive) SELECT * FROM c WHERE id = 5') AS inlined,\n       plan_nodes('WITH c AS MATERIALIZED (SELECT * FROM run_archive) SELECT * FROM c WHERE id = 5') AS fenced;",
		},
		{
			kind: "try",
			title: "Try it: remove arithmetic on a key",
			prompt:
				"The query inside the starter adds 1 to the indexed `id`. Rewrite that query text, with the same meaning, so the plan uses the primary key, and return its `plan_nodes`.",
			starterSql: "SELECT plan_nodes('SELECT * FROM run_archive WHERE id + 1 = 4243');",
			solutionSql: "SELECT plan_nodes('SELECT * FROM run_archive WHERE id = 4242');",
			check: { type: "result" },
			hints: [
				"Move the arithmetic to the constant: id + 1 = 4243 means id = ...",
				"SELECT plan_nodes('SELECT * FROM run_archive WHERE id = 4242');",
			],
		},
	],
	exercises: [
		{
			id: "ch39-ex01",
			title: "Replace a cast with a range",
			prompt:
				"An index on `started_at` exists. Return one row: the **number of runs started on 2025-06-01** (UTC), and the **plan_nodes of the counting query you used**, passed as text. Your counting query must let the index on `started_at` do the work.",
			difficulty: 2,
			kind: "query",
			concepts: ["sargability"],
			setupSql: "CREATE INDEX run_archive_started_idx ON run_archive (started_at);",
			starterSql:
				"SELECT count(*),\n       plan_nodes('SELECT count(*) FROM run_archive WHERE started_at::date = ''2025-06-01''')\nFROM run_archive\nWHERE started_at::date = '2025-06-01';",
			solutionSql:
				"SELECT count(*),\n       plan_nodes('SELECT count(*) FROM run_archive WHERE started_at >= ''2025-06-01'' AND started_at < ''2025-06-02''')\nFROM run_archive\nWHERE started_at >= '2025-06-01' AND started_at < '2025-06-02';",
			check: { type: "result" },
			hints: [
				"Run the starter: the count is right, the plan is a Seq Scan.",
				"Replace the cast with a half-open range on the bare column, in both places.",
				"started_at >= '2025-06-01' AND started_at < '2025-06-02' (quotes doubled inside plan_nodes).",
			],
			explanation:
				"The range keeps `started_at` bare, so the B-tree jumps to June 1st and counts 288 entries without touching the table (Index Only Scan).\n\n**Pitfall:** `BETWEEN '2025-06-01' AND '2025-06-02'` is sargable but includes midnight of June 2nd: a run starting exactly then would be counted on two days. Half-open ranges (`>=` and `<`) never overlap.\n\n**Alternative:** an expression index on `((started_at AT TIME ZONE 'UTC')::date)` serves a date comparison written with the same expression.",
		},
		{
			id: "ch39-ex02",
			title: "Fix a literal type mismatch",
			prompt:
				"An index on `seed` exists, but the query inside the starter writes the seed as `3007215346.0`. Fix the query text (same row) so the plan uses the index on `seed`, and return its `plan_nodes`.",
			difficulty: 2,
			kind: "query",
			concepts: ["index-selection-reasons"],
			setupSql: "CREATE INDEX run_archive_seed_idx ON run_archive (seed);",
			starterSql: "SELECT plan_nodes('SELECT id FROM run_archive WHERE seed = 3007215346.0');",
			solutionSql: "SELECT plan_nodes('SELECT id FROM run_archive WHERE seed = 3007215346');",
			check: { type: "result" },
			hints: [
				"`seed` is a bigint. What type is `3007215346.0`?",
				"Comparing bigint with numeric converts the column to numeric, and the bigint index no longer matches.",
				"Write the seed as an integer literal: seed = 3007215346.",
			],
			explanation:
				"`3007215346.0` is a numeric, so PostgreSQL compares `seed::numeric` with it: an expression on the column, which the bigint B-tree cannot serve. An integer literal (or `3007215346::bigint`) keeps the column bare.\n\n**Pitfall:** this often hides in application code that sends numbers as floats or as strings of the wrong type.",
		},
		{
			id: "ch39-ex03",
			title: "Explain three Seq Scan choices",
			prompt:
				"An index on `run_archive(status)` exists. Answer with one row of three text columns: the **top node** of the plan of\n\n1. `SELECT * FROM run_archive WHERE status = 'finished'`\n2. `SELECT * FROM run_archive WHERE status = 'in_progress'`\n3. `SELECT * FROM players WHERE id = 3`",
			difficulty: 2,
			kind: "query",
			concepts: ["index-selection-reasons"],
			setupSql: "CREATE INDEX run_archive_status_idx ON run_archive (status);",
			starterSql: "SELECT 'Bitmap Heap Scan', 'Bitmap Heap Scan', 'Index Scan';",
			solutionSql:
				"SELECT (plan_nodes('SELECT * FROM run_archive WHERE status = ''finished'''))[1],\n       (plan_nodes('SELECT * FROM run_archive WHERE status = ''in_progress'''))[1],\n       (plan_nodes('SELECT * FROM players WHERE id = 3'))[1];",
			check: { type: "result" },
			hints: [
				"88% of rows are finished, 2% in progress; `players` fits in a single page.",
				"Check each with (plan_nodes('...'))[1].",
				"Two of the three are Seq Scans, for two different reasons.",
			],
			explanation:
				"`finished` matches 88% of the table: a Seq Scan is cheaper. `in_progress` (2%) uses the index through a bitmap. `players` has 25 rows on one page: reading that page is cheaper than walking the primary key.\n\n**Pitfall:** treating every Seq Scan as a missing index. First ask how many rows and pages the query really needs.",
		},
		{
			id: "ch39-ex04",
			title: "Read column statistics from pg_stats",
			prompt:
				"Return **attname**, **n_distinct** and **correlation rounded to 2 decimals** from `pg_stats` for the `run_archive` columns `region`, `started_at` and `status`, sorted by attname A to Z.",
			difficulty: 2,
			kind: "query",
			concepts: ["statistics"],
			solutionSql:
				"SELECT attname, n_distinct, round(correlation::numeric, 2)\nFROM pg_stats\nWHERE tablename = 'run_archive' AND attname IN ('region', 'started_at', 'status')\nORDER BY attname;",
			check: { type: "result", orderMatters: true },
			hints: [
				"pg_stats has one row per table and column.",
				"Filter on tablename and attname; correlation is a real, cast it to numeric to round it.",
				"round(correlation::numeric, 2) ... WHERE tablename = 'run_archive' AND attname IN (...) ORDER BY attname",
			],
			explanation:
				"`n_distinct` = 4 for region, 3 for status, and -1 for started_at (every value distinct). `started_at` correlates perfectly with the physical order (1.00): that is why BRIN and range scans on it are so cheap.\n\n**Pitfall:** these numbers come from a random sample, refreshed only by ANALYZE. On a busy real table they drift until the next ANALYZE.",
		},
		{
			id: "ch39-ex05",
			title: "Refresh stale statistics",
			prompt:
				"`run_copy` was analyzed while it held only eu rows, then 15 000 na rows were inserted, so the planner estimates about **one** na row. Refresh the planner's statistics for `run_copy` so that its estimate for `SELECT * FROM run_copy WHERE region = 'na'` becomes right. (The helper `estimated_rows('<query>')` returns the planner's estimate.)",
			difficulty: 3,
			kind: "ddl",
			concepts: ["statistics"],
			setupSql: STALE_COPY,
			starterSql: "SELECT estimated_rows('SELECT * FROM run_copy WHERE region = ''na''');",
			solutionSql: "ANALYZE run_copy;",
			check: {
				type: "state",
				verifySql:
					"SELECT estimated_rows('SELECT * FROM run_copy WHERE region = ''na''') AS na_estimate,\n       (SELECT most_common_vals::text FROM pg_stats WHERE tablename = 'run_copy' AND attname = 'region') AS common_regions;",
			},
			hints: [
				"Run the starter: 1 row expected, 15 000 present. The statistics describe the table before the insert.",
				"Nothing refreshes statistics automatically in this sandbox.",
				"ANALYZE run_copy;",
			],
			explanation:
				"`ANALYZE` resamples the table: `na` enters `most_common_vals` with its true frequency and the estimate jumps from 1 to 15 000. With the old numbers the planner could pick a nested loop or an index scan for \"one row\".\n\n**Pitfall:** `VACUUM run_copy` alone refreshes the row count but not the column statistics: the estimate stays wrong. `VACUUM ANALYZE` does both.",
		},
		{
			id: "ch39-ex06",
			title: "Replace a correlated subquery with a join",
			prompt:
				"The starter computes each player's best archived score with a correlated subquery: one scan of `run_archive` per player. Return every player's **handle**, their **best** archived score and their number of archived **runs**, in **one grouped query** over a join (no subquery per player). Players without archived runs show NULL and 0.",
			difficulty: 3,
			kind: "query",
			concepts: ["query-rewriting"],
			starterSql:
				"SELECT p.handle,\n       (SELECT max(score) FROM run_archive r WHERE r.player_id = p.id) AS best\nFROM players p;",
			solutionSql:
				"SELECT p.handle, max(r.score) AS best, count(r.id) AS runs\nFROM players p\nLEFT JOIN run_archive r ON r.player_id = p.id\nGROUP BY p.id, p.handle;",
			check: { type: "result" },
			hints: [
				"Join players to run_archive once, then group by player.",
				"Keep players without runs: LEFT JOIN, and count a column of the right side.",
				"LEFT JOIN run_archive r ON r.player_id = p.id GROUP BY p.id, p.handle with max(r.score), count(r.id)",
			],
			explanation:
				"One Hash Join and one aggregation read the table once, instead of 25 full scans for the correlated version (no index on `player_id`). Same answers, 25 times less work.\n\n**Pitfall:** `count(*)` gives newbie_42 one run (the NULL row of the LEFT JOIN), and an inner JOIN drops newbie_42 entirely.\n\n**Alternative:** pre-aggregate first, `LEFT JOIN (SELECT player_id, max(score), count(*) FROM run_archive GROUP BY player_id) a`, with `coalesce(a.runs, 0)`.",
		},
		{
			id: "ch39-ex07",
			title: "Remove a MATERIALIZED fence",
			prompt:
				"The query inside the starter wraps `run_archive` in a `MATERIALIZED` CTE, so a lookup by id reads 100 000 rows. Fix the query text, keeping the CTE `c`, so the filter on `id` reaches the primary key, and return its `plan_nodes`.",
			difficulty: 3,
			kind: "query",
			concepts: ["cte-materialization"],
			starterSql:
				"SELECT plan_nodes('WITH c AS MATERIALIZED (SELECT * FROM run_archive) SELECT * FROM c WHERE id = 5');",
			solutionSql:
				"SELECT plan_nodes('WITH c AS (SELECT * FROM run_archive) SELECT * FROM c WHERE id = 5');",
			check: { type: "result" },
			hints: [
				"Run the starter: CTE Scan over a Seq Scan.",
				"Since PostgreSQL 12 a CTE used once is inlined, unless you prevent it.",
				"Remove the word MATERIALIZED (or write NOT MATERIALIZED).",
			],
			explanation:
				"Without the keyword, the planner inlines `c` and pushes `id = 5` down to the table: one Index Scan.\n\n**Pitfall:** following the pre-12 rule that \"CTEs are optimization fences\" and adding MATERIALIZED everywhere. Keep it for the rare case where computing once really helps.\n\n**Alternative:** `AS NOT MATERIALIZED` states the inlining explicitly, even for a CTE referenced twice.",
		},
		{
			id: "ch39-ex08",
			title: "Boss: The Lazy Index Inquiry",
			story:
				"Combines sargable date ranges, removing arithmetic on a column and dropping a CTE fence, with proof from plan_nodes.",
			prompt:
				"Three indexes exist on `run_archive`: `started_at`, `score` and `player_id`. The starter runs three slow counts. Rewrite each one so its index can do the work, **without changing its count**, and return one row per count: **label**, **runs** (the count) and **plan** (`plan_nodes` of your rewritten counting query).\n\n- `march`: runs started in March 2025;\n- `legends`: runs with `score / 2 >= 2600` (integer division);\n- `owl twenty`: runs of player 20, currently behind a MATERIALIZED CTE.",
			difficulty: 5,
			kind: "query",
			concepts: ["sargability", "index-selection-reasons", "cte-materialization"],
			setupSql:
				"CREATE INDEX run_archive_started_idx ON run_archive (started_at);\nCREATE INDEX run_archive_score_idx ON run_archive (score);\nCREATE INDEX run_archive_player_idx ON run_archive (player_id);",
			starterSql: BOSS_STARTER,
			solutionSql: BOSS_SOLUTION,
			check: { type: "result" },
			hints: [
				"Run the starter: three Seq Scans. Each one hides its column differently.",
				"March is a half-open timestamp range; `score / 2 >= 2600` with integer division means score of at least 5200; the CTE needs no fence at all.",
				"started_at >= '2025-03-01' AND started_at < '2025-04-01'; score >= 5200; SELECT count(*) FROM run_archive WHERE player_id = 20.",
			],
			explanation:
				"Each rewrite exposes the bare column to its index: the March range becomes an Index Only Scan, `legends` a bitmap over 326 entries, player 20 a bitmap over 2 896 entries. Same counts, a fraction of the pages.\n\n**Pitfall:** `score >= 5201` for `legends`: with integer division, 5200 / 2 is already 2600. Check the boundary on both versions.\n\n**Alternative:** `NOT MATERIALIZED` instead of dropping the CTE gives the same plan.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch39-pr01",
			title: "Remove a useless function call",
			prompt:
				"An index on `run_archive(region)` exists. Region codes are always stored in lower case. Rewrite the text `SELECT id FROM run_archive WHERE lower(region) = 'sa'` so the index is used, and return its `plan_nodes`.",
			difficulty: 1,
			kind: "query",
			concepts: ["sargability"],
			setupSql: "CREATE INDEX run_archive_region_idx ON run_archive (region);",
			starterSql: "SELECT plan_nodes('SELECT id FROM run_archive WHERE lower(region) = ''sa''');",
			solutionSql: "SELECT plan_nodes('SELECT id FROM run_archive WHERE region = ''sa''');",
			check: { type: "result" },
			hints: [
				"The function hides the column.",
				"The data is already lower case: the function is useless here.",
				"WHERE region = 'sa' (quotes doubled inside plan_nodes).",
			],
			explanation:
				"`lower()` changes nothing on lowercase data but prevents the index from being used. Drop it, or if the data is mixed case, index `lower(region)`.",
		},
		{
			id: "ch39-pr02",
			title: "Sargable month range",
			prompt:
				"An index on `started_at` exists. Return one row: the **number of runs started in March 2025** and the **plan_nodes of your counting query**, written with a sargable range instead of `date_trunc('month', started_at) = '2025-03-01'`.",
			difficulty: 2,
			kind: "query",
			concepts: ["sargability"],
			setupSql: "CREATE INDEX run_archive_started_idx ON run_archive (started_at);",
			solutionSql:
				"SELECT count(*),\n       plan_nodes('SELECT count(*) FROM run_archive WHERE started_at >= ''2025-03-01'' AND started_at < ''2025-04-01''')\nFROM run_archive\nWHERE started_at >= '2025-03-01' AND started_at < '2025-04-01';",
			check: { type: "result" },
			hints: [
				"First day included, first day of the next month excluded.",
				"Use the same range in the count and in the plan_nodes text.",
				"started_at >= '2025-03-01' AND started_at < '2025-04-01'",
			],
			explanation:
				"8 928 rows, answered by an Index Only Scan. `date_trunc` on the column would force a Seq Scan.",
		},
		{
			id: "ch39-pr03",
			title: "LIKE prefix vs suffix",
			prompt:
				"An index on `death_cause` exists. Answer with one row of two text columns: the **top node** of `SELECT id FROM run_archive WHERE death_cause LIKE '%Golem'`, then of `... LIKE 'Lava%'`.",
			difficulty: 2,
			kind: "query",
			concepts: ["index-selection-reasons"],
			setupSql: "CREATE INDEX run_archive_death_idx ON run_archive (death_cause);",
			solutionSql:
				"SELECT (plan_nodes('SELECT id FROM run_archive WHERE death_cause LIKE ''%Golem'''))[1],\n       (plan_nodes('SELECT id FROM run_archive WHERE death_cause LIKE ''Lava%'''))[1];",
			check: { type: "result" },
			hints: [
				"A B-tree is sorted from the first character.",
				"A known prefix is a range in that order; a known suffix is not.",
				"Check both with (plan_nodes('...'))[1].",
			],
			explanation:
				"`'Lava%'` becomes the range `>= 'Lava' AND < 'Lavb'` (possible because this database uses the C collation). `'%Golem'` could start with anything: Seq Scan. Suffix and infix search need a trigram index (World 9).",
		},
		{
			id: "ch39-pr04",
			title: "Inequality and B-trees",
			prompt:
				"An index on `status` exists. Answer with one row of two text columns: the **top node** of `SELECT id FROM run_archive WHERE status = 'in_progress'`, then of `SELECT id FROM run_archive WHERE status <> 'finished'`.",
			difficulty: 2,
			kind: "query",
			concepts: ["index-selection-reasons"],
			setupSql: "CREATE INDEX run_archive_status_idx ON run_archive (status);",
			solutionSql:
				"SELECT (plan_nodes('SELECT id FROM run_archive WHERE status = ''in_progress'''))[1],\n       (plan_nodes('SELECT id FROM run_archive WHERE status <> ''finished'''))[1];",
			check: { type: "result" },
			hints: [
				"`<>` matches 12% of the rows, but can a B-tree jump to \"everything except\"?",
				"Check both with plan_nodes.",
				"(plan_nodes('...'))[1] for each.",
			],
			explanation:
				"A B-tree serves `=`, `<`, `>` and ranges. `<>` is not one of its operators, so even at 12% the query stays a Seq Scan. Rewrite as `status IN ('abandoned', 'in_progress')` to let the index be considered.",
		},
		{
			id: "ch39-pr05",
			title: "Create dependency statistics",
			prompt:
				"Score is about 210 points per floor, but the planner treats `score` and `floor_reached` as independent. Create **dependency statistics** on these two columns of `run_archive`, then gather them.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["statistics"],
			solutionSql:
				"CREATE STATISTICS run_archive_score_floor (dependencies) ON score, floor_reached FROM run_archive;\nANALYZE run_archive;",
			check: {
				type: "state",
				verifySql:
					"SELECT count(*) AS gathered FROM pg_stats_ext WHERE tablename = 'run_archive' AND dependencies IS NOT NULL;",
			},
			hints: [
				"Extended statistics are declared with CREATE STATISTICS.",
				"They stay empty until the next ANALYZE.",
				"CREATE STATISTICS ... (dependencies) ON score, floor_reached FROM run_archive; then ANALYZE run_archive;",
			],
			explanation:
				"Without them the planner multiplies the selectivities of `floor_reached = 20` and `score >= 4200` as if they were independent, and underestimates. Declared dependencies fix that, but only once ANALYZE fills them.",
		},
		{
			id: "ch39-pr06",
			title: "Read n_distinct",
			prompt:
				"Return **attname** and **n_distinct** from `pg_stats` for the `run_archive` columns `dungeon_id`, `player_id` and `season_id`.",
			difficulty: 1,
			kind: "query",
			concepts: ["statistics"],
			solutionSql:
				"SELECT attname, n_distinct FROM pg_stats\nWHERE tablename = 'run_archive' AND attname IN ('dungeon_id', 'player_id', 'season_id');",
			check: { type: "result" },
			hints: [
				"pg_stats, one row per column.",
				"Filter on tablename and attname.",
				"WHERE tablename = 'run_archive' AND attname IN ('dungeon_id', 'player_id', 'season_id')",
			],
			explanation:
				"5 dungeons, 24 players, 3 seasons. Positive values are counts; a negative value would mean \"this fraction of the rows\".",
		},
		{
			id: "ch39-pr07",
			title: "Replace JOIN with EXISTS",
			prompt:
				"Return the **handle** of every player with at least one archived run in dungeon 5 scoring **5200 or more**, each player once.",
			difficulty: 2,
			kind: "query",
			concepts: ["query-rewriting"],
			starterSql:
				"SELECT p.handle\nFROM players p\nJOIN run_archive r ON r.player_id = p.id\nWHERE r.dungeon_id = 5 AND r.score >= 5200;",
			solutionSql:
				"SELECT p.handle FROM players p\nWHERE EXISTS (SELECT 1 FROM run_archive r WHERE r.player_id = p.id AND r.dungeon_id = 5 AND r.score >= 5200);",
			check: { type: "result" },
			hints: [
				"Run the starter: 65 rows for 19 players.",
				"You only need to know that a matching run exists.",
				"WHERE EXISTS (SELECT 1 FROM run_archive r WHERE r.player_id = p.id AND ...)",
			],
			explanation:
				"EXISTS stops at the first matching row per player and never duplicates. JOIN + DISTINCT builds all 65 pairs, then discards 46.",
		},
		{
			id: "ch39-pr08",
			title: "Pre-aggregate before joining",
			prompt:
				"Return every dungeon's **name** and its number of archived runs tagged `cursed` (0 when none), by aggregating `run_archive` first and joining `dungeons` after.",
			difficulty: 2,
			kind: "query",
			concepts: ["query-rewriting"],
			solutionSql:
				"SELECT d.name, coalesce(c.cursed, 0) AS cursed\nFROM dungeons d\nLEFT JOIN (SELECT dungeon_id, count(*) AS cursed FROM run_archive WHERE 'cursed' = ANY (tags) GROUP BY dungeon_id) c\n  ON c.dungeon_id = d.id;",
			check: { type: "result" },
			hints: [
				"Count cursed runs per dungeon_id in a derived table.",
				"Then LEFT JOIN dungeons to it and turn missing counts into 0.",
				"LEFT JOIN (SELECT dungeon_id, count(*) ... WHERE tags @> '{cursed}' GROUP BY dungeon_id) c, coalesce(c.cursed, 0)",
			],
			explanation:
				"Pre-aggregating shrinks 100 000 rows to at most 5 before the join. On larger joins this ordering often makes the difference between a fast and a slow query.",
		},
		{
			id: "ch39-pr09",
			title: "Compare inlined and materialized plans",
			prompt:
				"Answer with one row of two columns: the `plan_nodes` of `WITH c AS (SELECT * FROM run_archive) SELECT * FROM c WHERE id = 7` and of the same query with `AS MATERIALIZED`.",
			difficulty: 2,
			kind: "query",
			concepts: ["cte-materialization"],
			solutionSql:
				"SELECT plan_nodes('WITH c AS (SELECT * FROM run_archive) SELECT * FROM c WHERE id = 7'),\n       plan_nodes('WITH c AS MATERIALIZED (SELECT * FROM run_archive) SELECT * FROM c WHERE id = 7');",
			check: { type: "result" },
			hints: [
				"Two calls to plan_nodes in one SELECT.",
				"Only the keyword MATERIALIZED differs.",
				"plan_nodes('WITH c AS (...) ...'), plan_nodes('WITH c AS MATERIALIZED (...) ...')",
			],
			explanation:
				"Inlined: `{Index Scan}`. Materialized: a CTE Scan over a full Seq Scan. One keyword, 1786 pages of difference.",
		},
	],
};

export default chapter;
