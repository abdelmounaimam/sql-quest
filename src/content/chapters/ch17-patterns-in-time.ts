import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch17-patterns-in-time",
	order: 17,
	world: "The Observatory",
	tier: "expert",
	track: "query",
	title: "Patterns in Time",
	subtitle: "Buckets, empty days, streaks and listening sessions",
	emoji: "⏳",
	datasetId: "bardic",
	concepts: ["date-bucketing", "time-series-gap-fill", "gaps-and-islands", "sessionization"],
	prerequisites: ["ch15-windows-on-the-ranks"],
	lesson: [
		{
			kind: "explain",
			title: "A river of plays",
			body: "The Observatory's telescope turns to **Bardic Beats**, the realm's music service. The bard-in-chief wants to know *when* the realm listens.\n\n`plays` is an event stream: one row per listen, with `listener_id`, `track_id`, `played_at` (an instant) and `ms_played`. Time questions need **buckets**:\n```sql\ndate_trunc('day', played_at)\n```\ncuts every instant down to the start of its day. The session time zone is GMT, so these are **UTC** days.",
		},
		{
			kind: "example",
			title: "Plays per day",
			body: "Group by the bucket, count the rows. Scroll down: 10 March, then **12 March**. Where did the 11th go?",
			sql: "SELECT date_trunc('day', played_at)::date AS day, count(*) AS plays\nFROM plays\nGROUP BY 1\nORDER BY 1;",
		},
		{
			kind: "explain",
			title: "Choosing a bucket",
			body: "- `date_trunc('hour' | 'day' | 'week' | 'month', ts)`: calendar units. Weeks start on **Monday**.\n- `date_bin('15 minutes', ts, timestamptz '2026-01-01')`: any stride, counted from an origin.\n- `played_at::date`: the day as a date.\n\nKeep buckets as **timestamps or dates**, not `to_char` text: `'01/03'` sorts before `'23/02'`. Local time zones (Tokyo listeners!) come back in World 8.",
		},
		{
			kind: "quiz",
			question: "The plays per day chart has no row at all for 11 March. Why?",
			choices: [
				"date_trunc rounded the 11 March plays into 10 March",
				"No play happened on 11 March, and GROUP BY only builds groups from rows that exist",
				"count(*) hides groups whose count is 0",
				"ORDER BY skips missing dates",
			],
			answerIndex: 1,
			explanation:
				"GROUP BY can only make groups out of rows that exist. A day without plays is not a group with 0 rows: it is no group at all. To see it, you need a calendar that lists every day.",
		},
		{
			kind: "example",
			title: "Gap filling with a calendar",
			body: "`generate_series` builds the full calendar; LEFT JOIN hangs the plays on it. 11 March is back, with **0**.",
			sql: "SELECT d::date AS day, count(p.id) AS plays\nFROM generate_series(date '2026-02-23', date '2026-03-14', interval '1 day') AS d\nLEFT JOIN plays p ON p.played_at::date = d::date\nGROUP BY d\nORDER BY d;",
		},
		{
			kind: "quiz",
			question:
				"In that gap filled query, what would `count(*)` show for 11 March instead of `count(p.id)`?",
			choices: ["0", "1", "NULL", "An error"],
			answerIndex: 1,
			explanation:
				"The LEFT JOIN keeps 11 March as **one row** whose plays columns are NULL. `count(*)` counts that row (1); `count(p.id)` skips NULLs and gives the honest 0.",
		},
		{
			kind: "explain",
			title: "Islands: streaks of days",
			body: "A **streak** is a run of consecutive days. The trick: number the days of each listener with `row_number()`, then subtract.\n\n| day | rn | day - rn |\n|---|---|---|\n| Feb 23 | 1 | Feb 22 |\n| Feb 24 | 2 | Feb 22 |\n| Feb 25 | 3 | Feb 22 |\n| Mar 2 | 4 | Feb 26 |\n\nInside a streak both go up by 1, so the difference stays **constant**. Group by it. Deduplicate the days first: two plays on one day would break the count.",
		},
		{
			kind: "example",
			title: "moonmoth's streaks",
			body: "Look at the `grp` column: it stays on one date for the whole Feb 23 to 27 streak, then jumps. Grouping by `grp` turns each island into one row.",
			sql: "WITH days AS (\n  SELECT DISTINCT played_at::date AS day\n  FROM plays WHERE listener_id = 1\n)\nSELECT day,\n       row_number() OVER (ORDER BY day) AS rn,\n       day - row_number() OVER (ORDER BY day)::int AS grp\nFROM days\nORDER BY day;",
		},
		{
			kind: "explain",
			title: "Sessions: cut when the music stops",
			body: "A listening **session** ends when a listener is silent for more than 30 minutes. Two window passes:\n\n1. **Flag** each play that starts a session: it is the listener's first play, or `played_at - lag(played_at) > interval '30 minutes'`.\n2. A **running sum** of the flags numbers the sessions: 1, 1, 1, 2, 2, 3...\n\nBoth windows need `PARTITION BY listener_id`, or one listener's music bleeds into the next.",
		},
		{
			kind: "try",
			title: "Your turn: the daily chart",
			prompt:
				"Return **day** (the UTC date) and **plays** (number of plays) for every day that has at least one play.",
			starterSql: "SELECT played_at AS day, count(*) AS plays\nFROM plays\nGROUP BY played_at;",
			solutionSql: "SELECT played_at::date AS day, count(*) AS plays FROM plays GROUP BY 1;",
			check: { type: "result" },
			hints: [
				"Run the starter: every instant is its own group. Bucket first.",
				"Group by played_at::date (or date_trunc('day', played_at)::date).",
			],
		},
	],
	exercises: [
		{
			id: "ch17-ex01",
			title: "Monday by the hour",
			story: "The bard-in-chief wants to schedule new releases at the busiest hour of a typical Monday.",
			prompt:
				"For **23 February 2026 (UTC)**, return **hour** (the play time **truncated to the hour**, as a timestamp) and **plays** (the number of plays starting in that hour). Only hours with plays.",
			difficulty: 2,
			kind: "query",
			concepts: ["date-bucketing"],
			starterSql:
				"SELECT extract(hour FROM played_at) AS hour, count(*) AS plays\nFROM plays\nWHERE played_at::date = '2026-02-23'\nGROUP BY 1;",
			solutionSql:
				"SELECT date_trunc('hour', played_at) AS hour, count(*) AS plays FROM plays WHERE played_at >= '2026-02-23' AND played_at < '2026-02-24' GROUP BY 1;",
			check: { type: "result" },
			hints: [
				"Run the starter: the hour is a bare number, the board wants a real timestamp.",
				"date_trunc('hour', ...) keeps the date and zeroes the minutes.",
				"SELECT date_trunc('hour', played_at) AS hour, count(*) ... GROUP BY 1",
			],
			explanation:
				"`date_trunc('hour', played_at)` keeps a full timestamp, so buckets from different days never merge and they sort correctly. Seven busy hours, the peak is 18:00 with grimgrin's metal session.\n\n**Pitfall:** `extract(hour ...)` gives 2, 10, 14...: fine for one day, but it would merge the 18:00 of every day into one bucket.\n\n**Alternative:** the half open range `>= '2026-02-23' AND < '2026-02-24'` and `played_at::date = '2026-02-23'` select the same plays.",
		},
		{
			id: "ch17-ex02",
			title: "Quarter hours",
			story:
				"grimgrin, a dwarven metalhead, wants to see how dense his listening is, in 15 minute slices.",
			prompt:
				"For the plays of **listener 5** (grimgrin), return **slot** (the start of the **15 minute** bucket containing the play, buckets aligned on midnight UTC: 18:00, 18:15, 18:30...) and **plays**. Only slots with plays.",
			difficulty: 2,
			kind: "query",
			concepts: ["date-bucketing"],
			starterSql:
				"SELECT date_trunc('hour', played_at) AS slot, count(*) AS plays\nFROM plays\nWHERE listener_id = 5\nGROUP BY 1;",
			solutionSql:
				"SELECT date_bin('15 minutes', played_at, timestamptz '2026-01-01 00:00+00') AS slot, count(*) AS plays FROM plays WHERE listener_id = 5 GROUP BY 1;",
			check: { type: "result" },
			hints: [
				"date_trunc only knows calendar units: hour, day, week...",
				"date_bin(stride, ts, origin) cuts time into any stride counted from the origin.",
				"date_bin('15 minutes', played_at, timestamptz '2026-01-01 00:00+00')",
			],
			explanation:
				"`date_bin` counts strides of 15 minutes from the origin; any origin at a midnight gives slots at :00, :15, :30, :45. 10 slots for grimgrin.\n\n**Pitfall:** an origin like `'2026-01-01 00:05'` would shift every slot by 5 minutes.\n\n**Alternative:** `date_trunc('hour', ts) + floor(extract(minute FROM ts) / 15) * interval '15 minutes'`.",
		},
		{
			id: "ch17-ex03",
			title: "Fix: the calendar in the wrong order",
			story:
				"The daily chart on the tavern wall shows `01/03` first and `23/02` near the end: the bard who made it bucketed by text.",
			prompt:
				"Return **day** (as a **date**) and **plays** for every day that has plays, **ordered by day**, oldest first.",
			difficulty: 2,
			kind: "query",
			concepts: ["date-bucketing"],
			starterSql:
				"SELECT to_char(played_at, 'DD/MM') AS day, count(*) AS plays\nFROM plays\nGROUP BY 1\nORDER BY 1;",
			solutionSql:
				"SELECT played_at::date AS day, count(*) AS plays FROM plays GROUP BY 1 ORDER BY 1;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Run the starter: text sorts character by character, so '01/03' < '23/02'.",
				"Bucket with a real date type, format later (or never).",
				"SELECT played_at::date AS day, count(*) ... GROUP BY 1 ORDER BY 1",
			],
			explanation:
				"A `date` sorts chronologically, text sorts by characters. Keep buckets typed and let the display layer format them.\n\n**Pitfall:** grouping by `'DD/MM'` also merges the same day of different years. Text only sorts right when the biggest unit comes first (`'YYYY-MM-DD'`), so keep real dates and you never have to think about it.",
		},
		{
			id: "ch17-ex04",
			title: "The full calendar",
			story: "The bard-in-chief suspects the service went silent one day. A chart with holes hides that.",
			prompt:
				"Return **day** (a date) and **plays** for **every** day from **23 February to 14 March 2026, both included**: days without any play show **0**.",
			difficulty: 3,
			kind: "query",
			concepts: ["time-series-gap-fill"],
			starterSql:
				"SELECT played_at::date AS day, count(*) AS plays\nFROM plays\nGROUP BY 1;",
			solutionSql:
				"SELECT d::date AS day, count(p.id) AS plays\nFROM generate_series(date '2026-02-23', date '2026-03-14', interval '1 day') AS d\nLEFT JOIN plays p ON p.played_at::date = d::date\nGROUP BY d;",
			check: { type: "result" },
			hints: [
				"The plays alone cannot produce a day that has no plays: build the calendar first.",
				"generate_series over the 20 days, LEFT JOIN plays on the day, and count a plays column.",
				"FROM generate_series(date '2026-02-23', date '2026-03-14', interval '1 day') AS d LEFT JOIN plays p ON p.played_at::date = d::date ... count(p.id)",
			],
			explanation:
				"The series supplies all 20 days, the LEFT JOIN keeps those without plays, and `count(p.id)` counts only real plays: 11 March shows 0.\n\n**Pitfall:** `count(*)` gives 1 on the empty day (it counts the calendar row), and an inner JOIN drops it again.",
		},
		{
			id: "ch17-ex05",
			title: "Fix: moonmoth's vanishing days",
			story:
				"moonmoth asked for her own calendar. The query below was supposed to show her empty days as 0, but they have disappeared.",
			prompt:
				"Return **day** (a date) and **plays** for **every** day from **23 February to 14 March 2026, both included**, counting only the plays of **listener 1** (moonmoth): 0 for days she did not listen.",
			difficulty: 3,
			kind: "query",
			concepts: ["time-series-gap-fill"],
			starterSql:
				"SELECT d::date AS day, count(p.id) AS plays\nFROM generate_series(date '2026-02-23', date '2026-03-14', interval '1 day') AS d\nLEFT JOIN plays p ON p.played_at::date = d::date\nWHERE p.listener_id = 1\nGROUP BY d;",
			solutionSql:
				"SELECT d::date AS day, count(p.id) AS plays\nFROM generate_series(date '2026-02-23', date '2026-03-14', interval '1 day') AS d\nLEFT JOIN plays p ON p.played_at::date = d::date AND p.listener_id = 1\nGROUP BY d;",
			check: { type: "result" },
			hints: [
				"Run the starter: only 9 days survive. What does WHERE do to a row whose p.listener_id is NULL?",
				"A filter on the right table of a LEFT JOIN belongs in the ON clause.",
				"LEFT JOIN plays p ON p.played_at::date = d::date AND p.listener_id = 1",
			],
			explanation:
				"In ON, the condition decides which plays attach to each day; days with no matching play are still kept. In WHERE, it runs after the join and `NULL = 1` is not true, so empty days vanish.\n\n**Pitfall:** `WHERE p.listener_id = 1 OR p.listener_id IS NULL` looks right but drops days on which only *other* listeners played.\n\n**Alternative:** filter first in a subquery: `LEFT JOIN (SELECT * FROM plays WHERE listener_id = 1) p ON ...`.",
		},
		{
			id: "ch17-ex06",
			title: "Listening streaks",
			story:
				"Bardic Beats awards a *Faithful Ear* badge for listening at least 3 days in a row. Find every streak that earns it.",
			prompt:
				"Return **listener_id**, **streak_start**, **streak_end** (dates) and **days** for every streak of **consecutive UTC days with at least one play** that lasts **3 days or more**.",
			difficulty: 4,
			kind: "query",
			concepts: ["gaps-and-islands"],
			solutionSql:
				"WITH days AS (\n  SELECT DISTINCT listener_id, played_at::date AS day FROM plays\n), islands AS (\n  SELECT listener_id, day,\n         day - (row_number() OVER (PARTITION BY listener_id ORDER BY day))::int AS grp\n  FROM days\n)\nSELECT listener_id, min(day) AS streak_start, max(day) AS streak_end, count(*) AS days\nFROM islands\nGROUP BY listener_id, grp\nHAVING count(*) >= 3;",
			check: { type: "result" },
			hints: [
				"Step 1: one row per listener and day (DISTINCT). Step 2: subtract a row_number per listener from the day. Step 3: group by listener and that difference.",
				"day - row_number() is constant inside a streak. Partition the row_number by listener_id, order by day.",
				"islands AS (SELECT listener_id, day, day - (row_number() OVER (PARTITION BY listener_id ORDER BY day))::int AS grp FROM days) ... GROUP BY listener_id, grp HAVING count(*) >= 3",
			],
			explanation:
				"Five streaks: moonmoth twice (5 and 3 days), grimgrin (4) and nightowl twice (3, then 4 across the month end). The date minus the row number is the same for every day of an island, so it works as a group key.\n\n**Pitfall:** skipping the DISTINCT step: with 4 plays on one day, row_number climbs 4 times while the date stays, and streaks shatter.\n\n**Alternative:** flag days where `day - lag(day) <> 1`, running sum of flags, group by that.",
		},
		{
			id: "ch17-ex07",
			title: "Counting sessions",
			story:
				"Royalties are paid per listening session. A session ends when a listener stays silent for **more than** 30 minutes; a gap of exactly 30 minutes keeps the session going.",
			prompt:
				"For every listener who played anything, return **listener_id** and **sessions**: the number of listening sessions, where a play **starts a new session** if it is the listener's first play, or if **more than 30 minutes** passed since that listener's previous play (`played_at` to `played_at`).",
			difficulty: 4,
			kind: "query",
			concepts: ["sessionization"],
			starterSql:
				"WITH flagged AS (\n  SELECT listener_id,\n         played_at - lag(played_at) OVER (ORDER BY played_at) AS gap\n  FROM plays\n)\nSELECT listener_id, count(*) FILTER (WHERE gap IS NULL OR gap > interval '30 minutes') AS sessions\nFROM flagged\nGROUP BY listener_id;",
			solutionSql:
				"WITH flagged AS (\n  SELECT listener_id,\n         played_at - lag(played_at) OVER (PARTITION BY listener_id ORDER BY played_at) AS gap\n  FROM plays\n)\nSELECT listener_id, count(*) FILTER (WHERE gap IS NULL OR gap > interval '30 minutes') AS sessions\nFROM flagged\nGROUP BY listener_id;",
			check: { type: "result" },
			hints: [
				"Run the starter: the previous play may belong to someone else. Whose silence should end a session?",
				"lag needs PARTITION BY listener_id, so each listener's first play gets a NULL gap.",
				"lag(played_at) OVER (PARTITION BY listener_id ORDER BY played_at)",
			],
			explanation:
				"Each play is compared with the same listener's previous play; the first play (NULL gap) and every gap over 30 minutes start a session. moonmoth has 10 sessions, grimgrin 7.\n\n**Pitfall:** without the partition, listeners interleave and the gaps are meaningless; and `>= interval '30 minutes'` would split grimgrin's exact 30 minute pause into two sessions.\n\n**Alternative:** `sum(CASE WHEN ... THEN 1 ELSE 0 END)` instead of `count(*) FILTER`.",
		},
		{
			id: "ch17-ex08",
			title: "Boss: The Bard's Almanac",
			story:
				"The bard-in-chief is writing an almanac of the realm's most dedicated metalhead. Every one of grimgrin's listening sessions gets a line.",
			prompt:
				"One row per listening session of **listener 5** (grimgrin), sessions as in *Counting sessions* (new session after **more than 30 minutes** of silence). Return:\n\n- **session_no**: 1, 2, 3... in time order;\n- **started** and **ended**: `played_at` of its first and last play;\n- **plays**: number of plays in it;\n- **minutes_listened**: `sum(ms_played) / 60000.0`, unrounded.\n\nRows ordered by **session_no**.",
			difficulty: 5,
			kind: "query",
			concepts: ["sessionization", "running-totals", "lag-lead"],
			solutionSql:
				"WITH flagged AS (\n  SELECT played_at, ms_played,\n         CASE WHEN lag(played_at) OVER (ORDER BY played_at) IS NULL\n                OR played_at - lag(played_at) OVER (ORDER BY played_at) > interval '30 minutes'\n              THEN 1 ELSE 0 END AS new_session\n  FROM plays\n  WHERE listener_id = 5\n), numbered AS (\n  SELECT *, sum(new_session) OVER (ORDER BY played_at) AS session_no\n  FROM flagged\n)\nSELECT session_no, min(played_at) AS started, max(played_at) AS ended,\n       count(*) AS plays, sum(ms_played) / 60000.0 AS minutes_listened\nFROM numbered\nGROUP BY session_no\nORDER BY session_no;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Three steps: flag the plays that start a session, number the sessions with a running sum of the flags, then GROUP BY the session number.",
				"Flag = 1 when lag(played_at) IS NULL or the gap is more than 30 minutes. session_no = sum(flag) OVER (ORDER BY played_at).",
				"WITH flagged AS (... CASE WHEN ... THEN 1 ELSE 0 END AS new_session ...), numbered AS (SELECT *, sum(new_session) OVER (ORDER BY played_at) AS session_no FROM flagged) SELECT session_no, min(played_at), max(played_at), count(*), sum(ms_played) / 60000.0 FROM numbered GROUP BY session_no ORDER BY session_no",
			],
			explanation:
				"The running sum of start flags gives every play the number of its session, which then works as a normal GROUP BY key. On 23 February grimgrin's 30 minute pause keeps session 1 going, and the 32 minute pause starts session 2: 7 sessions in all.\n\n**Pitfall:** `>=` instead of `>` splits the session at the 30 minute pause (8 sessions), and forgetting the first row's flag numbers the first session 0.\n\n**Alternative:** `count(*) FILTER (WHERE flag)` running with `OVER (ORDER BY played_at)` gives the same numbers.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch17-pr01",
			title: "Week by week",
			prompt:
				"Return **week** (the start of the week, from `date_trunc('week', ...)`: weeks start on Monday) and **plays** for every week with plays.",
			difficulty: 1,
			kind: "query",
			concepts: ["date-bucketing"],
			solutionSql: "SELECT date_trunc('week', played_at) AS week, count(*) AS plays FROM plays GROUP BY 1;",
			check: { type: "result" },
			hints: [
				"Same as days, with another unit.",
				"date_trunc('week', played_at)",
				"SELECT date_trunc('week', played_at) AS week, count(*) AS plays FROM plays GROUP BY 1;",
			],
			explanation:
				"ISO weeks start on Monday: 23 February 2026 is a Monday, so you get three weeks (96, 38 and 10 plays).\n\n**Pitfall:** `extract(week ...)` gives week numbers that repeat every year.",
		},
		{
			id: "ch17-pr02",
			title: "Every hour of Monday",
			prompt:
				"For **23 February 2026 (UTC)**, return **hour** (timestamp) and **plays** for **all 24 hours** of the day, 0 for hours without plays.",
			difficulty: 3,
			kind: "query",
			concepts: ["time-series-gap-fill"],
			solutionSql:
				"SELECT h AS hour, count(p.id) AS plays\nFROM generate_series(timestamptz '2026-02-23 00:00+00', timestamptz '2026-02-23 23:00+00', interval '1 hour') AS h\nLEFT JOIN plays p ON date_trunc('hour', p.played_at) = h\nGROUP BY h;",
			check: { type: "result" },
			hints: [
				"Build the 24 hours with generate_series, from 00:00 to 23:00 UTC.",
				"LEFT JOIN plays on date_trunc('hour', played_at) = the hour; count a plays column.",
				"FROM generate_series(timestamptz '2026-02-23 00:00+00', timestamptz '2026-02-23 23:00+00', interval '1 hour') AS h LEFT JOIN plays p ON date_trunc('hour', p.played_at) = h",
			],
			explanation:
				"24 rows, 17 of them zero. Joining on the truncated hour attaches each play to its bucket.\n\n**Pitfall:** ending the series at `'2026-02-24 00:00'` adds a 25th hour from the next day.",
		},
		{
			id: "ch17-pr03",
			title: "Everyone, every day",
			prompt:
				"For **every listener** (quietquill, who never played, included) and **every day** from **23 February to 1 March 2026, both included**, return **listener_id**, **day** (a date) and **plays** (0 when none).",
			difficulty: 3,
			kind: "query",
			concepts: ["time-series-gap-fill", "cross-join"],
			solutionSql:
				"SELECT l.id AS listener_id, d::date AS day, count(p.id) AS plays\nFROM listeners l\nCROSS JOIN generate_series(date '2026-02-23', date '2026-03-01', interval '1 day') AS d\nLEFT JOIN plays p ON p.listener_id = l.id AND p.played_at::date = d::date\nGROUP BY l.id, d;",
			check: { type: "result" },
			hints: [
				"The grid is listeners times days: 10 times 7 rows before any play is attached.",
				"CROSS JOIN listeners with the series, then LEFT JOIN plays on both the listener and the day.",
				"FROM listeners l CROSS JOIN generate_series(...) AS d LEFT JOIN plays p ON p.listener_id = l.id AND p.played_at::date = d::date",
			],
			explanation:
				"The CROSS JOIN builds all 70 (listener, day) cells; the LEFT JOIN fills them. Both join conditions belong in ON.\n\n**Pitfall:** using `plays` to list the listeners loses quietquill, who never played.",
		},
		{
			id: "ch17-pr04",
			title: "Longest streak",
			prompt:
				"For every listener who played, return **listener_id** and **longest**: the length in days of their longest streak of consecutive UTC days with plays (a single day counts as 1).",
			difficulty: 4,
			kind: "query",
			concepts: ["gaps-and-islands"],
			solutionSql:
				"WITH days AS (\n  SELECT DISTINCT listener_id, played_at::date AS day FROM plays\n), islands AS (\n  SELECT listener_id, day - (row_number() OVER (PARTITION BY listener_id ORDER BY day))::int AS grp\n  FROM days\n), lengths AS (\n  SELECT listener_id, count(*) AS len FROM islands GROUP BY listener_id, grp\n)\nSELECT listener_id, max(len) AS longest FROM lengths GROUP BY listener_id;",
			check: { type: "result" },
			hints: [
				"First find every island with its length, then keep the longest per listener.",
				"Islands: DISTINCT days, day minus row_number per listener, group by listener and that key.",
				"lengths AS (SELECT listener_id, count(*) AS len FROM islands GROUP BY listener_id, grp) SELECT listener_id, max(len) FROM lengths GROUP BY listener_id",
			],
			explanation:
				"Two GROUP BYs: one per island, one per listener. moonmoth's best is 5 days.\n\n**Pitfall:** `count(DISTINCT day)` per listener counts all listening days, streak or not.",
		},
		{
			id: "ch17-pr05",
			title: "The silent days",
			prompt:
				"Using LAG on the list of days that have plays (any listener), return **gap_start** and **gap_end** (dates) of every hole between two play days: from the day after a play day to the day before the next play day.",
			difficulty: 3,
			kind: "query",
			concepts: ["gaps-and-islands", "lag-lead"],
			solutionSql:
				"WITH days AS (\n  SELECT DISTINCT played_at::date AS day FROM plays\n), steps AS (\n  SELECT day, lag(day) OVER (ORDER BY day) AS prev FROM days\n)\nSELECT prev + 1 AS gap_start, day - 1 AS gap_end\nFROM steps\nWHERE day - prev > 1;",
			check: { type: "result" },
			hints: [
				"Compare each play day with the previous play day.",
				"If the difference is more than 1 day, the days in between are a gap.",
				"SELECT prev + 1, day - 1 FROM (SELECT day, lag(day) OVER (ORDER BY day) AS prev FROM days) s WHERE day - prev > 1",
			],
			explanation:
				"Subtracting two dates gives a number of days. One gap: 11 March to 11 March.\n\n**Pitfall:** forgetting DISTINCT makes lag compare a day with itself (difference 0), which is harmless here but breaks streak counting.",
		},
		{
			id: "ch17-pr06",
			title: "Mind the gap",
			prompt:
				"For every play of **listener 5**, return **played_at**, **gap_minutes** (minutes since grimgrin's previous play, NULL for his first play) and **new_session** (boolean: true for his first play or when the gap is **more than 30** minutes).",
			difficulty: 3,
			kind: "query",
			concepts: ["sessionization", "lag-lead"],
			solutionSql:
				"SELECT played_at,\n       extract(epoch FROM played_at - lag(played_at) OVER w) / 60 AS gap_minutes,\n       coalesce(played_at - lag(played_at) OVER w > interval '30 minutes', true) AS new_session\nFROM plays\nWHERE listener_id = 5\nWINDOW w AS (ORDER BY played_at);",
			check: { type: "result" },
			hints: [
				"lag(played_at) gives the previous play; the difference is an interval.",
				"extract(epoch FROM interval) gives seconds. The first play has a NULL gap, but must be flagged true.",
				"coalesce(played_at - lag(played_at) OVER w > interval '30 minutes', true)",
			],
			explanation:
				"Look at 23 February: 18:18 to 18:48 is exactly 30 minutes (false), 18:48 to 19:20 is 32 (true).\n\n**Pitfall:** `gap > 30` with a NULL gap gives NULL, not true: the first play needs its own rule.",
		},
		{
			id: "ch17-pr07",
			title: "Fix: the pause that split a session",
			story:
				"grimgrin swears he only paused for 30 minutes to refill his tankard, yet the royalties report shows 8 sessions.",
			prompt:
				"Return **one number**, the count of listening sessions of **listener 5**, where a new session starts at his first play or after **more than 30 minutes** of silence.",
			difficulty: 2,
			kind: "query",
			concepts: ["sessionization"],
			starterSql:
				"SELECT count(*) AS sessions\nFROM (\n  SELECT played_at - lag(played_at) OVER (ORDER BY played_at) AS gap\n  FROM plays WHERE listener_id = 5\n) g\nWHERE gap IS NULL OR gap >= interval '30 minutes';",
			solutionSql:
				"SELECT count(*) AS sessions FROM (SELECT played_at - lag(played_at) OVER (ORDER BY played_at) AS gap FROM plays WHERE listener_id = 5) g WHERE gap IS NULL OR gap > interval '30 minutes';",
			check: { type: "result" },
			hints: [
				"Which pause is exactly 30 minutes?",
				"*More than* 30 minutes is a strict comparison.",
				"gap > interval '30 minutes'",
			],
			explanation:
				"With `>` the exact 30 minute pause stays inside the session: 7 sessions.\n\n**Pitfall:** threshold direction and strictness are the classic sessionization bugs; read the rule word by word.",
		},
	],
};

export default chapter;
