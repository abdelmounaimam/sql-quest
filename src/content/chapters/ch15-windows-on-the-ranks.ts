import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch15-windows-on-the-ranks",
	order: 15,
	world: "The Observatory",
	tier: "adept",
	track: "query",
	title: "Windows on the Ranks",
	subtitle: "Rankings, running totals and before/after comparisons without losing a single row",
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
			body: "Welcome to the Observatory, recruit. The season commissioner of the Dungeon Delve arcade wants every run **next to** the big numbers.\n\nGROUP BY collapses rows. A **window function** does not: add `OVER ()` to an aggregate and each row keeps its own columns *and* sees the total.\n```sql\nSELECT id, score, max(score) OVER () AS best\nFROM runs;\n```",
		},
		{
			kind: "explain",
			title: "PARTITION BY and ORDER BY inside OVER",
			body: "Inside the parentheses you shape the window:\n\n- `PARTITION BY season_id`: each season is its own little world, the window restarts.\n- `ORDER BY started_at`: the window becomes **cumulative**, each row sees the rows up to itself.\n\n```sql\nsum(score) OVER (PARTITION BY player_id ORDER BY started_at)\n```\nThis ORDER BY sorts the *window*, not the result: add a normal ORDER BY at the end for that.",
		},
		{
			kind: "example",
			title: "NightOwl's climb",
			body: "One OVER per column, each with its own shape. `all_hers` counts all 8 of her runs on every row, `season_avg` is per season, and `running` grows run after run until 26650.",
			sql: "SELECT id, season_id, started_at, score,\n       count(*) OVER () AS all_hers,\n       round(avg(score) OVER (PARTITION BY season_id), 1) AS season_avg,\n       sum(score) OVER (ORDER BY started_at) AS running\nFROM runs\nWHERE player_id = 1\nORDER BY started_at;",
		},
		{
			kind: "explain",
			title: "Three ways to rank",
			body: "Ranking functions number rows inside the window. They only disagree on **ties**:\n\n- `row_number()`: 1, 2, 3, 4 (ties get different numbers, in no promised order)\n- `rank()`: 1, 1, 1, 4 (ties share, then places are skipped)\n- `dense_rank()`: 1, 1, 1, 2 (ties share, no gap)\n\n`ntile(4)` deals the rows into 4 buckets of nearly equal size.",
		},
		{
			kind: "quiz",
			question:
				"Season 4 scores, highest first: 5200, 5200, 5200, 5100. What does `rank() OVER (ORDER BY score DESC)` give the 5100 run?",
			choices: ["2", "4", "3", "1"],
			answerIndex: 1,
			explanation:
				"`rank()` counts how many rows come strictly before, plus one: three 5200 runs, so 5100 is **4th**. `dense_rank()` would say 2, and `row_number()` would say 4 but split the three 5200 runs into 1, 2, 3.",
		},
		{
			kind: "example",
			title: "The three rankers side by side",
			body: "Look at the top of season 4: NightOwl, Ægir and Kaito share 5200. `rank` jumps from 1 to 4, `dense_rank` goes to 2, and `row_number` invents an order the scores do not justify.",
			sql: "SELECT id, score,\n       row_number() OVER (ORDER BY score DESC) AS row_num,\n       rank()       OVER (ORDER BY score DESC) AS rnk,\n       dense_rank() OVER (ORDER BY score DESC) AS dense\nFROM runs\nWHERE season_id = 4\nORDER BY score DESC, id;",
		},
		{
			kind: "explain",
			title: "LAG and LEAD: look at your neighbours",
			body: "`lag(score)` reads the previous row of the window, `lead(score)` the next one. They need an ORDER BY in OVER, and return NULL at the edges unless you give a default: `lag(score, 1, 0)`.\n\nWindows run **after** WHERE, so `WHERE rank() OVER (...) <= 3` fails with 42P20. To filter on a window result, compute it in a CTE first, then filter outside.",
		},
		{
			kind: "explain",
			title: "Frames: which rows the window sees",
			body: "With ORDER BY, the default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. RANGE treats **ties as peers**: they all enter the frame together.\n\nCount rows instead with **ROWS**:\n```sql\navg(score) OVER (ORDER BY started_at\n  ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)\n```\nThat is a 3 run moving average. Also, `last_value()` with the default frame stops at the current row: it returns the current row's value!",
		},
		{
			kind: "example",
			title: "The surprise of the peers",
			body: "Run it: the three 5200 runs all show 15600, not 5200, 10400, 15600. With the default RANGE frame, tied rows enter the sum together. `rows_running` counts row by row, with `id` as a tie breaker.",
			sql: "SELECT id, score,\n       sum(score) OVER (ORDER BY score DESC) AS range_running,\n       sum(score) OVER (ORDER BY score DESC, id\n         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rows_running\nFROM runs\nWHERE season_id = 4\nORDER BY score DESC, id;",
		},
		{
			kind: "try",
			title: "Your turn: the crowd average",
			prompt:
				"Return the **id** and **score** of every run, plus **avg_all**: the average score of **all** runs (unrounded), on every row.",
			starterSql: "SELECT id, score, avg(score) AS avg_all\nFROM runs;",
			solutionSql: "SELECT id, score, avg(score) OVER () AS avg_all FROM runs;",
			check: { type: "result" },
			hints: [
				"Run the starter: an aggregate next to plain columns needs a GROUP BY... unless it is a window.",
				"Add OVER () right after avg(score).",
			],
		},
	],
	exercises: [
		{
			id: "ch15-ex01",
			title: "The record on every line",
			story:
				"The commissioner prints a card for every run, and each card must show the all time record so delvers know how far they are from glory.",
			prompt:
				"Return the **id** and **score** of every run, plus **best**: the highest score among **all** runs (the same value on every row).",
			difficulty: 1,
			kind: "query",
			concepts: ["window-basics"],
			starterSql: "SELECT id, score, max(score) AS best\nFROM runs;",
			solutionSql: "SELECT id, score, max(score) OVER () AS best FROM runs;",
			check: { type: "result" },
			hints: [
				"Run the starter: max() next to plain columns wants a GROUP BY, which would collapse the runs.",
				"A window function keeps every row: add OVER after the aggregate.",
				"max(score) OVER () AS best",
			],
			explanation:
				"`OVER ()` makes `max` a window function over the whole result: 50 rows stay 50 rows, each carrying 5200.\n\n**Pitfall:** `GROUP BY id, score` makes the error go away but every group is a single run, so `best` just repeats the run's own score.\n\n**Alternative:** a scalar subquery `(SELECT max(score) FROM runs)` gives the same column; windows shine once the total depends on the row's group.",
		},
		{
			id: "ch15-ex02",
			title: "Season by season",
			story:
				"A run worth 2400 is a triumph in the Season of Embers and a shrug in the Season of Shadows. Compare each run with its own season.",
			prompt:
				"Return the **id**, **season_id** and **score** of every run, plus **season_avg**: the average score of the runs **of the same season** (unrounded).",
			difficulty: 2,
			kind: "query",
			concepts: ["window-partition-order"],
			solutionSql:
				"SELECT id, season_id, score, avg(score) OVER (PARTITION BY season_id) AS season_avg FROM runs;",
			check: { type: "result" },
			hints: [
				"Same idea as the record card, but the window must restart for each season.",
				"PARTITION BY inside OVER splits the window into groups.",
				"avg(score) OVER (PARTITION BY season_id)",
			],
			explanation:
				"`PARTITION BY season_id` gives every season its own window: season 1 averages 1290, season 4 about 3004.35.\n\n**Pitfall:** `avg(score) OVER ()` averages the whole table, and `GROUP BY season_id` would leave only 4 rows.\n\n**Alternative:** a correlated subquery `(SELECT avg(score) FROM runs x WHERE x.season_id = r.season_id)` works too, but recomputes the average for every row.",
		},
		{
			id: "ch15-ex03",
			title: "A podium without gaps",
			story:
				"The Season of Shadows trophy room has a shelf per score level: the best score gets shelf 1, the next distinct score shelf 2, and so on. No shelf may stay empty.",
			prompt:
				"For every **season 4** run, return the **id**, the **score** and **pos**: its shelf, where the highest score is 1, equal scores share a shelf and the **next distinct score gets the next number** (no gaps).",
			difficulty: 2,
			kind: "query",
			concepts: ["ranking-functions"],
			solutionSql:
				"SELECT id, score, dense_rank() OVER (ORDER BY score DESC) AS pos FROM runs WHERE season_id = 4;",
			check: { type: "result" },
			hints: [
				"Three runs share 5200: they share shelf 1, and 5100 is on shelf 2.",
				"Of the ranking functions, the one that never skips a number is dense_rank.",
				"dense_rank() OVER (ORDER BY score DESC) AS pos",
			],
			explanation:
				"`dense_rank()` gives ties the same number and continues with the next integer: 1, 1, 1, 2, 3, 4, 4, 5...\n\n**Pitfall:** `rank()` would put 5100 on shelf 4 and leave shelves 2 and 3 empty; `row_number()` splits the 5200 trio into 1, 2, 3.",
		},
		{
			id: "ch15-ex04",
			title: "Fix: the unfair leaderboard",
			story:
				"NightOwl, Ægir and Kaito all scored 5200 in the Season of Shadows, yet the leaderboard shows them 1st, 2nd and 3rd. Three angry messages already reached the commissioner.",
			prompt:
				"Fix the leaderboard: for every **season 4** run return the **id**, **score** and **place**, highest score first, where **tied scores share a place and the next place is skipped** (5200, 5200, 5200, 5100 gives 1, 1, 1, 4).",
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
				"row_number never repeats a number. You need the ranker that shares and then skips.",
				"rank() OVER (ORDER BY score DESC)",
			],
			explanation:
				"`rank()` is the sports ranking: three players tied for 1st, so the next one is 4th.\n\n**Pitfall:** `row_number()` breaks ties arbitrarily (and may break them differently tomorrow), while `dense_rank()` would give 5100 place 2.",
		},
		{
			id: "ch15-ex05",
			title: "NightOwl's progress report",
			story:
				"NightOwl wants to know, run after run, how many points she gained or lost compared with her previous attempt.",
			prompt:
				"For every run of **player 1** (NightOwl), return the **id**, the **score** and **delta**: the score minus the score of her **previous run in time** (`started_at` order). The first run has no previous run: its delta is **NULL**.",
			difficulty: 3,
			kind: "query",
			concepts: ["lag-lead"],
			starterSql:
				"SELECT id, score,\n       score - lead(score) OVER (ORDER BY started_at) AS delta\nFROM runs\nWHERE player_id = 1;",
			solutionSql:
				"SELECT id, score, score - lag(score) OVER (ORDER BY started_at) AS delta FROM runs WHERE player_id = 1;",
			check: { type: "result" },
			hints: [
				"Run the starter: the last run has the NULL, so it looks forward instead of back.",
				"lag reads the previous row, lead the next one.",
				"score - lag(score) OVER (ORDER BY started_at) AS delta",
			],
			explanation:
				"`lag(score)` reads the score of the row just before in the window order: +550, +650, +500, +1300, +400, then -200 and +800.\n\n**Pitfall:** `lead` looks forward, and ordering the window by `score` instead of `started_at` compares her with her next best run, not her previous one.\n\n**Alternative:** `lag(score, 1)` is the same thing spelled out; `lag(score, 1, 0)` would replace the NULL by 0 (not asked here).",
		},
		{
			id: "ch15-ex06",
			title: "Lifetime points",
			story:
				"The arcade awards a medal at 10000 lifetime points. Every delver wants to see their own counter climb.",
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
				"Run the starter: the counter mixes everybody's points together.",
				"Each player needs their own window, still ordered by time.",
				"sum(score) OVER (PARTITION BY player_id ORDER BY started_at)",
			],
			explanation:
				"PARTITION BY restarts the sum for each player, ORDER BY makes it cumulative: NightOwl ends at 26650, Kaito at 20500.\n\n**Pitfall:** without PARTITION BY the total leaks across players; without ORDER BY every row shows the player's grand total.\n\n**Alternative:** a correlated subquery summing earlier runs gives the same numbers but rescans the table for every row.",
		},
		{
			id: "ch15-ex07",
			title: "Fix: the running total that jumps",
			story:
				"The commissioner wanted a running total of season 4 points from the best run down, one run at a time. Instead, the first three lines all read 15600.",
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
				"Make the order total (add the id tie breaker) and count physical rows with a ROWS frame.",
				"OVER (ORDER BY score DESC, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)",
			],
			explanation:
				"The default frame is `RANGE ... CURRENT ROW`, which includes every **peer** of the current row (same ORDER BY value). The ROWS frame stops at the current row itself, and the `id` tie breaker fixes which tied run comes first: 5200, 10400, 15600, 20700...\n\n**Pitfall:** `ROWS` without the `id` tie breaker steps one row at a time but the order among the three 5200 runs is not guaranteed.\n\n**Alternative:** once `id` makes the order total there are no peers left, so the default frame gives the same result; spelling out ROWS says what you mean.",
		},
		{
			id: "ch15-ex08",
			title: "Boss: The Season Chronicle",
			story:
				"The season commissioner wants the Chronicle of the Season of Shadows: one line per run, from the best down, telling how far each run trails the one above and how the pack is moving.",
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
				"lag(r.score) OVER (ORDER BY r.score DESC, r.id) - r.score, and avg(r.score) OVER (ORDER BY r.score DESC, r.id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)",
			],
			explanation:
				"Three windows, three shapes: `rank()` needs only the score (so ties share a place), while `lag` and the moving average need a **total** order, or their values change from run to run. A named window `WINDOW w AS (...)` keeps the OVER clauses short, and `OVER (w ROWS ...)` extends it with a frame.\n\n**Pitfall:** `RANGE BETWEEN 2 PRECEDING` means *scores within 2 points*, not 2 rows, and the default frame would average everything above.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch15-pr01",
			title: "How many of us?",
			prompt:
				"Return every player's **handle** with **players**: the total number of registered players, on every row.",
			difficulty: 1,
			kind: "query",
			concepts: ["window-basics"],
			solutionSql: "SELECT handle, count(*) OVER () AS players FROM players;",
			check: { type: "result" },
			hints: [
				"An aggregate that must not collapse the rows.",
				"count(*) with an empty OVER ().",
				"SELECT handle, count(*) OVER () AS players FROM players;",
			],
			explanation:
				"`count(*) OVER ()` counts the rows of the whole result and repeats the answer (25) on each row.\n\n**Pitfall:** `count(*)` alone needs a GROUP BY and would lose the handles.",
		},
		{
			id: "ch15-pr02",
			title: "The dungeon record",
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
				"PARTITION BY dungeon_id, and no ORDER BY (you want the whole dungeon, not a running max).",
				"max(score) OVER (PARTITION BY dungeon_id)",
			],
			explanation:
				"PARTITION BY gives each dungeon its own window: the Goblin Warrens record is 1200, the Abyssal Spire record 5200.\n\n**Pitfall:** adding `ORDER BY started_at` inside OVER turns it into a *record so far*, which is a different question.",
		},
		{
			id: "ch15-pr03",
			title: "Two rankings of the Frost",
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
				"Ægir and Kaito tie at 3100 (1 and 1), so the 2400 runs are 3rd for `rank` but 2nd for `dense_rank`.\n\n**Alternative:** `WINDOW w AS (ORDER BY score DESC)` then `rank() OVER w, dense_rank() OVER w`.",
		},
		{
			id: "ch15-pr04",
			title: "Four chapters of a career",
			prompt:
				"Split **player 1**'s runs into **4 buckets** of equal size in time order (`started_at`): return the run **id** and **bucket** (1 for her earliest runs, 4 for her latest).",
			difficulty: 2,
			kind: "query",
			concepts: ["ranking-functions"],
			solutionSql:
				"SELECT id, ntile(4) OVER (ORDER BY started_at) AS bucket FROM runs WHERE player_id = 1;",
			check: { type: "result" },
			hints: [
				"There is a ranking function that deals rows into n buckets.",
				"ntile(4), ordered by time.",
				"ntile(4) OVER (ORDER BY started_at) AS bucket",
			],
			explanation:
				"8 runs into 4 buckets gives 2 runs per bucket. With 9 runs the first bucket would get the extra one: ntile buckets differ by at most one row.",
		},
		{
			id: "ch15-pr05",
			title: "When is Kaito back?",
			prompt:
				"For every run of **player 7** (Kaito), return the **id**, the **started_at** and **next_start**: the `started_at` of his **next** run in time, NULL for his latest run.",
			difficulty: 2,
			kind: "query",
			concepts: ["lag-lead"],
			solutionSql:
				"SELECT id, started_at, lead(started_at) OVER (ORDER BY started_at) AS next_start FROM runs WHERE player_id = 7;",
			check: { type: "result" },
			hints: [
				"You need the value from the following row.",
				"lead() looks forward in the window order.",
				"lead(started_at) OVER (ORDER BY started_at)",
			],
			explanation:
				"`lead` reads the next row in window order; the last row has no next one, so it gets NULL.\n\n**Pitfall:** `lag` would return the *previous* run, with the NULL on the first row instead.",
		},
		{
			id: "ch15-pr06",
			title: "Fix: the last value that isn't",
			story:
				"A coach wants each of NightOwl's runs next to her first ever score and her latest score. The latest score column just copies the current row.",
			prompt:
				"For every run of **player 1**, return the **id**, the **score**, **first_score** (score of her earliest run) and **last_score** (score of her **latest** run, the same on every row), using `started_at` order.",
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
				"The default frame ends at the current row. Stretch it to the end of the partition.",
				"OVER (ORDER BY started_at ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)",
			],
			explanation:
				"`last_value` returns the last row **of the frame**, and the default frame stops at the current row. A frame up to `UNBOUNDED FOLLOWING` makes it the true last run (5200).\n\n**Alternative:** `first_value(score) OVER (ORDER BY started_at DESC)` also finds the latest score.",
		},
		{
			id: "ch15-pr07",
			title: "NightOwl's form",
			prompt:
				"For every run of **player 1**, return the **id** and **moving_avg**: the average score of this run and her **2 previous runs** in `started_at` order (fewer for her first two runs), unrounded.",
			difficulty: 3,
			kind: "query",
			concepts: ["window-frames", "running-totals"],
			solutionSql:
				"SELECT id, avg(score) OVER (ORDER BY started_at ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg FROM runs WHERE player_id = 1;",
			check: { type: "result" },
			hints: [
				"A sliding window of 3 rows: two before, plus the current one.",
				"ROWS BETWEEN 2 PRECEDING AND CURRENT ROW.",
				"avg(score) OVER (ORDER BY started_at ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)",
			],
			explanation:
				"The ROWS frame counts physical rows: 1200, then (1200 + 1750) / 2, then three runs at a time.\n\n**Pitfall:** `3 PRECEDING` averages 4 runs (off by one), and without a frame you get a cumulative average.",
		},
		{
			id: "ch15-pr08",
			title: "Runs so far",
			prompt:
				"For every run, return the **season_id**, the run **id** and **runs_so_far**: how many runs of **that season** had started up to and including this one (`started_at` order).",
			difficulty: 2,
			kind: "query",
			concepts: ["running-totals"],
			solutionSql:
				"SELECT season_id, id, count(*) OVER (PARTITION BY season_id ORDER BY started_at) AS runs_so_far FROM runs;",
			check: { type: "result" },
			hints: [
				"A running count, restarting each season.",
				"count(*) with PARTITION BY season_id and ORDER BY started_at.",
				"count(*) OVER (PARTITION BY season_id ORDER BY started_at)",
			],
			explanation:
				"A cumulative count is a running total of ones. Start times are all different, so the default frame and a ROWS frame agree.\n\n**Alternative:** `row_number() OVER (PARTITION BY season_id ORDER BY started_at)` gives the same numbers here.",
		},
	],
};

export default chapter;
