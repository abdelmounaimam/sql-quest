### ch37-reading-the-runes · Reading the Runes 📖
- **File** `src/content/chapters/ch37-reading-the-runes.ts` · **World** The Clockwork Engine · **Tier** adept · **Track** performance · **Dataset** `dungeon`
- **Subtitle** EXPLAIN, plan nodes, estimates vs reality, and how tables get joined
- **Concepts** `explain-basics`, `explain-analyze`, `scan-types`, `join-algorithms`
- **Prerequisites** `ch18-the-grand-report`, `ch28-cursed-designs`
- **Lesson** (10 steps)
  1. explain · EXPLAIN shows the plan: a tree of nodes, read from the most indented line up; cost is in planner units, not ms; rows is an estimate.
  2. example · First rune: `EXPLAIN SELECT * FROM run_archive WHERE player_id = 7;` (Seq Scan, Filter, rows estimate close to 2900).
  3. quiz · `cost=0.00..3036.00` means? (startup and total cost in planner units; misconception: milliseconds)
  4. explain · EXPLAIN ANALYZE runs the query: actual rows, loops, Rows Removed by Filter, Buffers; timings are meaningless in this browser engine; options `COSTS OFF, TIMING OFF`; DML must be wrapped in BEGIN/ROLLBACK.
  5. example · `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT count(*) FROM run_archive WHERE region = 'sa';` (10000 kept, 90000 removed, 1786 buffers).
  6. explain · Scan types: Seq Scan, Index Scan, Index Only Scan, Bitmap Index Scan + Bitmap Heap Scan; the `plan_nodes(text)` helper and `(plan_nodes(...))[1]` for the top node.
  7. example · `plan_nodes` of a key lookup, a keys only range (`Index Only Scan` without asking) and a full scan.
  8. explain · Join algorithms: Nested Loop (few outer rows, indexed inner side), Hash Join (big unsorted inputs), Merge Join (inputs already sorted).
  9. quiz · Nested Loop with 50 outer rows and an inner Seq Scan of 100 000 rows: what is wrong? (no index on the inner join key; misconception: nested loops are always bad)
  10. try · plan_nodes of `SELECT * FROM run_archive WHERE id BETWEEN 10 AND 20` (`{Index Scan}`).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch37-ex01 | run EXPLAIN on `WHERE dungeon_id = 2` and answer with `SELECT '<top node>'` (Seq Scan) | 1 | query | result | explain-basics | predict |
| ch37-ex02 | answer with the planner's estimated rows for `WHERE region = 'sa'` (read from EXPLAIN; varies around 10000 per build, solution reads `plan_json`) | 2 | query | result | explain-basics | predict |
| ch37-ex03 | with EXPLAIN ANALYZE, answer actual rows and Rows Removed by Filter of `WHERE status = 'in_progress'` (2000, 98000) | 2 | query | result | explain-analyze | predict |
| ch37-ex04 | starter `EXPLAIN ANALYZE DELETE ... 'abandoned'` really deletes: wrap it in BEGIN/ROLLBACK; verify abandoned rows still 10000 and `n_tup_del` >= 10000 (proof the plan really ran) after `pg_stat_force_next_flush()` | 3 | transaction | state | explain-analyze | fix |
| ch37-ex05 | three columns: scan node of `WHERE id = 42`, of `SELECT id ... WHERE id < 100`, of `WHERE score > 5000` (Index Scan, Index Only Scan, Seq Scan) | 2 | query | result | scan-types | predict |
| ch37-ex06 | setupSql indexes player_id and dungeon_id separately: name the node that merges the two bitmaps of `player_id = 20 AND dungeon_id = 3` and the number of Bitmap Index Scans (BitmapAnd, 2) | 2 | query | result | scan-types | predict |
| ch37-ex07 | setupSql indexes run_archive(player_id): join node of all runs joined to players (Hash Join), of NightOwl only (Nested Loop), of live runs joined to their archive copy by id (Merge Join) | 3 | query | result | join-algorithms | predict |
| ch37-ex08 | **Boss · The Rune Reader**: four labelled queries in a VALUES list (starter): label, top node, join node or NULL, uses an index (boolean) | 4 | query | result | explain-basics, scan-types, join-algorithms | write |

- **Practice**: `ch37-pr01` explain-basics: estimated rows of `SELECT * FROM players` (25); `ch37-pr02` explain-basics: top node of `SELECT count(*) FROM run_archive` (Aggregate); `ch37-pr03` explain-analyze: actual rows produced by the archive Index Scan inside the live runs merge join (51, not 100 000); `ch37-pr04` explain-analyze: shared hit buffers of a primary key lookup (3); `ch37-pr05` scan-types: with an index on region, scan node of `region = 'eu'` and `region = 'sa'` (Seq Scan, Bitmap Heap Scan); `ch37-pr06` join-algorithms: `SET enable_hashjoin = off; SET enable_nestloop = off;` then the join node of runs to players in the archive (Merge Join); `ch37-pr07` join-algorithms: top node of the NightOwl join with the player_id index (Nested Loop).
- **Negative cases to add**: ex01 `'Index Scan'`, full EXPLAIN line text; ex02 the total row count; ex03 swapped columns; ex04 the starter, plain EXPLAIN (nothing ran); ex05 `'Index Scan'` for the keys only range; ex06 BitmapOr; ex07 swapped columns; accept `(plan_nodes(...))[1]` everywhere a literal is expected, START TRANSACTION / ABORT for ex04.
- **Notes**: ANALYZE samples randomly, so estimates differ between builds (9903 and 10133 seen for `region = 'sa'`): never hard-code an estimate, read it with `plan_json(q) -> 0 -> 'Plan' ->> 'Plan Rows'`. Actual rows and buffers are deterministic. Statistics counters start at 0 in every sandbox and need `SELECT pg_stat_force_next_flush();`. `n_tup_del` counts rolled back deletes too. PG18 removes a self join on the primary key (`run_archive a JOIN run_archive b ON b.id = a.id` plans as one Seq Scan): avoid it as a join example.
