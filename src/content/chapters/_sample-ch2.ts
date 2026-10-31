import type { Chapter } from "../types";

/** DEV SAMPLE chapter 2: mutations, jsonb, vectors, constraints, transactions. */
const chapter: Chapter = {
	id: "_sample-ch2",
	order: 2,
	world: "Sample Shores",
	tier: "apprentice",
	track: "mutation",
	title: "Market Day",
	subtitle: "Change the ledgers: INSERT, UPDATE, DELETE, jsonb and vectors",
	emoji: "⚖️",
	datasetId: "_sample-starport",
	concepts: [
		"_insert-rows",
		"_update-delete",
		"_returning",
		"_constraints",
		"_jsonb-access",
		"_vector-knn",
		"_transactions",
	],
	prerequisites: ["_sample-ch1"],
	lesson: [
		{
			kind: "explain",
			title: "Writing to the ledgers",
			body: "Three verbs change data:\n\n- `INSERT INTO t (cols) VALUES (...)` adds rows\n- `UPDATE t SET col = ... WHERE ...` changes rows\n- `DELETE FROM t WHERE ...` removes rows\n\nAdd `RETURNING` to see what changed.",
		},
		{
			kind: "example",
			title: "UPDATE with RETURNING",
			body: "Double the price of ration packs and get the new rows back. Your sandbox is reset after every run, so experiment freely.",
			sql: "UPDATE items SET price = price * 2 WHERE name = 'Ration Pack' RETURNING name, price;",
		},
		{
			kind: "example",
			title: "Reading jsonb",
			body: "`->>` extracts a field as text, `@>` tests containment.",
			sql: "SELECT name, specs->>'fuel' AS fuel FROM items WHERE specs ? 'fuel';",
		},
		{
			kind: "quiz",
			question: "What does `UPDATE traders SET credits = 0;` do?",
			choices: [
				"Nothing, a WHERE clause is required",
				"Resets the first trader only",
				"Resets every trader's credits to 0",
				"Raises an error",
			],
			answerIndex: 2,
			explanation:
				"Without WHERE, UPDATE touches every row. Write the WHERE before anything else.",
		},
		{
			kind: "explain",
			title: "Similar items with vectors",
			body: "Each item has an `embedding` vector. `a <-> b` is the distance between two vectors, so\n\n```sql\nORDER BY embedding <-> '[0.9,0.1,0]' LIMIT 3\n```\n\nreturns the three most similar items.",
		},
		{
			kind: "try",
			title: "Your turn: a tip for Gnib",
			prompt: "Give **Gnib** 50 more credits.",
			starterSql: "UPDATE traders\nSET credits = \nWHERE ",
			solutionSql:
				"UPDATE traders SET credits = credits + 50 WHERE name = 'Gnib';",
			check: {
				type: "state",
				verifySql: "SELECT id, credits FROM traders ORDER BY id",
			},
			hints: [
				"Use the current value: credits = credits + 50.",
				"Target the row with WHERE name = 'Gnib'.",
			],
		},
	],
	exercises: [
		{
			id: "_s2-ex01",
			title: "A new world",
			story: "Scouts just charted a new planet and the registry needs it.",
			prompt:
				"Insert planet **9**, named `Brightwater`, in sector `Outer Rim`, with gravity `0.90`.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["_insert-rows"],
			starterSql: "INSERT INTO planets (id, name, sector, gravity)\nVALUES ",
			solutionSql:
				"INSERT INTO planets (id, name, sector, gravity) VALUES (9, 'Brightwater', 'Outer Rim', 0.90);",
			check: {
				type: "state",
				verifySql: "SELECT id, name, sector, gravity FROM planets ORDER BY id",
			},
			hints: [
				"VALUES takes one tuple per row, in the column order you listed.",
				"Text values need single quotes.",
			],
			explanation:
				"Listing the columns explicitly keeps the INSERT readable and safe if the table gains columns later.",
		},
		{
			id: "_s2-ex02",
			title: "Inflation strikes",
			story:
				"The guild raises rare item prices by 10% and wants the new tags printed.",
			prompt:
				"Increase the price of every `rare` item by 10%, and return the **name** and new **price** of the changed items.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["_update-delete", "_returning"],
			solutionSql:
				"UPDATE items SET price = price * 1.10 WHERE rarity = 'rare' RETURNING name, price;",
			check: {
				type: "result+state",
				verifySql: "SELECT id, price FROM items ORDER BY id",
			},
			hints: [
				"UPDATE items SET price = ... WHERE rarity = 'rare'",
				"Multiply by 1.10.",
				"Finish with RETURNING name, price.",
			],
			explanation:
				"RETURNING gives you the post-update values in the same round trip. The checker verifies both the returned rows and the final table.",
		},
		{
			id: "_s2-ex03",
			title: "Fuel inspection",
			story:
				"Lumen customs caps item power at 100. Find every item over the limit.",
			prompt:
				"Return the **name** of items whose `specs` contain a `power` greater than 100.",
			difficulty: 3,
			kind: "query",
			concepts: ["_jsonb-access"],
			solutionSql: "SELECT name FROM items WHERE (specs->>'power')::int > 100;",
			check: { type: "result" },
			hints: [
				"`specs->>'power'` gives the value as text.",
				"Cast the text to a number before comparing: `::int`.",
			],
			explanation:
				"`->>` returns text, so cast it. Items without a power key give NULL and are filtered out.",
		},
		{
			id: "_s2-ex04",
			title: "Test the guard",
			story: "The registry claims item names are unique. Prove it.",
			prompt:
				"Try to insert a new item (id 99) named `Plasma Torch` (category `tool`, rarity `common`, price 10). The database must refuse it with a **unique violation**.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["_constraints", "_insert-rows"],
			solutionSql:
				"INSERT INTO items (id, name, category, rarity, price) VALUES (99, 'Plasma Torch', 'tool', 'common', 10);",
			check: { type: "error", sqlstate: "23505" },
			hints: [
				"Just write the INSERT: the constraint does the rest.",
				"The UNIQUE constraint on name raises SQLSTATE 23505.",
			],
			explanation:
				"`name text UNIQUE` creates a unique index. Postgres raises `23505 unique_violation` and the row is never stored.",
		},
		{
			id: "_s2-ex05",
			title: "Expired bounties",
			story: "The bounty board is cluttered with old notices.",
			prompt:
				"A `bounties` table was pinned up for this mission. Delete every bounty whose `expires_at` is before `2024-06-01`.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["_update-delete"],
			setupSql:
				"CREATE TABLE bounties (id int PRIMARY KEY, target text NOT NULL, reward int NOT NULL, expires_at date NOT NULL);\nINSERT INTO bounties VALUES (1, 'Bort', 500, '2024-03-01'), (2, 'Kix', 120, '2024-07-15'), (3, 'Zul the Quiet', 900, '2024-05-31'), (4, 'Pim Saddo', 60, '2024-06-01'), (5, 'Rexa Voll', 1500, '2025-01-01');",
			solutionSql: "DELETE FROM bounties WHERE expires_at < '2024-06-01';",
			check: {
				type: "state",
				verifySql: "SELECT id FROM bounties ORDER BY id",
			},
			hints: [
				"DELETE FROM bounties WHERE ...",
				"`before` means strictly less than: <, not <=.",
			],
			explanation:
				"Date literals compare naturally. Bounty 4 expires exactly on 2024-06-01 and must stay.",
		},
		{
			id: "_s2-ex06",
			title: "Similar gadgets",
			story: "A buyer loved the Plasma Torch. Suggest similar items.",
			prompt:
				"Return the **name** of the 3 items closest to the vector `[0.9,0.1,0.1]` (Euclidean distance), closest first.",
			difficulty: 3,
			kind: "query",
			concepts: ["_vector-knn"],
			solutionSql:
				"SELECT name FROM items ORDER BY embedding <-> '[0.9,0.1,0.1]' LIMIT 3;",
			check: { type: "result", orderMatters: true },
			hints: [
				"`<->` measures the distance between two vectors.",
				"ORDER BY the distance ascending, then LIMIT.",
			],
			explanation:
				"pgvector's `<->` is L2 distance. Rows with a NULL embedding sort last, so they never show up in a top 3.",
		},
		{
			id: "_s2-boss",
			title: "Boss: The Great Spice Deal",
			story:
				"Rexa Voll sells 2 Spice Crates to Gnib for 120 credits each. Half a trade would start a war: it must be all or nothing.",
			prompt:
				"In **one transaction**:\n1. remove 2 units of item 7 from Rexa's (trader 1) inventory,\n2. add 2 units of item 7 to Gnib's (trader 2) inventory (he has none yet),\n3. move 240 credits from Gnib to Rexa,\n4. record trade **13** (seller 1, buyer 2, item 7, quantity 2, unit price 120) at `2024-09-01 12:00+00`.",
			difficulty: 5,
			kind: "transaction",
			concepts: ["_transactions", "_update-delete", "_insert-rows"],
			starterSql: "BEGIN;\n\n-- your statements\n\nCOMMIT;",
			solutionSql: `BEGIN;
UPDATE inventory SET quantity = quantity - 2 WHERE trader_id = 1 AND item_id = 7;
INSERT INTO inventory (trader_id, item_id, quantity) VALUES (2, 7, 2);
UPDATE traders SET credits = credits - 240 WHERE id = 2;
UPDATE traders SET credits = credits + 240 WHERE id = 1;
INSERT INTO trades VALUES (13, 1, 2, 7, 2, 120, '2024-09-01 12:00+00');
COMMIT;`,
			check: {
				type: "state",
				verifySql:
					"SELECT 'inv' AS k, trader_id::text AS a, quantity::text AS b FROM inventory WHERE item_id = 7\nUNION ALL SELECT 'credits', id::text, credits::text FROM traders WHERE id IN (1, 2)\nUNION ALL SELECT 'trade', id::text, (seller_id || '>' || buyer_id || ':' || item_id || 'x' || quantity || '@' || unit_price || ' ' || traded_at)::text FROM trades WHERE id = 13",
			},
			hints: [
				"Wrap everything between BEGIN; and COMMIT;",
				"Gnib has no row for item 7 yet: INSERT it rather than UPDATE.",
				"Two UPDATEs on traders: one minus 240, one plus 240.",
			],
			explanation:
				"A transaction makes the four changes atomic: if any statement fails, none of them is kept. Real systems also lock the rows (`SELECT ... FOR UPDATE`) to avoid races.",
			boss: true,
		},
	],
	practice: [
		{
			id: "_s2-pr01",
			title: "New trader",
			prompt:
				"Insert trader **13** named `Nova`, species `human`, home planet 8, 100 credits, joined at `2024-09-01 00:00+00`. Leave tags at their default.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["_insert-rows"],
			solutionSql:
				"INSERT INTO traders (id, name, species, planet_id, credits, joined_at) VALUES (13, 'Nova', 'human', 8, 100, '2024-09-01 00:00+00');",
			check: {
				type: "state",
				verifySql:
					"SELECT id, name, species, planet_id, credits, joined_at, tags FROM traders ORDER BY id",
			},
			hints: ["Skip the tags column: it gets its DEFAULT '{}'."],
			explanation: "Omitted columns receive their default value.",
		},
		{
			id: "_s2-pr02",
			title: "Clear empty stock",
			prompt: "Delete every inventory row whose quantity is 0.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["_update-delete"],
			solutionSql: "DELETE FROM inventory WHERE quantity = 0;",
			check: {
				type: "state",
				verifySql:
					"SELECT trader_id, item_id, quantity FROM inventory ORDER BY trader_id, item_id",
			},
			hints: ["DELETE FROM inventory WHERE ..."],
			explanation: "Only the matching rows are removed.",
		},
		{
			id: "_s2-pr03",
			title: "Sale receipt",
			prompt:
				"Delete the trades made before `2024-04-01` and return their **id**s.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["_returning", "_update-delete"],
			solutionSql:
				"DELETE FROM trades WHERE traded_at < '2024-04-01' RETURNING id;",
			check: {
				type: "result+state",
				verifySql: "SELECT id FROM trades ORDER BY id",
			},
			hints: ["DELETE ... WHERE ... RETURNING id"],
			explanation: "RETURNING works on DELETE too: you get the removed rows.",
		},
		{
			id: "_s2-pr04",
			title: "Ghost trader",
			prompt:
				"Try to give trader **404** (who does not exist) 1 unit of item 1 in the inventory. The database must refuse it with a **foreign key violation**.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["_constraints"],
			solutionSql:
				"INSERT INTO inventory (trader_id, item_id, quantity) VALUES (404, 1, 1);",
			check: { type: "error", sqlstate: "23503" },
			hints: ["Insert into inventory with trader_id 404."],
			explanation:
				"`REFERENCES traders(id)` rejects rows pointing at a missing trader with 23503.",
		},
		{
			id: "_s2-pr05",
			title: "Vegan menu",
			prompt:
				'Return the **name** of items whose specs contain `"vegan": true`.',
			difficulty: 2,
			kind: "query",
			concepts: ["_jsonb-access"],
			solutionSql: "SELECT name FROM items WHERE specs @> '{\"vegan\": true}';",
			check: { type: "result" },
			hints: ["Containment: specs @> '{...}'"],
			explanation: "`@>` checks that the left json contains the right one.",
		},
		{
			id: "_s2-pr06",
			title: "Origin story",
			prompt:
				"Return the **name** and origin planet (`specs -> origin -> planet`, as text) of items that have one.",
			difficulty: 3,
			kind: "query",
			concepts: ["_jsonb-access"],
			solutionSql:
				"SELECT name, specs #>> '{origin,planet}' FROM items WHERE specs #>> '{origin,planet}' IS NOT NULL;",
			check: { type: "result" },
			hints: ["#>> '{origin,planet}' follows a path and returns text."],
			explanation:
				"`#>>` takes a path array; `specs->'origin'->>'planet'` works too.",
		},
		{
			id: "_s2-pr07",
			title: "Mysterious neighbours",
			prompt:
				"Return the **name** of the 2 items closest to `[0.1,0.1,1.0]`, closest first.",
			difficulty: 2,
			kind: "query",
			concepts: ["_vector-knn"],
			solutionSql:
				"SELECT name FROM items ORDER BY embedding <-> '[0.1,0.1,1.0]' LIMIT 2;",
			check: { type: "result", orderMatters: true },
			hints: ["ORDER BY embedding <-> '[...]' LIMIT 2"],
			explanation: "Smallest distance first.",
		},
		{
			id: "_s2-pr08",
			title: "Atomic gift",
			prompt:
				"In one transaction, move 100 credits from Sena Okoro (trader 8) to Zul the Quiet (trader 9).",
			difficulty: 3,
			kind: "transaction",
			concepts: ["_transactions"],
			starterSql: "BEGIN;\n\nCOMMIT;",
			solutionSql:
				"BEGIN;\nUPDATE traders SET credits = credits - 100 WHERE id = 8;\nUPDATE traders SET credits = credits + 100 WHERE id = 9;\nCOMMIT;",
			check: {
				type: "state",
				verifySql: "SELECT id, credits FROM traders ORDER BY id",
			},
			hints: ["Two UPDATEs between BEGIN and COMMIT."],
			explanation: "Both updates land together or not at all.",
		},
	],
};

export default chapter;
