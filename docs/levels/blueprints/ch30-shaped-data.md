### ch30-shaped-data · Shaped Data 🧬
- **File** `src/content/chapters/ch30-shaped-data.ts` · **World** The Alchemist's Vault · **Tier** adept · **Track** types · **Dataset** `guild`
- **Subtitle** Enums that sort themselves, domains that guard, composites and arrays
- **Concepts** `enum-types`, `domain-types`, `composite-types`, `arrays`
- **Prerequisites** `ch29-precise-measures`, `ch25-binding-laws`, `ch12-exists-or-not`
- **Lesson** (10 steps)
  1. explain · Enums: labels with a rank: enums: ordered labels, declaration order, 22P02
  2. example · The rarity ladder: items by rarity DESC
  3. quiz · `ORDER BY class` first value → warrior (misconception: alphabetical)
  4. explain · Domains: a type with a rule: domains: CREATE DOMAIN ... CHECK (VALUE ...), 23514
  5. explain · Composite types: a row in a cell: composites: `(stats).dex`, `stats.dex` is 42P01, ROW(...)::stat_block
  6. example · The nimblest heroes: nimblest heroes, Bors' NULL stats
  7. explain · Arrays: arrays: 1-based, `= ANY`, `@>` all, `&&` any, cardinality, unnest, NULL vs '{}'
  8. quiz · `tags[0]` → NULL (0-based habit)
  9. example · Scouts of the guild: scouts with `@>`
  10. try · Your turn: the first tag: first tag (starter uses tags[0])
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch30-ex01 | items rarer than uncommon (`rarity > 'uncommon'`) | 1 | query | result | enum-types | write |
| ch30-ex02 | hero count per class in declaration order | 2 | query | result (ordered) | enum-types | write |
| ch30-ex03 | CREATE DOMAIN gold_amount (numeric(10,2), >= 0) and retype heroes.gold; behavioural verify via try_sqlstate | 3 | ddl | state | domain-types | design |
| ch30-ex04 | str, dex, wis of heroes with wis >= 15, wis desc, name | 2 | query | result (ordered) | composite-types | write |
| ch30-ex05 | fix `stats.dex` (42P01) → `(stats).dex` | 2 | query | result | composite-types | fix |
| ch30-ex06 | fix `tags && '{scout,archer}'`: heroes with both tags (`@>`) | 2 | query | result | arrays | fix |
| ch30-ex07 | heroes with no tags: NULL or '{}' (7) | 3 | query | result | arrays | write |
| ch30-ex08 | tag census with unnest, most common first, ties by tag | 3 | query | result (ordered) | arrays | write |
| ch30-ex09 | **Boss · The Class Registry**: per class (enum order) hero count, avg dex 1 decimal, sorted distinct tag array (subquery, no fan-out) | 4 | query | result (ordered) | enum-types, composite-types, arrays | write |

- **Practice**: `ch30-pr01` enum-types: rarity BETWEEN uncommon AND epic; `ch30-pr02` enum-types: ALTER TYPE ADD VALUE 'paladin' AFTER 'cleric'; `ch30-pr03` enum-types: insert invalid label must fail 22P02; `ch30-pr04` domain-types: level_20 domain + apprentices table (try_sqlstate verify); `ch30-pr05` composite-types: str > dex; `ch30-pr06` composite-types: `(ROW(10,12,14)::stat_block).dex`; `ch30-pr07` arrays: tags overlapping Aldric's (`&&`); `ch30-pr08` arrays: coalesce(cardinality(tags), 0); `ch30-pr09` arrays: fix `'fire' IN (tags)` → `= ANY`
- **Negative cases** (`scripts/negative-cases/ch30-shaped-data.ts`): ex01 `rarity::text >` (empty); ex02 `ORDER BY class::text`; ex03 table CHECK instead of domain, `VALUE > 0`, NOT NULL domain, domain not applied; ex04 `ORDER BY stats`; ex06 `= ANY` single tag (`= ANY vs @>`); ex07 `= '{}'`, `IS NULL`, `cardinality = 0`; ex09 fan-out unnest in FROM, unrounded avg, alphabetical order. Accept `(stats).*`, `<@`, `array_length IS NULL`, CTE and LATERAL forms.
- **Notes**: Tags NULL for heroes 11, 18, 30; '{}' for 9, 17, 22, 24 (Bors also has NULL stats). Collation C: `Nyx` sorts before `Ælfric`. `try_sqlstate(q text)` (plpgsql EXECUTE, returns SQLSTATE or 'ok') is created in the exercise setupSql of the domain exercises.
