import type { CaseSet } from "../validate-content";

const BASE = `CREATE TABLE reward_ledger (reward_id int PRIMARY KEY, hero_id int NOT NULL, amount numeric(10,2) NOT NULL);
CREATE TABLE gold_audit (hero_id int, old_gold numeric(10,2), new_gold numeric(10,2));
CREATE FUNCTION log_gold() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO gold_audit VALUES (NEW.id, OLD.gold, NEW.gold); RETURN NULL; END $$;
CREATE TRIGGER t AFTER UPDATE ON heroes FOR EACH ROW WHEN (OLD.gold IS DISTINCT FROM NEW.gold) EXECUTE FUNCTION log_gold();`;

const TAIL = `ALTER TABLE heroes ENABLE ROW LEVEL SECURITY;
CREATE POLICY p ON heroes FOR SELECT TO guild_master_1 USING (guild_id = 1);
CREATE VIEW guild_leaderboard AS SELECT g.name AS guild, h.name AS hero, h.xp, dense_rank() OVER (PARTITION BY g.id ORDER BY h.xp DESC) AS place FROM heroes h JOIN guilds g ON g.id = h.guild_id;`;

const NAIVE_PAYOUT = `INSERT INTO reward_ledger SELECT reward_id, hero_id, amount FROM gold_rewards ON CONFLICT DO NOTHING;
UPDATE heroes h SET gold = coalesce(h.gold, 0) + r.amount FROM gold_rewards r WHERE h.id = r.hero_id;`;

const GOOD_PAYOUT = `WITH paid AS (INSERT INTO reward_ledger SELECT reward_id, hero_id, amount FROM gold_rewards ON CONFLICT (reward_id) DO NOTHING RETURNING hero_id, amount)
UPDATE heroes h SET gold = coalesce(h.gold, 0) + (SELECT sum(amount) FROM paid p WHERE p.hero_id = h.id) WHERE h.id IN (SELECT hero_id FROM paid);`;

