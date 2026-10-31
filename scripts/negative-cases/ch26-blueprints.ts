import type { CaseSet } from "../validate-content";

const TABLES =
	"CREATE TABLE legacy_guilds (guild_name text PRIMARY KEY, guild_hall text NOT NULL);\nCREATE TABLE legacy_sheets (sheet_id int PRIMARY KEY, hero_name text NOT NULL, guild_name text NOT NULL REFERENCES legacy_guilds);\nCREATE TABLE legacy_party (sheet_id int REFERENCES legacy_sheets, member text, PRIMARY KEY (sheet_id, member));\nCREATE TABLE legacy_items (sheet_id int REFERENCES legacy_sheets, slot int CHECK (slot BETWEEN 1 AND 3), item text NOT NULL, PRIMARY KEY (sheet_id, slot));\n";
const GUILDS_MODE =
	"INSERT INTO legacy_guilds SELECT guild_name, mode() WITHIN GROUP (ORDER BY guild_hall) FROM adventurer_sheet_legacy GROUP BY guild_name;\n";
const GUILDS_MIN =
	"INSERT INTO legacy_guilds SELECT guild_name, min(guild_hall) FROM adventurer_sheet_legacy GROUP BY guild_name;\n";
const SHEETS = "INSERT INTO legacy_sheets SELECT sheet_id, hero_name, guild_name FROM adventurer_sheet_legacy;\n";
const PARTY =
	"INSERT INTO legacy_party SELECT sheet_id, trim(m) FROM adventurer_sheet_legacy, regexp_split_to_table(party_members, ',') m WHERE trim(m) <> '';\n";
const PARTY_NO_TRIM =
	"INSERT INTO legacy_party SELECT sheet_id, m FROM adventurer_sheet_legacy, string_to_table(party_members, ',') m;\n";
const ITEMS =
	"INSERT INTO legacy_items SELECT sheet_id, 1, item1 FROM adventurer_sheet_legacy WHERE item1 IS NOT NULL UNION ALL SELECT sheet_id, 2, item2 FROM adventurer_sheet_legacy WHERE item2 IS NOT NULL UNION ALL SELECT sheet_id, 3, item3 FROM adventurer_sheet_legacy WHERE item3 IS NOT NULL;\n";

