### ch34-exotic-matter · Exotic Matter 💎
- **File** `src/content/chapters/ch34-exotic-matter.ts` · **World** The Alchemist's Vault · **Tier** expert · **Track** types · **Dataset** `library`
- **Subtitle** Side quest: networks, bytes, shapes, paths, case blind text and secret hashes
- **Concepts** `network-types`, `bytea-binary`, `geometric-types`, `ltree`, `case-insensitive-text`, `pgcrypto-hashing`
- **Prerequisites** `ch30-shaped-data`, `ch28-cursed-designs`
- **Lesson** (10 steps)
  1. explain · Addresses that know their networks: inet and cidr: `<<`, masklen, host, family
  2. example · Visitors from banned networks: visits from banned networks
  3. explain · Raw bytes: bytea: bytea: hex display, encode/decode, md5 returns text
  4. example · Shapes on the floor plan: geometric literals: `<->`, box and circle `@>`
  5. explain · ltree: paths through the shelves: ltree: `<@`, `@>`, lquery `~`, nlevel, subpath
  6. example · The Arcana wing: the Arcana wing with depth
  7. explain · Text that ignores case: citext, lower() index, ICU nondeterministic, casefold; `::text` breaks it
  8. quiz · verify a password with `crypt(typed, password_hash)`
  9. explain · pgcrypto: one way only: pgcrypto: crypt + gen_salt('bf'), digest, hmac, gen_random_bytes
  10. try · Your turn: the tampered scroll: tampered scroll (starter casts md5 text to bytea)
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch34-ex01 | visits from banned networks: id, ip, reason (12, 13, 19) | 2 | query | result | network-types | write |
| ch34-ex02 | IPv4 visits per /24 block (network(set_masklen(ip, 24))) | 3 | query | result | network-types | write |
| ch34-ex03 | tampered scrolls: checksum <> decode(md5(body), 'hex') → 21 | 2 | query | result | bytea-binary | write |
| ch34-ex04 | 2 reading rooms nearest to (0,0) with distance (setupSql creates reading_rooms) | 2 | query | result (ordered) | geometric-types | write |
| ch34-ex05 | sections strictly below history, path order | 2 | query | result (ordered) | ltree | write |
| ch34-ex06 | fix `email = '...'::text` (case sensitive) → citext comparison | 2 | query | result | case-insensitive-text | fix |
| ch34-ex07 | reader whose password is hunter2 (crypt with stored hash) | 2 | query | result | pgcrypto-hashing | write |
| ch34-ex08 | **Boss · The Warden's Sweep**: visits to arcana.forbidden subtree: visitor email or anonymous, banned flag, path, intact checksum, sha256 hex seal; ordered by id | 5 | query | result (ordered) | network-types, ltree, bytea-binary, pgcrypto-hashing, case-insensitive-text | write |

- **Practice**: `ch34-pr01` network-types: masklen of banned networks; `ch34-pr02` network-types: readers from 192.168.7.0/24; `ch34-pr03` bytea-binary: base64 checksum of scroll 1; `ch34-pr04` bytea-binary: 16 bytes vs 32 hex characters; `ch34-pr05` geometric-types: box contains point, distance 5; `ch34-pr06` ltree: ancestors of arcana.forbidden.necromancy; `ch34-pr07` ltree: nlevel = 2; `ch34-pr08` ltree: lquery `*.fire.*`; `ch34-pr09` case-insensitive-text: readers per lower-cased domain; `ch34-pr10` case-insensitive-text: duplicate citext email must fail 23505; `ch34-pr11` pgcrypto-hashing: readers using leaked passwords; `ch34-pr12` pgcrypto-hashing: sha256 digest is 32 bytes
- **Negative cases** (`scripts/negative-cases/ch34-exotic-matter.ts`): ex01 host LIKE, equality; ex02 IPv6 kept, /16; ex03 `md5(body)::bytea`; ex04 sort by x, farthest first; ex05 root included, wrong order; ex06 `email::text =`; ex07 fresh gen_salt, md5; ex08 inner join on readers, `= 'arcana.forbidden'`, md5 cast, digest of title. Accept `>>`, `<<=`, encode on the text side, sqrt distance, lquery `{1,}`, lower(email), LEFT JOIN banned_networks.
- **Notes**: library has no geometric data and no cube/earthdistance: ex04 builds `reading_rooms(name, seat point)` in setupSql (6 rows, no distance ties). bcrypt cost 4 keeps crypt over 13 readers fast. Side quest: prerequisites ch30 and ch28.
