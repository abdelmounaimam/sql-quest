import type { Chapter } from "../types";

/** Hidden helper: runs a statement and returns 'ok' or the SQLSTATE it raised. */
const SQLSTATE_HELPER = `CREATE FUNCTION sqlstate_of(q text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE q;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $f$;`;

/** The cursed search function of ex07 / ex08, built by concatenation. */
const UNSAFE_FINDER = `CREATE TABLE search_log (input text, rows_returned int);
CREATE FUNCTION find_reader_unsafe(p_name text) RETURNS TABLE (name text, clearance int)
LANGUAGE plpgsql AS $f$
DECLARE n int;
BEGIN
  RETURN QUERY EXECUTE 'SELECT name, clearance FROM readers WHERE name = ''' || p_name || '''';
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO search_log VALUES (p_name, n);
END $f$;`;

const FINE_FOR = `CREATE FUNCTION fine_for(p_loan int, as_of date) RETURNS numeric
LANGUAGE plpgsql STABLE AS $$
DECLARE
  due date;
  back date;
  late int;
BEGIN
  SELECT upper(loan_period)::date, coalesce(returned_at::date, as_of)
    INTO due, back
    FROM loans WHERE id = p_loan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown loan %', p_loan;
  END IF;
  late := greatest(back - due, 0);
  RETURN least(late * 0.50, 20.00);
END $$;`;

