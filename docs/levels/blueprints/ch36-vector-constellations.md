### ch36-vector-constellations · Vector Constellations ✨
- **File** `src/content/chapters/ch36-vector-constellations.ts` · **World** The Oracle's Library · **Tier** master · **Track** types · **Dataset** `bardic`
- **Subtitle** Embeddings, nearest neighbours, vector indexes and hybrid search
- **Concepts** `vector-basics`, `vector-knn-search`, `vector-indexes`, `hybrid-search`
- **Prerequisites** `ch35-words-of-power`, `ch13-unions-and-named-spells`
- **Lesson** (10 steps)
  1. explain · An embedding is a list of numbers; here 4 dims `[energy, darkness, acoustic, tempo]`; similar tracks sit close together. Real embeddings come from a model, outside SQL.
  2. example · Meet the vectors: title, mood, embedding of the first 6 tracks (folk vs ambient clusters).
  3. explain · Distances: `<->` Euclidean, `<=>` cosine distance (`1 - cosine similarity`), `<#>` NEGATIVE inner product, `<+>` L1; smaller is closer for all four.
  4. quiz · Which ORDER BY gives the 3 most similar tracks? (`embedding <=> q LIMIT 3`; distractors: DESC, `<#> DESC`, no LIMIT)
  5. example · Surprise: the winner for `goblin rave` under `<->`, `<=>` and `<#>` (inner product crowns a metal track because it rewards long vectors).
  6. explain · Same space only: `vector(4)` vs a 3-number vector raises 22000; cosine similarity is `1 - (a <=> b)`.
  7. explain · Three-line EXPLAIN primer: `EXPLAIN SELECT ...` shows the plan; `Seq Scan` reads everything, `Index Scan` uses an index (World 10 goes deeper).
  8. explain · HNSW (`m`, `ef_construction`, `hnsw.ef_search`) and IVFFlat (`lists`, `ivfflat.probes`, build after loading data); the opclass must match the operator (`vector_cosine_ops` for `<=>`); results are approximate; tiny tables prefer Seq Scan, so demos use `SET enable_seqscan = off`.
  9. explain · Hybrid search: rank by FTS and by vector separately, fuse with Reciprocal Rank Fusion `sum(1 / (60 + position))`; never add raw scores of different scales.
  10. try · title of the single track closest (cosine) to the `dragon fight` vector.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch36-ex01 | title and Euclidean distance (4 decimals) between each track of album 1 and the `tavern brawl` vector | 2 | query | result | vector-basics | write |
| ch36-ex02 | starter `'[1,2,3]'::vector <-> embedding` fails with 22000: title and distance to `[1,1,1,1]` (4 decimals) of every metal track | 2 | query | result | vector-basics | fix |
| ch36-ex03 | titles of the 5 tracks closest by cosine distance to `goblin rave`, closest first (5th 0.0068 vs 6th 0.0548) | 2 | query | result (ordered) | vector-knn-search | write |
| ch36-ex04 | same among non-explicit tracks: title and similarity `1 - cosine distance` (4 decimals), closest first | 3 | query | result (ordered) | vector-knn-search | write |
| ch36-ex05 | for each `query_vectors` label: label and title of the nearest track (Euclidean), one row per label (LATERAL) | 3 | query | result | vector-knn-search | write |
| ch36-ex06 | create an HNSW index for cosine search on `tracks.embedding`; verify access method + opclass via catalog and an Index Scan in the plan with `enable_seqscan = off` | 3 | ddl | state | vector-indexes | optimize |
| ch36-ex07 | setupSql has an HNSW index with `vector_l2_ops`; the cosine query ignores it: replace it (drop and recreate with `vector_cosine_ops`) | 3 | ddl | state | vector-indexes | fix |
| ch36-ex08 | **Boss · The Oracle's Riddle**: top 5 by RRF of (a) FTS top 10 on `lyrics_tsv` for `websearch_to_tsquery('english', 'fire or dragon or gold')` (ts_rank desc, ties by id) and (b) cosine top 10 to `dragon fight` (ties by id); score `sum(1.0 / (60 + position))`; title and score (5 decimals), ties by title | 5 | query | result (ordered) | hybrid-search, vector-knn-search, full-text-search, cte-basics | write |

- **Practice**: `ch36-pr01` vector-basics: `vector_dims` and `vector_norm` (4 decimals) of track 1; `ch36-pr02` vector-basics: predict `'[1,0,0,0]'::vector <#> '[1,0,0,0]'` (-1); `ch36-pr03` vector-knn-search: 3 nearest tracks to track 10 itself (Euclidean), itself excluded; `ch36-pr04` vector-knn-search: nearest track per genre to `starlit drift` (DISTINCT ON); `ch36-pr05` vector-indexes: IVFFlat index for L2 with `lists = 4` (catalog: am, opclass, reloptions); `ch36-pr06` vector-indexes: HNSW index for inner product `<#>` used by the plan; `ch36-pr07` hybrid-search: RRF of two given rankings in VALUES (predict the winner); `ch36-pr08` hybrid-search: FTS list for `moon` on `lyrics_tsv`, title and rank, ties by title.
- **Negative cases to add**: ex03 `DESC` (farthest), `<#>` ascending, Euclidean happens to agree only on the first two; ex04 filter applied after the LIMIT (3 rows), similarity without `1 -`; ex05 plain join without per-label LIMIT; ex06 L2 opclass, IVFFlat; ex07 keeping the L2 index (still unused), creating the cosine index but leaving the dead one; boss adding raw ts_rank and distance, `rank()` instead of `row_number()`, no per-list LIMIT 10. Accept: subquery for the query vector instead of a join, `cosine_distance()` function, `CROSS JOIN LATERAL` vs `LEFT JOIN LATERAL ... ON true`, `DISTINCT ON` for ex05.
- **Notes**: 36 tracks, clusters by mood. Tracks 6, 7, 8, 32, 33, 34 are instrumentals (NULL lyrics, still in FTS by title). Plan checks need a `plan_text(query)` helper in the exercise setupSql and `SET enable_seqscan = off` in verifySql. Boss: FTS ranks tie heavily, so positions use `row_number() OVER (ORDER BY ts_rank DESC, id)`; ranks 5 and 6 of the fusion tie (0.02878), the title tie breaker decides.
