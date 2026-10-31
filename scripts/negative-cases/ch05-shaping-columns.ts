// Negative and accept cases for ch05-shaping-columns.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch05-shaping-columns/lesson-8": {
		reject: [{ sql: "SELECT name, (cargo_capacity / 1000)::numeric FROM ships;", why: "cast after the integer division" }],
		accept: [
			"SELECT name, cargo_capacity::numeric / 1000 AS kt FROM ships;",
			"SELECT name, CAST(cargo_capacity AS numeric) / 1000 FROM ships;",
		],
	},
	"ch05-ex01": {
		reject: [
			{ sql: "SELECT id, qty * COALESCE(unit_price, 0) FROM trades;", why: "the unknown value must stay NULL" },
			{ sql: "SELECT id, qty + unit_price FROM trades;", why: "addition instead of multiplication" },
		],
		accept: ["SELECT id, unit_price * qty FROM trades;"],
	},
	"ch05-ex02": {
		reject: [
			{ sql: "SELECT name, round(base_price * 1.15) FROM commodities;", why: "round without digits drops the cents" },
			{ sql: "SELECT name, base_price * 1.15 FROM commodities;", why: "not rounded" },
			{ sql: "SELECT name, round(base_price * 0.15, 2) FROM commodities;", why: "tax only, not the taxed price" },
		],
		accept: [
			"SELECT name, round(base_price + base_price * 0.15, 2) AS price FROM commodities;",
			"SELECT name, round(base_price * 115 / 100, 2) FROM commodities;",
		],
	},
	"ch05-ex03": {
		reject: [
			{ sql: "SELECT name, (reputation / 1000)::numeric FROM pilots;", why: "cast after the integer division" },
			{ sql: "SELECT name, round(reputation / 1000, 2) FROM pilots;", why: "integer division inside round" },
		],
		accept: [
			"SELECT name, reputation::numeric / 1000 FROM pilots;",
			"SELECT name, CAST(reputation AS numeric) / 1000 FROM pilots;",
			"SELECT name, reputation / 1000::numeric AS fame FROM pilots;",
		],
	},
	"ch05-ex04": {
		reject: [
			{ sql: "SELECT 42, 3, 19.9;", why: "casts truncate belief" },
			{ sql: "SELECT 42, 4, 19.9;", why: "round(19.99, 1) is 20.0" },
		],
		accept: ["SELECT CAST('42' AS int), CAST(3.7 AS int), round(CAST('19.99' AS numeric), 1);", "SELECT 42, 4, 20.0;"],
	},
	"ch05-ex05": {
		reject: [
			{
				sql: "SELECT name, CASE WHEN hull_integrity >= 50 THEN 'worn' WHEN hull_integrity >= 90 THEN 'pristine' WHEN hull_integrity IS NULL THEN 'uninspected' ELSE 'critical' END FROM ships;",
				why: "branches in the wrong order",
			},
			{
				sql: "SELECT name, CASE WHEN hull_integrity >= 90 THEN 'pristine' WHEN hull_integrity >= 50 THEN 'worn' WHEN hull_integrity < 50 THEN 'critical' END FROM ships;",
				why: "no branch for NULL: uninspected ships get NULL",
			},
			{
				sql: "SELECT name, CASE WHEN hull_integrity = NULL THEN 'uninspected' WHEN hull_integrity >= 90 THEN 'pristine' WHEN hull_integrity >= 50 THEN 'worn' ELSE 'critical' END FROM ships;",
				why: "= NULL never matches",
			},
		],
		accept: [
			"SELECT name, CASE WHEN hull_integrity >= 90 THEN 'pristine' WHEN hull_integrity >= 50 THEN 'worn' WHEN hull_integrity < 50 THEN 'critical' ELSE 'uninspected' END AS c FROM ships;",
			"SELECT name, CASE WHEN hull_integrity >= 90 THEN 'pristine' WHEN hull_integrity >= 50 THEN 'worn' WHEN hull_integrity IS NULL THEN 'uninspected' ELSE 'critical' END FROM ships;",
		],
	},
	"ch05-ex06": {
		reject: [
			{
				sql: "SELECT name, rank FROM pilots ORDER BY CASE rank WHEN 'cadet' THEN 1 WHEN 'ensign' THEN 2 WHEN 'lieutenant' THEN 3 WHEN 'captain' THEN 4 WHEN 'commander' THEN 5 WHEN 'admiral' THEN 6 END DESC, name;",
				why: "highest rank first",
			},
			{
				sql: "SELECT name, rank FROM pilots ORDER BY CASE rank WHEN 'cadet' THEN 1 WHEN 'ensign' THEN 2 WHEN 'lieutenant' THEN 3 WHEN 'captain' THEN 4 WHEN 'commander' THEN 5 WHEN 'admiral' THEN 6 END;",
				why: "no tie breaker on name",
			},
		],
		accept: [
			"SELECT name, rank FROM pilots ORDER BY CASE WHEN rank = 'cadet' THEN 1 WHEN rank = 'ensign' THEN 2 WHEN rank = 'lieutenant' THEN 3 WHEN rank = 'captain' THEN 4 WHEN rank = 'commander' THEN 5 ELSE 6 END, name;",
			"SELECT name, rank FROM pilots ORDER BY array_position(ARRAY['cadet','ensign','lieutenant','captain','commander','admiral'], rank), name;",
		],
	},
	"ch05-ex07": {
		reject: [
			{ sql: "SELECT name, ceil(1000 / cargo_capacity) FROM ships;", why: "integer division before ceil" },
			{ sql: "SELECT name, round(1000.0 / cargo_capacity) FROM ships;", why: "round instead of rounding up" },
			{ sql: "SELECT name, floor(1000.0 / cargo_capacity) FROM ships;", why: "floor rounds down" },
		],
		accept: [
			"SELECT name, ceiling(1000 / cargo_capacity::numeric) AS trips FROM ships;",
			"SELECT name, ceil(1000 / CAST(cargo_capacity AS numeric)) FROM ships;",
		],
	},
	"ch05-ex08": {
		reject: [
			{
				sql: "SELECT name, CASE WHEN credits = NULL THEN 'frozen' WHEN credits = 0 THEN 'broke' ELSE credits::text END FROM pilots;",
				why: "= NULL never matches, Lumen gets NULL",
			},
			{ sql: "SELECT name, COALESCE(credits::text, 'frozen') FROM pilots;", why: "broke label missing" },
			{
				sql: "SELECT name, CASE WHEN credits IS NULL THEN 'frozen' WHEN credits = 0 THEN 'broke' ELSE credits::int::text END FROM pilots;",
				why: "int cast rounds 12500.50",
			},
		],
		accept: [
			"SELECT name, CASE WHEN credits = 0 THEN 'broke' WHEN credits IS NULL THEN 'frozen' ELSE CAST(credits AS text) END AS label FROM pilots;",
			"SELECT name, COALESCE(CASE WHEN credits = 0 THEN 'broke' ELSE credits::text END, 'frozen') FROM pilots;",
		],
	},
	"ch05-ex09": {
		reject: [
			{
				sql: "SELECT id, qty * unit_price, CASE side WHEN 'sell' THEN 0.08 ELSE 0.03 END, round(qty * unit_price * CASE side WHEN 'sell' THEN 0.08 ELSE 0.03 END, 2), CASE WHEN qty >= 100 THEN 'bulk' ELSE 'retail' END FROM trades;",
				why: "unknown price not counted as 0",
			},
			{
				sql: "SELECT id, qty * COALESCE(unit_price, 0), CASE side WHEN 'sell' THEN 0.08 ELSE 0.03 END, round(qty * COALESCE(unit_price, 0) * CASE side WHEN 'sell' THEN 0.08 ELSE 0.03 END, 2), CASE WHEN qty > 100 THEN 'bulk' ELSE 'retail' END FROM trades;",
				why: "qty of exactly 100 is bulk",
			},
			{
				sql: "SELECT id, qty * COALESCE(unit_price, 0), CASE side WHEN 'sell' THEN 8 ELSE 3 END, round(qty * COALESCE(unit_price, 0) * CASE side WHEN 'sell' THEN 8 ELSE 3 END / 100, 2), CASE WHEN qty >= 100 THEN 'bulk' ELSE 'retail' END FROM trades;",
				why: "rate written as a percentage",
			},
			{
				sql: "SELECT id, qty * COALESCE(unit_price, 0), CASE side WHEN 'buy' THEN 0.08 ELSE 0.03 END, round(qty * COALESCE(unit_price, 0) * CASE side WHEN 'buy' THEN 0.08 ELSE 0.03 END, 2), CASE WHEN qty >= 100 THEN 'bulk' ELSE 'retail' END FROM trades;",
				why: "rates swapped",
			},
		],
		accept: [
			"SELECT id, COALESCE(qty * unit_price, 0) AS v, CASE WHEN side = 'sell' THEN 0.08 WHEN side = 'buy' THEN 0.03 END AS r, round(COALESCE(qty * unit_price, 0) * CASE WHEN side = 'sell' THEN 0.08 ELSE 0.03 END, 2) AS t, CASE WHEN qty < 100 THEN 'retail' ELSE 'bulk' END AS s FROM trades;",
		],
	},
	"ch05-pr02": {
		reject: [{ sql: "SELECT id, qty / 12 FROM trades;", why: "quotient instead of remainder" }],
		accept: ["SELECT id, mod(qty, 12) FROM trades;"],
	},
	"ch05-pr03": {
		reject: [{ sql: "SELECT name, joined_at FROM pilots;", why: "time of day kept" }],
		accept: ["SELECT name, CAST(joined_at AS date) FROM pilots;"],
	},
	"ch05-pr04": {
		reject: [{ sql: "SELECT 3.5, 3.5;", why: "a cast after the division does not rescue it" }],
	},
	"ch05-pr05": {
		accept: ["SELECT name, CASE legal WHEN false THEN 'contraband' ELSE 'legal' END FROM commodities;"],
	},
	"ch05-pr06": {
		reject: [
			{
				sql: "SELECT name, CASE WHEN population IS NULL THEN 'unknown' WHEN population < 1000000 THEN 'outpost' WHEN population < 1000000000 THEN 'colony' ELSE 'metropolis' END FROM planets;",
				why: "Mirage (0) becomes an outpost",
			},
			{
				sql: "SELECT name, CASE WHEN population = 0 THEN 'abandoned' WHEN population < 1000000 THEN 'outpost' WHEN population < 1000000000 THEN 'colony' ELSE 'metropolis' END FROM planets;",
				why: "unknown populations become metropolises",
			},
		],
	},
	"ch05-pr07": {
		accept: ["SELECT name, CASE WHEN reputation < 0 THEN -reputation ELSE reputation END FROM pilots;"],
	},
};

export default cases;
