// Negative and accept cases for ch07-calendars-and-clocks.
import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch07-calendars-and-clocks/lesson-8": {
		reject: [{ sql: "SELECT name, date_trunc('year', launched_on) FROM ships WHERE launched_on IS NOT NULL;", why: "a timestamp, not the year number" }],
		accept: [
			"SELECT name, date_part('year', launched_on) FROM ships WHERE launched_on IS NOT NULL;",
			"SELECT name, EXTRACT(YEAR FROM launched_on) AS y FROM ships WHERE NOT launched_on IS NULL;",
		],
	},
	"ch07-ex01": {
		reject: [
			{ sql: "SELECT id, traded_at FROM trades WHERE traded_at BETWEEN '2076-02-29' AND '2076-03-01';", why: "BETWEEN includes the next midnight" },
			{ sql: "SELECT id, traded_at FROM trades WHERE traded_at <= '2076-03-01' AND traded_at >= '2076-02-29';", why: "closed range includes the next midnight" },
			{ sql: "SELECT id, traded_at FROM trades WHERE traded_at > '2076-02-29' AND traded_at < '2076-03-01 00:00:01';", why: "still includes the next midnight" },
		],
		accept: [
			"SELECT id, traded_at FROM trades WHERE traded_at::date = '2076-02-29';",
			"SELECT id, traded_at FROM trades WHERE traded_at >= date '2076-02-29' AND traded_at < date '2076-02-29' + 1;",
			"SELECT id, traded_at FROM trades WHERE date_trunc('day', traded_at) = '2076-02-29';",
		],
	},
	"ch07-ex02": {
		reject: [
			{ sql: "SELECT name, launched_on - date '2078-01-01' FROM ships WHERE launched_on IS NOT NULL;", why: "negative day counts" },
			{ sql: "SELECT name, age(date '2078-01-01', launched_on) FROM ships WHERE launched_on IS NOT NULL;", why: "an interval, not a day count" },
			{ sql: "SELECT name, date '2078-01-01' - launched_on FROM ships;", why: "unknown launch kept" },
		],
		accept: ["SELECT name, '2078-01-01'::date - launched_on AS days FROM ships WHERE launched_on IS NOT NULL;"],
	},
	"ch07-ex03": {
		reject: [{ sql: "SELECT name, date_trunc('year', joined_at) FROM pilots;", why: "a timestamp, not a number" }],
		accept: ["SELECT name, date_part('year', joined_at) FROM pilots;", "SELECT name, to_char(joined_at, 'YYYY') FROM pilots;"],
	},
	"ch07-ex04": {
		reject: [
			{ sql: "SELECT id, traded_at FROM trades WHERE traded_at >= '2076-01-01' AND traded_at < '2076-02-01';", why: "only January 2076" },
			{ sql: "SELECT id, traded_at FROM trades WHERE date_trunc('month', traded_at) = '2076-01-01';", why: "date_trunc keeps the year" },
		],
		accept: [
			"SELECT id, traded_at FROM trades WHERE to_char(traded_at, 'MM') = '01';",
			"SELECT id, traded_at FROM trades WHERE date_part('month', traded_at) = 1;",
		],
	},
	"ch07-ex05": {
		reject: [
			{ sql: "SELECT name, to_char(discovered_on, 'DD MON YYYY') FROM planets WHERE discovered_on IS NOT NULL;", why: "MON is upper case" },
			{ sql: "SELECT name, to_char(discovered_on, 'DD MM YYYY') FROM planets WHERE discovered_on IS NOT NULL;", why: "month number instead of name" },
			{ sql: "SELECT name, to_char(discovered_on, 'DD Mon YYYY') FROM planets;", why: "unknown date kept" },
		],
		accept: ["SELECT name, to_char(discovered_on, 'DD Mon YYYY') FROM planets WHERE to_char(discovered_on, 'DD Mon YYYY') IS NOT NULL;"],
	},
	"ch07-ex06": {
		reject: [
			{ sql: "SELECT id, seized_at + 30 FROM seizures;", why: "30 days is not a month" },
			{ sql: "SELECT id, seized_at + 31 FROM seizures;", why: "31 days is not a month either" },
		],
		accept: [
			"SELECT id, seized_at + interval '1 month' FROM seizures;",
			"SELECT id, (seized_at + make_interval(months => 1))::date FROM seizures;",
		],
	},
	"ch07-ex07": {
		reject: [
			{ sql: "SELECT date '2076-02-29', date '2076-01-31';", why: "month arithmetic is not reversible" },
			{ sql: "SELECT date '2076-03-02', date '2076-02-02';", why: "a month is not 31 days" },
		],
		accept: ["SELECT timestamp '2076-02-29', timestamp '2076-01-29';"],
	},
	"ch07-ex08": {
		reject: [
			{ sql: "SELECT name, timestamptz '2078-03-01' - joined_at FROM pilots ORDER BY 2 DESC, name;", why: "plain subtraction: days, not years and months" },
			{ sql: "SELECT name, age(timestamptz '2078-03-01', joined_at) FROM pilots ORDER BY 2, name;", why: "shortest service first" },
			{ sql: "SELECT name, age(joined_at, timestamptz '2078-03-01') FROM pilots ORDER BY joined_at, name;", why: "arguments swapped: negative intervals" },
		],
		accept: [
			"SELECT name, age('2078-03-01', joined_at) FROM pilots ORDER BY joined_at, name;",
			"SELECT name, age(timestamptz '2078-03-01', joined_at) AS t FROM pilots ORDER BY t DESC, 1;",
		],
	},
	"ch07-ex09": {
		reject: [
			{
				sql: "SELECT name, joined_at::date, 2078 - extract(year from joined_at) FROM pilots WHERE extract(month from joined_at) >= 10 ORDER BY extract(month from joined_at), extract(day from joined_at), name;",
				why: "year subtraction counts an unfinished year",
			},
			{
				sql: "SELECT name, joined_at::date, extract(year from age(timestamptz '2078-03-01', joined_at)) FROM pilots WHERE extract(month from joined_at) >= 10 ORDER BY joined_at, name;",
				why: "sorted by year first",
			},
			{
				sql: "SELECT name, joined_at::date, extract(year from age(timestamptz '2078-03-01', joined_at)) FROM pilots WHERE extract(month from joined_at) > 10 ORDER BY extract(month from joined_at), extract(day from joined_at), name;",
				why: "October forgotten",
			},
		],
		accept: [
			"SELECT name, CAST(joined_at AS date), date_part('year', age('2078-03-01', joined_at)) FROM pilots WHERE extract(quarter from joined_at) = 4 ORDER BY to_char(joined_at, 'MM-DD'), name;",
			"SELECT name, joined_at::date, extract(year from age(date '2078-03-01', joined_at::date)) FROM pilots WHERE extract(month from joined_at) IN (10, 11, 12) ORDER BY extract(month from joined_at), extract(day from joined_at), name;",
		],
	},
	"ch07-pr01": {
		reject: [{ sql: "SELECT id, traded_at FROM trades WHERE traded_at BETWEEN '2076-03-01' AND '2076-03-31';", why: "loses 31 March after midnight" }],
		accept: ["SELECT id, traded_at FROM trades WHERE date_trunc('month', traded_at) = '2076-03-01';"],
	},
	"ch07-pr02": {
		accept: ["SELECT name, discovered_on FROM planets WHERE extract(year from discovered_on) < 2050;"],
	},
	"ch07-pr03": {
		reject: [{ sql: "SELECT id, to_char(traded_at, 'Day') FROM trades WHERE traded_at >= '2077-01-01' AND traded_at < '2078-01-01';", why: "padded day names" }],
		accept: ["SELECT id, trim(to_char(traded_at, 'Day')) FROM trades WHERE extract(year from traded_at) = 2077;"],
	},
	"ch07-pr04": {
		reject: [{ sql: "SELECT name, extract(year from joined_at) FROM pilots;", why: "a number, not an instant" }],
		accept: ["SELECT name, make_date(extract(year from joined_at)::int, 1, 1) FROM pilots;"],
	},
	"ch07-pr05": {
		reject: [
			{
				sql: "SELECT id, extract(hour from traded_at - timestamptz '2076-01-01') FROM trades WHERE traded_at >= '2076-01-01' AND traded_at < '2076-02-01';",
				why: "hour field only",
			},
		],
		accept: [
			"SELECT id, extract(epoch from (traded_at - '2076-01-01'::timestamptz)) / 3600.0 FROM trades WHERE extract(year from traded_at) = 2076 AND extract(month from traded_at) = 1;",
		],
	},
	"ch07-pr06": {
		reject: [{ sql: "SELECT id, seized_at + interval '1 month' FROM seizures;", why: "a month is not 30 days" }],
		accept: ["SELECT id, seized_at + 30 FROM seizures;"],
	},
};

export default cases;
