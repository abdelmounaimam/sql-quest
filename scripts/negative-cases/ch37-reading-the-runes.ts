import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch37-reading-the-runes/lesson-9": {
		reject: [
			{ sql: "SELECT plan_nodes('SELECT * FROM run_archive WHERE score BETWEEN 10 AND 20');", why: "wrong column, Seq Scan" },
		],
		accept: ["SELECT plan_nodes('SELECT * FROM run_archive WHERE id >= 10 AND id <= 20') AS nodes;"],
	},
	"ch37-ex01": {
		reject: [
			{ sql: "SELECT 'Index Scan';", why: "no index on dungeon_id" },
			{ sql: "SELECT 'Seq Scan on run_archive';", why: "table name is not part of the node type" },
		],
		accept: [
			"SELECT (plan_nodes('SELECT * FROM run_archive WHERE dungeon_id = 2'))[1];",
			"EXPLAIN SELECT * FROM run_archive WHERE dungeon_id = 2;\nSELECT 'Seq Scan' AS top_node;",
		],
	},
	"ch37-ex02": {
		reject: [
			{ sql: "SELECT 100000;", why: "table size, not the estimate" },
			{ sql: "SELECT 3036;", why: "total cost, not rows" },
		],
		accept: [
			"SELECT estimated_rows('SELECT region FROM run_archive WHERE region = ''sa''')::int AS estimate;",
		],
	},
	"ch37-ex03": {
		reject: [
			{ sql: "SELECT 98000, 2000;", why: "columns swapped" },
			{ sql: "SELECT 2000, 100000;", why: "rows read instead of rows removed" },
		],
		accept: [
			"SELECT count(*) FILTER (WHERE status = 'in_progress'), count(*) FILTER (WHERE status <> 'in_progress') FROM run_archive;",
		],
	},
	"ch37-ex04": {
		reject: [
			{ sql: "EXPLAIN DELETE FROM run_archive WHERE status = 'abandoned';", why: "plain EXPLAIN runs nothing: no real numbers" },
			{ sql: "BEGIN;\nEXPLAIN ANALYZE DELETE FROM run_archive WHERE status = 'abandoned';\nCOMMIT;", why: "COMMIT keeps the deletion" },
		],
		accept: [
			"START TRANSACTION;\nEXPLAIN (ANALYZE, BUFFERS) DELETE FROM run_archive WHERE status = 'abandoned';\nABORT;",
			"BEGIN;\nEXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) DELETE FROM run_archive WHERE status = 'abandoned';\nROLLBACK;",
		],
	},
	"ch37-ex05": {
		reject: [
			{ sql: "SELECT 'Index Scan', 'Index Scan', 'Seq Scan';", why: "keys only range is an Index Only Scan" },
			{ sql: "SELECT 'Index Scan', 'Index Only Scan', 'Index Scan';", why: "score has no index" },
		],
		accept: ["SELECT 'Index Scan' AS a, 'Index Only Scan' AS b, 'Seq Scan' AS c;"],
	},
	"ch37-ex06": {
		reject: [
			{ sql: "SELECT 'BitmapOr', 2;", why: "AND combines with BitmapAnd" },
			{ sql: "SELECT 'BitmapAnd', 1;", why: "two indexes are scanned" },
		],
		accept: [
			"SELECT n[2], (SELECT count(*) FROM unnest(n) x WHERE x = 'Bitmap Index Scan') FROM (SELECT plan_nodes('SELECT * FROM run_archive WHERE player_id = 20 AND dungeon_id = 3') AS n) s;",
		],
	},
	"ch37-ex07": {
		reject: [
			{ sql: "SELECT 'Nested Loop', 'Hash Join', 'Merge Join';", why: "first two swapped" },
			{ sql: "SELECT 'Hash Join', 'Nested Loop', 'Hash Join';", why: "the live runs join is a Merge Join" },
		],
		accept: ["SELECT 'Hash Join' AS all_runs, 'Nested Loop' AS one_player, 'Merge Join' AS live_runs;"],
	},
	"ch37-ex08": {
		reject: [
			{
				sql: "WITH runes(label, query) AS (VALUES ('vault key', 'SELECT * FROM run_archive WHERE id = 4242'), ('eu crowd', 'SELECT * FROM run_archive WHERE region = ''eu'''), ('owl hunt', 'SELECT p.handle, r.score FROM players p JOIN run_archive r ON r.player_id = p.id WHERE p.id = 1'), ('grand census', 'SELECT d.name, count(*) FROM dungeons d JOIN run_archive r ON r.dungeon_id = d.id GROUP BY d.name')), plans AS (SELECT label, plan_nodes(query) AS nodes FROM runes) SELECT label, nodes[1], CASE WHEN 'Hash Join' = ANY (nodes) THEN 'Hash Join' WHEN 'Merge Join' = ANY (nodes) THEN 'Merge Join' END, array_to_string(nodes, ',') LIKE '%Index%' FROM plans;",
				why: "forgets the Nested Loop",
			},
			{
				sql: "VALUES ('vault key', 'Index Scan', NULL, true), ('eu crowd', 'Seq Scan', NULL, false), ('owl hunt', 'Nested Loop', 'Nested Loop', true), ('grand census', 'Aggregate', 'Hash Join', true);",
				why: "grand census uses no index",
			},
		],
		accept: [
			"SELECT label, n[1], (SELECT j FROM unnest(n) j WHERE j IN ('Nested Loop', 'Hash Join', 'Merge Join') LIMIT 1), EXISTS (SELECT 1 FROM unnest(n) x WHERE x LIKE '%Index%') FROM (VALUES ('vault key', 'SELECT * FROM run_archive WHERE id = 4242'), ('eu crowd', 'SELECT * FROM run_archive WHERE region = ''eu'''), ('owl hunt', 'SELECT p.handle, r.score FROM players p JOIN run_archive r ON r.player_id = p.id WHERE p.id = 1'), ('grand census', 'SELECT d.name, count(*) FROM dungeons d JOIN run_archive r ON r.dungeon_id = d.id GROUP BY d.name')) AS v(label, q), LATERAL (SELECT plan_nodes(q) AS n) p;",
			"VALUES ('vault key', 'Index Scan', NULL, true), ('eu crowd', 'Seq Scan', NULL, false), ('owl hunt', 'Nested Loop', 'Nested Loop', true), ('grand census', 'Aggregate', 'Hash Join', false);",
		],
	},
	"ch37-pr02": {
		reject: [{ sql: "SELECT 'Seq Scan';", why: "that is the child, not the top" }],
	},
	"ch37-pr05": {
		reject: [{ sql: "SELECT 'Bitmap Heap Scan', 'Bitmap Heap Scan';", why: "eu is too common for the index" }],
		accept: ["SELECT 'Seq Scan', 'Bitmap Heap Scan';"],
	},
	"ch37-pr06": {
		reject: [{ sql: "SELECT 'Hash Join';", why: "hash join was disabled" }],
	},
};

export default cases;
