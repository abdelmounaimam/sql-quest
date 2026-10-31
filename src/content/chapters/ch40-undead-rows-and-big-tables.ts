import type { Chapter } from "../types";

const INDEX_NODES = "ARRAY['Index Scan', 'Index Only Scan', 'Bitmap Index Scan']";
const usesIndex = (q: string) => `plan_nodes('${q}') && ${INDEX_NODES}`;
const noSort = (q: string) => `array_to_string(plan_nodes('${q}'), ',') NOT LIKE '%Sort%'`;
const usesPartial = (q: string) =>
	`EXISTS (SELECT 1 FROM jsonb_array_elements_text(jsonb_path_query_array(plan_json('${q}'), 'strict $.**."Index Name"')) AS u(name) JOIN pg_class c ON c.relname = u.name JOIN pg_index i ON i.indexrelid = c.oid WHERE i.indpred IS NOT NULL)`;

const Q_KEY =
	"SELECT id, score FROM run_archive WHERE (score, id) < (3000, 77630) ORDER BY score DESC, id DESC LIMIT 20";
const Q_SEASON_KEY =
	"SELECT id, score FROM run_archive WHERE season_id = 3 AND (score, id) < (5000, 60000) ORDER BY score DESC, id DESC LIMIT 20";
const Q_LIVE = "SELECT id, started_at FROM run_archive WHERE status = ''in_progress'' ORDER BY started_at";

const PARTITIONED = `CREATE TABLE runs_by_season (LIKE run_archive) PARTITION BY LIST (season_id);
CREATE TABLE runs_s1 PARTITION OF runs_by_season FOR VALUES IN (1);
CREATE TABLE runs_s2 PARTITION OF runs_by_season FOR VALUES IN (2);
CREATE TABLE runs_s3 PARTITION OF runs_by_season FOR VALUES IN (3);`;

const SEASON9_INSERT =
	"INSERT INTO runs_by_season (id, player_id, season_id, dungeon_id, region, started_at, score, floor_reached, status, seed, tags)\nVALUES (100001, 1, 9, 5, 'eu', '2026-06-01 20:00+00', 5300, 23, 'finished', 42, '{}');";

