### ch43-trials-of-mastery ◇ · Trials of Mastery 👑
- **File** `src/content/chapters/ch43-trials-of-mastery.ts` · **World** The Astral Spire · **Tier** master · **Track** advanced · **Dataset** `guild`
- **Subtitle** Side quest: no new syntax, every technique, and a peek behind the server
- **Concepts** `operations-overview`
- **Prerequisites** `ch42-wards-and-gatekeepers`
- **Lesson** (7 steps)
  1. explain · What a real server adds: backups (`pg_dump`, base backup + WAL for point-in-time recovery), replication (a replica is not a backup), connection pooling, configuration, upgrades (`pg_upgrade`).
  2. example · Read the dials: `name, setting, unit, context` of `shared_buffers`, `work_mem`, `max_connections` from `pg_settings` (PGlite values differ from a server).
  3. explain · Measure before tuning: `pg_database_size`, `pg_total_relation_size`, stats views, EXPLAIN; `context` says how a setting changes (postmaster = restart, sighup = reload, user = SET).
  4. example · Biggest tables: `pg_total_relation_size` per table (surprise: a 6-row table weighs 48 kB, because of its indexes and 8 kB pages).
  5. quiz · Your replica is up to date: is it a backup? (no: a `DROP TABLE` replicates in milliseconds)
  6. explain · Trials rules: every trial mixes worlds, any technique is allowed, try before opening hints.
  7. try · Return the `context` of `shared_buffers` (postmaster).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch43-ex01 | starter uses `rank()` and puts four heroes on the Ember Fang podium: top 3 heroes by xp per guild, ties by name, wanderers excluded: guild name, hero name, xp | 3 | query | result | top-n-per-group, ranking-functions | fix |
| ch43-ex02 | heroes who completed **every** quest of their guild hall's region: Aldric, Morwen, Ulfric | 4 | query | result | relational-division | write |
| ch43-ex03 | every hero with the name of the root of their mentor tree and their depth (roots: themselves, depth 0) | 4 | query | result | recursive-cte | write |
| ch43-ex04 | inventories: rename `healing potion` to `Healing Potion` and merge quantities inside each bag (hero 13: 10 + 2); verify every item per bag plus the rest of each document | 5 | mutation | state | jsonb-modification, jsonb-decomposition | write |
| ch43-ex05 | the 3 largest guild tables by `pg_total_relation_size`, largest first, ties by name | 2 | query | result (ordered) | operations-overview, catalog-introspection | write |
| ch43-ex06 | cheapest portal route Highmoor to Frostspire: path array and total toll (48) | 4 | query | result | recursive-graph-walks | write |
| ch43-ex07 | **Boss · The Astral Throne**: `reward_ledger` (PK reward_id), gold audit trigger (only real changes), payout of `gold_rewards` applied once per reward (data-modifying CTE, run twice, NULL gold counts as 0, two rewards for Aldric), RLS so `guild_master_1` sees only guild 1 heroes, view `guild_leaderboard(guild, hero, xp, place)` with dense_rank; verify audit, gold, ledger, rows seen by the role, leaderboard places 1 to 3 (rank() would skip Pip) | 5 | ddl | state | upsert-patterns, audit-history, row-level-security, views, ranking-functions, data-modifying-cte | design |

- **Practice**: `ch43-pr01` operations-overview: `context` and `unit` of `work_mem` (user, kB); `ch43-pr02` operations-overview: `pg_database_size(current_database()) > 0` (sizes vary by environment, grade the boolean); `ch43-pr03` operations-overview: among `shared_buffers`, `work_mem`, `max_connections`, `wal_level`, `TimeZone`, the settings that need a restart (`context = 'postmaster'`).
- **Negative cases to add**: ex01 `rank()` (4 rows for Ember Fang), wanderers included; ex02 counting completions without restricting to the region; ex03 depth off by one, mentor instead of root; ex04 renaming without merging (hero 13 keeps two potion lines), touching coins; ex05 `pg_relation_size` (no indexes); ex06 shortest hop count instead of cheapest toll; boss `UPDATE ... FROM gold_rewards` (Aldric gets only one reward), payout without the ledger (doubles on the rerun), RLS without enabling, `rank()` in the view.
- **Notes**: side quest, master tier, concepts reach back into every world (the validator only warns on concepts of chapters not yet written). Never grade numeric settings (PGlite differs from a server), only `context`, `unit` and booleans; table sizes are compared learner vs reference on the same engine. Guild 6 has no heroes; wanderers 11, 15, 18, 22, 24, 25. Xander (22) has NULL gold. Role `guild_master_1` is created in the boss setupSql; RLS is checked through a `seen_as(role, table)` helper.
