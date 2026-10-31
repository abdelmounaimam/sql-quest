import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch27-lenses-and-realms/lesson-8": {
		reject: [{ sql: "CREATE VIEW wanderers AS SELECT name, level FROM heroes WHERE guild_id = NULL;", why: "= NULL matches nothing" }],
		accept: ["CREATE OR REPLACE VIEW wanderers (name, level) AS SELECT h.name, h.level FROM heroes h WHERE h.guild_id IS NULL"],
	},
	"ch27-ex01": {
		reject: [
			{ sql: "CREATE TABLE guild_rosters AS SELECT g.name AS guild, h.name AS hero, h.class FROM heroes h JOIN guilds g ON g.id = h.guild_id;", why: "a frozen copy" },
			{ sql: "CREATE VIEW guild_rosters AS SELECT g.name AS guild, h.name AS hero, h.class FROM heroes h LEFT JOIN guilds g ON g.id = h.guild_id;", why: "wanderers included" },
			{ sql: "CREATE VIEW guild_rosters AS SELECT g.name, h.name AS hero, h.class FROM heroes h JOIN guilds g ON g.id = h.guild_id;", why: "column not named guild" },
		],
		accept: ["CREATE VIEW guild_rosters (guild, hero, class) AS SELECT g.name, h.name, h.class FROM guilds g, heroes h WHERE h.guild_id = g.id;"],
	},
	"ch27-ex02": {
		reject: [
			{ sql: "CREATE VIEW apprentices AS SELECT id, name, class, level, joined_on FROM heroes WHERE level < 10;", why: "no CHECK OPTION" },
			{ sql: "CREATE VIEW apprentices AS SELECT id, name, class, level, joined_on FROM heroes WHERE level <= 10 WITH CHECK OPTION;", why: "level 10 included" },
		],
		accept: ["CREATE VIEW apprentices WITH (check_option = cascaded) AS SELECT id, name, class, level, joined_on FROM heroes WHERE level BETWEEN 1 AND 9;"],
	},
	"ch27-ex03": {
		reject: [
			{ sql: "CREATE MATERIALIZED VIEW quest_board AS SELECT q.title, count(c.hero_id) AS completions FROM quests q LEFT JOIN quest_completions c ON c.quest_id = q.id GROUP BY q.id, q.title;\nINSERT INTO quest_completions (hero_id, quest_id, completed_at) VALUES (24, 1, '2026-10-31 12:00+00');", why: "no refresh: stale board" },
			{ sql: "CREATE VIEW quest_board AS SELECT q.title, count(c.hero_id) AS completions FROM quests q LEFT JOIN quest_completions c ON c.quest_id = q.id GROUP BY q.id, q.title;\nINSERT INTO quest_completions (hero_id, quest_id, completed_at) VALUES (24, 1, '2026-10-31 12:00+00');", why: "plain view" },
			{ sql: "CREATE MATERIALIZED VIEW quest_board AS SELECT q.title, count(*) AS completions FROM quests q JOIN quest_completions c ON c.quest_id = q.id GROUP BY q.title;\nINSERT INTO quest_completions (hero_id, quest_id, completed_at) VALUES (24, 1, '2026-10-31 12:00+00');\nREFRESH MATERIALIZED VIEW quest_board;", why: "unfinished quests missing" },
			{ sql: "CREATE MATERIALIZED VIEW quest_board AS SELECT q.title, count(*) AS completions FROM quests q LEFT JOIN quest_completions c ON c.quest_id = q.id GROUP BY q.title;\nINSERT INTO quest_completions (hero_id, quest_id, completed_at) VALUES (24, 1, '2026-10-31 12:00+00');\nREFRESH MATERIALIZED VIEW quest_board;", why: "count(*) gives 1 to unfinished quests" },
		],
		accept: ["INSERT INTO quest_completions VALUES (24, 1, '2026-10-31 12:00:00 UTC', NULL);\nCREATE MATERIALIZED VIEW quest_board AS SELECT title, (SELECT count(*) FROM quest_completions c WHERE c.quest_id = q.id) AS completions FROM quests q;"],
	},
	"ch27-ex04": {
		reject: [{ sql: "REFRESH MATERIALIZED VIEW region_rewards;", why: "plain refresh succeeds" }],
	},
	"ch27-ex05": {
		reject: [
			{ sql: "CREATE SCHEMA archive;\nCREATE TABLE archive.adventurer_sheet_legacy AS SELECT * FROM adventurer_sheet_legacy;\nCREATE TABLE archive.hero_attributes AS SELECT * FROM hero_attributes;", why: "copies, originals stay in public" },
			{ sql: "CREATE SCHEMA archive;\nALTER TABLE hero_attributes SET SCHEMA archive;", why: "sheets not moved" },
		],
		accept: ["CREATE SCHEMA IF NOT EXISTS archive;\nALTER TABLE IF EXISTS hero_attributes SET SCHEMA archive;\nALTER TABLE IF EXISTS adventurer_sheet_legacy SET SCHEMA archive;"],
	},
	"ch27-ex06": {
		reject: [{ sql: "SET search_path TO public, archive;\nSELECT attr, count(value) FROM hero_attributes GROUP BY attr;", why: "count(value) skips NULLs" }],
		accept: [
			"SELECT attr, count(*) FROM archive.hero_attributes GROUP BY attr;",
			"SET search_path = archive, public;\nSELECT attr, count(*) AS entries FROM hero_attributes GROUP BY 1;",
		],
	},
	"ch27-ex07": {
		reject: [
			{ sql: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'heroes' ORDER BY column_name;", why: "alphabetical, not table order" },
			{ sql: "SELECT column_name, udt_name, is_nullable FROM information_schema.columns WHERE table_name = 'heroes' ORDER BY ordinal_position;", why: "udt_name instead of data_type" },
		],
		accept: ["SELECT c.column_name, c.data_type, c.is_nullable FROM information_schema.columns AS c WHERE c.table_name = 'heroes' AND c.table_schema = 'public' ORDER BY c.ordinal_position;"],
	},
	"ch27-ex08": {
		reject: [
			{ sql: "CREATE VIEW fk_map AS SELECT conrelid::regclass::text AS table_name, count(DISTINCT confrelid) AS fk_count, string_agg(DISTINCT confrelid::regclass::text, ', ' ORDER BY confrelid::regclass::text) AS referenced FROM pg_constraint WHERE contype = 'f' GROUP BY conrelid;\nSELECT * FROM fk_map ORDER BY table_name;", why: "counts referenced tables, not constraints" },
			{ sql: "CREATE VIEW fk_map AS SELECT conrelid::regclass::text AS table_name, count(*) AS fk_count, string_agg(confrelid::regclass::text, ', ' ORDER BY confrelid::regclass::text) AS referenced FROM pg_constraint WHERE contype = 'f' GROUP BY conrelid;\nSELECT * FROM fk_map ORDER BY table_name;", why: "heroes listed twice for rumors" },
			{ sql: "CREATE VIEW fk_map AS SELECT * FROM (VALUES ('hero_attributes', 1, 'heroes'), ('hero_titles', 1, 'heroes'), ('heroes', 2, 'guilds, heroes'), ('inventories', 1, 'heroes'), ('quest_completions', 2, 'heroes, quests'), ('quests', 1, 'quests'), ('rumors', 2, 'heroes'), ('skill_tree', 1, 'skill_tree')) AS v(table_name, fk_count, referenced);\nSELECT * FROM fk_map ORDER BY table_name;", why: "hand typed: does not see new tables" },
		],
		accept: [
			"CREATE VIEW fk_map AS SELECT tc.table_name::text AS table_name, count(DISTINCT tc.constraint_name) AS fk_count, string_agg(DISTINCT ccu.table_name::text, ', ' ORDER BY ccu.table_name::text) AS referenced FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' GROUP BY tc.table_name;\nSELECT * FROM fk_map ORDER BY 1;",
		],
	},
	"ch27-pr01": {
		reject: [{ sql: "CREATE OR REPLACE VIEW hero_cards AS SELECT name, gold, level FROM heroes;", why: "gold not at the end (fails)" }],
		accept: ["DROP VIEW hero_cards;\nCREATE VIEW hero_cards AS SELECT name, level, gold FROM heroes;"],
	},
	"ch27-pr04": {
		reject: [{ sql: "REFRESH MATERIALIZED VIEW region_rewards;", why: "no unique index" }],
		accept: ["CREATE UNIQUE INDEX ON region_rewards (region);\nREFRESH MATERIALIZED VIEW region_rewards;\nREFRESH MATERIALIZED VIEW CONCURRENTLY region_rewards;"],
	},
	"ch27-pr05": {
		reject: [{ sql: "CREATE SCHEMA vault;\nCREATE TABLE relics (name text);\nINSERT INTO relics VALUES ('Silver Scale');", why: "table lands in public" }],
		accept: ["CREATE SCHEMA vault;\nSET search_path TO vault, public;\nCREATE TABLE relics (name text);\nINSERT INTO relics VALUES ('Silver Scale');"],
	},
	"ch27-pr07": {
		reject: [{ sql: "COMMENT ON TABLE quests IS 'Missions';\nSELECT obj_description('quests'::regclass, 'pg_class');", why: "wrong text" }],
	},
};

export default cases;
