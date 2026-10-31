### ch17-patterns-in-time · Patterns in Time ⏳
- **File** `src/content/chapters/ch17-patterns-in-time.ts` · **World** The Observatory · **Tier** expert · **Track** query · **Dataset** `bardic`
- **Subtitle** Buckets, empty days, streaks and listening sessions
- **Concepts** `date-bucketing`, `time-series-gap-fill`, `gaps-and-islands`, `sessionization`
- **Prerequisites** `ch15-windows-on-the-ranks`
- **Lesson** (10 steps)
  1. explain · Bardic Beats: `plays` is an event stream; `date_trunc('day', played_at)`; GMT session so UTC days.
  2. example · Plays per day: 10 March then 12 March, the 11th is missing.
  3. explain · date_trunc units (weeks start Monday), `date_bin` any stride from an origin, `::date`; keep buckets typed, not `to_char` text. Time zones teased for World 8.
  4. quiz · Why is 11 March missing? (GROUP BY only builds groups from existing rows)
  5. example · Gap fill: generate_series LEFT JOIN plays, `count(p.id)` shows 0.
  6. quiz · `count(*)` on the empty day after the LEFT JOIN gives? (1)
  7. explain · Islands: day minus row_number is constant inside a streak; deduplicate days first.
  8. example · moonmoth's days with rn and grp columns.
  9. explain · Sessions: flag first play or gap > 30 min with LAG, running sum of flags; partition by listener.
  10. try · day (UTC date) and plays for every day with plays.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch17-ex01 | 23 February: **hour** (timestamp truncated to the hour) and plays, hours with plays only; starter uses extract(hour) | 2 | query | result | date-bucketing | write |
| ch17-ex02 | listener 5: **slot** (15 minute date_bin aligned on midnight) and plays | 2 | query | result | date-bucketing | write |
| ch17-ex03 | fix the `to_char('DD/MM')` chart: day as a date and plays, ordered by day | 2 | query | result (ordered) | date-bucketing | fix |
| ch17-ex04 | every day 23 Feb to 14 Mar (both included) with plays, 0 for 11 March | 3 | query | result | time-series-gap-fill | write |
| ch17-ex05 | fix the WHERE after the LEFT JOIN: listener 1 per day over the same range, 0 included | 3 | query | result | time-series-gap-fill | fix |
| ch17-ex06 | streaks of 3+ consecutive UTC days: listener_id, streak_start, streak_end, days (5 rows) | 4 | query | result | gaps-and-islands | write |
| ch17-ex07 | fix the unpartitioned LAG: sessions per listener (new session after more than 30 minutes) | 4 | query | result | sessionization | fix |
| ch17-ex08 | **Boss · The Bard's Almanac**: grimgrin's sessions: session_no, started, ended, plays, minutes_listened, ordered | 5 | query | result (ordered) | sessionization, running-totals, lag-lead | write |

- **Practice**: `ch17-pr01` date-bucketing: plays per ISO week (3 weeks); `ch17-pr02` time-series-gap-fill: all 24 hours of 23 February; `ch17-pr03` time-series-gap-fill: every listener × every day of 23 Feb to 1 Mar (70 cells, quietquill included); `ch17-pr04` gaps-and-islands: longest streak per listener; `ch17-pr05` gaps-and-islands: silent days via LAG (11 March); `ch17-pr06` sessionization: listener 5 gap_minutes and new_session flag; `ch17-pr07` sessionization: fix `>=` to `>` in the session count (7, not 8).
- **Negative cases**: whole range or day bucket (ex01); shifted origin, 30 minute stride (ex02); ordered by plays (ex03); count(*), inner join, missing last day (ex04); `OR IS NULL` in WHERE and missing listener filter (ex05); undeduplicated days, `> 3` (ex06); `>=` and missing first-play flag (ex07); `>=`, session 0, integer division (boss). Accept: `::date` vs `date_trunc`, half open ranges, filter in a subquery or a FILTER, LAG + running sum islands, `coalesce(... > ..., true)` flags.
- **Notes**: session TimeZone is GMT, every prompt says UTC. 144 plays, no play on 11 March. grimgrin's 23 Feb gaps 6, 6, 6, 30, 32, 6 minutes: 7 sessions with `>`, 8 with `>=`. Sessions per listener 1 to 9: 10, 6, 6, 3, 7, 5, 7, 2, 3. Streaks ≥ 3: listener 1 (5 and 3 days), 5 (4), 7 (3 and 4 across the month end). `to_char('YYYY-MM-DD')` is accepted in ex03 (same text as a date).
