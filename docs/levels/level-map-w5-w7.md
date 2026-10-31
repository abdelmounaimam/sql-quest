## 8. World 5: The Observatory

The season commissioner of the Dungeon Delve arcade hands you the leaderboard and a telescope: from now on you read rows *together*, not one by one. Chapter 17 visits Bardic Beats, whose listeners leave long trails of plays in time.

Data facts every World 5 writer should use (verified):
- `runs` season 4: scores 5200 three times (runs 30 NightOwl, 33 Ægir, 41 Kaito), then 5100, 4900, 4600 twice, 4400, 3300 twice, 3000 twice, 2400 three times, 1600 twice. `rank()` gives 1,1,1,4,5,6,6,8...; `dense_rank()` gives 1,1,1,2,3,4,4,5.
- Season 2 has ties at the top (3100 twice: Ægir run 10, Kaito run 14) and 2400 twice. Season 3 best: Kaito 5000, Ægir 4800, NightOwl and xX_Slayer_Xx 4200.
- NightOwl (player 1) has 8 runs with distinct `started_at` from 1200 to 5200; deltas 550, 650, 500, 1300, 400, -200, 800; running total 26650.
- Best score per dungeon: 1200 (4 runs tie), 1750 (unique), 2400 (5 tie), 3300 (2 tie), 5200 (3 tie). Earliest of the 5200 ties is run 33.
- Players without runs: 15 to 25 except 25 has a login (newbie_42 never ran).
- `daily_logins` exact duplicates: (1, 2026-03-03) ×2, (2, 2026-03-02) ×2, (7, 2026-03-10) ×3. Islands after dedup: player 1: 03-01..05, 03-07..09, 03-12; player 7: 03-08..14 (7 days, longest); player 11: 02-27..03-02 across the month end.
- `achievements` gold: SPIRE_CLIMBER, HOLLOW_CROWN, FLAWLESS. Only Kaito (7) holds all three; Ægir (3) holds two. Nobody holds NIGHT_SHIFT.
- `death_cause` has case/space variants: 'drowned knight', 'goblin king', 'lava golem ' (trailing space). NULL = cleared or abandoned (abandoned = `ended_at IS NULL`: runs 7, 25, 32, 48).
- Overall: median score 2400 (`percentile_cont` = `percentile_disc` = 2400), `mode()` of dungeon_id = 5, `corr(score, floor_reached)` ≈ 0.998. One run belongs to Hollow (region NULL): ROLLUP shows a real NULL region next to subtotal NULLs.
- `bardic.plays`: 144 rows, 2026-02-23 to 2026-03-14 UTC, no play at all on 2026-03-11 (gap fill shows a 0 day). Listener 5 (grimgrin) on 2026-02-23: gaps 6, 6, 6, **30**, **32**, 6 minutes (30 = same session, 32 = new session). Sessions per listener with "gap > 30 min": 10, 6, 6, 3, 7, 5, 7, 2, 3 for listeners 1 to 9; listener 10 never played. UTC-day streaks of 3+ days: listener 1 02-23..27 (5) and 03-02..04 (3); listener 5 02-23..26 (4); listener 7 02-23..25 and 02-27..03-02 (4). Play 136 (listener 9) is a 4.2 s skip.

### ch15-windows-on-the-ranks · Windows on the Ranks 🪟
- **File** `src/content/chapters/ch15-windows-on-the-ranks.ts` · **World** The Observatory · **Tier** adept · **Track** query · **Dataset** `dungeon`
- **Subtitle** Rankings, running totals and before/after comparisons without losing a single row
- **Concepts** `window-basics`, `window-partition-order`, `ranking-functions`, `lag-lead`, `window-frames`, `running-totals`
- **Prerequisites** `ch13-unions-and-named-spells`
- **Lesson** (10 steps)
  1. explain · Aggregates that don't collapse: `avg(score) OVER ()` puts the total next to every row; GROUP BY would merge rows.
  2. example · Every run vs the season average: `SELECT id, score, avg(score) OVER (PARTITION BY season_id) FROM runs`
  3. explain · PARTITION BY and ORDER BY inside OVER: partition restarts, order makes it cumulative.
  4. example · NightOwl's running total: `SELECT started_at, score, sum(score) OVER (ORDER BY started_at) FROM runs WHERE player_id = 1`
  5. quiz · `row_number`, `rank`, `dense_rank` on 5200, 5200, 5200, 5100: what does `rank()` give the 5100? (rank vs dense_rank confusion; answer 4)
  6. example · The three rankers side by side on season 4 (shows 1,1,1,4 vs 1,1,1,2).
  7. explain · LAG and LEAD: previous/next row, default value for the edges, always with an ORDER BY.
  8. quiz · Can you write `WHERE rank() OVER (...) <= 3`? (windows run after WHERE: 42P20; wrap in a CTE)
  9. explain · Frames: default `RANGE UNBOUNDED PRECEDING AND CURRENT ROW` treats ties as peers; `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` for moving averages; `last_value` surprise.
  10. try · Season averages: return `id`, `score` and the overall average score of all runs next to each run.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch15-ex01 | For every run return **id**, **score** and **best**, the highest score of all runs (same value on every row). | 1 | query | result | window-basics | write |
| ch15-ex02 | For every run return **id**, **season_id**, **score** and the **average score of its season** (numeric, tolerance default). | 2 | query | result | window-partition-order | write |
| ch15-ex03 | Season 4 podium: return **id**, **score** and **pos** where pos is the `dense_rank` by score (highest = 1), for every season 4 run. | 2 | query | result | ranking-functions | write |
| ch15-ex04 | Fix: the commissioner's leaderboard uses `row_number()` and gives NightOwl, Ægir and Kaito different places for the same 5200. Return **id**, **score** and **place** for season 4 runs with **tied scores sharing a place and the next place skipping** (1, 1, 1, 4). | 2 | query | result | ranking-functions | fix |
| ch15-ex05 | NightOwl's progress: for player 1's runs return **id**, **score** and **delta**, the score minus the previous run's score in time order (NULL for the first run). | 3 | query | result | lag-lead | write |
| ch15-ex06 | For every player's runs return **player_id**, **id**, **score** and **running_total**: the cumulative score of that player's runs in `started_at` order. | 3 | query | result | running-totals, window-partition-order | write |
| ch15-ex07 | Fix: a "running total by score" uses `sum(score) OVER (ORDER BY score)` on season 4 and the three 5200 runs jump together. Return **id**, **score**, **running** for season 4 runs ordered by score descending **then id**, where each row adds exactly its own score (use a ROWS frame and the id tie breaker inside OVER). | 4 | query | result | window-frames | fix |
| ch15-ex08 | **Boss · The Season Chronicle**: for every season 4 run return **handle**, **score**, **season_rank** (`rank()` by score desc), **gap_to_previous** (score difference with the run just above in that ranking, ordered by score desc then id; NULL for the first) and **moving_avg** (average of that run and the 2 runs above it in the same ordering). Rows in ranking order (score desc, id). | 5 | query | result (ordered) | ranking-functions, lag-lead, window-frames, running-totals | write |

- **Practice**: `ch15-pr01` window-basics: every player's **handle** and the total number of players next to it; `ch15-pr02` window-partition-order: per run **id**, **dungeon_id**, **score** and the best score in that dungeon; `ch15-pr03` ranking-functions: season 2 runs with `rank` and `dense_rank` (two columns, see the 3100 tie); `ch15-pr04` ranking-functions: split NightOwl's 8 runs into 4 `ntile` buckets by started_at; `ch15-pr05` lag-lead: for Kaito's runs, **id** and the **started_at of his next run** (LEAD), NULL at the end; `ch15-pr06` window-frames: player 1 runs with `first_value(score)` and `last_value(score)` over the whole partition (`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`); `ch15-pr07` window-frames: 3-run moving average of NightOwl's scores; `ch15-pr08` running-totals: cumulative runs count per season in start order.
- **Negative cases to add**: `row_number()` where rank is required (ex04); `rank()` vs `dense_rank()` swapped (ex03); LAG without PARTITION BY leaking values across players (ex06 uses `sum ... OVER (ORDER BY started_at)` without partition); default RANGE frame in ex07; `last_value` with the default frame (pr06). Accept `WINDOW w AS (...)` named windows and `lag(score, 1)` vs `lag(score)`.
- **Notes**: ex08 needs a total order inside every OVER (`ORDER BY score DESC, id`) or `rank()` stays tie-aware while LAG/AVG become nondeterministic; state it in the prompt. Moving average values need tolerance (default 1e-6 is fine with numeric). Filtering on a window result requires a CTE or subquery (ch13 taught CTEs); keep that for ch16.

### ch16-champions-of-each-dungeon · Champions of Each Dungeon 🥇
- **File** `src/content/chapters/ch16-champions-of-each-dungeon.ts` · **World** The Observatory · **Tier** expert · **Track** query · **Dataset** `dungeon`
- **Subtitle** One best row per group, the top N per group, and the doubles to throw away
- **Concepts** `distinct-on`, `top-n-per-group`, `lateral-join`, `deduplication`
- **Prerequisites** `ch15-windows-on-the-ranks`
- **Lesson** (9 steps)
  1. explain · The most asked question in analytics: "the best X of each Y". Three tools: DISTINCT ON, row_number in a subquery, LATERAL.
  2. example · Best run per dungeon with DISTINCT ON: `SELECT DISTINCT ON (dungeon_id) dungeon_id, id, score FROM runs ORDER BY dungeon_id, score DESC, started_at`
  3. quiz · What happens with `DISTINCT ON (dungeon_id) ... ORDER BY score DESC`? (42P10: ORDER BY must start with the DISTINCT ON expressions)
  4. explain · Top N per group: `row_number() OVER (PARTITION BY ... ORDER BY ...)` in a CTE, then `WHERE rn <= N` outside (you cannot filter a window in the same SELECT).
  5. example · Top 2 runs of each player with a CTE and row_number.
  6. explain · LATERAL: a subquery in FROM that can see the current row of the table before it; `LEFT JOIN LATERAL (...) ON true` keeps players with no runs.
  7. example · Every player's latest run, newbies included: `SELECT p.handle, r.score FROM players p LEFT JOIN LATERAL (SELECT score FROM runs WHERE player_id = p.id ORDER BY started_at DESC LIMIT 1) r ON true`
  8. explain · Duplicates: find them with `GROUP BY ... HAVING count(*) > 1`, keep one copy with DISTINCT or row_number; the fix that sticks is a UNIQUE constraint (World 7).
  9. try · Doubled logins: return **player_id**, **day** and **copies** for every login row that appears more than once in `daily_logins`.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch16-ex01 | Each player's best run: return **player_id**, **id** (run) and **score** of the highest scoring run of every player who has runs; ties broken by the **earliest started_at**. Use DISTINCT ON. | 2 | query | result | distinct-on | write |
