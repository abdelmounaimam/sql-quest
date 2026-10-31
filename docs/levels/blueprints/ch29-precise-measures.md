### ch29-precise-measures · Precise Measures ⚗️
- **File** `src/content/chapters/ch29-precise-measures.ts` · **World** The Alchemist's Vault · **Tier** apprentice · **Track** types · **Dataset** `inn`
- **Subtitle** Exact money, treacherous floats, padded text and ids that never collide
- **Concepts** `numeric-types`, `floating-point`, `money-handling`, `text-types`, `boolean-type`, `uuid-type`
- **Prerequisites** `ch24-laying-foundations`
- **Lesson** (10 steps)
  1. explain · The bookkeeper's scales: the bookkeeper's scales: smallint/int/bigint ranges, numeric(p,s), 22003
  2. example · Casts round, scales clamp: `2147483647::bigint + 1`, `65.50::int` rounds to 66, `1.005::numeric(5,2)`
  3. explain · Floats are approximate: floats are binary fractions: tolerance tests, never money
  4. example · The tip that would not add up: payments 17 + 18: exact 0.30 vs float 0.30000000000000004, `= 0.3` false
  5. quiz · type for nightly_rate (real, money, numeric(8,2), text) → numeric(8,2); misconception float/money for money
  6. explain · Money, the right way: numeric + currency column, never sum currencies, round once on the total
  7. explain · text, varchar(n), char(n): text vs varchar(n) vs char(n): `'GP '` padding, `=` ignores it, LIKE and octet_length see it
  8. explain · Booleans and UUIDs: boolean three states, `IS NOT TRUE`; uuid v4 vs uuidv7, uuid input formats
  9. example · Where did the version go?: md5-derived refs: `uuid_extract_version` NULL vs 7 for uuidv7()
  10. try · Your turn: a week in the Lumière Quarter: 7 nights of realm 1 rooms (starter casts to int first)
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch29-ex01 | name and nightly_rate in cents as int (multiply then cast) | 1 | query | result | numeric-types | write |
| ch29-ex02 | fix `beds * 1000000000` int overflow (22003): widen to bigint before multiplying | 2 | query | result | numeric-types | fix |
| ch29-ex03 | id, amount, amount_float of payments where the float is not exactly the amount (14, 15, 16) | 2 | query | result | floating-point | write |
| ch29-ex04 | fix `amount_float = amount` for booking 13: boolean within half a cent | 3 | query | result | floating-point | fix |
| ch29-ex05 | per booking: currency, exact total, 7.7% tithe rounded once (7.72 not 7.74 on booking 13) | 3 | query | result | money-handling | write |
| ch29-ex06 | fix `currency LIKE 'GP'` (char(3) padding): id, amount of GP payments | 2 | query | result | text-types | fix |
| ch29-ex07 | names of guests not VIP, NULL included (`IS NOT TRUE`) | 2 | query | result | boolean-type | write |
| ch29-ex08 | fix `ref::text = '90B0...'` upper-case lookup: compare as uuid | 2 | query | result | uuid-type | fix |
| ch29-ex09 | **Boss · The Ledger of Exact Coin**: CREATE TABLE ledger (uuidv7 PK, numeric(10,2), text currency, boolean NOT NULL DEFAULT false) + copy payments (rtrim currency, settled for card) | 5 | ddl | state | money-handling, uuid-type, numeric-types, text-types, boolean-type | design |

- **Practice**: `ch29-pr01` numeric-types: `1000.00::numeric(5,2)` must fail 22003; `ch29-pr02` numeric-types: nightly_rate::numeric(5,1); `ch29-pr03` floating-point: predict float vs numeric `0.1 + 0.2 = 0.3`; `ch29-pr04` floating-point: payments drifting by more than 0.001; `ch29-pr05` money-handling: total per currency (rtrim); `ch29-pr06` text-types: insert into varchar(10) must fail 22001 (setupSql table); `ch29-pr07` text-types: names with more bytes than characters; `ch29-pr08` boolean-type: count per vip value incl. NULL; `ch29-pr09` uuid-type: versions of uuidv7() and gen_random_uuid(); `ch29-pr10` uuid-type: refs starting with c (cast to text)
- **Negative cases** (`scripts/negative-cases/ch29-precise-measures.ts`): ex01 cast before multiply; ex02 cast after overflow; ex03 rounding hides drift; ex04 exact equality, a whole cent of tolerance; ex05 per line rounding, no rounding; ex06 wrong pattern (accept `=`, rtrim, `LIKE 'GP%'`); ex07 `= false`, `NOT vip`; ex08 text LIKE; ex09 v4 default, char(3) currency, float amount, nullable settled. Accept CAST forms, `vip IS DISTINCT FROM true`, `ref = '...'::uuid`.
- **Notes**: Values are compared with 1e-6 tolerance, so float drift must be graded through booleans or row membership, never by comparing float sums. `currency || '|'` hides the padding (bpchar to text strips it) while `concat` keeps it. Booking 7's ref is `90b09014-2cc2-db0d-6908-65c1bdf46884`. uuidv7 values are random: the boss verify only checks `uuid_extract_version(id) = 7` counts.
