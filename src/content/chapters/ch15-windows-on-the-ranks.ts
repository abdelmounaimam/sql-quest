import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch15-windows-on-the-ranks",
	order: 15,
	world: "The Observatory",
	tier: "adept",
	track: "query",
	title: "Windows on the Ranks",
	subtitle: "Window functions: OVER, PARTITION BY, ranking, LAG/LEAD, frames and running totals",
	emoji: "🪟",
	datasetId: "dungeon",
	concepts: [
		"window-basics",
		"window-partition-order",
		"ranking-functions",
		"lag-lead",
		"window-frames",
		"running-totals",
	],
	prerequisites: ["ch13-unions-and-named-spells"],
	lesson: [
		{
			kind: "explain",
			title: "Aggregates that keep every row",
			body: "GROUP BY collapses rows into groups. A **window function** does not: it computes a value over a set of rows and returns it **on each row**, next to that row's own columns.\n\nAdd `OVER ()` to an aggregate to turn it into a window function over the whole result:\n```sql\nSELECT id, score, max(score) OVER () AS best\nFROM runs;\n```\nEvery row of `runs` stays in the result, and each one carries the overall maximum score.",
		},
		{
			kind: "explain",
			title: "PARTITION BY and ORDER BY inside OVER",
			body: "The parentheses after OVER define the window:\n\n- `PARTITION BY season_id`: rows are split into groups by season, and the window restarts for each group.\n- `ORDER BY started_at`: the window becomes **cumulative**, each row sees the rows up to itself.\n\n```sql\nsum(score) OVER (PARTITION BY player_id ORDER BY started_at)\n```\nThis ORDER BY sorts the *window*, not the result. Add a normal ORDER BY at the end of the query to sort the output.",
		},
		{
			kind: "example",
			title: "Three windows on player 1's runs",
			body: "Each column has its own OVER clause and its own window. `all_hers` counts all 8 runs of player 1 on every row, `season_avg` is computed per season, and `running` accumulates run after run until 26650.",
			sql: "SELECT id, season_id, started_at, score,\n       count(*) OVER () AS all_hers,\n       round(avg(score) OVER (PARTITION BY season_id), 1) AS season_avg,\n       sum(score) OVER (ORDER BY started_at) AS running\nFROM runs\nWHERE player_id = 1\nORDER BY started_at;",
		},
		{
			kind: "explain",
			title: "Three ways to rank",
			body: "Ranking functions number the rows inside the window, following its ORDER BY. They differ only on **ties**:\n\n- `row_number()`: 1, 2, 3, 4 (ties get different numbers, in no guaranteed order)\n- `rank()`: 1, 1, 1, 4 (ties share a number, then positions are skipped)\n- `dense_rank()`: 1, 1, 1, 2 (ties share a number, no gap)\n\n`ntile(4)` distributes the rows into 4 buckets of nearly equal size.",
		},
		{
			kind: "quiz",
			question:
				"Season 4 scores, highest first: 5200, 5200, 5200, 5100. What does `rank() OVER (ORDER BY score DESC)` return for the 5100 run?",
			choices: ["2", "4", "3", "1"],
			answerIndex: 1,
			explanation:
				"`rank()` counts the rows that come strictly before, plus one. Three runs have 5200, so 5100 gets **4**. `dense_rank()` would return 2, and `row_number()` would return 4 but number the three 5200 runs 1, 2, 3.",
		},
		{
			kind: "example",
			title: "The three ranking functions side by side",
			body: "The top of season 4 has three runs tied at 5200. `rank` jumps from 1 to 4, `dense_rank` continues with 2, and `row_number` assigns distinct numbers that the scores do not justify.",
			sql: "SELECT id, score,\n       row_number() OVER (ORDER BY score DESC) AS row_num,\n       rank()       OVER (ORDER BY score DESC) AS rnk,\n       dense_rank() OVER (ORDER BY score DESC) AS dense\nFROM runs\nWHERE season_id = 4\nORDER BY score DESC, id;",
		},
		{
			kind: "explain",
			title: "LAG and LEAD: read neighbouring rows",
			body: "`lag(score)` returns the value from the previous row of the window, `lead(score)` from the next one. Both need an ORDER BY in OVER. They return NULL at the edges unless you pass a default: `lag(score, 1, 0)`.\n\nWindow functions are evaluated **after** WHERE, so `WHERE rank() OVER (...) <= 3` fails with error 42P20. To filter on a window result, compute it in a CTE or subquery first, then filter in the outer query.",
		},
		{
			kind: "explain",
			title: "Frames: which rows the window sees",
			body: "With an ORDER BY, the default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. RANGE treats rows with equal ORDER BY values as **peers**: they all enter the frame together.\n\nUse **ROWS** to count physical rows instead:\n```sql\navg(score) OVER (ORDER BY started_at\n  ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)\n```\nThis is a moving average over 3 runs. Note that `last_value()` with the default frame stops at the current row, so it returns the current row's value.",
		},
		{
			kind: "example",
			title: "Peers in the default RANGE frame",
			body: "Run it: the three 5200 runs all show 15600 in `range_running`, not 5200, 10400, 15600. With the default RANGE frame, tied rows enter the sum together. `rows_running` adds one row at a time, with `id` as a tie breaker.",
			sql: "SELECT id, score,\n       sum(score) OVER (ORDER BY score DESC) AS range_running,\n       sum(score) OVER (ORDER BY score DESC, id\n         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rows_running\nFROM runs\nWHERE season_id = 4\nORDER BY score DESC, id;",
		},
		{
			kind: "try",
			title: "Try it: overall average on every row",
			prompt:
				"Return the **id** and **score** of every run, plus **avg_all**: the average score of **all** runs (unrounded), on every row.",
			starterSql: "SELECT id, score, avg(score) AS avg_all\nFROM runs;",
			solutionSql: "SELECT id, score, avg(score) OVER () AS avg_all FROM runs;",
			check: { type: "result" },
			hints: [
				"Run the starter: an aggregate next to plain columns requires a GROUP BY, unless it is a window function.",
				"Add OVER () right after avg(score).",
			],
		},
	],
	exercises: [
		{
			id: "ch15-ex01",
			title: "Overall maximum on every row",
			prompt:
				"Return the **id** and **score** of every run, plus **best**: the highest score among **all** runs (the same value on every row).",
			difficulty: 1,
			kind: "query",
			concepts: ["window-basics"],
			starterSql: "SELECT id, score, max(score) AS best\nFROM runs;",
			solutionSql: "SELECT id, score, max(score) OVER () AS best FROM runs;",
			check: { type: "result" },
			hints: [
				"Run the starter: max() next to plain columns requires a GROUP BY, which would collapse the runs.",
				"A window function keeps every row: add OVER after the aggregate.",
				"max(score) OVER () AS best",
			],
			explanation:
				"`OVER ()` makes `max` a window function over the whole result: the 50 rows stay 50 rows, each carrying 5200.\n\n**Pitfall:** `GROUP BY id, score` removes the error, but every group is then a single run, so `best` just repeats the run's own score.\n\n**Alternative:** a scalar subquery `(SELECT max(score) FROM runs)` gives the same column. Window functions become more useful when the value depends on the row's group.",
		},
		{
			id: "ch15-ex02",
			title: "Average per season on every run",
			prompt:
				"Return the **id**, **season_id** and **score** of every run, plus **season_avg**: the average score of the runs **of the same season** (unrounded).",
			difficulty: 2,
			kind: "query",
			concepts: ["window-partition-order"],
			solutionSql:
				"SELECT id, season_id, score, avg(score) OVER (PARTITION BY season_id) AS season_avg FROM runs;",
			check: { type: "result" },
			hints: [
				"Same idea as an overall aggregate on every row, but the window must restart for each season.",
				"PARTITION BY inside OVER splits the window into groups.",
				"avg(score) OVER (PARTITION BY season_id)",
			],
			explanation:
				"`PARTITION BY season_id` gives every season its own window: season 1 averages 1290, season 4 about 3004.35.\n\n**Pitfall:** `avg(score) OVER ()` averages the whole table, and `GROUP BY season_id` would leave only 4 rows.\n\n**Alternative:** a correlated subquery `(SELECT avg(score) FROM runs x WHERE x.season_id = r.season_id)` also works, but recomputes the average for every row.",
		},
		{
			id: "ch15-ex03",
			title: "Ranking without gaps",
			prompt:
				"For every **season 4** run, return the **id**, the **score** and **pos**: its position, where the highest score is 1, equal scores share a position and the **next distinct score gets the next number** (no gaps).",
			difficulty: 2,
			kind: "query",
			concepts: ["ranking-functions"],
			solutionSql:
				"SELECT id, score, dense_rank() OVER (ORDER BY score DESC) AS pos FROM runs WHERE season_id = 4;",
			check: { type: "result" },
			hints: [
				"Three runs share 5200: they share position 1, and 5100 gets position 2.",
				"Among the ranking functions, the one that never skips a number is dense_rank.",
				"dense_rank() OVER (ORDER BY score DESC) AS pos",
			],
			explanation:
				"`dense_rank()` gives ties the same number and continues with the next integer: 1, 1, 1, 2, 3, 4, 4, 5...\n\n**Pitfall:** `rank()` would give 5100 position 4 and skip 2 and 3. `row_number()` numbers the three 5200 runs 1, 2, 3.",
		},
		{
			id: "ch15-ex04",
			title: "Fix: ties must share a rank",
			prompt:
				"Fix the query: for every **season 4** run return the **id**, **score** and **place**, highest score first, where **tied scores share a place and the next place is skipped** (5200, 5200, 5200, 5100 gives 1, 1, 1, 4).",
			difficulty: 2,
			kind: "query",
			concepts: ["ranking-functions"],
			starterSql:
				"SELECT id, score,\n       row_number() OVER (ORDER BY score DESC) AS place\nFROM runs\nWHERE season_id = 4;",
			solutionSql:
				"SELECT id, score, rank() OVER (ORDER BY score DESC) AS place FROM runs WHERE season_id = 4;",
			check: { type: "result" },
			hints: [
				"Run the starter and look at the three 5200 runs.",
				"row_number never repeats a number. You need the ranking function that shares a number on ties and then skips.",
				"rank() OVER (ORDER BY score DESC)",
			],
			explanation:
				"`rank()` is the usual competition ranking: three rows tied for 1st, so the next one is 4th.\n\n**Pitfall:** `row_number()` breaks ties arbitrarily (and may break them differently on the next run), while `dense_rank()` would give 5100 place 2.",
		},
		{
			id: "ch15-ex05",
			title: "Difference from the previous run",
			prompt:
				"For every run of **player 1** (NightOwl), return the **id**, the **score** and **delta**: the score minus the score of the player's **previous run in time** (`started_at` order). The first run has no previous run: its delta is **NULL**.",
			difficulty: 3,
			kind: "query",
			concepts: ["lag-lead"],
			starterSql:
				"SELECT id, score,\n       score - lead(score) OVER (ORDER BY started_at) AS delta\nFROM runs\nWHERE player_id = 1;",
			solutionSql:
				"SELECT id, score, score - lag(score) OVER (ORDER BY started_at) AS delta FROM runs WHERE player_id = 1;",
			check: { type: "result" },
			hints: [
				"Run the starter: the NULL is on the last run, so the query reads the next row instead of the previous one.",
				"lag reads the previous row, lead the next one.",
				"`score - lag(score) OVER (ORDER BY started_at) AS delta`",
			],
			explanation:
				"`lag(score)` returns the score of the row just before in the window order: +550, +650, +500, +1300, +400, then -200 and +800.\n\n**Pitfall:** `lead` reads forward, and ordering the window by `score` instead of `started_at` compares each run with the next higher score, not with the previous run.\n\n**Alternative:** `lag(score, 1)` is the same thing with the offset written out. `lag(score, 1, 0)` would replace the NULL with 0 (not asked here).",
		},
		{
			id: "ch15-ex06",
			title: "Running total per player",
			prompt:
				"For **every run**, return the **player_id**, the run **id**, the **score** and **running_total**: the sum of the scores of **that player's** runs up to and including this one, in `started_at` order.",
			difficulty: 3,
			kind: "query",
			concepts: ["running-totals", "window-partition-order"],
			starterSql:
				"SELECT player_id, id, score,\n       sum(score) OVER (ORDER BY started_at) AS running_total\nFROM runs;",
			solutionSql:
				"SELECT player_id, id, score, sum(score) OVER (PARTITION BY player_id ORDER BY started_at) AS running_total FROM runs;",
			check: { type: "result" },
			hints: [
				"Run the starter: the total adds up the scores of all players together.",
				"Each player needs a separate window, still ordered by time.",
				"sum(score) OVER (PARTITION BY player_id ORDER BY started_at)",
			],
			explanation:
				"PARTITION BY restarts the sum for each player, ORDER BY makes it cumulative: player 1 ends at 26650, player 7 at 20500.\n\n**Pitfall:** without PARTITION BY the total runs across players. Without ORDER BY every row shows the player's grand total.\n\n**Alternative:** a correlated subquery summing earlier runs gives the same numbers but scans the table again for every row.",
		},
		{
			id: "ch15-ex07",
			title: "Fix: running total with tied scores",
			prompt:
				"For every **season 4** run, return the **id**, the **score** and **running**: the sum of the scores of the runs up to and including this one, where runs are taken by **score, highest first, ties by id (smallest first)**. Each row must add **exactly its own score** to the previous row's total (the first line reads 5200).",
			difficulty: 4,
			kind: "query",
			concepts: ["window-frames", "running-totals"],
			starterSql:
				"SELECT id, score,\n       sum(score) OVER (ORDER BY score DESC) AS running\nFROM runs\nWHERE season_id = 4;",
			solutionSql:
				"SELECT id, score, sum(score) OVER (ORDER BY score DESC, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running FROM runs WHERE season_id = 4;",
			check: { type: "result" },
			hints: [
				"Run the starter: the three 5200 runs are peers, so the default RANGE frame adds them all at once.",
				"Make the order total (add id as a tie breaker) and count physical rows with a ROWS frame.",
				"OVER (ORDER BY score DESC, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)",
			],
			explanation:
				"The default frame is `RANGE ... CURRENT ROW`, which includes every **peer** of the current row (same ORDER BY value). The ROWS frame stops at the current row itself, and the `id` tie breaker fixes which tied run comes first: 5200, 10400, 15600, 20700...\n\n**Pitfall:** `ROWS` without the `id` tie breaker steps one row at a time, but the order among the three 5200 runs is not guaranteed.\n\n**Alternative:** once `id` makes the order total there are no peers left, so the default frame gives the same result. Writing ROWS explicitly states the intent.",
		},
		{
			id: "ch15-ex08",
			title: "Boss: The Season Chronicle",
			story:
				"Combines rank(), lag() and a ROWS moving average over a named window on a join.",
			prompt:
				"For every **season 4** run, return in this order:\n\n- **handle** of the player;\n- **score**;\n- **season_rank**: `rank()` by score, highest first (ties share a place);\n- **gap_to_previous**: the score of the run just above **minus** this run's score, NULL for the first line;\n- **moving_avg**: the average score of this run and the **2 runs just above it** (fewer at the top), unrounded.\n\n\"Above\" means in the order **score highest first, ties by run id smallest first**. Return the rows **in that order**.",
			difficulty: 5,
			kind: "query",
			concepts: ["ranking-functions", "lag-lead", "window-frames", "running-totals"],
			solutionSql:
				"SELECT p.handle, r.score,\n       rank() OVER (ORDER BY r.score DESC) AS season_rank,\n       lag(r.score) OVER w - r.score AS gap_to_previous,\n       avg(r.score) OVER (w ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg\nFROM runs r\nJOIN players p ON p.id = r.player_id\nWHERE r.season_id = 4\nWINDOW w AS (ORDER BY r.score DESC, r.id)\nORDER BY r.score DESC, r.id;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Join players for the handle, filter season 4, then add one window column at a time and check each against the prompt.",
				"rank() uses score only (ties share). lag and the moving average need the total order score DESC, id; the moving average needs a ROWS frame of 2 PRECEDING.",
				"`lag(r.score) OVER (ORDER BY r.score DESC, r.id) - r.score`, and `avg(r.score) OVER (ORDER BY r.score DESC, r.id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`",
			],
			explanation:
				"Three windows with three shapes: `rank()` needs only the score (so ties share a place), while `lag` and the moving average need a **total** order, otherwise their values can change between executions. A named window `WINDOW w AS (...)` keeps the OVER clauses short, and `OVER (w ROWS ...)` extends it with a frame.\n\n**Pitfall:** `RANGE BETWEEN 2 PRECEDING` means *scores within 2 points*, not 2 rows, and the default frame would average every row above.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch15-pr01",
			title: "Total player count on every row",
			prompt:
				"Return every player's **handle** with **players**: the total number of registered players, on every row.",
			difficulty: 1,
			kind: "query",
			concepts: ["window-basics"],
			solutionSql: "SELECT handle, count(*) OVER () AS players FROM players;",
			check: { type: "result" },
			hints: [
				"You need an aggregate that does not collapse the rows.",
				"count(*) with an empty OVER ().",
				"SELECT handle, count(*) OVER () AS players FROM players;",
			],
			explanation:
				"`count(*) OVER ()` counts the rows of the whole result and repeats the value (25) on each row.\n\n**Pitfall:** `count(*)` alone requires a GROUP BY and would lose the handles.",
		},
		{
			id: "ch15-pr02",
			title: "Maximum score per dungeon",
			prompt:
				"Return the **id**, **dungeon_id** and **score** of every run, plus **dungeon_best**: the highest score ever made **in the same dungeon**.",
			difficulty: 2,
			kind: "query",
			concepts: ["window-partition-order"],
			solutionSql:
				"SELECT id, dungeon_id, score, max(score) OVER (PARTITION BY dungeon_id) AS dungeon_best FROM runs;",
			check: { type: "result" },
			hints: [
				"One window per dungeon.",
				"PARTITION BY dungeon_id, and no ORDER BY (you want the whole dungeon, not a running maximum).",
				"max(score) OVER (PARTITION BY dungeon_id)",
			],
			explanation:
				"PARTITION BY gives each dungeon its own window: the maximum in Goblin Warrens is 1200, in Abyssal Spire 5200.\n\n**Pitfall:** adding `ORDER BY started_at` inside OVER turns it into a *maximum so far*, which answers a different question.",
		},
		{
			id: "ch15-pr03",
			title: "rank and dense_rank in season 2",
			prompt:
				"For every **season 2** run return the **id**, **score**, **rnk** (`rank()` by score, highest first) and **drnk** (`dense_rank()` by score, highest first).",
			difficulty: 2,
			kind: "query",
			concepts: ["ranking-functions"],
			solutionSql:
				"SELECT id, score, rank() OVER (ORDER BY score DESC) AS rnk, dense_rank() OVER (ORDER BY score DESC) AS drnk FROM runs WHERE season_id = 2;",
			check: { type: "result" },
			hints: [
				"Two window columns with the same window.",
				"Both need ORDER BY score DESC inside OVER.",
				"rank() OVER (ORDER BY score DESC), dense_rank() OVER (ORDER BY score DESC)",
			],
			explanation:
				"Two runs tie at 3100 (both 1), so the 2400 runs are 3rd for `rank` but 2nd for `dense_rank`.\n\n**Alternative:** `WINDOW w AS (ORDER BY score DESC)` then `rank() OVER w, dense_rank() OVER w`.",
		},
		{
			id: "ch15-pr04",
			title: "Split runs into 4 buckets",
			prompt:
				"Split **player 1**'s runs into **4 buckets** of equal size in time order (`started_at`): return the run **id** and **bucket** (1 for the earliest runs, 4 for the latest).",
			difficulty: 2,
			kind: "query",
			concepts: ["ranking-functions"],
			solutionSql:
				"SELECT id, ntile(4) OVER (ORDER BY started_at) AS bucket FROM runs WHERE player_id = 1;",
			check: { type: "result" },
			hints: [
				"One ranking function distributes rows into n buckets.",
				"ntile(4), ordered by time.",
				"ntile(4) OVER (ORDER BY started_at) AS bucket",
			],
			explanation:
				"8 runs in 4 buckets gives 2 runs per bucket. With 9 runs the first bucket would get the extra one: ntile bucket sizes differ by at most one row.",
		},
		{
			id: "ch15-pr05",
			title: "Start time of the next run",
			prompt:
				"For every run of **player 7** (Kaito), return the **id**, the **started_at** and **next_start**: the `started_at` of the player's **next** run in time, NULL for the latest run.",
			difficulty: 2,
			kind: "query",
			concepts: ["lag-lead"],
			solutionSql:
				"SELECT id, started_at, lead(started_at) OVER (ORDER BY started_at) AS next_start FROM runs WHERE player_id = 7;",
			check: { type: "result" },
			hints: [
				"You need the value from the following row.",
				"lead() reads forward in the window order.",
				"lead(started_at) OVER (ORDER BY started_at)",
			],
			explanation:
				"`lead` reads the next row in window order. The last row has no next row, so it gets NULL.\n\n**Pitfall:** `lag` would return the *previous* run, with the NULL on the first row instead.",
		},
		{
			id: "ch15-pr06",
			title: "Fix: last_value with the default frame",
			prompt:
				"For every run of **player 1**, return the **id**, the **score**, **first_score** (score of the player's earliest run) and **last_score** (score of the player's **latest** run, the same on every row), using `started_at` order.",
			difficulty: 3,
			kind: "query",
			concepts: ["window-frames"],
			starterSql:
				"SELECT id, score,\n       first_value(score) OVER (ORDER BY started_at) AS first_score,\n       last_value(score)  OVER (ORDER BY started_at) AS last_score\nFROM runs\nWHERE player_id = 1;",
			solutionSql:
				"SELECT id, score, first_value(score) OVER w AS first_score, last_value(score) OVER w AS last_score FROM runs WHERE player_id = 1 WINDOW w AS (ORDER BY started_at ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING);",
			check: { type: "result" },
			hints: [
				"Run the starter: last_score equals score on every row.",
				"The default frame ends at the current row. Extend it to the end of the partition.",
				"OVER (ORDER BY started_at ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)",
			],
			explanation:
				"`last_value` returns the last row **of the frame**, and the default frame stops at the current row. A frame that reaches `UNBOUNDED FOLLOWING` makes it the actual latest run (5200).\n\n**Alternative:** `first_value(score) OVER (ORDER BY started_at DESC)` also returns the latest score.",
		},
		{
			id: "ch15-pr07",
			title: "Moving average over 3 runs",
			prompt:
				"For every run of **player 1**, return the **id** and **moving_avg**: the average score of this run and the player's **2 previous runs** in `started_at` order (fewer for the first two runs), unrounded.",
			difficulty: 3,
			kind: "query",
			concepts: ["window-frames", "running-totals"],
			solutionSql:
				"SELECT id, avg(score) OVER (ORDER BY started_at ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg FROM runs WHERE player_id = 1;",
			check: { type: "result" },
			hints: [
				"A sliding window of 3 rows: the two before, plus the current one.",
				"ROWS BETWEEN 2 PRECEDING AND CURRENT ROW.",
				"avg(score) OVER (ORDER BY started_at ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)",
			],
			explanation:
				"The ROWS frame counts physical rows: 1200, then (1200 + 1750) / 2, then three runs at a time.\n\n**Pitfall:** `3 PRECEDING` averages 4 runs (off by one), and without a frame you get a cumulative average.",
		},
		{
			id: "ch15-pr08",
			title: "Running count per season",
			prompt:
				"For every run, return the **season_id**, the run **id** and **runs_so_far**: how many runs of **that season** had started up to and including this one (`started_at` order).",
			difficulty: 2,
			kind: "query",
			concepts: ["running-totals"],
			solutionSql:
				"SELECT season_id, id, count(*) OVER (PARTITION BY season_id ORDER BY started_at) AS runs_so_far FROM runs;",
			check: { type: "result" },
			hints: [
				"A running count that restarts each season.",
				"count(*) with PARTITION BY season_id and ORDER BY started_at.",
				"count(*) OVER (PARTITION BY season_id ORDER BY started_at)",
			],
			explanation:
				"A cumulative count is a running total of ones. All start times are distinct, so the default frame and a ROWS frame give the same result.\n\n**Alternative:** `row_number() OVER (PARTITION BY season_id ORDER BY started_at)` gives the same numbers here.",
		},
	],
};

export default chapter;
