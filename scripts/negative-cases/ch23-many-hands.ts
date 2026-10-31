// Negative and accept cases for ch23-many-hands.
import type { CaseSet } from "../validate-content";

const BOSS = (opts: { begin?: string; cancel?: string; versionGuard?: string } = {}) =>
	`${opts.begin ?? "BEGIN ISOLATION LEVEL REPEATABLE READ"}; SELECT id, version FROM rooms WHERE id = 14 FOR UPDATE; ${opts.cancel ?? "UPDATE bookings SET status = 'cancelled' WHERE id = 31 AND status = 'pending';"} INSERT INTO bookings (ref, room_id, guest_id, stay, status, created_at) VALUES (gen_random_uuid(), 13, 5, '[2026-03-22,2026-03-24)', 'confirmed', '2026-03-15 12:00:00+00'); UPDATE rooms SET version = version + 1 WHERE id IN (13, 14) ${opts.versionGuard ?? "AND version = 1"} RETURNING id, version, current_setting('transaction_isolation') AS level; COMMIT;`;

const cases: Record<string, CaseSet> = {
	"ch23-many-hands/lesson-9": {
		reject: [
			{ sql: "UPDATE rooms SET nightly_rate = nightly_rate + 5.00 WHERE id = 14;", why: "version not bumped" },
			{ sql: "UPDATE rooms SET nightly_rate = nightly_rate + 5.00, version = version + 1;", why: "every room changed" },
		],
		accept: ["UPDATE rooms SET version = version + 1, nightly_rate = nightly_rate + 5 WHERE name = 'The Last Room';"],
	},
	"ch23-ex01": {
		reject: [
			{ sql: "BEGIN; SELECT current_setting('transaction_isolation') AS level; COMMIT;", why: "default level is read committed" },
			{ sql: "BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT current_setting('transaction_isolation') AS level; COMMIT;", why: "wrong level" },
		],
		accept: [
			"START TRANSACTION ISOLATION LEVEL SERIALIZABLE; SELECT current_setting('transaction_isolation'); COMMIT;",
			"BEGIN; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE; SELECT current_setting('transaction_isolation') AS level; COMMIT;",
		],
	},
	"ch23-ex02": {
		reject: [
			{ sql: "SELECT 'non-repeatable read';", why: "no existing row changed" },
			{ sql: "SELECT 'Phantom Read';", why: "must be one of the listed strings exactly" },
		],
		accept: ["SELECT 'phantom read' AS answer;"],
	},
	"ch23-ex03": {
		reject: [{ sql: "SELECT 6;", why: "that is the READ COMMITTED answer" }],
		accept: ["SELECT 5 AS second_count;"],
	},
	"ch23-ex04": {
		reject: [
			{ sql: "UPDATE bookings SET status = 'confirmed' WHERE id IN (SELECT id FROM bookings WHERE status = 'pending' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id;", why: "oldest by id, not by time (19)" },
			{ sql: "UPDATE bookings SET status = 'confirmed' WHERE status = 'pending' RETURNING id;", why: "confirms every pending booking" },
		],
		accept: [
			"UPDATE bookings b SET status = 'confirmed' WHERE b.id = (SELECT id FROM bookings WHERE status = 'pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING b.id;",
			"BEGIN; UPDATE bookings SET status = 'confirmed' WHERE id IN (SELECT id FROM bookings WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id; COMMIT;",
		],
	},
	"ch23-ex05": {
		reject: [{ sql: "SELECT pg_try_advisory_lock(14); SELECT pg_try_advisory_lock(14) AS released;", why: "lock taken twice, never released" }],
		accept: [
			"SELECT pg_try_advisory_lock(14); SELECT pg_advisory_unlock(14);",
			"SELECT pg_try_advisory_lock(14) AS got; SELECT pg_advisory_unlock_all(); SELECT true AS released;",
		],
	},
	"ch23-ex06": {
		reject: [
			{ sql: "UPDATE rooms SET nightly_rate = 120.00 WHERE id = 14 AND version = 1 RETURNING id, version;", why: "version not bumped" },
			{ sql: "UPDATE rooms SET nightly_rate = 120.00, version = version + 1 WHERE version = 1 RETURNING id, version;", why: "every room at version 1 changed" },
		],
		accept: ["UPDATE rooms SET version = version + 1, nightly_rate = 120 WHERE id = 14 AND version = 1 RETURNING rooms.id, rooms.version;"],
	},
	"ch23-ex07": {
		reject: [
			{ sql: "UPDATE rooms SET nightly_rate = 120.00, version = version + 1 WHERE id = 14 RETURNING id, version;", why: "no version guard: overwrites Nell" },
			{ sql: "UPDATE rooms SET nightly_rate = 120.00, version = version + 1 WHERE id = 14 AND version = 2 RETURNING id, version;", why: "guard on Nell's version instead of the one Brom read" },
		],
		accept: ["UPDATE rooms SET version = version + 1, nightly_rate = 120.00 WHERE id = 14 AND version = 1 RETURNING id, version;"],
	},
	"ch23-ex08": {
		reject: [
			{ sql: BOSS({ begin: "BEGIN" }), why: "plain BEGIN: level is read committed" },
			{ sql: BOSS({ cancel: "" }), why: "booking 31 not cancelled" },
			{ sql: BOSS({ versionGuard: "AND version = 2" }), why: "version guard never matches: nothing bumped" },
		],
		accept: [
			"START TRANSACTION ISOLATION LEVEL REPEATABLE READ; SELECT * FROM rooms WHERE id = 14 FOR UPDATE; UPDATE bookings SET status = 'cancelled' WHERE id = 31 AND status = 'pending'; INSERT INTO bookings (ref, room_id, guest_id, stay, status, created_at) VALUES (gen_random_uuid(), 13, 5, daterange('2026-03-22', '2026-03-24'), 'confirmed', timestamptz '2026-03-15 12:00 UTC'); UPDATE rooms SET version = version + 1 WHERE id IN (14, 13) AND version = 1 RETURNING id, version, current_setting('transaction_isolation'); COMMIT;",
		],
	},
	"ch23-pr01": {
		reject: [{ sql: "SELECT 'lost update';", why: "they wrote different rows" }],
	},
	"ch23-pr02": {
		reject: [{ sql: "BEGIN; SELECT current_setting('transaction_isolation'); COMMIT;", why: "level never set" }],
		accept: ["BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT current_setting('transaction_isolation'); COMMIT;"],
	},
	"ch23-pr03": {
		reject: [{ sql: "UPDATE bookings SET status = 'confirmed' WHERE id IN (SELECT id FROM bookings WHERE status = 'pending' ORDER BY id LIMIT 2 FOR UPDATE SKIP LOCKED) RETURNING id;", why: "ordered by id: 19 and 23" }],
	},
	"ch23-pr04": {
		reject: [{ sql: "SELECT '40001';", why: "serialization failure, not deadlock" }],
	},
	"ch23-pr05": {
		reject: [{ sql: "UPDATE rooms SET nightly_rate = nightly_rate + 10.00 WHERE id = 3 RETURNING nightly_rate, version;", why: "version not bumped" }],
	},
	"ch23-pr06": {
		reject: [{ sql: "UPDATE rooms SET nightly_rate = 280.00, version = version + 1 WHERE id = 9 AND version = 1 RETURNING id, version;", why: "stale guard: nothing updated" }],
	},
};

export default cases;
