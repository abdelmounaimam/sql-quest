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

/** Any integrity refusal (23xxx) reads 'refused': RESTRICT (23001) and NO ACTION (23503) are equivalent. */
const refused = (stmt: string) =>
	`SELECT CASE WHEN r LIKE 'error 23%' THEN 'refused' ELSE r END FROM (SELECT pg_temp.try_sql($q$${stmt}$q$) AS r) x`;

const STALE_COUNTS =
	"ALTER TABLE guilds ADD COLUMN hero_count int NOT NULL DEFAULT 0;\nUPDATE guilds SET hero_count = CASE id WHEN 1 THEN 5 WHEN 2 THEN 4 WHEN 3 THEN 5 WHEN 4 THEN 4 WHEN 5 THEN 6 WHEN 6 THEN 1 END;";

const NOTES_SETUP =
	"CREATE TABLE notes (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, target_type text NOT NULL, target_id int NOT NULL, body text NOT NULL);\nINSERT INTO notes (target_type, target_id, body) VALUES\n  ('hero', 1, 'Snores like a dragon.'),\n  ('quest', 3, 'Bring ladders.'),\n  ('hero', 25, 'Origin unknown. Do not ask.'),\n  ('quest', 18, 'Nobody has returned yet.'),\n  ('hero', 99, 'Who wrote this?'),\n  ('quest', 42, 'A quest that never existed.'),\n  ('hero', 3, 'Talks to her staff.');";

// Boss probes: rows are found by name, never by generated id.
const SPIRE = "(SELECT id FROM towers WHERE name = 'Silver Spire')";
const floorOf = (no: number) =>
	`(SELECT f.id FROM floors f JOIN towers t ON t.id = f.tower_id WHERE t.name = 'Silver Spire' AND f.floor_no = ${no})`;
const roomOf = (no: number, name: string) => `(SELECT id FROM rooms WHERE floor_id = ${floorOf(no)} AND name = '${name}')`;
const addFloor = (no: number, danger: number, hero: string) =>
	`INSERT INTO floors (tower_id, floor_no, danger, guardian_hero_id) VALUES (${SPIRE}, ${no}, ${danger}, ${hero})`;

