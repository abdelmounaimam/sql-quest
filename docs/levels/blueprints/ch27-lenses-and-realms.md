### ch27-lenses-and-realms · Lenses and Realms 🔭
- **File** `src/content/chapters/ch27-lenses-and-realms.ts` · **World** The Architect's Tower · **Tier** adept · **Track** schema · **Dataset** `guild`
- **Subtitle** Views, materialized views, schemas and reading the catalog
- **Concepts** `views`, `materialized-views`, `schemas-search-path`, `catalog-introspection`
- **Prerequisites** `ch26-blueprints`, `ch13-unions-and-named-spells`
- **Lesson** (9 steps)
  1. explain · A view is a saved query with a name; it stores no rows and is always up to date.
  2. example · `CREATE VIEW hero_cards AS ... LEFT JOIN guilds ...; SELECT * FROM hero_cards;`
  3. explain · Simple views are updatable; `WITH CHECK OPTION` refuses rows the view could not see (44000).
  4. quiz · A view created with `SELECT *`; you add a column to the table. Does the view show it? (no: the column list was frozen at creation)
  5. explain · Materialized views store the result; `REFRESH MATERIALIZED VIEW`; CONCURRENTLY needs a unique index (55000).
  6. explain · Schemas are namespaces: `CREATE SCHEMA`, `ALTER TABLE ... SET SCHEMA`, `search_path` decides lookup (42P01 when off the path).
  7. example · `information_schema.tables` listing of the user schemas.
  8. explain · No `\d` here: `information_schema.columns`, `pg_indexes`, `pg_constraint`, `'heroes'::regclass`, `obj_description`.
  9. try · Create view `wanderers` (name, level) of heroes without a guild.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch27-ex01 | View **guild_rosters** (guild, hero, class) for every hero with a guild. Verify: a new hero added after the view appears in it | 2 | ddl | state | views | design |
| ch27-ex02 | View **apprentices** (id, name, class, level, joined_on) of heroes below level 10 WITH CHECK OPTION. Probes: insert level 3 ok, level 15 44000, raise Pip to 12 44000 | 3 | ddl | state | views | design |
| ch27-ex03 | Materialized view **quest_board** (title, completions, 0 included), then record Bors (24) completing Rats in the Cellar (1) and refresh. Verify: relkind 'm' and fresh counts | 3 | ddl | state | materialized-views | write |
| ch27-ex04 | Error mission: `REFRESH MATERIALIZED VIEW CONCURRENTLY` on setupSql `region_rewards` without unique index: **55000** | 2 | ddl | error 55000 | materialized-views | predict |
| ch27-ex05 | Move `adventurer_sheet_legacy` and `hero_attributes` into new schema **archive** | 2 | ddl | state | schemas-search-path | write |
| ch27-ex06 | Fix: after the move (setupSql), `SELECT attr, count(*) ... FROM hero_attributes` fails 42P01. Put archive on the search_path (or qualify) | 3 | query | result | schemas-search-path | fix |
| ch27-ex07 | Catalog: **column_name**, **data_type**, **is_nullable** of every column of `heroes` in table order | 2 | query | result (ordered) | catalog-introspection | write |
| ch27-ex08 | **Boss · The Grand Lens**: create view **fk_map** (table_name, fk_count, referenced: distinct referenced tables, sorted, comma separated) for every public table with a FK, then return it ordered by table_name | 5 | ddl | result+state | catalog-introspection, views | write |

- **Practice**: `ch27-pr01` views: `CREATE OR REPLACE VIEW` adding a column at the end (setupSql view); `ch27-pr02` views: update a hero's level through a simple view; `ch27-pr03` materialized-views: `WITH NO DATA` then SELECT → 55000; `ch27-pr04` materialized-views: refresh a stale setupSql matview after an insert; `ch27-pr05` schemas-search-path: schema `vault` with table `vault.relics(name text)` and one row; `ch27-pr06` catalog-introspection: indexes of `heroes` from `pg_indexes`; `ch27-pr07` catalog-introspection: `COMMENT ON TABLE quests` then read it with `obj_description`.
- **Negative cases to add**: INNER vs LEFT in the board (quests with 0 completions vanish), CREATE TABLE AS instead of a view (frozen copy), plain view for quest_board, forgotten REFRESH, missing WITH CHECK OPTION, wrong column order in the catalog list, `count(DISTINCT)` vs constraint count in the boss. Accept: qualified `archive.hero_attributes`, `pg_attribute` catalog versions, `information_schema` FK versions of the boss, `SET search_path = public, archive` vs `archive, public`.
- **Notes**: `SET search_path` lasts for the rest of the learner script only. Boss counts: heroes 2 (guilds, heroes), quest_completions 2, rumors 2 (heroes once in `referenced`), quests, inventories, skill_tree, hero_titles, hero_attributes 1 each.
