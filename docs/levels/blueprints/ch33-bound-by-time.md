### ch33-bound-by-time · Bound by Time ⌛
- **File** `src/content/chapters/ch33-bound-by-time.ts` · **World** The Alchemist's Vault · **Tier** expert · **Track** types · **Dataset** `inn`
- **Subtitle** Instants, local clocks, ranges, multiranges and the end of double bookings
- **Concepts** `timezones`, `range-types`, `multirange-types`, `temporal-constraints`
- **Prerequisites** `ch30-shaped-data`
- **Lesson** (10 steps)
  1. explain · One instant, many clocks: timestamptz is an instant, TimeZone only displays
  2. example · Same instant, three clocks: booking 3 on three clocks
  3. quiz · `timestamptz AT TIME ZONE` returns a wall clock timestamp (direction misconception)
  4. explain · When a day is 23 hours: DST: Odile's 7-hour night, `1 day` vs `24 hours`
  5. explain · Ranges: ranges, half open bounds, `&& @> -|- *`, lower/upper
  6. example · Who sleeps here on the night of 1 March?: who sleeps here on 1 March
  7. explain · Multiranges: multiranges: range_agg, datemultirange, subtraction, unnest
  8. example · Free nights in The Last Room: free nights of The Last Room
  9. explain · No double booking, ever: EXCLUDE USING gist (room_id WITH =, stay WITH &&) WHERE ..., 23P01, WITHOUT OVERLAPS
  10. try · Your turn: back to back: bookings adjacent to booking 3 (starter uses `&&`)
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch33-ex01 | local check-in wall clock per realm (booking 9 NULL) | 2 | query | result | timezones | write |
| ch33-ex02 | fix `created_at::date` for Chatham: local creation date | 3 | query | result | timezones | fix |
| ch33-ex03 | Odile's shifts: Paris start, end and real duration (7 h on DST night) | 2 | query | result | timezones | predict |
| ch33-ex04 | non cancelled stays covering the night of 2026-03-04 (12, 27; not 11) | 1 | query | result | range-types | write |
| ch33-ex05 | overlapping pairs of the same room, first_id < second_id → (30, 31) | 3 | query | result | range-types | write |
| ch33-ex06 | range_agg of shifts per staff, sorted | 3 | query | result (ordered) | multirange-types | write |
| ch33-ex07 | free nights of room 14 in March as a datemultirange | 3 | query | result | multirange-types | write |
| ch33-ex08 | cancel booking 31, add EXCLUDE constraint no_double_booking ignoring cancelled (try_sqlstate behavioural verify) | 4 | ddl | state | temporal-constraints | design |
| ch33-ex09 | **Boss · The Night Clerk's Calendar**: realm 1 rooms: clipped booked multirange, free nights, last March checkout at 11:00 Paris as timestamptz (DST) | 5 | query | result (ordered) | range-types, multirange-types, timezones | write |

- **Practice**: `ch33-pr01` timezones: predict Paris wall clock across the DST jump; `ch33-pr02` timezones: bookings created on 14 March Tokyo time (23, 26); `ch33-pr03` range-types: seasons overlapping booking 20; `ch33-pr04` range-types: adjacent pairs (3,4), (11,27), (22,29); `ch33-pr05` multirange-types: merged desk hours via unnest(range_agg); `ch33-pr06` temporal-constraints: insert overlapping booking 17 must fail 23P01 (setupSql adds the constraint); `ch33-pr07` temporal-constraints: room_holds with PRIMARY KEY (room_id, hold WITHOUT OVERLAPS); `ch33-pr08` range-types: canonical form of a `[]` daterange
- **Negative cases** (`scripts/negative-cases/ch33-bound-by-time.ts`): ex01 `AT TIME ZONE 'UTC'`, raw instant, drops booking 9; ex02 UTC date, date_trunc; ex03 wall clock difference (8 h), GMT instants; ex04 BETWEEN on bounds; ex05 `<>` mirrored pairs, `<=` bound test (touching stays), self pairs; ex08 no WHERE (still 23P01), no room_id, UNIQUE; ex09 UTC checkout, fixed +01 offset, inner join drops the Attic. Accept `timezone()`, `<@`, generate_series counting.
- **Notes**: Timestamps without zone are compared as if UTC, timestamptz as instants: local wall clock answers and instants never collide by accident. No cancelled booking covers 4 March, so the cancelled filter of ex04 is not separately graded. `try_sqlstate` lives in setupSql; NEW_BOOKING probes in verify insert with `gen_random_uuid()` refs.
