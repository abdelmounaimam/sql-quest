import type { Chapter } from "../types";

// Verify helpers (SQL fragments). `q` is a query already escaped for a SQL string literal.
const INDEX_NODES = "ARRAY['Index Scan', 'Index Only Scan', 'Bitmap Index Scan']";
const usesIndex = (q: string) => `plan_nodes('${q}') && ${INDEX_NODES}`;
const noSort = (q: string) => `array_to_string(plan_nodes('${q}'), ',') NOT LIKE '%Sort%'`;
const planIndexes = (q: string) =>
	`jsonb_array_elements_text(jsonb_path_query_array(plan_json('${q}'), 'strict $.**."Index Name"')) AS u(name) JOIN pg_class c ON c.relname = u.name`;
const usesAm = (q: string, am: string) =>
	`EXISTS (SELECT 1 FROM ${planIndexes(q)} JOIN pg_am a ON a.oid = c.relam WHERE a.amname = '${am}')`;
const usesPartial = (q: string) =>
	`EXISTS (SELECT 1 FROM ${planIndexes(q)} JOIN pg_index i ON i.indexrelid = c.oid WHERE i.indpred IS NOT NULL)`;
const attnum = (table: string, col: string) =>
	`(SELECT attnum FROM pg_attribute WHERE attrelid = '${table}'::regclass AND attname = '${col}')`;
const keyStartsWith = (table: string, a: string, b: string) =>
	`EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = '${table}'::regclass AND i.indnkeyatts >= 2 AND i.indkey[0] = ${attnum(table, a)} AND i.indkey[1] = ${attnum(table, b)})`;
const extraIndexes = "(SELECT count(*) FROM pg_index WHERE indrelid = 'run_archive'::regclass AND NOT indisprimary)";
const isIndexOnly = (q: string) => `'Index Only Scan' = ANY (plan_nodes('${q}'))`;

const Q_SEED = "SELECT id, player_id, score FROM run_archive WHERE seed = 3007215346";
const Q_BOARD = "SELECT id, score FROM run_archive WHERE season_id = 3 ORDER BY score DESC LIMIT 10";
const Q_PAIR = "SELECT * FROM run_archive WHERE player_id = 20 AND dungeon_id = 3";
const Q_LIVE = "SELECT id, started_at FROM run_archive WHERE status = ''in_progress'' ORDER BY started_at";
const Q_LAVA = "SELECT * FROM run_archive WHERE lower(death_cause) = ''lava golem''";
const Q_COVER = "SELECT player_id, score FROM run_archive WHERE player_id = 20";
const Q_CURSED = "SELECT id FROM run_archive WHERE tags @> ''{cursed}''";
const Q_DAY =
	"SELECT count(*) FROM run_archive WHERE started_at >= ''2025-06-01'' AND started_at < ''2025-06-02''";
const Q_HIGH1 = "SELECT count(*) FROM run_archive WHERE season_id = 1 AND score >= 5000";

