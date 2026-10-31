// Negative and accept cases for ch08-tally-the-loot.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch08-tally-the-loot/lesson-9": {
		reject: [{ sql: "SELECT species, count(callsign) FROM pilots GROUP BY species;", why: "count(callsign) skips pilots without one" }],
		accept: ["SELECT species, count(*) AS pilots FROM pilots GROUP BY 1;", "SELECT species, count(id) FROM pilots GROUP BY species ORDER BY 2 DESC;"],
	},
	"ch08-ex01": {
		reject: [
			{ sql: "SELECT count(unit_price), sum(qty) FROM trades;", why: "count(col) skips the unknown price" },
			{ sql: "SELECT count(*), count(qty) FROM trades;", why: "count instead of sum" },
		],
		accept: ["SELECT count(id) AS n, sum(qty) AS total FROM trades;"],
	},
	"ch08-ex02": {
		reject: [
			{ sql: "SELECT count(*), count(callsign), count(faction_id) FROM pilots;", why: "count(col) counts pilots, not distinct factions" },
			{ sql: "SELECT count(*), count(*), count(DISTINCT faction_id) FROM pilots;", why: "count(*) also counts NULL callsigns" },
			{ sql: "SELECT count(*), count(callsign), count(DISTINCT COALESCE(faction_id, 0)) FROM pilots;", why: "freelancers counted as a faction" },
		],
	},
	"ch08-ex03": {
		reject: [
			{ sql: "SELECT side, count(*), sum(qty * unit_price), round(avg(COALESCE(unit_price, 0)), 2) FROM trades GROUP BY side;", why: "unknown price averaged as 0" },
			{ sql: "SELECT side, count(unit_price), sum(qty * unit_price), round(avg(unit_price), 2) FROM trades GROUP BY side;", why: "count(col) drops trade 37" },
			{ sql: "SELECT side, count(*), sum(qty) * sum(unit_price), round(avg(unit_price), 2) FROM trades GROUP BY side;", why: "product of sums is not a sum of products" },
		],
		accept: ["SELECT side AS s, count(*), sum(unit_price * qty), round(avg(unit_price), 2) FROM trades GROUP BY 1;"],
	},
	"ch08-ex04": {
		reject: [
			{ sql: "SELECT faction_id, count(credits), sum(credits) FROM pilots GROUP BY faction_id;", why: "Lumen not counted" },
			{ sql: "SELECT faction_id, count(*), sum(credits) FROM pilots WHERE faction_id IS NOT NULL GROUP BY faction_id;", why: "freelancers dropped" },
		],
		accept: ["SELECT faction_id, count(id), sum(credits) FROM pilots GROUP BY 1;"],
	},
	"ch08-ex05": {
		reject: [
			{ sql: "SELECT commodity_id, count(*) FROM trades GROUP BY commodity_id HAVING count(*) >= 3;", why: "3 is not more than 3" },
			{ sql: "SELECT commodity_id, count(*) FROM trades GROUP BY commodity_id;", why: "no filter on groups" },
		],
		accept: ["SELECT commodity_id, count(*) AS n FROM trades GROUP BY commodity_id HAVING NOT count(*) <= 3;"],
	},
	"ch08-ex06": {
		reject: [
			{ sql: "SELECT species, count(*) FROM pilots GROUP BY species HAVING count(*) > 2;", why: "average condition missing" },
			{ sql: "SELECT species, count(*) FROM pilots WHERE reputation > 100 GROUP BY species HAVING count(*) > 2;", why: "row filter instead of a group filter" },
			{ sql: "SELECT species, count(*) FROM pilots GROUP BY species HAVING count(*) > 2 OR avg(reputation) > 100;", why: "OR instead of AND" },
		],
		accept: ["SELECT species, count(*) FROM pilots GROUP BY species HAVING avg(reputation) > 100 AND count(*) >= 3;"],
	},
	"ch08-ex07": {
		reject: [
			{ sql: "SELECT ship_id, count(side = 'buy'), count(side = 'sell') FROM trades GROUP BY ship_id;", why: "count counts false too" },
			{ sql: "SELECT ship_id, count(*), count(*) FROM trades WHERE side = 'buy' GROUP BY ship_id;", why: "WHERE removes the sells" },
		],
		accept: [
			"SELECT ship_id, sum(CASE WHEN side = 'buy' THEN 1 ELSE 0 END), sum(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) FROM trades GROUP BY ship_id;",
			"SELECT ship_id, count(CASE WHEN side = 'buy' THEN 1 END) AS b, count(CASE WHEN side = 'sell' THEN 1 END) AS s FROM trades GROUP BY ship_id;",
			"SELECT ship_id, count(*) FILTER (WHERE side <> 'sell'), count(*) FILTER (WHERE side <> 'buy') FROM trades GROUP BY ship_id;",
		],
	},
	"ch08-ex08": {
		reject: [
			{ sql: "SELECT species, string_agg(callsign, ', ') FROM pilots GROUP BY species ORDER BY species;", why: "ORDER BY outside the call does not sort the list" },
			{ sql: "SELECT species, string_agg(callsign, ',' ORDER BY callsign) FROM pilots GROUP BY species;", why: "separator without the space" },
			{ sql: "SELECT species, string_agg(callsign, ', ' ORDER BY callsign COLLATE \"unicode\") FROM pilots GROUP BY species;", why: "dictionary order instead of byte order" },
		],
		accept: [
			"SELECT species, string_agg(callsign, ', ' ORDER BY callsign) FROM pilots WHERE callsign IS NOT NULL GROUP BY species;",
			"SELECT species, array_to_string(array_agg(callsign ORDER BY callsign), ', ') FROM pilots GROUP BY species;",
		],
	},
	"ch08-ex09": {
		reject: [
			{
				sql: "SELECT date_trunc('month', traded_at), count(*), sum(qty * unit_price), max(qty) FROM trades WHERE side = 'sell' GROUP BY 1 HAVING count(*) >= 3 ORDER BY 1;",
				why: "WHERE removes the buys from the counts",
			},
			{
				sql: "SELECT date_trunc('month', traded_at), count(*), sum(qty * unit_price) FILTER (WHERE side = 'sell'), max(qty) FROM trades GROUP BY 1 HAVING count(*) > 3 ORDER BY 1;",
				why: "at least 3 means >= 3",
			},
			{
				sql: "SELECT date_trunc('month', traded_at), count(*), sum(qty * unit_price), max(qty) FROM trades GROUP BY 1 HAVING count(*) >= 3 ORDER BY 1;",
				why: "buys included in the sell value",
			},
			{
				sql: "SELECT date_trunc('month', traded_at), count(*), sum(qty * unit_price) FILTER (WHERE side = 'sell'), max(qty) FROM trades GROUP BY 1 HAVING count(*) >= 3 ORDER BY 1 DESC;",
				why: "newest first",
			},
			{
				sql: "SELECT extract(month from traded_at), count(*), sum(qty * unit_price) FILTER (WHERE side = 'sell'), max(qty) FROM trades GROUP BY 1 HAVING count(*) >= 3 ORDER BY 1;",
				why: "extract(month) merges the months of different years",
			},
		],
		accept: [
			"SELECT date_trunc('month', traded_at)::date AS m, count(*), sum(CASE WHEN side = 'sell' THEN qty * unit_price END), max(qty) FROM trades GROUP BY 1 HAVING count(*) >= 3 ORDER BY m;",
			"SELECT date_trunc('month', traded_at) AS month, count(id), sum(qty * unit_price) FILTER (WHERE side = 'sell' AND unit_price IS NOT NULL), max(qty) FROM trades GROUP BY month HAVING count(*) > 2 ORDER BY month ASC;",
		],
	},
	"ch08-pr02": {
		reject: [{ sql: "SELECT round(sum(hull_integrity) / count(*), 2) FROM ships;", why: "uninspected ships counted as zeros" }],
		accept: ["SELECT round(avg(hull_integrity), 2) FROM ships WHERE hull_integrity IS NOT NULL;"],
	},
	"ch08-pr03": {
		reject: [{ sql: "SELECT count(*), count(*) FROM planets;", why: "count(*) also counts unknown populations" }],
	},
	"ch08-pr04": {
		reject: [{ sql: "SELECT count(model) FROM ships;", why: "counts ships, not models" }],
	},
	"ch08-pr05": {
		reject: [{ sql: "SELECT model, count(model) FROM ships GROUP BY model;", why: "count(model) is 0 for the NULL group" }],
	},
	"ch08-pr06": {
		reject: [{ sql: "SELECT sector, count(*) FROM planets GROUP BY sector HAVING count(*) >= 2;", why: "Outer Rim has only 2" }],
	},
	"ch08-pr07": {
		accept: ["SELECT name, credits / 1000 AS kilo FROM pilots WHERE credits > 20000 ORDER BY 2 DESC, 1;"],
	},
	"ch08-pr08": {
		reject: [{ sql: "SELECT count(legal), count(NOT legal) FROM commodities;", why: "count counts false too" }],
		accept: ["SELECT sum(CASE WHEN legal THEN 1 ELSE 0 END), sum(CASE WHEN legal THEN 0 ELSE 1 END) FROM commodities;"],
	},
	"ch08-pr09": {
		reject: [{ sql: "SELECT category, bool_and(NOT legal) FROM commodities GROUP BY category;", why: "bool_and needs every row" }],
		accept: ["SELECT category, NOT bool_and(legal) FROM commodities GROUP BY category;", "SELECT category, count(*) FILTER (WHERE NOT legal) > 0 FROM commodities GROUP BY category;"],
	},
	"ch08-pr10": {
		reject: [{ sql: "SELECT rank, count(*) FROM pilots GROUP BY rank ORDER BY count(*) DESC;", why: "no tie breaker" }],
		accept: ["SELECT rank, count(*) FROM pilots GROUP BY 1 ORDER BY 2 DESC, 1;"],
	},
};

export default cases;
