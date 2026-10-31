// Negative and accept cases for ch20-reforging-and-banishing.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch20-reforging-and-banishing/lesson-8": {
		reject: [{ sql: "UPDATE pilots SET rank = 'ensign' WHERE rank = 'cadet';", why: "promotes every cadet" }],
		accept: ["UPDATE pilots SET rank = 'ensign' WHERE name = 'Wren Calloway';"],
	},
	"ch20-ex01": {
		reject: [
			{ sql: "UPDATE pilots SET credits = credits + 100;", why: "no WHERE: every pilot paid" },
			{ sql: "UPDATE pilots SET credits = COALESCE(credits, 0) + 100 WHERE rank = 'cadet';", why: "unfreezes Lumen" },
			{ sql: "UPDATE pilots SET credits = 100 WHERE rank = 'cadet';", why: "overwrites instead of adding" },
		],
		accept: ["UPDATE pilots SET credits = 100 + credits WHERE rank IN ('cadet');"],
	},
	"ch20-ex02": {
		reject: [
			{ sql: "UPDATE ships SET hull_integrity = 100 WHERE hull_integrity <= 30 OR hull_integrity IS NULL;", why: "repairs uninspected hulls too" },
			{ sql: "UPDATE ships SET hull_integrity = 100 WHERE hull_integrity < 50;", why: "wrong threshold" },
		],
		accept: ["UPDATE ships SET hull_integrity = 100.00 WHERE NOT hull_integrity >= 30;"],
	},
	"ch20-ex03": {
		reject: [
			{ sql: "UPDATE pilots p SET credits = p.credits + 500 FROM factions f WHERE f.name = 'Azure Navy';", why: "no join condition: every pilot paid" },
			{ sql: "UPDATE pilots SET credits = credits + 500 WHERE faction_id = 1;", why: "wrong faction" },
		],
		accept: [
			"UPDATE pilots SET credits = credits + 500 WHERE faction_id IN (SELECT id FROM factions WHERE name = 'Azure Navy');",
			"UPDATE pilots SET credits = credits + 500 WHERE faction_id = 5;",
		],
	},
	"ch20-ex04": {
		reject: [
			{ sql: "UPDATE commodities c SET base_price = t.unit_price FROM trades t WHERE t.commodity_id = c.id AND t.side = 'sell';", why: "ungrouped join: an arbitrary trade per commodity" },
			{ sql: "UPDATE commodities c SET base_price = (SELECT avg(unit_price) FROM trades t WHERE t.commodity_id = c.id AND t.side = 'sell');", why: "commodities without sells become NULL" },
			{ sql: "UPDATE commodities c SET base_price = s.p FROM (SELECT commodity_id, avg(unit_price) AS p FROM trades GROUP BY commodity_id) s WHERE s.commodity_id = c.id;", why: "averages buys and sells" },
		],
		accept: [
			"UPDATE commodities SET base_price = s.p FROM (SELECT commodity_id, round(avg(unit_price), 2) AS p FROM trades WHERE side = 'sell' GROUP BY commodity_id HAVING count(unit_price) > 0) AS s WHERE commodities.id = s.commodity_id;",
			"WITH s AS (SELECT commodity_id, avg(unit_price) AS p FROM trades WHERE side = 'sell' GROUP BY commodity_id) UPDATE commodities c SET base_price = s.p FROM s WHERE s.commodity_id = c.id;",
		],
	},
	"ch20-ex05": {
		reject: [
			{ sql: "DELETE FROM seizures WHERE fine = NULL;", why: "= NULL deletes nothing" },
			{ sql: "DELETE FROM seizures;", why: "no WHERE" },
		],
	},
	"ch20-ex06": {
		reject: [
			{ sql: "DELETE FROM trades t USING ships s WHERE s.id = t.ship_id AND s.name = 'Jackpot';", why: "forgets 100% Legit" },
			{ sql: "DELETE FROM trades t USING ships s, pilots p WHERE p.id = s.pilot_id AND p.name = 'Jax O''Hara';", why: "trades not joined: deletes every trade" },
		],
		accept: [
			"DELETE FROM trades WHERE ship_id IN (SELECT s.id FROM ships s JOIN pilots p ON p.id = s.pilot_id WHERE p.name = 'Jax O''Hara');",
			"DELETE FROM trades USING ships JOIN pilots ON pilots.id = ships.pilot_id WHERE ships.id = trades.ship_id AND pilots.id = 9;",
		],
	},
	"ch20-ex07": {
		reject: [
			{ sql: "DELETE FROM pilots WHERE id = 22;", why: "Wren can be deleted without error" },
			{ sql: "DELETE FROM pilot WHERE id = 2;", why: "typo: 42P01, not a foreign key error" },
		],
		accept: ["DELETE FROM pilots WHERE name = 'Bram Kettle';"],
	},
	"ch20-ex08": {
		reject: [
			{ sql: "TRUNCATE trades;", why: "numbering not reset" },
			{ sql: "DELETE FROM trades;", why: "numbering not reset" },
		],
		accept: [
			"TRUNCATE TABLE trades RESTART IDENTITY;",
			"DELETE FROM trades; ALTER SEQUENCE trades_id_seq RESTART;",
		],
	},
	"ch20-ex09": {
		reject: [
			{ sql: "UPDATE pilots p SET reputation = p.reputation - 200 FROM ships s JOIN seizures z ON z.ship_id = s.id WHERE s.pilot_id = p.id; DELETE FROM seizures z USING commodities c WHERE c.id = z.commodity_id AND c.name = 'Glow Shrooms' AND z.seized_at < '2077-01-01'; UPDATE ships SET hull_integrity = 50 WHERE hull_integrity IS NULL AND pilot_id IS NOT NULL;", why: "ungrouped join punishes every seized pilot" },
			{ sql: "UPDATE pilots p SET reputation = p.reputation - 200 FROM (SELECT s.pilot_id FROM seizures z JOIN ships s ON s.id = z.ship_id GROUP BY s.pilot_id HAVING count(*) >= 2) r WHERE r.pilot_id = p.id; DELETE FROM seizures z USING commodities c WHERE c.id = z.commodity_id AND c.name = 'Glow Shrooms' AND z.seized_at < '2077-01-01'; UPDATE ships SET hull_integrity = 50 WHERE hull_integrity IS NULL;", why: "the pilotless Ghost Ship is repaired" },
			{ sql: "UPDATE pilots p SET reputation = p.reputation - 200 FROM (SELECT s.pilot_id FROM seizures z JOIN ships s ON s.id = z.ship_id GROUP BY s.pilot_id HAVING count(*) >= 2) r WHERE r.pilot_id = p.id; DELETE FROM seizures z USING commodities c WHERE c.id = z.commodity_id AND c.name = 'Glow Shrooms'; UPDATE ships SET hull_integrity = 50 WHERE hull_integrity IS NULL AND pilot_id IS NOT NULL;", why: "deletes the 2077 Glow Shrooms seizure too" },
		],
		accept: [
			"UPDATE pilots SET reputation = reputation - 200 WHERE id IN (SELECT s.pilot_id FROM seizures z JOIN ships s ON s.id = z.ship_id GROUP BY s.pilot_id HAVING count(*) > 1);\nDELETE FROM seizures WHERE commodity_id = (SELECT id FROM commodities WHERE name = 'Glow Shrooms') AND seized_at < date '2077-01-01';\nUPDATE ships SET hull_integrity = 50 WHERE pilot_id IS NOT NULL AND hull_integrity IS NULL;",
		],
	},
	"ch20-pr02": {
		reject: [{ sql: "UPDATE reputation_tiers SET min_rep = max_rep WHERE tier = 'outlaw'; UPDATE reputation_tiers SET max_rep = min_rep WHERE tier = 'outlaw';", why: "two sequential updates lose a value" }],
		accept: ["UPDATE reputation_tiers SET min_rep = -1000, max_rep = -1 WHERE tier = 'outlaw';"],
	},
	"ch20-pr03": {
		reject: [{ sql: "UPDATE pilots p SET reputation = p.reputation + 50 FROM factions f WHERE f.founded_year < 2050;", why: "no join condition: every pilot gains" }],
	},
	"ch20-pr04": {
		accept: ["UPDATE ships SET hull_integrity = 100 WHERE pilot_id IN (SELECT id FROM pilots WHERE rank = 'admiral');"],
	},
	"ch20-pr06": {
		reject: [{ sql: "DELETE FROM routes WHERE hazard IS NOT NULL;", why: "deletes the dangerous lanes instead" }],
	},
	"ch20-pr07": {
		reject: [{ sql: "DELETE FROM manifest_lines m USING ships s WHERE s.model = 'Viper X';", why: "no join condition: every line deleted" }],
		accept: ["DELETE FROM manifest_lines WHERE ship_id IN (SELECT id FROM ships WHERE model = 'Viper X');"],
	},
	"ch20-pr08": {
		reject: [{ sql: "TRUNCATE ships CASCADE;", why: "CASCADE succeeds and wipes other tables" }],
	},
};

export default cases;
