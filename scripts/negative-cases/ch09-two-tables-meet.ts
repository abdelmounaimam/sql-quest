// Negative and accept cases for ch09-two-tables-meet.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch09-two-tables-meet/lesson-8": {
		reject: [{ sql: "SELECT s.name, p.rank FROM ships s JOIN pilots p ON p.id = s.id;", why: "wrong key: ship id is not a pilot id" }],
		accept: ["SELECT ships.name, rank FROM ships JOIN pilots ON pilots.id = ships.pilot_id;"],
	},
	"ch09-ex01": {
		reject: [
			{ sql: "SELECT s.name, p.name FROM ships s JOIN pilots p ON p.id = s.id;", why: "wrong key (s.id = p.id)" },
			{ sql: "SELECT s.name, p.name FROM ships s JOIN pilots p ON p.name = s.name;", why: "joins on names instead of ids" },
			{ sql: "SELECT s.name, p.name FROM ships s, pilots p;", why: "comma join without condition: cartesian product" },
			{ sql: "SELECT p.name, s.name FROM ships s JOIN pilots p ON p.id = s.pilot_id;", why: "columns swapped" },
		],
		accept: [
			"SELECT s.name, p.name FROM ships s, pilots p WHERE s.pilot_id = p.id;",
			"SELECT ships.name, pilots.name FROM pilots INNER JOIN ships ON ships.pilot_id = pilots.id;",
		],
	},
	"ch09-ex02": {
		reject: [
			{ sql: "SELECT p.name, p.name FROM pilots p JOIN factions f ON f.id = p.faction_id;", why: "pilot name twice" },
			{ sql: "SELECT p.name, f.name FROM pilots p JOIN factions f ON f.id = p.id;", why: "wrong key" },
		],
		accept: [
			"SELECT pilots.name, factions.name FROM pilots JOIN factions ON pilots.faction_id = factions.id;",
			"SELECT p.name AS pilot, f.name AS faction FROM factions AS f JOIN pilots AS p ON p.faction_id = f.id;",
		],
	},
	"ch09-ex03": {
		reject: [
			{ sql: "SELECT f.name, pl.name FROM factions f JOIN planets pl ON pl.id = f.id;", why: "wrong key (f.id)" },
			{ sql: "SELECT f.name, pl.name FROM factions f, planets pl;", why: "cartesian product" },
		],
		accept: ["SELECT f.name, pl.name FROM planets pl JOIN factions f ON f.homeworld_id = pl.id;"],
	},
	"ch09-ex04": {
		reject: [
			{ sql: "SELECT t.id, c.name, pl.name FROM trades t, commodities c, planets pl WHERE c.id = t.commodity_id;", why: "missing planet condition: 480 rows" },
			{ sql: "SELECT t.id, c.name, pl.name FROM trades t JOIN commodities c ON c.id = t.commodity_id JOIN planets pl ON pl.id = t.ship_id;", why: "planet joined on the ship id" },
		],
		accept: ["SELECT t.id, c.name, pl.name FROM trades t, commodities c, planets pl WHERE c.id = t.commodity_id AND pl.id = t.planet_id;"],
	},
	"ch09-ex05": {
		reject: [
			{ sql: "SELECT t.id, p.name FROM trades t JOIN pilots p ON p.id = t.ship_id;", why: "skips ships: ship id used as a pilot id" },
			{ sql: "SELECT t.id, s.name FROM trades t JOIN ships s ON s.id = t.ship_id;", why: "ship name instead of pilot name" },
		],
		accept: ["SELECT trades.id, pilots.name FROM pilots JOIN ships ON ships.pilot_id = pilots.id JOIN trades ON trades.ship_id = ships.id;"],
	},
	"ch09-ex06": {
		reject: [
			{ sql: "SELECT z.id, t.id FROM seizures z JOIN trades t USING (ship_id);", why: "same ship only, commodity ignored" },
			{ sql: "SELECT z.id, t.id FROM seizures z JOIN trades t USING (ship_id, commodity_id, qty);", why: "also requires equal quantities" },
		],
		accept: ["SELECT z.id, t.id FROM seizures z JOIN trades t ON t.ship_id = z.ship_id AND t.commodity_id = z.commodity_id;"],
	},
	"ch09-ex07": {
		reject: [
			{ sql: "SELECT p.name, pl.name, pl.sector FROM pilots p JOIN planets pl ON pl.id = p.home_planet_id;", why: "keeps the unknown sector" },
		],
		accept: ["SELECT p.name, pl.name, pl.sector FROM pilots p JOIN planets pl ON pl.id = p.home_planet_id AND pl.sector IS NOT NULL;"],
	},
	"ch09-ex08": {
		reject: [
			{ sql: "SELECT t.traded_at, p.name, c.name, pl.name, t.qty * t.unit_price FROM trades t JOIN ships s ON s.id = t.ship_id JOIN pilots p ON p.id = s.pilot_id JOIN commodities c ON c.id = t.commodity_id JOIN planets pl ON pl.id = t.planet_id WHERE c.category = 'contraband' ORDER BY t.traded_at;", why: "category instead of legal: misses Antimatter Pods" },
			{ sql: "SELECT t.traded_at, p.name, c.name, pl.name, t.qty * t.unit_price FROM trades t JOIN ships s ON s.id = t.ship_id JOIN pilots p ON p.id = s.pilot_id JOIN commodities c ON c.id = t.commodity_id JOIN planets pl ON pl.id = t.planet_id WHERE NOT c.legal ORDER BY t.traded_at DESC;", why: "newest first" },
			{ sql: "SELECT t.traded_at, p.name, c.name, pl.name, t.unit_price FROM trades t JOIN ships s ON s.id = t.ship_id JOIN pilots p ON p.id = s.pilot_id JOIN commodities c ON c.id = t.commodity_id JOIN planets pl ON pl.id = t.planet_id WHERE NOT c.legal ORDER BY t.traded_at;", why: "unit price instead of value" },
			{ sql: "SELECT t.traded_at, p.name, c.name, pl.name, t.qty * t.unit_price FROM trades t JOIN pilots p ON p.id = t.ship_id JOIN commodities c ON c.id = t.commodity_id JOIN planets pl ON pl.id = t.planet_id WHERE NOT c.legal ORDER BY t.traded_at;", why: "skips ships" },
		],
		accept: [
			"SELECT t.traded_at, p.name, c.name, pl.name, t.qty * t.unit_price AS value FROM trades t, ships s, pilots p, commodities c, planets pl WHERE s.id = t.ship_id AND p.id = s.pilot_id AND c.id = t.commodity_id AND pl.id = t.planet_id AND c.legal = false ORDER BY 1;",
		],
	},
	"ch09-pr01": {
		reject: [
			{ sql: "SELECT s.name, p.callsign FROM ships s JOIN pilots p ON p.name = s.name;", why: "joins on names" },
			{ sql: "SELECT s.name, p.callsign FROM ships s JOIN pilots p ON p.id = s.id;", why: "wrong key" },
		],
	},
	"ch09-pr02": {
		accept: ["SELECT commodities.name, seizures.qty, seizures.fine FROM commodities JOIN seizures ON seizures.commodity_id = commodities.id;"],
	},
	"ch09-pr04": {
		reject: [
			{ sql: "SELECT a.name, a.name FROM routes r JOIN planets a ON a.id = r.from_planet_id;", why: "one join for two roles" },
			{ sql: "SELECT b.name, a.name FROM routes r JOIN planets a ON a.id = r.from_planet_id JOIN planets b ON b.id = r.to_planet_id;", why: "ends swapped" },
		],
	},
	"ch09-pr05": {
		reject: [{ sql: "SELECT p.name, s.name, f.name FROM pilots p JOIN ships s ON s.pilot_id = p.id JOIN factions f ON f.id = s.id;", why: "faction joined on the ship id" }],
	},
	"ch09-pr06": {
		reject: [{ sql: "SELECT ship_id, commodity_id, qty, qty FROM seizures NATURAL JOIN trades;", why: "NATURAL JOIN matches id and qty too" }],
		accept: ["SELECT z.ship_id, z.commodity_id, z.qty, t.qty FROM seizures z JOIN trades t ON t.ship_id = z.ship_id AND t.commodity_id = z.commodity_id;"],
	},
};

export default cases;
