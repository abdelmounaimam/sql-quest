import type { CaseSet } from "../validate-content";

const cases: Record<string, CaseSet> = {
	"ch29-precise-measures/lesson-9": {
		reject: [{ sql: "SELECT name, round(nightly_rate) * 7 FROM rooms WHERE realm_id = 1;", why: "rounds before multiplying" }],
		accept: ["SELECT name, 7 * nightly_rate AS price FROM rooms WHERE realm_id = 1"],
	},
	"ch29-ex01": {
		reject: [
			{ sql: "SELECT name, nightly_rate * 100 AS cents FROM rooms;", why: "numeric cents, not an integer (strictTypes)" },
			{ sql: "SELECT name, nightly_rate::int * 100 FROM rooms;", why: "casts (rounds) before multiplying" },
			{ sql: "SELECT name, nightly_rate FROM rooms;", why: "not in cents" },
		],
		accept: ["SELECT name, CAST(nightly_rate * 100 AS integer) FROM rooms", "SELECT name, (100 * nightly_rate)::bigint AS c FROM rooms"],
	},
	"ch29-ex02": {
		reject: [
			{ sql: "SELECT name, (beds * 1000000000)::bigint FROM rooms;", why: "cast after the int overflow" },
			{ sql: "SELECT name, beds * 100000000 FROM rooms;", why: "wrong factor to dodge the overflow" },
		],
		accept: ["SELECT name, beds * 1000000000::bigint FROM rooms;", "SELECT name, beds::numeric * 1000000000 FROM rooms;", "SELECT name, beds * 1e9 FROM rooms;"],
	},
	"ch29-ex03": {
		reject: [
			{ sql: "SELECT id, amount, amount_float FROM payments WHERE round(amount_float::numeric, 2) <> amount;", why: "rounding hides the drift of 14 and 15" },
			{ sql: "SELECT id, amount, amount_float FROM payments WHERE amount_float::numeric(10,2) <> amount;", why: "the numeric(10,2) cast rounds the drift away" },
		],
		accept: ["SELECT id, amount, amount_float FROM payments WHERE amount_float::numeric <> amount;", "SELECT id, amount, amount_float FROM payments WHERE amount_float <> amount;"],
	},
	"ch29-ex04": {
		reject: [
			{ sql: "SELECT id, amount_float::numeric = amount FROM payments WHERE booking_id = 13;", why: "exact equality again" },
			{ sql: "SELECT id, abs(amount_float - amount::float8) < 0.01 FROM payments WHERE booking_id = 13;", why: "a whole cent of tolerance hides payment 16" },
		],
		accept: [
			"SELECT id, round(amount_float::numeric, 2) = amount AS matches FROM payments WHERE booking_id = 13;",
			"SELECT id, abs(amount - amount_float::numeric) < 0.005 FROM payments WHERE booking_id = 13;",
		],
	},
	"ch29-ex05": {
		reject: [
			{ sql: "SELECT booking_id, currency, sum(amount), sum(round(amount * 0.077, 2)) FROM payments GROUP BY booking_id, currency;", why: "rounds every line before summing" },
			{ sql: "SELECT booking_id, currency, sum(amount), sum(amount) * 0.077 FROM payments GROUP BY booking_id, currency;", why: "never rounded" },
		],
		accept: ["SELECT booking_id, min(currency), sum(amount) AS total, round(0.077 * sum(amount), 2) FROM payments GROUP BY booking_id;"],
	},
	"ch29-ex06": {
		reject: [{ sql: "SELECT id, amount FROM payments WHERE currency LIKE 'G';", why: "pattern still wrong" }],
		accept: [
			"SELECT id, amount FROM payments WHERE rtrim(currency) = 'GP';",
			"SELECT id, amount FROM payments WHERE currency LIKE 'GP%';",
			"SELECT id, amount FROM payments WHERE currency::text = 'GP';",
		],
	},
	"ch29-ex07": {
		reject: [
			{ sql: "SELECT name FROM guests WHERE vip = false;", why: "drops the unknown guests" },
			{ sql: "SELECT name FROM guests WHERE NOT vip;", why: "NOT NULL is unknown" },
			{ sql: "SELECT name FROM guests WHERE vip IS NOT FALSE;", why: "inverted" },
		],
		accept: [
			"SELECT name FROM guests WHERE NOT coalesce(vip, false);",
			"SELECT name FROM guests WHERE vip = false OR vip IS NULL;",
			"SELECT name FROM guests WHERE vip IS DISTINCT FROM true;",
		],
	},
	"ch29-ex08": {
		reject: [{ sql: "SELECT id, status FROM bookings WHERE ref::text LIKE '90B0%';", why: "text comparison is case sensitive" }],
		accept: [
			"SELECT id, status FROM bookings WHERE ref = '90B09014-2CC2-DB0D-6908-65C1BDF46884'::uuid;",
			"SELECT id, status FROM bookings WHERE ref::text = lower('90B09014-2CC2-DB0D-6908-65C1BDF46884');",
		],
	},
	"ch29-ex09": {
		reject: [
			{
				sql: "CREATE TABLE ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id int NOT NULL, amount numeric(10,2) NOT NULL, currency text NOT NULL, settled boolean NOT NULL DEFAULT false); INSERT INTO ledger (booking_id, amount, currency, settled) SELECT booking_id, amount, rtrim(currency), method = 'card' FROM payments;",
				why: "version 4 ids instead of uuidv7",
			},
			{
				sql: "CREATE TABLE ledger (id uuid PRIMARY KEY DEFAULT uuidv7(), booking_id int NOT NULL, amount numeric(10,2) NOT NULL, currency char(3) NOT NULL, settled boolean NOT NULL DEFAULT false); INSERT INTO ledger (booking_id, amount, currency, settled) SELECT booking_id, amount, currency, method = 'card' FROM payments;",
				why: "currency kept as padded char(3)",
			},
			{
				sql: "CREATE TABLE ledger (id uuid PRIMARY KEY DEFAULT uuidv7(), booking_id int NOT NULL, amount double precision NOT NULL, currency text NOT NULL, settled boolean NOT NULL DEFAULT false); INSERT INTO ledger (booking_id, amount, currency, settled) SELECT booking_id, amount_float, rtrim(currency), method = 'card' FROM payments;",
				why: "floats for money",
			},
			{
				sql: "CREATE TABLE ledger (id uuid PRIMARY KEY DEFAULT uuidv7(), booking_id int NOT NULL, amount numeric(10,2) NOT NULL, currency text NOT NULL, settled boolean DEFAULT false); INSERT INTO ledger (booking_id, amount, currency, settled) SELECT booking_id, amount, rtrim(currency), method = 'card' FROM payments;",
				why: "settled may be NULL",
			},
		],
		accept: [
			"CREATE TABLE ledger (id uuid DEFAULT uuidv7() PRIMARY KEY, booking_id integer NOT NULL, amount numeric(10,2) NOT NULL, currency text NOT NULL, settled bool NOT NULL DEFAULT false); INSERT INTO ledger (booking_id, amount, currency, settled) SELECT booking_id, amount, currency::text, method = 'card' FROM payments;",
			"CREATE TABLE ledger (id uuid NOT NULL DEFAULT uuidv7(), booking_id int NOT NULL, amount numeric(10,2) NOT NULL, currency text NOT NULL, settled boolean NOT NULL DEFAULT false, PRIMARY KEY (id)); INSERT INTO ledger (booking_id, amount, currency, settled) SELECT booking_id, amount, trim(currency), CASE WHEN method = 'card' THEN true ELSE false END FROM payments;",
		],
	},
	"ch29-pr03": {
		reject: [{ sql: "SELECT 0.1 + 0.2 = 0.3, 0.1::float8 + 0.2::float8 = 0.3;", why: "columns swapped" }],
	},
	"ch29-pr05": {
		reject: [{ sql: "SELECT currency, sum(amount) FROM payments GROUP BY 1;", why: "padded GP " }],
		accept: ["SELECT currency::text, sum(amount) FROM payments GROUP BY currency;"],
	},
};

export default cases;
