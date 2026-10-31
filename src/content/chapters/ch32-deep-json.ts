import type { Chapter } from "../types";

const PLAN_OF =
	"CREATE FUNCTION plan_of(q text) RETURNS text LANGUAGE plpgsql AS $$\nDECLARE p json;\nBEGIN\n  EXECUTE 'EXPLAIN (FORMAT JSON, COSTS OFF) ' || q INTO p;\n  RETURN p::text;\nEND $$;";

const chapter: Chapter = {
	id: "ch32-deep-json",
	order: 32,
	world: "The Alchemist's Vault",
	tier: "expert",
	track: "types",
	title: "Deep JSON",
	subtitle: "jsonpath, JSON_TABLE, GIN indexes and the old hstore",
	emoji: "🔮",
	datasetId: "guild",
	concepts: ["sql-json-path", "json-table", "jsonb-indexing", "hstore"],
	prerequisites: ["ch31-scrolls-of-json"],
	lesson: [
		{
			kind: "explain",
			title: "jsonpath: a map of the scroll",
			body: "A **jsonpath** walks a document in one string:\n\n- `$` the root, `.bags` a key, `[*]` every array element\n- `? (@.qty > 5)` a **filter**: `@` is the current item\n- inside paths, equality is `==`, strings use double quotes: `@.item == \"Torch\"`\n\n`jsonb_path_query(doc, path)` returns every match as a row, `doc @? path` asks *is there at least one match?*",
		},
		{
			kind: "example",
			title: "Big stacks",
			body: "Every item carried more than 5 times, with its owner. `#>> '{}'` turns the jsonb string into plain text.",
			sql: "SELECT hero_id,\n       jsonb_path_query(doc, '$.bags[*].items[*] ? (@.qty > 5).item') #>> '{}' AS item\nFROM inventories;",
		},
		{
			kind: "quiz",
			question: "Which test finds the inventories holding **any** item with a fire enchant, in any bag?",
			choices: [
				"`doc @? '$.bags[*].items[*].enchant.fire'`",
				"`doc -> 'bags' -> 0 -> 'items' -> 0 -> 'enchant' ? 'fire'`",
				"`doc ? 'fire'`",
				"`doc @? '$.bags[*].items[*] ? (@.enchant = \"fire\")'`",
			],
			answerIndex: 0,
			explanation:
				"The path visits every bag and every item and succeeds if a `fire` key exists in some enchant. The arrow chain only reads the first item of the first bag, `?` only sees top-level keys, and `=` is a syntax error inside a jsonpath (use `==`).",
		},
		{
			kind: "explain",
			title: "SQL/JSON functions",
			body: "The SQL standard functions (PG17) read like English:\n```sql\njson_exists(doc, '$.notes')\njson_value(doc, '$.coins.gold' RETURNING int)\njson_query(doc, '$.coins')\ndoc IS JSON OBJECT\n```\n`json_value` returns one scalar (typed with RETURNING), `json_query` a piece of JSON. On a missing path they return NULL. Paths are **lax** by default: small structural mismatches are forgiven instead of raising errors.",
		},
		{
			kind: "explain",
			title: "JSON_TABLE: a document becomes a table",
			body: "```sql\nJSON_TABLE(doc, '$.bags[*]'\n  COLUMNS (\n    slot int PATH '$.slot',\n    NESTED PATH '$.items[*]' COLUMNS (\n      item text PATH '$.item',\n      qty  int  PATH '$.qty')))\n```\nThe row path picks the rows, each column has a type and a path. `NESTED PATH` unrolls an inner array; a bag with no items still yields **one row** with NULLs, like an outer join.",
		},
		{
			kind: "example",
			title: "Finn's bags as a table",
			body: "Finn (hero 8) has a lute in bag 1 and an empty bag 2. JSON_TABLE keeps the empty bag as a row of NULLs.",
			sql: "SELECT jt.*\nFROM inventories i,\n     JSON_TABLE(i.doc, '$.bags[*]'\n       COLUMNS (slot int PATH '$.slot',\n                NESTED PATH '$.items[*]'\n                  COLUMNS (item text PATH '$.item', qty int PATH '$.qty'))) AS jt\nWHERE i.hero_id = 8;",
		},
		{
			kind: "explain",
			title: "Indexing jsonb",
			body: "- `CREATE INDEX ON items USING gin (attributes)`: the default **jsonb_ops** class serves `@>`, `?`, `?|`, `?&`, `@?`, `@@`\n- `gin (attributes jsonb_path_ops)`: smaller and faster for `@>` and paths, but **no** `?`\n- `btree ((attributes ->> 'set'))`: an expression index for `->> =` equality and sorting\n\nA GIN index does **not** help `attributes ->> 'set' = 'x'`: write `@>` to use it.",
		},
		{
			kind: "example",
			title: "Watch the index kick in",
			body: "The items table is tiny, so the planner would rather scan it. `SET enable_seqscan = off` forbids the shortcut and reveals what the GIN index can do: a **Bitmap Index Scan**.",
			sql: "CREATE INDEX items_attr_gin ON items USING gin (attributes);\nSET enable_seqscan = off;\nEXPLAIN (COSTS OFF)\nSELECT name FROM items WHERE attributes @> '{\"set\": \"Dragonbone\"}';",
		},
		{
			kind: "explain",
			title: "hstore, the elder map",
			body: "**hstore** (an extension) stores a flat map of text keys to text values, older than jsonb:\n\n- `titles -> 'since'` gives a value (always **text**, or NULL)\n- `titles ? 'granted_by'` tests a key; `?&` all keys, `?|` any key\n- `each(titles)` unrolls key and value pairs; `hstore_to_jsonb(titles)` converts\n\nNo nesting, no numbers, no booleans: prefer jsonb for new designs.",
		},
		{
			kind: "try",
			title: "Your turn: honorary titles",
			prompt: "Return each row of `hero_titles` as **hero_id** and the value of its `title` key.",
			starterSql: "SELECT hero_id, titles ->> 'title'\nFROM hero_titles;",
			solutionSql: "SELECT hero_id, titles -> 'title' AS title FROM hero_titles;",
			check: { type: "result" },
			hints: [
				"Run the starter: hstore has no `->>` operator.",
				"For hstore, `->` already returns text.",
			],
		},
	],
	exercises: [
		{
			id: "ch32-ex01",
			title: "The heavy haulers",
			story: "The quartermaster suspects hoarding: who carries more than two of anything?",
			prompt:
				"Return the **hero_id** and the **item** name (as text) of every item carried with a **qty greater than 2**. Use a jsonpath.",
			difficulty: 2,
			kind: "query",
			concepts: ["sql-json-path"],
			solutionSql:
				"SELECT hero_id, jsonb_path_query(doc, '$.bags[*].items[*] ? (@.qty > 2).item') #>> '{}' AS item\nFROM inventories;",
			check: { type: "result", strictTypes: true },
			hints: [
				"Walk every bag and every item, then filter on qty.",
				"`jsonb_path_query(doc, '$.bags[*].items[*] ? (@.qty > 2)')` returns the items; add `.item` to get the name.",
				"jsonb_path_query(doc, '$.bags[*].items[*] ? (@.qty > 2).item')",
			],
			explanation:
				"One path replaces two levels of unnesting and a WHERE: Aldric's and Hilde's potions, Brynja's and Ulfric's bread, Zoë's torches.\n\n**Pitfall:** `'$.bags[*].items[0] ...'` only checks the first item of each bag (path arrays start at 0 too) and misses Aldric's and Brynja's stacks.\n\n**Alternative:** unnest with `jsonb_array_elements` twice and filter `(it ->> 'qty')::int > 2`.",
		},
		{
			id: "ch32-ex02",
			title: "Fire in the bags",
			story: "A fire elemental is loose. Morwen needs to know which heroes carry fire enchanted gear.",
			prompt: "Return the **hero_id** of every inventory holding at least one item whose `enchant` has a **fire** key.",
			difficulty: 2,
			kind: "query",
			concepts: ["sql-json-path"],
			solutionSql: "SELECT hero_id FROM inventories WHERE doc @? '$.bags[*].items[*].enchant.fire';",
			check: { type: "result" },
			hints: [
				"You only need yes or no per inventory.",
				"`@?` returns true when a path matches something.",
				"WHERE doc @? '$.bags[*].items[*].enchant.fire'",
			],
			explanation:
				"`@?` answers *does this path lead anywhere?* for every bag and item at once: Aldric, Morwen and Vesper.\n\n**Pitfall:** `doc -> 'bags' -> 0 -> 'items' -> 0 -> 'enchant' ? 'fire'` inspects one item only and misses Vesper's dagger.\n\n**Alternative:** `jsonb_path_exists(doc, '$.bags[*].items[*].enchant.fire')`.",
		},
		{
			id: "ch32-ex03",
			title: "Who has a torch?",
			story: "The dungeon ahead is dark. The scribe's search for torches crashes.",
			prompt: "Return the **hero_id** of every inventory carrying an item named **Torch**.",
			difficulty: 2,
			kind: "query",
			concepts: ["sql-json-path"],
			starterSql: "SELECT hero_id\nFROM inventories\nWHERE doc @? '$.bags[*].items[*] ? (@.item = \"Torch\")';",
			solutionSql: "SELECT hero_id FROM inventories WHERE doc @? '$.bags[*].items[*] ? (@.item == \"Torch\")';",
			check: { type: "result" },
			hints: [
				"Read the error: a syntax error *of jsonpath input*.",
				"jsonpath follows JavaScript-like syntax: equality is written `==`.",
				"? (@.item == \"Torch\")",
			],
			explanation:
				"Inside the path, `==` compares and strings take double quotes; the whole path is an SQL string in single quotes.\n\n**Pitfall:** mixing the two languages: `=` (SQL) inside a path, or `'Torch'` with single quotes, which ends the SQL string early.\n\n**Alternative:** `doc @@ '$.bags[*].items[*].item == \"Torch\"'` uses the predicate form.",
		},
		{
			id: "ch32-ex04",
			title: "The bags, tabulated",
			story: "The quartermaster wants the bags as a proper table, empty bags included so she can refill them.",
			prompt:
				"With **JSON_TABLE**, return **hero_id**, **slot** (int), **item** (text) and **qty** (int) for every bag of every inventory. A bag with no items appears **once** with NULL item and qty; inventories without bags produce no rows.",
			difficulty: 3,
			kind: "query",
			concepts: ["json-table"],
			solutionSql:
				"SELECT i.hero_id, jt.slot, jt.item, jt.qty\nFROM inventories i,\n     JSON_TABLE(i.doc, '$.bags[*]'\n       COLUMNS (slot int PATH '$.slot',\n                NESTED PATH '$.items[*]'\n                  COLUMNS (item text PATH '$.item', qty int PATH '$.qty'))) AS jt;",
			check: { type: "result", strictTypes: true },
			hints: [
				"The row path is the bags; the items are an array inside each bag.",
				"`NESTED PATH '$.items[*]' COLUMNS (...)` unrolls the inner array and keeps empty bags as a NULL row.",
				"JSON_TABLE(i.doc, '$.bags[*]' COLUMNS (slot int PATH '$.slot', NESTED PATH '$.items[*]' COLUMNS (item text PATH '$.item', qty int PATH '$.qty')))",
			],
			explanation:
				"The outer path makes one row per bag; NESTED joins each bag to its items like a LEFT JOIN, so Finn's empty bag 2 shows up with NULLs.\n\n**Pitfall:** a row path of `'$.bags[*].items[*]'` cannot reach the slot (it lives one level up) and drops the empty bag.\n\n**Alternative:** `LEFT JOIN LATERAL jsonb_array_elements(b -> 'items') ON true` after unnesting the bags.",
		},
		{
			id: "ch32-ex05",
			title: "An index for the armory",
			story:
				"The armory will soon hold thousands of items, and the smiths search them by containment all day long.",
			setupSql: PLAN_OF,
			prompt:
				"Create an index that lets `SELECT name FROM items WHERE attributes @> '{\"set\": \"Dragonbone\"}'` be answered with an **index scan** on `items.attributes`.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["jsonb-indexing"],
			solutionSql: "CREATE INDEX items_attributes_gin ON items USING gin (attributes);",
			check: {
				type: "state",
				verifySql:
					"SET enable_seqscan = off;\nSELECT plan_of('SELECT name FROM items WHERE attributes @> ''{\"set\": \"Dragonbone\"}''') LIKE '%Bitmap Index Scan%' AS uses_index,\n       (SELECT count(*) > 0 FROM pg_indexes WHERE tablename = 'items' AND indexdef ILIKE '%gin%(attributes%') AS gin_on_attributes;",
			},
			hints: [
				"Which index type understands `@>` on jsonb?",
				"A B-tree cannot answer containment. GIN indexes every key and value of the document.",
				"CREATE INDEX ... ON items USING gin (attributes);",
			],
			explanation:
				"GIN breaks each document into its keys and values, so `@>` can look up candidates instead of reading every row. (The check disables sequential scans, because on 21 rows a scan would still win.)\n\n**Pitfall:** `CREATE INDEX ON items ((attributes ->> 'set'))` builds a B-tree that only helps `attributes ->> 'set' = 'Dragonbone'`, not `@>`.\n\n**Alternative:** `USING gin (attributes jsonb_path_ops)`, smaller, serving `@>` but not `?`.",
		},
		{
			id: "ch32-ex06",
			title: "Granted by whom?",
			story: "The herald must thank whoever granted each title, but only where a name was recorded.",
			prompt:
				"Return the **hero_id** and **title** of every row of `hero_titles` that has a `granted_by` key with a **non NULL** value.",
			difficulty: 2,
			kind: "query",
			concepts: ["hstore"],
			solutionSql: "SELECT hero_id, titles -> 'title' AS title FROM hero_titles WHERE titles -> 'granted_by' IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"Ulfric's titles contain `granted_by => NULL`.",
				"`?` only tests that the key exists; test the value instead.",
				"WHERE titles -> 'granted_by' IS NOT NULL",
			],
			explanation:
				"A missing key and a NULL value both give NULL through `->`, so `IS NOT NULL` keeps only Aldric's Queen Maelis.\n\n**Pitfall:** `titles ? 'granted_by'` also returns Ulfric, whose key exists with a NULL value.\n\n**Alternative:** `defined(titles, 'granted_by')` is hstore's own *key exists with a non NULL value* test.",
		},
		{
			id: "ch32-ex07",
			title: "Every honour, unrolled",
			story: "The herald copies every honour into her book, one line each.",
			prompt:
				"Return **hero_id**, **key** and **value** of every pair in `hero_titles.titles`, sorted by hero_id then key (byte order).",
			difficulty: 2,
			kind: "query",
			concepts: ["hstore"],
			solutionSql:
				"SELECT t.hero_id, e.key, e.value\nFROM hero_titles t, each(t.titles) AS e\nORDER BY t.hero_id, e.key;",
			check: { type: "result", orderMatters: true },
			hints: [
				"hstore has a set returning function that yields key and value.",
				"`each(titles)` in FROM gives columns `key` and `value`.",
				"FROM hero_titles t, each(t.titles) e ORDER BY t.hero_id, e.key",
			],
			explanation:
				"`each` turns the map into rows; Ulfric's `granted_by` comes back with a NULL value. Every value is text, even `2020` and `5000`.\n\n**Pitfall:** `skeys(titles)` alone loses the values.\n\n**Alternative:** `jsonb_each_text(hstore_to_jsonb(titles))`.",
		},
		{
			id: "ch32-ex08",
			title: "Boss: The Philosopher's Inventory",
			story:
				"The Philosopher of the Vault weighs every inventory for magic: enchantments, their power, legendary sets and the owner's honours.",
			prompt:
				"For **every** inventory return:\n\n- **name** of the hero\n- **title**: the `title` from `hero_titles` (NULL when the hero has none)\n- **enchanted**: the number of carried items that have an `enchant` object\n- **power**: the sum of **all** enchant values of all items (0 when none)\n- **set_piece**: true when the hero carries at least one item whose catalogue entry in `items` (matched on the exact name) has a `set` key\n\nOrder by power descending, then name.",
			difficulty: 5,
			kind: "query",
			concepts: ["sql-json-path", "json-table", "hstore", "jsonb-decomposition"],
			solutionSql:
				"SELECT h.name,\n       t.titles -> 'title' AS title,\n       jsonb_array_length(jsonb_path_query_array(i.doc, '$.bags[*].items[*] ? (exists(@.enchant))')) AS enchanted,\n       (SELECT coalesce(sum(v::int), 0)\n        FROM jsonb_path_query(i.doc, '$.bags[*].items[*].enchant.*') AS v) AS power,\n       EXISTS (SELECT 1\n               FROM JSON_TABLE(i.doc, '$.bags[*].items[*]' COLUMNS (item text PATH '$.item')) AS jt\n               JOIN items it ON it.name = jt.item\n               WHERE it.attributes ? 'set') AS set_piece\nFROM inventories i\nJOIN heroes h ON h.id = i.hero_id\nLEFT JOIN hero_titles t ON t.hero_id = i.hero_id\nORDER BY power DESC, h.name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Start from inventories joined to heroes, LEFT JOIN hero_titles; compute each other column with its own subquery or path.",
				"`'$.bags[*].items[*].enchant.*'` yields every enchant value; `? (exists(@.enchant))` keeps enchanted items; JSON_TABLE gives item names to join with `items`.",
				"(SELECT coalesce(sum(v::int), 0) FROM jsonb_path_query(i.doc, '$.bags[*].items[*].enchant.*') v)",
			],
			explanation:
				"Each column reads the document its own way: a filtered path for counting, a `.*` wildcard for summing every enchant, JSON_TABLE for a relational join with the catalogue, `->` on the hstore for the title. Vesper leads with 6 power; Ulfric's Dragonbone Helm makes him a set bearer with no enchantment at all.\n\n**Pitfall:** unnesting items in the main FROM with an inner join drops Séraphine and Bors and multiplies the titles; counting all items instead of enchanted ones inflates `enchanted`.\n\n**Alternative:** one LATERAL JSON_TABLE with an `enchant jsonb PATH '$.enchant'` column, then aggregate with `jsonb_each_text`.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch32-pr01",
			title: "Morwen's packing list",
			prompt: "Return, as **one jsonb array**, the names of all items carried by hero **3**, in bag order.",
			difficulty: 2,
			kind: "query",
			concepts: ["sql-json-path"],
			solutionSql: "SELECT jsonb_path_query_array(doc, '$.bags[*].items[*].item') AS items FROM inventories WHERE hero_id = 3;",
			check: { type: "result" },
			hints: [
				"There is an `_array` variant of jsonb_path_query.",
				"The path walks bags, items, then the `item` key.",
				"jsonb_path_query_array(doc, '$.bags[*].items[*].item')",
			],
			explanation: "`[\"Staff of Embers\", \"Frost Wand\", \"Map of Mistwood\"]`: the `_array` variant gathers every match into one value.",
		},
		{
			id: "ch32-pr02",
			title: "Gold, the standard way",
			prompt:
				"Return every inventory's **hero_id** and its gold as an **int** using `json_value` (NULL when there is no gold).",
			difficulty: 2,
			kind: "query",
			concepts: ["sql-json-path"],
			solutionSql: "SELECT hero_id, json_value(doc, '$.coins.gold' RETURNING int) AS gold FROM inventories;",
			check: { type: "result", strictTypes: true },
			hints: [
				"json_value extracts one scalar.",
				"Add `RETURNING int` to type it.",
				"json_value(doc, '$.coins.gold' RETURNING int)",
			],
			explanation: "Standard SQL/JSON, portable to other databases. Missing paths give NULL (the default `NULL ON EMPTY`).",
		},
		{
			id: "ch32-pr03",
			title: "The sword's spec sheet",
			prompt:
				"With **JSON_TABLE** over the attributes of item **2**, return one row with columns **set** (text), **level** (int, from `requires.level`) and **slots** (jsonb).",
			difficulty: 2,
			kind: "query",
			concepts: ["json-table"],
			solutionSql:
				"SELECT jt.*\nFROM items,\n     JSON_TABLE(attributes, '$' COLUMNS (set text PATH '$.set', level int PATH '$.requires.level', slots jsonb PATH '$.slots')) AS jt\nWHERE id = 2;",
			check: { type: "result", strictTypes: true },
			hints: [
				"The row path is the root `$`: one row per document.",
				"Each column gets a type and a PATH.",
				"JSON_TABLE(attributes, '$' COLUMNS (set text PATH '$.set', level int PATH '$.requires.level', slots jsonb PATH '$.slots'))",
			],
			explanation: "Dragonbone, 15 and `[\"hand\"]`. A jsonb column keeps the array as JSON instead of forcing it into a scalar.",
		},
		{
			id: "ch32-pr04",
			title: "Empty bags count too",
			prompt:
				"With **JSON_TABLE**, return **slot** and **item** for every bag of hero **8**, keeping empty bags as a row with a NULL item.",
			difficulty: 2,
			kind: "query",
			concepts: ["json-table"],
			solutionSql:
				"SELECT jt.slot, jt.item\nFROM inventories i,\n     JSON_TABLE(i.doc, '$.bags[*]' COLUMNS (slot int PATH '$.slot', NESTED PATH '$.items[*]' COLUMNS (item text PATH '$.item'))) AS jt\nWHERE i.hero_id = 8;",
			check: { type: "result" },
			hints: [
				"Rows are bags; items are nested.",
				"NESTED PATH behaves like an outer join.",
				"NESTED PATH '$.items[*]' COLUMNS (item text PATH '$.item')",
			],
			explanation: "Two rows: (1, Lute of Echoes) and (2, NULL).",
		},
		{
			id: "ch32-pr05",
			title: "A lean index",
			prompt:
				"Create a GIN index on `inventories.doc` using the **jsonb_path_ops** operator class.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["jsonb-indexing"],
			solutionSql: "CREATE INDEX inventories_doc_path_ops ON inventories USING gin (doc jsonb_path_ops);",
			check: {
				type: "state",
				verifySql:
					"SELECT count(*) AS n FROM pg_indexes WHERE tablename = 'inventories' AND indexdef ILIKE '%gin%(doc jsonb_path_ops)%';",
			},
			hints: [
				"The operator class goes right after the column.",
				"USING gin (column opclass)",
				"CREATE INDEX ON inventories USING gin (doc jsonb_path_ops);",
			],
			explanation: "jsonb_path_ops hashes whole paths: smaller and quicker for `@>`, `@?` and `@@`, useless for `?` key tests.",
		},
		{
			id: "ch32-pr06",
			title: "Sort by set",
			prompt: "Create a **B-tree** expression index on `items` over the text value of the `set` key (`attributes ->> 'set'`).",
			difficulty: 2,
			kind: "ddl",
			concepts: ["jsonb-indexing"],
			solutionSql: "CREATE INDEX items_set_idx ON items ((attributes ->> 'set'));",
			check: {
				type: "state",
				verifySql:
					"SELECT count(*) AS n FROM pg_indexes WHERE tablename = 'items' AND indexdef ILIKE '%btree%(attributes ->> ''set''%';",
			},
			hints: [
				"An expression index needs double parentheses.",
				"B-tree is the default type.",
				"CREATE INDEX ON items ((attributes ->> 'set'));",
			],
			explanation: "This index serves `WHERE attributes ->> 'set' = 'Nightshade'` and `ORDER BY attributes ->> 'set'`, which GIN cannot.",
		},
		{
			id: "ch32-pr07",
			title: "Nyx as JSON",
			prompt: "Return the titles of hero **25** converted to **jsonb**.",
			difficulty: 1,
			kind: "query",
			concepts: ["hstore"],
			solutionSql: "SELECT hstore_to_jsonb(titles) AS titles FROM hero_titles WHERE hero_id = 25;",
			check: { type: "result" },
			hints: [
				"hstore ships conversion functions.",
				"hstore_to_jsonb(...)",
				"SELECT hstore_to_jsonb(titles) FROM hero_titles WHERE hero_id = 25;",
			],
			explanation: "Every value becomes a JSON **string**, even the bounty `\"5000\"`: hstore never knew it was a number.",
		},
		{
			id: "ch32-pr08",
			title: "Dated titles",
			prompt: "Return the **hero_id** of every row whose titles have **both** a `title` and a `since` key.",
			difficulty: 1,
			kind: "query",
			concepts: ["hstore"],
			solutionSql: "SELECT hero_id FROM hero_titles WHERE titles ?& ARRAY['title', 'since'];",
			check: { type: "result" },
			hints: [
				"There is an *all keys* operator.",
				"`?&` takes a text array.",
				"WHERE titles ?& ARRAY['title', 'since']",
			],
			explanation: "Everyone but Vesper, who only has an alias. `?|` would mean *any of these keys*.",
		},
	],
};

export default chapter;
