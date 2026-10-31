import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch07-calendars-and-clocks",
	order: 7,
	world: "The Counting House",
	tier: "apprentice",
	track: "query",
	title: "Calendars and Clocks",
	subtitle: "Dates, timestamps and intervals, plus the leap day that ate a trade",
	emoji: "📅",
	datasetId: "starport",
	concepts: ["date-time-basics", "date-functions", "interval-arithmetic"],
	prerequisites: ["ch05-shaping-columns"],
	lesson: [
		{
			kind: "explain",
			title: "Days and instants",
			body: "Two types run the Starport's calendar:\n\n- `date`: a day, no time (`ships.launched_on`);\n- `timestamptz`: an exact **instant** (`trades.traded_at`), shown in the session time zone, which is GMT here.\n\nWrite literals in ISO format, year first: `'2076-02-29'` or `'2076-02-29 12:00'`. Cast a timestamp to `date` to keep only the day.",
		},
		{
			kind: "example",
			title: "The first deals",
			body: "Each trade is an instant down to the minute. `::date` keeps the day and drops the time.",
			sql: "SELECT id, traded_at, traded_at::date AS day\nFROM trades\nORDER BY traded_at\nLIMIT 5;",
		},
		{
			kind: "explain",
			title: "Calendar arithmetic",
			body: "```sql\ndate '2076-02-27' + 3              -- 2076-03-01\ndate '2078-01-01' - date '2077-12-25' -- 7 (days)\ntimestamptz '2076-01-09 17:40'\n  - timestamptz '2076-01-03 08:12'  -- 6 days 09:28:00\n```\n\nA `date` plus an integer moves by days. Two dates subtract into a **number of days**. Two timestamps subtract into an **interval**.",
		},
		{
			kind: "quiz",
			question:
				"Trade 7 was signed on 29 Feb 2076 at noon. Does `WHERE traded_at = '2076-02-29'` find it?",
			choices: [
				"Yes, the date matches",
				"No: the literal means midnight exactly, and noon is not midnight",
				"Only if the session time zone is GMT",
				"No, it raises an error",
			],
			answerIndex: 1,
			explanation:
				"Compared with a timestamp, `'2076-02-29'` becomes the instant `2076-02-29 00:00:00`. Only a deal signed at that exact second would match. To catch a whole day, use a **half-open range**: `traded_at >= '2076-02-29' AND traded_at < '2076-03-01'`.",
		},
		{
			kind: "explain",
			title: "Taking dates apart",
			body: "- `extract(year from ts)`: one field as a number (`month`, `day`, `hour`, `dow` = day of week, 0 is Sunday);\n- `date_trunc('month', ts)`: rounds **down** to the start of the month;\n- `to_char(ts, 'DD Mon YYYY')`: formats as text.\n\nIn `to_char`, `MM` is the **month** and `MI` the **minute**. Mixing them up is a classic.",
		},
		{
			kind: "example",
			title: "Fields, buckets, labels",
			body: "Same instants, four views. `date_trunc` still returns a timestamp (the first instant of the month), while `to_char` returns **text**.",
			sql: "SELECT id, traded_at,\n       extract(dow from traded_at) AS weekday,\n       date_trunc('month', traded_at) AS month_start,\n       to_char(traded_at, 'YYYY-MM') AS label\nFROM trades\nORDER BY traded_at\nLIMIT 5;",
		},
		{
			kind: "explain",
			title: "Intervals",
			body: "An **interval** is a duration: `interval '3 days'`, `interval '1 month'`, `interval '2 hours'`.\n\nMonths have different lengths, so `+ interval '1 month'` keeps the day number and **clamps** to the last day when it does not exist: 31 January plus one month lands on 28 or 29 February.\n\n`age(later, earlier)` returns a readable interval in years, months and days.",
		},
		{
			kind: "example",
			title: "The clamped month",
			body: "2076 is a leap year, 2077 is not. And look how long Ada Quasar had served by New Year 2078.",
			sql: "SELECT date '2076-01-31' + interval '1 month' AS leap,\n       date '2077-01-31' + interval '1 month' AS plain,\n       age(date '2078-01-01', date '2041-03-15') AS ada_service;",
		},
		{
			kind: "try",
			title: "Your turn: launch years",
			prompt:
				"Return the **name** and the **launch year** of every ship whose launch date is **known**.",
			starterSql: "SELECT name, launched_on\nFROM ships\nWHERE launched_on IS NOT NULL;",
			solutionSql:
				"SELECT name, extract(year from launched_on) FROM ships WHERE launched_on IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"Pull one field out of the date instead of returning the whole date.",
				"extract(year from launched_on)",
			],
		},
	],
	exercises: [
		{
			id: "ch07-ex01",
			title: "The leap day that ate a trade",
			story:
				"An auditor swears a deal was signed on 29 February 2076, but the clerk's query finds nothing. Careful: the night shift also logged a deal at the stroke of midnight on 1 March.",
			prompt:
				"Fix the query: return the **id** and **traded_at** of every trade signed **on 29 February 2076**, at any time of that day (and not one second of 1 March).",
			difficulty: 2,
			kind: "query",
			concepts: ["date-time-basics"],
			setupSql:
				"INSERT INTO trades (id, ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at) VALUES (41, 8, 3, 3, 'sell', 5, 150.00, '2076-03-01 00:00:00+00');",
			starterSql: "SELECT id, traded_at\nFROM trades\nWHERE traded_at = '2076-02-29';",
			solutionSql:
				"SELECT id, traded_at FROM trades WHERE traded_at >= '2076-02-29' AND traded_at < '2076-03-01';",
			check: { type: "result" },
			hints: [
				"Run the starter: `'2076-02-29'` compared with a timestamp means midnight exactly.",
				"Catch the whole day with a range: from the start of the day, up to but **not including** the start of the next day.",
				"WHERE traded_at >= '2076-02-29' AND traded_at < '2076-03-01'",
			],
			explanation:
				"A half-open range `>= day AND < next day` catches every instant of the day, whatever the precision, and nothing of the next one.\n\n**Pitfall:** `BETWEEN '2076-02-29' AND '2076-03-01'` includes both ends, so the midnight deal of 1 March sneaks in. **Alternative:** `traded_at::date = '2076-02-29'` is also correct, but it computes a cast on every row (World 10 explains why indexes dislike that).",
		},
		{
			id: "ch07-ex02",
			title: "Days in service",
			story: "The shipyard celebrates New Year 2078 by counting how many days each ship has flown.",
			prompt:
				"Return the **name** of every ship with a **known** launch date and the **number of days** from its launch to **2078-01-01**.",
			difficulty: 2,
			kind: "query",
			concepts: ["date-time-basics"],
			solutionSql:
				"SELECT name, date '2078-01-01' - launched_on AS days FROM ships WHERE launched_on IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"Subtracting two dates gives a number of days.",
				"Write the reference day as a typed literal: `date '2078-01-01'`, then subtract the launch date.",
				"date '2078-01-01' - launched_on ... WHERE launched_on IS NOT NULL",
			],
			explanation:
				"`date - date` returns an **integer** number of days, ready for arithmetic: Starling has flown 13848 days.\n\n**Pitfall:** `launched_on - date '2078-01-01'` gives negative numbers, and `age(...)` returns an interval (`37 years 10 mons 28 days`), not a day count. **Alternative:** `'2078-01-01'::date - launched_on`.",
		},
		{
			id: "ch07-ex03",
			title: "Year of the badge",
			story: "Badges are engraved with the year a pilot joined.",
			prompt: "Return the **name** of every pilot and the **year** they joined (a number like 2041).",
			difficulty: 1,
			kind: "query",
			concepts: ["date-functions"],
			solutionSql: "SELECT name, extract(year from joined_at) AS year FROM pilots;",
			check: { type: "result" },
			hints: [
				"You need one field of the joined_at timestamp.",
				"extract(field from value) pulls a field out.",
				"extract(year from joined_at)",
			],
			explanation:
				"`extract(year from ...)` returns the year as a number. **Alternative:** `date_part('year', joined_at)`, the older spelling.\n\n**Pitfall:** `date_trunc('year', joined_at)` returns a timestamp (`2041-01-01 00:00`), not the number 2041.",
		},
		{
			id: "ch07-ex04",
			title: "January rush",
			story:
				"Every January, freighters rush to restock after the holidays. The economist wants every January deal, from every year on record.",
			prompt:
				"Return the **id** and **traded_at** of every trade signed in **January**, whatever the year.",
			difficulty: 2,
			kind: "query",
			concepts: ["date-functions"],
			solutionSql: "SELECT id, traded_at FROM trades WHERE extract(month from traded_at) = 1;",
			check: { type: "result" },
			hints: [
				"A date range would pin a single year. You need the month field alone.",
				"extract(month from traded_at) returns 1 to 12.",
				"WHERE extract(month from traded_at) = 1",
			],
			explanation:
				"`extract(month ...)` ignores the year, so January 2076 and January 2077 both match. That is exactly what this mission wants, and exactly the bug when you meant *one* January.\n\n**Pitfall:** `traded_at >= '2076-01-01' AND traded_at < '2076-02-01'` keeps only January 2076 and misses trades 28 and 29. **Alternative:** `to_char(traded_at, 'MM') = '01'`.",
		},
		{
			id: "ch07-ex05",
			title: "The atlas dates",
			story: "The new atlas prints discovery dates the old way: `12 Apr 2031`.",
			prompt:
				"Return the **name** of every planet with a **known** discovery date and that date formatted as **day (2 digits), short month name, year**: `12 Apr 2031`.",
			difficulty: 2,
			kind: "query",
			concepts: ["date-functions"],
			solutionSql:
				"SELECT name, to_char(discovered_on, 'DD Mon YYYY') AS discovered FROM planets WHERE discovered_on IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"to_char turns a date into text following a pattern.",
				"`DD` = day, `Mon` = short month name with a capital, `YYYY` = year.",
				"to_char(discovered_on, 'DD Mon YYYY')",
			],
			explanation:
				"The pattern letters are case sensitive: `Mon` gives `Apr`, `MON` gives `APR`, `MM` gives `04`. Mirage prints as `29 Feb 2068`.\n\n**Pitfall:** the result is **text**: sorting it would put `02 Nov` before `12 Apr`. Sort by the real date column instead.",
		},
		{
			id: "ch07-ex06",
			title: "Fines are due",
			story: "A customs fine must be paid one calendar month after the seizure, to the day.",
			prompt:
				"Return the **id** of every seizure and its **due date**: `seized_at` plus **one month**, as a date.",
			difficulty: 2,
			kind: "query",
			concepts: ["interval-arithmetic"],
			solutionSql:
				"SELECT id, (seized_at + interval '1 month')::date AS due FROM seizures;",
			check: { type: "result" },
			hints: [
				"A month is not a fixed number of days.",
				"Add an interval: `interval '1 month'`. The result is a timestamp; cast it back to date.",
				"(seized_at + interval '1 month')::date",
			],
			explanation:
				"`+ interval '1 month'` moves to the same day number of the next month: 20 January becomes 20 February.\n\n**Pitfall:** `seized_at + 30` adds 30 days, which lands on 19 February. **Alternative:** `seized_at + make_interval(months => 1)`.",
		},
		{
			id: "ch07-ex07",
			title: "There and back again",
			story:
				"The bookkeeper adds a month to 31 January 2076, then removes it, and expects to be back on 31 January.",
			prompt:
				"Return **one row** with two columns, in this order: the value of `date '2076-01-31' + interval '1 month'`, and the value of `(date '2076-01-31' + interval '1 month') - interval '1 month'`. Predict both before you run.",
			difficulty: 3,
			kind: "query",
			concepts: ["interval-arithmetic"],
			solutionSql:
				"SELECT date '2076-01-31' + interval '1 month', (date '2076-01-31' + interval '1 month') - interval '1 month';",
			check: { type: "result" },
			hints: [
				"No FROM needed: one row of two expressions.",
				"February 2076 has 29 days, and 29 January exists.",
				"SELECT date '2076-01-31' + interval '1 month', (date '2076-01-31' + interval '1 month') - interval '1 month';",
			],
			explanation:
				"31 January plus a month clamps to **29 February** (there is no 31 February). Going back a month from 29 February gives **29 January**: the two days lost at the clamp never come back.\n\n**Pitfall:** treating month arithmetic as reversible. Billing systems that add and subtract months drift exactly like this.",
		},
		{
			id: "ch07-ex08",
			title: "Veterans of the docks",
			story: "The gala on 1 March 2078 honours the longest serving pilots.",
			prompt:
				"Return the **name** of every pilot and their **service time** on **2078-03-01** as an interval in years, months and days (`36 years 11 mons 16 days 15:00:00` for Ada), **longest service first**, ties by **name A to Z**.",
			difficulty: 3,
			kind: "query",
			concepts: ["interval-arithmetic", "date-functions"],
			solutionSql:
				"SELECT name, age(timestamptz '2078-03-01', joined_at) AS service FROM pilots ORDER BY service DESC, name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Subtraction gives a pile of days (`13499 days 15:00:00`). Another function speaks in years and months.",
				"`age(later, earlier)` returns years, months and days. Sort on it like any value.",
				"age(timestamptz '2078-03-01', joined_at) ... ORDER BY 2 DESC, name",
			],
			explanation:
				"`age` breaks the gap into calendar units, and intervals sort like durations, so the oldest recruit comes first.\n\n**Pitfall:** `timestamptz '2078-03-01' - joined_at` is correct as a duration but reads as `13499 days 15:00:00`, not the format asked. Putting the dates in the wrong order inside `age` gives negative intervals. **Alternative:** `ORDER BY joined_at, name` gives the same order.",
		},
		{
			id: "ch07-ex09",
			title: "Boss: The Anniversary Roster",
			story:
				"The Starport throws a party for every pilot who joined during the last quarter of a year. The roster goes in calendar order, as the party dates follow the anniversaries.",
			prompt:
				"Return the pilots who joined in **October, November or December** (any year), with three columns:\n\n1. **name**;\n2. **join date** as a `date`;\n3. **full years of service** on **2078-03-01** (a whole number: Cyra Vex has 18).\n\nSort by **month** of joining, then **day** of the month, then **name A to Z** (the year does not matter).",
			difficulty: 4,
			kind: "query",
			concepts: ["date-functions", "interval-arithmetic", "date-time-basics"],
			solutionSql:
				"SELECT name,\n       joined_at::date AS joined_on,\n       extract(year from age(timestamptz '2078-03-01', joined_at)) AS years\nFROM pilots\nWHERE extract(month from joined_at) >= 10\nORDER BY extract(month from joined_at), extract(day from joined_at), name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Three pieces: a month filter, an age in years, and a sort that ignores the year.",
				"`extract(month ...)` filters and sorts. Full years = the year field of `age(...)`.",
				"extract(year from age(timestamptz '2078-03-01', joined_at)) ... ORDER BY extract(month from joined_at), extract(day from joined_at), name",
			],
			explanation:
				"`extract(year from age(...))` counts only **completed** years, which is what an anniversary is. Sorting on month then day ignores the year, so Nox (31 October 2067) comes before Cyra (11 November 2059).\n\n**Pitfall:** `2078 - extract(year from joined_at)` says Cyra has 19 years, but her 19th anniversary is not until November. Sorting by `joined_at` sorts by year first. **Alternative:** `WHERE extract(quarter from joined_at) = 4` and `ORDER BY to_char(joined_at, 'MM-DD'), name`.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch07-pr01",
			title: "The March ledger",
			prompt:
				"Return the **id** and **traded_at** of every trade signed in **March 2076** (from the first to the last instant of the month).",
			difficulty: 2,
			kind: "query",
			concepts: ["date-time-basics"],
			solutionSql:
				"SELECT id, traded_at FROM trades WHERE traded_at >= '2076-03-01' AND traded_at < '2076-04-01';",
			check: { type: "result" },
			hints: [
				"A late-night deal on 31 March still counts.",
				"Use a half-open range: start of March included, start of April excluded.",
				"WHERE traded_at >= '2076-03-01' AND traded_at < '2076-04-01'",
			],
			explanation:
				"The half-open range keeps trade 10 (31 March, 23:59) and leaves out trade 11 (1 April, 00:01).\n\n**Pitfall:** `BETWEEN '2076-03-01' AND '2076-03-31'` stops at midnight **starting** 31 March and loses trade 10.",
		},
		{
			id: "ch07-pr02",
			title: "The early charts",
			prompt:
				"Return the **name** and **discovered_on** of every planet discovered **before 1 January 2050**.",
			difficulty: 1,
			kind: "query",
			concepts: ["date-time-basics"],
			solutionSql:
				"SELECT name, discovered_on FROM planets WHERE discovered_on < '2050-01-01';",
			check: { type: "result" },
			hints: [
				"Dates compare like numbers: earlier is smaller.",
				"Write the date as an ISO literal in quotes.",
				"WHERE discovered_on < '2050-01-01'",
			],
			explanation:
				"`discovered_on` is a `date`, so the literal is read as a date. Éclat, charted on 31 December 2049, just makes it. Hollow Moon's NULL never passes a comparison.",
		},
		{
			id: "ch07-pr03",
			title: "What day was it?",
			prompt:
				"Return the **id** of every trade signed in **2077** and the **weekday name** of its date, without padding spaces (`Friday`, not `Friday   `).",
			difficulty: 2,
			kind: "query",
			concepts: ["date-functions"],
			solutionSql:
				"SELECT id, to_char(traded_at, 'FMDay') AS weekday FROM trades WHERE traded_at >= '2077-01-01' AND traded_at < '2078-01-01';",
			check: { type: "result" },
			hints: [
				"to_char has a pattern for the day name.",
				"`Day` pads names to 9 characters. The `FM` prefix (fill mode) removes the padding.",
				"to_char(traded_at, 'FMDay')",
			],
			explanation:
				"`Day` gives `Friday   ` (padded to the longest name, Wednesday); `FMDay` trims it.\n\n**Pitfall:** comparing a padded day name with `'Friday'` silently fails. **Alternative:** `trim(to_char(traded_at, 'Day'))`.",
		},
		{
			id: "ch07-pr04",
			title: "Class of the year",
			prompt:
				"Return the **name** of every pilot and the **first instant of the year** they joined (Ada joined in 2041: `2041-01-01 00:00`).",
			difficulty: 2,
			kind: "query",
			concepts: ["date-functions"],
			solutionSql: "SELECT name, date_trunc('year', joined_at) AS class FROM pilots;",
			check: { type: "result" },
			hints: [
				"You want to round a timestamp **down** to a unit.",
				"date_trunc('unit', value)",
				"date_trunc('year', joined_at)",
			],
			explanation:
				"`date_trunc` keeps the type (a timestamp) and zeroes everything below the unit. It is the tool for grouping by month or year in *Tally the Loot*.\n\n**Pitfall:** `extract(year ...)` returns the number 2041, not a point in time.",
		},
		{
			id: "ch07-pr05",
			title: "Hours on the clock",
			story: "The auditor counts in hours since the books opened on 1 January 2076 at midnight.",
			prompt:
				"Return the **id** of every trade signed in **January 2076** and the **number of hours** (with decimals) between `2076-01-01 00:00` and its traded_at.",
			difficulty: 3,
			kind: "query",
			concepts: ["interval-arithmetic"],
			solutionSql:
				"SELECT id, extract(epoch from traded_at - timestamptz '2076-01-01') / 3600 AS hours FROM trades WHERE traded_at >= '2076-01-01' AND traded_at < '2076-02-01';",
			check: { type: "result" },
			hints: [
				"Subtracting two timestamps gives an interval. You want it as one number.",
				"`extract(epoch from interval)` returns the total number of seconds.",
				"extract(epoch from traded_at - timestamptz '2076-01-01') / 3600",
			],
			explanation:
				"`epoch` converts the whole interval into seconds; divide by 3600 for hours. Trade 1 happened 56.2 hours after the books opened.\n\n**Pitfall:** `extract(hour from interval)` returns only the hour **field** (8 for `2 days 08:12:00`), not the total.",
		},
		{
			id: "ch07-pr06",
			title: "Thirty days of grace",
			prompt:
				"Return the **id** of every seizure and the day that falls **exactly 30 days** after `seized_at`. Use `make_interval`.",
			difficulty: 2,
			kind: "query",
			concepts: ["interval-arithmetic"],
			solutionSql:
				"SELECT id, (seized_at + make_interval(days => 30))::date AS grace_end FROM seizures;",
			check: { type: "result" },
			hints: [
				"make_interval builds an interval from named parts.",
				"`make_interval(days => 30)`; cast the sum back to a date if you like.",
				"seized_at + make_interval(days => 30)",
			],
			explanation:
				"`make_interval(days => 30)` is handy when the number comes from a column (`make_interval(days => qty)`). On a `date`, `seized_at + 30` gives the same day.\n\n**Pitfall:** `interval '1 month'` is not 30 days: from 20 January it reaches 20 February, one day later than 30 days.",
		},
	],
};

export default chapter;
