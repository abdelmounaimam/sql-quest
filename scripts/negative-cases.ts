/**
 * Validator-only answer bank (never shipped to the app).
 *
 * Key: an exercise id ("ch03-ex02") or a lesson try step ("ch01-hello-table/lesson-7").
 * - reject: classic wrong answers that the check MUST refuse (misconceptions).
 * - accept: other correct formulations that the check MUST accept (fairness:
 *   different aliases, equivalent predicates, other valid syntax).
 *
 * `pnpm validate:content` judges each one with the app's comparison rules.
 */
import type { CaseSet } from "./validate-content";

const cases: Record<string, CaseSet> = {
	// ---------------------------------------------------------------- ch01
	"ch01-hello-table/lesson-7": {
		reject: [{ sql: "SELECT species, name FROM pilots;", why: "columns swapped" }],
		accept: ["select NAME, Species from PILOTS"],
	},
	"ch01-ex01": {
		reject: [{ sql: "SELECT name FROM factions;", why: "only one column" }],
		accept: ["SELECT id, name, motto, founded_year, homeworld_id FROM factions;"],
	},
	"ch01-ex02": {
		reject: [
			{ sql: "SELECT callsign, name FROM pilots;", why: "columns in the wrong order" },
			{ sql: "SELECT name callsign FROM pilots;", why: "missing comma turns callsign into an alias" },
		],
		accept: ["SELECT name AS pilot, callsign AS radio FROM pilots"],
	},
	"ch01-ex03": {
		reject: [{ sql: "SELECT name model FROM ships;", why: "missing comma: one aliased column" }],
		accept: ["select name, model from ships -- fixed"],
	},
	"ch01-ex04": {
		reject: [
			{ sql: 'SELECT name AS "Item", base_price AS "Price" FROM commodities;', why: "capitalised titles" },
			{ sql: "SELECT name AS price, base_price AS item FROM commodities;", why: "aliases swapped" },
		],
		accept: ["SELECT name item, base_price price FROM commodities;"],
	},
	"ch01-ex05": {
		reject: [{ sql: "SELECT name AS Planet, population AS head_count FROM planets;", why: "unquoted aliases fold to lower case" }],
	},
	"ch01-ex06": {
		reject: [{ sql: "SELECT name, 'Cleared' FROM ships;", why: "wrong text value" }],
		accept: ["SELECT name, 'cleared' FROM ships;", "SELECT name, 'cleared' AS \"Status\" FROM ships;"],
	},
	"ch01-ex07": {
		reject: [{ sql: "SELECT DISTINCT model FROM ships;", why: "removes the duplicates the prompt asks to keep" }],
	},
	"ch01-ex08": {
		reject: [
			{ sql: "SELECT name AS Ship, model AS Model, cargo_capacity AS Hold, 'Bay 7' AS Dock FROM ships;", why: "unquoted titles are lower case" },
			{ sql: 'SELECT name AS "Ship", model AS "Model", cargo_capacity AS "Hold", \'Bay7\' AS "Dock" FROM ships;', why: "wrong value" },
		],
		accept: ['SELECT name "Ship", model "Model", cargo_capacity "Hold", \'Bay 7\' "Dock" FROM ships'],
	},
	"ch01-pr02": {
		accept: ["SELECT name, motto AS faction_motto FROM factions;"],
	},
	"ch01-pr06": {
		reject: [{ sql: "SELECT name, 'Captains log' FROM pilots;", why: "apostrophe dropped" }],
		accept: ["SELECT name, E'Captain\\'s log' FROM pilots;"],
	},
	// ---------------------------------------------------------------- ch02
	"ch02-ex01": {
		reject: [{ sql: "SELECT name, cargo_capacity FROM ships WHERE cargo_capacity > 500;", why: "strict > drops the 500s" }],
		accept: ["SELECT name, cargo_capacity FROM ships WHERE 500 <= cargo_capacity"],
	},
	"ch02-ex02": {
		reject: [{ sql: "SELECT name FROM pilots WHERE rank = 'Captain';", why: "text comparison is case sensitive" }],
	},
	"ch02-ex04": {
		reject: [{ sql: "SELECT name FROM pilots WHERE rank = 'captain' OR species = 'Human';", why: "OR instead of AND" }],
	},
	"ch02-ex05": {
		accept: ["SELECT name FROM pilots WHERE species IN ('Synth', 'Vulpine') AND reputation > 0;"],
		reject: [{ sql: "SELECT name FROM pilots WHERE species = 'Synth' OR (species = 'Vulpine' AND reputation > 0);", why: "precedence unchanged" }],
	},
	"ch02-ex06": {
		reject: [{ sql: "SELECT name, category FROM commodities WHERE category IN ('fuel, tech');", why: "one string instead of two values" }],
		accept: ["SELECT name, category FROM commodities WHERE category = 'fuel' OR category = 'tech';"],
	},
	"ch02-ex07": {
		reject: [
			{ sql: "SELECT id, qty FROM trades WHERE qty > 20 AND qty < 50;", why: "bounds excluded" },
			{ sql: "SELECT id, qty FROM trades WHERE qty BETWEEN 50 AND 20;", why: "reversed bounds" },
		],
		accept: ["SELECT id, qty FROM trades WHERE qty >= 20 AND qty <= 50;"],
	},
	"ch02-ex08": {
		reject: [{ sql: "SELECT name FROM ships WHERE name LIKE 'L';", why: "no wildcard: behaves like =" }],
	},
	"ch02-ex09": {
		reject: [
			{ sql: "SELECT name, model, hull_integrity FROM ships WHERE (model IN ('Viper X', 'Gambit 3', 'Hauler 9') OR name LIKE '%''%') AND hull_integrity BETWEEN 10 AND 60;", why: "hull test applied to rule 2" },
			{ sql: "SELECT name, model, hull_integrity FROM ships WHERE model IN ('Viper X', 'Gambit 3', 'Hauler 9') AND hull_integrity BETWEEN 10 AND 60;", why: "rule 2 forgotten" },
		],
		accept: ["SELECT name, model, hull_integrity FROM ships WHERE name LIKE '%''%' OR model IN ('Viper X', 'Gambit 3', 'Hauler 9') AND hull_integrity >= 10 AND hull_integrity <= 60;"],
	},
	"ch02-pr02": {
		accept: ["SELECT name, rank FROM pilots WHERE NOT rank = 'cadet';", "SELECT name, rank FROM pilots WHERE rank != 'cadet';"],
	},
	"ch02-pr04": {
		accept: ["SELECT name FROM commodities WHERE legal = true AND unit <> 'crate';"],
		reject: [{ sql: "SELECT name FROM commodities WHERE NOT legal AND unit <> 'crate';", why: "NOT on the wrong condition" }],
	},
	"ch02-pr06": {
		reject: [{ sql: "SELECT callsign FROM pilots WHERE callsign LIKE '%____%';", why: "at least 4, not exactly 4" }],
	},
	"ch02-pr07": {
		accept: ["SELECT name, callsign FROM pilots WHERE callsign LIKE '%#_%' ESCAPE '#';"],
	},
	"ch02-pr08": {
		reject: [{ sql: "SELECT callsign FROM pilots WHERE callsign LIKE '%z%';", why: "LIKE is case sensitive: misses Zed" }],
		accept: ["SELECT callsign FROM pilots WHERE callsign LIKE '%z%' OR callsign LIKE '%Z%';"],
	},

	// ---------------------------------------------------------------- ch03
	"ch03-ex02": {
		reject: [{ sql: "SELECT name, population FROM planets WHERE population > 0;", why: "zero is a known value" }],
	},
	"ch03-ex03": {
		reject: [{ sql: "SELECT name FROM planets WHERE population = 0;", why: "forgets unknown populations" }],
		accept: ["SELECT name FROM planets WHERE COALESCE(population, 0) = 0;"],
	},
	"ch03-ex04": {
		reject: [{ sql: "SELECT name FROM pilots WHERE NOT faction_id = 2;", why: "NOT does not rescue NULLs" }],
		accept: ["SELECT name FROM pilots WHERE faction_id IS DISTINCT FROM 2;"],
	},
	"ch03-ex05": {
		reject: [{ sql: "SELECT name, category FROM commodities WHERE category <> 'food';", why: "drops the NULL category" }],
		accept: ["SELECT name, category FROM commodities WHERE category <> 'food' OR category IS NULL;"],
	},
	"ch03-ex06": {
		reject: [{ sql: "SELECT name, COALESCE(callsign, '') FROM pilots;", why: "wrong placeholder" }],
		accept: ["SELECT name, COALESCE(callsign, 'no callsign') AS radio FROM pilots;"],
	},
	"ch03-ex07": {
		reject: [{ sql: "SELECT name, credits FROM pilots;", why: "NULL left as is" }],
	},
	"ch03-ex08": {
		reject: [{ sql: "SELECT id, raw FROM manifest_lines;", why: "empty text left as is" }],
		accept: ["SELECT id, CASE WHEN raw = '' THEN NULL ELSE raw END FROM manifest_lines;"],
	},
	"ch03-ex09": {
		reject: [
			{ sql: "SELECT name, COALESCE(model, 'unregistered'), hull_integrity FROM ships WHERE (hull_integrity < 50 OR hull_integrity IS NULL) AND pilot_id <> 9;", why: "<> drops pilotless ships" },
			{ sql: "SELECT name, COALESCE(model, 'unregistered'), hull_integrity FROM ships WHERE hull_integrity < 50 AND pilot_id IS DISTINCT FROM 9;", why: "forgets uninspected hulls" },
			{ sql: "SELECT name, model, hull_integrity FROM ships WHERE (hull_integrity < 50 OR hull_integrity IS NULL) AND pilot_id IS DISTINCT FROM 9;", why: "model not labelled" },
		],
		accept: ["SELECT name, COALESCE(model, 'unregistered'), hull_integrity FROM ships WHERE (hull_integrity < 50 OR hull_integrity IS NULL) AND (pilot_id <> 9 OR pilot_id IS NULL);"],
	},
	"ch03-pr05": {
		reject: [{ sql: "SELECT name FROM pilots WHERE home_planet_id <> 1;", why: "drops Lumen" }],
	},

	// ---------------------------------------------------------------- ch04
	"ch04-ex01": {
		reject: [{ sql: "SELECT name FROM planets ORDER BY name DESC;", why: "reversed" }],
	},
	"ch04-ex02": {
		reject: [{ sql: "SELECT name, credits FROM pilots ORDER BY credits DESC, name;", why: "NULL credits sort first in DESC" }],
		accept: ["SELECT name AS pilot, credits FROM pilots ORDER BY 2 DESC NULLS LAST, 1;"],
	},
	"ch04-ex04": {
		reject: [
			{ sql: "SELECT name FROM ships ORDER BY name LIMIT 5 OFFSET 10;", why: "page 3" },
			{ sql: "SELECT name FROM ships ORDER BY name LIMIT 5 OFFSET 4;", why: "off by one" },
		],
		accept: ["SELECT name FROM ships ORDER BY name OFFSET 5 ROWS FETCH NEXT 5 ROWS ONLY;"],
	},
	"ch04-ex06": {
		reject: [{ sql: "SELECT DISTINCT species FROM pilots;", why: "one column only" }],
		accept: ["SELECT DISTINCT species, rank FROM pilots ORDER BY 1;", "SELECT species, rank FROM pilots GROUP BY species, rank;"],
	},
	"ch04-ex07": {
		accept: [
			"SELECT name, cargo_capacity FROM ships WHERE cargo_capacity IS NOT NULL ORDER BY cargo_capacity DESC FETCH FIRST 2 ROWS WITH TIES;",
		],
		reject: [{ sql: "SELECT name, cargo_capacity FROM ships ORDER BY cargo_capacity DESC FETCH FIRST 2 ROWS WITH TIES;", why: "NULL capacity sorts first" }],
	},
	"ch04-ex08": {
		reject: [{ sql: "SELECT callsign FROM pilots WHERE callsign IS NOT NULL ORDER BY lower(callsign);", why: "lower() still puts É after z" }],
	},
	"ch04-ex09": {
		reject: [
			{ sql: "SELECT name, callsign, credits FROM pilots WHERE callsign IS NOT NULL ORDER BY credits DESC, name LIMIT 5 OFFSET 15;", why: "panel 4" },
			{ sql: "SELECT name, callsign, credits FROM pilots WHERE callsign <> NULL ORDER BY credits DESC, name LIMIT 5 OFFSET 10;", why: "<> NULL is never true" },
			{ sql: "SELECT name, callsign, credits FROM pilots ORDER BY credits DESC, name LIMIT 5 OFFSET 10;", why: "callsign filter missing" },
		],
		accept: ["SELECT name, callsign, credits FROM pilots WHERE callsign IS NOT NULL ORDER BY credits DESC, name OFFSET 10 FETCH FIRST 5 ROWS ONLY;"],
	},
	"ch04-pr05": {
		reject: [{ sql: "SELECT DISTINCT hazard FROM routes;", why: "keeps the NULL" }],
	},
	"ch04-pr06": {
		reject: [{ sql: "SELECT DISTINCT category FROM commodities WHERE category IS NOT NULL;", why: "the NULL row is required" }],
	},
};

export default cases;
