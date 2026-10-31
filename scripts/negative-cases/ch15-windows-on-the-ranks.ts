// Negative and accept cases for ch15-windows-on-the-ranks.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch15-windows-on-the-ranks/lesson-9": {
		reject: [
			{ sql: "SELECT id, score, avg(score) OVER (PARTITION BY season_id) FROM runs;", why: "season average instead of the overall one" },
		],
		accept: ["SELECT r.id, r.score, (SELECT avg(score) FROM runs) AS a FROM runs r;"],
	},
	"ch15-ex01": {
		reject: [
			{ sql: "SELECT id, score, max(score) AS best FROM runs GROUP BY id, score;", why: "GROUP BY per run repeats the run's own score" },
			{ sql: "SELECT id, score, max(score) OVER (PARTITION BY season_id) FROM runs;", why: "best of the season, not of all runs" },
		],
		accept: [
			"SELECT id, score, (SELECT max(score) FROM runs) AS best FROM runs;",
			"SELECT r.id AS run, r.score AS pts, max(r.score) OVER () AS top FROM runs AS r ORDER BY r.id;",
		],
	},
	"ch15-ex02": {
		reject: [
			{ sql: "SELECT id, season_id, score, avg(score) OVER () FROM runs;", why: "average of all runs, no partition" },
			{ sql: "SELECT id, season_id, score, round(avg(score) OVER (PARTITION BY season_id), 1) FROM runs;", why: "rounded" },
			{ sql: "SELECT id, season_id, score, avg(score) OVER (PARTITION BY season_id ORDER BY started_at) FROM runs;", why: "ORDER BY makes it a running average" },
		],
		accept: [
			"SELECT r.id, r.season_id, r.score, (SELECT avg(x.score) FROM runs x WHERE x.season_id = r.season_id) FROM runs r;",
			"SELECT id, season_id, score, avg(score) OVER w FROM runs WINDOW w AS (PARTITION BY season_id);",
		],
	},
	"ch15-ex03": {
		reject: [
			{ sql: "SELECT id, score, rank() OVER (ORDER BY score DESC) FROM runs WHERE season_id = 4;", why: "rank leaves gaps" },
			{ sql: "SELECT id, score, row_number() OVER (ORDER BY score DESC, id) FROM runs WHERE season_id = 4;", why: "row_number splits ties" },
			{ sql: "SELECT id, score, dense_rank() OVER (ORDER BY score) FROM runs WHERE season_id = 4;", why: "lowest score ranked first" },
		],
		accept: ["SELECT id, score, dense_rank() OVER w AS shelf FROM runs WHERE season_id = 4 WINDOW w AS (ORDER BY score DESC) ORDER BY 3;"],
	},
	"ch15-ex04": {
		reject: [
			{ sql: "SELECT id, score, dense_rank() OVER (ORDER BY score DESC) FROM runs WHERE season_id = 4;", why: "dense_rank gives 5100 place 2" },
			{ sql: "SELECT id, score, row_number() OVER (ORDER BY score DESC, id) FROM runs WHERE season_id = 4;", why: "ties get different places" },
		],
		accept: [
			"SELECT r.id, r.score, (SELECT count(*) + 1 FROM runs x WHERE x.season_id = 4 AND x.score > r.score) FROM runs r WHERE r.season_id = 4;",
		],
	},
	"ch15-ex05": {
		reject: [
			{ sql: "SELECT id, score, score - lag(score) OVER (ORDER BY score) FROM runs WHERE player_id = 1;", why: "window ordered by score, not time" },
			{ sql: "SELECT id, score, score - lag(score, 1, 0) OVER (ORDER BY started_at) FROM runs WHERE player_id = 1;", why: "default 0 instead of NULL on the first run" },
			{ sql: "SELECT id, score, lag(score) OVER (ORDER BY started_at) - score FROM runs WHERE player_id = 1;", why: "sign reversed" },
		],
		accept: [
			"SELECT id, score, score - lag(score, 1) OVER (ORDER BY started_at) AS d FROM runs WHERE player_id = 1;",
			"SELECT id, score, score - lead(score) OVER (ORDER BY started_at DESC) FROM runs WHERE player_id = 1;",
		],
	},
	"ch15-ex06": {
		reject: [
			{ sql: "SELECT player_id, id, score, sum(score) OVER (PARTITION BY player_id) FROM runs;", why: "no ORDER BY: grand total per player" },
			{ sql: "SELECT player_id, id, score, sum(score) OVER (PARTITION BY player_id ORDER BY score) FROM runs;", why: "ordered by score, not time" },
		],
		accept: [
			"SELECT r.player_id, r.id, r.score, (SELECT sum(x.score) FROM runs x WHERE x.player_id = r.player_id AND x.started_at <= r.started_at) FROM runs r;",
			"SELECT player_id, id, score, sum(score) OVER (PARTITION BY player_id ORDER BY started_at ROWS UNBOUNDED PRECEDING) FROM runs;",
		],
	},
	"ch15-ex07": {
		reject: [
			{ sql: "SELECT id, score, sum(score) OVER (ORDER BY score DESC RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM runs WHERE season_id = 4;", why: "explicit RANGE frame still adds peers together" },
			{ sql: "SELECT id, score, sum(score) OVER (ORDER BY score DESC, id DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM runs WHERE season_id = 4;", why: "tie breaker reversed" },
			{ sql: "SELECT id, score, sum(score) OVER (ORDER BY score, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM runs WHERE season_id = 4;", why: "lowest score first" },
		],
		accept: [
			"SELECT id, score, sum(score) OVER (ORDER BY score DESC, id) FROM runs WHERE season_id = 4;",
			"SELECT id, score, sum(score) OVER (ORDER BY score DESC, id ROWS UNBOUNDED PRECEDING) AS running FROM runs WHERE season_id = 4;",
		],
	},
	"ch15-ex08": {
		reject: [
			{
				sql: "SELECT p.handle, r.score, dense_rank() OVER (ORDER BY r.score DESC), lag(r.score) OVER (ORDER BY r.score DESC, r.id) - r.score, avg(r.score) OVER (ORDER BY r.score DESC, r.id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) FROM runs r JOIN players p ON p.id = r.player_id WHERE r.season_id = 4 ORDER BY r.score DESC, r.id;",
				why: "dense_rank instead of rank",
			},
			{
				sql: "SELECT p.handle, r.score, rank() OVER (ORDER BY r.score DESC), lag(r.score) OVER (ORDER BY r.score DESC, r.id) - r.score, avg(r.score) OVER (ORDER BY r.score DESC, r.id) FROM runs r JOIN players p ON p.id = r.player_id WHERE r.season_id = 4 ORDER BY r.score DESC, r.id;",
				why: "cumulative average instead of a 3 run moving average",
			},
			{
				sql: "SELECT p.handle, r.score, rank() OVER (ORDER BY r.score DESC), lag(r.score) OVER (ORDER BY r.score DESC, r.id) - r.score, avg(r.score) OVER (ORDER BY r.score DESC, r.id ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) FROM runs r JOIN players p ON p.id = r.player_id WHERE r.season_id = 4 ORDER BY r.score DESC, r.id;",
				why: "moving average frame off by one",
			},
			{
				sql: "SELECT p.handle, r.score, rank() OVER (ORDER BY r.score DESC), r.score - lag(r.score) OVER (ORDER BY r.score DESC, r.id), avg(r.score) OVER (ORDER BY r.score DESC, r.id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) FROM runs r JOIN players p ON p.id = r.player_id WHERE r.season_id = 4 ORDER BY r.score DESC, r.id;",
				why: "gap sign reversed",
			},
		],
		accept: [
			"WITH s AS (SELECT r.id, r.player_id, r.score FROM runs r WHERE r.season_id = 4) SELECT p.handle, s.score, rank() OVER (ORDER BY s.score DESC) AS rnk, lag(s.score) OVER (ORDER BY s.score DESC, s.id) - s.score AS gap, avg(s.score) OVER (ORDER BY s.score DESC, s.id ROWS 2 PRECEDING) AS ma FROM s JOIN players p ON p.id = s.player_id ORDER BY s.score DESC, s.id;",
		],
	},
	"ch15-pr02": {
		reject: [{ sql: "SELECT id, dungeon_id, score, max(score) OVER (PARTITION BY dungeon_id ORDER BY started_at) FROM runs;", why: "record so far, not the dungeon record" }],
	},
	"ch15-pr03": {
		reject: [{ sql: "SELECT id, score, dense_rank() OVER (ORDER BY score DESC), rank() OVER (ORDER BY score DESC) FROM runs WHERE season_id = 2;", why: "columns swapped" }],
		accept: ["SELECT id, score, rank() OVER w, dense_rank() OVER w FROM runs WHERE season_id = 2 WINDOW w AS (ORDER BY score DESC);"],
	},
	"ch15-pr05": {
		reject: [{ sql: "SELECT id, started_at, lag(started_at) OVER (ORDER BY started_at) FROM runs WHERE player_id = 7;", why: "previous run instead of next" }],
	},
	"ch15-pr06": {
		reject: [
			{ sql: "SELECT id, score, first_value(score) OVER w, last_value(score) OVER w FROM runs WHERE player_id = 1 WINDOW w AS (ORDER BY started_at RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW);", why: "frame still ends at the current row" },
		],
		accept: [
			"SELECT id, score, first_value(score) OVER (ORDER BY started_at), first_value(score) OVER (ORDER BY started_at DESC) FROM runs WHERE player_id = 1;",
		],
	},
	"ch15-pr07": {
		reject: [
			{ sql: "SELECT id, avg(score) OVER (ORDER BY started_at ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) FROM runs WHERE player_id = 1;", why: "4 runs, off by one" },
			{ sql: "SELECT id, avg(score) OVER (ORDER BY started_at) FROM runs WHERE player_id = 1;", why: "cumulative average" },
		],
		accept: ["SELECT id, avg(score) OVER (ORDER BY started_at ROWS 2 PRECEDING) FROM runs WHERE player_id = 1;"],
	},
	"ch15-pr08": {
		reject: [{ sql: "SELECT season_id, id, count(*) OVER (ORDER BY started_at) FROM runs;", why: "no partition: counts across seasons" }],
		accept: ["SELECT season_id, id, row_number() OVER (PARTITION BY season_id ORDER BY started_at) FROM runs;"],
	},
};

export default cases;
