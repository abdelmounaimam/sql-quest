### ch38-index-forging · Index Forging 🗝️
- **File** `src/content/chapters/ch38-index-forging.ts` · **World** The Clockwork Engine · **Tier** expert · **Track** performance · **Dataset** `dungeon`
- **Subtitle** B-trees, column order, partial, expression, covering and specialist indexes
- **Concepts** `btree-index`, `multicolumn-index`, `partial-index`, `expression-index`, `covering-index`, `gin-gist-brin-hash`
- **Prerequisites** `ch37-reading-the-runes`
- **Lesson** (10 steps)
  1. explain · A B-tree is a sorted tree of keys with linked leaves: equality, ranges, `ORDER BY ... LIMIT`, `LIKE 'prefix%'`; every index costs space and slows every write.
  2. example · `CREATE INDEX run_archive_score_idx ON run_archive (score);` then plan_nodes of a top score range (Bitmap), the podium `ORDER BY score DESC LIMIT 5` (Limit, Index Scan: no Sort) and an untouched `dungeon_id` filter (Seq Scan).
  3. explain · Multicolumn: the index is sorted by the first column, then the second inside it; equality columns first, then the range or sort column; two single indexes are not one composite (BitmapAnd from ch37).
  4. quiz · best index for `WHERE season_id = 3 ORDER BY score DESC LIMIT 10`: `(season_id, score)` (misconceptions: range or sort column first, two separate indexes).
  5. explain · Partial index: `CREATE INDEX ... WHERE status = 'in_progress'` holds 2% of the rows; usable only when the query's WHERE implies the index predicate.
  6. explain · Expression index: `(lower(death_cause))` serves only queries using that exact expression; the expression must be IMMUTABLE (`started_at::date` on a timestamptz fails with 42P17).
  7. explain · Covering: `INCLUDE (score)` plus the visibility map; Index Only Scan needs VACUUM (autovacuum never runs here); VACUUM is its own statement.
  8. example · `CREATE INDEX ... (player_id) INCLUDE (score); VACUUM run_archive;` then plan_nodes (Index Only Scan).
  9. explain · GIN (arrays, jsonb, text search), GiST (ranges, geometry, exclusion), BRIN (huge tables physically ordered by the column, tiny), hash (equality only).
  10. try · create an index so `SELECT * FROM run_archive WHERE player_id = 20` is no longer a Seq Scan.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch38-ex01 | anti-cheat replay by seed: make `WHERE seed = 3007215346` use an index (plan has an index node) | 1 | ddl | state | btree-index | optimize |
| ch38-ex02 | season leaderboard `WHERE season_id = 3 ORDER BY score DESC LIMIT 10`: no Sort, an index node, and a composite whose first two keys are season_id then score | 3 | ddl | state | multicolumn-index | optimize |
| ch38-ex03 | starter forges `(player_id)` and `(dungeon_id)` separately (BitmapAnd): exactly one non-primary index, no BitmapAnd, and the Index Cond covers both columns (either order passes) | 3 | ddl | state | multicolumn-index | fix |
| ch38-ex04 | in-progress list `WHERE status = 'in_progress' ORDER BY started_at`: the plan uses a partial index (`pg_index.indpred` not NULL) and has no Sort | 3 | ddl | state | partial-index | optimize |
| ch38-ex05 | `WHERE lower(death_cause) = 'lava golem'` uses an index (expression index) | 3 | ddl | state | expression-index | optimize |
| ch38-ex06 | `SELECT player_id, score ... WHERE player_id = 20` becomes an Index Only Scan (covering index + VACUUM) | 4 | ddl | state | covering-index | optimize |
| ch38-ex07 | cursed tag search answered by a GIN index and a one day `started_at` count answered by a BRIN index (access method of the index named in the plan) | 4 | ddl | state | gin-gist-brin-hash | optimize |
| ch38-ex08 | **Boss · The Smith's Masterwork**: at most 3 new indexes for 4 queries: season leaderboard (no Sort), season 1 high scores count (Index Only Scan), in-progress list (partial, no Sort), cursed tags (GIN) | 5 | ddl | state | multicolumn-index, covering-index, partial-index, gin-gist-brin-hash | optimize |

- **Practice**: `ch38-pr01` btree-index: index for `WHERE score >= 5200` (326 rows); `ch38-pr02` btree-index: podium `ORDER BY score DESC LIMIT 5` without a Sort; `ch38-pr03` multicolumn-index: `(region, started_at)` for `region = 'sa' AND started_at >= '2025-12-01'` (key order checked); `ch38-pr04` partial-index: `(score) WHERE status = 'abandoned'` for abandoned runs above 4800; `ch38-pr05` expression-index: `CREATE INDEX ... ((started_at::date))` must fail with 42P17; `ch38-pr06` expression-index: the immutable way `((started_at AT TIME ZONE 'UTC')::date)` and a query using it; `ch38-pr07` covering-index: `(player_id) INCLUDE (dungeon_id)` + VACUUM; `ch38-pr08` gin-gist-brin-hash: hash index on seed (access method checked); `ch38-pr09` gin-gist-brin-hash: GiST on `seasons.during`.
- **Negative cases to add**: ex01 an index on player_id; ex02 `(score DESC, season_id)` (PG18 skip scan avoids the Sort, but the key order is wrong), `(season_id)` alone (Sort); ex03 the starter, keeping only `(player_id)`; ex04 full `(status, started_at)`, partial on `(id)` (Sort stays); ex05 index on bare `death_cause`; ex06 covering index without VACUUM, VACUUM alone; ex07 B-tree on tags, B-tree on started_at instead of BRIN; boss 4 indexes; accept other names, `(season_id, score DESC, id)`, `(player_id, score)` + VACUUM, both column orders in ex03, hash index in ex01.
- **Notes**: verified plans: `(season_id, score)` gives `{Limit,Index Scan}` (12 buffers) and `(score DESC, season_id)` also avoids the Sort (15 buffers, skip scan), so ex02 grades the key order through `pg_index.indkey`. `(season_id, score)` answers the season 1 count with an Index Only Scan even before VACUUM; `(player_id) INCLUDE (score)` needs VACUUM. Full `(started_at)` index leaves the in-progress list as `{Sort,Seq Scan}`. VACUUM cannot go in setupSql (it runs as one batch).
