// Negative and accept cases for ch06-words-and-patterns.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch06-words-and-patterns/lesson-8": {
		reject: [{ sql: "SELECT name, upper(callsign) FROM pilots;", why: "pilots without a callsign kept" }],
		accept: ["SELECT name, UPPER(callsign) AS loud FROM pilots WHERE callsign <> '';"],
	},
	"ch06-ex01": {
		reject: [
			{ sql: "SELECT name, octet_length(name) FROM ships ORDER BY octet_length(name) DESC, name;", why: "bytes instead of characters" },
			{ sql: "SELECT name, length(name) FROM ships ORDER BY length(name), name;", why: "shortest first" },
		],
		accept: ["SELECT name, char_length(name) FROM ships ORDER BY 2 DESC, 1;"],
	},
	"ch06-ex02": {
		reject: [
			{ sql: "SELECT name, concat(name, ' (', callsign, ')') FROM pilots;", why: "prints empty parentheses" },
			{ sql: "SELECT name, COALESCE(name || ' (' || callsign || ')', '') FROM pilots;", why: "empty label instead of the name" },
		],
		accept: [
			"SELECT name, concat(name, ' (' || callsign || ')') FROM pilots;",
			"SELECT name, CASE WHEN callsign IS NULL THEN name ELSE name || ' (' || callsign || ')' END AS label FROM pilots;",
			"SELECT name, COALESCE(name || ' (' || callsign || ')', name) FROM pilots;",
		],
	},
	"ch06-ex03": {
		reject: [
			{ sql: "SELECT name, upper(substring(name from 0 for 3)) FROM commodities;", why: "positions start at 1: only 2 characters" },
			{ sql: "SELECT name, left(name, 3) FROM commodities;", why: "not upper case" },
		],
		accept: [
			"SELECT name, substr(upper(name), 1, 3) FROM commodities;",
			"SELECT name, upper(substring(name from 1 for 3)) AS code FROM commodities;",
		],
	},
	"ch06-ex04": {
		reject: [
			{ sql: "SELECT id, split_part(raw, ';', 0) FROM manifest_lines WHERE raw IS NOT NULL;", why: "split_part counts from 1" },
			{ sql: "SELECT id, split_part(raw, ';', 2) FROM manifest_lines WHERE raw IS NOT NULL;", why: "second piece" },
			{ sql: "SELECT id, split_part(raw, ';', 1) FROM manifest_lines;", why: "NULL line kept" },
			{ sql: "SELECT id, trim(split_part(raw, ';', 1)) FROM manifest_lines WHERE raw IS NOT NULL;", why: "text must stay untouched" },
		],
		accept: ["SELECT id, substring(raw from '^[^;]*') FROM manifest_lines WHERE raw IS NOT NULL;"],
	},
	"ch06-ex05": {
		reject: [{ sql: "SELECT name FROM pilots WHERE name LIKE '%[0-9]%';", why: "LIKE has no character classes in Postgres" }],
		accept: ["SELECT name FROM pilots WHERE name ~ '\\d';", "SELECT name FROM pilots WHERE name SIMILAR TO '%[0-9]%';"],
	},
	"ch06-ex06": {
		reject: [
			{ sql: "SELECT callsign FROM pilots WHERE callsign ~* '^[a-z]+$';", why: "case-insensitive match lets Nova in" },
			{ sql: "SELECT callsign FROM pilots WHERE callsign ~ '^[a-z]+';", why: "only anchored at the start" },
			{ sql: "SELECT callsign FROM pilots WHERE callsign = lower(callsign);", why: "keeps digits and underscores" },
		],
		accept: ["SELECT callsign FROM pilots WHERE callsign !~ '[^a-z]';"],
	},
	"ch06-ex07": {
		reject: [
			{ sql: "SELECT id, substring(raw from '[0-9]')::int FROM manifest_lines;", why: "a single digit" },
			{ sql: "SELECT id, regexp_replace(raw, '[^0-9]', '', 'g')::int FROM manifest_lines;", why: "empty text cannot be cast" },
			{ sql: "SELECT id, substring(raw from '[0-9]+')::int FROM manifest_lines WHERE raw ~ '[0-9]';", why: "lines without numbers dropped" },
		],
		accept: [
			"SELECT id, (regexp_match(raw, '[0-9]+'))[1]::int FROM manifest_lines;",
			"SELECT id, CAST(substring(raw from '\\d+') AS integer) AS qty FROM manifest_lines;",
		],
	},
	"ch06-ex08": {
		reject: [
			{
				sql: "SELECT id, lower(trim(replace(split_part(raw, ';', 1), '-', ' '))) FROM manifest_lines WHERE raw <> '';",
				why: "runs of spaces not collapsed",
			},
			{
				sql: "SELECT id, lower(regexp_replace(replace(split_part(raw, ';', 1), '-', ' '), '\\s+', ' ', 'g')) FROM manifest_lines WHERE raw <> '';",
				why: "not trimmed",
			},
			{
				sql: "SELECT id, lower(trim(regexp_replace(split_part(raw, ';', 1), '\\s+', ' ', 'g'))) FROM manifest_lines WHERE raw <> '';",
				why: "dash kept",
			},
			{
				sql: "SELECT id, trim(regexp_replace(replace(split_part(raw, ';', 1), '-', ' '), '\\s+', ' ', 'g')) FROM manifest_lines WHERE raw <> '';",
				why: "case not normalised",
			},
			{
				sql: "SELECT id, lower(trim(regexp_replace(replace(split_part(raw, ';', 1), '-', ' '), '\\s+', ' ', 'g'))) FROM manifest_lines WHERE raw IS NOT NULL;",
				why: "empty line kept",
			},
		],
		accept: [
			"SELECT id, regexp_replace(trim(lower(regexp_replace(split_part(raw, ';', 1), '[-\\s]+', ' ', 'g'))), '\\s+', ' ', 'g') AS commodity FROM manifest_lines WHERE NULLIF(raw, '') IS NOT NULL;",
		],
	},
	"ch06-ex09": {
		reject: [
			{
				sql: "SELECT id, lower(trim(regexp_replace(replace(split_part(raw, ';', 1), '-', ' '), '\\s+', ' ', 'g'))), substring(raw from '[0-9]+')::int, raw ~ 'fragile' FROM manifest_lines WHERE raw <> '';",
				why: "case-sensitive fragile test",
			},
			{
				sql: "SELECT id, lower(trim(regexp_replace(replace(split_part(raw, ';', 1), '-', ' '), '\\s+', ' ', 'g'))), substring(raw from '[0-9]+')::int, raw ~* 'fragile' FROM manifest_lines;",
				why: "NULL and empty lines kept",
			},
			{
				sql: "SELECT id, lower(trim(split_part(raw, ';', 1))), substring(raw from '[0-9]+')::int, raw ~* 'fragile' FROM manifest_lines WHERE raw <> '';",
				why: "commodity not fully cleaned",
			},
		],
		accept: [
			"SELECT id, lower(trim(regexp_replace(replace(split_part(raw, ';', 1), '-', ' '), '\\s+', ' ', 'g'))), substring(split_part(raw, ';', 2) from '[0-9]+')::int, raw ILIKE '%fragile%' FROM manifest_lines WHERE NULLIF(raw, '') IS NOT NULL;",
		],
	},
	"ch06-pr02": {
		reject: [{ sql: "SELECT concat(name, ' / ', model) FROM ships;", why: "dangling separator for the Ghost Ship" }],
		accept: ["SELECT name || COALESCE(' / ' || model, '') FROM ships;"],
	},
	"ch06-pr03": {
		accept: ["SELECT name, strpos(name, ' ') FROM planets WHERE name LIKE '% %';"],
	},
	"ch06-pr04": {
		reject: [{ sql: "SELECT callsign FROM pilots WHERE callsign ~ '[a-z]';", why: "not anchored at the start" }],
		accept: ["SELECT callsign FROM pilots WHERE left(callsign, 1) BETWEEN 'a' AND 'z';"],
	},
	"ch06-pr05": {
		reject: [{ sql: "SELECT id, raw FROM manifest_lines WHERE raw ~ 'plasma';", why: "case sensitive" }],
		accept: ["SELECT id, raw FROM manifest_lines WHERE raw ILIKE '%plasma%';"],
	},
	"ch06-pr06": {
		reject: [{ sql: "SELECT id FROM manifest_lines WHERE raw !~ ';\\s*[0-9]';", why: "NULL line lost" }],
		accept: ["SELECT id FROM manifest_lines WHERE COALESCE(raw, '') !~ ';\\s*[0-9]';"],
	},
	"ch06-pr07": {
		reject: [{ sql: "SELECT id, trim(raw) FROM manifest_lines;", why: "empty text kept" }],
		accept: ["SELECT id, CASE WHEN trim(raw) = '' THEN NULL ELSE trim(raw) END FROM manifest_lines;"],
	},
	"ch06-pr08": {
		accept: ["SELECT name, replace(lower(name), ' ', '-') FROM ships;"],
	},
};

export default cases;
