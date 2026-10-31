### ch21-the-pact · The Pact 🤝
- **File** `src/content/chapters/ch21-the-pact.ts` · **World** The Forge · **Tier** apprentice · **Track** mutation · **Dataset** `starport`
- **Subtitle** All or nothing: transactions, savepoints and reading constraint errors
- **Concepts** `transactions-basics`, `savepoints`, `constraint-errors`
- **Prerequisites** `ch20-reforging-and-banishing`
- **Lesson** (9 steps)
  1. explain · A credit transfer is two UPDATEs; if the second fails the first must not stay: `BEGIN; ...; COMMIT;` (ACID in one sentence each).
  2. example · Ada pays Dax 500 credits inside BEGIN/COMMIT, then SELECT both wallets.
  3. explain · ROLLBACK undoes everything since BEGIN; without BEGIN every statement commits on its own (autocommit) and ROLLBACK only warns; after COMMIT it is too late.
  4. quiz · Inside a transaction an UPDATE fails. What happens to the next statements? (25P02: every statement is refused until ROLLBACK)
  5. explain · `SAVEPOINT s`, `ROLLBACK TO SAVEPOINT s` (undo only what came after, the transaction stays open), `RELEASE SAVEPOINT s` (forget the mark, commits nothing).
  6. example · Two price changes, roll back the second with a savepoint, commit the first.
  7. explain · Constraint errors: 23502 not null, 23503 foreign key, 23505 unique, 23514 check; the DETAIL line names the key; NULL callsigns never collide.
  8. quiz · `DETAIL: Key (name)=(Mirage) already exists.` Which SQLSTATE? (23505)
  9. try · Transfer 300 credits from Kree-7 (10) to Tiko (19) inside BEGIN/COMMIT (starter only debits).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch21-ex01 | Inside BEGIN/COMMIT, move 1000 credits from **Vera Lux** (21) to **Yuki Hoshino** (24) | 1 | transaction | state | transactions-basics | mutate |
| ch21-ex02 | Fix: the starter deletes hazardous routes "as a test", then ROLLBACK without BEGIN (autocommit already happened), then opens lane 9→3. Make the test delete undone and keep the new lane | 2 | transaction | state | transactions-basics | fix |
| ch21-ex03 | Error mission: Jax O'Hara (0.00 credits) pays 50 credits: **23514** | 2 | mutation | error 23514 | constraint-errors | predict |
| ch21-ex04 | Error mission: register a second planet named **Mirage**: **23505** | 1 | mutation | error 23505 | constraint-errors | predict |
| ch21-ex05 | One transaction: Water Ice to 13.00, `SAVEPOINT before_pearls`, Void Pearls to 99.99 (typo), roll back to the savepoint, COMMIT | 3 | transaction | state | savepoints | mutate |
| ch21-ex06 | Fix: `... SAVEPOINT; second fine; RELEASE SAVEPOINT; ROLLBACK;` loses both fines (RELEASE is not a commit). Both fines must stick | 3 | transaction | state | savepoints, transactions-basics | fix |
| ch21-ex07 | Predict: Ada's credits after `+100, SAVEPOINT a, +200, SAVEPOINT b, +400, ROLLBACK TO a, +800, COMMIT` (98900) | 3 | transaction | result | savepoints | predict |
| ch21-ex08 | **Boss · The Cargo Pact**: Bram buys 300 t of Space Kelp at 8.50 (insert the trade), pays 2550, `SAVEPOINT commission`, pays Grimble a 51 credit commission, `SAVEPOINT refund`, a 255 refund that Customs vetoes (roll back to refund), COMMIT | 5 | transaction | state | transactions-basics, savepoints, insert-basic | write |

- **Practice**: `ch21-pr01` transactions-basics: open lanes 11→2 and 2→11 (3.9 ly) inside one transaction; `ch21-pr02` transactions-basics: fix a cadet payroll that ends with ROLLBACK; `ch21-pr03` savepoints: three price changes with two savepoints, roll back to the first; `ch21-pr04` constraint-errors: ship with cargo_capacity 0 → **23514**; `ch21-pr05` constraint-errors: pilot without joined_at → **23502**; `ch21-pr06` constraint-errors: trade for ship 99 → **23503**; `ch21-pr07` constraint-errors: a second callsign 'Nova' → **23505**.
- **Negative cases to add**: ROLLBACK instead of ROLLBACK TO SAVEPOINT (ex05, boss), ending with ROLLBACK (ex06, pr02), only one side of a transfer (try, ex01), statement failing with another code (42703 typo, 23502 instead of 23514), deleting the DELETE line is accepted (same state). Accept: `START TRANSACTION`, `END`, `ROLLBACK TO before_pearls` without the keyword SAVEPOINT.
- **Notes**: the app stops the learner script at its **first error**, so a state mission can never contain a failing statement: savepoint recovery after a real error and 25P02 are taught with quizzes and explain cards; error missions are single statements. A script left open (no COMMIT) is still seen by verifySql in the same session, so "forgot COMMIT" cannot be graded; the fix missions use a final ROLLBACK instead. ROLLBACK outside a transaction is only a warning (25P01), which makes ex02 runnable.
