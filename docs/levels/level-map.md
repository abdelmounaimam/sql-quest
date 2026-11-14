# SQL Quest level map

The blueprint every level writer follows. It fixes, for all 43 chapters, the id, world, dataset, concepts, prerequisites, lesson outline, exercise list and practice pool. World 1 (`ch01` to `ch04`) is written in full in `src/content/chapters/` and is the **reference implementation**: when in doubt, open those files and copy their shape, tone and rigor.

Sources: `docs/research/curriculum.md` (concept catalog, pedagogy, verified PGlite facts), `src/content/types.ts` (contract), `src/content/datasets/*.ts` (the six worlds), `scripts/validate-content.ts` (the judge of everything you write).

## 1. Workflow for a writer

1. Read this section, the style guide (section 2) and your chapter's blueprint (sections 4 to 14).
2. Open the dataset file of your chapter. Read `tableNotes`, `columnNotes` and the header comment: they list the deliberate quirks (NULLs, ties, orphans, case variants) your exercises should exploit.
3. Write `src/content/chapters/<id>.ts` (`export default` a `Chapter`, tabs, double quotes, like `ch01-hello-table.ts`).
4. Add negative and accept cases for your chapter to `scripts/negative-cases.ts` (section 2.8).
5. Run `pnpm validate:content <chapter-id>` until it prints `ok`. Then run it on the whole content once.
6. Never edit `src/content/types.ts` or a dataset to make an exercise work; if a dataset truly lacks something, prefer an exercise `setupSql` (it runs after the dataset, before the learner's SQL) and report the gap.

## 2. Style guide

### 2.1 Tone: the app plays like a game, the teaching reads like documentation
The game lives in the **interactions** (map, missions, bosses, hearts, XP, combos) and in the **names** (world names, level titles like *The Void*, the mascot). Everything that teaches is plain technical writing:
- Lesson cards, examples, quiz questions and explanations, mission prompts, hints and post-success explanations use the vocabulary of the PostgreSQL docs: *table, row, column, query, clause, predicate, NULL, join, index*. No role play, no characters, no "your first shift at the Starport", no "the dock chief needs...".
- Introduce each topic directly: what it is, the syntax, what it returns, the pitfalls. A learner must never have to understand a story to understand the SQL.
- The datasets are only example data. Refer to them by table and column names ("the `pilots` table", "ships with a `hull_integrity` below 50"), never as a world the learner lives in.
- Exercise `title`s describe the task ("Fix a trailing comma", "Ships per faction"), short, no puns.
- Exercise `story` is omitted on regular missions. On a boss it is one neutral sentence that says what the challenge combines ("Combines OR, AND and IS NULL in one WHERE clause."), shown on the boss intro.
- Chapter `subtitle` is technical ("SELECT, column lists, aliases and quoting"). Chapter `title` and `world` keep their game names.
- When a text points to another level, name the concept first ("NULL, covered in *The Void*"), not only the level.
- Second person, present tense, short sentences. Keep it friendly, not playful.
- No dash punctuation in learner-facing prose (no em dash, no en dash, no spaced hyphen). Use commas, colons, parentheses or a new sentence.

### 2.2 Datasets (example data, not a story)

| dataset | world(s) | what it holds |
|---|---|---|
| `starport` 🚀 Starport Exchange | 1, 2, 3, 6 | planets, factions, pilots, ships, traders, commodities, trades, routes |
| `guild` 🐉 Guild of the Silver Dragon | 4, 7, 8 | heroes, guilds, quests, quest completions, inventories, a legacy denormalized table |
| `dungeon` 🗡️ Dungeon Delve Leaderboard | 5, 10 | players, seasons, runs, achievements, logins, a large archive table |
| `bardic` 🎻 Bardic Beats | 5 (ch17), 9 (ch36) | artists, albums, tracks, listeners, plays, playlists, embeddings |
| `inn` 🏨 The Wandering Star Inn | 6 (ch23), 8 (ch29, ch33) | rooms, guests, bookings, payments, staff shifts across time zones |
| `library` 📜 The Great Library of Aethel | 8 (ch34), 9 (ch35), 11 | scrolls in English and French, readers, loans, sections, access logs |

### 2.3 Writing prompts so exactly one result is correct
- **Name every output column, in order**: "Return the **name** and **credits** of ...". Bold the column names. Column titles only matter when the check has `matchColumnNames: true`; then say so explicitly ("titled **Planet**").
- **State every filter boundary**: "500 or more", "between 20 and 50, both included", "known gravity only".
- **Say what happens to NULLs** whenever the column has any: "including pilots with no faction", "unknown dates go last".
- **Order**: use `orderMatters: true` only when the prompt asks for an order, and then the order must be total. If the sort key has ties in the data, the prompt must give a tie breaker ("ties by name A to Z"). Do not use `orderMatters` just because the solution has an ORDER BY.
- **LIMIT with ties**: if the cut-off row ties with the next one, either pick another N, ask for `WITH TIES`, or add a tie breaker to the prompt. Check the data before choosing N.
- **One mission, one new idea**: an exercise introduces at most one idea that the previous exercises did not use.
- **Fairness**: different aliases, different but equivalent predicates (`BETWEEN` vs `>= AND <=`, `IN` vs `OR`, `NOT EXISTS` vs `LEFT JOIN ... IS NULL`) must all pass. Columns are compared by position, values in Postgres text form, numbers with tolerance 1e-6, rows as a multiset unless `orderMatters`.
- Avoid checks that depend on `now()`, `random()` without `setseed` in the same SQL, or the physical row order.

### 2.4 Check types
| situation | check |
|---|---|
| SELECT | `{ type: 'result' }` (+ `orderMatters`, `matchColumnNames`, `tolerance` when needed) |
| INSERT / UPDATE / DELETE / MERGE | `{ type: 'state', verifySql }`: verifySql selects the affected table(s) **with a total ORDER BY or as a multiset**, only the columns that matter. A no-op (`SELECT 1`) must fail it: the validator checks that. |
| DML with RETURNING | `{ type: 'result+state', verifySql }` |
| DDL | `state` with catalog queries (`information_schema.columns`, `pg_indexes`, `pg_constraint`), or better, **behavioural** verifySql: insert a valid row and an invalid one inside the verify query and report what happened (e.g. via a `DO` block is not allowed in verify, so use a small SQL function created in the exercise `setupSql`). |
| "This must fail" missions | `{ type: 'error', sqlstate: '23505' }` |
| Reading a plan (World 10) | answer with a final `SELECT <value>` (result check), or `state` with `plan_nodes('<query>')` (dungeon helper: returns the node types of the query's plan, COSTS OFF) |

Remember the app splits the learner SQL into statements and runs each one separately in a fresh clone; `VACUUM` and `CALL` with COMMIT work because they are sent alone.

### 2.5 Hints (exactly 3, escalating)
1. **Nudge**: points at the part of the problem to look at, often "run the starter and look at X".
2. **Concept**: names the tool or rule ("NULL never equals anything; use IS NULL").
3. **Near solution**: the key clause, almost copy-pastable (`WHERE faction_id IS NULL`). Never the whole query unless the exercise is trivial.

Lesson `try` steps may have 2 hints.

### 2.6 Explanations (shown after success)
Markdown, 2 to 5 sentences, in this order:
1. **Why it works** (one or two sentences on the mechanism).
2. **Pitfall**: the classic wrong answer and what it would do (bold label `**Pitfall:**`).
3. **Alternative** (optional): another valid formulation, or where this idea comes back later.

### 2.7 Lesson steps
- 6 to 10 steps (contract allows 4 to 10). Pattern: explain → example → explain → quiz → example → ... → try. End with a `try` that mirrors exercise 1.
- One idea per card, **under ~80 words** (the validator warns above 110). Code blocks count, keep them short.
- Every `example` must run on the dataset and show something interesting (a NULL, a tie, a surprise).
- At least one `quiz` per chapter targeting a misconception from the catalog (`docs/research/curriculum.md` section 2 "mistakes" and section 4.2). Wrong choices are real mistakes, not jokes.
- `try` steps get a `starterSql` that does not already pass.

### 2.8 Exercises and practice
- Main exercises: 6 to 9, increasing difficulty (1 → 4/5), last one `boss: true` combining the chapter's concepts (and reviewing earlier ones).
- Styles to mix: **write** (from scratch), **fix** (fix-the-bug: starter is broken or subtly wrong), **predict** (the prompt asks to return what a given expression evaluates to, e.g. `SELECT` the value), **refactor** (same result, different technique), **mutate** (DML to reach a state), **design** (DDL, World 7), **optimize** (World 10: plan shape or buffers).
- At least one **fix** exercise per chapter, built on a classic misconception (its starter must fail the check: the validator enforces it).
- Practice pool (`chNN-prMM`): at least one drill per chapter concept, two for the trickiest. Drills are short (difficulty 1 to 3), single concept, and can reuse exercise patterns on other tables.
- `scripts/negative-cases.ts`: for each exercise built on a misconception, add `reject` cases (the wrong answers) and `accept` cases (equivalent right answers with other aliases or syntax). Aim for at least 1 reject per exercise and 1 accept on every exercise whose prompt allows several formulations.

### 2.9 Ids and files
- Chapter id `chNN-slug`, NN = global order (01 to 43), zero padded; file `src/content/chapters/<id>.ts`; `order` = NN.
- Exercise ids `chNN-exMM` (main) and `chNN-prMM` (practice), MM from 01, unique across all content.
- Lesson try keys in `negative-cases.ts`: `<chapter-id>/lesson-<index>` (0-based index in `lesson`).
- Concept ids exactly as in `src/content/concepts.ts`.
- Files starting with `_` are the build agent's dev samples: never reference them.

### 2.10 Known platform limits (verified)
- Database collation is `C` (byte order); `COLLATE "unicode"` for dictionary order. Session `TimeZone` is GMT. `library` and `bardic` set `default_text_search_config = english`; elsewhere it is `simple`.
- `statement_timeout` is not enforced: the app kills runaway queries with a watchdog. Keep recursive CTEs bounded and `generate_series` small.
- The app **forbids** in learner SQL: `COPY`, `SET ROLE` / `SET SESSION AUTHORIZATION`, `ALTER SYSTEM`, `CREATE/DROP DATABASE`, server file functions, `LOAD`. Solutions must not use them either (the validator checks). `verifySql` is not filtered, so role-based checks (`SET ROLE x; SELECT ...; RESET ROLE`) go there.
- No `pg_stat_statements`, no `tsm_system_rows`, no PostGIS. Extensions available: see `ExtensionName` in the contract; a dataset must create them in its `setupSql`.
- `EXPLAIN` timings are meaningless in WASM: grade plan shapes and buffers, never milliseconds. Autovacuum and autoanalyze never run: call `ANALYZE` / `VACUUM` explicitly.

## 3. World and chapter overview

Side quests (optional on the map) are marked ◇. Prerequisites form the unlock graph: World 6 opens after World 2 (players who want to write data early), World 8 opens after chapter 24.

| # | id | world | dataset | tier | track | emoji | title | concepts | prerequisites |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ch01-hello-table | The Starport Docks | starport | novice | query | 👋 | Hello, Table | relational-model, sql-statement-anatomy, select-columns, select-star, column-aliases, quotes-and-identifiers | none |
| 2 | ch02-sifting-the-ledger | The Starport Docks | starport | novice | query | 🔎 | Sifting the Ledger | where-comparison, boolean-logic, in-and-between, like-ilike | ch01 |
| 3 | ch03-the-void | The Starport Docks | starport | novice | query | 🕳️ | The Void | null-basics, three-valued-logic, is-distinct-from, coalesce-nullif | ch02 |
| 4 | ch04-order-in-the-hall | The Starport Docks | starport | novice | query | 🏆 | Order in the Hall | order-by, limit-offset, distinct, collation-sorting | ch03 |
| 5 | ch05-shaping-columns | The Counting House | starport | apprentice | query | 🧮 | Shaping Columns | arithmetic-expressions, type-casting, case-expression, numeric-functions | ch04 |
| 6 | ch06-words-and-patterns | The Counting House | starport | apprentice | query | 🔤 | Words and Patterns | string-functions, regex-matching, data-cleaning | ch05 |
| 7 | ch07-calendars-and-clocks | The Counting House | starport | apprentice | query | 📅 | Calendars and Clocks | date-time-basics, date-functions, interval-arithmetic | ch05 |
| 8 | ch08-tally-the-loot | The Counting House | starport | apprentice | query | 💰 | Tally the Loot | aggregate-functions, count-variants, group-by, having, logical-processing-order, aggregate-filter, collection-aggregates | ch06, ch07 |
| 9 | ch09-two-tables-meet | The Jump Gates | starport | apprentice | query | 🔗 | Two Tables Meet | keys-and-relationships-intro, table-aliases, inner-join, multi-table-join, join-using-natural | ch08 |
| 10 | ch10-outer-gates-and-mirrors | The Jump Gates | starport | adept | query | 🪞 | Outer Gates and Mirrors | left-join, right-full-join, self-join, cross-join, non-equi-join, join-fanout | ch09 |
| 11 | ch11-queries-within-queries | The Nested Catacombs | guild | adept | query | 🪆 | Queries within Queries | scalar-subquery, in-subquery, derived-tables, correlated-subquery | ch10 |
| 12 | ch12-exists-or-not | The Nested Catacombs | guild | adept | query | ❓ | Exists or Not | semi-join-exists, anti-join, not-in-null-trap, any-all | ch11 |
| 13 | ch13-unions-and-named-spells | The Nested Catacombs | guild | adept | query | 📜 | Unions and Named Spells | set-operations, values-lists, cte-basics, generate-series | ch11 |
| 14 | ch14-the-endless-stair | The Nested Catacombs | guild | expert | query | 🌀 | The Endless Stair | recursive-cte, recursive-graph-walks | ch13 |
| 15 | ch15-windows-on-the-ranks | The Observatory | dungeon | adept | query | 🪟 | Windows on the Ranks | window-basics, window-partition-order, ranking-functions, lag-lead, window-frames, running-totals | ch13 |
| 16 | ch16-champions-of-each-dungeon | The Observatory | dungeon | expert | query | 🥇 | Champions of Each Dungeon | distinct-on, top-n-per-group, lateral-join, deduplication | ch15 |
| 17 | ch17-patterns-in-time | The Observatory | bardic | expert | query | ⏳ | Patterns in Time | date-bucketing, time-series-gap-fill, gaps-and-islands, sessionization | ch15 |
| 18 | ch18-the-grand-report | The Observatory | dungeon | expert | query | 📊 | The Grand Report | grouping-sets, pivoting, statistical-aggregates, ordered-set-aggregates, relational-division, random-sampling | ch16, ch12 |
| 19 | ch19-forging-rows | The Forge | starport | novice | mutation | ⚒️ | Forging Rows | insert-basic, insert-multi-row, default-values, returning-clause, insert-select, sequences | ch08 |
| 20 | ch20-reforging-and-banishing | The Forge | starport | apprentice | mutation | 🔥 | Reforging and Banishing | update-basic, update-from, delete-basic, delete-using, truncate | ch19, ch10 |
| 21 | ch21-the-pact | The Forge | starport | apprentice | mutation | 🤝 | The Pact | transactions-basics, savepoints, constraint-errors | ch20 |
| 22 | ch22-merge-and-upsert | The Forge | starport | adept | mutation | 🔀 | Merge and Upsert | upsert-on-conflict, merge-statement, data-modifying-cte, bulk-load-copy | ch21, ch13 |
| 23 | ch23-many-hands ◇ | The Forge | inn | expert | mutation | 👥 | Many Hands | isolation-levels, row-locking, optimistic-locking | ch21 |
| 24 | ch24-laying-foundations | The Architect's Tower | guild | apprentice | schema | 🧱 | Laying Foundations | data-type-basics, create-table, primary-key, identity-columns, not-null-default, naming-conventions, drop-objects | ch21 |
| 25 | ch25-binding-laws | The Architect's Tower | guild | adept | schema | ⚖️ | Binding Laws | unique-constraint, check-constraint, foreign-key, fk-actions, generated-columns, alter-table | ch24 |
| 26 | ch26-blueprints | The Architect's Tower | guild | adept | schema | 📐 | Blueprints | er-modeling, relationship-cardinality, normalization-1nf, normalization-2nf-3nf, normalization-bcnf-beyond | ch25 |
| 27 | ch27-lenses-and-realms | The Architect's Tower | guild | adept | schema | 🔭 | Lenses and Realms | views, materialized-views, schemas-search-path, catalog-introspection | ch26, ch13 |
| 28 | ch28-cursed-designs | The Architect's Tower | guild | expert | schema | 💀 | Cursed Designs | design-antipatterns, denormalization, hierarchy-models | ch27, ch14 |
| 29 | ch29-precise-measures | The Alchemist's Vault | inn | apprentice | types | ⚗️ | Precise Measures | numeric-types, floating-point, money-handling, text-types, boolean-type, uuid-type | ch24 |
| 30 | ch30-shaped-data | The Alchemist's Vault | guild | adept | types | 🧬 | Shaped Data | enum-types, domain-types, composite-types, arrays | ch29, ch25, ch12 |
| 31 | ch31-scrolls-of-json | The Alchemist's Vault | guild | adept | types | 📦 | Scrolls of JSON | json-vs-jsonb, jsonb-operators, jsonb-construction, jsonb-decomposition, jsonb-modification | ch30, ch16 |
| 32 | ch32-deep-json | The Alchemist's Vault | guild | expert | types | 🔮 | Deep JSON | sql-json-path, json-table, jsonb-indexing, hstore | ch31 |
| 33 | ch33-bound-by-time | The Alchemist's Vault | inn | expert | types | ⌛ | Bound by Time | timezones, range-types, multirange-types, temporal-constraints | ch30 |
| 34 | ch34-exotic-matter ◇ | The Alchemist's Vault | library | expert | types | 💎 | Exotic Matter | network-types, bytea-binary, geometric-types, ltree, case-insensitive-text, pgcrypto-hashing | ch30, ch28 |
| 35 | ch35-words-of-power | The Oracle's Library | library | expert | types | 🪄 | Words of Power | full-text-search, fts-ranking-highlighting, fts-indexing, trigram-search, fuzzy-string-matching | ch33 |
| 36 | ch36-vector-constellations | The Oracle's Library | bardic | master | types | ✨ | Vector Constellations | vector-basics, vector-knn-search, vector-indexes, hybrid-search | ch35, ch13 |
| 37 | ch37-reading-the-runes | The Clockwork Engine | dungeon | adept | performance | 📖 | Reading the Runes | explain-basics, explain-analyze, scan-types, join-algorithms | ch18, ch28 |
| 38 | ch38-index-forging | The Clockwork Engine | dungeon | expert | performance | 🗝️ | Index Forging | btree-index, multicolumn-index, partial-index, expression-index, covering-index, gin-gist-brin-hash | ch37 |
| 39 | ch39-why-not-my-index | The Clockwork Engine | dungeon | expert | performance | 🧐 | Why Not My Index? | sargability, index-selection-reasons, statistics, query-rewriting, cte-materialization | ch38 |
| 40 | ch40-undead-rows-and-big-tables | The Clockwork Engine | dungeon | master | performance | 🧟 | Undead Rows and Big Tables | mvcc-concept, vacuum-mvcc, pagination-performance, n-plus-one, write-performance, partitioning, query-stats | ch39, ch22 |
| 41 | ch41-spellcrafting | The Astral Spire | library | expert | advanced | 🧙 | Spellcrafting | sql-functions, plpgsql-basics, procedures, dynamic-sql, sql-injection | ch40 |
| 42 | ch42-wards-and-gatekeepers | The Astral Spire | library | master | advanced | 🛡️ | Wards and Gatekeepers | triggers, audit-history, listen-notify, roles-privileges, row-level-security, upsert-patterns, stored-logic-guidelines | ch41, ch22, ch31 |
| 43 | ch43-trials-of-mastery ◇ | The Astral Spire | guild | master | advanced | 👑 | Trials of Mastery | operations-overview | ch42 |

Prerequisites in the table use the `chNN` prefix for brevity; in the chapter file write full ids (`"ch06-words-and-patterns"`). Every one of the 199 concepts appears in exactly one chapter.

### 3.1 Deliberate changes from the research curriculum
- **World names follow the datasets**: World 1 is *The Starport Docks* and World 3 *The Jump Gates* (the research names were fantasy, the dataset is a space port). Chapter 10 becomes *Outer Gates and Mirrors*, chapter 16 *Champions of Each Dungeon* (it uses the leaderboard).
- **Datasets per chapter**: World 5 uses `dungeon` except ch17 (sessions and streaks over `bardic` plays); the side quest ch23 uses `inn` (two clerks, one room); ch29 and ch33 use `inn`; ch34 uses `library`; ch36 uses `bardic`; ch43 uses `guild`.
- **Concept placement fixes** (the catalog had prerequisites pointing forward): `hierarchy-models` lives only in ch28 (ch14 shows adjacency lists without naming the concept), `temporal-constraints` only in ch33, `sql-injection` moves to ch41 next to dynamic SQL, `mvcc-concept` moves from the ch23 side quest to ch40 (VACUUM needs it on the main path), `coalesce-nullif` is taught in ch03 only (ch05 reuses it). Prerequisite edges were relaxed in `concepts.ts` for `scan-types`, `expression-index`, `covering-index`, `vector-indexes`, `jsonb-indexing`, `deduplication`, `upsert-on-conflict`, `constraint-errors`, `recursive-graph-walks`: each chapter lesson teaches the small piece it needs inline (e.g. ch36 shows a 3-line EXPLAIN before vector indexes).
- **COPY is forbidden** in the app, so `bulk-load-copy` is taught with a staging table of raw CSV lines (`string_to_table`, `split_part`) and an explain card about COPY.
- **Roles**: `SET ROLE` is forbidden in learner SQL, so ch42 grades GRANT/REVOKE/RLS through `verifySql` (which may `SET ROLE`) and `has_table_privilege(...)`.
- **World 1 boss** (*The Tavern Keeper's Ledger* in the research) is ch04's boss *The Hall of Fame*; every chapter has its own boss and the last chapter of each world carries the world boss.

## 4. World 1: The Starport Docks (written, reference implementation)

Dataset `starport`. Story: your first week on the docks. Each chapter is implemented and validated; the summaries below are the index, the files are the truth.

### ch01-hello-table · Hello, Table 👋
- **File** `src/content/chapters/ch01-hello-table.ts` · **World** The Starport Docks · **Tier** novice · **Track** query · **Dataset** `starport`
- **Subtitle** Your first SELECT: read the Starport's registers
- **Concepts** `relational-model`, `sql-statement-anatomy`, `select-columns`, `select-star`, `column-aliases`, `quotes-and-identifiers`
- **Prerequisites** none
- **Lesson** (8 steps): explain tables/rows/columns · example `SELECT * FROM planets;` · explain clauses, `;`, comments · example `SELECT name, sector FROM planets;` · quiz missing comma turns into alias · explain AS and the two quotes · example aliases with `"Head Count"` and a `'charted'` literal · try name + species of pilots
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch01-ex01 | every column of `factions` | 1 | query | result | select-star, relational-model | write |
| ch01-ex02 | name, callsign of every pilot | 1 | query | result | select-columns | write |
| ch01-ex03 | fix `SELECT name, model, FROM ships;` | 1 | query | result | sql-statement-anatomy | fix |
| ch01-ex04 | commodities name AS item, base_price AS price | 1 | query | result, names | column-aliases | write |
| ch01-ex05 | planets titled exactly `Planet`, `Head Count` | 2 | query | result, names | quotes-and-identifiers | fix |
| ch01-ex06 | ship name + literal `cleared` (starter uses double quotes) | 2 | query | result | quotes-and-identifiers | fix |
| ch01-ex07 | model column of ships, duplicates and NULL kept | 1 | query | result | relational-model | predict |
| ch01-ex08 | **Boss · The Harbor Master's Board**: `Ship`, `Model`, `Hold`, `Dock`='Bay 7' | 3 | query | result, names | all | write |

- **Practice**: pr01 relational-model (sector of every planet) · pr02 statement anatomy (silent comma alias) · pr03 select-columns · pr04 select-star (seizures) · pr05 column-aliases · pr06 quotes (`'Captain''s log'`) · pr07 quoted alias with a space

### ch02-sifting-the-ledger · Sifting the Ledger 🔎
- **Concepts** `where-comparison`, `boolean-logic`, `in-and-between`, `like-ilike` · **Prerequisites** `ch01-hello-table`
- **Lesson** (9 steps): explain WHERE · example credits > 40000 · explain text comparison and quotes · explain AND/OR precedence · quiz precedence trap · example IN + BETWEEN · explain LIKE wildcards, ILIKE, escaping · example apostrophe in LIKE · try credits = 0
- **Exercises**: ex01 cargo ≥ 500 · ex02 captains · ex03 `Kepler''s Rest` (fix) · ex04 Human captains (AND) · ex05 precedence trap (fix) · ex06 IN fuel/tech · ex07 BETWEEN 20 and 50 · ex08 LIKE 'L%' · ex09 **Boss · The Customs Sweep** (IN + BETWEEN + LIKE apostrophe, OR of two rules)
- **Practice**: pr01 to pr08 (comparison ×2, boolean ×2, BETWEEN dates, `____`, escaped `_`, ILIKE z)

### ch03-the-void · The Void 🕳️
- **Concepts** `null-basics`, `three-valued-logic`, `is-distinct-from`, `coalesce-nullif` · **Prerequisites** `ch02-sifting-the-ledger`
- **Lesson** (9 steps): explain NULL vs 0 · example freelancers IS NULL · quiz `= NULL` · explain truth table · example `NULL OR TRUE`... · explain silent drop of `<>` and IS DISTINCT FROM · explain COALESCE / NULLIF · example COALESCE callsign · try unknown sector
- **Exercises**: ex01 no faction (fix `= NULL`) · ex02 known population (0 counts) · ex03 population 0 or unknown · ex04 not faction 2 incl. freelancers (fix) · ex05 IS DISTINCT FROM 'food' · ex06 COALESCE callsign · ex07 COALESCE credits 0 · ex08 NULLIF raw '' · ex09 **Boss · Into the Void** (weak or uninspected hulls, not pilot 9 but keep pilotless ships, model 'unregistered')
- **Practice**: pr01 to pr07 (IS NULL ×2, 3VL ×2 incl. `NOT` does not rescue NULL, IS DISTINCT FROM, COALESCE, NULLIF)

### ch04-order-in-the-hall · Order in the Hall 🏆
- **Concepts** `order-by`, `limit-offset`, `distinct`, `collation-sorting` · **Prerequisites** `ch03-the-void`
- **Lesson** (10 steps): explain rows have no order · example two keys, NULL on top in DESC · explain NULLS FIRST/LAST · quiz direction applies per key · explain LIMIT/OFFSET/WITH TIES · example top 3 · example DISTINCT · explain C collation · example `COLLATE "unicode"` · try 3 longest routes
- **Exercises**: ex01 planets A to Z · ex02 rich list NULLS LAST + tie breaker (fix) · ex03 top 3 known gravity (fix NULL steals a slot) · ex04 page 2 · ex05 DISTINCT species · ex06 DISTINCT species, rank · ex07 FETCH FIRST 2 WITH TIES (fix) · ex08 dictionary order callsigns (fix) · ex09 **Boss · The Hall of Fame** (World 1 boss: WHERE + IS NOT NULL + two-key sort + page 3)
- **Practice**: pr01 to pr07 (ORDER BY ×2, LIMIT ×2, DISTINCT ×2 incl. the NULL row, collation)

## 5. World 2: The Counting House

Dataset `starport`. Story: the Starport's accountants hire you. Columns get computed, cleaned, dated and finally counted. Keep everything single table: joins only arrive in World 3.

### ch05-shaping-columns · Shaping Columns 🧮
- **File** `src/content/chapters/ch05-shaping-columns.ts` · **World** The Counting House · **Tier** apprentice · **Track** query · **Dataset** `starport`
- **Subtitle** Compute, convert and label: expressions, casts, CASE and math functions
- **Concepts** `arithmetic-expressions`, `type-casting`, `case-expression`, `numeric-functions`
- **Prerequisites** `ch04-order-in-the-hall`
- **Lesson** (9 steps)
  1. explain · Columns can be computed: `+ - * / %`, parentheses, aliases on expressions
  2. example · Deal values: `SELECT id, qty, unit_price, qty * unit_price AS value FROM trades;` (trade 37 shows NULL: NULL propagates)
  3. explain · Integer division: `7 / 2 = 3`, `7 / 2.0 = 3.5`; `%` is the remainder
  4. quiz · What does `SELECT cargo_capacity / 1000 FROM ships WHERE name = 'Tusker'` return? (0, 0.9, 1, error) → 0 (integer division misconception)
  5. explain · Casting: `x::numeric`, `CAST(x AS int)`, `'42'::int`; `'12abc'::int` fails with 22P02; `3.7::int` rounds to 4
  6. explain · CASE: searched form `CASE WHEN cond THEN v ... ELSE v END`, simple form `CASE rank WHEN 'cadet' THEN 1 ... END`; no ELSE gives NULL
  7. example · Hull labels: `CASE WHEN hull_integrity >= 90 THEN 'pristine' WHEN hull_integrity >= 50 THEN 'worn' ELSE 'critical' END` (watch the Ghost Ship: NULL falls into ELSE)
  8. example · Math kit: `round(gravity, 1), ceil(gravity), floor(gravity), abs(reputation), width_bucket(reputation, -1000, 1000, 4)`
  9. try · Cargo in kilotons: name and `cargo_capacity / 1000.0` of every ship (starter divides by 1000)
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch05-ex01 | id and value (`qty * unit_price`) of every trade, NULL value kept for the lost record | 1 | query | result | arithmetic-expressions | write |
| ch05-ex02 | name and price with 15% station tax (`base_price * 1.15`) rounded to 2 decimals, every commodity | 2 | query | result | arithmetic-expressions, numeric-functions | write |
| ch05-ex03 | fix `cargo_capacity / 1000` returning 0: name and capacity in thousands with 3 decimals | 2 | query | result | type-casting, arithmetic-expressions | fix |
| ch05-ex04 | one row: `'42'` as int, `3.7` as int, `'19.99'` as numeric rounded to 1 decimal (three columns, that order) | 2 | query | result | type-casting | predict |
| ch05-ex05 | name and condition of every ship: `pristine` (≥ 90), `worn` (≥ 50), `critical` (< 50), `uninspected` (NULL) | 2 | query | result | case-expression | write |
| ch05-ex06 | pilots name and rank sorted by seniority cadet < ensign < lieutenant < captain < commander < admiral, ties by name | 3 | query | result (ordered) | case-expression | write |
| ch05-ex07 | name and number of trips (`ceil(1000.0 / cargo_capacity)`) each ship needs to haul 1000 units; NULL for unknown capacity | 2 | query | result | numeric-functions | write |
| ch05-ex08 | fix a CASE with incompatible branches (`THEN 0 ELSE 'none'` raises 22P02/42804): label credits `broke` (0), `frozen` (NULL), else the amount as text | 3 | query | result | case-expression, type-casting | fix |
| ch05-ex09 | **Boss · The Customs Invoice**: for every trade id: value (unknown price counts 0), tax rate (8% sells, 3% buys), tax rounded to 2 decimals, size `bulk` (qty ≥ 100) or `retail` | 4 | query | result | all + coalesce-nullif | write |

- **Practice**: `ch05-pr01` arithmetic-expressions: routes distance in parsecs (`distance_ly / 3.26`, 2 decimals); `ch05-pr02` arithmetic-expressions: trades id and `qty % 12` leftover crates; `ch05-pr03` type-casting: pilots name and `joined_at::date`; `ch05-pr04` type-casting: predict `(7 / 2)::numeric` vs `7 / 2::numeric` in one row; `ch05-pr05` case-expression: commodities name and `contraband` / `legal` label; `ch05-pr06` case-expression: planets size class by population incl. `unknown`; `ch05-pr07` numeric-functions: pilots name and `abs(reputation)`; `ch05-pr08` numeric-functions: pilots name and `width_bucket(reputation, -1000, 1000, 4)`
- **Negative cases to add**: integer division (`/ 1000`), `round(x)` without digits, CASE without the NULL branch (Ghost Ship becomes `critical`), CASE order wrong (`>= 50` before `>= 90`), alphabetical rank order; accept `CAST(... AS numeric)` vs `::numeric`, `1000.0` vs `::numeric`.
- **Notes**: `round(2.5)` is 3 on numeric but `round(2.5::float8)` is 2: keep money in numeric. Values are compared in Postgres text form with numeric tolerance, so `12.0` and `12` match.

### ch06-words-and-patterns · Words and Patterns 🔤
- **File** `src/content/chapters/ch06-words-and-patterns.ts` · **World** The Counting House · **Tier** apprentice · **Track** query · **Dataset** `starport`
- **Subtitle** Slice, glue and scrub text, then let regular expressions do the heavy lifting
- **Concepts** `string-functions`, `regex-matching`, `data-cleaning`
- **Prerequisites** `ch05-shaping-columns`
- **Lesson** (9 steps)
  1. explain · Text toolbox: `upper lower initcap length trim`, positions start at 1
  2. example · `SELECT name, upper(name), length(name), left(name, 3) FROM planets;`
  3. explain · Gluing: `||` vs `concat()` / `concat_ws()`; `'a' || NULL` is NULL
  4. quiz · `SELECT 'Pilot ' || callsign` for Dax (NULL callsign) gives? ('Pilot ', NULL, 'Pilot NULL', error) → NULL
  5. explain · Cutting: `split_part(s, ';', 2)`, `substring(s from 2 for 3)`, `position('x' in s)`, `replace`
  6. example · Manifest parts: `SELECT raw, split_part(raw, ';', 1), split_part(raw, ';', 2) FROM manifest_lines;`
  7. explain · Regex: `~` (case sensitive), `~*`, `!~`; unanchored unless `^...$`; `regexp_replace(s, pattern, repl, 'g')`, `substring(s from '[0-9]+')`
  8. example · `SELECT raw, regexp_replace(raw, '\s+', ' ', 'g') FROM manifest_lines;`
  9. try · Shout the callsigns: name and upper-cased callsign of pilots who have one
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch06-ex01 | name and length of every ship name, longest first, ties by name A to Z | 1 | query | result (ordered) | string-functions | write |
| ch06-ex02 | fix the radio label `name || ' (' || callsign || ')'` that becomes NULL for pilots without callsign: show `Ada Quasar (Nova)`, or just the name when there is no callsign | 2 | query | result | string-functions, coalesce-nullif | fix |
| ch06-ex03 | 3-letter commodity codes: name and `upper(left(name, 3))` | 1 | query | result | string-functions | write |
| ch06-ex04 | manifest id and the text before the first `;` (raw commodity), lines with NULL raw excluded | 2 | query | result | string-functions | write |
| ch06-ex05 | pilots whose name contains a digit (`~ '[0-9]'`): name | 2 | query | result | regex-matching | write |
| ch06-ex06 | fix an unanchored regex: callsigns made **only** of lower-case letters (`~ '^[a-z]+$'`, starter uses `~ '[a-z]+'`) | 3 | query | result | regex-matching | fix |
| ch06-ex07 | manifest id and the first number found in raw as an int (`substring(raw from '[0-9]+')::int`), NULL when there is none | 3 | query | result | regex-matching, type-casting | write |
| ch06-ex08 | manifest id and commodity normalised: trimmed, lower case, `-` replaced by a space, runs of spaces collapsed | 3 | query | result | data-cleaning | write |
| ch06-ex09 | **Boss · The Manifest Cleanup**: for every manifest line with a non-empty raw: id, clean commodity (as ex08), quantity as int or NULL (`n/a`, missing), and `fragile` = whether the line mentions FRAGILE in any case | 5 | query | result | all | write |

- **Practice**: `ch06-pr01` string-functions: commodities `initcap(category)`; `ch06-pr02` string-functions: `concat_ws(' / ', name, model)` for ships (NULL model skipped); `ch06-pr03` string-functions: planets whose name has a space, with `position(' ' in name)`; `ch06-pr04` regex-matching: commodities whose name has two words (`~ '^\S+ \S+$'`); `ch06-pr05` regex-matching: case-insensitive `~*` search for 'plasma' in raw manifests; `ch06-pr06` data-cleaning: find manifest lines whose quantity cannot be parsed (`raw !~ ';\s*[0-9]'` or NULL/empty), id only; `ch06-pr07` data-cleaning: `NULLIF(trim(raw), '')` per line
- **Negative cases to add**: `||` with NULL (ex02), `split_part` with index 0, regex without `^$` anchors, `regexp_replace` without `'g'`, casting the whole raw column to int (22P02); accept `strpos` vs `position`, `substr` vs `left`.
- **Notes**: line 12 raw is NULL, line 8 is `''`, line 7 says `n/a`, line 10 has a third part `FRAGILE`, line 13 has a double space. `\s` needs standard strings: `'\s+'` works because `standard_conforming_strings` is on.

### ch07-calendars-and-clocks · Calendars and Clocks 📅
- **File** `src/content/chapters/ch07-calendars-and-clocks.ts` · **World** The Counting House · **Tier** apprentice · **Track** query · **Dataset** `starport`
- **Subtitle** Dates, timestamps and intervals, plus the leap day that ate a trade
- **Concepts** `date-time-basics`, `date-functions`, `interval-arithmetic`
- **Prerequisites** `ch05-shaping-columns`
- **Lesson** (9 steps)
  1. explain · Types: `date`, `timestamptz` (an instant, shown in the session time zone, GMT here); ISO literals `'2076-02-29'`
  2. example · `SELECT id, traded_at, traded_at::date FROM trades ORDER BY traded_at LIMIT 5;`
  3. explain · Date arithmetic: `date + 7`, `date - date` = days (integer); `timestamptz - timestamptz` = interval
  4. quiz · `WHERE traded_at = '2076-02-29'` finds the leap-day trade? (no: it means midnight exactly) → half-open ranges `>= day AND < next day`
  5. explain · `extract(year from ts)`, `date_trunc('month', ts)`, `to_char(ts, 'DD Mon YYYY')` (MM month vs MI minute)
  6. example · `SELECT traded_at, extract(dow from traded_at), date_trunc('month', traded_at), to_char(traded_at, 'YYYY-MM') FROM trades LIMIT 5;`
  7. explain · Intervals: `interval '1 month'`, `'2076-01-31'::date + interval '1 month'` = Feb 29 (clamped), `age(a, b)`
  8. example · `SELECT date '2076-01-31' + interval '1 month', date '2077-01-31' + interval '1 month', age(date '2078-01-01', date '2041-03-15');`
  9. try · Launch year: name and `extract(year from launched_on)` of every ship with a known launch date
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch07-ex01 | fix `WHERE traded_at = '2076-02-29'`: id and traded_at of every trade signed on 29 Feb 2076 | 2 | query | result | date-time-basics | fix |
| ch07-ex02 | ship name and days between launch and 2078-01-01 (`date '2078-01-01' - launched_on`), unknown launch excluded | 2 | query | result | date-time-basics | write |
| ch07-ex03 | name and join year of every pilot | 1 | query | result | date-functions | write |
| ch07-ex04 | trades of December, any year (`extract(month ...) = 12`): id, traded_at | 2 | query | result | date-functions | write |
| ch07-ex05 | planets name and discovery date formatted `DD Mon YYYY` (`to_char`), unknown dates excluded | 2 | query | result | date-functions | write |
| ch07-ex06 | seizure id and fine due date one month after `seized_at` (as a date) | 2 | query | result | interval-arithmetic | write |
| ch07-ex07 | predict: one row with `date '2076-01-31' + interval '1 month'` and `(date '2076-01-31' + interval '1 month') - interval '1 month'` | 3 | query | result | interval-arithmetic | predict |
| ch07-ex08 | pilot name and tenure on 2078-01-01 as an interval (`age(timestamptz '2078-01-01', joined_at)`), longest first, ties by name | 3 | query | result (ordered) | interval-arithmetic, date-functions | write |
| ch07-ex09 | **Boss · The Anniversary Roster**: pilots who joined in the last quarter of any year: name, join date (date), full years of service on 2078-01-01, sorted by month then day then name | 4 | query | result (ordered) | all | write |

- **Practice**: `ch07-pr01` date-time-basics: trades in the first week of 2077 with a half-open range; `ch07-pr02` date-time-basics: planets discovered before 2050 (date literal); `ch07-pr03` date-functions: trades id and weekday name (`to_char(traded_at, 'FMDay')`); `ch07-pr04` date-functions: `date_trunc('year', joined_at)` per pilot; `ch07-pr05` interval-arithmetic: one row, hours between trade 1 and trade 2 (`extract(epoch from t2 - t1) / 3600`); `ch07-pr06` interval-arithmetic: `make_interval(days => 30)` added to seizures
- **Negative cases to add**: `= '2076-02-29'` on a timestamptz; `BETWEEN '2076-02-29' AND '2076-03-01'` (includes the next midnight); `extract(month)` vs `date_trunc` confusion; `to_char` with `MI`; accept `traded_at::date = '2076-02-29'` for ex01 (correct, just not index friendly).
- **Notes**: trades sit at month ends and near midnight UTC on purpose (2076-03-31 23:59, 2076-04-01 00:01, 2076-12-31 23:45). Session TimeZone is GMT: do not teach time zones here (World 8, ch33). Never use `now()` or `current_date` in checked solutions.

### ch08-tally-the-loot · Tally the Loot 💰
- **File** `src/content/chapters/ch08-tally-the-loot.ts` · **World** The Counting House · **Tier** apprentice · **Track** query · **Dataset** `starport`
- **Subtitle** Count, sum and group: from one big total to one row per group
- **Concepts** `aggregate-functions`, `count-variants`, `group-by`, `having`, `logical-processing-order`, `aggregate-filter`, `collection-aggregates`
- **Prerequisites** `ch06-words-and-patterns`, `ch07-calendars-and-clocks`
- **Lesson** (10 steps)
  1. explain · Aggregates collapse rows: `count sum avg min max`; one row out
  2. example · `SELECT count(*), sum(qty), avg(unit_price), min(traded_at), max(traded_at) FROM trades;`
  3. explain · `count(*)` vs `count(col)` vs `count(DISTINCT col)`; NULLs ignored by every aggregate except `count(*)`
  4. quiz · `SELECT count(callsign) FROM pilots` = 24? (no: 21; misconception count(col) counts rows)
  5. explain · GROUP BY: one row per group; every selected column grouped or aggregated (42803)
  6. example · `SELECT side, count(*), sum(qty) FROM trades GROUP BY side;`
  7. explain · Logical order FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT: why aliases fail in WHERE and aggregates belong in HAVING
  8. example · `SELECT commodity_id, count(*) AS n FROM trades GROUP BY commodity_id HAVING count(*) > 3 ORDER BY n DESC;`
  9. explain · Conditional and collection aggregates: `count(*) FILTER (WHERE side = 'sell')`, `string_agg(callsign, ', ' ORDER BY callsign)`, `array_agg`, `bool_or`
  10. try · How many pilots per species: species and count
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch08-ex01 | one row: number of trades and total quantity traded | 1 | query | result | aggregate-functions | write |
| ch08-ex02 | one row: number of pilots, pilots with a callsign, distinct factions represented (24, 21, 5) | 2 | query | result | count-variants | write |
| ch08-ex03 | per side (`buy`/`sell`): number of trades, total value `sum(qty * unit_price)`, average unit price rounded to 2 decimals | 2 | query | result | group-by, aggregate-functions | write |
| ch08-ex04 | per faction_id (freelancers form their own NULL group): number of pilots and total credits | 2 | query | result | group-by | write |
| ch08-ex05 | commodity ids traded more than 3 times, with their count | 2 | query | result | having | write |
| ch08-ex06 | fix: starter filters `WHERE count(*) > 1` / uses an alias in WHERE (42803 / 42703): species having more than 2 pilots with average reputation above 100 | 3 | query | result | logical-processing-order, having | fix |
| ch08-ex07 | per ship_id: number of buys and number of sells as two columns (`FILTER`), ships with trades only | 3 | query | result | aggregate-filter | write |
| ch08-ex08 | per species: comma separated list of callsigns sorted A to Z (byte order), NULL callsigns skipped | 3 | query | result | collection-aggregates | write |
| ch08-ex09 | **Boss · Audit of the Counting House**: per month (`date_trunc`) with at least 3 trades: month, trades, total sell value (FILTER, unknown prices ignored), largest quantity, sorted by month | 5 | query | result (ordered) | all + date-functions | write |

- **Practice**: `ch08-pr01` aggregate-functions: min and max base_price of commodities; `ch08-pr02` aggregate-functions: avg hull integrity (NULLs ignored, 2 decimals); `ch08-pr03` count-variants: count(*) vs count(population) on planets; `ch08-pr04` count-variants: number of distinct models among ships; `ch08-pr05` group-by: ships per model incl. the NULL model; `ch08-pr06` having: sectors with more than 2 planets; `ch08-pr07` logical-processing-order: fix ORDER BY on an alias that works vs WHERE on an alias that fails (predict which runs); `ch08-pr08` aggregate-filter: one row with legal and illegal commodity counts; `ch08-pr09` collection-aggregates: `bool_or(NOT legal)` per category; `ch08-pr10` group-by: rank and number of pilots per rank, sorted by count desc then rank
- **Negative cases to add**: `count(callsign)` where `count(*)` is asked and vice versa; `count(faction_id)` instead of `count(DISTINCT faction_id)`; grouping by an extra column; condition in WHERE that kills a group instead of FILTER; `string_agg` without ORDER BY inside the call (multiset compare treats the string as a value, so order inside it matters); accept `sum(CASE WHEN ... THEN 1 ELSE 0 END)` for FILTER.
- **Notes**: `sum` over no rows is NULL; `avg` of an int column returns numeric with many decimals, so ask for rounding. Trade 37 has a NULL unit_price: its value is NULL and is ignored by `sum`.

## 6. World 3: The Jump Gates

Dataset `starport`. Story: the Starport opens gates between its registers. Joins arrive, then the traps of outer joins and fan-out.

### ch09-two-tables-meet · Two Tables Meet 🔗
- **File** `src/content/chapters/ch09-two-tables-meet.ts` · **World** The Jump Gates · **Tier** apprentice · **Track** query · **Dataset** `starport`
- **Subtitle** Primary keys, foreign keys and the INNER JOIN that follows them
- **Concepts** `keys-and-relationships-intro`, `table-aliases`, `inner-join`, `multi-table-join`, `join-using-natural`
- **Prerequisites** `ch08-tally-the-loot`
- **Lesson** (9 steps)
  1. explain · Keys: `pilots.id` identifies a pilot, `ships.pilot_id` points at one; ids, not names, connect tables
  2. example · `SELECT id, name, pilot_id FROM ships;` next to `SELECT id, name FROM pilots;`
  3. explain · `JOIN ... ON` pairs rows whose condition holds; rows without a partner vanish (Old Faithful, Ghost Ship)
  4. example · `SELECT s.name AS ship, p.name AS pilot FROM ships s JOIN pilots p ON p.id = s.pilot_id;`
  5. quiz · `SELECT name FROM ships JOIN pilots ON ...` fails with? (42702 ambiguous column) → qualify with aliases
  6. explain · Chains: trades → ships → pilots, trades → commodities, trades → planets; one ON per join
  7. example · 3-table join: trade id, commodity name, planet name
  8. explain · `USING (col)` when names match (`seizures` and `trades` share `ship_id`, `commodity_id`); NATURAL JOIN silently joins on every same-named column (`id`, `qty` too!)
  9. try · Ships and their pilots: ship name and pilot name
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch09-ex01 | ship name and pilot name for every ship that has a pilot | 1 | query | result | inner-join | write |
| ch09-ex02 | fix the ambiguous `SELECT name, name FROM pilots JOIN factions ...` (42702): pilot name and faction name | 2 | query | result | table-aliases | fix |
| ch09-ex03 | faction name and homeworld planet name (factions with a homeworld only) | 2 | query | result | keys-and-relationships-intro, inner-join | write |
| ch09-ex04 | trade id, commodity name and planet name of every trade | 2 | query | result | multi-table-join | write |
| ch09-ex05 | trade id and the name of the pilot who flew the ship (trades → ships → pilots) | 3 | query | result | multi-table-join | write |
| ch09-ex06 | fix `seizures NATURAL JOIN trades` (returns 0 rows): seizure id and trade id where the same ship traded the same commodity, with `USING (ship_id, commodity_id)` | 3 | query | result | join-using-natural | fix |
| ch09-ex07 | pilots and their home planet sector: pilot name, planet name, sector, only planets with a known sector | 2 | query | result | inner-join | write |
| ch09-ex08 | **Boss · The Customs Cross-check**: every trade of an illegal commodity: traded_at, pilot name, commodity name, planet name, value; sorted by traded_at | 4 | query | result (ordered) | all + where | write |

- **Practice**: `ch09-pr01` keys-and-relationships-intro: ship name and its pilot's callsign, joining on the key (`ships.pilot_id = pilots.id`), not on names; `ch09-pr02` table-aliases: commodities and their seizures with short aliases; `ch09-pr03` inner-join: seizure id and ship name; `ch09-pr04` inner-join: route from/to planet names (join planets twice: preview of aliases); `ch09-pr05` multi-table-join: pilots with ship and faction names; `ch09-pr06` join-using-natural: `JOIN ... USING` on seizures/trades counting matches
- **Negative cases to add**: joining on names instead of ids (`p.name = s.name`), wrong key (`s.id = p.id`), NATURAL JOIN, missing join condition in a comma join (cartesian product); accept `JOIN ... ON` vs `USING` vs `WHERE` comma joins.
- **Notes**: inner joins drop Old Faithful and Ghost Ship (no pilot) and Lumen's missing planet: point it out, it motivates ch10.

### ch10-outer-gates-and-mirrors · Outer Gates and Mirrors 🪞
- **File** `src/content/chapters/ch10-outer-gates-and-mirrors.ts` · **World** The Jump Gates · **Tier** adept · **Track** query · **Dataset** `starport`
- **Subtitle** LEFT, FULL and self joins, joins on ranges, and the fan-out that inflates your sums
- **Concepts** `left-join`, `right-full-join`, `self-join`, `cross-join`, `non-equi-join`, `join-fanout`
- **Prerequisites** `ch09-two-tables-meet`
- **Lesson** (10 steps)
  1. explain · LEFT JOIN keeps every left row, NULL-fills the right side
  2. example · factions with their pilots, Lantern Guild with NULLs
  3. quiz · LEFT JOIN + `WHERE p.rank = 'captain'`: are pilotless factions kept? (no, WHERE runs after the join: put the condition in ON)
  4. explain · `count(*)` vs `count(p.id)` after a LEFT JOIN (1 vs 0 for empty groups)
  5. explain · RIGHT JOIN = swapped LEFT; FULL JOIN keeps both sides; COALESCE the keys
  6. example · self join: pilots with their mentor's name (`pilots p LEFT JOIN pilots m ON m.id = p.mentor_id`)
  7. explain · Non-equi joins: `JOIN reputation_tiers t ON p.reputation BETWEEN t.min_rep AND t.max_rep`; CROSS JOIN = every pair
  8. example · pilots with their reputation tier
  9. explain · Fan-out: ship × trades × seizures multiplies rows; aggregate each child first, then join
  10. try · Every faction with its number of pilots, 0 included
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch10-ex01 | every faction name and its pilot count, 0 for the Lantern Guild | 2 | query | result | left-join | write |
| ch10-ex02 | fix the LEFT JOIN whose WHERE drops ships: every ship name and its number of trades in 2077 (0 when none) | 3 | query | result | left-join | fix |
| ch10-ex03 | commodities never traded: name (LEFT JOIN ... IS NULL on the trade key) | 2 | query | result | left-join | write |
| ch10-ex04 | every planet and every faction homeworld pairing: planet name, faction name, keeping planets without faction and factions without homeworld (FULL JOIN) | 3 | query | result | right-full-join | write |
| ch10-ex05 | pilot name and mentor name, pilots without mentor kept with NULL | 2 | query | result | self-join | write |
| ch10-ex06 | two-hop routes: start, middle and end planet ids where end ≠ start (17 rows) | 3 | query | result | self-join | write |
| ch10-ex07 | pilot name and reputation tier (`reputation_tiers` with BETWEEN) | 2 | query | result | non-equi-join | write |
| ch10-ex08 | docking schedule: every ship with a known model paired with every planet that has a spaceport (ship name, planet name) | 2 | query | result | cross-join | write |
| ch10-ex09 | **Boss · The Broken Gate**: per faction (all 6): pilots, ships flown by its pilots, total sell value of those ships, computed without double counting (pre-aggregate in derived tables), zeros not NULLs | 5 | query | result | join-fanout, left-join, group-by | fix |

- **Practice**: `ch10-pr01` left-join: planets with their trade count incl. 0; `ch10-pr02` left-join: pilots without a ship (anti join pattern via IS NULL); `ch10-pr03` right-full-join: rewrite a RIGHT JOIN as LEFT JOIN (same result); `ch10-pr04` self-join: pairs of pilots of the same species (`a.id < b.id`); `ch10-pr05` self-join: route pairs that exist in both directions; `ch10-pr06` cross-join: every species × rank combination (from DISTINCT subqueries); `ch10-pr07` non-equi-join: trades whose unit_price is above the commodity base_price by more than 10%; `ch10-pr08` join-fanout: fix a sum of seizure fines inflated by joining trades; `ch10-pr09` join-fanout: count trades and seizures per ship without fan-out
- **Negative cases to add**: INNER instead of LEFT (Lantern Guild missing), `count(*)` instead of `count(p.id)`, filter in WHERE instead of ON, `a.id <> b.id` (mirrored pairs), BETWEEN on the wrong bounds, `sum(DISTINCT)` as a fan-out "fix"; accept NOT EXISTS for never traded (even though EXISTS comes in ch12).
- **Notes**: Ship 18 and 19 have no trades; commodities 15 and 16 never traded; Lantern Guild has no pilots and no homeworld; planet 10 (Hollow Moon) has no trades. Ship 3 (Black Lotus) has 2 trades and 3 seizures: the perfect fan-out example (6 rows).

## 7. World 4: The Nested Catacombs

Dataset `guild`. Story: you become archivist of the Guild of the Silver Dragon and descend into its catacombs of records. Queries nest, then name themselves, then call themselves.

### ch11-queries-within-queries · Queries within Queries 🪆
- **File** `src/content/chapters/ch11-queries-within-queries.ts` · **World** The Nested Catacombs · **Tier** adept · **Track** query · **Dataset** `guild`
- **Subtitle** A query inside a query: as a value, as a list, as a table, and one that looks back at you
- **Concepts** `scalar-subquery`, `in-subquery`, `derived-tables`, `correlated-subquery`
- **Prerequisites** `ch10-outer-gates-and-mirrors`
- **Lesson** (9 steps)
  1. explain · Schema tour of the guild (heroes, guilds, quests, quest_completions) and the new story
  2. explain · Scalar subquery: `(SELECT avg(gold) FROM heroes)` is one value usable anywhere
  3. example · heroes richer than average
  4. quiz · `WHERE guild_id = (SELECT id FROM guilds WHERE hall_region = 'Highmoor')` fails why? (21000: two guilds in Highmoor)
  5. explain · `IN (SELECT ...)` for lists; derived tables in FROM need an alias habit (optional since PG16)
  6. example · per guild average level as a derived table, filtered outside
  7. explain · Correlated subquery: the inner query uses the outer row (`WHERE x.guild_id = h.guild_id`)
  8. example · each hero with the max gold of their guild
  9. try · heroes whose level is above the average level: name, level
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch11-ex01 | name and gold of heroes richer than the average hero (NULL gold ignored) | 2 | query | result | scalar-subquery | write |
| ch11-ex02 | name of heroes whose guild hall is in Highmoor (`guild_id IN (SELECT ...)`) | 2 | query | result | in-subquery | write |
| ch11-ex03 | fix `= (SELECT id FROM guilds WHERE hall_region = 'Highmoor')` (21000) | 2 | query | result | in-subquery | fix |
| ch11-ex04 | name and level of each hero with the difference to the overall max level as a third column | 2 | query | result | scalar-subquery | write |
| ch11-ex05 | guilds whose heroes average more than level 12: guild_id and average level rounded to 1 decimal, from a derived table | 3 | query | result | derived-tables | write |
| ch11-ex06 | every hero name and number of completed quests via a correlated subquery in SELECT (0 for none) | 3 | query | result | correlated-subquery | write |
| ch11-ex07 | quests whose reward is above the average reward of their own region: title, region, reward_gold | 3 | query | result | correlated-subquery | write |
| ch11-ex08 | **Boss · The Archivist's Ledger**: for each guild that has heroes: guild name, richest hero name and gold (ties: all of them; Ember Fang and Moonlit Veil both top at 2100.00), plus that guild's hero count | 4 | query | result | all | write |

- **Practice**: `ch11-pr01` scalar-subquery: quests with the max reward; `ch11-pr02` in-subquery: heroes who completed quest 3; `ch11-pr03` in-subquery: items whose rarity is in the set of rarities of items heavier than 10; `ch11-pr04` derived-tables: average party size per quest, then quests above 3; `ch11-pr05` correlated-subquery: heroes whose xp equals the max xp of their class (ties: Aldric and Nyx at 98000); `ch11-pr06` correlated-subquery: each guild and its newest hero's join date
- **Negative cases to add**: `=` with a multi-row subquery, `avg` over gold with COALESCE(gold, 0) (changes the threshold), uncorrelated subquery where correlation is needed (`WHERE reward_gold > (SELECT avg(reward_gold) FROM quests)`), `max(gold)` then joining back on gold only (wrong guild); accept JOIN + GROUP BY formulations.
- **Notes**: guild 6 has no heroes (scalar subquery returns NULL for it). Heroes 22 and 28 have NULL gold.

### ch12-exists-or-not · Exists or Not ❓
- **File** `src/content/chapters/ch12-exists-or-not.ts` · **World** The Nested Catacombs · **Tier** adept · **Track** query · **Dataset** `guild`
- **Subtitle** Semi-joins, anti-joins, the NOT IN trap, and comparing with ANY or ALL
- **Concepts** `semi-join-exists`, `anti-join`, `not-in-null-trap`, `any-all`
- **Prerequisites** `ch11-queries-within-queries`
- **Lesson** (9 steps)
  1. explain · `EXISTS (subquery)`: true if at least one row; select list irrelevant; must be correlated
  2. example · heroes who completed at least one quest
  3. explain · Anti-join: `NOT EXISTS` or `LEFT JOIN ... WHERE right.key IS NULL`
  4. example · quests never completed (18, 19)
  5. quiz · `WHERE id NOT IN (SELECT mentor_id FROM heroes)` returns? (0 rows, because mentor_id contains NULL)
  6. example · the trap live: NOT IN gives 0 rows, NOT EXISTS gives 17
  7. explain · `x > ALL (...)`, `x = ANY (...)` on subqueries and arrays (`'scout' = ANY(tags)`); `> ALL (empty)` is true
  8. quiz · EXISTS vs JOIN + DISTINCT: which never duplicates heroes?
  9. try · heroes who never completed a quest (NOT EXISTS)
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch12-ex01 | name of heroes who completed at least one quest, each once | 1 | query | result | semi-join-exists | write |
| ch12-ex02 | name of heroes with no completed quest (11, 18, 22, 24, 30) | 2 | query | result | anti-join | write |
| ch12-ex03 | fix the NOT IN trap: heroes who mentor no one (starter returns 0 rows) | 3 | query | result | not-in-null-trap | fix |
| ch12-ex04 | quests nobody completed, via LEFT JOIN ... IS NULL: id, title | 2 | query | result | anti-join | write |
| ch12-ex05 | guilds with at least one level-15+ hero: guild name | 2 | query | result | semi-join-exists | write |
| ch12-ex06 | quests harder than every Highmoor quest (`> ALL`): id, title, difficulty | 2 | query | result | any-all | write |
| ch12-ex07 | heroes tagged `scout` (`'scout' = ANY(tags)`): id, name | 2 | query | result | any-all | write |
| ch12-ex08 | fix the semi-join that duplicates: starter `JOIN quest_completions` lists Aldric 5 times; return each hero who completed a Highmoor quest once | 3 | query | result | semi-join-exists | fix |
| ch12-ex09 | **Boss · Unfinished Business**: guilds that have heroes but none of whose heroes completed a secret quest: guild name and hero count | 4 | query | result | all | write |

- **Practice**: `ch12-pr01` semi-join-exists: guild names with at least one hero who completed quest 8 (Heart of the Mist); `ch12-pr02` anti-join: guilds without heroes; `ch12-pr03` anti-join: heroes never told a rumor; `ch12-pr04` not-in-null-trap: rewrite `quest_id NOT IN (SELECT prerequisite_quest_id FROM quests)` (NULLs!) with NOT EXISTS: quests that are nobody's prerequisite; `ch12-pr05` not-in-null-trap: predict the row count of a NOT IN with a NULL (answer with `SELECT 0`); `ch12-pr06` any-all: heroes whose level is greater than ANY level in guild 5; `ch12-pr07` any-all: quests whose reward is at least every Mistwood reward (`>= ALL`)
- **Negative cases to add**: NOT IN on nullable columns, EXISTS without correlation (always true), JOIN without DISTINCT (duplicates), LEFT JOIN ... IS NULL on a nullable non-key column (`party_size`), `IN (tags)` instead of `= ANY(tags)`; accept `IN (SELECT ...)` for semi-joins, `NOT IN (SELECT mentor_id FROM heroes WHERE mentor_id IS NOT NULL)`, LEFT JOIN anti-join.
- **Notes**: `NOT IN (SELECT mentor_id ...)` returns 0 rows, `NOT EXISTS` 17. Quest 8 was done by Nyx without its prerequisite 7 (handy anomaly). Hero tags: NULL for 11, 18, 30 and `{}` for 9, 17, 22, 24.

### ch13-unions-and-named-spells · Unions and Named Spells 📜
- **File** `src/content/chapters/ch13-unions-and-named-spells.ts` · **World** The Nested Catacombs · **Tier** adept · **Track** query · **Dataset** `guild`
- **Subtitle** Stack results, conjure inline tables, name your steps with WITH, and summon series
- **Concepts** `set-operations`, `values-lists`, `cte-basics`, `generate-series`
- **Prerequisites** `ch11-queries-within-queries`
- **Lesson** (9 steps)
  1. explain · UNION / UNION ALL / INTERSECT / EXCEPT: same column count and compatible types; UNION removes duplicates
  2. example · all regions: quest regions UNION guild halls
  3. quiz · UNION vs UNION ALL row count for the two region lists (6 vs 26)
  4. explain · `VALUES (1, 'a'), (2, 'b') AS t(id, label)` as a table
  5. example · a bounty board VALUES joined to quests by title
  6. explain · `WITH step AS (...) SELECT ... FROM step`; several CTEs separated by commas; a CTE lives for one statement
  7. example · completions per hero in a CTE, then above-average heroes
  8. explain · `generate_series(1, 20)` and dates `generate_series(date '2025-01-01', date '2025-12-01', interval '1 month')`
  9. try · every difficulty 1 to 5 with its number of Highmoor quests, 0 included
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch13-ex01 | every region that has a quest or a guild hall, once each | 1 | query | result | set-operations | write |
| ch13-ex02 | regions with quests but no guild hall (EXCEPT): Frostspire | 2 | query | result | set-operations | write |
| ch13-ex03 | fix a UNION that hides duplicates: list every quest reward and every hero gold amount as one column `amount` with duplicates kept (UNION ALL), NULL gold excluded | 2 | query | result | set-operations | fix |
| ch13-ex04 | VALUES bounty board `('Rats in the Cellar', 5), ('Yeti Tracks', 40), ('Dragon Tea Party', 99)` joined to quests: title, region, bonus (the unknown quest is dropped) | 2 | query | result | values-lists | write |
| ch13-ex05 | CTE: heroes whose completed-quest count is above the average count among heroes who completed at least one: name, count | 3 | query | result | cte-basics | write |
| ch13-ex06 | fix a query that uses a CTE in a second statement (42P01): merge into one statement | 2 | query | result | cte-basics | fix |
| ch13-ex07 | every level from 1 to 20 with its number of wanderers (heroes without a guild), 0 included, sorted by level | 2 | query | result (ordered) | generate-series | write |
| ch13-ex08 | every month of 2025 (first day as date) with the number of quest completions in it, 0 included | 3 | query | result | generate-series, cte-basics | write |
| ch13-ex09 | **Boss · Census of the Catacombs**: one CTE per source (heroes per region of their guild hall, quests per region, completions per region), joined on the full region list (UNION of all regions): region, heroes, quests, completions, zeros not NULLs | 4 | query | result | all | write |

- **Practice**: `ch13-pr01` set-operations: INTERSECT regions with quests and guild halls; `ch13-pr02` set-operations: UNION ALL hero names and guild names as one list with a `kind` column; `ch13-pr03` values-lists: VALUES of class → role labels joined to heroes; `ch13-pr04` cte-basics: two chained CTEs (per guild gold, then above 1000); `ch13-pr05` generate-series: difficulties 1 to 5 with quest counts; `ch13-pr06` generate-series: dates of the first week of October 2025 with rumor counts
- **Negative cases to add**: UNION where UNION ALL is required, mismatched column count (42601), VALUES without column aliases used by name, INNER JOIN on the series (empty levels lost), `count(*)` instead of `count(h.id)` on the series LEFT JOIN; accept `UNION` of DISTINCT subqueries, subquery instead of CTE.
- **Notes**: every level 1 to 20 has at least one hero, so plain per-level counts never show a 0: filter the facts (wanderers, a guild, a region) to make empty buckets appear, and put that filter in the ON clause or a CTE, not in WHERE.

### ch14-the-endless-stair · The Endless Stair 🌀
- **File** `src/content/chapters/ch14-the-endless-stair.ts` · **World** The Nested Catacombs · **Tier** expert · **Track** query · **Dataset** `guild`
- **Subtitle** Recursive CTEs: climb mentor lineages, quest chains and portal graphs without falling into loops
- **Concepts** `recursive-cte`, `recursive-graph-walks`
- **Prerequisites** `ch13-unions-and-named-spells`
- **Lesson** (9 steps)
  1. explain · `WITH RECURSIVE`: anchor `UNION ALL` recursive member that joins back to the CTE; stops when no new row
  2. example · counting 1 to 5
  3. explain · Trees as adjacency lists: `mentor_id`, `prerequisite_quest_id`, `skill_tree.parent_id`
  4. example · climbing up from hero 14 (Eskil) to Aldric, with depth
  5. quiz · what stops a recursion? (no new rows, not a LIMIT; runaway queries are killed by the watchdog)
  6. explain · Walking down: descendants with depth and a path array `path || h.id`
  7. explain · Graphs with cycles (portals Highmoor ↔ Mistwood): stop with `WHERE NOT next = ANY(path)` or the `CYCLE` clause; bound depth
  8. example · `CYCLE from_region SET is_cycle USING route` on portals from Highmoor
  9. try · all quests required before quest 4 (Embers of the Ash Wyrm): 13 then 5
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch14-ex01 | numbers 1 to 10 with a recursive CTE (no generate_series) | 1 | query | result | recursive-cte | write |
| ch14-ex02 | mentor chain of hero 14 upward: name and depth (Eskil 0 ... Aldric 4) | 2 | query | result | recursive-cte | write |
| ch14-ex03 | every apprentice of Aldric (direct or indirect): name and depth, Aldric excluded | 3 | query | result | recursive-cte | write |
| ch14-ex04 | fix a recursion with a type mismatch between anchor and recursive member (`'root'` vs `text` concat, 42804) building the skill path `Mage Arts > Fire Magic > ...` | 3 | query | result | recursive-cte | fix |
| ch14-ex05 | prerequisite chain of quest 18 (The Kraken's Due): id and title of every quest needed, nearest first | 2 | query | result (ordered) | recursive-cte | write |
| ch14-ex06 | fix the runaway walk over portals from Highmoor (starter has no cycle guard and is killed): every region reachable from Highmoor, once each | 3 | query | result | recursive-graph-walks | fix |
| ch14-ex07 | cheapest total toll from Highmoor to Frostspire over portals (48, via Mistwood and Saltmarsh): one row, the toll | 4 | query | result | recursive-graph-walks | write |
| ch14-ex08 | rumor reach: every hero who eventually hears the rumors first told by hero 8 (follow teller → listener, cycles possible), hero 8 excluded | 3 | query | result | recursive-graph-walks | write |
| ch14-ex09 | **Boss · Depths of the Catacombs**: heroes in Aldric's lineage (Aldric included) who never completed a quest, with their depth and the name of their direct mentor | 5 | query | result | recursive-cte, anti-join, cte-basics | write |

- **Practice**: `ch14-pr01` recursive-cte: powers of 2 below 1000; `ch14-pr02` recursive-cte: skill tree descendants of `Fire Magic` with depth; `ch14-pr03` recursive-cte: mentor chain of hero 30 (Mabel) upward; `ch14-pr04` recursive-graph-walks: regions reachable from Shadowfell with the number of hops (shortest); `ch14-pr05` recursive-graph-walks: detect the cycle starting at Highmoor with the `CYCLE` clause (return the cyclic path)
- **Negative cases to add**: UNION instead of UNION ALL where duplicates matter (depth counts), forgetting the anchor filter (every hero as a root), path check missing (killed by timeout, counts as wrong), max depth off by one; accept `SEARCH DEPTH FIRST` variants, CYCLE clause vs path array.
- **Notes**: every recursive exercise must terminate on the data even with a sloppy but correct answer; set the validator timeout in mind (30 s) and keep starters that loop only in **fix** exercises whose solution terminates. Bounded recursion (`WHERE depth < 10`) is an acceptable cycle guard in the accept list. `hierarchy-models` is taught in ch28; do not name it here.

## 8 to 11. Worlds 5 to 11 (ch15 to ch43)

Blueprints for these chapters are being drafted and will be appended here as sections 8 (World 5) to 14 (World 11), in the same format as sections 5 to 7. Until then, the overview table in section 3 (ids, datasets, concepts, prerequisites) is binding.
