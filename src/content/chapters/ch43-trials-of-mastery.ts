import type { Chapter } from "../types";

/** Hidden checker helper: rows of a table visible to a role (or the SQLSTATE). */
const SEEN_AS = `CREATE FUNCTION seen_as(r text, tbl text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  EXECUTE format('SET ROLE %I', r);
  EXECUTE format('SELECT count(*) FROM %I', tbl) INTO n;
  RESET ROLE;
  RETURN n::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $f$;`;

const BOSS_SETUP = `${SEEN_AS}
DO $$
BEGIN
  CREATE ROLE guild_master_1 NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT SELECT ON heroes, guilds TO guild_master_1;
CREATE TABLE gold_rewards (reward_id int NOT NULL, hero_id int NOT NULL, amount numeric(10,2) NOT NULL);
INSERT INTO gold_rewards VALUES (1, 1, 100.00), (2, 13, 50.50), (3, 22, 25.00), (4, 1, 10.00);`;

const PAYOUT = `WITH paid AS (
  INSERT INTO reward_ledger (reward_id, hero_id, amount)
  SELECT reward_id, hero_id, amount FROM gold_rewards
  ON CONFLICT (reward_id) DO NOTHING
  RETURNING hero_id, amount
)
UPDATE heroes h
SET gold = coalesce(h.gold, 0) + p.total
FROM (SELECT hero_id, sum(amount) AS total FROM paid GROUP BY hero_id) AS p
WHERE h.id = p.hero_id;`;

const INVENTORY_ROWS = `SELECT i.hero_id, b->>'slot' AS slot, it->>'item' AS item, (it->>'qty')::int AS qty, it->'enchant' AS enchant
FROM inventories i, jsonb_array_elements(i.doc->'bags') AS b, jsonb_array_elements(b->'items') AS it
UNION ALL
SELECT hero_id, 'rest', (doc - 'bags')::text, NULL, NULL FROM inventories;`;

