import type { Chapter } from "../types";

/**
 * World 7 grading (see ch24): verifySql creates the hidden helper
 * pg_temp.try_sql(stmt) and runs behavioural probes in order. A write returns
 * 'ok' or 'error <SQLSTATE>', a SELECT returns its rows as text, so constraint
 * names and inline vs table constraints never matter.
 */
const TRY_SQL = `CREATE OR REPLACE FUNCTION pg_temp.try_sql(stmt text) RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE r text;
BEGIN
  IF ltrim(stmt) ~* '^(select|with|values|table)[[:space:]]' THEN
    EXECUTE 'SELECT string_agg(probe_row::text, '' ; '') FROM (' || stmt || ') probe_row' INTO r;
    RETURN coalesce(r, '(no rows)');
  END IF;
  EXECUTE stmt;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN 'error ' || SQLSTATE;
END
$fn$;`;

function probes(...rows: [string, string][]): string {
	const values = rows
		.map(([label, stmt], i) => `  (${i + 1}, '${label.replace(/'/g, "''")}', $p$${stmt}$p$)`)
		.join(",\n");
	return `${TRY_SQL}\nSELECT probe, pg_temp.try_sql(stmt) AS result\nFROM (VALUES\n${values}\n) AS t(n, probe, stmt)\nORDER BY n;`;
}

/** Probe that reports any integrity refusal (23xxx) as 'refused': RESTRICT (23001) and NO ACTION (23503) are equivalent. */
const refused = (stmt: string) =>
	`SELECT CASE WHEN r LIKE 'error 23%' THEN 'refused' ELSE r END FROM (SELECT pg_temp.try_sql($q$${stmt}$q$) AS r) x`;

/** A minimal valid hero insert with one extra column. */
const newHero = (name: string, extraCol: string, extraVal: string) =>
	`INSERT INTO heroes (name, class, level, joined_on, ${extraCol}) VALUES ('${name}', 'bard', 1, '2026-10-31', ${extraVal})`;

