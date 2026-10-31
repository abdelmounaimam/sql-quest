import type { CaseSet } from "../validate-content";

const FINE_FOR_NO_CAP = `CREATE FUNCTION fine_for(p_loan int, as_of date) RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE due date; back date;
BEGIN
  SELECT upper(loan_period)::date, coalesce(returned_at::date, as_of) INTO due, back FROM loans WHERE id = p_loan;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown loan'; END IF;
  RETURN greatest(back - due, 0) * 0.50;
END $$;`;

const cases: Record<string, CaseSet> = {
	"ch41-spellcrafting/lesson-9": {
		accept: [
			"CREATE FUNCTION scroll_count(lang text) RETURNS bigint LANGUAGE sql STABLE RETURN (SELECT count(*) FROM scrolls WHERE language = lang); SELECT scroll_count('fr') AS n;",
		],
	},
	"ch41-ex01": {
		reject: [
			{
				sql: "CREATE FUNCTION pages_written(author_name text) RETURNS bigint LANGUAGE sql AS $$ SELECT sum(page_count) FROM scrolls WHERE author = author_name $$;",
				why: "NULL instead of 0 for an unknown author",
			},
			{
				sql: "CREATE FUNCTION pages_written(author_name text) RETURNS bigint LANGUAGE sql AS $$ SELECT count(*) FROM scrolls WHERE author = author_name $$;",
				why: "counts scrolls instead of pages",
			},
		],
		accept: [
			"CREATE FUNCTION pages_written(author_name text) RETURNS bigint LANGUAGE sql STABLE RETURN (SELECT coalesce(sum(page_count), 0) FROM scrolls WHERE author = author_name);",
			"CREATE FUNCTION pages_written(author_name text) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE t bigint; BEGIN SELECT sum(page_count) INTO t FROM scrolls WHERE author = author_name; RETURN coalesce(t, 0); END $$;",
		],
	},
	"ch41-ex02": {
		reject: [
			{
				sql: "CREATE FUNCTION section_scrolls(p ltree) RETURNS TABLE (title text, path ltree) LANGUAGE sql AS $$ SELECT s.title, sec.path FROM scrolls s JOIN sections sec ON sec.id = s.section_id WHERE sec.path = p $$;",
				why: "exact shelf only, sub-shelves lost",
			},
		],
		accept: [
			"CREATE FUNCTION section_scrolls(p ltree) RETURNS TABLE (title text, path ltree) LANGUAGE plpgsql STABLE AS $$ BEGIN RETURN QUERY SELECT s.title, sec.path FROM scrolls s JOIN sections sec ON sec.id = s.section_id WHERE p @> sec.path; END $$;",
		],
	},
	"ch41-ex03": {
		reject: [
			{
				sql: "CREATE FUNCTION days_overdue(p_loan int, as_of date) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN returned_at IS NULL THEN greatest(as_of - upper(loan_period)::date, 0) ELSE 0 END FROM loans WHERE id = p_loan $$;",
				why: "still labelled IMMUTABLE while reading a table",
			},
			{
				sql: "CREATE FUNCTION days_overdue(p_loan int, as_of date) RETURNS int LANGUAGE sql STABLE AS $$ SELECT greatest(as_of - upper(loan_period)::date, 0) FROM loans WHERE id = p_loan $$;",
				why: "returned loans counted as late",
			},
		],
		accept: [
			"CREATE FUNCTION days_overdue(p_loan int, as_of date) RETURNS int LANGUAGE sql AS $$ SELECT coalesce((SELECT greatest(as_of - upper(loan_period)::date, 0) FROM loans WHERE id = p_loan AND returned_at IS NULL), 0) $$;",
		],
	},
	"ch41-ex04": {
		reject: [
			{ sql: FINE_FOR_NO_CAP, why: "no 20.00 cap" },
			{
				sql: "CREATE FUNCTION fine_for(p_loan int, as_of date) RETURNS numeric LANGUAGE sql AS $$ SELECT least(greatest(coalesce(returned_at::date, as_of) - upper(loan_period)::date, 0) * 0.50, 20.00) FROM loans WHERE id = p_loan $$;",
				why: "unknown loan returns NULL instead of raising",
			},
			{
				sql: "CREATE FUNCTION fine_for(p_loan int, as_of date) RETURNS numeric LANGUAGE plpgsql AS $$ DECLARE due date; BEGIN SELECT upper(loan_period)::date INTO due FROM loans WHERE id = p_loan; IF NOT FOUND THEN RAISE EXCEPTION 'unknown'; END IF; RETURN least(greatest(as_of - due, 0) * 0.50, 20.00); END $$;",
				why: "late returns measured to as_of instead of the return date",
			},
		],
		accept: [
			"CREATE FUNCTION fine_for(p_loan int, as_of date) RETURNS numeric LANGUAGE plpgsql AS $$ DECLARE l loans; BEGIN SELECT * INTO STRICT l FROM loans WHERE id = p_loan; RETURN least(greatest(coalesce(l.returned_at::date, as_of) - upper(l.loan_period)::date, 0) * 0.5, 20); END $$;",
		],
	},
	"ch41-ex05": {
		reject: [
			{
				sql: "CREATE PROCEDURE send_reminders(as_of date) LANGUAGE plpgsql AS $$ BEGIN INSERT INTO reminders SELECT id, as_of FROM loans WHERE returned_at IS NULL; COMMIT; END $$; CALL send_reminders('2026-10-31');",
				why: "loan 20 is not due yet",
			},
			{
				sql: "CREATE PROCEDURE send_reminders(as_of date) LANGUAGE plpgsql AS $$ BEGIN INSERT INTO reminders SELECT id, as_of FROM loans WHERE returned_at IS NULL AND upper(loan_period) < as_of; COMMIT; END $$;",
				why: "created but never called",
			},
		],
		accept: [
			"CREATE PROCEDURE send_reminders(as_of date) LANGUAGE sql AS $$ INSERT INTO reminders (loan_id, sent_on) SELECT id, as_of FROM loans WHERE returned_at IS NULL AND upper(loan_period) < as_of $$; CALL send_reminders(date '2026-10-31');",
		],
	},
	"ch41-ex06": {
		reject: [
			{
				sql: "CREATE FUNCTION count_rows(tbl text, col text, val text) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE n bigint; BEGIN EXECUTE format('SELECT count(*) FROM %s WHERE %s = ''%s''', tbl, col, val) INTO n; RETURN n; END $$;",
				why: "%s: Night Watch breaks and the attack succeeds",
			},
			{
				sql: "CREATE FUNCTION count_rows(tbl text, col text, val text) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE n bigint; BEGIN EXECUTE 'SELECT count(*) FROM ' || quote_ident(tbl) || ' WHERE ' || quote_ident(col) || ' = ''' || val || '''' INTO n; RETURN n; END $$;",
				why: "value glued without quoting: injectable",
			},
		],
		accept: [
			"CREATE FUNCTION count_rows(tbl text, col text, val text) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE n bigint; BEGIN EXECUTE format('SELECT count(*) FROM %I WHERE %I::text = $1', tbl, col) INTO n USING val; RETURN n; END $$;",
		],
	},
	"ch41-ex07": {
		reject: [
			{ sql: "SELECT name FROM readers;", why: "reads the table directly, the function never leaked" },
		],
		accept: [
			"SELECT * FROM find_reader_unsafe('x'' OR ''a''=''a');",
			"SELECT name FROM find_reader_unsafe($$' OR true OR name = '$$);",
		],
	},
	"ch41-ex08": {
		reject: [
			{
				sql: "CREATE FUNCTION find_reader(p_name text) RETURNS TABLE (name text, clearance int) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY EXECUTE 'SELECT name, clearance FROM readers WHERE name = ' || quote_ident(p_name); END $$;",
				why: "quote_ident turns the value into a column name",
			},
		],
		accept: [
			"CREATE FUNCTION find_reader(p_name text) RETURNS TABLE (name text, clearance int) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY EXECUTE 'SELECT name, clearance FROM readers WHERE name = $1' USING p_name; END $$;",
			"CREATE FUNCTION find_reader(p_name text) RETURNS TABLE (name text, clearance int) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY EXECUTE format('SELECT name, clearance FROM readers WHERE name = %L', p_name); END $$;",
		],
	},
	"ch41-ex09": {
		reject: [
			{
				sql: `${FINE_FOR_NO_CAP}
CREATE FUNCTION overdue_report(as_of date, sort_by text) RETURNS TABLE (title text, reader text, fine numeric) LANGUAGE plpgsql AS $$
BEGIN
  IF sort_by NOT IN ('title', 'reader', 'fine') THEN RAISE EXCEPTION 'no'; END IF;
  RETURN QUERY EXECUTE format('SELECT s.title, r.name AS reader, fine_for(l.id, $1) AS fine FROM loans l JOIN scrolls s ON s.id = l.scroll_id JOIN readers r ON r.id = l.reader_id WHERE l.returned_at IS NULL AND upper(l.loan_period) < $1 ORDER BY %I, title', sort_by) USING as_of;
END $$;`,
				why: "fine_for without the cap",
			},
			{
				sql: `CREATE FUNCTION fine_for(p_loan int, as_of date) RETURNS numeric LANGUAGE sql AS $$ SELECT least(greatest(coalesce(returned_at::date, as_of) - upper(loan_period)::date, 0) * 0.50, 20.00) FROM loans WHERE id = p_loan $$;
CREATE FUNCTION overdue_report(as_of date, sort_by text) RETURNS TABLE (title text, reader text, fine numeric) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY EXECUTE 'SELECT s.title, r.name AS reader, fine_for(l.id, $1) AS fine FROM loans l JOIN scrolls s ON s.id = l.scroll_id JOIN readers r ON r.id = l.reader_id WHERE l.returned_at IS NULL AND upper(l.loan_period) < $1 ORDER BY ' || sort_by || ', title' USING as_of;
END $$;`,
				why: "no whitelist: the attack reaches the SQL text",
			},
		],
		accept: [
			`CREATE FUNCTION fine_for(p_loan int, as_of date) RETURNS numeric LANGUAGE plpgsql AS $$ DECLARE l loans; BEGIN SELECT * INTO STRICT l FROM loans WHERE id = p_loan; RETURN least(greatest(coalesce(l.returned_at::date, as_of) - upper(l.loan_period)::date, 0) * 0.5, 20); END $$;
CREATE FUNCTION overdue_report(as_of date, sort_by text) RETURNS TABLE (title text, reader text, fine numeric) LANGUAGE plpgsql AS $$
BEGIN
  CASE sort_by
    WHEN 'title', 'reader', 'fine' THEN NULL;
    ELSE RAISE EXCEPTION 'bad sort %', sort_by;
  END CASE;
  RETURN QUERY EXECUTE format('SELECT x.title, x.reader, x.fine FROM (SELECT s.title, r.name AS reader, fine_for(l.id, %L) AS fine FROM loans l JOIN scrolls s ON s.id = l.scroll_id JOIN readers r ON r.id = l.reader_id WHERE l.returned_at IS NULL AND upper(l.loan_period) < %L) x ORDER BY %I, x.title', as_of, as_of, sort_by);
END $$;`,
		],
	},
	"ch41-pr01": {
		reject: [
			{
				sql: "CREATE FUNCTION initials(n text) RETURNS text LANGUAGE sql RETURN left(n, 1) || left(split_part(n, ' ', 2), 1);",
				why: "not labelled IMMUTABLE",
			},
		],
	},
	"ch41-pr05": {
		reject: [
			{
				sql: "CREATE PROCEDURE try_enrol() LANGUAGE plpgsql AS $$ BEGIN INSERT INTO ward_log VALUES ('attempt'); INSERT INTO readers (name, email, password_hash, clearance, joined_at) VALUES ('Test Reader', 'test@aethel.lib', 'x', 1, '2026-10-31'); COMMIT; END $$; CALL try_enrol();",
				why: "the reader is committed too",
			},
		],
	},
	"ch41-pr07": {
		reject: [
			{
				sql: "CREATE FUNCTION max_of(tbl text, col text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE r text; BEGIN EXECUTE format('SELECT max(%I)::text FROM %I', tbl, col) INTO r; RETURN r; END $$;",
				why: "arguments swapped in format",
			},
		],
	},
};

export default cases;
