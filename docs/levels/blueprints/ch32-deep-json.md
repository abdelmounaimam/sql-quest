### ch32-deep-json · Deep JSON 🔮
- **File** `src/content/chapters/ch32-deep-json.ts` · **World** The Alchemist's Vault · **Tier** expert · **Track** types · **Dataset** `guild`
- **Subtitle** jsonpath, JSON_TABLE, GIN indexes and the old hstore
- **Concepts** `sql-json-path`, `json-table`, `jsonb-indexing`, `hstore`
- **Prerequisites** `ch31-scrolls-of-json`
- **Lesson** (10 steps)
  1. explain · jsonpath: a map of the scroll: jsonpath: `$`, `.key`, `[*]`, filters `? (@.qty > 5)`, `==`, `@?`
  2. example · Big stacks: items with qty > 5 via jsonb_path_query
  3. quiz · fire enchant anywhere (`@?` vs arrow chain, `?`, `=` in path)
  4. explain · SQL/JSON functions: json_exists, json_value RETURNING, json_query, IS JSON, lax mode
  5. explain · JSON_TABLE: a document becomes a table: JSON_TABLE COLUMNS/PATH, NESTED PATH as an outer join
  6. example · Finn's bags as a table: Finn's bags with an empty bag row
  7. explain · Indexing jsonb: GIN jsonb_ops vs jsonb_path_ops vs B-tree expression index
  8. example · Watch the index kick in: CREATE INDEX + `SET enable_seqscan = off` + EXPLAIN shows a Bitmap Index Scan
  9. explain · hstore, the elder map: hstore: `->` text, `?`, `?&`, each(), hstore_to_jsonb
  10. try · Your turn: honorary titles: hero_id and title (starter uses `->>`, which hstore lacks)
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch32-ex01 | hero_id and item names with qty > 2 via jsonpath | 2 | query | result | sql-json-path | write |
| ch32-ex02 | inventories with a fire enchant (`@?`): 1, 3, 20 | 2 | query | result | sql-json-path | write |
| ch32-ex03 | fix `@.item = "Torch"` (jsonpath syntax error) → `==` | 2 | query | result | sql-json-path | fix |
| ch32-ex04 | JSON_TABLE hero_id, slot, item, qty with NESTED PATH (empty bag row kept) | 3 | query | result | json-table | write |
| ch32-ex05 | create an index so `attributes @> ...` uses a Bitmap Index Scan (plan_of helper in setupSql, `SET enable_seqscan = off` in verify) | 3 | ddl | state | jsonb-indexing | optimize |
| ch32-ex06 | hero_titles with a non NULL granted_by | 2 | query | result | hstore | write |
| ch32-ex07 | each(titles) pairs sorted by hero_id, key | 2 | query | result (ordered) | hstore | write |
| ch32-ex08 | **Boss · The Philosopher's Inventory** (World 8 boss): per inventory name, hstore title, enchanted item count, total enchant power, set_piece via JSON_TABLE join with items; ordered | 5 | query | result (ordered) | sql-json-path, json-table, hstore, jsonb-decomposition | write |

- **Practice**: `ch32-pr01` sql-json-path: jsonb_path_query_array of hero 3's items; `ch32-pr02` sql-json-path: json_value RETURNING int; `ch32-pr03` json-table: item 2 spec sheet (set, level, slots jsonb); `ch32-pr04` json-table: hero 8 bags with NESTED PATH outer row; `ch32-pr05` jsonb-indexing: GIN jsonb_path_ops on inventories.doc; `ch32-pr06` jsonb-indexing: B-tree on `(attributes ->> 'set')`; `ch32-pr07` hstore: hstore_to_jsonb for hero 25; `ch32-pr08` hstore: `?&` title and since
- **Negative cases** (`scripts/negative-cases/ch32-deep-json.ts`): ex01 first item of each bag, `>=`; ex02 arrow chain on the first item, any enchant; ex03 drops a hero (accept `@@`, like_regex, `::text LIKE`); ex04 comma join drops the empty bag; ex05 B-tree expression index, wrong column (accept jsonb_path_ops); ex06 `? 'granted_by'`; ex07 sorted by value; ex08 all items counted, inner join on titles, first item only.
- **Notes**: Plan checks: `plan_of(q)` returns `EXPLAIN (FORMAT JSON, COSTS OFF)` text; items has 21 rows so verify sets `enable_seqscan = off`. Under heavy machine load the first item of a run can exceed 30 s: validate with `--timeout=120000`. This chapter carries the World 8 boss.
