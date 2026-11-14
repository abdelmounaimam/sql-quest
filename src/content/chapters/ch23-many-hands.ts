import type { Chapter } from "../types";

const ROOMS_STATE = "SELECT id, nightly_rate, version FROM rooms ORDER BY id;";
const BOOKINGS_STATE = "SELECT id, room_id, guest_id, stay, status FROM bookings ORDER BY id;";

const chapter: Chapter = {
	id: "ch23-many-hands",
	order: 23,
	world: "The Forge",
	tier: "expert",
	track: "mutation",
	title: "Many Hands",
	subtitle: "Isolation levels, row locks and optimistic locking",
	emoji: "👥",
	datasetId: "inn",
	concepts: ["isolation-levels", "row-locking", "optimistic-locking"],
	prerequisites: ["ch21-the-pact"],
	lesson: [
		{
			kind: "explain",
			title: "Concurrent transactions",
			body: "When two sessions (call them **A** and **B**) work on the same data at the same moment, four anomalies can occur:\n\n- a value changes between two reads (**non-repeatable read**),\n- new rows appear in a repeated query (**phantom read**),\n- one session's write erases the other's (**lost update**),\n- two valid decisions add up to a broken rule (**write skew**).\n\nThis sandbox has a single session, so concurrent runs are shown as **timelines**.",
		},
		{
			kind: "explain",
			title: "Isolation levels",
			body: "| level | what a transaction sees |\n|---|---|\n| READ COMMITTED (default) | a fresh snapshot **per statement** |\n| REPEATABLE READ | one snapshot for the **whole transaction** |\n| SERIALIZABLE | as if transactions ran one after another; may fail with **40001** |\n\nPostgres never shows uncommitted data: READ UNCOMMITTED behaves like READ COMMITTED. Choose with `BEGIN ISOLATION LEVEL REPEATABLE READ;`.",
		},
		{
			kind: "quiz",
			question:
				"Default level. Session A: `BEGIN; SELECT nightly_rate FROM rooms WHERE id = 14;` → 99.99. Session B: `UPDATE rooms SET nightly_rate = 120.00 WHERE id = 14;` (autocommit). Session A runs the same SELECT again, still inside its transaction. What does it see?",
			choices: [
				"99.99, because its transaction started before B's change",
				"120.00: under READ COMMITTED every statement sees the latest committed data",
				"An error 40001",
				"Nothing: the row is locked by B",
			],
			answerIndex: 1,
			explanation:
				"That is a **non-repeatable read**: same query, same transaction, different answer. Under REPEATABLE READ, session A keeps seeing 99.99 until it ends its transaction.",
		},
		{
			kind: "example",
			title: "Choosing a level",
			body: "The level is set when the transaction starts and can be read back with `current_setting`.",
			sql: "BEGIN ISOLATION LEVEL REPEATABLE READ;\nSELECT current_setting('transaction_isolation') AS level;\nCOMMIT;",
		},
		{
			kind: "quiz",
			question:
				"Sessions A and B run SERIALIZABLE transactions that conflict. B commits first; A's COMMIT fails with SQLSTATE 40001. What should the application do?",
			choices: [
				"Show an error page: the data is corrupted",
				"Retry A's whole transaction from its BEGIN",
				"Re-run only A's last statement",
				"Switch to READ UNCOMMITTED to avoid conflicts",
			],
			answerIndex: 1,
			explanation:
				"40001 (*serialization failure*) means \"try again\": nothing was written, and a fresh attempt sees B's work. SERIALIZABLE is safe only with a **retry loop** around the whole transaction.",
		},
		{
			kind: "explain",
			title: "Pessimistic locks",
			body: "`SELECT ... FOR UPDATE` locks the rows it returns **until the transaction ends**: anyone else trying to lock or change them waits. Outside BEGIN, the lock is released at once, so it protects nothing.\n\n- `SKIP LOCKED` skips rows locked by others: useful for work queues.\n- Two sessions locking rooms 1 then 2, and 2 then 1, wait for each other forever: Postgres kills one with **40P01** (deadlock). Always lock in the same order.\n- `pg_try_advisory_lock(14)` locks an *idea* (a number), not a row; a session advisory lock survives COMMIT until you unlock it.",
		},
		{
			kind: "example",
			title: "Claiming a row from a queue",
			body: "This query claims the oldest pending booking. With SKIP LOCKED, a second session running the same query at the same time gets the next one instead of waiting.",
			sql: "BEGIN;\nSELECT id, room_id, created_at\nFROM bookings\nWHERE status = 'pending'\nORDER BY created_at\nLIMIT 1\nFOR UPDATE SKIP LOCKED;\nCOMMIT;",
		},
		{
			kind: "explain",
			title: "Optimistic locking",
			body: "No lock is held between the read and the write. You remember the row's `version`, then write only if nobody changed it meanwhile:\n```sql\nUPDATE rooms\nSET nightly_rate = 120.00, version = version + 1\nWHERE id = 14 AND version = 1\nRETURNING id, version;\n```\nOne row back: your write succeeded. **No row back**: another session changed the row first. Re-read the row and decide again.",
		},
		{
			kind: "quiz",
			question:
				"Two sessions add a 5.00 surcharge to room 14 at the same time. Which version can lose one surcharge?",
			choices: [
				"`SELECT nightly_rate ...` in the app, compute 104.99, then `UPDATE rooms SET nightly_rate = 104.99 WHERE id = 14`",
				"`UPDATE rooms SET nightly_rate = nightly_rate + 5 WHERE id = 14`",
				"Both are safe",
				"Both lose updates",
			],
			answerIndex: 0,
			explanation:
				"Read-modify-write in the application: both sessions read 99.99, both write 104.99, one surcharge is lost (**lost update**). `SET x = x + 5` reads and writes in one statement on the latest version of the row, so the second session adds on top of the first.",
		},
		{
			kind: "try",
			title: "Write an atomic surcharge",
			prompt:
				"In **one UPDATE**, raise the `nightly_rate` of room **14** (**The Last Room**) by **5.00** from its current value and increase its `version` by **1**.",
			starterSql: "UPDATE rooms\nSET nightly_rate = 104.99\nWHERE id = 14;",
			solutionSql:
				"UPDATE rooms SET nightly_rate = nightly_rate + 5.00, version = version + 1 WHERE id = 14;",
			check: { type: "state", verifySql: ROOMS_STATE },
			hints: [
				"The starter hard-codes a value read earlier, and does not change the version.",
				"SET nightly_rate = nightly_rate + 5.00, version = version + 1",
			],
		},
	],
	exercises: [
		{
			id: "ch23-ex01",
			title: "Start a SERIALIZABLE transaction",
			prompt:
				"Start a transaction at isolation level **SERIALIZABLE**, **return** `current_setting('transaction_isolation')` as **level**, then **COMMIT**.",
			difficulty: 1,
			kind: "transaction",
			concepts: ["isolation-levels"],
			solutionSql:
				"BEGIN ISOLATION LEVEL SERIALIZABLE;\nSELECT current_setting('transaction_isolation') AS level;\nCOMMIT;",
			check: { type: "result" },
			hints: [
				"The level goes right after BEGIN.",
				"BEGIN ISOLATION LEVEL SERIALIZABLE;",
				"BEGIN ISOLATION LEVEL SERIALIZABLE; SELECT current_setting('transaction_isolation') AS level; COMMIT;",
			],
			explanation:
				"The SELECT runs inside the transaction and reports `serializable`. The level must be chosen before the first query of the transaction.\n\n**Pitfall:** a plain `BEGIN` reports `read committed`, the default: Postgres never upgrades your level by itself.",
		},
		{
			id: "ch23-ex02",
			title: "Identify a phantom read",
			prompt:
				"Under **READ COMMITTED**:\n\n| step | session A | session B |\n|---|---|---|\n| 1 | `BEGIN;` | |\n| 2 | `SELECT count(*) FROM bookings WHERE status = 'pending';` | |\n| 3 | | `INSERT INTO bookings ... status 'pending'` and commit |\n| 4 | same count again | |\n\nSession A's second count is one higher. **Return** the name of this anomaly as a one-row, one-column result, choosing **exactly** one of: `dirty read`, `non-repeatable read`, `phantom read`, `lost update`, `write skew`.",
			difficulty: 2,
			kind: "query",
			concepts: ["isolation-levels"],
			solutionSql: "SELECT 'phantom read' AS anomaly;",
			check: { type: "result" },
			hints: [
				"Did an existing row change, or did a new row appear in the result?",
				"A new row matching the WHERE of a repeated query is a phantom.",
				"SELECT 'phantom read';",
			],
			explanation:
				"A **phantom read**: no row that session A saw was modified, but a new row now matches its condition. READ COMMITTED takes a new snapshot per statement, so the second count sees B's insert.\n\n**Pitfall:** calling it a non-repeatable read, which is about an *existing* row whose values changed.",
		},
		{
			id: "ch23-ex03",
			title: "Count under REPEATABLE READ",
			prompt:
				"Replay the timeline of *Identify a phantom read* with session A starting its transaction with `BEGIN ISOLATION LEVEL REPEATABLE READ;`, using the current data. **Return** one number: the count that session A's **second** query shows. (Tip: run its first count yourself.)",
			difficulty: 3,
			kind: "query",
			concepts: ["isolation-levels"],
			solutionSql: "SELECT count(*) FROM bookings WHERE status = 'pending';",
			check: { type: "result" },
			hints: [
				"First, how many pending bookings are there right now?",
				"Under REPEATABLE READ, session A's whole transaction reads the snapshot taken at its first query.",
				"Same count as the first one: SELECT count(*) FROM bookings WHERE status = 'pending';",
			],
			explanation:
				"5, both times: the snapshot is fixed at session A's first query, so B's committed insert stays invisible until A ends its transaction. The result is consistent, but not the latest data.\n\n**Pitfall:** answering 6. That is what READ COMMITTED would show.",
		},
		{
			id: "ch23-ex04",
			title: "Claim the oldest pending booking",
			prompt:
				"In **one UPDATE**, set the status of the **oldest pending** booking (smallest `created_at`) to **confirmed**, choosing it with a subquery that uses `FOR UPDATE SKIP LOCKED`, so that concurrent sessions each claim a different booking without waiting. **Return** its **id**.",
			difficulty: 3,
			kind: "transaction",
			concepts: ["row-locking"],
			solutionSql:
				"UPDATE bookings\nSET status = 'confirmed'\nWHERE id IN (\n  SELECT id FROM bookings\n  WHERE status = 'pending'\n  ORDER BY created_at\n  LIMIT 1\n  FOR UPDATE SKIP LOCKED\n)\nRETURNING id;",
			check: { type: "result+state", verifySql: BOOKINGS_STATE },
			hints: [
				"Write the SELECT that finds the oldest pending booking first, like the lesson example.",
				"Put it in `WHERE id IN (...)` of an UPDATE, keeping FOR UPDATE SKIP LOCKED inside.",
				"UPDATE bookings SET status = 'confirmed' WHERE id IN (SELECT id FROM bookings WHERE status = 'pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id;",
			],
			explanation:
				"Booking 28 (made 2026-03-10) is confirmed. The subquery locks the row it picks; a second session running the same statement skips it and takes 31.\n\n**Pitfall:** `ORDER BY id` picks booking 19, which is not the oldest: ids say nothing about time.",
		},
		{
			id: "ch23-ex05",
			title: "Take and release an advisory lock",
			prompt:
				"Take the session advisory lock **14** with `pg_try_advisory_lock`, then release it with `pg_advisory_unlock`. Your last statement must **return** the result of the release as **released**. No advisory lock may remain afterwards.",
			difficulty: 2,
			kind: "query",
			concepts: ["row-locking"],
			starterSql: "SELECT pg_try_advisory_lock(14) AS got;",
			solutionSql:
				"SELECT pg_try_advisory_lock(14) AS got;\nSELECT pg_advisory_unlock(14) AS released;",
			check: {
				type: "result+state",
				verifySql: "SELECT count(*) AS advisory_locks FROM pg_locks WHERE locktype = 'advisory';",
			},
			hints: [
				"Run the starter: it returns true, but the lock is still held.",
				"Session advisory locks live until you unlock them, even across COMMIT.",
				"SELECT pg_advisory_unlock(14) AS released;",
			],
			explanation:
				"`pg_try_advisory_lock` returns true when it got the lock (false instead of waiting if someone else holds it); `pg_advisory_unlock` returns true when it released one.\n\n**Pitfall:** forgetting the unlock. A session lock outlives the transaction and blocks every other session until the connection closes. `pg_advisory_xact_lock` releases itself at COMMIT.",
		},
		{
			id: "ch23-ex06",
			title: "Optimistic update with a version guard",
			prompt:
				"Room **14** was read earlier at rate 99.99, **version 1**. Set its `nightly_rate` to **120.00** and increase its `version` by 1, **only if** its version is still **1**. **Return** its **id** and new **version**.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["optimistic-locking"],
			solutionSql:
				"UPDATE rooms\nSET nightly_rate = 120.00, version = version + 1\nWHERE id = 14 AND version = 1\nRETURNING id, version;",
			check: { type: "result+state", verifySql: ROOMS_STATE },
			hints: [
				"The version you read becomes part of the WHERE.",
				"Bump the version in the same SET.",
				"... WHERE id = 14 AND version = 1 RETURNING id, version;",
			],
			explanation:
				"Nobody changed the room, so the guard holds: one row comes back with version 2, and any session still holding version 1 now updates nothing.\n\n**Pitfall:** forgetting `version = version + 1`. The next stale writer still finds version 1 and overwrites your change.",
		},
		{
			id: "ch23-ex07",
			title: "Optimistic update on a stale version",
			prompt:
				"Room **14** was read at **version 1**. Since then, another session set its rate to 110.00 and its version to **2**. The starter UPDATE overwrites that change. Rewrite it as an **optimistic** update based on the version that was read (**1**): rate **120.00**, version + 1, returning **id** and **version**. Since the room already changed, it must change **nothing** and return **no row**.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["optimistic-locking"],
			setupSql: "UPDATE rooms SET nightly_rate = 110.00, version = 2 WHERE id = 14;",
			starterSql:
				"UPDATE rooms\nSET nightly_rate = 120.00\nWHERE id = 14\nRETURNING id, version;",
			solutionSql:
				"UPDATE rooms\nSET nightly_rate = 120.00, version = version + 1\nWHERE id = 14 AND version = 1\nRETURNING id, version;",
			check: { type: "result+state", verifySql: ROOMS_STATE },
			hints: [
				"Run the starter: the 110.00 rate is silently overwritten.",
				"Add the version that was read to the WHERE, and bump it in the SET.",
				"... SET nightly_rate = 120.00, version = version + 1 WHERE id = 14 AND version = 1 RETURNING id, version;",
			],
			explanation:
				"The guard `version = 1` no longer matches, so zero rows are updated and RETURNING sends back nothing: the application must re-read the room (110.00, version 2) and decide again.\n\n**Pitfall:** ignoring the affected row count. An app that does not check for *0 rows* thinks the save worked.",
		},
		{
			id: "ch23-ex08",
			title: "Boss: The Last Room",
			story:
				"Combines an isolation level, a row lock and optimistic guards in one transaction.",
			prompt:
				"Room **14** has one bed and two bookings for the night of 22 March: confirmed booking **30** and pending booking **31**. Resolve the double booking. In **one transaction** at isolation level **REPEATABLE READ**:\n\n1. Lock room **14** with `SELECT ... FOR UPDATE`.\n2. Set booking **31** to **cancelled**, only if its status is still **pending**.\n3. Rebook its guest (guest **5**) in room **13**: ref `gen_random_uuid()`, stay `'[2026-03-22,2026-03-24)'`, status **confirmed**, created at **2026-03-15 12:00 UTC**.\n4. Increase the `version` of rooms **13** and **14** by 1, only where the version is still **1**, **returning** **id**, **version** and `current_setting('transaction_isolation')` as **level**.\n5. **COMMIT**.",
			difficulty: 5,
			kind: "transaction",
			concepts: ["row-locking", "optimistic-locking", "isolation-levels"],
			solutionSql:
				"BEGIN ISOLATION LEVEL REPEATABLE READ;\nSELECT id, version FROM rooms WHERE id = 14 FOR UPDATE;\nUPDATE bookings SET status = 'cancelled' WHERE id = 31 AND status = 'pending';\nINSERT INTO bookings (ref, room_id, guest_id, stay, status, created_at)\nVALUES (gen_random_uuid(), 13, 5, '[2026-03-22,2026-03-24)', 'confirmed', '2026-03-15 12:00:00+00');\nUPDATE rooms\nSET version = version + 1\nWHERE id IN (13, 14) AND version = 1\nRETURNING id, version, current_setting('transaction_isolation') AS level;\nCOMMIT;",
			check: {
				type: "result+state",
				verifySql:
					"SELECT 'booking' AS kind, id, concat_ws(',', room_id, guest_id, stay, status, created_at) AS detail FROM bookings\nUNION ALL\nSELECT 'room', id, concat_ws(',', nightly_rate, version) FROM rooms\nORDER BY 1, 2;",
			},
			hints: [
				"Seven statements: BEGIN with the level, the locking SELECT, the guarded UPDATE, the INSERT, the guarded UPDATE with RETURNING, COMMIT.",
				"Guards are extra WHERE conditions: `AND status = 'pending'`, `AND version = 1`.",
				"Step 4: UPDATE rooms SET version = version + 1 WHERE id IN (13, 14) AND version = 1 RETURNING id, version, current_setting('transaction_isolation') AS level;",
			],
			explanation:
				"The FOR UPDATE lock blocks other sessions from changing room 14 until COMMIT, the status guard makes sure booking 31 was not confirmed meanwhile, and the version guards make any stale editor of rooms 13 and 14 miss. Both rooms come back at version 2 under `repeatable read`, and the double booking is gone.\n\n**Pitfall:** taking the lock without BEGIN (it is released at once) or with a plain BEGIN (the level reads `read committed`). The real fix is a constraint that forbids overlapping stays, covered in *Bound by Time*.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch23-pr01",
			title: "Identify write skew",
			prompt:
				"A rule requires at least one staff member on duty. Two staff members are on duty, and each runs a transaction to go off duty, under **REPEATABLE READ**:\n\n| step | session A | session B |\n|---|---|---|\n| 1 | counts staff on duty: 2 | counts staff on duty: 2 |\n| 2 | sets its own row off duty | sets its own row off duty |\n| 3 | commits | commits |\n\nNobody is left on duty, though each decision looked safe. **Return** the name of this anomaly, choosing **exactly** one of: `dirty read`, `non-repeatable read`, `phantom read`, `lost update`, `write skew`.",
			difficulty: 2,
			kind: "query",
			concepts: ["isolation-levels"],
			solutionSql: "SELECT 'write skew' AS anomaly;",
			check: { type: "result" },
			hints: [
				"Did they overwrite the same row?",
				"Each changed a **different** row, based on a read the other's write made false.",
				"SELECT 'write skew';",
			],
			explanation:
				"**Write skew**: two transactions read the same facts, write different rows, and together break a rule. REPEATABLE READ does not catch it; SERIALIZABLE does (one of them gets 40001).\n\n**Pitfall:** calling it a lost update, which needs both sessions to write the **same** row.",
		},
		{
			id: "ch23-pr02",
			title: "Set the level after BEGIN",
			prompt:
				"Run `BEGIN;`, then set the level with `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;`, then **return** `current_setting('transaction_isolation')`, then **COMMIT**.",
			difficulty: 1,
			kind: "transaction",
			concepts: ["isolation-levels"],
			solutionSql:
				"BEGIN;\nSET TRANSACTION ISOLATION LEVEL REPEATABLE READ;\nSELECT current_setting('transaction_isolation');\nCOMMIT;",
			check: { type: "result" },
			hints: [
				"Four statements, in the order given.",
				"SET TRANSACTION must come before any query in the transaction.",
				"BEGIN; SET TRANSACTION ISOLATION LEVEL REPEATABLE READ; SELECT current_setting('transaction_isolation'); COMMIT;",
			],
			explanation:
				"`SET TRANSACTION` changes the level of the transaction just started, as long as no query ran yet.\n\n**Pitfall:** putting it after the first SELECT fails (25001): the snapshot is already taken.",
		},
		{
			id: "ch23-pr03",
			title: "Claim two pending bookings",
			prompt:
				"In **one UPDATE**, confirm the **two oldest pending** bookings (by `created_at`), chosen with `FOR UPDATE SKIP LOCKED`, and **return** their **id**s.",
			difficulty: 3,
			kind: "transaction",
			concepts: ["row-locking"],
			solutionSql:
				"UPDATE bookings\nSET status = 'confirmed'\nWHERE id IN (\n  SELECT id FROM bookings\n  WHERE status = 'pending'\n  ORDER BY created_at\n  LIMIT 2\n  FOR UPDATE SKIP LOCKED\n)\nRETURNING id;",
			check: { type: "result+state", verifySql: BOOKINGS_STATE },
			hints: [
				"Same pattern as *Claim the oldest pending booking*.",
				"Only the LIMIT changes.",
				"... ORDER BY created_at LIMIT 2 FOR UPDATE SKIP LOCKED) RETURNING id;",
			],
			explanation:
				"Bookings 28 and 31 are confirmed. Batch claiming keeps the queue fast; SKIP LOCKED keeps sessions from waiting on the same rows.\n\n**Pitfall:** `ORDER BY id` takes 19 and 23 instead.",
		},
		{
			id: "ch23-pr04",
			title: "Name the deadlock error",
			prompt:
				"Session A locks room 1, then asks for room 2. Session B locked room 2, then asks for room 1. Postgres detects that they wait for each other and cancels one transaction. **Return** the SQLSTATE it raises, as text, choosing **exactly** one of: `40001`, `40P01`, `55P03`, `25P02`.",
			difficulty: 2,
			kind: "query",
			concepts: ["row-locking"],
			solutionSql: "SELECT '40P01' AS sqlstate;",
			check: { type: "result" },
			hints: [
				"Two transactions waiting for each other forever: what is that called?",
				"40001 is a serialization failure, 55P03 is a NOWAIT lock failure.",
				"SELECT '40P01';",
			],
			explanation:
				"40P01 is **deadlock detected**. The victim must retry; the cure is to always lock rooms in the same order (for example by id).\n\n**Pitfall:** 40001 also means \"retry\", but it comes from SERIALIZABLE checks, not from lock waits.",
		},
		{
			id: "ch23-pr05",
			title: "Atomic surcharge with RETURNING",
			prompt:
				"In **one UPDATE**, add **10.00** to the `nightly_rate` of the **Moonlit Loft** (room 3) from its current value and bump its `version` by 1. **Return** the new **nightly_rate** and **version**.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["optimistic-locking"],
			solutionSql:
				"UPDATE rooms\nSET nightly_rate = nightly_rate + 10.00, version = version + 1\nWHERE id = 3\nRETURNING nightly_rate, version;",
			check: { type: "result+state", verifySql: ROOMS_STATE },
			hints: [
				"Compute from the column, not from a number you read before.",
				"Two assignments in SET.",
				"SET nightly_rate = nightly_rate + 10.00, version = version + 1 WHERE id = 3 RETURNING nightly_rate, version;",
			],
			explanation:
				"130.00 at version 2. The addition happens on the current row inside one statement, so a concurrent surcharge would stack instead of vanishing.\n\n**Pitfall:** reading 120.00 in the app and writing 130.00 back: correct alone, a lost update under load.",
		},
		{
			id: "ch23-pr06",
			title: "Retry an optimistic update",
			prompt:
				"Room **9** (the Jaguar Lodge) was read at **version 1**. Another session then changed it to **version 2**, so the guarded update with version 1 returned no row, and the room was re-read. Write the **retry**: set room **9**'s rate to **280.00** and bump its version, guarded by the re-read version (**2**). **Return** **id** and **version**.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["optimistic-locking"],
			setupSql: "UPDATE rooms SET nightly_rate = 270.00, version = 2 WHERE id = 9;",
			solutionSql:
				"UPDATE rooms\nSET nightly_rate = 280.00, version = version + 1\nWHERE id = 9 AND version = 2\nRETURNING id, version;",
			check: { type: "result+state", verifySql: ROOMS_STATE },
			hints: [
				"Same optimistic UPDATE, with the fresh version.",
				"WHERE id = 9 AND version = 2",
				"UPDATE rooms SET nightly_rate = 280.00, version = version + 1 WHERE id = 9 AND version = 2 RETURNING id, version;",
			],
			explanation:
				"The retry succeeds: version 3. Optimistic locking is a loop: read, decide, write with the guard, and on zero rows read again.\n\n**Pitfall:** retrying blindly without the guard. Then the retry itself can overwrite a third session.",
		},
	],
};

export default chapter;
