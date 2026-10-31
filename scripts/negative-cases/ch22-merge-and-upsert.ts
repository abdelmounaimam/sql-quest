// Negative and accept cases for ch22-merge-and-upsert.
import type { CaseSet } from "../validate-content";

const LATEST =
	"SELECT f.commodity_name, f.price FROM price_feed f WHERE f.quoted_at = (SELECT max(g.quoted_at) FROM price_feed g WHERE g.commodity_name = f.commodity_name)";
const OLDEST =
	"SELECT DISTINCT ON (commodity_name) commodity_name, price FROM price_feed ORDER BY commodity_name, quoted_at";
const NEWEST =
	"SELECT DISTINCT ON (commodity_name) commodity_name, price FROM price_feed ORDER BY commodity_name, quoted_at DESC";

const merge = (src: string, matched = "WHEN MATCHED", returning = "") =>
	`MERGE INTO commodities c USING (${src}) AS f ON c.name = f.commodity_name ${matched} THEN UPDATE SET base_price = f.price WHEN NOT MATCHED THEN INSERT (name, base_price, unit) VALUES (f.commodity_name, f.price, 'crate') ${returning};`;

const boss = (src: string, matched: string, end = "COMMIT") =>
	`BEGIN; WITH changes AS (MERGE INTO commodities c USING (${src}) AS f ON c.name = f.commodity_name ${matched} THEN UPDATE SET base_price = f.price WHEN NOT MATCHED THEN INSERT (name, base_price, unit) VALUES (f.commodity_name, f.price, 'crate') RETURNING c.name, old.base_price, new.base_price, merge_action()) INSERT INTO price_log (name, old_price, new_price, action) SELECT * FROM changes; ${end};`;

