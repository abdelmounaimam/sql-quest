import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch32-deep-json/lesson-9": {
		reject: [{ sql: "SELECT hero_id, titles -> 'since' FROM hero_titles;", why: "wrong key" }],
		accept: ["SELECT hero_id, titles['title'] FROM hero_titles", "SELECT hero_id, hstore_to_jsonb(titles) ->> 'title' FROM hero_titles"],
	},
	"ch32-ex01": {
		reject: [
			{ sql: "SELECT hero_id, jsonb_path_query(doc, '$.bags[*].items[*] ? (@.qty > 2).item') AS item FROM inventories;", why: "jsonb strings, not text (strictTypes)" },
			{ sql: "SELECT hero_id, jsonb_path_query(doc, '$.bags[*].items[0] ? (@.qty > 2).item') #>> '{}' FROM inventories;", why: "first item of each bag only" },
			{ sql: "SELECT hero_id, jsonb_path_query(doc, '$.bags[*].items[*] ? (@.qty >= 2).item') #>> '{}' FROM inventories;", why: "2 included" },
		],
		accept: [
			"SELECT i.hero_id, it ->> 'item' FROM inventories i, jsonb_array_elements(i.doc -> 'bags') b, jsonb_array_elements(b -> 'items') it WHERE (it ->> 'qty')::int > 2;",
			"SELECT hero_id, jsonb_path_query(doc, '$.bags[*].items[*] ? (@.qty > 2)') ->> 'item' FROM inventories;",
		],
	},
	"ch32-ex02": {
		reject: [
			{ sql: "SELECT hero_id FROM inventories WHERE doc -> 'bags' -> 0 -> 'items' -> 0 -> 'enchant' ? 'fire';", why: "first item only" },
			{ sql: "SELECT hero_id FROM inventories WHERE doc @? '$.bags[*].items[*].enchant';", why: "any enchant, not fire" },
		],
		accept: [
			"SELECT hero_id FROM inventories WHERE jsonb_path_exists(doc, '$.bags[*].items[*].enchant.fire');",
			"SELECT hero_id FROM inventories WHERE json_exists(doc, '$.bags[*].items[*].enchant.fire');",
		],
	},
	"ch32-ex03": {
		reject: [{ sql: "SELECT hero_id FROM inventories WHERE doc @? '$.bags[*].items[*] ? (@.item like_regex \"Torch\")' AND hero_id <> 19;", why: "drops Ulfric" }],
		accept: [
			"SELECT hero_id FROM inventories WHERE doc @@ '$.bags[*].items[*].item == \"Torch\"';",
			"SELECT hero_id FROM inventories WHERE doc @? '$.bags[*].items[*] ? (@.item like_regex \"^Torch$\")';",
			"SELECT hero_id FROM inventories WHERE doc::text LIKE '%\"item\": \"Torch\"%';",
		],
	},
	"ch32-ex04": {
		reject: [
			{ sql: "SELECT i.hero_id, jt.slot, jt.item, jt.qty FROM inventories i, JSON_TABLE(i.doc, '$.bags[*]' COLUMNS (slot text PATH '$.slot', NESTED PATH '$.items[*]' COLUMNS (item text PATH '$.item', qty text PATH '$.qty'))) AS jt;", why: "slot and qty declared as text (strictTypes)" },
			{ sql: "SELECT i.hero_id, (b ->> 'slot')::int, it ->> 'item', (it ->> 'qty')::int FROM inventories i, jsonb_array_elements(i.doc -> 'bags') b, jsonb_array_elements(b -> 'items') it;", why: "drops Finn's empty bag" },
		],
		accept: [
			"SELECT i.hero_id, (b ->> 'slot')::int, it ->> 'item', (it ->> 'qty')::int FROM inventories i CROSS JOIN LATERAL jsonb_array_elements(i.doc -> 'bags') b LEFT JOIN LATERAL jsonb_array_elements(b -> 'items') it ON true;",
		],
	},
	"ch32-ex05": {
		reject: [
			{ sql: "CREATE INDEX ON items ((attributes ->> 'set'));", why: "B-tree on an expression cannot serve @>" },
			{ sql: "CREATE INDEX ON items (name);", why: "wrong column" },
		],
		accept: ["CREATE INDEX ON items USING gin (attributes jsonb_path_ops);", "CREATE INDEX idx ON items USING GIN (attributes jsonb_ops);"],
	},
	"ch32-ex06": {
		reject: [{ sql: "SELECT hero_id, titles -> 'title' FROM hero_titles WHERE titles ? 'granted_by';", why: "keeps Ulfric's NULL value" }],
		accept: ["SELECT hero_id, titles -> 'title' FROM hero_titles WHERE defined(titles, 'granted_by');"],
	},
	"ch32-ex07": {
		reject: [{ sql: "SELECT hero_id, (each(titles)).key, (each(titles)).value FROM hero_titles ORDER BY 1, 3;", why: "sorted by value" }],
		accept: ["SELECT hero_id, (each(titles)).* FROM hero_titles ORDER BY 1, 2;", "SELECT t.hero_id, e.key, e.value FROM hero_titles t CROSS JOIN LATERAL jsonb_each_text(hstore_to_jsonb(t.titles)) e ORDER BY 1, 2;"],
	},
	"ch32-ex08": {
		reject: [
			{
				sql: "SELECT h.name, t.titles -> 'title', jsonb_array_length(jsonb_path_query_array(i.doc, '$.bags[*].items[*]')), (SELECT coalesce(sum(v::int), 0) FROM jsonb_path_query(i.doc, '$.bags[*].items[*].enchant.*') v) AS power, EXISTS (SELECT 1 FROM JSON_TABLE(i.doc, '$.bags[*].items[*]' COLUMNS (item text PATH '$.item')) jt JOIN items it ON it.name = jt.item WHERE it.attributes ? 'set') FROM inventories i JOIN heroes h ON h.id = i.hero_id LEFT JOIN hero_titles t ON t.hero_id = i.hero_id ORDER BY power DESC, h.name;",
				why: "counts all items, not enchanted ones",
			},
			{
				sql: "SELECT h.name, t.titles -> 'title', jsonb_array_length(jsonb_path_query_array(i.doc, '$.bags[*].items[*] ? (exists(@.enchant))')), (SELECT coalesce(sum(v::int), 0) FROM jsonb_path_query(i.doc, '$.bags[*].items[*].enchant.*') v) AS power, EXISTS (SELECT 1 FROM JSON_TABLE(i.doc, '$.bags[*].items[*]' COLUMNS (item text PATH '$.item')) jt JOIN items it ON it.name = jt.item WHERE it.attributes ? 'set') FROM inventories i JOIN heroes h ON h.id = i.hero_id JOIN hero_titles t ON t.hero_id = i.hero_id ORDER BY power DESC, h.name;",
				why: "inner join on titles drops untitled heroes",
			},
			{
				sql: "SELECT h.name, t.titles -> 'title', jsonb_array_length(jsonb_path_query_array(i.doc, '$.bags[*].items[*] ? (exists(@.enchant))')), (SELECT coalesce(sum(v::int), 0) FROM jsonb_path_query(i.doc, '$.bags[*].items[0].enchant.*') v) AS power, EXISTS (SELECT 1 FROM JSON_TABLE(i.doc, '$.bags[*].items[*]' COLUMNS (item text PATH '$.item')) jt JOIN items it ON it.name = jt.item WHERE it.attributes ? 'set') FROM inventories i JOIN heroes h ON h.id = i.hero_id LEFT JOIN hero_titles t ON t.hero_id = i.hero_id ORDER BY power DESC, h.name;",
				why: "power of the first item of each bag only",
			},
		],
		accept: [
			"SELECT h.name, t.titles -> 'title', count(x.enchant) AS enchanted, coalesce(sum((SELECT sum(value::int) FROM jsonb_each_text(x.enchant))), 0) AS power, coalesce(bool_or(it.attributes ? 'set'), false) FROM inventories i JOIN heroes h ON h.id = i.hero_id LEFT JOIN hero_titles t ON t.hero_id = i.hero_id LEFT JOIN LATERAL JSON_TABLE(i.doc, '$.bags[*].items[*]' COLUMNS (item text PATH '$.item', enchant jsonb PATH '$.enchant')) x ON true LEFT JOIN items it ON it.name = x.item GROUP BY h.name, t.titles ORDER BY power DESC, h.name;",
		],
	},
	"ch32-pr04": {
		reject: [{ sql: "SELECT (b ->> 'slot')::int, it ->> 'item' FROM inventories i, jsonb_array_elements(i.doc -> 'bags') b, jsonb_array_elements(b -> 'items') it WHERE i.hero_id = 8;", why: "drops the empty bag" }],
	},
	"ch32-pr05": {
		reject: [{ sql: "CREATE INDEX ON inventories USING gin (doc);", why: "default jsonb_ops" }],
	},
	"ch32-pr06": {
		reject: [{ sql: "CREATE INDEX ON items USING gin (attributes);", why: "GIN, not an expression B-tree" }],
		accept: ["CREATE INDEX ON items USING btree ((attributes ->> 'set'));"],
	},
	"ch32-pr08": {
		reject: [{ sql: "SELECT hero_id FROM hero_titles WHERE titles ?| ARRAY['title', 'since'];", why: "any key, not all" }],
	},
	"ch32-pr02": {
		reject: [{ sql: "SELECT hero_id, json_value(doc, '$.coins.gold') AS gold FROM inventories;", why: "json_value returns text by default (strictTypes)" }],
		accept: ["SELECT hero_id, json_value(doc, '$.coins.gold' RETURNING integer) FROM inventories;"],
	},
	"ch32-pr03": {
		reject: [
			{
				sql: "SELECT jt.* FROM items, JSON_TABLE(attributes, '$' COLUMNS (set text PATH '$.set', level text PATH '$.requires.level', slots jsonb PATH '$.slots')) AS jt WHERE id = 2;",
				why: "level declared as text (strictTypes)",
			},
		],
	},
};

export default cases;
