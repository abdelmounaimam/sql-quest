## 11. World 8: The Alchemist's Vault (PostgreSQL types)

### ch29-precise-measures · Precise Measures ⚗️
- **File** `src/content/chapters/ch29-precise-measures.ts` · **World** The Alchemist's Vault · **Tier** apprentice · **Track** types · **Dataset** `inn`
- **Subtitle** Exact money, treacherous floats, padded text and ids that never collide
- **Concepts** `numeric-types`, `floating-point`, `money-handling`, `text-types`, `boolean-type`, `uuid-type`
- **Prerequisites** `ch24-laying-foundations`
- **Lesson** (9 steps)
  1. explain · The bookkeeper's nightmare: integers have ranges (smallint, int, bigint), numeric(p, s) is exact; overflow raises 22003.
  2. example · Overflow on purpose: `SELECT 2147483647::int + 1;` fails, `SELECT 2147483647::bigint + 1;` works.
  3. explain · Floats are approximate: real and double precision store binary fractions; never compare them with `=`.
  4. example · The tip that would not add up: `SELECT sum(amount) AS exact, sum(amount_float) AS drifting FROM payments WHERE id IN (17, 18);` (0.30 vs 0.30000000000000004).
  5. quiz · Which type should hold a nightly rate? (choices: real, money, numeric(8,2), text; misconception: float or money for money)
  6. explain · text vs varchar(n) vs char(n): prefer text; char(3) pads with spaces ('GP ' in payments.currency), length() ignores the padding, octet_length() sees it.
  7. explain · Booleans are true, false or NULL (`WHERE vip`, `WHERE vip IS NOT TRUE`); UUIDs: gen_random_uuid() (v4) and uuidv7() (time ordered); `uuid_extract_version`.
  8. example · Where did the version go?: `SELECT ref, uuid_extract_version(ref) FROM bookings LIMIT 3;` (md5-derived refs have no version, NULL) next to `uuidv7()`.
  9. try · Total takings in gold pieces: return the exact sum of `amount` for payments in currency `GP`.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch29-ex01 | Return each room's **name** and its **nightly_rate times 1000 nights** as an exact number (numeric), for rooms of realm 2 | 1 | query | result | numeric-types | write |
| ch29-ex02 | The night auditor's query `SELECT sum(nightly_rate)::int * 2147483647` crashes with 22003. Fix it so it returns the product as a **bigint or numeric** (same value) | 2 | query | result | numeric-types | fix |
| ch29-ex03 | Return the **id** and **amount** of payments whose legacy `amount_float` does **not exactly equal** their `amount` (compare amount_float with amount::float8). Expect the three 100/3 splits | 2 | query | result | floating-point | predict |
| ch29-ex04 | Starter compares `sum(amount_float) = 0.3` for payments 17 and 18 and returns false. Fix it: return **true** when the float sum is within **0.000001** of 0.3 (abs difference) | 3 | query | result | floating-point | fix |
| ch29-ex05 | Per booking with at least one payment: return **booking_id**, **currency** and the exact **total paid** (numeric, rounded to 2 decimals once on the total). Booking 12 must show 1050.00 (charged three times) | 3 | query | result | money-handling | write |
| ch29-ex06 | Return **id**, **currency**, `length(currency)` and `octet_length(currency)` of payments in gold pieces, and a third text column `currency || '|'`: show why char(3) hides its padding | 2 | query | result | text-types | predict |
| ch29-ex07 | Return the **name** of guests who are **not** VIPs, including guests whose `vip` is unknown (NULL counts as not VIP) | 2 | query | result | boolean-type | write |
| ch29-ex08 | **Boss · The Ledger of Exact Coin**: create table `ledger` (id uuid primary key default uuidv7(), booking_id int not null references bookings, amount numeric(10,2) not null check (amount > 0), currency text not null check (currency ~ '^[A-Z]{3}$' or currency = 'GP'), settled boolean not null default false), then insert one row per payment with `trim(currency)` and the exact amount. verifySql: booking_id, amount, currency, settled ordered by booking_id, amount, currency; plus `uuid_extract_version(id) = 7` for all rows and the column types from information_schema | 5 | ddl | state | money-handling, uuid-type, numeric-types, text-types, boolean-type | design |

- **Practice**: `ch29-pr01` numeric-types: does `numeric(5,2)` accept 1000.00? write `SELECT 1000.00::numeric(5,2);` (error check 22003); `ch29-pr02` numeric-types: return the max nightly_rate cast to numeric(5,1); `ch29-pr03` floating-point: return `0.1::float8 + 0.2::float8 = 0.3` and `0.1 + 0.2 = 0.3` as two columns (predict, result); `ch29-pr04` floating-point: return payments of booking 13 where `amount_float` and `amount` differ by more than 0.001; `ch29-pr05` money-handling: return the total of JPY payments as numeric with no decimals (round once); `ch29-pr06` text-types: return guests whose name is longer than 12 characters (length on text); `ch29-pr07` boolean-type: count guests per `vip` value, NULL as its own group; `ch29-pr08` uuid-type: return `uuid_extract_version(uuidv7())` (predict 7) and `uuid_extract_version(gen_random_uuid())` (4); `ch29-pr09` uuid-type: return id and ref of bookings whose ref text starts with 'c' (cast uuid to text).
- **Negative cases to add**: ex03 reject `amount_float <> amount` written as `WHERE amount_float::numeric <> amount` (rounding hides the drift) only if it returns a different set (check data), reject `round(amount_float::numeric, 2) <> amount`; ex04 reject `sum(amount_float) = 0.3`; ex05 reject summing amount_float, reject `round` per row then sum when it changes booking 13 (it does not: accept it); accept `sum(amount)::numeric(12,2)`; ex07 reject `WHERE vip = false` (drops NULL), accept `WHERE vip IS NOT TRUE` and `WHERE NOT coalesce(vip, false)`.
- **Notes**: payments mix currencies (EUR, BRL, JPY, NZD, GP): never sum across currencies, the boss groups or keeps currency. `currency = 'GP'` is true for 'GP ' because char comparison ignores trailing spaces. Booking refs are md5-shaped uuids: `uuid_extract_version` returns NULL for them (nice predict item). uuidv7 values are random, so checks must never compare uuid values, only versions or counts.

### ch30-shaped-data · Shaped Data 🧬
- **File** `src/content/chapters/ch30-shaped-data.ts` · **World** The Alchemist's Vault · **Tier** adept · **Track** types · **Dataset** `guild`
- **Subtitle** Enums that sort themselves, domains that guard, composites and arrays
- **Concepts** `enum-types`, `domain-types`, `composite-types`, `arrays`
- **Prerequisites** `ch29-precise-measures`, `ch25-binding-laws`, `ch12-exists-or-not`
- **Lesson** (9 steps)
  1. explain · Enums are ordered labels: `hero_class` and `rarity` sort by declaration order, not alphabetically.
  2. example · Rarity ladder: `SELECT name, rarity FROM items ORDER BY rarity DESC, name;` (legendary first, though 'epic' < 'legendary' alphabetically too: point at common/uncommon/rare).
  3. quiz · `ORDER BY class` on heroes puts which class first? (warrior, declaration order; misconception: alphabetical 'bard')
  4. explain · Domains: `CREATE DOMAIN gold_amount AS numeric(10,2) CHECK (VALUE >= 0)` reuse a rule; violations raise 23514.
  5. explain · Composite types: `stats` is a `stat_block(str, dex, wis)`; read a field with `(stats).dex`, the parentheses are required.
  6. example · The nimblest: `SELECT name, (stats).dex FROM heroes ORDER BY (stats).dex DESC NULLS LAST, name LIMIT 3;`
  7. explain · Arrays: 1-based, `tags[1]`, `'scout' = ANY(tags)`, `tags @> '{scout}'`, `&&`, `cardinality`, `unnest`; NULL array vs empty `'{}'`.
  8. example · Scouts of the guild: `SELECT name, tags FROM heroes WHERE tags @> '{scout}';`
  9. try · First tag: return each hero's name and the **first** element of `tags` (NULL when none).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch30-ex01 | Return **name** and **rarity** of items rarer than `uncommon` (enum comparison `rarity > 'uncommon'`) | 1 | query | result | enum-types | write |
| ch30-ex02 | Return each **class** with its number of heroes, in **class declaration order** (orderMatters) | 2 | query | result | enum-types | write |
| ch30-ex03 | `INSERT INTO heroes (name, class, level, joined_on) VALUES ('Pip', 'paladin', 1, '2026-10-31');` must fail: make it fail with the invalid enum label error (22P02) | 2 | mutation | error 22P02 | enum-types | predict |
| ch30-ex04 | Create domain `gold_amount` (numeric(10,2), not negative) and change `heroes.gold` to use it; verifySql: data_type/domain_name of heroes.gold from information_schema and a probe that `-1::gold_amount` fails (via a setupSql helper function returning the SQLSTATE) | 3 | ddl | state | domain-types | design |
| ch30-ex05 | Return **name**, `(stats).str`, `(stats).dex`, `(stats).wis` of heroes whose wisdom is at least 15, wisdom descending, ties by name (orderMatters) | 2 | query | result | composite-types | write |
| ch30-ex06 | Starter `SELECT name, stats.dex FROM heroes;` fails with 42P01. Fix it to return name and dex for every hero (NULL stats stays NULL) | 2 | query | result | composite-types | fix |
| ch30-ex07 | Return **name** of heroes that have **no tags at all**: NULL or empty array (3 NULL + 4 empty) | 3 | query | result | arrays | write |
| ch30-ex08 | Return each distinct **tag** with the number of heroes carrying it (unnest), most common first, ties by tag (orderMatters) | 3 | query | result | arrays | write |
| ch30-ex09 | **Boss · The Class Registry**: return for each class (declaration order) the hero **count**, the **average dex** rounded to 1 decimal (NULL stats ignored), and the **sorted array of distinct tags** used by heroes of that class (`array_agg(DISTINCT t ORDER BY t)` over unnest, empty classes of tags give NULL) | 4 | query | result, orderMatters | enum-types, composite-types, arrays | write |

- **Practice**: `ch30-pr01` enum-types: return items whose rarity is between 'rare' and 'legendary'; `ch30-pr02` enum-types: add the value 'paladin' to hero_class after 'cleric' (`ALTER TYPE ... ADD VALUE ... AFTER`), verify with `enum_range(NULL::hero_class)`; `ch30-pr03` domain-types: create domain `level_20` (int between 1 and 20) and a table `apprentices(name text, level level_20)`, verify by catalog; `ch30-pr04` composite-types: return heroes whose str is greater than their dex; `ch30-pr05` composite-types: build a stat_block literal with `ROW(10,12,14)::stat_block` and return its dex (predict); `ch30-pr06` arrays: heroes with a tag in common with Aldric (`&&`); `ch30-pr07` arrays: return name and `cardinality(tags)` with NULL tags shown as 0 (coalesce).
- **Negative cases to add**: ex01 reject `rarity::text > 'uncommon'` (alphabetical); ex02 reject `ORDER BY class::text`; ex07 reject `WHERE tags = '{}'` (misses NULL) and `WHERE tags IS NULL` (misses empty), accept `coalesce(cardinality(tags), 0) = 0`; ex08 accept `GROUP BY 1 ORDER BY 2 DESC, 1`; ex09 reject `avg((stats).dex)` without rounding only if different.
- **Notes**: hero 24 has NULL stats and an empty tags array; tags NULL for 11, 18, 30, `'{}'` for 9, 17, 22, 24. `array_length('{}', 1)` is NULL while `cardinality('{}')` is 0 (good quiz). Domain behaviour check: in exercise setupSql create `try_sqlstate(sql text) returns text` (plpgsql EXECUTE, return SQLSTATE or 'ok') so verifySql can probe invalid values.

