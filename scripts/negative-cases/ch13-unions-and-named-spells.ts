// Negative and accept cases for ch13-unions-and-named-spells.
import type { CaseSet } from "../validate-content";

const bossCtes =
	"WITH regions AS (SELECT region FROM quests UNION SELECT hall_region FROM guilds), hc AS (SELECT g.hall_region AS region, count(*) AS n FROM heroes h JOIN guilds g ON g.id = h.guild_id GROUP BY g.hall_region), qc AS (SELECT region, count(*) AS n FROM quests GROUP BY region), cc AS (SELECT q.region, count(*) AS n FROM quest_completions x JOIN quests q ON q.id = x.quest_id GROUP BY q.region)";

const cases: Record<string, CaseSet> = {
	"ch13-unions-and-named-spells/lesson-9": {
		reject: [
			{ sql: "SELECT d, count(*) FROM generate_series(1, 5) AS d LEFT JOIN quests q ON q.difficulty = d AND q.region = 'Highmoor' GROUP BY d;", why: "count(*) gives 1 to the empty difficulty" },
			{ sql: "SELECT d, count(q.id) FROM generate_series(1, 5) AS d LEFT JOIN quests q ON q.difficulty = d WHERE q.region = 'Highmoor' GROUP BY d;", why: "region filter in WHERE drops difficulty 5" },
		],
		accept: ["SELECT s.n, (SELECT count(*) FROM quests q WHERE q.difficulty = s.n AND q.region = 'Highmoor') FROM generate_series(1, 5) AS s(n);"],
	},
	"ch13-ex01": {
		reject: [{ sql: "SELECT region FROM quests UNION ALL SELECT hall_region FROM guilds;", why: "UNION ALL keeps duplicates" }],
		accept: [
			"SELECT DISTINCT region FROM quests UNION SELECT DISTINCT hall_region FROM guilds;",
			"SELECT DISTINCT r FROM (SELECT region AS r FROM quests UNION ALL SELECT hall_region FROM guilds) x;",
		],
	},
	"ch13-ex02": {
		reject: [
			{ sql: "SELECT hall_region FROM guilds EXCEPT SELECT region FROM quests;", why: "operands reversed" },
			{ sql: "SELECT region FROM quests EXCEPT ALL SELECT hall_region FROM guilds;", why: "EXCEPT ALL keeps leftover duplicates" },
		],
		accept: ["SELECT DISTINCT region FROM quests q WHERE NOT EXISTS (SELECT 1 FROM guilds g WHERE g.hall_region = q.region);"],
	},
	"ch13-ex03": {
		reject: [
			{ sql: "SELECT reward_gold AS amount FROM quests UNION ALL SELECT gold FROM heroes;", why: "NULL gold kept" },
			{ sql: "SELECT reward_gold FROM quests UNION ALL SELECT gold FROM heroes WHERE gold IS NOT NULL UNION SELECT 0 WHERE false;", why: "a trailing UNION deduplicates everything again" },
		],
		accept: ["SELECT gold AS amount FROM heroes WHERE gold IS NOT NULL UNION ALL SELECT reward_gold FROM quests;"],
	},
	"ch13-ex04": {
		reject: [
			{ sql: "SELECT b.title, q.region, b.bonus FROM (VALUES ('Rats in the Cellar', 5), ('Yeti Tracks', 40), ('Dragon Tea Party', 99)) AS b(title, bonus) LEFT JOIN quests q ON q.title = b.title;", why: "keeps the invented quest" },
			{ sql: "SELECT q.title, q.region, b.bonus FROM (VALUES ('Rats in the Cellar', 5), ('Yeti Tracks', 40), ('Dragon Tea Party', 99)) AS b(bonus, title) JOIN quests q ON q.title = b.title;", why: "column names in the wrong order" },
		],
		accept: [
			"SELECT q.title, q.region, b.column2 FROM (VALUES ('Rats in the Cellar', 5), ('Yeti Tracks', 40), ('Dragon Tea Party', 99)) AS b JOIN quests q ON q.title = b.column1;",
			"WITH board(title, bonus) AS (VALUES ('Rats in the Cellar', 5), ('Yeti Tracks', 40), ('Dragon Tea Party', 99)) SELECT q.title, q.region, board.bonus FROM board JOIN quests q USING (title);",
		],
	},
	"ch13-ex05": {
		reject: [
			{ sql: "WITH earned AS (SELECT qc.hero_id, sum(q.reward_gold) AS total FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id GROUP BY qc.hero_id) SELECT h.name, e.total FROM earned e JOIN heroes h ON h.id = e.hero_id WHERE e.total > (SELECT avg(q.reward_gold) FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id);", why: "average per completion, not per hero" },
			{ sql: "WITH earned AS (SELECT qc.hero_id, sum(q.reward_gold) AS total FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id GROUP BY qc.hero_id) SELECT h.name, e.total FROM earned e JOIN heroes h ON h.id = e.hero_id WHERE e.total >= (SELECT min(total) FROM earned);", why: "every earner" },
		],
		accept: [
			"SELECT h.name, t.total FROM heroes h JOIN (SELECT qc.hero_id, sum(q.reward_gold) AS total FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id GROUP BY qc.hero_id) t ON t.hero_id = h.id WHERE t.total > (SELECT avg(s) FROM (SELECT sum(q.reward_gold) AS s FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id GROUP BY qc.hero_id) z);",
			"WITH earned AS (SELECT qc.hero_id, sum(q.reward_gold) AS total FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id GROUP BY qc.hero_id), bar AS (SELECT avg(total) AS a FROM earned) SELECT h.name, e.total FROM earned e JOIN heroes h ON h.id = e.hero_id CROSS JOIN bar WHERE e.total > bar.a;",
		],
	},
	"ch13-ex06": {
		reject: [
			{ sql: "WITH veterans AS (SELECT id, name, guild_id FROM heroes WHERE level > 15) SELECT v.name, g.name FROM veterans v JOIN guilds g ON g.id = v.guild_id;", why: "level 15 excluded" },
			{ sql: "WITH veterans AS (SELECT id, name, guild_id FROM heroes WHERE level >= 15) SELECT v.name, g.name FROM veterans v LEFT JOIN guilds g ON g.id = v.guild_id;", why: "keeps Nyx, who has no guild" },
		],
		accept: [
			"SELECT h.name, g.name FROM heroes h JOIN guilds g ON g.id = h.guild_id WHERE h.level >= 15;",
			"SELECT v.name, g.name FROM (SELECT id, name, guild_id FROM heroes WHERE level >= 15) v JOIN guilds g ON g.id = v.guild_id;",
		],
	},
	"ch13-ex07": {
		reject: [
			{ sql: "SELECT h.level, count(*) FROM heroes h WHERE h.guild_id IS NULL GROUP BY h.level ORDER BY h.level;", why: "no series: empty levels missing" },
			{ sql: "SELECT s.lvl, count(*) FROM generate_series(1, 20) AS s(lvl) LEFT JOIN heroes h ON h.level = s.lvl AND h.guild_id IS NULL GROUP BY s.lvl ORDER BY s.lvl;", why: "count(*) gives 1 to empty levels" },
			{ sql: "SELECT s.lvl, count(h.id) FROM generate_series(1, 20) AS s(lvl) LEFT JOIN heroes h ON h.level = s.lvl WHERE h.guild_id IS NULL GROUP BY s.lvl ORDER BY s.lvl;", why: "filter in WHERE: levels whose heroes all have a guild vanish" },
			{ sql: "SELECT s.lvl, count(h.id) FROM generate_series(1, 20) AS s(lvl) JOIN heroes h ON h.level = s.lvl AND h.guild_id IS NULL GROUP BY s.lvl ORDER BY s.lvl;", why: "INNER JOIN on the series" },
			{ sql: "SELECT s.lvl, count(h.id) FROM generate_series(1, 20) AS s(lvl) LEFT JOIN heroes h ON h.level = s.lvl AND h.guild_id IS NULL GROUP BY s.lvl ORDER BY s.lvl DESC;", why: "wrong order" },
		],
		accept: ["SELECT lvl, (SELECT count(*) FROM heroes h WHERE h.level = lvl AND h.guild_id IS NULL) FROM generate_series(1, 20) AS lvl ORDER BY 1;"],
	},
	"ch13-ex08": {
		reject: [
			{ sql: "SELECT date_trunc('month', completed_at)::date, count(*) FROM quest_completions WHERE completed_at >= '2025-01-01' AND completed_at < '2026-01-01' GROUP BY 1;", why: "quiet months missing" },
			{ sql: "SELECT m::date, count(*) FROM generate_series(date '2025-01-01', date '2025-12-01', interval '1 month') AS m LEFT JOIN quest_completions qc ON qc.completed_at >= m AND qc.completed_at < m + interval '1 month' GROUP BY m;", why: "count(*) gives 1 to quiet months" },
		],
		accept: [
			"SELECT m::date, count(qc.quest_id) FROM generate_series(date '2025-01-01', date '2025-12-01', interval '1 month') AS m LEFT JOIN quest_completions qc ON date_trunc('month', qc.completed_at) = m GROUP BY m;",
			"SELECT make_date(2025, n, 1), (SELECT count(*) FROM quest_completions qc WHERE extract(year FROM qc.completed_at) = 2025 AND extract(month FROM qc.completed_at) = n) FROM generate_series(1, 12) AS n;",
		],
	},
	"ch13-ex09": {
		reject: [
			{ sql: "SELECT g.hall_region, count(h.id), count(DISTINCT q.id), count(c.quest_id) FROM guilds g LEFT JOIN heroes h ON h.guild_id = g.id LEFT JOIN quests q ON q.region = g.hall_region LEFT JOIN quest_completions c ON c.quest_id = q.id GROUP BY g.hall_region;", why: "one big join: fan-out and Frostspire missing" },
			{ sql: `${bossCtes} SELECT r.region, hc.n, qc.n, cc.n FROM regions r LEFT JOIN hc ON hc.region = r.region LEFT JOIN qc ON qc.region = r.region LEFT JOIN cc ON cc.region = r.region;`, why: "NULL instead of 0" },
			{ sql: `${bossCtes} SELECT r.region, COALESCE(hc.n, 0), COALESCE(qc.n, 0), COALESCE(cc.n, 0) FROM (SELECT hall_region AS region FROM guilds) r LEFT JOIN hc ON hc.region = r.region LEFT JOIN qc ON qc.region = r.region LEFT JOIN cc ON cc.region = r.region;`, why: "region list from guilds only: duplicates and no Frostspire" },
		],
		accept: [
			"SELECT r.region, (SELECT count(*) FROM heroes h JOIN guilds g ON g.id = h.guild_id WHERE g.hall_region = r.region), (SELECT count(*) FROM quests q WHERE q.region = r.region), (SELECT count(*) FROM quest_completions c JOIN quests q ON q.id = c.quest_id WHERE q.region = r.region) FROM (SELECT region FROM quests UNION SELECT hall_region FROM guilds) r;",
		],
	},
	"ch13-pr01": {
		reject: [{ sql: "SELECT region FROM quests UNION SELECT hall_region FROM guilds;", why: "UNION instead of INTERSECT" }],
		accept: ["SELECT DISTINCT q.region FROM quests q JOIN guilds g ON g.hall_region = q.region;"],
	},
	"ch13-pr02": {
		reject: [{ sql: "SELECT name, 'hero' FROM heroes UNION ALL SELECT name, 'guild' FROM guilds;", why: "columns in the wrong order" }],
	},
	"ch13-pr04": {
		reject: [{ sql: "WITH totals AS (SELECT guild_id, sum(gold) AS total FROM heroes GROUP BY guild_id) SELECT g.name, t.total FROM totals t JOIN guilds g ON g.id = t.guild_id;", why: "no filter above 1000" }],
		accept: ["SELECT g.name, sum(h.gold) FROM guilds g JOIN heroes h ON h.guild_id = g.id GROUP BY g.name HAVING sum(h.gold) > 1000;"],
	},
	"ch13-pr05": {
		reject: [{ sql: "SELECT d, count(q.id) FROM generate_series(1, 5) AS d LEFT JOIN quests q ON q.difficulty = d WHERE q.region = 'Frostspire' GROUP BY d;", why: "region filter in WHERE" }],
	},
	"ch13-pr06": {
		reject: [{ sql: "SELECT s.d::date, count(r.id) FROM generate_series(date '2025-10-01', date '2025-10-06', interval '1 day') AS s(d) LEFT JOIN rumors r ON r.told_at >= s.d AND r.told_at < s.d + interval '1 day' GROUP BY s.d;", why: "stops on 6 October" }],
		accept: ["SELECT s.d::date, count(r.id) FROM generate_series(date '2025-10-01', date '2025-10-07', interval '1 day') AS s(d) LEFT JOIN rumors r ON r.told_at::date = s.d::date GROUP BY s.d;"],
	},
};

export default cases;
