import type { Chapter } from "../types";

/**
 * Hidden checker helpers (exercise setupSql only). Learners cannot switch roles,
 * so verifySql asks these functions to do it:
 *  - seen_as(role, table): rows of the table visible to that role, or the SQLSTATE;
 *  - try_as(role, statement): 'ok:<rows>' or the SQLSTATE;
 *  - sqlstate_of(statement): 'ok' or the SQLSTATE, as the current user.
 */
const HELPERS = `CREATE FUNCTION seen_as(r text, tbl text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  EXECUTE format('SET ROLE %I', r);
  EXECUTE format('SELECT count(*) FROM %I', tbl) INTO n;
  RESET ROLE;
  RETURN n::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $f$;
CREATE FUNCTION try_as(r text, stmt text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  EXECUTE format('SET ROLE %I', r);
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  RETURN 'ok:' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $f$;
CREATE FUNCTION sqlstate_of(q text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE q;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $f$;`;

const CLEARANCE_TRIGGER = (ret: "NULL" | "NEW") => `CREATE OR REPLACE FUNCTION check_clearance() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT clearance FROM readers WHERE id = NEW.reader_id)
     < (SELECT clearance_level FROM scrolls WHERE id = NEW.scroll_id) THEN
    RAISE EXCEPTION 'reader % may not borrow scroll %', NEW.reader_id, NEW.scroll_id;
  END IF;
  RETURN ${ret};
END $$;`;

const NEW_LOAN = (scroll: number, reader: number) =>
	`INSERT INTO loans (scroll_id, reader_id, loan_period) VALUES (${scroll}, ${reader}, '[2026-11-01 10:00+00,2026-11-15 10:00+00)')`;

const BOSS_SETUP = `${HELPERS}
CREATE TABLE scroll_audit (
  id         bigint GENERATED ALWAYS AS IDENTITY,
  scroll_id  int NOT NULL,
  changed    jsonb NOT NULL
);
CREATE TABLE scroll_import (title text, section_id int, author text, language text, body text, page_count int, clearance_level int);
INSERT INTO scroll_import
  SELECT title, section_id, 'Hakon Bly', language, body, 4, clearance_level FROM scrolls WHERE id = 4;
INSERT INTO scroll_import
  SELECT title, section_id, author, language, body, page_count, clearance_level FROM scrolls WHERE id = 5;
INSERT INTO scroll_import VALUES
  ('The Mouser''s Ledger', 10, 'Mittens', 'en', 'Seven mice, two moths and one suspicious sock. Every page is signed with a paw.', 1, 1);`;

const BOSS_UPSERT = `INSERT INTO scrolls (title, section_id, author, language, body, page_count, clearance_level)
SELECT title, section_id, author, language, body, page_count, clearance_level FROM scroll_import
ON CONFLICT (title) DO UPDATE
  SET author = EXCLUDED.author, page_count = EXCLUDED.page_count;`;

