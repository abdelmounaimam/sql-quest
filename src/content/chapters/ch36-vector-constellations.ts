import type { Chapter } from "../types";

/** Hidden helper for plan checks: the EXPLAIN text of a query (COSTS OFF). */
const PLAN_HELPER = `CREATE FUNCTION plan_text(q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text; o text := '';
BEGIN
  FOR r IN EXECUTE 'EXPLAIN (COSTS OFF) ' || q LOOP o := o || r || E'\\n'; END LOOP;
  RETURN o;
END $f$;`;

/** Catalog view of the non-btree indexes on tracks: access method and operator class. */
const VECTOR_INDEXES = `SELECT am.amname::text AS method, opc.opcname::text AS opclass, coalesce(array_to_string(c.reloptions, ','), '') AS options
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_am am ON am.oid = c.relam
  JOIN pg_opclass opc ON opc.oid = i.indclass[0]
 WHERE i.indrelid = 'tracks'::regclass AND am.amname <> 'btree'`;

const COSINE_PLAN =
	"SELECT plan_text($q$SELECT title FROM tracks ORDER BY embedding <=> '[0.95,0.85,0.1,0.9]' LIMIT 5$q$) ~ 'Index Scan' AS cosine_query_uses_index";

const chapter: Chapter = {
	id: "ch36-vector-constellations",
	order: 36,
	world: "The Oracle's Library",
	tier: "master",
	track: "types",
	title: "Vector Constellations",
	subtitle: "pgvector: embeddings, distance operators, nearest neighbour search, HNSW and IVFFlat indexes, hybrid search",
	emoji: "✨",
	datasetId: "bardic",
	concepts: [
		"vector-basics",
		"vector-knn-search",
		"vector-indexes",
		"hybrid-search",
	],
	prerequisites: ["ch35-words-of-power", "ch13-unions-and-named-spells"],
	lesson: [
		{
			kind: "explain",
			title: "Embeddings: rows as points in space",
			body: "Keyword search cannot find *similar* items: two calm songs can share no words at all.\n\nAn **embedding** is a list of numbers that places a row in a space where similar items sit close together. The pgvector extension stores it in a `vector(n)` column. In the `tracks` table, `embedding` is a `vector(4)`: `[energy, darkness, acoustic, tempo]`, each between 0 and 1. (Real embeddings have hundreds of dimensions and come from a model; SQL only stores and compares them.)",
		},
		{
			kind: "example",
			title: "Look at the vectors",
			body: "The first three folk tracks are acoustic (third number near 0.9); the ambient tracks are quiet and slow. Rows with similar vectors have similar sounds.",
			sql: "SELECT id, title, mood, embedding\nFROM tracks\nORDER BY id\nLIMIT 6;",
		},
		{
			kind: "explain",
			title: "Distance operators",
			body: "pgvector has one operator per distance. For all of them, **smaller means closer**:\n\n| operator | distance |\n|---|---|\n| `<->` | Euclidean (straight line) |\n| `<=>` | cosine distance = 1 minus cosine similarity (direction only) |\n| `<#>` | **negative** inner product |\n| `<+>` | L1 (taxicab) |\n\nThe nearest neighbours of `q`: `ORDER BY embedding <=> q LIMIT k`.",
		},
		{
			kind: "quiz",
			question:
				"You want the 3 tracks most similar to a query vector `q`. Which clause is right?",
			choices: [
				"`ORDER BY embedding <=> q DESC LIMIT 3`",
				"`ORDER BY embedding <=> q LIMIT 3`",
				"`ORDER BY embedding <#> q DESC LIMIT 3`",
				"`ORDER BY embedding <=> q`",
			],
			answerIndex: 1,
			explanation:
				"These operators return **distances**: the most similar track has the smallest one, so sort ascending and stop after 3. DESC returns the 3 *least* similar; `<#>` is already negated, so DESC also returns the worst; without LIMIT you sort the whole table.",
		},
		{
			kind: "example",
			title: "Different operators, different results",
			body: "This query asks each operator for the single closest track to the `goblin rave` vector of `query_vectors`. The inner product returns a **metal** track: it rewards long vectors, not only the right direction. Use `<#>` only when vectors are normalised.",
			sql: "SELECT (SELECT title FROM tracks ORDER BY embedding <-> q.embedding LIMIT 1) AS euclidean,\n       (SELECT title FROM tracks ORDER BY embedding <=> q.embedding LIMIT 1) AS cosine,\n       (SELECT title FROM tracks ORDER BY embedding <#> q.embedding LIMIT 1) AS inner_product\nFROM query_vectors q\nWHERE q.label = 'goblin rave';",
		},
		{
			kind: "explain",
			title: "Dimensions and scales",
			body: "Vectors compare only when they have the same number of dimensions. `'[1,2,3]'::vector <-> embedding` fails with **22000** *different vector dimensions 3 and 4*.\n\nTo turn a distance into a similarity:\n```sql\n1 - (a <=> b)      -- cosine similarity, 1 = same direction\n(a <#> b) * -1     -- inner product\n```\nNever compare a cosine distance with a Euclidean one: they use different scales.",
		},
		{
			kind: "explain",
			title: "Checking the plan with EXPLAIN",
			body: "To see how Postgres runs a query, put `EXPLAIN` in front of it:\n```sql\nEXPLAIN SELECT title FROM tracks WHERE id = 3;\n```\nThe result is a tree of steps. Two leaf nodes matter here:\n\n- **Seq Scan**: read every row of the table;\n- **Index Scan using ...**: go through an index.\n\nQuery plans are covered in depth in World 10; here you only check which leaf appears.",
		},
		{
			kind: "explain",
			title: "Vector indexes",
			body: "Nearest neighbour (k-NN) search over millions of vectors needs an **approximate** index:\n```sql\nCREATE INDEX ON tracks\n  USING hnsw (embedding vector_cosine_ops);\n```\n- **HNSW**: a layered graph; parameters `m`, `ef_construction`, `SET hnsw.ef_search`.\n- **IVFFlat**: clusters; `WITH (lists = 4)`, `SET ivfflat.probes`; build it after loading data.\n- The **opclass must match the operator**: `vector_l2_ops` serves `<->`, `vector_cosine_ops` serves `<=>`, `vector_ip_ops` serves `<#>`.\n\nOn 36 rows the planner prefers a Seq Scan, so the checks use `SET enable_seqscan = off`.",
		},
		{
			kind: "explain",
			title: "Hybrid search",
			body: "Full text search finds exact words; vector search finds similar meaning. **Hybrid search** runs both and merges the two ranked lists. Their scores use different scales (`ts_rank` 0.03, cosine 0.0001), so never add them. Merge **positions** instead, with Reciprocal Rank Fusion (RRF):\n```sql\nscore = sum(1.0 / (60 + position))\n```\nA track ranked 1st in one list scores 1/61; a track in both lists gets two shares and moves up.",
		},
		{
			kind: "try",
			title: "Try it: nearest track by cosine distance",
			prompt:
				"Return the **title** of the single track closest, by **cosine distance**, to the `dragon fight` vector of `query_vectors`.",
			starterSql:
				"SELECT t.title\nFROM tracks t, query_vectors q\nWHERE q.label = 'dragon fight'\nORDER BY t.embedding <=> q.embedding DESC\nLIMIT 1;",
			solutionSql:
				"SELECT t.title FROM tracks t, query_vectors q WHERE q.label = 'dragon fight' ORDER BY t.embedding <=> q.embedding LIMIT 1;",
			check: { type: "result" },
			hints: [
				"Run the starter: it returns a calm lullaby. DESC puts the farthest track first.",
				"ORDER BY t.embedding <=> q.embedding LIMIT 1",
			],
		},
	],
	exercises: [
		{
			id: "ch36-ex01",
			title: "Euclidean distance to a vector",
			prompt:
				"For each track of **album 1**, return the **title** and the **Euclidean distance** between its embedding and the `tavern brawl` vector of `query_vectors`, rounded to **4** decimals.",
			difficulty: 2,
			kind: "query",
			concepts: ["vector-basics"],
			solutionSql:
				"SELECT t.title, round((t.embedding <-> q.embedding)::numeric, 4) AS distance\nFROM tracks t, query_vectors q\nWHERE q.label = 'tavern brawl'\n  AND t.album_id = 1;",
			check: { type: "result" },
			hints: [
				"Join the tracks to the one query vector you need (`WHERE q.label = 'tavern brawl'`).",
				"Euclidean distance is `<->`. Distances are floats: `round(x::numeric, 4)`.",
				"round((t.embedding <-> q.embedding)::numeric, 4) ... WHERE q.label = 'tavern brawl' AND t.album_id = 1",
			],
			explanation:
				"`<->` measures the straight line between two points: all three folk ballads are far (about 0.9) from the fast, energetic `tavern brawl` vector.\n\n**Pitfall:** `<=>` is also a distance, but a cosine one, so its numbers are not comparable. **Alternative:** the function form `l2_distance(t.embedding, q.embedding)` returns the same values.",
		},
		{
			id: "ch36-ex02",
			title: "Fix a dimension mismatch",
			prompt:
				"The starter fails. Fix it so it measures each **metal** track against the 4 dimensional vector `[1,1,1,1]` (maximum energy, darkness, acoustic and tempo): return the **title** and the Euclidean distance rounded to **4** decimals.",
			difficulty: 2,
			kind: "query",
			concepts: ["vector-basics"],
			starterSql:
				"SELECT title, round(('[1,2,3]'::vector <-> embedding)::numeric, 4) AS distance\nFROM tracks\nWHERE genre = 'metal';",
			solutionSql:
				"SELECT title, round(('[1,1,1,1]'::vector <-> embedding)::numeric, 4) AS distance\nFROM tracks\nWHERE genre = 'metal';",
			check: { type: "result" },
			hints: [
				"Read the error: 22000, different vector dimensions 3 and 4.",
				"Both sides must be `vector(4)`: four numbers.",
				"'[1,1,1,1]'::vector <-> embedding",
			],
			explanation:
				"pgvector refuses to compare vectors of different sizes, because the numbers would not mean the same thing.\n\n**Pitfall:** padding a vector with zeros removes the error but produces a meaningless comparison: embeddings from different models never share a space.",
		},
		{
			id: "ch36-ex03",
			title: "Top 5 by cosine distance",
			prompt:
				"Return the **title** of the **5** tracks closest to the `goblin rave` vector by **cosine distance**, closest first.",
			difficulty: 2,
			kind: "query",
			concepts: ["vector-knn-search"],
			solutionSql:
				"SELECT t.title\nFROM tracks t, query_vectors q\nWHERE q.label = 'goblin rave'\nORDER BY t.embedding <=> q.embedding\nLIMIT 5;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Sort the tracks by their distance to the query vector.",
				"Cosine distance is `<=>`; smallest first; keep 5.",
				"ORDER BY t.embedding <=> q.embedding LIMIT 5",
			],
			explanation:
				"`ORDER BY distance LIMIT k` is the whole k-NN pattern: the result holds the four electronic goblin tracks and the Ice Fox track.\n\n**Pitfall:** `<#>` (negative inner product) ranks by length as well as direction and brings metal tracks into the result. **Alternative:** `ORDER BY t.embedding <=> (SELECT embedding FROM query_vectors WHERE label = 'goblin rave')`.",
		},
		{
			id: "ch36-ex04",
			title: "Filtered nearest neighbours",
			prompt:
				"Among tracks that are **not explicit**, return the **title** and the **similarity** (`1 - cosine distance` to the `goblin rave` vector, rounded to **4** decimals) of the **5** most similar, most similar first.",
			difficulty: 3,
			kind: "query",
			concepts: ["vector-knn-search", "vector-basics"],
			solutionSql:
				"SELECT t.title, round((1 - (t.embedding <=> q.embedding))::numeric, 4) AS similarity\nFROM tracks t, query_vectors q\nWHERE q.label = 'goblin rave'\n  AND NOT t.explicit\nORDER BY t.embedding <=> q.embedding\nLIMIT 5;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Filter in WHERE, before ORDER BY and LIMIT select the rows.",
				"Similarity is `1 - (a <=> b)`; still sort by the distance ascending.",
				"WHERE q.label = 'goblin rave' AND NOT t.explicit ORDER BY t.embedding <=> q.embedding LIMIT 5",
			],
			explanation:
				"The filter runs first, so LIMIT 5 picks among non explicit tracks only and you still get 5 rows.\n\n**Pitfall:** taking the top 5 first and filtering afterwards leaves 3 tracks (two goblin tracks are explicit). With an approximate index the same problem appears inside the index scan; pgvector's iterative scans exist for that reason.",
		},
		{
			id: "ch36-ex05",
			title: "Nearest track per query vector",
			prompt:
				"For each row of `query_vectors`, return its **label** and the **title** of the track nearest to it by **Euclidean distance**: exactly one row per label.",
			difficulty: 3,
			kind: "query",
			concepts: ["vector-knn-search"],
			solutionSql:
				"SELECT q.label, nn.title\nFROM query_vectors q\nCROSS JOIN LATERAL (\n  SELECT t.title\n  FROM tracks t\n  ORDER BY t.embedding <-> q.embedding\n  LIMIT 1\n) AS nn;",
			check: { type: "result" },
			hints: [
				"You need a k-NN search (k = 1) per label: a subquery that can see the outer row.",
				"`CROSS JOIN LATERAL (SELECT ... ORDER BY ... LIMIT 1)` runs once per query vector.",
				"FROM query_vectors q CROSS JOIN LATERAL (SELECT t.title FROM tracks t ORDER BY t.embedding <-> q.embedding LIMIT 1) nn",
			],
			explanation:
				"LATERAL lets the inner query use `q.embedding`, so each label gets its own nearest neighbour, and an index could serve each lookup separately.\n\n**Pitfall:** a plain join returns 6 × 36 rows; a global `LIMIT 6` keeps the six closest pairs overall, not one per label. **Alternative:** `DISTINCT ON (q.label) ... ORDER BY q.label, t.embedding <-> q.embedding`.",
		},
		{
			id: "ch36-ex06",
			title: "Create an HNSW cosine index",
			prompt:
				"Create an **HNSW** index on `tracks.embedding` that serves **cosine distance** (`<=>`) searches.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["vector-indexes"],
			setupSql: PLAN_HELPER,
			solutionSql:
				"CREATE INDEX tracks_embedding_cosine ON tracks USING hnsw (embedding vector_cosine_ops);",
			check: {
				type: "state",
				verifySql: `SET enable_seqscan = off;\nSELECT ix.method, ix.opclass, (${COSINE_PLAN}) FROM (${VECTOR_INDEXES}) ix;`,
			},
			hints: [
				"`CREATE INDEX ... USING hnsw (column opclass)`.",
				"The operator class decides which distance the index supports: `<=>` needs the cosine one.",
				"CREATE INDEX ON tracks USING hnsw (embedding vector_cosine_ops);",
			],
			explanation:
				"With `vector_cosine_ops` the planner can answer `ORDER BY embedding <=> q LIMIT k` by walking the HNSW graph instead of sorting every row.\n\n**Pitfall:** HNSW has no default operator class (`USING hnsw (embedding)` fails with 42704), and `vector_l2_ops` would only serve `<->`. **Alternative:** IVFFlat (`USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`) builds faster but must be created after the data is loaded.",
		},
		{
			id: "ch36-ex07",
			title: "Replace an index with the wrong opclass",
			prompt:
				"The existing index `tracks_embedding_l2` uses `vector_l2_ops`, so cosine searches cannot use it. **Replace** it: drop it and create an HNSW index for **cosine** distance.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["vector-indexes"],
			setupSql: `${PLAN_HELPER}\nCREATE INDEX tracks_embedding_l2 ON tracks USING hnsw (embedding vector_l2_ops);`,
			starterSql:
				"-- The planner ignores the index for this query:\nSELECT title FROM tracks\nORDER BY embedding <=> '[0.95,0.85,0.1,0.9]'\nLIMIT 5;",
			solutionSql:
				"DROP INDEX tracks_embedding_l2;\nCREATE INDEX tracks_embedding_cosine ON tracks USING hnsw (embedding vector_cosine_ops);",
			check: {
				type: "state",
				verifySql: `SET enable_seqscan = off;\nSELECT string_agg(ix.method || ' ' || ix.opclass, ', ' ORDER BY ix.opclass) AS vector_indexes, (${COSINE_PLAN}) FROM (${VECTOR_INDEXES}) ix;`,
			},
			hints: [
				"An index on `<->` distances cannot order rows by `<=>` distances.",
				"Two statements: `DROP INDEX`, then `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`.",
				"DROP INDEX tracks_embedding_l2; CREATE INDEX ON tracks USING hnsw (embedding vector_cosine_ops);",
			],
			explanation:
				"Each opclass builds its graph with one distance. The L2 graph cannot answer a cosine ordering, so it only cost write time and disk space.\n\n**Pitfall:** adding the cosine index but keeping the L2 one leaves an unused index that slows every insert. **Alternative:** if both searches are needed, keep both, one per operator.",
		},
		{
			id: "ch36-ex08",
			title: "Boss: The Oracle's Riddle",
			story:
				"Combines full text search, cosine k-NN, window functions and Reciprocal Rank Fusion in one query.",
			prompt:
				"Build two ranked lists, each limited to its **top 10**:\n\n1. **words**: tracks with `lyrics_tsv @@ websearch_to_tsquery('english', 'fire or dragon or gold')`, positioned 1 to 10 by `ts_rank(lyrics_tsv, query)` descending, ties by **id**;\n2. **vibe**: all tracks positioned 1 to 10 by cosine distance to the `dragon fight` vector, ties by **id**.\n\nA track's **score** is the sum, over the lists it appears in, of `1.0 / (60 + position)`. Return the **title** and the **score** (rounded to **5** decimals) of the **5** best tracks, highest score first, ties by **title**.",
			difficulty: 5,
			kind: "query",
			concepts: [
				"hybrid-search",
				"vector-knn-search",
				"full-text-search",
				"cte-basics",
			],
			solutionSql:
				"WITH words AS (\n  SELECT id, row_number() OVER (ORDER BY ts_rank(lyrics_tsv, w) DESC, id) AS pos\n  FROM tracks, websearch_to_tsquery('english', 'fire or dragon or gold') AS w\n  WHERE lyrics_tsv @@ w\n  ORDER BY pos\n  LIMIT 10\n), vibe AS (\n  SELECT t.id, row_number() OVER (ORDER BY t.embedding <=> q.embedding, t.id) AS pos\n  FROM tracks t, query_vectors q\n  WHERE q.label = 'dragon fight'\n  ORDER BY pos\n  LIMIT 10\n), fused AS (\n  SELECT id, 1.0 / (60 + pos) AS share FROM words\n  UNION ALL\n  SELECT id, 1.0 / (60 + pos) FROM vibe\n)\nSELECT t.title, round(sum(f.share), 5) AS score\nFROM fused f\nJOIN tracks t ON t.id = f.id\nGROUP BY t.id, t.title\nORDER BY score DESC, t.title\nLIMIT 5;",
			check: { type: "result", orderMatters: true },
			hints: [
				"One CTE per list. `row_number() OVER (ORDER BY ...)` gives the position, then `LIMIT 10` cuts the list.",
				"Stack both lists with UNION ALL as `(id, 1.0 / (60 + pos))`, then `GROUP BY` track and `sum` the shares.",
				"... fused AS (SELECT id, 1.0 / (60 + pos) AS share FROM words UNION ALL SELECT id, 1.0 / (60 + pos) FROM vibe) SELECT t.title, round(sum(share), 5) ... GROUP BY t.id, t.title ORDER BY 2 DESC, t.title LIMIT 5",
			],
			explanation:
				"RRF ignores the raw scores and uses positions only, so a track that ranks well in both lists (Forged in Wyrmfire: matching lyrics and a vector close to `dragon fight`) beats a track that tops just one. Hammerfall Halls, the closest vector, has no matching lyrics and drops out of the top 5.\n\n**Pitfall:** `ts_rank + (1 - distance)` adds a 0.04 scale to a 0.99 scale, so the vector list always wins; `UNION` instead of `UNION ALL` merges identical shares and undercounts. **Alternative:** weight the lists (`0.7 / (60 + pos)`) when one source is more reliable.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch36-pr01",
			title: "Dimensions and norm of a vector",
			prompt:
				"Return two values for track **1**: the number of dimensions of its embedding (`vector_dims`) and its length (`vector_norm`, rounded to **4** decimals).",
			difficulty: 1,
			kind: "query",
			concepts: ["vector-basics"],
			solutionSql:
				"SELECT vector_dims(embedding), round(vector_norm(embedding)::numeric, 4)\nFROM tracks\nWHERE id = 1;",
			check: { type: "result" },
			hints: [
				"pgvector provides helper functions.",
				"`vector_dims(v)` and `vector_norm(v)`.",
				"SELECT vector_dims(embedding), round(vector_norm(embedding)::numeric, 4) FROM tracks WHERE id = 1;",
			],
			explanation:
				"4 dimensions and a length of about 1.02. Cosine distance ignores this length; inner product does not.",
		},
		{
			id: "ch36-pr02",
			title: "Sign of the inner product operator",
			prompt:
				"Return **one value**: `'[1,0,0,0]'::vector <#> '[1,0,0,0]'`.",
			difficulty: 1,
			kind: "query",
			concepts: ["vector-basics"],
			solutionSql: "SELECT '[1,0,0,0]'::vector <#> '[1,0,0,0]';",
			check: { type: "result" },
			hints: [
				"The inner product of a unit vector with itself is 1.",
				"`<#>` returns the inner product multiplied by -1.",
				"SELECT '[1,0,0,0]'::vector <#> '[1,0,0,0]';",
			],
			explanation:
				"-1. pgvector negates the inner product so that *smaller is closer* holds for every operator and indexes can sort ascending.",
		},
		{
			id: "ch36-pr03",
			title: "Nearest neighbours of a row",
			prompt:
				"Return the **title** of the **3** tracks closest to track **10** (Hammerfall Halls) by **Euclidean distance**, closest first, track 10 itself excluded.",
			difficulty: 2,
			kind: "query",
			concepts: ["vector-knn-search"],
			solutionSql:
				"SELECT t.title\nFROM tracks t, tracks s\nWHERE s.id = 10\n  AND t.id <> 10\nORDER BY t.embedding <-> s.embedding\nLIMIT 3;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Use the track's own embedding as the query vector.",
				"Exclude it, or it comes first with distance 0.",
				"FROM tracks t, tracks s WHERE s.id = 10 AND t.id <> 10 ORDER BY t.embedding <-> s.embedding LIMIT 3",
			],
			explanation:
				"The result is the other three Iron Lutes metal tracks. Without `t.id <> 10`, Hammerfall Halls comes first, at distance 0.",
		},
		{
			id: "ch36-pr04",
			title: "Nearest track per genre",
			prompt:
				"For each **genre**, return the genre and the **title** of its track nearest to the `starlit drift` vector (Euclidean distance).",
			difficulty: 3,
			kind: "query",
			concepts: ["vector-knn-search"],
			solutionSql:
				"SELECT DISTINCT ON (t.genre) t.genre, t.title\nFROM tracks t, query_vectors q\nWHERE q.label = 'starlit drift'\nORDER BY t.genre, t.embedding <-> q.embedding;",
			check: { type: "result" },
			hints: [
				"One row per group: DISTINCT ON or a window function.",
				"`DISTINCT ON (genre)` keeps the first row of each genre in ORDER BY order.",
				"SELECT DISTINCT ON (t.genre) t.genre, t.title ... ORDER BY t.genre, t.embedding <-> q.embedding",
			],
			explanation:
				"k-NN combines with the top N per group techniques of World 5: each genre gets its closest track to `starlit drift`, even if that track is far.",
		},
		{
			id: "ch36-pr05",
			title: "Create an IVFFlat index",
			prompt:
				"Create an **IVFFlat** index on `tracks.embedding` for **Euclidean** distance (`<->`) with **4 lists**.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["vector-indexes"],
			solutionSql:
				"CREATE INDEX tracks_embedding_ivf ON tracks USING ivfflat (embedding vector_l2_ops) WITH (lists = 4);",
			check: { type: "state", verifySql: `${VECTOR_INDEXES};` },
			hints: [
				"`USING ivfflat`, and the storage parameter goes in `WITH (...)`.",
				"The L2 operator class is `vector_l2_ops` (also the default).",
				"CREATE INDEX ON tracks USING ivfflat (embedding vector_l2_ops) WITH (lists = 4);",
			],
			explanation:
				"IVFFlat splits the vectors into 4 clusters at build time; a search probes the nearest `ivfflat.probes` clusters. Build it after loading data, or the clusters are meaningless.",
		},
		{
			id: "ch36-pr06",
			title: "Index for the inner product",
			prompt:
				"Create an **HNSW** index on `tracks.embedding` that the planner can use for `ORDER BY embedding <#> ...` searches.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["vector-indexes"],
			setupSql: PLAN_HELPER,
			solutionSql:
				"CREATE INDEX tracks_embedding_ip ON tracks USING hnsw (embedding vector_ip_ops);",
			check: {
				type: "state",
				verifySql:
					"SET enable_seqscan = off;\nSELECT plan_text($q$SELECT title FROM tracks ORDER BY embedding <#> '[0.95,0.85,0.1,0.9]' LIMIT 5$q$) ~ 'Index Scan' AS ip_query_uses_index;",
			},
			hints: [
				"Each distance operator has its own operator class.",
				"Inner product: `vector_ip_ops`.",
				"CREATE INDEX ON tracks USING hnsw (embedding vector_ip_ops);",
			],
			explanation:
				"`vector_ip_ops` serves `<#>`. A cosine or L2 index would leave this query on a Seq Scan.",
		},
		{
			id: "ch36-pr07",
			title: "Reciprocal Rank Fusion on two rankings",
			prompt:
				"Two rankings of three songs: ranking A is Reel 1st, Hymn 2nd, Lullaby 3rd; ranking B is Hymn 1st, Lullaby 2nd, Reel 3rd. Put them in a `VALUES` list `(judge, song, position)` and return each **song** with its RRF **score** `sum(1.0 / (60 + position))` rounded to **5** decimals, best first.",
			difficulty: 2,
			kind: "query",
			concepts: ["hybrid-search"],
			solutionSql:
				"SELECT song, round(sum(1.0 / (60 + position)), 5) AS score\nFROM (VALUES ('A', 'Reel', 1), ('A', 'Hymn', 2), ('A', 'Lullaby', 3),\n             ('B', 'Hymn', 1), ('B', 'Lullaby', 2), ('B', 'Reel', 3)) AS r(judge, song, position)\nGROUP BY song\nORDER BY score DESC;",
			check: { type: "result", orderMatters: true },
			hints: [
				"`(VALUES (...), (...)) AS r(judge, song, position)` is an inline table.",
				"Group by song and sum the shares.",
				"SELECT song, round(sum(1.0 / (60 + position)), 5) ... GROUP BY song ORDER BY 2 DESC",
			],
			explanation:
				"Hymn (2nd + 1st) beats Reel (1st + 3rd): ranking well in both lists beats ranking first once. The constant 60 keeps a single first place from dominating.",
		},
		{
			id: "ch36-pr08",
			title: "Full text ranking for hybrid search",
			prompt:
				"Return the **title** and `ts_rank(lyrics_tsv, to_tsquery('english', 'moon'))` rounded to **4** decimals of every track whose `lyrics_tsv` matches **moon**, highest rank first, ties by title.",
			difficulty: 2,
			kind: "query",
			concepts: ["hybrid-search", "full-text-search"],
			solutionSql:
				"SELECT title, round(ts_rank(lyrics_tsv, q)::numeric, 4) AS rank\nFROM tracks, to_tsquery('english', 'moon') AS q\nWHERE lyrics_tsv @@ q\nORDER BY rank DESC, title;",
			check: { type: "result", orderMatters: true },
			hints: [
				"`lyrics_tsv` is already a tsvector (generated from title and lyrics).",
				"Filter with `@@`, rank with `ts_rank`, sort with a tie breaker.",
				"WHERE lyrics_tsv @@ q ORDER BY rank DESC, title",
			],
			explanation:
				"This is the keyword list that a hybrid search would merge: four tracks tie at 0.0608, so positions need a tie breaker before RRF can use them.",
		},
	],
};

export default chapter;
