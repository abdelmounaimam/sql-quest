import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch36-vector-constellations/lesson-9": {
		reject: [
			{
				sql: "SELECT t.title FROM tracks t, query_vectors q WHERE q.label = 'dragon fight' ORDER BY t.embedding <#> q.embedding LIMIT 1;",
				why: "inner product instead of cosine",
			},
		],
		accept: [
			"SELECT title FROM tracks ORDER BY embedding <=> (SELECT embedding FROM query_vectors WHERE label = 'dragon fight') LIMIT 1",
		],
	},
	"ch36-ex01": {
		reject: [
			{
				sql: "SELECT t.title, round((t.embedding <=> q.embedding)::numeric, 4) FROM tracks t, query_vectors q WHERE q.label = 'tavern brawl' AND t.album_id = 1;",
				why: "cosine distance instead of Euclidean",
			},
		],
		accept: [
			"SELECT title, round(l2_distance(embedding, (SELECT embedding FROM query_vectors WHERE label = 'tavern brawl'))::numeric, 4) AS d FROM tracks WHERE album_id = 1",
		],
	},
	"ch36-ex02": {
		reject: [
			{
				sql: "SELECT title, round(('[1,1,1,1]'::vector <=> embedding)::numeric, 4) FROM tracks WHERE genre = 'metal';",
				why: "cosine instead of Euclidean",
			},
		],
		accept: [
			"SELECT title, round(l2_distance(embedding, '[1,1,1,1]')::numeric, 4) FROM tracks WHERE genre = 'metal'",
		],
	},
	"ch36-ex03": {
		reject: [
			{
				sql: "SELECT t.title FROM tracks t, query_vectors q WHERE q.label = 'goblin rave' ORDER BY t.embedding <=> q.embedding DESC LIMIT 5;",
				why: "DESC returns the farthest tracks",
			},
			{
				sql: "SELECT t.title FROM tracks t, query_vectors q WHERE q.label = 'goblin rave' ORDER BY t.embedding <#> q.embedding LIMIT 5;",
				why: "inner product ranks by length too",
			},
		],
		accept: [
			"SELECT title FROM tracks ORDER BY embedding <=> (SELECT embedding FROM query_vectors WHERE label = 'goblin rave') LIMIT 5",
			"SELECT t.title FROM tracks t JOIN query_vectors q ON q.label = 'goblin rave' ORDER BY cosine_distance(t.embedding, q.embedding) FETCH FIRST 5 ROWS ONLY",
		],
	},
	"ch36-ex04": {
		reject: [
			{
				sql: "SELECT title, sim FROM (SELECT t.title, t.explicit, round((1 - (t.embedding <=> q.embedding))::numeric, 4) AS sim FROM tracks t, query_vectors q WHERE q.label = 'goblin rave' ORDER BY t.embedding <=> q.embedding LIMIT 5) x WHERE NOT explicit ORDER BY sim DESC;",
				why: "filters after the LIMIT: only 3 rows",
			},
			{
				sql: "SELECT t.title, round((t.embedding <=> q.embedding)::numeric, 4) FROM tracks t, query_vectors q WHERE q.label = 'goblin rave' AND NOT t.explicit ORDER BY t.embedding <=> q.embedding LIMIT 5;",
				why: "distance instead of similarity",
			},
		],
		accept: [
			"SELECT t.title, round((1 - cosine_distance(t.embedding, q.embedding))::numeric, 4) AS similarity FROM tracks t JOIN query_vectors q ON q.label = 'goblin rave' WHERE t.explicit = false ORDER BY similarity DESC LIMIT 5",
		],
	},
	"ch36-ex05": {
		reject: [
			{
				sql: "SELECT q.label, t.title FROM query_vectors q, tracks t ORDER BY t.embedding <-> q.embedding LIMIT 6;",
				why: "global LIMIT, not one per label",
			},
		],
		accept: [
			"SELECT DISTINCT ON (q.label) q.label, t.title FROM query_vectors q CROSS JOIN tracks t ORDER BY q.label, t.embedding <-> q.embedding",
			"SELECT q.label, x.title FROM query_vectors q LEFT JOIN LATERAL (SELECT title FROM tracks ORDER BY embedding <-> q.embedding LIMIT 1) x ON true",
		],
	},
	"ch36-ex06": {
		reject: [
			{
				sql: "CREATE INDEX ON tracks USING hnsw (embedding vector_l2_ops);",
				why: "L2 opclass cannot serve <=>",
			},
			{
				sql: "CREATE INDEX ON tracks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 4);",
				why: "IVFFlat instead of HNSW",
			},
		],
		accept: [
			"CREATE INDEX idx_cos ON tracks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)",
		],
	},
	"ch36-ex07": {
		reject: [
			{
				sql: "CREATE INDEX tracks_embedding_cosine ON tracks USING hnsw (embedding vector_cosine_ops);",
				why: "the dead L2 index is kept",
			},
			{
				sql: "DROP INDEX tracks_embedding_l2;",
				why: "drops the index without replacing it",
			},
		],
		accept: [
			"CREATE INDEX c ON tracks USING hnsw (embedding vector_cosine_ops); DROP INDEX tracks_embedding_l2;",
		],
	},
	"ch36-ex08": {
		reject: [
			{
				sql: "SELECT t.title, round((coalesce(ts_rank(t.lyrics_tsv, w), 0) + (1 - (t.embedding <=> q.embedding)))::numeric, 5) AS score FROM tracks t, query_vectors q, websearch_to_tsquery('english', 'fire or dragon or gold') w WHERE q.label = 'dragon fight' ORDER BY score DESC, t.title LIMIT 5;",
				why: "adds raw scores of different scales",
			},
			{
				sql: "WITH words AS (SELECT id, rank() OVER (ORDER BY ts_rank(lyrics_tsv, w) DESC) AS pos FROM tracks, websearch_to_tsquery('english', 'fire or dragon or gold') w WHERE lyrics_tsv @@ w ORDER BY pos LIMIT 10), vibe AS (SELECT t.id, rank() OVER (ORDER BY t.embedding <=> q.embedding) AS pos FROM tracks t, query_vectors q WHERE q.label = 'dragon fight' ORDER BY pos LIMIT 10), f AS (SELECT id, 1.0 / (60 + pos) s FROM words UNION ALL SELECT id, 1.0 / (60 + pos) FROM vibe) SELECT t.title, round(sum(s), 5) sc FROM f JOIN tracks t USING (id) GROUP BY t.id, t.title ORDER BY sc DESC, t.title LIMIT 5;",
				why: "rank() gives tied positions instead of 1 to 10",
			},
		],
		accept: [
			"WITH w AS (SELECT websearch_to_tsquery('english', 'fire or dragon or gold') AS q), v AS (SELECT embedding FROM query_vectors WHERE label = 'dragon fight'), words AS (SELECT t.id, row_number() OVER (ORDER BY ts_rank(t.lyrics_tsv, w.q) DESC, t.id) AS pos FROM tracks t, w WHERE t.lyrics_tsv @@ w.q), vibe AS (SELECT t.id, row_number() OVER (ORDER BY t.embedding <=> v.embedding, t.id) AS pos FROM tracks t, v) SELECT t.title, round(coalesce(1.0 / (60 + a.pos), 0) + coalesce(1.0 / (60 + b.pos), 0), 5) AS score FROM tracks t LEFT JOIN words a ON a.id = t.id AND a.pos <= 10 LEFT JOIN vibe b ON b.id = t.id AND b.pos <= 10 WHERE a.pos <= 10 OR b.pos <= 10 ORDER BY score DESC, t.title LIMIT 5",
		],
	},
	"ch36-pr03": {
		reject: [
			{
				sql: "SELECT t.title FROM tracks t, tracks s WHERE s.id = 10 ORDER BY t.embedding <-> s.embedding LIMIT 3;",
				why: "track 10 finds itself first",
			},
		],
	},
	"ch36-pr05": {
		accept: ["CREATE INDEX ON tracks USING ivfflat (embedding) WITH (lists = 4)"],
		reject: [
			{
				sql: "CREATE INDEX ON tracks USING ivfflat (embedding vector_l2_ops) WITH (lists = 8);",
				why: "wrong number of lists",
			},
		],
	},
	"ch36-pr06": {
		reject: [
			{
				sql: "CREATE INDEX ON tracks USING hnsw (embedding vector_cosine_ops);",
				why: "cosine opclass cannot serve <#>",
			},
		],
	},
	"ch36-pr07": {
		reject: [
			{
				sql: "SELECT song, round(sum(position)::numeric, 5) AS score FROM (VALUES ('A', 'Reel', 1), ('A', 'Hymn', 2), ('A', 'Lullaby', 3), ('B', 'Hymn', 1), ('B', 'Lullaby', 2), ('B', 'Reel', 3)) AS r(judge, song, position) GROUP BY song ORDER BY score DESC;",
				why: "sums raw positions",
			},
		],
	},
};

export default cases;