| ch16-ex02 | Fix: `SELECT DISTINCT ON (dungeon_id) dungeon_id, id, score FROM runs ORDER BY score DESC;` fails. Return the champion run per dungeon (**dungeon_id**, **id**, **score**), ties broken by earliest started_at. | 2 | query | result | distinct-on | fix |
| ch16-ex03 | Top 3 runs of each season: return **season_id**, **id**, **score** for the 3 highest scoring runs of each season, ties broken by **earliest started_at** (exactly 3 rows per season). | 3 | query | result | top-n-per-group | write |
| ch16-ex04 | Fair podium: return **season_id**, **id**, **score** for every run whose `rank()` within its season (by score, highest first) is 3 or better, ties included (season 2 returns 4 rows: 3100, 3100, 2400, 2400). | 3 | query | result | top-n-per-group | write |
| ch16-ex05 | Latest run of every player, players without runs included: return **handle**, **score** and **started_at** of each player's most recent run (NULLs when none). Use LATERAL. | 3 | query | result | lateral-join | write |
| ch16-ex06 | Each player's two best runs with LATERAL: **handle**, **score**, only players with runs, ties broken by earliest started_at. | 3 | query | result | lateral-join, top-n-per-group | refactor |
| ch16-ex07 | Clean login book: return **player_id** and **day** of `daily_logins` with each pair exactly once (31 rows: 35 minus 4 extra copies). | 1 | query | result | deduplication | write |
| ch16-ex08 | Fix: the anti-cheat bot counts logins per player with `count(*)` and NightOwl gets 10 instead of 9. Return **player_id** and **days_logged** (distinct days) for every player in `daily_logins`. | 2 | query | result | deduplication | fix |
| ch16-ex09 | **Boss · The Champions' Gallery**: for each dungeon (all 5) return **dungeon** (name), **champion** (handle of the best run, earliest started_at on ties), **score**, and **runner_up** (handle of the second best run by the same order, NULL if none). | 5 | query | result | distinct-on, top-n-per-group, lateral-join | write |

- **Practice**: `ch16-pr01` distinct-on: each player's first ever run (**player_id**, **id**, **started_at**); `ch16-pr02` distinct-on: the most recent unlock of each achievement (**achievement_id**, **player_id**, **unlocked_at**), achievements never unlocked excluded; `ch16-pr03` top-n-per-group: the 2 longest runs (ended_at minus started_at) per dungeon, abandoned runs excluded, ties by id; `ch16-pr04` top-n-per-group: top 1 per region with ties (`rank() = 1`) of best scores; `ch16-pr05` lateral-join: for every dungeon, its name and its 2 most recent runs (id, started_at) via LATERAL, dungeons without runs excluded; `ch16-pr06` deduplication: list the duplicated (player_id, day) pairs and how many extra copies each has (copies minus 1); `ch16-pr07` deduplication: number every login row with `row_number() OVER (PARTITION BY player_id, day)` and return only rows numbered 2 or more (the ones a cleanup would delete).
- **Negative cases to add**: `max(score)` then join back (returns tied duplicates, ex01 on dungeon 1 has 4 ties); `DISTINCT ON` without tie breaker (accept only if the prompt has no tie; here it must include `started_at`); `WHERE rn <= 3` in the same SELECT (42703, rejected by error); `rank()` used for ex03 (returns extra rows); `JOIN LATERAL` instead of `LEFT JOIN LATERAL` in ex05 (drops newbies); `count(*)` in ex08. Accept: the row_number CTE version of ex01, `DISTINCT` and `GROUP BY` versions of ex07, `count(DISTINCT day)` in ex08.
- **Notes**: DELETE is only taught in ch20 (World 6 may be locked), so deduplication stays SELECT-based here; mention in an explain card that ch20 shows `DELETE ... USING` with `ctid`. ex03 has no tie at position 3 in any season when broken by started_at; ex04 shows why rank() returns more rows.

### ch17-patterns-in-time · Patterns in Time ⏳
- **File** `src/content/chapters/ch17-patterns-in-time.ts` · **World** The Observatory · **Tier** expert · **Track** query · **Dataset** `bardic`
- **Subtitle** Buckets, empty days, streaks and listening sessions
- **Concepts** `date-bucketing`, `time-series-gap-fill`, `gaps-and-islands`, `sessionization`
- **Prerequisites** `ch15-windows-on-the-ranks`
- **Lesson** (10 steps)
  1. explain · Welcome to Bardic Beats: `plays` is an event stream (who played what, when). Time questions need buckets.
  2. example · Plays per day: `SELECT date_trunc('day', played_at) AS day, count(*) FROM plays GROUP BY 1 ORDER BY 1`
  3. explain · `date_trunc` vs `date_bin('15 minutes', ts, origin)`; keep buckets as timestamps, not `to_char` text (text sorts wrong).
  4. quiz · Plays per day shows no row for 2026-03-11. Why? (GROUP BY cannot invent empty groups)
  5. example · Gap fill: `generate_series('2026-02-23', '2026-03-14', interval '1 day')` LEFT JOIN plays, `count(p.id)`.
  6. quiz · After the LEFT JOIN, `count(*)` gives 1 on the empty day. Which count gives 0? (count(*) vs count(col))
  7. explain · Islands: consecutive days minus their row_number are constant inside a streak; group by that difference.
  8. example · Listener 1's UTC listening days with `day - row_number()` shown as a column.
  9. explain · Sessions: flag a row when the gap since the previous play is more than 30 minutes (or it is the first), then a running sum of flags numbers the sessions.
  10. try · Daily counts: return **day** (date) and **plays** for every day that has at least one play.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch17-ex01 | Return **hour** (timestamp truncated to the hour) and **plays** for 2026-02-23 (UTC), only hours with plays. | 2 | query | result | date-bucketing | write |
| ch17-ex02 | Return **slot** (`date_bin` 15 minute buckets aligned on midnight UTC) and **plays** for listener 5's plays. | 2 | query | result | date-bucketing | write |
| ch17-ex03 | Fix: a daily chart uses `to_char(played_at, 'DD/MM')` and sorts 01/03 before 23/02. Return **day** (a date) and **plays** for every day with plays, **ordered by day**. | 2 | query | result (ordered) | date-bucketing | fix |
| ch17-ex04 | Full calendar: return **day** and **plays** for **every** day from 2026-02-23 to 2026-03-14 inclusive, 0 for days without plays (2026-03-11 must show 0). | 3 | query | result | time-series-gap-fill | write |
| ch17-ex05 | Fix: the calendar above filters `WHERE p.listener_id = 1` after the LEFT JOIN and loses empty days. Return **day** and **plays** of listener 1 for every day of the same range, 0 included. | 3 | query | result | time-series-gap-fill | fix |
| ch17-ex06 | Listening streaks: return **listener_id**, **streak_start**, **streak_end** and **days** for every run of consecutive UTC days with plays lasting **3 days or more**. | 4 | query | result | gaps-and-islands | write |
| ch17-ex07 | Sessions: return **listener_id** and **sessions**, the number of listening sessions of every listener who played, where a new session starts when more than 30 minutes passed since that listener's previous play. | 4 | query | result | sessionization | write |
| ch17-ex08 | **Boss · The Bard's Almanac**: one row per session of listener 5 (grimgrin): **session_no** (1, 2, ... in time order), **started**, **ended** (first and last play), **plays** and **minutes_listened** (sum of ms_played / 60000.0). Ordered by session_no. | 5 | query | result (ordered) | sessionization, date-bucketing | write |

- **Practice**: `ch17-pr01` date-bucketing: plays per ISO week (`date_trunc('week', ...)`, weeks start Monday); `ch17-pr02` time-series-gap-fill: hourly plays of 2026-02-23 including empty hours (24 rows); `ch17-pr03` time-series-gap-fill: for every listener and every day of the first week (02-23..03-01), number of plays, 0 included (cross join listeners × series); `ch17-pr04` gaps-and-islands: the longest streak in days of each listener who played (**listener_id**, **longest**); `ch17-pr05` gaps-and-islands: gaps: days without plays between 2026-02-23 and 2026-03-14 (the only one is 2026-03-11) using LAG on the daily list; `ch17-pr06` sessionization: for listener 5, every play with **gap_minutes** since the previous play and **new_session** boolean (30 vs 32 minute rows); `ch17-pr07` sessionization: fix the boundary: a query with `>= interval '30 minutes'` splits the 30 minute gap; return the session count of listener 5 (7).
- **Negative cases to add**: `count(*)` after the LEFT JOIN (ex04 gives 1 on 03-11); filter in WHERE instead of in the ON clause (ex05); `>=` 30 minutes (ex07 and pr07); session flags without PARTITION BY listener (ex07); text buckets (ex03); islands without deduplicating days first (multiple plays per day break `day - row_number`). Accept: `date_trunc('day', played_at)::date` and `played_at::date`; `count(p.id)` and `count(p.played_at)`; LAG/flag/sum method and the row_number difference method for islands.
- **Notes**: session TimeZone is GMT, so `::date` = UTC day; say "UTC days" in every prompt. Local days via `AT TIME ZONE` belong to ch33 (timezones); mention listener 2 (Tokyo) only as a teaser card. `generate_series` over timestamps returns timestamptz: cast to date for the output. Boss: minutes as numeric with tolerance.

### ch18-the-grand-report · The Grand Report 📊
- **File** `src/content/chapters/ch18-the-grand-report.ts` · **World** The Observatory · **Tier** expert · **Track** query · **Dataset** `dungeon`
- **Subtitle** Subtotals, pivots, medians, correlations and "who did them all"
- **Concepts** `grouping-sets`, `pivoting`, `statistical-aggregates`, `ordered-set-aggregates`, `relational-division`, `random-sampling`
- **Prerequisites** `ch16-champions-of-each-dungeon`, `ch12-exists-or-not`
- **Lesson** (10 steps)
  1. explain · Reports want several levels at once: per region and dungeon, per region, grand total. `GROUP BY ROLLUP (region, dungeon)` does it in one pass.
  2. example · ROLLUP on runs by region and dungeon with count and sum.
  3. quiz · In the ROLLUP output there are two kinds of NULL region. How do you tell Hollow's real NULL region from a subtotal? (`GROUPING(region)`)
  4. explain · Pivot: one column per category with `count(*) FILTER (WHERE season_id = 1) AS s1`; tablefunc `crosstab` exists but needs declared output columns.
  5. example · Runs per dungeon × season pivot with FILTER.
  6. explain · Medians are not `avg`: `percentile_cont(0.5) WITHIN GROUP (ORDER BY score)`; `percentile_disc` returns a real value; `mode()`.
  7. explain · Spread and relationships: `stddev_samp` vs `stddev_pop`, `corr(score, floor_reached)`, `regr_slope`; correlation is not causation.
  8. explain · Relational division: "players who hold ALL gold badges" = count of their gold badges equals the number of gold badges (or double NOT EXISTS).
  9. explain · Random samples: `ORDER BY random() LIMIT n` sorts everything; `TABLESAMPLE BERNOULLI (1) REPEATABLE (42)` is reproducible.
  10. try · Median score: return the median score of all runs with percentile_cont.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch18-ex01 | Return **region**, **runs** and **total_score** per player region plus a grand total row (ROLLUP on region only). | 2 | query | result | grouping-sets | write |
