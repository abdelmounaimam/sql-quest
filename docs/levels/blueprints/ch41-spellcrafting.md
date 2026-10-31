### ch41-spellcrafting · Spellcrafting 🧙
- **File** `src/content/chapters/ch41-spellcrafting.ts` · **World** The Astral Spire · **Tier** expert · **Track** advanced · **Dataset** `library`
- **Subtitle** SQL functions, PL/pgSQL, procedures, dynamic SQL and the injection curse
- **Concepts** `sql-functions`, `plpgsql-basics`, `procedures`, `dynamic-sql`, `sql-injection`
- **Prerequisites** `ch40-undead-rows-and-big-tables`
- **Lesson** (10 steps)
  1. explain · `CREATE FUNCTION name(params) RETURNS type LANGUAGE sql AS $$ ... $$`; scalar, `SETOF`, `RETURNS TABLE`; volatility labels IMMUTABLE / STABLE / VOLATILE.
  2. example · `scrolls_by(author_name text) RETURNS SETOF scrolls ... STABLE`, then `SELECT title FROM scrolls_by('Elowen Thrice')`.
  3. quiz · A function reads `now()`: which label is honest? (STABLE; IMMUTABLE lets the planner fold a stale value into indexes and plans)
  4. explain · PL/pgSQL anatomy: DECLARE, BEGIN, IF, RETURN, `RAISE EXCEPTION` (P0001), `DO $$ ... $$` for one-offs; set-based SQL first, loops last.
  5. explain · Procedures: `CREATE PROCEDURE`, `CALL`, COMMIT / ROLLBACK inside (only when CALL is its own statement, which the app guarantees); a procedure cannot be used in SELECT (42809).
  6. explain · SQL injection: gluing input into SQL text lets `x' OR '1'='1` rewrite the WHERE clause.
  7. example · A cursed function `find_reader_unsafe` built with `||`, called with a crafted name: every reader spills out (surprise).
  8. explain · Dynamic SQL done right: `EXECUTE format('SELECT count(*) FROM %I WHERE %I = %L', t, c, v)` and `EXECUTE ... USING $1`; identifiers with `%I`, values with `%L` or parameters.
  9. quiz · Which placeholder for a table name chosen at runtime? (`%I`; `%L` makes it a string, `%s` is raw and injectable, `$1` cannot bind identifiers)
  10. try · Fix `scroll_count(lang text)` (starter ignores the parameter, 30) and call it for `'fr'` (8).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch41-ex01 | `pages_written(author_name text) RETURNS bigint`, 0 for unknown authors; verify calls Elowen (96), Nobody (0) and hidden authors | 2 | ddl | state | sql-functions | write |
| ch41-ex02 | `section_scrolls(p ltree) RETURNS TABLE(title text, path ltree)`: scrolls whose section is under p (`<@`); verify `arcana.fire` and a hidden `history` count | 3 | ddl | state | sql-functions | write |
| ch41-ex03 | starter `days_overdue(p_loan int)` is IMMUTABLE and reads `now()`: rewrite as `days_overdue(p_loan int, as_of date)` (0 when returned or not late), not IMMUTABLE; verify values and `provolatile <> 'i'` | 3 | ddl | state | sql-functions | fix |
| ch41-ex04 | PL/pgSQL `fine_for(p_loan int, as_of date) RETURNS numeric`: 0.50 per late day (return date, or as_of while out), capped at 20.00, `RAISE EXCEPTION` for an unknown loan; verify every loan and the SQLSTATE of loan 999 (helper `sqlstate_of` in setupSql) | 4 | ddl | state | plpgsql-basics | write |
| ch41-ex05 | procedure `send_reminders(as_of date)` inserting one `reminders` row per overdue loan, then COMMIT; CALL it; verify reminders | 3 | ddl | state | procedures | write |
| ch41-ex06 | `count_rows(tbl text, col text, val text) RETURNS bigint` with `EXECUTE format(... %I ... %I = %L)`; verify scrolls/language/fr (8), readers/clearance/3 (2), the hidden table `"Night Watch"` and an injection attempt (0) | 3 | ddl | state | dynamic-sql, sql-injection | write |
| ch41-ex07 | the setupSql's `find_reader_unsafe` logs how many rows each call returned: make it leak **every** reader (13) | 3 | query | state | sql-injection | predict |
| ch41-ex08 | starter `find_reader` glues input with `||`: rewrite it safely; verify Garrick (1), the injection string (0), `Céleste Duvall` (1) | 3 | ddl | state | sql-injection | fix |
| ch41-ex09 | **Boss · The Grimoire Engine**: `fine_for` (as ex04) + PL/pgSQL `overdue_report(as_of date, sort_by text) RETURNS TABLE(title text, reader text, fine numeric)` for unreturned loans past due, sorted by the caller's column via `format('%I')` then title, `RAISE EXCEPTION` unless sort_by is title, reader or fine; verify two sort orders WITH ORDINALITY, the error on `fine; DROP TABLE loans`, loans intact | 5 | ddl | state | sql-functions, plpgsql-basics, dynamic-sql, sql-injection | write |

- **Practice**: `ch41-pr01` sql-functions: SQL standard body `initials(n text) RETURNS text IMMUTABLE RETURN ...`; `ch41-pr02` sql-functions: `scroll_age(written date, as_of date) RETURNS int` labelled IMMUTABLE (pure); `ch41-pr03` plpgsql-basics: `DO` block raising when more than 3 loans are overdue on 2026-10-31 (error P0001); `ch41-pr04` plpgsql-basics: `forbidden_pages()` with a FOR loop (183); `ch41-pr05` procedures: `try_enrol()` logs, COMMITs, inserts a reader, ROLLBACKs (log 1, readers 13); `ch41-pr06` dynamic-sql: predict `format('%I', 'Night Watch')`, `format('%L', 'O''Brien')`, `format('%I', 'scrolls')`; `ch41-pr07` dynamic-sql: `max_of(tbl text, col text) RETURNS text`; `ch41-pr08` sql-injection: `PREPARE reader_by_name(text)` + `EXECUTE` for Bram Tolliver; `ch41-pr09` sql-injection: predict `quote_literal` of the attack string and `quote_ident('Night Watch')`.
- **Negative cases to add**: ex01 sum without coalesce (NULL); ex02 `=` instead of `<@` (misses dragons); ex03 keeping IMMUTABLE, counting returned loans; ex04 no cap, returning NULL for unknown loans, ignoring late returns; ex05 a function instead of a procedure is fine only if it writes the same rows, reject inserting every unreturned loan (20 is not due); ex06 `%s` (Night Watch fails, injection counts 30), `%L` for the table; ex07 calling with a normal name; ex08 the unsafe body, `quote_ident` on the value; boss sort by concatenation without whitelist (still rejects the attack with 42703, so whitelist SQLSTATE P0001 is graded), missing the title tie breaker.
- **Notes**: overdue loans on 2026-10-31: 9, 13, 16, 19 (20 is due on 3 Nov); late returns: 2 (8 days), 8 (15), 15 (17). Fines on 2026-10-31: 4.00, 7.50, 20.00 (cap), 8.50, 20.00, 20.00, 8.00. Every function exercise is graded by calling the function in verifySql with the prompt's inputs plus hidden ones, never by the learner's last SELECT. Hidden helpers come from the exercise setupSql: `sqlstate_of(q text)` (returns `ok` or the SQLSTATE), the table `"Night Watch"`, `search_log`. RAISE NOTICE output is not graded.