const cases: Record<string, CaseSet> = {
	"ch22-merge-and-upsert/lesson-9": {
		reject: [{ sql: "INSERT INTO commodities (name, base_price, unit) VALUES ('Comet Tea', 19.50, 'crate') ON CONFLICT (name) DO NOTHING;", why: "DO NOTHING keeps the old price" }],
		accept: ["UPDATE commodities SET base_price = 19.50 WHERE name = 'Comet Tea';"],
	},
	"ch22-ex01": {
		reject: [
			{ sql: "INSERT INTO commodities (name, category, base_price, unit) VALUES ('Asteroid Honey', 'luxury', 66.00, 'jar'), ('Water Ice', 'essentials', 99.00, 'ton'), ('Comet Tea', 'food', 25.00, 'crate');", why: "plain INSERT fails with 23505" },
			{ sql: "INSERT INTO commodities (name, category, base_price, unit) VALUES ('Asteroid Honey', 'luxury', 66.00, 'jar'), ('Water Ice', 'essentials', 99.00, 'ton'), ('Comet Tea', 'food', 25.00, 'crate') ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price;", why: "overwrites known prices" },
		],
		accept: [
			"INSERT INTO commodities (name, category, base_price, unit) VALUES ('Asteroid Honey', 'luxury', 66.00, 'jar'), ('Water Ice', 'essentials', 99.00, 'ton'), ('Comet Tea', 'food', 25.00, 'crate') ON CONFLICT DO NOTHING;",
		],
	},
	"ch22-ex02": {
		reject: [
			{ sql: "INSERT INTO commodities (name, category, base_price, unit) VALUES ('Void Pearls', 'luxury', 2100.00, 'pearl'), ('Moon Cheese', 'food', 14.00, 'wheel') ON CONFLICT (name) DO NOTHING;", why: "DO NOTHING keeps the old pearl price" },
			{ sql: "UPDATE commodities SET base_price = 2100.00 WHERE name = 'Void Pearls';", why: "Moon Cheese never inserted" },
		],
		accept: [
			"INSERT INTO commodities AS c (name, category, base_price, unit) VALUES ('Moon Cheese', 'food', 14, 'wheel'), ('Void Pearls', 'luxury', 2100, 'pearl') ON CONFLICT (name) DO UPDATE SET base_price = excluded.base_price WHERE c.base_price IS DISTINCT FROM excluded.base_price;",
			"MERGE INTO commodities c USING (VALUES ('Void Pearls', 'luxury', 2100.00, 'pearl'), ('Moon Cheese', 'food', 14.00, 'wheel')) AS s(name, category, price, unit) ON c.name = s.name WHEN MATCHED THEN UPDATE SET base_price = s.price WHEN NOT MATCHED THEN INSERT (name, category, base_price, unit) VALUES (s.name, s.category, s.price, s.unit);",
		],
	},
	"ch22-ex03": {
		reject: [
			{ sql: "INSERT INTO cargo_stock (commodity, qty) VALUES ('Water Ice', 300), ('Comet Tea', 40), ('Space Kelp', 25) ON CONFLICT (commodity) DO UPDATE SET qty = EXCLUDED.qty;", why: "replaces the stock instead of adding" },
			{ sql: "INSERT INTO cargo_stock (commodity, qty) VALUES ('Water Ice', 300), ('Comet Tea', 40), ('Space Kelp', 25) ON CONFLICT (commodity) DO NOTHING;", why: "deliveries to known goods are lost" },
		],
		accept: [
			"INSERT INTO cargo_stock AS s (commodity, qty) VALUES ('Water Ice', 300), ('Comet Tea', 40), ('Space Kelp', 25) ON CONFLICT (commodity) DO UPDATE SET qty = s.qty + excluded.qty;",
		],
	},
	"ch22-ex04": {
		reject: [
			{ sql: "INSERT INTO commodities (name, base_price, unit) SELECT commodity_name, price, 'crate' FROM price_feed;", why: "fails with 23505, not 21000" },
			{ sql: `INSERT INTO commodities (name, base_price, unit) SELECT commodity_name, price, 'crate' FROM (${NEWEST}) f ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price;`, why: "deduplicated source: no error" },
		],
		accept: [`MERGE INTO commodities c USING price_feed f ON c.name = f.commodity_name WHEN MATCHED THEN UPDATE SET base_price = f.price WHEN NOT MATCHED THEN INSERT (name, base_price, unit) VALUES (f.commodity_name, f.price, 'crate');`],
	},
	"ch22-ex05": {
		reject: [
			{ sql: merge(OLDEST), why: "keeps the older Water Ice quote (12.50)" },
			{ sql: merge("SELECT commodity_name, price FROM price_feed f WHERE quoted_at = (SELECT min(quoted_at) FROM price_feed g WHERE g.commodity_name = f.commodity_name)"), why: "earliest quote instead of latest" },
		],
		accept: [
			merge(NEWEST),
			merge("SELECT f.commodity_name, f.price FROM price_feed f JOIN (SELECT commodity_name, max(quoted_at) AS q FROM price_feed GROUP BY commodity_name) m ON m.commodity_name = f.commodity_name AND m.q = f.quoted_at"),
			`INSERT INTO commodities (name, base_price, unit) SELECT commodity_name, price, 'crate' FROM (${LATEST}) f ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price;`,
		],
	},
	"ch22-ex06": {
		reject: [
			{ sql: merge(LATEST, "WHEN MATCHED", "RETURNING merge_action(), c.name, c.base_price"), why: "unconditional update reports Nebula Spice" },
			{ sql: merge(LATEST, "WHEN MATCHED AND c.base_price <> f.price"), why: "no RETURNING" },
		],
		accept: [
			merge(NEWEST, "WHEN MATCHED AND c.base_price IS DISTINCT FROM f.price", "RETURNING merge_action() AS action, c.name, c.base_price"),
			merge(LATEST, "WHEN MATCHED AND f.price <> c.base_price", "RETURNING merge_action(), new.name, new.base_price"),
		],
	},
	"ch22-ex07": {
		reject: [
			{ sql: "INSERT INTO seizure_archive SELECT * FROM seizures WHERE seized_at < '2077-01-01';", why: "copied but not removed" },
			{ sql: "WITH moved AS (DELETE FROM seizures WHERE seized_at < '2077-01-01' RETURNING id) SELECT * FROM moved;", why: "deleted but never archived" },
		],
		accept: [
			"INSERT INTO seizure_archive SELECT * FROM seizures WHERE seized_at < '2077-01-01'; DELETE FROM seizures WHERE seized_at < '2077-01-01';",
			"WITH moved AS (DELETE FROM seizures s WHERE s.seized_at < date '2077-01-01' RETURNING s.id, s.ship_id, s.commodity_id, s.qty, s.fine, s.seized_at) INSERT INTO seizure_archive (id, ship_id, commodity_id, qty, fine, seized_at) SELECT id, ship_id, commodity_id, qty, fine, seized_at FROM moved;",
		],
	},
	"ch22-ex08": {
		reject: [
			{ sql: "INSERT INTO commodities (name, category, base_price, unit) SELECT trim(split_part(line, ',', 1)), trim(split_part(line, ',', 2)), trim(split_part(line, ',', 3))::numeric, trim(split_part(line, ',', 4)) FROM cargo_csv;", why: "header imported: 22P02" },
			{ sql: "INSERT INTO commodities (name, category, base_price, unit) SELECT split_part(line, ',', 1), split_part(line, ',', 2), split_part(line, ',', 3)::numeric, split_part(line, ',', 4) FROM cargo_csv WHERE line_no > 1;", why: "padding not trimmed" },
		],
		accept: [
			"INSERT INTO commodities (name, category, base_price, unit) SELECT btrim(f[1]), btrim(f[2]), btrim(f[3])::numeric(10,2), btrim(f[4]) FROM (SELECT string_to_array(line, ',') AS f FROM cargo_csv WHERE line NOT LIKE 'name,%') s;",
		],
	},
	"ch22-ex09": {
		reject: [
			{ sql: boss(LATEST, "WHEN MATCHED"), why: "unconditional update logs Nebula Spice" },
			{ sql: boss(OLDEST, "WHEN MATCHED AND c.base_price <> f.price"), why: "stale Water Ice quote" },
			{ sql: boss(LATEST, "WHEN MATCHED AND c.base_price <> f.price", "ROLLBACK"), why: "ROLLBACK discards the import" },
			{ sql: merge(LATEST, "WHEN MATCHED AND c.base_price <> f.price"), why: "nothing logged" },
		],
		accept: [
			boss(NEWEST, "WHEN MATCHED AND c.base_price IS DISTINCT FROM f.price"),
			`START TRANSACTION; WITH changes AS (MERGE INTO commodities c USING (${LATEST}) AS f ON c.name = f.commodity_name WHEN MATCHED AND c.base_price = f.price THEN DO NOTHING WHEN MATCHED THEN UPDATE SET base_price = f.price WHEN NOT MATCHED THEN INSERT (name, base_price, unit) VALUES (f.commodity_name, f.price, 'crate') RETURNING merge_action() AS action, new.name, old.base_price AS o, new.base_price AS n) INSERT INTO price_log (action, name, old_price, new_price) SELECT action, name, o, n FROM changes; COMMIT;`,
		],
	},
	"ch22-pr01": {
		reject: [{ sql: "INSERT INTO reputation_tiers (tier, min_rep, max_rep) VALUES ('legend', 800, 1200), ('mythic', 1201, 2000) ON CONFLICT (tier) DO NOTHING;", why: "legend not updated" }],
	},
	"ch22-pr02": {
		reject: [{ sql: "INSERT INTO commodities (name, unit) VALUES ('Moon Dust', 'gram') ON CONFLICT (name) DO NOTHING;", why: "valid conflict target: no error" }],
	},
	"ch22-pr03": {
		reject: [
			{ sql: "MERGE INTO routes r USING (VALUES (1, 11, 2.6), (1, 3, 9.9)) AS o(f, t, d) ON r.from_planet_id = o.f AND r.to_planet_id = o.t WHEN MATCHED THEN UPDATE SET distance_ly = o.d WHEN NOT MATCHED THEN INSERT (from_planet_id, to_planet_id, distance_ly) VALUES (o.f, o.t, o.d) WHEN NOT MATCHED BY SOURCE THEN DELETE;", why: "deletes every other lane of the map" },
			{ sql: "MERGE INTO routes r USING (VALUES (1, 11, 2.6), (1, 3, 9.9)) AS o(f, t, d) ON r.from_planet_id = o.f AND r.to_planet_id = o.t WHEN MATCHED THEN UPDATE SET distance_ly = o.d WHEN NOT MATCHED THEN INSERT (from_planet_id, to_planet_id, distance_ly) VALUES (o.f, o.t, o.d);", why: "lane 1 to 2 not closed" },
		],
	},
	"ch22-pr05": {
		reject: [{ sql: "INSERT INTO ships (name, model, cargo_capacity) VALUES ('Firefly', 'Courier Mk II', 40);", why: "no pilot registered or linked" }],
		accept: ["INSERT INTO pilots (name, species, rank, joined_at) VALUES ('Firefly Jones', 'Human', 'ensign', '2078-04-01 00:00:00+00'); INSERT INTO ships (name, model, pilot_id, cargo_capacity) VALUES ('Firefly', 'Courier Mk II', currval(pg_get_serial_sequence('pilots', 'id')), 40);"],
	},
	"ch22-pr06": {
		reject: [{ sql: "SELECT count(*) FROM price_csv WHERE pg_input_is_valid(split_part(line, ';', 2), 'numeric');", why: "counts the valid lines" }],
	},
	"ch22-pr07": {
		reject: [{ sql: "INSERT INTO routes (from_planet_id, to_planet_id, distance_ly) SELECT split_part(line, ',', 1)::int, split_part(line, ',', 2)::int, split_part(line, ',', 3)::numeric FROM csv_blob, string_to_table(body, E'\\n') AS line WHERE line NOT LIKE 'from,%';", why: "empty last line fails the cast" }],
		accept: ["INSERT INTO routes (from_planet_id, to_planet_id, distance_ly) SELECT split_part(l, ',', 1)::int, split_part(l, ',', 2)::int, split_part(l, ',', 3)::numeric FROM csv_blob CROSS JOIN LATERAL string_to_table(body, E'\\n') AS l WHERE l ~ '^[0-9]';"],
	},
};

export default cases;
