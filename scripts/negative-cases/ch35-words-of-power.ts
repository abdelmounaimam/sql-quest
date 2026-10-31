import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch35-words-of-power/lesson-9": {
		reject: [
			{
				sql: "SELECT id, title FROM scrolls WHERE to_tsvector('english', body) @@ to_tsquery('english', 'kraken');",
				why: "forgets the English-only filter (the French kraken sneaks in)",
			},
		],
		accept: [
			"SELECT id, title FROM scrolls WHERE language = 'en' AND to_tsvector('english', body) @@ plainto_tsquery('english', 'Kraken')",
		],
	},
	"ch35-ex01": {
		reject: [
			{
				sql: "SELECT id, title FROM scrolls WHERE language = 'en' AND to_tsvector('english', body) @@ to_tsquery('english', 'dragon | fire');",
				why: "OR instead of AND",
			},
		],
		accept: [
			"SELECT s.id, s.title FROM scrolls s WHERE s.language = 'en' AND to_tsvector('english', s.body) @@ plainto_tsquery('english', 'dragon fire')",
			"SELECT id, title FROM scrolls WHERE language = 'en' AND to_tsvector('english', body) @@ websearch_to_tsquery('english', 'dragons fire')",
		],
	},
	"ch35-ex02": {
		reject: [
			{
				sql: "SELECT id, title FROM scrolls WHERE language = 'en' AND body ~* 'war';",
				why: "a regex is still a substring match (warden)",
			},
		],
		accept: [
			"SELECT id, title FROM scrolls WHERE language = 'en' AND to_tsvector('english', body) @@ plainto_tsquery('english', 'wars')",
		],
	},
	"ch35-ex03": {
		reject: [
			{
				sql: "SELECT id, title FROM scrolls WHERE language = 'fr' AND to_tsvector('english', unaccent(body)) @@ to_tsquery('english', 'reveiller');",
				why: "english config does not stem French verbs",
			},
			{
				sql: "SELECT id, title FROM scrolls WHERE language = 'fr' AND to_tsvector('french', unaccent(body)) @@ to_tsquery('french', 'réveil') AND id = 30;",
				why: "only one of the two scrolls",
			},
		],
		accept: [
			"SELECT id, title FROM scrolls WHERE language = 'fr' AND to_tsvector('french', unaccent(body)) @@ plainto_tsquery('french', unaccent('reveiller'))",
		],
	},
	"ch35-ex04": {
		reject: [
			{
				sql: "SELECT title, round(ts_rank(to_tsvector('english', body), q)::numeric, 4) AS rank FROM scrolls, websearch_to_tsquery('english', 'dragon fire') q WHERE language = 'en' ORDER BY rank DESC, title;",
				why: "ranks without the @@ filter: zero-rank rows",
			},
			{
				sql: "SELECT title, round(ts_rank(to_tsvector('english', body), q)::numeric, 4) AS rank FROM scrolls, websearch_to_tsquery('english', 'dragon fire') q WHERE language = 'en' AND to_tsvector('english', body) @@ q ORDER BY rank;",
				why: "lowest rank first",
			},
		],
		accept: [
			"WITH q AS (SELECT websearch_to_tsquery('english', 'dragon fire') AS q) SELECT s.title AS t, round(ts_rank(to_tsvector('english', s.body), q.q)::numeric, 4) FROM scrolls s, q WHERE s.language = 'en' AND to_tsvector('english', s.body) @@ q.q ORDER BY ts_rank(to_tsvector('english', s.body), q.q) DESC",
		],
	},
	"ch35-ex05": {
		reject: [
			{
				sql: "SELECT title, ts_headline('english', body, q) FROM scrolls, to_tsquery('english', 'kraken') q WHERE language = 'en' AND to_tsvector('english', body) @@ q;",
				why: "default <b> markers instead of brackets",
			},
		],
		accept: [
			"SELECT s.title, ts_headline('english', s.body, to_tsquery('english', 'kraken'), 'StartSel=[, StopSel=]') AS h FROM scrolls s WHERE s.language = 'en' AND to_tsvector('english', s.body) @@ to_tsquery('english', 'kraken')",
		],
	},
	"ch35-ex06": {
		reject: [
			{
				sql: "ALTER TABLE scrolls ADD COLUMN search tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', body), 'B')) STORED;",
				why: "no GIN index",
			},
			{
				sql: "ALTER TABLE scrolls ADD COLUMN search tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED; CREATE INDEX ON scrolls USING gin (search);",
				why: "no weights: titles count like bodies",
			},
			{
				sql: "ALTER TABLE scrolls ADD COLUMN search tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', body), 'B')); CREATE INDEX ON scrolls USING gin (search);",
				why: "virtual generated column cannot be indexed",
			},
		],
		accept: [
			"ALTER TABLE scrolls ADD COLUMN search tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english'::regconfig, title), 'A') || setweight(to_tsvector('english'::regconfig, body), 'B')) STORED; CREATE INDEX idx_scrolls_search ON scrolls USING GIN (search);",
		],
	},
	"ch35-ex07": {
		reject: [
			{
				sql: "SELECT name, round(similarity(name, 'Isolde Maro')::numeric, 3) FROM readers WHERE name LIKE 'Isolde%';",
				why: "prefix match misses Ysolde",
			},
			{
				sql: "SELECT name, round(similarity(name, 'Isolde Maro')::numeric, 3) AS s FROM readers WHERE similarity(name, 'Isolde Maro') > 0.3 ORDER BY s;",
				why: "least similar first",
			},
		],
		accept: [
			"SELECT name, round(similarity('Isolde Maro', name)::numeric, 3) FROM readers WHERE similarity(name, 'Isolde Maro') > 0.3 ORDER BY name <-> 'Isolde Maro'",
		],
	},
	"ch35-ex08": {
		reject: [
			{
				sql: "SELECT name FROM readers WHERE split_part(name, ' ', 1) IN ('Steven', 'Catherine');",
				why: "exact spelling finds nobody",
			},
			{
				sql: "SELECT name FROM readers WHERE soundex(split_part(name, ' ', 1)) = soundex('Steven') OR soundex(split_part(name, ' ', 1)) = soundex('Catherine');",
				why: "soundex keeps the first letter: C never matches K",
			},
		],
		accept: [
			"SELECT r.name FROM readers r WHERE difference(split_part(r.name, ' ', 1), 'Steven') = 4 OR levenshtein(lower(split_part(r.name, ' ', 1)), 'catherine') < 3",
		],
	},
	"ch35-ex09": {
		reject: [
			{
				sql: "SELECT id, title, language, round(ts_rank(to_tsvector(c, body), websearch_to_tsquery(c, 'dragons'))::numeric, 4) AS rank FROM (SELECT *, (CASE language WHEN 'fr' THEN 'french' ELSE 'english' END)::regconfig AS c FROM scrolls) s WHERE to_tsvector(c, body) @@ websearch_to_tsquery(c, 'dragons') OR similarity(author, 'Ellowen Thrise') > 0.4 ORDER BY rank DESC, id;",
				why: "body only: no title weight",
			},
			{
				sql: "WITH d AS (SELECT s.*, setweight(to_tsvector(c, title), 'A') || setweight(to_tsvector(c, body), 'B') AS doc, websearch_to_tsquery(c, 'dragons') AS q FROM (SELECT *, (CASE language WHEN 'fr' THEN 'french' ELSE 'english' END)::regconfig AS c FROM scrolls) s) SELECT id, title, language, round(ts_rank(doc, q)::numeric, 4) AS rank FROM d WHERE doc @@ q ORDER BY rank DESC, id;",
				why: "forgets the author typo branch",
			},
		],
		accept: [
			"WITH en AS (SELECT id, title, language, author, setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', body), 'B') AS doc, websearch_to_tsquery('english', 'dragons') AS q FROM scrolls WHERE language = 'en'), fr AS (SELECT id, title, language, author, setweight(to_tsvector('french', title), 'A') || setweight(to_tsvector('french', body), 'B') AS doc, websearch_to_tsquery('french', 'dragons') AS q FROM scrolls WHERE language = 'fr'), allx AS (SELECT * FROM en UNION ALL SELECT * FROM fr) SELECT id, title, language, round((CASE WHEN doc @@ q THEN ts_rank(doc, q) ELSE 0 END)::numeric, 4) AS r FROM allx WHERE doc @@ q OR similarity(author, 'Ellowen Thrise') > 0.4 ORDER BY r DESC, id",
		],
	},
	"ch35-pr02": {
		reject: [
			{
				sql: "SELECT id, title FROM scrolls WHERE language = 'en' AND to_tsvector('simple', body) @@ to_tsquery('simple', 'burn');",
				why: "simple config does not stem",
			},
		],
	},
	"ch35-pr05": {
		accept: ["CREATE INDEX ON scrolls USING GIN (to_tsvector('english'::regconfig, body))"],
		reject: [
			{
				sql: "CREATE INDEX ON scrolls USING gin (to_tsvector('simple', body));",
				why: "index config differs from the query config",
			},
		],
	},
	"ch35-pr08": {
		reject: [
			{
				sql: "SELECT name FROM readers WHERE split_part(name, ' ', 1) = 'Isolde';",
				why: "exact match misses the twin",
			},
		],
	},
};

export default cases;