### ch31-scrolls-of-json · Scrolls of JSON 📦
- **File** `src/content/chapters/ch31-scrolls-of-json.ts` · **World** The Alchemist's Vault · **Tier** adept · **Track** types · **Dataset** `guild`
- **Subtitle** Read, build, unnest and rewrite the heroes' loot bags
- **Concepts** `json-vs-jsonb`, `jsonb-operators`, `jsonb-construction`, `jsonb-decomposition`, `jsonb-modification`
- **Prerequisites** `ch30-shaped-data`, `ch16-champions-of-each-dungeon`
- **Lesson** (10 steps)
  1. explain · json keeps text as typed (key order, duplicate keys), jsonb is parsed and indexable; use jsonb.
  2. example · Twin keys: `SELECT '{"a":1,"a":2}'::json::text AS json_text, '{"a":1,"a":2}'::jsonb AS parsed;`
  3. explain · `->` returns jsonb, `->>` returns text, `#>` / `#>>` follow a path, subscripts `doc['coins']['gold']`.
  4. example · Gold in the purse: `SELECT hero_id, doc->'coins'->>'gold' AS gold FROM inventories;`
  5. quiz · `WHERE doc->'coins'->'gold' > 100` fails with 42883. Why? (jsonb vs integer; use `(doc->'coins'->>'gold')::int`)
  6. explain · Containment `@>` and key tests `?`, `?|`, `?&`; JSON null vs missing key.
  7. explain · Building JSON: `jsonb_build_object`, `jsonb_agg`, `to_jsonb(row)`; jsonb_agg over zero rows is NULL.
  8. example · Unnesting: `SELECT i.hero_id, it->>'item' FROM inventories i, jsonb_array_elements(i.doc->'bags') b, jsonb_array_elements(b->'items') it;`
  9. explain · Modifying: `jsonb_set(doc, '{coins,gold}', '50')`, `||` shallow merge, `-` removes a key, `#-` removes a path.
  10. try · Silver count: return hero_id and the silver coins as an integer (NULL when no silver).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch31-ex01 | Return **name** and **attributes** (as text) of items whose attributes JSON is exactly `{}`, using `::json` vs `::jsonb` to explain why `'{ }'` spacing does not matter in jsonb (return name only) | 1 | query | result | json-vs-jsonb | predict |
| ch31-ex02 | Return **hero_id** and **gold** coins as **int** for inventories that have a gold entry, richest first, ties by hero_id (orderMatters) | 2 | query | result | jsonb-operators | write |
| ch31-ex03 | Starter `SELECT name FROM items WHERE attributes->'heal' > 10;` fails (42883). Fix it: items healing more than 10 | 2 | query | result | jsonb-operators | fix |
| ch31-ex04 | Return **name** of items of the **Nightshade** set using containment (`@>`) | 2 | query | result | jsonb-operators | write |
| ch31-ex05 | Return **hero_id** of inventories whose `notes` key is **present but JSON null** (2, 6, 13), not those where it is missing | 3 | query | result | jsonb-operators | predict |
| ch31-ex06 | Return one JSON object per guild: `{"guild": name, "heroes": [names sorted]}` as jsonb, one row per guild, guild 6 with an empty array (not NULL) | 3 | query | result | jsonb-construction | write |
| ch31-ex07 | Return **hero_id**, **item** and **qty** (int) for every item in every bag (LATERAL / jsonb_array_elements twice) | 3 | query | result | jsonb-decomposition | write |
| ch31-ex08 | Hero 2 sold 5 Bread Loaves: set `coins.gold` of inventory 2 to 25 and remove the `notes` key, other keys unchanged. verifySql: `doc` of hero 2 | 3 | mutation | state | jsonb-modification | mutate |
| ch31-ex09 | **Boss · The Quartermaster's Audit**: return per hero name (join heroes) the **total item quantity** across bags (0 for empty bags or no bags key, include every inventory row), and a jsonb **array of distinct item names** sorted, `'[]'` when none; order by total desc, hero name (orderMatters) | 4 | query | result | jsonb-decomposition, jsonb-construction, jsonb-operators | write |

- **Practice**: `ch31-pr01` json-vs-jsonb: return the `::json` and `::jsonb` text of `'{"b":1,"a":2,"a":3}'` (predict key order and duplicates); `ch31-pr02` jsonb-operators: items whose `requires.level` is at least 10 (`#>>` with cast); `ch31-pr03` jsonb-operators: items that have a `charges` key (`?`), including the JSON null one; `ch31-pr04` jsonb-construction: return each item as `jsonb_build_object('name', name, 'rarity', rarity)` for legendary items; `ch31-pr05` jsonb-decomposition: list each item's attribute keys (`jsonb_object_keys`) for item 2; `ch31-pr06` jsonb-decomposition: count slots per item with `jsonb_array_length(attributes->'slots')` (NULL when no slots key); `ch31-pr07` jsonb-modification: add `"enchanted": true` to item 17 with `||`; `ch31-pr08` jsonb-modification: remove the `fire` damage of item 2 with `#-`.
- **Negative cases to add**: ex02 reject comparing text `doc->'coins'->>'gold' DESC` (text sort: '980' > '3000'); ex05 reject `doc->>'notes' IS NULL` (also matches missing keys), accept `doc ? 'notes' AND doc->'notes' = 'null'`; ex06 reject `jsonb_agg` without COALESCE (guild 6 gets NULL); ex07 reject a query that drops hero 7 is fine (no items), but check row count; ex08 reject `jsonb_set(doc, '{coins,gold}', '"25"')` (string instead of number); ex09 reject inner join on `jsonb_array_elements` that loses heroes 7, 8 and 24 (use LEFT JOIN LATERAL ... ON true).
- **Notes**: items 1 and 20 differ only by case ('Healing Potion' vs 'healing potion') and both appear in hero 13's bag. Hero 24 has no `bags` key, hero 7 an empty bags array, hero 8 an empty items array. Item 9 has `"charges": null`. `json` text keeps duplicates but the JS driver parses json results: always show `::text` in examples (curriculum Appendix A).

### ch32-deep-json · Deep JSON 🔮
- **File** `src/content/chapters/ch32-deep-json.ts` · **World** The Alchemist's Vault · **Tier** expert · **Track** types · **Dataset** `guild`
- **Subtitle** jsonpath, JSON_TABLE, GIN indexes and the old hstore
- **Concepts** `sql-json-path`, `json-table`, `jsonb-indexing`, `hstore`
- **Prerequisites** `ch31-scrolls-of-json`
- **Lesson** (9 steps)
  1. explain · jsonpath: `$` root, `.key`, `[*]`, filters `? (@.qty > 1)`, `==` inside paths, `like_regex`; lax vs strict.
  2. example · Big stacks: `SELECT hero_id, jsonb_path_query(doc, '$.bags[*].items[*] ? (@.qty > 5).item') FROM inventories;`
  3. quiz · Which test finds inventories holding any fire enchant? (`doc @? '$.bags[*].items[*].enchant.fire'`; distractors use `=` in path, `->>` chains, `?` on nested key)
  4. explain · SQL/JSON functions: `json_exists`, `json_value`, `json_query`, `IS JSON`.
  5. explain · JSON_TABLE turns a document into rows with typed COLUMNS, NESTED PATH for inner arrays.
  6. example · Hero 1's bags as a table: JSON_TABLE with `'$.bags[*]'` and NESTED `'$.items[*]'` (3 rows).
  7. explain · Indexing: GIN `jsonb_ops` serves `@>`, `?`, `@?`; `jsonb_path_ops` is smaller but no `?`; B-tree on `(attributes->>'set')` for equality.
  8. explain · hstore: flat text to text map, `titles->'since'`, `?`, `each()`; values are always text.
  9. try · Return hero_id and title from `hero_titles` (hstore `->`).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch32-ex01 | Return **hero_id** and each **item name** with qty greater than 5 (jsonb_path_query, as text) | 2 | query | result | sql-json-path | write |
