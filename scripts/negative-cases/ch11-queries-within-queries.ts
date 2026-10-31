// Negative and accept cases for ch11-queries-within-queries.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch11-queries-within-queries/lesson-8": {
		reject: [{ sql: "SELECT name, level FROM heroes WHERE level > (SELECT avg(level) FROM heroes WHERE guild_id IS NOT NULL);", why: "average of guild members only" }],
		accept: ["SELECT h.name, h.level FROM heroes h, (SELECT avg(level) AS a FROM heroes) s WHERE h.level > s.a;"],
	},
	"ch11-ex01": {
		reject: [
			{ sql: "SELECT name, gold, gold - (SELECT avg(COALESCE(gold, 0)) FROM heroes) FROM heroes WHERE gold > (SELECT avg(COALESCE(gold, 0)) FROM heroes);", why: "COALESCE(gold, 0) lowers the average" },
			{ sql: "SELECT name, gold, (SELECT avg(gold) FROM heroes) - gold FROM heroes WHERE gold > (SELECT avg(gold) FROM heroes);", why: "difference reversed" },
		],
		accept: [
			"SELECT h.name, h.gold, h.gold - a.avg_gold FROM heroes h CROSS JOIN (SELECT avg(gold) AS avg_gold FROM heroes) a WHERE h.gold > a.avg_gold;",
			"SELECT name, gold, round(gold - (SELECT avg(gold) FROM heroes), 4) FROM heroes WHERE gold > (SELECT avg(gold) FROM heroes);",
		],
	},
	"ch11-ex02": {
		reject: [{ sql: "SELECT name FROM heroes WHERE guild_id IN (SELECT id FROM guilds WHERE hall_region <> 'Highmoor');", why: "condition negated" }],
		accept: [
			"SELECT h.name FROM heroes h JOIN guilds g ON g.id = h.guild_id WHERE g.hall_region = 'Highmoor';",
			"SELECT name FROM heroes WHERE guild_id = ANY (SELECT id FROM guilds WHERE hall_region = 'Highmoor');",
		],
	},
	"ch11-ex03": {
		reject: [{ sql: "SELECT name FROM heroes WHERE guild_id = (SELECT id FROM guilds WHERE founded_on >= '2021-01-01' LIMIT 1);", why: "LIMIT 1 hides the other guilds" }],
		accept: ["SELECT h.name FROM heroes h JOIN guilds g ON g.id = h.guild_id WHERE g.founded_on >= '2021-01-01';"],
	},
	"ch11-ex04": {
		reject: [{ sql: "SELECT name, level, level - (SELECT max(level) FROM heroes) FROM heroes;", why: "negative difference" }],
		accept: ["SELECT h.name, h.level, m.top - h.level FROM heroes h CROSS JOIN (SELECT max(level) AS top FROM heroes) m;"],
	},
	"ch11-ex05": {
		reject: [
			{ sql: "SELECT guild_id, avg(level) FROM (SELECT guild_id, level FROM heroes WHERE level > 12) t GROUP BY guild_id;", why: "filters heroes before averaging" },
		],
		accept: [
			"SELECT guild_id, avg(level) FROM heroes GROUP BY guild_id HAVING avg(level) > 12;",
			"SELECT t.guild_id, t.a FROM (SELECT guild_id, avg(level) AS a FROM heroes GROUP BY guild_id) t WHERE t.a > 12.0;",
		],
	},
	"ch11-ex06": {
		reject: [
			{ sql: "SELECT h.name, (SELECT count(*) FROM quest_completions) FROM heroes h;", why: "no correlation: total for everyone" },
			{ sql: "SELECT h.name, count(*) FROM heroes h LEFT JOIN quest_completions qc ON qc.hero_id = h.id GROUP BY h.id, h.name;", why: "count(*) gives 1 to idle heroes" },
		],
		accept: ["SELECT h.name, count(qc.quest_id) FROM heroes h LEFT JOIN quest_completions qc ON qc.hero_id = h.id GROUP BY h.id, h.name;"],
	},
	"ch11-ex07": {
		reject: [
			{ sql: "SELECT title, region, reward_gold FROM quests WHERE reward_gold > (SELECT avg(reward_gold) FROM quests);", why: "uncorrelated: global average" },
			{ sql: "SELECT q.title, q.region, q.reward_gold FROM quests q WHERE q.reward_gold > (SELECT avg(reward_gold) FROM quests x WHERE region = region);", why: "unqualified columns: region = region is always true" },
		],
		accept: [
			"SELECT q.title, q.region, q.reward_gold FROM quests q JOIN (SELECT region, avg(reward_gold) AS a FROM quests GROUP BY region) r ON r.region = q.region WHERE q.reward_gold > r.a;",
		],
	},
	"ch11-ex08": {
		reject: [
			{ sql: "SELECT g.name, h.name, h.gold, m.members FROM (SELECT guild_id, max(gold) AS top, count(*) AS members FROM heroes GROUP BY guild_id) m JOIN guilds g ON g.id = m.guild_id JOIN heroes h ON h.gold = m.top;", why: "joined back on gold only: wrong guild" },
			{ sql: "SELECT g.name, h.name, h.gold, (SELECT count(x.gold) FROM heroes x WHERE x.guild_id = g.id) FROM guilds g JOIN heroes h ON h.guild_id = g.id WHERE h.gold = (SELECT max(x.gold) FROM heroes x WHERE x.guild_id = g.id);", why: "count(gold) skips Rhiannon" },
			{ sql: "SELECT g.name, h.name, h.gold, (SELECT count(*) FROM heroes x WHERE x.guild_id = g.id) FROM guilds g JOIN heroes h ON h.guild_id = g.id WHERE h.gold = (SELECT max(gold) FROM heroes);", why: "global max instead of per guild" },
		],
		accept: [
			"SELECT g.name, h.name, h.gold, m.members FROM (SELECT guild_id, max(gold) AS top, count(*) AS members FROM heroes GROUP BY guild_id) m JOIN guilds g ON g.id = m.guild_id JOIN heroes h ON h.guild_id = m.guild_id AND h.gold = m.top;",
		],
	},
	"ch11-pr01": {
		accept: ["SELECT title, reward_gold FROM quests WHERE reward_gold >= ALL (SELECT reward_gold FROM quests);"],
	},
	"ch11-pr02": {
		accept: ["SELECT h.name FROM heroes h JOIN quest_completions qc ON qc.hero_id = h.id WHERE qc.quest_id = 3;"],
	},
	"ch11-pr03": {
		reject: [{ sql: "SELECT name, rarity FROM items WHERE weight > 3;", why: "only the heavy items themselves" }],
	},
	"ch11-pr04": {
		reject: [{ sql: "SELECT quest_id, avg(party_size) FROM quest_completions GROUP BY quest_id HAVING avg(party_size) >= 3;", why: "3 itself included" }],
		accept: ["SELECT quest_id, avg(party_size) FROM quest_completions GROUP BY quest_id HAVING avg(party_size) > 3;"],
	},
	"ch11-pr05": {
		reject: [{ sql: "SELECT name, class, xp FROM heroes WHERE xp = (SELECT max(xp) FROM heroes);", why: "uncorrelated: global max" }],
	},
	"ch11-pr06": {
		reject: [{ sql: "SELECT g.name, max(h.joined_on) FROM guilds g JOIN heroes h ON h.guild_id = g.id GROUP BY g.name;", why: "inner join drops the empty guild" }],
		accept: ["SELECT g.name, max(h.joined_on) FROM guilds g LEFT JOIN heroes h ON h.guild_id = g.id GROUP BY g.id, g.name;"],
	},
};

export default cases;
