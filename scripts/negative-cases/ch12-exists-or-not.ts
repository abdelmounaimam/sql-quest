// Negative and accept cases for ch12-exists-or-not.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch12-exists-or-not/lesson-8": {
		reject: [{ sql: "SELECT q.id, q.title FROM quests q JOIN quest_completions qc ON qc.quest_id = q.id;", why: "JOIN duplicates quests" }],
		accept: ["SELECT id, title FROM quests WHERE id IN (SELECT quest_id FROM quest_completions);"],
	},
	"ch12-ex01": {
		reject: [
			{ sql: "SELECT h.name FROM heroes h JOIN quest_completions qc ON qc.hero_id = h.id;", why: "JOIN without DISTINCT duplicates heroes" },
			{ sql: "SELECT h.name FROM heroes h WHERE EXISTS (SELECT 1 FROM quest_completions);", why: "EXISTS without correlation is always true" },
		],
		accept: [
			"SELECT name FROM heroes WHERE id IN (SELECT hero_id FROM quest_completions);",
			"SELECT h.name FROM heroes h WHERE EXISTS (SELECT qc.completed_at, qc.party_size FROM quest_completions qc WHERE qc.hero_id = h.id);",
		],
	},
	"ch12-ex02": {
		reject: [
			{ sql: "SELECT h.name FROM heroes h WHERE NOT EXISTS (SELECT 1 FROM quest_completions);", why: "no correlation: never true" },
			{ sql: "SELECT h.name FROM heroes h LEFT JOIN quest_completions qc ON qc.hero_id = h.id WHERE qc.party_size IS NULL;", why: "IS NULL on a nullable column" },
		],
		accept: [
			"SELECT h.name FROM heroes h LEFT JOIN quest_completions qc ON qc.hero_id = h.id WHERE qc.hero_id IS NULL;",
			"SELECT name FROM heroes WHERE id NOT IN (SELECT hero_id FROM quest_completions);",
		],
	},
	"ch12-ex03": {
		reject: [
			{ sql: "SELECT id, name FROM heroes WHERE id NOT IN (SELECT id FROM heroes WHERE mentor_id IS NOT NULL);", why: "heroes who have no mentor, not heroes who mentor no one" },
			{ sql: "SELECT h.id, h.name FROM heroes h WHERE NOT EXISTS (SELECT 1 FROM heroes a WHERE a.mentor_id = a.id);", why: "correlation on the wrong alias" },
		],
		accept: [
			"SELECT id, name FROM heroes WHERE id NOT IN (SELECT mentor_id FROM heroes WHERE mentor_id IS NOT NULL);",
			"SELECT h.id, h.name FROM heroes h LEFT JOIN heroes a ON a.mentor_id = h.id WHERE a.id IS NULL;",
		],
	},
	"ch12-ex04": {
		reject: [
			{ sql: "SELECT q.id, q.title FROM quests q LEFT JOIN quest_completions qc ON qc.quest_id = q.id WHERE qc.party_size IS NULL;", why: "IS NULL on nullable party_size" },
			{ sql: "SELECT q.id, q.title FROM quests q LEFT JOIN quest_completions qc ON qc.quest_id = q.id AND qc.quest_id IS NULL;", why: "anti condition in ON keeps every quest" },
		],
		accept: [
			"SELECT q.id, q.title FROM quest_completions qc RIGHT JOIN quests q ON q.id = qc.quest_id WHERE qc.hero_id IS NULL;",
			"SELECT q.id, q.title FROM quests q WHERE NOT EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.quest_id = q.id);",
		],
	},
	"ch12-ex05": {
		reject: [
			{ sql: "SELECT g.name FROM guilds g JOIN heroes h ON h.guild_id = g.id WHERE h.level >= 15;", why: "JOIN duplicates guilds" },
			{ sql: "SELECT g.name FROM guilds g WHERE EXISTS (SELECT 1 FROM heroes h WHERE h.level >= 15);", why: "uncorrelated: every guild" },
			{ sql: "SELECT g.name FROM guilds g WHERE EXISTS (SELECT 1 FROM heroes h WHERE h.guild_id = g.id) AND EXISTS (SELECT 1 FROM heroes h WHERE h.level >= 15);", why: "level test not tied to the guild" },
		],
		accept: [
			"SELECT DISTINCT g.name FROM guilds g JOIN heroes h ON h.guild_id = g.id WHERE h.level >= 15;",
			"SELECT name FROM guilds WHERE id IN (SELECT guild_id FROM heroes WHERE level >= 15);",
		],
	},
	"ch12-ex06": {
		reject: [
			{ sql: "SELECT id, title, difficulty FROM quests WHERE difficulty > ANY (SELECT difficulty FROM quests WHERE region = 'Highmoor');", why: "ANY instead of ALL" },
			{ sql: "SELECT id, title, difficulty FROM quests WHERE difficulty >= ALL (SELECT difficulty FROM quests WHERE region = 'Highmoor');", why: ">= keeps difficulty 4" },
		],
		accept: ["SELECT id, title, difficulty FROM quests WHERE difficulty > (SELECT max(difficulty) FROM quests WHERE region = 'Highmoor');"],
	},
	"ch12-ex07": {
		reject: [
			{ sql: "SELECT id, name FROM heroes WHERE 'scout' IN (tags);", why: "IN (array) compares with the whole array" },
			{ sql: "SELECT id, name FROM heroes WHERE tags = '{scout}';", why: "only heroes whose only tag is scout" },
		],
		accept: ["SELECT id, name FROM heroes WHERE tags @> ARRAY['scout'];", "SELECT id, name FROM heroes WHERE 'scout' = SOME (tags);"],
	},
	"ch12-ex08": {
		reject: [
			{ sql: "SELECT h.name FROM heroes h WHERE EXISTS (SELECT 1 FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id WHERE q.region = 'Highmoor');", why: "EXISTS without correlation" },
		],
		accept: [
			"SELECT DISTINCT h.name FROM heroes h JOIN quest_completions qc ON qc.hero_id = h.id JOIN quests q ON q.id = qc.quest_id WHERE q.region = 'Highmoor';",
			"SELECT name FROM heroes WHERE id IN (SELECT qc.hero_id FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id WHERE q.region = 'Highmoor');",
		],
	},
	"ch12-ex09": {
		reject: [
			{ sql: "SELECT g.name, (SELECT count(*) FROM heroes h WHERE h.guild_id = g.id) FROM guilds g WHERE g.id NOT IN (SELECT h.guild_id FROM heroes h JOIN quest_completions qc ON qc.hero_id = h.id JOIN quests q ON q.id = qc.quest_id WHERE q.is_secret);", why: "NOT IN poisoned by Nyx's NULL guild" },
			{ sql: "SELECT g.name, (SELECT count(*) FROM heroes h WHERE h.guild_id = g.id) FROM guilds g WHERE NOT EXISTS (SELECT 1 FROM heroes h JOIN quest_completions qc ON qc.hero_id = h.id JOIN quests q ON q.id = qc.quest_id WHERE h.guild_id = g.id AND q.is_secret);", why: "keeps the empty guild" },
			{ sql: "SELECT g.name, count(*) FROM guilds g JOIN heroes h ON h.guild_id = g.id JOIN quest_completions qc ON qc.hero_id = h.id JOIN quests q ON q.id = qc.quest_id WHERE NOT q.is_secret GROUP BY g.name;", why: "guilds with a non-secret completion, counted per completion" },
		],
		accept: [
			"SELECT g.name, count(*) FROM guilds g JOIN heroes h ON h.guild_id = g.id WHERE NOT EXISTS (SELECT 1 FROM heroes x JOIN quest_completions qc ON qc.hero_id = x.id JOIN quests q ON q.id = qc.quest_id WHERE x.guild_id = g.id AND q.is_secret) GROUP BY g.id, g.name;",
			"SELECT g.name, count(*) FROM guilds g JOIN heroes h ON h.guild_id = g.id WHERE g.id NOT IN (SELECT h2.guild_id FROM heroes h2 JOIN quest_completions qc ON qc.hero_id = h2.id JOIN quests q ON q.id = qc.quest_id WHERE q.is_secret AND h2.guild_id IS NOT NULL) GROUP BY g.name;",
		],
	},
	"ch12-pr01": {
		reject: [{ sql: "SELECT g.name FROM guilds g WHERE EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.quest_id = 8);", why: "no correlation to the guild" }],
		accept: ["SELECT g.name FROM guilds g WHERE g.id IN (SELECT h.guild_id FROM heroes h JOIN quest_completions qc ON qc.hero_id = h.id WHERE qc.quest_id = 8);"],
	},
	"ch12-pr02": {
		reject: [{ sql: "SELECT name FROM guilds WHERE id NOT IN (SELECT guild_id FROM heroes);", why: "NOT IN trap: wanderers have NULL guild_id" }],
		accept: ["SELECT g.name FROM guilds g LEFT JOIN heroes h ON h.guild_id = g.id WHERE h.id IS NULL;"],
	},
	"ch12-pr03": {
		reject: [{ sql: "SELECT h.name FROM heroes h WHERE NOT EXISTS (SELECT 1 FROM rumors r WHERE r.teller_id = h.id);", why: "tellers instead of listeners" }],
		accept: ["SELECT name FROM heroes WHERE id NOT IN (SELECT listener_id FROM rumors);"],
	},
	"ch12-pr04": {
		accept: [
			"SELECT id, title FROM quests WHERE id NOT IN (SELECT prerequisite_quest_id FROM quests WHERE prerequisite_quest_id IS NOT NULL);",
			"SELECT q.id, q.title FROM quests q LEFT JOIN quests n ON n.prerequisite_quest_id = q.id WHERE n.id IS NULL;",
		],
		reject: [{ sql: "SELECT id, title FROM quests WHERE prerequisite_quest_id IS NULL;", why: "starting quests, not dead ends" }],
	},
	"ch12-pr05": {
		reject: [{ sql: "SELECT 1;", why: "expects the empty guild to be found" }],
		accept: ["SELECT count(*) FROM guilds WHERE id NOT IN (SELECT guild_id FROM heroes);"],
	},
	"ch12-pr06": {
		reject: [{ sql: "SELECT name, level FROM heroes WHERE level > ALL (SELECT level FROM heroes WHERE guild_id = 5);", why: "ALL instead of ANY" }],
		accept: ["SELECT name, level FROM heroes WHERE level > (SELECT min(level) FROM heroes WHERE guild_id = 5);"],
	},
	"ch12-pr07": {
		reject: [{ sql: "SELECT title, reward_gold FROM quests WHERE reward_gold > ALL (SELECT reward_gold FROM quests WHERE region = 'Mistwood');", why: "strict > drops Heart of the Mist" }],
		accept: ["SELECT title, reward_gold FROM quests WHERE reward_gold >= (SELECT max(reward_gold) FROM quests WHERE region = 'Mistwood');"],
	},
};

export default cases;