const cases: Record<string, CaseSet> = {
	"ch43-trials-of-mastery/lesson-6": {
		reject: [{ sql: "SELECT unit FROM pg_settings WHERE name = 'shared_buffers';", why: "unit, not context" }],
	},
	"ch43-ex01": {
		reject: [
			{
				sql: "SELECT guild, hero, xp FROM (SELECT g.name AS guild, h.name AS hero, h.xp, rank() OVER (PARTITION BY g.id ORDER BY h.xp DESC) AS rk FROM heroes h JOIN guilds g ON g.id = h.guild_id) x WHERE rk <= 3;",
				why: "rank() lets four heroes onto Ember Fang's podium",
			},
			{
				sql: "SELECT guild, hero, xp FROM (SELECT g.name AS guild, h.name AS hero, h.xp, row_number() OVER (PARTITION BY g.id ORDER BY h.xp DESC, h.name DESC) AS rn FROM heroes h JOIN guilds g ON g.id = h.guild_id) x WHERE rn <= 3;",
				why: "tie broken Z to A",
			},
		],
		accept: [
			"SELECT g.name, t.name, t.xp FROM guilds g CROSS JOIN LATERAL (SELECT name, xp FROM heroes h WHERE h.guild_id = g.id ORDER BY xp DESC, name LIMIT 3) t",
		],
	},
	"ch43-ex02": {
		reject: [
			{
				sql: "SELECT DISTINCT h.name FROM heroes h JOIN guilds g ON g.id = h.guild_id JOIN quest_completions c ON c.hero_id = h.id JOIN quests q ON q.id = c.quest_id WHERE q.region = g.hall_region;",
				why: "at least one home quest, not every one",
			},
		],
		accept: [
			"SELECT h.name FROM heroes h JOIN guilds g ON g.id = h.guild_id JOIN quest_completions c ON c.hero_id = h.id JOIN quests q ON q.id = c.quest_id AND q.region = g.hall_region GROUP BY h.id, h.name, g.hall_region HAVING count(*) = (SELECT count(*) FROM quests q2 WHERE q2.region = g.hall_region)",
		],
	},
	"ch43-ex03": {
		reject: [
			{
				sql: "WITH RECURSIVE l AS (SELECT id, name, name AS root, 1 AS depth FROM heroes WHERE mentor_id IS NULL UNION ALL SELECT h.id, h.name, l.root, l.depth + 1 FROM heroes h JOIN l ON h.mentor_id = l.id) SELECT name, root, depth FROM l;",
				why: "depth starts at 1",
			},
			{
				sql: "SELECT h.name, coalesce(m.name, h.name), CASE WHEN m.id IS NULL THEN 0 ELSE 1 END FROM heroes h LEFT JOIN heroes m ON m.id = h.mentor_id;",
				why: "direct mentor, not the root",
			},
		],
		accept: [
			"WITH RECURSIVE up AS (SELECT id AS hero, id AS cur, mentor_id, 0 AS steps FROM heroes UNION ALL SELECT u.hero, h.id, h.mentor_id, u.steps + 1 FROM up u JOIN heroes h ON h.id = u.mentor_id) SELECT h.name, r.name, u.steps FROM up u JOIN heroes h ON h.id = u.hero JOIN heroes r ON r.id = u.cur WHERE u.mentor_id IS NULL",
		],
	},
	"ch43-ex04": {
		reject: [
			{
				sql: "UPDATE inventories SET doc = replace(doc::text, '\"healing potion\"', '\"Healing Potion\"')::jsonb;",
				why: "renames without merging Hilde's two lines",
			},
		],
	},
	"ch43-ex05": {
		reject: [
			{
				sql: "SELECT relname, pg_relation_size(relid) FROM pg_stat_user_tables ORDER BY 2 DESC, 1 LIMIT 3;",
				why: "heap only, indexes ignored",
			},
		],
		accept: [
			"SELECT c.relname, pg_total_relation_size(c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 2 DESC, 1 LIMIT 3",
		],
	},
	"ch43-ex06": {
		reject: [
			{
				sql: "WITH RECURSIVE r AS (SELECT to_region, ARRAY['Highmoor', to_region] AS path, toll AS total FROM portals WHERE from_region = 'Highmoor' UNION ALL SELECT p.to_region, r.path || p.to_region, r.total + p.toll FROM r JOIN portals p ON p.from_region = r.to_region WHERE p.to_region <> ALL (r.path)) SELECT path, total FROM r WHERE to_region = 'Frostspire' ORDER BY cardinality(path), total DESC LIMIT 1;",
				why: "fewest hops, not cheapest",
			},
		],
		accept: [
			"WITH RECURSIVE r(region, path, total) AS (SELECT 'Highmoor'::text, ARRAY['Highmoor']::text[], 0 UNION ALL SELECT p.to_region, r.path || p.to_region, r.total + p.toll FROM r JOIN portals p ON p.from_region = r.region WHERE NOT p.to_region = ANY (r.path)) SELECT path, total FROM r WHERE region = 'Frostspire' ORDER BY total FETCH FIRST 1 ROW ONLY",
		],
	},
	"ch43-ex07": {
		reject: [
			{ sql: `${BASE}\n${NAIVE_PAYOUT}\n${NAIVE_PAYOUT}\n${TAIL}`, why: "UPDATE FROM pays one reward per hero and pays again on the rerun" },
			{
				sql: `${BASE}\n${GOOD_PAYOUT}\n${GOOD_PAYOUT}\nCREATE POLICY p ON heroes FOR SELECT TO guild_master_1 USING (guild_id = 1);\nCREATE VIEW guild_leaderboard AS SELECT g.name AS guild, h.name AS hero, h.xp, dense_rank() OVER (PARTITION BY g.id ORDER BY h.xp DESC) AS place FROM heroes h JOIN guilds g ON g.id = h.guild_id;`,
				why: "RLS never enabled",
			},
			{
				sql: `${BASE}\n${GOOD_PAYOUT}\n${GOOD_PAYOUT}\nALTER TABLE heroes ENABLE ROW LEVEL SECURITY;\nCREATE POLICY p ON heroes FOR SELECT TO guild_master_1 USING (guild_id = 1);\nCREATE VIEW guild_leaderboard AS SELECT g.name AS guild, h.name AS hero, h.xp, rank() OVER (PARTITION BY g.id ORDER BY h.xp DESC) AS place FROM heroes h JOIN guilds g ON g.id = h.guild_id;`,
				why: "rank() leaves a gap after ties",
			},
		],
		accept: [`${BASE}\n${GOOD_PAYOUT}\n${GOOD_PAYOUT}\n${TAIL}`],
	},
};

export default cases;