| ch18-ex02 | Fix: the ROLLUP by region and dungeon name labels subtotals as NULL and Hollow's NULL region looks like a subtotal. Return **region** (shown as `'(all)'` on subtotal rows only, real NULL kept as NULL), **dungeon** (`'(all)'` on subtotal rows), **runs**. | 4 | query | result | grouping-sets | fix |
| ch18-ex03 | Pivot: one row per dungeon (**dungeon_id**) with columns **s1**, **s2**, **s3**, **s4**: number of runs in each season (0 when none). | 3 | query | result | pivoting | write |
| ch18-ex04 | Return the **median** (percentile_cont), the **p90** (percentile_cont 0.9) and the **most common dungeon_id** (mode) over all runs. | 3 | query | result | ordered-set-aggregates | write |
| ch18-ex05 | Return **dungeon_id**, **sd** (`stddev_samp` of score) and **r** (`corr(score, floor_reached)`) per dungeon, for dungeons with at least 3 runs. | 3 | query | result | statistical-aggregates | write |
| ch18-ex06 | Hall of the Gilded: return the **handle** of every player who holds **all** gold achievements (only Kaito). | 4 | query | result | relational-division | write |
| ch18-ex07 | Reproducible audit: return the **number of rows** of `run_archive` sampled with `TABLESAMPLE BERNOULLI (1) REPEATABLE (42)`. | 2 | query | result | random-sampling | write |
| ch18-ex08 | **Boss · The Astronomer's Almanac**: for each season, the top 3 players by their **best score** in that season using `rank()` (ties included, so 14 rows): **season_id**, **place**, **handle**, **best_score**, **longest_streak** (longest run of consecutive login days in `daily_logins` after deduplication, 0 if none), and a pivot of that player's runs in that season: **easy** (dungeon difficulty 1 or 2), **mid** (3), **hard** (4 or 5). Ordered by season_id, place, handle. | 5 | query | result (ordered) | grouping-sets, pivoting, relational-division, top-n-per-group, gaps-and-islands | write |

- **Practice**: `ch18-pr01` grouping-sets: `GROUPING SETS ((season_id), (dungeon_id), ())` with runs count; `ch18-pr02` grouping-sets: CUBE on region and season with a `GROUPING(...)` bitmask column; `ch18-pr03` pivoting: per region, number of runs per death outcome (cleared, died, abandoned) as three FILTER columns; `ch18-pr04` pivoting: the same s1..s4 pivot with `crosstab` (two-argument form, declared columns, dungeons without runs in a season show NULL); `ch18-pr05` statistical-aggregates: `regr_slope(score, floor_reached)` and `regr_intercept` over all runs (tolerance); `ch18-pr06` ordered-set-aggregates: median run duration in minutes per dungeon (finished runs only); `ch18-pr07` relational-division: players who hold every **silver** achievement (CRYPT_WALKER, WEB_CUTTER, FIRE_WALKER: only NightOwl, player 1); `ch18-pr08` relational-division: double NOT EXISTS version of ex06; `ch18-pr09` random-sampling: `SELECT setseed(0.42); SELECT handle FROM players ORDER BY random() LIMIT 3;` (deterministic within one SQL run: same seed statement required in the prompt).
- **Negative cases to add**: `COALESCE(region, '(all)')` in ex02 (relabels Hollow); `count(*)` without FILTER per season (ex03); `avg(score)` as median (ex04); `stddev_pop` vs `stddev_samp` (ex05); `count(*) = 3` without restricting to gold, or IN-list "any gold" (ex06); `ORDER BY random()` without seed (ex07 and pr09 rejected because nondeterministic). Accept: `sum(CASE WHEN ... THEN 1 ELSE 0 END)` pivots, double NOT EXISTS division, `percentile_disc` NOT accepted for percentile_cont missions (say "interpolated" in the prompt).
- **Notes**: `random()` results differ between the learner and solution sandboxes unless both run `setseed` first in the same SQL: prompts must spell out the seed statement. `crosstab` requires `tablefunc` (loaded by the dungeon dataset); its source query must be ordered. The boss is long: build it with CTEs (best per player/season, deduped login islands, pivot) and give hint 3 as the CTE skeleton. Verified boss row count: 3 + 4 + 4 + 3 = 14.

## 9. World 6: The Forge

Back at the Starport, but now you hold the hammer: INSERT, UPDATE, DELETE, transactions and imports. Every mission is graded on the **final state** of the data (`state` checks), so prompts must say exactly which rows end up where. The app runs each mission on a fresh clone, so learners can experiment freely. World 6 opens after ch08 (prerequisite graph); ch20 also needs the joins of World 3.

Data facts (verified on `starport`): next identity values are planets 13, factions 7, pilots 25, ships 22, commodities 17, trades 41, seizures 9, manifest_lines 15. Unique keys: `planets.name`, `factions.name`, `pilots.callsign` (NULLs allowed many times), `ships.name`, `commodities.name`. CHECKs: `pilots.credits >= 0` (23514), `trades.qty > 0`, `trades.side IN ('buy','sell')`, `ships.cargo_capacity > 0`, `hull_integrity BETWEEN 0 AND 100`. Deleting pilot 2 fails with 23503 (mentor of pilots 6 and 15, owner of ships 2 and 20). `TRUNCATE ships` fails with 0A000 (referenced by trades); `TRUNCATE trades RESTART IDENTITY` works. `price_feed` quotes Water Ice twice (12.50 at 08:00, 12.75 at 09:30), Comet Tea and Void Pearls and Quantum Chips exist in `commodities`, Asteroid Honey does not; a naive `INSERT ... ON CONFLICT DO UPDATE` or `MERGE` over the raw feed fails with **21000** (row affected twice).

### ch19-forging-rows · Forging Rows ⚒️
- **File** `src/content/chapters/ch19-forging-rows.ts` · **World** The Forge · **Tier** novice · **Track** mutation · **Dataset** `starport`
- **Subtitle** INSERT new pilots, planets and cargo, and get their ids back
- **Concepts** `insert-basic`, `insert-multi-row`, `default-values`, `returning-clause`, `insert-select`, `sequences`
- **Prerequisites** `ch08-tally-the-loot`
- **Lesson** (9 steps)
  1. explain · Reading is over, time to write: `INSERT INTO table (columns) VALUES (values);` always name the columns.
  2. example · Register a planet: `INSERT INTO planets (name, sector) VALUES ('Nova Prime', 'Frontier'); SELECT * FROM planets WHERE name = 'Nova Prime';` (id 13 appears by itself).
  3. explain · Omitted columns get their DEFAULT (has_spaceport false, reputation 0) or NULL; `DEFAULT` keyword; identity ids come from a sequence.
  4. quiz · You insert `(name, sector)` but list `VALUES ('Frontier', 'Nova Prime')`. What happens? (silently swapped, same types)
  5. explain · Several rows in one statement: `VALUES (...), (...);` one failing row aborts the whole statement.
  6. example · RETURNING: `INSERT INTO factions (name, founded_year) VALUES ('Comet Riders', 2078) RETURNING id, name;`
  7. explain · INSERT ... SELECT copies the result of a query into a table.
  8. explain · Sequences hand out numbers and never give them back: a failed insert still burns an id. Gaps are normal; never "fill" them.
  9. try · Register the planet **Glimmerfall** in sector **Frontier** (other columns default).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch19-ex01 | Register planet **Nova Prime**, sector **Frontier**, population **12000**, gravity **0.88**; other columns default. verify: `SELECT name, sector, population, gravity, has_spaceport FROM planets ORDER BY id` | 1 | mutation | state | insert-basic | mutate |
| ch19-ex02 | Fix: `INSERT INTO commodities VALUES ('Moon Cheese', 'food', 14.00, true, 'wheel');` fails (no column list, id comes first). Add the commodity Moon Cheese, food, 14.00, legal, sold by the wheel. verify commodities by id | 1 | mutation | state | insert-basic | fix |
| ch19-ex03 | Three new cadets in one statement: **Ivy Starling**, **Bo Ruckus**, **Mox** (all Human cadets, joined 2078-01-10 00:00 UTC, no faction, no callsign). verify pilots name/rank/species ordered by id | 2 | mutation | state | insert-multi-row | mutate |
| ch19-ex04 | Insert pilot **Kip Lanyard** (Vulpine, ensign, joined 2078-02-01 00:00 UTC) relying on defaults, so `reputation` is the default and `credits` is NULL. verify name, credits, reputation | 2 | mutation | state | default-values | mutate |
| ch19-ex05 | Register ship **Dawn Treader** (model Courier Mk II, pilot 4, capacity 40) and **return its id and name**. | 2 | mutation | result+state | returning-clause | write |
| ch19-ex06 | Archive the contraband: setupSql creates `contraband_archive(commodity_id int, name text, base_price numeric)`. Copy every illegal commodity into it with INSERT ... SELECT. verify the archive ordered by commodity_id | 3 | mutation | state | insert-select | write |
| ch19-ex07 | Gaps are normal: setupSql inserted and deleted a planet named Temp (id 13 is burned). Register **Sable Spire** (sector Frontier) and **return its id** (14). | 3 | mutation | result+state | sequences | predict |
| ch19-ex08 | **Boss · The New Arrivals**: a convoy lands. In one statement insert the 4 pilots listed in setupSql table `arrivals(name, species, rank, callsign)` as pilots joined at **2078-03-01 00:00 UTC** (other columns default), and **return** the new **id**, **name** and **callsign**. | 4 | mutation | result+state | insert-select, returning-clause, default-values | write |

