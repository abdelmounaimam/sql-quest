import type { CaseSet } from "../validate-content";

const UPSERT = `INSERT INTO scrolls (title, section_id, author, language, body, page_count, clearance_level)
SELECT title, section_id, author, language, body, page_count, clearance_level FROM scroll_import
ON CONFLICT (title) DO UPDATE SET author = EXCLUDED.author, page_count = EXCLUDED.page_count;`;

const RLS = `ALTER TABLE scrolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY a ON scrolls FOR SELECT TO apprentice_reader USING (clearance_level = 1);
CREATE POLICY b ON scrolls FOR SELECT TO archivist USING (true);`;

const cases: Record<string, CaseSet> = {
	"ch42-wards-and-gatekeepers/lesson-9": {
		reject: [{ sql: "GRANT ALL ON loans TO apprentice_reader;", why: "grants far more than SELECT" }],
	},
	"ch42-ex01": {
		reject: [
			{
				sql: "CREATE FUNCTION lower_email() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.email := lower(NEW.email); RETURN NEW; END $$; CREATE TRIGGER t BEFORE INSERT ON readers FOR EACH ROW EXECUTE FUNCTION lower_email();",
				why: "INSERT only: reader 5 is never cleaned",
			},
			{
				sql: "CREATE FUNCTION lower_email() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.email := lower(NEW.email); RETURN NEW; END $$; CREATE TRIGGER t AFTER INSERT OR UPDATE ON readers FOR EACH ROW EXECUTE FUNCTION lower_email();",
				why: "AFTER trigger: changes to NEW are ignored",
			},
		],
		accept: [
			"CREATE FUNCTION f() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.email = lower(NEW.email::text); RETURN NEW; END $$; CREATE TRIGGER t BEFORE UPDATE OR INSERT ON readers FOR EACH ROW EXECUTE PROCEDURE f();",
		],
	},
	"ch42-ex02": {
		reject: [
			{ sql: "DROP TRIGGER loans_check_clearance ON loans;", why: "the ward is gone: forbidden loans pass" },
		],
		accept: [
			"CREATE OR REPLACE FUNCTION check_clearance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM readers r, scrolls s WHERE r.id = NEW.reader_id AND s.id = NEW.scroll_id AND r.clearance < s.clearance_level) THEN RAISE EXCEPTION 'too low'; END IF; RETURN NEW; END $$;",
		],
	},
	"ch42-ex03": {
		reject: [
			{
				sql: "CREATE FUNCTION a() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO loan_audit (op, loan_id, old_row, new_row) VALUES (TG_OP, NEW.id, to_jsonb(OLD), to_jsonb(NEW)); RETURN NULL; END $$; CREATE TRIGGER t AFTER UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION a(); UPDATE loans SET returned_at = '2026-10-31 12:00+00' WHERE id = 9;",
				why: "audits UPDATE only",
			},
			{
				sql: "CREATE FUNCTION a() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO loan_audit (op, loan_id, new_row) VALUES (TG_OP, coalesce(NEW.id, OLD.id), to_jsonb(NEW)); RETURN NULL; END $$; CREATE TRIGGER t AFTER INSERT OR UPDATE OR DELETE ON loans FOR EACH ROW EXECUTE FUNCTION a(); UPDATE loans SET returned_at = '2026-10-31 12:00+00' WHERE id = 9;",
				why: "old row not kept",
			},
			{
				sql: "CREATE FUNCTION a() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO loan_audit (op, loan_id, old_row, new_row) VALUES (TG_OP, coalesce(NEW.id, OLD.id), to_jsonb(OLD), to_jsonb(NEW)); RETURN NULL; END $$; CREATE TRIGGER t AFTER INSERT OR UPDATE OR DELETE ON loans FOR EACH ROW EXECUTE FUNCTION a();",
				why: "loan 9 never returned",
			},
		],
		accept: [
			"CREATE FUNCTION a() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP = 'DELETE' THEN INSERT INTO loan_audit (op, loan_id, old_row) VALUES (TG_OP, OLD.id, to_jsonb(OLD)); ELSIF TG_OP = 'INSERT' THEN INSERT INTO loan_audit (op, loan_id, new_row) VALUES (TG_OP, NEW.id, to_jsonb(NEW)); ELSE INSERT INTO loan_audit (op, loan_id, old_row, new_row) VALUES (TG_OP, NEW.id, to_jsonb(OLD), to_jsonb(NEW)); END IF; RETURN NULL; END $$; CREATE TRIGGER t AFTER INSERT OR UPDATE OR DELETE ON loans FOR EACH ROW EXECUTE FUNCTION a(); UPDATE loans SET returned_at = timestamptz '2026-10-31 12:00:00+00' WHERE id = 9;",
		],
	},
	"ch42-ex04": {
		reject: [
			{
				sql: "CREATE FUNCTION r() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_notify('returns', NEW.id::text); INSERT INTO outbox (channel, payload) VALUES ('returns', NEW.id::text); RETURN NULL; END $$; CREATE TRIGGER t AFTER UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION r(); UPDATE loans SET returned_at = '2026-10-31 12:00+00' WHERE id IN (13, 16);",
				why: "rings on every update",
			},
		],
		accept: [
			"CREATE FUNCTION r() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_notify('returns', NEW.id::text); INSERT INTO outbox (channel, payload) VALUES ('returns', NEW.id::text); RETURN NULL; END $$; CREATE TRIGGER t AFTER UPDATE OF returned_at ON loans FOR EACH ROW WHEN (OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL) EXECUTE FUNCTION r(); UPDATE loans SET returned_at = '2026-10-31 12:00+00' WHERE id = 13; UPDATE loans SET returned_at = '2026-10-31 12:00+00' WHERE id = 16;",
		],
	},
	"ch42-ex05": {
		reject: [
			{ sql: "GRANT ALL ON loans TO archivist; REVOKE SELECT ON citations FROM apprentice_reader;", why: "GRANT ALL also gives TRUNCATE" },
			{ sql: "GRANT DELETE ON loans TO archivist;", why: "citations still readable" },
		],
		accept: ["REVOKE SELECT ON TABLE citations FROM apprentice_reader; GRANT DELETE ON TABLE loans TO archivist;"],
	},
	"ch42-ex06": {
		reject: [
			{
				sql: "CREATE POLICY a ON scrolls FOR SELECT TO apprentice_reader USING (clearance_level = 1); CREATE POLICY b ON scrolls FOR SELECT TO archivist USING (true);",
				why: "RLS never enabled",
			},
			{
				sql: "ALTER TABLE scrolls ENABLE ROW LEVEL SECURITY; CREATE POLICY a ON scrolls FOR SELECT TO apprentice_reader USING (clearance_level = 1);",
				why: "archivist has no policy and sees nothing",
			},
			{
				sql: "ALTER TABLE scrolls ENABLE ROW LEVEL SECURITY; CREATE POLICY a ON scrolls FOR SELECT USING (clearance_level = 1);",
				why: "one policy for everybody hides scrolls from archivists",
			},
		],
		accept: [RLS],
	},
	"ch42-ex07": {
		reject: [
			{
				sql: "INSERT INTO readers (name, email, password_hash, clearance, joined_at) SELECT name, email, crypt('changeme', gen_salt('bf', 4)), clearance, '2026-10-31 09:00+00' FROM reader_import;",
				why: "plain INSERT fails on the rerun (23505)",
			},
			{
				sql: "INSERT INTO readers (name, email, password_hash, clearance, joined_at) SELECT name, email, crypt('changeme', gen_salt('bf', 4)), clearance, '2026-10-31 09:00+00' FROM reader_import ON CONFLICT (email) DO NOTHING;",
				why: "corrections never applied",
			},
			{
				sql: "INSERT INTO readers (name, email, password_hash, clearance, joined_at) SELECT name, email, crypt('changeme', gen_salt('bf', 4)), clearance, '2026-10-31 09:00+00' FROM reader_import ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, clearance = EXCLUDED.clearance, password_hash = EXCLUDED.password_hash;",
				why: "resets existing readers' passwords",
			},
		],
		accept: [
			"MERGE INTO readers r USING reader_import i ON r.email = i.email WHEN MATCHED THEN UPDATE SET name = i.name, clearance = i.clearance WHEN NOT MATCHED THEN INSERT (name, email, password_hash, clearance, joined_at) VALUES (i.name, i.email, crypt('changeme', gen_salt('bf', 4)), i.clearance, '2026-10-31 09:00+00');",
			"INSERT INTO readers AS r (name, email, password_hash, clearance, joined_at) SELECT name, email, crypt('changeme', gen_salt('bf', 4)), clearance, timestamptz '2026-10-31 09:00:00+00' FROM reader_import ON CONFLICT ON CONSTRAINT readers_email_key DO UPDATE SET name = excluded.name, clearance = excluded.clearance; INSERT INTO readers AS r (name, email, password_hash, clearance, joined_at) SELECT name, email, crypt('changeme', gen_salt('bf', 4)), clearance, timestamptz '2026-10-31 09:00:00+00' FROM reader_import ON CONFLICT ON CONSTRAINT readers_email_key DO UPDATE SET name = excluded.name, clearance = excluded.clearance;",
		],
	},
	"ch42-ex08": {
		reject: [
			{
				sql: `ALTER TABLE scrolls ADD CONSTRAINT u UNIQUE (title);
CREATE FUNCTION a() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO scroll_audit (scroll_id, changed) SELECT NEW.id, coalesce(jsonb_object_agg(n.key, n.value), '{}') FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o USING (key) WHERE n.value IS DISTINCT FROM o.value; RETURN NULL; END $$;
CREATE TRIGGER t AFTER UPDATE ON scrolls FOR EACH ROW EXECUTE FUNCTION a();
${RLS}
${UPSERT}
${UPSERT}`,
				why: "logs empty diffs for no-op updates",
			},
			{
				sql: `ALTER TABLE scrolls ADD CONSTRAINT u UNIQUE (title);
CREATE FUNCTION a() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE d jsonb; BEGIN SELECT jsonb_object_agg(n.key, n.value) INTO d FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o USING (key) WHERE n.value IS DISTINCT FROM o.value; IF d IS NOT NULL THEN INSERT INTO scroll_audit (scroll_id, changed) VALUES (NEW.id, d); END IF; RETURN NULL; END $$;
CREATE TRIGGER t AFTER UPDATE ON scrolls FOR EACH ROW EXECUTE FUNCTION a();
${UPSERT}
${UPSERT}`,
				why: "no row-level security",
			},
		],
		accept: [
			`CREATE UNIQUE INDEX scrolls_title_uq ON scrolls (title);
CREATE FUNCTION a() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO scroll_audit (scroll_id, changed) SELECT NEW.id, jsonb_object_agg(n.key, n.value) FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o USING (key) WHERE n.value IS DISTINCT FROM o.value HAVING count(*) > 0; RETURN NULL; END $$;
CREATE TRIGGER t AFTER UPDATE ON scrolls FOR EACH ROW WHEN (OLD IS DISTINCT FROM NEW) EXECUTE FUNCTION a();
${RLS}
MERGE INTO scrolls s USING scroll_import i ON s.title = i.title WHEN MATCHED THEN UPDATE SET author = i.author, page_count = i.page_count WHEN NOT MATCHED THEN INSERT (title, section_id, author, language, body, page_count, clearance_level) VALUES (i.title, i.section_id, i.author, i.language, i.body, i.page_count, i.clearance_level);
MERGE INTO scrolls s USING scroll_import i ON s.title = i.title WHEN MATCHED THEN UPDATE SET author = i.author, page_count = i.page_count WHEN NOT MATCHED THEN INSERT (title, section_id, author, language, body, page_count, clearance_level) VALUES (i.title, i.section_id, i.author, i.language, i.body, i.page_count, i.clearance_level);`,
		],
	},
	"ch42-pr01": {
		reject: [
			{
				sql: "CREATE FUNCTION c() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE delete_stats SET statements = statements + 1; RETURN NULL; END $$; CREATE TRIGGER t AFTER DELETE ON loans FOR EACH ROW EXECUTE FUNCTION c();",
				why: "row-level trigger counts rows",
			},
		],
	},
	"ch42-pr02": {
		reject: [
			{
				sql: "CREATE FUNCTION l() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO clearance_log VALUES (NEW.id, OLD.clearance, NEW.clearance); RETURN NULL; END $$; CREATE TRIGGER t AFTER UPDATE OF clearance ON readers FOR EACH ROW EXECUTE FUNCTION l();",
				why: "UPDATE OF fires for SET clearance = clearance",
			},
		],
	},
	"ch42-pr03": {
		reject: [
			{
				sql: "SELECT a.id, n.key, o.value, n.value FROM loan_audit a, jsonb_each_text(a.new_row) n, jsonb_each_text(a.old_row) o WHERE o.key = n.key AND n.value <> o.value;",
				why: "<> drops the NULL to date change",
			},
		],
	},
	"ch42-pr06": {
		reject: [
			{ sql: "CREATE POLICY p ON readers FOR SELECT TO archivist USING (clearance <= 2);", why: "RLS not enabled" },
		],
	},
	"ch42-pr07": {
		reject: [
			{
				sql: "ALTER TABLE scrolls ENABLE ROW LEVEL SECURITY; CREATE POLICY r ON scrolls FOR SELECT TO archivist USING (true); CREATE POLICY u ON scrolls FOR UPDATE TO archivist USING (true);",
				why: "USING (true) without WITH CHECK lets the promotion through",
			},
		],
	},
	"ch42-pr08": {
		reject: [
			{
				sql: "INSERT INTO visit_counts VALUES (4, 1) ON CONFLICT (reader_id) DO UPDATE SET visits = EXCLUDED.visits + 1; INSERT INTO visit_counts VALUES (4, 1) ON CONFLICT (reader_id) DO UPDATE SET visits = EXCLUDED.visits + 1; INSERT INTO visit_counts VALUES (4, 1) ON CONFLICT (reader_id) DO UPDATE SET visits = EXCLUDED.visits + 1; INSERT INTO visit_counts VALUES (1, 1) ON CONFLICT (reader_id) DO UPDATE SET visits = EXCLUDED.visits + 1;",
				why: "EXCLUDED.visits is the proposed 1, not the stored count",
			},
		],
	},
	"ch42-pr09": {
		reject: [
			{ sql: "DROP TRIGGER scrolls_positive_pages ON scrolls;", why: "rule dropped, not replaced" },
			{
				sql: "ALTER TABLE scrolls ADD CONSTRAINT c CHECK (page_count > 0);",
				why: "the hidden trigger is still there",
			},
		],
	},
};

export default cases;
