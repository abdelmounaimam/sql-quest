import type { Chapter } from "../types";

/** Hidden helper for plan checks: the EXPLAIN text of a query (COSTS OFF). */
const PLAN_HELPER = `CREATE FUNCTION plan_text(q text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text; o text := '';
BEGIN
  FOR r IN EXECUTE 'EXPLAIN (COSTS OFF) ' || q LOOP o := o || r || E'\\n'; END LOOP;
  RETURN o;
END $f$;`;

const chapter: Chapter = {
	id: "ch35-words-of-power",
	order: 35,
	world: "The Oracle's Library",
	tier: "expert",
	track: "types",
	title: "Words of Power",
	subtitle:
		"Full-text search in two languages, ranking, highlighting and forgiving typos",
	emoji: "🪄",
	datasetId: "library",
	concepts: [
		"full-text-search",
		"fts-ranking-highlighting",
		"fts-indexing",
		"trigram-search",
		"fuzzy-string-matching",
	],
	prerequisites: ["ch33-bound-by-time"],
	lesson: [
		{
			kind: "explain",
			title: "The poor man's search engine",
			body: "Head Librarian Elowen wants a search box. Your first idea is `body ILIKE '%war%'`. It has three curses:\n\n- it matches pieces of words: the night **war**den is not about war;\n- it knows nothing about grammar: *burn*, *burned*, *burning* are three different strings;\n- it cannot rank results, and a B-tree index cannot help a leading `%`.\n\nPostgreSQL ships a real search engine: **full-text search**.",
		},
		{
			kind: "example",
			title: "Words become lexemes",
			body: "`to_tsvector` turns text into **lexemes**: lower case, stemmed, stop words dropped, with positions. The `simple` config only lower-cases. Compare the two vectors, then the query.",
			sql: "SELECT to_tsvector('simple', 'The dragons were burning') AS simple_vector,\n       to_tsvector('english', 'The dragons were burning') AS english_vector,\n       to_tsquery('english', 'dragon & burn') AS query;",
		},
		{
			kind: "explain",
			title: "Matching with @@",
			body: "`tsvector @@ tsquery` is true when the document satisfies the query:\n```sql\nWHERE to_tsvector('english', body)\n   @@ to_tsquery('english', 'dragon & !frost')\n```\nQuery operators: `&` and, `|` or, `!` not, `<->` followed by.\n\nThe **config** (`english`, `french`, `simple`) decides how words are stemmed. This library's default is english, but always write the config yourself: document and query must use the same one.",
		},
		{
			kind: "quiz",
			question:
				"What does `SELECT title FROM scrolls WHERE to_tsvector('english', body) @@ to_tsquery('simple', 'dragons');` return?",
			choices: [
				"Every scroll that mentions dragons",
				"Nothing: the documents store `dragon`, the query looks for `dragons`",
				"An error: the two configs are incompatible",
				"Only scrolls with the exact word dragons",
			],
			answerIndex: 1,
			explanation:
				"The english config stems *dragons* to `dragon` in the document, but the `simple` config keeps `dragons` in the query. No lexeme matches and no error warns you. Use the same config on both sides.",
		},
		{
			kind: "explain",
			title: "User input, ranking and highlights",
			body: "Raw input breaks `to_tsquery('english', 'dragon fire')` (syntax error 42601). Use `websearch_to_tsquery`: it understands `\"quotes\"`, `or` and `-word` like a web search box.\n\n- `ts_rank(vector, query)` scores relevance (a float: round it).\n- `setweight(vector, 'A')` marks title words as more important than body words (`'B'`).\n- `ts_headline(config, text, query)` returns a snippet with the matches marked.",
		},
		{
			kind: "example",
			title: "A ranked search",
			body: "Filter with `@@` first, then rank. Without the filter, every scroll would get a rank of 0 and clutter the list.",
			sql: "SELECT title, round(ts_rank(to_tsvector('english', body), q)::numeric, 4) AS rank\nFROM scrolls, websearch_to_tsquery('english', 'dragon fire') AS q\nWHERE language = 'en'\n  AND to_tsvector('english', body) @@ q\nORDER BY rank DESC;",
		},
		{
			kind: "explain",
			title: "Indexing the search",
			body: "Computing `to_tsvector` for every row on every search is slow. Store it once and index it:\n```sql\nALTER TABLE scrolls ADD COLUMN search tsvector\n  GENERATED ALWAYS AS (to_tsvector('english', body)) STORED;\nCREATE INDEX ON scrolls USING gin (search);\n```\n- Write **STORED**: in PostgreSQL 18 a generated column is VIRTUAL by default, and a virtual column cannot be indexed.\n- Use the two-argument `to_tsvector`: the one-argument form depends on a setting, so it is not IMMUTABLE (error 42P17).",
		},
		{
			kind: "explain",
			title: "Forgiving typos",
			body: "FTS needs correctly spelled words. For names and typos, use the fuzzy extensions:\n\n- **pg_trgm**: `similarity(a, b)` (0 to 1, shared 3-letter chunks), `a % b` (similar above 0.3), `a <-> b` (distance, great in ORDER BY).\n- **fuzzystrmatch**: `levenshtein(a, b)` (number of edits), `soundex(a)` and `dmetaphone(a)` (how a name sounds).\n- **unaccent**: `unaccent('Céleste')` is `Celeste`.",
		},
		{
			kind: "example",
			title: "Fuzzy surprises",
			body: "Ysolde and Isolde differ by one letter but share only 40% of their trigrams. Stephen and Steven sound alike. And stemming is not a dictionary: `mice` never matches `mouse`.",
			sql: "SELECT similarity('Ysolde', 'Isolde') AS trigram_similarity,\n       levenshtein('Ysolde', 'Isolde') AS edits,\n       soundex('Stephen') = soundex('Steven') AS sounds_alike,\n       to_tsvector('english', 'mice') @@ to_tsquery('english', 'mouse') AS mice_are_mice;",
		},
		{
			kind: "try",
			title: "Your turn: here be krakens",
			prompt:
				"Return the **id** and **title** of every **English** scroll whose body mentions the **kraken**. Use full-text search with the english config.",
			starterSql:
				"SELECT id, title\nFROM scrolls\nWHERE language = 'en'\n  AND body LIKE '%Kraken%';",
			solutionSql:
				"SELECT id, title FROM scrolls WHERE language = 'en' AND to_tsvector('english', body) @@ to_tsquery('english', 'kraken');",
			check: { type: "result" },
			hints: [
				"Run the starter: LIKE is case sensitive and the bodies say *kraken* in lower case.",
				"WHERE language = 'en' AND to_tsvector('english', body) @@ to_tsquery('english', 'kraken')",
			],
		},
	],
	exercises: [
		{
			id: "ch35-ex01",
			title: "Fire and scales",
			story:
				"Elowen is writing a treatise on fire-breathing. She wants every English scroll that speaks of both dragons and fire, in any grammatical form.",
			prompt:
				"Return the **id** and **title** of every **English** scroll whose body matches both **dragon** and **fire**, using full-text search with the **english** config.",
			difficulty: 2,
			kind: "query",
			concepts: ["full-text-search"],
			solutionSql:
				"SELECT id, title\nFROM scrolls\nWHERE language = 'en'\n  AND to_tsvector('english', body) @@ to_tsquery('english', 'dragon & fire');",
			check: { type: "result" },
			hints: [
				"Turn the body into a tsvector and the two words into a tsquery.",
				"Both words must be present: the tsquery operator for *and* is `&`.",
				"to_tsvector('english', body) @@ to_tsquery('english', 'dragon & fire')",
			],
			explanation:
				"`to_tsquery('english', 'dragon & fire')` holds the lexemes `dragon` and `fire`, so *Dragons* and *dragon* both match after stemming.\n\n**Pitfall:** `dragon | fire` means *or* and drags in every scroll about fire mages. **Alternative:** `plainto_tsquery('english', 'dragon fire')` puts `&` between words for you.",
		},
		{
			id: "ch35-ex02",
			title: "The warden is not a war",
			story:
				"The archive's search box runs `body ILIKE '%war%'`. A historian searching for wars got a scroll about the night warden and mice.",
			prompt:
				"Return the **id** and **title** of every **English** scroll about **war** (the word war in any form, like *wars*), using full-text search with the english config.",
			difficulty: 2,
			kind: "query",
			concepts: ["full-text-search"],
			starterSql:
				"SELECT id, title\nFROM scrolls\nWHERE language = 'en'\n  AND body ILIKE '%war%';",
			solutionSql:
				"SELECT id, title\nFROM scrolls\nWHERE language = 'en'\n  AND to_tsvector('english', body) @@ to_tsquery('english', 'war');",
			check: { type: "result" },
			hints: [
				"Run the starter: which scroll is not about war at all?",
				"`%war%` matches any text that contains those three letters, even inside *warden*. FTS compares whole lexemes.",
				"to_tsvector('english', body) @@ to_tsquery('english', 'war')",
			],
			explanation:
				"Full-text search compares lexemes: `warden` is its own word and never equals `war`, while *wars* is stemmed to `war`.\n\n**Pitfall:** patching LIKE with spaces (`'% war %'`) misses *war.* and *war,* and still cannot rank. **Alternative:** a trigram index speeds up `LIKE '%x%'`, but it does not fix its meaning.",
		},
		{
			id: "ch35-ex03",
			title: "No accents on the keyboard",
			story:
				"Amélie the translator receives a request from a reader whose keyboard lost its accents. The reader typed **reveiller** (to wake) and wants every French scroll about waking.",
			prompt:
				"Return the **id** and **title** of every **French** scroll matching the word **reveiller**. Use the **french** config and apply `unaccent` to both the body and the search word.",
			difficulty: 3,
			kind: "query",
			concepts: ["full-text-search", "fuzzy-string-matching"],
			starterSql:
				"SELECT id, title\nFROM scrolls\nWHERE language = 'fr'\n  AND to_tsvector('french', body) @@ to_tsquery('french', 'reveiller');",
			solutionSql:
				"SELECT id, title\nFROM scrolls\nWHERE language = 'fr'\n  AND to_tsvector('french', unaccent(body)) @@ to_tsquery('french', unaccent('reveiller'));",
			check: { type: "result" },
			hints: [
				"Run the starter: no rows. The scrolls say *réveille* and *réveiller*, with an accent.",
				"Remove accents on both sides so that `reveil` meets `reveil`.",
				"to_tsvector('french', unaccent(body)) @@ to_tsquery('french', unaccent('reveiller'))",
			],
			explanation:
				"The french config stems *réveille* and *réveiller* to `réveil`; `unaccent` turns both the document and the input into plain `reveil`, so the stems meet.\n\n**Pitfall:** the english config does not know French conjugations and finds nothing here. **Alternative:** in production, build a custom text search config with the unaccent dictionary so the index does it for you.",
		},
		{
			id: "ch35-ex04",
			title: "The most relevant first",
			story:
				"A visitor types `dragon fire` in the search box and expects the best scroll at the top, like any web search.",
			prompt:
				"Return the **title** and the **rank** (`ts_rank` of the English body against `websearch_to_tsquery('english', 'dragon fire')`, rounded to 4 decimals) of every **English** scroll that matches the search, **highest rank first**.",
			difficulty: 3,
			kind: "query",
			concepts: ["fts-ranking-highlighting", "full-text-search"],
			solutionSql:
				"SELECT title, round(ts_rank(to_tsvector('english', body), q)::numeric, 4) AS rank\nFROM scrolls, websearch_to_tsquery('english', 'dragon fire') AS q\nWHERE language = 'en'\n  AND to_tsvector('english', body) @@ q\nORDER BY rank DESC;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Put the query in the FROM clause once (`websearch_to_tsquery(...) AS q`) and reuse `q`.",
				"Keep only matching scrolls with `@@`, then sort by `ts_rank` descending. Round with `round(x::numeric, 4)`.",
				"SELECT title, round(ts_rank(to_tsvector('english', body), q)::numeric, 4) ... WHERE language = 'en' AND to_tsvector('english', body) @@ q ORDER BY 2 DESC",
			],
			explanation:
				"`ts_rank` scores how often and how densely the query lexemes appear; the five matching scrolls get distinct ranks.\n\n**Pitfall:** ranking without the `@@` filter lists all 22 English scrolls, most with a rank of 0. **Alternative:** `ts_rank_cd` (cover density) rewards query words that appear close together.",
		},
		{
			id: "ch35-ex05",
			title: "Mark the words",
			story:
				"The reading-room screen shows a snippet under each result with the search word in brackets, so readers see why a scroll was found.",
			prompt:
				"Return the **title** and the snippet `ts_headline('english', body, q, 'StartSel=[,StopSel=]')` of every **English** scroll whose body matches `to_tsquery('english', 'kraken')`.",
			difficulty: 3,
			kind: "query",
			concepts: ["fts-ranking-highlighting"],
			solutionSql:
				"SELECT title, ts_headline('english', body, q, 'StartSel=[,StopSel=]') AS snippet\nFROM scrolls, to_tsquery('english', 'kraken') AS q\nWHERE language = 'en'\n  AND to_tsvector('english', body) @@ q;",
			check: { type: "result" },
			hints: [
				"`ts_headline` takes the original text (not the tsvector) and the query.",
				"The options string sets the markers: `'StartSel=[,StopSel=]'`.",
				"SELECT title, ts_headline('english', body, q, 'StartSel=[,StopSel=]') FROM scrolls, to_tsquery('english', 'kraken') AS q WHERE ...",
			],
			explanation:
				"`ts_headline` re-reads the raw text, finds the words that match the query and wraps them, keeping the original spelling and capitals.\n\n**Pitfall:** it is slow (it parses the whole text), so compute it only for the rows you show, after filtering and LIMIT, never for the whole table.",
		},
		{
			id: "ch35-ex06",
			title: "Carve the index",
			story:
				"Bartholomew, Master of Scrolls, refuses to let every search re-read every scroll. He wants the search vector stored and indexed, with titles counting more than bodies.",
			prompt:
				"Add to `scrolls` a **stored generated column** named **search** equal to `setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', body), 'B')`, then create a **GIN index** on it.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["fts-indexing"],
			solutionSql:
				"ALTER TABLE scrolls ADD COLUMN search tsvector\n  GENERATED ALWAYS AS (\n    setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', body), 'B')\n  ) STORED;\nCREATE INDEX scrolls_search_idx ON scrolls USING gin (search);",
			check: {
				type: "state",
				verifySql:
					"SELECT (SELECT attgenerated::text FROM pg_attribute WHERE attrelid = 'scrolls'::regclass AND attname = 'search') AS generated,\n       (SELECT count(*) FROM pg_indexes WHERE tablename = 'scrolls' AND indexdef ILIKE '%using gin (search)%') AS gin_indexes,\n       (SELECT string_agg(id || ':' || round(ts_rank(search, to_tsquery('english', 'dragon'))::numeric, 4), ', ' ORDER BY id)\n          FROM scrolls WHERE search @@ to_tsquery('english', 'dragon')) AS dragon_hits;",
			},
			hints: [
				"Two statements: `ALTER TABLE ... ADD COLUMN ... GENERATED ALWAYS AS (...) STORED`, then `CREATE INDEX`.",
				"Without STORED the column is VIRTUAL in PostgreSQL 18 and cannot be indexed. The index method is `USING gin`.",
				"ALTER TABLE scrolls ADD COLUMN search tsvector GENERATED ALWAYS AS (setweight(...title..., 'A') || setweight(...body..., 'B')) STORED; CREATE INDEX ON scrolls USING gin (search);",
			],
			explanation:
				"The generated column is recomputed on every INSERT and UPDATE, so it can never drift from the text, and GIN indexes each lexeme. Weight A makes a title hit count more than a body hit in `ts_rank`.\n\n**Pitfall:** the query must use the same config as the column (english); a search with `to_tsquery('simple', ...)` would silently miss stemmed words. **Alternative:** an expression index `USING gin (to_tsvector('english', body))` works too, but every query must repeat the exact same expression.",
		},
		{
			id: "ch35-ex07",
			title: "Isolde or Ysolde?",
			story:
				"A courier hands Wisp a parcel for \"Isolde Maro\". There is no such reader, but the twins Isolde and Ysolde Marrow both look plausible.",
			prompt:
				"Return the **name** and the **similarity** with `'Isolde Maro'` (pg_trgm `similarity`, rounded to 3 decimals) of every reader whose similarity is **above 0.3**, most similar first.",
			difficulty: 3,
			kind: "query",
			concepts: ["trigram-search"],
			solutionSql:
				"SELECT name, round(similarity(name, 'Isolde Maro')::numeric, 3) AS sim\nFROM readers\nWHERE similarity(name, 'Isolde Maro') > 0.3\nORDER BY sim DESC;",
			check: { type: "result", orderMatters: true },
			hints: [
				"`similarity(a, b)` from pg_trgm returns a number between 0 and 1.",
				"Filter on the similarity, then sort it descending. Round with `round(x::numeric, 3)`.",
				"WHERE similarity(name, 'Isolde Maro') > 0.3 ORDER BY similarity(name, 'Isolde Maro') DESC",
			],
			explanation:
				"Trigrams survive typos: *Maro* still shares most of its chunks with *Marrow*. Isolde scores 0.625 and her twin Ysolde 0.368, so the courier should ask before delivering.\n\n**Pitfall:** `name LIKE 'Isolde%'` finds one twin and hides the ambiguity. **Alternative:** `ORDER BY name <-> 'Isolde Maro' LIMIT 3` gives the closest names, and a GiST trigram index can serve it.",
		},
		{
			id: "ch35-ex08",
			title: "It sounded like Steven",
			story:
				"Gorrik the night warden took two messages by ear: one for a *Steven*, one for a *Catherine*. Neither name is in the register as spoken.",
			prompt:
				"Return the **name** of every reader whose **first name** (the part before the first space) either has the same `soundex` code as **Steven**, or is at most **2 edits** away from **catherine** (`levenshtein` on the lower-case first name).",
			difficulty: 3,
			kind: "query",
			concepts: ["fuzzy-string-matching"],
			solutionSql:
				"SELECT name\nFROM readers\nWHERE soundex(split_part(name, ' ', 1)) = soundex('Steven')\n   OR levenshtein(lower(split_part(name, ' ', 1)), 'catherine') <= 2;",
			check: { type: "result" },
			hints: [
				"`split_part(name, ' ', 1)` extracts the first name.",
				"`soundex` encodes how a name sounds (S315 for Steven); `levenshtein` counts single-letter edits.",
				"WHERE soundex(split_part(name, ' ', 1)) = soundex('Steven') OR levenshtein(lower(split_part(name, ' ', 1)), 'catherine') <= 2",
			],
			explanation:
				"Stephen and Steven share the code S315, and Katherine is one edit from catherine.\n\n**Pitfall:** without `lower()`, *Katherine* vs *catherine* already costs an edit for the capital K. soundex is tuned for English names and keeps the first letter, so Catherine (C365) and Katherine (K365) never match by sound: `dmetaphone` gives both K0RN.",
		},
		{
			id: "ch35-ex09",
			title: "Boss: The Librarian's Oracle",
			story:
				"Elowen unveils the Oracle, a single search box for the whole library. A visitor types **dragons** and also mumbles that the scroll was by \"Ellowen Thrise\", hoping the Oracle forgives the spelling.",
			prompt:
				"Search **every** scroll (English and French) and return **id**, **title**, **language** and **rank**:\n\n- each scroll is searched with its own config: `english` for `'en'`, `french` for `'fr'`, on the document `setweight(to_tsvector(cfg, title), 'A') || setweight(to_tsvector(cfg, body), 'B')` and the query `websearch_to_tsquery(cfg, 'dragons')`;\n- a matching scroll's rank is `ts_rank` of that document and query, rounded to 4 decimals;\n- also return scrolls whose **author** has a trigram `similarity` **above 0.4** with `'Ellowen Thrise'`: if they do not match the search, their rank is **0**;\n- each scroll appears once; sort by rank **highest first**, ties by **id**.",
			difficulty: 5,
			kind: "query",
			concepts: [
				"full-text-search",
				"fts-ranking-highlighting",
				"trigram-search",
			],
			solutionSql:
				"WITH docs AS (\n  SELECT s.id, s.title, s.language, s.author,\n         setweight(to_tsvector(c.cfg, s.title), 'A') || setweight(to_tsvector(c.cfg, s.body), 'B') AS doc,\n         websearch_to_tsquery(c.cfg, 'dragons') AS q\n  FROM scrolls s\n  CROSS JOIN LATERAL (SELECT (CASE s.language WHEN 'fr' THEN 'french' ELSE 'english' END)::regconfig AS cfg) c\n)\nSELECT id, title, language,\n       round(CASE WHEN doc @@ q THEN ts_rank(doc, q) ELSE 0 END::numeric, 4) AS rank\nFROM docs\nWHERE doc @@ q\n   OR similarity(author, 'Ellowen Thrise') > 0.4\nORDER BY rank DESC, id;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Pick the config per row: `(CASE language WHEN 'fr' THEN 'french' ELSE 'english' END)::regconfig`. Or write one query per language and UNION ALL them.",
				"Build the weighted document once (a CTE helps), keep rows that match `@@` OR whose author is similar, and give the non-matching ones a rank of 0.",
				"round(CASE WHEN doc @@ q THEN ts_rank(doc, q) ELSE 0 END::numeric, 4) ... WHERE doc @@ q OR similarity(author, 'Ellowen Thrise') > 0.4 ORDER BY rank DESC, id",
			],
			explanation:
				"Each language gets its own stemmer, titles weigh more than bodies (the four scrolls with *Dragon* in the title lead), and the trigram branch rescues Elowen's *On Forbidden Knowledge* even though it never mentions dragons. A scroll found both ways appears once because both tests live in one WHERE.\n\n**Pitfall:** a UNION ALL of the search hits and the author hits lists *On the Nesting of Dragons* twice; ranking the body alone drops the title boost and reshuffles the top. **Alternative:** `UNION` of the two branches followed by `max(rank)` per id.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch35-pr01",
			title: "Monsters of the deep",
			prompt:
				"Return **one number**: how many **English** scrolls match **kraken** or **serpent** (english config).",
			difficulty: 1,
			kind: "query",
			concepts: ["full-text-search"],
			solutionSql:
				"SELECT count(*)\nFROM scrolls\nWHERE language = 'en'\n  AND to_tsvector('english', body) @@ to_tsquery('english', 'kraken | serpent');",
			check: { type: "result" },
			hints: [
				"Either word is enough.",
				"The tsquery operator for *or* is `|`.",
				"to_tsquery('english', 'kraken | serpent')",
			],
			explanation:
				"Three scrolls: two krakens and the scroll of sea serpents, whose plural is stemmed to `serpent`.",
		},
		{
			id: "ch35-pr02",
			title: "Every kind of burn",
			prompt:
				"Return the **id** and **title** of every **English** scroll whose body contains any form of **burn** (burn, burns, burned, burning), using full-text search with the english config.",
			difficulty: 2,
			kind: "query",
			concepts: ["full-text-search"],
			starterSql:
				"SELECT id, title\nFROM scrolls\nWHERE language = 'en'\n  AND body ILIKE '%burned%';",
			solutionSql:
				"SELECT id, title\nFROM scrolls\nWHERE language = 'en'\n  AND to_tsvector('english', body) @@ to_tsquery('english', 'burn');",
			check: { type: "result" },
			hints: [
				"The starter only knows one spelling.",
				"The english stemmer reduces every form to the same lexeme.",
				"to_tsvector('english', body) @@ to_tsquery('english', 'burn')",
			],
			explanation:
				"Stemming maps *burning*, *burned* and *burns* to `burn`: six scrolls instead of two.",
		},
		{
			id: "ch35-pr03",
			title: "Densest frost",
			prompt:
				"Return the **id** and **title** of the **2** English scrolls with the highest `ts_rank_cd` for `to_tsquery('english', 'frost')`, highest first, ties by id.",
			difficulty: 2,
			kind: "query",
			concepts: ["fts-ranking-highlighting"],
			solutionSql:
				"SELECT id, title\nFROM scrolls, to_tsquery('english', 'frost') AS q\nWHERE language = 'en'\n  AND to_tsvector('english', body) @@ q\nORDER BY ts_rank_cd(to_tsvector('english', body), q) DESC, id\nLIMIT 2;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Filter with `@@`, sort by the rank, keep 2.",
				"`ts_rank_cd(vector, query)` is the cover density rank.",
				"ORDER BY ts_rank_cd(to_tsvector('english', body), q) DESC, id LIMIT 2",
			],
			explanation:
				"*Frost and Silence* and *The War of Ash and Frost* mention frost twice and tie at the top; the id breaks the tie.",
		},
		{
			id: "ch35-pr04",
			title: "Short snippets",
			prompt:
				"Return the **title** and `ts_headline('english', body, q, 'StartSel=<<, StopSel=>>, MaxWords=8, MinWords=4')` of every English scroll matching `to_tsquery('english', 'frost')`.",
			difficulty: 2,
			kind: "query",
			concepts: ["fts-ranking-highlighting"],
			solutionSql:
				"SELECT title, ts_headline('english', body, q, 'StartSel=<<, StopSel=>>, MaxWords=8, MinWords=4')\nFROM scrolls, to_tsquery('english', 'frost') AS q\nWHERE language = 'en'\n  AND to_tsvector('english', body) @@ q;",
			check: { type: "result" },
			hints: [
				"Filter first, then build the snippet.",
				"The options string controls markers and length.",
				"ts_headline('english', body, q, 'StartSel=<<, StopSel=>>, MaxWords=8, MinWords=4')",
			],
			explanation:
				"`MaxWords` and `MinWords` keep each snippet short enough for a result list.",
		},
		{
			id: "ch35-pr05",
			title: "An index that refuses",
			story:
				"Hakon tried to index the bodies and got error 42P17. Fix his statement so the planner can use the index for English searches.",
			prompt:
				"Create a **GIN expression index** on `scrolls` that serves `WHERE to_tsvector('english', body) @@ ...`.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["fts-indexing"],
			setupSql: PLAN_HELPER,
			starterSql:
				"CREATE INDEX scrolls_body_fts ON scrolls USING gin (to_tsvector(body));",
			solutionSql:
				"CREATE INDEX scrolls_body_fts ON scrolls USING gin (to_tsvector('english', body));",
			check: {
				type: "state",
				verifySql:
					"SET enable_seqscan = off;\nSELECT plan_text($q$SELECT id FROM scrolls WHERE to_tsvector('english', body) @@ to_tsquery('english', 'dragon')$q$) ~ 'Bitmap Index Scan' AS index_used;",
			},
			hints: [
				"Read the error: functions in an index expression must be IMMUTABLE.",
				"The one-argument `to_tsvector` depends on a setting; the two-argument form does not.",
				"USING gin (to_tsvector('english', body))",
			],
			explanation:
				"With the config spelled out the expression is IMMUTABLE and the planner can match it, but only if queries use exactly `to_tsvector('english', body)`.",
		},
		{
			id: "ch35-pr06",
			title: "Close enough",
			prompt:
				"Return the **name** of every reader whose name is trigram-similar to `'Isold'` using the `%` operator (default threshold 0.3).",
			difficulty: 2,
			kind: "query",
			concepts: ["trigram-search"],
			solutionSql: "SELECT name FROM readers WHERE name % 'Isold';",
			check: { type: "result" },
			hints: [
				"pg_trgm adds an operator that means *similar enough*.",
				"`a % b` is true when `similarity(a, b)` is above `pg_trgm.similarity_threshold`.",
				"WHERE name % 'Isold'",
			],
			explanation:
				"Only Isolde Marrow passes: Ysolde starts with a different letter, which costs her the leading trigrams.",
		},
		{
			id: "ch35-pr07",
			title: "Predict the trigrams",
			prompt:
				"Return **one value**: `similarity('Ysolde', 'Isolde')`, rounded to 2 decimals.",
			difficulty: 1,
			kind: "query",
			concepts: ["trigram-search"],
			solutionSql: "SELECT round(similarity('Ysolde', 'Isolde')::numeric, 2);",
			check: { type: "result" },
			hints: [
				"Just compute it.",
				"`round(x::numeric, 2)`",
				"SELECT round(similarity('Ysolde', 'Isolde')::numeric, 2);",
			],
			explanation:
				"0.4: each word has 7 trigrams (with padding) and they share 4 of them, so `4 / (7 + 7 - 4)`. One letter at the start breaks three trigrams.",
		},
		{
			id: "ch35-pr08",
			title: "The twins",
			prompt:
				"Return the **name** of every reader whose **first name** is at most **1 edit** away from **Isolde** (`levenshtein`).",
			difficulty: 2,
			kind: "query",
			concepts: ["fuzzy-string-matching"],
			solutionSql:
				"SELECT name FROM readers WHERE levenshtein(split_part(name, ' ', 1), 'Isolde') <= 1;",
			check: { type: "result" },
			hints: [
				"Take the first name with `split_part`.",
				"`levenshtein(a, b)` counts insertions, deletions and substitutions.",
				"WHERE levenshtein(split_part(name, ' ', 1), 'Isolde') <= 1",
			],
			explanation:
				"Both twins: Isolde (0 edits) and Ysolde (1 substitution). Edit distance sees them as close, trigrams much less.",
		},
		{
			id: "ch35-pr09",
			title: "Céleste without the accent",
			prompt:
				"Return the **name** of every reader whose name, **with accents removed**, starts with `Celeste`.",
			difficulty: 1,
			kind: "query",
			concepts: ["fuzzy-string-matching"],
			solutionSql: "SELECT name FROM readers WHERE unaccent(name) LIKE 'Celeste%';",
			check: { type: "result" },
			hints: [
				"`'Céleste' LIKE 'Celeste%'` is false: é is not e.",
				"The unaccent extension strips accents.",
				"WHERE unaccent(name) LIKE 'Celeste%'",
			],
			explanation: "`unaccent('Céleste Duvall')` is `Celeste Duvall`. The original name is still returned untouched.",
		},
	],
};

export default chapter;
