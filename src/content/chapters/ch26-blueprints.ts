import type { Chapter } from "../types";

/**
 * World 7 grading (see ch24): verifySql creates the hidden helper
 * pg_temp.try_sql(stmt) and runs behavioural probes in order. A write returns
 * 'ok' or 'error <SQLSTATE>', a SELECT returns its rows as text.
 */
const TRY_SQL = `CREATE OR REPLACE FUNCTION pg_temp.try_sql(stmt text) RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE r text;
BEGIN
  IF ltrim(stmt) ~* '^(select|with|values|table)[[:space:]]' THEN
    EXECUTE 'SELECT string_agg(probe_row::text, '' ; '') FROM (' || stmt || ') probe_row' INTO r;
    RETURN coalesce(r, '(no rows)');
  END IF;
  EXECUTE stmt;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN 'error ' || SQLSTATE;
END
$fn$;`;

function probes(...rows: [string, string][]): string {
	const values = rows
		.map(([label, stmt], i) => `  (${i + 1}, '${label.replace(/'/g, "''")}', $p$${stmt}$p$)`)
		.join(",\n");
	return `${TRY_SQL}\nSELECT probe, pg_temp.try_sql(stmt) AS result\nFROM (VALUES\n${values}\n) AS t(n, probe, stmt)\nORDER BY n;`;
}

const LEGACY_GUILDS_FILL =
	"INSERT INTO legacy_guilds (guild_name, guild_hall)\nWITH spellings AS (\n  SELECT guild_name, guild_hall, count(*) AS n\n  FROM adventurer_sheet_legacy\n  GROUP BY guild_name, guild_hall\n)\nSELECT guild_name, guild_hall\nFROM spellings s\nWHERE n = (SELECT max(n) FROM spellings x WHERE x.guild_name = s.guild_name);";

