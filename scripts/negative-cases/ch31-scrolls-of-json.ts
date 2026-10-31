import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch31-scrolls-of-json/lesson-9": {
		reject: [{ sql: "SELECT hero_id, (doc -> 'coins' ->> 'gold')::int FROM inventories;", why: "gold instead of silver" }],
		accept: ["SELECT hero_id, (doc #>> '{coins,silver}')::int FROM inventories", "SELECT hero_id, doc['coins']['silver'] FROM inventories"],
	},
	"ch31-ex01": {
		reject: [
			{ sql: "SELECT name FROM items WHERE attributes::text = '{\"slots\": [\"belt\"], \"consumable\": true, \"heal\": 30}';", why: "text comparison of the spelling" },
			{ sql: "SELECT name FROM items WHERE attributes @> '{\"consumable\": true}';", why: "containment is not equality" },
		],
		accept: [
			"SELECT name FROM items WHERE attributes = '{\"heal\":30,\"slots\":[\"belt\"],\"consumable\":true}'::jsonb;",
			"SELECT name FROM items WHERE attributes @> '{\"slots\": [\"belt\"], \"consumable\": true, \"heal\": 30}' AND attributes <@ '{\"slots\": [\"belt\"], \"consumable\": true, \"heal\": 30}';",
		],
	},
	"ch31-ex02": {
		reject: [
			{ sql: "SELECT hero_id, doc -> 'coins' ->> 'gold' AS gold FROM inventories WHERE doc -> 'coins' ? 'gold' ORDER BY gold DESC;", why: "text sort: 980 before 3000" },
			{ sql: "SELECT hero_id, (doc -> 'coins' ->> 'gold')::int AS gold FROM inventories ORDER BY gold DESC;", why: "keeps inventories without gold (NULL first)" },
		],
		accept: [
			"SELECT hero_id, (doc #>> '{coins,gold}')::int FROM inventories WHERE doc #>> '{coins,gold}' IS NOT NULL ORDER BY 2 DESC;",
			"SELECT hero_id, (doc['coins']['gold'])::int AS g FROM inventories WHERE doc['coins']['gold'] IS NOT NULL ORDER BY g DESC NULLS LAST;",
		],
	},
	"ch31-ex03": {
		reject: [{ sql: "SELECT name FROM items WHERE attributes ->> 'heal' > '10';", why: "text comparison lets Bread Loaf in" }],
		accept: ["SELECT name FROM items WHERE attributes -> 'heal' > '10'::jsonb;", "SELECT name FROM items WHERE (attributes ->> 'heal')::numeric > 10;"],
	},
	"ch31-ex04": {
		reject: [
			{ sql: "SELECT name FROM items WHERE attributes ? 'set';", why: "every set, not Nightshade" },
			{ sql: "SELECT name FROM items WHERE attributes -> 'set' = 'Nightshade';", why: "not valid JSON on the right" },
		],
		accept: ["SELECT name FROM items WHERE attributes ->> 'set' = 'Nightshade';", "SELECT name FROM items WHERE attributes -> 'set' = '\"Nightshade\"';"],
	},
	"ch31-ex05": {
		reject: [
			{ sql: "SELECT hero_id FROM inventories WHERE doc ->> 'notes' IS NULL;", why: "mixes missing keys and JSON null" },
			{ sql: "SELECT hero_id FROM inventories WHERE NOT doc ? 'notes';", why: "missing keys instead" },
		],
		accept: ["SELECT hero_id FROM inventories WHERE doc ? 'notes' AND doc -> 'notes' = 'null';", "SELECT hero_id FROM inventories WHERE doc @> '{\"notes\": null}';"],
	},
	"ch31-ex06": {
		reject: [
			{ sql: "SELECT g.id, jsonb_build_object('guild', g.name, 'heroes', (SELECT jsonb_agg(h.name ORDER BY h.name) FROM heroes h WHERE h.guild_id = g.id)) FROM guilds g;", why: "NULL array for the Quiet Bell" },
			{ sql: "SELECT g.id, jsonb_build_object('guild', g.name, 'heroes', coalesce((SELECT jsonb_agg(h.name) FROM heroes h WHERE h.guild_id = g.id), '[]')) FROM guilds g;", why: "array not sorted" },
		],
		accept: [
			"SELECT g.id, jsonb_build_object('guild', g.name, 'heroes', coalesce(jsonb_agg(h.name ORDER BY h.name) FILTER (WHERE h.id IS NOT NULL), '[]'::jsonb)) FROM guilds g LEFT JOIN heroes h ON h.guild_id = g.id GROUP BY g.id, g.name;",
		],
	},
	"ch31-ex07": {
		reject: [
			{ sql: "SELECT i.hero_id, it ->> 'item', (it ->> 'qty')::int FROM inventories i, jsonb_array_elements(i.doc -> 'bags' -> 0 -> 'items') it;", why: "first bag only" },
		],
		accept: [
			"SELECT i.hero_id, it.item, it.qty FROM inventories i CROSS JOIN LATERAL jsonb_array_elements(i.doc -> 'bags') b CROSS JOIN LATERAL jsonb_to_recordset(b -> 'items') AS it(item text, qty int);",
		],
	},
	"ch31-ex08": {
		reject: [
			{ sql: "UPDATE inventories SET doc = jsonb_set(doc, '{coins,gold}', '\"25\"') - 'notes' WHERE hero_id = 2;", why: "gold stored as a string" },
			{ sql: "UPDATE inventories SET doc = (doc || '{\"coins\": {\"gold\": 25}}') - 'notes' WHERE hero_id = 2;", why: "shallow merge loses silver and copper" },
			{ sql: "UPDATE inventories SET doc = jsonb_set(doc, '{coins,gold}', '25') WHERE hero_id = 2;", why: "notes key kept" },
		],
		accept: [
			"UPDATE inventories SET doc = jsonb_set(doc #- '{notes}', '{coins,gold}', to_jsonb(25)) WHERE hero_id = 2;",
			"UPDATE inventories SET doc = jsonb_set(doc, '{coins}', doc -> 'coins' || '{\"gold\": 25}') - 'notes' WHERE hero_id = 2;",
		],
	},
	"ch31-ex09": {
		reject: [
			{
				sql: "SELECT h.name, sum((it ->> 'qty')::int) AS t, jsonb_agg(DISTINCT it ->> 'item' ORDER BY it ->> 'item') FROM inventories i JOIN heroes h ON h.id = i.hero_id, jsonb_array_elements(i.doc -> 'bags') b, jsonb_array_elements(b -> 'items') it GROUP BY h.name ORDER BY t DESC, h.name;",
				why: "comma join loses empty inventories",
			},
			{
				sql: "SELECT h.name, coalesce(sum((it ->> 'qty')::int), 0) AS t, coalesce(jsonb_agg(DISTINCT it ->> 'item' ORDER BY it ->> 'item'), '[]') FROM inventories i JOIN heroes h ON h.id = i.hero_id LEFT JOIN LATERAL jsonb_array_elements(i.doc -> 'bags') b ON true LEFT JOIN LATERAL jsonb_array_elements(b -> 'items') it ON true GROUP BY h.name ORDER BY t DESC, h.name;",
				why: "[null] instead of [] for empty inventories",
			},
			{
				sql: "SELECT h.name, coalesce(sum((it ->> 'qty')::int), 0) AS t, coalesce(jsonb_agg(DISTINCT lower(it ->> 'item') ORDER BY lower(it ->> 'item')) FILTER (WHERE it IS NOT NULL), '[]') FROM inventories i JOIN heroes h ON h.id = i.hero_id LEFT JOIN LATERAL jsonb_array_elements(i.doc -> 'bags') b ON true LEFT JOIN LATERAL jsonb_array_elements(b -> 'items') it ON true GROUP BY h.name ORDER BY t DESC, h.name;",
				why: "names lower-cased",
			},
		],
		accept: [
			"SELECT h.name, coalesce((SELECT sum((x ->> 'qty')::int) FROM jsonb_path_query(i.doc, '$.bags[*].items[*]') x), 0) AS t, coalesce((SELECT jsonb_agg(DISTINCT x ->> 'item' ORDER BY x ->> 'item') FROM jsonb_path_query(i.doc, '$.bags[*].items[*]') x), '[]') FROM inventories i JOIN heroes h ON h.id = i.hero_id ORDER BY t DESC, h.name;",
		],
	},
	"ch31-pr03": {
		reject: [{ sql: "SELECT name FROM items WHERE attributes ->> 'charges' IS NOT NULL;", why: "misses the JSON null" }],
	},
	"ch31-pr07": {
		accept: ["UPDATE items SET attributes = jsonb_set(attributes, '{enchanted}', 'true') WHERE id = 17;"],
		reject: [{ sql: "UPDATE items SET attributes = '{\"enchanted\": true}' WHERE id = 17;", why: "other keys lost" }],
	},
	"ch31-pr08": {
		reject: [{ sql: "UPDATE items SET attributes = attributes - 'fire' WHERE id = 2;", why: "top-level key only: no change" }],
		accept: ["UPDATE items SET attributes = jsonb_set(attributes, '{damage}', (attributes -> 'damage') - 'fire') WHERE id = 2;"],
	},
};

export default cases;
