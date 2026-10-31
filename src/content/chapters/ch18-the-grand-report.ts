import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch18-the-grand-report",
	order: 18,
	world: "The Observatory",
	tier: "expert",
	track: "query",
	title: "The Grand Report",
	subtitle: "Subtotals, pivots, medians, correlations and \"who did them all\"",
	emoji: "📊",
	datasetId: "dungeon",
	concepts: [
		"grouping-sets",
		"pivoting",
		"statistical-aggregates",
		"ordered-set-aggregates",
		"relational-division",
		"random-sampling",
	],
	prerequisites: ["ch16-champions-of-each-dungeon", "ch12-exists-or-not"],
	lesson: [
		{
			kind: "explain",
			title: "Many levels in one pass",
			body: "End of season: the commissioner wants **the Grand Report**. Reports want several levels at once: per region and dungeon, per region, and a grand total.\n\n`GROUP BY ROLLUP (a, b)` computes the groups `(a, b)`, then `(a)`, then `()` in one query. The rolled up column shows **NULL** on subtotal rows.\n\n`CUBE (a, b)` adds every combination, `GROUPING SETS ((a), (b), ())` lists exactly the ones you want.",
		},
		{
			kind: "example",
			title: "Runs per region, with a total",
			body: "Look at the bottom: **two** rows have a NULL region. One is the grand total (50 runs). The other is Hollow, who plays without a region (1 run). The `lvl` column tells them apart.",
			sql: "SELECT p.region, count(*) AS runs, sum(r.score) AS total,\n       GROUPING(p.region) AS lvl\nFROM runs r\nJOIN players p ON p.id = r.player_id\nGROUP BY ROLLUP (p.region)\nORDER BY p.region;",
		},
		{
			kind: "quiz",
			question:
				"A ROLLUP output has two rows with region NULL. How do you know which one is the subtotal?",
			choices: [
				"The subtotal is always the last row",
				"`region IS NULL` is only true on the subtotal",
				"`GROUPING(region)` is 1 on the subtotal and 0 on a real NULL",
				"You cannot: use COALESCE(region, 'total') and hope",
			],
			answerIndex: 2,
			explanation:
				"`GROUPING(col)` returns 1 when the row aggregates over that column (a subtotal) and 0 when the NULL is real data. Row order is not guaranteed without ORDER BY, and COALESCE would relabel Hollow's real NULL as a total.",
		},
		{
			kind: "explain",
			title: "Pivot: rows become columns",
			body: "SQL has no PIVOT keyword in PostgreSQL. Write one aggregate per output column, each with its own FILTER:\n```sql\nSELECT dungeon_id,\n  count(*) FILTER (WHERE season_id = 1) AS s1,\n  count(*) FILTER (WHERE season_id = 2) AS s2\nFROM runs GROUP BY dungeon_id;\n```\n`sum(CASE WHEN ... THEN 1 ELSE 0 END)` works anywhere. The `tablefunc` extension also offers `crosstab()`, but you must declare its output columns yourself.",
		},
		{
			kind: "example",
			title: "Dungeons by season",
			body: "Five dungeons, four season columns. The Abyssal Spire opened in season 3: its first two cells show **0**, because `count` over no rows is 0.",
			sql: "SELECT dungeon_id,\n       count(*) FILTER (WHERE season_id = 1) AS s1,\n       count(*) FILTER (WHERE season_id = 2) AS s2,\n       count(*) FILTER (WHERE season_id = 3) AS s3,\n       count(*) FILTER (WHERE season_id = 4) AS s4\nFROM runs\nGROUP BY dungeon_id\nORDER BY dungeon_id;",
		},
		{
			kind: "explain",
			title: "Medians are not averages",
			body: "There is no `median()`. Ordered set aggregates sort the values first, with **WITHIN GROUP**:\n\n- `percentile_cont(0.5) WITHIN GROUP (ORDER BY score)`: the median, **interpolated** between two values if needed;\n- `percentile_disc(0.9) ...`: the first real value at or above 90%;\n- `mode() WITHIN GROUP (ORDER BY dungeon_id)`: the most common value.",
		},
		{
			kind: "example",
			title: "Describing the scores",
			body: "The average (2581.6) and the median (2400) disagree: a few huge Spire runs pull the mean up. `stddev_samp` treats the runs as a sample (divides by n - 1), `stddev_pop` as the whole population. `corr` near 1 says score and floor rise together, not that one *causes* the other.",
			sql: "SELECT avg(score) AS mean,\n       percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,\n       percentile_cont(0.9) WITHIN GROUP (ORDER BY score) AS p90,\n       percentile_disc(0.9) WITHIN GROUP (ORDER BY score) AS p90_disc,\n       round(stddev_samp(score), 1) AS sd_samp,\n       round(stddev_pop(score), 1) AS sd_pop,\n       round(corr(score, floor_reached)::numeric, 3) AS r\nFROM runs;",
		},
		{
			kind: "explain",
			title: "Who did them ALL?",
			body: "*Players who hold every gold badge* is **relational division**. Two classic recipes:\n\n1. **Count match**: keep the player's gold badges and require `count(DISTINCT achievement_id) = (SELECT count(*) FROM achievements WHERE tier = 'gold')`.\n2. **Double NOT EXISTS**: there is no gold badge that the player does not hold.\n\nOnly gold badges may be counted, or a player with three bronze badges sneaks in.",
		},
		{
			kind: "explain",
			title: "Random, but reproducible",
			body: "- `ORDER BY random() LIMIT 5` picks 5 random rows, but sorts the whole table first.\n- `TABLESAMPLE BERNOULLI (1)` keeps each row with probability 1%; `SYSTEM (1)` keeps whole pages (faster, clumpier).\n- `REPEATABLE (42)` fixes the sample; `SELECT setseed(0.42);` fixes `random()` for the rest of the session.\n\nWithout a seed, two runs (or the judge and you) see different rows.",
		},
		{
			kind: "try",
			title: "Your turn: seasons and a total",
			prompt:
				"Return **season_id** and **runs** (number of runs) for each season, plus **one grand total row** (season_id NULL) for all runs.",
			starterSql: "SELECT season_id, count(*) AS runs\nFROM runs\nGROUP BY season_id;",
			solutionSql: "SELECT season_id, count(*) AS runs FROM runs GROUP BY ROLLUP (season_id);",
			check: { type: "result" },
			hints: [
				"Run the starter: 4 rows, the total is missing.",
				"Wrap the grouping column in ROLLUP (...).",
			],
		},
	],
	exercises: [
		{
			id: "ch18-ex01",
			title: "The regional ledger",
			story: "The commissioner opens the report with the regions: how many runs, how many points, and the whole arcade at the bottom.",
			prompt:
				"Return **region** (of the player), **runs** and **total_score** for each player region, **plus one grand total row** for all runs. Hollow's unknown region forms its own group with a NULL region.",
			difficulty: 2,
			kind: "query",
			concepts: ["grouping-sets"],
			starterSql:
				"SELECT p.region, count(*) AS runs, sum(r.score) AS total_score\nFROM runs r\nJOIN players p ON p.id = r.player_id\nGROUP BY p.region;",
			solutionSql:
				"SELECT p.region, count(*) AS runs, sum(r.score) AS total_score FROM runs r JOIN players p ON p.id = r.player_id GROUP BY ROLLUP (p.region);",
			check: { type: "result" },
			hints: [
				"Run the starter: one row per region, but no total.",
				"ROLLUP adds the grand total level to the grouping.",
				"GROUP BY ROLLUP (p.region)",
			],
			explanation:
				"`ROLLUP (p.region)` computes the groups `(region)` and `()`: 5 region rows (Hollow's NULL included) and the 50 run total.\n\n**Pitfall:** a UNION ALL with a separate total query works, but scans the runs twice and is easy to get out of sync.\n\n**Alternative:** `GROUPING SETS ((p.region), ())` or `CUBE (p.region)` give the same rows for a single column.",
		},
		{
			id: "ch18-ex02",
			title: "Fix: the phantom subtotal",
			story:
				"The report labels subtotals with `(all)`, but Hollow's single run in the Spider Queen's Lair now shows up as if it were a total for all regions.",
			prompt:
				"For `ROLLUP (region, dungeon name)` over runs, return **region**, **dungeon** (the dungeon name) and **runs**. Show `'(all)'` **only on subtotal rows** (in region and in dungeon); a **real NULL region** (Hollow) must stay **NULL**.",
			difficulty: 4,
			kind: "query",
			concepts: ["grouping-sets"],
			starterSql:
				"SELECT coalesce(p.region, '(all)') AS region,\n       coalesce(d.name, '(all)') AS dungeon,\n       count(*) AS runs\nFROM runs r\nJOIN players p ON p.id = r.player_id\nJOIN dungeons d ON d.id = r.dungeon_id\nGROUP BY ROLLUP (p.region, d.name);",
			solutionSql:
				"SELECT CASE WHEN GROUPING(p.region) = 1 THEN '(all)' ELSE p.region END AS region,\n       CASE WHEN GROUPING(d.name) = 1 THEN '(all)' ELSE d.name END AS dungeon,\n       count(*) AS runs\nFROM runs r\nJOIN players p ON p.id = r.player_id\nJOIN dungeons d ON d.id = r.dungeon_id\nGROUP BY ROLLUP (p.region, d.name);",
			check: { type: "result" },
			hints: [
				"Run the starter and look for Spider Queen's Lair under region '(all)': that is Hollow.",
				"COALESCE cannot tell a real NULL from a subtotal. GROUPING(col) can.",
				"CASE WHEN GROUPING(p.region) = 1 THEN '(all)' ELSE p.region END",
			],
			explanation:
				"`GROUPING(p.region)` is 1 only on rows where the region was rolled up; Hollow's rows have 0 and keep their NULL. The same test on the dungeon labels the region subtotals.\n\n**Pitfall:** `coalesce(region, '(all)')` relabels real NULLs and creates a phantom `(all) / Spider Queen's Lair` row.\n\n**Alternative:** `GROUPING(p.region, d.name)` returns a bitmask (0, 1 or 3 here) that identifies the level in one number.",
		},
		{
			id: "ch18-ex03",
			title: "The season grid",
			story: "The board in the arcade lobby shows one line per dungeon and one column per season.",
			prompt:
				"Return one row per dungeon: **dungeon_id**, then **s1**, **s2**, **s3** and **s4**, the number of runs of that dungeon in seasons 1 to 4 (**0** when there are none).",
			difficulty: 3,
			kind: "query",
			concepts: ["pivoting"],
			starterSql:
				"SELECT dungeon_id, season_id, count(*) AS runs\nFROM runs\nGROUP BY dungeon_id, season_id;",
			solutionSql:
				"SELECT dungeon_id,\n       count(*) FILTER (WHERE season_id = 1) AS s1,\n       count(*) FILTER (WHERE season_id = 2) AS s2,\n       count(*) FILTER (WHERE season_id = 3) AS s3,\n       count(*) FILTER (WHERE season_id = 4) AS s4\nFROM runs\nGROUP BY dungeon_id;",
			check: { type: "result" },
			hints: [
				"Run the starter: the right numbers, in the wrong shape (one row per pair).",
				"Group by dungeon only, and write one count per season column.",
				"count(*) FILTER (WHERE season_id = 1) AS s1, ... GROUP BY dungeon_id",
			],
			explanation:
				"Each FILTER restricts its count to one season, so a single pass fills the whole grid, zeros included.\n\n**Pitfall:** `crosstab` would show NULL instead of 0 for the empty cells (Spire in seasons 1 and 2), and plain `count(*)` without FILTER repeats the dungeon total in every column.\n\n**Alternative:** `sum(CASE WHEN season_id = 1 THEN 1 ELSE 0 END)` is the portable spelling.",
		},
		{
			id: "ch18-ex04",
			title: "The middle of the pack",
			story:
				"The commissioner suspects the average lies: a few Spire legends inflate it. She wants the truth about a typical run.",
			prompt:
				"Return one row with three columns: **median** (the **interpolated** median score of all runs, `percentile_cont`), **p90** (the **interpolated** 90th percentile of the scores) and **top_dungeon** (the **most common** dungeon_id among runs).",
			difficulty: 3,
			kind: "query",
			concepts: ["ordered-set-aggregates"],
			starterSql:
				"SELECT avg(score) AS median,\n       max(score) * 0.9 AS p90,\n       max(dungeon_id) AS top_dungeon\nFROM runs;",
			solutionSql:
				"SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,\n       percentile_cont(0.9) WITHIN GROUP (ORDER BY score) AS p90,\n       mode() WITHIN GROUP (ORDER BY dungeon_id) AS top_dungeon\nFROM runs;",
			check: { type: "result" },
			hints: [
				"None of the starter's three columns measures what its name says.",
				"Percentiles and the mode need the values sorted: WITHIN GROUP (ORDER BY ...).",
				"percentile_cont(0.5) WITHIN GROUP (ORDER BY score), percentile_cont(0.9) ..., mode() WITHIN GROUP (ORDER BY dungeon_id)",
			],
			explanation:
				"The median is 2400 (the average is 2581.6), the 90th percentile 4910, and the Abyssal Spire (5) has the most runs.\n\n**Pitfall:** `percentile_disc(0.9)` returns 4900, an existing score; `percentile_cont` interpolates 4910 between 4900 and 5000, a score nobody made.\n\n**Alternative:** `percentile_cont(ARRAY[0.5, 0.9])` returns both percentiles as one array.",
		},
		{
			id: "ch18-ex05",
			title: "How wild is each dungeon?",
			story:
				"The level designers want to know which dungeons give steady scores and whether going deeper always pays.",
			prompt:
				"For each dungeon with **9 runs or more**, return **dungeon_id**, **sd** (the **sample** standard deviation of score) and **r** (the correlation between score and floor_reached). Unrounded.",
			difficulty: 3,
			kind: "query",
			concepts: ["statistical-aggregates"],
			solutionSql:
				"SELECT dungeon_id, stddev_samp(score) AS sd, corr(score, floor_reached) AS r FROM runs GROUP BY dungeon_id HAVING count(*) >= 9;",
			check: { type: "result" },
			hints: [
				"One row per dungeon, filtered on the number of runs: that is a HAVING.",
				"The sample standard deviation is stddev_samp (stddev is its alias); corr(y, x) gives the correlation.",
				"SELECT dungeon_id, stddev_samp(score), corr(score, floor_reached) ... GROUP BY dungeon_id HAVING count(*) >= 9",
			],
			explanation:
				"Four dungeons qualify (the Spider Queen's Lair has 8 runs). The Molten Forge is the steadiest (sd 150), the Spire the wildest (about 903). Every `r` is above 0.9: deeper runs score more.\n\n**Pitfall:** `stddev_pop` divides by n instead of n - 1 and gives smaller values; and `corr` measures a straight line relationship, not a cause.",
		},
		{
			id: "ch18-ex06",
			title: "The Gilded Hall",
			story: "A golden statue awaits every delver who holds **all** the gold badges.",
			prompt:
				"Return the **handle** of every player who holds **every** achievement of tier `gold`.",
			difficulty: 4,
			kind: "query",
			concepts: ["relational-division"],
			starterSql:
				"SELECT DISTINCT p.handle\nFROM players p\nJOIN player_achievements pa ON pa.player_id = p.id\nJOIN achievements a ON a.id = pa.achievement_id\nWHERE a.tier = 'gold';",
			solutionSql:
				"SELECT p.handle\nFROM players p\nJOIN player_achievements pa ON pa.player_id = p.id\nJOIN achievements a ON a.id = pa.achievement_id\nWHERE a.tier = 'gold'\nGROUP BY p.id, p.handle\nHAVING count(DISTINCT a.id) = (SELECT count(*) FROM achievements WHERE tier = 'gold');",
			check: { type: "result" },
			hints: [
				"Run the starter: it lists players with **at least one** gold badge.",
				"Count each player's gold badges and compare with the total number of gold badges.",
				"GROUP BY p.id, p.handle HAVING count(DISTINCT a.id) = (SELECT count(*) FROM achievements WHERE tier = 'gold')",
			],
			explanation:
				"Only Kaito holds all three gold badges; Ægir has two, NightOwl one. Comparing with a subquery keeps the answer right if a fourth gold badge is added tomorrow.\n\n**Pitfall:** `HAVING count(*) = 3` without the gold filter finds players with any three badges (xX_Slayer_Xx), and the starter's join answers *at least one*, not *all*.\n\n**Alternative:** double NOT EXISTS: no gold badge exists that this player does not hold.",
		},
		{
			id: "ch18-ex07",
			title: "The reproducible audit",
			story:
				"The anti-cheat bot audits a 1% sample of the 100 000 archived runs. The auditors must be able to rerun the exact same sample next week.",
			prompt:
				"Sample `run_archive` with `TABLESAMPLE BERNOULLI (1) REPEATABLE (42)` and return one row: **sampled** (the number of sampled runs) and **avg_score** (their average score rounded to **1** decimal).",
			difficulty: 2,
			kind: "query",
			concepts: ["random-sampling"],
			starterSql:
				"SELECT count(*) AS sampled, round(avg(score), 1) AS avg_score\nFROM run_archive TABLESAMPLE SYSTEM (1);",
			solutionSql:
				"SELECT count(*) AS sampled, round(avg(score), 1) AS avg_score FROM run_archive TABLESAMPLE BERNOULLI (1) REPEATABLE (42);",
			check: { type: "result" },
			hints: [
				"Two things differ from the mission: the sampling method and the seed.",
				"BERNOULLI decides row by row; REPEATABLE (seed) makes the draw reproducible.",
				"FROM run_archive TABLESAMPLE BERNOULLI (1) REPEATABLE (42)",
			],
			explanation:
				"BERNOULLI keeps each row with probability 1%, so you get about 1000 runs (975 here), and REPEATABLE (42) returns the same ones every time on the same data.\n\n**Pitfall:** `SYSTEM` samples whole pages: faster, but rows from one page arrive together (here, consecutive runs). Without REPEATABLE the auditors can never reproduce the numbers.",
		},
		{
			id: "ch18-ex08",
			title: "Boss: The Astronomer's Almanac",
			story:
				"The world boss. The season commissioner wants the Almanac of the Observatory: the podium of every season, each hero's taste for danger, and how faithful they are to the arcade.",
			prompt:
				"Rank the players of each season by their **best score in that season**, with `rank()` (highest first, ties share a place), and keep places **4 or better**. For each of those players return:\n\n- **season_id**, **place**, **handle**, **best_score**;\n- **easy**, **mid**, **hard**: how many runs that player made **in that season** in dungeons of difficulty 1 or 2, 3, and 4 or 5;\n- **login_days**: the number of **different days** the player appears in `daily_logins` (all seasons, **0** if never).\n\nOrder by **season_id**, **place**, then **handle**.",
			difficulty: 5,
			kind: "query",
			concepts: ["pivoting", "top-n-per-group", "deduplication", "ranking-functions", "cte-basics"],
			solutionSql:
				"WITH best AS (\n  SELECT season_id, player_id, max(score) AS best_score\n  FROM runs GROUP BY season_id, player_id\n), ranked AS (\n  SELECT *, rank() OVER (PARTITION BY season_id ORDER BY best_score DESC) AS place\n  FROM best\n), mix AS (\n  SELECT r.season_id, r.player_id,\n         count(*) FILTER (WHERE d.difficulty <= 2) AS easy,\n         count(*) FILTER (WHERE d.difficulty = 3) AS mid,\n         count(*) FILTER (WHERE d.difficulty >= 4) AS hard\n  FROM runs r JOIN dungeons d ON d.id = r.dungeon_id\n  GROUP BY r.season_id, r.player_id\n), logins AS (\n  SELECT player_id, count(DISTINCT day) AS login_days\n  FROM daily_logins GROUP BY player_id\n)\nSELECT k.season_id, k.place, p.handle, k.best_score, m.easy, m.mid, m.hard,\n       coalesce(l.login_days, 0) AS login_days\nFROM ranked k\nJOIN players p ON p.id = k.player_id\nJOIN mix m ON m.season_id = k.season_id AND m.player_id = k.player_id\nLEFT JOIN logins l ON l.player_id = k.player_id\nWHERE k.place <= 4\nORDER BY k.season_id, k.place, p.handle;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Build it in CTEs: best score per (season, player); its rank per season; the difficulty pivot per (season, player); distinct login days per player. Then join them.",
				"rank() OVER (PARTITION BY season_id ORDER BY best_score DESC) on the per player bests, not on single runs. Pivot with count(*) FILTER (WHERE d.difficulty <= 2) and friends. count(DISTINCT day) and a LEFT JOIN plus coalesce for login_days.",
				"WITH best AS (... max(score) ... GROUP BY season_id, player_id), ranked AS (SELECT *, rank() OVER (...) AS place FROM best), mix AS (... count(*) FILTER (...) ... GROUP BY r.season_id, r.player_id), logins AS (SELECT player_id, count(DISTINCT day) ... ) SELECT ... WHERE k.place <= 4 ORDER BY k.season_id, k.place, p.handle",
			],
			explanation:
				"Each CTE answers one small question at the right grain, and the final join assembles the Almanac: 16 rows. In the Season of Shadows three players share 1st place at 5200, so xX_Slayer_Xx is 4th. Ægir never logged in (0), and NightOwl shows 9 days, not the 10 rows of the book.\n\n**Pitfall:** ranking single runs instead of each player's best puts Kaito on the Shadows podium twice (his 5100 is the 4th best run), and `count(*)` on `daily_logins` counts the doubles.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch18-pr01",
			title: "Three reports in one",
			prompt:
				"In one query with **GROUPING SETS**, return **season_id**, **dungeon_id** and **runs** for: each season (dungeon_id NULL), each dungeon (season_id NULL), and the grand total (both NULL).",
			difficulty: 2,
			kind: "query",
			concepts: ["grouping-sets"],
			solutionSql:
				"SELECT season_id, dungeon_id, count(*) AS runs FROM runs GROUP BY GROUPING SETS ((season_id), (dungeon_id), ());",
			check: { type: "result" },
			hints: [
				"Three grouping levels: (season_id), (dungeon_id) and ().",
				"GROUPING SETS lists them explicitly, separated by commas.",
				"GROUP BY GROUPING SETS ((season_id), (dungeon_id), ())",
			],
			explanation:
				"4 season rows, 5 dungeon rows, 1 total: 10 rows from one scan.\n\n**Pitfall:** `ROLLUP (season_id, dungeon_id)` would give season and dungeon *pairs* plus season subtotals, but no per dungeon totals.",
		},
		{
			id: "ch18-pr02",
			title: "Every angle with CUBE",
			prompt:
				"Use `CUBE (p.region, r.season_id)` over runs joined with players and return **region**, **season_id**, **runs** and **lvl**, where lvl is `GROUPING(p.region, r.season_id)` (0 for detail rows, 1, 2 or 3 for the totals).",
			difficulty: 3,
			kind: "query",
			concepts: ["grouping-sets"],
			solutionSql:
				"SELECT p.region, r.season_id, count(*) AS runs, GROUPING(p.region, r.season_id) AS lvl FROM runs r JOIN players p ON p.id = r.player_id GROUP BY CUBE (p.region, r.season_id);",
			check: { type: "result" },
			hints: [
				"CUBE (a, b) computes (a, b), (a), (b) and ().",
				"GROUPING with two arguments returns a bitmask: 1 when the second is rolled up, 2 for the first, 3 for both.",
				"GROUPING(p.region, r.season_id) AS lvl ... GROUP BY CUBE (p.region, r.season_id)",
			],
			explanation:
				"The bitmask labels every level in one number, and it is the only way to tell Hollow's NULL region (lvl 0 or 1) from a region total (lvl 2 or 3).\n\n**Pitfall:** CUBE grows fast: with n columns it computes 2 to the power n grouping sets.",
		},
		{
			id: "ch18-pr03",
			title: "How did the runs end?",
			prompt:
				"Per player **region** (NULL region included as its own row), return **region** and three columns: **cleared** (ended_at known and death_cause NULL), **died** (death_cause known) and **abandoned** (ended_at NULL).",
			difficulty: 2,
			kind: "query",
			concepts: ["pivoting"],
			solutionSql:
				"SELECT p.region,\n       count(*) FILTER (WHERE r.ended_at IS NOT NULL AND r.death_cause IS NULL) AS cleared,\n       count(*) FILTER (WHERE r.death_cause IS NOT NULL) AS died,\n       count(*) FILTER (WHERE r.ended_at IS NULL) AS abandoned\nFROM runs r JOIN players p ON p.id = r.player_id\nGROUP BY p.region;",
			check: { type: "result" },
			hints: [
				"One row per region, one FILTERed count per outcome.",
				"Cleared needs two conditions: ended and not killed.",
				"count(*) FILTER (WHERE r.ended_at IS NOT NULL AND r.death_cause IS NULL) AS cleared",
			],
			explanation:
				"Each FILTER picks its own rows inside the region group. In na only one run out of 14 was cleared.\n\n**Pitfall:** `count(*) FILTER (WHERE death_cause IS NULL)` alone mixes cleared runs with abandoned ones.",
		},
		{
			id: "ch18-pr04",
			title: "The crosstab way",
			prompt:
				"With the `crosstab` function of `tablefunc` (two argument form), return **dungeon_id**, **s1**, **s2**, **s3**, **s4**: runs per dungeon and season, where a season without runs shows **NULL** (that is what crosstab does).",
			difficulty: 3,
			kind: "query",
			concepts: ["pivoting"],
			solutionSql:
				"SELECT *\nFROM crosstab(\n  'SELECT dungeon_id, season_id, count(*)::int FROM runs GROUP BY 1, 2 ORDER BY 1, 2',\n  'SELECT generate_series(1, 4)'\n) AS ct(dungeon_id int, s1 int, s2 int, s3 int, s4 int);",
			check: { type: "result" },
			hints: [
				"crosstab(source_sql, categories_sql) needs the source as (row, category, value), ordered by row.",
				"The second query lists the categories 1 to 4, and the AS clause declares the output columns and types.",
				"crosstab('SELECT dungeon_id, season_id, count(*)::int FROM runs GROUP BY 1, 2 ORDER BY 1, 2', 'SELECT generate_series(1, 4)') AS ct(dungeon_id int, s1 int, s2 int, s3 int, s4 int)",
			],
			explanation:
				"The category query tells crosstab which column each season goes to, so missing seasons leave a NULL instead of shifting values left.\n\n**Pitfall:** the one argument form fills columns in order of appearance: the Spire's season 3 count would land in s1.",
		},
		{
			id: "ch18-pr05",
			title: "Points per floor",
			prompt:
				"Over all runs, return **slope** and **intercept** of the least squares line that predicts score from floor_reached (`regr_slope`, `regr_intercept`). Unrounded.",
			difficulty: 2,
			kind: "query",
			concepts: ["statistical-aggregates"],
			solutionSql:
				"SELECT regr_slope(score, floor_reached) AS slope, regr_intercept(score, floor_reached) AS intercept FROM runs;",
			check: { type: "result", tolerance: 0.0001 },
			hints: [
				"The regr_ functions take (y, x): the predicted value first.",
				"Score is y, floor_reached is x.",
				"regr_slope(score, floor_reached), regr_intercept(score, floor_reached)",
			],
			explanation:
				"About 237 points per floor. Arguments are **(y, x)**, the reverse of what many people expect.\n\n**Pitfall:** `regr_slope(floor_reached, score)` predicts floors from scores: a tiny slope.",
		},
		{
			id: "ch18-pr06",
			title: "A typical delve",
			prompt:
				"For each dungeon, return **dungeon_id** and **median_minutes**: the interpolated median duration in minutes (`ended_at - started_at`) of its **finished** runs (ended_at known).",
			difficulty: 3,
			kind: "query",
			concepts: ["ordered-set-aggregates"],
			solutionSql:
				"SELECT dungeon_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM ended_at - started_at) / 60) AS median_minutes FROM runs WHERE ended_at IS NOT NULL GROUP BY dungeon_id;",
			check: { type: "result" },
			hints: [
				"extract(epoch FROM interval) gives seconds.",
				"Sort the minutes inside WITHIN GROUP; filter abandoned runs out.",
				"percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM ended_at - started_at) / 60)",
			],
			explanation:
				"The Sunken Crypt has an even number of finished runs, so its median (50.5) sits between two real durations.\n\n**Pitfall:** `avg` of durations is pulled by outliers; and abandoned runs have no duration at all.",
		},
		{
			id: "ch18-pr07",
			title: "The Silver Circle",
			prompt:
				"Return the **handle** of every player who holds **every** achievement of tier `silver`.",
			difficulty: 3,
			kind: "query",
			concepts: ["relational-division"],
			solutionSql:
				"SELECT p.handle FROM players p JOIN player_achievements pa ON pa.player_id = p.id JOIN achievements a ON a.id = pa.achievement_id WHERE a.tier = 'silver' GROUP BY p.id, p.handle HAVING count(*) = (SELECT count(*) FROM achievements WHERE tier = 'silver');",
			check: { type: "result" },
			hints: [
				"Same recipe as the Gilded Hall, another tier.",
				"Count each player's silver badges and compare with the number of silver badges.",
				"WHERE a.tier = 'silver' GROUP BY p.id, p.handle HAVING count(*) = (SELECT count(*) FROM achievements WHERE tier = 'silver')",
			],
			explanation:
				"Only NightOwl holds Crypt Walker, Web Cutter and Fire Walker. The primary key of player_achievements prevents duplicates, so `count(*)` is safe here.\n\n**Pitfall:** `a.tier IN ('silver')` plus DISTINCT lists anyone with at least one silver badge.",
		},
		{
			id: "ch18-pr08",
			title: "Explorer of every dungeon",
			prompt:
				"Return the **handle** of every player who has at least one run in **every** dungeon.",
			difficulty: 3,
			kind: "query",
			concepts: ["relational-division", "anti-join"],
			solutionSql:
				"SELECT p.handle FROM players p\nWHERE NOT EXISTS (\n  SELECT 1 FROM dungeons d\n  WHERE NOT EXISTS (\n    SELECT 1 FROM runs r WHERE r.player_id = p.id AND r.dungeon_id = d.id\n  )\n);",
			check: { type: "result" },
			hints: [
				"Turn it around: a player qualifies if there is **no** dungeon they never entered.",
				"Two nested NOT EXISTS: dungeons, then runs of this player in that dungeon. Or count DISTINCT dungeons per player.",
				"WHERE NOT EXISTS (SELECT 1 FROM dungeons d WHERE NOT EXISTS (SELECT 1 FROM runs r WHERE r.player_id = p.id AND r.dungeon_id = d.id))",
			],
			explanation:
				"Only NightOwl has entered all five dungeons. The double negation reads: *there is no dungeon without a run of hers*.\n\n**Pitfall:** `HAVING count(*) = 5` counts runs, not dungeons: Kaito has exactly 5 runs but only 3 dungeons. Use `count(DISTINCT dungeon_id)`.",
		},
		{
			id: "ch18-pr09",
			title: "Three lucky winners",
			prompt:
				"The arcade raffle must be reproducible. First run `SELECT setseed(0.42);`, then return the **handle** of **3** players picked with `ORDER BY random() LIMIT 3` from `players`, in the order they were drawn.",
			difficulty: 2,
			kind: "query",
			concepts: ["random-sampling"],
			solutionSql: "SELECT setseed(0.42);\nSELECT handle FROM players ORDER BY random() LIMIT 3;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Two statements: set the seed, then draw.",
				"setseed makes random() produce the same sequence every time.",
				"SELECT setseed(0.42); SELECT handle FROM players ORDER BY random() LIMIT 3;",
			],
			explanation:
				"With the same seed and the same table, `random()` replays the same sequence, so anyone can audit the raffle.\n\n**Pitfall:** without `setseed`, every run draws different winners; and `ORDER BY random()` sorts the whole table, which is slow on the 100 000 row archive (use TABLESAMPLE there).",
		},
	],
};

export default chapter;
