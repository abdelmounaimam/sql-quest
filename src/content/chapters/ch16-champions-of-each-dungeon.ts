import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch16-champions-of-each-dungeon",
	order: 16,
	world: "The Observatory",
	tier: "expert",
	track: "query",
	title: "Champions of Each Dungeon",
	subtitle: "DISTINCT ON, top N per group, LATERAL joins and deduplication",
	emoji: "🥇",
	datasetId: "dungeon",
	concepts: ["distinct-on", "top-n-per-group", "lateral-join", "deduplication"],
	prerequisites: ["ch15-windows-on-the-ranks"],
	lesson: [
		{
			kind: "explain",
			title: "The best row of each group",
			body: "A very common analytics question has the shape *the best X of each Y*: the best run of each dungeon, the latest run of each player, the top 3 of each season. PostgreSQL gives you three tools for it:\n\n1. `DISTINCT ON`: one row per group, PostgreSQL only, very short.\n2. `row_number()` in a CTE, then a filter: any N, any database.\n3. `LATERAL`: a subquery evaluated once per row of another table.",
		},
		{
			kind: "example",
			title: "DISTINCT ON: the first row of each group",
			body: "`DISTINCT ON (dungeon_id)` keeps the **first** row of each dungeon, following the ORDER BY. Four runs tie at 1200 in Goblin Warrens: `started_at` breaks the tie, so the earliest one (run 1) is kept.",
			sql: "SELECT DISTINCT ON (dungeon_id)\n       dungeon_id, id, score, started_at\nFROM runs\nORDER BY dungeon_id, score DESC, started_at;",
		},
		{
			kind: "quiz",
			question:
				"What does `SELECT DISTINCT ON (dungeon_id) dungeon_id, id, score FROM runs ORDER BY score DESC;` do?",
			choices: [
				"Returns the best run of each dungeon",
				"Returns one arbitrary run per dungeon",
				"Fails: ORDER BY must start with dungeon_id",
				"Returns every run, sorted by score",
			],
			answerIndex: 2,
			explanation:
				"It fails with error 42P10: the ORDER BY must **start** with the DISTINCT ON expressions, so that the rows of each group are contiguous. Write `ORDER BY dungeon_id, score DESC, ...`: the keys after the group key decide which row comes first.",
		},
		{
			kind: "explain",
			title: "Top N: number, then filter",
			body: "To keep more than one row per group, number the rows inside each group, then keep the small numbers:\n```sql\nWITH ranked AS (\n  SELECT *, row_number() OVER (\n    PARTITION BY season_id\n    ORDER BY score DESC, started_at) AS rn\n  FROM runs)\nSELECT * FROM ranked WHERE rn <= 3;\n```\nThe CTE is required: window functions are evaluated after WHERE, so the filter must be in the **outer** query.",
		},
		{
			kind: "example",
			title: "Two best runs per player",
			body: "Players with a single run (such as Hollow) keep one row. Player 1's 8 runs are reduced to 2. Change `rn <= 2` to `rn <= 1` and you get the same answer as DISTINCT ON.",
			sql: "WITH ranked AS (\n  SELECT player_id, id, score,\n         row_number() OVER (PARTITION BY player_id\n                            ORDER BY score DESC, started_at) AS rn\n  FROM runs)\nSELECT player_id, rn, id, score\nFROM ranked\nWHERE rn <= 2\nORDER BY player_id, rn;",
		},
		{
			kind: "explain",
			title: "LATERAL: a subquery per row",
			body: "A subquery in FROM normally cannot reference the tables listed before it. With **LATERAL** it can: it is evaluated once for each row on its left.\n```sql\nFROM players p\nLEFT JOIN LATERAL (\n  SELECT score FROM runs\n  WHERE player_id = p.id\n  ORDER BY started_at DESC LIMIT 1\n) r ON true\n```\n`LEFT JOIN ... ON true` keeps the players for whom the subquery returns no row.",
		},
		{
			kind: "example",
			title: "Latest run of every player, with or without runs",
			body: "25 rows: 14 players with their latest run, and 11 players without runs (Rook to newbie_42) with NULLs. With `JOIN LATERAL` instead of `LEFT JOIN LATERAL`, those 11 rows would disappear.",
			sql: "SELECT p.handle, r.score, r.started_at\nFROM players p\nLEFT JOIN LATERAL (\n  SELECT score, started_at\n  FROM runs\n  WHERE player_id = p.id\n  ORDER BY started_at DESC\n  LIMIT 1\n) r ON true\nORDER BY p.id;",
		},
		{
			kind: "explain",
			title: "Duplicate rows",
			body: "The `daily_logins` table has no key, and some (player_id, day) pairs appear more than once. To deal with duplicates:\n\n- **find** them: `GROUP BY player_id, day HAVING count(*) > 1`;\n- **ignore** them in a query: `SELECT DISTINCT`, or `row_number() OVER (PARTITION BY player_id, day)` and keep `rn = 1`;\n- **remove** them permanently: DELETE (covered in *Reforging and Banishing*) and a UNIQUE constraint (covered in *Binding Laws*) so they cannot come back.",
		},
		{
			kind: "example",
			title: "Find duplicated (player_id, day) pairs",
			body: "Three pairs are duplicated. Player 7's row for 10 March appears **three** times, so a cleanup must remove 2 of those rows, not 1.",
			sql: "SELECT player_id, day, count(*) AS copies\nFROM daily_logins\nGROUP BY player_id, day\nHAVING count(*) > 1\nORDER BY player_id, day;",
		},
		{
			kind: "try",
			title: "Try it: latest run of each dungeon",
			prompt:
				"With DISTINCT ON, return the **dungeon_id**, the run **id** and **started_at** of the **most recent** run of each dungeon.",
			starterSql:
				"SELECT DISTINCT ON (dungeon_id) dungeon_id, id, started_at\nFROM runs\nORDER BY dungeon_id, started_at;",
			solutionSql:
				"SELECT DISTINCT ON (dungeon_id) dungeon_id, id, started_at FROM runs ORDER BY dungeon_id, started_at DESC;",
			check: { type: "result" },
			hints: [
				"Run the starter: it keeps the oldest run of each dungeon.",
				"The first row of each group must be the newest: sort started_at descending.",
			],
		},
	],
	exercises: [
		{
			id: "ch16-ex01",
			title: "Best run per player",
			prompt:
				"For every player **who has runs**, return the **player_id**, the run **id** and the **score** of their highest scoring run. If a player had two runs with the same best score, keep the one that **started earliest**. Use DISTINCT ON.",
			difficulty: 2,
			kind: "query",
			concepts: ["distinct-on"],
			starterSql:
				"SELECT DISTINCT ON (player_id) player_id, id, score\nFROM runs\nORDER BY player_id, score;",
			solutionSql:
				"SELECT DISTINCT ON (player_id) player_id, id, score FROM runs ORDER BY player_id, score DESC, started_at;",
			check: { type: "result" },
			hints: [
				"Run the starter: it returns each player's lowest scoring run.",
				"After the group key, the ORDER BY decides which row of the group comes first.",
				"ORDER BY player_id, score DESC, started_at",
			],
			explanation:
				"DISTINCT ON keeps the first row of each `player_id`, and `score DESC, started_at` puts the best (then earliest) run first. The `started_at` tie breaker makes the choice deterministic even when the current data has no ties.\n\n**Pitfall:** `GROUP BY player_id` with `max(score)` gives the score but not *which* run, and `DISTINCT ON` without a complete ORDER BY picks an arbitrary row.\n\n**Alternative:** `row_number() OVER (PARTITION BY player_id ORDER BY score DESC, started_at)` and keep `rn = 1`.",
		},
		{
			id: "ch16-ex02",
			title: "Fix: DISTINCT ON with the wrong ORDER BY",
			prompt:
				"Return one row per dungeon: the **dungeon_id**, the run **id** and the **score** of its best run. On equal scores, the run that **started earliest** wins.",
			difficulty: 2,
			kind: "query",
			concepts: ["distinct-on"],
			starterSql:
				"SELECT DISTINCT ON (dungeon_id) dungeon_id, id, score\nFROM runs\nORDER BY score DESC;",
			solutionSql:
				"SELECT DISTINCT ON (dungeon_id) dungeon_id, id, score FROM runs ORDER BY dungeon_id, score DESC, started_at;",
			check: { type: "result" },
			hints: [
				"Read the error: SELECT DISTINCT ON expressions must match initial ORDER BY expressions.",
				"The ORDER BY must begin with dungeon_id. The tie breaking rule comes after it.",
				"ORDER BY dungeon_id, score DESC, started_at",
			],
			explanation:
				"To keep the first row of each group, PostgreSQL needs the rows of each group next to each other, so the ORDER BY starts with the DISTINCT ON key. The rest of the ORDER BY is the tie breaking rule: Goblin Warrens returns run 1, Abyssal Spire returns run 33.\n\n**Pitfall:** joining `max(score)` per dungeon back to `runs` on the score returns **every** tied run: 4 rows for Goblin Warrens, 3 for Abyssal Spire.",
		},
		{
			id: "ch16-ex03",
			title: "Top 3 runs per season",
			prompt:
				"For each season, return the **season_id**, the run **id** and the **score** of its **3** highest scoring runs: exactly 3 rows per season. On equal scores, the run that **started earliest** goes first.",
			difficulty: 3,
			kind: "query",
			concepts: ["top-n-per-group"],
			starterSql:
				"SELECT season_id, id, score,\n       row_number() OVER (PARTITION BY season_id ORDER BY score DESC, started_at) AS rn\nFROM runs\nWHERE rn <= 3;",
			solutionSql:
				"WITH ranked AS (\n  SELECT season_id, id, score,\n         row_number() OVER (PARTITION BY season_id ORDER BY score DESC, started_at) AS rn\n  FROM runs\n)\nSELECT season_id, id, score FROM ranked WHERE rn <= 3;",
			check: { type: "result" },
			hints: [
				"Run the starter: column rn does not exist yet when WHERE is evaluated.",
				"Compute rn in a CTE (or a subquery in FROM), then filter on it in the outer query.",
				"WITH ranked AS (SELECT ..., row_number() OVER (...) AS rn FROM runs) SELECT season_id, id, score FROM ranked WHERE rn <= 3",
			],
			explanation:
				"WHERE is evaluated before window functions, so `rn` only exists in the outer query. `row_number` never repeats a number, so you get exactly 3 rows per season, with `started_at` breaking the ties at 2400 and 4200.\n\n**Pitfall:** `rank()` would return 4 rows for seasons 2 and 3 (tied 3rd places).\n\n**Alternative:** `seasons s CROSS JOIN LATERAL (SELECT ... WHERE season_id = s.id ORDER BY score DESC, started_at LIMIT 3)`.",
		},
		{
			id: "ch16-ex04",
			title: "Top 3 per season, ties included",
			prompt:
				"For each season, return the **season_id**, the run **id** and the **score** of every run whose **sports rank** in its season (highest score first, ties share a place, places after a tie are skipped) is **3 or better**.",
			difficulty: 3,
			kind: "query",
			concepts: ["top-n-per-group", "ranking-functions"],
			solutionSql:
				"WITH ranked AS (\n  SELECT season_id, id, score,\n         rank() OVER (PARTITION BY season_id ORDER BY score DESC) AS place\n  FROM runs\n)\nSELECT season_id, id, score FROM ranked WHERE place <= 3;",
			check: { type: "result" },
			hints: [
				"Same shape as the top 3, but with a ranking function that lets ties share a place.",
				"rank() skips places after ties; dense_rank() does not.",
				"rank() OVER (PARTITION BY season_id ORDER BY score DESC) AS place ... WHERE place <= 3",
			],
			explanation:
				"`rank()` gives ties the same place: season 2 has 3100, 3100, 2400, 2400 (places 1, 1, 3, 3) so 4 runs qualify, while season 4 stops at its three 5200 runs (the 5100 run is 4th).\n\n**Pitfall:** `dense_rank() <= 3` also includes the 5100 and 4900 runs of season 4, because it never skips a place.",
		},
		{
			id: "ch16-ex05",
			title: "Latest run of every player",
			prompt:
				"For **every player**, return the **handle**, and the **score** and **started_at** of their **most recent** run. Players without runs appear once, with NULL score and started_at. Use LATERAL.",
			difficulty: 3,
			kind: "query",
			concepts: ["lateral-join"],
			starterSql:
				"SELECT p.handle, r.score, r.started_at\nFROM players p\nJOIN LATERAL (\n  SELECT score, started_at\n  FROM runs\n  WHERE player_id = p.id\n  ORDER BY started_at DESC\n  LIMIT 1\n) r ON true;",
			solutionSql:
				"SELECT p.handle, r.score, r.started_at FROM players p LEFT JOIN LATERAL (SELECT score, started_at FROM runs WHERE player_id = p.id ORDER BY started_at DESC LIMIT 1) r ON true;",
			check: { type: "result" },
			hints: [
				"Run the starter and count the rows: 14, but there are 25 players.",
				"An inner join drops the players whose subquery returns no row.",
				"LEFT JOIN LATERAL (...) r ON true",
			],
			explanation:
				"The lateral subquery is evaluated once per player and returns at most one row. `LEFT JOIN ... ON true` keeps the player even when it returns none.\n\n**Pitfall:** without the LATERAL keyword, `p.id` inside the subquery is an error (42P01, invalid reference to FROM clause entry).\n\n**Alternative:** `DISTINCT ON (player_id)` over `runs`, then `players LEFT JOIN` that result.",
		},
		{
			id: "ch16-ex06",
			title: "Two best runs per player with LATERAL",
			prompt:
				"Using a **LATERAL** subquery, return the **handle** and the **score** of the **2** highest scoring runs of every player **who has runs** (players with a single run give one row). On equal scores, the run that **started earliest** comes first.",
			difficulty: 3,
			kind: "query",
			concepts: ["lateral-join", "top-n-per-group"],
			solutionSql:
				"SELECT p.handle, r.score\nFROM players p\nCROSS JOIN LATERAL (\n  SELECT score FROM runs\n  WHERE player_id = p.id\n  ORDER BY score DESC, started_at\n  LIMIT 2\n) r;",
			check: { type: "result" },
			hints: [
				"For each player, the question is a small query: their runs, best first, two of them.",
				"Put that query in a LATERAL subquery with ORDER BY and LIMIT 2. Players without runs must not appear, so an inner join is correct here.",
				"FROM players p CROSS JOIN LATERAL (SELECT score FROM runs WHERE player_id = p.id ORDER BY score DESC, started_at LIMIT 2) r",
			],
			explanation:
				"`CROSS JOIN LATERAL` (or `JOIN LATERAL ... ON true`) evaluates the subquery per player and drops the players for whom it returns nothing, which is what the prompt asks.\n\n**Pitfall:** `LEFT JOIN LATERAL` would add 11 rows with a NULL score for the players without runs.\n\n**Alternative:** the `row_number()` CTE with `WHERE rn <= 2`. LATERAL is faster when an index on `(player_id, score)` lets each subquery stop after 2 rows (indexes are covered in *Index Forging*).",
		},
		{
			id: "ch16-ex07",
			title: "Remove duplicate login rows",
			prompt:
				"Return the **player_id** and **day** of the logins in `daily_logins`, with every (player_id, day) pair **exactly once**.",
			difficulty: 2,
			kind: "query",
			concepts: ["deduplication"],
			starterSql: "SELECT player_id, day\nFROM daily_logins;",
			solutionSql: "SELECT DISTINCT player_id, day FROM daily_logins;",
			check: { type: "result" },
			hints: [
				"Run the starter: 35 rows, but some pairs appear two or three times.",
				"Collapse identical rows: DISTINCT, or GROUP BY both columns.",
				"SELECT DISTINCT player_id, day FROM daily_logins;",
			],
			explanation:
				"`DISTINCT` on both columns keeps one copy of each pair: 31 rows (35 minus 4 extra copies).\n\n**Pitfall:** `DISTINCT ON (player_id)` keeps one row per player, not one per day.\n\n**Alternative:** `GROUP BY player_id, day`, or `row_number() OVER (PARTITION BY player_id, day)` and keep `rn = 1`, which also works when other columns differ between the copies.",
		},
		{
			id: "ch16-ex08",
			title: "Fix: count distinct login days",
			prompt:
				"For every player who appears in `daily_logins`, return the **player_id** and **days_logged**: the number of **different days** they logged in.",
			difficulty: 2,
			kind: "query",
			concepts: ["deduplication"],
			starterSql:
				"SELECT player_id, count(*) AS days_logged\nFROM daily_logins\nGROUP BY player_id;",
			solutionSql:
				"SELECT player_id, count(DISTINCT day) AS days_logged FROM daily_logins GROUP BY player_id;",
			check: { type: "result" },
			hints: [
				"Compare the starter with a SELECT DISTINCT over the table: which players are overcounted?",
				"Count days, not rows, and count each day once.",
				"count(DISTINCT day)",
			],
			explanation:
				"`count(DISTINCT day)` ignores the duplicates: player 1 has 9 days, Brakka 5, Kaito 7, instead of 10, 6 and 9.\n\n**Pitfall:** `count(day)` still counts rows (it only skips NULLs).\n\n**Alternative:** deduplicate first in a subquery (`SELECT DISTINCT player_id, day ...`) and count the rows of that.",
		},
		{
			id: "ch16-ex09",
			title: "Boss: The Champions' Gallery",
			story:
				"Combines two LEFT JOIN LATERAL subqueries with ORDER BY, LIMIT and OFFSET to return the first and second row per group.",
			prompt:
				"For **each of the 5 dungeons**, return:\n\n- **dungeon**: its name;\n- **champion**: the handle of the player of its best run;\n- **score**: that run's score;\n- **runner_up**: the handle of the player of its **second** best run;\n- **runner_up_score**: that run's score.\n\nRuns are ordered by **score highest first, ties by the earliest started_at**. The second best run is simply the second run in that order (it may tie with the first, and it may belong to the same player). Use NULLs if a dungeon has fewer runs.",
			difficulty: 5,
			kind: "query",
			concepts: ["lateral-join", "top-n-per-group", "distinct-on", "left-join"],
			solutionSql:
				"SELECT d.name AS dungeon, c.handle AS champion, c.score,\n       ru.handle AS runner_up, ru.score AS runner_up_score\nFROM dungeons d\nLEFT JOIN LATERAL (\n  SELECT p.handle, r.score FROM runs r JOIN players p ON p.id = r.player_id\n  WHERE r.dungeon_id = d.id ORDER BY r.score DESC, r.started_at LIMIT 1\n) c ON true\nLEFT JOIN LATERAL (\n  SELECT p.handle, r.score FROM runs r JOIN players p ON p.id = r.player_id\n  WHERE r.dungeon_id = d.id ORDER BY r.score DESC, r.started_at LIMIT 1 OFFSET 1\n) ru ON true;",
			check: { type: "result" },
			hints: [
				"Start from dungeons, so every dungeon gets a row. For each one you need the 1st and the 2nd run in the same order.",
				"Two LEFT JOIN LATERAL subqueries: the same ORDER BY, one with LIMIT 1, the other with LIMIT 1 OFFSET 1. Or number the runs with row_number() and pick rn 1 and rn 2.",
				"LEFT JOIN LATERAL (SELECT p.handle, r.score FROM runs r JOIN players p ON p.id = r.player_id WHERE r.dungeon_id = d.id ORDER BY r.score DESC, r.started_at LIMIT 1 OFFSET 1) ru ON true",
			],
			explanation:
				"Each LATERAL subquery reads one dungeon's runs in the same order, and OFFSET 1 returns the second row. In Abyssal Spire, Ægir (5200, January 8) comes before Kaito (5200, February 1) on start time alone.\n\n**Pitfall:** defining the second run as *the best score below the first one* (`dense_rank() = 2`) skips tied runs: Goblin Warrens would return Vex's 1150 instead of Lua's 1200.\n\n**Alternative:** `row_number()` in a CTE, then `max(handle) FILTER (WHERE rn = 1)` and `FILTER (WHERE rn = 2)` per dungeon.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch16-pr01",
			title: "First run per player",
			prompt:
				"For every player who has runs, return the **player_id**, the **id** and the **started_at** of their **first ever** run.",
			difficulty: 1,
			kind: "query",
			concepts: ["distinct-on"],
			solutionSql:
				"SELECT DISTINCT ON (player_id) player_id, id, started_at FROM runs ORDER BY player_id, started_at;",
			check: { type: "result" },
			hints: [
				"One row per player: the earliest one.",
				"DISTINCT ON (player_id), sorted by player then start time.",
				"ORDER BY player_id, started_at",
			],
			explanation:
				"The first row of each player in `started_at` order is their first run. Start times are unique per player, so no further tie breaker is needed.",
		},
		{
			id: "ch16-pr02",
			title: "Latest unlock per achievement",
			prompt:
				"For every achievement that someone unlocked, return the **achievement_id**, the **player_id** and the **unlocked_at** of its **most recent** unlock.",
			difficulty: 2,
			kind: "query",
			concepts: ["distinct-on"],
			solutionSql:
				"SELECT DISTINCT ON (achievement_id) achievement_id, player_id, unlocked_at FROM player_achievements ORDER BY achievement_id, unlocked_at DESC;",
			check: { type: "result" },
			hints: [
				"One row per achievement, newest first inside the group.",
				"DISTINCT ON (achievement_id) with unlocked_at descending.",
				"ORDER BY achievement_id, unlocked_at DESC",
			],
			explanation:
				"9 rows: NIGHT_SHIFT (10) was never unlocked, so it has no group. Hollow holds the most recent First Blood unlock.\n\n**Pitfall:** without DESC you get the *first* unlock of each achievement.",
		},
		{
			id: "ch16-pr03",
			title: "Two longest runs per dungeon",
			prompt:
				"For each dungeon, return the **dungeon_id** and the run **id** of its **2 longest** runs (duration: `ended_at - started_at`), **abandoned runs excluded** (ended_at is NULL). On equal durations, the smaller run id first.",
			difficulty: 3,
			kind: "query",
			concepts: ["top-n-per-group"],
			solutionSql:
				"WITH ranked AS (\n  SELECT dungeon_id, id,\n         row_number() OVER (PARTITION BY dungeon_id ORDER BY ended_at - started_at DESC, id) AS rn\n  FROM runs\n  WHERE ended_at IS NOT NULL\n)\nSELECT dungeon_id, id FROM ranked WHERE rn <= 2;",
			check: { type: "result" },
			hints: [
				"Number the finished runs inside each dungeon by duration, longest first.",
				"Filter out abandoned runs in the CTE, and keep rn <= 2 in the outer query.",
				"`row_number() OVER (PARTITION BY dungeon_id ORDER BY ended_at - started_at DESC, id)`",
			],
			explanation:
				"Intervals sort like numbers. In Abyssal Spire two runs tie at 2 h 20 (runs 22 and 41): both are in the top 2.\n\n**Pitfall:** without `WHERE ended_at IS NOT NULL`, NULL durations sort **first** in DESC order and take the top positions.",
		},
		{
			id: "ch16-pr04",
			title: "Best run per region, ties included",
			prompt:
				"For each player **region** (players with a known region only), return the **region**, the **handle** and the **score** of the region's highest scoring run, **ties included** (a region may have several rows).",
			difficulty: 3,
			kind: "query",
			concepts: ["top-n-per-group", "ranking-functions"],
			solutionSql:
				"WITH ranked AS (\n  SELECT p.region, p.handle, r.score,\n         rank() OVER (PARTITION BY p.region ORDER BY r.score DESC) AS place\n  FROM runs r JOIN players p ON p.id = r.player_id\n  WHERE p.region IS NOT NULL\n)\nSELECT region, handle, score FROM ranked WHERE place = 1;",
			check: { type: "result" },
			hints: [
				"All tied rows must be kept, so row_number is the wrong tool.",
				"rank() = 1 per region, computed in a CTE.",
				"rank() OVER (PARTITION BY p.region ORDER BY r.score DESC) AS place ... WHERE place = 1",
			],
			explanation:
				"`rank() = 1` keeps every run tied for first: in eu, NightOwl and Ægir share 5200.\n\n**Pitfall:** `DISTINCT ON (region)` or `row_number() = 1` would silently drop one of them.",
		},
		{
			id: "ch16-pr05",
			title: "Two latest runs per dungeon",
			prompt:
				"Using LATERAL, return each dungeon's **name** with the **id** and **started_at** of its **2 most recent** runs.",
			difficulty: 2,
			kind: "query",
			concepts: ["lateral-join"],
			solutionSql:
				"SELECT d.name, r.id, r.started_at FROM dungeons d CROSS JOIN LATERAL (SELECT id, started_at FROM runs WHERE dungeon_id = d.id ORDER BY started_at DESC LIMIT 2) r;",
			check: { type: "result" },
			hints: [
				"For each dungeon, a small query: its runs, newest first, two of them.",
				"CROSS JOIN LATERAL (SELECT ... WHERE dungeon_id = d.id ORDER BY ... LIMIT 2)",
				"FROM dungeons d CROSS JOIN LATERAL (SELECT id, started_at FROM runs WHERE dungeon_id = d.id ORDER BY started_at DESC LIMIT 2) r",
			],
			explanation:
				"The subquery can reference `d.id` because of LATERAL and is evaluated once per dungeon: 5 dungeons, 10 rows.\n\n**Pitfall:** a LIMIT 2 in a plain subquery (no LATERAL) would keep 2 runs overall, not 2 per dungeon.",
		},
		{
			id: "ch16-pr06",
			title: "Count extra copies per pair",
			prompt:
				"Return every (**player_id**, **day**) pair that appears **more than once** in `daily_logins`, with **extra**: the number of copies beyond the first one.",
			difficulty: 2,
			kind: "query",
			concepts: ["deduplication"],
			solutionSql:
				"SELECT player_id, day, count(*) - 1 AS extra FROM daily_logins GROUP BY player_id, day HAVING count(*) > 1;",
			check: { type: "result" },
			hints: [
				"Group by the pair, keep the groups that have more than one row.",
				"HAVING count(*) > 1; the extra copies are count(*) minus one.",
				"SELECT player_id, day, count(*) - 1 AS extra ... HAVING count(*) > 1",
			],
			explanation:
				"Three pairs, 4 extra rows in total: player 7's row for 10 March has 2 extras.\n\n**Pitfall:** grouping by `player_id` alone counts logins per player, not copies of a day.",
		},
		{
			id: "ch16-pr07",
			title: "Number duplicate copies",
			prompt:
				"Number the copies of each (player_id, day) pair in `daily_logins` (any order inside a pair) and return the **player_id**, **day** and **copy_no** of every row whose copy number is **2 or more**: the rows a cleanup would delete.",
			difficulty: 3,
			kind: "query",
			concepts: ["deduplication", "top-n-per-group"],
			solutionSql:
				"WITH numbered AS (\n  SELECT player_id, day, row_number() OVER (PARTITION BY player_id, day) AS copy_no\n  FROM daily_logins\n)\nSELECT player_id, day, copy_no FROM numbered WHERE copy_no >= 2;",
			check: { type: "result" },
			hints: [
				"row_number restarts for each pair if you partition by both columns.",
				"Compute copy_no in a CTE, then keep copy_no >= 2.",
				"row_number() OVER (PARTITION BY player_id, day) AS copy_no ... WHERE copy_no >= 2",
			],
			explanation:
				"Copy 1 of every pair is kept; copies 2 and 3 are the duplicates: 4 rows. The copies are identical, so which one is numbered 1 does not matter.\n\n**Pitfall:** `PARTITION BY player_id` alone numbers all of a player's logins and marks distinct days as duplicates.\n\n**Next:** `DELETE ... USING`, covered in *Reforging and Banishing*, deletes exactly these rows.",
		},
	],
};

export default chapter;
