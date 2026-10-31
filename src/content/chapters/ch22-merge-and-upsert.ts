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
	subtitle: "Insert or update in one move, imports you can run twice, and chained writes",
	emoji: "🔀",
	datasetId: "starport",
	concepts: ["upsert-on-conflict", "merge-statement", "data-modifying-cte", "bulk-load-copy"],
	prerequisites: ["ch21-the-pact", "ch13-unions-and-named-spells"],
	lesson: [
		{
			kind: "explain",
			title: "Insert or update?",
			body: "Every morning the galactic exchange drops quotes into `price_feed`. Some commodities are known (Water Ice), one is brand new (Asteroid Honey).\n\n- A plain INSERT fails on the known names: **23505**.\n- A plain UPDATE silently ignores the new one.\n\nYou need *insert, or update if it already exists*: an **upsert**.",
		},
		{
			kind: "example",
			title: "ON CONFLICT DO UPDATE",
			body: "Comet Tea already exists, so instead of failing the INSERT turns into an update of its price.",
			sql: "INSERT INTO commodities (name, base_price, unit)\nVALUES ('Comet Tea', 19.00, 'crate')\nON CONFLICT (name)\nDO UPDATE SET base_price = EXCLUDED.base_price\nRETURNING name, base_price;",
		},
		{
			kind: "explain",
			title: "The rules of ON CONFLICT",
			body: "- `ON CONFLICT (name)` needs a **unique index** on exactly that column, else **42P10**.\n- `DO NOTHING` skips the row quietly.\n- `EXCLUDED` is the row you *tried* to insert; the table name is the row already there.\n- In expressions, qualify: `cargo_stock.qty + EXCLUDED.qty`. A bare `qty` is ambiguous (**42702**).",
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
				"An upsert may touch each target row **once** per statement. The feed quotes Water Ice at 08:00 and 09:30: which one should win? Postgres refuses to guess (*cannot affect row a second time*). Deduplicate the source first.",
		},
		{
			kind: "explain",
			title: "MERGE",
			body: "```sql\nMERGE INTO commodities c\nUSING source s ON c.name = s.name\nWHEN MATCHED AND c.base_price <> s.price THEN\n  UPDATE SET base_price = s.price\nWHEN NOT MATCHED THEN\n  INSERT (name, base_price, unit) VALUES (s.name, s.price, 'crate');\n```\nWHEN clauses are tried **in order**, the first that applies wins. Others: `THEN DELETE`, `THEN DO NOTHING`, `WHEN NOT MATCHED BY SOURCE`. `RETURNING merge_action()` says what happened; `old.col` / `new.col` give before and after.",
		},
		{
			kind: "example",
			title: "A small merge",
			body: "Two quotes as an inline source: Comet Tea exists, Moon Cheese does not.",
			sql: "MERGE INTO commodities c\nUSING (VALUES ('Comet Tea', 19.00), ('Moon Cheese', 14.00)) AS s(name, price)\nON c.name = s.name\nWHEN MATCHED THEN\n  UPDATE SET base_price = s.price\nWHEN NOT MATCHED THEN\n  INSERT (name, base_price, unit) VALUES (s.name, s.price, 'crate')\nRETURNING merge_action(), c.name, c.base_price;",
		},
		{
			kind: "explain",
			title: "Writes inside WITH",
			body: "A CTE may INSERT, UPDATE, DELETE or MERGE, and pass its RETURNING rows on:\n```sql\nWITH moved AS (\n  DELETE FROM seizures WHERE fine IS NULL\n  RETURNING *\n)\nINSERT INTO seizure_archive\nSELECT * FROM moved;\n```\nOne statement, so it is atomic: the rows cannot be deleted without being archived.",
		},
		{
			kind: "explain",
			title: "Bulk loading",
			body: "Real servers load files with `COPY commodities FROM '/data/feed.csv' WITH (FORMAT csv, HEADER true)` (disabled in this sandbox).\n\nThe robust pattern is the same everywhere: land the raw text in a **staging table**, look at it, then `INSERT ... SELECT` with `trim`, `split_part` and casts. Skip the header line and blank lines: one bad value aborts the whole load (22P02).",
		},
		{
			kind: "example",
			title: "Cutting a CSV into rows",
			body: "`string_to_table` splits a text into one row per line, `split_part` cuts the fields. Spot the header and the empty last line: both must be filtered out before loading.",
			sql: "SELECT line,\n       split_part(line, ',', 1) AS name,\n       split_part(line, ',', 2) AS price\nFROM string_to_table(E'name,price\\nIon Salt,22.00\\nStar Anise,9.50\\n', E'\\n') AS line;",
		},
		{
			kind: "try",
			title: "Your turn: a fresh Comet Tea quote",
			prompt:
				"The exchange quotes **Comet Tea** at **19.50**. Upsert it: if the name exists, only its base_price changes; otherwise insert it with unit **crate**.",
			starterSql:
				"INSERT INTO commodities (name, base_price, unit)\nVALUES ('Comet Tea', 19.50, 'crate');",
			solutionSql:
				"INSERT INTO commodities (name, base_price, unit)\nVALUES ('Comet Tea', 19.50, 'crate')\nON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price;",
			check: { type: "state", verifySql: COMMODITIES },
			hints: [
				"Run the starter: 23505, Comet Tea exists.",
				"Add ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price",
			],
		},
	],
	exercises: [
		{
			id: "ch22-ex01",
			title: "Skip what we know",
			story:
				"A supplier's catalogue arrives. The quartermaster trusts the Starport's own records more than the supplier's: known goods must not be touched.",
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
				"ON CONFLICT ... DO NOTHING skips the rows that collide.",
				"... VALUES (...), (...), (...) ON CONFLICT (name) DO NOTHING;",
			],
			explanation:
				"Only Asteroid Honey is new; the two collisions are skipped and Water Ice keeps its 12.00. Run it twice and nothing more happens: the statement is **idempotent**.\n\n**Pitfall:** `DO UPDATE` would overwrite Water Ice with the supplier's 99.00.\n\n**Alternative:** `ON CONFLICT DO NOTHING` without a target skips conflicts on any unique key.",
		},
		{
			id: "ch22-ex02",
			title: "Pearls and cheese",
			story:
				"Two quotes arrive at once: a new price for the famous Void Pearls, and a product nobody has seen here, Moon Cheese.",
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
				"Moon Cheese is inserted; Void Pearls collides on `name` and becomes an update of its price only.\n\n**Pitfall:** `DO NOTHING` leaves the pearls at 1999.99, and `SET base_price = 2100.00` hard-codes one row's value into a rule meant for every row.",
		},
		{
			id: "ch22-ex03",
			title: "Stock that adds up",
			story:
				"The warehouse keeps `cargo_stock (commodity, qty)`. Today's deliveries should **add** to what is on the shelves. The clerk's upsert crashes with `column reference \"qty\" is ambiguous`.",
			prompt:
				"Fix the upsert so the delivered quantities are **added** to the existing stock, and goods not in stock yet are inserted with the delivered quantity.",
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
				"Inside DO UPDATE, two rows are in scope: the one on the shelf and the proposed one.",
				"`qty` alone could mean either; name the table for the existing row.",
				"SET qty = cargo_stock.qty + EXCLUDED.qty",
			],
			explanation:
				"`cargo_stock.qty` is the stock on the shelf, `EXCLUDED.qty` the delivery: Water Ice reaches 800, Space Kelp 225, Comet Tea arrives with 40. Only the left side of SET stays unqualified (it always names the target column).\n\n**Pitfall:** `SET qty = EXCLUDED.qty` runs fine and silently **replaces** the stock by the delivery.",
		},
		{
			id: "ch22-ex04",
			title: "The raw feed bites",
			story:
				"The intern wants to upsert the exchange's feed straight into the commodity list. You have read the feed.",
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
				"Look at the feed: is every name there only once?",
				"INSERT INTO commodities (name, base_price, unit) SELECT commodity_name, price, 'crate' FROM price_feed ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price;",
			],
			explanation:
				"21000 (*cardinality violation*): Water Ice is quoted twice, so the statement would update the same row twice. Postgres refuses rather than pick a winner.\n\n**Pitfall:** without ON CONFLICT you get 23505 instead, on the first known name. Different code, different problem.",
		},
		{
			id: "ch22-ex05",
			title: "Only the latest word",
			story:
				"The quartermaster switches to MERGE, and the raw feed bites again: `MERGE command cannot affect row a second time`.",
			prompt:
				"Fix the MERGE so it uses only the **latest quote** (`quoted_at`) of each commodity name: matched commodities get that **price** as base_price, unknown names are inserted with that price and unit **crate**.",
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
				"With one row per name, every target row is matched at most once: Water Ice takes the 09:30 quote (12.75), Asteroid Honey is inserted.\n\n**Pitfall:** picking the *first* quote (`min(quoted_at)`, or DISTINCT ON sorted ascending) runs fine and stores the stale 12.50.\n\n**Alternative:** `SELECT DISTINCT ON (commodity_name) commodity_name, price FROM price_feed ORDER BY commodity_name, quoted_at DESC` (Champions of Each Dungeon chapter).",
		},
		{
			id: "ch22-ex06",
			title: "Tell me what you did",
			story:
				"The auditors want MERGE to touch only prices that really changed, and to report every row it touched.",
			prompt:
				"MERGE the latest quote of each commodity into `commodities` as in the previous mission, but update a matched commodity **only when its base_price differs** from the quote. **Return** `merge_action()`, the commodity **name** and its new **base_price** for every row touched.",
			difficulty: 4,
			kind: "mutation",
			concepts: ["merge-statement", "returning-clause"],
			solutionSql: `MERGE INTO commodities c\nUSING (\n  ${LATEST_QUOTES}\n) AS f\nON c.name = f.commodity_name\nWHEN MATCHED AND c.base_price <> f.price THEN\n  UPDATE SET base_price = f.price\nWHEN NOT MATCHED THEN\n  INSERT (name, base_price, unit) VALUES (f.commodity_name, f.price, 'crate')\nRETURNING merge_action(), c.name, c.base_price;`,
			check: { type: "result+state", verifySql: COMMODITIES },
			hints: [
				"Start from your MERGE of the previous mission.",
				"WHEN MATCHED accepts an extra condition: `WHEN MATCHED AND ... THEN`. Rows matching no clause are left alone.",
				"WHEN MATCHED AND c.base_price <> f.price THEN UPDATE ...; finish with RETURNING merge_action(), c.name, c.base_price;",
			],
			explanation:
				"Nebula Spice is quoted at its current 455.00, matches no WHEN clause and is left alone: four UPDATEs and one INSERT come back.\n\n**Pitfall:** an unconditional WHEN MATCHED rewrites Nebula Spice with the same value and reports it as an UPDATE: noise in every audit.\n\n**Alternative:** `c.base_price IS DISTINCT FROM f.price` also catches a NULL price.",
		},
		{
			id: "ch22-ex07",
			title: "Into the archive",
			story:
				"Customs moves old cases to the archive vault `seizure_archive` (same columns as `seizures`). A case must never be deleted without being archived.",
			prompt:
				"In **one statement**, move every seizure made **before 2077-01-01** from `seizures` into `seizure_archive` (all columns, values unchanged).",
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
				"DELETE ... RETURNING * hands back the deleted rows.",
				"Wrap the DELETE in a CTE and feed its rows to an INSERT.",
				"WITH moved AS (DELETE FROM seizures WHERE seized_at < '2077-01-01' RETURNING *) INSERT INTO seizure_archive SELECT * FROM moved;",
			],
			explanation:
				"The DELETE inside WITH returns exactly the rows it removed, and the INSERT archives exactly those rows: five cases from 2076 move, nothing can slip between the two steps.\n\n**Pitfall:** `INSERT ... SELECT` then `DELETE` as two statements works only if both use the very same filter; one typo and cases are lost or duplicated.",
		},
		{
			id: "ch22-ex08",
			title: "The staging bay",
			story:
				"A supplier's CSV file was pasted line by line into `cargo_csv (line_no, line)`. Line 1 is the header `name,category,base_price,unit`, and somebody padded a line with spaces.",
			prompt:
				"Insert every **data** line of `cargo_csv` as a commodity: the four comma-separated fields go into **name**, **category**, **base_price** and **unit**, each **trimmed** of surrounding spaces, the price as a number. Skip the header line.",
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
				"Staging lets you look at raw text before it touches the real table; INSERT ... SELECT then cleans and casts in one pass.\n\n**Pitfall:** forgetting the header makes `'base_price'::numeric` fail with 22P02 and nothing is loaded; forgetting trim stores `'  Moon Cheese '` as a different name than `'Moon Cheese'`.",
		},
		{
			id: "ch22-ex09",
			title: "Boss: The Smith's Ledger",
			story:
				"The Forge's final test. Every morning the exchange feed must be applied to the commodity list, every change must be written in the ledger `price_log (name, old_price, new_price, action)`, and running the import twice must not change or log anything new.",
			prompt:
				"Inside **BEGIN** / **COMMIT**, in one statement:\n\n- MERGE the **latest quote** of each commodity name into `commodities`: update the base_price **only when it differs**, insert unknown names with that price and unit **crate**;\n- log every row the MERGE touched into `price_log`: **name**, **old_price** (base_price before, NULL for an insert), **new_price** (after) and **action** (`merge_action()`).",
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
				"Reuse the MERGE of *Tell me what you did*, then wrap it in WITH changes AS (...).",
				"In MERGE's RETURNING, `old.base_price` is the value before and `new.base_price` the value after; an INSERT has no old row, so old is NULL.",
				"WITH changes AS (MERGE ... RETURNING c.name, old.base_price, new.base_price, merge_action()) INSERT INTO price_log (name, old_price, new_price, action) SELECT * FROM changes;",
			],
			explanation:
				"The MERGE and the log are one statement inside one transaction: the ledger can never disagree with the prices. Four updates and Asteroid Honey's insert are logged; a second run finds nothing to change and logs nothing.\n\n**Pitfall:** an unconditional WHEN MATCHED logs Nebula Spice (455.00 to 455.00) on every run, and a feed with duplicate names would abort the import with 21000.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch22-pr01",
			title: "Legends and myths",
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
				"Legend is stretched to 1200, mythic is created.\n\n**Pitfall:** `DO NOTHING` would create mythic but leave legend capped at 1000.",
		},
		{
			id: "ch22-pr02",
			title: "No index, no upsert",
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
				"Many goods share a unit, so no unique index can back that conflict target.",
			],
			explanation:
				"42P10: ON CONFLICT needs a unique index or constraint on exactly the listed columns, and `unit` has none.\n\n**Pitfall:** adding a UNIQUE on unit to silence it would forbid two goods sold by the crate.",
		},
		{
			id: "ch22-pr03",
			title: "Official lanes of Terra Nova",
			story:
				"The Harbor Master publishes the official lanes leaving Terra Nova (planet 1): to planet **11** at **2.6** ly and to planet **3** at **9.9** ly. Any other lane leaving Terra Nova is closed.",
			prompt:
				"With **one MERGE** on `routes`, using the source `(VALUES (1, 11, 2.6), (1, 3, 9.9))`: update the distance of lanes that exist, insert the missing ones (no hazard), and **delete** every lane leaving planet 1 that is not in the list. Lanes leaving other planets stay untouched.",
			difficulty: 3,
			kind: "mutation",
			concepts: ["merge-statement"],
			solutionSql:
				"MERGE INTO routes r\nUSING (VALUES (1, 11, 2.6), (1, 3, 9.9)) AS o(from_id, to_id, dist)\nON r.from_planet_id = o.from_id AND r.to_planet_id = o.to_id\nWHEN MATCHED THEN\n  UPDATE SET distance_ly = o.dist\nWHEN NOT MATCHED THEN\n  INSERT (from_planet_id, to_planet_id, distance_ly) VALUES (o.from_id, o.to_id, o.dist)\nWHEN NOT MATCHED BY SOURCE AND r.from_planet_id = 1 THEN\n  DELETE;",
			check: { type: "state", verifySql: ROUTES_STATE },
			hints: [
				"Three clauses: MATCHED, NOT MATCHED, NOT MATCHED BY SOURCE.",
				"NOT MATCHED BY SOURCE means a target row no source row matches. Restrict it to planet 1, or every other lane goes too.",
				"WHEN NOT MATCHED BY SOURCE AND r.from_planet_id = 1 THEN DELETE",
			],
			explanation:
				"1 → 11 is updated, 1 → 3 inserted, 1 → 2 deleted, and the rest of the map is untouched.\n\n**Pitfall:** an unconditional `WHEN NOT MATCHED BY SOURCE THEN DELETE` closes every lane of the Starport except the two official ones.",
		},
		{
			id: "ch22-pr04",
			title: "First match wins",
			story:
				"The tier committee retires the `unknown` tier, widens `trusted` and creates `elite`. The clerk's MERGE is refused with `unreachable WHEN clause specified after unconditional WHEN clause`.",
			prompt:
				"Fix the MERGE: a matched tier flagged **retire** is deleted, any other matched tier gets the new bounds, and a new tier is inserted.",
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
				"MERGE tries the WHEN clauses from top to bottom.",
				"An unconditional WHEN MATCHED catches every matched row, so nothing after it could ever run.",
				"Put `WHEN MATCHED AND s.retire THEN DELETE` before the plain `WHEN MATCHED`.",
			],
			explanation:
				"The specific clause must come before the general one: `unknown` is deleted, `trusted` widened to 549, `elite` created.\n\n**Pitfall:** the same order mistake with two *conditional* clauses gives no error at all, just the wrong action.",
		},
		{
			id: "ch22-pr05",
			title: "Pilot and ship together",
			prompt:
				"In **one statement**, register pilot **Firefly Jones** (Human ensign, joined **2078-04-01 00:00 UTC**) and the ship **Firefly** (model **Courier Mk II**, capacity **40**) flown by her. Use a data-modifying CTE to pass her new id to the ship.",
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
				"The id generated in the CTE flows straight into the ship row: no guessing, no second round trip.\n\n**Pitfall:** hard-coding pilot id 25 works only until another clerk registers someone first.",
		},
		{
			id: "ch22-pr06",
			title: "Which lines would break?",
			story:
				"Before loading `price_csv (line)` (format `name;price`), the quartermaster wants to know how many lines would crash the load.",
			prompt:
				"**Return** one number: how many lines of `price_csv` have a price (the text after `;`) that is **not** a valid numeric value. Use `pg_input_is_valid(text, 'numeric')`.",
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
				"Two lines would break the load: `19,50` (comma decimal) and `n/a`. Spaces around a number are fine for numeric input.\n\n**Pitfall:** casting the column directly in a SELECT stops at the first bad line with 22P02, without telling you how many there are.",
		},
		{
			id: "ch22-pr07",
			title: "A lane file",
			story:
				"A navigator pasted a whole CSV file into the single row of `csv_blob (body)`: a header `from,to,distance_ly`, two lanes, and a final newline.",
			prompt:
				"Insert every lane of the file into `routes` (from, to, distance; no hazard). Split the text into lines with `string_to_table(body, E'\\n')` and skip the header and any empty line.",
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
				"There are four lines: the header, two lanes and an empty one. Filter two of them out.",
				"... WHERE line <> '' AND line NOT LIKE 'from,%'",
			],
			explanation:
				"`string_to_table` turns the blob into rows; the WHERE drops the header and the empty string after the final newline, then the casts build two lanes.\n\n**Pitfall:** the trailing newline yields an empty line whose `''::int` fails with 22P02 and aborts the whole load.",
		},
	],
};

export default chapter;
