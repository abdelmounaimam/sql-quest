### ch40-undead-rows-and-big-tables · Undead Rows and Big Tables 🧟
- **File** `src/content/chapters/ch40-undead-rows-and-big-tables.ts` · **World** The Clockwork Engine · **Tier** master · **Track** performance · **Dataset** `dungeon`
- **Subtitle** MVCC, VACUUM, keyset pages, N+1, write costs, partitions and stats views
- **Concepts** `mvcc-concept`, `vacuum-mvcc`, `pagination-performance`, `n-plus-one`, `write-performance`, `partitioning`, `query-stats`
- **Prerequisites** `ch39-why-not-my-index`, `ch22-merge-and-upsert`
- **Lesson** (10 steps)
  1. explain · MVCC: an UPDATE writes a new row version and leaves the old one for readers; `ctid` (where a version lives) and `xmin` (who wrote it); dead versions are the undead rows.
  2. example · one statement, data-modifying CTE: old ctid and xmin of NightOwl next to the new ones returned by `UPDATE ... RETURNING ctid, xmin` ((0,1) becomes (0,26)).
  3. explain · VACUUM marks dead space reusable and fills the visibility map; VACUUM FULL rewrites the table under an exclusive lock; autovacuum never runs here; VACUUM is its own statement, never inside BEGIN (25001).
  4. quiz · after deleting the 10 000 abandoned runs, `pg_relation_size` is? (unchanged; misconception: DELETE frees disk)
  5. explain · OFFSET reads and throws away every skipped row; keyset continues after the last row seen: `WHERE (score, id) < (3000, 77630) ORDER BY score DESC, id DESC LIMIT 20` with a matching index; the unique tie breaker is mandatory.
  6. explain · N+1: one query for the list then one per row (or a correlated subquery per row); fix with one JOIN or `= ANY (ARRAY[...])`.
  7. explain · Write costs: every index is updated by every INSERT, UPDATE (unless HOT) and DELETE; batch writes; drop redundant prefixes and indexes with `idx_scan = 0`.
  8. explain · Partitioning: `PARTITION BY LIST (season_id)`, pruning, DEFAULT partition, dropping a partition as instant retention; it does not speed up queries without the key.
  9. example · stats views: count players, `pg_stat_force_next_flush()`, then `pg_stat_user_tables` (counters start at 0 in every sandbox; pg_stat_statements is not available here: think total time = calls x mean).
  10. try · DELETE the abandoned runs, flush, return n_dead_tup of run_archive (10000).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch40-ex01 | move NightOwl to region na and return her row's old and new ctid in one statement (data-modifying CTE or temp table): (0,1), (0,26) | 2 | mutation | result+state | mvcc-concept | predict |
| ch40-ex02 | starter only deletes the abandoned runs: also make the space reusable; verify abandoned = 0 and `relallvisible > 0` (VACUUM filled the visibility map) | 2 | mutation | state | vacuum-mvcc | fix |
| ch40-ex03 | starter runs `VACUUM FULL` inside BEGIN/COMMIT (25001): fix so the deleted space is really returned; verify size below 14 000 000 bytes (14 630 912 to 13 410 304) | 3 | mutation | state | vacuum-mvcc | fix |
| ch40-ex04 | keyset page: id, score of the 20 runs after (score 3000, id 77630) in score DESC, id DESC order | 3 | query | result (ordered) | pagination-performance | write |
| ch40-ex05 | create the index that serves that keyset query with no Sort (`(score)` alone leaves an Incremental Sort) | 3 | ddl | state | pagination-performance | optimize |
| ch40-ex06 | the leaderboard fetched 10 runs then 10 handles one by one: return id, score, handle of the season 3 top 10 in one query | 2 | query | result | n-plus-one | refactor |
| ch40-ex07 | setupSql forges `ra_player`, `ra_player_started`, `ra_season`, `ra_season_score`; starter drops the wrong one: drop the indexes made redundant by a longer index with the same leading column | 3 | ddl | state | write-performance | fix |
| ch40-ex08 | `runs_by_season` partitioned by LIST (season_id), partitions `runs_s1` to `runs_s3`, filled from run_archive; verify counts per partition, relkind `p` and pruning (`plan_json` relation names for season 2 = `["runs_s2"]`) | 4 | ddl | state | partitioning | design |
| ch40-ex09 | **Boss · Overclock the Engine**: at most 2 new indexes so the season 3 keyset page (`season_id = 3 AND (score, id) < (5000, 60000)`) has no Sort and the live board uses a partial index; return that page with handles in one query (id, score, handle, ordered) | 5 | ddl | result+state | pagination-performance, n-plus-one, write-performance, partial-index, multicolumn-index | optimize |

- **Practice**: `ch40-pr01` mvcc-concept: update two players in two statements, count distinct `xmin::text` of players (3); `ch40-pr02` vacuum-mvcc: relation size before and after deleting the abandoned runs (equal); `ch40-pr03` pagination-performance: page 3 of 10 season 1 runs with OFFSET (ordered); `ch40-pr04` pagination-performance: the 10 season 1 runs after (4000, 10000) with keyset; `ch40-pr05` n-plus-one: run counts of players 4, 8 and 15 with `= ANY (ARRAY[...])`; `ch40-pr06` write-performance: run a dashboard workload, flush, name the never used secondary index (`run_archive_region_idx`); `ch40-pr07` partitioning: add a DEFAULT partition so the starter's season 9 insert lands in `runs_other`; `ch40-pr08` query-stats: seq_scan of players after three counts (3); `ch40-pr09` query-stats: from a VALUES stand-in for pg_stat_statements, the query with the largest total time (calls x mean), not the slowest single call.
- **Negative cases to add**: ex01 swapped ctids; ex02 the starter (no VACUUM); ex03 plain VACUUM (size unchanged), the starter; ex04 `score <= 3000 AND id < 77630`, `<=` row comparison (anchor repeated), `score < 3000` (tied runs lost), ASC tie breaker; ex05 `(score)` alone; ex06 inner join without the top 10 filter; ex07 dropping the long indexes, dropping all; ex08 plain table; boss OFFSET page, 3 indexes; accept `score < 3000 OR (score = 3000 AND id < 77630)`, `(score DESC, id DESC)`, RANGE partitions, temp table instead of a CTE.
- **Notes**: statistics counters start at 0 in every sandbox; `pg_stat_force_next_flush()` publishes pending counts, and a DELETE flushed after a VACUUM brings its 10 000 dead tuples back into `n_dead_tup` (80000 live, 10000 dead): never grade on counters read after VACUUM, grade VACUUM with `pg_class.relallvisible` (0 before, 1786 after) or `pg_relation_size`. VACUUM FULL leaves `relallvisible` at 0. `n_tup_del` counts rolled back deletes. Plain `plan_nodes` cannot show pruning; read `Relation Name` in `plan_json`. Inserting the 100 000 runs into partitions takes well under a second.
