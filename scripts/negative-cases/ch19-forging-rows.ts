// Negative and accept cases for ch19-forging-rows.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch19-forging-rows/lesson-8": {
		reject: [{ sql: "INSERT INTO planets (name) VALUES ('Glimmerfall');", why: "sector missing" }],
		accept: ["INSERT INTO planets (sector, name) VALUES ('Frontier', 'Glimmerfall');"],
	},
	"ch19-ex01": {
		reject: [
			{ sql: "INSERT INTO planets (name, sector, population, gravity) VALUES ('Frontier', 'Nova Prime', 12000, 0.88);", why: "name and sector swapped" },
			{ sql: "INSERT INTO planets (name, sector, population, gravity, has_spaceport) VALUES ('Nova Prime', 'Frontier', 12000, 0.88, NULL);", why: "explicit NULL is not the default (23502)" },
			{ sql: "INSERT INTO planets (name, sector, population, gravity) VALUES ('Nova Prime', 'Frontier', 12000, 0.8);", why: "wrong gravity" },
		],
		accept: [
			"INSERT INTO planets (name, sector, population, gravity, has_spaceport) VALUES ('Nova Prime', 'Frontier', 12000, 0.88, DEFAULT);",
			"insert into planets (gravity, population, sector, name) values (0.88, 12000, 'Frontier', 'Nova Prime')",
			"INSERT INTO planets (name, sector, population, gravity, has_spaceport) VALUES ('Nova Prime', 'Frontier', 12000, 0.88, false);",
		],
	},
	"ch19-ex02": {
		reject: [
			{ sql: "INSERT INTO commodities (name, category, base_price, unit) VALUES ('Moon Cheese', 'food', 14.00, 'Wheel');", why: "unit spelled differently" },
			{ sql: "INSERT INTO commodities (name, category, base_price, legal, unit) VALUES ('Moon Cheese', 'food', 14.00, false, 'wheel');", why: "marked illegal" },
		],
		accept: [
			"INSERT INTO commodities (name, category, base_price, unit) VALUES ('Moon Cheese', 'food', 14, 'wheel');",
			"INSERT INTO commodities VALUES (DEFAULT, 'Moon Cheese', 'food', 14.00, true, 'wheel');",
		],
	},
	"ch19-ex03": {
		reject: [
			{ sql: "INSERT INTO pilots (name, species, rank, joined_at) VALUES ('Ivy Starling', 'Human', 'cadet', '2078-01-10 00:00:00+00'), ('Bo Ruckus', 'Human', 'cadet', '2078-01-10 00:00:00+00');", why: "Mox is missing" },
			{ sql: "INSERT INTO pilots (name, species, rank, joined_at) VALUES ('Ivy Starling', 'cadet', 'Human', '2078-01-10 00:00:00+00'), ('Bo Ruckus', 'cadet', 'Human', '2078-01-10 00:00:00+00'), ('Mox', 'cadet', 'Human', '2078-01-10 00:00:00+00');", why: "species and rank swapped" },
			{ sql: "INSERT INTO pilots (name, species, rank, joined_at) VALUES ('Ivy Starling', 'Human', 'cadet', '2078-01-10 00:00:00+05'), ('Bo Ruckus', 'Human', 'cadet', '2078-01-10 00:00:00+05'), ('Mox', 'Human', 'cadet', '2078-01-10 00:00:00+05');", why: "wrong time zone offset" },
		],
		accept: [
			"INSERT INTO pilots (name, species, rank, joined_at) VALUES ('Mox', 'Human', 'cadet', timestamptz '2078-01-10'), ('Bo Ruckus', 'Human', 'cadet', timestamptz '2078-01-10'), ('Ivy Starling', 'Human', 'cadet', timestamptz '2078-01-10');",
			"INSERT INTO pilots (name, species, rank, joined_at) SELECT n, 'Human', 'cadet', '2078-01-10 00:00:00+00' FROM (VALUES ('Ivy Starling'), ('Bo Ruckus'), ('Mox')) AS v(n);",
		],
	},
	"ch19-ex04": {
		reject: [
			{ sql: "INSERT INTO pilots (name, species, rank, credits, joined_at) VALUES ('Kip Lanyard', 'Vulpine', 'ensign', 0, '2078-02-01 00:00:00+00');", why: "credits 0 instead of unknown" },
			{ sql: "INSERT INTO pilots (name, species, rank, reputation, joined_at) VALUES ('Kip Lanyard', 'Vulpine', 'ensign', 1, '2078-02-01 00:00:00+00');", why: "reputation is not the default" },
		],
		accept: [
			"INSERT INTO pilots (name, species, rank, credits, reputation, joined_at) VALUES ('Kip Lanyard', 'Vulpine', 'ensign', NULL, DEFAULT, '2078-02-01 00:00:00+00');",
		],
	},
	"ch19-ex05": {
		reject: [
			{ sql: "INSERT INTO ships (name, model, pilot_id, cargo_capacity) VALUES ('Dawn Treader', 'Courier Mk II', 4, 40);", why: "no RETURNING: nothing comes back" },
			{ sql: "INSERT INTO ships (name, model, pilot_id, cargo_capacity) VALUES ('Dawn Treader', 'Courier Mk II', 4, 40) RETURNING *;", why: "returns every column" },
		],
		accept: [
			"INSERT INTO ships (name, model, pilot_id, cargo_capacity) VALUES ('Dawn Treader', 'Courier Mk II', 4, 40) RETURNING ships.id AS new_id, ships.name AS ship;",
		],
	},
	"ch19-ex06": {
		reject: [
			{ sql: "INSERT INTO contraband_archive (commodity_id, name, base_price) SELECT id, name, base_price FROM commodities WHERE category = 'contraband';", why: "misses the illegal Antimatter Pods" },
			{ sql: "INSERT INTO contraband_archive (commodity_id, name, base_price) SELECT id, name, base_price FROM commodities WHERE legal;", why: "copies the legal goods" },
		],
		accept: [
			"INSERT INTO contraband_archive SELECT id, name, base_price FROM commodities WHERE legal = false;",
			"INSERT INTO contraband_archive (name, commodity_id, base_price) SELECT name, id, base_price FROM commodities WHERE legal IS FALSE;",
		],
	},
	"ch19-ex07": {
		reject: [
			{ sql: "INSERT INTO planets (id, name, sector) VALUES (13, 'Sable Spire', 'Frontier') RETURNING id;", why: "fills the gap by hand" },
			{ sql: "INSERT INTO planets (name, sector) VALUES ('Sable Spire', 'Frontier');", why: "no id returned" },
		],
		accept: ["INSERT INTO planets (sector, name) VALUES ('Frontier', 'Sable Spire') RETURNING planets.id;"],
	},
	"ch19-ex08": {
		reject: [
			{ sql: "INSERT INTO pilots (name, species, rank, callsign, joined_at) SELECT name, species, rank, callsign, '2078-03-01 00:00:00+00' FROM arrivals WHERE cleared RETURNING id, name, callsign;", why: "no ORDER BY: ids land in storage order" },
			{ sql: "INSERT INTO pilots (name, species, rank, callsign, joined_at) SELECT name, species, rank, callsign, '2078-03-01 00:00:00+00' FROM arrivals ORDER BY name RETURNING id, name, callsign;", why: "uncleared Juno registered" },
			{ sql: "INSERT INTO pilots (name, species, rank, callsign, joined_at) SELECT name, species, rank, callsign, '2078-03-01 00:00:00+00' FROM arrivals WHERE cleared ORDER BY name DESC RETURNING id, name, callsign;", why: "ids in Z to A order" },
		],
		accept: [
			"INSERT INTO pilots (name, species, rank, callsign, joined_at, reputation) SELECT a.name, a.species, a.rank, a.callsign, timestamptz '2078-03-01 00:00 UTC', 0 FROM arrivals a WHERE a.cleared = true ORDER BY a.name RETURNING id, name, callsign;",
		],
	},
	"ch19-pr01": {
		reject: [{ sql: "INSERT INTO factions (name, founded_year) VALUES ('Comet Riders', 2078);", why: "homeworld missing" }],
	},
	"ch19-pr02": {
		reject: [{ sql: "INSERT INTO routes (from_planet_id, to_planet_id, distance_ly) VALUES (11, 2, 3.9);", why: "only one direction" }],
		accept: ["INSERT INTO routes VALUES (2, 11, 3.9, NULL), (11, 2, 3.9, NULL);"],
	},
	"ch19-pr03": {
		reject: [{ sql: "INSERT INTO commodities (name, unit) VALUES ('Ion Salt', 'sack'), ('Star Anise', 'jar');", why: "no duplicate, no error" }],
	},
	"ch19-pr04": {
		reject: [{ sql: "INSERT INTO commodities (name, category, base_price, legal, unit) VALUES ('Ion Salt', 'essentials', 22.00, false, 'sack');", why: "legal set to false" }],
		accept: ["INSERT INTO commodities (name, category, base_price, unit) VALUES ('Ion Salt', 'essentials', 22.00, 'sack');"],
	},
	"ch19-pr05": {
		reject: [{ sql: "INSERT INTO trades (ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at) VALUES (13, 2, 12, 'sell', 20, 101.00, '2078-01-05 10:00:00+00') RETURNING id, unit_price;", why: "returns the unit price, not the value" }],
	},
	"ch19-pr07": {
		reject: [{ sql: "INSERT INTO ships (name) VALUES ('Firefly'); SELECT nextval(pg_get_serial_sequence('ships', 'id'));", why: "nextval hands out a new number (23)" }],
		accept: ["INSERT INTO ships (name) VALUES ('Firefly'); SELECT currval('ships_id_seq');"],
	},
	"ch19-pr08": {
		reject: [{ sql: "SELECT nextval(pg_get_serial_sequence('planets', 'id'));", why: "nextval works, no error" }],
	},
};

export default cases;
