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
	subtitle: "Embeddings, nearest neighbours, vector indexes and hybrid search",
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
			title: "Songs as points in space",
			body: "The bard-in-chief of Bardic Beats wants a button: *find me something like this*. Keywords cannot do it: a calm lullaby and a calm forest hymn share no words.\n\nSo every track carries an **embedding**: a list of numbers placing it on a map of sound. Here `vector(4)` = `[energy, darkness, acoustic, tempo]`, each 0 to 1. Similar songs sit close together. (Real embeddings have hundreds of numbers and come from a model; SQL only stores and compares them.)",
		},
		{
			kind: "example",
			title: "Meet the vectors",
			body: "The first three folk tracks are acoustic (third number near 0.9); the ambient tracks are quiet and slow. Neighbours in the list are neighbours in sound.",
			sql: "SELECT id, title, mood, embedding\nFROM tracks\nORDER BY id\nLIMIT 6;",
		},
		{
			kind: "explain",
			title: "Four ways to measure",
			body: "pgvector gives one operator per distance. For all of them, **smaller means closer**:\n\n| operator | distance |\n|---|---|\n| `<->` | Euclidean (straight line) |\n| `<=>` | cosine distance = 1 minus cosine similarity (direction only) |\n| `<#>` | **negative** inner product |\n| `<+>` | L1 (taxicab) |\n\nThe nearest neighbours of `q`: `ORDER BY embedding <=> q LIMIT k`.",
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
				"These operators return **distances**: the most similar track has the smallest one, so sort ascending and stop after 3. DESC returns the 3 *least* similar; `<#>` is already negated, so DESC also gives the worst; without LIMIT you sort the whole catalogue.",
		},
		{
			kind: "example",
			title: "Three judges, three winners?",
			body: "Ask each operator for the single closest track to the *goblin rave* vibe. The inner product crowns a **metal** track: it rewards long vectors, not only the right direction. Use `<#>` only when vectors are normalised.",
			sql: "SELECT (SELECT title FROM tracks ORDER BY embedding <-> q.embedding LIMIT 1) AS euclidean,\n       (SELECT title FROM tracks ORDER BY embedding <=> q.embedding LIMIT 1) AS cosine,\n       (SELECT title FROM tracks ORDER BY embedding <#> q.embedding LIMIT 1) AS inner_product\nFROM query_vectors q\nWHERE q.label = 'goblin rave';",
		},
		{
			kind: "explain",
			title: "One space at a time",
			body: "Vectors compare only within the same space. `'[1,2,3]'::vector <-> embedding` fails with **22000** *different vector dimensions 3 and 4*.\n\nDistances and similarities are mirror images:\n```sql\n1 - (a <=> b)      -- cosine similarity, 1 = same direction\n(a <#> b) * -1     -- inner product\n```\nNever compare a cosine distance with a Euclidean one: they live on different scales.",
		},
		{
			kind: "explain",
			title: "A peek at the plan",
			body: "How does Postgres run a query? Put `EXPLAIN` in front of it:\n```sql\nEXPLAIN SELECT title FROM tracks WHERE id = 3;\n```\nThe answer is a tree of steps. Two leaves matter today:\n\n- **Seq Scan**: read every row of the table;\n- **Index Scan using ...**: jump through an index.\n\nWorld 10 teaches plans in depth; here you only check which leaf appears.",
		},
		{
			kind: "explain",
			title: "Vector indexes",
			body: "k-NN over millions of vectors needs an **approximate** index:\n```sql\nCREATE INDEX ON tracks\n  USING hnsw (embedding vector_cosine_ops);\n```\n- **HNSW**: a layered graph; knobs `m`, `ef_construction`, `SET hnsw.ef_search`.\n- **IVFFlat**: clusters; `WITH (lists = 4)`, `SET ivfflat.probes`; build it after loading data.\n- The **opclass must match the operator**: `vector_l2_ops` serves `<->`, `vector_cosine_ops` serves `<=>`, `vector_ip_ops` serves `<#>`.\n\nOn 36 rows the planner prefers a Seq Scan, so the checks use `SET enable_seqscan = off`.",
		},
		{
			kind: "explain",
			title: "Hybrid search",
			body: "Keywords find exact words; vectors find the vibe. **Hybrid search** runs both and fuses the lists. Their scores live on different scales (`ts_rank` 0.03, cosine 0.0001), so never add them. Fuse **positions** instead, with Reciprocal Rank Fusion:\n```sql\nscore = sum(1.0 / (60 + position))\n```\nA track ranked 1st in one list scores 1/61; a track in both lists collects two shares and rises.",
		},
		{
			kind: "try",
			title: "Your turn: the dragon's song",
			prompt:
				"Return the **title** of the single track closest, by **cosine distance**, to the `dragon fight` vector of `query_vectors`.",
			starterSql:
				"SELECT t.title\nFROM tracks t, query_vectors q\nWHERE q.label = 'dragon fight'\nORDER BY t.embedding <=> q.embedding DESC\nLIMIT 1;",
			solutionSql:
				"SELECT t.title FROM tracks t, query_vectors q WHERE q.label = 'dragon fight' ORDER BY t.embedding <=> q.embedding LIMIT 1;",
			check: { type: "result" },
			hints: [
				"Run the starter: a calm lullaby wins the dragon fight. DESC puts the farthest first.",
				"ORDER BY t.embedding <=> q.embedding LIMIT 1",
			],
		},
	],
	exercises: [
		{
			id: "ch36-ex01",
			title: "How far from the tavern?",
			story:
				"Mélusine & the Moths want to play the tavern. The booker measures how far their first album sits from the *tavern brawl* vibe.",
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
				"`<->` measures the straight line between two points: all three folk ballads are far (about 0.9) from a fast, energetic brawl.\n\n**Pitfall:** `<=>` is also a distance but a cosine one, so its numbers are not comparable. **Alternative:** the function form `l2_distance(t.embedding, q.embedding)` gives the same values.",
		},
		{
			id: "ch36-ex02",
			title: "A vector from another world",
			story:
				"A visiting bard hands over a three-number vibe from his own lute app. The query explodes.",
			prompt:
				"The starter fails. Fix it so it measures each **metal** track against the 4-dimensional vector `[1,1,1,1]` (full energy, darkness, acoustics and tempo): return the **title** and the Euclidean distance rounded to **4** decimals.",
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
				"pgvector refuses to compare vectors of different sizes, because the numbers would not mean the same thing.\n\n**Pitfall:** padding a foreign vector with zeros makes the error go away but compares apples with lutes: embeddings from different models never share a space.",
		},
		{
			id: "ch36-ex03",
			title: "More goblin, please",
			story:
				"goblin_dj_fan pressed *find me something like this* on the goblin rave playlist.",
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
				"`ORDER BY distance LIMIT k` is the whole k-NN recipe: the four electronic goblin bangers and the Ice Fox's track.\n\n**Pitfall:** `<#>` (negative inner product) ranks by length as well as direction and brings metal into the rave. **Alternative:** `ORDER BY t.embedding <=> (SELECT embedding FROM query_vectors WHERE label = 'goblin rave')`.",
		},
		{
			id: "ch36-ex04",
			title: "Safe for the children's tavern",
			story:
				"The children's tavern bans explicit lyrics but loves the goblin sound.",
			prompt:
				"Among tracks that are **not explicit**, return the **title** and the **similarity** (`1 - cosine distance` to the `goblin rave` vector, rounded to **4** decimals) of the **5** most similar, most similar first.",
			difficulty: 3,
			kind: "query",
			concepts: ["vector-knn-search", "vector-basics"],
			solutionSql:
				"SELECT t.title, round((1 - (t.embedding <=> q.embedding))::numeric, 4) AS similarity\nFROM tracks t, query_vectors q\nWHERE q.label = 'goblin rave'\n  AND NOT t.explicit\nORDER BY t.embedding <=> q.embedding\nLIMIT 5;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Filter in WHERE, before the ORDER BY and LIMIT pick the winners.",
				"Similarity is `1 - (a <=> b)`; still sort by the distance ascending.",
				"WHERE q.label = 'goblin rave' AND NOT t.explicit ORDER BY t.embedding <=> q.embedding LIMIT 5",
			],
			explanation:
				"The filter runs first, so LIMIT 5 picks among clean tracks only and the list stays full.\n\n**Pitfall:** taking the top 5 first and filtering afterwards leaves 3 tracks (two goblin bangers are explicit). With an approximate index the same trap appears inside the index scan; pgvector's iterative scans exist for that reason.",
		},
		{
			id: "ch36-ex05",
			title: "One song per vibe",
			story:
				"The homepage shows one suggestion per saved vibe.",
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
				"LATERAL lets the inner query use `q.embedding`, so each label gets its own nearest neighbour, which an index could serve one probe at a time.\n\n**Pitfall:** a plain join returns 6 × 36 rows; a global `LIMIT 6` keeps the six closest pairs overall, not one per label. **Alternative:** `DISTINCT ON (q.label) ... ORDER BY q.label, t.embedding <-> q.embedding`.",
		},
		{
			id: "ch36-ex06",
			title: "Weave the constellation",
			story:
				"Bardic Beats is about to import a million songs. The cosine search must stay instant.",
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
				"The operator class decides which distance the index understands: `<=>` needs the cosine one.",
				"CREATE INDEX ON tracks USING hnsw (embedding vector_cosine_ops);",
			],
			explanation:
				"With `vector_cosine_ops` the planner can answer `ORDER BY embedding <=> q LIMIT k` by walking the HNSW graph instead of sorting every row.\n\n**Pitfall:** HNSW has no default operator class (`USING hnsw (embedding)` fails with 42704), and `vector_l2_ops` would only serve `<->`. **Alternative:** IVFFlat (`USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`) builds faster but must be created after the data is loaded.",
		},
		{
			id: "ch36-ex07",
			title: "The index nobody uses",
			story:
				"An apprentice already built an index, yet the cosine search still reads every track. The schema shows `tracks_embedding_l2`.",
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
				"Each opclass builds its graph with one distance. The L2 graph cannot answer a cosine ordering, so it only cost write time and disk.\n\n**Pitfall:** adding the cosine index but keeping the L2 one leaves a dead index that slows every insert. **Alternative:** if both searches are real, keep both, one per operator.",
		},
		{
			id: "ch36-ex08",
			title: "Boss: The Oracle's Riddle",
			story:
				"A listener asks the Oracle for \"fire, dragon or gold\" songs that *feel* like a dragon fight. Keywords alone pick a folk ballad about a fen fire; vectors alone ignore the lyrics. The bard-in-chief wants both, fused.",
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
				"RRF ignores the raw scores and trusts positions only, so a track that is good in both lists (Forged in Wyrmfire: wyrmfire lyrics and a pure dragon-fight sound) beats a track that tops just one. Hammerfall Halls, the closest vibe, has no matching lyrics and falls out of the top 5.\n\n**Pitfall:** `ts_rank + (1 - distance)` adds a 0.04 scale to a 0.99 scale and the vector list wins every time; `UNION` instead of `UNION ALL` merges identical shares and undercounts. **Alternative:** weight the lists (`0.7 / (60 + pos)`) when one source is more trusted.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch36-pr01",
			title: "Size of a vector",
			prompt:
				"Return two values for track **1**: the number of dimensions of its embedding (`vector_dims`) and its length (`vector_norm`, rounded to **4** decimals).",
			difficulty: 1,
			kind: "query",
			concepts: ["vector-basics"],
			solutionSql:
				"SELECT vector_dims(embedding), round(vector_norm(embedding)::numeric, 4)\nFROM tracks\nWHERE id = 1;",
			check: { type: "result" },
			hints: [
				"pgvector ships helper functions.",
				"`vector_dims(v)` and `vector_norm(v)`.",
				"SELECT vector_dims(embedding), round(vector_norm(embedding)::numeric, 4) FROM tracks WHERE id = 1;",
			],
			explanation:
				"4 dimensions and a length of about 1.02. Cosine distance ignores this length; inner product does not.",
		},
		{
			id: "ch36-pr02",
			title: "The negative twin",
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
			title: "Sounds like Hammerfall",
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
				"Exclude it, or it wins with distance 0.",
				"FROM tracks t, tracks s WHERE s.id = 10 AND t.id <> 10 ORDER BY t.embedding <-> s.embedding LIMIT 3",
			],
			explanation: "The other three Iron Lutes metal tracks. Forgetting `t.id <> 10` returns Hammerfall Halls first, at distance 0.",
		},
		{
			id: "ch36-pr04",
			title: "Best per genre",
			prompt:
				"For each **genre**, return the genre and the **title** of its track nearest to the `starlit drift` vector (Euclidean distance).",
			difficulty: 3,
			kind: "query",
			concepts: ["vector-knn-search"],
			solutionSql:
				"SELECT DISTINCT ON (t.genre) t.genre, t.title\nFROM tracks t, query_vectors q\nWHERE q.label = 'starlit drift'\nORDER BY t.genre, t.embedding <-> q.embedding;",
			check: { type: "result" },
			hints: [
				"One winner per group: DISTINCT ON or a window.",
				"`DISTINCT ON (genre)` keeps the first row of each genre in ORDER BY order.",
				"SELECT DISTINCT ON (t.genre) t.genre, t.title ... ORDER BY t.genre, t.embedding <-> q.embedding",
			],
			explanation:
				"k-NN combines with the top-N-per-group tools of World 5: each genre gets its closest track to the starry drift, even if it is far.",
		},
		{
			id: "ch36-pr05",
			title: "Clusters of sound",
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
			explanation: "`vector_ip_ops` serves `<#>`. A cosine or L2 index would leave this query on a Seq Scan.",
		},
		{
			id: "ch36-pr07",
			title: "Fuse two judges",
			story:
				"Two judges ranked three songs. Judge A: Reel 1st, Hymn 2nd, Lullaby 3rd. Judge B: Hymn 1st, Lullaby 2nd, Reel 3rd.",
			prompt:
				"Put the two rankings in a `VALUES` list `(judge, song, position)` and return each **song** with its RRF **score** `sum(1.0 / (60 + position))` rounded to **5** decimals, best first.",
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
				"Hymn (2nd + 1st) beats Reel (1st + 3rd): being good everywhere beats being first once. The constant 60 keeps a single first place from dominating.",
		},
		{
			id: "ch36-pr08",
			title: "The keyword half",
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
				"This is the keyword list a hybrid search would fuse: four tracks tie at 0.0608, so positions need a tie breaker before RRF can use them.",
		},
	],
};

export default chapter;