const chapter: Chapter = {
	id: "ch38-index-forging",
	order: 38,
	world: "The Clockwork Engine",
	tier: "expert",
	track: "performance",
	title: "Index Forging",
	subtitle: "B-tree indexes, multicolumn order, partial, expression and covering indexes, GIN, GiST, BRIN and hash",
	emoji: "🗝️",
	datasetId: "dungeon",
	concepts: [
		"btree-index",
		"multicolumn-index",
		"partial-index",
		"expression-index",
		"covering-index",
		"gin-gist-brin-hash",
	],
	prerequisites: ["ch37-reading-the-runes"],
	lesson: [
		{
			kind: "explain",
			title: "The B-tree index",
			body: "An index is a separate structure that Postgres keeps in sync with the table. The default type, the **B-tree**, stores the column's values **sorted**, with a pointer to each row, and its leaves are linked in order.\n\nSo it serves `=`, ranges (`<`, `BETWEEN`), `ORDER BY ... LIMIT` and `LIKE 'prefix%'`.\n\nThe cost: disk space, and every INSERT, UPDATE and DELETE must update the index too.",
		},
		{
			kind: "example",
			title: "One index, three plans",
			body: "One index on `score`. The high score filter uses a Bitmap scan; the top 5 query has **no Sort**, because the index already holds scores in order (read backwards); the `dungeon_id` filter cannot use this index at all.",
			sql: "CREATE INDEX run_archive_score_idx ON run_archive (score);\nSELECT plan_nodes('SELECT * FROM run_archive WHERE score >= 5200') AS top_scores,\n       plan_nodes('SELECT * FROM run_archive ORDER BY score DESC LIMIT 5') AS podium,\n       plan_nodes('SELECT * FROM run_archive WHERE dungeon_id = 2') AS untouched;",
		},
		{
			kind: "explain",
			title: "Multicolumn indexes: column order matters",
			body: "`CREATE INDEX ON run_archive (season_id, score)` sorts by season, then by score **within** each season, like a phone book sorted by last name then first name.\n\nRule: **equality columns first, then the range or sort column**. The index serves `season_id = 3` alone, but not `score` alone (or only poorly).\n\nTwo single column indexes are not the same as one composite index: remember the BitmapAnd.",
		},
		{
			kind: "quiz",
			question:
				"A query runs `WHERE season_id = 3 ORDER BY score DESC LIMIT 10`. Which index lets it read just 10 entries, with no Sort?",
			choices: [
				"`(score, season_id)`",
				"`(season_id, score)`",
				"Two indexes: `(season_id)` and `(score)`",
				"`(season_id)` alone",
			],
			answerIndex: 1,
			explanation:
				"Inside `(season_id, score)`, the season 3 entries are adjacent and already sorted by score: jump there, read 10 backwards, stop. With score first, season 3 is spread across the whole index; separate indexes cannot return a filtered set in sorted order.",
		},
		{
			kind: "explain",
			title: "Partial indexes",
			body: "A partial index covers only the rows that match its WHERE clause. Only 2% of rows in `run_archive` have `status = 'in_progress'`:\n```sql\nCREATE INDEX run_archive_live_idx ON run_archive (started_at)\nWHERE status = 'in_progress';\n```\nThe index is small and cheap to maintain. The planner uses it only when the query's WHERE **implies** the index's WHERE (`status = 'in_progress'` here).",
		},
		{
			kind: "explain",
			title: "Expression indexes",
			body: "An index on `death_cause` is useless for `WHERE lower(death_cause) = 'lava golem'`: the index holds `Lava Golem`, not `lava golem`. Index the expression itself:\n```sql\nCREATE INDEX ON run_archive (lower(death_cause));\n```\nThe query must use the **same** expression. The expression must also be IMMUTABLE: `(started_at::date)` fails with 42P17, because that cast depends on the session time zone.",
		},
		{
			kind: "explain",
			title: "Covering indexes and the visibility map",
			body: "`CREATE INDEX ON run_archive (player_id) INCLUDE (score)` stores `score` in the leaves. A query that needs only `player_id` and `score` can skip the table: an **Index Only Scan**.\n\nCatch: the index cannot tell if a row is visible to your transaction. The **visibility map**, filled by `VACUUM`, marks whole pages as visible. Autovacuum never runs here, so call `VACUUM run_archive;` yourself, as its own statement.",
		},
		{
			kind: "example",
			title: "An Index Only Scan",
			body: "Before the VACUUM, the plan would be a Bitmap Heap Scan that visits the table. After it: an Index Only Scan.",
			sql: "CREATE INDEX run_archive_player_cover_idx ON run_archive (player_id) INCLUDE (score);\nVACUUM run_archive;\nSELECT plan_nodes('SELECT player_id, score FROM run_archive WHERE player_id = 20');",
		},
		{
			kind: "explain",
			title: "Other index types",
			body: "`CREATE INDEX ... USING <method> (col)`:\n- **gin**: many keys per row: arrays (`tags @> '{cursed}'`), jsonb, text search.\n- **gist**: ranges and geometry (`during && ...`), exclusion constraints.\n- **brin**: one summary per block of pages; very small, good for large tables physically ordered by the column (`started_at` grows with `id`).\n- **hash**: equality only, no ranges, no sorting.",
		},
		{
			kind: "try",
			title: "Try it: index a filter column",
			prompt:
				"Create an index so that `SELECT * FROM run_archive WHERE player_id = 20` no longer uses a Seq Scan.",
			starterSql: "SELECT plan_nodes('SELECT * FROM run_archive WHERE player_id = 20');",
			solutionSql: "CREATE INDEX run_archive_player_idx ON run_archive (player_id);",
			check: {
				type: "state",
				verifySql: `SELECT ${usesIndex("SELECT * FROM run_archive WHERE player_id = 20")} AS uses_index;`,
			},
			hints: [
				"The filter is on player_id: index that column.",
				"CREATE INDEX run_archive_player_idx ON run_archive (player_id);",
			],
		},
	],
	exercises: [
		{
			id: "ch38-ex01",
			title: "Create a B-tree index for equality",
			prompt: `Create an index so that \`${Q_SEED}\` uses an index instead of a Seq Scan.`,
			difficulty: 1,
			kind: "ddl",
			concepts: ["btree-index"],
			starterSql: `SELECT plan_nodes('${Q_SEED}');`,
			solutionSql: "CREATE INDEX run_archive_seed_idx ON run_archive (seed);",
			check: { type: "state", verifySql: `SELECT ${usesIndex(Q_SEED)} AS uses_index;` },
			hints: [
				"Run the starter: Seq Scan. Which column does the WHERE filter on?",
				"A B-tree on the filtered column turns the search into a tree walk.",
				"CREATE INDEX run_archive_seed_idx ON run_archive (seed);",
			],
			explanation:
				"With a B-tree on `seed`, the lookup reads a few pages instead of 1786. Seeds are unique, so this is the ideal B-tree case.\n\n**Pitfall:** indexing every column \"just in case\" (the Index Shotgun antipattern): each index slows every write and most are never used.\n\n**Alternative:** `CREATE UNIQUE INDEX` also documents that seeds never repeat, and a hash index works for pure equality.",
		},
		{
			id: "ch38-ex02",
			title: "Composite index for filter and sort",
			prompt: `Create **one composite index** so that \`${Q_BOARD}\` uses an index and needs **no Sort**. Put the columns in the order given by the rule: equality columns first, then the sort column.`,
			difficulty: 3,
			kind: "ddl",
			concepts: ["multicolumn-index"],
			starterSql: `SELECT plan_nodes('${Q_BOARD}');`,
			solutionSql: "CREATE INDEX run_archive_season_score_idx ON run_archive (season_id, score DESC);",
			check: {
				type: "state",
				verifySql: `SELECT ${usesIndex(Q_BOARD)} AS uses_index,\n       ${noSort(Q_BOARD)} AS no_sort,\n       ${keyStartsWith("run_archive", "season_id", "score")} AS equality_first;`,
			},
			hints: [
				"Run the starter: Limit, Sort, Seq Scan. One column is filtered by equality, the other sorts.",
				"Equality column first, sort column second.",
				"CREATE INDEX ... ON run_archive (season_id, score DESC);",
			],
			explanation:
				"The index jumps to season 3 and reads its scores already sorted: 10 entries, then stop. `score` or `score DESC` both work, since a B-tree can be read in both directions.\n\n**Pitfall:** `(score DESC, season_id)`. PostgreSQL 18 can still avoid the Sort with a *skip scan*, but it walks the top scores of every season and filters; on a large table that reads far more pages. And `(season_id)` alone still sorts all of season 3.\n\n**Alternative:** `(season_id, score DESC, id)` also gives a stable order for ties.",
		},
		{
			id: "ch38-ex03",
			title: "Replace two indexes with one composite",
			prompt: `The starter creates two separate indexes, and the plan shows a BitmapAnd scanning both. Fix it: leave **exactly one** index on \`run_archive\` besides the primary key, such that \`${Q_PAIR}\` uses a **single index for both conditions** (no BitmapAnd).`,
			difficulty: 3,
			kind: "ddl",
			concepts: ["multicolumn-index"],
			starterSql:
				"CREATE INDEX run_archive_player_idx ON run_archive (player_id);\nCREATE INDEX run_archive_dungeon_idx ON run_archive (dungeon_id);",
			solutionSql: "CREATE INDEX run_archive_player_dungeon_idx ON run_archive (player_id, dungeon_id);",
			check: {
				type: "state",
				verifySql: `SELECT ${extraIndexes} AS extra_indexes,\n       NOT ('BitmapAnd' = ANY (plan_nodes('${Q_PAIR}'))) AS no_bitmap_and,\n       (SELECT string_agg(ic, ' ') FROM jsonb_array_elements_text(jsonb_path_query_array(plan_json('${Q_PAIR}'), 'strict $.**."Index Cond"')) AS x(ic)) LIKE ALL (ARRAY['%player_id%', '%dungeon_id%']) AS both_in_index;`,
			},
			hints: [
				"Run the starter, then plan_nodes of the query: BitmapAnd over two Bitmap Index Scans.",
				"One index can hold both columns; with two equality conditions, both orders work.",
				"CREATE INDEX ... ON run_archive (player_id, dungeon_id); and nothing else.",
			],
			explanation:
				"The composite index jumps straight to the 566 entries of player 20 in dungeon 3. The two single indexes each listed all their matches (2 896 for the player, 20 000 for the dungeon) before the BitmapAnd discarded most of them.\n\n**Pitfall:** keeping only `(player_id)`: the dungeon 3 condition becomes a recheck on every row of player 20.\n\n**Alternative:** `(dungeon_id, player_id)` is just as good here; pick the order that also serves your other queries (player first also serves `WHERE player_id = 20` alone).",
		},
		{
			id: "ch38-ex04",
			title: "Create a partial index",
			prompt: `Create a **partial index** so that \`SELECT id, started_at FROM run_archive WHERE status = 'in_progress' ORDER BY started_at\` uses it and needs **no Sort**.`,
			difficulty: 3,
			kind: "ddl",
			concepts: ["partial-index"],
			starterSql:
				"CREATE INDEX run_archive_status_idx ON run_archive (status, started_at);",
			solutionSql:
				"CREATE INDEX run_archive_live_idx ON run_archive (started_at) WHERE status = 'in_progress';",
			check: {
				type: "state",
				verifySql: `SELECT ${usesPartial(Q_LIVE)} AS uses_partial,\n       ${noSort(Q_LIVE)} AS no_sort;`,
			},
			hints: [
				"The starter indexes all 100 000 rows. Only the in progress ones are ever queried.",
				"Add a WHERE clause to CREATE INDEX; index the column the query sorts by.",
				"CREATE INDEX ... ON run_archive (started_at) WHERE status = 'in_progress';",
			],
			explanation:
				"The partial index holds 2 000 entries, already sorted by `started_at`: the plan is a single Index Scan. It is about 50 times smaller than a full index and costs nothing when rows with another status are written.\n\n**Pitfall:** a query with `status = $1` (a parameter) cannot prove it matches the index predicate; partial indexes need the literal condition.\n\n**Alternative:** `UNIQUE ... WHERE` is the classic way to enforce \"unique among active rows only\".",
		},
		{
			id: "ch38-ex05",
			title: "Create an expression index",
			prompt: `An index on \`death_cause\` already exists but the query below does not use it. Create an index so that \`SELECT * FROM run_archive WHERE lower(death_cause) = 'lava golem'\` uses it.`,
			difficulty: 3,
			kind: "ddl",
			concepts: ["expression-index"],
			starterSql: "CREATE INDEX run_archive_death_idx ON run_archive (death_cause);",
			solutionSql: "CREATE INDEX run_archive_death_lower_idx ON run_archive (lower(death_cause));",
			check: { type: "state", verifySql: `SELECT ${usesIndex(Q_LAVA)} AS uses_index;` },
			hints: [
				"Run the starter, then plan_nodes of the query: still a Seq Scan.",
				"The index must hold exactly what the WHERE compares: the lowercased value.",
				"CREATE INDEX ... ON run_archive (lower(death_cause));",
			],
			explanation:
				"The expression index stores `lower(death_cause)` for each row, so the comparison matches index entries directly.\n\n**Pitfall:** the query must repeat the exact expression: `upper(death_cause) = 'LAVA GOLEM'` or `death_cause ILIKE 'lava golem'` will not use it.\n\n**Alternative:** a `citext` column (like `players.handle`) compares case insensitively with a plain index.",
		},
		{
			id: "ch38-ex06",
			title: "Get an Index Only Scan",
			prompt: `Make \`${Q_COVER}\` run as an **Index Only Scan**.`,
			difficulty: 4,
			kind: "ddl",
			concepts: ["covering-index"],
			starterSql: "CREATE INDEX run_archive_player_cover_idx ON run_archive (player_id) INCLUDE (score);",
			solutionSql:
				"CREATE INDEX run_archive_player_cover_idx ON run_archive (player_id) INCLUDE (score);\nVACUUM run_archive;",
			check: { type: "state", verifySql: `SELECT ${isIndexOnly(Q_COVER)} AS index_only;` },
			hints: [
				"Run the starter, then plan_nodes: a Bitmap Heap Scan still visits the table.",
				"The index has every column, but Postgres cannot yet trust that each row is visible: the visibility map is empty.",
				"Add VACUUM run_archive; as its own statement after the CREATE INDEX.",
			],
			explanation:
				"`INCLUDE (score)` stores score in the index leaves; `VACUUM` marks all pages all visible, so the index alone can answer: an Index Only Scan with zero heap fetches.\n\n**Pitfall:** expecting index only scans on a freshly loaded table. On a real server autovacuum eventually catches up; here nothing runs unless you ask.\n\n**Alternative:** `(player_id, score)` as two key columns also covers the query and can even serve `ORDER BY score`.",
		},
		{
			id: "ch38-ex07",
			title: "Create GIN and BRIN indexes",
			prompt: `Create two indexes:\n\n1. one so that \`SELECT id FROM run_archive WHERE tags @> '{cursed}'\` uses a **GIN** index;\n2. one so that \`SELECT count(*) FROM run_archive WHERE started_at >= '2025-06-01' AND started_at < '2025-06-02'\` uses a **BRIN** index.`,
			difficulty: 4,
			kind: "ddl",
			concepts: ["gin-gist-brin-hash"],
			starterSql: "CREATE INDEX run_archive_tags_idx ON run_archive (tags);",
			solutionSql:
				"CREATE INDEX run_archive_tags_gin ON run_archive USING gin (tags);\nCREATE INDEX run_archive_started_brin ON run_archive USING brin (started_at);",
			check: {
				type: "state",
				verifySql: `SELECT ${usesAm(Q_CURSED, "gin")} AS cursed_by_gin,\n       ${usesAm(Q_DAY, "brin")} AS day_by_brin;`,
			},
			hints: [
				"A B-tree on an array compares whole arrays; it cannot answer \"contains\".",
				"Name the access method: CREATE INDEX ... USING gin (...) and USING brin (...).",
				"USING gin (tags) and USING brin (started_at).",
			],
			explanation:
				"GIN stores one entry per array element, so `@>` jumps straight to the rows tagged `cursed`. BRIN keeps only the min and max `started_at` of each block of pages (a few kilobytes for the whole table): since rows are stored in time order, a one day range skips almost every block.\n\n**Pitfall:** BRIN on a column in random physical order (like `score`) is useless: every block's range covers everything.\n\n**Alternative:** a B-tree on `started_at` answers the day count too, at about 200 times the size.",
		},
		{
			id: "ch38-ex08",
			title: "Boss: The Smith's Masterwork",
			story:
				"Combines composite, covering, partial and GIN indexes under a budget of three indexes for four queries.",
			prompt: `Create **at most 3 indexes** on \`run_archive\` so that:\n\n1. \`${Q_BOARD}\` uses an index with **no Sort**;\n2. \`${Q_HIGH1}\` is an **Index Only Scan**;\n3. \`SELECT id, started_at FROM run_archive WHERE status = 'in_progress' ORDER BY started_at\` uses a **partial** index with no Sort;\n4. \`SELECT id FROM run_archive WHERE tags @> '{cursed}'\` uses a **GIN** index.`,
			difficulty: 5,
			kind: "ddl",
			concepts: ["multicolumn-index", "covering-index", "partial-index", "gin-gist-brin-hash"],
			solutionSql:
				"CREATE INDEX run_archive_season_score_idx ON run_archive (season_id, score);\nCREATE INDEX run_archive_live_idx ON run_archive (started_at) WHERE status = 'in_progress';\nCREATE INDEX run_archive_tags_gin ON run_archive USING gin (tags);\nVACUUM run_archive;",
			check: {
				type: "state",
				verifySql: `SELECT ${usesIndex(Q_BOARD)} AND ${noSort(Q_BOARD)} AS podium,\n       ${isIndexOnly(Q_HIGH1)} AS high_scores,\n       ${usesPartial(Q_LIVE)} AND ${noSort(Q_LIVE)} AS live_board,\n       ${usesAm(Q_CURSED, "gin")} AS cursed,\n       ${extraIndexes} <= 3 AS within_budget;`,
			},
			hints: [
				"Four queries, three indexes: one index must serve two queries. Which two filter on the same column?",
				"Queries 1 and 2 both filter `season_id =` and then use `score`: one composite with season_id first serves both, and covers query 2 entirely.",
				"(season_id, score), a partial (started_at) WHERE status = 'in_progress', a GIN on tags; VACUUM run_archive; if the Index Only Scan does not appear.",
			],
			explanation:
				"`(season_id, score)` is the key index: it returns the season 3 top 10 in order **and** answers the season 1 count from the index alone, since that query needs no other column. The partial index and the GIN index cover the rest.\n\n**Pitfall:** one index per query. Four indexes would work, but each costs space and slows every insert.\n\n**Alternative:** `(season_id, score DESC)` serves both just as well.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch38-pr01",
			title: "Index a range filter",
			prompt:
				"Create an index so that `SELECT id, score FROM run_archive WHERE score >= 5200` uses an index.",
			difficulty: 1,
			kind: "ddl",
			concepts: ["btree-index"],
			solutionSql: "CREATE INDEX run_archive_score_idx ON run_archive (score);",
			check: {
				type: "state",
				verifySql: `SELECT ${usesIndex("SELECT id, score FROM run_archive WHERE score >= 5200")} AS uses_index;`,
			},
			hints: [
				"A range on one column.",
				"B-trees serve ranges.",
				"CREATE INDEX ... ON run_archive (score);",
			],
			explanation:
				"326 rows out of 100 000: a range scan on a B-tree finds them without reading the rest.",
		},
		{
			id: "ch38-pr02",
			title: "Top N without a Sort",
			prompt:
				"Create an index so that `SELECT id, score FROM run_archive ORDER BY score DESC LIMIT 5` uses an index and has **no Sort** node.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["btree-index"],
			solutionSql: "CREATE INDEX run_archive_score_idx ON run_archive (score);",
			check: {
				type: "state",
				verifySql: `SELECT ${usesIndex("SELECT id, score FROM run_archive ORDER BY score DESC LIMIT 5")} AND ${noSort("SELECT id, score FROM run_archive ORDER BY score DESC LIMIT 5")} AS sorted_by_index;`,
			},
			hints: [
				"A B-tree keeps its keys sorted.",
				"It can be read backwards for DESC.",
				"CREATE INDEX ... ON run_archive (score);",
			],
			explanation:
				"Limit over an Index Scan Backward: read 5 entries from the top, stop. Without the index, all 100 000 rows get sorted to keep 5.",
		},
		{
			id: "ch38-pr03",
			title: "Composite index for equality and range",
			prompt:
				"Create a composite index so that `SELECT id FROM run_archive WHERE region = 'sa' AND started_at >= '2025-12-01'` uses it, with the columns in the right order.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["multicolumn-index"],
			solutionSql: "CREATE INDEX run_archive_region_started_idx ON run_archive (region, started_at);",
			check: {
				type: "state",
				verifySql: `SELECT ${usesIndex("SELECT id FROM run_archive WHERE region = ''sa'' AND started_at >= ''2025-12-01''")} AS uses_index,\n       ${keyStartsWith("run_archive", "region", "started_at")} AS equality_first;`,
			},
			hints: [
				"One equality condition, one range condition.",
				"Equality column first.",
				"CREATE INDEX ... ON run_archive (region, started_at);",
			],
			explanation:
				"With `region` first, all `sa` rows are contiguous and sorted by time: the range is one slice. With `started_at` first, the scan would walk every region's December rows and filter.",
		},
		{
			id: "ch38-pr04",
			title: "Partial index with a range key",
			prompt:
				"Create a **partial** index so that `SELECT id FROM run_archive WHERE status = 'abandoned' AND score > 4800` uses it.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["partial-index"],
			solutionSql: "CREATE INDEX run_archive_abandoned_score_idx ON run_archive (score) WHERE status = 'abandoned';",
			check: {
				type: "state",
				verifySql: `SELECT ${usesPartial("SELECT id FROM run_archive WHERE status = ''abandoned'' AND score > 4800")} AS uses_partial;`,
			},
			hints: [
				"Only abandoned rows matter.",
				"Put the status condition in the index's WHERE, the score in its key.",
				"CREATE INDEX ... ON run_archive (score) WHERE status = 'abandoned';",
			],
			explanation:
				"The index holds only the 10 000 abandoned rows, sorted by score: the query's `status = 'abandoned'` matches the predicate, and `score > 4800` is a range inside it.",
		},
		{
			id: "ch38-pr05",
			title: "Non immutable expression index",
			prompt:
				"Run `CREATE INDEX ON run_archive ((started_at::date));` and let Postgres reject it (this exercise expects the error).",
			difficulty: 2,
			kind: "ddl",
			concepts: ["expression-index"],
			solutionSql: "CREATE INDEX ON run_archive ((started_at::date));",
			check: { type: "error", sqlstate: "42P17" },
			hints: [
				"Just run the statement from the prompt.",
				"The error mentions IMMUTABLE functions.",
				"CREATE INDEX ON run_archive ((started_at::date));",
			],
			explanation:
				"`started_at` is a timestamptz: which date it falls on depends on the session `TimeZone`, so the cast is only STABLE. An index must always give the same answer: 42P17. Fix it by naming the zone (next exercise).",
		},
		{
			id: "ch38-pr06",
			title: "Immutable date expression index",
			prompt:
				"Create an expression index so that `SELECT id FROM run_archive WHERE (started_at AT TIME ZONE 'UTC')::date = '2025-06-01'` uses it.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["expression-index"],
			solutionSql: "CREATE INDEX run_archive_utc_day_idx ON run_archive (((started_at AT TIME ZONE 'UTC')::date));",
			check: {
				type: "state",
				verifySql: `SELECT ${usesIndex("SELECT id FROM run_archive WHERE (started_at AT TIME ZONE ''UTC'')::date = ''2025-06-01''")} AS uses_index;`,
			},
			hints: [
				"Index exactly the expression the query uses.",
				"An expression in CREATE INDEX needs its own parentheses.",
				"CREATE INDEX ... ON run_archive (((started_at AT TIME ZONE 'UTC')::date));",
			],
			explanation:
				"With the zone written out, the expression no longer depends on any setting: it is IMMUTABLE and indexable. The query must use the same expression to benefit.",
		},
		{
			id: "ch38-pr07",
			title: "Covering index with INCLUDE",
			prompt:
				"Make `SELECT player_id, dungeon_id FROM run_archive WHERE player_id = 20` run as an **Index Only Scan**.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["covering-index"],
			solutionSql:
				"CREATE INDEX run_archive_player_dungeon_cover ON run_archive (player_id) INCLUDE (dungeon_id);\nVACUUM run_archive;",
			check: {
				type: "state",
				verifySql: `SELECT ${isIndexOnly("SELECT player_id, dungeon_id FROM run_archive WHERE player_id = 20")} AS index_only;`,
			},
			hints: [
				"The index must hold both columns the query reads.",
				"And the visibility map must mark the pages as all visible.",
				"(player_id) INCLUDE (dungeon_id), then VACUUM run_archive; on its own.",
			],
			explanation:
				"INCLUDE puts `dungeon_id` in the leaves; VACUUM fills the visibility map. Both are needed for the Index Only Scan.",
		},
		{
			id: "ch38-pr08",
			title: "Create a hash index",
			prompt:
				"Create a **hash** index so that `SELECT id FROM run_archive WHERE seed = 3007215346` uses it.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["gin-gist-brin-hash"],
			solutionSql: "CREATE INDEX run_archive_seed_hash ON run_archive USING hash (seed);",
			check: {
				type: "state",
				verifySql: `SELECT ${usesAm("SELECT id FROM run_archive WHERE seed = 3007215346", "hash")} AS by_hash;`,
			},
			hints: [
				"Seeds are only ever compared with `=`.",
				"Choose the access method with USING.",
				"CREATE INDEX ... ON run_archive USING hash (seed);",
			],
			explanation:
				"A hash index answers equality only: no ranges, no ORDER BY, no uniqueness. For a value looked up exactly, it is a valid and compact alternative to a B-tree.",
		},
		{
			id: "ch38-pr09",
			title: "GiST index on a range column",
			prompt:
				"Create a **GiST** index on the `during` column of `seasons` (a tstzrange).",
			difficulty: 2,
			kind: "ddl",
			concepts: ["gin-gist-brin-hash"],
			solutionSql: "CREATE INDEX seasons_during_gist ON seasons USING gist (during);",
			check: {
				type: "state",
				verifySql:
					"SELECT count(*) AS gist_on_during FROM pg_indexes WHERE tablename = 'seasons' AND indexdef LIKE '%USING gist (during)%';",
			},
			hints: [
				"Ranges are served by GiST, not B-tree, for overlap (`&&`) and containment (`@>`).",
				"USING gist.",
				"CREATE INDEX ... ON seasons USING gist (during);",
			],
			explanation:
				"GiST indexes ranges for `&&` and `@>`, the operators behind \"which season contains this timestamp\". With four seasons the planner ignores it, but on a table of millions of rows it pays off (and it powers exclusion constraints).",
		},
	],
};

export default chapter;
