### ch15-windows-on-the-ranks · Windows on the Ranks 🪟
- **File** `src/content/chapters/ch15-windows-on-the-ranks.ts` · **World** The Observatory · **Tier** adept · **Track** query · **Dataset** `dungeon`
- **Subtitle** Rankings, running totals and before/after comparisons without losing a single row
- **Concepts** `window-basics`, `window-partition-order`, `ranking-functions`, `lag-lead`, `window-frames`, `running-totals`
- **Prerequisites** `ch13-unions-and-named-spells`
- **Lesson** (10 steps)
  1. explain · Aggregates that keep every row: `max(score) OVER ()` next to each run; GROUP BY would collapse them.
  2. explain · PARTITION BY restarts the window, ORDER BY inside OVER makes it cumulative; this ORDER BY sorts the window, not the result.
  3. example · NightOwl's climb: `count(*) OVER ()`, `avg(score) OVER (PARTITION BY season_id)`, `sum(score) OVER (ORDER BY started_at)` (ends at 26650).
  4. explain · Three rankers: row_number 1,2,3,4 / rank 1,1,1,4 / dense_rank 1,1,1,2; ntile(n) buckets.
  5. quiz · rank() of the 5100 run after three 5200s? (4; rank vs dense_rank misconception)
  6. example · The three rankers side by side on season 4.
  7. explain · LAG / LEAD, default value at the edges; windows run after WHERE (42P20), filter in a CTE.
  8. explain · Frames: default `RANGE ... CURRENT ROW` treats ties as peers; ROWS for moving averages; `last_value` surprise.
  9. example · Surprise of the peers: `sum(score) OVER (ORDER BY score DESC)` gives 15600 to all three 5200 runs, vs a ROWS frame with id tie breaker.
  10. try · id, score and the overall average score (avg_all) next to every run.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch15-ex01 | id, score and **best** (max score of all runs) on every run; starter has max() without OVER (42803) | 1 | query | result | window-basics | write |
| ch15-ex02 | id, season_id, score and **season_avg** (unrounded average of the run's season) | 2 | query | result | window-partition-order | write |
| ch15-ex03 | season 4: id, score, **pos** = shelf with no gaps (dense_rank by score desc) | 2 | query | result | ranking-functions | write |
| ch15-ex04 | fix `row_number()` leaderboard: season 4 id, score, **place** with ties sharing and skipping (rank) | 2 | query | result | ranking-functions | fix |
| ch15-ex05 | player 1: id, score, **delta** vs previous run in time (NULL first); starter uses lead | 3 | query | result | lag-lead | fix-ish write |
| ch15-ex06 | every run: player_id, id, score, **running_total** per player in started_at order; starter has no PARTITION BY | 3 | query | result | running-totals, window-partition-order | write |
| ch15-ex07 | fix the jumping running total: season 4 id, score, **running** by score desc, id, one row at a time (ROWS frame + tie breaker) | 4 | query | result | window-frames, running-totals | fix |
| ch15-ex08 | **Boss · The Season Chronicle**: season 4 handle, score, season_rank (rank), gap_to_previous (above minus this), moving_avg (this + 2 above), order score desc, id | 5 | query | result (ordered) | ranking-functions, lag-lead, window-frames, running-totals | write |

- **Practice**: `ch15-pr01` window-basics: handle + total player count; `ch15-pr02` window-partition-order: run id, dungeon_id, score, dungeon_best; `ch15-pr03` ranking-functions: season 2 rank and dense_rank (3100 tie); `ch15-pr04` ranking-functions: ntile(4) of NightOwl's 8 runs; `ch15-pr05` lag-lead: Kaito's runs with next_start (LEAD); `ch15-pr06` window-frames: fix `last_value` with the default frame (first_score, last_score over the whole partition); `ch15-pr07` window-frames: 3 run moving average of NightOwl; `ch15-pr08` running-totals: runs_so_far per season.
- **Negative cases**: GROUP BY per run for ex01; avg OVER () / rounded / running avg for ex02; rank and row_number for ex03; dense_rank for ex04; lag ordered by score, default 0, reversed sign for ex05; no ORDER BY or ordered by score in ex06; explicit RANGE frame, reversed tie breaker for ex07; dense_rank, cumulative avg, frame off by one and gap sign for the boss. Accept: scalar and correlated subqueries, named WINDOW clauses, `lag(score, 1)`, `lead` with DESC order, default frame once `id` makes the order total (ex07).
- **Notes**: started_at is unique, so per player cumulative windows have no peers. Season 4 has 5200 ×3 (runs 30, 33, 41), 4600 ×2, 3300 ×2, 3000 ×2, 2400 ×3, 1600 ×2. Season averages: 1290, 2178.57, 2746.15, 3004.35. NightOwl's deltas: +550, +650, +500, +1300, +400, -200, +800.
