// Negative and accept cases for ch18-the-grand-report.
import type { CaseSet } from "../validate-content";

const BOSS_HEAD = `WITH best AS (SELECT season_id, player_id, max(score) AS best_score FROM runs GROUP BY season_id, player_id),
mix AS (SELECT r.season_id, r.player_id, count(*) FILTER (WHERE d.difficulty <= 2) AS easy, count(*) FILTER (WHERE d.difficulty = 3) AS mid, count(*) FILTER (WHERE d.difficulty >= 4) AS hard FROM runs r JOIN dungeons d ON d.id = r.dungeon_id GROUP BY r.season_id, r.player_id)`;

const cases: Record<string, CaseSet> = {
	"ch18-the-grand-report/lesson-9": {
		reject: [{ sql: "SELECT season_id, count(*) FROM runs GROUP BY season_id;", why: "no total row" }],
		accept: ["SELECT season_id, count(*) FROM runs GROUP BY GROUPING SETS ((season_id), ());"],
	},
	"ch18-ex01": {
		reject: [
			{ sql: "SELECT p.region, count(*), sum(r.score) FROM runs r JOIN players p ON p.id = r.player_id WHERE p.region IS NOT NULL GROUP BY ROLLUP (p.region);", why: "Hollow's run dropped" },
			{ sql: "SELECT p.region, count(*), sum(r.score) FROM runs r LEFT JOIN players p ON p.id = r.player_id GROUP BY p.region;", why: "no grand total" },
		],
		accept: [
			"SELECT p.region, count(*), sum(r.score) FROM runs r JOIN players p ON p.id = r.player_id GROUP BY GROUPING SETS ((p.region), ());",
			"SELECT p.region, count(*), sum(r.score) FROM runs r JOIN players p ON p.id = r.player_id GROUP BY CUBE (p.region);",
			"SELECT p.region, count(*), sum(r.score) FROM runs r JOIN players p ON p.id = r.player_id GROUP BY p.region UNION ALL SELECT NULL, count(*), sum(score) FROM runs;",
		],
	},
	"ch18-ex02": {
		reject: [
			{ sql: "SELECT CASE WHEN GROUPING(p.region) = 1 THEN '(all)' ELSE p.region END, coalesce(d.name, '(all)'), count(*) FROM runs r JOIN players p ON p.id = r.player_id JOIN dungeons d ON d.id = r.dungeon_id GROUP BY CUBE (p.region, d.name);", why: "CUBE adds per dungeon totals" },
			{ sql: "SELECT p.region, d.name, count(*) FROM runs r JOIN players p ON p.id = r.player_id JOIN dungeons d ON d.id = r.dungeon_id GROUP BY ROLLUP (p.region, d.name);", why: "subtotals not labelled" },
		],
		accept: [
			"SELECT CASE GROUPING(p.region, d.name) WHEN 3 THEN '(all)' ELSE p.region END, CASE WHEN GROUPING(p.region, d.name) >= 1 THEN '(all)' ELSE d.name END, count(*) FROM runs r JOIN players p ON p.id = r.player_id JOIN dungeons d ON d.id = r.dungeon_id GROUP BY ROLLUP (p.region, d.name);",
			"SELECT CASE WHEN GROUPING(p.region) = 1 THEN '(all)' ELSE p.region END, CASE WHEN GROUPING(d.name) = 1 THEN '(all)' ELSE d.name END, count(*) FROM runs r JOIN players p ON p.id = r.player_id JOIN dungeons d ON d.id = r.dungeon_id GROUP BY GROUPING SETS ((p.region, d.name), (p.region), ());",
		],
	},
	"ch18-ex03": {
		reject: [
			{ sql: "SELECT * FROM crosstab('SELECT dungeon_id, season_id, count(*)::int FROM runs GROUP BY 1, 2 ORDER BY 1, 2', 'SELECT generate_series(1, 4)') AS ct(dungeon_id int, s1 int, s2 int, s3 int, s4 int);", why: "NULL instead of 0" },
			{ sql: "SELECT dungeon_id, count(*), count(*), count(*), count(*) FROM runs GROUP BY dungeon_id;", why: "no FILTER: totals in every column" },
		],
		accept: [
			"SELECT dungeon_id, sum(CASE WHEN season_id = 1 THEN 1 ELSE 0 END), sum(CASE WHEN season_id = 2 THEN 1 ELSE 0 END), sum(CASE WHEN season_id = 3 THEN 1 ELSE 0 END), sum(CASE WHEN season_id = 4 THEN 1 ELSE 0 END) FROM runs GROUP BY dungeon_id;",
			"SELECT d.id, count(r.id) FILTER (WHERE r.season_id = 1), count(r.id) FILTER (WHERE r.season_id = 2), count(r.id) FILTER (WHERE r.season_id = 3), count(r.id) FILTER (WHERE r.season_id = 4) FROM dungeons d LEFT JOIN runs r ON r.dungeon_id = d.id GROUP BY d.id;",
		],
	},
	"ch18-ex04": {
		reject: [
			{ sql: "SELECT avg(score), percentile_cont(0.9) WITHIN GROUP (ORDER BY score), mode() WITHIN GROUP (ORDER BY dungeon_id) FROM runs;", why: "average is not the median" },
			{ sql: "SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY score), percentile_disc(0.9) WITHIN GROUP (ORDER BY score), mode() WITHIN GROUP (ORDER BY dungeon_id) FROM runs;", why: "percentile_disc does not interpolate" },
			{ sql: "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY score), percentile_cont(0.9) WITHIN GROUP (ORDER BY score DESC), mode() WITHIN GROUP (ORDER BY dungeon_id) FROM runs;", why: "descending order gives the 10th percentile" },
		],
		accept: [
			"SELECT (percentile_cont(ARRAY[0.5, 0.9]) WITHIN GROUP (ORDER BY score))[1], (percentile_cont(ARRAY[0.5, 0.9]) WITHIN GROUP (ORDER BY score))[2], (SELECT dungeon_id FROM runs GROUP BY dungeon_id ORDER BY count(*) DESC LIMIT 1) FROM runs;",
		],
	},
	"ch18-ex05": {
		reject: [
			{ sql: "SELECT dungeon_id, stddev_pop(score), corr(score, floor_reached) FROM runs GROUP BY dungeon_id HAVING count(*) >= 9;", why: "population instead of sample" },
			{ sql: "SELECT dungeon_id, stddev_samp(score), corr(score, floor_reached) FROM runs GROUP BY dungeon_id HAVING count(*) > 9;", why: "more than 9 instead of 9 or more" },
		],
		accept: ["SELECT dungeon_id, stddev(score), corr(floor_reached, score) FROM runs GROUP BY dungeon_id HAVING count(*) > 8;"],
	},
	"ch18-ex06": {
		reject: [
			{ sql: "SELECT p.handle FROM players p JOIN player_achievements pa ON pa.player_id = p.id GROUP BY p.id, p.handle HAVING count(*) = 3;", why: "any three badges, not the gold ones" },
			{ sql: "SELECT p.handle FROM players p JOIN player_achievements pa ON pa.player_id = p.id JOIN achievements a ON a.id = pa.achievement_id WHERE a.tier = 'gold' GROUP BY p.id, p.handle HAVING count(*) >= 2;", why: "at least two, not all" },
		],
		accept: [
			"SELECT p.handle FROM players p WHERE NOT EXISTS (SELECT 1 FROM achievements a WHERE a.tier = 'gold' AND NOT EXISTS (SELECT 1 FROM player_achievements pa WHERE pa.player_id = p.id AND pa.achievement_id = a.id));",
			"SELECT p.handle FROM players p JOIN player_achievements pa ON pa.player_id = p.id JOIN achievements a ON a.id = pa.achievement_id GROUP BY p.id, p.handle HAVING count(*) FILTER (WHERE a.tier = 'gold') = (SELECT count(*) FROM achievements WHERE tier = 'gold');",
		],
	},
	"ch18-ex07": {
		reject: [
			{ sql: "SELECT count(*), round(avg(score), 1) FROM run_archive TABLESAMPLE SYSTEM (1) REPEATABLE (42);", why: "SYSTEM samples pages" },
			{ sql: "SELECT count(*), round(avg(score), 1) FROM run_archive TABLESAMPLE BERNOULLI (1) REPEATABLE (7);", why: "another seed" },
		],
		accept: ["SELECT count(*) AS n, round(avg(s.score)::numeric, 1) FROM run_archive AS s TABLESAMPLE BERNOULLI (1.0) REPEATABLE (42);"],
	},
	"ch18-ex08": {
		reject: [
			{
				sql: `${BOSS_HEAD}, ranked AS (SELECT *, dense_rank() OVER (PARTITION BY season_id ORDER BY best_score DESC) AS place FROM best)
SELECT k.season_id, k.place, p.handle, k.best_score, m.easy, m.mid, m.hard, (SELECT count(DISTINCT day) FROM daily_logins l WHERE l.player_id = k.player_id)
FROM ranked k JOIN players p ON p.id = k.player_id JOIN mix m USING (season_id, player_id) WHERE k.place <= 4 ORDER BY k.season_id, k.place, p.handle;`,
				why: "dense_rank lets extra players in",
			},
			{
				sql: `${BOSS_HEAD}, ranked AS (SELECT *, rank() OVER (PARTITION BY season_id ORDER BY best_score DESC) AS place FROM best)
SELECT k.season_id, k.place, p.handle, k.best_score, m.easy, m.mid, m.hard, (SELECT count(*) FROM daily_logins l WHERE l.player_id = k.player_id)
FROM ranked k JOIN players p ON p.id = k.player_id JOIN mix m USING (season_id, player_id) WHERE k.place <= 4 ORDER BY k.season_id, k.place, p.handle;`,
				why: "login doubles counted",
			},
			{
				sql: `${BOSS_HEAD}, ranked AS (SELECT *, rank() OVER (PARTITION BY season_id ORDER BY best_score DESC) AS place FROM best)
SELECT k.season_id, k.place, p.handle, k.best_score, m.easy, m.mid, m.hard, l.n
FROM ranked k JOIN players p ON p.id = k.player_id JOIN mix m USING (season_id, player_id) JOIN (SELECT player_id, count(DISTINCT day) AS n FROM daily_logins GROUP BY player_id) l ON l.player_id = k.player_id WHERE k.place <= 4 ORDER BY k.season_id, k.place, p.handle;`,
				why: "inner join drops players who never logged in",
			},
			{
				sql: `WITH ranked AS (SELECT r.season_id, r.player_id, r.score AS best_score, rank() OVER (PARTITION BY r.season_id ORDER BY r.score DESC) AS place FROM runs r),
mix AS (SELECT r.season_id, r.player_id, count(*) FILTER (WHERE d.difficulty <= 2) AS easy, count(*) FILTER (WHERE d.difficulty = 3) AS mid, count(*) FILTER (WHERE d.difficulty >= 4) AS hard FROM runs r JOIN dungeons d ON d.id = r.dungeon_id GROUP BY r.season_id, r.player_id)
SELECT k.season_id, k.place, p.handle, k.best_score, m.easy, m.mid, m.hard, (SELECT count(DISTINCT day) FROM daily_logins l WHERE l.player_id = k.player_id)
FROM ranked k JOIN players p ON p.id = k.player_id JOIN mix m USING (season_id, player_id) WHERE k.place <= 4 ORDER BY k.season_id, k.place, p.handle;`,
				why: "ranks single runs, not each player's best",
			},
		],
		accept: [
			`${BOSS_HEAD}, ranked AS (SELECT *, rank() OVER (PARTITION BY season_id ORDER BY best_score DESC) AS place FROM best)
SELECT k.season_id, k.place, p.handle, k.best_score, m.easy, m.mid, m.hard, (SELECT count(DISTINCT day) FROM daily_logins l WHERE l.player_id = k.player_id) AS login_days
FROM ranked k JOIN players p ON p.id = k.player_id JOIN mix m USING (season_id, player_id) WHERE k.place <= 4 ORDER BY 1, 2, 3;`,
		],
	},
	"ch18-pr01": {
		reject: [{ sql: "SELECT season_id, dungeon_id, count(*) FROM runs GROUP BY ROLLUP (season_id, dungeon_id);", why: "ROLLUP gives pairs and no per dungeon totals" }],
		accept: ["SELECT season_id, NULL::int, count(*) FROM runs GROUP BY season_id UNION ALL SELECT NULL, dungeon_id, count(*) FROM runs GROUP BY dungeon_id UNION ALL SELECT NULL, NULL, count(*) FROM runs;"],
	},
	"ch18-pr02": {
		reject: [{ sql: "SELECT p.region, r.season_id, count(*), GROUPING(p.region, r.season_id) FROM runs r JOIN players p ON p.id = r.player_id GROUP BY ROLLUP (p.region, r.season_id);", why: "ROLLUP misses the per season totals" }],
	},
	"ch18-pr03": {
		reject: [{ sql: "SELECT p.region, count(*) FILTER (WHERE r.death_cause IS NULL), count(*) FILTER (WHERE r.death_cause IS NOT NULL), count(*) FILTER (WHERE r.ended_at IS NULL) FROM runs r JOIN players p ON p.id = r.player_id GROUP BY p.region;", why: "abandoned runs counted as cleared" }],
	},
	"ch18-pr04": {
		reject: [{ sql: "SELECT * FROM crosstab('SELECT dungeon_id, season_id, count(*)::int FROM runs GROUP BY 1, 2 ORDER BY 1, 2') AS ct(dungeon_id int, s1 int, s2 int, s3 int, s4 int);", why: "one argument form shifts values left" }],
		accept: ["SELECT dungeon_id, nullif(count(*) FILTER (WHERE season_id = 1), 0)::int, nullif(count(*) FILTER (WHERE season_id = 2), 0)::int, nullif(count(*) FILTER (WHERE season_id = 3), 0)::int, nullif(count(*) FILTER (WHERE season_id = 4), 0)::int FROM runs GROUP BY dungeon_id;"],
	},
	"ch18-pr05": {
		reject: [{ sql: "SELECT regr_slope(floor_reached, score), regr_intercept(floor_reached, score) FROM runs;", why: "x and y swapped" }],
	},
	"ch18-pr06": {
		reject: [{ sql: "SELECT dungeon_id, avg(extract(epoch FROM ended_at - started_at) / 60) FROM runs WHERE ended_at IS NOT NULL GROUP BY dungeon_id;", why: "average, not median" }],
	},
	"ch18-pr07": {
		reject: [{ sql: "SELECT DISTINCT p.handle FROM players p JOIN player_achievements pa ON pa.player_id = p.id JOIN achievements a ON a.id = pa.achievement_id WHERE a.tier IN ('silver');", why: "at least one silver badge" }],
	},
	"ch18-pr08": {
		reject: [{ sql: "SELECT p.handle FROM players p JOIN runs r ON r.player_id = p.id GROUP BY p.id, p.handle HAVING count(*) = 5;", why: "counts runs, not distinct dungeons" }],
		accept: ["SELECT p.handle FROM players p JOIN runs r ON r.player_id = p.id GROUP BY p.id, p.handle HAVING count(DISTINCT r.dungeon_id) = (SELECT count(*) FROM dungeons);"],
	},
	"ch18-pr09": {
		reject: [{ sql: "SELECT setseed(0.24);\nSELECT handle FROM players ORDER BY random() LIMIT 3;", why: "another seed" }],
	},
};

export default cases;
