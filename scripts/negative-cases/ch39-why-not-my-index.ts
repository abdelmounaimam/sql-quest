import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch39-why-not-my-index/lesson-9": {
		reject: [{ sql: "SELECT plan_nodes('SELECT * FROM run_archive WHERE id - 0 = 4242');", why: "still arithmetic on the column" }],
		accept: ["SELECT plan_nodes('SELECT * FROM run_archive WHERE id = 4243 - 1');"],
	},
	"ch39-ex01": {
		reject: [
			{
				sql: "SELECT count(*), plan_nodes('SELECT count(*) FROM run_archive WHERE date_trunc(''day'', started_at) = ''2025-06-01''') FROM run_archive WHERE started_at >= '2025-06-01' AND started_at < '2025-06-02';",
				why: "plan of a non-sargable query",
			},
			{
				sql: "SELECT count(*), plan_nodes('SELECT count(*) FROM run_archive WHERE started_at >= ''2025-06-01'' AND started_at < ''2025-06-02''') FROM run_archive WHERE started_at >= '2025-06-01' AND started_at < '2025-06-03';",
				why: "counts June 2nd too",
			},
		],
		accept: [
			"SELECT count(*) AS runs, plan_nodes('SELECT count(*) FROM run_archive WHERE started_at BETWEEN ''2025-06-01'' AND ''2025-06-01 23:59:59.999999''') AS plan FROM run_archive WHERE started_at BETWEEN '2025-06-01' AND '2025-06-01 23:59:59.999999';",
			"SELECT count(*), plan_nodes('SELECT count(*) FROM run_archive WHERE started_at >= date ''2025-06-01'' AND started_at < date ''2025-06-01'' + 1') FROM run_archive WHERE started_at >= date '2025-06-01' AND started_at < date '2025-06-01' + 1;",
		],
	},
	"ch39-ex02": {
		reject: [{ sql: "SELECT plan_nodes('SELECT id FROM run_archive WHERE seed::numeric = 3007215346');", why: "cast on the column" }],
		accept: [
			"SELECT plan_nodes('SELECT id FROM run_archive WHERE seed = 3007215346::bigint');",
			"SELECT plan_nodes('SELECT id FROM run_archive WHERE seed = ''3007215346''');",
		],
	},
	"ch39-ex03": {
		reject: [
			{ sql: "SELECT 'Bitmap Heap Scan', 'Bitmap Heap Scan', 'Seq Scan';", why: "finished is too common for the index" },
			{ sql: "SELECT 'Seq Scan', 'Bitmap Heap Scan', 'Index Scan';", why: "players is one page" },
		],
		accept: ["SELECT 'Seq Scan' AS finished, 'Bitmap Heap Scan' AS live, 'Seq Scan' AS player;"],
	},
	"ch39-ex04": {
		reject: [
			{
				sql: "SELECT attname, n_distinct, round(correlation::numeric, 2) FROM pg_stats WHERE tablename = 'run_archive' AND attname IN ('region', 'started_at', 'status') ORDER BY attname DESC;",
				why: "reverse order",
			},
		],
		accept: [
			"SELECT s.attname, s.n_distinct, round(s.correlation::numeric, 2) AS corr FROM pg_stats s WHERE s.tablename = 'run_archive' AND s.attname IN ('status', 'region', 'started_at') ORDER BY 1;",
		],
	},
	"ch39-ex05": {
		reject: [{ sql: "VACUUM run_copy;", why: "VACUUM alone does not refresh column statistics" }],
		accept: ["VACUUM ANALYZE run_copy;", "ANALYZE run_copy (region);"],
	},
	"ch39-ex06": {
		reject: [
			{
				sql: "SELECT p.handle, max(r.score), count(*) FROM players p LEFT JOIN run_archive r ON r.player_id = p.id GROUP BY p.id, p.handle;",
				why: "count(*) gives newbie_42 one run",
			},
			{
				sql: "SELECT p.handle, max(r.score), count(r.id) FROM players p JOIN run_archive r ON r.player_id = p.id GROUP BY p.id, p.handle;",
				why: "inner join drops newbie_42",
			},
		],
		accept: [
			"SELECT p.handle, a.best, coalesce(a.runs, 0) FROM players p LEFT JOIN (SELECT player_id, max(score) AS best, count(*) AS runs FROM run_archive GROUP BY player_id) a ON a.player_id = p.id;",
		],
	},
	"ch39-ex07": {
		reject: [
			{ sql: "SELECT plan_nodes('WITH c AS MATERIALIZED (SELECT * FROM run_archive WHERE score > 0) SELECT * FROM c WHERE id = 5');", why: "fence kept" },
		],
		accept: ["SELECT plan_nodes('WITH c AS NOT MATERIALIZED (SELECT * FROM run_archive) SELECT * FROM c WHERE id = 5');"],
	},
	"ch39-ex08": {
		reject: [
			{
				sql: "SELECT 'march', (SELECT count(*) FROM run_archive WHERE started_at >= '2025-03-01' AND started_at < '2025-04-01'), plan_nodes('SELECT count(*) FROM run_archive WHERE started_at >= ''2025-03-01'' AND started_at < ''2025-04-01''') UNION ALL SELECT 'legends', (SELECT count(*) FROM run_archive WHERE score >= 5201), plan_nodes('SELECT count(*) FROM run_archive WHERE score >= 5201') UNION ALL SELECT 'owl twenty', (SELECT count(*) FROM run_archive WHERE player_id = 20), plan_nodes('SELECT count(*) FROM run_archive WHERE player_id = 20');",
				why: "off by one on the legends boundary",
			},
			{
				sql: "SELECT 'march', (SELECT count(*) FROM run_archive WHERE started_at >= '2025-03-01' AND started_at < '2025-04-01'), plan_nodes('SELECT count(*) FROM run_archive WHERE started_at >= ''2025-03-01'' AND started_at < ''2025-04-01''') UNION ALL SELECT 'legends', (SELECT count(*) FROM run_archive WHERE score >= 5200), plan_nodes('SELECT count(*) FROM run_archive WHERE score >= 5200') UNION ALL SELECT 'owl twenty', (SELECT count(*) FROM run_archive WHERE player_id = 20), plan_nodes('WITH all_runs AS MATERIALIZED (SELECT * FROM run_archive) SELECT count(*) FROM all_runs WHERE player_id = 20');",
				why: "CTE fence kept",
			},
		],
		accept: [
			"SELECT 'march' AS label, (SELECT count(*) FROM run_archive WHERE started_at >= '2025-03-01' AND started_at < '2025-04-01') AS runs, plan_nodes('SELECT count(*) FROM run_archive WHERE started_at >= ''2025-03-01'' AND started_at < ''2025-04-01''') AS plan UNION ALL SELECT 'legends', (SELECT count(*) FROM run_archive WHERE score > 5199), plan_nodes('SELECT count(*) FROM run_archive WHERE score > 5199') UNION ALL SELECT 'owl twenty', (WITH all_runs AS NOT MATERIALIZED (SELECT * FROM run_archive) SELECT count(*) FROM all_runs WHERE player_id = 20), plan_nodes('WITH all_runs AS NOT MATERIALIZED (SELECT * FROM run_archive) SELECT count(*) FROM all_runs WHERE player_id = 20');",
		],
	},
	"ch39-pr03": {
		reject: [{ sql: "SELECT 'Bitmap Heap Scan', 'Bitmap Heap Scan';", why: "a leading wildcard cannot use the B-tree" }],
	},
	"ch39-pr04": {
		reject: [{ sql: "SELECT 'Bitmap Heap Scan', 'Bitmap Heap Scan';", why: "<> is not a B-tree operator" }],
	},
	"ch39-pr05": {
		reject: [
			{ sql: "CREATE STATISTICS run_archive_score_floor (dependencies) ON score, floor_reached FROM run_archive;", why: "no ANALYZE: statistics stay empty" },
		],
	},
	"ch39-pr07": {
		accept: [
			"SELECT DISTINCT p.handle FROM players p JOIN run_archive r ON r.player_id = p.id WHERE r.dungeon_id = 5 AND r.score >= 5200;",
			"SELECT handle FROM players WHERE id IN (SELECT player_id FROM run_archive WHERE dungeon_id = 5 AND score >= 5200);",
		],
	},
	"ch39-pr08": {
		accept: [
			"SELECT d.name, count(r.id) FROM dungeons d LEFT JOIN run_archive r ON r.dungeon_id = d.id AND r.tags @> '{cursed}' GROUP BY d.id, d.name;",
		],
	},
};

export default cases;