const chapter: Chapter = {
	id: "ch40-undead-rows-and-big-tables",
	order: 40,
	world: "The Clockwork Engine",
	tier: "master",
	track: "performance",
	title: "Undead Rows and Big Tables",
	subtitle: "MVCC, VACUUM, keyset pages, N+1, write costs, partitions and stats views",
	emoji: "🧟",
	datasetId: "dungeon",
	concepts: [
		"mvcc-concept",
		"vacuum-mvcc",
		"pagination-performance",
		"n-plus-one",
		"write-performance",
		"partitioning",
		"query-stats",
	],
	prerequisites: ["ch39-why-not-my-index", "ch22-merge-and-upsert"],
	lesson: [
		{
			kind: "explain",
			title: "Rows that refuse to die",
			body: "PostgreSQL never edits a row in place. An `UPDATE` writes a **new version** of the row and marks the old one as expired; a `DELETE` only marks. Readers who started earlier keep seeing the old version: readers never block writers. This is **MVCC**.\n\nTwo hidden columns tell the story: `ctid` (where a version lives: page, slot) and `xmin` (the transaction that wrote it). Expired versions are **dead tuples**: the undead rows of the Engine.",
		},
		{
			kind: "example",
			title: "NightOwl moves house",
			body: "One statement: the CTE `before` still sees the old version, `UPDATE ... RETURNING` shows the new one. Same row, new address `(0,26)`, new writer `xmin`. The old version is still sitting at `(0,1)`, dead.",
			sql: "WITH before AS (\n  SELECT ctid, xmin FROM players WHERE id = 1\n), moved AS (\n  UPDATE players SET region = 'na' WHERE id = 1\n  RETURNING ctid, xmin\n)\nSELECT before.ctid AS old_ctid, before.xmin AS old_xmin,\n       moved.ctid AS new_ctid, moved.xmin AS new_xmin\nFROM before, moved;",
		},
		{
			kind: "explain",
			title: "VACUUM, the gravedigger",
			body: "`VACUUM run_archive;` removes dead tuples, records their space as **reusable** for future rows, and fills the **visibility map** (the one index-only scans need).\n\n`VACUUM FULL` rewrites the whole table compactly and gives disk space back, but locks the table for the whole time.\n\nAutovacuum never runs in this sandbox. And VACUUM refuses to run inside `BEGIN ... COMMIT` (25001): send it as its own statement.",
		},
		{
			kind: "quiz",
			question:
				"`run_archive` takes 14 630 912 bytes. You delete the 10 000 abandoned runs (10% of the rows). What does `pg_relation_size('run_archive')` say right after?",
			choices: [
				"About 13 200 000: 10% smaller",
				"Exactly 14 630 912: deleted rows only become dead tuples",
				"0 until the next VACUUM",
				"It depends on the number of indexes",
			],
			answerIndex: 1,
			explanation:
				"DELETE marks rows dead; the pages stay. Even a plain VACUUM only makes the space reusable inside the file. Only VACUUM FULL (or a rewrite) shrinks it, here to 13 410 304 bytes.",
		},
		{
			kind: "explain",
			title: "Pages without OFFSET",
			body: "`LIMIT 20 OFFSET 50000` still reads and throws away 50 000 rows: deep pages get slower and slower.\n\n**Keyset pagination** continues after the last row shown:\n```sql\nWHERE (score, id) < (3000, 77630)\nORDER BY score DESC, id DESC\nLIMIT 20\n```\nThe unique `id` breaks ties, the row comparison handles them, and an index on `(score, id)` jumps straight to the spot.",
		},
		{
			kind: "explain",
			title: "The N+1 curse",
			body: "The app asks for the top 10 runs (1 query), then loops: `SELECT handle FROM players WHERE id = $1` for each run (10 queries). That is **N+1**: each round trip costs far more than the work itself.\n\nOne JOIN does it in a single query. For a list of ids from the app, use `WHERE id = ANY (ARRAY[4, 8, 15])`. A correlated subquery per row is the same curse in disguise.",
		},
		{
			kind: "explain",
			title: "Every index has a price",
			body: "Each INSERT, DELETE, and each UPDATE that cannot stay on the same page (HOT), must also update **every** index of the table. More indexes, slower writes.\n\nHunt the useless ones:\n- **redundant prefixes**: `(player_id)` next to `(player_id, started_at)`;\n- **never used**: `idx_scan = 0` in `pg_stat_user_indexes` after a real workload.\n\nAnd write in batches: one multi-row INSERT beats a thousand single ones.",
		},
		{
			kind: "explain",
			title: "Partitions: one big table, many small ones",
			body: "```sql\nCREATE TABLE runs_by_season (LIKE run_archive)\n  PARTITION BY LIST (season_id);\nCREATE TABLE runs_s1 PARTITION OF runs_by_season\n  FOR VALUES IN (1);\n```\nRows land in the right partition automatically. A query filtering on `season_id` skips the others (**pruning**), and retiring a season is `DROP TABLE runs_s1`, instantly. A `DEFAULT` partition catches the rest.\n\nPitfall: queries without the partition key get no faster.",
		},
		{
			kind: "example",
			title: "The Engine's own ledger",
			body: "`pg_stat_user_tables` counts scans and rows per table. Surprise: `n_live_tup` is 0. Counters start fresh in every sandbox, and pending counts only appear after `pg_stat_force_next_flush()`.\n\nOn a real server, `pg_stat_statements` ranks queries by **total** time (calls x mean): it is not installed here, so World 10 measures plans and buffers instead.",
			sql: "SELECT count(*) FROM players;\nSELECT pg_stat_force_next_flush();\nSELECT relname, seq_scan, idx_scan, n_live_tup\nFROM pg_stat_user_tables\nWHERE relname IN ('players', 'run_archive');",
		},
		{
			kind: "try",
			title: "Your turn: count the undead",
			prompt:
				"Delete the **abandoned** runs from `run_archive`, then return the table's **n_dead_tup** from `pg_stat_user_tables`. Do not forget to flush the counters first.",
			starterSql:
				"DELETE FROM run_archive WHERE status = 'abandoned';\nSELECT n_dead_tup FROM pg_stat_user_tables WHERE relname = 'run_archive';",
			solutionSql:
				"DELETE FROM run_archive WHERE status = 'abandoned';\nSELECT pg_stat_force_next_flush();\nSELECT n_dead_tup FROM pg_stat_user_tables WHERE relname = 'run_archive';",
			check: { type: "result" },
			hints: [
				"Run the starter: 0 dead tuples? The counters have not been published yet.",
				"Add SELECT pg_stat_force_next_flush(); between the DELETE and the final SELECT.",
			],
		},
	],
	exercises: [
		{
			id: "ch40-ex01",
			title: "A new address",
			story:
				"NightOwl moved to the North American servers. The commissioner bets the row stays where it was. Prove him wrong.",
			prompt:
				"Set NightOwl's (player 1) **region** to `'na'` and return one row: the row's **old ctid** and its **new ctid**.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["mvcc-concept"],
			starterSql: "UPDATE players SET region = 'na' WHERE id = 1;\nSELECT ctid FROM players WHERE id = 1;",
			solutionSql:
				"WITH before AS (SELECT ctid FROM players WHERE id = 1),\n     moved AS (UPDATE players SET region = 'na' WHERE id = 1 RETURNING ctid)\nSELECT before.ctid AS old_ctid, moved.ctid AS new_ctid\nFROM before, moved;",
			check: { type: "result+state", verifySql: "SELECT id, region FROM players WHERE id = 1;" },
			hints: [
				"After the UPDATE, the old version is invisible: read the old ctid before, or in the same statement.",
				"A data-modifying CTE sees the old row in one branch and returns the new one with RETURNING.",
				"WITH before AS (SELECT ctid ...), moved AS (UPDATE ... RETURNING ctid) SELECT before.ctid, moved.ctid FROM before, moved;",
			],
			explanation:
				"Old version at `(0,1)`, new version at `(0,26)`: the UPDATE appended a new tuple at the end of the page. The old one stays until VACUUM, a dead tuple.\n\n**Pitfall:** believing UPDATE edits in place. That belief hides bloat, HOT updates and why VACUUM exists.\n\n**Alternative:** save the old ctid first in a temporary table (`CREATE TEMP TABLE before AS ...`), then update and join.",
		},
		{
			id: "ch40-ex02",
			title: "Lay them to rest",
			story:
				"The anti-cheat bot purges the abandoned runs. The commissioner wants the space ready for next season's runs, without locking the archive.",
			prompt:
				"The starter deletes the abandoned runs. Complete it so the dead tuples are cleaned up and their space becomes **reusable**, without rewriting the table.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["vacuum-mvcc"],
			starterSql: "DELETE FROM run_archive WHERE status = 'abandoned';",
			solutionSql: "DELETE FROM run_archive WHERE status = 'abandoned';\nVACUUM run_archive;",
			check: {
				type: "state",
				verifySql:
					"SELECT (SELECT count(*) FROM run_archive WHERE status = 'abandoned') AS abandoned_left,\n       relallvisible > 0 AS vacuumed\nFROM pg_class WHERE relname = 'run_archive';",
			},
			hints: [
				"After the DELETE, 10 000 dead tuples still occupy their pages.",
				"Autovacuum never runs here: call the gravedigger yourself.",
				"Add VACUUM run_archive; as its own statement (not VACUUM FULL).",
			],
			explanation:
				"VACUUM removes the dead tuples, records the free space for reuse and marks every page all-visible in the visibility map (`relallvisible` goes from 0 to 1786). The file keeps its size, but new runs will fill the holes.\n\n**Pitfall:** treating VACUUM as optional. Without it (and with autovacuum off or overwhelmed) tables bloat forever and index-only scans never appear.",
		},
		{
			id: "ch40-ex03",
			title: "Shrink the archive",
			story:
				"Disk is running out on the leaderboard server. An apprentice wrote the starter to give the space of the abandoned runs back to the disk. It crashes with 25001.",
			prompt:
				"Fix the starter so the abandoned runs are deleted and `run_archive` is **rewritten compactly**, giving the space back to the disk.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["vacuum-mvcc"],
			starterSql:
				"DELETE FROM run_archive WHERE status = 'abandoned';\nBEGIN;\nVACUUM FULL run_archive;\nCOMMIT;",
			solutionSql: "DELETE FROM run_archive WHERE status = 'abandoned';\nVACUUM FULL run_archive;",
			check: {
				type: "state",
				verifySql:
					"SELECT (SELECT count(*) FROM run_archive WHERE status = 'abandoned') AS abandoned_left,\n       pg_relation_size('run_archive') < 14000000 AS shrunk;",
			},
			hints: [
				"Read the error: VACUUM cannot run inside a transaction block.",
				"Remove BEGIN and COMMIT around it; VACUUM manages its own transactions.",
				"DELETE ...; then VACUUM FULL run_archive; alone.",
			],
			explanation:
				"`VACUUM FULL` copies the live rows into a fresh file and drops the old one: 14 630 912 bytes become 13 410 304. It needs its own transaction, hence the 25001 inside BEGIN.\n\n**Pitfall:** plain `VACUUM` here: the space becomes reusable but the file does not shrink. And on a live server, VACUUM FULL locks out every reader for the whole rewrite: a last resort, not a routine.",
		},
		{
			id: "ch40-ex04",
			title: "The next page, the fast way",
			story:
				"The global leaderboard shows 20 runs per page, by score then id, both descending. The last run on screen is run **77630** with score **3000**.",
			prompt:
				"Return the **id** and **score** of the next 20 runs, in the leaderboard order (score highest first, ties by id highest first), using **keyset** pagination from that last run.",
			difficulty: 3,
			kind: "query",
			concepts: ["pagination-performance"],
			starterSql:
				"SELECT id, score\nFROM run_archive\nWHERE score < 3000\nORDER BY score DESC, id DESC\nLIMIT 20;",
			solutionSql: `${Q_KEY};`,
			check: { type: "result", orderMatters: true },
			hints: [
				"Run the starter: it skips the other runs that also scored 3000 with a smaller id.",
				"Compare the pair (score, id) with the pair of the last row seen.",
				"WHERE (score, id) < (3000, 77630) ORDER BY score DESC, id DESC LIMIT 20",
			],
			explanation:
				"The row comparison `(score, id) < (3000, 77630)` means: lower score, or same score and lower id. It continues exactly after the last row, ties included, without reading the previous pages.\n\n**Pitfall:** `score <= 3000 AND id < 77630` drops every lower score with a larger id; and mixing `id ASC` with `score DESC` breaks the row comparison.\n\n**Alternative:** `score < 3000 OR (score = 3000 AND id < 77630)` says the same thing longhand.",
		},
		{
			id: "ch40-ex05",
			title: "An index for every page",
			story: "Keyset pages are correct now. Make them instant.",
			prompt: `Create an index so that \`${Q_KEY}\` uses it and needs **no Sort** of any kind.`,
			difficulty: 3,
			kind: "ddl",
			concepts: ["pagination-performance"],
			starterSql: "CREATE INDEX run_archive_score_idx ON run_archive (score);",
			solutionSql: "CREATE INDEX run_archive_score_id_idx ON run_archive (score, id);",
			check: {
				type: "state",
				verifySql: `SELECT ${usesIndex(Q_KEY)} AS uses_index,\n       ${noSort(Q_KEY)} AS no_sort;`,
			},
			hints: [
				"Run the starter, then plan_nodes of the query: an Incremental Sort remains.",
				"The index must hold the full sort key, tie breaker included.",
				"CREATE INDEX ... ON run_archive (score, id);",
			],
			explanation:
				"`(score, id)` read backwards is exactly `ORDER BY score DESC, id DESC`, and the row comparison becomes an index condition: the plan is a Limit over an index scan that reads 20 entries. Page 1 and page 5 000 cost the same.\n\n**Pitfall:** `(score)` alone: ties on score still need sorting by id (Incremental Sort).\n\n**Alternative:** `(score DESC, id DESC)` works too; mixed directions would need a matching mixed index.",
		},
		{
			id: "ch40-ex06",
			title: "Ten handles, one trip",
			story:
				"The season 3 podium page fetches the top 10 runs, then asks for each player's handle in its own query: 11 round trips per refresh.",
			prompt:
				"Return the **id**, **score** and player **handle** of the **10 best-scoring runs of season 3** in the archive, in **one** query.",
			difficulty: 2,
			kind: "query",
			concepts: ["n-plus-one"],
			starterSql:
				"SELECT id, player_id, score\nFROM run_archive\nWHERE season_id = 3\nORDER BY score DESC\nLIMIT 10;",
			solutionSql:
				"SELECT r.id, r.score, p.handle\nFROM run_archive r\nJOIN players p ON p.id = r.player_id\nWHERE r.season_id = 3\nORDER BY r.score DESC\nLIMIT 10;",
			check: { type: "result" },
			hints: [
				"The starter is the \"1\" of N+1; the app then looked up each handle separately.",
				"Join players once instead.",
				"JOIN players p ON p.id = r.player_id, keep the WHERE, ORDER BY and LIMIT.",
			],
			explanation:
				"One JOIN brings the handles along: one round trip instead of eleven. The top 10 is exactly the runs scoring 5229 and 5228, so no tie decides who gets in.\n\n**Pitfall:** ORMs produce N+1 silently (lazy loading); each query is fast, so nobody notices until the page needs 500 of them.\n\n**Alternative:** if the app already holds the ids, `WHERE p.id = ANY (ARRAY[...])` fetches all handles at once.",
		},
		{
			id: "ch40-ex07",
			title: "Too many keys on the ring",
			story:
				"Inserting new runs got slow: four indexes were forged over the years, `ra_player`, `ra_player_started`, `ra_season` and `ra_season_score`. The starter drops one... the wrong one.",
			prompt:
				"Drop every index that is made **redundant** by a longer index starting with the same column, and keep the others.",
			difficulty: 3,
			kind: "ddl",
			concepts: ["write-performance"],
			setupSql:
				"CREATE INDEX ra_player ON run_archive (player_id);\nCREATE INDEX ra_player_started ON run_archive (player_id, started_at);\nCREATE INDEX ra_season ON run_archive (season_id);\nCREATE INDEX ra_season_score ON run_archive (season_id, score);",
			starterSql: "DROP INDEX ra_player_started;",
			solutionSql: "DROP INDEX ra_player;\nDROP INDEX ra_season;",
			check: {
				type: "state",
				verifySql:
					"SELECT indexname FROM pg_indexes WHERE tablename = 'run_archive' ORDER BY indexname;",
			},
			hints: [
				"Look at the definitions: SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'run_archive';",
				"A B-tree on (a, b) also serves every query on a alone: (a) is then a redundant prefix.",
				"Drop the two single-column indexes, keep the composites and the primary key.",
			],
			explanation:
				"`(player_id, started_at)` answers every `player_id = ...` query that `(player_id)` could, so the short one only costs writes and space. Same for `ra_season`. Two fewer indexes to update on every insert.\n\n**Pitfall:** dropping the longer index (the starter): queries on the second column lose their index, and nothing is saved on the prefix.\n\n**Alternative:** on a real server, also check `idx_scan` in `pg_stat_user_indexes` before dropping anything.",
		},
		{
			id: "ch40-ex08",
			title: "One vault per season",
			story:
				"The archive will keep growing for years. The commissioner wants it split by season, so old seasons can be retired with a single command.",
			prompt:
				"Create **runs_by_season** with the same columns as `run_archive`, **partitioned by LIST on season_id**, with partitions **runs_s1**, **runs_s2** and **runs_s3** for seasons 1, 2 and 3, then copy every run of `run_archive` into it.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["partitioning"],
			solutionSql: `${PARTITIONED}\nINSERT INTO runs_by_season SELECT * FROM run_archive;`,
			check: {
				type: "state",
				verifySql:
					"SELECT tableoid::regclass::text AS partition,\n       count(*) AS runs,\n       (SELECT relkind::text FROM pg_class WHERE relname = 'runs_by_season') AS kind,\n       jsonb_path_query_array(plan_json('SELECT count(*) FROM runs_by_season WHERE season_id = 2'), 'strict $.**.\"Relation Name\"')::text AS season2_reads\nFROM runs_by_season\nGROUP BY 1;",
			},
			hints: [
				"`CREATE TABLE runs_by_season (LIKE run_archive) PARTITION BY LIST (season_id);` creates the parent, which holds no rows itself.",
				"Each partition: CREATE TABLE runs_s1 PARTITION OF runs_by_season FOR VALUES IN (1);",
				"Then INSERT INTO runs_by_season SELECT * FROM run_archive; the rows route themselves.",
			],
			explanation:
				"The parent routes each row to its season (25 919, 26 208 and 47 873 runs), and a query on `season_id = 2` reads only `runs_s2`: the planner prunes the other two. Retiring season 1 later is `DROP TABLE runs_s1`, instant, instead of a 26 000 row DELETE plus VACUUM.\n\n**Pitfall:** a query without `season_id` scans all partitions: partitioning is for data management and pruning, not a general speed-up.\n\n**Alternative:** `PARTITION BY RANGE (season_id)` with `FOR VALUES FROM (1) TO (2)` works too.",
		},
		{
			id: "ch40-ex09",
			title: "Boss: Overclock the Engine",
			story:
				"Final overhaul of the Clockwork Engine. The season 3 leaderboard pages with a deep OFFSET and fetches handles one by one, the live board sorts on every refresh, and the commissioner allows only **two** new indexes.",
			prompt: `1. Create **at most 2 indexes** on \`run_archive\` so that \`${Q_SEASON_KEY}\` uses an index with **no Sort**, and \`SELECT id, started_at FROM run_archive WHERE status = 'in_progress' ORDER BY started_at\` uses a **partial** index with **no Sort**.\n2. End with **one query** returning the **id**, **score** and player **handle** of that season 3 page: the 20 runs after (score 5000, id 60000), score highest first, ties by id highest first.`,
			difficulty: 5,
			kind: "ddl",
			concepts: ["pagination-performance", "n-plus-one", "write-performance", "multicolumn-index", "partial-index"],
			starterSql:
				"SELECT id, score, player_id\nFROM run_archive\nWHERE season_id = 3\nORDER BY score DESC, id DESC\nLIMIT 20 OFFSET 1000;",
			solutionSql:
				"CREATE INDEX run_archive_season_board ON run_archive (season_id, score, id);\nCREATE INDEX run_archive_live_idx ON run_archive (started_at) WHERE status = 'in_progress';\nSELECT r.id, r.score, p.handle\nFROM run_archive r\nJOIN players p ON p.id = r.player_id\nWHERE r.season_id = 3 AND (r.score, r.id) < (5000, 60000)\nORDER BY r.score DESC, r.id DESC\nLIMIT 20;",
			check: {
				type: "result+state",
				orderMatters: true,
				verifySql: `SELECT ${usesIndex(Q_SEASON_KEY)} AND ${noSort(Q_SEASON_KEY)} AS season_pages,\n       ${usesPartial(Q_LIVE)} AND ${noSort(Q_LIVE)} AS live_board,\n       (SELECT count(*) FROM pg_index WHERE indrelid = 'run_archive'::regclass AND NOT indisprimary) <= 2 AS within_budget;`,
			},
			hints: [
				"Three fixes: an index for the season pages, a partial index for the live board, and a keyset query joined to players.",
				"The season pages filter on season_id, then sort by score and id: all three belong in one index, in that order.",
				"(season_id, score, id) and (started_at) WHERE status = 'in_progress'; then WHERE r.season_id = 3 AND (r.score, r.id) < (5000, 60000) with JOIN players.",
			],
			explanation:
				"`(season_id, score, id)` turns the season filter plus keyset condition into one index range read backwards: any page costs about 20 entries. The partial index serves the live board, the JOIN kills the N+1, and two indexes keep inserts cheap.\n\n**Pitfall:** `(season_id, score)` without `id`: ties at the same score need an Incremental Sort, and the keyset condition on id is only a filter.\n\n**Alternative:** `(season_id, score DESC, id DESC)` is equivalent for this order.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch40-pr01",
			title: "Many writers",
			prompt:
				"In **two separate statements**, set player 1's region to `'na'` and player 2's region to `'asia'`. Then return the number of **distinct `xmin` values** among all players (compare them as text).",
			difficulty: 2,
			kind: "mutation",
			concepts: ["mvcc-concept"],
			solutionSql:
				"UPDATE players SET region = 'na' WHERE id = 1;\nUPDATE players SET region = 'asia' WHERE id = 2;\nSELECT count(DISTINCT xmin::text) FROM players;",
			check: { type: "result+state", verifySql: "SELECT id, region FROM players WHERE id IN (1, 2) ORDER BY id;" },
			hints: [
				"Every row version records the transaction that wrote it in xmin.",
				"All players were loaded by one transaction; each UPDATE statement runs in its own.",
				"count(DISTINCT xmin::text) after the two UPDATEs.",
			],
			explanation:
				"3: the loading transaction for 23 players, plus one new writer per UPDATE. xmin is how each reader decides which versions it may see.",
		},
		{
			id: "ch40-pr02",
			title: "Weightless deletion",
			prompt:
				"Return one row: the size in bytes of `run_archive` (`pg_relation_size`) **before** and **after** deleting the abandoned runs.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["vacuum-mvcc"],
			solutionSql:
				"CREATE TEMP TABLE size_before AS SELECT pg_relation_size('run_archive') AS bytes;\nDELETE FROM run_archive WHERE status = 'abandoned';\nSELECT b.bytes AS before, pg_relation_size('run_archive') AS after FROM size_before b;",
			check: {
				type: "result+state",
				verifySql: "SELECT count(*) FROM run_archive WHERE status = 'abandoned';",
			},
			hints: [
				"Save the size first, for example in a temporary table.",
				"Then DELETE, then read the size again next to the saved one.",
				"CREATE TEMP TABLE size_before AS SELECT pg_relation_size('run_archive') AS bytes; ...",
			],
			explanation:
				"Both are 14 630 912: DELETE leaves dead tuples in place. Only VACUUM FULL gives the bytes back.",
		},
		{
			id: "ch40-pr03",
			title: "Page three, the old way",
			prompt:
				"Return the **id** and **score** of the season 1 runs on **page 3** of the leaderboard: 10 runs per page, score highest first, ties by id highest first. Use OFFSET.",
			difficulty: 1,
			kind: "query",
			concepts: ["pagination-performance"],
			solutionSql:
				"SELECT id, score FROM run_archive WHERE season_id = 1 ORDER BY score DESC, id DESC LIMIT 10 OFFSET 20;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Page 3 skips two pages.",
				"OFFSET (3 - 1) * 10.",
				"ORDER BY score DESC, id DESC LIMIT 10 OFFSET 20",
			],
			explanation:
				"Correct, and fine for page 3. For page 2 000, the Engine would read and discard 20 000 rows first: that is when keyset pays off.",
		},
		{
			id: "ch40-pr04",
			title: "Page after, the new way",
			prompt:
				"The last season 1 run on screen is id **10000** with score **4000**. Return the **id** and **score** of the next 10 season 1 runs (score highest first, ties by id highest first) with **keyset** pagination.",
			difficulty: 2,
			kind: "query",
			concepts: ["pagination-performance"],
			solutionSql:
				"SELECT id, score FROM run_archive\nWHERE season_id = 1 AND (score, id) < (4000, 10000)\nORDER BY score DESC, id DESC\nLIMIT 10;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Continue after the pair (4000, 10000).",
				"Row comparison: (score, id) < (4000, 10000).",
				"WHERE season_id = 1 AND (score, id) < (4000, 10000) ORDER BY score DESC, id DESC LIMIT 10",
			],
			explanation:
				"The season filter and the keyset condition combine; with an index on `(season_id, score, id)` this page costs 10 index entries wherever it is.",
		},
		{
			id: "ch40-pr05",
			title: "Three players, one question",
			prompt:
				"The app holds the player ids 4, 8 and 15 and used to send one query each. Return **player_id** and the number of archived **runs** for those three players, in one query, using `= ANY` with an array.",
			difficulty: 2,
			kind: "query",
			concepts: ["n-plus-one"],
			solutionSql:
				"SELECT player_id, count(*) AS runs\nFROM run_archive\nWHERE player_id = ANY (ARRAY[4, 8, 15])\nGROUP BY player_id;",
			check: { type: "result" },
			hints: [
				"One WHERE that matches any of the three ids.",
				"= ANY (ARRAY[4, 8, 15]) takes the whole list as one parameter.",
				"WHERE player_id = ANY (ARRAY[4, 8, 15]) GROUP BY player_id",
			],
			explanation:
				"One scan instead of three: from an application, the array is a single parameter (`= ANY($1)`), whatever the list length.",
		},
		{
			id: "ch40-pr06",
			title: "The idle key",
			prompt:
				"Three indexes exist on `run_archive`. Run the dashboard workload below, flush the counters, then return the **name** of every index of `run_archive` (primary key excluded) that was **never scanned**.\n\n```sql\nSELECT count(*) FROM run_archive WHERE player_id = 20;\nSELECT count(*) FROM run_archive WHERE region = 'eu';\nSELECT id FROM run_archive WHERE seed = 3007215346;\n```",
			difficulty: 3,
			kind: "query",
			concepts: ["write-performance", "query-stats"],
			setupSql:
				"CREATE INDEX run_archive_player_idx ON run_archive (player_id);\nCREATE INDEX run_archive_region_idx ON run_archive (region);\nCREATE INDEX run_archive_seed_idx ON run_archive (seed);",
			solutionSql:
				"SELECT count(*) FROM run_archive WHERE player_id = 20;\nSELECT count(*) FROM run_archive WHERE region = 'eu';\nSELECT id FROM run_archive WHERE seed = 3007215346;\nSELECT pg_stat_force_next_flush();\nSELECT indexrelname FROM pg_stat_user_indexes\nWHERE relname = 'run_archive' AND idx_scan = 0 AND indexrelname <> 'run_archive_pkey';",
			check: { type: "result" },
			hints: [
				"Counters start at zero: run the workload first.",
				"pg_stat_user_indexes has one row per index with idx_scan.",
				"After pg_stat_force_next_flush(): WHERE relname = 'run_archive' AND idx_scan = 0, primary key excluded.",
			],
			explanation:
				"`run_archive_region_idx` was never used: `region = 'eu'` is too common for it. It still slows down every insert. On a real server, watch idx_scan over weeks before dropping.",
		},
		{
			id: "ch40-pr07",
			title: "A season nobody planned",
			prompt:
				"`runs_by_season` has partitions for seasons 1 to 3 only, so the starter's insert of a season 9 run fails. Add a **DEFAULT** partition named **runs_other**, then run the insert.",
			difficulty: 2,
			kind: "ddl",
			concepts: ["partitioning"],
			setupSql: PARTITIONED,
			starterSql: SEASON9_INSERT,
			solutionSql: `CREATE TABLE runs_other PARTITION OF runs_by_season DEFAULT;\n${SEASON9_INSERT}`,
			check: {
				type: "state",
				verifySql: "SELECT id, tableoid::regclass::text AS partition FROM runs_by_season WHERE season_id = 9;",
			},
			hints: [
				"Run the starter: no partition accepts season 9.",
				"A DEFAULT partition takes every value no other partition claims.",
				"CREATE TABLE runs_other PARTITION OF runs_by_season DEFAULT; then the INSERT.",
			],
			explanation:
				"The row lands in `runs_other`. Handy as a safety net, but adding a real partition for season 9 later requires moving those rows out of the default first.",
		},
		{
			id: "ch40-pr08",
			title: "Who reads the players table",
			prompt:
				"Run `SELECT count(*) FROM players;` **three times**, flush the counters, then return the **seq_scan** count of `players` from `pg_stat_user_tables`.",
			difficulty: 1,
			kind: "query",
			concepts: ["query-stats"],
			solutionSql:
				"SELECT count(*) FROM players;\nSELECT count(*) FROM players;\nSELECT count(*) FROM players;\nSELECT pg_stat_force_next_flush();\nSELECT seq_scan FROM pg_stat_user_tables WHERE relname = 'players';",
			check: { type: "result" },
			hints: [
				"Three identical statements, then the flush.",
				"pg_stat_user_tables has one row per table.",
				"SELECT seq_scan FROM pg_stat_user_tables WHERE relname = 'players';",
			],
			explanation:
				"3: one sequential scan per count. On a real server these counters accumulate since the last reset, so compare snapshots rather than raw totals.",
		},
		{
			id: "ch40-pr09",
			title: "Slowest is not heaviest",
			prompt:
				"The starter mimics a `pg_stat_statements` report. Return the **query** and its **total_ms** (calls x mean_ms) for the single query that costs the server the most time in total.",
			difficulty: 2,
			kind: "query",
			concepts: ["query-stats"],
			starterSql:
				"SELECT query, mean_ms\nFROM (VALUES ('leaderboard page', 50000, 2.0),\n             ('season report', 12, 900.0),\n             ('profile page', 8000, 6.5)) AS s(query, calls, mean_ms)\nORDER BY mean_ms DESC\nLIMIT 1;",
			solutionSql:
				"SELECT query, calls * mean_ms AS total_ms\nFROM (VALUES ('leaderboard page', 50000, 2.0),\n             ('season report', 12, 900.0),\n             ('profile page', 8000, 6.5)) AS s(query, calls, mean_ms)\nORDER BY total_ms DESC\nLIMIT 1;",
			check: { type: "result" },
			hints: [
				"The starter picks the slowest single call.",
				"Total time is calls multiplied by mean time.",
				"SELECT query, calls * mean_ms AS total_ms ... ORDER BY total_ms DESC LIMIT 1",
			],
			explanation:
				"The 2 ms leaderboard page costs 100 000 ms in total, ten times the scary 900 ms report. Optimize by total time first: that is the column `pg_stat_statements` users sort on.",
		},
	],
};

export default chapter;
