### ch18-the-grand-report · The Grand Report 📊
- **File** `src/content/chapters/ch18-the-grand-report.ts` · **World** The Observatory · **Tier** expert · **Track** query · **Dataset** `dungeon`
- **Subtitle** Subtotals, pivots, medians, correlations and "who did them all"
- **Concepts** `grouping-sets`, `pivoting`, `statistical-aggregates`, `ordered-set-aggregates`, `relational-division`, `random-sampling`
- **Prerequisites** `ch16-champions-of-each-dungeon`, `ch12-exists-or-not`
- **Lesson** (10 steps)
  1. explain · ROLLUP / CUBE / GROUPING SETS; rolled up columns show NULL.
  2. example · ROLLUP by region: two NULL rows (Hollow's 1 run and the 50 run total), `GROUPING(region)` column.
  3. quiz · Which NULL is the subtotal? (`GROUPING(region) = 1`; COALESCE relabels real NULLs)
  4. explain · Pivot with `count(*) FILTER (WHERE ...)` per column; `sum(CASE ...)`; crosstab needs declared columns.
  5. example · Dungeons × seasons pivot (Spire 0, 0 in seasons 1 and 2).
  6. explain · percentile_cont (interpolated), percentile_disc, mode() WITHIN GROUP.
  7. example · mean 2581.6 vs median 2400, p90 4910 vs 4900, stddev_samp vs stddev_pop, corr 0.998 (not causation).
  8. explain · Relational division: count match on the gold badges or double NOT EXISTS.
  9. explain · Random: ORDER BY random() LIMIT, TABLESAMPLE BERNOULLI vs SYSTEM, REPEATABLE and setseed.
  10. try · runs per season plus a grand total row (ROLLUP).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch18-ex01 | region, runs, total_score per player region + grand total (ROLLUP) | 2 | query | result | grouping-sets | write |
| ch18-ex02 | fix COALESCE labels: ROLLUP (region, dungeon name) with `'(all)'` only on subtotals, Hollow's NULL kept | 4 | query | result | grouping-sets | fix |
| ch18-ex03 | dungeon_id, s1..s4 runs per season, 0 when none | 3 | query | result | pivoting | write |
| ch18-ex04 | one row: median (percentile_cont), p90 (percentile_cont 0.9), top_dungeon (mode) | 3 | query | result | ordered-set-aggregates | write |
| ch18-ex05 | dungeon_id, sd (stddev_samp), r (corr score/floor) for dungeons with 9+ runs | 3 | query | result | statistical-aggregates | write |
| ch18-ex06 | handle of players holding every gold achievement (Kaito); starter answers "at least one" | 4 | query | result | relational-division | write |
| ch18-ex07 | sampled count and avg score (1 decimal) of `run_archive TABLESAMPLE BERNOULLI (1) REPEATABLE (42)`; starter uses SYSTEM without seed | 2 | query | result | random-sampling | write |
| ch18-ex08 | **Boss · The Astronomer's Almanac**: per season, rank() ≤ 4 of players' best scores (16 rows): season_id, place, handle, best_score, easy / mid / hard runs that season (difficulty 1 or 2, 3, 4 or 5), login_days (distinct days, 0 if none); order season_id, place, handle | 5 | query | result (ordered) | pivoting, top-n-per-group, deduplication, ranking-functions, cte-basics | write |

- **Practice**: `ch18-pr01` grouping-sets: GROUPING SETS ((season_id), (dungeon_id), ()); `ch18-pr02` grouping-sets: CUBE (region, season_id) with a GROUPING bitmask; `ch18-pr03` pivoting: cleared / died / abandoned per region; `ch18-pr04` pivoting: two argument crosstab with NULL cells; `ch18-pr05` statistical-aggregates: regr_slope and regr_intercept (y, x); `ch18-pr06` ordered-set-aggregates: median finished run duration in minutes per dungeon; `ch18-pr07` relational-division: every silver badge (NightOwl); `ch18-pr08` relational-division: players who entered every dungeon, double NOT EXISTS (NightOwl; Kaito has 5 runs but 3 dungeons); `ch18-pr09` random-sampling: `setseed(0.42)` then 3 handles by `ORDER BY random()`.
- **Negative cases**: dropped NULL region, missing total (ex01); CUBE and unlabelled subtotals (ex02); crosstab NULLs, counts without FILTER (ex03); avg as median, percentile_disc, DESC order (ex04); stddev_pop, `> 9` (ex05); any three badges, at least two gold (ex06); SYSTEM sampling, other seed (ex07); dense_rank, counted doubles, inner join on logins, ranking single runs (boss). Accept: GROUPING SETS / CUBE / UNION ALL totals, GROUPING bitmask, sum(CASE) and LEFT JOIN pivots, percentile arrays, double NOT EXISTS, FILTER based division.
- **Notes**: random prompts always name the seed (`setseed` or `REPEATABLE`), else the learner and judge sandboxes see different rows. crosstab needs `tablefunc` (loaded by the dataset) and an ordered source. **Deliberate change from the coordinator draft:** the boss reports `login_days` (distinct login days, deduplication from ch16) instead of the longest login streak, because ch17 (gaps and islands) is not a prerequisite of ch18 on the unlock graph. The boss keeps places ≤ 4 (16 rows, 4 per season) instead of ≤ 3: with ≤ 3 the wrong method "rank single runs" gives the same rows, with ≤ 4 Kaito would appear twice in season 4, so the check catches it. Boss facts: Ægir has 0 login days, NightOwl 9, Kaito 7, xX_Slayer_Xx 3.