const cases: Record<string, CaseSet> = {
	"ch26-blueprints/lesson-9": {
		reject: [{ sql: "SELECT sheet_id, party_members FROM adventurer_sheet_legacy;", why: "list not split" }],
		accept: ["SELECT sheet_id, member FROM adventurer_sheet_legacy, unnest(string_to_array(replace(party_members, ' ', ''), ',')) AS member WHERE member <> '';"],
	},
	"ch26-ex01": {
		reject: [
			{ sql: "SELECT 'M:N', '1:N';", why: "swapped" },
			{ sql: "SELECT '1:N', '1:N';", why: "completions seen as 1:N" },
		],
		accept: ["SELECT '1:N' AS a, 'M:N' AS b"],
	},
	"ch26-ex02": {
		reject: [
			{ sql: "CREATE TABLE hero_skills (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, hero_id int NOT NULL REFERENCES heroes, skill_id int NOT NULL REFERENCES skill_tree, learned_on date);", why: "pairs can repeat" },
			{ sql: "CREATE TABLE hero_skills (hero_id int, skill_id int, learned_on date, PRIMARY KEY (hero_id, skill_id));", why: "no foreign keys" },
			{ sql: "CREATE TABLE hero_skills (hero_id int REFERENCES heroes, skill_id int REFERENCES skill_tree, learned_on date, PRIMARY KEY (hero_id, skill_id, learned_on));", why: "date in the key lets a skill repeat" },
		],
		accept: ["CREATE TABLE hero_skills (hero_id int NOT NULL, skill_id int NOT NULL, learned_on date, CONSTRAINT hs_hero FOREIGN KEY (hero_id) REFERENCES heroes (id), CONSTRAINT hs_skill FOREIGN KEY (skill_id) REFERENCES skill_tree (id), CONSTRAINT hs_uq UNIQUE (hero_id, skill_id));"],
	},
	"ch26-ex03": {
		reject: [
			{ sql: "SELECT a.sheet_id, h.id FROM adventurer_sheet_legacy a, string_to_table(a.party_members, ',') AS m JOIN heroes h ON h.name = m OR h.name LIKE m || ' %';", why: "no trim: members after a space are lost" },
			{ sql: "SELECT a.sheet_id, h.id FROM adventurer_sheet_legacy a, string_to_table(a.party_members, ',') AS m JOIN heroes h ON h.name = trim(m);", why: "exact names only: first names never match" },
		],
		accept: ["SELECT a.sheet_id, h.id FROM adventurer_sheet_legacy a CROSS JOIN LATERAL regexp_split_to_table(a.party_members, '\\s*,\\s*') AS m(member) JOIN heroes h ON split_part(h.name, ' ', 1) = trim(m.member);"],
	},
	"ch26-ex04": {
		reject: [
			{ sql: "SELECT DISTINCT a.sheet_id, s.slot, s.item FROM adventurer_sheet_legacy a CROSS JOIN LATERAL (VALUES (1, a.item1), (2, a.item2), (3, a.item3)) AS s(slot, item);", why: "NULL slots kept" },
			{ sql: "SELECT sheet_id, 1, item1 FROM adventurer_sheet_legacy WHERE item1 IS NOT NULL;", why: "only the first column" },
		],
		accept: ["SELECT sheet_id, 1 AS slot, item1 AS item FROM adventurer_sheet_legacy WHERE item1 IS NOT NULL UNION ALL SELECT sheet_id, 2, item2 FROM adventurer_sheet_legacy WHERE item2 IS NOT NULL UNION ALL SELECT sheet_id, 3, item3 FROM adventurer_sheet_legacy WHERE item3 IS NOT NULL;"],
	},
	"ch26-ex05": {
		reject: [{ sql: "SELECT guild_name, count(guild_hall) FROM adventurer_sheet_legacy GROUP BY guild_name HAVING count(guild_hall) > 1;", why: "counts rows, not spellings" }],
		accept: ["SELECT guild_name, count(*) FROM (SELECT DISTINCT guild_name, guild_hall FROM adventurer_sheet_legacy) d GROUP BY guild_name HAVING count(*) > 1;"],
	},
	"ch26-ex06": {
		reject: [
			{ sql: "CREATE TABLE legacy_guilds (guild_name text PRIMARY KEY, guild_hall text NOT NULL);\n" + GUILDS_MIN, why: "min() picks 'High Moor'" },
			{ sql: "CREATE TABLE legacy_guilds (guild_name text, guild_hall text NOT NULL);\n" + GUILDS_MODE, why: "no primary key" },
			{ sql: "CREATE TABLE legacy_guilds AS SELECT DISTINCT guild_name, guild_hall FROM adventurer_sheet_legacy;", why: "both spellings kept, no key" },
		],
		accept: [
			"CREATE TABLE legacy_guilds (guild_name text PRIMARY KEY, guild_hall text NOT NULL);\n" + GUILDS_MODE,
			"CREATE TABLE legacy_guilds (guild_name text NOT NULL, guild_hall text NOT NULL, CONSTRAINT lg_pk PRIMARY KEY (guild_name));\nINSERT INTO legacy_guilds SELECT DISTINCT ON (guild_name) guild_name, guild_hall FROM adventurer_sheet_legacy GROUP BY guild_name, guild_hall ORDER BY guild_name, count(*) DESC;",
		],
	},
	"ch26-ex07": {
		reject: [
			{ sql: "CREATE TABLE hero_skill_list AS SELECT hero_id, skill_id FROM hero_class_skills;\nDROP TABLE hero_class_skills;", why: "CTAS has no primary key" },
			{ sql: "CREATE TABLE hero_skill_list (hero_id int, skill_id int, PRIMARY KEY (hero_id, skill_id));\nINSERT INTO hero_skill_list SELECT hero_id, skill_id FROM hero_class_skills;", why: "old table kept" },
		],
		accept: ["CREATE TABLE hero_skill_list AS SELECT hero_id, skill_id FROM hero_class_skills;\nALTER TABLE hero_skill_list ADD PRIMARY KEY (hero_id, skill_id);\nDROP TABLE hero_class_skills;"],
	},
	"ch26-ex08": {
		reject: [
			{ sql: TABLES + GUILDS_MIN + SHEETS + PARTY + ITEMS, why: "min() hall" },
			{ sql: TABLES + GUILDS_MODE + SHEETS + PARTY_NO_TRIM + ITEMS, why: "members not trimmed" },
			{ sql: TABLES.replace(" CHECK (slot BETWEEN 1 AND 3)", "") + GUILDS_MODE + SHEETS + PARTY + ITEMS, why: "slot unchecked" },
			{ sql: TABLES.replace(" REFERENCES legacy_guilds", "") + GUILDS_MODE + SHEETS + PARTY + ITEMS, why: "sheets not linked to guilds" },
		],
		accept: [TABLES + GUILDS_MODE + SHEETS + PARTY + ITEMS],
	},
	"ch26-pr01": { reject: [{ sql: "SELECT 'pet';", why: "pet is an entity" }] },
	"ch26-pr02": { reject: [{ sql: "SELECT 'hall_region';", why: "a fact about the guild" }] },
	"ch26-pr03": {
		reject: [{ sql: "CREATE TABLE hero_biographies (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, hero_id int NOT NULL REFERENCES heroes, story text NOT NULL);", why: "one-to-many" }],
		accept: ["CREATE TABLE hero_biographies (hero_id int NOT NULL UNIQUE REFERENCES heroes, story text NOT NULL);"],
	},
	"ch26-pr04": {
		reject: [{ sql: "SELECT sheet_id, count(*) FROM adventurer_sheet_legacy, string_to_table(party_members, ',') GROUP BY sheet_id;", why: "Cedric lost" }],
		accept: ["SELECT sheet_id, cardinality(string_to_array(party_members, ',')) FROM adventurer_sheet_legacy;"],
	},
	"ch26-pr05": {
		reject: [{ sql: "SELECT sheet_id, item1 FROM adventurer_sheet_legacy WHERE item1 = item2;", why: "misses item2 = item3" }],
		accept: ["SELECT sheet_id, item2 FROM adventurer_sheet_legacy WHERE item2 = item3 OR item1 = item2 OR item1 = item3;"],
	},
	"ch26-pr06": {
		accept: ["SELECT region, count(DISTINCT difficulty) FROM quests GROUP BY region HAVING min(difficulty) <> max(difficulty);"],
	},
	"ch26-pr07": {
		reject: [{ sql: "SELECT a.sheet_id, a.guild_hall, g.hall_region FROM adventurer_sheet_legacy a JOIN guilds g ON g.name = a.guild_name WHERE lower(replace(a.guild_hall, ' ', '')) <> lower(g.hall_region);", why: "normalising both sides hides the typo" }],
	},
	"ch26-pr08": { reject: [{ sql: "SELECT '3NF';", why: "teacher -> subject is allowed by 3NF" }] },
};

export default cases;
