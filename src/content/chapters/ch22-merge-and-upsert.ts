import type { Chapter } from "../types";

const COMMODITIES =
	"SELECT name, category, base_price, legal, unit FROM commodities ORDER BY name;";
const LATEST_QUOTES =
	"SELECT f.commodity_name, f.price\n  FROM price_feed f\n  WHERE f.quoted_at = (SELECT max(g.quoted_at) FROM price_feed g WHERE g.commodity_name = f.commodity_name)";
const ROUTES_STATE =
	"SELECT from_planet_id, to_planet_id, distance_ly, hazard FROM routes ORDER BY from_planet_id, to_planet_id;";

const chapter: Chapter = {
	id: "ch22-merge-and-upsert",
	order: 22,
	world: "The Forge",
	tier: "adept",
	track: "mutation",
	title: "Merge and Upsert",
	subtitle: "INSERT ... ON CONFLICT, MERGE, data-modifying CTEs and staged bulk loading",
	emoji: "🔀",
	datasetId: "starport",
	concepts: ["upsert-on-conflict", "merge-statement", "data-modifying-cte", "bulk-load-copy"],
	prerequisites: ["ch21-the-pact", "ch13-unions-and-named-spells"],
	lesson: [
		{
			kind: "explain",
			title: "Insert or update?",
			body: "The `price_feed` table holds price quotes by commodity name. Some names already exist in `commodities` (Water Ice), one does not (Asteroid Honey).\n\n- A plain INSERT fails on the existing names: **23505**.\n- A plain UPDATE silently ignores the new one.\n\nYou need *insert, or update if the row already exists*: an **upsert**.",
		},
		{
			kind: "example",
			title: "ON CONFLICT DO UPDATE",
			body: "Comet Tea already exists, so instead of failing, the INSERT updates its price.",
			sql: "INSERT INTO commodities (name, base_price, unit)\nVALUES ('Comet Tea', 19.00, 'crate')\nON CONFLICT (name)\nDO UPDATE SET base_price = EXCLUDED.base_price\nRETURNING name, base_price;",
		},
		{
			kind: "explain",
			title: "The rules of ON CONFLICT",
			body: "- `ON CONFLICT (name)` needs a **unique index** on exactly that column, otherwise **42P10**.\n- `DO NOTHING` skips the conflicting row without an error.\n- `EXCLUDED` is the row you *tried* to insert; the table name refers to the existing row.\n- In expressions, qualify the columns: `cargo_stock.qty + EXCLUDED.qty`. A bare `qty` is ambiguous (**42702**).",
		},
		{
			kind: "quiz",
			question:
				"`INSERT INTO commodities (name, base_price, unit) SELECT commodity_name, price, 'crate' FROM price_feed ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price;` fails with 21000. Why?",
			choices: [
				"Asteroid Honey is not in commodities yet",
				"Water Ice appears twice in the feed, so one statement would update the same row twice",
				"EXCLUDED cannot be used with INSERT ... SELECT",
				"The feed's price column has another type",
			],
			answerIndex: 1,
			explanation:
				"An upsert may change each target row only **once** per statement. `price_feed` has two quotes for Water Ice (08:00 and 09:30): PostgreSQL does not choose one and fails (*cannot affect row a second time*). Deduplicate the source first.",
		},
		{
			kind: "explain",
			title: "MERGE",
			body: "```sql\nMERGE INTO commodities c\nUSING source s ON c.name = s.name\nWHEN MATCHED AND c.base_price <> s.price THEN\n  UPDATE SET base_price = s.price\nWHEN NOT MATCHED THEN\n  INSERT (name, base_price, unit) VALUES (s.name, s.price, 'crate');\n```\nWHEN clauses are evaluated **in order**, and the first one that applies is used. Other actions: `THEN DELETE`, `THEN DO NOTHING`, `WHEN NOT MATCHED BY SOURCE`. `RETURNING merge_action()` reports the action taken; `old.col` / `new.col` give the values before and after.",
		},
		{
			kind: "example",
			title: "MERGE with an inline source",
			body: "Two rows in a VALUES source: Comet Tea exists, Moon Cheese does not.",
			sql: "MERGE INTO commodities c\nUSING (VALUES ('Comet Tea', 19.00), ('Moon Cheese', 14.00)) AS s(name, price)\nON c.name = s.name\nWHEN MATCHED THEN\n  UPDATE SET base_price = s.price\nWHEN NOT MATCHED THEN\n  INSERT (name, base_price, unit) VALUES (s.name, s.price, 'crate')\nRETURNING merge_action(), c.name, c.base_price;",
		},
		{
			kind: "explain",
			title: "Data-modifying statements in WITH",
			body: "A CTE may contain an INSERT, UPDATE, DELETE or MERGE, and pass its RETURNING rows to the main statement:\n```sql\nWITH moved AS (\n  DELETE FROM seizures WHERE fine IS NULL\n  RETURNING *\n)\nINSERT INTO seizure_archive\nSELECT * FROM moved;\n```\nIt is one statement, so it is atomic: rows cannot be deleted without being archived.",
		},
		{
			kind: "explain",
			title: "Bulk loading",
			body: "A PostgreSQL server loads files with `COPY commodities FROM '/data/feed.csv' WITH (FORMAT csv, HEADER true)` (disabled in this sandbox).\n\nThe robust pattern is the same everywhere: load the raw text into a **staging table**, inspect it, then `INSERT ... SELECT` with `trim`, `split_part` and casts. Skip the header line and blank lines: one invalid value aborts the whole load (22P02).",
		},
		{
			kind: "example",
			title: "Split CSV text into rows",
			body: "`string_to_table` splits a text into one row per line, and `split_part` extracts the fields. Note the header and the empty last line: both must be filtered out before loading.",
			sql: "SELECT line,\n       split_part(line, ',', 1) AS name,\n       split_part(line, ',', 2) AS price\nFROM string_to_table(E'name,price\\nIon Salt,22.00\\nStar Anise,9.50\\n', E'\\n') AS line;",
		},
		{
			kind: "try",
			title: "Try it: upsert one row",
			prompt:
				"Upsert **Comet Tea** at **19.50**: if the name exists, only its base_price changes; otherwise insert it with unit **crate**.",
			starterSql:
				"INSERT INTO commodities (name, base_price, unit)\nVALUES ('Comet Tea', 19.50, 'crate');",
			solutionSql:
				"INSERT INTO commodities (name, base_price, unit)\nVALUES ('Comet Tea', 19.50, 'crate')\nON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price;",
			check: { type: "state", verifySql: COMMODITIES },
			hints: [
				"Run the starter: 23505, Comet Tea already exists.",
				"Add ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price",
			],
		},
	],
	exercises: [
		{
			id: "ch22-ex01",
			title: "Insert and skip existing names",
			prompt:
				"In **one INSERT**, add these commodities, **skipping** any whose name already exists (existing rows stay exactly as they are):\n\n| name | category | base_price | unit |\n|---|---|---|---|\n| Asteroid Honey | luxury | 66.00 | jar |\n| Water Ice | essentials | 99.00 | ton |\n| Comet Tea | food | 25.00 | crate |",
			difficulty: 2,
			kind: "mutation",
			concepts: ["upsert-on-conflict"],
			solutionSql:
				"INSERT INTO commodities (name, category, base_price, unit)\nVALUES ('Asteroid Honey', 'luxury', 66.00, 'jar'),\n       ('Water Ice', 'essentials', 99.00, 'ton'),\n       ('Comet Tea', 'food', 25.00, 'crate')\nON CONFLICT (name) DO NOTHING;",
			check: { type: "state", verifySql: COMMODITIES },
			hints: [
				"A plain INSERT stops at the first duplicate (23505) and inserts nothing.",
				"ON CONFLICT ... DO NOTHING skips the conflicting rows.",
				"... VALUES (...), (...), (...) ON CONFLICT (name) DO NOTHING;",
			],
			explanation:
				"Only Asteroid Honey is new; the two conflicting rows are skipped and Water Ice keeps its 12.00. Run it twice and nothing more changes: the statement is **idempotent**.\n\n**Pitfall:** `DO UPDATE` would overwrite Water Ice with 99.00.\n\n**Alternative:** `ON CONFLICT DO NOTHING` without a target skips conflicts on any unique key.",
		},
		{
			id: "ch22-ex02",
			title: "Upsert two rows",
			prompt:
				"In **one upsert**, process these two rows. An existing commodity only gets its **base_price** updated; a new one is inserted with all four values.\n\n| name | category | base_price | unit |\n|---|---|---|---|\n| Void Pearls | luxury | 2100.00 | pearl |\n| Moon Cheese | food | 14.00 | wheel |",
			difficulty: 2,
			kind: "mutation",
			concepts: ["upsert-on-conflict"],
			solutionSql:
				"INSERT INTO commodities (name, category, base_price, unit)\nVALUES ('Void Pearls', 'luxury', 2100.00, 'pearl'),\n       ('Moon Cheese', 'food', 14.00, 'wheel')\nON CONFLICT (name)\nDO UPDATE SET base_price = EXCLUDED.base_price;",
			check: { type: "state", verifySql: COMMODITIES },
			hints: [
				"One INSERT with two rows, plus an ON CONFLICT clause.",
				"DO UPDATE SET ... with EXCLUDED, the row you tried to insert.",
				"ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price;",
			],
			explanation:
				"Moon Cheese is inserted; Void Pearls conflicts on `name` and only its price is updated.\n\n**Pitfall:** `DO NOTHING` leaves Void Pearls at 1999.99, and `SET base_price = 2100.00` hard codes one row's value into a rule that applies to every row.",
		},
		{
			id: "ch22-ex03",
			title: "Fix: ambiguous column in DO UPDATE",
			prompt:
				"The table `cargo_stock (commodity, qty)` holds current quantities. The starter fails with `column reference \"qty\" is ambiguous`. Fix the upsert so the delivered quantities are **added** to the existing stock, and commodities not in stock yet are inserted with the delivered quantity.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["upsert-on-conflict"],
			setupSql:
				"CREATE TABLE cargo_stock (commodity text PRIMARY KEY, qty int NOT NULL);\nINSERT INTO cargo_stock VALUES ('Water Ice', 500), ('Space Kelp', 200);",
			starterSql:
				"INSERT INTO cargo_stock (commodity, qty)\nVALUES ('Water Ice', 300), ('Comet Tea', 40), ('Space Kelp', 25)\nON CONFLICT (commodity)\nDO UPDATE SET qty = qty + EXCLUDED.qty;",
			solutionSql:
				"INSERT INTO cargo_stock (commodity, qty)\nVALUES ('Water Ice', 300), ('Comet Tea', 40), ('Space Kelp', 25)\nON CONFLICT (commodity)\nDO UPDATE SET qty = cargo_stock.qty + EXCLUDED.qty;",
			check: { type: "state", verifySql: "SELECT commodity, qty FROM cargo_stock ORDER BY commodity;" },
			hints: [
				"Inside DO UPDATE, two rows are in scope: the existing one and the proposed one.",
				"`qty` alone could mean either; qualify it with the table name for the existing row.",
				"SET qty = cargo_stock.qty + EXCLUDED.qty",
			],
			explanation:
				"`cargo_stock.qty` is the existing quantity, `EXCLUDED.qty` the delivered one: Water Ice reaches 800, Space Kelp 225, Comet Tea is inserted with 40. Only the left side of SET stays unqualified (it always names a target column).\n\n**Pitfall:** `SET qty = EXCLUDED.qty` runs without error and silently **replaces** the stock with the delivery.",
		},
		{
			id: "ch22-ex04",
			title: "Upsert from a source with duplicates",
			prompt:
				"Write the upsert that copies every row of `price_feed` into `commodities` (name, base_price, unit `crate`) with `ON CONFLICT (name) DO UPDATE` of the price. It must **fail**: run it and read the error code.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["upsert-on-conflict"],
			solutionSql:
				"INSERT INTO commodities (name, base_price, unit)\nSELECT commodity_name, price, 'crate' FROM price_feed\nON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price;",
			check: { type: "error", sqlstate: "21000" },
			hints: [
				"INSERT ... SELECT from price_feed, then the ON CONFLICT clause.",
				"Look at the feed: does every name appear only once?",
				"INSERT INTO commodities (name, base_price, unit) SELECT commodity_name, price, 'crate' FROM price_feed ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price;",
			],
			explanation:
				"21000 (*cardinality violation*): Water Ice is quoted twice, so the statement would update the same row twice. PostgreSQL fails rather than choose one.\n\n**Pitfall:** without ON CONFLICT you get 23505 instead, on the first existing name. Different code, different problem.",
		},
		{
			id: "ch22-ex05",
			title: "Fix: MERGE with a duplicated source",
			prompt:
				"The starter fails with `MERGE command cannot affect row a second time`. Fix the MERGE so it uses only the **latest quote** (`quoted_at`) of each commodity name: matched commodities get that **price** as base_price, unknown names are inserted with that price and unit **crate**.",
			difficulty: 4,
			kind: "mutation",
			concepts: ["merge-statement"],
			starterSql:
				"MERGE INTO commodities c\nUSING price_feed f\nON c.name = f.commodity_name\nWHEN MATCHED THEN\n  UPDATE SET base_price = f.price\nWHEN NOT MATCHED THEN\n  INSERT (name, base_price, unit) VALUES (f.commodity_name, f.price, 'crate');",
			solutionSql: `MERGE INTO commodities c\nUSING (\n  ${LATEST_QUOTES}\n) AS f\nON c.name = f.commodity_name\nWHEN MATCHED THEN\n  UPDATE SET base_price = f.price\nWHEN NOT MATCHED THEN\n  INSERT (name, base_price, unit) VALUES (f.commodity_name, f.price, 'crate');`,
			check: { type: "state", verifySql: COMMODITIES },
			hints: [
				"The source must have one row per commodity name. Write that SELECT first.",
				"Keep a feed row only if its quoted_at is the max quoted_at for its name (a correlated subquery), then use that SELECT in USING (...) AS f.",
				"USING (SELECT f.commodity_name, f.price FROM price_feed f WHERE f.quoted_at = (SELECT max(g.quoted_at) FROM price_feed g WHERE g.commodity_name = f.commodity_name)) AS f",
			],
			explanation:
				"With one row per name, every target row is matched at most once: Water Ice gets the 09:30 quote (12.75), Asteroid Honey is inserted.\n\n**Pitfall:** picking the *first* quote (`min(quoted_at)`, or DISTINCT ON sorted ascending) runs without error and stores the older 12.50.\n\n**Alternative:** `SELECT DISTINCT ON (commodity_name) commodity_name, price FROM price_feed ORDER BY commodity_name, quoted_at DESC` (DISTINCT ON, covered in *Champions of Each Dungeon*).",
		},
		{
			id: "ch22-ex06",
			title: "Conditional MERGE with RETURNING",
			prompt:
				"MERGE the latest quote of each commodity into `commodities` as in the previous exercise, but update a matched commodity **only when its base_price differs** from the quote. **Return** `merge_action()`, the commodity **name** and its new **base_price** for every row changed.",
			difficulty: 4,
			kind: "mutation",
			concepts: ["merge-statement", "returning-clause"],
			solutionSql: `MERGE INTO commodities c\nUSING (\n  ${LATEST_QUOTES}\n) AS f\nON c.name = f.commodity_name\nWHEN MATCHED AND c.base_price <> f.price THEN\n  UPDATE SET base_price = f.price\nWHEN NOT MATCHED THEN\n  INSERT (name, base_price, unit) VALUES (f.commodity_name, f.price, 'crate')\nRETURNING merge_action(), c.name, c.base_price;`,
			check: { type: "result+state", verifySql: COMMODITIES },
			hints: [
				"Start from your MERGE of the previous exercise.",
				"WHEN MATCHED accepts an extra condition: `WHEN MATCHED AND ... THEN`. Rows matching no clause are left unchanged.",
				"WHEN MATCHED AND c.base_price <> f.price THEN UPDATE ...; finish with RETURNING merge_action(), c.name, c.base_price;",
			],
			explanation:
				"Nebula Spice is quoted at its current 455.00, matches no WHEN clause and is left unchanged: four UPDATE rows and one INSERT row are returned.\n\n**Pitfall:** an unconditional WHEN MATCHED rewrites Nebula Spice with the same value and reports it as an UPDATE, which adds noise to any change log.\n\n**Alternative:** `c.base_price IS DISTINCT FROM f.price` also handles a NULL price.",
		},
		{
			id: "ch22-ex07",
			title: "Move rows with a DELETE in a CTE",
			prompt:
				"The table `seizure_archive` has the same columns as `seizures`. In **one statement**, move every seizure made **before 2077-01-01** from `seizures` into `seizure_archive` (all columns, values unchanged).",
			difficulty: 4,
			kind: "mutation",
			concepts: ["data-modifying-cte"],
			setupSql:
				"CREATE TABLE seizure_archive (id int, ship_id int, commodity_id int, qty int, fine numeric(10,2), seized_at date);",
			solutionSql:
				"WITH moved AS (\n  DELETE FROM seizures\n  WHERE seized_at < '2077-01-01'\n  RETURNING *\n)\nINSERT INTO seizure_archive\nSELECT * FROM moved;",
			check: {
				type: "state",
				verifySql:
					"SELECT 'live' AS place, id, ship_id, commodity_id, qty, fine, seized_at FROM seizures\nUNION ALL\nSELECT 'archive', id, ship_id, commodity_id, qty, fine, seized_at FROM seizure_archive\nORDER BY 1, 2;",
			},
			hints: [
				"DELETE ... RETURNING * returns the deleted rows.",
				"Wrap the DELETE in a CTE and pass its rows to an INSERT.",
				"WITH moved AS (DELETE FROM seizures WHERE seized_at < '2077-01-01' RETURNING *) INSERT INTO seizure_archive SELECT * FROM moved;",
			],
			explanation:
				"The DELETE inside WITH returns exactly the rows it removed, and the INSERT archives exactly those rows: five seizures from 2076 are moved, and no row can be lost between the two steps.\n\n**Pitfall:** `INSERT ... SELECT` then `DELETE` as two statements works only if both use exactly the same filter; one typo and rows are lost or duplicated.",
		},
		{
			id: "ch22-ex08",
			title: "Load CSV lines from a staging table",
			prompt:
				"The table `cargo_csv (line_no, line)` holds a CSV file, one line per row. Line 1 is the header `name,category,base_price,unit`, and some fields are padded with spaces. Insert every **data** line as a commodity: the four comma separated fields go into **name**, **category**, **base_price** and **unit**, each **trimmed** of surrounding spaces, the price as a number. Skip the header line.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["bulk-load-copy", "insert-select"],
			setupSql:
				"CREATE TABLE cargo_csv (line_no int, line text);\nINSERT INTO cargo_csv VALUES\n  (1, 'name,category,base_price,unit'),\n  (2, 'Ion Salt,essentials,22.00,sack'),\n  (3, '  Moon Cheese , food , 14.00 , wheel '),\n  (4, 'Star Anise,food,9.50,jar');",
			solutionSql:
				"INSERT INTO commodities (name, category, base_price, unit)\nSELECT trim(split_part(line, ',', 1)),\n       trim(split_part(line, ',', 2)),\n       trim(split_part(line, ',', 3))::numeric,\n       trim(split_part(line, ',', 4))\nFROM cargo_csv\nWHERE line_no > 1;",
			check: { type: "state", verifySql: COMMODITIES },
			hints: [
				"First SELECT the four fields with split_part(line, ',', n) and look at line 3.",
				"trim() removes the padding; the header must be filtered out or its 'base_price' fails the cast.",
				"INSERT INTO commodities (name, category, base_price, unit) SELECT trim(split_part(line, ',', 1)), ... FROM cargo_csv WHERE line_no > 1;",
			],
			explanation:
				"A staging table lets you inspect raw text before it reaches the real table; INSERT ... SELECT then cleans and casts in one pass.\n\n**Pitfall:** without skipping the header, `'base_price'::numeric` fails with 22P02 and nothing is loaded; without trim, `'  Moon Cheese '` is stored as a different name than `'Moon Cheese'`.",
		},
		{
			id: "ch22-ex09",
			title: "Boss: The Smith's Ledger",
			story:
				"Combines a conditional MERGE from a deduplicated source, RETURNING with old and new values, a data-modifying CTE and a transaction.",
			prompt:
				"The table `price_log (name, old_price, new_price, action)` records price changes. Inside **BEGIN** / **COMMIT**, in one statement:\n\n- MERGE the **latest quote** of each commodity name into `commodities`: update the base_price **only when it differs**, insert unknown names with that price and unit **crate**;\n- log every row the MERGE changed into `price_log`: **name**, **old_price** (base_price before, NULL for an insert), **new_price** (after) and **action** (`merge_action()`).\n\nRunning the script a second time must not change or log anything.",
			difficulty: 5,
			kind: "transaction",
			concepts: ["merge-statement", "data-modifying-cte", "transactions-basics"],
			setupSql: "CREATE TABLE price_log (name text, old_price numeric, new_price numeric, action text);",
			solutionSql: `BEGIN;\nWITH changes AS (\n  MERGE INTO commodities c\n  USING (\n    ${LATEST_QUOTES}\n  ) AS f\n  ON c.name = f.commodity_name\n  WHEN MATCHED AND c.base_price <> f.price THEN\n    UPDATE SET base_price = f.price\n  WHEN NOT MATCHED THEN\n    INSERT (name, base_price, unit) VALUES (f.commodity_name, f.price, 'crate')\n  RETURNING c.name, old.base_price AS old_price, new.base_price AS new_price, merge_action() AS action\n)\nINSERT INTO price_log (name, old_price, new_price, action)\nSELECT name, old_price, new_price, action FROM changes;\nCOMMIT;`,
			check: {
				type: "state",
				verifySql:
					"SELECT 'commodity' AS kind, name, base_price AS a, NULL::numeric AS b, unit AS info FROM commodities\nUNION ALL\nSELECT 'log', name, old_price, new_price, action FROM price_log\nORDER BY 1, 2;",
			},
			hints: [
				"Reuse the MERGE of *Conditional MERGE with RETURNING*, then wrap it in WITH changes AS (...).",
				"In MERGE's RETURNING, `old.base_price` is the value before and `new.base_price` the value after; an INSERT has no old row, so old is NULL.",
				"WITH changes AS (MERGE ... RETURNING c.name, old.base_price, new.base_price, merge_action()) INSERT INTO price_log (name, old_price, new_price, action) SELECT * FROM changes;",
			],
			explanation:
				"The MERGE and the log insert are one statement inside one transaction, so the log always matches the prices. Four updates and the Asteroid Honey insert are logged; a second run finds nothing to change and logs nothing.\n\n**Pitfall:** an unconditional WHEN MATCHED logs Nebula Spice (455.00 to 455.00) on every run, and a source with duplicate names would abort the statement with 21000.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch22-pr01",
			title: "Upsert two columns",
			prompt:
				"In **one upsert** on `reputation_tiers` (key `tier`), apply these two rows: if the tier exists, update both bounds; otherwise insert it.\n\n| tier | min_rep | max_rep |\n|---|---|---|\n| legend | 800 | 1200 |\n| mythic | 1201 | 2000 |",
			difficulty: 2,
			kind: "mutation",
			concepts: ["upsert-on-conflict"],
			solutionSql:
				"INSERT INTO reputation_tiers (tier, min_rep, max_rep)\nVALUES ('legend', 800, 1200), ('mythic', 1201, 2000)\nON CONFLICT (tier)\nDO UPDATE SET min_rep = EXCLUDED.min_rep, max_rep = EXCLUDED.max_rep;",
			check: {
				type: "state",
				verifySql: "SELECT tier, min_rep, max_rep FROM reputation_tiers ORDER BY tier;",
			},
			hints: [
				"`tier` is the primary key, so it can be the conflict target.",
				"Two assignments in DO UPDATE SET, both from EXCLUDED.",
				"ON CONFLICT (tier) DO UPDATE SET min_rep = EXCLUDED.min_rep, max_rep = EXCLUDED.max_rep;",
			],
			explanation:
				"`legend` is extended to 1200, `mythic` is inserted.\n\n**Pitfall:** `DO NOTHING` would insert mythic but leave legend at a max_rep of 1000.",
		},
		{
			id: "ch22-pr02",
			title: "ON CONFLICT without a unique index",
			prompt:
				"Write `INSERT INTO commodities (name, unit) VALUES ('Moon Dust', 'gram') ON CONFLICT (unit) DO NOTHING;`. It must **fail**: run it and read the error code.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["upsert-on-conflict"],
			solutionSql:
				"INSERT INTO commodities (name, unit) VALUES ('Moon Dust', 'gram') ON CONFLICT (unit) DO NOTHING;",
			check: { type: "error", sqlstate: "42P10" },
			hints: [
				"Copy the statement as given.",
				"Is `unit` unique in commodities?",
				"Many commodities share a unit, so no unique index can back that conflict target.",
			],
			explanation:
				"42P10: ON CONFLICT needs a unique index or constraint on exactly the listed columns, and `unit` has none.\n\n**Pitfall:** adding a UNIQUE constraint on unit to remove the error would forbid two commodities with the unit crate.",
		},
		{
			id: "ch22-pr03",
			title: "MERGE with WHEN NOT MATCHED BY SOURCE",
			prompt:
				"With **one MERGE** on `routes`, using the source `(VALUES (1, 11, 2.6), (1, 3, 9.9))` (from planet, to planet, distance): update the distance of routes that exist, insert the missing ones (no hazard), and **delete** every route leaving planet 1 that is not in the list. Routes leaving other planets stay unchanged.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["merge-statement"],
			solutionSql:
				"MERGE INTO routes r\nUSING (VALUES (1, 11, 2.6), (1, 3, 9.9)) AS o(from_id, to_id, dist)\nON r.from_planet_id = o.from_id AND r.to_planet_id = o.to_id\nWHEN MATCHED THEN\n  UPDATE SET distance_ly = o.dist\nWHEN NOT MATCHED THEN\n  INSERT (from_planet_id, to_planet_id, distance_ly) VALUES (o.from_id, o.to_id, o.dist)\nWHEN NOT MATCHED BY SOURCE AND r.from_planet_id = 1 THEN\n  DELETE;",
			check: { type: "state", verifySql: ROUTES_STATE },
			hints: [
				"Three clauses: MATCHED, NOT MATCHED, NOT MATCHED BY SOURCE.",
				"NOT MATCHED BY SOURCE means a target row that no source row matches. Restrict it to planet 1, or every other route is deleted too.",
				"WHEN NOT MATCHED BY SOURCE AND r.from_planet_id = 1 THEN DELETE",
			],
			explanation:
				"1 → 11 is updated, 1 → 3 inserted, 1 → 2 deleted, and every other route is unchanged.\n\n**Pitfall:** an unconditional `WHEN NOT MATCHED BY SOURCE THEN DELETE` deletes every route except the two in the source.",
		},
		{
			id: "ch22-pr04",
			title: "Fix: order of WHEN clauses",
			prompt:
				"The starter fails with `unreachable WHEN clause specified after unconditional WHEN clause`. Fix the MERGE: a matched tier flagged **retire** is deleted, any other matched tier gets the new bounds, and a new tier is inserted.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["merge-statement"],
			starterSql:
				"MERGE INTO reputation_tiers t\nUSING (VALUES ('unknown', 0, 99, true),\n             ('trusted', 100, 549, false),\n             ('elite', 1001, 1200, false)) AS s(tier, min_rep, max_rep, retire)\nON t.tier = s.tier\nWHEN MATCHED THEN\n  UPDATE SET min_rep = s.min_rep, max_rep = s.max_rep\nWHEN MATCHED AND s.retire THEN\n  DELETE\nWHEN NOT MATCHED THEN\n  INSERT (tier, min_rep, max_rep) VALUES (s.tier, s.min_rep, s.max_rep);",
			solutionSql:
				"MERGE INTO reputation_tiers t\nUSING (VALUES ('unknown', 0, 99, true),\n             ('trusted', 100, 549, false),\n             ('elite', 1001, 1200, false)) AS s(tier, min_rep, max_rep, retire)\nON t.tier = s.tier\nWHEN MATCHED AND s.retire THEN\n  DELETE\nWHEN MATCHED THEN\n  UPDATE SET min_rep = s.min_rep, max_rep = s.max_rep\nWHEN NOT MATCHED THEN\n  INSERT (tier, min_rep, max_rep) VALUES (s.tier, s.min_rep, s.max_rep);",
			check: {
				type: "state",
				verifySql: "SELECT tier, min_rep, max_rep FROM reputation_tiers ORDER BY tier;",
			},
			hints: [
				"MERGE evaluates the WHEN clauses from top to bottom.",
				"An unconditional WHEN MATCHED catches every matched row, so nothing after it could ever run.",
				"Put `WHEN MATCHED AND s.retire THEN DELETE` before the plain `WHEN MATCHED`.",
			],
			explanation:
				"The specific clause must come before the general one: `unknown` is deleted, `trusted` is extended to 549, `elite` is inserted.\n\n**Pitfall:** the same ordering mistake with two *conditional* clauses gives no error at all, just the wrong action.",
		},
		{
			id: "ch22-pr05",
			title: "Insert related rows with a CTE",
			prompt:
				"In **one statement**, insert pilot **Firefly Jones** (Human ensign, joined **2078-04-01 00:00 UTC**) and the ship **Firefly** (model **Courier Mk II**, capacity **40**) whose pilot is that new pilot. Use a data-modifying CTE to pass the new pilot id to the ship.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["data-modifying-cte"],
			solutionSql:
				"WITH new_pilot AS (\n  INSERT INTO pilots (name, species, rank, joined_at)\n  VALUES ('Firefly Jones', 'Human', 'ensign', '2078-04-01 00:00:00+00')\n  RETURNING id\n)\nINSERT INTO ships (name, model, pilot_id, cargo_capacity)\nSELECT 'Firefly', 'Courier Mk II', id, 40 FROM new_pilot;",
			check: {
				type: "state",
				verifySql:
					"SELECT s.name, s.model, s.cargo_capacity, p.name AS pilot, p.rank, p.joined_at FROM ships s LEFT JOIN pilots p ON p.id = s.pilot_id ORDER BY s.name;",
			},
			hints: [
				"The pilot INSERT goes in the CTE, with RETURNING id.",
				"The ship INSERT selects that id from the CTE.",
				"WITH new_pilot AS (INSERT INTO pilots ... RETURNING id) INSERT INTO ships (name, model, pilot_id, cargo_capacity) SELECT 'Firefly', 'Courier Mk II', id, 40 FROM new_pilot;",
			],
			explanation:
				"The id generated in the CTE goes directly into the ship row: no guessing and no second round trip.\n\n**Pitfall:** hard coding pilot id 25 only works until another session inserts a pilot first.",
		},
		{
			id: "ch22-pr06",
			title: "Count invalid numeric values",
			prompt:
				"The table `price_csv (line)` holds lines in the format `name;price`. **Return** one number: how many lines have a price (the text after `;`) that is **not** a valid numeric value. Use `pg_input_is_valid(text, 'numeric')`.",
			difficulty: 2,
			kind: "query",
			concepts: ["bulk-load-copy"],
			setupSql:
				"CREATE TABLE price_csv (line text);\nINSERT INTO price_csv VALUES ('Water Ice;12.40'), ('Comet Tea;19,50'), ('Void Pearls;2100'), ('Space Kelp;n/a'), ('Nebula Spice; 460.00 ');",
			solutionSql:
				"SELECT count(*)\nFROM price_csv\nWHERE NOT pg_input_is_valid(split_part(line, ';', 2), 'numeric');",
			check: { type: "result" },
			hints: [
				"split_part(line, ';', 2) gives the price text.",
				"pg_input_is_valid returns false instead of raising 22P02.",
				"SELECT count(*) FROM price_csv WHERE NOT pg_input_is_valid(split_part(line, ';', 2), 'numeric');",
			],
			explanation:
				"Two lines would fail the load: `19,50` (comma as decimal separator) and `n/a`. Spaces around a number are accepted by numeric input.\n\n**Pitfall:** casting the column directly in a SELECT stops at the first invalid line with 22P02, without telling you how many there are.",
		},
		{
			id: "ch22-pr07",
			title: "Load routes from a CSV text",
			prompt:
				"The single row of `csv_blob (body)` contains a whole CSV file: a header `from,to,distance_ly`, two routes, and a final newline. Insert every route of the file into `routes` (from, to, distance; no hazard). Split the text into lines with `string_to_table(body, E'\\n')` and skip the header and any empty line.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["bulk-load-copy"],
			setupSql:
				"CREATE TABLE csv_blob (body text);\nINSERT INTO csv_blob VALUES (E'from,to,distance_ly\\n11,2,3.9\\n2,11,3.9\\n');",
			solutionSql:
				"INSERT INTO routes (from_planet_id, to_planet_id, distance_ly)\nSELECT split_part(line, ',', 1)::int,\n       split_part(line, ',', 2)::int,\n       split_part(line, ',', 3)::numeric\nFROM csv_blob, string_to_table(body, E'\\n') AS line\nWHERE line <> '' AND line NOT LIKE 'from,%';",
			check: { type: "state", verifySql: ROUTES_STATE },
			hints: [
				"First SELECT the lines: `SELECT line FROM csv_blob, string_to_table(body, E'\\n') AS line;`. Count them.",
				"There are four lines: the header, two routes and an empty one. Filter two of them out.",
				"... WHERE line <> '' AND line NOT LIKE 'from,%'",
			],
			explanation:
				"`string_to_table` turns the text into rows; the WHERE drops the header and the empty string after the final newline, then the casts produce two routes.\n\n**Pitfall:** the trailing newline produces an empty line whose `''::int` fails with 22P02 and aborts the whole load.",
		},
	],
};

export default chapter;
