### ch16-champions-of-each-dungeon · Champions of Each Dungeon 🥇
- **File** `src/content/chapters/ch16-champions-of-each-dungeon.ts` · **World** The Observatory · **Tier** expert · **Track** query · **Dataset** `dungeon`
- **Subtitle** One best row per group, the top N per group, and the doubles to throw away
- **Concepts** `distinct-on`, `top-n-per-group`, `lateral-join`, `deduplication`
- **Prerequisites** `ch15-windows-on-the-ranks`
- **Lesson** (10 steps)
  1. explain · The best X of each Y: DISTINCT ON, row_number in a CTE, LATERAL.
  2. example · DISTINCT ON best run per dungeon, ties by started_at (Goblin Warrens: four 1200 runs, earliest wins).
  3. quiz · `DISTINCT ON (dungeon_id) ... ORDER BY score DESC` → 42P10, ORDER BY must start with the DISTINCT ON keys.
  4. explain · Top N: row_number in a CTE, filter `rn <= N` outside (windows run after WHERE).
  5. example · Each player's two best runs with row_number.
  6. explain · LATERAL sees the tables on its left; `LEFT JOIN LATERAL (...) ON true` keeps rows without matches.
  7. example · Everyone's latest run, newbies included (25 rows, 11 with NULLs).
  8. explain · Duplicates: find (GROUP BY HAVING), read past (DISTINCT / row_number), remove (DELETE in World 6, UNIQUE in World 7).
  9. example · Duplicated logins: three pairs, Kaito's 10 March ×3.
  10. try · DISTINCT ON: latest run of each dungeon (dungeon_id, id, started_at); starter keeps the oldest.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch16-ex01 | player_id, run id, score of each player's best run, ties by earliest started_at; starter keeps the worst | 2 | query | result | distinct-on | write |
| ch16-ex02 | fix `DISTINCT ON (dungeon_id) ... ORDER BY score DESC` (42P10): dungeon champion run, ties by earliest started_at | 2 | query | result | distinct-on | fix |
| ch16-ex03 | exactly 3 best runs per season (season_id, id, score), ties by earliest started_at; starter filters rn in the same SELECT (42703) | 3 | query | result | top-n-per-group | fix-ish write |
| ch16-ex04 | fair podium: runs with sports rank ≤ 3 in their season (14 rows) | 3 | query | result | top-n-per-group, ranking-functions | write |
| ch16-ex05 | every player's handle with the score and started_at of their latest run, NULLs for players without runs; starter uses JOIN LATERAL | 3 | query | result | lateral-join | fix |
| ch16-ex06 | the two best runs per player rewritten with LATERAL (handle, score), players with runs only | 3 | query | result | lateral-join, top-n-per-group | refactor |
| ch16-ex07 | clean login book: each (player_id, day) once (31 rows) | 2 | query | result | deduplication | write |
| ch16-ex08 | fix `count(*)` login report: player_id, days_logged = distinct days (NightOwl 9, not 10) | 2 | query | result | deduplication | fix |
| ch16-ex09 | **Boss · The Champions' Gallery**: each dungeon's name, champion, score, runner_up, runner_up_score (second run in score desc, started_at order) | 5 | query | result | lateral-join, top-n-per-group, distinct-on, left-join | write |

- **Practice**: `ch16-pr01` distinct-on: each player's first run; `ch16-pr02` distinct-on: most recent unlock per achievement (9 rows); `ch16-pr03` top-n-per-group: 2 longest finished runs per dungeon, ties by id; `ch16-pr04` top-n-per-group: best run per region with ties (`rank() = 1`, eu has NightOwl and Ægir); `ch16-pr05` lateral-join: each dungeon's 2 most recent runs; `ch16-pr06` deduplication: duplicated pairs with extra copies; `ch16-pr07` deduplication: rows numbered 2 or more by `row_number() OVER (PARTITION BY player_id, day)`.
- **Negative cases**: worst/first run instead of best (ex01); max then join back keeps 4 tied Goblin Warrens runs (ex02); rank() returns 14 rows, global LIMIT, wrong tie direction (ex03); dense_rank and row_number (ex04); oldest run and plain LEFT JOIN (ex05); LEFT JOIN LATERAL keeps runless players (ex06); DISTINCT ON per player, HAVING count = 1 (ex07); count(day) (ex08); runner up as second distinct score, latest wins ties (boss). Accept: row_number CTEs, LATERAL versions, GROUP BY / UNION / row_number dedup, count over a DISTINCT subquery, a FILTER pivot for the boss.
- **Notes**: deduplication stays SELECT only (DELETE comes in ch20). No player ties on their own best score; dungeons tie at the top (1200 ×4, 2400 ×5, 3300 ×2, 5200 ×3), which the earliest started_at rule resolves. Champions: NightOwl ×3, xX_Slayer_Xx, Ægir; runners up Lua, Sakura_Blade, xX_Slayer_Xx, Sakura_Blade, Kaito.
