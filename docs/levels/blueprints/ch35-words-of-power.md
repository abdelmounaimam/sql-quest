### ch35-words-of-power · Words of Power 🪄
- **File** `src/content/chapters/ch35-words-of-power.ts` · **World** The Oracle's Library · **Tier** expert · **Track** types · **Dataset** `library`
- **Subtitle** Full-text search in two languages, ranking, highlighting and forgiving typos
- **Concepts** `full-text-search`, `fts-ranking-highlighting`, `fts-indexing`, `trigram-search`, `fuzzy-string-matching`
- **Prerequisites** `ch33-bound-by-time`
- **Lesson** (10 steps)
  1. explain · `LIKE '%war%'` is the poor man's search engine: it finds the night *war*den, misses *wars* at a word boundary you did not plan for, cannot rank, cannot use a plain index.
  2. example · Lexemes: `to_tsvector('simple', 'The dragons were burning')` vs `to_tsvector('english', ...)` vs `to_tsquery('english', 'dragon & burn')` (stop words vanish, words are stemmed).
  3. explain · `tsvector @@ tsquery`, operators `& | ! <->`, configs (english, french, simple); always pass the config explicitly.
  4. quiz · `to_tsvector('english', body) @@ to_tsquery('simple', 'dragons')`: what happens? (finds nothing: the document holds `dragon`, the query `dragons`; config mismatch)
  5. explain · Raw user input: `websearch_to_tsquery` (quotes, `or`, `-`) instead of `to_tsquery` (42601 on `dragon fire`); `ts_rank`, `setweight` A/B, `ts_headline`.
  6. example · Ranked search for `dragon fire` with `ts_rank`, best first.
  7. explain · Indexing: a STORED generated tsvector column (PG18 defaults to VIRTUAL, which cannot be indexed) + GIN; the two-argument `to_tsvector('english', ...)` is required because the one-argument form is not IMMUTABLE (42P17).
  8. explain · Fuzzy matching: pg_trgm `similarity`, `%`, `<->`; fuzzystrmatch `levenshtein`, `soundex`, `dmetaphone`; `unaccent`.
  9. example · Surprises: `similarity('Ysolde','Isolde')` = 0.4, `levenshtein` = 1, `soundex('Stephen') = soundex('Steven')`, but `mice` never matches `mouse` (stemming is not a dictionary).
  10. try · id and title of English scrolls that mention the kraken (starter: case-sensitive `LIKE '%Kraken%'` finds nothing).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch35-ex01 | id, title of English scrolls whose body matches both **dragon** and **fire** (english config): 1, 2, 4, 6, 17 | 2 | query | result | full-text-search | write |
| ch35-ex02 | the search box uses `body ILIKE '%war%'` and returns a scroll about the night *warden*: rewrite with FTS, English scrolls about war (war, wars): 9, 22 | 2 | query | result | full-text-search | fix |
| ch35-ex03 | a French reader typed **reveiller** without accents: id, title of French scrolls matching it with the french config and unaccent on both sides: 23, 30 | 3 | query | result | full-text-search, fuzzy-string-matching | write |
| ch35-ex04 | title and `ts_rank` (4 decimals) of English scrolls matching the web search `dragon fire`, best first (no ties) | 3 | query | result (ordered) | fts-ranking-highlighting | write |
| ch35-ex05 | title and `ts_headline('english', body, q, 'StartSel=[,StopSel=]')` of English scrolls matching `kraken` | 3 | query | result | fts-ranking-highlighting | write |
| ch35-ex06 | add a STORED generated column `search` (title weight A, body weight B, english) and a GIN index on it; verify: attgenerated, GIN indexdef, ranks through the column | 3 | ddl | state | fts-indexing | design |
| ch35-ex07 | a reader typed **Isolde Maro**: name and `similarity` (3 decimals) of readers above 0.3, best first | 3 | query | result (ordered) | trigram-search | write |
| ch35-ex08 | readers whose first name sounds like **Steven** (soundex) or is within 2 edits of **catherine** (levenshtein on lower-case first name): Stephen Vance, Katherine Wray | 3 | query | result | fuzzy-string-matching | write |
| ch35-ex09 | **Boss · The Librarian's Oracle**: input `dragons`, English and French scrolls, config per language, title A + body B, plus scrolls whose author is trigram-similar (> 0.4) to `Ellowen Thrise` with rank 0; id, title, language, rank (4 decimals), rank desc then id | 5 | query | result (ordered) | full-text-search, fts-ranking-highlighting, trigram-search | write |

- **Practice**: `ch35-pr01` full-text-search: count English scrolls matching `kraken | serpent` (3); `ch35-pr02` full-text-search: every form of **burn** (fix `ILIKE '%burned%'`): 1, 2, 3, 4, 15, 17; `ch35-pr03` fts-ranking-highlighting: top 2 English scrolls by `ts_rank_cd` for `frost`, ties by id; `ch35-pr04` fts-ranking-highlighting: short `ts_headline` with `MaxWords=8, MinWords=4` for `frost`; `ch35-pr05` fts-indexing: fix `CREATE INDEX ... USING gin (to_tsvector(body))` (42P17) into an english expression index used by the planner (plan checked with `enable_seqscan = off`); `ch35-pr06` trigram-search: readers whose name `%` `Isold` (default threshold 0.3); `ch35-pr07` trigram-search: predict `similarity('Ysolde', 'Isolde')` (0.4); `ch35-pr08` fuzzy-string-matching: readers whose first name is within 1 edit of Isolde (twins); `ch35-pr09` fuzzy-string-matching: readers whose `unaccent(name)` starts with `Celeste`.
- **Negative cases to add**: ex01 `to_tsquery('english', 'dragon | fire')`; ex02 the ILIKE starter, `ILIKE '% war %'` misses nothing but `'%war%'` keeps the warden; ex03 french config without unaccent (0 rows), english config; ex04 rank without the `@@` filter (zero-rank rows), ascending order; ex06 VIRTUAL column (index fails), no index, wrong weights; ex07 `name LIKE 'Isolde%'` (misses Ysolde); ex08 exact equality; boss body-only rank, no author branch, no `@@` filter. Accept: `plainto_tsquery`, `websearch_to_tsquery`, CTE vs inline, UNION ALL per language for the boss.
- **Notes**: library sets `default_text_search_config = english`, but every solution passes the config explicitly. `ts_rank` is float4: always round. Generated columns default to VIRTUAL in PostgreSQL 18, so the lesson insists on STORED. Index plan checks need a helper `plan_text(query)` created in the exercise setupSql and `SET enable_seqscan = off` in verifySql (30 rows). The boss has rank ties (0.6957, 0.2432): ordered by rounded rank then id.
