import type { Chapter } from "../types";

/**
 * World 7 grading: DDL is judged by behaviour. Every verifySql first creates a
 * hidden helper pg_temp.try_sql(stmt): a write returns 'ok' or 'error <SQLSTATE>',
 * a SELECT returns its rows as text. Probes run in order, so any correct design
 * passes, whatever its constraint names or identity flavour.
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

const isIdentity = (table: string, col: string): [string, string] => [
	`${table}.${col} is an identity`,
	`SELECT attidentity <> '' FROM pg_attribute WHERE attrelid = '${table}'::regclass AND attname = '${col}'`,
];
const primaryKey = (table: string): [string, string] => [
	`primary key of ${table}`,
	`SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey) WHERE i.indrelid = '${table}'::regclass AND i.indisprimary ORDER BY a.attname`,
];

const BANNERS_SETUP =
	"CREATE TABLE banners (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, motto text NOT NULL);\nINSERT INTO banners (motto) VALUES ('Scales of silver'), ('Hearts of steel');";

const chapter: Chapter = {
	id: "ch24-laying-foundations",
	order: 24,
	world: "The Architect's Tower",
	tier: "apprentice",
	track: "schema",
	title: "Laying Foundations",
	subtitle: "CREATE TABLE with good types, keys, identities and defaults",
	emoji: "🧱",
	datasetId: "guild",
	concepts: [
		"data-type-basics",
		"create-table",
		"primary-key",
		"identity-columns",
		"not-null-default",
		"naming-conventions",
		"drop-objects",
	],
	prerequisites: ["ch21-the-pact"],
	lesson: [
		{
			kind: "explain",
			title: "The guild raises a tower",
			body: "The Guild of the Silver Dragon is building a tower, and you are its architect. Every new room of the archive starts as a table, and every column needs a **type**:\n\n| need | type |\n|---|---|\n| counts, ids | `int` (or `bigint`) |\n| exact money | `numeric(10,2)` |\n| words | `text` |\n| yes or no | `boolean` |\n| a day | `date` |\n| an instant | `timestamptz` |",
		},
		{
			kind: "quiz",
			question:
				"The quartermaster wants to store each hero's gold, always with 2 decimals, and sum it without surprises. Which type?",
			choices: [
				"`float`, it handles decimals",
				"`text`, so '1520.00' is kept exactly as typed",
				"`numeric(10,2)`",
				"`int`, gold is gold",
			],
			answerIndex: 2,
			explanation:
				"`numeric` is exact: 0.10 + 0.20 is 0.30. `float` is binary and drifts (0.30000000000000004). `text` sorts '85' above '1200' and refuses arithmetic. `int` drops the copper.",
		},
		{
			kind: "explain",
			title: "Anatomy of CREATE TABLE",
			body: "```sql\nCREATE TABLE guild_halls (\n  id       int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name     text NOT NULL,\n  built_on date\n);\n```\nOne line per column: **name**, **type**, then optional **constraints**. Commas go *between* columns: a comma before the closing `)` is a syntax error (42601).",
		},
		{
			kind: "example",
			title: "Your first table",
			body: "Create a notice board, pin a notice, read it back. The `posted_on` column fills itself from its DEFAULT and the id is numbered for you.",
			sql: "CREATE TABLE notice_board (\n  id        int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  message   text NOT NULL,\n  posted_on date NOT NULL DEFAULT '2026-10-31'\n);\nINSERT INTO notice_board (message) VALUES ('Dragons welcome, boots off');\nSELECT * FROM notice_board;",
		},
		{
			kind: "explain",
			title: "PRIMARY KEY: the identity of a row",
			body: "A **primary key** is unique and never NULL: it names exactly one row.\n\n- A **surrogate** key is a meaningless number (`id`).\n- A **natural** key is real data (a tavern's unique name).\n- A **composite** key spans columns: `PRIMARY KEY (quest_id, hero_id)` lets a hero join many quests, but each quest only once.\n\nA table without a key happily stores the same row twice.",
		},
		{
			kind: "explain",
			title: "Identity columns",
			body: "`GENERATED ALWAYS AS IDENTITY` numbers rows 1, 2, 3... from an attached sequence.\n\n- **ALWAYS** refuses an explicit id (428C9) unless you write `OVERRIDING SYSTEM VALUE`.\n- **BY DEFAULT** accepts one, which can later collide with the sequence (23505).\n\nThe older `serial` does the same job with a plain default; prefer identity in new tables.",
		},
		{
			kind: "explain",
			title: "NOT NULL and DEFAULT",
			body: "`NOT NULL` makes a column **required** (23502 when missing). `DEFAULT` fills a column the INSERT leaves out:\n```sql\nreward_gold numeric(10,2) NOT NULL DEFAULT 0,\nposted_at   timestamptz   NOT NULL DEFAULT now(),\nis_open     boolean       NOT NULL DEFAULT true\n```\nCareful: an explicit `NULL` in VALUES is **not** the default. It is a NULL, and NOT NULL refuses it.",
		},
		{
			kind: "explain",
			title: "Names that age well",
			body: "Use **lower case snake_case**: `guild_halls`, `built_on`, `hero_id`.\n\n- Reserved words like `user` or `order` break your DDL (42601).\n- `\"Display Name\"` works, but then *every* query must quote it forever.\n- Unquoted names fold to lower case: `CREATE TABLE Hall` creates `hall`.\n\nPick plural or singular table names and stick to it.",
		},
		{
			kind: "quiz",
			question:
				"You run `DROP TABLE heroes;` and get error 2BP01. Why, and what would `DROP TABLE heroes CASCADE;` do?",
			choices: [
				"Heroes still has rows; CASCADE deletes them first",
				"Other tables have foreign keys pointing at heroes; CASCADE drops those constraints too",
				"You lack permission; CASCADE asks for it",
				"Heroes is a system table; CASCADE is not allowed",
			],
			answerIndex: 1,
			explanation:
				"Rows never block a DROP. **Dependencies** do: quest_completions, inventories and others reference heroes. `CASCADE` drops every dependent object (constraints, views) silently, so read the NOTICE before you celebrate. `DROP TABLE IF EXISTS x` simply skips a missing table.",
		},
		{
			kind: "try",
			title: "Your turn: the banner rack",
			prompt:
				"Create table **banners** with **id** (an `int` identity primary key) and **motto** (`text`, required).",
			starterSql: "CREATE TABLE banners (\n  id int,\n  motto text\n);",
			solutionSql:
				"CREATE TABLE banners (\n  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  motto text NOT NULL\n);",
			check: {
				type: "state",
				verifySql: probes(
					["a banner with a motto", "INSERT INTO banners (motto) VALUES ('Onward')"],
					["a banner without a motto", "INSERT INTO banners (motto) VALUES (NULL)"],
					["rows", "SELECT id, motto FROM banners ORDER BY id"],
					isIdentity("banners", "id"),
					primaryKey("banners"),
				),
			},
			hints: [
				"Run the hidden probes in your head: who numbers the id, and who refuses a NULL motto?",
				"id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, motto text NOT NULL",
			],
		},
	],
	exercises: [
		{
			id: "ch24-ex01",
			title: "The first stone",
			story:
				"Aldric Stormborn lays the first stone of the tower. The archive needs a register of guild halls before anything else.",
			prompt:
				"Create table **guild_halls** with:\n\n- **id**: `int`, an identity, the primary key\n- **name**: `text`, required\n- **region**: `text`, optional\n- **built_on**: `date`, optional\n\nHidden tests will insert halls and check what your table accepts.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["create-table", "primary-key"],
			starterSql: "CREATE TABLE guild_halls (\n  \n);",
			solutionSql:
				"CREATE TABLE guild_halls (\n  id       int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name     text NOT NULL,\n  region   text,\n  built_on date\n);",
			check: {
				type: "state",
				verifySql: probes(
					["a full hall", "INSERT INTO guild_halls (name, region, built_on) VALUES ('Dragon Spire', 'Highmoor', '2026-10-31')"],
					["a hall with only a name", "INSERT INTO guild_halls (name) VALUES ('Lantern Loft')"],
					["a hall without a name", "INSERT INTO guild_halls (region) VALUES ('Mistwood')"],
					["a hall built on 'someday'", "INSERT INTO guild_halls (name, built_on) VALUES ('Fog Hut', 'someday')"],
					["rows", "SELECT id, name, region, built_on FROM guild_halls ORDER BY id"],
					isIdentity("guild_halls", "id"),
					primaryKey("guild_halls"),
				),
			},
			hints: [
				"Four columns, one per line, separated by commas (none before the closing parenthesis).",
				"The id is numbered by the database: an identity column. A required column refuses NULL.",
				"id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, region text, built_on date",
			],
			explanation:
				"The identity numbers halls 1, 2, 3 by itself, `NOT NULL` refuses a nameless hall (23502) and the `date` type refuses 'someday' (22007): types are your first line of defense.\n\n**Pitfall:** `id int PRIMARY KEY` without identity makes every insert supply its own id, so the hall with only a name fails. And `built_on text` would happily store 'someday'.\n\n**Alternative:** `GENERATED BY DEFAULT AS IDENTITY`, or a table constraint `PRIMARY KEY (id)` at the end.",
		},
		{
			id: "ch24-ex02",
			title: "The quartermaster's draft",
			story:
				"The quartermaster drafted a table for supply orders on a napkin. It does not even run.",
			prompt:
				"The starter fails. Create table **orders** instead, with:\n\n- **id**: `int` identity primary key\n- **name**: `text`, required\n- **gold**: `numeric(10,2)`, required, default **0**\n\nAll names in lower case.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["naming-conventions", "data-type-basics"],
			starterSql: "CREATE TABLE Order (\n  ID serial,\n  Name varchar(255),\n  Gold float,\n);",
			solutionSql:
				"CREATE TABLE orders (\n  id   int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name text NOT NULL,\n  gold numeric(10,2) NOT NULL DEFAULT 0\n);",
			check: {
				type: "state",
				verifySql: probes(
					[
						"columns (name, type, not null, identity)",
						"SELECT attname, format_type(atttypid, atttypmod), attnotnull, attidentity <> '' FROM pg_attribute WHERE attrelid = 'orders'::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attname",
					],
					["an order with only a name", "INSERT INTO orders (name) VALUES ('Rope (50 ft)')"],
					["rows", "SELECT id, name, gold FROM orders ORDER BY id"],
					["an order without a name", "INSERT INTO orders (gold) VALUES (5)"],
					primaryKey("orders"),
				),
			},
			hints: [
				"Three problems: a reserved word as table name, a comma before `)`, and types that drift or limit for no reason.",
				"`order` is reserved; `orders` is not. Money wants `numeric(10,2)`, not `float`.",
				"CREATE TABLE orders (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, gold numeric(10,2) NOT NULL DEFAULT 0);",
			],
			explanation:
				"`orders` is an ordinary name, lower case snake_case needs no quotes, and `numeric(10,2)` stores gold exactly with 2 decimals.\n\n**Pitfall:** quoting `\"Order\"` makes it run, but now every query must write `\"Order\"` with that exact case, forever. `float` gold drifts when summed.\n\n**Alternative:** `varchar(255)` is legal but adds a limit nobody asked for; in Postgres `text` is just as fast.",
		},
		{
			id: "ch24-ex03",
			title: "No double booking",
			story:
				"Morwen the Grey found Aldric listed three times in the same party. The new party roll must make that impossible.",
			prompt:
				"Create table **party_members** with **quest_id** (`int`), **hero_id** (`int`) and **role** (`text`), so that the same hero can join many quests and a quest can have many heroes, but a hero is in a given quest **at most once**. Both ids are required.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["primary-key"],
			solutionSql:
				"CREATE TABLE party_members (\n  quest_id int,\n  hero_id  int,\n  role     text,\n  PRIMARY KEY (quest_id, hero_id)\n);",
			check: {
				type: "state",
				verifySql: probes(
					["Aldric joins quest 3", "INSERT INTO party_members (quest_id, hero_id, role) VALUES (3, 1, 'tank')"],
					["Brynja joins quest 3", "INSERT INTO party_members (quest_id, hero_id, role) VALUES (3, 2, 'healer')"],
					["Aldric joins quest 17", "INSERT INTO party_members (quest_id, hero_id, role) VALUES (17, 1, 'scout')"],
					["Aldric joins quest 3 again", "INSERT INTO party_members (quest_id, hero_id, role) VALUES (3, 1, 'bard')"],
					["a member without a quest", "INSERT INTO party_members (quest_id, hero_id, role) VALUES (NULL, 4, 'cook')"],
					["a member without a hero", "INSERT INTO party_members (quest_id, hero_id, role) VALUES (5, NULL, 'cook')"],
					["rows", "SELECT count(*) FROM party_members"],
				),
			},
			hints: [
				"What identifies one row here? Not the quest alone, not the hero alone.",
				"A primary key can span two columns; it is declared after the columns.",
				"PRIMARY KEY (quest_id, hero_id)",
			],
			explanation:
				"The pair `(quest_id, hero_id)` is the identity of a membership: the composite key refuses the second Aldric in quest 3 (23505) and makes both ids NOT NULL.\n\n**Pitfall:** adding a surrogate `id` primary key and nothing else lets the same pair repeat forever: every duplicate gets a fresh id.\n\n**Alternative:** the guild's own `quest_completions` uses exactly this composite key.",
		},
		{
			id: "ch24-ex04",
			title: "Banner number seven",
			story:
				"The banner rack numbers its banners itself (`GENERATED ALWAYS`). A superstitious clerk insists on banner number 7 anyway.",
			prompt:
				"Table **banners** (`id` identity ALWAYS, `motto` text) has two banners. Insert a banner with **id 7** and motto **Lucky seven**, the plain way, and watch the tower refuse it. This mission succeeds when your statement fails with the right error.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["identity-columns"],
			setupSql: BANNERS_SETUP,
			solutionSql: "INSERT INTO banners (id, motto) VALUES (7, 'Lucky seven');",
			check: { type: "error", sqlstate: "428C9" },
			hints: [
				"Just write the INSERT the clerk wants: both columns, both values.",
				"`GENERATED ALWAYS` means the database alone chooses ids.",
				"INSERT INTO banners (id, motto) VALUES (7, 'Lucky seven');",
			],
			explanation:
				"Error 428C9 says *cannot insert a non-DEFAULT value into column id*: an ALWAYS identity protects its sequence from hand-picked ids that would collide later.\n\n**Pitfall:** switching to `BY DEFAULT` to silence it: the insert works, but when the sequence reaches 7 the next normal insert fails with 23505.\n\n**Alternative:** when you truly must (a data migration), `OVERRIDING SYSTEM VALUE` forces it.",
		},
		{
			id: "ch24-ex05",
			title: "The bounty board",
			story:
				"The quartermaster pins bounties every morning and never fills in more than the title. The table must do the rest.",
			prompt:
				"Create table **bounties** with:\n\n- **id**: `int` identity primary key\n- **title**: `text`, required\n- **reward_gold**: `numeric(10,2)`, required, default **0**\n- **posted_at**: `timestamptz`, required, default **the current moment**\n- **is_open**: `boolean`, required, default **true**",
			difficulty: 3,
			kind: "ddl",
			concepts: ["not-null-default"],
			solutionSql:
				"CREATE TABLE bounties (\n  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  title       text NOT NULL,\n  reward_gold numeric(10,2) NOT NULL DEFAULT 0,\n  posted_at   timestamptz NOT NULL DEFAULT now(),\n  is_open     boolean NOT NULL DEFAULT true\n);",
			check: {
				type: "state",
				verifySql: probes(
					["a bounty with only a title", "INSERT INTO bounties (title) VALUES ('Rats again')"],
					[
						"what the defaults filled in",
						"SELECT title, reward_gold, is_open, posted_at IS NOT NULL, pg_typeof(posted_at) FROM bounties",
					],
					["an explicit NULL reward", "INSERT INTO bounties (title, reward_gold) VALUES ('Free work', NULL)"],
					["an explicit NULL is_open", "INSERT INTO bounties (title, is_open) VALUES ('Maybe', NULL)"],
					["an explicit NULL posted_at", "INSERT INTO bounties (title, posted_at) VALUES ('Whenever', NULL)"],
					["a bounty without a title", "INSERT INTO bounties (reward_gold) VALUES (10)"],
					isIdentity("bounties", "id"),
				),
			},
			hints: [
				"Each column needs two things here: a NOT NULL and (except title) a DEFAULT.",
				"The current moment is `now()` (or `CURRENT_TIMESTAMP`).",
				"reward_gold numeric(10,2) NOT NULL DEFAULT 0, posted_at timestamptz NOT NULL DEFAULT now(), is_open boolean NOT NULL DEFAULT true",
			],
			explanation:
				"A title alone now gives a complete row: 0.00 gold, open, stamped with the moment of the insert. NOT NULL then guards against someone writing NULL on purpose.\n\n**Pitfall:** DEFAULT without NOT NULL: the default only fills *omitted* columns, so `VALUES ('Free work', NULL)` stores a NULL reward. And NOT NULL without DEFAULT makes the title-only insert fail.\n\n**Alternative:** `DEFAULT CURRENT_TIMESTAMP` is the SQL standard spelling of `now()`.",
		},
		{
			id: "ch24-ex06",
			title: "Spring cleaning",
			story:
				"Honorary titles move to a scroll of their own. The old table `hero_titles` must go, and so must `old_rumors`, which someone may already have burned.",
			prompt:
				"Drop the table **hero_titles**, then drop **old_rumors** in a way that does **not fail** if it does not exist (it does not). Do not touch anything else.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["drop-objects"],
			starterSql: "DROP TABLE hero_titles;\nDROP TABLE old_rumors;",
			solutionSql: "DROP TABLE hero_titles;\nDROP TABLE IF EXISTS old_rumors;",
			check: {
				type: "state",
				verifySql: probes(
					["hero_titles is gone", "SELECT to_regclass('hero_titles') IS NULL"],
					["old_rumors is gone", "SELECT to_regclass('old_rumors') IS NULL"],
					["heroes still standing", "SELECT count(*) FROM heroes"],
				),
			},
			hints: [
				"Run the starter: the second statement fails because the table is not there.",
				"DROP has a clause that skips missing objects with a notice instead of an error.",
				"DROP TABLE IF EXISTS old_rumors;",
			],
			explanation:
				"`IF EXISTS` turns *table does not exist* (42P01) into a harmless notice, which makes cleanup scripts safe to run twice.\n\n**Pitfall:** `DELETE FROM hero_titles` empties the table but keeps it; `TRUNCATE` too. Only `DROP` removes the table itself.\n\n**Alternative:** one statement for both: `DROP TABLE IF EXISTS hero_titles, old_rumors;`",
		},
		{
			id: "ch24-ex07",
			title: "Copper and crumbs",
			story:
				"The treasurer drops a tenth of a gold coin in the tip jar three times a day. At night the ledger must say exactly 0.30, not 0.30000000000000004.",
			prompt:
				"Create table **treasury_entries** with **id** (`int` identity primary key), **amount** (an **exact** amount with **2 decimals**), **recorded_at** (an instant **with time zone**), **approved** (yes or no) and **note** (free text). Insert **three** entries of **0.10**, each recorded at **2026-10-31 18:00 UTC**, approved, with note **tip jar**. Finally return the **total** amount.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["data-type-basics"],
			solutionSql:
				"CREATE TABLE treasury_entries (\n  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  amount      numeric(10,2) NOT NULL,\n  recorded_at timestamptz NOT NULL,\n  approved    boolean NOT NULL,\n  note        text\n);\nINSERT INTO treasury_entries (amount, recorded_at, approved, note) VALUES\n  (0.10, '2026-10-31 18:00+00', true, 'tip jar'),\n  (0.10, '2026-10-31 18:00+00', true, 'tip jar'),\n  (0.10, '2026-10-31 18:00+00', true, 'tip jar');\nSELECT sum(amount) AS total FROM treasury_entries;",
			check: {
				type: "result+state",
				verifySql: probes(
					[
						"amount type",
						"SELECT CASE WHEN t LIKE 'numeric(%,2)' THEN 'numeric(p,2)' ELSE t END FROM (SELECT format_type(atttypid, atttypmod) AS t FROM pg_attribute WHERE attrelid = 'treasury_entries'::regclass AND attname = 'amount') x",
					],
					[
						"other types",
						"SELECT attname, CASE WHEN t LIKE 'character varying%' THEN 'text' ELSE t END FROM (SELECT attname, format_type(atttypid, atttypmod) AS t FROM pg_attribute WHERE attrelid = 'treasury_entries'::regclass AND attname IN ('recorded_at', 'approved', 'note')) x ORDER BY attname",
					],
					["rows", "SELECT amount, recorded_at, approved, note FROM treasury_entries ORDER BY id"],
					isIdentity("treasury_entries", "id"),
				),
			},
			hints: [
				"Translate each need into a type: exact with 2 decimals, an instant with time zone, yes or no, free text.",
				"`numeric(10,2)`, `timestamptz`, `boolean`, `text`. Then one INSERT with three rows, then a SELECT with sum.",
				"amount numeric(10,2), recorded_at timestamptz, approved boolean, note text ... SELECT sum(amount) AS total FROM treasury_entries;",
			],
			explanation:
				"`numeric` stores decimal digits, so three times 0.10 is exactly 0.30, and `timestamptz` pins the instant to UTC whatever the reader's time zone.\n\n**Pitfall:** `float` (or `real`) stores binary fractions: the sum becomes 0.30000000000000004 and pennies drift in every report. `timestamp` without time zone forgets which clock 18:00 was read on.\n\n**Alternative:** any precision works (`numeric(12,2)`), as long as the scale is 2.",
		},
		{
			id: "ch24-ex08",
			title: "The Tower Registry",
			story:
				"The tower is finished. Brynja Ironhand hands you the keys, the floor plans and a pile of old drafts. Build the registry and clear the scaffolding.",
			prompt:
				"Create three tables and clean up:\n\n1. **tower_floors**: **floor_no** `int` primary key (no identity: floors have real numbers), **name** `text` required, **guardian_hero_id** `int` optional, **opened_on** `date` required, default **today** (`current_date`).\n2. **floor_keys**: **floor_no** `int`, **hero_id** `int`, **granted_at** `timestamptz` required, default **now**. A hero holds at most one key per floor.\n3. **tower_visits**: **id** `int` identity primary key, **hero_id** and **floor_no** `int` both required, **visited_at** `timestamptz` required, default **now**.\n4. Drop the old table **tower_draft**. The table **draft_notes** has a foreign key to it: draft_notes and its notes must survive.",
			difficulty: 5,
			kind: "ddl",
			concepts: [
				"create-table",
				"primary-key",
				"identity-columns",
				"not-null-default",
				"drop-objects",
				"naming-conventions",
			],
			boss: true,
			setupSql:
				"CREATE TABLE tower_draft (floor_no int PRIMARY KEY, sketch text);\nCREATE TABLE draft_notes (floor_no int REFERENCES tower_draft (floor_no), note text);\nINSERT INTO tower_draft VALUES (1, 'big hall'), (2, 'armory?');\nINSERT INTO draft_notes VALUES (1, 'needs more torches'), (2, 'ask Brynja');",
			solutionSql:
				"CREATE TABLE tower_floors (\n  floor_no         int PRIMARY KEY,\n  name             text NOT NULL,\n  guardian_hero_id int,\n  opened_on        date NOT NULL DEFAULT current_date\n);\nCREATE TABLE floor_keys (\n  floor_no   int,\n  hero_id    int,\n  granted_at timestamptz NOT NULL DEFAULT now(),\n  PRIMARY KEY (floor_no, hero_id)\n);\nCREATE TABLE tower_visits (\n  id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  hero_id    int NOT NULL,\n  floor_no   int NOT NULL,\n  visited_at timestamptz NOT NULL DEFAULT now()\n);\nDROP TABLE tower_draft CASCADE;",
			check: {
				type: "state",
				verifySql: probes(
					["floor 1", "INSERT INTO tower_floors (floor_no, name) VALUES (1, 'Hall of Echoes')"],
					["floor 2 with a guardian", "INSERT INTO tower_floors (floor_no, name, guardian_hero_id) VALUES (2, 'Armory', 2)"],
					["floor 1 again", "INSERT INTO tower_floors (floor_no, name) VALUES (1, 'Second Hall')"],
					["a floor without a name", "INSERT INTO tower_floors (floor_no, name) VALUES (3, NULL)"],
					["a floor without a number", "INSERT INTO tower_floors (floor_no, name) VALUES (NULL, 'Attic')"],
					["a floor with opened_on NULL", "INSERT INTO tower_floors (floor_no, name, opened_on) VALUES (4, 'Roof', NULL)"],
					["floors", "SELECT floor_no, name, guardian_hero_id, opened_on = current_date FROM tower_floors ORDER BY floor_no"],
					["key to floor 1 for Aldric", "INSERT INTO floor_keys (floor_no, hero_id) VALUES (1, 1)"],
					["key to floor 1 for Morwen", "INSERT INTO floor_keys (floor_no, hero_id) VALUES (1, 3)"],
					["key to floor 2 for Aldric", "INSERT INTO floor_keys (floor_no, hero_id) VALUES (2, 1)"],
					["second key to floor 1 for Aldric", "INSERT INTO floor_keys (floor_no, hero_id) VALUES (1, 1)"],
					["a key with granted_at NULL", "INSERT INTO floor_keys (floor_no, hero_id, granted_at) VALUES (2, 3, NULL)"],
					["keys", "SELECT floor_no, hero_id, granted_at IS NOT NULL FROM floor_keys ORDER BY floor_no, hero_id"],
					["two visits by Aldric", "INSERT INTO tower_visits (hero_id, floor_no) VALUES (1, 1), (1, 1)"],
					["a visit without a hero", "INSERT INTO tower_visits (floor_no) VALUES (2)"],
					["visits", "SELECT id, hero_id, floor_no, visited_at IS NOT NULL FROM tower_visits ORDER BY id"],
					isIdentity("tower_visits", "id"),
					["tower_draft is gone", "SELECT to_regclass('tower_draft') IS NULL"],
					["draft_notes survived", "SELECT floor_no, note FROM draft_notes ORDER BY floor_no"],
				),
			},
			hints: [
				"Build one table at a time; floor_keys needs a key made of two columns. Try a plain DROP of tower_draft first and read the error.",
				"`DEFAULT current_date` and `DEFAULT now()` fill the dates. A table others depend on needs `DROP ... CASCADE`, which removes the foreign key, not draft_notes.",
				"floor_keys: PRIMARY KEY (floor_no, hero_id). tower_visits: id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY. Cleanup: DROP TABLE tower_draft CASCADE;",
			],
			explanation:
				"Each table got the key that matches what identifies a row: a real floor number, a (floor, hero) pair, a generated visit number. Defaults fill the dates, NOT NULL guards them, and `CASCADE` removed only the foreign key of draft_notes, never its rows.\n\n**Pitfall:** a composite key on tower_visits would forbid Aldric's second visit; an identity on floor_no would renumber real floors. A plain `DROP TABLE tower_draft` fails with 2BP01.\n\n**Alternative:** `ALTER TABLE draft_notes DROP CONSTRAINT ...` first, then a plain DROP, does the same in two steps (ALTER arrives next chapter).",
		},
	],
	practice: [
		{
			id: "ch24-pr01",
			title: "Pick the types",
			prompt:
				"Create table **quest_log** with four columns and the fitting types: **quest_id** (a whole number), **finished_at** (an instant with time zone), **notes** (free text) and **paid** (yes or no).",
			difficulty: 1,
			kind: "ddl",
			concepts: ["data-type-basics"],
			solutionSql:
				"CREATE TABLE quest_log (\n  quest_id    int,\n  finished_at timestamptz,\n  notes       text,\n  paid        boolean\n);",
			check: {
				type: "state",
				verifySql: probes([
					"column kinds",
					"SELECT attname, CASE WHEN t IN ('integer', 'bigint', 'smallint') THEN 'whole number' WHEN t = 'text' OR t LIKE 'character varying%' THEN 'text' ELSE t END FROM (SELECT attname, format_type(atttypid, atttypmod) AS t FROM pg_attribute WHERE attrelid = 'quest_log'::regclass AND attnum > 0 AND NOT attisdropped) x ORDER BY attname",
				]),
			},
			hints: [
				"Four needs, four types from the first lesson card.",
				"Whole number: int. Instant with time zone: timestamptz. Yes or no: boolean.",
				"quest_id int, finished_at timestamptz, notes text, paid boolean",
			],
			explanation:
				"Each value gets the type that can hold all of its legal values and nothing else.\n\n**Pitfall:** storing the date or the flag as text: '31/10' and 'yes ' would be accepted and nothing could compare them.\n\n**Alternative:** `bigint` for ids that may pass two billion.",
		},
		{
			id: "ch24-pr02",
			title: "The scribe's purses",
			story:
				"The old scribe kept purses in a table where gold is `text`. Sorting it gives nonsense.",
			prompt:
				"Table **old_purses** has **hero** and **gold** (stored as text). Return **hero** and **gold** as a number, richest first.",
			difficulty: 2,
			kind: "query",
			concepts: ["data-type-basics"],
			setupSql:
				"CREATE TABLE old_purses (hero text, gold text);\nINSERT INTO old_purses VALUES ('Aldric Stormborn', '1520.00'), ('Finn O''Rourke', '120.75'), ('Nyx', '3000'), ('Pip Underbough', '18.20'), ('Bors the Bold', '5');",
			starterSql: "SELECT hero, gold\nFROM old_purses\nORDER BY gold DESC;",
			solutionSql:
				"SELECT hero, gold::numeric AS gold FROM old_purses ORDER BY gold::numeric DESC;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Run the starter: '5' comes first. Text is sorted letter by letter.",
				"Cast the text to a number before sorting.",
				"ORDER BY gold::numeric DESC",
			],
			explanation:
				"As text, '5' beats '3000' because '5' > '3'. Cast to `numeric`, the values compare as amounts.\n\n**Pitfall:** sorting the text column: wrong order and no error. The real cure is the right column type from day one.\n\n**Alternative:** `CAST(gold AS numeric)`.",
		},
		{
			id: "ch24-pr03",
			title: "The familiars' roll",
			prompt:
				"Create table **familiars** with **id** (`int` identity primary key), **name** (`text`, required), **species** (`text`) and **hero_id** (`int`).",
			difficulty: 1,
			kind: "ddl",
			concepts: ["create-table"],
			solutionSql:
				"CREATE TABLE familiars (\n  id      int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name    text NOT NULL,\n  species text,\n  hero_id int\n);",
			check: {
				type: "state",
				verifySql: probes(
					["Ash the owl", "INSERT INTO familiars (name, species, hero_id) VALUES ('Ash', 'owl', 3)"],
					["a nameless familiar", "INSERT INTO familiars (species) VALUES ('toad')"],
					["rows", "SELECT id, name, species, hero_id FROM familiars ORDER BY id"],
					isIdentity("familiars", "id"),
				),
			},
			hints: [
				"Same shape as the guild halls.",
				"Four columns; only name is required.",
				"id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, species text, hero_id int",
			],
			explanation:
				"Morwen's owl gets id 1 and a nameless toad is refused.\n\n**Pitfall:** forgetting the comma between two columns gives a syntax error near the next name.\n\n**Alternative:** `BY DEFAULT` identity works too.",
		},
		{
			id: "ch24-pr04",
			title: "Taverns by name",
			prompt:
				"Create table **taverns** with **name** (`text`) as a **natural** primary key, and **region** (`text`).",
			difficulty: 2,
			kind: "ddl",
			concepts: ["primary-key"],
			solutionSql: "CREATE TABLE taverns (\n  name   text PRIMARY KEY,\n  region text\n);",
			check: {
				type: "state",
				verifySql: probes(
					["The Prancing Wyvern", "INSERT INTO taverns (name, region) VALUES ('The Prancing Wyvern', 'Highmoor')"],
					["The Prancing Wyvern again", "INSERT INTO taverns (name, region) VALUES ('The Prancing Wyvern', 'Ashlands')"],
					["a tavern without a name", "INSERT INTO taverns (region) VALUES ('Mistwood')"],
					primaryKey("taverns"),
				),
			},
			hints: [
				"No id column this time: the name itself identifies the tavern.",
				"Put PRIMARY KEY on the name column.",
				"name text PRIMARY KEY, region text",
			],
			explanation:
				"A natural key uses real data: the second Prancing Wyvern is refused (23505) and so is a nameless tavern (23502).\n\n**Pitfall:** natural keys that change (a renamed tavern) must be updated everywhere they are referenced; that is why many designs prefer a surrogate id.\n\n**Alternative:** `PRIMARY KEY (name)` as a table constraint.",
		},
		{
			id: "ch24-pr05",
			title: "Forcing number 99",
			story:
				"For the guild's anniversary, the master herself orders banner number 99.",
			prompt:
				"Table **banners** has an ALWAYS identity. Insert the banner with **id 99** and motto **Ninety nine years**, overriding the identity.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["identity-columns"],
			setupSql: BANNERS_SETUP,
			solutionSql:
				"INSERT INTO banners (id, motto) OVERRIDING SYSTEM VALUE VALUES (99, 'Ninety nine years');",
			check: { type: "state", verifySql: "SELECT id, motto FROM banners ORDER BY id;" },
			hints: [
				"A plain insert with an id fails with 428C9.",
				"There is a clause between the column list and VALUES.",
				"INSERT INTO banners (id, motto) OVERRIDING SYSTEM VALUE VALUES (99, 'Ninety nine years');",
			],
			explanation:
				"`OVERRIDING SYSTEM VALUE` is the explicit permission an ALWAYS identity asks for.\n\n**Pitfall:** the sequence does not move: it still hands out 3, 4... and will collide at 99 one day. Migrations call `setval` afterwards.\n\n**Alternative:** let the database pick, and store the ceremonial number in its own column.",
		},
		{
			id: "ch24-pr06",
			title: "Which number did I get?",
			prompt:
				"Insert a banner with motto **Onward** into **banners** and return its generated **id**.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["identity-columns"],
			setupSql: BANNERS_SETUP,
			solutionSql: "INSERT INTO banners (motto) VALUES ('Onward') RETURNING id;",
			check: { type: "result+state", verifySql: "SELECT id, motto FROM banners ORDER BY id;" },
			hints: [
				"Leave the id out: the identity fills it.",
				"RETURNING shows columns of the inserted row.",
				"INSERT INTO banners (motto) VALUES ('Onward') RETURNING id;",
			],
			explanation:
				"The identity gave id 3 and `RETURNING id` handed it back in the same statement.\n\n**Pitfall:** `SELECT max(id)` afterwards can return another writer's row.\n\n**Alternative:** `RETURNING *` shows the whole row.",
		},
		{
			id: "ch24-pr07",
			title: "All defaults",
			prompt:
				"Table **watch_posts** gives every column a default. Add **one** watch post using **only** the defaults.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["not-null-default"],
			setupSql:
				"CREATE TABLE watch_posts (\n  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  post text NOT NULL DEFAULT 'main gate',\n  on_duty boolean NOT NULL DEFAULT true,\n  shift_start time NOT NULL DEFAULT '22:00'\n);",
			solutionSql: "INSERT INTO watch_posts DEFAULT VALUES;",
			check: {
				type: "state",
				verifySql: "SELECT id, post, on_duty, shift_start FROM watch_posts ORDER BY id;",
			},
			hints: [
				"No column needs a value from you.",
				"There is a special form of INSERT without VALUES.",
				"INSERT INTO watch_posts DEFAULT VALUES;",
			],
			explanation:
				"`DEFAULT VALUES` builds a row entirely from defaults: the main gate, on duty from 22:00.\n\n**Pitfall:** `VALUES (NULL)` is not the default: NOT NULL refuses it (23502).\n\n**Alternative:** `INSERT INTO watch_posts (post) VALUES (DEFAULT);`",
		},
		{
			id: "ch24-pr08",
			title: "A reserved name",
			prompt:
				"The starter fails. Create table **app_users** with **id** (`int` primary key) and **display_name** (`text`), using lower case names that need no quotes.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["naming-conventions"],
			starterSql: 'CREATE TABLE user (\n  id int PRIMARY KEY,\n  "Display Name" text\n);',
			solutionSql: "CREATE TABLE app_users (\n  id           int PRIMARY KEY,\n  display_name text\n);",
			check: {
				type: "state",
				verifySql: probes(
					[
						"columns",
						"SELECT attname, format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'app_users'::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attnum",
					],
					primaryKey("app_users"),
				),
			},
			hints: [
				"`user` is a reserved word; the column name has spaces and capitals.",
				"snake_case: lower case words joined by underscores.",
				"CREATE TABLE app_users (id int PRIMARY KEY, display_name text);",
			],
			explanation:
				"`app_users` and `display_name` never need quotes.\n\n**Pitfall:** `CREATE TABLE \"user\"` runs, but every later query must quote it, and `\"Display Name\"` must be typed with the exact capitals.\n\n**Alternative:** `members` or `accounts` avoid the reserved word too.",
		},
		{
			id: "ch24-pr09",
			title: "Pull the old mill down",
			prompt:
				"Drop the table **rumor_mills**. Table **mill_gossip** has a foreign key to it: keep **mill_gossip** and all its rows.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["drop-objects"],
			setupSql:
				"CREATE TABLE rumor_mills (id int PRIMARY KEY, name text);\nCREATE TABLE mill_gossip (mill_id int REFERENCES rumor_mills (id), line text);\nINSERT INTO rumor_mills VALUES (1, 'The Leaky Bucket');\nINSERT INTO mill_gossip VALUES (1, 'Nyx is a dragon.'), (1, 'The bell rings at midnight.');",
			starterSql: "DROP TABLE rumor_mills;",
			solutionSql: "DROP TABLE rumor_mills CASCADE;",
			check: {
				type: "state",
				verifySql: probes(
					["rumor_mills is gone", "SELECT to_regclass('rumor_mills') IS NULL"],
					["gossip kept", "SELECT count(*) FROM mill_gossip"],
				),
			},
			hints: [
				"Run the starter and read error 2BP01.",
				"CASCADE also drops what depends on the table: here, only the foreign key constraint.",
				"DROP TABLE rumor_mills CASCADE;",
			],
			explanation:
				"`CASCADE` dropped the foreign key of mill_gossip, not the table and not its rows.\n\n**Pitfall:** CASCADE on a table used by views drops those views too, silently except for a NOTICE. Read it.\n\n**Alternative:** drop the constraint first with ALTER TABLE, then a plain DROP.",
		},
	],
};

export default chapter;