const chapter: Chapter = {
	id: "ch26-blueprints",
	order: 26,
	world: "The Architect's Tower",
	tier: "adept",
	track: "schema",
	title: "Blueprints",
	subtitle: "ER modeling, cardinality and normalization from 1NF to BCNF",
	emoji: "📐",
	datasetId: "guild",
	concepts: [
		"er-modeling",
		"relationship-cardinality",
		"normalization-1nf",
		"normalization-2nf-3nf",
		"normalization-bcnf-beyond",
	],
	prerequisites: ["ch25-binding-laws"],
	lesson: [
		{
			kind: "explain",
			title: "Entities, attributes, relationships",
			body: "Before writing any DDL, sketch the model:\n\n1. **Entities**: the things you store facts about (hero, guild, quest).\n2. **Attributes**: the facts about each (a hero's level, a guild's motto).\n3. **Relationships**: how entities connect (a hero belongs to a guild).\n4. **Business rules**: what must always hold (a quest is completed once per hero).\n\nModel the facts, not the reports: a report is a query.",
		},
		{
			kind: "quiz",
			question:
				"The rule: *a hero belongs to at most one guild; a guild has many heroes.* Where does the foreign key go?",
			choices: [
				"`guilds.hero_id`, pointing at the heroes",
				"`heroes.guild_id`, pointing at the guild",
				"Both tables, pointing at each other",
				"A list of hero ids in `guilds.members`",
			],
			answerIndex: 1,
			explanation:
				"In a one-to-many relationship the key goes on the **many** side: each hero row holds one guild_id. `guilds.hero_id` could hold only one hero per guild, and a list column breaks first normal form.",
		},
		{
			kind: "explain",
			title: "Many-to-many needs a table",
			body: "A hero completes many quests; a quest is completed by many heroes. No single column can hold that. The answer is a **junction table**:\n```sql\nquest_completions (\n  hero_id  int REFERENCES heroes,\n  quest_id int REFERENCES quests,\n  completed_at timestamptz,\n  PRIMARY KEY (hero_id, quest_id)\n)\n```\nTwo foreign keys, and the pair as the key. Facts about the pair (when, party size) live here too.",
		},
		{
			kind: "example",
			title: "A denormalized legacy table",
			body: "The `adventurer_sheet_legacy` table has three design problems: a comma list of party members, three numbered item columns, and the guild hall repeated on every row.",
			sql: "SELECT * FROM adventurer_sheet_legacy ORDER BY sheet_id;",
		},
		{
			kind: "explain",
			title: "First normal form: one value per cell",
			body: "**1NF**: every cell holds a single value, and no column group repeats (`item1, item2, item3`). A comma list cannot be joined, indexed or constrained.\n\nTo break a list into rows:\n```sql\nSELECT sheet_id, trim(m) AS member\nFROM adventurer_sheet_legacy,\n     string_to_table(party_members, ',') AS m;\n```\n`trim` matters: the data contains `'Hilde,Ælfric, Odo'`, with a space before `Odo`.",
		},
		{
			kind: "example",
			title: "Unpivoting numbered columns",
			body: "A LATERAL VALUES list turns three columns into three rows, keeping the slot number. Empty slots are filtered out.",
			sql: "SELECT a.sheet_id, s.slot, s.item\nFROM adventurer_sheet_legacy a\nCROSS JOIN LATERAL (VALUES (1, a.item1), (2, a.item2), (3, a.item3)) AS s(slot, item)\nWHERE s.item IS NOT NULL\nORDER BY a.sheet_id, s.slot;",
		},
		{
			kind: "explain",
			title: "2NF and 3NF: nothing but the key",
			body: "A **functional dependency** `A → B` means: knowing A fixes B. Every non-key column must depend on\n\n- **the key** (1NF gives you a key),\n- **the whole key** (2NF: no column depending on half of a composite key),\n- **nothing but the key** (3NF: no column depending on another non-key column).\n\nOn the legacy sheet, `guild_hall` depends on `guild_name`, not on the sheet: it belongs in a guild table.",
		},
		{
			kind: "example",
			title: "The update anomaly",
			body: "When a fact is copied on many rows, the copies drift apart. One row has 'High Moor' instead of 'Highmoor'.",
			sql: "SELECT guild_name, count(DISTINCT guild_hall) AS spellings,\n       string_agg(DISTINCT guild_hall, ' / ') AS halls\nFROM adventurer_sheet_legacy\nGROUP BY guild_name\nHAVING count(DISTINCT guild_hall) > 1;",
		},
		{
			kind: "explain",
			title: "BCNF, 4NF and 5NF",
			body: "**BCNF**: *every* determinant is a key. 3NF has a loophole when a non-key column determines part of the key: in `lessons(student, subject, teacher)` where each teacher teaches one subject, `teacher → subject` but teacher is no key.\n\n**4NF**: two independent lists about the same thing (a hero's skills, a hero's languages) go in two tables, not one table of every combination.\n\n**5NF**: split further only when a table is the join of three smaller facts.",
		},
		{
			kind: "try",
			title: "Split a comma list into rows",
			prompt:
				"Return **sheet_id** and **member** (with no surrounding spaces) for every party member listed on every legacy sheet.",
			starterSql:
				"SELECT sheet_id, m AS member\nFROM adventurer_sheet_legacy,\n     string_to_table(party_members, ',') AS m;",
			solutionSql:
				"SELECT sheet_id, trim(m) AS member\nFROM adventurer_sheet_legacy,\n     string_to_table(party_members, ',') AS m;",
			check: { type: "result" },
			hints: [
				"Run the starter and look closely at ' Odo'.",
				"Wrap the member in trim().",
			],
		},
	],
	exercises: [
		{
			id: "ch26-ex01",
			title: "Relationship cardinality",
			prompt:
				"Return **one row** with two text columns: **heroes_guilds**, the cardinality between heroes and guilds, and **heroes_quests**, the cardinality between heroes and quests (through completions). Choose each from `'1:1'`, `'1:N'` and `'M:N'` (a guild has the N side in the first one).",
			difficulty: 1,
			kind: "query",
			concepts: ["er-modeling", "relationship-cardinality"],
			solutionSql: "SELECT '1:N' AS heroes_guilds, 'M:N' AS heroes_quests;",
			check: { type: "result" },
			hints: [
				"How many guilds can one hero have? How many heroes can one guild have?",
				"Can one hero complete several quests, and one quest be completed by several heroes?",
				"SELECT '1:N' AS heroes_guilds, ...",
			],
			explanation:
				"One guild, many heroes: 1:N, stored as `heroes.guild_id`. Many heroes, many quests: M:N, stored in the junction table `quest_completions`.\n\n**Pitfall:** reading 1:N backwards, or calling completions 1:N because each completion row has one hero. The *entities* are many on both sides.\n\n**Alternative:** some write 1:N as 1:* and M:N as *:*.",
		},
		{
			id: "ch26-ex02",
			title: "Create a junction table",
			prompt:
				"A hero learns many skills from `skill_tree`, and a skill can be learned by many heroes. Create table **hero_skills** with **hero_id** (`int`, an existing hero), **skill_id** (`int`, an existing `skill_tree` row) and **learned_on** (`date`, optional). A hero learns a given skill **at most once**, and both ids are required.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["relationship-cardinality"],
			solutionSql:
				"CREATE TABLE hero_skills (\n  hero_id    int REFERENCES heroes (id),\n  skill_id   int REFERENCES skill_tree (id),\n  learned_on date,\n  PRIMARY KEY (hero_id, skill_id)\n);",
			check: {
				type: "state",
				verifySql: probes(
					["Aldric learns Warrior Ways", "INSERT INTO hero_skills (hero_id, skill_id, learned_on) VALUES (1, 9, '2019-04-01')"],
					["Aldric learns Blade", "INSERT INTO hero_skills (hero_id, skill_id) VALUES (1, 10)"],
					["Brynja learns Warrior Ways", "INSERT INTO hero_skills (hero_id, skill_id) VALUES (2, 9)"],
					["Aldric learns Warrior Ways again", "INSERT INTO hero_skills (hero_id, skill_id) VALUES (1, 9)"],
					["hero 999 learns Blade", "INSERT INTO hero_skills (hero_id, skill_id) VALUES (999, 10)"],
					["Aldric learns skill 99", "INSERT INTO hero_skills (hero_id, skill_id) VALUES (1, 99)"],
					["a skill with no hero", "INSERT INTO hero_skills (skill_id) VALUES (3)"],
					["rows", "SELECT hero_id, skill_id, learned_on FROM hero_skills ORDER BY hero_id, skill_id"],
				),
			},
			hints: [
				"Like quest_completions: two foreign keys and a key made of both.",
				"Each id gets REFERENCES; the pair gets PRIMARY KEY.",
				"hero_id int REFERENCES heroes (id), skill_id int REFERENCES skill_tree (id), learned_on date, PRIMARY KEY (hero_id, skill_id)",
			],
			explanation:
				"Two foreign keys make each row a real (hero, skill) link; the composite primary key forbids learning the same skill twice and makes both ids required.\n\n**Pitfall:** a surrogate `id` key alone lets the same pair repeat; a `skills int[]` column on heroes cannot reference skill_tree at all.\n\n**Alternative:** `NOT NULL` on both ids plus `UNIQUE (hero_id, skill_id)` behaves the same.",
		},
		{
			id: "ch26-ex03",
			title: "Resolve names to hero ids",
			prompt:
				"For every party member on every legacy sheet, return **sheet_id** and the **hero_id** of the matching hero. A member matches the hero whose name **equals** the member or **starts with** the member followed by a space (`'Hilde'` is `'Hilde Ødegård'`). Members carry stray spaces in the list.",
			difficulty: 3,
			kind: "query",
			concepts: ["normalization-1nf"],
			solutionSql:
				"SELECT a.sheet_id, h.id AS hero_id\nFROM adventurer_sheet_legacy a,\n     string_to_table(a.party_members, ',') AS m\nJOIN heroes h ON h.name = trim(m) OR h.name LIKE trim(m) || ' %';",
			check: { type: "result" },
			hints: [
				"First break the list into rows, then join each member to heroes.",
				"Trim before matching: ' Odo' matches nothing. Two conditions joined by OR.",
				"JOIN heroes h ON h.name = trim(m) OR h.name LIKE trim(m) || ' %'",
			],
			explanation:
				"Once the list is rows, it can be joined like any column: the 16 members resolve to 16 hero ids, ready for a `(sheet_id, hero_id)` junction table.\n\n**Pitfall:** forgetting `trim` silently drops Odo, Ælfric, Morwen and the other members preceded by a space: no error, just missing rows.\n\n**Alternative:** `regexp_split_to_table(party_members, '\\s*,\\s*')` splits and trims in one go.",
		},
		{
			id: "ch26-ex04",
			title: "Unpivot the item columns",
			prompt:
				"Return **sheet_id**, **slot** (1, 2 or 3, from `item1`, `item2`, `item3`) and **item** for every **non NULL** item column of the legacy sheets. Keep duplicates: the same item in two slots gives two rows.",
			difficulty: 3,
			kind: "query",
			concepts: ["normalization-1nf"],
			solutionSql:
				"SELECT a.sheet_id, s.slot, s.item\nFROM adventurer_sheet_legacy a\nCROSS JOIN LATERAL (VALUES (1, a.item1), (2, a.item2), (3, a.item3)) AS s(slot, item)\nWHERE s.item IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"Three columns must become three rows per sheet.",
				"A LATERAL VALUES list with (slot, item) pairs, or three SELECTs glued with UNION ALL.",
				"CROSS JOIN LATERAL (VALUES (1, a.item1), (2, a.item2), (3, a.item3)) AS s(slot, item) WHERE s.item IS NOT NULL",
			],
			explanation:
				"Each sheet produces up to three rows, one per filled slot: 18 rows. Now the inventory can grow past three items without a schema change.\n\n**Pitfall:** `UNION` instead of `UNION ALL` (or a DISTINCT) merges the two Nightshade Daggers of sheet 105 only if the slot is dropped; keep the slot and keep duplicates.\n\n**Alternative:** `SELECT sheet_id, 1, item1 FROM ... WHERE item1 IS NOT NULL UNION ALL ...` three times.",
		},
		{
			id: "ch26-ex05",
			title: "Find inconsistent copies",
			prompt:
				"If the dependency `guild_name → guild_hall` held, each guild would have exactly one hall spelling. Return **guild_name** and **halls**, the number of **different** hall spellings, for every guild of the legacy sheets that has **more than one** spelling.",
			difficulty: 3,
			kind: "query",
			concepts: ["normalization-2nf-3nf"],
			solutionSql:
				"SELECT guild_name, count(DISTINCT guild_hall) AS halls\nFROM adventurer_sheet_legacy\nGROUP BY guild_name\nHAVING count(DISTINCT guild_hall) > 1;",
			check: { type: "result" },
			hints: [
				"One row per guild, counting spellings.",
				"count(DISTINCT ...) and a HAVING.",
				"GROUP BY guild_name HAVING count(DISTINCT guild_hall) > 1",
			],
			explanation:
				"Silver Dragon has 2 spellings: a fact stored three times was typed differently once. That is the update anomaly 3NF prevents by storing the hall once, in a guild table.\n\n**Pitfall:** `count(guild_hall)` counts rows, not spellings, and flags every guild with two sheets.\n\n**Alternative:** `HAVING min(guild_hall) <> max(guild_hall)` detects the same thing.",
		},
		{
			id: "ch26-ex06",
			title: "Extract a guild table",
			prompt:
				"Create **legacy_guilds** with **guild_name** (`text`, primary key) and **guild_hall** (`text`, required), and fill it with one row per guild of `adventurer_sheet_legacy`. When a guild's hall is spelled several ways, keep the **most frequent** spelling.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["normalization-2nf-3nf"],
			solutionSql: `CREATE TABLE legacy_guilds (\n  guild_name text PRIMARY KEY,\n  guild_hall text NOT NULL\n);\n${LEGACY_GUILDS_FILL}`,
			check: {
				type: "state",
				verifySql: probes(
					["guilds", "SELECT guild_name, guild_hall FROM legacy_guilds ORDER BY guild_name"],
					["Silver Dragon again", "INSERT INTO legacy_guilds (guild_name, guild_hall) VALUES ('Silver Dragon', 'Elsewhere')"],
					["a guild without a hall", "INSERT INTO legacy_guilds (guild_name) VALUES ('Nomads')"],
				),
			},
			hints: [
				"Count the sheets per (guild, hall) pair first, then keep the pair with the highest count for each guild.",
				"A CTE of counts, then a correlated `max(n)` per guild (or DISTINCT ON ordered by the count).",
				"WITH spellings AS (SELECT guild_name, guild_hall, count(*) AS n FROM adventurer_sheet_legacy GROUP BY 1, 2) SELECT ... WHERE n = (SELECT max(n) FROM spellings x WHERE x.guild_name = s.guild_name)",
			],
			explanation:
				"Four guilds, four rows, and Silver Dragon gets 'Highmoor' (2 sheets against 1). The primary key now makes a second, contradictory hall impossible.\n\n**Pitfall:** `min(guild_hall)` picks 'High Moor' (a space sorts before a letter); `max` picks the right one only by luck of the alphabet.\n\n**Alternative:** `SELECT DISTINCT ON (guild_name) guild_name, guild_hall ... ORDER BY guild_name, count(*) DESC`, or `mode() WITHIN GROUP (ORDER BY guild_hall)`.",
		},
		{
			id: "ch26-ex07",
			title: "Fix a 2NF violation",
			prompt:
				"Table `hero_class_skills(hero_id, class, skill_id)` has the key `(hero_id, skill_id)`. The class is copied on every skill row, and one row already says hero 3 is a warrior while the others say mage. The starter keeps the bad column. Instead, create **hero_skill_list** with **hero_id** and **skill_id** (both `int`, together the primary key) and no other column, fill it with every pair of `hero_class_skills`, then **drop** `hero_class_skills`. A hero's class already lives in `heroes`.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["normalization-2nf-3nf"],
			setupSql:
				"CREATE TABLE hero_class_skills (hero_id int, class text, skill_id int, PRIMARY KEY (hero_id, skill_id));\nINSERT INTO hero_class_skills VALUES (3, 'mage', 1), (3, 'mage', 2), (3, 'mage', 3), (3, 'warrior', 6), (1, 'warrior', 9), (1, 'warrior', 10), (1, 'warrior', 13), (20, 'rogue', 15), (20, 'rogue', 16), (20, 'rogue', 17);",
			starterSql: "CREATE TABLE hero_skill_list AS\nSELECT * FROM hero_class_skills;",
			solutionSql:
				"CREATE TABLE hero_skill_list (\n  hero_id  int,\n  skill_id int,\n  PRIMARY KEY (hero_id, skill_id)\n);\nINSERT INTO hero_skill_list (hero_id, skill_id)\nSELECT hero_id, skill_id FROM hero_class_skills;\nDROP TABLE hero_class_skills;",
			check: {
				type: "state",
				verifySql: probes(
					["columns of hero_skill_list", "SELECT attname FROM pg_attribute WHERE attrelid = 'hero_skill_list'::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attname"],
					["pairs", "SELECT hero_id, skill_id FROM hero_skill_list ORDER BY hero_id, skill_id"],
					["Morwen learns Mage Arts twice", "INSERT INTO hero_skill_list (hero_id, skill_id) VALUES (3, 1)"],
					["hero_class_skills is gone", "SELECT to_regclass('hero_class_skills') IS NULL"],
				),
			},
			hints: [
				"`class` depends on hero_id alone, half of the key: that is a 2NF violation. Leave it out.",
				"CREATE TABLE with a composite key, then INSERT ... SELECT only the two id columns, then DROP.",
				"INSERT INTO hero_skill_list (hero_id, skill_id) SELECT hero_id, skill_id FROM hero_class_skills; DROP TABLE hero_class_skills;",
			],
			explanation:
				"`hero_id → class` is a partial dependency: class depends on half of the key, so it repeated per skill and became inconsistent ('warrior' for hero 3). Keeping only the pair, and reading the class from heroes, leaves one place for each fact.\n\n**Pitfall:** `CREATE TABLE AS SELECT *` copies the bad column *and* loses the primary key: CTAS never copies constraints.\n\n**Alternative:** `CREATE TABLE hero_skill_list AS SELECT hero_id, skill_id FROM ...` followed by `ALTER TABLE ... ADD PRIMARY KEY (hero_id, skill_id)`.",
		},
		{
			id: "ch26-ex08",
			title: "The Scribe's Redemption",
			story:
				"Combines 1NF splitting, unpivoting, 3NF extraction, foreign keys and a lossless decomposition.",
			prompt:
				"Rebuild `adventurer_sheet_legacy` as a normalized design that loses no data and repeats no fact. Create and fill four tables:\n\n1. **legacy_guilds**: **guild_name** text primary key, **guild_hall** text required (most frequent spelling).\n2. **legacy_sheets**: **sheet_id** int primary key, **hero_name** text required, **guild_name** text required, an existing legacy guild.\n3. **legacy_party**: **sheet_id** (an existing sheet) and **member** text (trimmed), together the primary key.\n4. **legacy_items**: **sheet_id** (an existing sheet), **slot** int **between 1 and 3**, **item** text required; primary key (sheet_id, slot). Only filled slots.",
			difficulty: 5,
			kind: "ddl",
			concepts: ["normalization-1nf", "normalization-2nf-3nf", "relationship-cardinality"],
			boss: true,
			solutionSql: `CREATE TABLE legacy_guilds (\n  guild_name text PRIMARY KEY,\n  guild_hall text NOT NULL\n);\nCREATE TABLE legacy_sheets (\n  sheet_id   int PRIMARY KEY,\n  hero_name  text NOT NULL,\n  guild_name text NOT NULL REFERENCES legacy_guilds (guild_name)\n);\nCREATE TABLE legacy_party (\n  sheet_id int REFERENCES legacy_sheets (sheet_id),\n  member   text,\n  PRIMARY KEY (sheet_id, member)\n);\nCREATE TABLE legacy_items (\n  sheet_id int REFERENCES legacy_sheets (sheet_id),\n  slot     int CHECK (slot BETWEEN 1 AND 3),\n  item     text NOT NULL,\n  PRIMARY KEY (sheet_id, slot)\n);\n${LEGACY_GUILDS_FILL}\nINSERT INTO legacy_sheets (sheet_id, hero_name, guild_name)\nSELECT sheet_id, hero_name, guild_name FROM adventurer_sheet_legacy;\nINSERT INTO legacy_party (sheet_id, member)\nSELECT DISTINCT sheet_id, trim(m)\nFROM adventurer_sheet_legacy, string_to_table(party_members, ',') AS m\nWHERE trim(m) <> '';\nINSERT INTO legacy_items (sheet_id, slot, item)\nSELECT a.sheet_id, s.slot, s.item\nFROM adventurer_sheet_legacy a\nCROSS JOIN LATERAL (VALUES (1, a.item1), (2, a.item2), (3, a.item3)) AS s(slot, item)\nWHERE s.item IS NOT NULL;`,
			check: {
				type: "state",
				verifySql: probes(
					[
						"sheets rebuilt by joining your tables",
						"SELECT s.sheet_id, s.hero_name, g.guild_hall, (SELECT string_agg(p.member, ',' ORDER BY p.member) FROM legacy_party p WHERE p.sheet_id = s.sheet_id), (SELECT string_agg(i.item, ',' ORDER BY i.slot) FROM legacy_items i WHERE i.sheet_id = s.sheet_id) FROM legacy_sheets s JOIN legacy_guilds g ON g.guild_name = s.guild_name ORDER BY s.sheet_id",
					],
					["guild halls", "SELECT guild_name, guild_hall FROM legacy_guilds ORDER BY guild_name"],
					["slot 4 for Cedric", "INSERT INTO legacy_items (sheet_id, slot, item) VALUES (107, 4, 'Torch')"],
					["a second item in Cedric's slot 1", "INSERT INTO legacy_items (sheet_id, slot, item) VALUES (107, 1, 'Torch')"],
					["a torch in Cedric's slot 2", "INSERT INTO legacy_items (sheet_id, slot, item) VALUES (107, 2, 'Torch')"],
					["an item on sheet 999", "INSERT INTO legacy_items (sheet_id, slot, item) VALUES (999, 1, 'Torch')"],
					["an empty slot 3 for Cedric", "INSERT INTO legacy_items (sheet_id, slot, item) VALUES (107, 3, NULL)"],
					["Odo listed twice on sheet 101", "INSERT INTO legacy_party (sheet_id, member) VALUES (101, 'Odo')"],
					["a member on sheet 999", "INSERT INTO legacy_party (sheet_id, member) VALUES (999, 'Odo')"],
					["a sheet of an unknown guild", "INSERT INTO legacy_sheets (sheet_id, hero_name, guild_name) VALUES (109, 'Bors the Bold', 'Iron Anvil Two')"],
					["a sheet without a guild", "INSERT INTO legacy_sheets (sheet_id, hero_name) VALUES (110, 'Nyx')"],
				),
			},
			hints: [
				"Create the tables parent first (guilds, sheets, then party and items), and fill them in the same order: a foreign key needs its parent row.",
				"Reuse your earlier queries: the most frequent hall from *Extract a guild table*, `trim` + `string_to_table` for the party, the LATERAL VALUES unpivot for items.",
				"legacy_items: slot int CHECK (slot BETWEEN 1 AND 3), PRIMARY KEY (sheet_id, slot). Fill order: legacy_guilds, legacy_sheets, legacy_party, legacy_items.",
			],
			explanation:
				"The join of your four tables rebuilds every sheet, with the hall stored once per guild, one row per member and one row per filled slot: a **lossless** decomposition. And the constraints now refuse what the legacy table accepted.\n\n**Pitfall:** filling a child before its parent fails with 23503; splitting members without `trim` stores ' Odo' and 'Odo' as two people.\n\n**Alternative:** the party could reference real heroes by id (as in *Resolve names to hero ids*) instead of storing names.",
		},
	],
	practice: [
		{
			id: "ch26-pr01",
			title: "Entity or attribute",
			prompt:
				"The spec says: *the system tracks heroes, the pets they own, and each pet's color.* Return one row with one text column: the word, among `'hero'`, `'pet'` and `'color'`, that names an **attribute** rather than an entity.",
			difficulty: 1,
			kind: "query",
			concepts: ["er-modeling"],
			solutionSql: "SELECT 'color' AS attribute;",
			check: { type: "result" },
			hints: [
				"Entities have facts of their own; attributes are facts.",
				"Does a color have attributes of its own that you need to store?",
				"SELECT 'color';",
			],
			explanation:
				"Heroes and pets are things with their own facts and keys; a color is a fact about a pet, so it is a column of `pets`.\n\n**Pitfall:** modeling every noun as a table. If colors later needed a price or a rarity, then they would become an entity.\n\n**Alternative:** a small lookup table of allowed colors is fine, as a constraint, not as a separate entity.",
		},
		{
			id: "ch26-pr02",
			title: "Find the derived column",
			prompt:
				"A draft table reads `guild_report(guild_name, hall_region, hero_count)`. Return one row with one text column: the name of the column that is **derived** from other facts and should be computed by a query instead of stored.",
			difficulty: 1,
			kind: "query",
			concepts: ["er-modeling"],
			solutionSql: "SELECT 'hero_count' AS derived;",
			check: { type: "result" },
			hints: [
				"Which value could you compute from the heroes table at any time?",
				"Counting heroes per guild is a GROUP BY away.",
				"SELECT 'hero_count';",
			],
			explanation:
				"`hero_count` is a report: `count(*)` over heroes. Stored, it becomes wrong as soon as a hero joins.\n\n**Pitfall:** modeling reports instead of facts; the copy drifts and nobody knows which number is true.\n\n**Alternative:** if it must be fast, cache it on purpose (deliberate denormalization, covered in *Cursed Designs*) and keep it in sync.",
		},
		{
			id: "ch26-pr03",
			title: "One-to-one relationship",
			prompt:
				"Create **hero_biographies** with **hero_id** (`int`, primary key, an existing hero) and **story** (`text`, required): each hero has **at most one** biography.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["relationship-cardinality"],
			solutionSql:
				"CREATE TABLE hero_biographies (\n  hero_id int PRIMARY KEY REFERENCES heroes (id),\n  story   text NOT NULL\n);",
			check: {
				type: "state",
				verifySql: probes(
					["Aldric's biography", "INSERT INTO hero_biographies (hero_id, story) VALUES (1, 'Born in a storm.')"],
					["a second biography for Aldric", "INSERT INTO hero_biographies (hero_id, story) VALUES (1, 'Actually born at noon.')"],
					["a biography of hero 999", "INSERT INTO hero_biographies (hero_id, story) VALUES (999, 'Who?')"],
					["an empty biography", "INSERT INTO hero_biographies (hero_id) VALUES (3)"],
				),
			},
			hints: [
				"One-to-one: the child's foreign key is also its primary key.",
				"hero_id is both PRIMARY KEY and REFERENCES heroes.",
				"hero_id int PRIMARY KEY REFERENCES heroes (id), story text NOT NULL",
			],
			explanation:
				"Making the FK the primary key turns one-to-many into one-to-one: a second biography for hero 1 is refused (23505).\n\n**Pitfall:** an identity id plus a plain hero_id FK allows many biographies per hero.\n\n**Alternative:** `hero_id int UNIQUE NOT NULL REFERENCES heroes` with a separate id.",
		},
		{
			id: "ch26-pr04",
			title: "Count list items",
			prompt:
				"Return **sheet_id** and **party_size**, the number of members in the comma list, for **every** legacy sheet (an empty list counts 0).",
			difficulty: 2,
			kind: "query",
			concepts: ["normalization-1nf"],
			solutionSql:
				"SELECT sheet_id,\n       (SELECT count(*) FROM string_to_table(party_members, ',')) AS party_size\nFROM adventurer_sheet_legacy;",
			check: { type: "result" },
			hints: [
				"Count the pieces of each list, without losing sheet 107, whose list is empty.",
				"A correlated subquery over string_to_table returns 0 for an empty list.",
				"(SELECT count(*) FROM string_to_table(party_members, ',')) AS party_size",
			],
			explanation:
				"Splitting inside a scalar subquery keeps every sheet, and the empty list of sheet 107 counts 0.\n\n**Pitfall:** joining the split rows then grouping drops sheet 107 entirely; counting commas plus one gives it 1.\n\n**Alternative:** `cardinality(string_to_array(party_members, ','))`.",
		},
		{
			id: "ch26-pr05",
			title: "Duplicate items per sheet",
			prompt:
				"Return **sheet_id** and **item** for every legacy sheet that lists the **same item** in two or more of its item columns.",
			difficulty: 2,
			kind: "query",
			concepts: ["normalization-1nf"],
			solutionSql:
				"SELECT a.sheet_id, s.item\nFROM adventurer_sheet_legacy a\nCROSS JOIN LATERAL (VALUES (a.item1), (a.item2), (a.item3)) AS s(item)\nWHERE s.item IS NOT NULL\nGROUP BY a.sheet_id, s.item\nHAVING count(*) > 1;",
			check: { type: "result" },
			hints: [
				"Unpivot first, then the question is a GROUP BY.",
				"Group by sheet and item, keep groups of more than one.",
				"... GROUP BY a.sheet_id, s.item HAVING count(*) > 1",
			],
			explanation:
				"Sheet 105 lists two Nightshade Daggers and sheet 108 two Iron Shields. With numbered columns this needed `item1 = item2 OR item1 = item3 OR item2 = item3`; with rows it is one GROUP BY.\n\n**Pitfall:** comparing only `item1 = item2` misses pairs in other slots.\n\n**Alternative:** the three OR comparisons work for exactly three columns, and break the day a fourth appears.",
		},
		{
			id: "ch26-pr06",
			title: "Test a functional dependency",
			prompt:
				"Test the dependency `region → difficulty` on **quests**: return **region** and **difficulties** (the number of different difficulties) for every region with **more than one** difficulty.",
			difficulty: 2,
			kind: "query",
			concepts: ["normalization-2nf-3nf"],
			solutionSql:
				"SELECT region, count(DISTINCT difficulty) AS difficulties\nFROM quests\nGROUP BY region\nHAVING count(DISTINCT difficulty) > 1;",
			check: { type: "result" },
			hints: [
				"A dependency holds when each region has exactly one difficulty.",
				"count(DISTINCT difficulty) per region.",
				"GROUP BY region HAVING count(DISTINCT difficulty) > 1",
			],
			explanation:
				"Every region has several difficulties, so region does not determine difficulty: storing difficulty on quests is right.\n\n**Pitfall:** concluding a dependency from data that happens to agree today. Dependencies come from the business rules; data can only disprove them.\n\n**Alternative:** `HAVING min(difficulty) <> max(difficulty)`.",
		},
		{
			id: "ch26-pr07",
			title: "Compare copies to the source",
			prompt:
				"Return **sheet_id**, **guild_hall** (from the legacy sheet) and **hall_region** (from `guilds`) for every legacy sheet whose hall **differs** from its guild's hall in `guilds` (match `guild_name` to `guilds.name`).",
			difficulty: 2,
			kind: "query",
			concepts: ["normalization-2nf-3nf"],
			solutionSql:
				"SELECT a.sheet_id, a.guild_hall, g.hall_region\nFROM adventurer_sheet_legacy a\nJOIN guilds g ON g.name = a.guild_name\nWHERE a.guild_hall <> g.hall_region;",
			check: { type: "result" },
			hints: [
				"Join the copies to the single source of truth.",
				"Match by guild name, compare the halls.",
				"JOIN guilds g ON g.name = a.guild_name WHERE a.guild_hall <> g.hall_region",
			],
			explanation:
				"Sheet 103 says 'High Moor' where `guilds` says 'Highmoor': a copied fact that drifted.\n\n**Pitfall:** normalising both sides first (lower case, spaces removed) hides exactly the difference you are looking for: compare exactly.\n\n**Alternative:** `IS DISTINCT FROM` if either side could be NULL.",
		},
		{
			id: "ch26-pr08",
			title: "Identify a BCNF violation",
			prompt:
				"Table `lessons(student, subject, teacher)` has the key `(student, subject)`. Each teacher teaches exactly one subject. Return one row with one text column: the **lowest** normal form it violates, among `'2NF'`, `'3NF'` and `'BCNF'`.",
			difficulty: 3,
			kind: "query",
			concepts: ["normalization-bcnf-beyond"],
			solutionSql: "SELECT 'BCNF' AS violates;",
			check: { type: "result" },
			hints: [
				"List the dependencies: (student, subject) → teacher, and teacher → subject.",
				"subject is part of the key, so teacher → subject does not break 3NF. Is teacher a key?",
				"SELECT 'BCNF';",
			],
			explanation:
				"`teacher → subject` has a determinant (teacher) that is not a key, which BCNF forbids, but subject is a key attribute, so 3NF tolerates it. The fix: `teachers(teacher PK, subject)` and `enrolments(student, teacher)`.\n\n**Pitfall:** believing 3NF always equals BCNF; they differ exactly when overlapping candidate keys appear.\n\n**Alternative:** some designs keep the 3NF table to enforce *one teacher per student and subject* with a simple key.",
		},
	],
};

export default chapter;
