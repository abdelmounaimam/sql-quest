// Negative and accept cases for ch17-patterns-in-time.
import type { CaseSet } from "../validate-content";

const SERIES = "generate_series(date '2026-02-23', date '2026-03-14', interval '1 day') AS d";

const cases: Record<string, CaseSet> = {
	"ch17-patterns-in-time/lesson-9": {
		reject: [{ sql: "SELECT to_char(played_at, 'DD/MM'), count(*) FROM plays GROUP BY 1;", why: "text bucket" }],
		accept: ["SELECT date_trunc('day', played_at)::date, count(*) FROM plays GROUP BY 1 ORDER BY 1;"],
	},
	"ch17-ex01": {
		reject: [
			{ sql: "SELECT date_trunc('hour', played_at), count(*) FROM plays GROUP BY 1;", why: "every day, not only 23 February" },
			{ sql: "SELECT date_trunc('day', played_at), count(*) FROM plays WHERE played_at::date = '2026-02-23' GROUP BY 1;", why: "day bucket instead of hour" },
		],
		accept: [
			"SELECT date_trunc('hour', played_at) AS h, count(*) FROM plays WHERE played_at::date = date '2026-02-23' GROUP BY date_trunc('hour', played_at);",
			"SELECT date_bin('1 hour', played_at, timestamptz '2026-01-01 00:00+00'), count(*) FROM plays WHERE played_at >= '2026-02-23' AND played_at < '2026-02-24' GROUP BY 1;",
		],
	},
	"ch17-ex02": {
		reject: [
			{ sql: "SELECT date_bin('15 minutes', played_at, timestamptz '2026-01-01 00:05+00'), count(*) FROM plays WHERE listener_id = 5 GROUP BY 1;", why: "origin shifted by 5 minutes" },
			{ sql: "SELECT date_bin('30 minutes', played_at, timestamptz '2026-01-01 00:00+00'), count(*) FROM plays WHERE listener_id = 5 GROUP BY 1;", why: "30 minute buckets" },
		],
		accept: [
			"SELECT date_trunc('hour', played_at) + floor(extract(minute FROM played_at) / 15) * interval '15 minutes' AS slot, count(*) FROM plays WHERE listener_id = 5 GROUP BY 1;",
			"SELECT date_bin('15 minutes', played_at, '2000-01-01'), count(*) FROM plays WHERE listener_id = 5 GROUP BY 1;",
		],
	},
	"ch17-ex03": {
		reject: [
			{ sql: "SELECT played_at::date, count(*) FROM plays GROUP BY 1 ORDER BY 2 DESC, 1;", why: "ordered by plays" },
		],
		accept: [
			"SELECT date_trunc('day', played_at)::date AS d, count(*) FROM plays GROUP BY 1 ORDER BY d ASC;",
			"SELECT to_char(played_at, 'YYYY-MM-DD'), count(*) FROM plays GROUP BY 1 ORDER BY 1;",
		],
	},
	"ch17-ex04": {
		reject: [
			{ sql: `SELECT d::date, count(*) FROM ${SERIES} LEFT JOIN plays p ON p.played_at::date = d::date GROUP BY d;`, why: "count(*) gives 1 on the empty day" },
			{ sql: `SELECT d::date, count(p.id) FROM ${SERIES} JOIN plays p ON p.played_at::date = d::date GROUP BY d;`, why: "inner join drops the empty day" },
			{ sql: `SELECT d::date, count(p.id) FROM generate_series(date '2026-02-23', date '2026-03-13', interval '1 day') AS d LEFT JOIN plays p ON p.played_at::date = d::date GROUP BY d;`, why: "last day missing" },
		],
		accept: [
			`SELECT d::date, count(p.played_at) FROM ${SERIES} LEFT JOIN plays p ON p.played_at >= d AND p.played_at < d + interval '1 day' GROUP BY d;`,
			"SELECT d.day, coalesce(c.n, 0) FROM (SELECT generate_series(date '2026-02-23', date '2026-03-14', interval '1 day')::date AS day) d LEFT JOIN (SELECT played_at::date AS day, count(*) AS n FROM plays GROUP BY 1) c USING (day);",
		],
	},
	"ch17-ex05": {
		reject: [
			{ sql: `SELECT d::date, count(p.id) FROM ${SERIES} LEFT JOIN plays p ON p.played_at::date = d::date WHERE p.listener_id = 1 OR p.listener_id IS NULL GROUP BY d;`, why: "drops days where only others played" },
			{ sql: `SELECT d::date, count(p.id) FROM ${SERIES} LEFT JOIN plays p ON p.played_at::date = d::date GROUP BY d;`, why: "counts every listener" },
		],
		accept: [
			`SELECT d::date, count(p.id) FROM ${SERIES} LEFT JOIN (SELECT * FROM plays WHERE listener_id = 1) p ON p.played_at::date = d::date GROUP BY d;`,
			`SELECT d::date, count(*) FILTER (WHERE p.listener_id = 1) FROM ${SERIES} LEFT JOIN plays p ON p.played_at::date = d::date GROUP BY d;`,
		],
	},
	"ch17-ex06": {
		reject: [
			{
				sql: "WITH i AS (SELECT listener_id, played_at::date AS day, played_at::date - (row_number() OVER (PARTITION BY listener_id ORDER BY played_at))::int AS grp FROM plays) SELECT listener_id, min(day), max(day), count(DISTINCT day) FROM i GROUP BY listener_id, grp HAVING count(DISTINCT day) >= 3;",
				why: "days not deduplicated before row_number",
			},
			{
				sql: "WITH d AS (SELECT DISTINCT listener_id, played_at::date AS day FROM plays), i AS (SELECT listener_id, day, day - (row_number() OVER (ORDER BY listener_id, day))::int AS grp FROM d) SELECT listener_id, min(day), max(day), count(*) FROM i GROUP BY listener_id, grp HAVING count(*) > 3;",
				why: "more than 3 instead of 3 or more",
			},
		],
		accept: [
			"WITH d AS (SELECT DISTINCT listener_id, played_at::date AS day FROM plays), f AS (SELECT listener_id, day, CASE WHEN day - lag(day) OVER (PARTITION BY listener_id ORDER BY day) = 1 THEN 0 ELSE 1 END AS brk FROM d), g AS (SELECT listener_id, day, sum(brk) OVER (PARTITION BY listener_id ORDER BY day) AS isl FROM f) SELECT listener_id, min(day), max(day), count(*) FROM g GROUP BY listener_id, isl HAVING count(*) >= 3;",
		],
	},
	"ch17-ex07": {
		reject: [
			{
				sql: "WITH f AS (SELECT listener_id, played_at - lag(played_at) OVER (PARTITION BY listener_id ORDER BY played_at) AS gap FROM plays) SELECT listener_id, count(*) FILTER (WHERE gap IS NULL OR gap >= interval '30 minutes') FROM f GROUP BY listener_id;",
				why: ">= splits the exact 30 minute pause",
			},
			{
				sql: "WITH f AS (SELECT listener_id, played_at - lag(played_at) OVER (PARTITION BY listener_id ORDER BY played_at) AS gap FROM plays) SELECT listener_id, count(*) FILTER (WHERE gap > interval '30 minutes') FROM f GROUP BY listener_id;",
				why: "first play does not start a session",
			},
		],
		accept: [
			"WITH f AS (SELECT listener_id, CASE WHEN lag(played_at) OVER w IS NULL OR played_at - lag(played_at) OVER w > interval '30 minutes' THEN 1 ELSE 0 END AS s FROM plays WINDOW w AS (PARTITION BY listener_id ORDER BY played_at)) SELECT listener_id, sum(s) FROM f GROUP BY listener_id;",
		],
	},
	"ch17-ex08": {
		reject: [
			{
				sql: "WITH f AS (SELECT played_at, ms_played, CASE WHEN played_at - lag(played_at) OVER (ORDER BY played_at) >= interval '30 minutes' OR lag(played_at) OVER (ORDER BY played_at) IS NULL THEN 1 ELSE 0 END AS s FROM plays WHERE listener_id = 5), n AS (SELECT *, sum(s) OVER (ORDER BY played_at) AS k FROM f) SELECT k, min(played_at), max(played_at), count(*), sum(ms_played) / 60000.0 FROM n GROUP BY k ORDER BY k;",
				why: ">= splits the 30 minute pause",
			},
			{
				sql: "WITH f AS (SELECT played_at, ms_played, CASE WHEN played_at - lag(played_at) OVER (ORDER BY played_at) > interval '30 minutes' THEN 1 ELSE 0 END AS s FROM plays WHERE listener_id = 5), n AS (SELECT *, sum(s) OVER (ORDER BY played_at) AS k FROM f) SELECT k, min(played_at), max(played_at), count(*), sum(ms_played) / 60000.0 FROM n GROUP BY k ORDER BY k;",
				why: "first session numbered 0",
			},
			{
				sql: "WITH f AS (SELECT played_at, ms_played, CASE WHEN lag(played_at) OVER (ORDER BY played_at) IS NULL OR played_at - lag(played_at) OVER (ORDER BY played_at) > interval '30 minutes' THEN 1 ELSE 0 END AS s FROM plays WHERE listener_id = 5), n AS (SELECT *, sum(s) OVER (ORDER BY played_at) AS k FROM f) SELECT k, min(played_at), max(played_at), count(*), sum(ms_played) / 60000 FROM n GROUP BY k ORDER BY k;",
				why: "integer division truncates the minutes",
			},
		],
		accept: [
			"WITH f AS (SELECT played_at, ms_played, coalesce(played_at - lag(played_at) OVER w > interval '30 minutes', true) AS s FROM plays WHERE listener_id = 5 WINDOW w AS (ORDER BY played_at)), n AS (SELECT *, count(*) FILTER (WHERE s) OVER (ORDER BY played_at) AS k FROM f) SELECT k AS session_no, min(played_at), max(played_at), count(*), sum(ms_played)::numeric / 60000 FROM n GROUP BY k ORDER BY k;",
		],
	},
	"ch17-pr02": {
		reject: [
			{ sql: "SELECT h, count(p.id) FROM generate_series(timestamptz '2026-02-23 00:00+00', timestamptz '2026-02-24 00:00+00', interval '1 hour') AS h LEFT JOIN plays p ON date_trunc('hour', p.played_at) = h GROUP BY h;", why: "25 hours" },
		],
		accept: ["SELECT h, count(p.id) FROM generate_series(timestamptz '2026-02-23 00:00+00', timestamptz '2026-02-23 23:00+00', interval '1 hour') AS h LEFT JOIN plays p ON p.played_at >= h AND p.played_at < h + interval '1 hour' GROUP BY h;"],
	},
	"ch17-pr03": {
		reject: [
			{ sql: "SELECT l.id, d::date, count(p.id) FROM listeners l CROSS JOIN generate_series(date '2026-02-23', date '2026-03-01', interval '1 day') AS d LEFT JOIN plays p ON p.listener_id = l.id AND p.played_at::date = d::date WHERE l.id IN (SELECT listener_id FROM plays) GROUP BY l.id, d;", why: "quietquill missing" },
		],
	},
	"ch17-pr04": {
		reject: [{ sql: "SELECT listener_id, count(DISTINCT played_at::date) FROM plays GROUP BY listener_id;", why: "all days, not the longest streak" }],
	},
	"ch17-pr06": {
		reject: [
			{ sql: "SELECT played_at, extract(epoch FROM played_at - lag(played_at) OVER w) / 60, played_at - lag(played_at) OVER w > interval '30 minutes' FROM plays WHERE listener_id = 5 WINDOW w AS (ORDER BY played_at);", why: "first play flagged NULL instead of true" },
		],
		accept: ["SELECT played_at, extract(epoch FROM played_at - lag(played_at) OVER w) / 60.0, lag(played_at) OVER w IS NULL OR played_at - lag(played_at) OVER w > interval '30 minutes' FROM plays WHERE listener_id = 5 WINDOW w AS (ORDER BY played_at);"],
	},
	"ch17-pr07": {
		accept: ["SELECT count(*) FROM (SELECT played_at, lag(played_at) OVER (ORDER BY played_at) AS prev FROM plays WHERE listener_id = 5) g WHERE prev IS NULL OR played_at > prev + interval '30 minutes';"],
	},
};

export default cases;
