import type { Chapter } from "../types";

const TRY_SQLSTATE =
	"CREATE FUNCTION try_sqlstate(q text) RETURNS text LANGUAGE plpgsql AS $$\nBEGIN\n  EXECUTE q;\n  RETURN 'ok';\nEXCEPTION WHEN OTHERS THEN\n  RETURN SQLSTATE;\nEND $$;";

const chapter: Chapter = {
	id: "ch30-shaped-data",
	order: 30,
	world: "The Alchemist's Vault",
	tier: "adept",
	track: "types",
	title: "Shaped Data",
	subtitle: "Enums that sort themselves, domains that guard, composites and arrays",
	emoji: "🧬",
	datasetId: "guild",
	concepts: ["enum-types", "domain-types", "composite-types", "arrays"],
	prerequisites: ["ch29-precise-measures", "ch25-binding-laws", "ch12-exists-or-not"],
	lesson: [
		{
			kind: "explain",
			title: "Enums: labels with a rank",
			body: "An **enum** is a closed list of labels, declared once:\n```sql\nCREATE TYPE rarity AS ENUM\n  ('common', 'uncommon', 'rare', 'epic', 'legendary');\n```\nEnums sort and compare in **declaration order**, not alphabetically: `'rare' > 'uncommon'` is true. A label outside the list is refused with **22P02**. The guild uses two: `hero_class` and `rarity`.",
		},
		{
			kind: "example",
			title: "The rarity ladder",
			body: "Sorted by rank, rarest first. Alphabetically, `uncommon` would come last of all; here it sits just above `common`.",
			sql: "SELECT name, rarity\nFROM items\nORDER BY rarity DESC, name;",
		},
		{
			kind: "quiz",
			question:
				"`hero_class` was declared as `('warrior', 'mage', 'rogue', 'cleric', 'ranger', 'bard')`. Which class comes first with `ORDER BY class`?",
			choices: ["bard", "warrior", "cleric", "It depends on the collation"],
			answerIndex: 1,
			explanation:
				"Enums sort by declaration order, so `warrior` is first and `bard` last. Collations only apply to text; cast with `class::text` if you ever want alphabetical order.",
		},
		{
			kind: "explain",
			title: "Domains: a type with a rule",
			body: "A **domain** is a base type plus constraints, reusable on any column:\n```sql\nCREATE DOMAIN gold_amount AS numeric(10,2)\n  CHECK (VALUE >= 0);\n```\nEvery column of type `gold_amount` now refuses negative gold with **23514**. Define the rule once instead of copying a CHECK into ten tables.",
		},
		{
			kind: "explain",
			title: "Composite types: a row in a cell",
			body: "`heroes.stats` holds a whole `stat_block (str, dex, wis)`. Read a field with **parentheses**:\n```sql\nSELECT (stats).dex FROM heroes;\n```\nWithout them, `stats.dex` means *column dex of a table called stats*, and fails with 42P01. Build a value with `ROW(10, 12, 14)::stat_block`.",
		},
		{
			kind: "example",
			title: "The nimblest heroes",
			body: "Sorting on a field of a composite. Bors was never assessed: his whole `stats` is NULL, so are its fields.",
			sql: "SELECT name, stats, (stats).dex AS dex\nFROM heroes\nORDER BY (stats).dex DESC NULLS LAST, name\nLIMIT 4;",
		},
		{
			kind: "explain",
			title: "Arrays",
			body: "`tags text[]` holds a list. Subscripts start at **1**: `tags[1]`.\n\n| test | meaning |\n|---|---|\n| `'scout' = ANY(tags)` | contains this one value |\n| `tags @> '{scout,archer}'` | contains **all** of these |\n| `tags && '{scout,archer}'` | shares **at least one** |\n\n`cardinality(tags)` counts elements, `unnest(tags)` turns them into rows. NULL (never filled) and `'{}'` (empty) are different.",
		},
		{
			kind: "quiz",
			question: "Aldric's tags are `{veteran,leader}`. What does `tags[0]` return for him?",
			choices: ["veteran", "leader", "NULL", "An error: index out of range"],
			answerIndex: 2,
			explanation:
				"Postgres arrays are 1-based: `tags[1]` is `veteran`. An index outside the array is not an error, it quietly returns NULL, which makes 0-based habits hard to spot.",
		},
		{
			kind: "example",
			title: "Scouts of the guild",
			body: "`@>` reads *contains*: every hero whose tags include `scout`.",
			sql: "SELECT name, tags\nFROM heroes\nWHERE tags @> '{scout}';",
		},
		{
			kind: "try",
			title: "Your turn: the first tag",
			prompt: "Return each hero's **name** and the **first** element of their `tags` (NULL when there is none).",
			starterSql: "SELECT name, tags[0]\nFROM heroes;",
			solutionSql: "SELECT name, tags[1] FROM heroes;",
			check: { type: "result" },
			hints: [
				"Run the starter: every value is NULL.",
				"Postgres arrays start at 1.",
			],
		},
	],
	exercises: [
		{
			id: "ch30-ex01",
			title: "Beyond the ordinary",
			story: "The quartermaster only insures loot rarer than *uncommon*.",
			prompt: "Return the **name** and **rarity** of every item whose rarity is **above** `uncommon` (rare, epic or legendary).",
			difficulty: 1,
			kind: "query",
			concepts: ["enum-types"],
			solutionSql: "SELECT name, rarity FROM items WHERE rarity > 'uncommon';",
			check: { type: "result" },
			hints: [
				"`rarity` is an enum: it compares by rank.",
				"`>` works directly on enum values.",
				"WHERE rarity > 'uncommon'",
			],
			explanation:
				"The literal `'uncommon'` is read as a `rarity`, and enum comparison follows the declared order: rare, epic and legendary pass.\n\n**Pitfall:** `rarity::text > 'uncommon'` compares letters, and no rarity name sorts after *uncommon*: zero rows.\n\n**Alternative:** `rarity IN ('rare', 'epic', 'legendary')`, which breaks the day a new rarity is added.",
		},
		{
			id: "ch30-ex02",
			title: "Roll call by class",
			story: "Aldric wants the muster roll in the order the founders declared the classes.",
			prompt:
				"Return each **class** with its number of **heroes**, in **class declaration order** (warrior first).",
			difficulty: 2,
			kind: "query",
			concepts: ["enum-types"],
			solutionSql: "SELECT class, count(*) AS heroes FROM heroes GROUP BY class ORDER BY class;",
			check: { type: "result", orderMatters: true },
			hints: [
				"GROUP BY class, then sort.",
				"Sorting an enum uses its declaration order, nothing extra needed.",
				"ORDER BY class",
			],
			explanation:
				"`ORDER BY class` follows the enum: warrior, mage, rogue, cleric, ranger, bard.\n\n**Pitfall:** `ORDER BY class::text` sorts alphabetically and puts the bards first.\n\n**Alternative:** `ORDER BY array_position(enum_range(NULL::hero_class), class)` spells out the same rank.",
		},
		{
			id: "ch30-ex03",
			title: "No debts in the ledger",
			story:
				"A prankster set someone's gold to a negative number last winter. The treasurer wants a rule that every purse column of the realm can reuse.",
			prompt:
				"Create a domain **gold_amount** based on `numeric(10,2)` that refuses **negative** values, then change the type of `heroes.gold` to `gold_amount`. NULL gold must stay allowed.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["domain-types"],
			setupSql: TRY_SQLSTATE,
			solutionSql:
				"CREATE DOMAIN gold_amount AS numeric(10,2) CHECK (VALUE >= 0);\nALTER TABLE heroes ALTER COLUMN gold TYPE gold_amount;",
			check: {
				type: "state",
				verifySql:
					"SELECT 'column' AS probe, domain_name::text || ' ' || data_type::text AS outcome FROM information_schema.columns WHERE table_name = 'heroes' AND column_name = 'gold'\nUNION ALL SELECT 'negative cast', try_sqlstate('SELECT (-1)::gold_amount')\nUNION ALL SELECT 'zero cast', try_sqlstate('SELECT 0::gold_amount')\nUNION ALL SELECT 'negative hero', try_sqlstate('UPDATE heroes SET gold = -5 WHERE id = 1')\nUNION ALL SELECT 'null hero', try_sqlstate('UPDATE heroes SET gold = NULL WHERE id = 2')\nUNION ALL SELECT 'scale', try_sqlstate('SELECT 1.234::gold_amount') || ' ' || (SELECT 1.234::gold_amount)::text;",
			},
			hints: [
				"Two statements: CREATE DOMAIN, then ALTER TABLE ... ALTER COLUMN ... TYPE.",
				"Inside a domain CHECK, the value is called `VALUE`.",
				"CREATE DOMAIN gold_amount AS numeric(10,2) CHECK (VALUE >= 0);",
			],
			explanation:
				"The rule now lives in the type: any column declared `gold_amount` refuses negative gold with 23514, and a NULL still passes (CHECK accepts unknown).\n\n**Pitfall:** a plain `ALTER TABLE heroes ADD CHECK (gold >= 0)` protects one column only; the next table with gold needs it again.\n\n**Alternative:** add `NOT NULL` to the domain when a value is mandatory, but beware: outer joins can still produce NULLs of that type.",
		},
		{
			id: "ch30-ex04",
			title: "The wise ones",
			story: "Morwen the Grey is assembling a council of the wise.",
			prompt:
				"Return the **name**, **str**, **dex** and **wis** (the three fields of `stats`) of every hero whose wisdom is **15 or more**, wisdom descending, ties by name (byte order).",
			difficulty: 2,
			kind: "query",
			concepts: ["composite-types"],
			solutionSql:
				"SELECT name, (stats).str, (stats).dex, (stats).wis\nFROM heroes\nWHERE (stats).wis >= 15\nORDER BY (stats).wis DESC, name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Each field is read with `(stats).field`.",
				"Filter and sort on `(stats).wis` too.",
				"WHERE (stats).wis >= 15 ORDER BY (stats).wis DESC, name",
			],
			explanation:
				"`(stats).wis` works everywhere an expression does: SELECT, WHERE and ORDER BY. In byte order `Nyx` comes before `Ælfric` on the tie at 16.\n\n**Pitfall:** `ORDER BY stats DESC` sorts the whole composite field by field, starting with str, not wisdom.\n\n**Alternative:** `SELECT name, (stats).*` expands all three fields at once.",
		},
		{
			id: "ch30-ex05",
			title: "The missing table",
			story: "The old scribe wrote this query to list every hero's dexterity. Postgres complains about a table that does not exist.",
			prompt: "Return the **name** and **dex** of every hero (heroes without stats show NULL).",
			difficulty: 2,
			kind: "query",
			concepts: ["composite-types"],
			starterSql: "SELECT name, stats.dex\nFROM heroes;",
			solutionSql: "SELECT name, (stats).dex FROM heroes;",
			check: { type: "result" },
			hints: [
				"Read the error: *missing FROM-clause entry for table stats*.",
				"Postgres reads `stats.dex` as table.column. Wrap the composite column in parentheses.",
				"(stats).dex",
			],
			explanation:
				"The parentheses tell the parser that `stats` is a value, not a table name.\n\n**Pitfall:** renaming things or adding a table alias does not help; only `(stats).dex` (or `(h.stats).dex` with an alias) does.\n\n**Alternative:** if you really want a dex column, store it as a plain column: composites are handy for function results, less for tables.",
		},
		{
			id: "ch30-ex06",
			title: "Scouts who shoot",
			story:
				"The Wandering Lanterns need a scout who is also an archer. The recruiter's query brings back half the guild.",
			prompt: "Return the **name** of every hero whose tags include **both** `scout` **and** `archer`.",
			difficulty: 2,
			kind: "query",
			concepts: ["arrays"],
			starterSql: "SELECT name\nFROM heroes\nWHERE tags && '{scout,archer}';",
			solutionSql: "SELECT name FROM heroes WHERE tags @> '{scout,archer}';",
			check: { type: "result" },
			hints: [
				"Run the starter: Cedric is a scout but carries no bow.",
				"`&&` means *at least one in common*; you need *contains all*.",
				"WHERE tags @> '{scout,archer}'",
			],
			explanation:
				"`@>` checks that every element on the right is in the array: Zoë and Wren qualify.\n\n**Pitfall:** `&&` (overlap) or `'scout' = ANY(tags)` answers a weaker question and lets every scout in.\n\n**Alternative:** `'scout' = ANY(tags) AND 'archer' = ANY(tags)`. Only `@>` and `&&` can use a GIN index.",
		},
		{
			id: "ch30-ex07",
			title: "Blank sheets",
			story:
				"The archivist must tag every hero who has no tags yet, whether the field was left empty or never filled in.",
			prompt: "Return the **name** of every hero who has **no tags at all**: tags NULL **or** an empty array.",
			difficulty: 3,
			kind: "query",
			concepts: ["arrays"],
			solutionSql: "SELECT name FROM heroes WHERE tags IS NULL OR tags = '{}';",
			check: { type: "result" },
			hints: [
				"There are two kinds of nothing: NULL and `'{}'`.",
				"`tags = '{}'` misses NULL arrays; `cardinality(NULL)` is NULL, not 0.",
				"WHERE tags IS NULL OR tags = '{}'",
			],
			explanation:
				"Seven heroes: three never filled in (NULL) and four explicitly empty.\n\n**Pitfall:** `cardinality(tags) = 0` finds only the four empty arrays, and `tags IS NULL` only the three NULLs.\n\n**Alternative:** `coalesce(cardinality(tags), 0) = 0`. Note `array_length('{}', 1)` is NULL, not 0: a classic surprise.",
		},
		{
			id: "ch30-ex08",
			title: "The tag census",
			story: "Which tags are fashionable this season?",
			prompt:
				"Return each distinct **tag** with the number of **heroes** carrying it, most common first, ties by tag (byte order).",
			difficulty: 3,
			kind: "query",
			concepts: ["arrays"],
			solutionSql:
				"SELECT t AS tag, count(*) AS heroes\nFROM heroes, unnest(tags) AS t\nGROUP BY t\nORDER BY heroes DESC, tag;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Turn each array into rows first.",
				"`unnest(tags)` in the FROM clause gives one row per hero and tag.",
				"FROM heroes, unnest(tags) AS t GROUP BY t ORDER BY count(*) DESC, t",
			],
			explanation:
				"`unnest` in FROM acts like a join between each hero and its own tags. NULL and empty arrays yield no rows, which is exactly right here.\n\n**Pitfall:** `GROUP BY tags` groups whole arrays: `{scout,archer}` and `{archer}` would be different groups.\n\n**Alternative:** `SELECT unnest(tags) ...` in the select list works too, but FROM keeps the logic visible.",
		},
		{
			id: "ch30-ex09",
			title: "Boss: The Class Registry",
			story:
				"The guild's charter must list, for every class, how many heroes it counts, how nimble they are and which tags they wear.",
			prompt:
				"For each **class**, in declaration order, return:\n\n- **heroes**: the number of heroes of that class\n- **avg_dex**: their average dexterity rounded to **1 decimal** (heroes without stats ignored)\n- **tags**: the array of **distinct** tags used by heroes of that class, sorted A to Z",
			difficulty: 4,
			kind: "query",
			concepts: ["enum-types", "composite-types", "arrays"],
			solutionSql:
				"SELECT h.class,\n       count(*) AS heroes,\n       round(avg((h.stats).dex), 1) AS avg_dex,\n       (SELECT array_agg(DISTINCT t ORDER BY t)\n        FROM heroes h2, unnest(h2.tags) AS t\n        WHERE h2.class = h.class) AS tags\nFROM heroes h\nGROUP BY h.class\nORDER BY h.class;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Count and average on `heroes` grouped by class; the tags need their own unnest.",
				"If you unnest tags in the main FROM, every hero is repeated once per tag (and heroes without tags vanish): counts and averages go wrong. Use a correlated subquery for the tags.",
				"(SELECT array_agg(DISTINCT t ORDER BY t) FROM heroes h2, unnest(h2.tags) t WHERE h2.class = h.class)",
			],
			explanation:
				"Grouping on the enum gives one row per class in charter order; `avg` skips Bors's NULL stats; the subquery unnests tags per class without disturbing the counts.\n\n**Pitfall:** `FROM heroes, unnest(tags)` then `count(*)` counts tags instead of heroes and loses the untagged: the mages jump from 5 to 8.\n\n**Alternative:** aggregate tags in a separate CTE grouped by class and join it to the counts.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch30-pr01",
			title: "The middle shelf",
			prompt: "Return the **name** of every item whose rarity is **between uncommon and epic**, both included.",
			difficulty: 1,
			kind: "query",
			concepts: ["enum-types"],
			solutionSql: "SELECT name FROM items WHERE rarity BETWEEN 'uncommon' AND 'epic';",
			check: { type: "result" },
			hints: [
				"BETWEEN works on enums.",
				"The rank order is common < uncommon < rare < epic < legendary.",
				"WHERE rarity BETWEEN 'uncommon' AND 'epic'",
			],
			explanation: "Uncommon, rare and epic items. On text, `BETWEEN 'uncommon' AND 'epic'` would be an empty range (u comes after e).",
		},
		{
			id: "ch30-pr02",
			title: "A new calling",
			prompt:
				"The guild recognises a new class: add the value **paladin** to `hero_class`, placed **right after cleric**.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["enum-types"],
			solutionSql: "ALTER TYPE hero_class ADD VALUE 'paladin' AFTER 'cleric';",
			check: { type: "state", verifySql: "SELECT enum_range(NULL::hero_class)::text AS classes;" },
			hints: [
				"Enums grow with ALTER TYPE.",
				"ADD VALUE accepts BEFORE or AFTER an existing label.",
				"ALTER TYPE hero_class ADD VALUE 'paladin' AFTER 'cleric';",
			],
			explanation:
				"Adding is easy; removing or renaming a value in use is not. When labels change often, a lookup table with a foreign key is more flexible.",
		},
		{
			id: "ch30-pr03",
			title: "Not a real class",
			prompt:
				"Try to recruit **Pip** as a `paladin` (level 1, joined `2026-10-31`) into `heroes` **without** changing the enum. The insert must be refused with the invalid label error.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["enum-types"],
			solutionSql: "INSERT INTO heroes (name, class, level, joined_on) VALUES ('Pip', 'paladin', 1, '2026-10-31');",
			check: { type: "error", sqlstate: "22P02" },
			hints: [
				"Write the INSERT as if paladin existed.",
				"Columns: name, class, level, joined_on.",
				"INSERT INTO heroes (name, class, level, joined_on) VALUES ('Pip', 'paladin', 1, '2026-10-31');",
			],
			explanation: "22P02, *invalid input value for enum hero_class*. The enum is a gatekeeper: typos never reach the table.",
		},
		{
			id: "ch30-pr04",
			title: "Apprentice levels",
			setupSql: TRY_SQLSTATE,
			prompt:
				"Create a domain **level_20** over `int` that only accepts values **from 1 to 20**, then a table **apprentices** with columns `name text` and `level level_20`.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["domain-types"],
			solutionSql:
				"CREATE DOMAIN level_20 AS int CHECK (VALUE BETWEEN 1 AND 20);\nCREATE TABLE apprentices (name text, level level_20);",
			check: {
				type: "state",
				verifySql:
					"SELECT 'type' AS probe, domain_name::text AS outcome FROM information_schema.columns WHERE table_name = 'apprentices' AND column_name = 'level'\nUNION ALL SELECT 'level 0', try_sqlstate('INSERT INTO apprentices VALUES (''a'', 0)')\nUNION ALL SELECT 'level 1', try_sqlstate('INSERT INTO apprentices VALUES (''b'', 1)')\nUNION ALL SELECT 'level 20', try_sqlstate('INSERT INTO apprentices VALUES (''c'', 20)')\nUNION ALL SELECT 'level 21', try_sqlstate('INSERT INTO apprentices VALUES (''d'', 21)');",
			},
			hints: [
				"CREATE DOMAIN ... AS int CHECK (...), then CREATE TABLE.",
				"Inside the CHECK, refer to the value as VALUE.",
				"CHECK (VALUE BETWEEN 1 AND 20)",
			],
			explanation: "Levels 0 and 21 bounce off with 23514; 1 and 20 get in. The same domain can now guard heroes, apprentices and any future table.",
		},
		{
			id: "ch30-pr05",
			title: "Brawn over grace",
			prompt: "Return the **name** of every hero whose strength is **greater than** their dexterity.",
			difficulty: 1,
			kind: "query",
			concepts: ["composite-types"],
			solutionSql: "SELECT name FROM heroes WHERE (stats).str > (stats).dex;",
			check: { type: "result" },
			hints: [
				"Compare two fields of the same composite.",
				"Fields need parentheses around the column.",
				"WHERE (stats).str > (stats).dex",
			],
			explanation: "Eight brawlers. Bors's NULL stats give an unknown comparison, so he is left out.",
		},
		{
			id: "ch30-pr06",
			title: "Forge a stat block",
			prompt:
				"Return the **dex** field of the stat block built from str 10, dex 12, wis 14 (`ROW(10, 12, 14)::stat_block`).",
			difficulty: 2,
			kind: "query",
			concepts: ["composite-types"],
			solutionSql: "SELECT (ROW(10, 12, 14)::stat_block).dex;",
			check: { type: "result" },
			hints: [
				"Build the value, then read a field.",
				"Wrap the whole value in parentheses before `.dex`.",
				"SELECT (ROW(10, 12, 14)::stat_block).dex;",
			],
			explanation: "12. The literal form `'(10,12,14)'::stat_block` builds the same value.",
		},
		{
			id: "ch30-pr07",
			title: "Kindred spirits",
			prompt:
				"Return the **name** of every hero who shares **at least one tag** with Aldric Stormborn (hero 1), Aldric excluded.",
			difficulty: 2,
			kind: "query",
			concepts: ["arrays"],
			solutionSql:
				"SELECT name FROM heroes WHERE tags && (SELECT tags FROM heroes WHERE id = 1) AND id <> 1;",
			check: { type: "result" },
			hints: [
				"Fetch Aldric's tags with a subquery.",
				"`&&` means overlap: at least one element in common.",
				"WHERE tags && (SELECT tags FROM heroes WHERE id = 1) AND id <> 1",
			],
			explanation: "Brynja, Hilde and Ulfric (veterans) and Morwen (leader).",
		},
		{
			id: "ch30-pr08",
			title: "Counting tags",
			prompt: "Return each hero's **name** and number of tags, showing **0** for heroes whose tags are NULL.",
			difficulty: 2,
			kind: "query",
			concepts: ["arrays"],
			solutionSql: "SELECT name, coalesce(cardinality(tags), 0) AS n_tags FROM heroes;",
			check: { type: "result" },
			hints: [
				"cardinality counts elements.",
				"cardinality(NULL) is NULL: add a fallback.",
				"coalesce(cardinality(tags), 0)",
			],
			explanation: "`cardinality('{}')` is 0 but `array_length('{}', 1)` is NULL, so cardinality is the safer counter.",
		},
		{
			id: "ch30-pr09",
			title: "Fire in the blood",
			prompt: "Return the **name** of every hero tagged **fire**.",
			difficulty: 1,
			kind: "query",
			concepts: ["arrays"],
			starterSql: "SELECT name\nFROM heroes\nWHERE 'fire' IN (tags);",
			solutionSql: "SELECT name FROM heroes WHERE 'fire' = ANY(tags);",
			check: { type: "result" },
			hints: [
				"Run the starter: IN expects a list of values, not an array.",
				"Use `= ANY(array)`.",
				"WHERE 'fire' = ANY(tags)",
			],
			explanation: "`'fire' = ANY(tags)` tests every element. `IN (tags)` compares 'fire' with the whole array, and fails to parse it.",
		},
	],
};

export default chapter;
