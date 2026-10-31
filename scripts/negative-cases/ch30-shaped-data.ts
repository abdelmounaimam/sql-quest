import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch30-shaped-data/lesson-9": {
		reject: [{ sql: "SELECT name, tags[2] FROM heroes;", why: "second tag" }],
		accept: ["SELECT name, tags[1] AS first_tag FROM heroes ORDER BY name"],
	},
	"ch30-ex01": {
		reject: [
			{ sql: "SELECT name, rarity FROM items WHERE rarity::text > 'uncommon';", why: "alphabetical comparison" },
			{ sql: "SELECT name, rarity FROM items WHERE rarity >= 'uncommon';", why: "includes uncommon" },
		],
		accept: [
			"SELECT name, rarity FROM items WHERE rarity IN ('rare', 'epic', 'legendary');",
			"SELECT name, rarity FROM items WHERE rarity >= 'rare';",
		],
	},
	"ch30-ex02": {
		reject: [
			{ sql: "SELECT class, count(*) FROM heroes GROUP BY class ORDER BY class::text;", why: "alphabetical order" },
			{ sql: "SELECT class, count(*) FROM heroes GROUP BY class ORDER BY class DESC;", why: "reversed" },
		],
		accept: ["SELECT class, count(id) AS n FROM heroes GROUP BY 1 ORDER BY 1;"],
	},
	"ch30-ex03": {
		reject: [
			{ sql: "ALTER TABLE heroes ADD CONSTRAINT gold_ok CHECK (gold >= 0);", why: "a table CHECK, not a domain" },
			{
				sql: "CREATE DOMAIN gold_amount AS numeric(10,2) CHECK (VALUE > 0); ALTER TABLE heroes ALTER COLUMN gold TYPE gold_amount;",
				why: "refuses zero gold (and fails on Grimsby)",
			},
			{
				sql: "CREATE DOMAIN gold_amount AS numeric(10,2) NOT NULL CHECK (VALUE >= 0); ALTER TABLE heroes ALTER COLUMN gold TYPE gold_amount;",
				why: "forbids NULL gold",
			},
			{ sql: "CREATE DOMAIN gold_amount AS numeric(10,2) CHECK (VALUE >= 0);", why: "column not converted" },
		],
		accept: [
			"CREATE DOMAIN gold_amount numeric(10,2) CONSTRAINT not_negative CHECK (VALUE >= 0); ALTER TABLE heroes ALTER gold SET DATA TYPE gold_amount;",
			"CREATE DOMAIN gold_amount AS numeric(10,2) CHECK (NOT VALUE < 0); ALTER TABLE heroes ALTER COLUMN gold TYPE gold_amount USING gold::gold_amount;",
		],
	},
	"ch30-ex04": {
		reject: [
			{ sql: "SELECT name, (stats).str, (stats).dex, (stats).wis FROM heroes WHERE (stats).wis >= 15 ORDER BY stats DESC, name;", why: "sorts on str first" },
			{ sql: "SELECT name, (stats).str, (stats).dex, (stats).wis FROM heroes WHERE (stats).wis > 15 ORDER BY (stats).wis DESC, name;", why: "15 excluded" },
		],
		accept: ["SELECT name, (stats).* FROM heroes WHERE (stats).wis >= 15 ORDER BY 4 DESC, 1;", "SELECT h.name, (h.stats).str, (h.stats).dex, (h.stats).wis FROM heroes h WHERE (h.stats).wis >= 15 ORDER BY (h.stats).wis DESC, h.name;"],
	},
	"ch30-ex05": {
		reject: [{ sql: "SELECT name, (stats).dex FROM heroes WHERE stats IS NOT NULL;", why: "drops Bors" }],
		accept: ["SELECT h.name, (h.stats).dex AS dex FROM heroes AS h;"],
	},
	"ch30-ex06": {
		reject: [
			{ sql: "SELECT name FROM heroes WHERE 'scout' = ANY(tags);", why: "scouts only" },
		],
		accept: [
			"SELECT name FROM heroes WHERE 'scout' = ANY(tags) AND 'archer' = ANY(tags);",
			"SELECT name FROM heroes WHERE tags @> ARRAY['archer', 'scout'];",
			"SELECT name FROM heroes WHERE '{scout,archer}' <@ tags;",
		],
	},
	"ch30-ex07": {
		reject: [
			{ sql: "SELECT name FROM heroes WHERE tags = '{}';", why: "misses NULL tags" },
			{ sql: "SELECT name FROM heroes WHERE tags IS NULL;", why: "misses empty arrays" },
			{ sql: "SELECT name FROM heroes WHERE cardinality(tags) = 0;", why: "cardinality(NULL) is NULL" },
		],
		accept: [
			"SELECT name FROM heroes WHERE coalesce(cardinality(tags), 0) = 0;",
			"SELECT name FROM heroes WHERE array_length(tags, 1) IS NULL;",
		],
	},
	"ch30-ex08": {
		reject: [
			{ sql: "SELECT t, count(*) FROM heroes, unnest(tags) t GROUP BY t ORDER BY 2 DESC;", why: "no tie breaker" },
			{ sql: "SELECT t, count(*) FROM heroes, unnest(tags) t GROUP BY t ORDER BY 2, 1;", why: "least common first" },
		],
		accept: ["SELECT tag, count(*) FROM (SELECT unnest(tags) AS tag FROM heroes) x GROUP BY 1 ORDER BY 2 DESC, 1;"],
	},
	"ch30-ex09": {
		reject: [
			{
				sql: "SELECT h.class, count(*), round(avg((h.stats).dex), 1), array_agg(DISTINCT t ORDER BY t) FROM heroes h, unnest(h.tags) t GROUP BY h.class ORDER BY h.class;",
				why: "fan-out: counts tags, averages per tag",
			},
			{
				sql: "SELECT h.class, count(*), avg((h.stats).dex), (SELECT array_agg(DISTINCT t ORDER BY t) FROM heroes h2, unnest(h2.tags) t WHERE h2.class = h.class) FROM heroes h GROUP BY h.class ORDER BY h.class;",
				why: "average not rounded",
			},
			{
				sql: "SELECT h.class, count(*), round(avg((h.stats).dex), 1), (SELECT array_agg(DISTINCT t ORDER BY t) FROM heroes h2, unnest(h2.tags) t WHERE h2.class = h.class) FROM heroes h GROUP BY h.class ORDER BY h.class::text;",
				why: "alphabetical class order",
			},
		],
		accept: [
			"WITH c AS (SELECT class, count(*) AS n, round(avg((stats).dex), 1) AS d FROM heroes GROUP BY class), t AS (SELECT class, array_agg(DISTINCT tag ORDER BY tag) AS tags FROM heroes, unnest(tags) tag GROUP BY class) SELECT c.class, c.n, c.d, t.tags FROM c LEFT JOIN t USING (class) ORDER BY c.class;",
			"SELECT h.class, count(*), round(avg((h.stats).dex), 1), x.tags FROM heroes h LEFT JOIN LATERAL (SELECT array_agg(DISTINCT t ORDER BY t) AS tags FROM heroes h2, unnest(h2.tags) t WHERE h2.class = h.class) x ON true GROUP BY h.class, x.tags ORDER BY h.class;",
		],
	},
	"ch30-pr01": {
		reject: [{ sql: "SELECT name FROM items WHERE rarity::text BETWEEN 'epic' AND 'uncommon';", why: "alphabetical range" }],
	},
	"ch30-pr07": {
		accept: ["SELECT h.name FROM heroes h JOIN heroes a ON a.id = 1 WHERE h.tags && a.tags AND h.id <> a.id;"],
	},
	"ch30-pr08": {
		reject: [{ sql: "SELECT name, array_length(tags, 1) FROM heroes;", why: "NULL for empty and NULL arrays" }],
	},
};

export default cases;
