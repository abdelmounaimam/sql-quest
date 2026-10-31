### ch25-binding-laws · Binding Laws ⚖️
- **File** `src/content/chapters/ch25-binding-laws.ts` · **World** The Architect's Tower · **Tier** adept · **Track** schema · **Dataset** `guild`
- **Subtitle** UNIQUE, CHECK, FOREIGN KEY, cascades, generated columns and ALTER TABLE
- **Concepts** `unique-constraint`, `check-constraint`, `foreign-key`, `fk-actions`, `generated-columns`, `alter-table`
- **Prerequisites** `ch24-laying-foundations`
- **Grading** Same hidden `pg_temp.try_sql` probes as ch24 (see its blueprint): never depend on constraint names.
- **Lesson** (10 steps)
  1. explain · Constraints are laws the database enforces for every writer, forever. CHECK (condition) rejects rows where it is false (23514).
  2. example · Read the laws of `quests` from `pg_constraint` with `pg_get_constraintdef(oid)`: primary key, CHECK on difficulty, FK to its prerequisite.
  3. quiz · `CHECK (gold >= 0)`: may Xander keep his NULL gold? (yes: NULL makes the check unknown, which passes)
  4. explain · UNIQUE: several NULLs allowed unless `NULLS NOT DISTINCT`; case variants slip through, use a unique index on `lower(name)`.
  5. explain · FOREIGN KEY: references a PK or UNIQUE column of the same type (42830, 42804), refuses orphans (23503), NULL allowed.
  6. explain · FK actions: NO ACTION/RESTRICT, CASCADE, SET NULL, SET DEFAULT; changing one means DROP CONSTRAINT then ADD CONSTRAINT.
  7. quiz · `ON DELETE SET NULL` on a NOT NULL column: what happens when the parent goes? (23502)
  8. explain · Generated columns: `GENERATED ALWAYS AS (expr) VIRTUAL|STORED`, read only (428C9), immutable expressions only.
  9. explain · ALTER TABLE: ADD/DROP/RENAME COLUMN, `TYPE ... USING`, ADD CONSTRAINT, `NOT VALID` for new rows only.
  10. try · Hero xp can never be negative: add the CHECK.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch25-ex01 | Guild mottos unique, NULL allowed several times. Probes: 'Shh.' again 23505, two new NULL-motto guilds ok, 'shh.' ok | 2 | ddl | state | unique-constraint | design |
| ch25-ex02 | Error mission: unique index on `lower(name)` of items: **23505** (Healing Potion twins) | 2 | ddl | error 23505 | unique-constraint | predict |
| ch25-ex03 | heroes.gold never below 0, unknown purses (NULL) still allowed; Grimsby's 0.00 stays legal. Probes: -1 refused 23514, 0 ok, NULL ok | 2 | ddl | state | check-constraint | design |
| ch25-ex04 | Fix: starter `ADD FOREIGN KEY (hero_id) REFERENCES heroes (name)` (42830) on setupSql `bounties`. Probes: hero 999 23503, hero 2 ok, NULL ok | 2 | ddl | state | foreign-key | fix |
| ch25-ex05 | Deleting a hero deletes their completions (replace the FK `quest_completions_hero_id_fkey` by an ON DELETE CASCADE one). Probes: delete hero 17 ok, its completions 0, total 44, hero 999 completion still 23503 | 4 | ddl | state | fk-actions | design |
| ch25-ex06 | Generated column **xp_to_next** = `level * 5000 - xp` on heroes. Probes: values, write 428C9, recomputed after a level change. VIRTUAL and STORED both accepted | 3 | ddl | state | generated-columns | design |
| ch25-ex07 | Fix: setupSql adds `heroes.height_cm text`; starter `ALTER ... TYPE int` fails 42804. Use USING. Probes: type integer, values, 'tall' refused 22P02 | 3 | ddl | state | alter-table | fix |
| ch25-ex08 | **Boss · The Armory Ledger**: create `item_loans` (identity id; item_id required FK items ON DELETE CASCADE; hero_id required FK heroes, deletion refused; qty > 0; loaned_on required; returned_on optional not before loaned_on; **days_out** generated; one loan per hero, item and day) and make a guild mandatory for new heroes without touching the 6 wanderers (`NOT VALID`) | 5 | ddl | state | unique-constraint, check-constraint, foreign-key, fk-actions, generated-columns, alter-table | design |

- **Practice**: `ch25-pr01` unique-constraint: `UNIQUE NULLS NOT DISTINCT` on setupSql `badges(badge_no)`; `ch25-pr02` check-constraint: error mission `ADD CHECK (level >= 5)` → 23514; `ch25-pr03` check-constraint: quest rewards strictly positive; `ch25-pr04` foreign-key: create `hero_pets(id, hero_id FK, name)`; `ch25-pr05` fk-actions: error mission delete guild 5 → 23503; `ch25-pr06` fk-actions: quests prerequisite FK ON DELETE SET NULL (setupSql adds quests 21 and 22); `ch25-pr07` generated-columns: `value_per_weight` on items; `ch25-pr08` alter-table: rename `quests.is_secret` to `hidden`; `ch25-pr09` alter-table: add `renown int NOT NULL DEFAULT 0` to heroes.
- **Negative cases to add**: `CHECK (gold > 0)` (fails on Grimsby), `CHECK (gold >= 0 AND gold IS NOT NULL)` (fails on NULL purses), unique on lower(motto), NULLS NOT DISTINCT where NULLs must repeat, FK dropped but no CASCADE, CASCADE on the mentor FK, writing to the generated column, type change without USING, plain CHECK instead of NOT VALID in the boss (23514 on wanderers), `days_out` as a plain column. Accept: UNIQUE constraint vs unique index, `CHECK (gold >= 0 OR gold IS NULL)`, column-level vs table-level constraints, RESTRICT vs NO ACTION, VIRTUAL vs STORED, `ALTER COLUMN ... SET DATA TYPE`.
- **Notes**: the heroes table already has `CHECK (level BETWEEN 1 AND 20)`, so the try uses xp. Hero 17 is referenced only by quest_completions (2 rows); hero 30 by nothing (boss probe). `NOT ENFORCED` (PG18) is mentioned only as a trap, NOT VALID is taught.