- **Practice**: `ch19-pr01` insert-basic: add faction **Comet Riders** founded 2078 (homeworld Zephyria, id 5); `ch19-pr02` insert-multi-row: add the routes 11→2 and 2→11 (3.9 ly each) in one statement; `ch19-pr03` default-values: insert a planet using the `DEFAULT` keyword for has_spaceport; `ch19-pr04` returning-clause: insert a trade and return its id and `qty * unit_price` as **value**; `ch19-pr05` insert-select: copy every Frontier planet's name into setupSql table `frontier_watch(planet text)`; `ch19-pr06` sequences: return `currval` right after an INSERT RETURNING into ships (22); `ch19-pr07` sequences: predict the id of the next planet after setupSql inserted and deleted one (14, not 13).
- **Negative cases to add**: columns swapped in VALUES (ex01, ex03); explicit `NULL` for has_spaceport instead of default (ex01: NULL vs false, but has_spaceport is NOT NULL so it errors); explicit `0` for credits in ex04; second SELECT instead of RETURNING (ex05: no result set → rejected); `SELECT *` into the archive with different column order (ex06). Accept: `DEFAULT` keyword versions, `INSERT ... SELECT ... FROM (VALUES ...)` for ex03.
- **Notes**: ex07 setupSql: `INSERT INTO planets (name) VALUES ('Temp'); DELETE FROM planets WHERE name = 'Temp';` so the next id is 14. Do not write missions whose correct answer contains a failing statement: the app stops at the first error. `joined_at` is NOT NULL on pilots: every pilot insert must supply it (state it in the prompt). ex08 setupSql: `CREATE TABLE arrivals (...); INSERT ...` with 4 valid rows; the prompt says to keep their callsigns.

### ch20-reforging-and-banishing · Reforging and Banishing 🔥
- **File** `src/content/chapters/ch20-reforging-and-banishing.ts` · **World** The Forge · **Tier** apprentice · **Track** mutation · **Dataset** `starport`
- **Subtitle** UPDATE and DELETE, with joins, and without forgetting the WHERE
- **Concepts** `update-basic`, `update-from`, `delete-basic`, `delete-using`, `truncate`
- **Prerequisites** `ch19-forging-rows`, `ch10-outer-gates-and-mirrors`
- **Lesson** (9 steps)
  1. explain · `UPDATE table SET col = value WHERE ...;` test the WHERE with a SELECT first.
  2. example · Repair the Fizzbang: `UPDATE ships SET hull_integrity = 80 WHERE id = 6 RETURNING name, hull_integrity;`
  3. quiz · `UPDATE pilots SET credits = 0 AND reputation = 0 WHERE id = 9;` What does it do? (assigns a boolean expression to credits: 42804; use commas)
  4. explain · Expressions in SET use the old values: `SET credits = credits + 100`; `SET a = b, b = a` swaps.
  5. explain · UPDATE ... FROM: join another table to decide which rows and which values.
  6. example · Fine Customs' victims: `UPDATE pilots p SET reputation = reputation - 50 FROM ships s WHERE s.pilot_id = p.id AND s.id IN (SELECT ship_id FROM seizures)`
  7. explain · DELETE FROM ... WHERE; DELETE ... USING for joins; foreign keys may refuse (23503).
  8. explain · TRUNCATE empties whole tables fast; `RESTART IDENTITY`; refused when another table references it (0A000) unless CASCADE.
  9. try · Promote **Wren Calloway** (pilot 22) to **ensign**.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch20-ex01 | Give every **cadet** 100 extra credits (NULL stays NULL). verify `SELECT id, credits FROM pilots ORDER BY id` | 1 | mutation | state | update-basic | mutate |
| ch20-ex02 | Fix: `UPDATE ships SET hull_integrity = 100;` repaired the whole fleet. Repair only ships whose hull is **below 30**. verify ships id, hull | 1 | mutation | state | update-basic | fix |
| ch20-ex03 | Reprice: set `base_price` of every commodity to the **average unit_price of its sell trades**, only for commodities that have sell trades with a known price (UPDATE ... FROM a grouped subquery). verify commodities id, base_price | 3 | mutation | state | update-from | write |
| ch20-ex04 | Delete every seizure whose fine is still pending. verify seizures ids | 1 | mutation | state | delete-basic | mutate |
| ch20-ex05 | Banish the trades of the ship **100% Legit** (find it by name with DELETE ... USING ships). verify `SELECT id FROM trades ORDER BY id` | 2 | mutation | state | delete-using | write |
| ch20-ex06 | Error mission: delete pilot **Bram Kettle** (id 2). It must fail: which error? Write the DELETE; check expects **23503**. | 2 | mutation | error 23503 | delete-basic | predict |
| ch20-ex07 | Wipe the trade journal and restart its numbering: after your SQL, `trades` is empty and the next inserted trade gets id 1. verify `SELECT (SELECT count(*) FROM trades) AS rows_left, nextval(pg_get_serial_sequence('trades', 'id')) AS next_id` (1 call per side, so deterministic) | 2 | mutation | state | truncate | write |
| ch20-ex08 | **Boss · The Smugglers' Reckoning**: in this order: (1) every pilot whose ships were seized at least twice loses 200 reputation (UPDATE ... FROM), (2) delete the seizures of commodity **Glow Shrooms** older than 2077-01-01 (DELETE ... USING commodities), (3) set hull_integrity to 50 for ships with a NULL hull that belong to a pilot. verify pilots (id, reputation), seizures ids, ships (id, hull) as three columns of one union query or three verify queries combined in one SELECT of jsonb. | 5 | mutation | state | update-from, delete-using, update-basic | write |

- **Practice**: `ch20-pr01` update-basic: double the cargo capacity of Courier Mk II ships; `ch20-pr02` update-basic: swap `min_rep` and `max_rep` of tier 'outlaw' in one SET (shows simultaneous assignment); `ch20-pr03` update-from: set every pilot's `home_planet_id` to their faction's homeworld when the pilot has none (Lumen has no faction: stays NULL); `ch20-pr04` delete-basic: delete routes with hazard 'pirates'; `ch20-pr05` delete-using: delete manifest_lines of ships whose model is 'Viper X'; `ch20-pr06` truncate: error mission `TRUNCATE ships` → **0A000**; `ch20-pr07` delete-basic: fix `DELETE FROM routes WHERE hazard = NULL` (deletes nothing) so it deletes every lane with no hazard recorded.
- **Negative cases to add**: missing WHERE (ex01, ex02); `credits + 100` with COALESCE turning NULL into 100 (ex01); UPDATE ... FROM with an ungrouped join that picks an arbitrary trade (ex03); `DELETE ... WHERE ship_id = 21` hard-coded id is accepted (equivalent), but `name LIKE '%Legit%'` also accepted; `TRUNCATE trades` without RESTART IDENTITY (ex07); `NOT IN` with NULLs in a delete subquery. Accept: subquery `WHERE ship_id IN (SELECT id FROM ships WHERE ...)` versions of DELETE ... USING.
- **Notes**: verifySql must not depend on the order of physical rows: always ORDER BY a key. For ex07 use verify `SELECT (SELECT count(*) FROM trades), (SELECT last_value FROM trades_id_seq)` plus `is_called`, or simpler: have the verify INSERT a trade and return its id (verifySql can contain several statements; the last result counts). Boss verify: combine with `SELECT 'pilot' AS t, id, reputation::text FROM pilots UNION ALL ...` ordered.

### ch21-the-pact · The Pact 🤝
- **File** `src/content/chapters/ch21-the-pact.ts` · **World** The Forge · **Tier** apprentice · **Track** mutation · **Dataset** `starport`
- **Subtitle** All or nothing: transactions, savepoints and reading constraint errors
- **Concepts** `transactions-basics`, `savepoints`, `constraint-errors`
- **Prerequisites** `ch20-reforging-and-banishing`
- **Lesson** (9 steps)
  1. explain · A credit transfer is two UPDATEs. If the second fails, the first must not stay: `BEGIN; ...; COMMIT;`
  2. example · Ada pays Dax 500 credits inside BEGIN/COMMIT, then SELECT both wallets.
  3. explain · ROLLBACK undoes everything since BEGIN; without BEGIN each statement commits by itself (autocommit).
  4. quiz · Inside a transaction a statement fails. What happens to the next statements? (25P02: transaction aborted until ROLLBACK)
  5. explain · SAVEPOINT marks a point; `ROLLBACK TO SAVEPOINT s` undoes only what came after it; RELEASE forgets it.
  6. example · Two price changes, roll back the second with a savepoint, commit the first.
  7. explain · Constraint errors carry a code and a DETAIL: 23502 not null, 23503 foreign key, 23505 unique, 23514 check. Read the DETAIL line.
  8. quiz · `Key (name)=(Mirage) already exists.` Which SQLSTATE? (23505)
  9. try · Transfer 300 credits from Kree-7 (10) to Tiko (19) inside BEGIN/COMMIT.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch21-ex01 | Inside BEGIN/COMMIT, move 1000 credits from **Vera Lux** (21) to **Yuki Hoshino** (24). verify both wallets | 1 | transaction | state | transactions-basics | mutate |
| ch21-ex02 | The clerk started a cleanup by mistake: write `BEGIN;`, delete every route, then **undo it** so the routes are intact, then insert route 11→2 (3.9 ly) outside the transaction. verify routes | 2 | transaction | state | transactions-basics | mutate |
| ch21-ex03 | Error mission: make Jax O'Hara (credits 0.00) pay 50 credits. Write the UPDATE: it must fail with **23514**. | 2 | transaction | error 23514 | constraint-errors | predict |
| ch21-ex04 | Error mission: register a second planet called **Mirage**. Expected **23505**. | 1 | mutation | error 23505 | constraint-errors | predict |
| ch21-ex05 | Error mission: record a trade for ship **99** (does not exist). Expected **23503**. | 2 | mutation | error 23503 | constraint-errors | predict |
| ch21-ex06 | Savepoints: in one transaction set Water Ice's base_price to 13.00, `SAVEPOINT before_pearls`, set Void Pearls to 99.99 (a typo), roll back to the savepoint, then COMMIT. verify both prices | 3 | transaction | state | savepoints | mutate |
| ch21-ex07 | Fix: the starter does `BEGIN; UPDATE ...; SAVEPOINT s; UPDATE ...; ROLLBACK; COMMIT;` and loses both changes. Keep the first change, drop the second. verify | 3 | transaction | state | savepoints | fix |
| ch21-ex08 | **Boss · The Cargo Pact**: in one transaction: Bram (2) buys 100 tons of Space Kelp (commodity 11) at 8.50 on Zephyria (5) with ship 2 (insert the trade), pays for it (credits minus qty × price), and his mentor Grimble (7) gets a 2% commission from Bram. Use a savepoint before the commission; the guild cancels commissions under 20 credits, so roll back to the savepoint if Grimble's share is below 20 (it is 17: roll back). Commit. verify trade count for ship 2, Bram's and Grimble's credits | 5 | transaction | state | transactions-basics, savepoints | write |

