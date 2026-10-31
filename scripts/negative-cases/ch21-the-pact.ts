// Negative and accept cases for ch21-the-pact.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch21-the-pact/lesson-8": {
		reject: [{ sql: "BEGIN; UPDATE pilots SET credits = credits - 300 WHERE id = 10; UPDATE pilots SET credits = credits + 300 WHERE id = 19; ROLLBACK;", why: "ends with ROLLBACK" }],
		accept: ["START TRANSACTION; UPDATE pilots SET credits = credits + 300 WHERE id = 19; UPDATE pilots SET credits = credits - 300 WHERE id = 10; END;"],
	},
	"ch21-ex01": {
		reject: [
			{ sql: "BEGIN; UPDATE pilots SET credits = credits - 1000 WHERE id = 21; COMMIT;", why: "credits taken but never given" },
			{ sql: "BEGIN; UPDATE pilots SET credits = credits - 1000 WHERE id = 24; UPDATE pilots SET credits = credits + 1000 WHERE id = 21; COMMIT;", why: "transfer in the wrong direction" },
		],
		accept: ["BEGIN; UPDATE pilots SET credits = credits + CASE id WHEN 21 THEN -1000 ELSE 1000 END WHERE id IN (21, 24); COMMIT;"],
	},
	"ch21-ex02": {
		reject: [
			{ sql: "DELETE FROM routes WHERE hazard IS NOT NULL; BEGIN; ROLLBACK; INSERT INTO routes (from_planet_id, to_planet_id, distance_ly, hazard) VALUES (9, 3, 5.5, 'ion storm');", why: "BEGIN after the DELETE: too late" },
			{ sql: "BEGIN; DELETE FROM routes WHERE hazard IS NOT NULL; ROLLBACK; INSERT INTO routes (from_planet_id, to_planet_id, distance_ly, hazard) VALUES (3, 9, 5.5, 'ion storm');", why: "lane in the wrong direction (23505 duplicate)" },
		],
		accept: [
			"INSERT INTO routes (from_planet_id, to_planet_id, distance_ly, hazard) VALUES (9, 3, 5.5, 'ion storm');",
			"BEGIN; DELETE FROM routes WHERE hazard IS NOT NULL; ROLLBACK; BEGIN; INSERT INTO routes VALUES (9, 3, 5.5, 'ion storm'); COMMIT;",
		],
	},
	"ch21-ex03": {
		reject: [
			{ sql: "UPDATE pilots SET credits = credits - 50 WHERE id = 1;", why: "Ada can pay: no error" },
			{ sql: "UPDATE pilots SET credit = credits - 50 WHERE id = 9;", why: "typo raises 42703, not a check violation" },
		],
		accept: ["UPDATE pilots SET credits = credits - 50 WHERE name = 'Jax O''Hara';"],
	},
	"ch21-ex04": {
		reject: [
			{ sql: "INSERT INTO planets (name, sector) VALUES ('Mirage II', 'Outer Rim');", why: "new name: no error" },
			{ sql: "INSERT INTO planets (name, sector, has_spaceport) VALUES ('Mirage', 'Outer Rim', NULL);", why: "fails with 23502, not 23505" },
		],
		accept: ["INSERT INTO planets (name) VALUES ('Mirage');"],
	},
	"ch21-ex05": {
		reject: [
			{ sql: "BEGIN; UPDATE commodities SET base_price = 13.00 WHERE name = 'Water Ice'; SAVEPOINT before_pearls; UPDATE commodities SET base_price = 99.99 WHERE name = 'Void Pearls'; ROLLBACK; COMMIT;", why: "plain ROLLBACK loses Water Ice too" },
			{ sql: "BEGIN; UPDATE commodities SET base_price = 13.00 WHERE name = 'Water Ice'; SAVEPOINT before_pearls; UPDATE commodities SET base_price = 99.99 WHERE name = 'Void Pearls'; RELEASE SAVEPOINT before_pearls; COMMIT;", why: "RELEASE keeps the typo" },
		],
		accept: ["BEGIN; UPDATE commodities SET base_price = 13 WHERE id = 1; SAVEPOINT before_pearls; UPDATE commodities SET base_price = 99.99 WHERE id = 6; ROLLBACK TO before_pearls; COMMIT;"],
	},
	"ch21-ex06": {
		reject: [
			{ sql: "BEGIN; UPDATE pilots SET reputation = reputation - 100 WHERE id = 13; SAVEPOINT second_fine; UPDATE pilots SET reputation = reputation - 100 WHERE id = 18; ROLLBACK TO SAVEPOINT second_fine; COMMIT;", why: "second fine rolled back" },
		],
		accept: ["BEGIN; UPDATE pilots SET reputation = reputation - 100 WHERE id IN (13, 18); COMMIT;"],
	},
	"ch21-ex07": {
		reject: [
			{ sql: "SELECT 99500;", why: "forgot that ROLLBACK TO a also undoes the +200" },
			{ sql: "SELECT 98800;", why: "lost the +100 made before savepoint a" },
		],
		accept: ["SELECT 98900.00 AS credits;"],
	},
	"ch21-ex08": {
		reject: [
			{ sql: "BEGIN; INSERT INTO trades (ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at) VALUES (2, 5, 11, 'buy', 300, 8.50, '2078-01-15 09:00:00+00'); UPDATE pilots SET credits = credits - 2550.00 WHERE id = 2; SAVEPOINT commission; UPDATE pilots SET credits = credits - 51.00 WHERE id = 2; UPDATE pilots SET credits = credits + 51.00 WHERE id = 7; SAVEPOINT refund; UPDATE pilots SET credits = credits + 255.00 WHERE id = 2; ROLLBACK; COMMIT;", why: "plain ROLLBACK cancels the whole pact" },
			{ sql: "BEGIN; INSERT INTO trades (ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at) VALUES (2, 5, 11, 'buy', 300, 8.50, '2078-01-15 09:00:00+00'); UPDATE pilots SET credits = credits - 2550.00 WHERE id = 2; SAVEPOINT commission; UPDATE pilots SET credits = credits - 51.00 WHERE id = 2; UPDATE pilots SET credits = credits + 51.00 WHERE id = 7; SAVEPOINT refund; UPDATE pilots SET credits = credits + 255.00 WHERE id = 2; ROLLBACK TO SAVEPOINT commission; COMMIT;", why: "commission cancelled too" },
			{ sql: "BEGIN; INSERT INTO trades (ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at) VALUES (2, 5, 11, 'buy', 300, 8.50, '2078-01-15 09:00:00+00'); UPDATE pilots SET credits = credits - 2550.00 WHERE id = 2; SAVEPOINT commission; UPDATE pilots SET credits = credits + 51.00 WHERE id = 7; SAVEPOINT refund; UPDATE pilots SET credits = credits + 255.00 WHERE id = 2; ROLLBACK TO SAVEPOINT refund; COMMIT;", why: "commission paid to Grimble but not taken from Bram" },
		],
		accept: ["START TRANSACTION; INSERT INTO trades (ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at) VALUES (2, 5, 11, 'buy', 300, 8.5, timestamptz '2078-01-15 09:00 UTC'); UPDATE pilots SET credits = credits - 300 * 8.50 WHERE id = 2; SAVEPOINT commission; UPDATE pilots SET credits = credits + CASE id WHEN 2 THEN -51 ELSE 51 END WHERE id IN (2, 7); SAVEPOINT refund; UPDATE pilots SET credits = credits + 255 WHERE id = 2; ROLLBACK TO refund; COMMIT;"],
	},
	"ch21-pr02": {
		reject: [{ sql: "BEGIN; UPDATE pilots SET credits = COALESCE(credits, 0) + 50 WHERE rank = 'cadet'; COMMIT;", why: "unfreezes Lumen" }],
	},
	"ch21-pr03": {
		reject: [{ sql: "BEGIN; UPDATE commodities SET base_price = 220.00 WHERE name = 'Medical Gel'; SAVEPOINT one; UPDATE commodities SET base_price = 99.00 WHERE name = 'Robot Parts'; SAVEPOINT two; UPDATE commodities SET base_price = 270.00 WHERE name = 'Synth Silk'; ROLLBACK TO SAVEPOINT two; COMMIT;", why: "rolled back to the wrong savepoint" }],
	},
	"ch21-pr04": {
		reject: [{ sql: "INSERT INTO ships (name, cargo_capacity) VALUES ('Paper Moon', 1);", why: "valid capacity: no error" }],
	},
	"ch21-pr05": {
		reject: [{ sql: "INSERT INTO pilots (name, species, rank, joined_at) VALUES ('Nemo', 'Human', 'cadet', '2078-01-01');", why: "joined_at given: no error" }],
	},
	"ch21-pr06": {
		reject: [{ sql: "INSERT INTO trades (ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at) VALUES (99, 1, 1, 'buy', 0, 1.00, '2078-01-01 00:00:00+00');", why: "qty 0 fails the CHECK first (23514)" }],
	},
	"ch21-pr07": {
		reject: [{ sql: "INSERT INTO pilots (name, species, rank, callsign, joined_at) VALUES ('Nova Jr', 'Human', 'cadet', 'nova', '2078-01-01 00:00:00+00');", why: "lower-case nova is a different callsign: no error" }],
	},
};

export default cases;
