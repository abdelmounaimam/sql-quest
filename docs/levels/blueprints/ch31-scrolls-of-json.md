### ch31-scrolls-of-json · Scrolls of JSON 📦
- **File** `src/content/chapters/ch31-scrolls-of-json.ts` · **World** The Alchemist's Vault · **Tier** adept · **Track** types · **Dataset** `guild`
- **Subtitle** Read, build, unnest and rewrite the heroes' loot bags
- **Concepts** `json-vs-jsonb`, `jsonb-operators`, `jsonb-construction`, `jsonb-decomposition`, `jsonb-modification`
- **Prerequisites** `ch30-shaped-data`, `ch16-champions-of-each-dungeon`
- **Lesson** (10 steps)
  1. explain · Two kinds of scroll: json keeps text (dup keys, order), jsonb parsed and indexable
  2. example · The twin keys: twin keys: `::json::text` vs `::jsonb::text`
  3. explain · Reaching inside: `-> ->> #> #>>`, array index from 0, subscripts
  4. example · Gold in the purse: gold per inventory (missing key → NULL)
  5. quiz · `attributes -> 'heal' > 10` fails 42883 (-> vs ->>)
  6. explain · Containment and keys: `@>`, `?`, `?|`, `?&`; JSON null vs missing key
  7. explain · Building JSON: jsonb_build_object/array, to_jsonb, jsonb_agg (NULL over zero rows)
  8. example · Unpacking the bags: jsonb_array_elements twice for heroes 1, 7, 24
  9. explain · Rewriting a scroll: jsonb_set (jsonb value), `||` shallow, `-`, `#-`
  10. try · Your turn: silver coins: silver as int (starter reads a top-level key)
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch31-ex01 | items whose attributes equal a literal with reordered keys (jsonb equality) | 1 | query | result | json-vs-jsonb | write |
| ch31-ex02 | hero_id and gold as int, richest first (cast before sorting) | 2 | query | result (ordered) | jsonb-operators | write |
| ch31-ex03 | fix `attributes -> 'heal' > 10` (42883): heal > 10 | 2 | query | result | jsonb-operators | fix |
| ch31-ex04 | Nightshade set items with `@>` | 2 | query | result | jsonb-operators | write |
| ch31-ex05 | inventories whose notes key holds JSON null (2, 6, 13) | 3 | query | result | jsonb-operators | write |
| ch31-ex06 | per guild `{guild, heroes[]}` jsonb, `[]` for the empty guild | 3 | query | result | jsonb-construction | write |
| ch31-ex07 | hero_id, item, qty for every item of every bag (25 rows) | 3 | query | result | jsonb-decomposition | write |
| ch31-ex08 | update inventory 2: gold 25 (a number) and remove notes | 3 | mutation | state | jsonb-modification | mutate |
| ch31-ex09 | **Boss · The Quartermaster's Audit**: per inventory hero name, total qty (0), distinct sorted item array (`[]`), LEFT JOIN LATERAL, ordered | 4 | query | result (ordered) | jsonb-decomposition, jsonb-construction, jsonb-operators | write |

- **Practice**: `ch31-pr01` json-vs-jsonb: text of the same literal as json and jsonb; `ch31-pr02` jsonb-operators: `#>>` requires.level >= 10; `ch31-pr03` jsonb-operators: `? 'charges'` incl. JSON null; `ch31-pr04` jsonb-construction: jsonb_build_object for legendary items; `ch31-pr05` jsonb-decomposition: jsonb_object_keys of item 2; `ch31-pr06` jsonb-decomposition: jsonb_array_length of slots; `ch31-pr07` jsonb-modification: `|| '{"enchanted": true}'` on item 17; `ch31-pr08` jsonb-modification: `#- '{damage,fire}'` on item 2
- **Negative cases** (`scripts/negative-cases/ch31-scrolls-of-json.ts`): ex01 `::text` equality, containment instead of equality; ex02 text sort, missing filter; ex03 `->> > '10'` text compare; ex04 `? 'set'`, `-> 'set' = 'Nightshade'` (22P02); ex05 `->> IS NULL`, `NOT ?`; ex06 no coalesce, unsorted; ex07 first bag only; ex08 `'"25"'` string (caught by jsonb_typeof in verify), shallow `||`, notes kept; ex09 comma join, `[null]`, lower-cased names.
- **Notes**: The comparator parses jsonb and canonicalises numeric strings, so a jsonb string "25" equals the number 25 and a jsonb string equals the same text: verifySql must expose `jsonb_typeof` when the type matters. Items 1 and 20 differ only by case; hero 24 has no bags key, hero 7 an empty bags array, hero 8 an empty items array.