| ch32-ex02 | Return **hero_id** of inventories holding at least one item with a **fire** enchant (`@?` or `jsonb_path_exists`): heroes 1, 3, 20 | 2 | query | result | sql-json-path | write |
| ch32-ex03 | Starter uses `'$.bags[*].items[*] ? (@.item = "Torch")'` and errors. Fix it to return hero_id of inventories carrying a Torch | 2 | query | result | sql-json-path | fix |
| ch32-ex04 | With JSON_TABLE, return **hero_id**, **slot**, **item**, **qty** for every item of every inventory (heroes without items produce no rows) | 3 | query | result | json-table | write |
| ch32-ex05 | Create an index that lets `SELECT name FROM items WHERE attributes @> '{"set":"Dragonbone"}'` use a bitmap index scan with `SET enable_seqscan = off` in verifySql; verifySql: `pg_indexes` row for items using gin plus plan check via EXPLAIN in a helper created in setupSql | 3 | ddl | state | jsonb-indexing | optimize |
| ch32-ex06 | Return **hero_id** and **title** of hero_titles where a `granted_by` key exists with a non NULL value | 2 | query | result | hstore | write |
| ch32-ex07 | Return **hero_id**, **key**, **value** of every hstore pair (`each(titles)`), keys sorted per hero (orderMatters with hero_id, key) | 2 | query | result | hstore | write |
| ch32-ex08 | **Boss · The Philosopher's Inventory**: return, per hero who has an inventory, **name** (join heroes), **class**, the hero's `(stats).wis`, the **number of enchanted items** (jsonpath count), the **total enchant power** (sum of every enchant value via jsonb_each_text over each item's enchant, as int), and whether any carried item belongs to a **set** listed in items.attributes (bool); include heroes with nothing (0, 0, false); order by total power desc, name (orderMatters) | 5 | query | result | sql-json-path, json-table, hstore, jsonb-decomposition, composite-types, arrays | write |

- **Practice**: `ch32-pr01` sql-json-path: `jsonb_path_query_array` of all item names of hero 3; `ch32-pr02` sql-json-path: `json_value(doc, '$.coins.gold' RETURNING int)` per inventory (NULL when missing); `ch32-pr03` json-table: items.attributes of item 2 as columns `set`, `level` (from `$.requires.level`), `slots` (json_query); `ch32-pr04` jsonb-indexing: create a `jsonb_path_ops` GIN index on inventories.doc, verify with pg_indexes `indexdef ILIKE '%jsonb_path_ops%'`; `ch32-pr05` jsonb-indexing: create a B-tree expression index on `(attributes->>'set')`, verify indexdef; `ch32-pr06` hstore: convert hero_titles to jsonb with `hstore_to_jsonb` for hero 25; `ch32-pr07` hstore: heroes whose titles have both `title` and `since` (`?&`).
- **Negative cases to add**: ex02 reject `doc->'bags'->0->'items'->0->'enchant' ? 'fire'` (first item only); ex03 the starter (single `=`) must fail, accept `like_regex "^Torch$"`; ex06 reject `titles ? 'granted_by'` (keeps hero 19 whose value is NULL); ex08 reject an inner join that loses heroes without items, reject counting items instead of enchanted items.
- **Notes**: `@?` and `@@` need the path as a jsonpath literal; `"` inside paths, `'` around the SQL literal. Plan checks need `SET enable_seqscan = off` (items has 21 rows): put it in verifySql before calling a setupSql helper `plan_nodes_of(q text)` (same body as dungeon's plan_nodes). This is the World 8 boss (the curriculum's Philosopher's Inventory) even though ch33 comes after it on the map.

### ch33-bound-by-time · Bound by Time ⌛
- **File** `src/content/chapters/ch33-bound-by-time.ts` · **World** The Alchemist's Vault · **Tier** expert · **Track** types · **Dataset** `inn`
- **Subtitle** Instants, local clocks, ranges, multiranges and the end of double bookings
- **Concepts** `timezones`, `range-types`, `multirange-types`, `temporal-constraints`
- **Prerequisites** `ch30-shaped-data`
- **Lesson** (10 steps)
  1. explain · timestamptz is an instant; the session TimeZone (GMT here) only changes how it is displayed.
  2. example · Same instant, three clocks: `SELECT checked_in_at, checked_in_at AT TIME ZONE 'Asia/Tokyo' AS tokyo, checked_in_at AT TIME ZONE 'Europe/Paris' AS paris FROM bookings WHERE id = 3;`
  3. quiz · `timestamptz AT TIME ZONE 'Asia/Tokyo'` returns? (a timestamp without zone = Tokyo wall clock; misconception: it converts the instant)
  4. explain · DST: `'1 day'` is not always 24 hours; staff shift 10 of Odile crosses the Paris change and lasts 7 hours.
  5. explain · Ranges: `daterange '[2026-03-20,2026-03-23)'`, half open bounds, `&&` overlap, `@>` contains, `-|-` adjacent, `lower`/`upper`.
  6. example · Who is in the inn on 2026-03-21?: `SELECT id, room_id, stay FROM bookings WHERE stay @> date '2026-03-21' AND status <> 'cancelled';`
  7. explain · Multiranges: `range_agg(stay)` merges a room's stays; subtract from a month to get free nights.
  8. example · Free nights of The Last Room in March: `SELECT datemultirange(daterange('2026-03-01','2026-04-01')) - range_agg(stay) FROM bookings WHERE room_id = 14 AND status <> 'cancelled';`
  9. explain · No double booking: `EXCLUDE USING gist (room_id WITH =, stay WITH &&)` (needs btree_gist, loaded) or PG18 `PRIMARY KEY (room_id, stay WITHOUT OVERLAPS)`; violations raise 23P01.
  10. try · Return id and stay of bookings that touch (`-|-`) booking 3's stay in the same room.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch33-ex01 | Return **id** and the local check-in **wall clock time** (`checked_in_at AT TIME ZONE realm timezone`) of checked-in or checked-out bookings, joining rooms and realms (booking 9 stays NULL) | 2 | query | result | timezones | write |
| ch33-ex02 | Starter computes local time with `AT TIME ZONE 'UTC'` for everyone. Fix it to use each realm's timezone and return the **local date** of check-in for booking 3 (2026-01-10, the late Tokyo arrival) and booking 6 (Chatham) | 3 | query | result | timezones | fix |
| ch33-ex03 | Return **staff_name**, **id** and the real duration `upper(shift) - lower(shift)` of shifts that are not exactly 8 hours (Odile's DST shift) | 2 | query | result | timezones | predict |
| ch33-ex04 | Return **id**, **room_id**, **stay** of non cancelled bookings whose stay contains **2026-03-21** | 1 | query | result | range-types | write |
| ch33-ex05 | Find the double booking: return the two booking ids (`a.id < b.id`) of non cancelled bookings of the same room whose stays overlap (exactly 30 and 31) | 3 | query | result | range-types | write |
| ch33-ex06 | Return per **staff_name** the merged shifts as a multirange (`range_agg(shift)`), staff sorted by name (orderMatters) | 3 | query | result | multirange-types | write |
| ch33-ex07 | Return the **free nights** of room 14 in March 2026 as a datemultirange (`{[2026-03-03,2026-03-20),[2026-03-24,2026-04-01)}`) | 3 | query | result | multirange-types | write |
| ch33-ex08 | Add constraint `no_double_booking` to bookings (no two non cancelled stays of the same room may overlap): the plain ALTER fails with 23P01 until the conflict is resolved, so cancel booking 31 first, then add `EXCLUDE USING gist (room_id WITH =, stay WITH &&) WHERE (status <> 'cancelled')`. verifySql: status of 31, constraint present in pg_constraint (contype 'x'), and `try_sqlstate('INSERT ... overlapping room 14')` = '23P01' via a setupSql helper | 4 | ddl | state | temporal-constraints | design |
| ch33-ex09 | **Boss · The Night Clerk's Calendar**: for each room of realm 1 (Paris), return **room name**, its booked nights in March 2026 as a multirange of non cancelled stays clipped to March (`range_agg(stay * '[2026-03-01,2026-04-01)')`), the **number of free nights** in March (31 minus booked nights, computed by unnesting the free multirange), and the **local Paris check-in time** of its first March arrival at 15:00 local expressed as a UTC timestamptz (`(lower(stay) + time '15:00') AT TIME ZONE 'Europe/Paris'`, NULL when none); rooms without March bookings show an empty or NULL multirange (say which: use `coalesce(..., '{}')`) and 31 free nights; order by room name (orderMatters) | 5 | query | result | range-types, multirange-types, timezones | write |

- **Practice**: `ch33-pr01` timezones: return `now()`-free conversion: `timestamptz '2026-03-29 00:30+00' AT TIME ZONE 'Europe/Paris'` (predict 01:30 then DST); `ch33-pr02` timezones: count bookings created (created_at) on 2026-03-14 in UTC; `ch33-pr03` range-types: rate seasons overlapping booking 20 (two rows: Sakura Season and Lantern Festival); `ch33-pr04` range-types: bookings adjacent to another booking of the same room (`-|-`): pairs (3,4), (11,27), (22,29); `ch33-pr05` multirange-types: total booked nights per room with `sum(upper(s) - lower(s))` over `unnest(range_agg(stay))`; `ch33-pr06` temporal-constraints: insert a booking overlapping booking 17 after adding the constraint (setupSql adds it): error 23P01; `ch33-pr07` temporal-constraints: create table `room_holds (room_id int, hold daterange, PRIMARY KEY (room_id, hold WITHOUT OVERLAPS))`, verify by inserting two overlapping holds in verify helper.
- **Negative cases to add**: ex01 reject `AT TIME ZONE 'UTC'`; ex05 reject a self join without `a.id < b.id` (mirrored pairs and self pairs), reject forgetting the cancelled filter (adds no pair here? check: booking 8 is cancelled in room 3 alone, so equal; only keep rejects that differ); ex07 reject including cancelled bookings only if different; ex09 reject `upper - lower` on unclipped stays (booking 1 crosses months? check), accept `generate_series` day counting.
- **Notes**: booking 17 has NULL `checked_in_at` (confirmed, not arrived). Bookings 17 and 24 cover the Paris DST night (2026-03-29). Room 7 amenities NULL (irrelevant here). ALTER TABLE ADD EXCLUDE without the WHERE fails with 23P01 because of 30/31; with the WHERE it still fails until 31 is cancelled. `try_sqlstate(sql text) returns text` helper in setupSql (plpgsql EXECUTE + EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE).

### ch34-exotic-matter ◇ · Exotic Matter 💎
- **File** `src/content/chapters/ch34-exotic-matter.ts` · **World** The Alchemist's Vault · **Tier** expert · **Track** types · **Dataset** `library`
- **Subtitle** Side quest: networks, bytes, shapes, paths, case blind text and secret hashes
- **Concepts** `network-types`, `bytea-binary`, `geometric-types`, `ltree`, `case-insensitive-text`, `pgcrypto-hashing`
- **Prerequisites** `ch30-shaped-data`, `ch28-cursed-designs`
- **Lesson** (10 steps)
  1. explain · inet and cidr: `ip << network` (is inside), `masklen`, `host`, `family`; IPs as text cannot do this.
  2. example · Banned visitors: `SELECT a.id, a.ip, n.reason FROM access_log a JOIN banned_networks n ON a.ip << n.network;`
  3. explain · bytea shows as hex; `encode(checksum, 'hex')`, `md5(body)` returns text, `decode(..., 'hex')` makes bytes.
  4. explain · Built-in geometry: point, box, circle; `<->` distance, `@>` contains (no PostGIS, no earthdistance in this dataset).
  5. explain · ltree: `path <@ 'arcana'` (descendants), `@>` (ancestors), `nlevel`, `subpath`, lquery `~ '*.fire.*'`.
  6. example · The Arcana wing: `SELECT name, path, nlevel(path) FROM sections WHERE path <@ 'arcana' ORDER BY path;`
  7. explain · Case blind text: citext (`readers.email`), `lower()` with a unique index, ICU nondeterministic collations, PG18 `casefold()`.
  8. quiz · How do you check a reader's password against `password_hash`? (`password_hash = crypt('input', password_hash)`; distractors: `= crypt('input', gen_salt('bf'))`, `= md5('input')`, decrypt the hash)
  9. explain · pgcrypto: `crypt` + `gen_salt('bf')` for passwords, `digest(body, 'sha256')` for checksums; hashes are one way.
  10. try · Return the id of the scroll whose stored checksum does not match `decode(md5(body), 'hex')`.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch34-ex01 | Return **id**, **ip** and **reason** of access_log rows coming from a banned network (12, 13, 19) | 2 | query | result | network-types | write |
| ch34-ex02 | Return each distinct **/24 network** (`set_masklen(ip::cidr, 24)` or `network(set_masklen(ip,24))`) of IPv4 visits with its visit count, IPv6 excluded via `family(ip) = 4` | 3 | query | result | network-types | write |
| ch34-ex03 | Return **id** and **title** of tampered scrolls: stored checksum differs from the md5 of the body (only 21) | 2 | query | result | bytea-binary | write |
| ch34-ex04 | setupSql creates `reading_rooms(name text, seat point)` with 6 rows. Return the **name** of the 2 rooms nearest to point(0,0), nearest first (no ties in data) | 2 | query | result, orderMatters | geometric-types | write |
| ch34-ex05 | Return **name** and **path** of every section **under** `history` (descendants, not history itself), path order (orderMatters) | 2 | query | result | ltree | write |
| ch34-ex06 | Starter `SELECT name FROM readers WHERE email = 'garrick.holt@aethel.lib'::text` returns nothing because of the text cast. Fix it so the case blind citext comparison finds Garrick | 2 | query | result | case-insensitive-text | fix |
| ch34-ex07 | Return the **name** of the reader whose password is **hunter2** (crypt check) | 2 | query | result | pgcrypto-hashing | write |
| ch34-ex08 | **Boss · The Warden's Sweep**: return the **name** of readers (NULL readers excluded) who accessed, from a banned network or from the IPv6 range `2001:db8::/32`, a scroll in the `arcana.forbidden` subtree, together with the **sha256 hex digest** of that scroll's title; also add any reader whose password is in the leaked list `{'letmein','password','qwerty'}` with a NULL digest; one row per reader and scroll | 5 | query | result | network-types, ltree, pgcrypto-hashing, bytea-binary | write |

- **Practice**: `ch34-pr01` network-types: masklen of each banned network; `ch34-pr02` bytea-binary: `encode(checksum, 'base64')` of scroll 1; `ch34-pr03` geometric-types: does `box '((0,0),(10,10))'` contain `point '(3,4)'` (predict true) and the distance `point(0,0) <-> point(3,4)` (5); `ch34-pr04` ltree: ancestors of `arcana.forbidden.necromancy` (`@>`), path order; `ch34-pr05` ltree: sections at depth 2 (`nlevel = 2`); `ch34-pr06` case-insensitive-text: count readers per `lower(email)` domain part; `ch34-pr07` pgcrypto-hashing: readers using one of the leaked passwords `{'letmein','password','qwerty'}` (3 readers: Bram, Wendeline, Stephen); `ch34-pr08` pgcrypto-hashing: `digest('Aethel', 'sha256')` length in bytes (32, predict).
- **Negative cases to add**: ex01 reject `host(ip) LIKE '203.0.113.%'` only if different (it misses the other networks: reject); ex03 reject `checksum <> md5(body)::bytea` (text bytes, every row differs); ex05 reject `path <@ 'history'` without excluding the root; ex06 reject `lower(email) = ...` is fine (accept it); ex07 reject `password_hash = crypt('hunter2', gen_salt('bf'))` (new salt never matches).
- **Notes**: `geometric-types` has no data in library: create it in exercise setupSql (`reading_rooms`), cube/earthdistance are not loaded for this dataset, keep earthdistance to an explain card. Passwords are in `columnNotes` (bcrypt cost 4, cheap enough per row). `crypt` per row over 13 readers is fast. sections paths: check them in library.ts before writing missions about `history` (depth and names).

## 12. World 9: The Oracle's Library (search)

### ch35-words-of-power · Words of Power 🪄
- **File** `src/content/chapters/ch35-words-of-power.ts` · **World** The Oracle's Library · **Tier** expert · **Track** types · **Dataset** `library`
- **Subtitle** Full-text search in two languages, ranking, highlighting and forgiving typos
- **Concepts** `full-text-search`, `fts-ranking-highlighting`, `fts-indexing`, `trigram-search`, `fuzzy-string-matching`
- **Prerequisites** `ch33-bound-by-time`
- **Lesson** (10 steps)
  1. explain · `LIKE '%dragon%'` is the poor man's search engine: no stemming, no ranking, no index.
  2. example · Lexemes: `SELECT to_tsvector('english', 'The dragons were burning'), to_tsquery('english', 'dragon & burn');`
  3. explain · `tsvector @@ tsquery`; configs matter: english stems, french stems differently, `simple` does not; this database defaults to english.
  4. quiz · Why does `to_tsvector('english', body) @@ to_tsquery('simple', 'dragons')` miss scrolls? (config mismatch: 'dragon' vs 'dragons')
  5. explain · Raw user input: use `websearch_to_tsquery` (quotes, `or`, `-`) instead of `to_tsquery` (syntax errors 42601).
  6. example · Ranked: `SELECT title, ts_rank(to_tsvector('english', body), q) AS rank FROM scrolls, websearch_to_tsquery('english','dragon fire') q WHERE to_tsvector('english', body) @@ q ORDER BY rank DESC;`
  7. explain · `setweight` (title A, body B) and `ts_headline` to highlight matches.
  8. explain · Indexing: a STORED generated tsvector column + GIN index; the config in the column must match the query.
  9. explain · Fuzzy: pg_trgm `similarity`, `%`, `<->`; fuzzystrmatch `levenshtein`, `soundex`, `dmetaphone`; `unaccent` for accents.
  10. try · Return id and title of english scrolls matching `kraken`.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch35-ex01 | Return **id** and **title** of english scrolls whose body matches both **dragon** and **fire** (english config): 1, 2, 4, 6, 17 | 2 | query | result | full-text-search | write |
| ch35-ex02 | Starter uses `body ILIKE '%burned%'`. Rewrite with FTS so every form of **burn** (burning, burned, burns) matches in english scrolls | 2 | query | result | full-text-search | refactor |
| ch35-ex03 | Return **id** and **title** of french scrolls matching **sorcière** with the french config and unaccent on both sides (25) | 3 | query | result | full-text-search | write |
| ch35-ex04 | Return the **title** and `ts_rank` (rounded to 4 decimals) of english scrolls matching the web search `dragon fire`, best first, ties by title (orderMatters) | 3 | query | result | fts-ranking-highlighting | write |
| ch35-ex05 | Return **title** and `ts_headline('english', body, q, 'StartSel=[,StopSel=]')` of scrolls matching `kraken` (deterministic text) | 3 | query | result | fts-ranking-highlighting | write |
| ch35-ex06 | Add a STORED generated column `search` = `setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', body), 'B')` and a GIN index on it. verifySql: generation expression from information_schema.columns + `pg_indexes` gin row + a search result through the column | 3 | ddl | state | fts-indexing | design |
| ch35-ex07 | A reader typed **Isolde Maro**. Return **name** and `similarity` (rounded to 3) of readers with similarity above 0.3, best first, ties by name (orderMatters) | 3 | query | result | trigram-search | write |
| ch35-ex08 | Return the **name** of readers whose first name sounds like **Steven** (soundex) or is within **2 edits** of **Catherine** (levenshtein on lower first names): Stephen, Katherine | 3 | query | result | fuzzy-string-matching | write |
| ch35-ex09 | **Boss · The Librarian's Oracle**: one query (CTEs welcome) that searches english and french scrolls for the user input `dragon fire` with the right config per language (`websearch_to_tsquery` per language, unaccent for french), ranks with title weighted A and body B, returns **id**, **title**, **language** and rank rounded to 4; plus scrolls whose **author** is within trigram similarity 0.4 of the typo `Ellowen Thrise`, with rank 0; deduplicated, ordered by rank desc then id (orderMatters) | 5 | query | result | full-text-search, fts-ranking-highlighting, trigram-search, fuzzy-string-matching | write |

- **Practice**: `ch35-pr01` full-text-search: count english scrolls matching `kraken | serpent`; `ch35-pr02` full-text-search: show `to_tsvector('simple', ...)` vs `('english', ...)` of a sentence (predict stop words); `ch35-pr03` fts-ranking-highlighting: top 3 by `ts_rank_cd` for `war`, ties by id; `ch35-pr04` fts-indexing: create a GIN expression index on `to_tsvector('english', body)`, verify indexdef; `ch35-pr05` trigram-search: readers whose name matches `% 'Ysold'` (trigram operator); `ch35-pr06` trigram-search: `show_trgm('Isolde')` (predict); `ch35-pr07` fuzzy-string-matching: `levenshtein('Ysolde','Isolde')` (1); `ch35-pr08` fuzzy-string-matching: readers whose `unaccent(name)` starts with 'Celeste'.
- **Negative cases to add**: ex01 reject `to_tsquery('simple', ...)`, reject `ILIKE '%dragon%' AND ILIKE '%fire%'` (differs: matches 'firewood'? check data, keep only if different); ex02 the ILIKE starter must fail (it misses 'burning'); ex03 reject english config on french; ex04 reject ordering by rank without the `@@` filter (extra rows with rank 0); ex07 reject `name LIKE 'Isolde%'` (misses Ysolde); ex09 reject using the english config for french scrolls.
- **Notes**: library sets `default_text_search_config = english`, but exercises must always pass the config explicitly (graded configs). `ts_rank` values are floats: use rounding or tolerance. scroll 21 is tampered (not relevant here). Readers: Ysolde/Isolde Marrow (trigram), Céleste (unaccent), Stephen (soundex vs Steven), Katherine (dmetaphone vs Catherine). Check exact similarity numbers with a probe before fixing thresholds (Isolde vs Ysolde Marrow is 0.235 on 'Isolde' alone).

### ch36-vector-constellations · Vector Constellations ✨
- **File** `src/content/chapters/ch36-vector-constellations.ts` · **World** The Oracle's Library · **Tier** master · **Track** types · **Dataset** `bardic`
- **Subtitle** Embeddings, nearest neighbours, vector indexes and hybrid search
- **Concepts** `vector-basics`, `vector-knn-search`, `vector-indexes`, `hybrid-search`
- **Prerequisites** `ch35-words-of-power`, `ch13-unions-and-named-spells`
- **Lesson** (10 steps)
  1. explain · An embedding is a list of numbers; here 4 dims: [energy, darkness, acoustic, tempo]. Similar tracks have nearby vectors.
  2. example · Meet the vectors: `SELECT title, mood, embedding FROM tracks ORDER BY id LIMIT 6;`
  3. explain · Distances: `<->` Euclidean, `<=>` cosine distance (1 minus similarity), `<#>` NEGATIVE inner product, `<+>` L1.
  4. quiz · You want the 3 most similar tracks. Which ORDER BY? (`embedding <=> q ASC LIMIT 3`; distractors: DESC, `<#>` DESC, no LIMIT)
  5. example · Calm forest night: `SELECT t.title, t.genre FROM tracks t, query_vectors q WHERE q.label = 'calm forest night' ORDER BY t.embedding <-> q.embedding LIMIT 3;`
  6. explain · Mixing dimensions raises 22000; vectors compare only within one space.
  7. explain · A 3 line EXPLAIN primer: Seq Scan vs Index Scan in a plan (full EXPLAIN comes in World 10).
  8. explain · HNSW (m, ef_construction, `hnsw.ef_search`) and IVFFlat (lists, probes); the opclass must match the operator (`vector_cosine_ops` for `<=>`); approximate results; tiny tables prefer Seq Scan.
  9. explain · Hybrid search: rank by FTS and by vector distance separately, fuse with Reciprocal Rank Fusion `1/(60 + rank)`.
  10. try · Return the title of the single track closest (cosine) to the `dragon fight` query vector.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch36-ex01 | Return **title** and the Euclidean distance (rounded to 4) between each track of album 1 and the `tavern brawl` vector | 2 | query | result | vector-basics | write |
| ch36-ex02 | Starter `SELECT '[1,2,3]'::vector <-> embedding FROM tracks` fails with 22000. Fix it by comparing with a 4 dimensional vector `[1,1,1,1]` and return title and distance rounded to 4 | 2 | query | result | vector-basics | fix |
| ch36-ex03 | Return the **title** of the 5 tracks closest by **cosine distance** to `goblin rave`, closest first (verify no tie at rank 5) | 2 | query | result, orderMatters | vector-knn-search | write |
| ch36-ex04 | Same as ex03 but only among tracks that are **not explicit**, and return title and `1 - cosine distance` as **similarity** rounded to 4 | 3 | query | result, orderMatters | vector-knn-search | write |
| ch36-ex05 | For each `query_vectors` label, return the **label** and the **title** of its nearest track (Euclidean), one row per label (LATERAL) | 3 | query | result | vector-knn-search | write |
| ch36-ex06 | Create an HNSW index for cosine search on tracks.embedding. verifySql: `pg_indexes.indexdef` contains `hnsw` and `vector_cosine_ops`, and `plan_nodes`-style helper (setupSql) shows an Index Scan for `ORDER BY embedding <=> '[...]' LIMIT 5` under `SET enable_seqscan = off` | 3 | ddl | state | vector-indexes | optimize |
| ch36-ex07 | The starter index `USING hnsw (embedding vector_l2_ops)` is never used by the cosine query. Fix it (drop and recreate with the right opclass); same verify as ex06 | 3 | ddl | state | vector-indexes | fix |
| ch36-ex08 | **Boss · The Oracle's Riddle**: a listener asks for "fire dragon gold" and misspells the artist "Safron Drak". Return the top 5 tracks by **RRF score** combining (a) FTS rank on `lyrics_tsv` with `websearch_to_tsquery('english','fire dragon gold')` and (b) cosine distance to the `dragon fight` vector, each list limited to its top 10, `score = sum(1.0 / (60 + rank))`, plus a bonus of `1.0 / 61` for tracks whose artist name has trigram similarity above 0.4 with the typo; return **title** and score rounded to 5, best first, ties by title (orderMatters) | 5 | query | result | hybrid-search, vector-knn-search, full-text-search, trigram-search | write |

- **Practice**: `ch36-pr01` vector-basics: `vector_dims` and `vector_norm` of track 1's embedding; `ch36-pr02` vector-basics: `'[1,0,0,0]'::vector <#> '[1,0,0,0]'` (predict -1, negative inner product); `ch36-pr03` vector-knn-search: 3 nearest tracks to track 10 itself (exclude it); `ch36-pr04` vector-knn-search: nearest track per genre to `starlit drift` (DISTINCT ON genre); `ch36-pr05` vector-indexes: create an IVFFlat index with `lists = 4` for L2, verify indexdef; `ch36-pr06` hybrid-search: RRF of two given rankings built with VALUES (pure arithmetic, predict the winner); `ch36-pr07` hybrid-search: FTS top 5 for `moon night` with `ts_rank` rounded, ties by title.
- **Negative cases to add**: ex03 reject `ORDER BY ... DESC` (farthest), reject `<#>` ascending (inner product ranks differently), accept `ORDER BY embedding <=> (SELECT embedding FROM query_vectors WHERE label = 'goblin rave')`; ex04 reject filtering after LIMIT (subquery then filter) which returns fewer rows; ex05 reject a plain join without LIMIT per label; ex08 reject adding raw ts_rank and distance (different scales).
- **Notes**: tracks 6, 7, 8, 32, 33 are instrumentals with NULL lyrics (no FTS hit, still vectors). 36 tracks only: index plans need `SET enable_seqscan = off` in verifySql (allowed). Distances are floats: round in prompts, or set `tolerance`. Check ties at every LIMIT boundary with a probe before publishing. `query_vectors` labels: calm forest night, tavern brawl, dragon fight, goblin rave, haunted crypt, starlit drift. The ch36 lesson must carry its own tiny EXPLAIN primer (`explain-basics` is taught in ch37).

## 13. World 10: The Clockwork Engine (performance)

All World 10 chapters use `run_archive` (100 000 rows, only a primary key, no FKs). Facts verified on the built dataset: `season_id` is 1 to 3 only (no season 4 in the archive), max `score` 5229, `status` = finished 88000 / abandoned 10000 / in_progress 2000, `region` eu 60000 / na 15000 / asia 15000 / sa 10000, players 1 to 3 own about 12 900 rows each and every other player about 2 900, `tags` has 'cursed' on 100 rows, `death_cause` values are capitalised ('Lava Golem', NULL on 15 826 rows), `started_at` grows with id from 2025-01-01 to 2025-12-14. Helpers: `plan_json(text)` and `plan_nodes(text)` (COSTS OFF). Each sandbox is a fresh clone, so an index created by the learner is graded in the same sandbox via verifySql. Plans verified: `season_id = 3 ORDER BY score DESC LIMIT 10` goes from `{Limit,Sort,Seq Scan}` to `{Limit,Index Scan}` with `(season_id, score DESC)`; partial index on `(started_at) WHERE status = 'in_progress'` gives `{Index Scan}`; GIN on tags gives Bitmap scans for `tags @> '{cursed}'`; BRIN on started_at gives Bitmap scans for a one day range; `lower(death_cause)` index gives Bitmap scans; `(player_id) INCLUDE (score)` gives `Index Only Scan` only after `VACUUM run_archive`; `region = 'eu'` stays Seq Scan even with an index while `region = 'sa'` uses it; `started_at::date = ...` stays Seq Scan with a B-tree on started_at; inlined CTE uses the PK, `MATERIALIZED` gives `{CTE Scan,Seq Scan}`. Statistics views need `SELECT pg_stat_force_next_flush();` before reading counters.

### ch37-reading-the-runes · Reading the Runes 📖
- **File** `src/content/chapters/ch37-reading-the-runes.ts` · **World** The Clockwork Engine · **Tier** adept · **Track** performance · **Dataset** `dungeon`
- **Subtitle** EXPLAIN, plan nodes, estimates vs reality, and how tables get joined
- **Concepts** `explain-basics`, `explain-analyze`, `scan-types`, `join-algorithms`
- **Prerequisites** `ch18-the-grand-report`, `ch28-cursed-designs`
- **Lesson** (9 steps)
  1. explain · EXPLAIN shows the plan: a tree of nodes, read from the innermost (most indented) up; cost is in arbitrary units, not ms.
  2. example · First rune: `EXPLAIN SELECT * FROM run_archive WHERE player_id = 7;` (Seq Scan with a Filter, rows estimate).
  3. quiz · `cost=0.00..2137.00` means? (startup and total cost in planner units; misconception: milliseconds)
  4. explain · EXPLAIN ANALYZE runs the query: actual rows, loops, buffers (shared hit/read); compare estimate vs actual. Wrap DML in BEGIN/ROLLBACK.
  5. example · `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT count(*) FROM run_archive WHERE region = 'sa';`
  6. explain · Scan types: Seq Scan, Index Scan, Index Only Scan, Bitmap Index Scan + Bitmap Heap Scan.
  7. example · `SELECT plan_nodes('SELECT * FROM run_archive WHERE id = 7');` vs `'... WHERE score > 100'` (helper shows node types).
  8. explain · Join algorithms: Nested Loop (small outer side, indexed inner), Hash Join (big unsorted inputs), Merge Join (sorted inputs).
  9. try · Return the node types of the plan of `SELECT * FROM run_archive WHERE id BETWEEN 10 AND 20` with plan_nodes.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch37-ex01 | Run EXPLAIN on `SELECT * FROM run_archive WHERE dungeon_id = 2` and answer with `SELECT '<top node type>'` (Seq Scan) | 1 | query | result | explain-basics | predict |
| ch37-ex02 | From `EXPLAIN SELECT * FROM run_archive WHERE region = 'sa'`, answer with a final `SELECT` of the planner's **estimated rows** (read it from the plan; equal to 10000 after ANALYZE, verify with a probe) | 2 | query | result | explain-basics | predict |
| ch37-ex03 | Using `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)`, answer with the **actual rows** returned by the scan of `SELECT * FROM run_archive WHERE status = 'in_progress'` (2000) | 2 | query | result | explain-analyze | predict |
| ch37-ex04 | Starter runs `EXPLAIN ANALYZE DELETE FROM run_archive WHERE status = 'abandoned'` and the rows are gone. Fix it so the plan is shown but the data survives (BEGIN; EXPLAIN ANALYZE ...; ROLLBACK). verifySql: count of abandoned rows (10000) | 3 | transaction | state | explain-analyze | fix |
| ch37-ex05 | Return `plan_nodes(...)` for `SELECT id FROM run_archive WHERE id < 100` and for `SELECT * FROM run_archive` as two columns | 2 | query | result | scan-types | write |
| ch37-ex06 | Create any index that turns the plan of `SELECT * FROM run_archive WHERE player_id = 20` into a Bitmap or Index scan. verifySql: `plan_nodes('SELECT * FROM run_archive WHERE player_id = 20') && ARRAY['Index Scan','Bitmap Index Scan','Index Only Scan']` | 2 | ddl | state | scan-types | optimize |
| ch37-ex07 | Answer with the join node type of `SELECT r.id, p.handle FROM run_archive r JOIN players p ON p.id = r.player_id` (Hash Join) and, after `CREATE INDEX ON run_archive (player_id)`, of the same join filtered on `p.id = 7` (Nested Loop): return both as two columns via plan_nodes | 3 | query | result | join-algorithms | predict |
| ch37-ex08 | **Boss · The Rune Reader**: for three given queries (a PK lookup, a 60% region filter, a players to run_archive join on one player after an index), return one row per query with its **label**, its **top scan node** and its **join node** (NULL when none), built from `plan_nodes` in one SELECT (VALUES list of labelled queries + LATERAL); learner must create the needed index first | 4 | query | result | explain-basics, scan-types, join-algorithms | write |

- **Practice**: `ch37-pr01` explain-basics: answer the estimated row count of a full scan of `players` (25); `ch37-pr02` explain-basics: which node is on top of `SELECT count(*) FROM run_archive`? (Aggregate); `ch37-pr03` explain-analyze: actual loops of the inner side of a nested loop (predict from given plan text); `ch37-pr04` explain-analyze: read `Buffers` of a PK lookup and answer whether shared hit > 0 (true); `ch37-pr05` scan-types: plan_nodes of `WHERE region = 'eu'` after creating an index on region (still Seq Scan: predict); `ch37-pr06` join-algorithms: `SET enable_hashjoin = off;` then answer the join node of the full join (Merge Join or Nested Loop: verify with a probe first).
- **Negative cases to add**: ex01 reject `'Index Scan'`; ex04 reject running the starter (state has 0 abandoned rows); ex06 reject an index on region; ex07 reject swapped columns.
- **Notes**: EXPLAIN output text (QUERY PLAN rows) is not a stable thing to compare: missions answer with a final SELECT of a value, or use plan_nodes. Answers must be computed in the same sandbox if they depend on statistics: verify every estimate with a probe on the built dataset (ANALYZE runs at setup). `SET enable_*` is allowed (not forbidden). Never grade timings.

### ch38-index-forging · Index Forging 🗝️
- **File** `src/content/chapters/ch38-index-forging.ts` · **World** The Clockwork Engine · **Tier** expert · **Track** performance · **Dataset** `dungeon`
- **Subtitle** B-trees, column order, partial, expression, covering and specialist indexes
- **Concepts** `btree-index`, `multicolumn-index`, `partial-index`, `expression-index`, `covering-index`, `gin-gist-brin-hash`
- **Prerequisites** `ch37-reading-the-runes`
- **Lesson** (10 steps)
  1. explain · A B-tree is a sorted tree of keys with a linked leaf chain: equality, ranges, `ORDER BY`, `LIKE 'prefix%'`; every index slows writes.
  2. example · Before and after: `SELECT plan_nodes('SELECT * FROM run_archive WHERE player_id = 20');` then `CREATE INDEX ...`, then again.
  3. explain · Multicolumn: equality columns first, then the range or sort column; `(season_id, score DESC)` serves `WHERE season_id = 3 ORDER BY score DESC LIMIT 10` with no Sort.
  4. quiz · Index `(score, season_id)` vs `(season_id, score)` for `WHERE season_id = 3 AND score > 5000`? (equality first; PG18 skip scan helps the other way but less)
  5. explain · Partial index: `WHERE status = 'in_progress'` indexes 2% of rows; the query must imply the predicate.
  6. explain · Expression index: `lower(death_cause)`; the query must use the same expression; functions must be IMMUTABLE (42P17).
  7. explain · Covering: `INCLUDE (score)` + visibility map: Index Only Scan appears after `VACUUM` (autovacuum never runs here).
  8. example · `CREATE INDEX ON run_archive (player_id) INCLUDE (score); VACUUM run_archive; SELECT plan_nodes('SELECT player_id, score FROM run_archive WHERE player_id = 20');`
  9. explain · GIN (arrays, jsonb, FTS, trigram), GiST (ranges, exclusion), BRIN (huge naturally ordered columns like started_at), hash (equality only).
  10. try · Create an index so `SELECT * FROM run_archive WHERE player_id = 20` is no longer a Seq Scan.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch38-ex01 | Make `SELECT * FROM run_archive WHERE dungeon_id = 5 AND player_id = 20` use an index (verify plan_nodes contains an index node) | 2 | ddl | state | btree-index | optimize |
| ch38-ex02 | Create the index that makes `SELECT id, score FROM run_archive WHERE season_id = 3 ORDER BY score DESC LIMIT 10` plan as exactly `{Limit,Index Scan}` (no Sort); also return the 10 rows (result+state) | 3 | ddl | result+state | multicolumn-index | optimize |
| ch38-ex03 | Starter creates `(score DESC, season_id)` and the plan still sorts. Fix the column order (drop and recreate); verify plan_nodes has no 'Sort' | 3 | ddl | state | multicolumn-index | fix |
| ch38-ex04 | Create a **partial** index so `SELECT id, started_at FROM run_archive WHERE status = 'in_progress' ORDER BY started_at` is an Index Scan; verifySql also checks `pg_indexes.indexdef ILIKE '%WHERE%'` and the index size is under 10% of a full one (`pg_relation_size`) | 3 | ddl | state | partial-index | optimize |
| ch38-ex05 | Make `SELECT * FROM run_archive WHERE lower(death_cause) = 'lava golem'` use an index (expression index) | 3 | ddl | state | expression-index | optimize |
| ch38-ex06 | Make `SELECT player_id, score FROM run_archive WHERE player_id = 20` an **Index Only Scan** (covering index plus VACUUM as its own statement) | 4 | ddl | state | covering-index | optimize |
| ch38-ex07 | Make `SELECT id FROM run_archive WHERE tags @> '{cursed}'` use a GIN index, and `SELECT count(*) FROM run_archive WHERE started_at >= '2025-06-01' AND started_at < '2025-06-02'` use a BRIN index (both verified by plan_nodes and by `pg_indexes.indexdef ILIKE '%USING brin%'`) | 4 | ddl | state | gin-gist-brin-hash | optimize |
| ch38-ex08 | **Boss · The Smith's Masterwork**: with **at most 3 new indexes** (verify count in pg_indexes), make all four queries index driven: the season leaderboard (ex02), the in-progress list (ex04), the cursed tag search (ex07) and the per-player covering lookup (ex06, Index Only after VACUUM). verifySql returns one boolean per query plus the index count | 5 | ddl | state | btree-index, multicolumn-index, partial-index, covering-index, gin-gist-brin-hash | optimize |

- **Practice**: `ch38-pr01` btree-index: index for `WHERE seed = 123456` (unique-ish), verify plan; `ch38-pr02` btree-index: answer whether `LIKE 'Lava%'` on death_cause can use a plain B-tree in the C collation (true: predict, then verify); `ch38-pr03` multicolumn-index: create `(region, started_at)` and verify `WHERE region = 'sa' AND started_at > '2025-12-01'` uses it; `ch38-pr04` partial-index: partial index on `(score) WHERE status = 'abandoned'`, verify it serves `WHERE status = 'abandoned' AND score > 5000`; `ch38-pr05` expression-index: index `(date_trunc('day', started_at AT TIME ZONE 'UTC'))` fails or succeeds? (IMMUTABLE expression with explicit zone succeeds; plain `started_at::date` fails 42P17: error check); `ch38-pr06` covering-index: INCLUDE vs key column: create `(season_id) INCLUDE (score)` and verify Index Only Scan for `SELECT season_id, score ... WHERE season_id = 1` after VACUUM; `ch38-pr07` gin-gist-brin-hash: hash index on seed, verify `USING hash`; `ch38-pr08` gin-gist-brin-hash: GiST index on `seasons.during` (tstzrange), verify indexdef.
- **Negative cases to add**: ex02 reject `(score DESC, season_id)` (still sorts), reject `(season_id)` alone; ex04 reject a full index on status (plan may use it but size check fails); ex05 reject an index on `death_cause` (no lower); ex06 reject the covering index without VACUUM (Bitmap Heap Scan); ex07 reject a B-tree on tags.
- **Notes**: `VACUUM` must be its own statement (the app splits statements, so `CREATE INDEX ...; VACUUM run_archive;` works). The plan of `WHERE score > 9000` returns nothing useful: max score is 5229. Index creation on 100k rows takes about 100 ms: fine.

### ch39-why-not-my-index · Why Not My Index? 🧐
- **File** `src/content/chapters/ch39-why-not-my-index.ts` · **World** The Clockwork Engine · **Tier** expert · **Track** performance · **Dataset** `dungeon`
- **Subtitle** Sargable predicates, selectivity, statistics, rewrites and CTE fences
- **Concepts** `sargability`, `index-selection-reasons`, `statistics`, `query-rewriting`, `cte-materialization`
- **Prerequisites** `ch38-index-forging`
- **Lesson** (9 steps)
  1. explain · Sargable: keep the indexed column bare; `started_at::date = d`, `score + 0 = 42`, `lower(x)` without an expression index all hide it.
  2. example · Same question, two plans: plan_nodes of `started_at::date = '2025-06-01'` vs `started_at >= '2025-06-01' AND started_at < '2025-06-02'` with a B-tree on started_at.
  3. quiz · The index on region is ignored for `region = 'eu'`. Why? (60% of rows: a Seq Scan is cheaper; misconception: the index is broken)
  4. explain · Other reasons: tiny tables, stale stats, type mismatch, wrong opclass or collation, OR across columns.
  5. explain · Statistics: `pg_stats` (n_distinct, most_common_vals, histogram, correlation), ANALYZE after loads, CREATE STATISTICS for correlated columns.
  6. example · `SELECT attname, n_distinct, correlation FROM pg_stats WHERE tablename = 'run_archive' AND attname IN ('region','started_at','id');`
  7. explain · Rewrites: EXISTS vs IN vs JOIN, UNION ALL instead of OR, pre-aggregate before joining, drop needless DISTINCT and ORDER BY; measure each.
  8. explain · CTEs are inlined since PG12; `MATERIALIZED` forces a fence (CTE Scan) and can lose the index.
  9. try · Rewrite `WHERE started_at::date = '2025-06-01'` into a sargable range (same 259 rows).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch39-ex01 | setupSql creates a B-tree on started_at. Return two columns: the count of runs started on 2025-06-01 (259) using a sargable range, and `plan_nodes` of your range query written as a string (must contain an index node). The cast version gives a Seq Scan | 2 | query | result | sargability | refactor |
| ch39-ex02 | setupSql creates an index on score. The starter `WHERE score + 0 = 4000` and `WHERE score::text = '4000'` are given; answer with the plan node types of the sargable version via plan_nodes (Bitmap or Index scan) | 2 | query | result | sargability | fix |
| ch39-ex03 | setupSql creates an index on region. Answer with two columns: plan_nodes for `region = 'eu'` and for `region = 'sa'` (Seq Scan vs Bitmap): explain why in the explanation | 2 | query | result | index-selection-reasons | predict |
| ch39-ex04 | Return `attname`, `n_distinct` and `round(correlation::numeric, 2)` from pg_stats for `run_archive` columns `region`, `status`, `started_at`, ordered by attname (orderMatters) | 2 | query | result | statistics | write |
| ch39-ex05 | setupSql inserts 50 000 'na' rows into a copy table `run_copy` without ANALYZE. Run `ANALYZE run_copy` and return the new `n_live_tup`-free proof: `SELECT most_common_vals::text FROM pg_stats WHERE tablename = 'run_copy' AND attname = 'region'` | 3 | mutation | result+state | statistics | fix |
| ch39-ex06 | Rewrite a correlated `SELECT p.handle, (SELECT max(score) FROM run_archive r WHERE r.player_id = p.id) ...` into a pre-aggregated join that returns the same rows (handle, best score, players without runs show NULL) | 3 | query | result | query-rewriting | refactor |
| ch39-ex07 | Return two columns: plan_nodes of `WITH c AS (SELECT * FROM run_archive) SELECT * FROM c WHERE id = 5` and of the same with `AS MATERIALIZED` (`{Index Scan}` vs `{CTE Scan,Seq Scan}`) | 3 | query | result | cte-materialization | predict |
| ch39-ex08 | **Boss · The Lazy Index Inquiry**: three slow queries are given with an index each already in setupSql (started_at, lower(death_cause) missing so a plain death_cause index, score); rewrite each so it uses its index without changing results, and return one row per query with **label**, **result count** and `plan_nodes` of your rewritten text (strings built in the SELECT) | 5 | query | result | sargability, index-selection-reasons, query-rewriting | refactor |

- **Practice**: `ch39-pr01` sargability: rewrite `WHERE extract(year from started_at) = 2025 AND extract(month from started_at) = 3` as a range (same count); `ch39-pr02` index-selection-reasons: with an index on status, answer plan nodes for `status = 'finished'` (Seq Scan) and `'in_progress'`; `ch39-pr03` index-selection-reasons: `players` has 25 rows: predict the scan node of `WHERE id = 3` (verify by probe; tiny tables often prefer Seq Scan); `ch39-pr04` statistics: `CREATE STATISTICS` on (score, floor_reached) dependencies, verify `pg_statistic_ext`; `ch39-pr05` query-rewriting: OR across two columns to UNION (same rows); `ch39-pr06` cte-materialization: rewrite a MATERIALIZED CTE so the filter reaches the index (same result, plan_nodes in negative cases); `ch39-pr07` sargability: `WHERE handle ILIKE 'night%'` on players vs citext equality (predict).
- **Negative cases to add**: ex01 reject the cast version only through a companion state check: simpler, make negative cases cover count mistakes (`BETWEEN '2025-06-01' AND '2025-06-02'` counts midnight of the next day: reject if a row sits exactly at midnight, verify with a probe, otherwise drop); ex06 reject the inner join that drops player 25; ex07 reject swapped columns.
- **Notes**: learner SQL cannot be EXPLAINed by the checker, so "make the query sargable" missions grade the **result** and use plan_nodes on fixed strings for the plan part (write the rewritten query as a string inside plan_nodes). Statistics counters need `SELECT pg_stat_force_next_flush();`. `region = 'eu'` stays Seq Scan, `'sa'` uses the index (verified).

### ch40-undead-rows-and-big-tables · Undead Rows and Big Tables 🧟
- **File** `src/content/chapters/ch40-undead-rows-and-big-tables.ts` · **World** The Clockwork Engine · **Tier** master · **Track** performance · **Dataset** `dungeon`
- **Subtitle** MVCC, VACUUM, keyset pages, N+1, write costs, partitions and stats views
- **Concepts** `mvcc-concept`, `vacuum-mvcc`, `pagination-performance`, `n-plus-one`, `write-performance`, `partitioning`, `query-stats`
- **Prerequisites** `ch39-why-not-my-index`, `ch22-merge-and-upsert`
- **Lesson** (10 steps)
  1. explain · MVCC: an UPDATE writes a new row version; `ctid` and `xmin` change; old versions are dead tuples.
  2. example · `SELECT ctid, xmin FROM players WHERE id = 1; UPDATE players SET region = region WHERE id = 1; SELECT ctid, xmin FROM players WHERE id = 1;`
  3. explain · VACUUM marks dead space reusable and updates the visibility map; VACUUM FULL rewrites the table (exclusive lock); autovacuum never runs in this sandbox.
  4. quiz · After deleting 10% of run_archive, `pg_relation_size` is? (unchanged; misconception: DELETE frees disk)
  5. explain · OFFSET pagination reads and throws away rows; keyset: `WHERE (score, id) < ($1, $2) ORDER BY score DESC, id DESC LIMIT 20` with a matching index.
  6. explain · N+1: one query per player in a loop vs one JOIN or `= ANY(ARRAY[...])`.
  7. explain · Write costs: every index is updated on INSERT; batch inserts; find unused indexes in `pg_stat_user_indexes` (idx_scan = 0).
  8. explain · Partitioning: `PARTITION BY LIST (season_id)`; pruning removes partitions from the plan; dropping a partition is instant retention.
  9. explain · Stats views: `pg_stat_user_tables` (n_live_tup, n_dead_tup, seq_scan, idx_scan), `pg_stat_user_indexes`; call `pg_stat_force_next_flush()` first here; no pg_stat_statements in this sandbox.
  10. try · Return n_dead_tup of run_archive after deleting the abandoned runs (flush first).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch40-ex01 | Update player 1's region to 'na' and return, in one final SELECT, whether its `ctid` changed (compare with the ctid saved first in a temp table) | 2 | mutation | result | mvcc-concept | predict |
| ch40-ex02 | Delete the abandoned runs, flush stats, and return `n_dead_tup` (10000); then a second statement VACUUM and return n_dead_tup again (0): return both values in a final SELECT from a temp table you fill | 3 | mutation | result | vacuum-mvcc | write |
| ch40-ex03 | Starter uses `VACUUM FULL` inside `BEGIN ... COMMIT` and fails (25001). Fix it so the table is rewritten; verifySql: `pg_relation_size('run_archive') < 14000000` after deleting abandoned rows | 3 | mutation | state | vacuum-mvcc | fix |
| ch40-ex04 | Keyset page: return **id** and **score** of the 20 runs after (score 3000, id 50000) in `score DESC, id DESC` order (orderMatters); a second check in negative cases rejects the OFFSET version that returns other rows | 3 | query | result | pagination-performance | write |
| ch40-ex05 | Create the index that makes the keyset query an `{Limit,Index Only Scan}` or `{Limit,Index Scan}` plan with no Sort; verify plan_nodes | 3 | ddl | state | pagination-performance | optimize |
| ch40-ex06 | The app ran 25 queries `SELECT max(score) FROM run_archive WHERE player_id = $1`. Return **player_id** and **best score** for all players in ONE query (players without runs included with NULL) | 2 | query | result | n-plus-one | refactor |
| ch40-ex07 | setupSql creates 4 indexes on run_archive (two of them redundant prefixes). Drop the indexes that are prefixes of another index; verifySql lists remaining index names | 3 | ddl | state | write-performance | fix |
| ch40-ex08 | Create `runs_by_season` partitioned by LIST (season_id) with partitions for 1, 2, 3, copy run_archive into it, and name partitions `runs_s1`, `runs_s2`, `runs_s3`; verifySql: counts per partition and `jsonb_path_query_array(plan_json('SELECT count(*) FROM runs_by_season WHERE season_id = 2'), 'strict $.**."Relation Name"')` (only runs_s2) | 4 | ddl | state | partitioning | design |
| ch40-ex09 | **Boss · Overclock the Engine**: five slow queries (season leaderboard top 10, in-progress list, a deep OFFSET page 250 of the global leaderboard, per-player best score loop, cursed tag search). Make each fast: create indexes (max 4), rewrite the OFFSET page as keyset from given last values, and return one row per query with label and `plan_nodes` of the final query text. verifySql checks that no plan contains 'Seq Scan' or 'Sort' where forbidden, and the keyset page rows match | 5 | ddl | result+state | pagination-performance, partitioning, multicolumn-index, partial-index, n-plus-one | optimize |

- **Practice**: `ch40-pr01` mvcc-concept: `xmin` of a row before and after an UPDATE in the same SELECT pattern (predict changed); `ch40-pr02` vacuum-mvcc: answer `pg_relation_size` before and after a DELETE (same); `ch40-pr03` pagination-performance: page 3 of 10 runs of season 1 by score desc, id desc with OFFSET (result, orderMatters); `ch40-pr04` n-plus-one: rewrite with `= ANY(ARRAY[1,5,9])`; `ch40-pr05` write-performance: list unused indexes (`idx_scan = 0`) after a few queries (flush first); `ch40-pr06` partitioning: add a DEFAULT partition and insert a season 9 row into it, verify `tableoid::regclass`; `ch40-pr07` query-stats: return `seq_scan` count of players after running 3 scans (flush); `ch40-pr08` query-stats: tables ordered by n_live_tup desc (top 3, orderMatters).
- **Negative cases to add**: ex04 reject `OFFSET` with a guessed number, reject `(score, id) <= (...)` (includes the anchor row), reject mixing ASC id; ex06 reject the inner join (drops player 25); ex07 reject dropping the primary key.
- **Notes**: `n_dead_tup` reads 0 until `SELECT pg_stat_force_next_flush();` (verified: 10000 after flush, 0 after VACUUM). VACUUM cannot run inside BEGIN (25001); the app sends each statement alone so a plain `VACUUM` works. Deleting the 10000 abandoned rows then `VACUUM FULL` shrinks the heap from about 14.6 MB to 13.4 MB (verified). Partition pruning is visible through `plan_json` relation names, not through `plan_nodes` (both partitioned and pruned plans show `Seq Scan`). The keyset anchor (3000, 50000): probe the exact 20 rows before writing.

## 14. World 11: The Astral Spire (code in the database, security)

### ch41-spellcrafting · Spellcrafting 🧙
- **File** `src/content/chapters/ch41-spellcrafting.ts` · **World** The Astral Spire · **Tier** expert · **Track** advanced · **Dataset** `library`
- **Subtitle** SQL functions, PL/pgSQL, procedures, dynamic SQL and the injection curse
- **Concepts** `sql-functions`, `plpgsql-basics`, `procedures`, `dynamic-sql`, `sql-injection`
- **Prerequisites** `ch40-undead-rows-and-big-tables`
- **Lesson** (10 steps)
  1. explain · `CREATE FUNCTION ... LANGUAGE sql` wraps a query; SQL standard body `RETURN expr`; RETURNS TABLE / SETOF; volatility labels.
  2. example · `CREATE FUNCTION scrolls_by(author_name text) RETURNS SETOF scrolls LANGUAGE sql STABLE AS $$ SELECT * FROM scrolls WHERE author = author_name $$; SELECT title FROM scrolls_by('Elowen Thrice');`
  3. quiz · A function calls `now()`. Which label is honest? (STABLE; misconception: IMMUTABLE for speed)
  4. explain · PL/pgSQL: DECLARE, IF, FOR loops, RETURN QUERY, RAISE NOTICE, EXCEPTION blocks; `DO $$ ... $$` for one-offs.
  5. explain · Procedures: `CREATE PROCEDURE`, `CALL`, COMMIT and ROLLBACK inside (only when CALL is sent alone, which the app does).
  6. explain · Dynamic SQL: `EXECUTE format('SELECT count(*) FROM %I WHERE %I = %L', tbl, col, val)`; `%I` identifiers, `%L` literals, `USING $1`.
  7. explain · SQL injection: concatenating input lets `x' OR '1'='1` rewrite your query; parameters or `%L` stop it.
  8. example · A cursed function: setupSql-like snippet `find_reader_unsafe(name text)` built with `||`; call it with a harmless name.
  9. quiz · Which call to the unsafe function dumps every reader? (`'nobody'' OR ''1''=''1'`)
  10. try · Write `scroll_count(lang text) RETURNS bigint` (LANGUAGE sql) and call it for 'fr' (8).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch41-ex01 | Create `pages_written(author_name text) RETURNS bigint` (sum of page_count of that author's scrolls, 0 when none) and return `pages_written('Elowen Thrice')` and `pages_written('Nobody')` | 2 | ddl | result | sql-functions | write |
| ch41-ex02 | Create `section_scrolls(p ltree) RETURNS TABLE(title text, path ltree)` returning scrolls whose section is under p; return `SELECT * FROM section_scrolls('arcana')` | 3 | ddl | result | sql-functions | write |
| ch41-ex03 | Starter declares `overdue_days(loan_id int) ... IMMUTABLE` using `now()`. Fix it into a PL/pgSQL function `overdue_days(loan_id int, as_of timestamptz)` returning days late (0 when returned on time or not due) and return it for loans 9, 13, 16 as of `'2026-10-31'` | 3 | ddl | result | plpgsql-basics | fix |
| ch41-ex04 | Create PL/pgSQL `fine_for(loan_id int, as_of timestamptz) RETURNS numeric`: 0.50 per late day, capped at 20.00, RAISE EXCEPTION 'unknown loan' (P0001) for missing ids; return fines for all overdue loans ordered by loan id (orderMatters) | 4 | ddl | result | plpgsql-basics | write |
| ch41-ex05 | Create procedure `close_overdue(as_of timestamptz)` that sets `returned_at = as_of` for overdue loans and COMMITs; `CALL` it alone; verifySql: loans with returned_at = as_of | 3 | ddl | state | procedures | write |
| ch41-ex06 | Create `count_rows(tbl text, col text, val text) RETURNS bigint` with `EXECUTE format('... %I ... %I = %L')`; return counts for ('scrolls','language','fr') and ('readers','clearance','3') | 3 | ddl | result | dynamic-sql | write |
| ch41-ex07 | setupSql creates `find_reader_unsafe(name text)` (concatenation). Return the rows the attacker gets: call it with the input that returns **every** reader (result = all readers' names) | 3 | query | result | sql-injection | predict |
| ch41-ex08 | Fix: replace `find_reader_unsafe` with `find_reader(name text)` using a parameter (or `format('%L')`); verifySql: `find_reader('Garrick Holt')` returns 1 row and `find_reader('x'' OR ''1''=''1')` returns 0 rows | 3 | ddl | state | sql-injection | fix |
| ch41-ex09 | **Boss · The Grimoire Engine**: create `section_report(section_path ltree, as_of timestamptz) RETURNS TABLE(title text, loans bigint, open_fines numeric)` in PL/pgSQL that builds its per-section query with `format('%L')` (no concatenation of input), uses `fine_for` from ex04 (recreated in the solution), and returns scrolls of the subtree with their loan counts and the sum of open fines; return `section_report('arcana', '2026-10-31')` ordered by title (orderMatters) | 5 | ddl | result | sql-functions, plpgsql-basics, dynamic-sql, sql-injection | write |

- **Practice**: `ch41-pr01` sql-functions: SQL standard body `CREATE FUNCTION initials(n text) RETURNS text RETURN ...` and call it; `ch41-pr02` sql-functions: function overload ambiguity: calling `f(NULL)` with two overloads fails 42725 (error check); `ch41-pr03` plpgsql-basics: DO block that raises 'too many' (P0001) when more than 5 overdue loans (error check); `ch41-pr04` plpgsql-basics: FOR loop summing page_count of clearance 3 scrolls into a function result; `ch41-pr05` procedures: procedure that inserts a reader then ROLLBACKs inside (verify reader count unchanged); `ch41-pr06` dynamic-sql: `format('%I', 'Weird Name')` and `format('%L', 'O''Brien')` (predict quoting); `ch41-pr07` sql-injection: `quote_literal` vs `quote_ident` outputs (predict); `ch41-pr08` sql-injection: PREPARE/EXECUTE with `$1` for a reader lookup (result).
- **Negative cases to add**: ex01 reject returning NULL for 'Nobody' (sum without coalesce); ex03 reject keeping IMMUTABLE with now(); ex06 reject `%s` instead of `%I` (fails on quoted names: verify with a probe it actually differs, otherwise move to a quiz); ex08 reject a version that escapes with `replace(name, '''', '')` if it still passes (it does: accept it but note), reject the unsafe function kept as is.
- **Notes**: overdue loans as of 2026-10-31: 9, 13, 16, 19 (loan 20 still running). RAISE NOTICE output is not graded (needs onNotice in the app). Functions created by the learner live only in the learner sandbox: verifySql calls them by name. `CALL` with COMMIT works only as a lone statement (the app splits). Never use `SET ROLE` in learner SQL.

### ch42-wards-and-gatekeepers · Wards and Gatekeepers 🛡️
- **File** `src/content/chapters/ch42-wards-and-gatekeepers.ts` · **World** The Astral Spire · **Tier** master · **Track** advanced · **Dataset** `library`
- **Subtitle** Triggers, audit trails, notifications, privileges, row-level security and safe imports
- **Concepts** `triggers`, `audit-history`, `listen-notify`, `roles-privileges`, `row-level-security`, `upsert-patterns`, `stored-logic-guidelines`
- **Prerequisites** `ch41-spellcrafting`, `ch22-merge-and-upsert`, `ch31-scrolls-of-json`
- **Lesson** (10 steps)
  1. explain · Triggers: BEFORE/AFTER, ROW/STATEMENT, `NEW`/`OLD`, `TG_OP`; a BEFORE trigger returning NULL silently skips the row.
  2. example · Stamp every loan: a BEFORE INSERT trigger that defaults `loan_period` to 14 days from now (shown, then a test insert).
  3. explain · Audit trail: an AFTER trigger writes `to_jsonb(OLD)`, `to_jsonb(NEW)`, `TG_OP`, `current_user`, `now()` into `loan_audit`.
  4. explain · LISTEN/NOTIFY: `pg_notify('overdue', payload)` is delivered at commit to listeners; here we grade an outbox row written next to it.
  5. explain · Roles and privileges: `GRANT SELECT ON scrolls TO apprentice_reader`, REVOKE, `has_table_privilege`; least privilege.
  6. quiz · Why does your RLS policy seem broken when you test it here? (the default user `postgres` is superuser and bypasses RLS; test with a role)
  7. explain · RLS: `ALTER TABLE scrolls ENABLE ROW LEVEL SECURITY`, `CREATE POLICY ... USING (...) WITH CHECK (...)`; no policy means deny all for non owners.
  8. explain · Idempotent imports: staging + `INSERT ... ON CONFLICT DO UPDATE` or MERGE; running twice changes nothing.
  9. explain · Where logic lives: constraints first, then functions, then triggers; keep rules visible.
  10. try · Grant SELECT on `loans` to `apprentice_reader` (verified with has_table_privilege).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch42-ex01 | Create a BEFORE UPDATE trigger on readers that lowercases `email` (citext stays citext, store lower text); update reader 5's email; verifySql: reader 5 email text | 2 | ddl | state | triggers | write |
| ch42-ex02 | Starter's BEFORE INSERT trigger on loans returns NULL and every insert vanishes. Fix the trigger function (RETURN NEW) and run the given test insert; verifySql counts loans (22) | 3 | ddl | state | triggers | fix |
| ch42-ex03 | Create `loan_audit(id, loan_id, op, old_row jsonb, new_row jsonb, at)` and an AFTER INSERT OR UPDATE OR DELETE trigger on loans filling it; then return loan 9 by setting returned_at '2026-10-31'; verifySql: op, loan_id, `old_row->>'returned_at'`, `new_row->>'returned_at'` | 4 | ddl | state | audit-history | write |
| ch42-ex04 | Create an AFTER UPDATE trigger that, when `returned_at` goes from NULL to a value, calls `pg_notify('returns', loan id)` AND inserts into `outbox(channel, payload)`; return loans 13 and 16; verifySql: outbox rows | 3 | ddl | state | listen-notify | write |
| ch42-ex05 | Give `archivist` DELETE on loans and REVOKE SELECT on citations from `apprentice_reader`; verifySql: `has_table_privilege` for both, as booleans | 2 | ddl | state | roles-privileges | write |
| ch42-ex06 | Enable RLS on scrolls and create a policy so `apprentice_reader` sees only `clearance_level = 1` scrolls (archivist sees all: second policy or `TO apprentice_reader` only plus a permissive one for archivist); verifySql: `SET ROLE apprentice_reader; SELECT count(*) FROM scrolls; RESET ROLE;` and the same for archivist | 4 | ddl | state | row-level-security | write |
| ch42-ex07 | setupSql creates staging `reader_import(email, name, clearance)` with 4 rows (2 existing emails in other case, 2 new). Upsert them into readers (email is citext unique) so running it **twice** gives the same state; password_hash for new readers `crypt('changeme', gen_salt('bf', 4))`; verifySql: name, clearance by email | 4 | mutation | state | upsert-patterns | write |
| ch42-ex08 | **Boss · The Astral Wards** (World 11 boss): (1) audit trigger on scrolls updates into `scroll_audit` with jsonb diff of changed keys only, (2) RLS so `apprentice_reader` sees clearance 1 and cannot UPDATE anything (WITH CHECK false or no update grant), (3) idempotent upsert of a 3 row `scroll_import` staging table on title (unique index you create). verifySql: audit rows after the upsert, `SET ROLE apprentice_reader` counts, `has_table_privilege` booleans, and the scrolls state; run the upsert twice in the solution to prove idempotence | 5 | ddl | state | triggers, audit-history, row-level-security, upsert-patterns | design |

- **Practice**: `ch42-pr01` triggers: statement level trigger counting deletes into a counter table; `ch42-pr02` triggers: `WHEN (OLD.clearance IS DISTINCT FROM NEW.clearance)` condition, verify only changed rows logged; `ch42-pr03` audit-history: list audit rows with `jsonb_each` of new_row minus old_row (setupSql provides audit data); `ch42-pr04` listen-notify: run `LISTEN returns;` then `SELECT pg_notify('returns', '9');` and answer `pg_notification_queue_usage() >= 0` (predict true); the payload itself is not observable here; `ch42-pr05` roles-privileges: `has_table_privilege('apprentice_reader','loans','SELECT')` (predict false); `ch42-pr06` row-level-security: policy with no USING for archivist on loans, verify counts via SET ROLE in verifySql; `ch42-pr07` upsert-patterns: atomic counter `INSERT ... ON CONFLICT (reader_id) DO UPDATE SET visits = visits + 1` run 3 times; `ch42-pr08` stored-logic-guidelines: replace a trigger that enforces `clearance BETWEEN 1 AND 3` with a CHECK constraint (state: trigger gone, constraint present).
- **Negative cases to add**: ex02 the starter must fail (no loan inserted); ex03 reject a BEFORE trigger that writes the audit row (still fine?) only if different, reject logging without old_row; ex05 reject GRANT ALL; ex06 reject a policy without ENABLE ROW LEVEL SECURITY (counts 30 for apprentice), reject a policy `TO PUBLIC USING (clearance_level = 1)` only if it also hides scrolls from archivist; ex07 reject plain INSERT (second run fails 23505) and `ON CONFLICT DO NOTHING` (names not updated).
- **Notes**: `SET ROLE` is forbidden in learner SQL but allowed in verifySql: every RLS and privilege check goes through verifySql. The superuser `postgres` bypasses RLS even with FORCE. apprentice_reader can SELECT sections, scrolls, citations; archivist can SELECT, INSERT, UPDATE sections, scrolls, citations, loans, readers and SELECT staff and access_log (dataset grants). NOTIFY payloads are not observable by the checker, hence the outbox row. Clearance levels of scrolls: 3 for 7, 8, 21, 30; count the clearance 1 scrolls with a probe before writing expected numbers.

### ch43-trials-of-mastery ◇ · Trials of Mastery 👑
- **File** `src/content/chapters/ch43-trials-of-mastery.ts` · **World** The Astral Spire · **Tier** master · **Track** advanced · **Dataset** `guild`
- **Subtitle** Side quest: the post game, no new syntax, every technique, a peek behind the server
- **Concepts** `operations-overview`
- **Prerequisites** `ch42-wards-and-gatekeepers`
- **Lesson** (7 steps)
  1. explain · What a real server adds: backups (pg_dump, PITR), replication (a replica is not a backup), connection pooling, configuration, upgrades.
  2. example · Read the dials: `SELECT name, setting, unit, context FROM pg_settings WHERE name IN ('shared_buffers','work_mem','max_connections');`
  3. explain · Measure before tuning: `pg_database_size`, `pg_total_relation_size`, stats views.
  4. example · Biggest tables: `SELECT relname, pg_total_relation_size(relid) FROM pg_stat_user_tables ORDER BY 2 DESC LIMIT 5;`
  5. quiz · Your replica is up to date. Is it a backup? (no: a DROP TABLE replicates too)
  6. explain · Trials rules: no hints until the third failure, any technique allowed, bosses mix every world.
  7. try · Return the setting `context` of `shared_buffers` (postmaster: needs a restart).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch43-ex01 | Return the **top 3 heroes per guild by xp** (ties broken by name), with guild name, wanderers excluded (any technique) | 3 | query | result | top-n-per-group, operations-overview | write |
| ch43-ex02 | Return heroes who completed **every** quest of the region of their guild hall (relational division with a join to guilds.hall_region) | 4 | query | result | relational-division | write |
| ch43-ex03 | Walk the mentor tree: return each hero with the **name of their root mentor** and their depth (roots depth 0) | 4 | query | result | recursive-cte | write |
| ch43-ex04 | Inventory fix: move every 'healing potion' (lower case) entry in inventories to the canonical 'Healing Potion' and merge quantities per bag; verifySql: doc of hero 13 and hero 1 | 5 | mutation | state | jsonb-modification, jsonb-decomposition | write |
| ch43-ex05 | Return the size in bytes of the 3 largest guild tables (`pg_total_relation_size`), largest first (orderMatters; check ties) | 2 | query | result | operations-overview | write |
| ch43-ex06 | Cheapest portal route from Highmoor to Frostspire with the path as an array and its total toll (48), CYCLE clause or path check | 4 | query | result | recursive-graph-walks | write |
| ch43-ex07 | **Boss · The Astral Throne**: build a multi-tenant guild app: (1) table `guild_members(guild_id, hero_id, role)` filled from heroes with a CHECK on role and an exclusion of duplicates, (2) an audit trigger on heroes.gold changes into `gold_audit` (jsonb old/new), (3) RLS on heroes so a role `guild_master_1` (created in setupSql, granted SELECT) sees only guild 1 heroes, (4) an idempotent upsert of a `gold_rewards` staging table into heroes.gold (adding rewards once, keyed by a `reward_id` ledger), (5) a leaderboard view `guild_leaderboard` (rank per guild by xp, dense_rank). verifySql: members count per role, audit rows, `SET ROLE guild_master_1` hero count, gold of rewarded heroes after running the upsert twice, leaderboard top row per guild | 5 | ddl | state | row-level-security, audit-history, upsert-patterns, views, ranking-functions | design |

- **Practice**: `ch43-pr01` operations-overview: return `context` and `unit` of `work_mem` from pg_settings; `ch43-pr02` operations-overview: return the boolean `pg_database_size(current_database()) > 0` (sizes are environment dependent, so grade only the boolean); `ch43-pr03` operations-overview: list settings that need a restart among a given list (`context = 'postmaster'`).
- **Negative cases to add**: ex01 reject rank() (ties give more than 3 if any; check data, guild 1 xp ties), reject including wanderers; ex02 reject counting without DISTINCT; ex03 reject an unbounded walk (none: tree), ex06 reject UNION without cycle protection (the validator timeout catches it); boss reject a non idempotent upsert (second run doubles gold).
- **Notes**: Trials are timed and hint-light in the app (that is a UI rule; content still ships 3 hints). Exercise concepts reach back into every world: the validator only warns when a concept was never taught before, all of these were. `pg_settings` values in PGlite differ from a server (e.g. shared_buffers), so only grade `context`, `unit`, booleans, never numeric settings. Portal route cost 48 Highmoor to Frostspire via Mistwood and Saltmarsh (dataset note). guild 6 has no heroes; wanderers 11, 15, 18, 22, 24, 25.
