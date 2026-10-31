### ch19-forging-rows · Forging Rows ⚒️
- **File** `src/content/chapters/ch19-forging-rows.ts` · **World** The Forge · **Tier** novice · **Track** mutation · **Dataset** `starport`
- **Subtitle** INSERT new pilots, planets and cargo, and get their ids back
- **Concepts** `insert-basic`, `insert-multi-row`, `default-values`, `returning-clause`, `insert-select`, `sequences`
- **Prerequisites** `ch08-tally-the-loot`
- **Lesson** (9 steps)
  1. explain · Reading is over, time to write: `INSERT INTO table (columns) VALUES (values);` always name the columns; text in single quotes.
  2. example · Register a planet: `INSERT INTO planets (name, sector) VALUES ('Nova Prime', 'Frontier'); SELECT * FROM planets WHERE name = 'Nova Prime';` (id 13 appears by itself, has_spaceport false, the rest NULL).
  3. quiz · You list `(name, sector)` but write `VALUES ('Frontier', 'Nova Prime')`. What happens? (silently swapped: same types, no error)
  4. explain · Omitted columns get their DEFAULT (has_spaceport false, reputation 0) or NULL; the `DEFAULT` keyword asks for it explicitly; an explicit `NULL` is **not** the default (23502 on NOT NULL columns).
  5. explain · Several rows in one statement: `VALUES (...), (...);` one failing row aborts the whole statement.
  6. example · RETURNING: `INSERT INTO factions (name, founded_year) VALUES ('Comet Riders', 2078) RETURNING id, name;`
  7. explain · INSERT ... SELECT copies the result of a query into a table; columns are matched by position, not by name.
  8. explain · Sequences hand out numbers and never take them back: a failed or deleted insert still burns an id. Gaps are normal; never "fill" them by hand (23505 later). `currval` before any `nextval` in the session fails (55000).
  9. try · Register the planet **Glimmerfall** in sector **Frontier** (other columns default). Starter swaps the two values.
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch19-ex01 | Register planet **Nova Prime**, sector **Frontier**, population **12000**, gravity **0.88**; other columns default | 1 | mutation | state | insert-basic | mutate |
| ch19-ex02 | Fix `INSERT INTO commodities VALUES ('Moon Cheese', 'food', 14.00, true, 'wheel');` (22P02: the first column is id). Add Moon Cheese, food, 14.00, legal, sold by the wheel | 1 | mutation | state | insert-basic | fix |
| ch19-ex03 | Three cadets in one statement: **Ivy Starling**, **Bo Ruckus**, **Mox** (Human cadets, joined 2078-01-10 00:00 UTC, no faction, no callsign) | 2 | mutation | state | insert-multi-row | mutate |
| ch19-ex04 | Fix the clerk's INSERT that passes `NULL` for reputation (23502): register **Kip Lanyard** (Vulpine ensign, joined 2078-02-01 00:00 UTC), reputation at its default, credits unknown | 2 | mutation | state | default-values | fix |
| ch19-ex05 | Register ship **Dawn Treader** (Courier Mk II, pilot 4, capacity 40) and **return its id and name** (22) | 2 | mutation | result+state | returning-clause | write |
| ch19-ex06 | setupSql `contraband_archive(commodity_id, name, base_price)`: copy every **illegal** commodity (legal = false, not category contraband: Antimatter Pods counts) | 3 | mutation | state | insert-select | write |
| ch19-ex07 | A clerk registered and deleted a test planet (setupSql burns id 13). Register **Sable Spire** (Frontier) and return its **id** (14, not 13) | 3 | mutation | result+state | sequences | predict |
| ch19-ex08 | **Boss · The New Arrivals**: setupSql `arrivals(name, species, rank, callsign, cleared)` with 5 rows, 4 cleared. Insert the cleared ones as pilots joined 2078-03-01 00:00 UTC (other columns default), ids handed out in name order A to Z, and return **id**, **name**, **callsign** | 4 | mutation | result+state | insert-select, returning-clause, default-values, sequences | write |

- **Practice**: `ch19-pr01` insert-basic: faction **Comet Riders**, founded 2078, homeworld Zephyria (5), no motto; `ch19-pr02` insert-multi-row: routes 11→2 and 2→11, 3.9 ly, no hazard, one statement; `ch19-pr03` insert-multi-row: error mission, three commodities in one statement where the third is a second **Water Ice** → 23505 and nothing is inserted; `ch19-pr04` default-values: commodity **Ion Salt** with `DEFAULT` for legal; `ch19-pr05` returning-clause: insert a trade and return **id** and **value** (`qty * unit_price`); `ch19-pr06` insert-select: copy every Frontier planet's name into setupSql `frontier_watch(planet)`; `ch19-pr07` sequences: insert ship **Firefly** then return `currval` of the ships sequence (22); `ch19-pr08` sequences: error mission, `currval` of the planets sequence in a fresh session → 55000.
- **Negative cases to add**: VALUES swapped (try, ex01); explicit NULL for has_spaceport (23502); `credits` set to 0 in ex04; no RETURNING in ex05 (no result set); `RETURNING *` (wrong columns); `category = 'contraband'` instead of `NOT legal` (ex06 misses Antimatter Pods); explicit id 13 in ex07 ("filling the gap"); boss without ORDER BY (ids in physical order), boss without the `cleared` filter. Accept: `DEFAULT` keyword versions, explicit `false` for has_spaceport, `INSERT ... SELECT` without column list when the order matches, three single INSERTs for ex03 (same end state).
- **Notes**: next identity values: planets 13, factions 7, pilots 25, ships 22, commodities 17, trades 41. `pilots.joined_at` is NOT NULL: every pilot prompt gives it. verifySql never selects ids that depend on insertion order unless the prompt fixes that order (ex07, boss). The app stops at the first error: missions never require a failing statement followed by more SQL.
