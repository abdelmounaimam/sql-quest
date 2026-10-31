### ch28-cursed-designs · Cursed Designs 💀
- **File** `src/content/chapters/ch28-cursed-designs.ts` · **World** The Architect's Tower · **Tier** expert · **Track** schema · **Dataset** `guild`
- **Subtitle** EAV, polymorphic ids, cached counters and trees: break the curses
- **Concepts** `design-antipatterns`, `denormalization`, `hierarchy-models`
- **Prerequisites** `ch27-lenses-and-realms`, `ch14-the-endless-stair`
- **Lesson** (9 steps)
  1. explain · Karwin's antipatterns: EAV, polymorphic associations, item1..item3 columns, one table per year, comma lists. Flexible looking, but types and keys are lost.
  2. example · The EAV table: `SELECT * FROM hero_attributes;` every value is text: '2041-02-30', 'tall enough'.
  3. quiz · `notes(target_type, target_id)` points at heroes or quests. What can't the database enforce? (a foreign key)
  4. explain · Fix EAV: one typed column per attribute; find bad values first with `pg_input_is_valid(value, 'date')`.
  5. explain · Denormalization: a cached `hero_count` is fast to read and drifts unless every write updates it (triggers come in World 11).
  6. explain · Trees: adjacency list (`parent_id` + recursive CTE), materialized path (`skill_tree.path`), nested sets, closure table.
  7. example · The materialized path: `WHERE path::text LIKE 'mage.ice.%'` lists a subtree without recursion.
  8. quiz · Which models make "all descendants of Fire Magic" a non-recursive query? (path or closure table)
  9. try · **hero_id** and **value** of every non-NULL birthday that is not a valid date (only '2041-02-30').
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch28-ex01 | Un-EAV: one row per hero of `hero_attributes`: **hero_id**, **birthday**, **height_cm**, **favorite_color** (text, NULL when absent) | 3 | query | result | design-antipatterns | refactor |
| ch28-ex02 | Typed rescue: `hero_profiles(hero_id PK FK, birthday date, height_cm int CHECK > 0, favorite_color text)` filled from the EAV, only ISO `YYYY-MM-DD` valid dates and valid integers kept (others NULL). Probes: contents, 'someday' birthday refused, height 0 refused, hero 999 refused | 4 | ddl | state | design-antipatterns | design |
| ch28-ex03 | Fix: setupSql polymorphic `notes(id, target_type, target_id, body)`; starter adds an FK on target_id (fails 23503). Create `hero_notes(hero_id FK, body)` and `quest_notes(quest_id FK, body)`, copy the notes whose target exists | 4 | ddl | state | design-antipatterns | fix |
| ch28-ex04 | Cache: add `guilds.hero_count int NOT NULL DEFAULT 0`, filled with real counts (guild 6 stays 0) | 3 | ddl | state | denormalization | write |
| ch28-ex05 | Drift detector: setupSql adds a stale cache. **guild_id**, **cached**, **actual** where they differ (guild 6: cached 1, actual 0) | 3 | query | result | denormalization | write |
| ch28-ex06 | Subtree by path: **name** of every skill under Fire Magic, itself excluded (setupSql adds the decoy 'mage.firestorm') | 2 | query | result | hierarchy-models | write |
| ch28-ex07 | Closure table **skill_closure(ancestor_id, descendant_id, depth, PK pair)** with depth 0 self pairs, built from parent_id | 4 | ddl | state | hierarchy-models | design |
| ch28-ex08 | **Boss · Raise the Tower**: towers, floors (number 1..50 unique per tower, danger 1..5, required guardian hero), rooms (name unique per floor, optional parent room, never its own parent, deleted with their floor and their parent), room_treasures (item, qty > 0, once per room). About 20 probes | 5 | ddl | state | design-antipatterns, hierarchy-models | design |

- **Practice**: `ch28-pr01` design-antipatterns: EAV rows per attribute; `ch28-pr02` design-antipatterns: heights that are not integers (`pg_input_is_valid`); `ch28-pr03` denormalization: resync a stale cache with one UPDATE; `ch28-pr04` denormalization: guilds whose cached `total_gold` drifted; `ch28-pr05` hierarchy-models: depth of every skill from its path; `ch28-pr06` hierarchy-models: ancestors of Meteor with a recursive CTE.
- **Negative cases to add**: direct `value::date` cast (22008), `LIKE 'mage.fire%'` (decoy), closure without self pairs, `count(*)` with LEFT JOIN (guild 6 gets 1), FK on a polymorphic column, inner pivot dropping NULL attributes. Accept: ltree `<@`, `pg_input_is_valid` vs regex filters, `max(CASE ...)` vs FILTER pivots, `UPDATE ... FROM` vs correlated subquery.
- **Notes**: DateStyle is `ISO, MDY`, so '05/04/1995' is a valid date (May 4): ex02 keeps ISO dates only and says so. ltree itself is ch34: paths are read as text (`path::text LIKE`), `<@` accepted. `hierarchy-models` is named here for the first time.
