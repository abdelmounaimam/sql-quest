### ch39-why-not-my-index · Why Not My Index? 🧐
- **File** `src/content/chapters/ch39-why-not-my-index.ts` · **World** The Clockwork Engine · **Tier** expert · **Track** performance · **Dataset** `dungeon`
- **Subtitle** Sargable predicates, selectivity, statistics, rewrites and CTE fences
- **Concepts** `sargability`, `index-selection-reasons`, `statistics`, `query-rewriting`, `cte-materialization`
- **Prerequisites** `ch38-index-forging`
- **Lesson** (10 steps)
  1. explain · Sargable: keep the indexed column bare; `started_at::date = d`, `score + 0 = 42`, `lower(region)` without an expression index hide it.
  2. example · B-tree on started_at, then plan_nodes of `started_at::date = '2025-06-01'` (Seq Scan) vs the half-open range (Index Only Scan).
  3. quiz · the region index is ignored for `region = 'eu'`: why? (60% of rows, Seq Scan is cheaper; misconception: the index is broken, force it with enable_seqscan)
  4. explain · Other reasons: tiny tables, stale statistics, type mismatch (`seed = 3007215346.0`), operators the index cannot serve (`<>`, `LIKE '%x'`), OR across unindexed columns.
  5. explain · Statistics: `pg_stats` (n_distinct, most_common_vals, histogram_bounds, correlation); ANALYZE explicitly after loads here; CREATE STATISTICS for correlated columns.
  6. example · pg_stats of region, status, started_at, player_id (negative n_distinct means a fraction of rows, correlation 1 for started_at).
  7. explain · Rewrites: EXISTS instead of JOIN + DISTINCT, pre-aggregate before joining, a correlated subquery per row is a hidden loop; measure each version.
  8. explain · CTEs are inlined since PG12; `MATERIALIZED` forces a fence that the outer filter cannot cross.
  9. example · plan_nodes of the same lookup through an inlined CTE (`{Index Scan}`) and a MATERIALIZED one (`{CTE Scan,Seq Scan}`).
  10. try · fix the text inside `plan_nodes('SELECT * FROM run_archive WHERE id + 1 = 4243')` so the primary key is used (`{Index Scan}`).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch39-ex01 | setupSql indexes started_at: count of runs started on 2025-06-01 (288) and plan_nodes of the sargable counting query (`{Aggregate,Index Only Scan}`); starter uses the cast | 2 | query | result | sargability | refactor |
| ch39-ex02 | setupSql indexes seed: starter `plan_nodes('... WHERE seed = 3007215346.0')` is a Seq Scan (numeric vs bigint); fix the literal so the index is used | 2 | query | result | index-selection-reasons | fix |
| ch39-ex03 | setupSql indexes status: top node of `status = 'finished'`, of `status = 'in_progress'` and of `players WHERE id = 3` (Seq Scan, Bitmap Heap Scan, Seq Scan) | 2 | query | result | index-selection-reasons | predict |
| ch39-ex04 | attname, n_distinct, correlation rounded to 2 decimals from pg_stats for region, started_at, status, sorted by attname | 2 | query | result (ordered) | statistics | write |
| ch39-ex05 | setupSql builds `run_copy` (6000 eu rows), ANALYZEs it, then adds 15000 na rows: the planner expects 1 na row; refresh statistics so the estimate is 15000 and `most_common_vals` is `{na,eu}` | 3 | ddl | state | statistics | fix |
| ch39-ex06 | refactor the correlated `(SELECT max(score) ... WHERE r.player_id = p.id)` into one grouped LEFT JOIN that also returns the run count: handle, best, runs (newbie_42: NULL, 0) | 3 | query | result | query-rewriting | refactor |
| ch39-ex07 | starter `plan_nodes('WITH c AS MATERIALIZED (...) SELECT * FROM c WHERE id = 5')`: remove the fence so the filter reaches the primary key (`{Index Scan}`) | 3 | query | result | cte-materialization | fix |
| ch39-ex08 | **Boss · The Lazy Index Inquiry**: indexes on started_at, score, player_id exist; rewrite three slow counts (extract year and month, `score / 2 >= 2600`, a MATERIALIZED CTE on player 20) and return label, runs, plan_nodes of the rewritten query | 5 | query | result | sargability, index-selection-reasons, cte-materialization | refactor |

- **Practice**: `ch39-pr01` sargability: `lower(region) = 'sa'` with an index on region, the data is already lower case; `ch39-pr02` sargability: `date_trunc('month', started_at) = '2025-03-01'` as a range: count (8928) and plan; `ch39-pr03` index-selection-reasons: `LIKE '%Golem'` vs `LIKE 'Lava%'` with an index on death_cause (Seq Scan, Bitmap Heap Scan); `ch39-pr04` index-selection-reasons: `status = 'in_progress'` vs `status <> 'finished'` with an index on status (Bitmap Heap Scan, Seq Scan); `ch39-pr05` statistics: CREATE STATISTICS (dependencies) on score, floor_reached then ANALYZE, verified in pg_stats_ext; `ch39-pr06` statistics: n_distinct of dungeon_id, player_id, season_id (5, 24, 3); `ch39-pr07` query-rewriting: handles with a run in dungeon 5 scoring 5200 or more, once each (EXISTS; JOIN without DISTINCT gives 65 rows for 19 players); `ch39-pr08` query-rewriting: cursed runs per dungeon name with zeros, pre-aggregated; `ch39-pr09` cte-materialization: predict both plans of a fenced and an inlined CTE.
- **Negative cases to add**: ex01 the cast version; ex02 `seed::numeric = ...`; ex03 Bitmap for finished; ex04 unordered; ex05 `VACUUM run_copy` (reltuples only, MCV unchanged); ex06 inner join (drops newbie_42), `count(*)` (1 for newbie_42); ex07 `MATERIALIZED` kept; boss the extract version; accept `NOT MATERIALIZED`, `ANALYZE;`, `VACUUM ANALYZE run_copy`, pre-aggregated derived tables, `score >= 5200` written as `score > 5199`.
- **Notes**: learner SQL cannot be EXPLAINed by the checker, so "make it sargable" missions grade the result plus `plan_nodes` of a query text the learner writes. `run_copy` stays below 30 000 rows so ANALYZE reads every row and the estimates are exact. `players WHERE id = 3` is a Seq Scan despite the primary key (one page). `status <> 'finished'` (12%) stays a Seq Scan: B-trees cannot serve `<>`.