- **Practice**: `ch21-pr01` transactions-basics: wrap two route inserts (both directions 11↔2) in a transaction; `ch21-pr02` savepoints: two savepoints, roll back to the first; `ch21-pr03` constraint-errors: insert a ship with cargo_capacity 0 → **23514**; `ch21-pr04` constraint-errors: insert a pilot without joined_at → **23502**; `ch21-pr05` constraint-errors: give two pilots the callsign 'Nova' → **23505** (but two NULL callsigns are fine: a predict quiz in the lesson).
- **Negative cases to add**: ROLLBACK instead of ROLLBACK TO SAVEPOINT (ex06, ex07); COMMIT before the second UPDATE in ex01 still passes (state same) so it is accepted; no BEGIN in ex02 (DELETE commits: state wrong). Error missions: reject statements failing with another code (e.g. 42703 typo).
- **Notes**: the app stops the learner script at its **first error**, so a state mission can never contain a failing statement: savepoint recovery after a real error (and 25P02) can only be taught with quizzes and explain cards. Error missions (`error` check) are single statements. The boss commission check is done by the learner's reasoning, not by procedural code (no PL/pgSQL yet): the prompt gives the numbers (100 × 8.50 = 850, 2% = 17).

### ch22-merge-and-upsert · Merge and Upsert 🔀
- **File** `src/content/chapters/ch22-merge-and-upsert.ts` · **World** The Forge · **Tier** adept · **Track** mutation · **Dataset** `starport`
- **Subtitle** Insert or update in one move, imports you can run twice, and chained writes
- **Concepts** `upsert-on-conflict`, `merge-statement`, `data-modifying-cte`, `bulk-load-copy`
- **Prerequisites** `ch21-the-pact`, `ch13-unions-and-named-spells`
- **Lesson** (10 steps)
  1. explain · The exchange sends `price_feed`: some commodities exist, some are new. INSERT fails on the existing names (23505), UPDATE ignores the new ones.
  2. example · `INSERT INTO commodities (name, base_price, unit) VALUES ('Comet Tea', 19.00, 'crate') ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price RETURNING *;`
  3. explain · ON CONFLICT needs a unique index matching the target (42P10 otherwise); DO NOTHING; `EXCLUDED` is the row you tried to insert.
  4. quiz · Upserting the raw feed fails with 21000. Why? (Water Ice appears twice in one statement)
  5. explain · MERGE: `MERGE INTO target USING source ON ... WHEN MATCHED THEN UPDATE ... WHEN NOT MATCHED THEN INSERT ...`; `RETURNING merge_action()` (PG17).
  6. example · MERGE the deduplicated feed (DISTINCT ON latest quote) with RETURNING merge_action().
  7. explain · Data-modifying CTEs: `WITH moved AS (DELETE ... RETURNING *) INSERT INTO archive SELECT * FROM moved;` all CTEs see the same snapshot.
  8. explain · Bulk loading: real servers use `COPY ... FROM` a CSV file (disabled in this sandbox). The pattern stays: load raw lines into a text staging table, inspect, then INSERT ... SELECT with casts.
  9. example · Parse CSV lines with `split_part(line, ',', 2)::numeric` from a staging table (skip the header).
  10. try · Upsert **Comet Tea** at **19.00** (it exists).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch22-ex01 | Add commodity **Asteroid Honey** (luxury, 66.00, sold by the jar) but **do nothing** if a commodity with that name already exists; run it so that running it twice is harmless. verify commodities name/base_price ordered by name | 2 | mutation | state | upsert-on-conflict | write |
| ch22-ex02 | Upsert **Void Pearls** at **2100.00** keeping its other columns. verify | 2 | mutation | state | upsert-on-conflict | write |
| ch22-ex03 | Error mission: upsert the whole raw `price_feed` with ON CONFLICT DO UPDATE. Expected **21000**. | 3 | mutation | error 21000 | upsert-on-conflict | predict |
| ch22-ex04 | Fix: the MERGE over the raw feed fails with 21000. MERGE only the **latest quote** of each commodity name into `commodities` (update price when matched, insert with unit 'crate' when not). verify | 4 | mutation | state | merge-statement | fix |
| ch22-ex05 | Same MERGE, but **return** `merge_action()`, **name** and **base_price** of every touched row (5 rows: 4 UPDATE, 1 INSERT). | 4 | mutation | result+state | merge-statement | write |
| ch22-ex06 | Move every seizure older than **2077-01-01** into setupSql table `seizure_archive` (same columns) and remove them from `seizures`, in **one statement** (WITH ... DELETE ... RETURNING then INSERT). verify both tables | 4 | mutation | state | data-modifying-cte | write |
| ch22-ex07 | Staging import: setupSql creates `manifest_csv(line text)` with a header line `name,category,base_price,unit` and 3 data lines (one with spaces to trim). Insert the data lines as commodities (trimmed, price cast to numeric). verify | 3 | mutation | state | bulk-load-copy | write |
| ch22-ex08 | **Boss · The Smith's Ledger**: an idempotent import inside BEGIN/COMMIT: MERGE the latest quote per commodity from `price_feed` into `commodities` (update only when the price **changed**, insert unknown commodities with category NULL and unit 'crate'), and in the same transaction log every changed or inserted row into setupSql table `price_log(name, old_price, new_price, action)` using a data-modifying CTE around `MERGE ... RETURNING merge_action(), old.base_price, new.base_price` (PG18 OLD/NEW). Running the whole script twice must leave the same state. verify commodities and price_log | 5 | transaction | state | merge-statement, data-modifying-cte, upsert-on-conflict | write |

- **Practice**: `ch22-pr01` upsert-on-conflict: upsert tier 'legend' with max_rep 1200 (the tier exists) using ON CONFLICT (tier); `ch22-pr02` upsert-on-conflict: error mission: ON CONFLICT (unit) on commodities → **42P10** (no unique index); `ch22-pr03` merge-statement: MERGE with `WHEN NOT MATCHED BY SOURCE THEN DELETE` against a setupSql "official routes" list; `ch22-pr04` data-modifying-cte: `WITH new_p AS (INSERT INTO pilots ... RETURNING id) INSERT INTO ships (name, pilot_id, ...) SELECT 'Firefly', id FROM new_p`; `ch22-pr05` bulk-load-copy: count the data lines of a staging CSV that would fail a numeric cast (`pg_input_is_valid(split_part(...), 'numeric')`, PG16+).
- **Negative cases to add**: ON CONFLICT DO NOTHING when an update is needed (ex02); MERGE over the raw feed (ex04, error); `DISTINCT ON` ordered by quoted_at ASC (keeps the older 12.50 for Water Ice); importing the header line (ex07: 22P02 error, rejected); boss: unconditional WHEN MATCHED update (logs unchanged Nebula Spice). Accept: `INSERT ... ON CONFLICT` versions of ex04 when the source is deduplicated; `max(quoted_at)` join instead of DISTINCT ON.
- **Notes**: COPY is forbidden by the app (and by the validator for solutions): bulk-load-copy is taught with staging tables and `string_to_table`/`split_part`; the explain card shows COPY syntax as plain text only. Verified: `MERGE ... RETURNING merge_action(), old.base_price, new.base_price` works in PGlite, also inside a data-modifying CTE (4 UPDATE + 1 INSERT; old is NULL for the insert). The unique key used by every upsert is `commodities.name` (already in the dataset; UNIQUE itself is taught in ch25).

### ch23-many-hands · Many Hands 👥 (side quest)
- **File** `src/content/chapters/ch23-many-hands.ts` · **World** The Forge · **Tier** expert · **Track** mutation · **Dataset** `inn`
- **Subtitle** Two clerks, one Last Room: isolation, locks and lost updates
- **Concepts** `isolation-levels`, `row-locking`, `optimistic-locking`
- **Prerequisites** `ch21-the-pact`
- **Lesson** (10 steps)
  1. explain · The Wandering Star Inn has two clerks and one database. When both act at once, anomalies appear: dirty, non-repeatable and phantom reads, lost updates, write skew.
  2. explain · Isolation levels in PostgreSQL: READ COMMITTED (default), REPEATABLE READ, SERIALIZABLE; READ UNCOMMITTED behaves like READ COMMITTED.
  3. quiz · Timeline: clerk A reads room 14's version (1), clerk B updates it to 2 and commits, A reads again. Under READ COMMITTED, what does A see? (2: non-repeatable read)
  4. example · `BEGIN ISOLATION LEVEL REPEATABLE READ; SHOW transaction_isolation; COMMIT;`
  5. quiz · Under SERIALIZABLE, a conflicting transaction fails with which code, and what must the app do? (40001, retry)
  6. explain · Pessimistic locking: `SELECT ... FOR UPDATE` locks rows until COMMIT; `SKIP LOCKED` for job queues; deadlocks (40P01) come from inconsistent lock order.
  7. example · Claim the oldest pending booking with `FOR UPDATE SKIP LOCKED` (booking 28).
  8. explain · Optimistic locking: read the `version`, then `UPDATE ... SET ..., version = version + 1 WHERE id = 14 AND version = 1`; 0 rows updated means someone was faster.
  9. quiz · Read-modify-write in app code (`SELECT credits` then `UPDATE SET credits = <value>`) vs `SET credits = credits + 10`: which loses updates? (the first)
  10. try · Atomic bump: raise The Last Room's nightly_rate by 5.00 with a single UPDATE using the current value.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch23-ex01 | Predict: return, as **anomaly**, the name of the anomaly in this timeline (A reads count of pending bookings, B inserts a pending booking and commits, A counts again, READ COMMITTED): `'phantom read'`. (Answer with a SELECT of the text, from 4 choices listed in the prompt.) | 2 | query | result | isolation-levels | predict |
| ch23-ex02 | Open a transaction at **SERIALIZABLE**, return `current_setting('transaction_isolation')` as **level**, then COMMIT. | 1 | transaction | result | isolation-levels | write |
| ch23-ex03 | Job queue: in one statement confirm the **oldest pending** booking (by created_at) using a `FOR UPDATE SKIP LOCKED` subquery and **return its id** (28). | 3 | transaction | result+state | row-locking | write |
| ch23-ex04 | Advisory lock: take the session advisory lock **14** (The Last Room) and return whether you got it (**got** = true), then release it. | 2 | query | result | row-locking | write |
| ch23-ex05 | Optimistic update: clerk A read version **1** of room 14. Set its nightly_rate to **120.00** and bump the version, **only if** the version is still 1, returning **id** and **version**. | 3 | mutation | result+state | optimistic-locking | write |
| ch23-ex06 | Fix: setupSql already bumped room 14 to version 2 (clerk B won). Clerk A's starter `UPDATE rooms SET nightly_rate = 120.00 WHERE id = 14 RETURNING id, version;` overwrites B. Rewrite it so the stale update changes **nothing** and returns **no row**. | 3 | mutation | result+state | optimistic-locking | fix |
| ch23-ex07 | **Boss · The Last Room**: inside one transaction, lock room 14 with `FOR UPDATE`, check (in SQL) that no non-cancelled booking of room 14 overlaps 2026-03-21..2026-03-22, and insert a booking for guest 15 (Zoë) only if it is free (INSERT ... SELECT ... WHERE NOT EXISTS), bumping room 14's version; return the number of bookings inserted (0, because booking 30 holds it). verify room 14 version and its bookings | 5 | transaction | result+state | row-locking, optimistic-locking, isolation-levels | write |

