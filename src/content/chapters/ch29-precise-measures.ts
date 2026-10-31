import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch29-precise-measures",
	order: 29,
	world: "The Alchemist's Vault",
	tier: "apprentice",
	track: "types",
	title: "Precise Measures",
	subtitle: "Exact money, treacherous floats, padded text and ids that never collide",
	emoji: "⚗️",
	datasetId: "inn",
	concepts: [
		"numeric-types",
		"floating-point",
		"money-handling",
		"text-types",
		"boolean-type",
		"uuid-type",
	],
	prerequisites: ["ch24-laying-foundations"],
	lesson: [
		{
			kind: "explain",
			title: "The bookkeeper's scales",
			body: "The Wandering Star Inn's bookkeeper weighs every coin. Pick the right scale:\n\n| type | holds |\n|---|---|\n| `smallint` | up to 32 767 |\n| `int` | up to 2 147 483 647 |\n| `bigint` | up to 9.2 quintillion |\n| `numeric(p, s)` | exact decimals: p digits, s after the point |\n\nGo past the limit and Postgres refuses with **22003** (out of range). Nothing is silently wrapped around.",
		},
		{
			kind: "example",
			title: "Casts round, scales clamp",
			body: "`bigint` has room to spare. Casting a decimal to `int` **rounds** (65.50 becomes 66), and `numeric(5,2)` rounds to 2 decimals on the way in.",
			sql: "SELECT 2147483647::bigint + 1 AS big,\n       65.50::int AS rounded,\n       1.005::numeric(5,2) AS two_decimals;",
		},
		{
			kind: "explain",
			title: "Floats are approximate",
			body: "`real` and `double precision` store **binary** fractions. Most decimals, like 0.1, have no exact binary form, so tiny errors creep in and add up.\n\nRules of the vault:\n- never test floats with `=`; compare with a tolerance: `abs(a - b) < 0.000001`\n- never store money in a float\n\nThe inn's old `payments.amount_float` column is a cautionary tale.",
		},
		{
			kind: "example",
			title: "The tip that would not add up",
			body: "Payments 17 and 18 are tips of 0.10 and 0.20. The exact column says 0.30. The legacy float column says something else, and `= 0.3` is **false**.",
			sql: "SELECT sum(amount) AS exact,\n       sum(amount_float)::text AS drifting,\n       sum(amount_float) = 0.3 AS equals_point_three\nFROM payments\nWHERE id IN (17, 18);",
		},
		{
			kind: "quiz",
			question: "Which type should hold `rooms.nightly_rate` (a price with cents)?",
			choices: [
				"`real`, it is small and fast",
				"`money`, the name says it all",
				"`numeric(8,2)`",
				"`text`, so nothing gets rounded",
			],
			answerIndex: 2,
			explanation:
				"`numeric(8,2)` is exact to the cent. `real` drifts, `money` depends on a locale setting and rounds products to 2 decimals behind your back (`1::money * 3.333` is `$3.33`), and `text` cannot be summed or checked.",
		},
		{
			kind: "explain",
			title: "Money, the right way",
			body: "Store money as `numeric` **plus a currency column**, and never add two currencies together.\n\nRound **once**, on the final total:\n```sql\nround(sum(amount) * 0.077, 2)   -- good\nsum(round(amount * 0.077, 2))   -- drifts\n```\nRounding every line first adds up the rounding errors, and the cents stop matching the bank's.",
		},
		{
			kind: "explain",
			title: "text, varchar(n), char(n)",
			body: "Prefer **text**. `varchar(n)` adds a length limit (22001 on insert when too long). `char(n)` **pads with spaces**: the currency `GP` is stored as `'GP '`.\n\nPadding is sneaky: `currency = 'GP'` ignores it, `length(currency)` hides it, but `LIKE 'GP'` and `octet_length` see it.",
		},
		{
			kind: "explain",
			title: "Booleans and UUIDs",
			body: "A `boolean` holds true, false **or NULL**. Write `WHERE vip`, and `WHERE vip IS NOT TRUE` for *not VIP, unknown included*.\n\nA `uuid` is a 128-bit id: `gen_random_uuid()` makes a random version 4, `uuidv7()` (PG18) a **time ordered** version 7, kinder to indexes. Store them as `uuid`, never as text: the type accepts upper case, missing dashes and braces as the same value.",
		},
		{
			kind: "example",
			title: "Where did the version go?",
			body: "Booking refs were forged from md5 hashes, so they carry no valid version: `uuid_extract_version` returns NULL. A fresh `uuidv7()` says 7 (its value changes on every run).",
			sql: "SELECT id, ref, uuid_extract_version(ref) AS ref_version,\n       uuid_extract_version(uuidv7()) AS fresh_version\nFROM bookings\nWHERE id <= 3;",
		},
		{
			kind: "try",
			title: "Your turn: a week in the Lumière Quarter",
			prompt:
				"Return the **name** and the exact price of **7 nights** (`nightly_rate * 7`) of every room of realm **1**.",
			starterSql:
				"SELECT name, nightly_rate::int * 7 AS week\nFROM rooms\nWHERE realm_id = 1;",
			solutionSql: "SELECT name, nightly_rate * 7 AS week FROM rooms WHERE realm_id = 1;",
			check: { type: "result" },
			hints: [
				"Run the starter: the Garret costs 462? Its rate is 65.50.",
				"The `::int` cast rounds before multiplying. Keep the numeric value.",
			],
		},
	],
	exercises: [
		{
			id: "ch29-ex01",
			title: "Counting in copper",
			story:
				"The new till only understands whole copper pieces: 100 copper make one coin.",
			prompt:
				"Return the **name** of every room and its **nightly_rate in cents** (rate times 100) as an **integer**.",
			difficulty: 1,
			kind: "query",
			concepts: ["numeric-types"],
			solutionSql: "SELECT name, (nightly_rate * 100)::int AS cents FROM rooms;",
			check: { type: "result" },
			hints: [
				"Multiply first, then cast.",
				"Casting 65.50 to int rounds it to 66 before the multiplication.",
				"(nightly_rate * 100)::int",
			],
			explanation:
				"Multiplying the exact numeric first keeps every cent: 65.50 becomes 6550. The cast happens on a whole number, so nothing is lost.\n\n**Pitfall:** `nightly_rate::int * 100` rounds first, so the Garret costs 6600 and The Last Room 10000.\n\n**Alternative:** `CAST(nightly_rate * 100 AS integer)`.",
		},
		{
			id: "ch29-ex02",
			title: "A billion motes per bed",
			story:
				"The alchemist claims every bed hides one billion dust motes. Her census query crashes on the big rooms.",
			prompt:
				"Return the **name** of every room and its number of **motes**: `beds` times **1000000000**. The query must not overflow.",
			difficulty: 2,
			kind: "query",
			concepts: ["numeric-types"],
			starterSql: "SELECT name, beds * 1000000000 AS motes\nFROM rooms;",
			solutionSql: "SELECT name, beds::bigint * 1000000000 AS motes FROM rooms;",
			check: { type: "result" },
			hints: [
				"Run the starter: error 22003, integer out of range.",
				"`int * int` is computed as an int, whose limit is about 2.1 billion. Widen one side **before** multiplying.",
				"beds::bigint * 1000000000",
			],
			explanation:
				"With one operand cast to `bigint`, the multiplication itself runs in bigint, and 6 000 000 000 fits easily.\n\n**Pitfall:** `(beds * 1000000000)::bigint` casts too late: the int multiplication has already overflowed.\n\n**Alternative:** `beds * 1000000000::bigint` or `beds::numeric * 1000000000`.",
		},
		{
			id: "ch29-ex03",
			title: "The drifting thirds",
			story:
				"Ngaio's booking 13 was split into three equal shares of 100 gold pieces. The legacy float column remembers it differently.",
			prompt:
				"Return the **id**, **amount** and **amount_float** of every payment whose `amount_float` is **not exactly equal** to its `amount`.",
			difficulty: 2,
			kind: "query",
			concepts: ["floating-point"],
			solutionSql:
				"SELECT id, amount, amount_float FROM payments WHERE amount_float <> amount::float8;",
			check: { type: "result" },
			hints: [
				"Compare the two columns directly.",
				"`amount::float8` puts both sides in the same type; `<>` then compares the binary values exactly.",
				"WHERE amount_float <> amount::float8",
			],
			explanation:
				"100.0 / 3 has no finite binary form, so the float stores 33.333333333333336, which is neither 33.33 nor 33.34.\n\n**Pitfall:** `round(amount_float::numeric, 2) <> amount` rounds the evidence away and only catches payment 16.\n\n**Alternative:** `amount_float::numeric <> amount` finds the same three payments.",
		},
		{
			id: "ch29-ex04",
			title: "Close enough for a float",
			story:
				"The reconciler flags any legacy float that does not *equal* the exact amount. It cries wolf on the thirds.",
			prompt:
				"For every payment of **booking 13**, return the **id** and a boolean **matches**: true when `amount_float` is **within half a cent** of `amount` (absolute difference strictly below 0.005).",
			difficulty: 3,
			kind: "query",
			concepts: ["floating-point"],
			starterSql:
				"SELECT id, amount_float = amount AS matches\nFROM payments\nWHERE booking_id = 13;",
			solutionSql:
				"SELECT id, abs(amount_float - amount::float8) < 0.005 AS matches\nFROM payments\nWHERE booking_id = 13;",
			check: { type: "result" },
			hints: [
				"Run the starter: payments 14 and 15 are 33.33 to the cent, yet flagged false.",
				"Floats need a tolerance test: the absolute difference below a threshold.",
				"abs(amount_float - amount::float8) < 0.005",
			],
			explanation:
				"A tolerance turns *bit for bit identical* into *close enough*, the only meaningful question for floats. Payment 16 (33.34 recorded as 33.3333...) is still caught.\n\n**Pitfall:** `amount_float = amount` fails on almost every non trivial decimal.\n\n**Alternative:** `round(amount_float::numeric, 2) = amount` compares at the cent.",
		},
		{
			id: "ch29-ex05",
			title: "The Crossroads tithe",
			story:
				"The Crossroads magistrate takes a 7.7% tithe on every booking's takings, rounded to the copper.",
			prompt:
				"For every booking that has payments, return the **booking_id**, the **currency**, the exact **total** paid and the **tithe**: 7.7% of the total, **rounded once** to 2 decimals.",
			difficulty: 3,
			kind: "query",
			concepts: ["money-handling"],
			solutionSql:
				"SELECT booking_id, currency, sum(amount) AS total,\n       round(sum(amount) * 0.077, 2) AS tithe\nFROM payments\nGROUP BY booking_id, currency;",
			check: { type: "result" },
			hints: [
				"Group the payments per booking (and its currency), then compute on the sum.",
				"Round the final tithe, not each payment's share: per line rounding drifts.",
				"round(sum(amount) * 0.077, 2) with GROUP BY booking_id, currency",
			],
			explanation:
				"Summing exact numerics then rounding once gives 7.72 on booking 13. Booking 12 shows 1050.00: it was charged three times, an honest total of a dishonest ledger.\n\n**Pitfall:** `sum(round(amount * 0.077, 2))` gives 7.74 on booking 13: five tiny roundings add up to two copper too many.\n\n**Alternative:** `round(0.077 * sum(amount), 2)`.",
		},
		{
			id: "ch29-ex06",
			title: "The padded gold",
			story:
				"The bookkeeper wants every payment made in gold pieces. Her search finds no gold at all.",
			prompt:
				"Return the **id** and **amount** of every payment whose **currency** is `GP`.",
			difficulty: 2,
			kind: "query",
			concepts: ["text-types"],
			starterSql: "SELECT id, amount\nFROM payments\nWHERE currency LIKE 'GP';",
			solutionSql: "SELECT id, amount FROM payments WHERE currency = 'GP';",
			check: { type: "result" },
			hints: [
				"`currency` is a `char(3)`. What does a 2-letter code look like inside it?",
				"char(n) pads `GP` to `'GP '`. LIKE compares the padded text; `=` on char(n) ignores trailing spaces.",
				"WHERE currency = 'GP'",
			],
			explanation:
				"Comparing a `char(n)` with `=` ignores trailing padding, so `'GP '` equals `'GP'`.\n\n**Pitfall:** `LIKE 'GP'` sees the third character, a space, and matches nothing. That is why new columns should be `text`.\n\n**Alternative:** `rtrim(currency) = 'GP'` or `currency LIKE 'GP%'`.",
		},
		{
			id: "ch29-ex07",
			title: "Ordinary travellers",
			story:
				"The inn throws a party for everyone who is **not** a VIP. Nobody ever assessed some guests, and they want cake too.",
			prompt:
				"Return the **name** of every guest who is **not a VIP**, including guests whose `vip` flag is **unknown**.",
			difficulty: 2,
			kind: "query",
			concepts: ["boolean-type"],
			solutionSql: "SELECT name FROM guests WHERE vip IS NOT TRUE;",
			check: { type: "result" },
			hints: [
				"`vip` has three states: true, false and NULL.",
				"`NOT vip` and `vip = false` both drop NULL rows. There is an IS test for booleans.",
				"WHERE vip IS NOT TRUE",
			],
			explanation:
				"`IS NOT TRUE` answers true for false **and** for NULL, so Beatriz, Odo, the second Isolde and Zoë come to the party.\n\n**Pitfall:** `WHERE NOT vip` evaluates `NOT NULL` to unknown and silently drops 4 guests.\n\n**Alternative:** `WHERE vip = false OR vip IS NULL`, or `WHERE NOT coalesce(vip, false)`.",
		},
		{
			id: "ch29-ex08",
			title: "The shouting clerk",
			story:
				"A guest reads her key token aloud in capitals: `90B09014-2CC2-DB0D-6908-65C1BDF46884`. The clerk's search finds nothing.",
			prompt:
				"Return the **id** and **status** of the booking whose **ref** is `90B09014-2CC2-DB0D-6908-65C1BDF46884`.",
			difficulty: 2,
			kind: "query",
			concepts: ["uuid-type"],
			starterSql:
				"SELECT id, status\nFROM bookings\nWHERE ref::text = '90B09014-2CC2-DB0D-6908-65C1BDF46884';",
			solutionSql:
				"SELECT id, status FROM bookings WHERE ref = '90B09014-2CC2-DB0D-6908-65C1BDF46884';",
			check: { type: "result" },
			hints: [
				"How is a uuid printed when you cast it to text?",
				"`ref::text` is lower case, so the text comparison fails. Compare as uuid: the literal is then parsed into a uuid.",
				"WHERE ref = '90B09014-...'",
			],
			explanation:
				"Compared as a `uuid`, the literal is parsed into 128 bits: case, dashes and braces stop mattering, and the unique index on `ref` can be used.\n\n**Pitfall:** comparing as text is case sensitive and format sensitive. Storing uuids in text columns has the same problem, plus double the size.\n\n**Alternative:** `WHERE ref = '90b090142cc2db0d690865c1bdf46884'::uuid`.",
		},
		{
			id: "ch29-ex09",
			title: "Boss: The Ledger of Exact Coin",
			story:
				"The bookkeeper retires the float column for good. She wants a clean ledger: exact amounts, honest currency codes, and ids that sort by time.",
			prompt:
				"1. Create a table **ledger** with:\n   - `id` uuid, primary key, defaulting to `uuidv7()`\n   - `booking_id` int, not null\n   - `amount` numeric(10,2), not null\n   - `currency` **text**, not null\n   - `settled` boolean, not null, default **false**\n2. Copy every payment into it (let `id` use its default): its booking_id, its exact amount, its currency **without padding**, and `settled` = **true for card payments**. Other payments keep the default.",
			difficulty: 5,
			kind: "ddl",
			concepts: ["money-handling", "uuid-type", "numeric-types", "text-types", "boolean-type"],
			solutionSql:
				"CREATE TABLE ledger (\n  id uuid PRIMARY KEY DEFAULT uuidv7(),\n  booking_id int NOT NULL,\n  amount numeric(10,2) NOT NULL,\n  currency text NOT NULL,\n  settled boolean NOT NULL DEFAULT false\n);\nINSERT INTO ledger (booking_id, amount, currency) SELECT booking_id, amount, rtrim(currency) FROM payments WHERE method <> 'card';\nINSERT INTO ledger (booking_id, amount, currency, settled) SELECT booking_id, amount, rtrim(currency), true FROM payments WHERE method = 'card';",
			check: {
				type: "state",
				verifySql:
					"SELECT 'col' AS k, column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(numeric_scale::text, '-') || ' ' || coalesce(column_default, '-') AS v\nFROM information_schema.columns WHERE table_name = 'ledger'\nUNION ALL\nSELECT 'pk', a.attname::text FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)\nWHERE c.conrelid = 'ledger'::regclass AND c.contype = 'p'\nUNION ALL\nSELECT 'row', booking_id || ' ' || amount || ' [' || currency || '] ' || settled FROM ledger\nUNION ALL\nSELECT 'v7', count(*) FILTER (WHERE uuid_extract_version(id) = 7) || '/' || count(*) FROM ledger;",
			},
			hints: [
				"Two steps: CREATE TABLE with defaults and constraints, then INSERT ... SELECT from payments.",
				"`DEFAULT uuidv7()` fills the id; `rtrim(currency)` (or `currency::text`) removes the char(3) padding; `method = 'card'` is already a boolean.",
				"INSERT INTO ledger (booking_id, amount, currency, settled) SELECT booking_id, amount, rtrim(currency), method = 'card' FROM payments;",
			],
			explanation:
				"Each type now says what it means: exact `numeric` cents, `text` codes without padding, a two-state `boolean` guarded by NOT NULL, and a time ordered `uuidv7` key that keeps the primary key index tidy.\n\n**Pitfall:** `settled` without NOT NULL invites a third, unintended state; copying `currency` with `concat` or into `char(3)` keeps `'GP '`.\n\n**Alternative:** `settled boolean NOT NULL DEFAULT false` plus one INSERT using `method = 'card'` as the value.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch29-pr01",
			title: "Too big for the box",
			prompt:
				"Prove that `numeric(5,2)` cannot hold **1000.00**: write a query that casts `1000.00` to `numeric(5,2)`. It must fail with an out of range error.",
			difficulty: 1,
			kind: "query",
			concepts: ["numeric-types"],
			solutionSql: "SELECT 1000.00::numeric(5,2);",
			check: { type: "error", sqlstate: "22003" },
			hints: [
				"numeric(5,2) means 5 digits in total, 2 after the point.",
				"1000.00 needs 6 digits.",
				"SELECT 1000.00::numeric(5,2);",
			],
			explanation:
				"`numeric(5,2)` tops out at 999.99. Postgres raises 22003 instead of truncating: exact types never lie quietly.",
		},
		{
			id: "ch29-pr02",
			title: "One decimal is enough",
			prompt:
				"Return the **name** of every room and its **nightly_rate** cast to `numeric(5,1)`.",
			difficulty: 1,
			kind: "query",
			concepts: ["numeric-types"],
			solutionSql: "SELECT name, nightly_rate::numeric(5,1) AS rate FROM rooms;",
			check: { type: "result" },
			hints: [
				"A cast to a smaller scale rounds.",
				"Use `::numeric(5,1)` or `CAST(... AS numeric(5,1))`.",
				"SELECT name, nightly_rate::numeric(5,1) FROM rooms;",
			],
			explanation:
				"The scale rounds half away from zero: 45.25 becomes 45.3 and 99.99 becomes 100.0. The precision 5 still fits, so no error.",
		},
		{
			id: "ch29-pr03",
			title: "Two kinds of point three",
			prompt:
				"Return one row with two booleans: `0.1::float8 + 0.2::float8 = 0.3` and `0.1 + 0.2 = 0.3` (in that order).",
			difficulty: 1,
			kind: "query",
			concepts: ["floating-point"],
			solutionSql:
				"SELECT 0.1::float8 + 0.2::float8 = 0.3 AS float_eq, 0.1 + 0.2 = 0.3 AS numeric_eq;",
			check: { type: "result" },
			hints: [
				"Just SELECT the two expressions.",
				"Unadorned decimal literals like 0.1 are numeric in Postgres.",
				"SELECT 0.1::float8 + 0.2::float8 = 0.3, 0.1 + 0.2 = 0.3;",
			],
			explanation:
				"false, then true. Decimal literals are `numeric`, which is exact; only the explicit `float8` drifts to 0.30000000000000004.",
		},
		{
			id: "ch29-pr04",
			title: "Visible drift",
			prompt:
				"Return the **id** of every payment whose `amount_float` differs from `amount` by **more than 0.001**.",
			difficulty: 2,
			kind: "query",
			concepts: ["floating-point"],
			solutionSql: "SELECT id FROM payments WHERE abs(amount_float - amount::float8) > 0.001;",
			check: { type: "result" },
			hints: [
				"A tolerance test, reversed.",
				"abs(a - b) gives the distance.",
				"WHERE abs(amount_float - amount::float8) > 0.001",
			],
			explanation:
				"Only the three thirds of booking 13 drift by more than a thousandth. The tips 0.1 and 0.2 are off by far less.",
		},
		{
			id: "ch29-pr05",
			title: "One purse per currency",
			prompt:
				"Return each **currency** as text without padding (`rtrim(currency)`) and the exact **total** of payments in that currency.",
			difficulty: 2,
			kind: "query",
			concepts: ["money-handling"],
			solutionSql: "SELECT rtrim(currency) AS currency, sum(amount) AS total FROM payments GROUP BY 1;",
			check: { type: "result" },
			hints: [
				"Never add yen to euros: group by currency.",
				"Group on the trimmed currency.",
				"SELECT rtrim(currency), sum(amount) FROM payments GROUP BY 1;",
			],
			explanation:
				"Five currencies, five totals. A single grand total would add 154000 yen to 1297 euros, a number that means nothing.",
		},
		{
			id: "ch29-pr06",
			title: "A sign too long",
			setupSql: "CREATE TABLE signs (label varchar(10));",
			prompt:
				"The table `signs (label varchar(10))` exists. Insert the label **The Wandering Star** into it: the insert must be **refused** by the length limit.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["text-types"],
			solutionSql: "INSERT INTO signs (label) VALUES ('The Wandering Star');",
			check: { type: "error", sqlstate: "22001" },
			hints: [
				"A plain INSERT is enough.",
				"varchar(10) rejects longer strings on insert.",
				"INSERT INTO signs (label) VALUES ('The Wandering Star');",
			],
			explanation:
				"22001 *value too long*. Surprise: an explicit cast `'The Wandering Star'::varchar(10)` silently truncates instead. Prefer `text` plus a CHECK on length when a limit really matters.",
		},
		{
			id: "ch29-pr07",
			title: "Letters and bytes",
			prompt:
				"Return the **name**, `char_length(name)` and `octet_length(name)` of every guest whose name takes **more bytes than characters**.",
			difficulty: 2,
			kind: "query",
			concepts: ["text-types"],
			solutionSql:
				"SELECT name, char_length(name), octet_length(name) FROM guests WHERE octet_length(name) > char_length(name);",
			check: { type: "result" },
			hints: [
				"Accented letters take 2 bytes in UTF-8.",
				"Compare the two lengths in WHERE.",
				"WHERE octet_length(name) > char_length(name)",
			],
			explanation:
				"Amélie, Ödön and Zoë. `length` counts characters, `octet_length` counts bytes: a varchar(n) limit counts characters.",
		},
		{
			id: "ch29-pr08",
			title: "Three kinds of guest",
			prompt: "Return each value of **vip** (true, false and unknown) with its number of guests.",
			difficulty: 1,
			kind: "query",
			concepts: ["boolean-type"],
			solutionSql: "SELECT vip, count(*) FROM guests GROUP BY vip;",
			check: { type: "result" },
			hints: [
				"GROUP BY the flag.",
				"NULL forms its own group, count(*) counts it.",
				"SELECT vip, count(*) FROM guests GROUP BY vip;",
			],
			explanation:
				"4 true, 7 false, 4 unknown. A `NOT NULL DEFAULT false` would have prevented the third state, if *unknown* is not a real answer.",
		},
		{
			id: "ch29-pr09",
			title: "Version check",
			prompt:
				"Return one row: `uuid_extract_version(uuidv7())` and `uuid_extract_version(gen_random_uuid())`, in that order.",
			difficulty: 1,
			kind: "query",
			concepts: ["uuid-type"],
			solutionSql:
				"SELECT uuid_extract_version(uuidv7()) AS v7, uuid_extract_version(gen_random_uuid()) AS v4;",
			check: { type: "result" },
			hints: [
				"The values are random, but their versions are not.",
				"SELECT the two calls.",
				"SELECT uuid_extract_version(uuidv7()), uuid_extract_version(gen_random_uuid());",
			],
			explanation:
				"7 and 4. Version 7 starts with a timestamp, so new ids land at the end of the index; version 4 is pure randomness.",
		},
		{
			id: "ch29-pr10",
			title: "Tokens starting with c",
			prompt:
				"Return the **id** and **ref** of every booking whose ref, written as text, **starts with c**.",
			difficulty: 2,
			kind: "query",
			concepts: ["uuid-type"],
			solutionSql: "SELECT id, ref FROM bookings WHERE ref::text LIKE 'c%';",
			check: { type: "result" },
			hints: [
				"LIKE works on text, not on uuid.",
				"Cast the uuid to text first: it prints in lower case.",
				"WHERE ref::text LIKE 'c%'",
			],
			explanation:
				"Bookings 5, 6 and 11. A uuid prints in lower case with dashes, so the pattern must be lower case too.",
		},
	],
};

export default chapter;
