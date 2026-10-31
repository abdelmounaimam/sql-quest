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

const columnsOf = (rel: string): [string, string] => [
	`columns of ${rel}`,
	`SELECT column_name FROM information_schema.columns WHERE table_name = '${rel}' ORDER BY ordinal_position`,
];
const kindOf = (rel: string): [string, string] => [
	`kind of ${rel} (v = view, m = materialized view, r = table)`,
	`SELECT relkind FROM pg_class WHERE oid = '${rel}'::regclass`,
];

const REGION_REWARDS =
	"CREATE MATERIALIZED VIEW region_rewards AS\nSELECT region, sum(reward_gold) AS total FROM quests GROUP BY region;";

const chapter: Chapter = {
	id: "ch27-lenses-and-realms",
	order: 27,
	world: "The Architect's Tower",
	tier: "adept",
	track: "schema",
	title: "Lenses and Realms",
	subtitle: "Views, materialized views, schemas and reading the catalog",
	emoji: "🔭",
	datasetId: "guild",
	concepts: ["views", "materialized-views", "schemas-search-path", "catalog-introspection"],
	prerequisites: ["ch26-blueprints", "ch13-unions-and-named-spells"],
	lesson: [
		{
			kind: "explain",
			title: "A lens on the tables",
			body: "A **view** is a query with a name:\n```sql\nCREATE VIEW wanderers AS\nSELECT name, level FROM heroes WHERE guild_id IS NULL;\n```\nYou then `SELECT * FROM wanderers` like a table. A view **stores no rows**: each read runs the query again, so it is always up to date. It is a lens, not a copy.",
		},
		{
			kind: "example",
			title: "Hero cards",
			body: "One view hides a join for every future reader. Wanderers show a NULL guild thanks to the LEFT JOIN inside.",
			sql: "CREATE VIEW hero_cards AS\nSELECT h.name, g.name AS guild, h.level\nFROM heroes h\nLEFT JOIN guilds g ON g.id = h.guild_id;\n\nSELECT * FROM hero_cards ORDER BY level DESC, name LIMIT 6;",
		},
		{
			kind: "explain",
			title: "Writing through a view",
			body: "A **simple** view (one table, no grouping, no DISTINCT) is updatable: INSERT and UPDATE go to the table below.\n\nBut a row written through `WHERE level < 10` could land outside the view and vanish from it. `WITH CHECK OPTION` refuses such rows (44000):\n```sql\nCREATE VIEW apprentices AS\nSELECT id, name, level FROM heroes WHERE level < 10\nWITH CHECK OPTION;\n```",
		},
		{
			kind: "quiz",
			question:
				"You create `CREATE VIEW all_heroes AS SELECT * FROM heroes;`, then `ALTER TABLE heroes ADD COLUMN renown int;`. Does `SELECT * FROM all_heroes` show renown?",
			choices: [
				"Yes, a view always shows the current columns",
				"No: the `*` was expanded into a fixed column list when the view was created",
				"No, and the ALTER fails because a view depends on heroes",
				"Yes, but only after REFRESH",
			],
			answerIndex: 1,
			explanation:
				"Postgres stores the view with its columns spelled out. New table columns never appear by themselves; you must `CREATE OR REPLACE VIEW`. That is why views should list their columns. (Dropping a column the view uses *does* fail, with 2BP01.)",
		},
		{
			kind: "explain",
			title: "Materialized views: a snapshot",
			body: "A **materialized view** runs its query once and **stores** the result. Reads are fast, but the data is frozen until you ask:\n```sql\nREFRESH MATERIALIZED VIEW quest_board;\n```\nA plain refresh blocks readers while it runs. `REFRESH ... CONCURRENTLY` does not, but needs a **unique index** on the view (55000 otherwise). Nothing refreshes it automatically.",
		},
		{
			kind: "explain",
			title: "Schemas: realms inside the database",
			body: "A **schema** is a namespace. Your tables live in `public`.\n```sql\nCREATE SCHEMA archive;\nALTER TABLE hero_attributes SET SCHEMA archive;\nSELECT * FROM archive.hero_attributes;\n```\nAn unqualified name is looked up along the **search_path** (`SHOW search_path;`). Off the path, the table seems not to exist (42P01). `SET search_path TO public, archive;` adds the realm for this session.",
		},
		{
			kind: "example",
			title: "Every table, from the catalog",
			body: "There is no `\\d` here: ask the catalog with SQL. `information_schema` is the portable, standard view of it.",
			sql: "SELECT table_schema, table_name, table_type\nFROM information_schema.tables\nWHERE table_schema NOT IN ('pg_catalog', 'information_schema')\nORDER BY table_schema, table_name;",
		},
		{
			kind: "explain",
			title: "Reading the map of the realm",
			body: "| question | ask |\n|---|---|\n| columns of a table | `information_schema.columns` |\n| its indexes | `pg_indexes` |\n| its constraints | `pg_constraint` + `pg_get_constraintdef(oid)` |\n| table by name | `'heroes'::regclass` |\n| a comment | `obj_description('heroes'::regclass, 'pg_class')` |\n\nCatalog names are stored in lower case: `'Heroes'::regclass` fails.",
		},
		{
			kind: "try",
			title: "Your turn: the wanderers",
			prompt:
				"Create a view **wanderers** with the **name** and **level** of every hero who has **no guild**.",
			starterSql: "CREATE TABLE wanderers AS\nSELECT name, level FROM heroes WHERE guild_id IS NULL;",
			solutionSql:
				"CREATE VIEW wanderers AS\nSELECT name, level FROM heroes WHERE guild_id IS NULL;",
			check: {
				type: "state",
				verifySql: probes(
					["a new wanderer arrives", "INSERT INTO heroes (name, class, level, joined_on) VALUES ('Drifter', 'bard', 4, '2026-10-31')"],
					["wanderers", "SELECT name, level FROM wanderers ORDER BY name"],
				),
			},
			hints: [
				"The starter makes a copy: heroes arriving tomorrow will not appear.",
				"CREATE VIEW wanderers AS SELECT name, level FROM heroes WHERE guild_id IS NULL;",
			],
		},
	],
	exercises: [
		{
			id: "ch27-ex01",
			title: "Guild rosters",
			story:
				"Every guild master wants a roster. You give them one lens instead of teaching each of them the join.",
			prompt:
				"Create a view **guild_rosters** with three columns: **guild** (the guild's name), **hero** (the hero's name) and **class**, for every hero who **belongs to a guild**.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["views"],
			solutionSql:
				"CREATE VIEW guild_rosters AS\nSELECT g.name AS guild, h.name AS hero, h.class\nFROM heroes h\nJOIN guilds g ON g.id = h.guild_id;",
			check: {
				type: "state",
				verifySql: probes(
					columnsOf("guild_rosters"),
					["a hero joins the Quiet Bell", "INSERT INTO heroes (name, class, level, joined_on, guild_id) VALUES ('Probe Knight', 'warrior', 1, '2026-10-31', 6)"],
					["roster", "SELECT guild, hero, class FROM guild_rosters ORDER BY guild, hero"],
				),
			},
			hints: [
				"Write the SELECT first, run it, then put `CREATE VIEW guild_rosters AS` in front.",
				"An inner join drops the wanderers; aliases name the columns.",
				"CREATE VIEW guild_rosters AS SELECT g.name AS guild, h.name AS hero, h.class FROM heroes h JOIN guilds g ON g.id = h.guild_id;",
			],
			explanation:
				"The view keeps the join in one place, and because it stores nothing, the hero who joined the Quiet Bell *after* it was created shows up at once.\n\n**Pitfall:** `CREATE TABLE guild_rosters AS ...` looks the same on day one, then never changes again. A LEFT JOIN would list the wanderers with an empty guild.\n\n**Alternative:** `CREATE VIEW guild_rosters (guild, hero, class) AS SELECT g.name, h.name, h.class ...` names the columns up front.",
		},
		{
			id: "ch27-ex02",
			title: "The apprentice gate",
			story:
				"The apprentice master may register and train apprentices through his own view, but must never be able to create or promote a hero past level 9 with it.",
			prompt:
				"Create a view **apprentices** with **id**, **name**, **class**, **level** and **joined_on** of every hero **below level 10**, refusing any insert or update made through it that would produce a hero the view cannot see.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["views"],
			solutionSql:
				"CREATE VIEW apprentices AS\nSELECT id, name, class, level, joined_on\nFROM heroes\nWHERE level < 10\nWITH CHECK OPTION;",
			check: {
				type: "state",
				verifySql: probes(
					["Tiny Tim (level 3) joins through the view", "INSERT INTO apprentices (name, class, level, joined_on) VALUES ('Tiny Tim', 'bard', 3, '2026-10-31')"],
					["Big Bertha (level 15) joins through the view", "INSERT INTO apprentices (name, class, level, joined_on) VALUES ('Big Bertha', 'warrior', 15, '2026-10-31')"],
					["Pip promoted to level 12 through the view", "UPDATE apprentices SET level = 12 WHERE name = 'Pip Underbough'"],
					["Pip promoted to level 9 through the view", "UPDATE apprentices SET level = 9 WHERE name = 'Pip Underbough'"],
					["apprentices", "SELECT name, level FROM apprentices ORDER BY name"],
				),
			},
			hints: [
				"A simple view over one table is updatable. Something must still stop rows from escaping it.",
				"The clause goes at the very end of CREATE VIEW.",
				"... WHERE level < 10 WITH CHECK OPTION;",
			],
			explanation:
				"Inserts and updates pass through the simple view to heroes, and `WITH CHECK OPTION` re-checks the view's WHERE on the new row: level 15 and the promotion to 12 fail with 44000, level 9 is fine.\n\n**Pitfall:** without the option, Big Bertha is inserted and immediately disappears from the view that created her. `level <= 10` lets Dagny (level 10) in.\n\n**Alternative:** a CHECK on heroes would block everyone, not just this gate; the view limits only its own users.",
		},
		{
			id: "ch27-ex03",
			title: "The quest board",
			story:
				"The tavern's quest board is read a thousand times a day and changes rarely. The innkeeper wants it precomputed, and updated when he says so.",
			prompt:
				"1. Create a **materialized view** **quest_board** with **title** and **completions** (the number of completions, **0** for quests nobody finished) for every quest.\n2. Record that **Bors the Bold** (hero 24) completed **Rats in the Cellar** (quest 1) at **2026-10-31 12:00 UTC**.\n3. Bring the board up to date.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["materialized-views"],
			solutionSql:
				"CREATE MATERIALIZED VIEW quest_board AS\nSELECT q.title, count(c.hero_id) AS completions\nFROM quests q\nLEFT JOIN quest_completions c ON c.quest_id = q.id\nGROUP BY q.id, q.title;\n\nINSERT INTO quest_completions (hero_id, quest_id, completed_at)\nVALUES (24, 1, '2026-10-31 12:00+00');\n\nREFRESH MATERIALIZED VIEW quest_board;",
			check: {
				type: "state",
				verifySql: probes(
					kindOf("quest_board"),
					["board", "SELECT title, completions FROM quest_board ORDER BY title"],
					["Bors's completions", "SELECT quest_id FROM quest_completions WHERE hero_id = 24"],
				),
			},
			hints: [
				"Three statements: create, insert, refresh. Check the board between steps 2 and 3.",
				"A LEFT JOIN and `count(c.hero_id)` give 0 for unfinished quests.",
				"CREATE MATERIALIZED VIEW quest_board AS SELECT ... ; INSERT ...; REFRESH MATERIALIZED VIEW quest_board;",
			],
			explanation:
				"The materialized view stored the counts once; after the insert it still said 4 for Rats in the Cellar until `REFRESH` recomputed it to 5.\n\n**Pitfall:** forgetting the refresh: no error, just a stale board. A plain view would be fresh but recompute the join on every read; an inner join hides the two quests nobody finished.\n\n**Alternative:** a unique index on title plus `REFRESH ... CONCURRENTLY` keeps the board readable during the refresh.",
		},
		{
			id: "ch27-ex04",
			title: "Refresh without a key",
			story:
				"The treasurer heard that `CONCURRENTLY` keeps readers happy and wants it on his reward summary right away.",
			prompt:
				"The materialized view **region_rewards** has no index. Refresh it **concurrently**. This mission succeeds when your statement **fails** with the right error.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["materialized-views"],
			setupSql: REGION_REWARDS,
			solutionSql: "REFRESH MATERIALIZED VIEW CONCURRENTLY region_rewards;",
			check: { type: "error", sqlstate: "55000" },
			hints: [
				"Just write the concurrent refresh.",
				"REFRESH MATERIALIZED VIEW CONCURRENTLY name",
				"REFRESH MATERIALIZED VIEW CONCURRENTLY region_rewards;",
			],
			explanation:
				"A concurrent refresh compares old and new rows by a unique key so readers never see an empty view. Without a unique index it has no key: 55000, *object not in prerequisite state*.\n\n**Pitfall:** a plain `REFRESH` succeeds and locks out readers meanwhile; fine at night, painful at noon.\n\n**Alternative:** `CREATE UNIQUE INDEX ON region_rewards (region);` first, then the concurrent refresh works.",
		},
		{
			id: "ch27-ex05",
			title: "The archive realm",
			story:
				"The cursed legacy tables clutter the main hall. Elders want them moved to a realm of their own, untouched.",
			prompt:
				"Create a schema **archive** and move the tables **adventurer_sheet_legacy** and **hero_attributes** into it, with all their rows.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["schemas-search-path"],
			solutionSql:
				"CREATE SCHEMA archive;\nALTER TABLE adventurer_sheet_legacy SET SCHEMA archive;\nALTER TABLE hero_attributes SET SCHEMA archive;",
			check: {
				type: "state",
				verifySql: probes(
					["where the tables live", "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name IN ('adventurer_sheet_legacy', 'hero_attributes') ORDER BY table_name, table_schema"],
					["sheets in the archive", "SELECT count(*) FROM archive.adventurer_sheet_legacy"],
					["attributes in the archive", "SELECT count(*) FROM archive.hero_attributes"],
				),
			},
			hints: [
				"First the schema, then move each table.",
				"ALTER TABLE ... SET SCHEMA moves a table with its rows, indexes and constraints.",
				"CREATE SCHEMA archive; ALTER TABLE hero_attributes SET SCHEMA archive; (and the same for the sheets)",
			],
			explanation:
				"`SET SCHEMA` only changes the namespace: rows, keys and even the foreign key from hero_attributes to heroes come along.\n\n**Pitfall:** `CREATE TABLE archive.x AS SELECT * FROM x` copies the rows but leaves the original in public and drops every constraint.\n\n**Alternative:** `CREATE SCHEMA IF NOT EXISTS archive` makes the script safe to rerun.",
		},
		{
			id: "ch27-ex06",
			title: "Lost in another realm",
			story:
				"The attributes were moved to `archive` yesterday. This morning the scribe's favourite report fails.",
			prompt:
				"The starter fails with 42P01. Make it work by adding **archive** to the **search_path** (keep `public` on it), then run the report: **attr** and **entries** (number of rows) per attribute of `hero_attributes`.",
			difficulty: 3,
			kind: "query",
			concepts: ["schemas-search-path"],
			setupSql: "CREATE SCHEMA archive;\nALTER TABLE hero_attributes SET SCHEMA archive;",
			starterSql: "SELECT attr, count(*) AS entries\nFROM hero_attributes\nGROUP BY attr;",
			solutionSql:
				"SET search_path TO public, archive;\nSELECT attr, count(*) AS entries\nFROM hero_attributes\nGROUP BY attr;",
			check: { type: "result" },
			hints: [
				"The table exists, just not where Postgres looks. `SHOW search_path;` tells you where it looks.",
				"SET search_path takes a comma separated list of schemas.",
				"SET search_path TO public, archive;",
			],
			explanation:
				"With archive on the path, the unqualified name resolves again; the setting lasts for the session, so every following statement benefits.\n\n**Pitfall:** `SET search_path TO archive` alone works for this report but hides every public table for the rest of the session. Note `count(value)` would skip the NULL values and undercount.\n\n**Alternative:** qualify the name, `FROM archive.hero_attributes`: explicit, and immune to the path.",
		},
		{
			id: "ch27-ex07",
			title: "Ask the catalog",
			story:
				"A new archivist asks what a hero record looks like. You answer with a query, not a drawing.",
			prompt:
				"Return **column_name**, **data_type** and **is_nullable**, as `information_schema.columns` reports them, for every column of the table **heroes**, in the order the columns appear in the table.",
			difficulty: 2,
			kind: "query",
			concepts: ["catalog-introspection"],
			solutionSql:
				"SELECT column_name, data_type, is_nullable\nFROM information_schema.columns\nWHERE table_schema = 'public' AND table_name = 'heroes'\nORDER BY ordinal_position;",
			check: { type: "result", orderMatters: true },
			hints: [
				"information_schema.columns has one row per column of every table.",
				"Filter on table_name; the table order is in ordinal_position.",
				"WHERE table_name = 'heroes' ORDER BY ordinal_position",
			],
			explanation:
				"`ordinal_position` is the column's place in the table, the order `SELECT *` uses. Enums and composites show as 'USER-DEFINED', arrays as 'ARRAY'.\n\n**Pitfall:** sorting by column_name gives an alphabet, not the table; filtering on `'Heroes'` finds nothing, catalog names are lower case.\n\n**Alternative:** `pg_attribute` with `format_type(atttypid, atttypmod)` shows the real type names (hero_class, text[]).",
		},
		{
			id: "ch27-ex08",
			title: "The Grand Lens",
			story:
				"The Head Architect wants a living map of how the archive's tables point at each other, one that redraws itself when new tables appear.",
			prompt:
				"Create a view **fk_map** with one row per table of schema **public** that has at least one foreign key, and three columns:\n\n- **table_name**\n- **fk_count**: the number of foreign key constraints of that table\n- **referenced**: the tables they point to, each **once**, sorted A to Z, separated by `', '` (comma and space)\n\nThen return `SELECT * FROM fk_map` sorted by **table_name**.",
			difficulty: 5,
			kind: "ddl",
			concepts: ["catalog-introspection", "views"],
			boss: true,
			solutionSql:
				"CREATE VIEW fk_map AS\nSELECT conrelid::regclass::text AS table_name,\n       count(*) AS fk_count,\n       string_agg(DISTINCT confrelid::regclass::text, ', '\n                  ORDER BY confrelid::regclass::text) AS referenced\nFROM pg_constraint\nWHERE contype = 'f'\n  AND connamespace = 'public'::regnamespace\nGROUP BY conrelid;\n\nSELECT * FROM fk_map ORDER BY table_name;",
			check: {
				type: "result+state",
				orderMatters: true,
				verifySql:
					"CREATE TABLE loot_drops (hero_id int REFERENCES heroes, quest_id int REFERENCES quests, item_id int REFERENCES items);\nSELECT * FROM fk_map ORDER BY table_name;",
			},
			hints: [
				"`pg_constraint` has one row per constraint: contype 'f' for foreign keys, conrelid the table, confrelid the table it references.",
				"Group by the table, count the constraints, and aggregate the referenced names with `string_agg(DISTINCT ... ORDER BY ...)`. Cast with `::regclass::text` to get names.",
				"SELECT conrelid::regclass::text AS table_name, count(*) AS fk_count, string_agg(DISTINCT confrelid::regclass::text, ', ' ORDER BY confrelid::regclass::text) AS referenced FROM pg_constraint WHERE contype = 'f' ... GROUP BY conrelid",
			],
			explanation:
				"The view reads the catalog on every call, so a table created afterwards (the hidden test adds `loot_drops`) appears by itself. rumors has 2 foreign keys but references only heroes, once.\n\n**Pitfall:** `count(DISTINCT confrelid)` counts referenced tables, not constraints (rumors would show 1); `string_agg` without DISTINCT lists heroes twice; a VALUES list typed by hand is correct today and wrong tomorrow.\n\n**Alternative:** `information_schema.table_constraints` joined to `constraint_column_usage` gives the same map with standard views.",
		},
	],
	practice: [
		{
			id: "ch27-pr01",
			title: "One more column on the card",
			prompt:
				"The view **hero_cards** shows **name** and **level**. Add **gold** as a **third** column, keeping the same view name.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["views"],
			setupSql: "CREATE VIEW hero_cards AS SELECT name, level FROM heroes;",
			solutionSql: "CREATE OR REPLACE VIEW hero_cards AS SELECT name, level, gold FROM heroes;",
			check: {
				type: "state",
				verifySql: probes(columnsOf("hero_cards"), ["rich cards", "SELECT name FROM hero_cards WHERE gold >= 2000 ORDER BY name"]),
			},
			hints: [
				"A plain CREATE VIEW fails: the name is taken.",
				"CREATE OR REPLACE VIEW can add columns at the end.",
				"CREATE OR REPLACE VIEW hero_cards AS SELECT name, level, gold FROM heroes;",
			],
			explanation:
				"`CREATE OR REPLACE VIEW` swaps the query in place, keeping anything that depends on the view.\n\n**Pitfall:** putting gold in the middle fails (42P16): replacement may only add columns at the end.\n\n**Alternative:** `DROP VIEW hero_cards; CREATE VIEW ...` works too, unless other views depend on it.",
		},
		{
			id: "ch27-pr02",
			title: "Training through the lens",
			prompt:
				"Through the view **hero_levels** (not the table), set the level of **Bors the Bold** (id 24) to **2**.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["views"],
			setupSql: "CREATE VIEW hero_levels AS SELECT id, name, level FROM heroes;",
			solutionSql: "UPDATE hero_levels SET level = 2 WHERE id = 24;",
			check: { type: "state", verifySql: "SELECT id, level FROM heroes ORDER BY id;" },
			hints: [
				"A simple view accepts UPDATE like a table.",
				"UPDATE hero_levels SET ... WHERE id = 24",
				"UPDATE hero_levels SET level = 2 WHERE id = 24;",
			],
			explanation:
				"The update went through the view to heroes: simple views are automatically updatable.\n\n**Pitfall:** a view with GROUP BY, DISTINCT or a join of several tables is not (55000 or 0A000).\n\n**Alternative:** INSTEAD OF triggers make complex views writable (World 11).",
		},
		{
			id: "ch27-pr03",
			title: "An empty snapshot",
			prompt:
				"Create a materialized view **rich_heroes** (name and gold of heroes with more than 1000 gold) **WITH NO DATA**, then select from it. This mission succeeds when the script **fails** with the right error.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["materialized-views"],
			solutionSql:
				"CREATE MATERIALIZED VIEW rich_heroes AS\nSELECT name, gold FROM heroes WHERE gold > 1000\nWITH NO DATA;\nSELECT * FROM rich_heroes;",
			check: { type: "error", sqlstate: "55000" },
			hints: [
				"`WITH NO DATA` goes at the end of CREATE MATERIALIZED VIEW.",
				"Then a plain SELECT from it.",
				"CREATE MATERIALIZED VIEW rich_heroes AS SELECT ... WITH NO DATA; SELECT * FROM rich_heroes;",
			],
			explanation:
				"An unpopulated materialized view cannot be read (55000) until the first `REFRESH`.\n\n**Pitfall:** expecting an empty result: Postgres refuses instead, so nobody mistakes *not computed yet* for *no rich heroes*.\n\n**Alternative:** WITH NO DATA is handy to create views fast and fill them later, off hours.",
		},
		{
			id: "ch27-pr04",
			title: "Refresh, gently",
			story:
				"A new quest, Dragon Tea Party, was posted after **region_rewards** was computed.",
			prompt:
				"Make **region_rewards** refreshable **concurrently** (one row per region), then refresh it concurrently.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["materialized-views"],
			setupSql: `${REGION_REWARDS}\nINSERT INTO quests (title, region, difficulty, reward_gold) VALUES ('Dragon Tea Party', 'Highmoor', 1, 99);`,
			solutionSql:
				"CREATE UNIQUE INDEX region_rewards_region_key ON region_rewards (region);\nREFRESH MATERIALIZED VIEW CONCURRENTLY region_rewards;",
			check: {
				type: "state",
				verifySql: probes(
					["unique indexes", "SELECT count(*) FROM pg_indexes WHERE tablename = 'region_rewards' AND indexdef LIKE 'CREATE UNIQUE%'"],
					["rewards", "SELECT region, total FROM region_rewards ORDER BY region"],
				),
			},
			hints: [
				"CONCURRENTLY needs a unique index on the materialized view.",
				"region identifies each row.",
				"CREATE UNIQUE INDEX ON region_rewards (region); REFRESH MATERIALIZED VIEW CONCURRENTLY region_rewards;",
			],
			explanation:
				"With the unique index, the concurrent refresh can diff old and new rows: Highmoor's total grows by 99 while readers keep reading.\n\n**Pitfall:** a plain refresh also updates the numbers, but locks readers out, and leaves the view unable to refresh concurrently tomorrow.\n\n**Alternative:** the index can cover several columns, as long as it is unique and has no WHERE clause.",
		},
		{
			id: "ch27-pr05",
			title: "The vault",
			prompt:
				"Create a schema **vault**, a table **relics** in it with a single column **name** (`text`), and store the relic **Silver Scale**.",
			difficulty: 1,
			kind: "ddl",
			concepts: ["schemas-search-path"],
			solutionSql:
				"CREATE SCHEMA vault;\nCREATE TABLE vault.relics (name text);\nINSERT INTO vault.relics (name) VALUES ('Silver Scale');",
			check: {
				type: "state",
				verifySql: probes(
					["where relics lives", "SELECT table_schema FROM information_schema.tables WHERE table_name = 'relics'"],
					["relics", "SELECT name FROM vault.relics"],
				),
			},
			hints: [
				"Three statements: schema, table, row.",
				"Qualify the table name with the schema: vault.relics.",
				"CREATE SCHEMA vault; CREATE TABLE vault.relics (name text); INSERT INTO vault.relics VALUES ('Silver Scale');",
			],
			explanation:
				"Qualified names put objects exactly where you mean.\n\n**Pitfall:** `CREATE TABLE relics` without the prefix lands in public, the first schema of the search_path.\n\n**Alternative:** `SET search_path TO vault, public;` before creating unqualified tables.",
		},
		{
			id: "ch27-pr06",
			title: "Indexes of the armory",
			prompt:
				"Return **indexname** and **indexdef** of every index on the table **items**.",
			difficulty: 1,
			kind: "query",
			concepts: ["catalog-introspection"],
			solutionSql: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'items';",
			check: { type: "result" },
			hints: [
				"pg_indexes has one row per index.",
				"Filter on tablename.",
				"SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'items';",
			],
			explanation:
				"Two indexes: the primary key and the one behind `UNIQUE (name)`. Constraints that must be checked fast create indexes by themselves.\n\n**Pitfall:** looking for the indexes in information_schema: indexes are not in the SQL standard, so only pg_catalog knows them.\n\n**Alternative:** `pg_index` joined to `pg_class` gives the same, in raw form.",
		},
		{
			id: "ch27-pr07",
			title: "Leave a note",
			prompt:
				"Attach the comment **Missions posted by the guild** to the table **quests**, then return it read back from the catalog.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["catalog-introspection"],
			solutionSql:
				"COMMENT ON TABLE quests IS 'Missions posted by the guild';\nSELECT obj_description('quests'::regclass, 'pg_class');",
			check: {
				type: "result+state",
				verifySql: "SELECT obj_description('quests'::regclass, 'pg_class');",
			},
			hints: [
				"COMMENT ON TABLE name IS 'text'",
				"Read it with obj_description(oid, catalog).",
				"SELECT obj_description('quests'::regclass, 'pg_class');",
			],
			explanation:
				"Comments live in the catalog next to the object and travel with backups: documentation that cannot get lost.\n\n**Pitfall:** `'Quests'::regclass` fails: catalog names are lower case.\n\n**Alternative:** `COMMENT ON COLUMN quests.region IS ...` and `col_description` for columns.",
		},
	],
};

export default chapter;
