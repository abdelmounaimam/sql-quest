// Negative and accept cases for ch10-outer-gates-and-mirrors.
import type { CaseSet } from "../validate-content";

const boss = (select: string, joins: string) =>
	`SELECT ${select} FROM factions f LEFT JOIN pilots p ON p.faction_id = f.id LEFT JOIN ships s ON s.pilot_id = p.id ${joins} GROUP BY f.id, f.name;`;
const naiveJoins =
	"LEFT JOIN trades t ON t.ship_id = s.id AND t.side = 'sell' LEFT JOIN seizures z ON z.ship_id = s.id";

const cases: Record<string, CaseSet> = {
	"ch10-outer-gates-and-mirrors/lesson-9": {
		reject: [{ sql: "SELECT s.name, p.name FROM pilots p LEFT JOIN ships s ON p.id = s.pilot_id;", why: "pilots on the left: keeps grounded pilots, drops pilotless ships" }],
		accept: ["SELECT s.name, p.name FROM pilots p RIGHT JOIN ships s ON p.id = s.pilot_id;"],
	},
	"ch10-ex01": {
		reject: [
			{ sql: "SELECT f.name, count(*) FROM factions f LEFT JOIN pilots p ON p.faction_id = f.id GROUP BY f.name;", why: "count(*) counts the NULL row: 1 for the Lantern Guild" },
			{ sql: "SELECT f.name, count(p.id) FROM factions f JOIN pilots p ON p.faction_id = f.id GROUP BY f.name;", why: "INNER JOIN loses the Lantern Guild" },
		],
		accept: [
			"SELECT f.name, count(p.faction_id) FROM pilots p RIGHT JOIN factions f ON f.id = p.faction_id GROUP BY f.name;",
			"SELECT f.name, (SELECT count(*) FROM pilots p WHERE p.faction_id = f.id) FROM factions f;",
		],
	},
	"ch10-ex02": {
		reject: [
			{ sql: "SELECT s.name, count(t.id) FROM ships s LEFT JOIN trades t ON t.ship_id = s.id WHERE (t.traded_at >= '2077-01-01' AND t.traded_at < '2078-01-01') OR t.id IS NULL GROUP BY s.id, s.name;", why: "drops ships that traded only in 2076" },
			{ sql: "SELECT s.name, count(*) FROM ships s LEFT JOIN trades t ON t.ship_id = s.id AND t.traded_at >= '2077-01-01' AND t.traded_at < '2078-01-01' GROUP BY s.id, s.name;", why: "count(*) gives 1 to ships without trades" },
			{ sql: "SELECT s.name, count(t.id) FROM ships s LEFT JOIN trades t ON t.ship_id = s.id GROUP BY s.id, s.name;", why: "counts every year" },
		],
		accept: [
			"SELECT s.name, count(t.id) FROM ships s LEFT JOIN trades t ON t.ship_id = s.id AND extract(year FROM t.traded_at) = 2077 GROUP BY s.name;",
			"SELECT s.name, count(t.id) FILTER (WHERE t.traded_at >= '2077-01-01' AND t.traded_at < '2078-01-01') FROM ships s LEFT JOIN trades t ON t.ship_id = s.id GROUP BY s.name;",
		],
	},
	"ch10-ex03": {
		reject: [
			{ sql: "SELECT c.name FROM commodities c LEFT JOIN trades t ON t.commodity_id = c.id WHERE t.unit_price IS NULL;", why: "IS NULL on a nullable column: adds Hydroponic Rice" },
			{ sql: "SELECT c.name FROM commodities c LEFT JOIN trades t ON t.commodity_id = c.id AND t.id IS NULL;", why: "anti condition placed in ON keeps everything" },
		],
		accept: [
			"SELECT c.name FROM commodities c WHERE NOT EXISTS (SELECT 1 FROM trades t WHERE t.commodity_id = c.id);",
			"SELECT c.name FROM trades t RIGHT JOIN commodities c ON c.id = t.commodity_id WHERE t.commodity_id IS NULL;",
		],
	},
	"ch10-ex04": {
		reject: [
			{ sql: "SELECT pl.name, f.name FROM planets pl LEFT JOIN factions f ON f.homeworld_id = pl.id;", why: "LEFT JOIN loses the Lantern Guild" },
			{ sql: "SELECT pl.name, f.name FROM planets pl RIGHT JOIN factions f ON f.homeworld_id = pl.id;", why: "RIGHT JOIN loses the lonely planets" },
		],
		accept: ["SELECT pl.name, f.name FROM factions f FULL OUTER JOIN planets pl ON pl.id = f.homeworld_id;"],
	},
	"ch10-ex05": {
		reject: [
			{ sql: "SELECT p.name, m.name FROM pilots p JOIN pilots m ON m.id = p.mentor_id;", why: "INNER JOIN drops self-taught pilots" },
			{ sql: "SELECT p.name, m.name FROM pilots p LEFT JOIN pilots m ON m.mentor_id = p.id;", why: "roles reversed: apprentices" },
		],
		accept: ["SELECT a.name, b.name FROM pilots b RIGHT JOIN pilots a ON a.mentor_id = b.id;"],
	},
	"ch10-ex06": {
		reject: [
			{ sql: "SELECT a.from_planet_id, a.to_planet_id, b.to_planet_id FROM routes a JOIN routes b ON b.from_planet_id = a.to_planet_id;", why: "keeps round trips" },
			{ sql: "SELECT a.from_planet_id, a.to_planet_id, b.to_planet_id FROM routes a JOIN routes b ON b.to_planet_id = a.from_planet_id WHERE b.from_planet_id <> a.to_planet_id;", why: "hops chained backwards" },
		],
		accept: ["SELECT r1.from_planet_id, r2.from_planet_id, r2.to_planet_id FROM routes r1, routes r2 WHERE r1.to_planet_id = r2.from_planet_id AND r1.from_planet_id <> r2.to_planet_id;"],
	},
	"ch10-ex07": {
		reject: [
			{ sql: "SELECT p.name, t.tier FROM pilots p JOIN reputation_tiers t ON p.reputation > t.min_rep AND p.reputation < t.max_rep;", why: "bounds excluded" },
			{ sql: "SELECT p.name, t.tier FROM pilots p JOIN reputation_tiers t ON p.reputation >= t.min_rep;", why: "only one bound: many tiers per pilot" },
		],
		accept: ["SELECT p.name, t.tier FROM pilots p, reputation_tiers t WHERE p.reputation >= t.min_rep AND p.reputation <= t.max_rep;"],
	},
	"ch10-ex08": {
		reject: [
			{ sql: "SELECT s.name, pl.name FROM ships s CROSS JOIN planets pl WHERE s.cargo_capacity > 900 AND pl.has_spaceport AND pl.gravity <= 1.00;", why: "900 excluded" },
			{ sql: "SELECT s.name, pl.name FROM ships s CROSS JOIN planets pl WHERE s.cargo_capacity >= 900 AND pl.has_spaceport AND pl.gravity < 1.00;", why: "1.00 excluded: loses Terra Nova" },
			{ sql: "SELECT s.name, pl.name FROM ships s CROSS JOIN planets pl WHERE s.cargo_capacity >= 900 AND pl.gravity <= 1.00;", why: "spaceport filter forgotten: adds Mirage" },
		],
		accept: ["SELECT s.name, pl.name FROM ships s, planets pl WHERE s.cargo_capacity >= 900 AND pl.has_spaceport = true AND NOT pl.gravity > 1;"],
	},
	"ch10-ex09": {
		reject: [
			{ sql: boss("f.name, count(DISTINCT p.id), count(DISTINCT s.id), COALESCE(sum(DISTINCT t.qty * t.unit_price), 0), COALESCE(sum(DISTINCT z.qty), 0)", naiveJoins), why: "sum(DISTINCT) merges equal values" },
			{ sql: boss("f.name, count(DISTINCT p.id), count(DISTINCT s.id), COALESCE(sum(t.qty * t.unit_price), 0), COALESCE(sum(z.qty), 0)", naiveJoins), why: "fan-out still inflates the sums" },
			{
				sql: boss(
					"f.name, count(DISTINCT p.id), count(DISTINCT s.id), sum(ts.sales), sum(zs.seized)",
					"LEFT JOIN (SELECT ship_id, sum(qty * unit_price) AS sales FROM trades WHERE side = 'sell' GROUP BY ship_id) ts ON ts.ship_id = s.id LEFT JOIN (SELECT ship_id, sum(qty) AS seized FROM seizures GROUP BY ship_id) zs ON zs.ship_id = s.id",
				),
				why: "NULL instead of 0",
			},
			{
				sql: "SELECT f.name, count(DISTINCT p.id), count(DISTINCT s.id), COALESCE(sum(ts.sales), 0), COALESCE(sum(zs.seized), 0) FROM factions f JOIN pilots p ON p.faction_id = f.id LEFT JOIN ships s ON s.pilot_id = p.id LEFT JOIN (SELECT ship_id, sum(qty * unit_price) AS sales FROM trades WHERE side = 'sell' GROUP BY ship_id) ts ON ts.ship_id = s.id LEFT JOIN (SELECT ship_id, sum(qty) AS seized FROM seizures GROUP BY ship_id) zs ON zs.ship_id = s.id GROUP BY f.id, f.name;",
				why: "INNER JOIN loses the Lantern Guild",
			},
			{
				sql: boss(
					"f.name, count(DISTINCT p.id), count(DISTINCT s.id), COALESCE(sum(ts.sales), 0), COALESCE(sum(zs.seized), 0)",
					"LEFT JOIN (SELECT ship_id, sum(qty * unit_price) AS sales FROM trades GROUP BY ship_id) ts ON ts.ship_id = s.id LEFT JOIN (SELECT ship_id, sum(qty) AS seized FROM seizures GROUP BY ship_id) zs ON zs.ship_id = s.id",
				),
				why: "buys counted as sales",
			},
		],
		accept: [
			"SELECT f.name,\n (SELECT count(*) FROM pilots p WHERE p.faction_id = f.id),\n (SELECT count(*) FROM ships s JOIN pilots p ON p.id = s.pilot_id WHERE p.faction_id = f.id),\n (SELECT COALESCE(sum(t.qty * t.unit_price), 0) FROM trades t JOIN ships s ON s.id = t.ship_id JOIN pilots p ON p.id = s.pilot_id WHERE p.faction_id = f.id AND t.side = 'sell'),\n (SELECT COALESCE(sum(z.qty), 0) FROM seizures z JOIN ships s ON s.id = z.ship_id JOIN pilots p ON p.id = s.pilot_id WHERE p.faction_id = f.id)\nFROM factions f;",
			"WITH ps AS (SELECT faction_id, count(*) AS n FROM pilots GROUP BY faction_id),\n sh AS (SELECT p.faction_id, count(*) AS n FROM ships s JOIN pilots p ON p.id = s.pilot_id GROUP BY p.faction_id),\n sa AS (SELECT p.faction_id, sum(t.qty * t.unit_price) AS v FROM trades t JOIN ships s ON s.id = t.ship_id JOIN pilots p ON p.id = s.pilot_id WHERE t.side = 'sell' GROUP BY p.faction_id),\n se AS (SELECT p.faction_id, sum(z.qty) AS v FROM seizures z JOIN ships s ON s.id = z.ship_id JOIN pilots p ON p.id = s.pilot_id GROUP BY p.faction_id)\nSELECT f.name, COALESCE(ps.n, 0), COALESCE(sh.n, 0), COALESCE(sa.v, 0), COALESCE(se.v, 0)\nFROM factions f LEFT JOIN ps ON ps.faction_id = f.id LEFT JOIN sh ON sh.faction_id = f.id LEFT JOIN sa ON sa.faction_id = f.id LEFT JOIN se ON se.faction_id = f.id;",
		],
	},
	"ch10-pr01": {
		reject: [{ sql: "SELECT pl.name, count(*) FROM planets pl LEFT JOIN trades t ON t.planet_id = pl.id GROUP BY pl.name;", why: "count(*) gives Hollow Moon 1" }],
	},
	"ch10-pr02": {
		reject: [{ sql: "SELECT p.name FROM pilots p LEFT JOIN ships s ON s.pilot_id = p.id WHERE s.hull_integrity IS NULL;", why: "IS NULL on a nullable column: adds Nox and Umbra-3" }],
		accept: ["SELECT p.name FROM pilots p WHERE NOT EXISTS (SELECT 1 FROM ships s WHERE s.pilot_id = p.id);"],
	},
	"ch10-pr03": {
		accept: ["SELECT c.name, z.id FROM seizures z RIGHT JOIN commodities c ON z.commodity_id = c.id;"],
	},
	"ch10-pr04": {
		reject: [
			{ sql: "SELECT a.name, b.name FROM pilots a JOIN pilots b ON b.species = a.species AND a.id <> b.id WHERE a.species <> 'Human';", why: "mirrored duplicate pairs" },
			{ sql: "SELECT a.name, b.name FROM pilots a JOIN pilots b ON b.species = a.species AND a.id <= b.id WHERE a.species <> 'Human';", why: "pilots paired with themselves" },
		],
	},
	"ch10-pr05": {
		reject: [{ sql: "SELECT a.from_planet_id, a.to_planet_id FROM routes a JOIN routes b ON b.from_planet_id = a.to_planet_id AND b.to_planet_id = a.from_planet_id;", why: "each lane twice" }],
	},
	"ch10-pr07": {
		reject: [{ sql: "SELECT t.id, c.name, t.unit_price, c.base_price FROM trades t JOIN commodities c ON c.id = t.commodity_id AND t.unit_price > c.base_price;", why: "any markup, not more than 10%" }],
		accept: ["SELECT t.id, c.name, t.unit_price, c.base_price FROM trades t JOIN commodities c ON c.id = t.commodity_id WHERE t.unit_price > 1.1 * c.base_price;"],
	},
	"ch10-pr09": {
		reject: [{ sql: "SELECT s.name, count(t.id), count(z.id) FROM ships s LEFT JOIN trades t ON t.ship_id = s.id LEFT JOIN seizures z ON z.ship_id = s.id GROUP BY s.id, s.name;", why: "fan-out: counts multiplied" }],
		accept: [
			"SELECT s.name, COALESCE(t.n, 0), COALESCE(z.n, 0) FROM ships s LEFT JOIN (SELECT ship_id, count(*) AS n FROM trades GROUP BY ship_id) t ON t.ship_id = s.id LEFT JOIN (SELECT ship_id, count(*) AS n FROM seizures GROUP BY ship_id) z ON z.ship_id = s.id;",
		],
	},
};

export default cases;