const chapter: Chapter = {
	id: "ch43-trials-of-mastery",
	order: 43,
	world: "The Astral Spire",
	tier: "master",
	track: "advanced",
	title: "Trials of Mastery",
	subtitle: "Side quest: no new syntax, every technique, and a peek behind the server",
	emoji: "👑",
	datasetId: "guild",
	concepts: ["operations-overview"],
	prerequisites: ["ch42-wards-and-gatekeepers"],
	lesson: [
		{
			kind: "explain",
			title: "Beyond the sandbox",
			body: "You are back in the Guild of the Silver Dragon, where it all began. Aldric has one last lesson: a real PostgreSQL server needs care your browser sandbox never did.\n\n- **Backups**: `pg_dump` for logical copies; base backups plus WAL archives for point-in-time recovery.\n- **Replication**: standby servers that follow the primary.\n- **Connection pooling** (PgBouncer): a few hundred connections, not thousands.\n- **Configuration** in `postgresql.conf`, and **upgrades** with `pg_upgrade`.",
		},
		{
			kind: "example",
			title: "Read the dials",
			body: "Every setting lives in `pg_settings`. The `context` column says how it can change. These values are PGlite's, not a production server's: read them, never copy them.",
			sql: "SELECT name, setting, unit, context\nFROM pg_settings\nWHERE name IN ('shared_buffers', 'work_mem', 'max_connections', 'wal_level')\nORDER BY name;",
		},
		{
			kind: "explain",
			title: "Measure before you tune",
			body: "Tuning by folklore makes servers slower. Measure first:\n\n- sizes: `pg_database_size(current_database())`, `pg_total_relation_size('heroes')` (table + indexes + TOAST);\n- activity: `pg_stat_user_tables`, `pg_stat_statements` on a real server;\n- plans: `EXPLAIN (ANALYZE, BUFFERS)`.\n\nThen change one knob at a time. `context` tells the cost: **postmaster** needs a restart, **sighup** a reload, **user** a simple `SET`.",
		},
		{
			kind: "example",
			title: "The weight of a table",
			body: "Surprise: the six-row `guilds` table weighs as much as the busiest ones. Storage comes in 8 kB pages, and each index (primary key, unique name) has pages of its own.",
			sql: "SELECT relname, n_live_tup AS rows, pg_total_relation_size(relid) AS bytes,\n       pg_size_pretty(pg_total_relation_size(relid)) AS pretty\nFROM pg_stat_user_tables\nORDER BY bytes DESC, relname\nLIMIT 6;",
		},
		{
			kind: "quiz",
			question:
				"Your streaming replica is always up to date, a few milliseconds behind the primary. Is it a backup?",
			choices: [
				"Yes: it holds a complete copy of the data",
				"No: a mistaken `DROP TABLE` or bad UPDATE reaches the replica within milliseconds",
				"Yes, as long as it runs on another machine",
				"Only if it is a logical replica",
			],
			answerIndex: 1,
			explanation:
				"Replication copies every change, including the disasters. A backup lets you go back in time: keep base backups and WAL archives (point-in-time recovery), and test restoring them.",
		},
		{
			kind: "explain",
			title: "The rules of the Trials",
			body: "The Trials are the guild's post-game:\n\n- each trial mixes techniques from several worlds;\n- any technique is allowed: windows or LATERAL, NOT EXISTS or EXCEPT, MERGE or ON CONFLICT;\n- the hints are there, but true masters try twice before opening them.\n\nThe final boss, **The Astral Throne**, builds a small multi-tenant guild application inside the database.",
		},
		{
			kind: "try",
			title: "Your turn: restart or not?",
			prompt:
				"Return the **context** of the setting `shared_buffers`, which tells whether changing it needs a restart.",
			starterSql: "SELECT setting\nFROM pg_settings\nWHERE name = 'shared_buffers';",
			solutionSql: "SELECT context FROM pg_settings WHERE name = 'shared_buffers';",
			check: { type: "result" },
			hints: [
				"The starter returns the value, not how it can change.",
				"SELECT context FROM pg_settings WHERE name = 'shared_buffers';",
			],
		},
	],
	exercises: [
		{
			id: "ch43-ex01",
			title: "Trial of the Podiums",
			story:
				"Morwen the Grey wants a podium per guild for the midwinter feast: the three heroes with the most experience. The herald's query put four heroes on the Ember Fang podium.",
			prompt:
				"For each guild, return the **guild name**, the **hero name** and the **xp** of its **3** heroes with the most xp, ties broken by hero name (A to Z). Heroes without a guild are not on any podium.",
			difficulty: 3,
			kind: "query",
			concepts: ["top-n-per-group", "ranking-functions"],
			starterSql:
				"SELECT guild, hero, xp\nFROM (\n  SELECT g.name AS guild, h.name AS hero, h.xp,\n         rank() OVER (PARTITION BY g.id ORDER BY h.xp DESC) AS rk\n  FROM heroes h\n  JOIN guilds g ON g.id = h.guild_id\n) ranked\nWHERE rk <= 3;",
			solutionSql:
				"SELECT guild, hero, xp\nFROM (\n  SELECT g.name AS guild, h.name AS hero, h.xp,\n         row_number() OVER (PARTITION BY g.id ORDER BY h.xp DESC, h.name) AS rn\n  FROM heroes h\n  JOIN guilds g ON g.id = h.guild_id\n) ranked\nWHERE rn <= 3;",
			check: { type: "result" },
			hints: [
				"Run the starter: Lyra Dawnsong and Rowan Ashby tie at 36000 xp and both get rank 3.",
				"`row_number()` never ties: give its ORDER BY the name as a tie breaker.",
				"row_number() OVER (PARTITION BY g.id ORDER BY h.xp DESC, h.name) ... WHERE rn <= 3",
			],
			explanation:
				"`row_number` with a tie breaker gives exactly three per guild: Lyra Dawnsong takes Ember Fang's third step over Rowan Ashby (both 36000 xp).\n\n**Pitfall:** `rank()` gives both of them 3 and the podium gets four heroes. **Alternative:** `CROSS JOIN LATERAL (SELECT ... ORDER BY xp DESC, name LIMIT 3)` per guild.",
		},
		{
			id: "ch43-ex02",
			title: "Trial of the Home Region",
			story:
				"A hero who has completed every quest of their guild hall's region earns the title *Warden of the Hall*.",
			prompt:
				"Return the **name** of every hero who belongs to a guild and has completed **every** quest whose region is the **hall_region** of their guild.",
			difficulty: 4,
			kind: "query",
			concepts: ["relational-division"],
			solutionSql:
				"SELECT h.name\nFROM heroes h\nJOIN guilds g ON g.id = h.guild_id\nWHERE NOT EXISTS (\n  SELECT 1 FROM quests q\n  WHERE q.region = g.hall_region\n    AND NOT EXISTS (\n      SELECT 1 FROM quest_completions c\n      WHERE c.hero_id = h.id AND c.quest_id = q.id\n    )\n);",
			check: { type: "result" },
			hints: [
				"Rephrase: there is **no** quest of the hall region that the hero has **not** completed.",
				"Double NOT EXISTS, or compare counts: completed quests of the region = all quests of the region.",
				"WHERE NOT EXISTS (SELECT 1 FROM quests q WHERE q.region = g.hall_region AND NOT EXISTS (SELECT 1 FROM quest_completions c WHERE c.hero_id = h.id AND c.quest_id = q.id))",
			],
			explanation:
				"Relational division: Aldric cleared all five Highmoor quests, Morwen the three of Mistwood, Ulfric the three of Ashlands.\n\n**Pitfall:** counting all of a hero's completions instead of only those in the hall region rewards busy heroes who never cleared home. **Alternative:** `GROUP BY h.id HAVING count(*) = (SELECT count(*) FROM quests WHERE region = g.hall_region)` on completions joined to quests of that region.",
		},
		{
			id: "ch43-ex03",
			title: "Trial of the Lineages",
			story:
				"The guild's genealogist traces every hero back to the founder of their teaching line.",
			prompt:
				"For **every** hero, return the hero's **name**, the **name of the root** of their mentor tree (the ancestor who has no mentor; a hero without a mentor is their own root) and their **depth** (0 for a root, 1 for a root's apprentice, and so on).",
			difficulty: 4,
			kind: "query",
			concepts: ["recursive-cte"],
			solutionSql:
				"WITH RECURSIVE lineage AS (\n  SELECT id, name, name AS root, 0 AS depth\n  FROM heroes WHERE mentor_id IS NULL\n  UNION ALL\n  SELECT h.id, h.name, l.root, l.depth + 1\n  FROM heroes h\n  JOIN lineage l ON h.mentor_id = l.id\n)\nSELECT name, root, depth FROM lineage;",
			check: { type: "result" },
			hints: [
				"Start from the roots (`mentor_id IS NULL`) and walk down to the apprentices.",
				"Carry the root's name and a depth counter through the recursion.",
				"Anchor: SELECT id, name, name AS root, 0 ... Recursive member: SELECT h.id, h.name, l.root, l.depth + 1 FROM heroes h JOIN lineage l ON h.mentor_id = l.id",
			],
			explanation:
				"Walking downward lets each row inherit its root from the parent: Mabel Crumb is four steps below Aldric.\n\n**Pitfall:** starting from every hero and walking up gives the right roots but needs a final filter to keep only the top row per hero; returning the direct mentor instead of the root answers another question.",
		},
		{
			id: "ch43-ex04",
			title: "Trial of the Potion Bags",
			story:
				"The quartermaster is tired of two spellings. Every `healing potion` in the bags must become a `Healing Potion`, and when a bag holds both, their quantities must merge into one line.",
			prompt:
				"Update `inventories` so that, inside every bag, items named `healing potion` are renamed `Healing Potion`, and two `Healing Potion` lines in the **same bag** become **one** line `{\"item\": \"Healing Potion\", \"qty\": <sum>}`. Every other item, bag, coin and note stays as it is.",
			difficulty: 5,
			kind: "mutation",
			concepts: ["jsonb-modification", "jsonb-decomposition"],
			solutionSql:
				"UPDATE inventories i\nSET doc = jsonb_set(i.doc, '{bags}', (\n  SELECT jsonb_agg(\n           jsonb_set(b.bag, '{items}', (\n             SELECT coalesce(jsonb_agg(x.item ORDER BY x.pos), '[]'::jsonb)\n             FROM (\n               SELECT min(e.pos) AS pos,\n                      CASE WHEN count(*) = 1\n                           THEN (array_agg(e.it))[1] || jsonb_build_object('item', e.canon)\n                           ELSE jsonb_build_object('item', e.canon, 'qty', sum((e.it->>'qty')::int))\n                      END AS item\n               FROM (\n                 SELECT t.it, t.pos,\n                        CASE WHEN t.it->>'item' = 'healing potion' THEN 'Healing Potion' ELSE t.it->>'item' END AS canon\n                 FROM jsonb_array_elements(b.bag->'items') WITH ORDINALITY AS t(it, pos)\n               ) e\n               GROUP BY e.canon\n             ) x))\n         ORDER BY b.idx)\n  FROM jsonb_array_elements(i.doc->'bags') WITH ORDINALITY AS b(bag, idx)))\nWHERE i.doc @? '$.bags[*].items[*] ? (@.item == \"healing potion\")';",
			check: { type: "state", verifySql: INVENTORY_ROWS },
			hints: [
				"Only two heroes carry the lower-case potion. Rebuild their `bags` array: explode bags, explode items, fix, aggregate back.",
				"Per bag, group items by their canonical name (a CASE). A group of one keeps its object (with the new name); a group of two becomes a fresh object with `sum(qty)`.",
				"jsonb_set(doc, '{bags}', (SELECT jsonb_agg(jsonb_set(bag, '{items}', <rebuilt items>) ORDER BY idx) FROM jsonb_array_elements(doc->'bags') WITH ORDINALITY b(bag, idx)))",
			],
			explanation:
				"Decompose with `jsonb_array_elements ... WITH ORDINALITY`, fix rows with plain SQL (CASE, GROUP BY, sum), then recompose with `jsonb_agg` and `jsonb_set`. Hilde's bag now holds 12 Healing Potions in one line; Aldric's 3 are simply renamed.\n\n**Pitfall:** a text `replace(doc::text, 'healing potion', 'Healing Potion')` renames but leaves two lines in Hilde's bag; updating every row with `jsonb_set(doc, '{bags}', NULL)` wipes documents without bags. **Alternative:** JSON_TABLE to explode, then the same aggregation.",
		},
		{
			id: "ch43-ex05",
			title: "Trial of the Heavy Tomes",
			story: "The guild's server is running out of disk. Where does the space go?",
			prompt:
				"Return the **name** and the **total size in bytes** (`pg_total_relation_size`: table plus indexes) of the **3** largest tables of the guild database, largest first, ties by name (A to Z).",
			difficulty: 2,
			kind: "query",
			concepts: ["operations-overview", "catalog-introspection"],
			solutionSql:
				"SELECT relname, pg_total_relation_size(relid) AS bytes\nFROM pg_stat_user_tables\nORDER BY bytes DESC, relname\nLIMIT 3;",
			check: { type: "result", orderMatters: true },
			hints: [
				"`pg_stat_user_tables` lists every user table with its `relid`.",
				"`pg_total_relation_size(relid)` counts indexes and TOAST too. Sort by size, then by name.",
				"ORDER BY pg_total_relation_size(relid) DESC, relname LIMIT 3",
			],
			explanation:
				"Three small tables tie at the top because of their indexes: guilds (primary key and unique name), items and skill_tree. On a real server this is the first query before buying disks.\n\n**Pitfall:** `pg_relation_size` measures the heap only and hides index bloat, often the real culprit.",
		},
		{
			id: "ch43-ex06",
			title: "Trial of the Portals",
			story:
				"Zoë must carry a message from Highmoor to Frostspire and pay as little toll as possible.",
			prompt:
				"Return the **path** (an array of region names, from `Highmoor` to `Frostspire`) and the **total toll** of the cheapest portal route from Highmoor to Frostspire. Never visit a region twice.",
			difficulty: 4,
			kind: "query",
			concepts: ["recursive-graph-walks"],
			solutionSql:
				"WITH RECURSIVE route AS (\n  SELECT to_region, ARRAY['Highmoor', to_region] AS path, toll AS total\n  FROM portals WHERE from_region = 'Highmoor'\n  UNION ALL\n  SELECT p.to_region, r.path || p.to_region, r.total + p.toll\n  FROM route r\n  JOIN portals p ON p.from_region = r.to_region\n  WHERE p.to_region <> ALL (r.path)\n)\nSELECT path, total\nFROM route\nWHERE to_region = 'Frostspire'\nORDER BY total\nLIMIT 1;",
			check: { type: "result" },
			hints: [
				"Walk the portals recursively from Highmoor, carrying the path and the running toll.",
				"Guard against cycles: do not step into a region already in the path (`<> ALL (path)` or the CYCLE clause).",
				"... WHERE p.to_region <> ALL (r.path) ... SELECT path, total FROM route WHERE to_region = 'Frostspire' ORDER BY total LIMIT 1",
			],
			explanation:
				"Highmoor, Mistwood, Saltmarsh, Frostspire costs 48; the direct-looking route through Deepforge costs 55.\n\n**Pitfall:** the fewest hops is not the cheapest; without the path guard the Highmoor and Mistwood loop never ends.",
		},
		{
			id: "ch43-ex07",
			title: "Boss: The Astral Throne",
			story:
				"Aldric hands you the keys of the guild's new treasury: each guild master will log in and see only their own heroes, every gold movement must be traceable, rewards must be paid exactly once even if the payout runs twice, and the feast needs a leaderboard. The table `gold_rewards (reward_id, hero_id, amount)` and the role `guild_master_1` (allowed to read heroes and guilds) exist.",
			prompt:
				"In one script:\n\n1. create `reward_ledger (reward_id int PRIMARY KEY, hero_id int NOT NULL, amount numeric(10,2) NOT NULL)`;\n2. create `gold_audit (hero_id int, old_gold numeric(10,2), new_gold numeric(10,2))` and an AFTER UPDATE trigger on `heroes` that logs a row **only when gold actually changes**;\n3. write a **payout** that records every reward of `gold_rewards` in the ledger and adds it to the hero's gold (unknown gold counts as 0), paying each reward **once**: run the payout **twice**;\n4. enable RLS on `heroes` so `guild_master_1` sees only heroes of **guild 1**;\n5. create the view `guild_leaderboard (guild, hero, xp, place)`: guild name, hero name, xp and `dense_rank` of xp (highest first) within the guild, guild members only.",
			difficulty: 5,
			kind: "ddl",
			concepts: [
				"upsert-patterns",
				"audit-history",
				"row-level-security",
				"views",
				"ranking-functions",
				"data-modifying-cte",
			],
			setupSql: BOSS_SETUP,
			solutionSql: `CREATE TABLE reward_ledger (
  reward_id  int PRIMARY KEY,
  hero_id    int NOT NULL,
  amount     numeric(10,2) NOT NULL
);

CREATE TABLE gold_audit (hero_id int, old_gold numeric(10,2), new_gold numeric(10,2));

CREATE FUNCTION log_gold() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO gold_audit (hero_id, old_gold, new_gold) VALUES (NEW.id, OLD.gold, NEW.gold);
  RETURN NULL;
END $$;

CREATE TRIGGER heroes_gold_audit AFTER UPDATE ON heroes
  FOR EACH ROW WHEN (OLD.gold IS DISTINCT FROM NEW.gold)
  EXECUTE FUNCTION log_gold();

${PAYOUT}
${PAYOUT}

ALTER TABLE heroes ENABLE ROW LEVEL SECURITY;
CREATE POLICY guild_1_only ON heroes FOR SELECT TO guild_master_1 USING (guild_id = 1);

CREATE VIEW guild_leaderboard AS
SELECT g.name AS guild, h.name AS hero, h.xp,
       dense_rank() OVER (PARTITION BY g.id ORDER BY h.xp DESC) AS place
FROM heroes h
JOIN guilds g ON g.id = h.guild_id;`,
			check: {
				type: "state",
				verifySql:
					"UPDATE heroes SET gold = gold WHERE id = 2;\nUPDATE heroes SET xp = xp + 1 WHERE id = 3;\nSELECT 'audit' AS kind, hero_id::text AS what, coalesce(old_gold::text, 'NULL') || ' -> ' || coalesce(new_gold::text, 'NULL') AS detail FROM gold_audit\nUNION ALL SELECT 'gold', id::text, gold::text FROM heroes WHERE id IN (1, 13, 22)\nUNION ALL SELECT 'ledger', count(*)::text, sum(amount)::text FROM reward_ledger\nUNION ALL SELECT 'seen', 'guild_master_1', seen_as('guild_master_1', 'heroes')\nUNION ALL SELECT 'board', guild || ' #' || place, hero FROM guild_leaderboard WHERE place <= 3;",
			},
			hints: [
				"Build in order: tables, trigger (with `WHEN (OLD.gold IS DISTINCT FROM NEW.gold)`), payout, RLS, view. Paste the payout twice.",
				"Payout as one data-modifying CTE: `INSERT INTO reward_ledger ... ON CONFLICT (reward_id) DO NOTHING RETURNING hero_id, amount`, then UPDATE heroes from the **summed** returned rows. Aldric has two rewards: `UPDATE ... FROM` applies only one matching row per hero, so group first.",
				"UPDATE heroes h SET gold = coalesce(h.gold, 0) + p.total FROM (SELECT hero_id, sum(amount) AS total FROM paid GROUP BY hero_id) p WHERE h.id = p.hero_id;",
			],
			explanation:
				"The ledger's primary key is the memory of the payout: the second run inserts nothing, so it pays nothing and the audit stays quiet. Aldric gains 110 in one audited change, Xander's unknown purse becomes 25.00, and the guild master sees only the five heroes of the Silver Dragon.\n\n**Pitfall:** `UPDATE heroes SET gold = gold + r.amount FROM gold_rewards r` pays Aldric only one of his two rewards, pays everybody again on the second run, and leaves Xander at NULL (`NULL + 25` is NULL). **Alternative:** MERGE into the ledger with `RETURNING merge_action()` feeding the same update.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch43-pr01",
			title: "The memory dial",
			prompt: "Return the **context** and the **unit** of the setting `work_mem`.",
			difficulty: 1,
			kind: "query",
			concepts: ["operations-overview"],
			solutionSql: "SELECT context, unit FROM pg_settings WHERE name = 'work_mem';",
			check: { type: "result" },
			hints: [
				"Settings live in `pg_settings`.",
				"Filter on `name`.",
				"SELECT context, unit FROM pg_settings WHERE name = 'work_mem';",
			],
			explanation:
				"`user` and `kB`: any session can `SET work_mem` for one big sort, without touching the server-wide default.",
		},
		{
			id: "ch43-pr02",
			title: "Is anybody home?",
			prompt:
				"Return **one boolean**: is the size of the current database (`pg_database_size(current_database())`) greater than 0?",
			difficulty: 1,
			kind: "query",
			concepts: ["operations-overview"],
			solutionSql: "SELECT pg_database_size(current_database()) > 0;",
			check: { type: "result" },
			hints: [
				"`current_database()` names the database you are connected to.",
				"Compare the size with 0.",
				"SELECT pg_database_size(current_database()) > 0;",
			],
			explanation:
				"true. Exact sizes depend on the engine and version, so monitoring compares sizes over time on the same server rather than with numbers from a blog.",
		},
		{
			id: "ch43-pr03",
			title: "Restart required",
			prompt:
				"Among `shared_buffers`, `work_mem`, `max_connections`, `wal_level` and `TimeZone`, return the **name** of every setting that needs a server **restart** to change (`context = 'postmaster'`).",
			difficulty: 2,
			kind: "query",
			concepts: ["operations-overview"],
			solutionSql:
				"SELECT name FROM pg_settings\nWHERE name IN ('shared_buffers', 'work_mem', 'max_connections', 'wal_level', 'TimeZone')\n  AND context = 'postmaster';",
			check: { type: "result" },
			hints: [
				"Filter the five names with IN.",
				"Restart-only settings have context `postmaster`.",
				"WHERE name IN (...) AND context = 'postmaster'",
			],
			explanation:
				"`max_connections`, `shared_buffers` and `wal_level` are fixed when the server starts: plan those changes for a maintenance window.",
		},
	],
};

export default chapter;