- **Practice**: `ch23-pr01` isolation-levels: predict the anomaly of a write-skew timeline (two clerks each move a different guest out of a 2-bed rule); `ch23-pr02` isolation-levels: `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` after BEGIN, return the setting; `ch23-pr03` row-locking: claim the 2 oldest pending bookings with `SKIP LOCKED` and return their ids; `ch23-pr04` row-locking: predict: two transactions lock rooms 1 then 2, and 2 then 1: which error? answer `'40P01'`; `ch23-pr05` optimistic-locking: atomic `UPDATE rooms SET version = version + 1 WHERE id = 3 RETURNING version`; `ch23-pr06` optimistic-locking: return the number of rows a stale update would touch using a CTE with RETURNING and count(*) (0).
- **Negative cases to add**: ex05 without `AND version = 1` (passes state here: so ex06 is the discriminating one); ex06 starter; ex03 `ORDER BY id` instead of created_at (returns 19); ex04 forgetting to unlock is accepted (state not checked). Accept `pg_try_advisory_lock(14)` and `pg_advisory_lock` + literal true? (only try_ returns a boolean: say "try" in the prompt).
- **Notes**: single session: no lock waits, no 40001 can be produced, so concurrency is taught through timelines (explain and quiz cards showing two columns, clerk A and clerk B) and predict exercises answered with `SELECT '<answer>' AS anomaly`; the prompt must list the allowed answers verbatim so exactly one string is right. Booking 30 (guest 2, 2026-03-20..23) and 31 (2026-03-22..24, pending) already overlap on room 14: mention it as the reason the inn needs ch33's exclusion constraint.

## 10. World 7: The Architect's Tower

The Guild of the Silver Dragon builds a new tower and you design its archive: tables, keys, constraints, views, and a reckoning with the old scribe's legacy ledger. DDL missions are checked with `state` (catalog queries or behaviour). A helper recommended for every World 7 chapter, created in exercise `setupSql`:

```sql
CREATE FUNCTION try_sql(stmt text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE stmt; RETURN 'ok';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE; END $$;
```

`verifySql` then probes behaviour: `SELECT try_sql($$INSERT INTO guild_halls (name) VALUES ('X')$$) AS valid_row, try_sql($$INSERT INTO guild_halls (name) VALUES (NULL)$$) AS null_name;` → `ok | 23502`. Any correct design passes, whatever its constraint names. Prefer it over `information_schema` when the learner may legitimately choose different types or names.

Data facts (verified on `guild`): deleting guild 5 fails with 23503 (heroes reference it); guild 6 (Quiet Bell) has no heroes. `items` has 'Healing Potion' (1) and 'healing potion' (20): a unique index on `lower(name)` fails with 23505. Hero levels go down to 2 (Mabel, 30): `CHECK (level >= 5)` fails with 23514. `adventurer_sheet_legacy`: 8 sheets, Silver Dragon's hall is 'Highmoor' on sheets 101 and 102 but 'High Moor' on 103 (update anomaly), `party_members` comma lists with inconsistent spaces and an empty string on 107, item1..item3 repeating columns with NULLs and duplicates (105 two daggers, 108 two shields). `hero_attributes` EAV: birthday values '1998-05-01', '1971-11-30', '2041-02-30' (invalid: 22008), '05/04/1995' (ambiguous), NULL; height_cm 'tall enough'. `skill_tree`: adjacency (`parent_id`) and a consistent ltree `path`, 22 nodes, 4 class roots (mage, warrior, rogue, cleric), depth up to 4.

### ch24-laying-foundations · Laying Foundations 🧱
- **File** `src/content/chapters/ch24-laying-foundations.ts` · **World** The Architect's Tower · **Tier** apprentice · **Track** schema · **Dataset** `guild`
- **Subtitle** CREATE TABLE with good types, keys, identities and defaults
- **Concepts** `data-type-basics`, `create-table`, `primary-key`, `identity-columns`, `not-null-default`, `naming-conventions`, `drop-objects`
- **Prerequisites** `ch21-the-pact`
- **Lesson** (10 steps)
  1. explain · The guild's new tower needs new tables. Types first: int/bigint, numeric for gold, text, boolean, date, timestamptz.
  2. quiz · Which type for gold coins with 2 decimals? (numeric(10,2); float drifts, text sorts wrong, money is locale bound)
  3. explain · `CREATE TABLE guild_halls (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, ...)`
  4. example · Create a tiny table, insert a row, `SELECT * FROM` it.
  5. explain · PRIMARY KEY = unique + not null; composite keys for junction tables; surrogate vs natural keys.
  6. explain · Identity vs serial; ALWAYS refuses explicit ids (428C9) unless `OVERRIDING SYSTEM VALUE`.
  7. explain · NOT NULL and DEFAULT (`DEFAULT now()`, `DEFAULT true`); adding a NOT NULL column later needs a default.
  8. explain · Naming: lower case snake_case, plural or singular consistently, no reserved words (`user`, `order`), no quotes needed.
  9. quiz · `DROP TABLE heroes;` fails with 2BP01. Why, and what does CASCADE do? (dependents: FKs; CASCADE drops the constraints)
  10. try · Create table `banners` with `id` (identity primary key) and `motto` (text, required).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch24-ex01 | Create `guild_halls` with **id** (int identity PK), **name** (text, required), **region** (text), **built_on** (date). verify via try_sql: valid insert ok, NULL name 23502, explicit duplicate id 23505... (writer: list exact probes) | 2 | ddl | state | create-table, primary-key | design |
| ch24-ex02 | Fix: `CREATE TABLE Order (ID serial, Name varchar(255), Gold float,);` fails. Create table **orders** with id identity PK, name text not null, gold numeric(10,2) default 0. verify columns via information_schema (name, data_type, is_nullable, column_default is not null) | 2 | ddl | state | naming-conventions, data-type-basics | fix |
| ch24-ex03 | Create `party_members(quest_id int, hero_id int)` so the same hero cannot join the same quest twice (composite primary key). verify via try_sql (duplicate pair 23505, same hero other quest ok) | 3 | ddl | state | primary-key | design |
| ch24-ex04 | Error mission: setupSql creates `banners (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, motto text)`. Insert a banner with explicit id 7: expected **428C9**. | 2 | mutation | error 428C9 | identity-columns | predict |
| ch24-ex05 | Create `bounties` with **id** identity, **title** required, **reward_gold** numeric(10,2) required default **0**, **posted_at** timestamptz required default `now()`, **open** boolean required default true. verify via try_sql + `SELECT reward_gold, open FROM bounties` after a probe insert of only the title | 3 | ddl | state | not-null-default | design |
| ch24-ex06 | Clean up: drop the legacy table `hero_titles` and, **without error even if it is already gone**, a table named `old_rumors`. verify `to_regclass('hero_titles') IS NULL` | 2 | ddl | state | drop-objects | write |
| ch24-ex07 | Choose types: create `treasury_entries` storing an exact amount in gold with 2 decimals, a moment with time zone, a yes/no `approved`, and a free text note; then insert 0.10 three times and return their sum (exactly 0.30). | 3 | ddl | result+state | data-type-basics | design |
| ch24-ex08 | **Boss · The Tower Registry**: create `tower_floors` (**floor_no** int PRIMARY KEY, **name** text required, **guardian_hero_id** int, **opened_on** date required default current_date) and `floor_keys` (floor_no int, hero_id int, granted_at timestamptz required default now(), composite PK). verify with try_sql probes on both tables | 5 | ddl | state | create-table, primary-key, not-null-default, identity-columns, naming-conventions | design |

- **Practice**: `ch24-pr01` data-type-basics: predict which type `SELECT pg_typeof(1.5)` shows (`numeric`); `ch24-pr02` create-table: create `pets(name text, species text)`; `ch24-pr03` primary-key: create `taverns` with `name` as a natural primary key; `ch24-pr04` identity-columns: insert with `OVERRIDING SYSTEM VALUE`; `ch24-pr05` not-null-default: insert into setupSql table with defaults using `DEFAULT VALUES`; `ch24-pr06` naming-conventions: fix a CREATE TABLE using `user` as a column name (rename to `username`); `ch24-pr07` drop-objects: `DROP TABLE ... CASCADE` on a table referenced by a setupSql child FK, verify child still exists without the constraint.
- **Negative cases to add**: serial instead of identity accepted (behaviour identical for probes) unless the mission says identity: verify with `attidentity` then; `varchar(255)` accepted; float for gold rejected in ex07 (sum shows 0.30000000000000004); missing composite PK (surrogate id only) in ex03 rejected by the duplicate-pair probe; `DROP TABLE old_rumors` without IF EXISTS fails (42P01) → rejected.
- **Notes**: create the `try_sql` helper in each exercise setupSql (it must not collide with learner names). DDL runs fine in the sandbox (fresh clone per run). Avoid `now()` values in verify output (compare `posted_at IS NOT NULL` instead).

### ch25-binding-laws · Binding Laws ⚖️
- **File** `src/content/chapters/ch25-binding-laws.ts` · **World** The Architect's Tower · **Tier** adept · **Track** schema · **Dataset** `guild`
- **Subtitle** UNIQUE, CHECK, FOREIGN KEY, cascades, generated columns and ALTER TABLE
- **Concepts** `unique-constraint`, `check-constraint`, `foreign-key`, `fk-actions`, `generated-columns`, `alter-table`
- **Prerequisites** `ch24-laying-foundations`
- **Lesson** (10 steps)
  1. explain · Constraints are laws the database enforces for every writer, forever.
  2. example · `ALTER TABLE heroes ADD CONSTRAINT heroes_xp_nonneg CHECK (xp >= 0);` then a violating UPDATE fails 23514.
  3. quiz · `CHECK (gold >= 0)`: can a hero have NULL gold? (yes: NULL makes the check unknown, which passes)
  4. explain · UNIQUE allows several NULLs unless `NULLS NOT DISTINCT`; case variants slip through: unique index on `lower(name)`.
  5. example · `CREATE UNIQUE INDEX ON items (lower(name));` fails 23505 because of Healing Potion / healing potion.
  6. explain · FOREIGN KEY references a PK or UNIQUE column; actions ON DELETE CASCADE / SET NULL / RESTRICT.
  7. quiz · `ON DELETE SET NULL` on a NOT NULL column: what happens on delete? (23502)
  8. explain · Generated columns: `GENERATED ALWAYS AS (expr)` VIRTUAL (PG18 default) or STORED; you cannot write to them (428C9).
  9. explain · ALTER TABLE: add/drop/rename columns, `ALTER COLUMN ... TYPE ... USING`, `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT`.
  10. try · Add a CHECK so hero `level` stays between 1 and 20 (already true for all rows).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch25-ex01 | Guild mottos must be unique among guilds (NULL allowed). Add the constraint. verify try_sql: duplicate motto 23505, two NULL mottos ok | 2 | ddl | state | unique-constraint | design |
