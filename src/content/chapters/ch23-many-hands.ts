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
	subtitle: "Two clerks, one Last Room: isolation, locks and lost updates",
	emoji: "👥",
	datasetId: "inn",
	concepts: ["isolation-levels", "row-locking", "optimistic-locking"],
	prerequisites: ["ch21-the-pact"],
	lesson: [
		{
			kind: "explain",
			title: "Two clerks, one ledger",
			body: "The Wandering Star Inn has two clerks, **Brom** and **Nell**, and one database. When they work at the same moment, strange things happen:\n\n- a value changes between two reads (**non-repeatable read**),\n- new rows appear in a repeated query (**phantom read**),\n- one clerk's write erases the other's (**lost update**),\n- two valid decisions add up to a broken rule (**write skew**).\n\nThis sandbox has a single session, so races are shown as **timelines**.",
		},
		{
			kind: "explain",
			title: "Isolation levels",
			body: "| level | what a transaction sees |\n|---|---|\n| READ COMMITTED (default) | a fresh snapshot **per statement** |\n| REPEATABLE READ | one snapshot for the **whole transaction** |\n| SERIALIZABLE | as if transactions ran one after another; may fail with **40001** |\n\nPostgres never shows uncommitted data: READ UNCOMMITTED behaves like READ COMMITTED. Choose with `BEGIN ISOLATION LEVEL REPEATABLE READ;`.",
		},
		{
			kind: "quiz",
			question:
				"Default level. Brom: `BEGIN; SELECT nightly_rate FROM rooms WHERE id = 14;` → 99.99. Nell: `UPDATE rooms SET nightly_rate = 120.00 WHERE id = 14;` (autocommit). Brom runs the same SELECT again, still inside his transaction. What does he see?",
			choices: [
				"99.99, because his transaction started before Nell's change",
				"120.00: under READ COMMITTED every statement sees the latest committed data",
				"An error 40001",
				"Nothing: the row is locked by Nell",
			],
			answerIndex: 1,
			explanation:
				"That is a **non-repeatable read**: same query, same transaction, different answer. Under REPEATABLE READ, Brom would keep seeing 99.99 until he ends his transaction.",
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
				"Brom and Nell both run SERIALIZABLE transactions that conflict. Nell commits first; Brom's COMMIT fails with SQLSTATE 40001. What should the application do?",
			choices: [
				"Show an error page: the data is corrupted",
				"Retry Brom's whole transaction from its BEGIN",
				"Re-run only Brom's last statement",
				"Switch to READ UNCOMMITTED to avoid conflicts",
			],
			answerIndex: 1,
			explanation:
				"40001 (*serialization failure*) means \"try again\": nothing was written, and a fresh attempt sees Nell's work. SERIALIZABLE is safe only with a **retry loop** around the whole transaction.",
		},
		{
			kind: "explain",
			title: "Pessimistic locks",
			body: "`SELECT ... FOR UPDATE` locks the rows it returns **until the transaction ends**: anyone else trying to lock or change them waits. Outside BEGIN, the lock is released at once, so it protects nothing.\n\n- `SKIP LOCKED` skips rows locked by others: perfect for work queues.\n- Two clerks locking rooms 1 then 2, and 2 then 1, wait for each other forever: Postgres kills one with **40P01** (deadlock). Always lock in the same order.\n- `pg_try_advisory_lock(14)` locks an *idea* (a number), not a row; a session advisory lock survives COMMIT until you unlock it.",
		},
		{
			kind: "example",
			title: "Taking a ticket from the queue",
			body: "Each clerk claims the oldest pending booking. With SKIP LOCKED, a second clerk running the same query at the same time would get the next one instead of waiting.",
			sql: "BEGIN;\nSELECT id, room_id, created_at\nFROM bookings\nWHERE status = 'pending'\nORDER BY created_at\nLIMIT 1\nFOR UPDATE SKIP LOCKED;\nCOMMIT;",
		},
		{
			kind: "explain",
			title: "Optimistic locking",
			body: "No lock while the clerk thinks: remember the row's `version`, then write only if nobody changed it meanwhile:\n```sql\nUPDATE rooms\nSET nightly_rate = 120.00, version = version + 1\nWHERE id = 14 AND version = 1\nRETURNING id, version;\n```\nOne row back: you won. **No row back**: someone was faster. Re-read the row and decide again.",
		},
		{
			kind: "quiz",
			question:
				"Both clerks add a 5.00 surcharge to room 14 at the same time. Which version can lose one surcharge?",
			choices: [
				"`SELECT nightly_rate ...` in the app, compute 104.99, then `UPDATE rooms SET nightly_rate = 104.99 WHERE id = 14`",
				"`UPDATE rooms SET nightly_rate = nightly_rate + 5 WHERE id = 14`",
				"Both are safe",
				"Both lose updates",
			],
			answerIndex: 0,
			explanation:
				"Read-modify-write in the application: both clerks read 99.99, both write 104.99, one surcharge vanishes (**lost update**). `SET x = x + 5` reads and writes in one statement on the latest version of the row, so the second clerk adds on top of the first.",
		},
		{
			kind: "try",
			title: "Your turn: an atomic surcharge",
			prompt:
				"In **one UPDATE**, raise **The Last Room** (room 14)'s `nightly_rate` by **5.00** from its current value and increase its `version` by **1**.",
			starterSql: "UPDATE rooms\nSET nightly_rate = 104.99\nWHERE id = 14;",
			solutionSql:
				"UPDATE rooms SET nightly_rate = nightly_rate + 5.00, version = version + 1 WHERE id = 14;",
			check: { type: "state", verifySql: ROOMS_STATE },
			hints: [
				"The starter hard-codes a number that someone read earlier, and forgets the version.",
				"SET nightly_rate = nightly_rate + 5.00, version = version + 1",
			],
		},
	],
	exercises: [
		{
			id: "ch23-ex01",
			title: "The strictest level",
			story: "The innkeeper wants the night audit to run at the safest isolation level.",
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
			title: "Name that anomaly",
			story: "Brom prepares the evening report of pending bookings, while Nell takes a call.",
			prompt:
				"Under **READ COMMITTED**:\n\n| step | Brom | Nell |\n|---|---|---|\n| 1 | `BEGIN;` | |\n| 2 | `SELECT count(*) FROM bookings WHERE status = 'pending';` | |\n| 3 | | `INSERT INTO bookings ... status 'pending'` and commit |\n| 4 | same count again | |\n\nBrom's second count is one higher. **Return** the name of this anomaly as a one-row, one-column result, choosing **exactly** one of: `dirty read`, `non-repeatable read`, `phantom read`, `lost update`, `write skew`.",
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
				"A **phantom read**: no row Brom saw was modified, but a new row now matches his condition. READ COMMITTED takes a new snapshot per statement, so the second count sees Nell's insert.\n\n**Pitfall:** calling it a non-repeatable read, which is about an *existing* row whose values changed.",
		},
		{
			id: "ch23-ex03",
			title: "Frozen in time",
			story: "Same evening, but Brom learned his lesson and starts the report with `BEGIN ISOLATION LEVEL REPEATABLE READ;`.",
			prompt:
				"Replay the timeline of *Name that anomaly* under **REPEATABLE READ**, starting from today's data. **Return** one number: the count Brom's **second** query shows. (Tip: run his first count yourself.)",
			difficulty: 3,
			kind: "query",
			concepts: ["isolation-levels"],
			solutionSql: "SELECT count(*) FROM bookings WHERE status = 'pending';",
			check: { type: "result" },
			hints: [
				"First, how many pending bookings are there right now?",
				"Under REPEATABLE READ, Brom's whole transaction reads the snapshot taken at his first query.",
				"Same count as the first one: SELECT count(*) FROM bookings WHERE status = 'pending';",
			],
			explanation:
				"5, both times: the snapshot is frozen at Brom's first query, so Nell's committed insert stays invisible until he ends his transaction. His report is consistent, just not the very latest.\n\n**Pitfall:** answering 6. That is what READ COMMITTED would show.",
		},
		{
			id: "ch23-ex04",
			title: "Next in the queue",
			story:
				"The two clerks process pending bookings at the same time. Each must grab a different one, and never wait for the other.",
			prompt:
				"In **one UPDATE**, set the status of the **oldest pending** booking (smallest `created_at`) to **confirmed**, choosing it with a subquery that uses `FOR UPDATE SKIP LOCKED`. **Return** its **id**.",
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
				"Booking 28 (made 2026-03-10) is confirmed. The subquery locks the row it picks; a second clerk running the same statement would skip it and take 31.\n\n**Pitfall:** `ORDER BY id` picks booking 19, which is not the oldest: ids say nothing about time.",
		},
		{
			id: "ch23-ex05",
			title: "The key to The Last Room",
			story:
				"Before touching The Last Room's paperwork, a clerk takes the advisory lock number 14. Last week someone forgot to release it and the desk froze for an hour.",
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
				"`pg_try_advisory_lock` returns true when it got the lock (false instead of waiting if someone else holds it); `pg_advisory_unlock` returns true when it released one.\n\n**Pitfall:** forgetting the unlock. A session lock outlives the transaction and blocks every other clerk until the connection closes. `pg_advisory_xact_lock` releases itself at COMMIT.",
		},
		{
			id: "ch23-ex06",
			title: "Brom's new rate",
			story:
				"Brom opened The Last Room's card a minute ago: rate 99.99, **version 1**. He decides on 120.00.",
			prompt:
				"Set room **14**'s `nightly_rate` to **120.00** and increase its `version` by 1, **only if** its version is still **1**. **Return** its **id** and new **version**.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["optimistic-locking"],
			solutionSql:
				"UPDATE rooms\nSET nightly_rate = 120.00, version = version + 1\nWHERE id = 14 AND version = 1\nRETURNING id, version;",
			check: { type: "result+state", verifySql: ROOMS_STATE },
			hints: [
				"The version Brom read becomes part of the WHERE.",
				"Bump the version in the same SET.",
				"... WHERE id = 14 AND version = 1 RETURNING id, version;",
			],
			explanation:
				"Nobody touched the room, so the guard holds: one row comes back with version 2, and anyone still holding version 1 will now miss.\n\n**Pitfall:** forgetting `version = version + 1`. The next stale writer would still find version 1 and overwrite Brom.",
		},
		{
			id: "ch23-ex07",
			title: "Nell was faster",
			story:
				"While Brom was thinking, Nell set The Last Room to 110.00 and bumped it to **version 2**. Brom's screen still shows version 1, and his UPDATE is about to erase Nell's work.",
			prompt:
				"Rewrite Brom's UPDATE as an **optimistic** update based on the version he read (**1**): rate **120.00**, version + 1, returning **id** and **version**. Since Nell already changed the room, it must change **nothing** and return **no row**.",
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
				"Run the starter: Nell's 110.00 is gone, and nobody will ever know.",
				"Add the version Brom read to the WHERE, and bump it in the SET.",
				"... SET nightly_rate = 120.00, version = version + 1 WHERE id = 14 AND version = 1 RETURNING id, version;",
			],
			explanation:
				"The guard `version = 1` no longer matches, so zero rows are updated and RETURNING sends back nothing: Brom's app must re-read the room (110.00, version 2) and ask him again.\n\n**Pitfall:** ignoring the affected row count. An app that does not check for *0 rows* thinks the save worked.",
		},
		{
			id: "ch23-ex08",
			title: "Boss: The Last Room",
			story:
				"The Last Room has one bed and two bookings for the night of 22 March: Kenji's confirmed booking 30 and Odo's pending booking 31. The innkeeper settles it, locks first, guards everywhere.",
			prompt:
				"In **one transaction** at isolation level **REPEATABLE READ**:\n\n1. Lock room **14** with `SELECT ... FOR UPDATE`.\n2. Set booking **31** to **cancelled**, only if its status is still **pending**.\n3. Rebook its guest (guest **5**) in room **13**: ref `gen_random_uuid()`, stay `'[2026-03-22,2026-03-24)'`, status **confirmed**, created at **2026-03-15 12:00 UTC**.\n4. Increase the `version` of rooms **13** and **14** by 1, only where the version is still **1**, **returning** **id**, **version** and `current_setting('transaction_isolation')` as **level**.\n5. **COMMIT**.",
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
				"The FOR UPDATE lock keeps other clerks off room 14 until COMMIT, the status guard makes sure Odo had not been confirmed meanwhile, and the version guards make any stale editor of rooms 13 and 14 miss. Both rooms come back at version 2 under `repeatable read`, and the double booking is gone.\n\n**Pitfall:** taking the lock without BEGIN (it is released at once) or with a plain BEGIN (the level reads `read committed`). The real cure is a constraint that forbids overlapping stays: see *Bound by Time*.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch23-pr01",
			title: "The empty night desk",
			story:
				"Rule of the inn: at least one night clerk stays on duty. Brom and Nell are both on duty and both want to leave.",
			prompt:
				"Under **REPEATABLE READ**:\n\n| step | Brom | Nell |\n|---|---|---|\n| 1 | counts clerks on duty: 2 | counts clerks on duty: 2 |\n| 2 | marks himself off duty | marks herself off duty |\n| 3 | commits | commits |\n\nNobody is left on duty, though each decision looked safe. **Return** the name of this anomaly, choosing **exactly** one of: `dirty read`, `non-repeatable read`, `phantom read`, `lost update`, `write skew`.",
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
				"**Write skew**: two transactions read the same facts, write different rows, and together break a rule. REPEATABLE READ does not catch it; SERIALIZABLE does (one of them gets 40001).\n\n**Pitfall:** calling it a lost update, which needs both clerks to write the **same** row.",
		},
		{
			id: "ch23-pr02",
			title: "Level after BEGIN",
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
			title: "Two at a time",
			prompt:
				"In **one UPDATE**, confirm the **two oldest pending** bookings (by `created_at`), chosen with `FOR UPDATE SKIP LOCKED`, and **return** their **id**s.",
			difficulty: 3,
			kind: "transaction",
			concepts: ["row-locking"],
			solutionSql:
				"UPDATE bookings\nSET status = 'confirmed'\nWHERE id IN (\n  SELECT id FROM bookings\n  WHERE status = 'pending'\n  ORDER BY created_at\n  LIMIT 2\n  FOR UPDATE SKIP LOCKED\n)\nRETURNING id;",
			check: { type: "result+state", verifySql: BOOKINGS_STATE },
			hints: [
				"Same pattern as *Next in the queue*.",
				"Only the LIMIT changes.",
				"... ORDER BY created_at LIMIT 2 FOR UPDATE SKIP LOCKED) RETURNING id;",
			],
			explanation:
				"Bookings 28 and 31 are confirmed. Batch claiming keeps the queue fast; SKIP LOCKED keeps clerks from fighting over the same rows.\n\n**Pitfall:** `ORDER BY id` takes 19 and 23 instead.",
		},
		{
			id: "ch23-pr04",
			title: "Crossed keys",
			prompt:
				"Brom locks room 1, then asks for room 2. Nell locked room 2, then asks for room 1. Postgres detects that they wait for each other and cancels one transaction. **Return** the SQLSTATE it raises, as text, choosing **exactly** one of: `40001`, `40P01`, `55P03`, `25P02`.",
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
			title: "A surcharge that never gets lost",
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
			title: "Read again, try again",
			story:
				"Brom read the Jaguar Lodge (room 9) at **version 1** and wants it at 280.00. Meanwhile Nell changed it: it is now at **version 2**. His guarded update with version 1 came back empty, so he re-read the room.",
			prompt:
				"Write Brom's **retry**: set room **9**'s rate to **280.00** and bump its version, guarded by the version he just re-read (**2**). **Return** **id** and **version**.",
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
				"The retry succeeds: version 3. Optimistic locking is a loop: read, decide, write with the guard, and on zero rows read again.\n\n**Pitfall:** retrying blindly without the guard. Then the retry itself can overwrite a third clerk.",
		},
	],
};

export default chapter;