const chapter: Chapter = {
	id: "ch25-binding-laws",
	order: 25,
	world: "The Architect's Tower",
	tier: "adept",
	track: "schema",
	title: "Binding Laws",
	subtitle: "UNIQUE, CHECK, FOREIGN KEY, cascades, generated columns and ALTER TABLE",
	emoji: "⚖️",
	datasetId: "guild",
	concepts: [
		"unique-constraint",
		"check-constraint",
		"foreign-key",
		"fk-actions",
		"generated-columns",
		"alter-table",
	],
	prerequisites: ["ch24-laying-foundations"],
	lesson: [
		{
			kind: "explain",
			title: "Constraints and CHECK",
			body: "Application code can forget a validation, and scripts can skip one. **Constraints** are rules the database enforces on every write, whatever the client.\n\nThe simplest is **CHECK**: a condition each row must satisfy.\n```sql\nALTER TABLE quests\n  ADD CONSTRAINT quests_reward_positive CHECK (reward_gold > 0);\n```\nA row that makes it false is refused with 23514. So is the ALTER itself, if an existing row already breaks the rule.",
		},
		{
			kind: "example",
			title: "Listing the constraints of a table",
			body: "`pg_constraint` lists every constraint. Type `p` is a primary key, `c` a CHECK, `f` a foreign key, `u` UNIQUE.",
			sql: "SELECT conname, contype, pg_get_constraintdef(oid) AS rule\nFROM pg_constraint\nWHERE conrelid = 'quests'::regclass\nORDER BY conname;",
		},
		{
			kind: "quiz",
			question:
				"You add `CHECK (gold >= 0)` to heroes. One hero's gold is NULL. What happens to that row, now and later?",
			choices: [
				"The ALTER fails: NULL is not >= 0",
				"It is accepted: NULL >= 0 is unknown, and CHECK only refuses false",
				"The gold is set to 0 automatically",
				"The row is deleted",
			],
			answerIndex: 1,
			explanation:
				"WHERE keeps only true, but CHECK refuses only **false**. Unknown passes. That is usually what you want (an unknown amount is not a negative one); if NULL must be refused too, add `NOT NULL`.",
		},
		{
			kind: "explain",
			title: "UNIQUE and its two surprises",
			body: "`UNIQUE (motto)` refuses a second identical value (23505). Two surprises:\n\n- **NULLs are all different**: many guilds may have no motto. `UNIQUE NULLS NOT DISTINCT` allows only one.\n- **Case counts**: 'Healing Potion' and 'healing potion' are different text. For a case insensitive rule, index the expression:\n```sql\nCREATE UNIQUE INDEX ON items (lower(name));\n```",
		},
		{
			kind: "explain",
			title: "FOREIGN KEY: no orphan rows",
			body: "```sql\nALTER TABLE bounties\n  ADD FOREIGN KEY (hero_id) REFERENCES heroes (id);\n```\nNow every `hero_id` must exist in heroes (23503 otherwise). NULL is still allowed: *no hero yet*.\n\nThe target must be a primary key or UNIQUE column (42830), of a compatible type (42804). The parent is protected too: deleting a referenced hero fails.",
		},
		{
			kind: "explain",
			title: "ON DELETE actions",
			body: "The FK decides what deleting a parent does to its children:\n\n| action | children |\n|---|---|\n| `NO ACTION` / `RESTRICT` (default) | delete refused |\n| `ON DELETE CASCADE` | deleted too |\n| `ON DELETE SET NULL` | their FK becomes NULL |\n\nTo change it, drop the old constraint by name and add a new one: `ALTER TABLE t DROP CONSTRAINT name, ADD ...`.",
		},
		{
			kind: "quiz",
			question:
				"`quest_completions.hero_id` is NOT NULL. You give its FK `ON DELETE SET NULL` and delete a hero who completed quests. What happens?",
			choices: [
				"The completions keep a NULL hero",
				"The completions are deleted",
				"The delete fails: setting NULL breaks NOT NULL (23502)",
				"The NOT NULL constraint is dropped",
			],
			answerIndex: 2,
			explanation:
				"SET NULL tries to write NULL into a column that refuses it, so the whole delete fails with 23502. Pick the action that matches the column: CASCADE for owned rows, SET NULL only for optional links.",
		},
		{
			kind: "explain",
			title: "Generated columns",
			body: "A **generated column** is computed from other columns of the same row:\n```sql\nALTER TABLE heroes ADD COLUMN xp_to_next int\n  GENERATED ALWAYS AS (level * 5000 - xp) STORED;\n```\n**STORED** computes it on write; **VIRTUAL** (the PG18 default) on read. Either way you cannot write to it (428C9), and the expression must be immutable: no `now()` (42P17).",
		},
		{
			kind: "explain",
			title: "ALTER TABLE",
			body: "`ALTER TABLE` changes an existing table:\n```sql\nALTER TABLE heroes ADD COLUMN renown int NOT NULL DEFAULT 0;\nALTER TABLE heroes RENAME COLUMN renown TO fame;\nALTER TABLE heroes ALTER COLUMN height TYPE int USING height::int;\nALTER TABLE heroes ADD CONSTRAINT c CHECK (...) NOT VALID;\n```\n`USING` says how to convert old values (42804 without it). `NOT VALID` enforces a new constraint on new and updated rows only, skipping the existing ones.",
		},
		{
			kind: "try",
			title: "Add a CHECK on xp",
			prompt:
				"Add a constraint to **heroes**: **xp** can never be negative. Zero is allowed (one hero, Bors the Bold, has 0).",
			starterSql: "ALTER TABLE heroes ADD CHECK (xp > 0);",
			solutionSql: "ALTER TABLE heroes ADD CONSTRAINT heroes_xp_nonneg CHECK (xp >= 0);",
			check: {
				type: "state",
				verifySql: probes(
					["Aldric drops to 0 xp", "UPDATE heroes SET xp = 0 WHERE id = 1"],
					["Brynja drops to -1 xp", "UPDATE heroes SET xp = -1 WHERE id = 2"],
					["a new hero with -5 xp", newHero("Probe", "xp", "-5")],
				),
			},
			hints: [
				"Run the starter: an existing row with 0 xp already violates it.",
				"Never negative means 0 is allowed: `>=`.",
			],
		},
	],
	exercises: [
		{
			id: "ch25-ex01",
			title: "Add a UNIQUE constraint",
			prompt:
				"Make **guilds.motto** unique: no two guilds may share the same motto, but any number of guilds may have **no motto** (NULL). Comparison stays case sensitive.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["unique-constraint"],
			solutionSql: "ALTER TABLE guilds ADD CONSTRAINT guilds_motto_key UNIQUE (motto);",
			check: {
				type: "state",
				verifySql: probes(
					["a new guild with no motto", "INSERT INTO guilds (name, hall_region, founded_on) VALUES ('Mute Choir', 'Highmoor', '2026-01-01')"],
					["another guild with no motto", "INSERT INTO guilds (name, hall_region, founded_on) VALUES ('Silent Pact', 'Ashlands', '2026-01-02')"],
					["a second 'Shh.'", "INSERT INTO guilds (name, motto, hall_region, founded_on) VALUES ('Hush Hall', 'Shh.', 'Mistwood', '2026-02-02')"],
					["a lower case 'shh.'", "INSERT INTO guilds (name, motto, hall_region, founded_on) VALUES ('Whisper Club', 'shh.', 'Mistwood', '2026-02-03')"],
					["Ember Fang copies 'Shh.'", "UPDATE guilds SET motto = 'Shh.' WHERE id = 2"],
				),
			},
			hints: [
				"Which constraint refuses duplicates?",
				"Plain UNIQUE already lets NULLs repeat: no extra option needed.",
				"ALTER TABLE guilds ADD UNIQUE (motto);",
			],
			explanation:
				"A plain `UNIQUE` treats every NULL as different from every other, so guilds without a motto never collide, while a second 'Shh.' is refused (23505).\n\n**Pitfall:** `UNIQUE NULLS NOT DISTINCT` allows only one guild without a motto; a unique index on `lower(motto)` also refuses 'shh.', which the prompt does not ask for.\n\n**Alternative:** `CREATE UNIQUE INDEX guilds_motto_idx ON guilds (motto);` enforces the same rule.",
		},
		{
			id: "ch25-ex02",
			title: "Case insensitive unique index",
			prompt:
				"Create a unique index on **items** over `lower(name)`, so that item names are unique **ignoring case**. The table already holds a pair that differs only by case, so this mission succeeds when your statement **fails** with the right error.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["unique-constraint"],
			solutionSql: "CREATE UNIQUE INDEX items_name_lower_key ON items (lower(name));",
			check: { type: "error", sqlstate: "23505" },
			hints: [
				"An index can be built on an expression, inside its own parentheses.",
				"`CREATE UNIQUE INDEX ... ON items (lower(name))`",
				"CREATE UNIQUE INDEX items_name_lower_key ON items (lower(name));",
			],
			explanation:
				"'Healing Potion' and 'healing potion' both become 'healing potion', so building the index fails with 23505 and names the duplicate key. Clean the data first (merge or rename item 20), then the index can be built.\n\n**Pitfall:** `UNIQUE (name)` succeeds but does not enforce the rule: names that differ only by case still pass.\n\n**Alternative:** a `citext` column (covered in World 8) compares case insensitively by itself.",
		},
		{
			id: "ch25-ex03",
			title: "CHECK with NULL allowed",
			prompt:
				"Add a constraint to **heroes**: **gold** can never be **below 0**. A gold of exactly 0 stays legal (hero 12 has 0.00), and unknown gold (NULL) must stay allowed.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["check-constraint"],
			solutionSql: "ALTER TABLE heroes ADD CONSTRAINT heroes_gold_nonneg CHECK (gold >= 0);",
			check: {
				type: "state",
				verifySql: probes(
					["Grimsby keeps 0.00", "UPDATE heroes SET gold = 0 WHERE id = 12"],
					["Pip drops to -1", "UPDATE heroes SET gold = -1 WHERE id = 16"],
					["a new hero with unknown gold", newHero("Mira Fog", "gold", "NULL")],
					["a new hero in debt", newHero("Owen Owe", "gold", "-5")],
					["heroes with unknown gold", "SELECT count(*) FROM heroes WHERE gold IS NULL"],
				),
			},
			hints: [
				"Below 0 is forbidden, so 0 itself is fine.",
				"Remember the quiz: CHECK lets NULL through on its own.",
				"CHECK (gold >= 0)",
			],
			explanation:
				"`CHECK (gold >= 0)` refuses only rows where the test is false. Rows with a NULL gold give unknown, which passes.\n\n**Pitfall:** `CHECK (gold > 0)` fails on hero 12's 0.00 (23514 at ALTER time), and `CHECK (gold >= 0 AND gold IS NOT NULL)` fails on the NULL rows.\n\n**Alternative:** `CHECK (gold >= 0 OR gold IS NULL)` says the same thing explicitly.",
		},
		{
			id: "ch25-ex04",
			title: "Add a FOREIGN KEY",
			prompt:
				"Table **bounties** has a column **hero_id**. The starter fails. Add a foreign key so that **hero_id** must match an existing hero (`heroes.id`). A bounty with no hero (NULL) stays allowed.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["foreign-key"],
			setupSql:
				"CREATE TABLE bounties (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, hero_id int, reward int NOT NULL);\nINSERT INTO bounties (hero_id, reward) VALUES (1, 100), (5, 50), (NULL, 10);",
			starterSql: "ALTER TABLE bounties\n  ADD FOREIGN KEY (hero_id) REFERENCES heroes (name);",
			solutionSql: "ALTER TABLE bounties ADD FOREIGN KEY (hero_id) REFERENCES heroes (id);",
			check: {
				type: "state",
				verifySql: probes(
					["a bounty on hero 999", "INSERT INTO bounties (hero_id, reward) VALUES (999, 5)"],
					["a bounty on Brynja", "INSERT INTO bounties (hero_id, reward) VALUES (2, 70)"],
					["a bounty with no hero", "INSERT INTO bounties (hero_id, reward) VALUES (NULL, 20)"],
					["a bounty on Mabel", "INSERT INTO bounties (hero_id, reward) VALUES (30, 5)"],
					["Mabel leaves the registry", "DELETE FROM heroes WHERE id = 30"],
				),
			},
			hints: [
				"Read the error: the referenced column must be a key of heroes, and of the same type as hero_id.",
				"hero_id holds numbers: it must point at the numeric primary key.",
				"REFERENCES heroes (id)",
			],
			explanation:
				"`hero_id` is an int and must point at `heroes.id`, the primary key. Now hero 999 is refused (23503), and so is deleting hero 30 while a bounty references it.\n\n**Pitfall:** `REFERENCES heroes (name)` fails twice over: name is not unique (42830) and it is text, not int.\n\n**Alternative:** `REFERENCES heroes` without a column picks the primary key.",
		},
		{
			id: "ch25-ex05",
			title: "Change an FK to ON DELETE CASCADE",
			prompt:
				"Change the foreign key from **quest_completions.hero_id** to **heroes** so that deleting a hero **deletes their completions**. The completions' other foreign key (to quests) must stay as it is. Find the current constraint name in `pg_constraint`.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["fk-actions"],
			solutionSql:
				"ALTER TABLE quest_completions DROP CONSTRAINT quest_completions_hero_id_fkey;\nALTER TABLE quest_completions\n  ADD CONSTRAINT quest_completions_hero_id_fkey\n  FOREIGN KEY (hero_id) REFERENCES heroes (id) ON DELETE CASCADE;",
			check: {
				type: "state",
				verifySql: probes(
					["Rowan (17) retires", "DELETE FROM heroes WHERE id = 17"],
					["Rowan's completions", "SELECT count(*) FROM quest_completions WHERE hero_id = 17"],
					["all completions", "SELECT count(*) FROM quest_completions"],
					["a completion by hero 999", "INSERT INTO quest_completions (hero_id, quest_id, completed_at) VALUES (999, 1, '2026-10-31')"],
					["deleting quest 20", "DELETE FROM quests WHERE id = 20"],
					["foreign keys on quest_completions", "SELECT count(*) FROM pg_constraint WHERE conrelid = 'quest_completions'::regclass AND contype = 'f'"],
				),
			},
			hints: [
				"An FK action cannot be edited in place: drop the constraint, then add a new one.",
				"`SELECT conname FROM pg_constraint WHERE conrelid = 'quest_completions'::regclass AND contype = 'f';` gives the names.",
				"DROP CONSTRAINT quest_completions_hero_id_fkey, then ADD FOREIGN KEY (hero_id) REFERENCES heroes (id) ON DELETE CASCADE",
			],
			explanation:
				"With `ON DELETE CASCADE`, deleting hero 17 also deletes its 2 completions in the same statement. The FK still refuses hero 999, and the quest FK still protects quest 20.\n\n**Pitfall:** dropping the FK without re-adding it also lets the delete through, but leaves orphan completions and accepts hero 999. CASCADE on the wrong FK (quests) silently deletes completions when a quest is removed.\n\n**Alternative:** both steps in one statement: `ALTER TABLE quest_completions DROP CONSTRAINT ..., ADD CONSTRAINT ...`.",
		},
		{
			id: "ch25-ex06",
			title: "Add a generated column",
			prompt:
				"Add a **generated** column **xp_to_next** (`int`) to **heroes**, always equal to `level * 5000 - xp` (the xp still needed for the next level). It must stay correct when level or xp change, and nobody may write it by hand.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["generated-columns"],
			solutionSql:
				"ALTER TABLE heroes\n  ADD COLUMN xp_to_next int GENERATED ALWAYS AS (level * 5000 - xp) STORED;",
			check: {
				type: "state",
				verifySql: probes(
					["xp_to_next of every hero", "SELECT id, xp_to_next FROM heroes ORDER BY id"],
					["writing xp_to_next by hand", "UPDATE heroes SET xp_to_next = 0 WHERE id = 1"],
					["Bors reaches level 2", "UPDATE heroes SET level = 2 WHERE id = 24"],
					["Bors now needs", "SELECT xp_to_next FROM heroes WHERE id = 24"],
					["a new hero, level 3 with 1000 xp", "INSERT INTO heroes (name, class, level, xp, joined_on) VALUES ('Nova', 'mage', 3, 1000, '2026-10-31')"],
					["Nova needs", "SELECT xp_to_next FROM heroes WHERE name = 'Nova'"],
				),
			},
			hints: [
				"A normal column filled once by UPDATE would go stale.",
				"`ADD COLUMN ... GENERATED ALWAYS AS (expression)`, then STORED or VIRTUAL.",
				"`ADD COLUMN xp_to_next int GENERATED ALWAYS AS (level * 5000 - xp) STORED`",
			],
			explanation:
				"The database recomputes `xp_to_next` whenever level or xp changes: hero 24 at level 2 now needs 10000. Writing it by hand is refused (428C9).\n\n**Pitfall:** `ADD COLUMN xp_to_next int` plus a one-off UPDATE looks identical at first and becomes wrong after the next change, the classic stale cached value bug.\n\n**Alternative:** `VIRTUAL` (the PG18 default) computes it on every read instead of storing it.",
		},
		{
			id: "ch25-ex07",
			title: "Change a column type with USING",
			prompt:
				"**heroes.height_cm** is `text` (values like '188', some NULL). The starter fails. Change the column to `int`, **keeping** every height.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["alter-table"],
			setupSql:
				"ALTER TABLE heroes ADD COLUMN height_cm text;\nUPDATE heroes SET height_cm = CASE id WHEN 1 THEN '188' WHEN 5 THEN '170' WHEN 13 THEN '165' WHEN 19 THEN '201' END;",
			starterSql: "ALTER TABLE heroes\n  ALTER COLUMN height_cm TYPE int;",
			solutionSql: "ALTER TABLE heroes\n  ALTER COLUMN height_cm TYPE int USING height_cm::int;",
			check: {
				type: "state",
				verifySql: probes(
					["type of height_cm", "SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'heroes'::regclass AND attname = 'height_cm'"],
					["known heights", "SELECT id, height_cm FROM heroes WHERE height_cm IS NOT NULL ORDER BY id"],
					["Morwen's height set to 'tall'", "UPDATE heroes SET height_cm = 'tall' WHERE id = 3"],
				),
			},
			hints: [
				"Run the starter and read the hint in the error message.",
				"Postgres will not guess how to turn text into int: tell it with USING.",
				"ALTER COLUMN height_cm TYPE int USING height_cm::int",
			],
			explanation:
				"`USING height_cm::int` converts each old value while the table is rewritten; NULLs stay NULL. Afterwards 'tall' is refused (22P02).\n\n**Pitfall:** without USING the change fails (42804). Dropping the column and adding a fresh int one runs fine and loses every height.\n\n**Alternative:** `ALTER COLUMN height_cm SET DATA TYPE integer USING CAST(height_cm AS integer)`.",
		},
		{
			id: "ch25-ex08",
			title: "The Armory Ledger",
			story:
				"Combines UNIQUE, CHECK, foreign keys with ON DELETE actions, a generated column and a NOT VALID constraint.",
			prompt:
				"1. Create **item_loans** with:\n   - **id**: `int` identity primary key\n   - **item_id**: `int`, required, an existing item; **deleting an item deletes its loans**\n   - **hero_id**: `int`, required, an existing hero; **deleting a hero who has loans is refused**\n   - **qty**: `int`, required, **greater than 0**\n   - **loaned_on**: `date`, required; **returned_on**: `date`, optional, **never before** loaned_on\n   - **days_out**: `int`, **generated** as `returned_on - loaned_on`\n   - a hero may not borrow the **same item twice on the same day**\n2. On **heroes**: every **new** hero must have a guild (`guild_id`), but the 6 existing heroes without a guild stay as they are.",
			difficulty: 5,
			kind: "ddl",
			concepts: [
				"unique-constraint",
				"check-constraint",
				"foreign-key",
				"fk-actions",
				"generated-columns",
				"alter-table",
			],
			boss: true,
			solutionSql:
				"CREATE TABLE item_loans (\n  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  item_id     int NOT NULL REFERENCES items (id) ON DELETE CASCADE,\n  hero_id     int NOT NULL REFERENCES heroes (id) ON DELETE RESTRICT,\n  qty         int NOT NULL CHECK (qty > 0),\n  loaned_on   date NOT NULL,\n  returned_on date,\n  days_out    int GENERATED ALWAYS AS (returned_on - loaned_on) STORED,\n  CHECK (returned_on >= loaned_on),\n  UNIQUE (hero_id, item_id, loaned_on)\n);\nALTER TABLE heroes\n  ADD CONSTRAINT heroes_guild_required CHECK (guild_id IS NOT NULL) NOT VALID;",
			check: {
				type: "state",
				verifySql: probes(
					["Aldric borrows the Dragonbone Sword", "INSERT INTO item_loans (item_id, hero_id, qty, loaned_on, returned_on) VALUES (2, 1, 1, '2026-10-01', '2026-10-11')"],
					["Morwen borrows 2 potions", "INSERT INTO item_loans (item_id, hero_id, qty, loaned_on) VALUES (1, 3, 2, '2026-10-05')"],
					["days out", "SELECT item_id, days_out FROM item_loans ORDER BY item_id"],
					["a loan of 0 torches", "INSERT INTO item_loans (item_id, hero_id, qty, loaned_on) VALUES (5, 1, 0, '2026-10-02')"],
					["returned before it was lent", "INSERT INTO item_loans (item_id, hero_id, qty, loaned_on, returned_on) VALUES (5, 1, 1, '2026-10-02', '2026-10-01')"],
					["an unknown item", "INSERT INTO item_loans (item_id, hero_id, qty, loaned_on) VALUES (99, 1, 1, '2026-10-02')"],
					["an unknown hero", "INSERT INTO item_loans (item_id, hero_id, qty, loaned_on) VALUES (5, 999, 1, '2026-10-02')"],
					["the sword again, same day", "INSERT INTO item_loans (item_id, hero_id, qty, loaned_on) VALUES (2, 1, 1, '2026-10-01')"],
					["the sword again, a week later", "INSERT INTO item_loans (item_id, hero_id, qty, loaned_on) VALUES (2, 1, 1, '2026-10-08')"],
					["a loan without a date", "INSERT INTO item_loans (item_id, hero_id, qty) VALUES (5, 1, 1)"],
					["a loan without an item", "INSERT INTO item_loans (hero_id, qty, loaned_on) VALUES (1, 1, '2026-10-02')"],
					["writing days_out by hand", "UPDATE item_loans SET days_out = 3"],
					["Mabel borrows a torch", "INSERT INTO item_loans (item_id, hero_id, qty, loaned_on) VALUES (5, 30, 1, '2026-10-03')"],
					["Mabel leaves the registry", refused("DELETE FROM heroes WHERE id = 30")],
					["the sword is destroyed", "DELETE FROM items WHERE id = 2"],
					["loans left", "SELECT item_id, hero_id FROM item_loans ORDER BY item_id, hero_id"],
					["a new wanderer", "INSERT INTO heroes (name, class, level, joined_on) VALUES ('Drifter', 'bard', 1, '2026-10-31')"],
					["a new Iron Anvil smith", "INSERT INTO heroes (name, class, level, joined_on, guild_id) VALUES ('Tobin Coal', 'warrior', 1, '2026-10-31', 4)"],
					["the old wanderers", "SELECT count(*) FROM heroes WHERE guild_id IS NULL"],
				),
			},
			hints: [
				"Go rule by rule: NOT NULL, REFERENCES with an ON DELETE action, CHECK, GENERATED ALWAYS AS, and a UNIQUE over three columns. A CHECK that compares two columns is easiest as a table constraint.",
				"For the heroes rule, a plain CHECK fails on the existing heroes without a guild (23514). There is a keyword that applies a new constraint to new rows only.",
				"item_id ... REFERENCES items ON DELETE CASCADE, hero_id ... REFERENCES heroes (default refuses), UNIQUE (hero_id, item_id, loaned_on), CHECK (returned_on >= loaned_on). Then: ALTER TABLE heroes ADD CHECK (guild_id IS NOT NULL) NOT VALID;",
			],
			explanation:
				"Every rule lives in the schema now: types and NOT NULL for presence, CHECKs for ranges, FKs with the right action for ownership (loans belong to an item, but a hero cannot be deleted while it has loans), a three column UNIQUE for the daily rule, and a generated `days_out` that cannot drift. `NOT VALID` enforces the guild rule on new rows while the 6 existing rows stay unchecked.\n\n**Pitfall:** `CHECK (returned_on >= loaned_on)` lets an open loan (NULL) pass, which is right; `ON DELETE CASCADE` on hero_id would silently erase the record of unreturned items.\n\n**Alternative:** `RESTRICT` and the default `NO ACTION` both refuse the delete; `VIRTUAL` works for days_out. Later, once those heroes have a guild, `ALTER TABLE heroes VALIDATE CONSTRAINT ...` checks the old rows too.",
		},
	],
	practice: [
		{
			id: "ch25-pr01",
			title: "UNIQUE NULLS NOT DISTINCT",
			prompt:
				"Table **guards** has **badge_no**. Make badge numbers unique **and** allow **at most one** guard without a badge (NULL). Ines already has no badge (NULL).",
			difficulty: 2,
			kind: "ddl",
			concepts: ["unique-constraint"],
			setupSql:
				"CREATE TABLE guards (name text NOT NULL, badge_no int);\nINSERT INTO guards VALUES ('Hugo', 7), ('Ines', NULL);",
			solutionSql: "ALTER TABLE guards ADD UNIQUE NULLS NOT DISTINCT (badge_no);",
			check: {
				type: "state",
				verifySql: probes(
					["Jory with badge 8", "INSERT INTO guards VALUES ('Jory', 8)"],
					["Kael with badge 7", "INSERT INTO guards VALUES ('Kael', 7)"],
					["Lune without a badge", "INSERT INTO guards VALUES ('Lune', NULL)"],
				),
			},
			hints: [
				"Plain UNIQUE lets NULLs repeat.",
				"PG15 added an option that treats NULLs as equal.",
				"UNIQUE NULLS NOT DISTINCT (badge_no)",
			],
			explanation:
				"`NULLS NOT DISTINCT` counts NULL as one value, so a second guard without a badge (Lune) is refused.\n\n**Pitfall:** plain UNIQUE accepts any number of NULLs.\n\n**Alternative:** a partial unique index `ON guards ((badge_no IS NULL)) WHERE badge_no IS NULL` does the same in older versions.",
		},
		{
			id: "ch25-pr02",
			title: "A CHECK that existing rows break",
			prompt:
				"Try to add `CHECK (level >= 5)` to **heroes**. Some heroes are below level 5, so this mission succeeds when the statement **fails** with the right error.",
			difficulty: 1,
			kind: "ddl",
			concepts: ["check-constraint"],
			solutionSql: "ALTER TABLE heroes ADD CHECK (level >= 5);",
			check: { type: "error", sqlstate: "23514" },
			hints: [
				"Just run the ALTER.",
				"Adding a CHECK validates every existing row.",
				"ALTER TABLE heroes ADD CHECK (level >= 5);",
			],
			explanation:
				"Several heroes (hero 30 is level 2) break the new rule, so the ALTER fails with 23514 and nothing changes.\n\n**Pitfall:** believing a new constraint only applies to future rows: by default it checks the past too.\n\n**Alternative:** `NOT VALID` skips the existing rows on purpose.",
		},
		{
			id: "ch25-pr03",
			title: "Strictly positive CHECK",
			prompt:
				"Add a constraint to **quests**: **reward_gold** must be **strictly positive**.",
			difficulty: 1,
			kind: "ddl",
			concepts: ["check-constraint"],
			solutionSql: "ALTER TABLE quests ADD CONSTRAINT quests_reward_positive CHECK (reward_gold > 0);",
			check: {
				type: "state",
				verifySql: probes(
					["a quest paying 1", "INSERT INTO quests (title, region, difficulty, reward_gold) VALUES ('Fetch Water', 'Highmoor', 1, 1)"],
					["a quest paying 0", "INSERT INTO quests (title, region, difficulty, reward_gold) VALUES ('Volunteer Work', 'Highmoor', 1, 0)"],
					["Rats in the Cellar now pays -10", "UPDATE quests SET reward_gold = -10 WHERE id = 1"],
				),
			},
			hints: [
				"Strictly positive excludes zero.",
				"A CHECK with `>`.",
				"CHECK (reward_gold > 0)",
			],
			explanation:
				"Every existing reward is at least 10, so the constraint is accepted and 0 is refused from now on.\n\n**Pitfall:** `>= 0` allows unpaid quests.\n\n**Alternative:** `CHECK (reward_gold BETWEEN 1 AND 100000)` adds an upper bound too.",
		},
		{
			id: "ch25-pr04",
			title: "Required foreign key",
			prompt:
				"Create **hero_pets** with **id** (`int` identity primary key), **hero_id** (`int`, required, an existing hero) and **name** (`text`, required).",
			difficulty: 2,
			kind: "ddl",
			concepts: ["foreign-key"],
			solutionSql:
				"CREATE TABLE hero_pets (\n  id      int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  hero_id int NOT NULL REFERENCES heroes (id),\n  name    text NOT NULL\n);",
			check: {
				type: "state",
				verifySql: probes(
					["Morwen's owl", "INSERT INTO hero_pets (hero_id, name) VALUES (3, 'Ash')"],
					["a pet of hero 999", "INSERT INTO hero_pets (hero_id, name) VALUES (999, 'Ghost')"],
					["a pet with no owner", "INSERT INTO hero_pets (name) VALUES ('Stray')"],
					["Mabel's toad", "INSERT INTO hero_pets (hero_id, name) VALUES (30, 'Wart')"],
					["Mabel leaves the registry", "DELETE FROM heroes WHERE id = 30"],
				),
			},
			hints: [
				"Required and must exist: two constraints on hero_id.",
				"`REFERENCES heroes (id)` can be written inline.",
				"hero_id int NOT NULL REFERENCES heroes (id)",
			],
			explanation:
				"NOT NULL requires a hero_id, REFERENCES requires an existing one, and hero 30 cannot be deleted while a pet references it.\n\n**Pitfall:** without NOT NULL the FK accepts a pet with no hero_id.\n\n**Alternative:** `FOREIGN KEY (hero_id) REFERENCES heroes` as a table constraint.",
		},
		{
			id: "ch25-pr05",
			title: "Delete a referenced row",
			prompt:
				"Delete guild **5** (Wandering Lanterns). Its heroes still reference it, so this mission succeeds when the delete **fails** with the right error.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["fk-actions"],
			solutionSql: "DELETE FROM guilds WHERE id = 5;",
			check: { type: "error", sqlstate: "23503" },
			hints: [
				"Just run the DELETE.",
				"heroes.guild_id has the default action.",
				"DELETE FROM guilds WHERE id = 5;",
			],
			explanation:
				"The default FK action (NO ACTION) refuses to leave heroes pointing at a missing guild: 23503.\n\n**Pitfall:** guild 6 deletes fine because nobody references it, so a test on an empty guild proves nothing.\n\n**Alternative:** `ON DELETE SET NULL` on heroes.guild_id would set their guild_id to NULL instead.",
		},
		{
			id: "ch25-pr06",
			title: "Change an FK to ON DELETE SET NULL",
			prompt:
				"The setup adds two quests: Sparring Match requires Training Dummy. Change the foreign key **quests.prerequisite_quest_id** so that deleting a quest sets the prerequisite of the quests that required it to **NULL**.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["fk-actions"],
			setupSql:
				"INSERT INTO quests (title, region, difficulty, reward_gold) VALUES ('Training Dummy', 'Highmoor', 1, 5);\nINSERT INTO quests (title, region, difficulty, reward_gold, prerequisite_quest_id) SELECT 'Sparring Match', 'Highmoor', 1, 8, id FROM quests WHERE title = 'Training Dummy';",
			solutionSql:
				"ALTER TABLE quests DROP CONSTRAINT quests_prerequisite_quest_id_fkey;\nALTER TABLE quests ADD FOREIGN KEY (prerequisite_quest_id) REFERENCES quests (id) ON DELETE SET NULL;",
			check: {
				type: "state",
				verifySql: probes(
					["retiring Training Dummy", "DELETE FROM quests WHERE title = 'Training Dummy'"],
					["Sparring Match requires", "SELECT coalesce(prerequisite_quest_id::text, 'nothing') FROM quests WHERE title = 'Sparring Match'"],
					["a quest requiring quest 999", "INSERT INTO quests (title, region, difficulty, reward_gold, prerequisite_quest_id) VALUES ('Ghost Hunt', 'Highmoor', 2, 30, 999)"],
				),
			},
			hints: [
				"Drop the old FK (its name is in pg_constraint), add a new one.",
				"The action for optional links is SET NULL.",
				"ADD FOREIGN KEY (prerequisite_quest_id) REFERENCES quests (id) ON DELETE SET NULL",
			],
			explanation:
				"Sparring Match survives with no prerequisite, and the FK still refuses quest 999.\n\n**Pitfall:** CASCADE would delete Sparring Match too, and every quest chained after it.\n\n**Alternative:** both steps in one ALTER separated by a comma.",
		},
		{
			id: "ch25-pr07",
			title: "Generated column with round",
			prompt:
				"Add a **generated** column **value_per_weight** (`numeric`) to **items**, equal to `round(base_value / weight, 2)`.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["generated-columns"],
			solutionSql:
				"ALTER TABLE items\n  ADD COLUMN value_per_weight numeric GENERATED ALWAYS AS (round(base_value / weight, 2)) VIRTUAL;",
			check: {
				type: "state",
				verifySql: probes(
					["values", "SELECT id, value_per_weight FROM items ORDER BY id"],
					["writing it by hand", "UPDATE items SET value_per_weight = 1 WHERE id = 1"],
				),
			},
			hints: [
				"Same shape as xp_to_next.",
				"`GENERATED ALWAYS AS (...)`, STORED or VIRTUAL.",
				"ADD COLUMN value_per_weight numeric GENERATED ALWAYS AS (round(base_value / weight, 2)) VIRTUAL",
			],
			explanation:
				"The Phoenix Feather has the highest value, 750000 per unit of weight; the Mystery Egg, with no base_value, gets NULL, because NULL divided by anything is NULL.\n\n**Pitfall:** a plain column filled by UPDATE forgets every future price change.\n\n**Alternative:** STORED computes it once per write.",
		},
		{
			id: "ch25-pr08",
			title: "Rename a column",
			prompt: "Rename the column **is_secret** of **quests** to **hidden**.",
			difficulty: 1,
			kind: "ddl",
			concepts: ["alter-table"],
			solutionSql: "ALTER TABLE quests RENAME COLUMN is_secret TO hidden;",
			check: {
				type: "state",
				verifySql: probes(
					["columns of quests", "SELECT attname FROM pg_attribute WHERE attrelid = 'quests'::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attnum"],
					["hidden quests", "SELECT count(*) FROM quests WHERE hidden"],
				),
			},
			hints: [
				"ALTER TABLE can rename a column in place.",
				"RENAME COLUMN old TO new",
				"ALTER TABLE quests RENAME COLUMN is_secret TO hidden;",
			],
			explanation:
				"A rename keeps the data, the default and the constraints; only the name changes.\n\n**Pitfall:** adding a new column and copying leaves the old one behind, and drops its NOT NULL and default.\n\n**Alternative:** none needed, but every query using the old name now fails with 42703.",
		},
		{
			id: "ch25-pr09",
			title: "Add a NOT NULL column with a default",
			prompt:
				"The starter fails. Add a required column **renown** (`int`) to **heroes** that starts at **0** for every existing and future hero.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["alter-table"],
			starterSql: "ALTER TABLE heroes ADD COLUMN renown int NOT NULL;",
			solutionSql: "ALTER TABLE heroes ADD COLUMN renown int NOT NULL DEFAULT 0;",
			check: {
				type: "state",
				verifySql: probes(
					["heroes with renown 0", "SELECT count(*) FROM heroes WHERE renown = 0"],
					["a new hero", "INSERT INTO heroes (name, class, level, joined_on) VALUES ('Fresh Face', 'bard', 1, '2026-10-31')"],
					["a hero with NULL renown", newHero("Nobody", "renown", "NULL")],
				),
			},
			hints: [
				"What value would the 30 existing heroes get?",
				"A DEFAULT fills existing rows when the column is added.",
				"ADD COLUMN renown int NOT NULL DEFAULT 0",
			],
			explanation:
				"The DEFAULT fills all 30 rows at once (instantly, without rewriting the table), and NOT NULL then holds.\n\n**Pitfall:** NOT NULL without a default fails with 23502 on a populated table.\n\n**Alternative:** add it nullable, UPDATE, then `ALTER COLUMN renown SET NOT NULL`.",
		},
	],
};

export default chapter;