| ch25-ex02 | Error mission: make item names unique **ignoring case** with a unique index on `lower(name)`: expected **23505** (the data has a duplicate). | 2 | ddl | error 23505 | unique-constraint | predict |
| ch25-ex03 | Quest rewards must be positive and difficulty between 1 and 5: add a CHECK on `reward_gold > 0`. verify try_sql probes | 2 | ddl | state | check-constraint | design |
| ch25-ex04 | Fix: setupSql creates `bounties(hero_id int, ...)` with no FK. Add a foreign key from `bounties.hero_id` to `heroes(id)` so unknown heroes are refused. verify try_sql: hero 999 → 23503, hero 1 ok | 2 | ddl | state | foreign-key | fix |
| ch25-ex05 | Disbanding: change `quest_completions.hero_id`'s FK so deleting a hero deletes their completions (ON DELETE CASCADE). verify: delete a hero referenced only by quest_completions inside verifySql, then count their completions (0). (use hero 17: referenced only by quest_completions, 2 rows; heroes 15, 16, 23, 27, 29 qualify too) | 4 | ddl | state | fk-actions | design |
| ch25-ex06 | Add a stored generated column **xp_to_next** = `level * 5000 - xp` to heroes. verify `SELECT id, xp_to_next FROM heroes ORDER BY id` and try_sql writing to it → 428C9 | 3 | ddl | state | generated-columns | design |
| ch25-ex07 | ALTER: setupSql adds `heroes.height text` filled with '188', '170', NULL... Change its type to int with USING. verify `data_type` and values | 3 | ddl | state | alter-table | write |
| ch25-ex08 | **Boss · The Binding Laws**: make `guild_id` mandatory for new heroes without breaking the 6 wanderers: add `CHECK (guild_id IS NOT NULL) NOT VALID`; forbid gold below 0 (NULL allowed); unique hero names ignoring case after renaming 'lyra' (11) to 'Lyra Brightwater'; set the FK `heroes.guild_id` to `ON DELETE SET NULL`. verify with try_sql probes (new hero without guild 23514, existing wanderers untouched, 'ALDRIC STORMBORN' duplicate 23505, delete guild 5 succeeds and its heroes have NULL guild_id) | 5 | ddl | state | check-constraint, unique-constraint, fk-actions, alter-table | design |

- **Practice**: `ch25-pr01` unique-constraint: `UNIQUE NULLS NOT DISTINCT` on a setupSql table; `ch25-pr02` check-constraint: error mission `ADD CHECK (level >= 5)` → **23514**; `ch25-pr03` foreign-key: create `hero_pets(hero_id REFERENCES heroes, name)`; `ch25-pr04` fk-actions: ON DELETE RESTRICT vs NO ACTION predict quiz-style; `ch25-pr05` fk-actions: error mission delete guild 5 → **23503**; `ch25-pr06` generated-columns: add a VIRTUAL column `value_per_weight` = `base_value / weight` to items (NULL base value gives NULL); `ch25-pr07` alter-table: rename column `quests.is_secret` to `hidden`; `ch25-pr08` alter-table: add a column with NOT NULL DEFAULT to a populated table.
- **Negative cases to add**: unique on `name` instead of `lower(name)` (case probe fails); CHECK accepting NULL questions: `CHECK (gold >= 0 OR gold IS NULL)` accepted (equivalent); type change without USING (42804, rejected); CASCADE on the wrong FK (mentor_id). Accept: constraint vs unique index forms of UNIQUE; `ALTER TABLE ... ADD CONSTRAINT` vs column-level syntax when creating.
- **Notes**: catalog verify: `SELECT conname, contype FROM pg_constraint` depends on names: prefer try_sql. PG18: `CHECK ... NOT ENFORCED` exists; teach NOT VALID instead (validated for new rows). Make sure every probe in verifySql is deterministic and leaves no side effect that changes later probes unexpectedly (run them in a fixed order).

### ch26-blueprints · Blueprints 📐
- **File** `src/content/chapters/ch26-blueprints.ts` · **World** The Architect's Tower · **Tier** adept · **Track** schema · **Dataset** `guild`
- **Subtitle** From the old scribe's ledger to a clean, normalized design
- **Concepts** `er-modeling`, `relationship-cardinality`, `normalization-1nf`, `normalization-2nf-3nf`, `normalization-bcnf-beyond`
- **Prerequisites** `ch25-binding-laws`
- **Lesson** (10 steps)
  1. explain · Design before DDL: entities (hero, guild, quest), attributes, relationships, business rules. Model facts, not reports.
  2. quiz · "A hero belongs to one guild; a guild has many heroes": where does the foreign key go? (heroes.guild_id)
  3. explain · Many-to-many needs a junction table with two FKs and a composite key (`quest_completions`).
  4. example · Meet the legacy: `SELECT * FROM adventurer_sheet_legacy;` (comma lists, item1..3, repeated guild halls).
  5. explain · 1NF: one value per cell. `string_to_table(party_members, ',')` + `trim` turns a list into rows.
  6. example · Unpivot item1..item3 with `CROSS JOIN LATERAL (VALUES (1, item1), (2, item2), (3, item3))`.
  7. explain · 2NF/3NF: every non-key column depends on the key, the whole key and nothing but the key; guild_hall depends on guild_name, not on the sheet.
  8. example · Spot the update anomaly: `SELECT guild_name, count(DISTINCT guild_hall) FROM adventurer_sheet_legacy GROUP BY 1 HAVING count(DISTINCT guild_hall) > 1;` (Silver Dragon: Highmoor vs High Moor)
  9. explain · BCNF, 4NF, 5NF in one card: every determinant is a key; independent multivalued facts in separate tables.
  10. try · Return **sheet_id** and **member** (trimmed) for every party member of every sheet, empty entries excluded.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch26-ex01 | Predict the cardinality: return the relationship between `heroes` and `guilds` and between `heroes` and `quests` as two text columns **heroes_guilds**, **heroes_quests**, from the choices `'1:1'`, `'1:N'`, `'M:N'` (`'1:N'`, `'M:N'`). | 1 | query | result | er-modeling, relationship-cardinality | predict |
| ch26-ex02 | Create the junction table **hero_skills(hero_id, skill_id, learned_on date)** with both FKs and a composite PK. verify try_sql probes | 3 | ddl | state | relationship-cardinality | design |
| ch26-ex03 | 1NF: return **sheet_id**, **member** for every party member (trimmed, empty ones excluded, the same member once per sheet). | 3 | query | result | normalization-1nf | write |
| ch26-ex04 | 1NF for items: return **sheet_id**, **slot** (1 to 3) and **item** for every non-NULL item column (duplicates kept: they are real). | 3 | query | result | normalization-1nf | write |
| ch26-ex05 | Find the functional dependency violation: return **guild_name** and **halls** (number of different hall spellings) for guilds whose hall is spelled more than one way. | 3 | query | result | normalization-2nf-3nf | write |
| ch26-ex06 | Decompose: create `legacy_guilds(guild_name text PRIMARY KEY, guild_hall text NOT NULL)` and fill it from the legacy sheets, using the **most frequent** spelling per guild ('Highmoor'). verify table contents | 4 | ddl | state | normalization-2nf-3nf | design |
| ch26-ex07 | Fix: setupSql creates `hero_class_skills(hero_id, class, skill_id)` where class depends on hero_id only (partial dependency). Create `hero_skill_list(hero_id, skill_id)` filled from it so the class lives only in heroes; verify contents | 4 | ddl | state | normalization-2nf-3nf, normalization-bcnf-beyond | refactor |
| ch26-ex08 | **Boss · The Scribe's Redemption**: build the normalized legacy model: `legacy_guilds(guild_name PK, guild_hall)`, `legacy_sheets(sheet_id PK, hero_name, guild_name FK)`, `legacy_party(sheet_id FK, member, PK both)`, `legacy_items(sheet_id FK, slot 1..3 CHECK, item, PK sheet_id+slot)`, all filled from `adventurer_sheet_legacy` with the cleaning rules of ex03 to ex06. verify a lossless join: the query rebuilding (sheet_id, guild_hall, member count, item count) from your tables. | 5 | ddl | state | normalization-1nf, normalization-2nf-3nf, relationship-cardinality | design |

- **Practice**: `ch26-pr01` er-modeling: predict which noun of a short spec is an attribute, not an entity (answer as text); `ch26-pr02` relationship-cardinality: create a 1:1 table `hero_biography(hero_id PK FK)`; `ch26-pr03` normalization-1nf: count party members per sheet from the comma list; `ch26-pr04` normalization-1nf: find sheets that list the same item twice; `ch26-pr05` normalization-2nf-3nf: does `quests.region` determine anything else in quests? write the FD check query for region → difficulty (returns regions with several difficulties); `ch26-pr06` normalization-bcnf-beyond: predict quiz-style which normal form a given 3-column table violates (text answer).
- **Negative cases to add**: `string_to_table` without trim (members with leading spaces); counting `''` as a member; DISTINCT on the items unpivot (drops real duplicates); `count(guild_hall)` instead of `count(DISTINCT guild_hall)`; picking the hall with `max()` (returns 'Highmoor' by chance in C collation? check: 'Highmoor' > 'High Moor' in C order since 'm' > ' ': so max() works by luck: the writer must make the prompt say "most frequent" and add a reject case that uses `min()`).
- **Notes**: er-modeling and BCNF are mostly conceptual: use quizzes and predict exercises with a closed list of text answers in the prompt. Verify for the boss must not depend on constraint names: use try_sql for the CHECK on slot and a rebuild query for content.

