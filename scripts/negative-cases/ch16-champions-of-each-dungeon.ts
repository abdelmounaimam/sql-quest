// Negative and accept cases for ch16-champions-of-each-dungeon.
import type { CaseSet } from "../validate-content";

const BOSS_ROWNUM = `WITH ranked AS (
  SELECT r.dungeon_id, p.handle, r.score,
         row_number() OVER (PARTITION BY r.dungeon_id ORDER BY r.score DESC, r.started_at) AS rn
  FROM runs r JOIN players p ON p.id = r.player_id)
SELECT d.name, max(handle) FILTER (WHERE rn = 1), max(score) FILTER (WHERE rn = 1),
       max(handle) FILTER (WHERE rn = 2), max(score) FILTER (WHERE rn = 2)
FROM dungeons d LEFT JOIN ranked k ON k.dungeon_id = d.id AND k.rn <= 2
GROUP BY d.id, d.name;`;

const cases: Record<string, CaseSet> = {
	"ch16-champions-of-each-dungeon/lesson-9": {
		reject: [{ sql: "SELECT DISTINCT ON (dungeon_id) dungeon_id, id, started_at FROM runs ORDER BY dungeon_id, score DESC;", why: "best run, not latest" }],
		accept: ["SELECT dungeon_id, id, started_at FROM runs r WHERE started_at = (SELECT max(started_at) FROM runs x WHERE x.dungeon_id = r.dungeon_id);"],
	},
	"ch16-ex01": {
		reject: [
			{ sql: "SELECT DISTINCT ON (player_id) player_id, id, score FROM runs ORDER BY player_id, started_at;", why: "first run, not best" },
			{ sql: "SELECT player_id, max(id), max(score) FROM runs GROUP BY player_id;", why: "max(id) is not the id of the best run" },
		],
		accept: [
			"WITH k AS (SELECT player_id, id, score, row_number() OVER (PARTITION BY player_id ORDER BY score DESC, started_at) AS rn FROM runs) SELECT player_id, id, score FROM k WHERE rn = 1;",
			"SELECT DISTINCT ON (r.player_id) r.player_id AS p, r.id AS run, r.score AS best FROM runs AS r ORDER BY r.player_id, r.score DESC, r.started_at ASC;",
		],
	},
	"ch16-ex02": {
		reject: [
			{ sql: "SELECT r.dungeon_id, r.id, r.score FROM runs r JOIN (SELECT dungeon_id, max(score) AS m FROM runs GROUP BY dungeon_id) b ON b.dungeon_id = r.dungeon_id AND b.m = r.score;", why: "max then join back keeps every tied run" },
			{ sql: "SELECT DISTINCT ON (dungeon_id) dungeon_id, id, score FROM runs ORDER BY dungeon_id, score DESC, started_at DESC;", why: "latest record holder instead of earliest" },
		],
		accept: [
			"SELECT d.id, r.id, r.score FROM dungeons d CROSS JOIN LATERAL (SELECT id, score FROM runs WHERE dungeon_id = d.id ORDER BY score DESC, started_at LIMIT 1) r;",
		],
	},
	"ch16-ex03": {
		reject: [
			{ sql: "WITH k AS (SELECT season_id, id, score, rank() OVER (PARTITION BY season_id ORDER BY score DESC) AS rn FROM runs) SELECT season_id, id, score FROM k WHERE rn <= 3;", why: "rank returns more than 3 rows on ties" },
			{ sql: "SELECT season_id, id, score FROM runs ORDER BY score DESC LIMIT 12;", why: "global top 12, not per season" },
			{ sql: "WITH k AS (SELECT season_id, id, score, row_number() OVER (PARTITION BY season_id ORDER BY score DESC, started_at DESC) AS rn FROM runs) SELECT season_id, id, score FROM k WHERE rn <= 3;", why: "latest wins the tie" },
		],
		accept: [
			"SELECT s.id, r.id, r.score FROM seasons s CROSS JOIN LATERAL (SELECT id, score FROM runs WHERE season_id = s.id ORDER BY score DESC, started_at LIMIT 3) r;",
			"SELECT season_id, id, score FROM (SELECT *, row_number() OVER (PARTITION BY season_id ORDER BY score DESC, started_at) AS rn FROM runs) t WHERE rn < 4;",
		],
	},
	"ch16-ex04": {
		reject: [
			{ sql: "WITH k AS (SELECT season_id, id, score, dense_rank() OVER (PARTITION BY season_id ORDER BY score DESC) AS p FROM runs) SELECT season_id, id, score FROM k WHERE p <= 3;", why: "dense_rank lets 4th and 5th scores in" },
			{ sql: "WITH k AS (SELECT season_id, id, score, row_number() OVER (PARTITION BY season_id ORDER BY score DESC, started_at) AS p FROM runs) SELECT season_id, id, score FROM k WHERE p <= 3;", why: "row_number drops tied runs" },
		],
		accept: [
			"SELECT r.season_id, r.id, r.score FROM runs r WHERE (SELECT count(*) FROM runs x WHERE x.season_id = r.season_id AND x.score > r.score) < 3;",
			"SELECT season_id, id, score FROM (SELECT season_id, id, score, rank() OVER w AS p FROM runs WINDOW w AS (PARTITION BY season_id ORDER BY score DESC)) t WHERE p <= 3;",
		],
	},
	"ch16-ex05": {
		reject: [
			{ sql: "SELECT p.handle, r.score, r.started_at FROM players p LEFT JOIN LATERAL (SELECT score, started_at FROM runs WHERE player_id = p.id ORDER BY started_at LIMIT 1) r ON true;", why: "first run instead of most recent" },
			{ sql: "SELECT p.handle, r.score, r.started_at FROM players p LEFT JOIN runs r ON r.player_id = p.id;", why: "every run, not the latest" },
		],
		accept: [
			"SELECT p.handle, l.score, l.started_at FROM players p LEFT JOIN (SELECT DISTINCT ON (player_id) player_id, score, started_at FROM runs ORDER BY player_id, started_at DESC) l ON l.player_id = p.id;",
		],
	},
	"ch16-ex06": {
		reject: [
			{ sql: "SELECT p.handle, r.score FROM players p LEFT JOIN LATERAL (SELECT score FROM runs WHERE player_id = p.id ORDER BY score DESC, started_at LIMIT 2) r ON true;", why: "LEFT JOIN keeps players without runs" },
			{ sql: "SELECT p.handle, r.score FROM players p CROSS JOIN LATERAL (SELECT score FROM runs WHERE player_id = p.id ORDER BY started_at DESC LIMIT 2) r;", why: "latest runs, not best" },
		],
		accept: [
			"SELECT p.handle, r.score FROM players p JOIN LATERAL (SELECT score FROM runs WHERE player_id = p.id ORDER BY score DESC, started_at LIMIT 2) r ON true;",
			"WITH k AS (SELECT player_id, score, row_number() OVER (PARTITION BY player_id ORDER BY score DESC, started_at) AS rn FROM runs) SELECT p.handle, k.score FROM k JOIN players p ON p.id = k.player_id WHERE rn <= 2;",
		],
	},
	"ch16-ex07": {
		reject: [
			{ sql: "SELECT DISTINCT ON (player_id) player_id, day FROM daily_logins ORDER BY player_id, day;", why: "one row per player, not per day" },
			{ sql: "SELECT player_id, day FROM daily_logins GROUP BY player_id, day HAVING count(*) = 1;", why: "drops the duplicated days entirely" },
		],
		accept: [
			"SELECT player_id, day FROM daily_logins GROUP BY player_id, day;",
			"SELECT player_id, day FROM (SELECT player_id, day, row_number() OVER (PARTITION BY player_id, day) AS rn FROM daily_logins) t WHERE rn = 1;",
			"SELECT player_id, day FROM daily_logins UNION SELECT player_id, day FROM daily_logins;",
		],
	},
	"ch16-ex08": {
		reject: [
			{ sql: "SELECT player_id, count(day) FROM daily_logins GROUP BY player_id;", why: "count(day) still counts rows" },
			{ sql: "SELECT player_id, count(DISTINCT player_id) FROM daily_logins GROUP BY player_id;", why: "distinct on the wrong column" },
		],
		accept: [
			"SELECT player_id, count(*) FROM (SELECT DISTINCT player_id, day FROM daily_logins) t GROUP BY player_id;",
		],
	},
	"ch16-ex09": {
		reject: [
			{
				sql: `WITH ranked AS (SELECT r.dungeon_id, p.handle, r.score, dense_rank() OVER (PARTITION BY r.dungeon_id ORDER BY r.score DESC) AS dr, row_number() OVER (PARTITION BY r.dungeon_id ORDER BY r.score DESC, r.started_at) AS rn FROM runs r JOIN players p ON p.id = r.player_id)
SELECT d.name, c.handle, c.score, u.handle, u.score FROM dungeons d
LEFT JOIN ranked c ON c.dungeon_id = d.id AND c.rn = 1
LEFT JOIN LATERAL (SELECT handle, score FROM ranked x WHERE x.dungeon_id = d.id AND x.dr = 2 ORDER BY x.rn LIMIT 1) u ON true;`,
				why: "runner up taken as the second distinct score",
			},
			{
				sql: "SELECT d.name, c.handle, c.score, ru.handle, ru.score FROM dungeons d LEFT JOIN LATERAL (SELECT p.handle, r.score FROM runs r JOIN players p ON p.id = r.player_id WHERE r.dungeon_id = d.id ORDER BY r.score DESC, r.started_at DESC LIMIT 1) c ON true LEFT JOIN LATERAL (SELECT p.handle, r.score FROM runs r JOIN players p ON p.id = r.player_id WHERE r.dungeon_id = d.id ORDER BY r.score DESC, r.started_at DESC LIMIT 1 OFFSET 1) ru ON true;",
				why: "latest record holder wins the tie",
			},
		],
		accept: [BOSS_ROWNUM],
	},
	"ch16-pr03": {
		reject: [
			{ sql: "WITH k AS (SELECT dungeon_id, id, row_number() OVER (PARTITION BY dungeon_id ORDER BY ended_at - started_at DESC, id) AS rn FROM runs) SELECT dungeon_id, id FROM k WHERE rn <= 2;", why: "abandoned runs (NULL duration) sort first" },
		],
		accept: ["SELECT d.id, r.id FROM dungeons d CROSS JOIN LATERAL (SELECT id FROM runs WHERE dungeon_id = d.id AND ended_at IS NOT NULL ORDER BY ended_at - started_at DESC, id LIMIT 2) r;"],
	},
	"ch16-pr04": {
		reject: [
			{ sql: "SELECT DISTINCT ON (p.region) p.region, p.handle, r.score FROM runs r JOIN players p ON p.id = r.player_id WHERE p.region IS NOT NULL ORDER BY p.region, r.score DESC, r.id;", why: "DISTINCT ON drops the tie" },
		],
	},
	"ch16-pr05": {
		reject: [{ sql: "SELECT d.name, r.id, r.started_at FROM dungeons d JOIN runs r ON r.dungeon_id = d.id WHERE r.id IN (SELECT id FROM runs ORDER BY started_at DESC LIMIT 2);", why: "2 runs overall, not per dungeon" }],
		accept: ["WITH k AS (SELECT dungeon_id, id, started_at, row_number() OVER (PARTITION BY dungeon_id ORDER BY started_at DESC) AS rn FROM runs) SELECT d.name, k.id, k.started_at FROM k JOIN dungeons d ON d.id = k.dungeon_id WHERE rn <= 2;"],
	},
	"ch16-pr06": {
		reject: [{ sql: "SELECT player_id, day, count(*) FROM daily_logins GROUP BY player_id, day HAVING count(*) > 1;", why: "copies instead of extra copies" }],
	},
	"ch16-pr07": {
		reject: [
			{ sql: "WITH n AS (SELECT player_id, day, row_number() OVER (PARTITION BY player_id ORDER BY day) AS c FROM daily_logins) SELECT player_id, day, c FROM n WHERE c >= 2;", why: "partition by player only" },
		],
		accept: ["SELECT player_id, day, c FROM (SELECT player_id, day, row_number() OVER (PARTITION BY player_id, day ORDER BY day) AS c FROM daily_logins) t WHERE c > 1;"],
	},
};

export default cases;
