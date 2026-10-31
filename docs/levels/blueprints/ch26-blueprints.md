### ch26-blueprints · Blueprints 📐
- **File** `src/content/chapters/ch26-blueprints.ts` · **World** The Architect's Tower · **Tier** adept · **Track** schema · **Dataset** `guild`
- **Subtitle** From the old scribe's ledger to a clean, normalized design
- **Concepts** `er-modeling`, `relationship-cardinality`, `normalization-1nf`, `normalization-2nf-3nf`, `normalization-bcnf-beyond`
- **Prerequisites** `ch25-binding-laws`
- **Grading** Hidden `pg_temp.try_sql` probes (see ch24) plus content queries on the learner's tables.
- **Lesson** (10 steps)
  1. explain · Design before DDL: entities, attributes, relationships, business rules. Model facts, not reports.
  2. quiz · "A hero belongs to one guild; a guild has many heroes": where does the foreign key go? (heroes.guild_id)
  3. explain · Many-to-many needs a junction table with two FKs and a composite key (`quest_completions`).
  4. example · Meet the legacy: `SELECT * FROM adventurer_sheet_legacy;` (comma lists, item1..3, repeated guild halls).
  5. explain · 1NF: one value per cell. `string_to_table(party_members, ',')` + `trim` turns a list into rows.
  6. example · Unpivot item1..item3 with `CROSS JOIN LATERAL (VALUES (1, item1), (2, item2), (3, item3))`.
  7. explain · 2NF/3NF: the key, the whole key and nothing but the key; guild_hall depends on guild_name, not on the sheet.
  8. example · The update anomaly: Silver Dragon's hall spelled 'Highmoor' and 'High Moor'.
  9. explain · BCNF, 4NF, 5NF in one card: every determinant is a key; independent multivalued facts in separate tables.
  10. try · Return **sheet_id** and **member** (trimmed) for every party member of every sheet.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch26-ex01 | Predict the cardinality: one row, **heroes_guilds** and **heroes_quests** from `'1:1'`, `'1:N'`, `'M:N'` (`'1:N'`, `'M:N'`) | 1 | query | result | er-modeling, relationship-cardinality | predict |
| ch26-ex02 | Create junction **hero_skills(hero_id, skill_id, learned_on date)** with both FKs and a composite PK. Probes: ok pairs, duplicate 23505, unknown hero/skill 23503, NULL skill 23502 | 3 | ddl | state | relationship-cardinality | design |
| ch26-ex03 | 1NF: **sheet_id**, **member** for every party member (trimmed, empty entries excluded) | 3 | query | result | normalization-1nf | write |
| ch26-ex04 | 1NF for items: **sheet_id**, **slot** (1 to 3), **item** for every non-NULL item column, duplicates kept | 3 | query | result | normalization-1nf | write |
| ch26-ex05 | The FD violation: **guild_name** and **halls** (number of different spellings) for guilds spelled more than one way | 3 | query | result | normalization-2nf-3nf | write |
| ch26-ex06 | Decompose: create `legacy_guilds(guild_name PK, guild_hall NOT NULL)` filled with the **most frequent** spelling per guild ('Highmoor', min() gives 'High Moor') | 4 | ddl | state | normalization-2nf-3nf | design |
| ch26-ex07 | Fix: setupSql `hero_class_skills(hero_id, class, skill_id)` repeats the class per skill (partial dependency, one row even disagrees with heroes). Starter copies it whole with CREATE TABLE AS. Create `hero_skill_list(hero_id, skill_id, PK both)` with the pairs only | 4 | ddl | state | normalization-2nf-3nf, normalization-bcnf-beyond | fix |
| ch26-ex08 | **Boss · The Scribe's Redemption**: `legacy_guilds`, `legacy_sheets(sheet_id PK, hero_name, guild_name FK)`, `legacy_party(sheet_id FK, member, PK both)`, `legacy_items(sheet_id FK, slot 1..3 CHECK, item, PK sheet_id+slot)`, filled with the rules of ex03 to ex06. Verify: lossless rebuild per sheet + probes | 5 | ddl | state | normalization-1nf, normalization-2nf-3nf, relationship-cardinality | design |

- **Practice**: `ch26-pr01` er-modeling: which of hero, pet, color is an attribute (`'color'`); `ch26-pr02` er-modeling: model a report vs facts (which column of a `guild_report(guild, hero_count)` table is derived: `'hero_count'`); `ch26-pr03` relationship-cardinality: 1:1 `hero_biographies(hero_id PK FK)`; `ch26-pr04` normalization-1nf: party size per sheet from the comma list (0 for Cedric); `ch26-pr05` normalization-1nf: sheets listing the same item twice; `ch26-pr06` normalization-2nf-3nf: regions whose quests have several difficulties (region does not determine difficulty); `ch26-pr07` normalization-2nf-3nf: legacy sheets whose hall disagrees with `guilds.hall_region`; `ch26-pr08` normalization-bcnf-beyond: lowest normal form violated by `lessons(student, subject, teacher)` (`'BCNF'`).
- **Negative cases to add**: no trim (leading spaces), DISTINCT on the item unpivot (drops real duplicates), `count(guild_hall)` instead of DISTINCT, min() for the hall, CREATE TABLE AS keeping the class column, swapped cardinalities, no composite PK in junction. Accept: `unnest(string_to_array(...))`, `regexp_split_to_table`, UNION ALL unpivot, `mode() WITHIN GROUP`, `DISTINCT ON` with count ordering, inline vs table constraints.
- **Notes**: `string_to_table('', ',')` yields no rows, so Cedric's empty party disappears by itself; trimming is the real trap. er-modeling and BCNF are conceptual: closed-list text answers stated in the prompt.
