import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch31-scrolls-of-json",
	order: 31,
	world: "The Alchemist's Vault",
	tier: "adept",
	track: "types",
	title: "Scrolls of JSON",
	subtitle: "json vs jsonb, operators, building, unnesting and updating documents",
	emoji: "📦",
	datasetId: "guild",
	concepts: [
		"json-vs-jsonb",
		"jsonb-operators",
		"jsonb-construction",
		"jsonb-decomposition",
		"jsonb-modification",
	],
	prerequisites: ["ch30-shaped-data", "ch16-champions-of-each-dungeon"],
	lesson: [
		{
			kind: "explain",
			title: "json and jsonb",
			body: "Postgres has two JSON types:\n\n- **json** keeps the text exactly as typed: spaces, key order, even duplicate keys. It has no `=` operator and no index support.\n- **jsonb** parses the document into a binary tree: keys are sorted, duplicates keep the **last** value, whitespace is dropped. It supports comparison, indexes and fast queries.\n\nUse **jsonb** unless you must keep the original text byte for byte.",
		},
		{
			kind: "example",
			title: "Duplicate keys in json and jsonb",
			body: "The same text, stored both ways. The json copy keeps both `a` keys and the original order; the jsonb copy keeps only the last `a` and sorts the keys.",
			sql: "SELECT '{\"b\": 1, \"a\": 2, \"a\": 3}'::json::text AS as_json,\n       '{\"b\": 1, \"a\": 2, \"a\": 3}'::jsonb::text AS as_jsonb;",
		},
		{
			kind: "explain",
			title: "Extraction operators",
			body: "| operator | returns |\n|---|---|\n| `doc -> 'coins'` | jsonb |\n| `doc ->> 'notes'` | **text** |\n| `doc #> '{coins,gold}'` | jsonb at a path |\n| `doc #>> '{coins,gold}'` | text at a path |\n\nArrays take an index from **0**: `doc -> 'bags' -> 0`. Subscripts work too: `doc['coins']['gold']`. Chain `->` to walk down, and finish with `->>` to get text.",
		},
		{
			kind: "example",
			title: "Extract a nested value",
			body: "Each inventory's gold, as text. Hero 8 has only silver, hero 24 only copper: the key is missing, so the result is NULL.",
			sql: "SELECT hero_id, doc -> 'coins' ->> 'gold' AS gold\nFROM inventories;",
		},
		{
			kind: "quiz",
			question:
				"`SELECT name FROM items WHERE attributes -> 'heal' > 10;` fails with 42883. Why?",
			choices: [
				"`heal` is not a key of every item",
				"`->` returns jsonb, and there is no `jsonb > integer` operator",
				"JSON numbers cannot be compared at all",
				"`>` needs parentheses around the arrow expression",
			],
			answerIndex: 1,
			explanation:
				"`->` returns a jsonb value. Take the text with `->>` and cast it: `(attributes ->> 'heal')::int > 10`. Comparing `->>` text with `'10'` would run but compare as strings, so `'2' > '10'`.",
		},
		{
			kind: "explain",
			title: "Containment and keys",
			body: "- `attributes @> '{\"set\": \"Nightshade\"}'`: the document **contains** this fragment\n- `attributes ? 'charges'`: the top-level key exists\n- `?|` any of these keys, `?&` all of them\n\nThere are two kinds of *nothing*: a **missing key** gives SQL NULL, while `\"notes\": null` is a key holding JSON `null`. `->>` turns both into SQL NULL; `?` and `jsonb_typeof` tell them apart.",
		},
		{
			kind: "explain",
			title: "Building JSON",
			body: "```sql\njsonb_build_object('name', name, 'gold', gold)\njsonb_build_array(1, 'two', true)\nto_jsonb(h)            -- a whole row\njsonb_agg(name ORDER BY name)\njsonb_object_agg(key, value)\n```\nPitfall: `jsonb_agg` over **zero rows** returns NULL, not `[]`. Wrap it: `coalesce(jsonb_agg(...), '[]')`.",
		},
		{
			kind: "example",
			title: "Unnest nested arrays",
			body: "`jsonb_array_elements` turns an array into rows. Used twice in FROM (an implicit LATERAL join), it walks the bags, then the items of each bag. Hero 7's empty `bags` array and hero 24's missing one produce no rows.",
			sql: "SELECT i.hero_id, b ->> 'slot' AS slot, it ->> 'item' AS item\nFROM inventories i,\n     jsonb_array_elements(i.doc -> 'bags') AS b,\n     jsonb_array_elements(b -> 'items') AS it\nWHERE i.hero_id IN (1, 7, 24);",
		},
		{
			kind: "explain",
			title: "Modifying a document",
			body: "jsonb values are immutable: you compute a new document and write it back with UPDATE.\n\n- `jsonb_set(doc, '{coins,gold}', '50')`: replace at a path (the new value is **jsonb**)\n- `doc || '{\"lucky\": true}'`: **shallow** merge, top-level keys only\n- `doc - 'notes'`: remove a key\n- `doc #- '{coins,silver}'`: remove at a path",
		},
		{
			kind: "try",
			title: "Extract silver as an integer",
			prompt:
				"Return each inventory's **hero_id** and its **silver** coins as an **integer** (NULL when there is no silver).",
			starterSql: "SELECT hero_id, (doc ->> 'silver')::int AS silver\nFROM inventories;",
			solutionSql: "SELECT hero_id, (doc -> 'coins' ->> 'silver')::int AS silver FROM inventories;",
			check: { type: "result" },
			hints: [
				"Run the starter: every value is NULL. Where is the `silver` key?",
				"Go through `coins` first: `doc -> 'coins' ->> 'silver'`, then cast.",
			],
		},
	],
	exercises: [
		{
			id: "ch31-ex01",
			title: "jsonb equality ignores key order",
			prompt:
				"Return the **name** of every item whose `attributes` document is **equal** to `{\"slots\": [\"belt\"], \"consumable\": true, \"heal\": 30}`.",
			difficulty: 1,
			kind: "query",
			concepts: ["json-vs-jsonb"],
			solutionSql:
				"SELECT name FROM items WHERE attributes = '{\"slots\": [\"belt\"], \"consumable\": true, \"heal\": 30}';",
			check: { type: "result" },
			hints: [
				"`attributes` is jsonb: equality is about content, not spelling.",
				"Compare the column with the literal directly; jsonb parses it.",
				"WHERE attributes = '{\"slots\": [\"belt\"], ...}'",
			],
			explanation:
				"Both healing potions match: jsonb equality ignores key order and whitespace because both sides are parsed into the same tree.\n\n**Pitfall:** `attributes::text = '...'` compares spellings and finds nothing; a `json` column could not even use `=`.\n\n**Alternative:** `attributes @> x AND attributes <@ x` (contains and is contained).",
		},
		{
			id: "ch31-ex02",
			title: "Sort by a JSON number",
			prompt:
				"Return the **hero_id** and **gold** (as an **integer**) of every inventory that has a gold entry, **richest first**.",
			difficulty: 2,
			kind: "query",
			concepts: ["jsonb-operators"],
			solutionSql:
				"SELECT hero_id, (doc -> 'coins' ->> 'gold')::int AS gold\nFROM inventories\nWHERE doc -> 'coins' ? 'gold'\nORDER BY gold DESC;",
			check: { type: "result", orderMatters: true, strictTypes: true },
			hints: [
				"Filter out inventories without a `gold` key, then sort.",
				"`->>` gives text: cast to int **before** sorting, or '980' sorts above '3000'.",
				"(doc -> 'coins' ->> 'gold')::int ... ORDER BY 2 DESC",
			],
			explanation:
				"Cast first, sort second: Nyx's 3000 comes first, Cedric's 0 comes last.\n\n**Pitfall:** `ORDER BY doc -> 'coins' ->> 'gold' DESC` sorts text, so 980 ranks above 3000 and 2100.\n\n**Alternative:** `WHERE doc #>> '{coins,gold}' IS NOT NULL` as the filter.",
		},
		{
			id: "ch31-ex03",
			title: "Compare a JSON value as a number",
			prompt: "Return the **name** of every item whose `heal` attribute is **greater than 10**.",
			difficulty: 2,
			kind: "query",
			concepts: ["jsonb-operators"],
			starterSql: "SELECT name\nFROM items\nWHERE attributes -> 'heal' > 10;",
			solutionSql: "SELECT name FROM items WHERE (attributes ->> 'heal')::int > 10;",
			check: { type: "result" },
			hints: [
				"Read the error: `jsonb > integer` does not exist.",
				"Extract the value as text with `->>`, then cast it to a number.",
				"(attributes ->> 'heal')::int > 10",
			],
			explanation:
				"`->>` returns text and the cast turns it into an int that compares like a number. Items without `heal` give NULL and are filtered out.\n\n**Pitfall:** `attributes ->> 'heal' > '10'` runs but compares text: `'2' > '10'`, so the Bread Loaf is wrongly included.\n\n**Alternative:** `attributes -> 'heal' > '10'::jsonb` compares two jsonb numbers numerically.",
		},
		{
			id: "ch31-ex04",
			title: "Filter with containment",
			prompt: "Return the **name** of every item whose `set` is **Nightshade**, using **containment** (`@>`).",
			difficulty: 2,
			kind: "query",
			concepts: ["jsonb-operators"],
			solutionSql: "SELECT name FROM items WHERE attributes @> '{\"set\": \"Nightshade\"}';",
			check: { type: "result" },
			hints: [
				"`@>` takes a jsonb fragment that must appear in the document.",
				"The fragment is itself a JSON object with one key.",
				"WHERE attributes @> '{\"set\": \"Nightshade\"}'",
			],
			explanation:
				"`@>` asks *does the document contain this fragment?* It is the operator a GIN index accelerates (next chapter).\n\n**Pitfall:** `attributes -> 'set' = 'Nightshade'` fails: the right side is parsed as JSON and `Nightshade` without quotes is not valid JSON.\n\n**Alternative:** `attributes ->> 'set' = 'Nightshade'`, a text comparison.",
		},
		{
			id: "ch31-ex05",
			title: "JSON null versus missing key",
			prompt:
				"Return the **hero_id** of every inventory whose `notes` key is **present** but holds JSON **null**.",
			difficulty: 3,
			kind: "query",
			concepts: ["jsonb-operators"],
			solutionSql: "SELECT hero_id FROM inventories WHERE jsonb_typeof(doc -> 'notes') = 'null';",
			check: { type: "result" },
			hints: [
				"`doc ->> 'notes'` is NULL in both cases. You need a test that sees the difference.",
				"`jsonb_typeof` returns `'null'` for JSON null and SQL NULL for a missing key. Or combine `?` with a jsonb comparison.",
				"WHERE jsonb_typeof(doc -> 'notes') = 'null'",
			],
			explanation:
				"Heroes 2, 6 and 13. A JSON null is a real value inside the document; a missing key is no value at all.\n\n**Pitfall:** `doc ->> 'notes' IS NULL` returns seven inventories, mixing missing keys with JSON nulls.\n\n**Alternative:** `doc ? 'notes' AND doc -> 'notes' = 'null'`.",
		},
		{
			id: "ch31-ex06",
			title: "Build a JSON object per guild",
			prompt:
				"For every guild return its **id** and a jsonb document `{\"guild\": <name>, \"heroes\": [<hero names>]}`, hero names sorted A to Z (byte order). A guild without members must get an **empty array**, not NULL.",
			difficulty: 3,
			kind: "query",
			concepts: ["jsonb-construction"],
			solutionSql:
				"SELECT g.id,\n       jsonb_build_object(\n         'guild', g.name,\n         'heroes', coalesce((SELECT jsonb_agg(h.name ORDER BY h.name)\n                             FROM heroes h WHERE h.guild_id = g.id), '[]')\n       ) AS doc\nFROM guilds g;",
			check: { type: "result" },
			hints: [
				"Build the object with `jsonb_build_object`; the array comes from `jsonb_agg` in a subquery.",
				"The Order of the Quiet Bell has no members: `jsonb_agg` over zero rows is NULL.",
				"coalesce((SELECT jsonb_agg(h.name ORDER BY h.name) FROM heroes h WHERE h.guild_id = g.id), '[]')",
			],
			explanation:
				"The correlated subquery builds one array per guild, and `coalesce` turns the Quiet Bell's NULL into `[]`.\n\n**Pitfall:** without coalesce the Quiet Bell gets `\"heroes\": null`, which breaks clients that loop over the array.\n\n**Alternative:** LEFT JOIN heroes, GROUP BY guild and `coalesce(jsonb_agg(h.name ORDER BY h.name) FILTER (WHERE h.id IS NOT NULL), '[]')`.",
		},
		{
			id: "ch31-ex07",
			title: "Flatten nested JSON arrays",
			prompt:
				"Return the **hero_id**, **item** name (text) and **qty** (integer) of every item in every bag of every inventory.",
			difficulty: 3,
			kind: "query",
			concepts: ["jsonb-decomposition"],
			solutionSql:
				"SELECT i.hero_id, it ->> 'item' AS item, (it ->> 'qty')::int AS qty\nFROM inventories i,\n     jsonb_array_elements(i.doc -> 'bags') AS b,\n     jsonb_array_elements(b -> 'items') AS it;",
			check: { type: "result", strictTypes: true },
			hints: [
				"Two levels of arrays: bags, then items inside each bag.",
				"Call `jsonb_array_elements` twice in FROM, the second on the output of the first.",
				"FROM inventories i, jsonb_array_elements(i.doc -> 'bags') b, jsonb_array_elements(b -> 'items') it",
			],
			explanation:
				"Each set returning function in FROM can see the columns to its left (implicit LATERAL), so the walk goes inventory, bag, item: 25 rows.\n\n**Pitfall:** `jsonb_array_elements(doc -> 'bags' -> 0 -> 'items')` reads only the first bag and misses Aldric's rope and Nyx's egg.\n\n**Alternative:** `jsonb_path_query(doc, '$.bags[*].items[*]')` does both levels in one call (next chapter).",
		},
		{
			id: "ch31-ex08",
			title: "Set a value and remove a key",
			prompt:
				"Update inventory **2**: set `coins.gold` to the **number** 25 and **remove** the `notes` key. Every other key stays as it is.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["jsonb-modification"],
			solutionSql:
				"UPDATE inventories\nSET doc = jsonb_set(doc, '{coins,gold}', '25') - 'notes'\nWHERE hero_id = 2;",
			check: { type: "state", verifySql: "SELECT hero_id, doc, jsonb_typeof(doc #> '{coins,gold}') AS gold_type FROM inventories ORDER BY hero_id;", orderMatters: true },
			hints: [
				"One UPDATE, combining two operations on the document.",
				"`jsonb_set` replaces a value at a path (the new value is jsonb); `- 'key'` removes a key.",
				"SET doc = jsonb_set(doc, '{coins,gold}', '25') - 'notes'",
			],
			explanation:
				"`jsonb_set` rebuilds the document with the new gold, then `- 'notes'` drops the key. Silver, copper and the bags are untouched.\n\n**Pitfall:** `jsonb_set(doc, '{coins,gold}', '\"25\"')` stores the *string* \"25\", and `doc || '{\"coins\": {\"gold\": 25}}'` replaces the whole `coins` object, losing silver and copper (`||` is shallow).\n\n**Alternative:** `doc #- '{notes}'` removes by path.",
		},
		{
			id: "ch31-ex09",
			title: "Boss: The Quartermaster's Audit",
			story:
				"Combines unnesting nested JSON arrays with LEFT JOIN LATERAL, aggregation and building a jsonb array with empty defaults.",
			prompt:
				"For **every** inventory return:\n\n- the hero's **name** (join `heroes`)\n- **total_qty**: the total quantity of items across all bags (**0** when there are none)\n- **items**: a jsonb array of the **distinct** item names carried, sorted A to Z (byte order), `[]` when there are none\n\nOrder by total_qty descending, then name.",
			difficulty: 4,
			kind: "query",
			concepts: ["jsonb-decomposition", "jsonb-construction", "jsonb-operators"],
			solutionSql:
				"SELECT h.name,\n       coalesce(sum((it ->> 'qty')::int), 0) AS total_qty,\n       coalesce(jsonb_agg(DISTINCT it ->> 'item' ORDER BY it ->> 'item')\n                FILTER (WHERE it IS NOT NULL), '[]') AS items\nFROM inventories i\nJOIN heroes h ON h.id = i.hero_id\nLEFT JOIN LATERAL jsonb_array_elements(i.doc -> 'bags') AS b ON true\nLEFT JOIN LATERAL jsonb_array_elements(b -> 'items') AS it ON true\nGROUP BY h.name\nORDER BY total_qty DESC, h.name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Unnest bags and items, then group per hero. Séraphine (empty bags) and Bors (no bags key) must still appear.",
				"A comma join with a set returning function drops rows that produce nothing: use `LEFT JOIN LATERAL ... ON true`. Then guard the aggregates against all-NULL groups.",
				"coalesce(sum(...), 0) and coalesce(jsonb_agg(DISTINCT it ->> 'item' ORDER BY it ->> 'item') FILTER (WHERE it IS NOT NULL), '[]')",
			],
			explanation:
				"LEFT JOIN LATERAL keeps every inventory, `sum` and `jsonb_agg` collapse the items per hero, and the FILTER plus coalesce turn *nothing* into 0 and `[]`. Hilde's two potions stay distinct: names are compared case sensitively.\n\n**Pitfall:** the comma join loses Séraphine and Bors; forgetting the FILTER gives them `[null]` instead of `[]`.\n\n**Alternative:** compute both values in a correlated subquery per inventory with `jsonb_path_query`.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch31-pr01",
			title: "Cast one literal to json and jsonb",
			prompt:
				"Return one row with the text of `'{\"b\": 1, \"a\": 2, \"a\": 3}'` cast to **json** then text, and the same literal cast to **jsonb** then text (in that order).",
			difficulty: 1,
			kind: "query",
			concepts: ["json-vs-jsonb"],
			solutionSql:
				"SELECT '{\"b\": 1, \"a\": 2, \"a\": 3}'::json::text AS as_json, '{\"b\": 1, \"a\": 2, \"a\": 3}'::jsonb::text AS as_jsonb;",
			check: { type: "result" },
			hints: [
				"Two casts each: `::json::text` and `::jsonb::text`.",
				"Keep the literal exactly as given, spaces included.",
				"SELECT '...'::json::text, '...'::jsonb::text;",
			],
			explanation:
				"json returns the text untouched; jsonb returns `{\"a\": 3, \"b\": 1}`: keys sorted, the last duplicate wins, spacing normalised.",
		},
		{
			id: "ch31-pr02",
			title: "Filter on a nested path",
			prompt: "Return the **name** of every item that requires a **level of 10 or more** (`requires.level`).",
			difficulty: 2,
			kind: "query",
			concepts: ["jsonb-operators"],
			solutionSql: "SELECT name FROM items WHERE (attributes #>> '{requires,level}')::int >= 10;",
			check: { type: "result" },
			hints: [
				"The level is nested: requires, then level.",
				"`#>>` follows a path and returns text; cast it.",
				"(attributes #>> '{requires,level}')::int >= 10",
			],
			explanation: "Only the Dragonbone Sword (level 15). `attributes -> 'requires' ->> 'level'` is the same path with two arrows.",
		},
		{
			id: "ch31-pr03",
			title: "Test that a key exists",
			prompt: "Return the **name** of every item that has a `charges` key, even if its value is null.",
			difficulty: 1,
			kind: "query",
			concepts: ["jsonb-operators"],
			solutionSql: "SELECT name FROM items WHERE attributes ? 'charges';",
			check: { type: "result" },
			hints: [
				"Test for the key, not for its value.",
				"The `?` operator checks that a top-level key exists.",
				"WHERE attributes ? 'charges'",
			],
			explanation: "The Staff of Embers and the Frost Wand, whose charges are JSON null. `attributes ->> 'charges' IS NOT NULL` would miss the wand.",
		},
		{
			id: "ch31-pr04",
			title: "Build a JSON object per row",
			prompt:
				"For every **legendary** item, return a jsonb object with two keys: `name` (the item name) and `rarity` (its rarity).",
			difficulty: 1,
			kind: "query",
			concepts: ["jsonb-construction"],
			solutionSql: "SELECT jsonb_build_object('name', name, 'rarity', rarity) AS label FROM items WHERE rarity = 'legendary';",
			check: { type: "result" },
			hints: [
				"`jsonb_build_object` takes key, value, key, value...",
				"The enum becomes a JSON string automatically.",
				"jsonb_build_object('name', name, 'rarity', rarity)",
			],
			explanation: "Three objects: Dragonbone Sword, Phoenix Feather and Ice Crown.",
		},
		{
			id: "ch31-pr05",
			title: "List the keys of a document",
			prompt: "Return the top-level **keys** of the attributes of item **2**, one per row.",
			difficulty: 2,
			kind: "query",
			concepts: ["jsonb-decomposition"],
			solutionSql: "SELECT jsonb_object_keys(attributes) AS key FROM items WHERE id = 2;",
			check: { type: "result" },
			hints: [
				"A set returning function lists keys.",
				"jsonb_object_keys(doc)",
				"SELECT jsonb_object_keys(attributes) FROM items WHERE id = 2;",
			],
			explanation: "damage, slots, set and requires. Only the top level: the keys inside `damage` need another call.",
		},
		{
			id: "ch31-pr06",
			title: "Length of a JSON array",
			prompt:
				"Return the **name** of every item and the **number of slots** listed in its `slots` array (NULL when there is no `slots` key).",
			difficulty: 2,
			kind: "query",
			concepts: ["jsonb-decomposition"],
			solutionSql: "SELECT name, jsonb_array_length(attributes -> 'slots') AS slots FROM items;",
			check: { type: "result" },
			hints: [
				"Count the elements of a jsonb array.",
				"`jsonb_array_length` works on the jsonb value, so use `->`.",
				"jsonb_array_length(attributes -> 'slots')",
			],
			explanation: "The Elven Bow lists 2 slots, the Map of Mistwood has an empty list (0), and items without the key give NULL.",
		},
		{
			id: "ch31-pr07",
			title: "Add a key with ||",
			prompt: "Add the key `\"enchanted\": true` to the attributes of item **17**, keeping its other keys.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["jsonb-modification"],
			solutionSql: "UPDATE items SET attributes = attributes || '{\"enchanted\": true}' WHERE id = 17;",
			check: { type: "state", verifySql: "SELECT id, attributes FROM items ORDER BY id;", orderMatters: true },
			hints: [
				"Merge a small object into the document.",
				"`||` concatenates two jsonb objects.",
				"SET attributes = attributes || '{\"enchanted\": true}'",
			],
			explanation: "`||` adds or replaces top-level keys. `jsonb_set(attributes, '{enchanted}', 'true')` does the same here.",
		},
		{
			id: "ch31-pr08",
			title: "Remove a nested key",
			prompt: "Remove the `fire` entry from the `damage` object of item **2**, keeping its `slash` damage and every other key.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["jsonb-modification"],
			solutionSql: "UPDATE items SET attributes = attributes #- '{damage,fire}' WHERE id = 2;",
			check: { type: "state", verifySql: "SELECT id, attributes FROM items ORDER BY id;", orderMatters: true },
			hints: [
				"The key is nested: damage, then fire.",
				"`#-` removes the value at a path.",
				"SET attributes = attributes #- '{damage,fire}'",
			],
			explanation: "`#-` reaches into nested objects. `attributes - 'fire'` would look for a top-level key and change nothing.",
		},
	],
};

export default chapter;
