import type { CaseSet } from "../validate-content";

const KEYSET_TAIL = "ORDER BY r.score DESC, r.id DESC LIMIT 20;";
const BOSS_INDEXES =
	"CREATE INDEX ON run_archive (season_id, score, id);\nCREATE INDEX ON run_archive (started_at) WHERE status = 'in_progress';\n";

const cases: Record<string, CaseSet> = {
	"ch40-undead-rows-and-big-tables/lesson-9": {
		reject: [
			{
				sql: "DELETE FROM run_archive WHERE status = 'in_progress';\nSELECT pg_stat_force_next_flush();\nSELECT n_dead_tup FROM pg_stat_user_tables WHERE relname = 'run_archive';",
				why: "deletes the wrong runs",
			},
		],
		accept: [
			"DELETE FROM run_archive WHERE status = 'abandoned';\nSELECT pg_stat_force_next_flush();\nSELECT s.n_dead_tup AS undead FROM pg_stat_user_tables s WHERE s.relname = 'run_archive';",
		],
	},
	"ch40-ex01": {
		reject: [
			{
				sql: "WITH before AS (SELECT ctid FROM players WHERE id = 1), moved AS (UPDATE players SET region = 'na' WHERE id = 1 RETURNING ctid) SELECT moved.ctid, before.ctid FROM before, moved;",
				why: "old and new swapped",
			},
		],
		accept: [
			"CREATE TEMP TABLE before AS SELECT ctid AS old_ctid FROM players WHERE id = 1;\nUPDATE players SET region = 'na' WHERE id = 1;\nSELECT b.old_ctid, p.ctid FROM before b, players p WHERE p.id = 1;",
		],
	},
	"ch40-ex02": {
		reject: [
			{ sql: "DELETE FROM run_archive WHERE status = 'abandoned';\nANALYZE run_archive;", why: "ANALYZE does not clean dead tuples" },
			{ sql: "VACUUM run_archive;", why: "nothing deleted" },
		],
		accept: [
			"DELETE FROM run_archive WHERE status = 'abandoned';\nVACUUM (ANALYZE) run_archive;",
			"DELETE FROM run_archive WHERE status = 'abandoned';\nVACUUM;",
		],
	},
	"ch40-ex03": {
		reject: [
			{ sql: "DELETE FROM run_archive WHERE status = 'abandoned';\nVACUUM run_archive;", why: "plain VACUUM does not shrink the file" },
			{ sql: "VACUUM FULL run_archive;", why: "nothing deleted" },
		],
		accept: ["DELETE FROM run_archive WHERE status = 'abandoned';\nVACUUM (FULL, ANALYZE) run_archive;"],
	},
	"ch40-ex04": {
		reject: [
			{
				sql: "SELECT id, score FROM run_archive WHERE score <= 3000 AND id < 77630 ORDER BY score DESC, id DESC LIMIT 20;",
				why: "drops lower scores with larger ids",
			},
			{
				sql: "SELECT id, score FROM run_archive WHERE (score, id) <= (3000, 77630) ORDER BY score DESC, id DESC LIMIT 20;",
				why: "repeats the last row of the previous page",
			},
			{
				sql: "SELECT id, score FROM run_archive WHERE (score, id) < (3000, 77630) ORDER BY score DESC, id LIMIT 20;",
				why: "tie breaker in the wrong direction",
			},
		],
		accept: [
			"SELECT id, score FROM run_archive WHERE score < 3000 OR (score = 3000 AND id < 77630) ORDER BY score DESC, id DESC LIMIT 20;",
			"SELECT id, score FROM run_archive WHERE ROW(score, id) < ROW(3000, 77630) ORDER BY score DESC, id DESC FETCH FIRST 20 ROWS ONLY;",
		],
	},
	"ch40-ex05": {
		reject: [{ sql: "CREATE INDEX ON run_archive (id, score);", why: "wrong column order" }],
		accept: ["CREATE INDEX ON run_archive (score DESC, id DESC);"],
	},
	"ch40-ex06": {
		reject: [
			{
				sql: "SELECT r.id, r.score, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id ORDER BY r.score DESC LIMIT 10;",
				why: "season filter forgotten",
			},
		],
		accept: [
			"SELECT t.id, t.score, p.handle FROM (SELECT id, score, player_id FROM run_archive WHERE season_id = 3 ORDER BY score DESC LIMIT 10) t JOIN players p ON p.id = t.player_id;",
		],
	},
	"ch40-ex07": {
		reject: [
			{
				sql: "DROP INDEX ra_player;\nDROP INDEX ra_player_started;\nDROP INDEX ra_season;\nDROP INDEX ra_season_score;",
				why: "drops the useful composites too",
			},
			{ sql: "DROP INDEX ra_player;", why: "ra_season left behind" },
		],
		accept: ["DROP INDEX ra_player, ra_season;"],
	},
	"ch40-ex08": {
		reject: [
			{
				sql: "CREATE TABLE runs_by_season AS SELECT * FROM run_archive;",
				why: "not partitioned",
			},
			{
				sql: "CREATE TABLE runs_by_season (LIKE run_archive) PARTITION BY LIST (season_id);\nCREATE TABLE runs_s1 PARTITION OF runs_by_season FOR VALUES IN (1);\nCREATE TABLE runs_s2 PARTITION OF runs_by_season FOR VALUES IN (2);\nCREATE TABLE runs_s3 PARTITION OF runs_by_season FOR VALUES IN (3);",
				why: "partitions left empty",
			},
		],
		accept: [
			"CREATE TABLE runs_by_season (LIKE run_archive INCLUDING DEFAULTS) PARTITION BY RANGE (season_id);\nCREATE TABLE runs_s1 PARTITION OF runs_by_season FOR VALUES FROM (1) TO (2);\nCREATE TABLE runs_s2 PARTITION OF runs_by_season FOR VALUES FROM (2) TO (3);\nCREATE TABLE runs_s3 PARTITION OF runs_by_season FOR VALUES FROM (3) TO (4);\nINSERT INTO runs_by_season SELECT * FROM run_archive;",
		],
	},
	"ch40-ex09": {
		reject: [
			{
				sql: `${BOSS_INDEXES}SELECT r.id, r.score, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id WHERE r.season_id = 3 ORDER BY r.score DESC, r.id DESC LIMIT 20 OFFSET 1000;`,
				why: "OFFSET page instead of the keyset page",
			},
			{
				sql: `${BOSS_INDEXES}CREATE INDEX ON run_archive (player_id);\nSELECT r.id, r.score, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id WHERE r.season_id = 3 AND (r.score, r.id) < (5000, 60000) ${KEYSET_TAIL}`,
				why: "three indexes, over budget",
			},
			{
				sql: `CREATE INDEX ON run_archive (season_id, score);\nCREATE INDEX ON run_archive (started_at) WHERE status = 'in_progress';\nSELECT r.id, r.score, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id WHERE r.season_id = 3 AND (r.score, r.id) < (5000, 60000) ${KEYSET_TAIL}`,
				why: "no id in the index: ties still sorted",
			},
		],
		accept: [
			`CREATE INDEX ON run_archive (season_id, score DESC, id DESC);\nCREATE INDEX ON run_archive (started_at) WHERE status = 'in_progress';\nSELECT r.id, r.score, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id WHERE r.season_id = 3 AND (r.score < 5000 OR (r.score = 5000 AND r.id < 60000)) ${KEYSET_TAIL}`,
		],
	},
	"ch40-pr01": {
		reject: [
			{
				sql: "UPDATE players SET region = CASE id WHEN 1 THEN 'na' ELSE 'asia' END WHERE id IN (1, 2);\nSELECT count(DISTINCT xmin::text) FROM players;",
				why: "one statement, one transaction: 2 writers",
			},
		],
	},
	"ch40-pr03": {
		reject: [
			{ sql: "SELECT id, score FROM run_archive WHERE season_id = 1 ORDER BY score DESC, id DESC LIMIT 10 OFFSET 30;", why: "page 4" },
		],
	},
	"ch40-pr04": {
		reject: [
			{
				sql: "SELECT id, score FROM run_archive WHERE season_id = 1 AND score < 4000 ORDER BY score DESC, id DESC LIMIT 10;",
				why: "drops the runs tied at 4000 with smaller ids",
			},
		],
	},
	"ch40-pr06": {
		reject: [
			{
				sql: "SELECT pg_stat_force_next_flush();\nSELECT indexrelname FROM pg_stat_user_indexes WHERE relname = 'run_archive' AND idx_scan = 0 AND indexrelname <> 'run_archive_pkey';",
				why: "no workload: every index looks idle",
			},
		],
	},
	"ch40-pr09": {
		accept: [
			"SELECT query, total_ms FROM (SELECT query, calls * mean_ms AS total_ms FROM (VALUES ('leaderboard page', 50000, 2.0), ('season report', 12, 900.0), ('profile page', 8000, 6.5)) AS s(query, calls, mean_ms)) t ORDER BY total_ms DESC FETCH FIRST 1 ROW ONLY;",
		],
	},
};

export default cases;