const chapter: Chapter = {
	id: "ch41-spellcrafting",
	order: 41,
	world: "The Astral Spire",
	tier: "expert",
	track: "advanced",
	title: "Spellcrafting",
	subtitle: "SQL functions, PL/pgSQL, procedures, dynamic SQL and the injection curse",
	emoji: "🧙",
	datasetId: "library",
	concepts: [
		"sql-functions",
		"plpgsql-basics",
		"procedures",
		"dynamic-sql",
		"sql-injection",
	],
	prerequisites: ["ch40-undead-rows-and-big-tables"],
	lesson: [
		{
			kind: "explain",
			title: "A query with a name",
			body: "High in the Astral Spire, the archivists store spells inside the database itself. The simplest spell is a **SQL function**: a query with parameters.\n```sql\nCREATE FUNCTION loans_of(r int) RETURNS bigint\nLANGUAGE sql STABLE\nAS $$ SELECT count(*) FROM loans WHERE reader_id = r $$;\n```\nIt can return one value, `SETOF scrolls` (rows of a table) or `TABLE(col type, ...)`. The label tells the planner how it behaves: **IMMUTABLE** (same input, same output forever), **STABLE** (constant within one query, may read tables), **VOLATILE** (anything goes, the default).",
		},
		{
			kind: "example",
			title: "A function that returns rows",
			body: "A `SETOF` function is used like a table in FROM. `$$` quotes the body so you do not have to double every apostrophe.",
			sql: "CREATE FUNCTION scrolls_by(author_name text) RETURNS SETOF scrolls\nLANGUAGE sql STABLE\nAS $$ SELECT * FROM scrolls WHERE author = author_name $$;\n\nSELECT title, page_count FROM scrolls_by('Elowen Thrice');",
		},
		{
			kind: "quiz",
			question:
				"A function computes how many days a loan is late using `now()`. Which volatility label is honest?",
			choices: [
				"IMMUTABLE, because it is faster",
				"STABLE",
				"No label: labels are only comments",
				"IMMUTABLE, because the formula never changes",
			],
			answerIndex: 1,
			explanation:
				"`now()` is constant within a transaction but changes between them, and the function reads a table: that is STABLE. IMMUTABLE is a promise the planner trusts: it may precompute the result once, store it in an index, and serve yesterday's answer forever.",
		},
		{
			kind: "explain",
			title: "PL/pgSQL: spells with steps",
			body: "When one query is not enough, use **PL/pgSQL**:\n```sql\nCREATE FUNCTION late_label(days int) RETURNS text\nLANGUAGE plpgsql IMMUTABLE AS $$\nDECLARE label text;\nBEGIN\n  IF days < 0 THEN\n    RAISE EXCEPTION 'negative days: %', days;\n  END IF;\n  label := CASE WHEN days = 0 THEN 'on time' ELSE 'late' END;\n  RETURN label;\nEND $$;\n```\n`RAISE EXCEPTION` aborts with SQLSTATE P0001. `DO $$ ... $$` runs a nameless block once. Prefer one set-based query over a loop whenever you can.",
		},
		{
			kind: "explain",
			title: "Procedures hold the transaction",
			body: "A function runs inside the caller's transaction. A **procedure** may end it:\n```sql\nCREATE PROCEDURE nightly() LANGUAGE plpgsql AS $$\nBEGIN\n  INSERT INTO ...;  COMMIT;   -- saved for good\n  UPDATE ...;       ROLLBACK; -- undone\nEND $$;\nCALL nightly();\n```\nYou run it with `CALL`, never inside a SELECT (error 42809). COMMIT inside works only when CALL is sent as its own statement; this app sends each statement separately, so it works here.",
		},
		{
			kind: "explain",
			title: "The injection curse",
			body: "Some spells build SQL text from user input:\n```sql\n'SELECT ... WHERE name = ''' || p_name || ''''\n```\nIf a visitor types `nobody' OR '1'='1`, the text becomes\n```sql\nWHERE name = 'nobody' OR '1'='1'\n```\nThe input escaped its quotes and rewrote the query. This is **SQL injection**, the oldest curse of the web.",
		},
		{
			kind: "example",
			title: "Watch the curse work",
			body: "A cursed search function, then a visitor with a crafted name. Run it: instead of nobody, the whole register spills out.",
			sql: "CREATE FUNCTION find_reader_unsafe(p_name text) RETURNS TABLE (name text, clearance int)\nLANGUAGE plpgsql AS $$\nBEGIN\n  RETURN QUERY EXECUTE\n    'SELECT name, clearance FROM readers WHERE name = ''' || p_name || '''';\nEND $$;\n\nSELECT * FROM find_reader_unsafe($q$nobody' OR '1'='1$q$);",
		},
		{
			kind: "explain",
			title: "Dynamic SQL, safely",
			body: "Sometimes the table or column really is chosen at runtime. Build the text with `format`:\n```sql\nEXECUTE format('SELECT count(*) FROM %I WHERE %I = %L',\n               tbl, col, val)\n   INTO result;\n```\n- `%I` quotes an **identifier** (`\"Night Watch\"`);\n- `%L` quotes a **literal** (`'O''Brien'`);\n- or pass values as parameters: `EXECUTE '... WHERE id = $1' USING some_id`.\n\nOutside PL/pgSQL, `PREPARE` and `EXECUTE` do the same with `$1`.",
		},
		{
			kind: "quiz",
			question:
				"Inside a function, the **table name** comes from a parameter `tbl`. Which `format` placeholder do you use?",
			choices: ["`%s`", "`%L`", "`%I`", "`$1` with USING"],
			answerIndex: 2,
			explanation:
				"`%I` quotes identifiers, so `Night Watch` becomes `\"Night Watch\"` and an attack string becomes a harmless (missing) table name. `%s` pastes raw text (injectable), `%L` makes a string literal, which is not a table, and `$1` parameters can only carry values, never names.",
		},
		{
			kind: "try",
			title: "Your turn: count by language",
			prompt:
				"The function `scroll_count(lang text)` ignores its parameter. Fix it so it counts the scrolls written in `lang`, then call it for `'fr'`.",
			starterSql:
				"CREATE FUNCTION scroll_count(lang text) RETURNS bigint\nLANGUAGE sql STABLE\nAS $$ SELECT count(*) FROM scrolls $$;\n\nSELECT scroll_count('fr');",
			solutionSql:
				"CREATE FUNCTION scroll_count(lang text) RETURNS bigint\nLANGUAGE sql STABLE\nAS $$ SELECT count(*) FROM scrolls WHERE language = lang $$;\n\nSELECT scroll_count('fr');",
			check: { type: "result" },
			hints: [
				"Run the starter: 30 is every scroll.",
				"Use the parameter in a WHERE clause: `WHERE language = lang`.",
			],
		},
	],
	exercises: [
		{
			id: "ch41-ex01",
			title: "Pages of a lifetime",
			story:
				"Elowen wants a spell that tells how many pages an author has written, for the Wall of Scribes.",
			prompt:
				"Create a function `pages_written(author_name text) RETURNS bigint` that returns the **total page_count** of that author's scrolls, and **0** when the author wrote nothing. The check calls it with several names.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["sql-functions"],
			solutionSql:
				"CREATE FUNCTION pages_written(author_name text) RETURNS bigint\nLANGUAGE sql STABLE\nAS $$ SELECT coalesce(sum(page_count), 0) FROM scrolls WHERE author = author_name $$;\n\nSELECT pages_written('Elowen Thrice'), pages_written('Nobody');",
			check: {
				type: "state",
				verifySql:
					"SELECT pages_written('Elowen Thrice') AS elowen, pages_written('Nobody') AS nobody,\n       pages_written('Morgana Vex') AS morgana, pages_written('Jean-Luc Ombre') AS jean_luc;",
			},
			hints: [
				"The body is one SELECT with `sum(page_count)` filtered on the parameter.",
				"`sum` of zero rows is NULL, not 0.",
				"AS $$ SELECT coalesce(sum(page_count), 0) FROM scrolls WHERE author = author_name $$",
			],
			explanation:
				"A SQL function is a named query: the parameter replaces a literal. Elowen totals 96 pages.\n\n**Pitfall:** without `coalesce`, an unknown author gets NULL, and `NULL > 50` silently drops them from any report built on it. **Alternative:** the SQL standard body `RETURN (SELECT coalesce(sum(page_count), 0) FROM scrolls WHERE author = author_name)`.",
		},
		{
			id: "ch41-ex02",
			title: "A shelf and everything under it",
			story:
				"Ines the Head Cataloguer wants to list a whole branch of the shelves, sub-shelves included.",
			prompt:
				"Create `section_scrolls(p ltree) RETURNS TABLE (title text, path ltree)` that returns the **title** of every scroll whose section is **p or below it**, with the section's **path**. The check calls it for several sections.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["sql-functions"],
			solutionSql:
				"CREATE FUNCTION section_scrolls(p ltree) RETURNS TABLE (title text, path ltree)\nLANGUAGE sql STABLE\nAS $$\n  SELECT s.title, sec.path\n  FROM scrolls s\n  JOIN sections sec ON sec.id = s.section_id\n  WHERE sec.path <@ p\n$$;\n\nSELECT * FROM section_scrolls('arcana.fire');",
			check: {
				type: "state",
				verifySql:
					"SELECT 'arcana.fire' AS asked, title, path::text FROM section_scrolls('arcana.fire')\nUNION ALL\nSELECT 'history', count(*)::text, NULL FROM section_scrolls('history');",
			},
			hints: [
				"Join scrolls to sections to know each scroll's path.",
				"ltree's `<@` means *is a descendant of (or equal to)*.",
				"... JOIN sections sec ON sec.id = s.section_id WHERE sec.path <@ p",
			],
			explanation:
				"`RETURNS TABLE` declares the output columns, and the function can be queried like a table. `arcana.fire` brings the dragon shelf along.\n\n**Pitfall:** `sec.path = p` only returns the shelf itself and loses every sub-shelf. In a PL/pgSQL version, an output column named `title` would also clash with `scrolls.title` (42702): qualify columns with table aliases.",
		},
		{
			id: "ch41-ex03",
			title: "The spell that lied",
			story:
				"An apprentice wrote `days_overdue` and labelled it IMMUTABLE \"for speed\". It reads `now()` and a table: tomorrow it will be wrong, and nobody can test it.",
			prompt:
				"Write `days_overdue(p_loan int, as_of date) RETURNS int`: the number of days between the loan's due date (`upper(loan_period)::date`) and `as_of` for a loan that is **not returned**, **0** when it is returned or not yet late. Do **not** label it IMMUTABLE. The check calls it for several loans on `2026-10-31`.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["sql-functions"],
			starterSql:
				"CREATE FUNCTION days_overdue(p_loan int) RETURNS int\nLANGUAGE sql IMMUTABLE\nAS $$\n  SELECT greatest(now()::date - upper(loan_period)::date, 0)\n  FROM loans WHERE id = p_loan AND returned_at IS NULL\n$$;",
			solutionSql:
				"CREATE FUNCTION days_overdue(p_loan int, as_of date) RETURNS int\nLANGUAGE sql STABLE\nAS $$\n  SELECT CASE WHEN returned_at IS NULL\n              THEN greatest(as_of - upper(loan_period)::date, 0)\n              ELSE 0 END\n  FROM loans WHERE id = p_loan\n$$;",
			check: {
				type: "state",
				verifySql:
					"SELECT days_overdue(9, '2026-10-31') AS loan_9, days_overdue(19, '2026-10-31') AS loan_19,\n       days_overdue(20, '2026-10-31') AS loan_20, days_overdue(2, '2026-10-31') AS loan_2,\n       (SELECT bool_and(provolatile <> 'i') FROM pg_proc WHERE proname = 'days_overdue') AS honest_label;",
			},
			hints: [
				"Replace `now()` by a parameter: the caller decides which day it is, and tests become possible.",
				"A function that reads a table is STABLE at best. Returned loans count 0 (a CASE, or a filter plus `coalesce`).",
				"CASE WHEN returned_at IS NULL THEN greatest(as_of - upper(loan_period)::date, 0) ELSE 0 END ... LANGUAGE sql STABLE",
			],
			explanation:
				"Passing the date in makes the function testable (2026-10-31 always gives the same answer) and STABLE is the truth: it reads `loans`. Loan 9 is 190 days late, loan 20 is not due yet, loan 2 came back.\n\n**Pitfall:** IMMUTABLE functions can be evaluated once at plan time or stored in an index, so the lie freezes yesterday's answer. With `WHERE returned_at IS NULL` alone, returned loans give NULL instead of 0.",
		},
		{
			id: "ch41-ex04",
			title: "The fine ledger",
			story:
				"Bartholomew sets the rules: half a coin per late day, never more than 20 coins, and a loud error if someone asks about a loan that does not exist.",
			prompt:
				"Write a **PL/pgSQL** function `fine_for(p_loan int, as_of date) RETURNS numeric`:\n\n- late days = (`returned_at::date`, or `as_of` while the scroll is still out) minus `upper(loan_period)::date`, never below 0;\n- fine = **0.50 per late day**, capped at **20.00**;\n- if the loan does not exist, `RAISE EXCEPTION` (any message).\n\nThe check computes the fine of every loan on `2026-10-31` and asks for loan 999.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["plpgsql-basics"],
			setupSql: SQLSTATE_HELPER,
			solutionSql: `${FINE_FOR}\n\nSELECT id, fine_for(id, '2026-10-31') FROM loans ORDER BY id;`,
			check: {
				type: "state",
				verifySql:
					"SELECT string_agg(id || '=' || fine_for(id, '2026-10-31')::numeric(6,2), ' ' ORDER BY id) AS fines,\n       sqlstate_of('SELECT fine_for(999, ''2026-10-31'')') <> 'ok' AS unknown_loan_fails\nFROM loans;",
			},
			hints: [
				"`SELECT ... INTO due, back FROM loans WHERE id = p_loan;` then `IF NOT FOUND THEN RAISE EXCEPTION ...`.",
				"`coalesce(returned_at::date, as_of)` is the day the scroll came back (or today). `greatest(x, 0)` and `least(x, 20.00)` clamp.",
				"late := greatest(back - due, 0); RETURN least(late * 0.50, 20.00);",
			],
			explanation:
				"`SELECT INTO` fills variables and sets `FOUND`, so the unknown loan raises P0001 instead of quietly returning NULL. Three overdue loans hit the 20.00 cap.\n\n**Pitfall:** without `IF NOT FOUND`, loan 999 returns NULL and a report summing fines just shrinks. **Alternative:** `SELECT ... INTO STRICT` raises NO_DATA_FOUND by itself, and the whole formula also fits in one SQL expression.",
		},
		{
			id: "ch41-ex05",
			title: "Owl post",
			story:
				"Every night Wisp the courier delivers reminders for overdue scrolls. The job must save its work even if the next step of the night fails.",
			prompt:
				"The table `reminders (loan_id int, sent_on date)` exists. Create a **procedure** `send_reminders(as_of date)` that inserts one reminder (`loan_id`, `as_of`) for every loan **not returned** whose due date (`upper(loan_period)`) is **before** `as_of`, then **COMMIT**s. Then call it for `2026-10-31`.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["procedures"],
			setupSql: "CREATE TABLE reminders (loan_id int, sent_on date);",
			solutionSql:
				"CREATE PROCEDURE send_reminders(as_of date)\nLANGUAGE plpgsql AS $$\nBEGIN\n  INSERT INTO reminders (loan_id, sent_on)\n  SELECT id, as_of FROM loans\n  WHERE returned_at IS NULL AND upper(loan_period) < as_of;\n  COMMIT;\nEND $$;\n\nCALL send_reminders('2026-10-31');",
			check: {
				type: "state",
				verifySql: "SELECT loan_id, sent_on FROM reminders ORDER BY loan_id;",
			},
			hints: [
				"`CREATE PROCEDURE name(params) LANGUAGE plpgsql AS $$ BEGIN ... END $$;` then `CALL name(...)`.",
				"One INSERT ... SELECT does all the reminders at once; `COMMIT;` goes after it, inside the body.",
				"INSERT INTO reminders SELECT id, as_of FROM loans WHERE returned_at IS NULL AND upper(loan_period) < as_of; COMMIT;",
			],
			explanation:
				"Four loans are out and past due (9, 13, 16, 19); loan 20 is out but due on 3 November. The COMMIT inside makes the reminders permanent before anything else in the nightly job runs.\n\n**Pitfall:** a function cannot COMMIT (2D000), and a procedure cannot be called in SELECT (42809). COMMIT inside a procedure also fails when CALL is sent in one batch with other statements; this app sends each statement alone.",
		},
		{
			id: "ch41-ex06",
			title: "The universal counter",
			story:
				"Gorrik keeps his own table, `\"Night Watch\"`, with spaces and capitals. He wants one spell that counts matching rows in any table.",
			prompt:
				"Create a PL/pgSQL function `count_rows(tbl text, col text, val text) RETURNS bigint` that returns how many rows of table `tbl` have column `col` equal to `val`. Build the query with `EXECUTE format(...)`, quoting names with `%I` and the value with `%L`. The check counts in `scrolls`, `readers`, `\"Night Watch\"`, and tries an injection.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["dynamic-sql", "sql-injection"],
			setupSql:
				"CREATE TABLE \"Night Watch\" (warden text, shift text);\nINSERT INTO \"Night Watch\" VALUES ('Gorrik', 'dusk'), ('Gorrik', 'midnight'), ('Mittens', 'midnight');",
			solutionSql:
				"CREATE FUNCTION count_rows(tbl text, col text, val text) RETURNS bigint\nLANGUAGE plpgsql STABLE AS $$\nDECLARE n bigint;\nBEGIN\n  EXECUTE format('SELECT count(*) FROM %I WHERE %I = %L', tbl, col, val) INTO n;\n  RETURN n;\nEND $$;\n\nSELECT count_rows('scrolls', 'language', 'fr');",
			check: {
				type: "state",
				verifySql:
					"SELECT count_rows('scrolls', 'language', 'fr') AS french,\n       count_rows('readers', 'clearance', '3') AS clearance_3,\n       count_rows('Night Watch', 'warden', 'Gorrik') AS gorrik_shifts,\n       count_rows('scrolls', 'language', $a$fr' OR '1'='1$a$) AS attack;",
			},
			hints: [
				"`EXECUTE some_text INTO variable` runs a query built at runtime.",
				"`format('SELECT count(*) FROM %I WHERE %I = %L', tbl, col, val)` quotes each piece the right way.",
				"DECLARE n bigint; BEGIN EXECUTE format('SELECT count(*) FROM %I WHERE %I = %L', tbl, col, val) INTO n; RETURN n; END",
			],
			explanation:
				"`%I` turns `Night Watch` into `\"Night Watch\"`, and `%L` turns the attack into one harmless string, so it counts 0 rows.\n\n**Pitfall:** with `%s` the table name breaks the syntax (42601) and the attack counts all 30 scrolls. **Alternative:** `EXECUTE format('SELECT count(*) FROM %I WHERE %I = $1', tbl, col) INTO n USING val` passes the value as a parameter.",
		},
		{
			id: "ch41-ex07",
			title: "Think like the thief",
			story:
				"A rival academy wants the full reader register. The library's old `find_reader_unsafe(p_name)` glues its input into SQL and logs every call in `search_log`. To fix a lock, first learn how it breaks.",
			prompt:
				"Call `find_reader_unsafe` with an input that makes it return **every reader**. The check reads the largest `rows_returned` in `search_log`.",
			difficulty: 3,
			kind: "query",
			concepts: ["sql-injection"],
			setupSql: UNSAFE_FINDER,
			starterSql: "SELECT * FROM find_reader_unsafe('Bram Tolliver');",
			solutionSql: "SELECT * FROM find_reader_unsafe($q$nobody' OR '1'='1$q$);",
			check: {
				type: "state",
				verifySql: "SELECT max(rows_returned) AS leaked FROM search_log;",
			},
			hints: [
				"The function builds `WHERE name = '<your input>'`. What if your input closes the quote?",
				"Close the quote, add a condition that is always true, and leave the last quote for the function to close.",
				"find_reader_unsafe($q$nobody' OR '1'='1$q$) (or 'nobody'' OR ''1''=''1' with doubled quotes)",
			],
			explanation:
				"Your input became code: `WHERE name = 'nobody' OR '1'='1'` is true for every row, so all 13 readers leak.\n\n**Pitfall:** \"we only show one row\" is no defence: attackers add `UNION SELECT email, ...` to read other tables too. The cure is to never let input become SQL text, as the next mission shows.",
		},
		{
			id: "ch41-ex08",
			title: "Seal the lock",
			story:
				"Saoirse the Ward Mage rewrites the reader search before the rival academy returns.",
			prompt:
				"Create a **safe** `find_reader(p_name text) RETURNS TABLE (name text, clearance int)` that returns the reader whose name equals `p_name` exactly. The check tries a normal name, an attack string and a name with an accent.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["sql-injection"],
			starterSql:
				"CREATE FUNCTION find_reader(p_name text) RETURNS TABLE (name text, clearance int)\nLANGUAGE plpgsql AS $$\nBEGIN\n  RETURN QUERY EXECUTE\n    'SELECT name, clearance FROM readers WHERE name = ''' || p_name || '''';\nEND $$;",
			solutionSql:
				"CREATE FUNCTION find_reader(p_name text) RETURNS TABLE (name text, clearance int)\nLANGUAGE sql STABLE AS $$\n  SELECT r.name, r.clearance FROM readers r WHERE r.name = p_name\n$$;",
			check: {
				type: "state",
				verifySql:
					"SELECT (SELECT count(*) FROM find_reader('Garrick Holt')) AS garrick,\n       (SELECT count(*) FROM find_reader($a$x' OR '1'='1$a$)) AS attack,\n       (SELECT count(*) FROM find_reader('Céleste Duvall')) AS celeste;",
			},
			hints: [
				"Does this search need dynamic SQL at all? The table and column never change.",
				"In a plain SQL function the parameter is a value, never code.",
				"LANGUAGE sql AS $$ SELECT r.name, r.clearance FROM readers r WHERE r.name = p_name $$",
			],
			explanation:
				"A parameter is bound as a value: the attack string is just a strange name that matches nobody. Static SQL is the strongest defence because there is no text to inject into.\n\n**Pitfall:** escaping quotes by hand (`replace(p_name, '''', '')`) breaks honest names like O'Brien and misses tricks you did not think of. **Alternative:** keep EXECUTE but write `... WHERE name = $1' USING p_name`, or `format('%L')`.",
		},
		{
			id: "ch41-ex09",
			title: "Boss: The Grimoire Engine",
			story:
				"Elowen commissions the Grimoire Engine: a report of overdue scrolls that the reading-room screen can sort by any column the clerk clicks. The clerk's click arrives as plain text, and the rival academy is listening.",
			prompt:
				"Create two functions:\n\n1. `fine_for(p_loan int, as_of date) RETURNS numeric` exactly as in *The fine ledger* (0.50 per late day, cap 20.00, exception for unknown loans);\n2. PL/pgSQL `overdue_report(as_of date, sort_by text) RETURNS TABLE (title text, reader text, fine numeric)` listing every loan **not returned** whose due date is **before** `as_of`: scroll **title**, reader **name**, and its **fine** from `fine_for`. Sort by the column named in `sort_by` (ascending), **ties by title**, using `EXECUTE format(...)` with `%I`. If `sort_by` is not `title`, `reader` or `fine`, `RAISE EXCEPTION`.\n\nThe check reads the report sorted by reader and by fine, and sends an attack as `sort_by`.",
			difficulty: 5,
			kind: "ddl",
			concepts: ["sql-functions", "plpgsql-basics", "dynamic-sql", "sql-injection"],
			setupSql: SQLSTATE_HELPER,
			solutionSql: `${FINE_FOR}

CREATE FUNCTION overdue_report(as_of date, sort_by text)
RETURNS TABLE (title text, reader text, fine numeric)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF sort_by NOT IN ('title', 'reader', 'fine') THEN
    RAISE EXCEPTION 'cannot sort by %', sort_by;
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT s.title, r.name AS reader, fine_for(l.id, $1) AS fine
       FROM loans l
       JOIN scrolls s ON s.id = l.scroll_id
       JOIN readers r ON r.id = l.reader_id
      WHERE l.returned_at IS NULL AND upper(l.loan_period) < $1
      ORDER BY %I, title', sort_by)
  USING as_of;
END $$;

SELECT * FROM overdue_report('2026-10-31', 'fine');`,
			check: {
				type: "state",
				verifySql:
					"SELECT 'reader' AS sorted_by, ord, title, reader, fine::numeric(6,2)\n  FROM overdue_report('2026-10-31', 'reader') WITH ORDINALITY AS r(title, reader, fine, ord)\nUNION ALL\nSELECT 'fine', ord, title, reader, fine::numeric(6,2)\n  FROM overdue_report('2026-10-31', 'fine') WITH ORDINALITY AS r(title, reader, fine, ord)\nUNION ALL\nSELECT 'attack', NULL, sqlstate_of('SELECT * FROM overdue_report(''2026-10-31'', ''fine; DROP TABLE loans'')'), (SELECT count(*)::text FROM loans), NULL\nORDER BY 1, 2;",
			},
			hints: [
				"Start with `fine_for` from the fine ledger. Then write the report as a plain query first, and only make the ORDER BY dynamic.",
				"Whitelist first (`IF sort_by NOT IN (...) THEN RAISE EXCEPTION`), then `RETURN QUERY EXECUTE format('... ORDER BY %I, title', sort_by) USING as_of`.",
				"Inside the format string, use `$1` for as_of (passed with USING) and alias the columns `AS reader` and `AS fine` so ORDER BY can name them.",
			],
			explanation:
				"Only the sort column is dynamic: it is checked against a whitelist and quoted with `%I`, while the date travels as a `$1` parameter. Four scrolls are overdue, three of them at the 20.00 cap, so the title breaks the ties.\n\n**Pitfall:** `'ORDER BY ' || sort_by` lets `fine; DROP TABLE loans` through as code; `%I` alone would turn it into an unknown column (42703), but the whitelist rejects it before any SQL is built and gives a clear message. **Alternative:** a static query with `ORDER BY CASE sort_by WHEN 'title' THEN title END, ...` needs no dynamic SQL at all.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch41-pr01",
			title: "Initials for the spines",
			prompt:
				"Create `initials(n text) RETURNS text` with a **SQL standard body** (`RETURN ...`, no `$$`): the first letter of the first word followed by the first letter of the second word (`'Elowen Thrice'` gives `ET`, `'Pim'` gives `P`). Label it IMMUTABLE.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["sql-functions"],
			solutionSql:
				"CREATE FUNCTION initials(n text) RETURNS text\nLANGUAGE sql IMMUTABLE\nRETURN left(n, 1) || left(split_part(n, ' ', 2), 1);",
			check: {
				type: "state",
				verifySql:
					"SELECT initials('Elowen Thrice') AS a, initials('Pim') AS b, initials('Saoirse Ní Bhriain') AS c,\n       (SELECT provolatile::text FROM pg_proc WHERE proname = 'initials') AS volatility;",
			},
			hints: [
				"`left(s, 1)` is the first letter; `split_part(s, ' ', 2)` the second word ('' when missing).",
				"The standard body is `RETURN expression;` right after the attributes.",
				"LANGUAGE sql IMMUTABLE RETURN left(n, 1) || left(split_part(n, ' ', 2), 1);",
			],
			explanation:
				"A pure text function is honestly IMMUTABLE. The standard body is parsed when the function is created, so a typo in a column name fails immediately instead of at first call.",
		},
		{
			id: "ch41-pr02",
			title: "An honest label",
			prompt:
				"Create `scroll_age(written date, as_of date) RETURNS int` returning the number of **whole years** from `written` to `as_of` (`extract(year from age(as_of, written))::int`), labelled **IMMUTABLE** (it depends only on its arguments).",
			difficulty: 2,
			kind: "ddl",
			concepts: ["sql-functions"],
			solutionSql:
				"CREATE FUNCTION scroll_age(written date, as_of date) RETURNS int\nLANGUAGE sql IMMUTABLE\nAS $$ SELECT extract(year from age(as_of, written))::int $$;",
			check: {
				type: "state",
				verifySql:
					"SELECT scroll_age('1187-03-02', '1222-12-31') AS a, scroll_age('1220-02-02', '1221-02-01') AS b,\n       (SELECT provolatile::text FROM pg_proc WHERE proname = 'scroll_age') AS volatility;",
			},
			hints: [
				"No table, no clock: only the two arguments.",
				"Such a function may promise IMMUTABLE.",
				"LANGUAGE sql IMMUTABLE AS $$ SELECT extract(year from age(as_of, written))::int $$",
			],
			explanation:
				"Because the reference date is a parameter, the function is pure and can even be used in an index expression. With `now()` inside it could not.",
		},
		{
			id: "ch41-pr03",
			title: "The alarm bell",
			prompt:
				"Write a `DO` block that raises an exception (`RAISE EXCEPTION`) when **more than 3** loans are unreturned and past due on `2026-10-31`. (There are 4, so your block must fail.)",
			difficulty: 2,
			kind: "query",
			concepts: ["plpgsql-basics"],
			solutionSql:
				"DO $$\nBEGIN\n  IF (SELECT count(*) FROM loans\n      WHERE returned_at IS NULL AND upper(loan_period) < date '2026-10-31') > 3 THEN\n    RAISE EXCEPTION 'too many overdue loans';\n  END IF;\nEND $$;",
			check: { type: "error", sqlstate: "P0001" },
			hints: [
				"`DO $$ BEGIN ... END $$;` runs an anonymous PL/pgSQL block.",
				"An IF can test a scalar subquery.",
				"IF (SELECT count(*) FROM loans WHERE returned_at IS NULL AND upper(loan_period) < date '2026-10-31') > 3 THEN RAISE EXCEPTION '...'; END IF;",
			],
			explanation:
				"`RAISE EXCEPTION` aborts the statement with SQLSTATE P0001, which applications can catch. `RAISE NOTICE` would only print a message.",
		},
		{
			id: "ch41-pr04",
			title: "Counting forbidden pages",
			prompt:
				"Create a PL/pgSQL function `forbidden_pages() RETURNS bigint` that adds up the `page_count` of every scroll with `clearance_level = 3` using a **FOR loop** over those scrolls.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["plpgsql-basics"],
			solutionSql:
				"CREATE FUNCTION forbidden_pages() RETURNS bigint\nLANGUAGE plpgsql STABLE AS $$\nDECLARE\n  total bigint := 0;\n  s record;\nBEGIN\n  FOR s IN SELECT page_count FROM scrolls WHERE clearance_level = 3 LOOP\n    total := total + s.page_count;\n  END LOOP;\n  RETURN total;\nEND $$;",
			check: {
				type: "state",
				verifySql: "SELECT forbidden_pages();",
			},
			hints: [
				"Declare a `total bigint := 0` and a `record` variable.",
				"`FOR s IN SELECT ... LOOP ... END LOOP;`",
				"FOR s IN SELECT page_count FROM scrolls WHERE clearance_level = 3 LOOP total := total + s.page_count; END LOOP;",
			],
			explanation:
				"183 pages. The loop works, but `SELECT sum(page_count) ...` does the same in one set-based step: loops are for logic SQL cannot express.",
		},
		{
			id: "ch41-pr05",
			title: "Half a night's work",
			story:
				"Hakon's enrolment job must keep its log line even when the enrolment itself is cancelled.",
			prompt:
				"The table `ward_log (msg text)` exists. Create a **procedure** `try_enrol()` that inserts `'attempt'` into `ward_log` and **COMMIT**s, then inserts a reader (`'Test Reader'`, `'test@aethel.lib'`, `'x'`, clearance 1, `joined_at` `'2026-10-31'`) and **ROLLBACK**s. Then CALL it.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["procedures"],
			setupSql: "CREATE TABLE ward_log (msg text);",
			solutionSql:
				"CREATE PROCEDURE try_enrol() LANGUAGE plpgsql AS $$\nBEGIN\n  INSERT INTO ward_log VALUES ('attempt');\n  COMMIT;\n  INSERT INTO readers (name, email, password_hash, clearance, joined_at)\n  VALUES ('Test Reader', 'test@aethel.lib', 'x', 1, '2026-10-31');\n  ROLLBACK;\nEND $$;\n\nCALL try_enrol();",
			check: {
				type: "state",
				verifySql:
					"SELECT (SELECT string_agg(msg, ',') FROM ward_log) AS log, (SELECT count(*) FROM readers) AS readers;",
			},
			hints: [
				"A procedure body may contain COMMIT and ROLLBACK statements.",
				"Each one ends the current transaction and starts a new one.",
				"INSERT INTO ward_log ...; COMMIT; INSERT INTO readers ...; ROLLBACK;",
			],
			explanation:
				"The log line survives (it was committed) and the reader vanishes (rolled back): still 13 readers. A function could do neither.",
		},
		{
			id: "ch41-pr06",
			title: "Predict the quoting",
			prompt:
				"Return **one row** with three values: `format('%I', 'Night Watch')`, `format('%L', 'O''Brien')` and `format('%I', 'scrolls')`.",
			difficulty: 1,
			kind: "query",
			concepts: ["dynamic-sql"],
			solutionSql:
				"SELECT format('%I', 'Night Watch'), format('%L', 'O''Brien'), format('%I', 'scrolls');",
			check: { type: "result" },
			hints: [
				"Just run the three calls.",
				"`%I` adds double quotes only when needed; `%L` adds single quotes and doubles inner ones.",
				"SELECT format('%I', 'Night Watch'), format('%L', 'O''Brien'), format('%I', 'scrolls');",
			],
			explanation:
				"`\"Night Watch\"` needs quotes (space, capitals); `scrolls` does not; `'O''Brien'` is a valid literal. That is exactly what EXECUTE needs.",
		},
		{
			id: "ch41-pr07",
			title: "The largest of anything",
			prompt:
				"Create a PL/pgSQL function `max_of(tbl text, col text) RETURNS text` returning `max(col)::text` of table `tbl`, with `EXECUTE format` and `%I` for both names.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["dynamic-sql"],
			solutionSql:
				"CREATE FUNCTION max_of(tbl text, col text) RETURNS text\nLANGUAGE plpgsql STABLE AS $$\nDECLARE result text;\nBEGIN\n  EXECUTE format('SELECT max(%I)::text FROM %I', col, tbl) INTO result;\n  RETURN result;\nEND $$;",
			check: {
				type: "state",
				verifySql:
					"SELECT max_of('scrolls', 'page_count') AS pages, max_of('readers', 'name') AS last_name, max_of('loans', 'returned_at') AS last_return;",
			},
			hints: [
				"Mind the order of arguments in `format`: they fill the placeholders left to right.",
				"`EXECUTE ... INTO result`.",
				"EXECUTE format('SELECT max(%I)::text FROM %I', col, tbl) INTO result;",
			],
			explanation:
				"The same function serves any table and column, and `%I` keeps it safe. Dynamic SQL is planned at every call, so keep it for truly dynamic needs.",
		},
		{
			id: "ch41-pr08",
			title: "A prepared question",
			prompt:
				"Prepare a statement `reader_by_name(text)` that returns the **name** and **clearance** of the reader whose name equals `$1`, then **execute** it for `'Bram Tolliver'`.",
			difficulty: 2,
			kind: "query",
			concepts: ["sql-injection"],
			solutionSql:
				"PREPARE reader_by_name(text) AS\n  SELECT name, clearance FROM readers WHERE name = $1;\nEXECUTE reader_by_name('Bram Tolliver');",
			check: { type: "result" },
			hints: [
				"`PREPARE name(types) AS query-with-$1;`",
				"Then `EXECUTE name(value);`",
				"PREPARE reader_by_name(text) AS SELECT name, clearance FROM readers WHERE name = $1; EXECUTE reader_by_name('Bram Tolliver');",
			],
			explanation:
				"The query is parsed once with a placeholder; the value arrives later and can never change its shape. Application drivers do this for you when you pass parameters.",
		},
		{
			id: "ch41-pr09",
			title: "Defused",
			prompt:
				"Return **one row** with `quote_literal($q$x' OR '1'='1$q$)` and `quote_ident('Night Watch')`.",
			difficulty: 1,
			kind: "query",
			concepts: ["sql-injection"],
			solutionSql: "SELECT quote_literal($q$x' OR '1'='1$q$), quote_ident('Night Watch');",
			check: { type: "result" },
			hints: [
				"Just run them.",
				"`quote_literal` doubles every quote inside and wraps the result in quotes.",
				"SELECT quote_literal($q$x' OR '1'='1$q$), quote_ident('Night Watch');",
			],
			explanation:
				"`'x'' OR ''1''=''1'` is one string literal: the attack is now text, not code. These are the functions behind `%L` and `%I`.",
		},
	],
};

export default chapter;
