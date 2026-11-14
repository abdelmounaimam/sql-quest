import type { Chapter } from "../types";

const TRY_SQLSTATE =
	"CREATE FUNCTION try_sqlstate(q text) RETURNS text LANGUAGE plpgsql AS $$\nBEGIN\n  EXECUTE q;\n  RETURN 'ok';\nEXCEPTION WHEN OTHERS THEN\n  RETURN SQLSTATE;\nEND $$;";

const NEW_BOOKING = (room: number, stay: string, status: string) =>
	`try_sqlstate('INSERT INTO bookings (ref, room_id, guest_id, stay, status, created_at) VALUES (gen_random_uuid(), ${room}, 1, ''${stay}'', ''${status}'', ''2026-03-01 10:00+00'')')`;

const chapter: Chapter = {
	id: "ch33-bound-by-time",
	order: 33,
	world: "The Alchemist's Vault",
	tier: "expert",
	track: "types",
	title: "Bound by Time",
	subtitle: "timestamptz and time zones, ranges, multiranges and exclusion constraints",
	emoji: "⌛",
	datasetId: "inn",
	concepts: ["timezones", "range-types", "multirange-types", "temporal-constraints"],
	prerequisites: ["ch30-shaped-data"],
	lesson: [
		{
			kind: "explain",
			title: "timestamptz is an instant",
			body: "A `timestamptz` is an **instant**: one point on the universal timeline. It stores no zone at all; the session `TimeZone` (GMT here) only decides how it is **displayed**.\n\nThe same instant shows different wall clock times in different zones. The check-in of booking 3 is 23:30 in Tokyo, 14:30 in UTC and 15:30 in Paris.",
		},
		{
			kind: "example",
			title: "One instant in three time zones",
			body: "`AT TIME ZONE` reads the instant on a given wall clock. Here is the `checked_in_at` of booking 3, read in two zones.",
			sql: "SELECT checked_in_at,\n       checked_in_at AT TIME ZONE 'Asia/Tokyo' AS tokyo,\n       checked_in_at AT TIME ZONE 'Europe/Paris' AS paris\nFROM bookings\nWHERE id = 3;",
		},
		{
			kind: "quiz",
			question: "What does `checked_in_at AT TIME ZONE 'Asia/Tokyo'` return when `checked_in_at` is a `timestamptz`?",
			choices: [
				"The same instant, now tagged with +09",
				"A `timestamp` without zone: the Tokyo wall clock reading",
				"The instant shifted by 9 hours",
				"An error: the session is in GMT",
			],
			answerIndex: 1,
			explanation:
				"On a timestamptz, AT TIME ZONE answers *what did the clock in Tokyo show?* and returns a plain `timestamp`. On a plain timestamp it works the other way: *this wall clock in Tokyo is which instant?* and returns a timestamptz.",
		},
		{
			kind: "explain",
			title: "Days that are not 24 hours",
			body: "Wall clocks jump. On 29 March 2026 Paris skips from 02:00 to 03:00 (summer time).\n\nA shift from midnight to 08:00 Paris time on that night lasts **7 hours** of real time. `interval '1 day'` added to a timestamptz follows the wall clock, `interval '24 hours'` follows the real clock. Always store instants (`timestamptz`), and convert to local time only to display or to group by local day.",
		},
		{
			kind: "explain",
			title: "Ranges",
			body: "A range is one value with two bounds: `daterange`, `tstzrange`, `int4range`, `numrange`. The `bookings.stay` column is **half open** `[arrival, departure)`: the departure day is excluded.\n\n| operator | meaning |\n|---|---|\n| `a && b` | overlap |\n| `a @> x` | contains a value or range |\n| `a -\\|- b` | adjacent (they touch) |\n| `a * b` | intersection |\n\n`lower(r)`, `upper(r)` and `isempty(r)` read it.",
		},
		{
			kind: "example",
			title: "Ranges that contain a date",
			body: "A stay covers a night if it contains the date of that night. Four bookings cover 1 March.",
			sql: "SELECT id, room_id, stay\nFROM bookings\nWHERE stay @> date '2026-03-01'\n  AND status <> 'cancelled';",
		},
		{
			kind: "explain",
			title: "Multiranges",
			body: "A **multirange** is a set of non overlapping ranges: `{[2026-03-01,2026-03-03),[2026-03-20,2026-03-24)}`.\n\n- `range_agg(stay)` merges ranges, joining overlapping and touching ones\n- `datemultirange(r)` wraps a single range\n- `m1 - m2` subtracts: a month minus the booked nights gives the **free** nights\n- `unnest(m)` turns it back into ranges\n\n`range + range` fails (22000) when the result would have a gap; multiranges allow gaps.",
		},
		{
			kind: "example",
			title: "Subtract booked nights from a month",
			body: "March, minus every non cancelled stay in room 14. The two overlapping bookings (20 to 23 and 22 to 24) merge into one block.",
			sql: "SELECT datemultirange(daterange('2026-03-01', '2026-04-01'))\n       - range_agg(stay) AS free\nFROM bookings\nWHERE room_id = 14 AND status <> 'cancelled';",
		},
		{
			kind: "explain",
			title: "Exclusion constraints",
			body: "An **exclusion constraint** generalises UNIQUE: no two rows may satisfy all the listed operators together.\n```sql\nALTER TABLE bookings ADD CONSTRAINT no_double_booking\n  EXCLUDE USING gist (room_id WITH =, stay WITH &&)\n  WHERE (status <> 'cancelled');\n```\n(`btree_gist` lets GiST handle the `=` on room_id.) Violations raise **23P01**. PG18 adds `PRIMARY KEY (room_id, stay WITHOUT OVERLAPS)` for the same idea.",
		},
		{
			kind: "try",
			title: "Adjacent ranges",
			prompt:
				"Return the **id** and **stay** of every booking of the **same room** as booking 3 whose stay is **adjacent** to booking 3's stay (they touch without overlapping).",
			starterSql:
				"SELECT b.id, b.stay\nFROM bookings b, bookings k\nWHERE k.id = 3\n  AND b.room_id = k.room_id\n  AND b.stay && k.stay;",
			solutionSql:
				"SELECT b.id, b.stay\nFROM bookings b, bookings k\nWHERE k.id = 3\n  AND b.room_id = k.room_id\n  AND b.stay -|- k.stay;",
			check: { type: "result" },
			hints: [
				"Run the starter: it finds booking 3 itself, which overlaps its own stay.",
				"The adjacency operator is `-|-`.",
			],
		},
	],
	exercises: [
		{
			id: "ch33-ex01",
			title: "Convert to each row's time zone",
			prompt:
				"For every booking whose status is `checked_in` or `checked_out`, return the **id** and the **local wall clock time** of check-in in the realm of the booked room (a `timestamp` without zone). A missing check-in stays NULL.",
			difficulty: 2,
			kind: "query",
			concepts: ["timezones"],
			solutionSql:
				"SELECT b.id, b.checked_in_at AT TIME ZONE r.timezone AS local_check_in\nFROM bookings b\nJOIN rooms ro ON ro.id = b.room_id\nJOIN realms r ON r.id = ro.realm_id\nWHERE b.status IN ('checked_in', 'checked_out');",
			check: { type: "result", strictTypes: true },
			hints: [
				"The time zone is in `realms`, reached through `rooms`.",
				"`AT TIME ZONE` accepts a column, not only a literal.",
				"b.checked_in_at AT TIME ZONE r.timezone",
			],
			explanation:
				"Every check-in reads 15:00 locally, except booking 3 at 23:30 in `Asia/Tokyo`; booking 9 has no check-in and stays NULL.\n\n**Pitfall:** `AT TIME ZONE 'UTC'` (or just the raw column) shows UTC for every row: 01:15 for an afternoon check-in in `Pacific/Chatham`.\n\n**Alternative:** `timezone(r.timezone, b.checked_in_at)` is the function form.",
		},
		{
			id: "ch33-ex02",
			title: "Local date of an instant",
			prompt:
				"For every booking of a room in realm **4** (Chatham Shoals), return the **id** and the **local calendar date** on which it was created, in that realm's time zone.",
			difficulty: 3,
			kind: "query",
			concepts: ["timezones"],
			starterSql:
				"SELECT b.id, b.created_at::date AS created_on\nFROM bookings b\nJOIN rooms ro ON ro.id = b.room_id\nWHERE ro.realm_id = 4;",
			solutionSql:
				"SELECT b.id, (b.created_at AT TIME ZONE r.timezone)::date AS created_on\nFROM bookings b\nJOIN rooms ro ON ro.id = b.room_id\nJOIN realms r ON r.id = ro.realm_id\nWHERE ro.realm_id = 4;",
			check: { type: "result", strictTypes: true },
			hints: [
				"Run the starter: every date is one day early.",
				"`::date` on a timestamptz cuts the day in the **session** time zone (GMT). Convert to the local wall clock first.",
				"(b.created_at AT TIME ZONE r.timezone)::date",
			],
			explanation:
				"`Pacific/Chatham` is 13 hours 45 minutes ahead of GMT. Converting to the local wall clock before taking the date gives the local calendar day. The same issue appears in `date_trunc('day', ts)` and in `GROUP BY ts::date`.\n\n**Pitfall:** `created_at::date` uses GMT midnight, so a booking made at 07:30 on 25 January in Chatham lands on 24 January.\n\n**Alternative:** `(b.created_at AT TIME ZONE 'Pacific/Chatham')::date` with the zone written out.",
		},
		{
			id: "ch33-ex03",
			title: "Shift durations across a DST change",
			prompt:
				"For each of **Odile's** shifts, return the **id**, the local **start** and **end** on the Paris wall clock (`Europe/Paris`), and the real **duration** (`upper(shift) - lower(shift)`).",
			difficulty: 2,
			kind: "query",
			concepts: ["timezones"],
			solutionSql:
				"SELECT id,\n       lower(shift) AT TIME ZONE 'Europe/Paris' AS starts,\n       upper(shift) AT TIME ZONE 'Europe/Paris' AS ends,\n       upper(shift) - lower(shift) AS duration\nFROM staff_shifts\nWHERE staff_name = 'Odile';",
			check: { type: "result", strictTypes: true },
			hints: [
				"`lower` and `upper` give the bounds of the tstzrange.",
				"Convert each bound to the Paris wall clock with AT TIME ZONE; subtract the instants for the duration.",
				"`lower(shift) AT TIME ZONE 'Europe/Paris'`, `upper(shift) - lower(shift)`",
			],
			explanation:
				"Both shifts read 00:00 to 08:00 on the wall clock, but the night of 29 March loses an hour to summer time: 7 hours of real time.\n\n**Pitfall:** subtracting the *local* timestamps (`ends - starts` on wall clock values) gives 8 hours both times.\n\n**Alternative:** `extract(epoch from upper(shift) - lower(shift)) / 3600` gives hours as a number.",
		},
		{
			id: "ch33-ex04",
			title: "Ranges that contain a date",
			prompt:
				"Return the **id**, **room_id** and **stay** of every booking that is **not cancelled** and covers the night of **2026-03-04**.",
			difficulty: 1,
			kind: "query",
			concepts: ["range-types"],
			solutionSql:
				"SELECT id, room_id, stay FROM bookings WHERE stay @> date '2026-03-04' AND status <> 'cancelled';",
			check: { type: "result" },
			hints: [
				"A range can be asked whether it contains a value.",
				"`@>` with a date respects the half open bounds: the departure day is not a night.",
				"WHERE stay @> date '2026-03-04' AND status <> 'cancelled'",
			],
			explanation:
				"Bookings 12 and 27 match. Booking 11 ends that day: `[2026-03-01,2026-03-04)` excludes the 4th.\n\n**Pitfall:** `date '2026-03-04' BETWEEN lower(stay) AND upper(stay)` includes the departure day and wrongly returns booking 11.\n\n**Alternative:** `date '2026-03-04' <@ stay`.",
		},
		{
			id: "ch33-ex05",
			title: "Bookings that overlap",
			prompt:
				"Return each pair of **non cancelled** bookings of the **same room** whose stays **overlap**, as two columns **first_id** and **second_id** with first_id < second_id.",
			difficulty: 3,
			kind: "query",
			concepts: ["range-types"],
			solutionSql:
				"SELECT a.id AS first_id, b.id AS second_id\nFROM bookings a\nJOIN bookings b ON b.room_id = a.room_id AND a.id < b.id AND a.stay && b.stay\nWHERE a.status <> 'cancelled' AND b.status <> 'cancelled';",
			check: { type: "result" },
			hints: [
				"Join bookings with itself on the room.",
				"`&&` tests overlap; `a.id < b.id` keeps each pair once and removes self pairs.",
				"ON b.room_id = a.room_id AND a.id < b.id AND a.stay && b.stay",
			],
			explanation:
				"Only bookings 30 and 31 overlap, on the night of 22 March. Back to back stays (3 and 4, 11 and 27, 22 and 29) only touch: with half open ranges, `&&` correctly ignores them.\n\n**Pitfall:** comparing bounds with `<=` (`lower(a) <= upper(b) AND lower(b) <= upper(a)`) treats touching stays as overlaps; `a.id <> b.id` lists every pair twice.\n\n**Alternative:** `lower(a.stay) < upper(b.stay) AND lower(b.stay) < upper(a.stay)`.",
		},
		{
			id: "ch33-ex06",
			title: "Merge ranges with range_agg",
			prompt:
				"Return each **staff_name** with the **merged** union of their shifts as a multirange, sorted by staff_name.",
			difficulty: 3,
			kind: "query",
			concepts: ["multirange-types"],
			solutionSql: "SELECT staff_name, range_agg(shift) AS coverage FROM staff_shifts GROUP BY staff_name ORDER BY staff_name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"An aggregate builds a multirange from ranges.",
				"`range_agg` merges overlapping and touching ranges.",
				"SELECT staff_name, range_agg(shift) FROM staff_shifts GROUP BY staff_name ORDER BY staff_name;",
			],
			explanation:
				"Brom's overlapping 06 to 14 and 13 to 20 become one block; Nell's back to back shifts merge into one long range; Odile keeps two pieces.\n\n**Pitfall:** `array_agg(shift)` keeps the raw shifts, overlaps included.\n\n**Alternative:** `range_agg(shift ORDER BY lower(shift))` gives the same multirange: it is normalised anyway.",
		},
		{
			id: "ch33-ex07",
			title: "Free nights as a multirange",
			prompt:
				"Return the **free nights** of room **14** in **March 2026** as a single `datemultirange`, ignoring cancelled bookings.",
			difficulty: 3,
			kind: "query",
			concepts: ["multirange-types"],
			solutionSql:
				"SELECT datemultirange(daterange('2026-03-01', '2026-04-01')) - range_agg(stay) AS free\nFROM bookings\nWHERE room_id = 14 AND status <> 'cancelled';",
			check: { type: "result" },
			hints: [
				"March as a multirange, minus the booked stays.",
				"`range_agg(stay)` merges the stays; subtracting multiranges leaves the gaps.",
				"`datemultirange(daterange('2026-03-01', '2026-04-01')) - range_agg(stay)`",
			],
			explanation:
				"Free from the 3rd to the 20th and from the 24th on. Stays outside March, if any, would subtract nothing.\n\n**Pitfall:** `daterange(...) - stay` per booking returns several rows, and a range minus a range in the middle fails with 22000 (*result would not be contiguous*).\n\n**Alternative:** `'{[2026-03-01,2026-04-01)}'::datemultirange - range_agg(stay)`.",
		},
		{
			id: "ch33-ex08",
			title: "Add an exclusion constraint",
			setupSql: TRY_SQLSTATE,
			prompt:
				"1. Cancel booking **31** (set its status to `cancelled`).\n2. Add a constraint named **no_double_booking** to `bookings` so that no two bookings of the same room whose status is not `cancelled` can have overlapping stays.",
			difficulty: 4,
			kind: "ddl",
			concepts: ["temporal-constraints"],
			solutionSql:
				"UPDATE bookings SET status = 'cancelled' WHERE id = 31;\nALTER TABLE bookings ADD CONSTRAINT no_double_booking\n  EXCLUDE USING gist (room_id WITH =, stay WITH &&)\n  WHERE (status <> 'cancelled');",
			check: {
				type: "state",
				verifySql: `SELECT 'booking 31' AS probe, status::text AS outcome FROM bookings WHERE id = 31
UNION ALL SELECT 'constraint', contype::text FROM pg_constraint WHERE conrelid = 'bookings'::regclass AND conname = 'no_double_booking'
UNION ALL SELECT 'overlap same room', ${NEW_BOOKING(14, "[2026-03-21,2026-03-22)", "confirmed")}
UNION ALL SELECT 'touching same room', ${NEW_BOOKING(14, "[2026-03-24,2026-03-25)", "confirmed")}
UNION ALL SELECT 'overlap other room', ${NEW_BOOKING(15, "[2026-03-21,2026-03-22)", "confirmed")}
UNION ALL SELECT 'cancelled overlap', ${NEW_BOOKING(1, "[2026-03-28,2026-03-29)", "cancelled")};`,
			},
			hints: [
				"Try adding the constraint first: it fails with 23P01 because 30 and 31 already overlap. Fix the data, then add it.",
				"`EXCLUDE USING gist (room_id WITH =, stay WITH &&)` plus a `WHERE (...)` clause that ignores cancelled bookings.",
				"ALTER TABLE bookings ADD CONSTRAINT no_double_booking EXCLUDE USING gist (room_id WITH =, stay WITH &&) WHERE (status <> 'cancelled');",
			],
			explanation:
				"The constraint refuses any new overlap in the same room (23P01), while touching stays, other rooms and cancelled bookings pass. A partial exclusion constraint needs the data to be clean before it can be created.\n\n**Pitfall:** without the WHERE clause, cancelled bookings would still block the room; checking overlaps in application code instead is open to race conditions between concurrent sessions.\n\n**Alternative:** in PG18, a period key `PRIMARY KEY (room_id, stay WITHOUT OVERLAPS)` (but it cannot skip cancelled rows).",
		},
		{
			id: "ch33-ex09",
			title: "Boss: The Night Clerk's Calendar",
			story:
				"Combines range intersection, multirange aggregation, counting days and converting a local time to an instant.",
			prompt:
				"For every room of realm **1**, return:\n\n- **name** of the room\n- **booked**: its non cancelled stays **clipped to March 2026**, merged into a datemultirange (`'{}'` when none)\n- **free_nights**: 31 minus the number of booked March nights\n- **last_checkout**: the instant of its latest departure day **in March** at **11:00 Paris time**, as a timestamptz (NULL when none)\n\nSort by room name.",
			difficulty: 5,
			kind: "query",
			concepts: ["range-types", "multirange-types", "timezones"],
			solutionSql:
				"SELECT ro.name,\n       coalesce(range_agg(b.stay * daterange('2026-03-01', '2026-04-01')), '{}') AS booked,\n       31 - coalesce((SELECT sum(upper(r) - lower(r))\n                      FROM unnest(range_agg(b.stay * daterange('2026-03-01', '2026-04-01'))) AS r), 0) AS free_nights,\n       (max(upper(b.stay)) FILTER (WHERE upper(b.stay) < date '2026-04-01') + time '11:00')\n         AT TIME ZONE 'Europe/Paris' AS last_checkout\nFROM rooms ro\nLEFT JOIN bookings b ON b.room_id = ro.id\n  AND b.status <> 'cancelled'\n  AND b.stay && daterange('2026-03-01', '2026-04-01')\nWHERE ro.realm_id = 1\nGROUP BY ro.name\nORDER BY ro.name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"LEFT JOIN the non cancelled March bookings to the rooms (filters in ON, so the Attic of Echoes, which has none, stays), then aggregate per room.",
				"`stay * daterange('2026-03-01', '2026-04-01')` clips a stay; `range_agg` merges; `unnest` the multirange to sum `upper - lower`.",
				"For the checkout: `(max(upper(b.stay)) + time '11:00') AT TIME ZONE 'Europe/Paris'` turns a Paris wall clock into an instant.",
			],
			explanation:
				"Ranges clip with `*`, multiranges merge and count without double counting, and `AT TIME ZONE` on a plain timestamp goes from the Paris wall clock to an instant: 11:00 is 10:00 GMT on 15 March but 09:00 GMT on the 29th and 31st, after the switch to summer time.\n\n**Pitfall:** a WHERE on bookings drops the Attic of Echoes; `AT TIME ZONE 'UTC'` or a fixed `+01` offset gets the summer checkouts wrong by an hour.\n\n**Alternative:** count free nights with `generate_series` over March days and `NOT (booked @> day)`.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch33-pr01",
			title: "Wall clock across a DST jump",
			prompt:
				"Return one row with the Paris wall clock reading (`AT TIME ZONE 'Europe/Paris'`) of the instants `2026-03-29 00:30+00` and `2026-03-29 01:30+00`, in that order.",
			difficulty: 2,
			kind: "query",
			concepts: ["timezones"],
			solutionSql:
				"SELECT timestamptz '2026-03-29 00:30+00' AT TIME ZONE 'Europe/Paris' AS before_jump,\n       timestamptz '2026-03-29 01:30+00' AT TIME ZONE 'Europe/Paris' AS after_jump;",
			check: { type: "result" },
			hints: [
				"Write the two timestamptz literals and convert each.",
				"timestamptz 'literal' AT TIME ZONE 'Europe/Paris'",
				"SELECT timestamptz '2026-03-29 00:30+00' AT TIME ZONE 'Europe/Paris', ...",
			],
			explanation: "01:30 then 03:30: one real hour apart, two hours apart on the wall clock. 02:30 Paris time does not exist that night.",
		},
		{
			id: "ch33-pr02",
			title: "Filter by local date",
			prompt:
				"Return the **id** of every booking **created** on **14 March 2026** according to the clocks of **Tokyo** (`Asia/Tokyo`).",
			difficulty: 2,
			kind: "query",
			concepts: ["timezones"],
			solutionSql: "SELECT id FROM bookings WHERE (created_at AT TIME ZONE 'Asia/Tokyo')::date = date '2026-03-14';",
			check: { type: "result" },
			hints: [
				"Convert to the Tokyo wall clock, then take the date.",
				"`::date` alone would use GMT.",
				"WHERE (created_at AT TIME ZONE 'Asia/Tokyo')::date = '2026-03-14'",
			],
			explanation:
				"Bookings 23 and 26. A GMT calendar would give 16 and 26 instead. For an index friendly version, compare with two instants: `created_at >= timestamptz '2026-03-14 00:00+09' AND created_at < timestamptz '2026-03-15 00:00+09'`.",
		},
		{
			id: "ch33-pr03",
			title: "Ranges that overlap a stay",
			prompt: "Return the **name** of every rate season whose period **overlaps** the stay of booking **20**.",
			difficulty: 1,
			kind: "query",
			concepts: ["range-types"],
			solutionSql: "SELECT name FROM rate_seasons WHERE period && (SELECT stay FROM bookings WHERE id = 20);",
			check: { type: "result" },
			hints: [
				"Fetch booking 20's stay with a subquery.",
				"`&&` tests overlap between two ranges.",
				"WHERE period && (SELECT stay FROM bookings WHERE id = 20)",
			],
			explanation: "Spring Blossom, Sakura Season and the Lantern Festival all overlap the first days of April.",
		},
		{
			id: "ch33-pr04",
			title: "Adjacent bookings",
			prompt:
				"Return every pair of bookings of the **same room** whose stays are **adjacent**, as **first_id** and **second_id** with first_id < second_id.",
			difficulty: 2,
			kind: "query",
			concepts: ["range-types"],
			solutionSql:
				"SELECT a.id AS first_id, b.id AS second_id\nFROM bookings a JOIN bookings b ON b.room_id = a.room_id AND a.id < b.id AND a.stay -|- b.stay;",
			check: { type: "result" },
			hints: [
				"Self join on the room.",
				"`-|-` means the ranges touch.",
				"ON b.room_id = a.room_id AND a.id < b.id AND a.stay -|- b.stay",
			],
			explanation: "(3, 4), (11, 27) and (22, 29): each second stay starts on the departure day of the first.",
		},
		{
			id: "ch33-pr05",
			title: "Total covered time without overlaps",
			prompt:
				"Return each **staff_name** and the **total time** they actually covered the desk, counting overlapping shifts only once (an interval).",
			difficulty: 3,
			kind: "query",
			concepts: ["multirange-types"],
			solutionSql:
				"SELECT staff_name, (SELECT sum(upper(r) - lower(r)) FROM unnest(range_agg(shift)) AS r) AS covered\nFROM staff_shifts\nGROUP BY staff_name;",
			check: { type: "result" },
			hints: [
				"Merge first, then measure.",
				"`unnest(range_agg(shift))` yields the merged ranges.",
				"`(SELECT sum(upper(r) - lower(r)) FROM unnest(range_agg(shift)) r)`",
			],
			explanation: "Brom covered 22 hours, not 23: two of his shifts overlap by an hour. Tiago 10, not 11.",
		},
		{
			id: "ch33-pr06",
			title: "Violate an exclusion constraint",
			setupSql:
				"UPDATE bookings SET status = 'cancelled' WHERE id = 31;\nALTER TABLE bookings ADD CONSTRAINT no_double_booking EXCLUDE USING gist (room_id WITH =, stay WITH &&) WHERE (status <> 'cancelled');",
			prompt:
				"The `no_double_booking` constraint is in place. Insert a booking of room **1** for guest **12** from **2026-03-29** to **2026-03-30** (ref `gen_random_uuid()`, status `confirmed`, created_at `2026-03-01 10:00+00`). The insert must be refused.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["temporal-constraints"],
			solutionSql:
				"INSERT INTO bookings (ref, room_id, guest_id, stay, status, created_at)\nVALUES (gen_random_uuid(), 1, 12, '[2026-03-29,2026-03-30)', 'confirmed', '2026-03-01 10:00+00');",
			check: { type: "error", sqlstate: "23P01" },
			hints: [
				"Booking 17 holds room 1 from 27 to 31 March.",
				"Write a plain INSERT with the six columns.",
				"VALUES (gen_random_uuid(), 1, 12, '[2026-03-29,2026-03-30)', 'confirmed', '2026-03-01 10:00+00')",
			],
			explanation: "23P01, *conflicting key value violates exclusion constraint*: the database enforces the rule even when two sessions insert at the same time.",
		},
		{
			id: "ch33-pr07",
			title: "Primary key WITHOUT OVERLAPS",
			setupSql: TRY_SQLSTATE,
			prompt:
				"Create a table **room_holds** with columns `room_id int` and `hold daterange`, whose **primary key** is the room plus the hold period **without overlaps** (PG18 temporal key).",
			difficulty: 3,
			kind: "ddl",
			concepts: ["temporal-constraints"],
			solutionSql: "CREATE TABLE room_holds (\n  room_id int,\n  hold daterange,\n  PRIMARY KEY (room_id, hold WITHOUT OVERLAPS)\n);",
			check: {
				type: "state",
				verifySql:
					"SELECT 'first' AS probe, try_sqlstate('INSERT INTO room_holds VALUES (1, ''[2026-01-01,2026-01-05)'')') AS outcome\nUNION ALL SELECT 'overlap', try_sqlstate('INSERT INTO room_holds VALUES (1, ''[2026-01-04,2026-01-06)'')')\nUNION ALL SELECT 'touching', try_sqlstate('INSERT INTO room_holds VALUES (1, ''[2026-01-05,2026-01-06)'')')\nUNION ALL SELECT 'other room', try_sqlstate('INSERT INTO room_holds VALUES (2, ''[2026-01-01,2026-01-05)'')')\nUNION ALL SELECT 'pk', contype::text FROM pg_constraint WHERE conrelid = 'room_holds'::regclass AND contype = 'p';",
			},
			hints: [
				"The temporal key is written inside PRIMARY KEY.",
				"The range column comes last, followed by WITHOUT OVERLAPS.",
				"PRIMARY KEY (room_id, hold WITHOUT OVERLAPS)",
			],
			explanation: "Overlapping holds of the same room fail with 23P01; touching holds and other rooms pass. Internally it is a GiST exclusion constraint.",
		},
		{
			id: "ch33-pr08",
			title: "Canonical form of a closed range",
			prompt: "Return the value of `daterange('2026-03-01', '2026-03-05', '[]')` (both bounds included).",
			difficulty: 1,
			kind: "query",
			concepts: ["range-types"],
			solutionSql: "SELECT daterange('2026-03-01', '2026-03-05', '[]') AS r;",
			check: { type: "result" },
			hints: [
				"The third argument sets the bound types.",
				"Just SELECT it and look.",
				"SELECT daterange('2026-03-01', '2026-03-05', '[]');",
			],
			explanation: "`[2026-03-01,2026-03-06)`: discrete ranges are always stored in canonical half open form.",
		},
	],
};

export default chapter;
