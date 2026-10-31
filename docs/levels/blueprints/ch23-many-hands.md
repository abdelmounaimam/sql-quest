### ch23-many-hands · Many Hands 👥 (side quest)
- **File** `src/content/chapters/ch23-many-hands.ts` · **World** The Forge · **Tier** expert · **Track** mutation · **Dataset** `inn`
- **Subtitle** Two clerks, one Last Room: isolation, locks and lost updates
- **Concepts** `isolation-levels`, `row-locking`, `optimistic-locking`
- **Prerequisites** `ch21-the-pact`
- **Lesson** (10 steps)
  1. explain · The Wandering Star Inn has two clerks (Brom and Nell) and one database. When they act at once: dirty reads, non-repeatable reads, phantoms, lost updates, write skew. The sandbox has a single session, so every race is shown as a two-column timeline.
  2. explain · Isolation levels in PostgreSQL: READ COMMITTED (default, each statement sees a fresh snapshot), REPEATABLE READ (one snapshot for the whole transaction), SERIALIZABLE (as if one after another, may fail with 40001); READ UNCOMMITTED behaves like READ COMMITTED (no dirty reads ever).
  3. quiz · Timeline: Brom reads room 14's rate (99.99), Nell updates it to 120.00 and commits, Brom reads again in the same READ COMMITTED transaction. What does he see? (120.00: non-repeatable read)
  4. example · `BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT current_setting('transaction_isolation') AS level; COMMIT;`
  5. quiz · Under SERIALIZABLE, Brom's COMMIT fails with 40001. What should the app do? (retry the whole transaction)
  6. explain · Pessimistic locking: `SELECT ... FOR UPDATE` locks rows until the transaction ends (outside a transaction the lock vanishes at once); `SKIP LOCKED` for work queues; deadlock 40P01 from inconsistent lock order; advisory locks lock an idea, not a row, and session advisory locks survive COMMIT.
  7. example · Claim the oldest pending booking: `SELECT ... ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED` inside BEGIN/COMMIT (booking 28).
  8. explain · Optimistic locking: read `version`, then `UPDATE ... SET ..., version = version + 1 WHERE id = 14 AND version = 1 RETURNING ...`; no row back means someone was faster: re-read and retry.
  9. quiz · Read-modify-write in app code (`SELECT rate`, compute, `SET rate = <number>`) vs `SET rate = rate + 5`: which can lose an update? (the first)
  10. try · Atomic bump: raise The Last Room's nightly_rate by 5.00 and its version by 1 in one UPDATE (starter hard-codes 104.99 and forgets the version).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch23-ex01 | Open a SERIALIZABLE transaction, return `current_setting('transaction_isolation')` as **level**, COMMIT | 1 | transaction | result | isolation-levels | write |
| ch23-ex02 | Predict: name the anomaly of a READ COMMITTED timeline (Brom counts pending bookings, Nell inserts one and commits, Brom counts again): one of five listed strings, `'phantom read'` | 2 | query | result | isolation-levels | predict |
| ch23-ex03 | Predict: same timeline under REPEATABLE READ; return the number Brom's second count shows (5, today's pending count) | 3 | query | result | isolation-levels | predict |
| ch23-ex04 | Job queue: in one UPDATE confirm the **oldest pending** booking (created_at) chosen with `FOR UPDATE SKIP LOCKED`, return its **id** (28) | 3 | transaction | result+state | row-locking | write |
| ch23-ex05 | Advisory lock: take session lock 14 with `pg_try_advisory_lock`, release it, return the release result as **released**; no advisory lock may remain | 2 | query | result+state | row-locking | write |
| ch23-ex06 | Optimistic update: Brom read version 1 of room 14; set its rate to 120.00 and bump the version only if still 1, returning **id**, **version** (14, 2) | 3 | mutation | result+state | optimistic-locking | write |
| ch23-ex07 | Fix: setupSql shows Nell already won (version 2, 110.00). Brom's starter overwrites her; rewrite it so the stale update changes **nothing** and returns **no row** | 3 | mutation | result+state | optimistic-locking | fix |
| ch23-ex08 | **Boss · The Last Room**: REPEATABLE READ transaction: lock room 14 FOR UPDATE, cancel pending booking 31 only if still pending, rebook guest 5 in room 13 for `[2026-03-22,2026-03-24)` (confirmed), bump rooms 13 and 14 with a version guard, returning **id**, **version** and the isolation **level**; COMMIT | 5 | transaction | result+state | row-locking, optimistic-locking, isolation-levels | write |

- **Practice**: `ch23-pr01` isolation-levels: predict a write-skew timeline (two night clerks each leave because the other is on duty) → `'write skew'`; `ch23-pr02` isolation-levels: `BEGIN; SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;` then return the level; `ch23-pr03` row-locking: confirm the 2 oldest pending bookings with SKIP LOCKED, return their ids (28, 31); `ch23-pr04` row-locking: predict the SQLSTATE of a lock-order deadlock → `'40P01'`; `ch23-pr05` optimistic-locking: atomic 10.00 surcharge on Moonlit Loft with a version bump, returning rate and version; `ch23-pr06` optimistic-locking: setupSql makes Brom's read of Jaguar Lodge stale (version 2): retry the guarded update against version 2, returning id and version (9, 3).
- **Negative cases to add**: anomaly names that are close (`non-repeatable read` vs `phantom read`), counting 6 under REPEATABLE READ, `ORDER BY id` in the queue (19 / 19, 23), forgetting `pg_advisory_unlock`, optimistic update without `AND version = ...` (ex07 overwrites), version not bumped, boss without the guards' effects (booking 31 not cancelled, Ghost row inserted twice), READ COMMITTED in the boss. Accept: `START TRANSACTION ISOLATION LEVEL ...`, `SET TRANSACTION` after BEGIN, `SHOW`-free variants, `= ANY (ARRAY(...))` instead of IN for the queue.
- **Notes**: single session: no lock waits, no 40001 or 40P01 can be produced, so races are taught with two-column timelines in explain and quiz cards and predict exercises answered with `SELECT '<answer>'`; the prompt lists the allowed answers verbatim so exactly one string is right. Pending bookings by created_at: 28, 31, 19, 23, 26 (by id: 19, 23, 26, 28, 31). Bookings 30 and 31 overlap on room 14: the reason ch33's exclusion constraint exists. The boss verify excludes `bookings.ref` (generated uuid).