### ch27-lenses-and-realms · Lenses and Realms 🔭
- **File** `src/content/chapters/ch27-lenses-and-realms.ts` · **World** The Architect's Tower · **Tier** adept · **Track** schema · **Dataset** `guild`
- **Subtitle** Views, materialized views, schemas and reading the catalog
- **Concepts** `views`, `materialized-views`, `schemas-search-path`, `catalog-introspection`
- **Prerequisites** `ch26-blueprints`, `ch13-unions-and-named-spells`
- **Lesson** (9 steps)
  1. explain · A view is a saved query with a name; it stores no rows and is always up to date.
  2. example · `CREATE VIEW hero_cards AS SELECT h.name, g.name AS guild, h.level FROM heroes h LEFT JOIN guilds g ON g.id = h.guild_id; SELECT * FROM hero_cards;`
  3. explain · Simple views are updatable; `WITH CHECK OPTION` refuses rows the view could not see (44000).
  4. quiz · A view was created with `SELECT *`. You add a column to the table. Does the view show it? (no: the column list was frozen)
  5. explain · Materialized views store the result; `REFRESH MATERIALIZED VIEW`; CONCURRENTLY needs a unique index (55000 otherwise).
  6. explain · Schemas are namespaces: `CREATE SCHEMA archive; ALTER TABLE ... SET SCHEMA archive;` `search_path` decides lookup order (42P01 when not on the path).
  7. example · `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY 1, 2;`
  8. explain · No `\d` here: `information_schema.columns`, `pg_indexes`, `pg_constraint`, `'heroes'::regclass`, `obj_description`.
  9. try · Create view `wanderers` listing name and level of heroes without a guild.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch27-ex01 | Create view **guild_rosters** (guild name, hero name, class) for every hero who has a guild. verify `SELECT * FROM guild_rosters` (multiset) | 2 | ddl | state | views | design |
| ch27-ex02 | Create view **apprentices** (id, name, level of heroes below level 10) **WITH CHECK OPTION**; verify try_sql: insert through the view a level 15 hero → 44000, level 3 ok | 3 | ddl | state | views | design |
| ch27-ex03 | Create materialized view **quest_board** (quest title, number of completions) then complete a quest (insert into quest_completions) and **refresh** it. verify the board shows the new count | 3 | ddl | state | materialized-views | write |
| ch27-ex04 | Error mission: `REFRESH MATERIALIZED VIEW CONCURRENTLY` on a setupSql materialized view without unique index: expected **55000**. | 2 | ddl | error 55000 | materialized-views | predict |
| ch27-ex05 | Move the legacy tables `adventurer_sheet_legacy` and `hero_attributes` into a new schema **archive**. verify `SELECT table_schema, table_name FROM information_schema.tables WHERE table_name IN (...)` | 2 | ddl | state | schemas-search-path | write |
| ch27-ex06 | Fix: after the move (setupSql did it), `SELECT count(*) FROM hero_attributes;` fails with 42P01. Make it work by changing the `search_path` (not by qualifying), then run it. | 3 | query | result | schemas-search-path | fix |
| ch27-ex07 | Catalog: return **column_name**, **data_type** and **is_nullable** of every column of `heroes`, in table order (`ordinal_position`). | 2 | query | result (ordered) | catalog-introspection | write |
| ch27-ex08 | **Boss · The Grand Lens**: return, for every table of schema `public` that has a foreign key, **table_name**, **fk_count** (number of FK constraints) and **referenced** (comma separated sorted list of referenced tables), ordered by table_name; then (same script) create view **fk_map** with that query. verify `SELECT * FROM fk_map ORDER BY 1` | 5 | ddl | result+state | catalog-introspection, views | write |

- **Practice**: `ch27-pr01` views: `CREATE OR REPLACE VIEW` adding a column at the end; `ch27-pr02` views: update a hero's level through a simple view; `ch27-pr03` materialized-views: create with `WITH NO DATA`, then error mission selecting it → **55000**; `ch27-pr04` schemas-search-path: create schema `vault` and table `vault.relics(name text)`, insert one; `ch27-pr05` catalog-introspection: list the indexes of `heroes` from `pg_indexes` (indexname, indexdef); `ch27-pr06` catalog-introspection: `COMMENT ON TABLE quests` then read it back with `obj_description('quests'::regclass)`.
- **Negative cases to add**: INNER vs LEFT join in views per prompt; `SELECT *` view (column list differs → state shows different columns); REFRESH forgotten (ex03); qualifying `archive.hero_attributes` instead of search_path in ex06 (accepted? The prompt forbids it, but the checker cannot see it: so make the starter run `SELECT count(*) FROM hero_attributes` unchanged and require `SET search_path` before it; a qualified rewrite passes the result too: accept it and say "or" in the prompt). Accept `pg_attribute` versions of ex07.
- **Notes**: `SET search_path` persists for the rest of the learner script (statements share a session) but not across runs. Catalog answers must exclude the plan helpers? (no plan helpers in guild). Order string_agg inside the call in the boss.

### ch28-cursed-designs · Cursed Designs 💀
- **File** `src/content/chapters/ch28-cursed-designs.ts` · **World** The Architect's Tower · **Tier** expert · **Track** schema · **Dataset** `guild`
- **Subtitle** EAV, polymorphic ids, cached counters and trees: break the curses
- **Concepts** `design-antipatterns`, `denormalization`, `hierarchy-models`
- **Prerequisites** `ch27-lenses-and-realms`, `ch14-the-endless-stair`
- **Lesson** (9 steps)
  1. explain · Karwin's antipatterns: EAV, polymorphic associations, multi-column attributes, one table per year, comma lists. They look flexible and lose types and keys.
  2. example · The EAV table: `SELECT * FROM hero_attributes;` every value is text, '2041-02-30' is not a date, 'tall enough' is not a height.
  3. quiz · A `comments(target_type, target_id)` table points at heroes or quests. What can't the database enforce? (a foreign key)
  4. explain · Fix EAV: one typed column per attribute (or a jsonb with CHECKs); find bad values first with `pg_input_is_valid(value, 'date')`.
  5. explain · Denormalization: a cached `guilds.hero_count` is fast to read and drifts unless every write updates it (transactions, triggers in World 11).
  6. example · Drift check: compare a cached count with `count(*)` from the source.
  7. explain · Trees: adjacency list (`parent_id`, recursive CTE), materialized path (`skill_tree.path`), nested sets, closure table (every ancestor/descendant pair).
  8. quiz · Which model makes "all descendants of Fire Magic" a simple non-recursive query? (path or closure table)
  9. try · Return **hero_id** and **value** of every non-NULL birthday in `hero_attributes` that is not a valid date (`pg_input_is_valid(value, 'date')`: only '2041-02-30').
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch28-ex01 | Un-EAV: return one row per hero present in `hero_attributes` with columns **hero_id**, **birthday**, **height_cm**, **favorite_color** (text, NULL when absent), using conditional aggregation. | 3 | query | result | design-antipatterns | refactor |
| ch28-ex02 | Typed rescue: create table **hero_profile(hero_id PK FK, birthday date, height_cm int CHECK > 0, favorite_color text)** and fill it from the EAV rows, turning values that are not valid dates/ints into NULL. verify contents | 4 | ddl | state | design-antipatterns | design |
| ch28-ex03 | Fix: setupSql creates `notes(id, target_type text, target_id int, body)` (polymorphic). Replace it with two proper tables `hero_notes(hero_id FK)` and `quest_notes(quest_id FK)` filled from it. verify contents + FK probes | 4 | ddl | state | design-antipatterns | refactor |
| ch28-ex04 | Cache: add `guilds.hero_count int NOT NULL DEFAULT 0` and fill it with the real counts (guild 6 stays 0). verify `SELECT id, hero_count FROM guilds ORDER BY id` | 3 | ddl | state | denormalization | write |
| ch28-ex05 | Drift detector: setupSql adds a stale `hero_count` column. Return **guild_id**, **cached**, **actual** for every guild whose cached count is wrong. | 3 | query | result | denormalization | write |
| ch28-ex06 | Subtree with the path: return **name** of every skill under Fire Magic (`mage.fire`), itself excluded, using `path` (text prefix `LIKE 'mage.fire.%'` or ltree `<@`). | 2 | query | result | hierarchy-models | write |
| ch28-ex07 | Closure table: create **skill_closure(ancestor_id, descendant_id, depth)** with every pair (including depth 0 self pairs) built from `parent_id` with a recursive CTE. verify `SELECT count(*), max(depth) FROM skill_closure` and a sample of rows | 4 | ddl | state | hierarchy-models | design |
| ch28-ex08 | **Boss · Raise the Tower**: design from this spec: towers have floors; each floor has exactly one guardian hero (a hero may guard several floors); floors are numbered 1..50 per tower and unique within a tower; a floor's danger is 1 to 5; rooms belong to floors and have a name unique within the floor; a room may contain treasures (item, quantity > 0), the same item once per room. Write the DDL. verify via try_sql probes (created in setupSql): a list of valid inserts (must return ok) and invalid ones (duplicate floor number in a tower → 23505, danger 6 → 23514, unknown hero → 23503, quantity 0 → 23514, duplicate item in a room → 23505, room without floor → 23502 or 23503); verifySql returns one row per probe: **probe**, **result**. The spec names the tables and columns exactly (towers, floors, rooms, room_treasures) so probes can be written. | 5 | ddl | state | design-antipatterns, hierarchy-models, denormalization | design |

- **Practice**: `ch28-pr01` design-antipatterns: count EAV rows per attribute (**attr**, **rows**); `ch28-pr02` design-antipatterns: find hero_attributes height values that are not integers (`pg_input_is_valid(value, 'int')`); `ch28-pr03` denormalization: refresh the cached counts with one UPDATE ... FROM; `ch28-pr04` hierarchy-models: depth of every skill from its path (`nlevel(path)` or count of dots + 1); `ch28-pr05` hierarchy-models: ancestors of Meteor using the adjacency list (recursive CTE, review of ch14).
- **Negative cases to add**: casting EAV values directly (`value::date` fails 22008, rejected); `max(value)` pivot keyed on the wrong attribute; LIKE 'mage.fire%' (also matches a hypothetical 'mage.firestorm': include such a row in setupSql to make the prefix rule discriminate); closure table missing self pairs; cached count with `count(*)` after LEFT JOIN (guild 6 gets 1). Accept ltree `<@` and text LIKE in ex06; `jsonb_object_agg` pivot NOT accepted (different shape).
- **Notes**: `pg_input_is_valid` (PG16) is available and verified: with DateStyle `ISO, MDY`, '05/04/1995' **is** valid (May 4) and only '2041-02-30' fails; ex02 should require ISO format too (`value ~ '^\d{4}-\d{2}-\d{2}$'` and valid) so the ambiguous date becomes NULL, and the prompt must say so. The `ltree` concept itself is ch34: here use `path` only through text operators or `<@` shown as given syntax. Boss probes: build them as rows of a VALUES list `(probe_name, sql)` and run `try_sql` over it in verifySql, ordered by probe_name.
