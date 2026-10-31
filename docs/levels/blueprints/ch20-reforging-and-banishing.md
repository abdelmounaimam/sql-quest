### ch20-reforging-and-banishing · Reforging and Banishing 🔥
- **File** `src/content/chapters/ch20-reforging-and-banishing.ts` · **World** The Forge · **Tier** apprentice · **Track** mutation · **Dataset** `starport`
- **Subtitle** UPDATE and DELETE, with joins, and without forgetting the WHERE
- **Concepts** `update-basic`, `update-from`, `delete-basic`, `delete-using`, `truncate`
- **Prerequisites** `ch19-forging-rows`, `ch10-outer-gates-and-mirrors`
- **Lesson** (9 steps)
  1. explain · `UPDATE table SET col = value WHERE ...;` no WHERE = every row. Test the WHERE with a SELECT first.
  2. example · Repair the Fizzbang: `UPDATE ships SET hull_integrity = 80 WHERE id = 6 RETURNING name, hull_integrity;`
  3. quiz · `UPDATE pilots SET credits = 0 AND reputation = 0 WHERE id = 9;` (42804: AND builds one expression; separate assignments with commas)
  4. explain · SET expressions read the **old** row: `credits = credits + 100`; `SET a = b, b = a` swaps; NULL + 100 stays NULL.
  5. explain · UPDATE ... FROM joins other tables: the target is not repeated in FROM, the join condition goes in WHERE; one target row is updated once even if several source rows match (arbitrary pick: aggregate first).
  6. example · `UPDATE pilots p SET reputation = p.reputation - 50 FROM ships s WHERE s.pilot_id = p.id AND s.name = 'Night Fang' RETURNING p.name, p.reputation;`
  7. explain · `DELETE FROM ... WHERE`; `DELETE FROM t USING other WHERE join AND filter`; foreign keys refuse to orphan rows (23503).
  8. explain · TRUNCATE empties whole tables at once; `RESTART IDENTITY` resets the sequence; refused when another table references it (0A000) unless CASCADE, which empties those too.
  9. try · Promote **Wren Calloway** (pilot 22) to **ensign** (starter forgets the WHERE).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch20-ex01 | Every **cadet** gets 100 extra credits; a frozen (NULL) account stays NULL | 1 | mutation | state | update-basic | mutate |
| ch20-ex02 | Fix `UPDATE ships SET hull_integrity = 100;`: repair only hulls **below 30** (Fizzbang, Jackpot, 100% Legit) | 1 | mutation | state | update-basic | fix |
| ch20-ex03 | Every pilot of the faction named **Azure Navy** gets a 500 credit bonus (UPDATE ... FROM factions, found by name) | 2 | mutation | state | update-from | write |
| ch20-ex04 | Reprice: each commodity's base_price becomes the **average unit_price of its sell trades** (unknown prices ignored); commodities without priced sells keep their price | 3 | mutation | state | update-from | write |
| ch20-ex05 | Delete every seizure whose fine is still pending (3 and 5) | 1 | mutation | state | delete-basic | mutate |
| ch20-ex06 | Delete every trade made by a ship flown by **Jax O'Hara** (trades 9, 33, 37) with DELETE ... USING ships, pilots | 2 | mutation | state | delete-using | write |
| ch20-ex07 | Error mission: delete pilot **Bram Kettle**; it must fail with **23503** (he mentors pilots and flies ships) | 2 | mutation | error 23503 | delete-basic | predict |
| ch20-ex08 | Empty the trade journal and restart its numbering (next trade gets id 1) | 2 | mutation | state | truncate | write |
| ch20-ex09 | **Boss · The Smugglers' Reckoning**: (1) pilots whose ships were seized at least twice in total lose 200 reputation (Cyra, Jax), (2) delete Glow Shrooms seizures before 2077-01-01 (1, 3, 7), (3) hull 50 for ships with an unknown hull that have a pilot (12, 17, not the Ghost Ship) | 5 | mutation | state | update-from, delete-using, update-basic | write |

- **Practice**: `ch20-pr01` update-basic: double the cargo capacity of every Courier Mk II; `ch20-pr02` update-basic: setupSql inverted the outlaw bounds, swap `min_rep` and `max_rep` back in one SET; `ch20-pr03` update-from: +50 reputation for pilots of factions founded before 2050; `ch20-pr04` update-from: fix `UPDATE ships SET ... FROM ships s JOIN pilots p ...` (target repeated in FROM repairs the whole fleet): only admirals' ships; `ch20-pr05` delete-basic: delete routes with hazard 'pirates'; `ch20-pr06` delete-basic: fix `DELETE FROM routes WHERE hazard = NULL` (deletes nothing); `ch20-pr07` delete-using: delete manifest lines of Viper X ships; `ch20-pr08` truncate: error mission `TRUNCATE ships` → **0A000**.
- **Negative cases to add**: missing WHERE (try, ex01, ex02); `COALESCE(credits, 0) + 100` (Lumen gets 100); `hull_integrity <= 30`; hard-coded faction 1; UPDATE ... FROM trades without grouping (arbitrary trade), averages that turn unsold commodities into NULL; `fine = NULL`; deleting only Jackpot's trades; `TRUNCATE trades` without RESTART IDENTITY, DELETE without restart; boss with an ungrouped join (every seized pilot punished), Ghost Ship repaired, Glow Shrooms seizures of 2077 deleted. Accept: `IN (SELECT ...)` versions of UPDATE ... FROM and DELETE ... USING, `faction_id = 5`, `DELETE` + `ALTER SEQUENCE ... RESTART`.
- **Notes**: Ship 3 (Cyra) has 3 seizures, ships 9 (Jax) 2, ships 6, 12, 15 one each: an ungrouped UPDATE ... FROM seizures punishes all five pilots once, the grouped one only Cyra and Jax. Boss verifySql is one UNION ALL of the three tables (kind, id, value). ex08 verify `SELECT (SELECT count(*) FROM trades), nextval(pg_get_serial_sequence('trades', 'id'))`.