const chapter: Chapter = {
	id: "ch28-cursed-designs",
	order: 28,
	world: "The Architect's Tower",
	tier: "expert",
	track: "schema",
	title: "Cursed Designs",
	subtitle: "EAV, polymorphic ids, cached counters and trees: break the curses",
	emoji: "💀",
	datasetId: "guild",
	concepts: ["design-antipatterns", "denormalization", "hierarchy-models"],
	prerequisites: ["ch27-lenses-and-realms", "ch14-the-endless-stair"],
	lesson: [
		{
			kind: "explain",
			title: "The cursed scrolls",
			body: "Some designs look flexible and slowly poison the archive (Bill Karwin calls them antipatterns):\n\n- **EAV**: one `(entity, attribute, value)` table for everything, all text.\n- **Polymorphic links**: `target_type` + `target_id` pointing at *some* table.\n- **Comma lists** and **item1, item2, item3** columns (last chapter).\n- **One table per year** (`quests_2025`, `quests_2026`).\n\nAll share one curse: the database can no longer enforce types or keys.",
		},
		{
			kind: "example",
			title: "Meet the EAV table",
			body: "Every value is text. Look at Morwen's height, Cedric's birthday, and two heroes whose value is NULL: is the attribute unknown, or absent?",
			sql: "SELECT hero_id, attr, value\nFROM hero_attributes\nORDER BY hero_id, attr;",
		},
		{
			kind: "quiz",
			question:
				"A table `notes(target_type, target_id, body)` stores notes about heroes (`target_type = 'hero'`) and quests (`'quest'`). What can the database **not** enforce?",
			choices: [
				"That body is not empty",
				"That target_id points at an existing hero or quest: no foreign key can target two tables",
				"That target_type is 'hero' or 'quest'",
				"That two notes have different ids",
			],
			answerIndex: 1,
			explanation:
				"A CHECK can restrict target_type, but a foreign key references exactly one table. So orphan notes (hero 99, quest 42) creep in silently. The cure: one link table per target, each with a real FK.",
		},
		{
			kind: "explain",
			title: "Lifting the EAV curse",
			body: "Give each attribute its own **typed column**: `birthday date`, `height_cm int CHECK (height_cm > 0)`. Types and CHECKs come back for free.\n\nBut the old text holds garbage, and `value::date` aborts the whole query on the first bad value (22008). Sort it first:\n```sql\npg_input_is_valid(value, 'date')   -- true or false, never an error\n```\nThen keep only what is valid, and turn the rest into NULL.",
		},
		{
			kind: "explain",
			title: "Denormalization: a deliberate copy",
			body: "Sometimes you *choose* to store a derived fact for speed: a `guilds.hero_count` read a thousand times a day instead of counting heroes each time.\n\nThe price: every write to heroes must update the copy, or it **drifts**. Keep the source of truth normalized, measure before you cache, and plan how the copy stays in sync (one transaction, later a trigger in World 11). A materialized view is a denormalization too.",
		},
		{
			kind: "explain",
			title: "Four ways to store a tree",
			body: "| model | stores | subtree query |\n|---|---|---|\n| **adjacency list** | `parent_id` | recursive CTE |\n| **materialized path** | `'mage.fire.fireball'` | `LIKE 'mage.fire.%'` |\n| **nested sets** | `lft, rgt` numbers | `BETWEEN`, but inserts renumber half the tree |\n| **closure table** | every (ancestor, descendant, depth) pair | one join |\n\n`skill_tree` keeps both `parent_id` and `path`. Whatever the model, guard against cycles.",
		},
		{
			kind: "example",
			title: "A subtree without recursion",
			body: "`path` is an `ltree` (a type you meet in World 8); read as text, a prefix test finds a whole branch in one pass.",
			sql: "SELECT name, path\nFROM skill_tree\nWHERE path::text LIKE 'mage.ice.%'\nORDER BY path;",
		},
		{
			kind: "quiz",
			question:
				"Which tree models answer *all skills under Fire Magic, at any depth* without a recursive query?",
			choices: [
				"Only the adjacency list",
				"The materialized path and the closure table",
				"None: trees always need recursion",
				"Only nested sets",
			],
			answerIndex: 1,
			explanation:
				"A path prefix or a closure join reaches every depth at once (nested sets too, with a range test). The adjacency list stores only one step, so it must walk the tree with `WITH RECURSIVE`, which is fine, just slower to write and to run on deep trees.",
		},
		{
			kind: "try",
			title: "Your turn: impossible birthdays",
			prompt:
				"Return **hero_id** and **value** of every **birthday** in `hero_attributes` whose value is not NULL and is **not a valid date**.",
			starterSql:
				"SELECT hero_id, value\nFROM hero_attributes\nWHERE attr = 'birthday' AND value::date IS NULL;",
			solutionSql:
				"SELECT hero_id, value\nFROM hero_attributes\nWHERE attr = 'birthday'\n  AND value IS NOT NULL\n  AND NOT pg_input_is_valid(value, 'date');",
			check: { type: "result" },
			hints: [
				"Run the starter: the cast explodes on the first bad value.",
				"NOT pg_input_is_valid(value, 'date') tests without casting.",
			],
		},
	],
	exercises: [
		{
			id: "ch28-ex01",
			title: "Un-EAV the heroes",
			story:
				"Before rebuilding the attributes, the archivist wants to see them as a normal table.",
			prompt:
				"Return one row per hero present in `hero_attributes`, with **hero_id**, **birthday**, **height_cm** and **favorite_color** (the text values; NULL when the hero has no such attribute or its value is NULL). Ignore other attributes.",
			difficulty: 3,
			kind: "query",
			concepts: ["design-antipatterns"],
			solutionSql:
				"SELECT hero_id,\n       max(value) FILTER (WHERE attr = 'birthday')       AS birthday,\n       max(value) FILTER (WHERE attr = 'height_cm')      AS height_cm,\n       max(value) FILTER (WHERE attr = 'favorite_color') AS favorite_color\nFROM hero_attributes\nGROUP BY hero_id;",
			check: { type: "result" },
			hints: [
				"One output row per hero: GROUP BY hero_id. Each column picks one attribute.",
				"An aggregate with FILTER keeps only the rows of one attribute; max() of a single value is that value.",
				"max(value) FILTER (WHERE attr = 'birthday') AS birthday, ...",
			],
			explanation:
				"Grouping by hero and filtering each aggregate on one attribute pivots rows into columns: 7 heroes, holes as NULL.\n\n**Pitfall:** filtering `WHERE value IS NOT NULL` first drops Nyx entirely (her only attribute is a NULL birthday); joining three copies of the table with INNER JOINs drops every hero missing one attribute.\n\n**Alternative:** `max(CASE WHEN attr = 'birthday' THEN value END)`, the pre FILTER spelling.",
		},
		{
			id: "ch28-ex02",
			title: "Typed at last",
			story:
				"Morwen burns the EAV scroll and dictates proper columns. Garbage does not make the trip.",
			prompt:
				"Create **hero_profiles** with **hero_id** (`int` primary key, an existing hero), **birthday** (`date`), **height_cm** (`int`, **greater than 0**) and **favorite_color** (`text`). Fill it with one row per hero of `hero_attributes`:\n\n- **birthday**: only values written exactly as `YYYY-MM-DD` that are valid dates, otherwise NULL ('05/04/1995' is ambiguous: NULL);\n- **height_cm**: only valid integers, otherwise NULL;\n- **favorite_color**: as is.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["design-antipatterns"],
			solutionSql:
				"CREATE TABLE hero_profiles (\n  hero_id        int PRIMARY KEY REFERENCES heroes (id),\n  birthday       date,\n  height_cm      int CHECK (height_cm > 0),\n  favorite_color text\n);\nINSERT INTO hero_profiles (hero_id, birthday, height_cm, favorite_color)\nSELECT hero_id,\n       max(value) FILTER (WHERE attr = 'birthday'\n                          AND value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'\n                          AND pg_input_is_valid(value, 'date'))::date,\n       max(value) FILTER (WHERE attr = 'height_cm' AND pg_input_is_valid(value, 'integer'))::int,\n       max(value) FILTER (WHERE attr = 'favorite_color')\nFROM hero_attributes\nGROUP BY hero_id;",
			check: {
				type: "state",
				verifySql: probes(
					["profiles", "SELECT hero_id, birthday, height_cm, favorite_color FROM hero_profiles ORDER BY hero_id"],
					["Brynja born on 'someday'", "INSERT INTO hero_profiles (hero_id, birthday) VALUES (2, 'someday')"],
					["Ælfric 0 cm tall", "INSERT INTO hero_profiles (hero_id, height_cm) VALUES (4, 0)"],
					["Zoë 'tall' cm tall", "INSERT INTO hero_profiles (hero_id, height_cm) VALUES (6, 'tall')"],
					["a profile of hero 999", "INSERT INTO hero_profiles (hero_id) VALUES (999)"],
					["a second profile for Aldric", "INSERT INTO hero_profiles (hero_id) VALUES (1)"],
					["Brynja with nothing known", "INSERT INTO hero_profiles (hero_id) VALUES (2)"],
				),
			},
			hints: [
				"Start from the pivot of the previous mission, then cast only the values that survive the tests.",
				"Inside the FILTER: a regex for the shape `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` and `pg_input_is_valid(value, 'date')`; for heights `pg_input_is_valid(value, 'integer')`.",
				"max(value) FILTER (WHERE attr = 'birthday' AND value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(value, 'date'))::date",
			],
			explanation:
				"The FILTER keeps only clean values, so the cast after `max()` never meets garbage. Now the table itself refuses 'someday', 0 cm and hero 999: the types and keys the EAV had thrown away are back.\n\n**Pitfall:** `value::date` straight away aborts on '2041-02-30' (22008); trusting `pg_input_is_valid` alone keeps '05/04/1995', read as May 4 under this server's DateStyle, maybe wrongly.\n\n**Alternative:** `CASE WHEN ... THEN value::date END` inside the aggregate.",
		},
		{
			id: "ch28-ex03",
			title: "Notes that point nowhere",
			story:
				"The scribe's `notes` table points at heroes or quests through `target_type` and `target_id`. Someone tried to protect it with a foreign key.",
			prompt:
				"The starter fails. Replace the polymorphic table instead: create **hero_notes** (**hero_id** `int` required, an existing hero; **body** `text` required) and **quest_notes** (**quest_id** `int` required, an existing quest; **body** `text` required), each with an identity **id** primary key. Copy every note whose target **exists** (orphans are lost causes), then **drop** `notes`.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["design-antipatterns"],
			setupSql: NOTES_SETUP,
			starterSql: "ALTER TABLE notes\n  ADD FOREIGN KEY (target_id) REFERENCES heroes (id);",
			solutionSql:
				"CREATE TABLE hero_notes (\n  id      int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  hero_id int NOT NULL REFERENCES heroes (id),\n  body    text NOT NULL\n);\nCREATE TABLE quest_notes (\n  id       int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  quest_id int NOT NULL REFERENCES quests (id),\n  body     text NOT NULL\n);\nINSERT INTO hero_notes (hero_id, body)\nSELECT n.target_id, n.body FROM notes n\nWHERE n.target_type = 'hero' AND EXISTS (SELECT 1 FROM heroes h WHERE h.id = n.target_id);\nINSERT INTO quest_notes (quest_id, body)\nSELECT n.target_id, n.body FROM notes n\nWHERE n.target_type = 'quest' AND EXISTS (SELECT 1 FROM quests q WHERE q.id = n.target_id);\nDROP TABLE notes;",
			check: {
				type: "state",
				verifySql: probes(
					["hero notes", "SELECT hero_id, body FROM hero_notes ORDER BY hero_id"],
					["quest notes", "SELECT quest_id, body FROM quest_notes ORDER BY quest_id"],
					["a note on hero 999", "INSERT INTO hero_notes (hero_id, body) VALUES (999, 'Ghost')"],
					["a note on quest 999", "INSERT INTO quest_notes (quest_id, body) VALUES (999, 'Ghost')"],
					["a hero note with no hero", "INSERT INTO hero_notes (body) VALUES ('Nobody')"],
					["notes is gone", "SELECT to_regclass('notes') IS NULL"],
				),
			},
			hints: [
				"Run the starter: quest ids and orphans break a foreign key to heroes. One column cannot reference two tables.",
				"Two tables, each with its own REFERENCES. Copy with INSERT ... SELECT filtered on target_type, keeping only targets that exist (EXISTS or a JOIN).",
				"INSERT INTO hero_notes (hero_id, body) SELECT n.target_id, n.body FROM notes n JOIN heroes h ON h.id = n.target_id WHERE n.target_type = 'hero';",
			],
			explanation:
				"Each note now has a real foreign key, so ghosts like hero 999 are refused forever, and the two orphans of the old table stayed behind.\n\n**Pitfall:** copying without the existence test fails on the orphans (23503); forgetting the target_type filter turns quest 3 into a note about Morwen (hero 3).\n\n**Alternative:** one `notes` table with two nullable FKs `hero_id` and `quest_id` plus `CHECK (num_nonnulls(hero_id, quest_id) = 1)`.",
		},
		{
			id: "ch28-ex04",
			title: "The guild counter",
			story:
				"The herald reads guild sizes on every page of the guild almanac. You agree to cache them, on purpose.",
			prompt:
				"Add to **guilds** a column **hero_count** (`int`, required, default **0**) and fill it with each guild's real number of heroes (guilds without heroes stay at 0).",
			difficulty: 3,
			kind: "ddl",
			concepts: ["denormalization"],
			solutionSql:
				"ALTER TABLE guilds ADD COLUMN hero_count int NOT NULL DEFAULT 0;\nUPDATE guilds g\nSET hero_count = (SELECT count(*) FROM heroes h WHERE h.guild_id = g.id);",
			check: {
				type: "state",
				verifySql: probes(
					["counts", "SELECT id, hero_count FROM guilds ORDER BY id"],
					["a brand new guild", "INSERT INTO guilds (name, hall_region, founded_on) VALUES ('Fresh Start', 'Highmoor', '2026-10-31')"],
					["its count", "SELECT hero_count FROM guilds WHERE name = 'Fresh Start'"],
					["a NULL count", "UPDATE guilds SET hero_count = NULL WHERE id = 1"],
				),
			},
			hints: [
				"Two steps: ALTER TABLE to add the column, UPDATE to fill it.",
				"A correlated subquery counts each guild's heroes, 0 included.",
				"UPDATE guilds g SET hero_count = (SELECT count(*) FROM heroes h WHERE h.guild_id = g.id);",
			],
			explanation:
				"The correlated `count(*)` returns 0 for the Quiet Bell, and NOT NULL DEFAULT 0 keeps future guilds consistent. The copy is correct *today*: every hero insert, delete or transfer must now update it too.\n\n**Pitfall:** `count(*)` over a LEFT JOIN counts the guild's own row for the Quiet Bell: 1 instead of 0. Use `count(h.id)`.\n\n**Alternative:** `UPDATE guilds g SET hero_count = c.n FROM (SELECT guild_id, count(*) AS n FROM heroes GROUP BY guild_id) c WHERE c.guild_id = g.id` (empty guilds keep the default 0).",
		},
		{
			id: "ch28-ex05",
			title: "Drift detector",
			story:
				"Weeks later, someone forgot to update the counter. The almanac lies.",
			prompt:
				"**guilds.hero_count** is a cached copy. Return **guild_id**, **cached** (the stored count) and **actual** (the real number of heroes, 0 when none) for every guild whose cache is **wrong**.",
			difficulty: 3,
			kind: "query",
			concepts: ["denormalization"],
			setupSql: STALE_COUNTS,
			solutionSql:
				"SELECT g.id AS guild_id, g.hero_count AS cached, count(h.id) AS actual\nFROM guilds g\nLEFT JOIN heroes h ON h.guild_id = g.id\nGROUP BY g.id, g.hero_count\nHAVING g.hero_count <> count(h.id);",
			check: { type: "result" },
			hints: [
				"Recount from the source of truth, then compare with the copy.",
				"LEFT JOIN keeps empty guilds; count the heroes' id, not the rows.",
				"... GROUP BY g.id, g.hero_count HAVING g.hero_count <> count(h.id)",
			],
			explanation:
				"Three guilds drifted, including the Quiet Bell whose cache claims 1 member it never had.\n\n**Pitfall:** `count(*)` with the LEFT JOIN counts 1 for the empty guild and hides its drift; an INNER JOIN forgets empty guilds altogether.\n\n**Alternative:** compare with a correlated `(SELECT count(*) FROM heroes h WHERE h.guild_id = g.id)` in WHERE.",
		},
		{
			id: "ch28-ex06",
			title: "Every flame below",
			story:
				"A new branch, Firestorm Lore, sits next to Fire Magic in the tree. The mage master wants only what grows under Fire Magic.",
			prompt:
				"Using **skill_tree.path**, return the **name** of every skill **below** Fire Magic (path `mage.fire`), at any depth, **Fire Magic itself excluded**.",
			difficulty: 2,
			kind: "query",
			concepts: ["hierarchy-models"],
			setupSql:
				"INSERT INTO skill_tree (parent_id, class, name, path, cost) VALUES (1, 'mage', 'Firestorm Lore', 'mage.firestorm', 2);",
			starterSql: "SELECT name\nFROM skill_tree\nWHERE path::text LIKE 'mage.fire%';",
			solutionSql: "SELECT name\nFROM skill_tree\nWHERE path::text LIKE 'mage.fire.%';",
			check: { type: "result" },
			hints: [
				"Run the starter: two intruders. Which ones, and why?",
				"A child's path is the parent's path plus a dot plus a label.",
				"LIKE 'mage.fire.%'",
			],
			explanation:
				"The dot in `'mage.fire.%'` anchors the prefix to a whole label: Fireball, Meteor and Flame Shield, at any depth, with no recursion.\n\n**Pitfall:** `'mage.fire%'` also matches Fire Magic itself and the neighbour `mage.firestorm`: prefix tests on paths must include the separator.\n\n**Alternative:** the ltree operator `path <@ 'mage.fire' AND path <> 'mage.fire'`, or a recursive CTE over parent_id.",
		},
		{
			id: "ch28-ex07",
			title: "The closure scroll",
			story:
				"The skill master is tired of recursion. He wants every ancestor and descendant pair written down once and for all.",
			prompt:
				"Create **skill_closure** with **ancestor_id** and **descendant_id** (`int`, both existing skills, together the primary key) and **depth** (`int`, required), and fill it from **skill_tree.parent_id** with **every** pair where the descendant is under the ancestor, at any depth, **plus** each skill paired with itself at depth **0**.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["hierarchy-models"],
			solutionSql:
				"CREATE TABLE skill_closure (\n  ancestor_id   int REFERENCES skill_tree (id),\n  descendant_id int REFERENCES skill_tree (id),\n  depth         int NOT NULL,\n  PRIMARY KEY (ancestor_id, descendant_id)\n);\nINSERT INTO skill_closure (ancestor_id, descendant_id, depth)\nWITH RECURSIVE walk AS (\n  SELECT id AS ancestor_id, id AS descendant_id, 0 AS depth\n  FROM skill_tree\n  UNION ALL\n  SELECT w.ancestor_id, s.id, w.depth + 1\n  FROM walk w\n  JOIN skill_tree s ON s.parent_id = w.descendant_id\n)\nSELECT ancestor_id, descendant_id, depth FROM walk;",
			check: {
				type: "state",
				verifySql: probes(
					["pairs and deepest depth", "SELECT count(*), max(depth) FROM skill_closure"],
					["self pairs", "SELECT count(*) FROM skill_closure WHERE ancestor_id = descendant_id AND depth = 0"],
					["under Fire Magic", "SELECT s.name, c.depth FROM skill_closure c JOIN skill_tree s ON s.id = c.descendant_id WHERE c.ancestor_id = 2 AND c.depth > 0 ORDER BY c.depth, s.name"],
					["above Meteor", "SELECT ancestor_id, depth FROM skill_closure WHERE descendant_id = 4 ORDER BY depth"],
					["every pair", "SELECT ancestor_id, descendant_id, depth FROM skill_closure ORDER BY ancestor_id, descendant_id"],
					["the pair Mage Arts, Meteor again", "INSERT INTO skill_closure (ancestor_id, descendant_id, depth) VALUES (1, 4, 3)"],
					["a pair with skill 99", "INSERT INTO skill_closure (ancestor_id, descendant_id, depth) VALUES (99, 1, 1)"],
				),
			},
			hints: [
				"Start a recursive CTE with every skill paired with itself at depth 0.",
				"The recursive step goes one level down: join the children whose parent_id is the current descendant, keep the ancestor, add 1 to depth.",
				"WITH RECURSIVE walk AS (SELECT id, id, 0 FROM skill_tree UNION ALL SELECT w.ancestor_id, s.id, w.depth + 1 FROM walk w JOIN skill_tree s ON s.parent_id = w.descendant_id) INSERT ... or INSERT ... WITH RECURSIVE ... SELECT",
			],
			explanation:
				"56 pairs: 22 self pairs plus 34 (ancestor, descendant) links, the deepest at depth 3. Now *everything under Fire Magic* is a single join on `ancestor_id = 2`, and *every ancestor of Meteor* is the same table read the other way.\n\n**Pitfall:** without the depth 0 pairs, queries like *this skill and everything under it* need a UNION; starting the recursion only from roots misses pairs between inner nodes.\n\n**Alternative:** maintain the closure on every insert with one `INSERT ... SELECT` of the parent's ancestors plus the self pair.",
		},
		{
			id: "ch28-ex08",
			title: "Raise the Tower",
			story:
				"The final blueprint. Aldric, Morwen and the quartermaster dictate the spec of the guild's dungeon tower; hidden tests will hammer it with good and bad rows.",
			prompt:
				"Write the DDL for four tables, each with an **id** `int` identity primary key unless stated:\n\n1. **towers**: **name** text, required, unique.\n2. **floors**: **tower_id** (required, an existing tower), **floor_no** int **1 to 50**, unique **within** a tower, **danger** int **1 to 5**, **guardian_hero_id** (required, an existing hero; a hero may guard several floors). A tower that still has floors **cannot be deleted**.\n3. **rooms**: **floor_id** (required, an existing floor), **name** text required and unique **within** a floor, **parent_room_id** (optional, an existing room: secret chambers live inside rooms). A room is **never its own parent**. Deleting a floor **deletes its rooms**; deleting a room **deletes its chambers**.\n4. **room_treasures** (no id): **room_id** (an existing room, deleted with it), **item_id** (an existing item), **qty** int required **above 0**; each item **once** per room.",
			difficulty: 5,
			kind: "ddl",
			concepts: ["design-antipatterns", "hierarchy-models"],
			boss: true,
			solutionSql:
				"CREATE TABLE towers (\n  id   int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name text NOT NULL UNIQUE\n);\nCREATE TABLE floors (\n  id               int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  tower_id         int NOT NULL REFERENCES towers (id),\n  floor_no         int NOT NULL CHECK (floor_no BETWEEN 1 AND 50),\n  danger           int NOT NULL CHECK (danger BETWEEN 1 AND 5),\n  guardian_hero_id int NOT NULL REFERENCES heroes (id),\n  UNIQUE (tower_id, floor_no)\n);\nCREATE TABLE rooms (\n  id             int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  floor_id       int NOT NULL REFERENCES floors (id) ON DELETE CASCADE,\n  name           text NOT NULL,\n  parent_room_id int REFERENCES rooms (id) ON DELETE CASCADE,\n  UNIQUE (floor_id, name),\n  CHECK (parent_room_id <> id)\n);\nCREATE TABLE room_treasures (\n  room_id int REFERENCES rooms (id) ON DELETE CASCADE,\n  item_id int REFERENCES items (id),\n  qty     int NOT NULL CHECK (qty > 0),\n  PRIMARY KEY (room_id, item_id)\n);",
			check: {
				type: "state",
				verifySql: probes(
					["tower Silver Spire", "INSERT INTO towers (name) VALUES ('Silver Spire')"],
					["tower Silver Spire again", "INSERT INTO towers (name) VALUES ('Silver Spire')"],
					["a tower without a name", "INSERT INTO towers (name) VALUES (NULL)"],
					["tower Ash Needle", "INSERT INTO towers (name) VALUES ('Ash Needle')"],
					["floor 1, guarded by Aldric", addFloor(1, 2, "1")],
					["floor 2, also guarded by Aldric", addFloor(2, 4, "1")],
					["floor 1 of Ash Needle", "INSERT INTO floors (tower_id, floor_no, danger, guardian_hero_id) VALUES ((SELECT id FROM towers WHERE name = 'Ash Needle'), 1, 3, 19)"],
					["floor 1 of Silver Spire again", addFloor(1, 1, "3")],
					["floor 51", addFloor(51, 1, "3")],
					["floor 3 with danger 6", addFloor(3, 6, "3")],
					["floor 4 guarded by hero 999", addFloor(4, 1, "999")],
					["floor 5 with no guardian", addFloor(5, 1, "NULL")],
					["a floor of tower 999", "INSERT INTO floors (tower_id, floor_no, danger, guardian_hero_id) VALUES (999, 1, 1, 1)"],
					["Vault on floor 1", `INSERT INTO rooms (floor_id, name) VALUES (${floorOf(1)}, 'Vault')`],
					["Vault on floor 2", `INSERT INTO rooms (floor_id, name) VALUES (${floorOf(2)}, 'Vault')`],
					["Vault on floor 1 again", `INSERT INTO rooms (floor_id, name) VALUES (${floorOf(1)}, 'Vault')`],
					["a room on floor 999", "INSERT INTO rooms (floor_id, name) VALUES (999, 'Lost Room')"],
					["Hidden Niche inside the floor 1 Vault", `INSERT INTO rooms (floor_id, name, parent_room_id) VALUES (${floorOf(1)}, 'Hidden Niche', ${roomOf(1, "Vault")})`],
					["a chamber inside room 999", `INSERT INTO rooms (floor_id, name, parent_room_id) VALUES (${floorOf(1)}, 'Nowhere', 999)`],
					["the floor 1 Vault becomes its own parent", `UPDATE rooms SET parent_room_id = id WHERE id = ${roomOf(1, "Vault")}`],
					["the Dragonbone Sword in the floor 1 Vault", `INSERT INTO room_treasures (room_id, item_id, qty) VALUES (${roomOf(1, "Vault")}, 2, 1)`],
					["5 potions in the Hidden Niche", `INSERT INTO room_treasures (room_id, item_id, qty) VALUES (${roomOf(1, "Hidden Niche")}, 1, 5)`],
					["0 torches in the floor 1 Vault", `INSERT INTO room_treasures (room_id, item_id, qty) VALUES (${roomOf(1, "Vault")}, 5, 0)`],
					["the sword again in the floor 1 Vault", `INSERT INTO room_treasures (room_id, item_id, qty) VALUES (${roomOf(1, "Vault")}, 2, 2)`],
					["item 99 in the floor 1 Vault", `INSERT INTO room_treasures (room_id, item_id, qty) VALUES (${roomOf(1, "Vault")}, 99, 1)`],
					["Closet inside the floor 2 Vault", `INSERT INTO rooms (floor_id, name, parent_room_id) VALUES (${floorOf(2)}, 'Closet', ${roomOf(2, "Vault")})`],
					["the floor 2 Vault collapses", `DELETE FROM rooms WHERE id = ${roomOf(2, "Vault")}`],
					["rooms left on floor 2", `SELECT count(*) FROM rooms WHERE floor_id = ${floorOf(2)}`],
					["floor 1 collapses", `DELETE FROM floors WHERE id = ${floorOf(1)}`],
					["rooms left in Silver Spire", `SELECT count(*) FROM rooms r JOIN floors f ON f.id = r.floor_id WHERE f.tower_id = ${SPIRE}`],
					["treasures left", "SELECT count(*) FROM room_treasures"],
					["Silver Spire is demolished", refused("DELETE FROM towers WHERE name = 'Silver Spire'")],
					["floors left", "SELECT t.name, f.floor_no FROM floors f JOIN towers t ON t.id = f.tower_id ORDER BY t.name, f.floor_no"],
				),
			},
			hints: [
				"Create parents before children: towers, floors, rooms, room_treasures. \"Unique within\" means a UNIQUE over two columns.",
				"Each \"deleted with\" is an `ON DELETE CASCADE`; \"cannot be deleted\" is the default action. A room referencing rooms is a self foreign key, and `CHECK (parent_room_id <> id)` stops the simplest cycle.",
				"floors: UNIQUE (tower_id, floor_no), CHECK (floor_no BETWEEN 1 AND 50). rooms: parent_room_id int REFERENCES rooms (id) ON DELETE CASCADE, UNIQUE (floor_id, name). room_treasures: PRIMARY KEY (room_id, item_id), qty CHECK (qty > 0).",
			],
			explanation:
				"Every rule of the spec lives in the schema: composite UNIQUEs for *unique within*, CHECKs for ranges, FKs for every link with the action the spec asked for, a self FK for the room tree. No EAV, no polymorphic ids, no comma lists: the hidden tests found nothing to exploit.\n\n**Pitfall:** `UNIQUE (floor_no)` alone forbids floor 1 in a second tower; `ON DELETE SET NULL` on parent_room_id leaves orphan chambers floating; CASCADE on tower_id would let one DELETE erase a whole tower.\n\n**Alternative:** natural keys such as `PRIMARY KEY (tower_id, floor_no)` for floors work too, if the hidden tests could find the rows; the CHECK only stops one-step cycles, longer ones need a trigger or a closure check.",
		},
	],
	practice: [
		{
			id: "ch28-pr01",
			title: "Census of the EAV",
			prompt: "Return **attr** and **entries**, the number of rows of `hero_attributes` for each attribute.",
			difficulty: 1,
			kind: "query",
			concepts: ["design-antipatterns"],
			solutionSql: "SELECT attr, count(*) AS entries FROM hero_attributes GROUP BY attr;",
			check: { type: "result" },
			hints: [
				"One row per attribute name.",
				"GROUP BY attr with count(*).",
				"SELECT attr, count(*) FROM hero_attributes GROUP BY attr;",
			],
			explanation:
				"Only Finn has an instrument: in an EAV table, the set of columns is whatever someone typed, typos included.\n\n**Pitfall:** `count(value)` skips the NULL values and undercounts birthdays.\n\n**Alternative:** `SELECT DISTINCT attr` to list the would-be columns.",
		},
		{
			id: "ch28-pr02",
			title: "Heights that are not numbers",
			prompt:
				"Return **hero_id** and **value** of every **height_cm** in `hero_attributes` that is **not a valid integer**.",
			difficulty: 2,
			kind: "query",
			concepts: ["design-antipatterns"],
			starterSql: "SELECT hero_id, value\nFROM hero_attributes\nWHERE attr = 'height_cm' AND value::int IS NULL;",
			solutionSql:
				"SELECT hero_id, value\nFROM hero_attributes\nWHERE attr = 'height_cm' AND NOT pg_input_is_valid(value, 'integer');",
			check: { type: "result" },
			hints: [
				"The starter's cast aborts on the first bad value.",
				"pg_input_is_valid(text, type) answers without raising.",
				"AND NOT pg_input_is_valid(value, 'integer')",
			],
			explanation:
				"Morwen is 'tall enough': a typed column would never have accepted it.\n\n**Pitfall:** the cast raises 22P02 and kills the whole query.\n\n**Alternative:** `value !~ '^[0-9]+$'` checks the shape with a regex.",
		},
		{
			id: "ch28-pr03",
			title: "Resync the counter",
			prompt:
				"**guilds.hero_count** has drifted. With **one** UPDATE, set it back to each guild's real number of heroes (0 when none).",
			difficulty: 2,
			kind: "mutation",
			concepts: ["denormalization"],
			setupSql: STALE_COUNTS,
			solutionSql:
				"UPDATE guilds g\nSET hero_count = (SELECT count(*) FROM heroes h WHERE h.guild_id = g.id);",
			check: { type: "state", verifySql: "SELECT id, hero_count FROM guilds ORDER BY id;" },
			hints: [
				"Recompute from the source for every guild.",
				"A correlated count(*) gives 0 for empty guilds.",
				"UPDATE guilds g SET hero_count = (SELECT count(*) FROM heroes h WHERE h.guild_id = g.id);",
			],
			explanation:
				"Recomputing every row from the source is the simplest repair, and safe to run any time.\n\n**Pitfall:** an `UPDATE ... FROM (grouped heroes)` skips the empty guild, leaving the Quiet Bell at 1.\n\n**Alternative:** run it inside the same transaction as each hero change, or move it into a trigger (World 11).",
		},
		{
			id: "ch28-pr04",
			title: "Gold that went missing",
			prompt:
				"**guilds.total_gold** caches the sum of its heroes' gold. Return **guild_id**, **cached** and **actual** (sum of known gold, **0** for a guild with no heroes or no known gold) for every guild whose cache is wrong.",
			difficulty: 3,
			kind: "query",
			concepts: ["denormalization"],
			setupSql:
				"ALTER TABLE guilds ADD COLUMN total_gold numeric(12,2) NOT NULL DEFAULT 0;\nUPDATE guilds g SET total_gold = coalesce((SELECT sum(gold) FROM heroes h WHERE h.guild_id = g.id), 0);\nUPDATE heroes SET gold = gold + 100 WHERE id = 3;\nUPDATE guilds SET total_gold = 500 WHERE id = 6;",
			solutionSql:
				"SELECT g.id AS guild_id, g.total_gold AS cached, coalesce(sum(h.gold), 0) AS actual\nFROM guilds g\nLEFT JOIN heroes h ON h.guild_id = g.id\nGROUP BY g.id, g.total_gold\nHAVING g.total_gold <> coalesce(sum(h.gold), 0);",
			check: { type: "result" },
			hints: [
				"Same shape as the drift detector, with sum instead of count.",
				"sum over no rows is NULL, and `500 <> NULL` is unknown: coalesce it.",
				"HAVING g.total_gold <> coalesce(sum(h.gold), 0)",
			],
			explanation:
				"Morwen's raise never reached the Moonlit Veil's cache, and the Quiet Bell claims 500 gold it never had.\n\n**Pitfall:** without coalesce, the empty guild's NULL sum makes the comparison unknown and hides its drift.\n\n**Alternative:** `IS DISTINCT FROM` instead of `<>`, still with coalesce for the 0.",
		},
		{
			id: "ch28-pr05",
			title: "Depth from the path",
			prompt:
				"Return **name** and **depth** of every skill, where depth is the number of labels in its **path** (`'mage'` is 1, `'mage.fire'` is 2).",
			difficulty: 2,
			kind: "query",
			concepts: ["hierarchy-models"],
			solutionSql:
				"SELECT name, array_length(string_to_array(path::text, '.'), 1) AS depth\nFROM skill_tree;",
			check: { type: "result" },
			hints: [
				"Labels are separated by dots.",
				"Split the text path on '.' and count the pieces.",
				"array_length(string_to_array(path::text, '.'), 1)",
			],
			explanation:
				"With a materialized path, depth is just reading the path: no recursion.\n\n**Pitfall:** counting characters, or counting dots and forgetting the +1.\n\n**Alternative:** the ltree function `nlevel(path)`.",
		},
		{
			id: "ch28-pr06",
			title: "Ancestors of the Meteor",
			prompt:
				"Using **parent_id** (the adjacency list), return **name** and **distance** of every ancestor of **Meteor** (id 4): its parent at distance 1, and so on up to the root.",
			difficulty: 3,
			kind: "query",
			concepts: ["hierarchy-models"],
			solutionSql:
				"WITH RECURSIVE up AS (\n  SELECT parent_id, 1 AS distance FROM skill_tree WHERE id = 4\n  UNION ALL\n  SELECT s.parent_id, u.distance + 1\n  FROM up u JOIN skill_tree s ON s.id = u.parent_id\n)\nSELECT s.name, u.distance\nFROM up u JOIN skill_tree s ON s.id = u.parent_id;",
			check: { type: "result" },
			hints: [
				"Climb one parent_id at a time with WITH RECURSIVE.",
				"Anchor: Meteor's parent at distance 1. Step: the parent of the previous row, distance + 1.",
				"WITH RECURSIVE up AS (SELECT parent_id, 1 AS distance FROM skill_tree WHERE id = 4 UNION ALL SELECT s.parent_id, u.distance + 1 FROM up u JOIN skill_tree s ON s.id = u.parent_id) ...",
			],
			explanation:
				"Fireball, Fire Magic, Mage Arts: the adjacency list needs one recursive step per level, but it is the easiest model to keep correct.\n\n**Pitfall:** a fixed chain of self joins works for 3 levels and silently misses the 4th.\n\n**Alternative:** the closure table answers it in one join: `WHERE descendant_id = 4 AND depth > 0`.",
		},
	],
};

export default chapter;
