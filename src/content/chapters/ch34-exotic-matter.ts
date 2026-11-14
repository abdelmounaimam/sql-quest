import type { Chapter } from "../types";

const READING_ROOMS =
	"CREATE TABLE reading_rooms (name text PRIMARY KEY, seat point NOT NULL);\nINSERT INTO reading_rooms (name, seat) VALUES\n  ('Map Room', '(3,4)'),\n  ('Candle Nook', '(1,1)'),\n  ('Star Gallery', '(-2,0)'),\n  ('Echo Vault', '(6,-8)'),\n  ('Moss Alcove', '(0,-3)'),\n  ('Lantern Loft', '(-5,5)');";

const chapter: Chapter = {
	id: "ch34-exotic-matter",
	order: 34,
	world: "The Alchemist's Vault",
	tier: "expert",
	track: "types",
	title: "Exotic Matter",
	subtitle: "inet and cidr, bytea, geometric types, ltree, citext and pgcrypto",
	emoji: "💎",
	datasetId: "library",
	concepts: [
		"network-types",
		"bytea-binary",
		"geometric-types",
		"ltree",
		"case-insensitive-text",
		"pgcrypto-hashing",
	],
	prerequisites: ["ch30-shaped-data", "ch28-cursed-designs"],
	lesson: [
		{
			kind: "explain",
			title: "Network types: inet and cidr",
			body: "Postgres has dedicated types for **IP addresses** and networks.\n\n- `inet` holds an address (with an optional mask): `10.13.0.21`, `2001:db8:ae7e::42`\n- `cidr` holds a network: `203.0.113.0/24`\n- `ip << net` means *inside*, `masklen(net)`, `host(ip)`, `family(ip)` (4 or 6)\n\nStored as text, an IP can only be matched with fragile LIKE patterns; `inet` understands networks, IPv6 included.",
		},
		{
			kind: "example",
			title: "Join on network containment",
			body: "One join on `<<` checks every row of `access_log` against every row of `banned_networks`, whatever the mask length.",
			sql: "SELECT a.id, a.ip, n.network, n.reason\nFROM access_log a\nJOIN banned_networks n ON a.ip << n.network;",
		},
		{
			kind: "explain",
			title: "Raw bytes: bytea",
			body: "`bytea` stores binary data and displays it as hex: `\\x2375546f...`.\n\n- `decode('2375', 'hex')` turns text into bytes, `encode(b, 'hex' | 'base64')` the other way\n- `md5(text)` returns **text** (32 hex characters), not bytes\n- `octet_length(b)` counts bytes\n\nThe `scrolls.checksum` column holds `decode(md5(body), 'hex')`: 16 bytes that change if the body changes.",
		},
		{
			kind: "example",
			title: "Geometric types",
			body: "Postgres ships geometric types (no PostGIS needed for simple cases): `point`, `box`, `circle`, `polygon`. `<->` is the distance, `@>` containment. Points are `(x,y)` on a flat plane, not latitude and longitude.",
			sql: "SELECT point '(0,0)' <-> point '(3,4)' AS distance,\n       box '((0,0),(10,10))' @> point '(3,4)' AS in_box,\n       circle '((0,0),5)' @> point '(3,4)' AS on_circle;",
		},
		{
			kind: "explain",
			title: "ltree: hierarchical paths",
			body: "`sections.path` is an **ltree**: labels joined by dots, `arcana.forbidden.necromancy`.\n\n| test | meaning |\n|---|---|\n| `path <@ 'arcana'` | is arcana or below it |\n| `path @> 'arcana.fire.dragons'` | is an ancestor (or itself) |\n| `path ~ '*.fire.*'` | lquery pattern |\n\n`nlevel(path)` gives the depth, `subpath(path, 0, 1)` the top label.",
		},
		{
			kind: "example",
			title: "Select a subtree",
			body: "Every section at or under `arcana`, with its depth. Note that `<@` includes the root itself.",
			sql: "SELECT name, path, nlevel(path) AS depth\nFROM sections\nWHERE path <@ 'arcana'\nORDER BY path;",
		},
		{
			kind: "explain",
			title: "Case insensitive text",
			body: "One row of `readers` has the email `Garrick.Holt@Aethel.LIB`. Three ways to compare without case:\n\n- `citext` (extension): `readers.email` compares and stays UNIQUE ignoring case\n- `lower(email) = lower($1)` plus an index on `lower(email)`\n- a nondeterministic ICU collation, or PG18 `casefold()`\n\nCast a citext to `text` and it becomes case sensitive again.",
		},
		{
			kind: "quiz",
			question: "How do you check that a reader typed the right password, given the stored bcrypt `password_hash`?",
			choices: [
				"`password_hash = crypt('typed', password_hash)`",
				"`password_hash = crypt('typed', gen_salt('bf'))`",
				"`password_hash = md5('typed')`",
				"Decrypt `password_hash` and compare with the typed text",
			],
			answerIndex: 0,
			explanation:
				"The stored hash contains its own salt and cost; passing it as the second argument makes `crypt` reuse them, so the same password yields the same hash. A fresh `gen_salt` never matches, md5 is a different (and broken) algorithm, and a hash cannot be decrypted at all.",
		},
		{
			kind: "explain",
			title: "pgcrypto: one way hashes",
			body: "- `crypt(password, gen_salt('bf'))` makes a slow, salted bcrypt hash: the right tool for passwords\n- `digest(data, 'sha256')` returns a 32-byte bytea fingerprint: the right tool for checksums\n- `hmac(data, key, 'sha256')` signs with a secret\n- `gen_random_bytes(16)` makes unguessable tokens\n\nHashes are **one way**: you verify by hashing again, never by decrypting.",
		},
		{
			kind: "try",
			title: "Compare a checksum",
			prompt:
				"Return the **id** of the scroll whose stored `checksum` does **not** match the md5 of its body as bytes (`decode(md5(body), 'hex')`).",
			starterSql: "SELECT id\nFROM scrolls\nWHERE checksum <> md5(body)::bytea;",
			solutionSql: "SELECT id FROM scrolls WHERE checksum <> decode(md5(body), 'hex');",
			check: { type: "result" },
			hints: [
				"Run the starter: all 30 scrolls are returned. Compare the lengths of the two sides.",
				"`md5()` returns 32 hex characters as text; casting them to bytea gives 32 bytes of characters, not the 16 bytes of the hash. Use `decode(..., 'hex')`.",
			],
		},
	],
	exercises: [
		{
			id: "ch34-ex01",
			title: "Addresses inside a network",
			prompt:
				"Return the **id**, **ip** and **reason** of every `access_log` row whose IP lies **inside** one of the `banned_networks`.",
			difficulty: 2,
			kind: "query",
			concepts: ["network-types"],
			solutionSql: "SELECT a.id, a.ip, n.reason\nFROM access_log a\nJOIN banned_networks n ON a.ip << n.network;",
			check: { type: "result" },
			hints: [
				"Join the two tables on a network test, not on equality.",
				"`ip << network` is true when the address is inside the network.",
				"JOIN banned_networks n ON a.ip << n.network",
			],
			explanation:
				"`<<` handles masks of any length and IPv6 alike: three rows match.\n\n**Pitfall:** `host(ip) LIKE '203.0.113.%'` only knows one network and breaks for masks that do not end on a dot (a /20, say).\n\n**Alternative:** `a.ip <<= n.network` also accepts an address equal to the network itself.",
		},
		{
			id: "ch34-ex02",
			title: "Group addresses by /24",
			prompt:
				"For **IPv4** visits only, return each **/24 network** the visits came from (as a `cidr`, like `10.13.0.0/24`) and the number of **visits** from it.",
			difficulty: 3,
			kind: "query",
			concepts: ["network-types"],
			solutionSql:
				"SELECT network(set_masklen(ip, 24)) AS block, count(*) AS visits\nFROM access_log\nWHERE family(ip) = 4\nGROUP BY 1;",
			check: { type: "result", strictTypes: true },
			hints: [
				"Widen each address to a /24 mask, then take its network.",
				"`set_masklen(ip, 24)` changes the mask, `network(...)` zeroes the host part; `family(ip) = 4` drops IPv6.",
				"network(set_masklen(ip, 24)) ... WHERE family(ip) = 4 GROUP BY 1",
			],
			explanation:
				"Seven blocks: four of them are /24s inside 10.13.0.0/16, and 192.168.7.0/24 is one.\n\n**Pitfall:** grouping on `split_part(host(ip), '.', 3)` or similar text tricks mixes different networks and fails on IPv6.\n\n**Alternative:** `set_masklen(ip::cidr, 24)`: on a cidr the mask change zeroes the host bits itself.",
		},
		{
			id: "ch34-ex03",
			title: "Rows with a wrong checksum",
			prompt:
				"Return the **id** and **title** of every scroll whose stored `checksum` differs from the md5 of its **body** (as bytes).",
			difficulty: 2,
			kind: "query",
			concepts: ["bytea-binary"],
			solutionSql: "SELECT id, title FROM scrolls WHERE checksum <> decode(md5(body), 'hex');",
			check: { type: "result" },
			hints: [
				"Both sides must be the same 16 bytes.",
				"`decode(md5(body), 'hex')` turns the hex text into bytes.",
				"WHERE checksum <> decode(md5(body), 'hex')",
			],
			explanation:
				"Only *Bones That Remember* (21) fails its checksum.\n\n**Pitfall:** `md5(body)::bytea` keeps the 32 hex **characters** as bytes, so every scroll differs.\n\n**Alternative:** `encode(checksum, 'hex') <> md5(body)` compares on the text side.",
		},
		{
			id: "ch34-ex04",
			title: "Nearest points with <->",
			setupSql: READING_ROOMS,
			prompt:
				"The setup creates a `reading_rooms` table with a `seat` point per room. Return the **name** and **distance** (`<->`) to point (0,0) of the **2** reading rooms **nearest** to point (0,0), nearest first.",
			difficulty: 2,
			kind: "query",
			concepts: ["geometric-types"],
			solutionSql:
				"SELECT name, seat <-> point '(0,0)' AS distance\nFROM reading_rooms\nORDER BY distance\nLIMIT 2;",
			check: { type: "result", orderMatters: true },
			hints: [
				"`<->` gives the straight line distance between two points.",
				"Sort by that distance, then cut.",
				"ORDER BY seat <-> point '(0,0)' LIMIT 2",
			],
			explanation:
				"The Candle Nook (about 1.41) then the Star Gallery (2). With a GiST index on `seat`, `ORDER BY seat <-> point` becomes an index driven nearest neighbour search.\n\n**Pitfall:** sorting on a single coordinate (`seat[0]`) or on `x + y` is not a distance.\n\n**Alternative:** `sqrt(seat[0]^2 + seat[1]^2)`, the same math by hand.",
		},
		{
			id: "ch34-ex05",
			title: "Descendants of an ltree path",
			prompt:
				"Return the **name** and **path** of every section strictly **below** `history` (descendants only), sorted by path.",
			difficulty: 2,
			kind: "query",
			concepts: ["ltree"],
			solutionSql: "SELECT name, path FROM sections WHERE path <@ 'history' AND path <> 'history' ORDER BY path;",
			check: { type: "result", orderMatters: true },
			hints: [
				"`<@` means *is a descendant of*... including itself.",
				"Exclude the root with an extra condition.",
				"WHERE path <@ 'history' AND path <> 'history'",
			],
			explanation:
				"Kingdoms and Wars. ltree sorts label by label, so paths group by branch.\n\n**Pitfall:** `path <@ 'history'` alone also returns History; `path::text LIKE 'history%'` would match a future `historians` section too.\n\n**Alternative:** `path ~ 'history.*{1,}'` (an lquery with at least one more label), or `path <@ 'history' AND nlevel(path) > 1`.",
		},
		{
			id: "ch34-ex06",
			title: "Case insensitive lookup on citext",
			prompt: "Return the **name** of the reader whose email is `garrick.holt@aethel.lib`, whatever its case.",
			difficulty: 2,
			kind: "query",
			concepts: ["case-insensitive-text"],
			starterSql: "SELECT name\nFROM readers\nWHERE email = 'garrick.holt@aethel.lib'::text;",
			solutionSql: "SELECT name FROM readers WHERE email = 'garrick.holt@aethel.lib';",
			check: { type: "result" },
			hints: [
				"`email` is a citext. What does the `::text` cast do to the comparison?",
				"Comparing with a text value makes Postgres use the text `=`, which is case sensitive. Let the literal be a citext.",
				"WHERE email = 'garrick.holt@aethel.lib'",
			],
			explanation:
				"With an untyped literal, Postgres picks the citext `=`, which ignores case and still uses the unique index on email.\n\n**Pitfall:** casting either side to text silently switches to case sensitive comparison.\n\n**Alternative:** `lower(email) = 'garrick.holt@aethel.lib'` works on any text column (index it with `CREATE INDEX ON readers (lower(email))`).",
		},
		{
			id: "ch34-ex07",
			title: "Check a password with crypt",
			prompt: "Return the **name** of every reader whose password is **hunter2**.",
			difficulty: 2,
			kind: "query",
			concepts: ["pgcrypto-hashing"],
			solutionSql: "SELECT name FROM readers WHERE password_hash = crypt('hunter2', password_hash);",
			check: { type: "result" },
			hints: [
				"You cannot read the passwords; you can only hash a guess and compare.",
				"Pass the stored hash as the salt argument of `crypt` so it reuses the same salt.",
				"WHERE password_hash = crypt('hunter2', password_hash)",
			],
			explanation:
				"Garrick's. `crypt` reads the algorithm, cost and salt from the stored hash, so only the right password reproduces it.\n\n**Pitfall:** `crypt('hunter2', gen_salt('bf'))` uses a brand new salt and never matches.\n\n**Alternative:** none worth having: never store passwords reversibly or with plain md5.",
		},
		{
			id: "ch34-ex08",
			title: "Boss: The Warden's Sweep",
			story:
				"Combines network containment, an ltree subtree, a citext LEFT JOIN, a bytea checksum and a SHA-256 digest in one query.",
			prompt:
				"For every `access_log` visit to a scroll shelved in the **arcana.forbidden** subtree (that section or below), return, sorted by access **id**:\n\n- **id** of the visit\n- **visitor**: the reader's email, or `anonymous` when there is no reader\n- **banned**: true when the IP lies inside any banned network\n- **path** of the scroll's section\n- **intact**: true when the scroll's checksum matches `decode(md5(body), 'hex')`\n- **seal**: the SHA-256 digest of the scroll's body, as lower-case hex text",
			difficulty: 5,
			kind: "query",
			concepts: ["network-types", "ltree", "bytea-binary", "pgcrypto-hashing", "case-insensitive-text"],
			solutionSql:
				"SELECT a.id,\n       coalesce(r.email, 'anonymous') AS visitor,\n       EXISTS (SELECT 1 FROM banned_networks n WHERE a.ip << n.network) AS banned,\n       sec.path,\n       s.checksum = decode(md5(s.body), 'hex') AS intact,\n       encode(digest(s.body, 'sha256'), 'hex') AS seal\nFROM access_log a\nJOIN scrolls s ON s.id = a.scroll_id\nJOIN sections sec ON sec.id = s.section_id\nLEFT JOIN readers r ON r.id = a.reader_id\nWHERE sec.path <@ 'arcana.forbidden'\nORDER BY a.id;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Chain access_log, scrolls, sections; LEFT JOIN readers so the anonymous visits are kept.",
				"`<@ 'arcana.forbidden'` selects the subtree; an EXISTS over banned_networks with `<<` gives the flag without duplicating rows.",
				"encode(digest(s.body, 'sha256'), 'hex') for the seal; s.checksum = decode(md5(s.body), 'hex') for intact",
			],
			explanation:
				"Six visits: Céleste three times, Mireille once, and two anonymous visits from a banned network, one of them to the modified scroll 21.\n\n**Pitfall:** an inner join on readers drops the anonymous visits, and joining banned_networks directly (instead of EXISTS) drops every unbanned visit; `path = 'arcana.forbidden'` misses `arcana.forbidden.necromancy`.\n\n**Alternative:** `LEFT JOIN banned_networks n ON a.ip << n.network` with `n.network IS NOT NULL AS banned` (safe as long as networks do not overlap).",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch34-pr01",
			title: "Mask length of a network",
			prompt: "Return each banned **network** and its **mask length**.",
			difficulty: 1,
			kind: "query",
			concepts: ["network-types"],
			solutionSql: "SELECT network, masklen(network) AS bits FROM banned_networks;",
			check: { type: "result" },
			hints: ["There is a function for the mask.", "masklen(cidr)", "SELECT network, masklen(network) FROM banned_networks;"],
			explanation: "24, 24 and 48: an IPv6 /48 is a huge block, still one row.",
		},
		{
			id: "ch34-pr02",
			title: "Filter by network",
			prompt: "Return the distinct **reader_id** of visits made from the network **192.168.7.0/24**.",
			difficulty: 1,
			kind: "query",
			concepts: ["network-types"],
			solutionSql: "SELECT DISTINCT reader_id FROM access_log WHERE ip << '192.168.7.0/24';",
			check: { type: "result" },
			hints: ["Test membership with `<<`.", "The literal is cast to inet automatically.", "WHERE ip << '192.168.7.0/24'"],
			explanation: "Readers 4, 6 and 11.",
		},
		{
			id: "ch34-pr03",
			title: "Encode bytes as base64",
			prompt: "Return the checksum of scroll **1** encoded as **base64** text.",
			difficulty: 1,
			kind: "query",
			concepts: ["bytea-binary"],
			solutionSql: "SELECT encode(checksum, 'base64') AS b64 FROM scrolls WHERE id = 1;",
			check: { type: "result" },
			hints: ["`encode` turns bytes into text.", "The format argument can be 'hex' or 'base64'.", "encode(checksum, 'base64')"],
			explanation: "Base64 needs 24 characters for 16 bytes, hex needs 32.",
		},
		{
			id: "ch34-pr04",
			title: "Bytes versus hex characters",
			prompt: "Return, for scroll **1**, the **number of bytes** of its checksum and the **number of characters** of `md5(body)`, in that order.",
			difficulty: 2,
			kind: "query",
			concepts: ["bytea-binary"],
			solutionSql: "SELECT octet_length(checksum) AS bytes, length(md5(body)) AS chars FROM scrolls WHERE id = 1;",
			check: { type: "result" },
			hints: ["octet_length counts bytes.", "md5 returns hex text.", "SELECT octet_length(checksum), length(md5(body)) ..."],
			explanation: "16 bytes against 32 characters: each byte takes two hex digits.",
		},
		{
			id: "ch34-pr05",
			title: "Containment and distance",
			prompt:
				"Return one row: whether `box '((0,0),(10,10))'` **contains** `point '(3,4)'`, and the **distance** between `point '(0,0)'` and `point '(3,4)'`.",
			difficulty: 1,
			kind: "query",
			concepts: ["geometric-types"],
			solutionSql: "SELECT box '((0,0),(10,10))' @> point '(3,4)' AS inside, point '(0,0)' <-> point '(3,4)' AS distance;",
			check: { type: "result" },
			hints: ["`@>` for containment, `<->` for distance.", "Write both expressions in one SELECT.", "SELECT box '((0,0),(10,10))' @> point '(3,4)', point '(0,0)' <-> point '(3,4)';"],
			explanation: "true and 5: the classic 3-4-5 triangle.",
		},
		{
			id: "ch34-pr06",
			title: "Ancestors of an ltree path",
			prompt:
				"Return the **name** and **path** of every section that is an **ancestor** of `arcana.forbidden.necromancy`, the section itself included, sorted by path.",
			difficulty: 2,
			kind: "query",
			concepts: ["ltree"],
			solutionSql: "SELECT name, path FROM sections WHERE path @> 'arcana.forbidden.necromancy' ORDER BY path;",
			check: { type: "result", orderMatters: true },
			hints: ["Ancestors contain the path.", "`@>` is the mirror of `<@`.", "WHERE path @> 'arcana.forbidden.necromancy'"],
			explanation: "Arcana, Forbidden Shelves, Necromancy: the breadcrumb trail for a page header.",
		},
		{
			id: "ch34-pr07",
			title: "Paths at a given depth",
			prompt: "Return the **name** of every section at **depth 2** (exactly two labels).",
			difficulty: 1,
			kind: "query",
			concepts: ["ltree"],
			solutionSql: "SELECT name FROM sections WHERE nlevel(path) = 2;",
			check: { type: "result" },
			hints: ["Count the labels.", "nlevel(path)", "WHERE nlevel(path) = 2"],
			explanation: "Seven sections are one level under a top level section.",
		},
		{
			id: "ch34-pr08",
			title: "Match a label with lquery",
			prompt: "Return the **name** of every section with a **fire** label anywhere in its path, using an lquery pattern.",
			difficulty: 2,
			kind: "query",
			concepts: ["ltree"],
			solutionSql: "SELECT name FROM sections WHERE path ~ '*.fire.*';",
			check: { type: "result" },
			hints: ["`~` matches an lquery.", "`*` matches any number of labels, zero included.", "WHERE path ~ '*.fire.*'"],
			explanation: "Fire Lore and Dragons. Labels match whole: a `fireplace` label would not match.",
		},
		{
			id: "ch34-pr09",
			title: "Group on a lower-cased domain",
			prompt:
				"Return each email **domain** (the part after `@`) in **lower case**, with the number of **readers** using it.",
			difficulty: 2,
			kind: "query",
			concepts: ["case-insensitive-text"],
			solutionSql: "SELECT lower(split_part(email, '@', 2)) AS domain, count(*) AS readers FROM readers GROUP BY 1;",
			check: { type: "result" },
			hints: [
				"`split_part` returns plain text, which groups case sensitively.",
				"Lower-case the domain before grouping.",
				"SELECT lower(split_part(email, '@', 2)), count(*) ... GROUP BY 1",
			],
			explanation: "One domain, 13 readers. Without `lower`, `Aethel.LIB` forms its own group: citext behaviour stops as soon as a text function returns plain text.",
		},
		{
			id: "ch34-pr10",
			title: "UNIQUE on a citext column",
			prompt:
				"Insert a new reader **Bram Again** with email `BRAM@aethel.lib`, password hash `crypt('x', gen_salt('bf', 4))`, clearance 1 and joined_at `2026-10-31 10:00+00`. The insert must be refused.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["case-insensitive-text"],
			solutionSql:
				"INSERT INTO readers (name, email, password_hash, clearance, joined_at)\nVALUES ('Bram Again', 'BRAM@aethel.lib', crypt('x', gen_salt('bf', 4)), 1, '2026-10-31 10:00+00');",
			check: { type: "error", sqlstate: "23505" },
			hints: ["Bram Tolliver already uses bram@aethel.lib.", "The email column is citext and UNIQUE.", "INSERT INTO readers (name, email, password_hash, clearance, joined_at) VALUES (...);"],
			explanation: "23505: on a citext column, UNIQUE ignores case, so `BRAM@` and `bram@` collide. A text column would have accepted the duplicate.",
		},
		{
			id: "ch34-pr11",
			title: "Test a list of passwords",
			prompt:
				"Given the leaked passwords `letmein`, `password` and `qwerty`, return the **name** of every reader who uses one of them.",
			difficulty: 3,
			kind: "query",
			concepts: ["pgcrypto-hashing"],
			solutionSql:
				"SELECT r.name\nFROM readers r\nWHERE EXISTS (\n  SELECT 1 FROM unnest(ARRAY['letmein', 'password', 'qwerty']) AS p\n  WHERE r.password_hash = crypt(p, r.password_hash)\n);",
			check: { type: "result" },
			hints: [
				"Try every leaked password against every hash.",
				"`unnest` the list and test `crypt(p, password_hash)` in an EXISTS.",
				"WHERE EXISTS (SELECT 1 FROM unnest(ARRAY[...]) p WHERE r.password_hash = crypt(p, r.password_hash))",
			],
			explanation: "Bram, Wendeline and Stephen. bcrypt is slow on purpose: an attacker pays that cost for every guess too.",
		},
		{
			id: "ch34-pr12",
			title: "Size of a SHA-256 digest",
			prompt: "Return the length in **bytes** of `digest('Aethel', 'sha256')`.",
			difficulty: 1,
			kind: "query",
			concepts: ["pgcrypto-hashing"],
			solutionSql: "SELECT octet_length(digest('Aethel', 'sha256')) AS bytes;",
			check: { type: "result" },
			hints: ["digest returns bytea.", "octet_length counts bytes.", "SELECT octet_length(digest('Aethel', 'sha256'));"],
			explanation: "32 bytes, 256 bits, whatever the size of the input.",
		},
	],
};

export default chapter;