const chapter: Chapter = {
	id: "ch42-wards-and-gatekeepers",
	order: 42,
	world: "The Astral Spire",
	tier: "master",
	track: "advanced",
	title: "Wards and Gatekeepers",
	subtitle:
		"Triggers, audit trails, notifications, privileges, row-level security and safe imports",
	emoji: "🛡️",
	datasetId: "library",
	concepts: [
		"triggers",
		"audit-history",
		"listen-notify",
		"roles-privileges",
		"row-level-security",
		"upsert-patterns",
		"stored-logic-guidelines",
	],
	prerequisites: [
		"ch41-spellcrafting",
		"ch22-merge-and-upsert",
		"ch31-scrolls-of-json",
	],
	lesson: [
		{
			kind: "explain",
			title: "Spells that cast themselves",
			body: "A **trigger** runs a function automatically when rows change:\n```sql\nCREATE FUNCTION f() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n  NEW.email := lower(NEW.email);\n  RETURN NEW;\nEND $$;\nCREATE TRIGGER t BEFORE INSERT OR UPDATE ON readers\n  FOR EACH ROW EXECUTE FUNCTION f();\n```\n- **BEFORE** can change `NEW`; **AFTER** sees the final row.\n- `OLD` is the row before, `NEW` after; `TG_OP` says INSERT, UPDATE or DELETE.\n- A BEFORE row trigger that returns **NULL** silently skips the row.",
		},
		{
			kind: "example",
			title: "NULL into a NOT NULL column?",
			body: "`loan_period` is NOT NULL, yet this insert passes: the BEFORE trigger runs first and fills in a 14-day period. Constraints are checked after BEFORE triggers.",
			sql: "CREATE FUNCTION default_period() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n  IF NEW.loan_period IS NULL THEN\n    NEW.loan_period := tstzrange(now(), now() + interval '14 days');\n  END IF;\n  RETURN NEW;\nEND $$;\nCREATE TRIGGER loans_default_period BEFORE INSERT ON loans\n  FOR EACH ROW EXECUTE FUNCTION default_period();\n\nINSERT INTO loans (scroll_id, reader_id, loan_period) VALUES (12, 3, NULL)\nRETURNING id, upper(loan_period) - lower(loan_period) AS lasts;",
		},
		{
			kind: "explain",
			title: "Who changed what, and when",
			body: "An **audit trail** is an AFTER trigger that copies every change into a history table:\n```sql\nINSERT INTO loan_audit (op, loan_id, old_row, new_row)\nVALUES (TG_OP, coalesce(NEW.id, OLD.id),\n        to_jsonb(OLD), to_jsonb(NEW));\n```\n`to_jsonb(OLD)` stores the whole row as a document, so the history survives schema changes. Add `current_user` and `now()` (as column defaults) to know who and when. On INSERT `OLD` is NULL; on DELETE `NEW` is.",
		},
		{
			kind: "explain",
			title: "Ringing the bell: LISTEN and NOTIFY",
			body: "Other programs can wait for news:\n```sql\nLISTEN returns;                       -- a client subscribes\nSELECT pg_notify('returns', '13');    -- someone rings\n```\nThe message is delivered **at COMMIT**, never before, and never if the transaction rolls back. A listener that is offline misses it forever, so serious systems also write an **outbox** row in the same transaction: the bell wakes the worker, the outbox remembers the job.",
		},
		{
			kind: "example",
			title: "Who may do what",
			body: "Roles receive privileges with `GRANT ... ON table TO role` and lose them with `REVOKE ... FROM role`. Give each role only what it needs (least privilege). `has_table_privilege` reads the answer from the catalog: the apprentice may read scrolls but not loans.",
			sql: "SELECT r AS role, t AS tbl,\n       has_table_privilege(r, t, 'SELECT') AS can_read,\n       has_table_privilege(r, t, 'UPDATE') AS can_update\nFROM unnest(ARRAY['apprentice_reader', 'archivist']) AS r,\n     unnest(ARRAY['scrolls', 'loans', 'readers']) AS t\nORDER BY r, t;",
		},
		{
			kind: "quiz",
			question:
				"You enable row-level security on `scrolls`, create a policy that hides forbidden scrolls, run `SELECT count(*) FROM scrolls` and still get 30. Why?",
			choices: [
				"Policies only apply after a server restart",
				"You are the superuser `postgres`, and superusers bypass row-level security",
				"RLS only filters UPDATE and DELETE, never SELECT",
				"The policy needs a LIMIT",
			],
			answerIndex: 1,
			explanation:
				"Superusers (and table owners, unless you `FORCE` RLS) bypass every policy. The policy works: test it as the role it targets. In this app you cannot `SET ROLE`, so the checker switches roles for you.",
		},
		{
			kind: "explain",
			title: "Row-level security",
			body: "Privileges decide *which tables*; **policies** decide *which rows*:\n```sql\nALTER TABLE scrolls ENABLE ROW LEVEL SECURITY;\nCREATE POLICY public_only ON scrolls\n  FOR SELECT TO apprentice_reader\n  USING (clearance_level = 1);\n```\n- `USING` filters the rows a role can see or touch.\n- `WITH CHECK` validates rows a role writes (INSERT, UPDATE).\n- RLS enabled with **no** policy for a role means it sees **nothing**.",
		},
		{
			kind: "explain",
			title: "Imports you can run twice",
			body: "Imports crash halfway, cron jobs fire twice. Make them **idempotent**: running again changes nothing.\n```sql\nINSERT INTO readers (...)\nSELECT ... FROM reader_import\nON CONFLICT (email) DO UPDATE\n  SET name = EXCLUDED.name;\n```\nLoad raw rows into a **staging** table, then upsert on a natural key (or MERGE). Counters too: `ON CONFLICT (k) DO UPDATE SET n = t.n + 1` is atomic, while read-then-write races.",
		},
		{
			kind: "explain",
			title: "Where should a rule live?",
			body: "Elowen's rule of thumb:\n\n1. **Constraints first**: `CHECK`, `UNIQUE`, `FOREIGN KEY` are declarative, visible and always on.\n2. **Functions** next: explicit logic that callers choose to run.\n3. **Triggers last**: for side effects like audit trails, never for rules a CHECK can state.\n\nTriggers are invisible in queries: hide too much in them and nobody knows why a row changed or vanished.",
		},
		{
			kind: "try",
			title: "Your turn: open the ledger",
			prompt:
				"Head Librarian Elowen lets apprentices read the loans ledger. Grant **SELECT** on `loans` to `apprentice_reader` (and nothing more).",
			starterSql: "GRANT SELECT ON scrolls TO apprentice_reader;",
			solutionSql: "GRANT SELECT ON loans TO apprentice_reader;",
			check: {
				type: "state",
				verifySql:
					"SELECT has_table_privilege('apprentice_reader', 'loans', 'SELECT') AS can_read,\n       has_table_privilege('apprentice_reader', 'loans', 'UPDATE') AS can_update;",
			},
			hints: [
				"The starter grants a privilege the apprentice already has, on the wrong table.",
				"GRANT SELECT ON loans TO apprentice_reader;",
			],
		},
	],
	exercises: [
		{
			id: "ch42-ex01",
			title: "One spelling per address",
			story:
				"Wisp the courier keeps mixing `Garrick.Holt@Aethel.LIB` and `garrick.holt@aethel.lib`. Ines wants every email stored in lower case, whoever writes it.",
			prompt:
				"Create a **BEFORE INSERT OR UPDATE** row trigger on `readers` that stores `lower(email)` in `email`. The check updates reader 5 and inserts a new reader.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["triggers"],
			solutionSql:
				"CREATE FUNCTION lower_email() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n  NEW.email := lower(NEW.email);\n  RETURN NEW;\nEND $$;\n\nCREATE TRIGGER readers_lower_email\n  BEFORE INSERT OR UPDATE ON readers\n  FOR EACH ROW EXECUTE FUNCTION lower_email();",
			check: {
				type: "state",
				verifySql:
					"UPDATE readers SET name = name WHERE id = 5;\nINSERT INTO readers (name, email, password_hash, clearance, joined_at)\nVALUES ('Vera Lark', 'Vera.Lark@AETHEL.lib', 'x', 1, '2026-10-31');\nSELECT name, email::text FROM readers WHERE id = 5 OR name = 'Vera Lark' ORDER BY name;",
			},
			hints: [
				"Two statements: a function `RETURNS trigger`, then `CREATE TRIGGER ... EXECUTE FUNCTION`.",
				"Change `NEW.email` and return `NEW`; a BEFORE trigger's changes are what gets stored.",
				"NEW.email := lower(NEW.email); RETURN NEW; ... BEFORE INSERT OR UPDATE ON readers FOR EACH ROW",
			],
			explanation:
				"Every write passes through the trigger, so even an update that never mentions the email cleans Garrick's address.\n\n**Pitfall:** an AFTER trigger can assign `NEW.email` but the row is already stored: nothing changes. And a CHECK (`email = lower(email)`) would only reject bad rows: often that is the better rule, since it stays visible.",
		},
		{
			id: "ch42-ex02",
			title: "The trigger that ate the loans",
			story:
				"Morgana installed a ward on `loans`: readers may not borrow scrolls above their clearance. Since then, **every** loan disappears without an error.",
			prompt:
				"The trigger function `check_clearance()` ends with `RETURN NULL`. Fix it (`CREATE OR REPLACE FUNCTION`) so that allowed loans are stored and forbidden ones still raise an exception. The check inserts one allowed and one forbidden loan.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["triggers"],
			setupSql: `${HELPERS}\n${CLEARANCE_TRIGGER("NULL")}\nCREATE TRIGGER loans_check_clearance BEFORE INSERT ON loans\n  FOR EACH ROW EXECUTE FUNCTION check_clearance();`,
			starterSql: CLEARANCE_TRIGGER("NULL"),
			solutionSql: CLEARANCE_TRIGGER("NEW"),
			check: {
				type: "state",
				verifySql: `${NEW_LOAN(12, 3)};\nSELECT (SELECT count(*) FROM loans) AS loans,\n       sqlstate_of($s$${NEW_LOAN(7, 3)}$s$) AS forbidden_loan;`,
			},
			hints: [
				"What does a BEFORE row trigger's return value mean?",
				"Returning NULL tells Postgres to skip the row, without any error. Return the row to keep it.",
				"Replace `RETURN NULL;` with `RETURN NEW;`",
			],
			explanation:
				"In a BEFORE row trigger, the returned row is the row that gets written; NULL means *skip it*. The INSERT reports success with 0 rows, which is why nobody noticed.\n\n**Pitfall:** dropping the trigger also stores the loan, but Bram (clearance 1) could then borrow *The Pale Ledger*. In AFTER triggers the return value is ignored, so `RETURN NULL` is the usual ending there.",
		},
		{
			id: "ch42-ex03",
			title: "The ledger remembers",
			story:
				"After the vanishing loans, Elowen wants a full history: every insert, change and deletion on `loans`, with the row before and after.",
			prompt:
				"The table `loan_audit (id, op, loan_id, old_row jsonb, new_row jsonb, changed_by, changed_at)` exists (the last two have defaults). Create an **AFTER INSERT OR UPDATE OR DELETE** row trigger on `loans` that inserts `TG_OP`, the loan id, `to_jsonb(OLD)` and `to_jsonb(NEW)`. Then record Garrick's return: set `returned_at` of loan **9** to `'2026-10-31 12:00+00'`. The check also deletes and inserts a loan.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["audit-history", "triggers"],
			setupSql:
				"CREATE TABLE loan_audit (\n  id          bigint GENERATED ALWAYS AS IDENTITY,\n  op          text NOT NULL,\n  loan_id     int NOT NULL,\n  old_row     jsonb,\n  new_row     jsonb,\n  changed_by  text NOT NULL DEFAULT current_user,\n  changed_at  timestamptz NOT NULL DEFAULT now()\n);",
			solutionSql:
				"CREATE FUNCTION audit_loans() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n  INSERT INTO loan_audit (op, loan_id, old_row, new_row)\n  VALUES (TG_OP, coalesce(NEW.id, OLD.id), to_jsonb(OLD), to_jsonb(NEW));\n  RETURN NULL;\nEND $$;\n\nCREATE TRIGGER loans_audit\n  AFTER INSERT OR UPDATE OR DELETE ON loans\n  FOR EACH ROW EXECUTE FUNCTION audit_loans();\n\nUPDATE loans SET returned_at = '2026-10-31 12:00+00' WHERE id = 9;",
			check: {
				type: "state",
				verifySql: `DELETE FROM loans WHERE id = 21;\n${NEW_LOAN(12, 3)};\nSELECT op, loan_id, old_row->>'returned_at' AS returned_before, new_row->>'returned_at' AS returned_after,\n       old_row->>'reader_id' AS old_reader, new_row->>'reader_id' AS new_reader, changed_by\nFROM loan_audit ORDER BY id;`,
			},
			hints: [
				"One function for the three operations: `TG_OP` tells which one fired.",
				"`OLD` is NULL on INSERT and `NEW` is NULL on DELETE, so `coalesce(NEW.id, OLD.id)` always finds the id and `to_jsonb(NULL)` stays NULL.",
				"INSERT INTO loan_audit (op, loan_id, old_row, new_row) VALUES (TG_OP, coalesce(NEW.id, OLD.id), to_jsonb(OLD), to_jsonb(NEW)); RETURN NULL;",
			],
			explanation:
				"Whole rows as jsonb make the history self-describing: you can replay any change, and a new column in `loans` needs no audit change. The defaults capture who and when.\n\n**Pitfall:** auditing only UPDATE misses the deleted loan 21, and storing only `NEW` loses what the value was before. **Alternative:** `RETURNING old.*, new.*` (PostgreSQL 18) shows both sides for one statement, but only a trigger catches every writer.",
		},
		{
			id: "ch42-ex04",
			title: "The returns bell",
			story:
				"The restorers want to know the moment a long-overdue scroll comes home, so they can check it for damage. A worker listens on channel `returns`, and reads the `outbox` table when it wakes up.",
			prompt:
				"The table `outbox (id, channel, payload)` exists. Create an **AFTER UPDATE** row trigger on `loans` that, when `returned_at` goes from **NULL to a value**, calls `pg_notify('returns', <loan id as text>)` **and** inserts the same channel and payload into `outbox`. Then return loans **13** and **16** (`returned_at = '2026-10-31 12:00+00'`). The check also makes updates that must not ring.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["listen-notify", "triggers"],
			setupSql:
				"CREATE TABLE outbox (\n  id       bigint GENERATED ALWAYS AS IDENTITY,\n  channel  text NOT NULL,\n  payload  text NOT NULL\n);",
			solutionSql:
				"CREATE FUNCTION announce_return() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n  IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN\n    PERFORM pg_notify('returns', NEW.id::text);\n    INSERT INTO outbox (channel, payload) VALUES ('returns', NEW.id::text);\n  END IF;\n  RETURN NULL;\nEND $$;\n\nCREATE TRIGGER loans_announce_return\n  AFTER UPDATE ON loans\n  FOR EACH ROW EXECUTE FUNCTION announce_return();\n\nUPDATE loans SET returned_at = '2026-10-31 12:00+00' WHERE id IN (13, 16);",
			check: {
				type: "state",
				verifySql:
					"UPDATE loans SET returned_at = returned_at + interval '1 hour' WHERE id = 1;\nUPDATE loans SET reader_id = reader_id WHERE id = 19;\nSELECT channel, payload FROM outbox ORDER BY payload;",
			},
			hints: [
				"Compare `OLD.returned_at` and `NEW.returned_at` inside the function (or in a `WHEN (...)` clause on the trigger).",
				"`pg_notify` returns void: call it with `PERFORM` in PL/pgSQL.",
				"IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN PERFORM pg_notify('returns', NEW.id::text); INSERT INTO outbox ...; END IF;",
			],
			explanation:
				"The notification and the outbox row are part of the same transaction: both appear at COMMIT, or neither does. Fixing the date of loan 1 or touching loan 19 rings nothing.\n\n**Pitfall:** notifying on every update floods the restorers; expecting the listener to hear the bell before COMMIT is the classic misunderstanding. Payloads must stay under 8000 bytes: send an id, not the scroll.",
		},
		{
			id: "ch42-ex05",
			title: "Keys to the right doors",
			story:
				"The archivists must be able to purge cancelled loans. Meanwhile, the apprentices have been gossiping about who cites whom; Morgana wants citations closed to them.",
			prompt:
				"Give `archivist` the **DELETE** privilege on `loans`, and remove **SELECT** on `citations` from `apprentice_reader`. Grant nothing else.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["roles-privileges"],
			setupSql: HELPERS,
			solutionSql:
				"GRANT DELETE ON loans TO archivist;\nREVOKE SELECT ON citations FROM apprentice_reader;",
			check: {
				type: "state",
				verifySql:
					"SELECT has_table_privilege('archivist', 'loans', 'DELETE') AS archivist_delete,\n       has_table_privilege('archivist', 'loans', 'TRUNCATE') AS archivist_truncate,\n       has_table_privilege('apprentice_reader', 'citations', 'SELECT') AS apprentice_citations,\n       has_table_privilege('apprentice_reader', 'scrolls', 'SELECT') AS apprentice_scrolls,\n       seen_as('apprentice_reader', 'citations') AS apprentice_reads_citations;",
			},
			hints: [
				"One GRANT and one REVOKE.",
				"`GRANT privilege ON table TO role;` and `REVOKE privilege ON table FROM role;`",
				"GRANT DELETE ON loans TO archivist; REVOKE SELECT ON citations FROM apprentice_reader;",
			],
			explanation:
				"Privileges are per table and per action. Now an apprentice reading citations gets 42501 *permission denied*, while scrolls stay open.\n\n**Pitfall:** `GRANT ALL` would also hand over TRUNCATE, REFERENCES and TRIGGER. In a real server, also check schema `USAGE` and sequence privileges, or inserts fail on the identity column.",
		},
		{
			id: "ch42-ex06",
			title: "Veils on the forbidden shelves",
			story:
				"Apprentices may enter the scroll hall, but only public scrolls (clearance 1) should exist for them. Archivists see everything.",
			prompt:
				"Enable **row-level security** on `scrolls` and create policies so that `apprentice_reader` sees only scrolls with `clearance_level = 1`, and `archivist` sees **all** scrolls. The check counts the rows each role can see.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["row-level-security"],
			setupSql: HELPERS,
			solutionSql:
				"ALTER TABLE scrolls ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY apprentice_public ON scrolls\n  FOR SELECT TO apprentice_reader\n  USING (clearance_level = 1);\n\nCREATE POLICY archivist_all ON scrolls\n  FOR ALL TO archivist\n  USING (true);",
			check: {
				type: "state",
				verifySql:
					"SELECT seen_as('apprentice_reader', 'scrolls') AS apprentice,\n       seen_as('archivist', 'scrolls') AS archivist,\n       (SELECT count(*) FROM scrolls) AS superuser;",
			},
			hints: [
				"First `ALTER TABLE scrolls ENABLE ROW LEVEL SECURITY;`. Once enabled, a role with no policy sees nothing.",
				"One policy per role: `CREATE POLICY name ON scrolls FOR SELECT TO role USING (condition);`",
				"... TO apprentice_reader USING (clearance_level = 1); CREATE POLICY ... TO archivist USING (true);",
			],
			explanation:
				"The database itself now filters: 20 scrolls for apprentices, 30 for archivists, whatever query they write. You, the superuser, still see 30.\n\n**Pitfall:** policies without `ENABLE ROW LEVEL SECURITY` do nothing (apprentices see 30); enabling RLS with only the apprentice policy blinds the archivists (0 rows). `FOR ALL` also lets the archivist's UPDATEs through, still limited by its table privileges.",
		},
		{
			id: "ch42-ex07",
			title: "The import that crashed",
			story:
				"The reader import from the Saltmarsh branch crashed halfway last night: Rowan Ashby was inserted, then everything stopped. The staging table `reader_import (email, name, clearance)` still holds all four rows. Two are existing readers whose email is typed in another case.",
			prompt:
				"Load `reader_import` into `readers` so the import is **idempotent** (running it again changes nothing):\n\n- a row whose email already exists (case-insensitive, `email` is citext) **updates name and clearance** only;\n- a new email inserts a reader with `password_hash = crypt('changeme', gen_salt('bf', 4))` and `joined_at = '2026-10-31 09:00+00'`.",
			difficulty: 4,
			kind: "mutation",
			concepts: ["upsert-patterns"],
			setupSql:
				"CREATE TABLE reader_import (email citext, name text, clearance int);\nINSERT INTO reader_import VALUES\n  ('garrick.holt@aethel.lib', 'Garrick Holt', 2),\n  ('WENDY@aethel.lib', 'Wendeline Moss-Fairweather', 1),\n  ('rowan@aethel.lib', 'Rowan Ashby', 2),\n  ('pell@aethel.lib', 'Pell Ironwood', 1);\nINSERT INTO readers (name, email, password_hash, clearance, joined_at)\nVALUES ('Rowan Ashby', 'rowan@aethel.lib', crypt('changeme', gen_salt('bf', 4)), 1, '2026-10-30 22:00+00');",
			solutionSql:
				"INSERT INTO readers (name, email, password_hash, clearance, joined_at)\nSELECT name, email, crypt('changeme', gen_salt('bf', 4)), clearance, '2026-10-31 09:00+00'\nFROM reader_import\nON CONFLICT (email) DO UPDATE\n  SET name = EXCLUDED.name,\n      clearance = EXCLUDED.clearance;",
			check: {
				type: "state",
				verifySql:
					"SELECT email::text, name, clearance, joined_at,\n       password_hash = crypt('changeme', password_hash) AS default_password\nFROM readers\nWHERE id IN (5, 7) OR id > 13\nORDER BY lower(email::text);",
			},
			hints: [
				"A plain INSERT stops on Rowan with 23505: the previous run already inserted him.",
				"`ON CONFLICT (email) DO UPDATE SET ...` turns the conflict into an update. citext makes `WENDY@...` and `wendy@...` the same key.",
				"... ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, clearance = EXCLUDED.clearance;",
			],
			explanation:
				"Every import row becomes either an insert or an update, so running the statement once, twice or after a crash gives the same table. Passwords and join dates of existing readers are untouched.\n\n**Pitfall:** `ON CONFLICT DO NOTHING` survives the rerun but never applies the corrections (Garrick stays at clearance 1); updating `password_hash` too would reset Garrick's password to *changeme*. **Alternative:** `MERGE INTO readers USING reader_import ...` with WHEN MATCHED / WHEN NOT MATCHED.",
		},
		{
			id: "ch42-ex08",
			title: "Boss: The Astral Wards",
			story:
				"The Spire's final trial. The scriptorium of the Saltmarsh branch sends batches of scrolls in `scroll_import`, sometimes twice. Elowen wants the hall warded before the next batch arrives: no duplicate titles, a memory of every real change, veils for the apprentices, and an import that can run twice.",
			prompt:
				"The tables `scroll_audit (id, scroll_id, changed jsonb)` and `scroll_import (title, section_id, author, language, body, page_count, clearance_level)` exist. In one script:\n\n1. make `scrolls.title` **unique**;\n2. create an **AFTER UPDATE** row trigger on `scrolls` that inserts `(scroll id, changed)` into `scroll_audit`, where `changed` is a jsonb object of **only the columns whose value changed**, with their **new** values; an update that changes nothing writes **no** row;\n3. enable **RLS** on `scrolls`: `apprentice_reader` sees clearance 1 scrolls only, `archivist` sees all;\n4. upsert `scroll_import` into `scrolls` on **title** (existing titles get the imported **author** and **page_count**; new titles are inserted), and **run that upsert twice**.\n\nThe check also updates a scroll itself, counts rows per role and tries a duplicate title.",
			difficulty: 5,
			kind: "ddl",
			concepts: [
				"triggers",
				"audit-history",
				"row-level-security",
				"upsert-patterns",
			],
			setupSql: BOSS_SETUP,
			solutionSql: `ALTER TABLE scrolls ADD CONSTRAINT scrolls_title_key UNIQUE (title);

CREATE FUNCTION audit_scroll() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE diff jsonb;
BEGIN
  SELECT jsonb_object_agg(n.key, n.value) INTO diff
  FROM jsonb_each(to_jsonb(NEW)) AS n
  JOIN jsonb_each(to_jsonb(OLD)) AS o ON o.key = n.key
  WHERE n.value IS DISTINCT FROM o.value;
  IF diff IS NOT NULL THEN
    INSERT INTO scroll_audit (scroll_id, changed) VALUES (NEW.id, diff);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER scrolls_audit AFTER UPDATE ON scrolls
  FOR EACH ROW EXECUTE FUNCTION audit_scroll();

ALTER TABLE scrolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY apprentice_public ON scrolls FOR SELECT TO apprentice_reader USING (clearance_level = 1);
CREATE POLICY archivist_all ON scrolls FOR ALL TO archivist USING (true);

${BOSS_UPSERT}
${BOSS_UPSERT}`,
			check: {
				type: "state",
				verifySql:
					"UPDATE scrolls SET page_count = page_count + 1 WHERE id = 9;\nSELECT 'audit' AS kind, scroll_id::text AS what, changed::text AS detail FROM scroll_audit\nUNION ALL SELECT 'seen', 'apprentice_reader', seen_as('apprentice_reader', 'scrolls')\nUNION ALL SELECT 'seen', 'archivist', seen_as('archivist', 'scrolls')\nUNION ALL SELECT 'scroll', title, coalesce(author, '?') || ' / ' || page_count FROM scrolls WHERE title IN ('Burned Pages', 'Frost and Silence', 'The Mouser''s Ledger')\nUNION ALL SELECT 'duplicate', 'Burned Pages', sqlstate_of($s$INSERT INTO scrolls (section_id, title, language, body, page_count, clearance_level) VALUES (2, 'Burned Pages', 'en', 'copy', 1, 1)$s$);",
			},
			hints: [
				"Work in order: UNIQUE constraint, trigger, RLS, then the upsert (ON CONFLICT needs the unique constraint). Paste the upsert twice at the end.",
				"For the diff, join `jsonb_each(to_jsonb(NEW))` with `jsonb_each(to_jsonb(OLD))` on the key, keep keys whose values are `IS DISTINCT FROM`, and `jsonb_object_agg` them. Skip the insert when the result is NULL.",
				"INSERT INTO scrolls (...) SELECT ... FROM scroll_import ON CONFLICT (title) DO UPDATE SET author = EXCLUDED.author, page_count = EXCLUDED.page_count;",
			],
			explanation:
				"The first import fills in the anonymous author of *Burned Pages* (audit: `{\"author\": \"Hakon Bly\", \"page_count\": 4}`) and adds Mittens's ledger; *Frost and Silence* arrives unchanged and leaves no trace. The second run updates rows to the values they already have, so the diff is empty and the audit stays quiet: the whole pipeline is idempotent. Apprentices now see 21 scrolls, archivists 31, and a duplicate title fails with 23505.\n\n**Pitfall:** auditing `to_jsonb(NEW)` blindly logs every no-op update of the second run; a plain INSERT fails on the rerun. **Alternative:** add `WHERE (scrolls.author, scrolls.page_count) IS DISTINCT FROM (EXCLUDED.author, EXCLUDED.page_count)` to the DO UPDATE so no-op updates never even happen.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch42-pr01",
			title: "Once per statement",
			prompt:
				"The table `delete_stats (statements int)` holds one row with 0. Create a **statement-level** AFTER DELETE trigger on `loans` that adds 1 to `statements` each time a DELETE statement runs, however many rows it removes. The check runs a 3-row delete and a delete that matches nothing.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["triggers"],
			setupSql: "CREATE TABLE delete_stats (statements int NOT NULL);\nINSERT INTO delete_stats VALUES (0);",
			solutionSql:
				"CREATE FUNCTION count_delete() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n  UPDATE delete_stats SET statements = statements + 1;\n  RETURN NULL;\nEND $$;\n\nCREATE TRIGGER loans_count_delete AFTER DELETE ON loans\n  FOR EACH STATEMENT EXECUTE FUNCTION count_delete();",
			check: {
				type: "state",
				verifySql:
					"DELETE FROM loans WHERE id IN (19, 20, 21);\nDELETE FROM loans WHERE id = 999;\nSELECT statements FROM delete_stats;",
			},
			hints: [
				"`FOR EACH STATEMENT` instead of `FOR EACH ROW`.",
				"A statement trigger has no NEW or OLD; just update the counter.",
				"CREATE TRIGGER ... AFTER DELETE ON loans FOR EACH STATEMENT EXECUTE FUNCTION count_delete();",
			],
			explanation:
				"2: one per statement, and it fires even when the DELETE removes nothing. A row trigger would have counted 3.",
		},
		{
			id: "ch42-pr02",
			title: "Only real promotions",
			prompt:
				"The table `clearance_log (reader_id, old_clearance, new_clearance)` exists. Create an AFTER UPDATE row trigger on `readers` that logs a row **only when the clearance actually changes**, using a `WHEN` clause on the trigger.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["triggers"],
			setupSql: "CREATE TABLE clearance_log (reader_id int, old_clearance int, new_clearance int);",
			solutionSql:
				"CREATE FUNCTION log_clearance() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n  INSERT INTO clearance_log VALUES (NEW.id, OLD.clearance, NEW.clearance);\n  RETURN NULL;\nEND $$;\n\nCREATE TRIGGER readers_log_clearance AFTER UPDATE ON readers\n  FOR EACH ROW\n  WHEN (OLD.clearance IS DISTINCT FROM NEW.clearance)\n  EXECUTE FUNCTION log_clearance();",
			check: {
				type: "state",
				verifySql:
					"UPDATE readers SET clearance = clearance WHERE id = 1;\nUPDATE readers SET clearance = 3 WHERE id = 2;\nUPDATE readers SET name = 'Bram T.' WHERE id = 3;\nSELECT reader_id, old_clearance, new_clearance FROM clearance_log ORDER BY reader_id;",
			},
			hints: [
				"The WHEN clause goes between `FOR EACH ROW` and `EXECUTE FUNCTION`.",
				"`SET clearance = clearance` is an update of the column that changes nothing.",
				"WHEN (OLD.clearance IS DISTINCT FROM NEW.clearance)",
			],
			explanation:
				"Only Isolde's promotion is logged. `AFTER UPDATE OF clearance` alone would also fire for `SET clearance = clearance`, because it only checks which columns the statement mentions.",
		},
		{
			id: "ch42-pr03",
			title: "Reading the history",
			prompt:
				"The table `loan_audit (id, old_row jsonb, new_row jsonb)` holds two updates. For every audit row, return the **id**, the **key** that changed, its **old** value and its **new** value (as text), only for keys whose value differs.",
			difficulty: 3,
			kind: "query",
			concepts: ["audit-history"],
			setupSql:
				"CREATE TABLE loan_audit (id int, old_row jsonb, new_row jsonb);\nINSERT INTO loan_audit VALUES\n  (1, '{\"id\": 9, \"scroll_id\": 10, \"reader_id\": 5, \"returned_at\": null}',\n      '{\"id\": 9, \"scroll_id\": 10, \"reader_id\": 5, \"returned_at\": \"2026-10-31T12:00:00+00:00\"}'),\n  (2, '{\"id\": 2, \"scroll_id\": 2, \"reader_id\": 3, \"returned_at\": \"2026-02-03T11:00:00+00:00\"}',\n      '{\"id\": 2, \"scroll_id\": 2, \"reader_id\": 4, \"returned_at\": \"2026-02-03T11:00:00+00:00\"}');",
			solutionSql:
				"SELECT a.id, n.key, o.value AS old_value, n.value AS new_value\nFROM loan_audit a\nCROSS JOIN LATERAL jsonb_each_text(a.new_row) AS n\nJOIN LATERAL jsonb_each_text(a.old_row) AS o ON o.key = n.key\nWHERE n.value IS DISTINCT FROM o.value;",
			check: { type: "result" },
			hints: [
				"`jsonb_each_text(doc)` turns a document into (key, value) rows.",
				"Expand old and new, join them on the key, keep differences. JSON null becomes SQL NULL: compare with IS DISTINCT FROM.",
				"... jsonb_each_text(a.new_row) n JOIN LATERAL jsonb_each_text(a.old_row) o ON o.key = n.key WHERE n.value IS DISTINCT FROM o.value",
			],
			explanation:
				"Loan 9 got a return date, loan 2 changed reader. With `<>` the first row would vanish: `NULL <> '2026-...'` is unknown.",
		},
		{
			id: "ch42-pr04",
			title: "Ring and remember",
			prompt:
				"The table `outbox (id, channel, payload)` exists. Create a function `announce(ch text, msg text) RETURNS void` that calls `pg_notify(ch, msg)` and inserts `(ch, msg)` into `outbox`. Then announce `'loan 9'` on channel `'overdue'`.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["listen-notify"],
			setupSql:
				"CREATE TABLE outbox (id bigint GENERATED ALWAYS AS IDENTITY, channel text NOT NULL, payload text NOT NULL);",
			solutionSql:
				"CREATE FUNCTION announce(ch text, msg text) RETURNS void LANGUAGE plpgsql AS $$\nBEGIN\n  PERFORM pg_notify(ch, msg);\n  INSERT INTO outbox (channel, payload) VALUES (ch, msg);\nEND $$;\n\nSELECT announce('overdue', 'loan 9');",
			check: {
				type: "state",
				verifySql:
					"SELECT announce('overdue', 'loan 13');\nSELECT channel, payload FROM outbox ORDER BY id;",
			},
			hints: [
				"`pg_notify` returns nothing: use `PERFORM` in PL/pgSQL.",
				"Insert into outbox in the same function so both happen in one transaction.",
				"PERFORM pg_notify(ch, msg); INSERT INTO outbox (channel, payload) VALUES (ch, msg);",
			],
			explanation:
				"Listeners get the bell at COMMIT; the outbox keeps the message for anyone who was asleep.",
		},
		{
			id: "ch42-pr05",
			title: "Predict the keys",
			prompt:
				"Return **one row** with `has_table_privilege('apprentice_reader', 'loans', 'SELECT')` and `has_table_privilege('archivist', 'loans', 'UPDATE')`.",
			difficulty: 1,
			kind: "query",
			concepts: ["roles-privileges"],
			solutionSql:
				"SELECT has_table_privilege('apprentice_reader', 'loans', 'SELECT'), has_table_privilege('archivist', 'loans', 'UPDATE');",
			check: { type: "result" },
			hints: [
				"Just run them.",
				"The dataset grants apprentices only sections, scrolls and citations.",
				"SELECT has_table_privilege('apprentice_reader', 'loans', 'SELECT'), has_table_privilege('archivist', 'loans', 'UPDATE');",
			],
			explanation: "false, true: apprentices cannot read the loans ledger; archivists can update it.",
		},
		{
			id: "ch42-pr06",
			title: "Veil the high-clearance readers",
			prompt:
				"Enable row-level security on `readers` and create a policy so that `archivist` sees only readers with `clearance <= 2`.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["row-level-security"],
			setupSql: HELPERS,
			solutionSql:
				"ALTER TABLE readers ENABLE ROW LEVEL SECURITY;\nCREATE POLICY archivist_low ON readers FOR SELECT TO archivist USING (clearance <= 2);",
			check: {
				type: "state",
				verifySql: "SELECT seen_as('archivist', 'readers') AS archivist, (SELECT count(*) FROM readers) AS superuser;",
			},
			hints: [
				"Two statements: enable RLS, then a policy.",
				"`CREATE POLICY name ON readers FOR SELECT TO archivist USING (...)`.",
				"USING (clearance <= 2)",
			],
			explanation: "The archivist sees 11 readers; Céleste and Mireille (clearance 3) are veiled. The superuser still sees 13.",
		},
		{
			id: "ch42-pr07",
			title: "No promotions to forbidden",
			prompt:
				"Enable row-level security on `scrolls`. Let `archivist` **read** every scroll, and **update** scrolls only if the updated row keeps `clearance_level < 3` (use `WITH CHECK`).",
			difficulty: 3,
			kind: "ddl",
			concepts: ["row-level-security"],
			setupSql: HELPERS,
			solutionSql:
				"ALTER TABLE scrolls ENABLE ROW LEVEL SECURITY;\nCREATE POLICY archivist_read ON scrolls FOR SELECT TO archivist USING (true);\nCREATE POLICY archivist_update ON scrolls FOR UPDATE TO archivist\n  USING (true) WITH CHECK (clearance_level < 3);",
			check: {
				type: "state",
				verifySql:
					"SELECT seen_as('archivist', 'scrolls') AS seen,\n       try_as('archivist', 'UPDATE scrolls SET page_count = 13 WHERE id = 1') AS harmless_update,\n       try_as('archivist', 'UPDATE scrolls SET clearance_level = 3 WHERE id = 1') AS promotion;",
			},
			hints: [
				"Reading needs a SELECT policy; writing needs an UPDATE policy.",
				"`USING` chooses which rows may be updated, `WITH CHECK` validates the new version of the row.",
				"CREATE POLICY ... FOR UPDATE TO archivist USING (true) WITH CHECK (clearance_level < 3);",
			],
			explanation:
				"The promotion fails with 42501 (new row violates row-level security policy). Without WITH CHECK, Postgres checks new rows against USING, so `USING (true)` alone would let the archivist push any scroll onto the forbidden shelves.",
		},
		{
			id: "ch42-pr08",
			title: "The visitor counter",
			prompt:
				"The table `visit_counts (reader_id int PRIMARY KEY, visits int NOT NULL)` is empty. Write **one** upsert that adds a visit for a reader (insert 1, or add 1 if the reader is already counted), and run it for readers **4, 4, 4** and **1** (four statements).",
			difficulty: 2,
			kind: "mutation",
			concepts: ["upsert-patterns"],
			setupSql: "CREATE TABLE visit_counts (reader_id int PRIMARY KEY, visits int NOT NULL);",
			solutionSql:
				"INSERT INTO visit_counts VALUES (4, 1) ON CONFLICT (reader_id) DO UPDATE SET visits = visit_counts.visits + 1;\nINSERT INTO visit_counts VALUES (4, 1) ON CONFLICT (reader_id) DO UPDATE SET visits = visit_counts.visits + 1;\nINSERT INTO visit_counts VALUES (4, 1) ON CONFLICT (reader_id) DO UPDATE SET visits = visit_counts.visits + 1;\nINSERT INTO visit_counts VALUES (1, 1) ON CONFLICT (reader_id) DO UPDATE SET visits = visit_counts.visits + 1;",
			check: {
				type: "state",
				verifySql: "SELECT reader_id, visits FROM visit_counts ORDER BY reader_id;",
			},
			hints: [
				"The first visit inserts, the next ones collide on the primary key.",
				"In DO UPDATE, `visit_counts.visits` is the stored value.",
				"INSERT INTO visit_counts VALUES (4, 1) ON CONFLICT (reader_id) DO UPDATE SET visits = visit_counts.visits + 1;",
			],
			explanation:
				"The increment happens inside one statement under a row lock, so two readers arriving together never lose a visit, unlike `SELECT visits` then `UPDATE`.",
		},
		{
			id: "ch42-pr09",
			title: "A rule in plain sight",
			story:
				"An old trigger `scrolls_positive_pages` rejects scrolls with zero pages. Nobody reading the schema can see the rule.",
			prompt:
				"Replace the trigger with a **CHECK constraint**: drop the trigger `scrolls_positive_pages` on `scrolls`, then add a constraint that requires `page_count > 0`.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["stored-logic-guidelines"],
			setupSql: `${HELPERS}\nCREATE FUNCTION positive_pages() RETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN\n  IF NEW.page_count <= 0 THEN RAISE EXCEPTION 'a scroll needs pages'; END IF;\n  RETURN NEW;\nEND $$;\nCREATE TRIGGER scrolls_positive_pages BEFORE INSERT OR UPDATE ON scrolls\n  FOR EACH ROW EXECUTE FUNCTION positive_pages();`,
			solutionSql:
				"DROP TRIGGER scrolls_positive_pages ON scrolls;\nALTER TABLE scrolls ADD CONSTRAINT scrolls_page_count_positive CHECK (page_count > 0);",
			check: {
				type: "state",
				verifySql:
					"SELECT (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'scrolls'::regclass AND NOT tgisinternal) AS triggers,\n       sqlstate_of('UPDATE scrolls SET page_count = 0 WHERE id = 1') AS zero_pages;",
			},
			hints: [
				"`DROP TRIGGER name ON table;`",
				"`ALTER TABLE ... ADD CONSTRAINT name CHECK (...)`.",
				"DROP TRIGGER scrolls_positive_pages ON scrolls; ALTER TABLE scrolls ADD CONSTRAINT ... CHECK (page_count > 0);",
			],
			explanation:
				"The rule is now declarative: visible in the schema, checked for existing rows when added, enforced with SQLSTATE 23514, and impossible to bypass by disabling triggers.",
		},
	],
};

export default chapter;
