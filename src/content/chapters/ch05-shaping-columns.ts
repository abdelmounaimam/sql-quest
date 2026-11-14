import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch05-shaping-columns",
	order: 5,
	world: "The Counting House",
	tier: "apprentice",
	track: "query",
	title: "Shaping Columns",
	subtitle: "Arithmetic expressions, integer division, casts, CASE and numeric functions",
	emoji: "🧮",
	datasetId: "starport",
	concepts: ["arithmetic-expressions", "type-casting", "case-expression", "numeric-functions"],
	prerequisites: ["ch04-order-in-the-hall"],
	lesson: [
		{
			kind: "explain",
			title: "Computed columns",
			body: "A SELECT list accepts **expressions**, not just column names:\n\n```sql\nSELECT name, credits * 2 AS doubled\nFROM pilots;\n```\n\nOperators: `+` `-` `*` `/` and `%` (remainder). Parentheses work like in math, and `AS` names the result.",
		},
		{
			kind: "example",
			title: "Multiply two columns",
			body: "`qty * unit_price` gives the value of each trade. Look at trade **37**: its `unit_price` is NULL, and any arithmetic with NULL returns NULL.",
			sql: "SELECT id, qty, unit_price, qty * unit_price AS value\nFROM trades;",
		},
		{
			kind: "explain",
			title: "Integer division",
			body: "When **both** sides of `/` are integers, Postgres returns an integer and discards the fraction:\n\n```sql\nSELECT 7 / 2;    -- 3\nSELECT 7 / 2.0;  -- 3.5000000000000000\nSELECT 7 % 2;    -- 1 (the remainder)\n```\n\nOne decimal number on either side is enough to get a decimal result.",
		},
		{
			kind: "quiz",
			question:
				"The ship Tusker has a `cargo_capacity` of 900 (an `int` column). What does `SELECT cargo_capacity / 1000 FROM ships WHERE name = 'Tusker';` return?",
			choices: ["0", "0.9", "1", "An error"],
			answerIndex: 0,
			explanation:
				"900 and 1000 are both integers, so the division is an integer division: 0.9 loses its fraction and becomes **0** (it is truncated, not rounded to 1). Write `1000.0` to get 0.9.",
		},
		{
			kind: "explain",
			title: "Cast a value to another type",
			body: "Two spellings, same effect:\n\n```sql\nSELECT CAST('42' AS int);  -- 42\nSELECT '42'::int;          -- 42\nSELECT 3.7::int;           -- 4 (rounded)\nSELECT '12abc'::int;       -- error 22P02\n```\n\nText that does not look like the target type makes the whole query fail. And cast **before** dividing: `(7 / 2)::numeric` is already 3.",
		},
		{
			kind: "explain",
			title: "Conditional expressions with CASE",
			body: "**Searched** form, conditions tried top to bottom, first match wins:\n\n```sql\nCASE WHEN credits >= 50000 THEN 'rich'\n     WHEN credits > 0 THEN 'fine'\n     ELSE 'broke' END\n```\n\n**Simple** form, one value compared:\n\n```sql\nCASE rank WHEN 'cadet' THEN 1 WHEN 'ensign' THEN 2 END\n```\n\nWithout `ELSE`, unmatched rows get NULL. Every branch must return the same type.",
		},
		{
			kind: "example",
			title: "CASE and NULL",
			body: "Look at the ships with a NULL `hull_integrity` (Night Fang, Silent Vow, Ghost Ship): `NULL >= 90` is not true and `NULL >= 50` is not true either, so they fall into the ELSE and get the label **critical**. That is probably not the intended result.",
			sql: "SELECT name, hull_integrity,\n       CASE WHEN hull_integrity >= 90 THEN 'pristine'\n            WHEN hull_integrity >= 50 THEN 'worn'\n            ELSE 'critical' END AS condition\nFROM ships;",
		},
		{
			kind: "example",
			title: "Numeric functions",
			body: "`round(x, n)` keeps n decimals, `ceil` goes up, `floor` goes down. Gravity 2.40 rounds to 2 but its ceiling is 3. Hollow Moon's NULL stays NULL in every column.\n\nOther numeric functions: `abs(x)`, `mod(a, b)`, `power`, `sqrt`, and `width_bucket(x, low, high, n)`, which returns the number of the equal slice (out of n) that x falls in.",
			sql: "SELECT name, gravity,\n       round(gravity, 1) AS r1,\n       round(gravity) AS r0,\n       ceil(gravity) AS up,\n       floor(gravity) AS down\nFROM planets;",
		},
		{
			kind: "try",
			title: "Keep decimals in a division",
			prompt:
				"Return the **name** of every ship and its **cargo_capacity divided by 1000**, with the decimals kept (900 must give 0.9).",
			starterSql: "SELECT name, cargo_capacity / 1000\nFROM ships;",
			solutionSql: "SELECT name, cargo_capacity / 1000.0 FROM ships;",
			check: { type: "result" },
			hints: [
				"Run the starter: almost every ship shows 0. Both sides of the division are integers.",
				"Make one side a decimal: `1000.0` or `cargo_capacity::numeric`.",
			],
		},
	],
	exercises: [
		{
			id: "ch05-ex01",
			title: "Value of each trade",
			prompt:
				"Return the **id** of every trade and its **value**: `qty` multiplied by `unit_price`. Keep the trade whose price is unknown: its value is simply unknown (NULL).",
			difficulty: 1,
			kind: "query",
			concepts: ["arithmetic-expressions"],
			starterSql: "SELECT id, qty, unit_price\nFROM trades;",
			solutionSql: "SELECT id, qty * unit_price AS value FROM trades;",
			check: { type: "result" },
			hints: [
				"The starter shows the two input columns side by side. You need one computed column instead.",
				"`*` multiplies two columns of the same row.",
				"SELECT id, qty * unit_price AS value FROM trades;",
			],
			explanation:
				"An expression is computed once per row, so each trade gets its own value. Trade 37 has a NULL price, and arithmetic with NULL returns NULL: its value is NULL.\n\n**Pitfall:** returning `qty` and `unit_price` as two columns leaves the multiplication to the reader. **Alternative:** `unit_price * qty` is the same thing; the alias is optional.",
		},
		{
			id: "ch05-ex02",
			title: "Add 15% and round",
			prompt:
				"Return the **name** of every commodity and its **base_price increased by 15%**, rounded to **2 decimals**. A commodity without a base price keeps a NULL price.",
			difficulty: 2,
			kind: "query",
			concepts: ["arithmetic-expressions", "numeric-functions"],
			solutionSql: "SELECT name, round(base_price * 1.15, 2) AS taxed FROM commodities;",
			check: { type: "result" },
			hints: [
				"Increasing a price by 15% means multiplying it by 1.15.",
				"`round(x, n)` keeps n decimals. Without n it rounds to a whole number.",
				"round(base_price * 1.15, 2)",
			],
			explanation:
				"`base_price * 1.15` adds the 15% in one step, and `round(..., 2)` keeps cents: Hydroponic Rice goes from 35.075 to 35.08.\n\n**Pitfall:** `round(base_price * 1.15)` drops the cents entirely (35), and `base_price * 0.15` returns only the tax. **Alternative:** `round(base_price + base_price * 0.15, 2)` gives the same numbers.",
		},
		{
			id: "ch05-ex03",
			title: "Fix an integer division",
			prompt:
				"Fix the query: return the **name** of every pilot and their **reputation divided by 1000**, with the decimals kept (950 must give 0.95, and -510 must give -0.51).",
			difficulty: 2,
			kind: "query",
			concepts: ["type-casting", "arithmetic-expressions"],
			starterSql: "SELECT name, reputation / 1000 AS fame\nFROM pilots;",
			solutionSql: "SELECT name, reputation / 1000.0 AS fame FROM pilots;",
			check: { type: "result" },
			hints: [
				"`reputation` is an integer, and so is 1000.",
				"An integer division throws the fraction away. Give the division a decimal operand.",
				"reputation / 1000.0, or reputation::numeric / 1000",
			],
			explanation:
				"With a decimal on one side, Postgres switches to `numeric` division and keeps the fraction.\n\n**Pitfall:** `(reputation / 1000)::numeric` casts *after* the integer division, which already produced 0. **Alternative:** `CAST(reputation AS numeric) / 1000` or `reputation / 1000::numeric` both cast before dividing.",
		},
		{
			id: "ch05-ex04",
			title: "Predict three casts",
			prompt:
				"Return **one row** with three columns, in this order: the value of `'42'::int`, the value of `3.7::int`, and the value of `round('19.99'::numeric, 1)`. Predict first, then run the expressions to check.",
			difficulty: 2,
			kind: "query",
			concepts: ["type-casting"],
			solutionSql: "SELECT '42'::int, 3.7::int, round('19.99'::numeric, 1);",
			check: { type: "result" },
			hints: [
				"A SELECT without FROM returns one row: `SELECT 1, 2, 3;`.",
				"Put the three expressions in the SELECT list, separated by commas.",
				"SELECT '42'::int, 3.7::int, round('19.99'::numeric, 1);",
			],
			explanation:
				"`'42'::int` turns text into the number 42. Casting a decimal to `int` **rounds** (3.7 becomes 4, not 3), and `round(19.99, 1)` is 20.0 because 19.99 is closer to 20.0 than to 19.9.\n\n**Pitfall:** `'3.7'::int` (text, not a number) is an error 22P02: text must already look like an integer. Cast it to numeric first: `'3.7'::numeric::int`.",
		},
		{
			id: "ch05-ex05",
			title: "CASE with a NULL branch",
			prompt:
				"Return the **name** of every ship and its **condition**:\n\n- `pristine` when hull_integrity is **90 or more**,\n- `worn` when it is **50 or more** (and below 90),\n- `critical` when it is **below 50**,\n- `uninspected` when hull_integrity is **unknown**.",
			difficulty: 2,
			kind: "query",
			concepts: ["case-expression"],
			starterSql:
				"SELECT name,\n       CASE WHEN hull_integrity >= 90 THEN 'pristine'\n            WHEN hull_integrity >= 50 THEN 'worn'\n            ELSE 'critical' END AS condition\nFROM ships;",
			solutionSql:
				"SELECT name,\n       CASE WHEN hull_integrity IS NULL THEN 'uninspected'\n            WHEN hull_integrity >= 90 THEN 'pristine'\n            WHEN hull_integrity >= 50 THEN 'worn'\n            ELSE 'critical' END AS condition\nFROM ships;",
			check: { type: "result" },
			hints: [
				"The starter is the lesson's example. Which ships reach its ELSE even though their hull is not below 50?",
				"Comparisons with NULL are never true, so a NULL hull reaches the ELSE. Give NULL its own branch.",
				"Add `WHEN hull_integrity IS NULL THEN 'uninspected'` (first is clearest).",
			],
			explanation:
				"CASE tries its branches top to bottom and stops at the first true one. An explicit `IS NULL` branch catches the three ships with a NULL hull before the ELSE does.\n\n**Pitfall:** putting `WHEN hull_integrity >= 50` before `>= 90` labels every pristine ship *worn*, because the first true branch wins. **Alternative:** spell out `WHEN hull_integrity < 50 THEN 'critical'` and use `ELSE 'uninspected'`.",
		},
		{
			id: "ch05-ex06",
			title: "Sort by a custom rank order",
			prompt:
				"Return the **name** and **rank** of every pilot, sorted by seniority from the lowest rank: **cadet, ensign, lieutenant, captain, commander, admiral**. Pilots of the same rank are sorted by **name A to Z**.",
			difficulty: 3,
			kind: "query",
			concepts: ["case-expression"],
			starterSql: "SELECT name, rank\nFROM pilots\nORDER BY rank, name;",
			solutionSql:
				"SELECT name, rank\nFROM pilots\nORDER BY CASE rank\n           WHEN 'cadet' THEN 1\n           WHEN 'ensign' THEN 2\n           WHEN 'lieutenant' THEN 3\n           WHEN 'captain' THEN 4\n           WHEN 'commander' THEN 5\n           WHEN 'admiral' THEN 6\n         END,\n         name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Run the starter: ranks are text, so they sort alphabetically (admiral, cadet, captain...).",
				"Turn each rank into a number with CASE, then sort by that number. A CASE can live in ORDER BY.",
				"ORDER BY CASE rank WHEN 'cadet' THEN 1 WHEN 'ensign' THEN 2 ... END, name",
			],
			explanation:
				"The CASE maps each rank to its position in the hierarchy, and ORDER BY sorts on that hidden number. The second key `name` orders pilots inside a rank.\n\n**Pitfall:** `ORDER BY rank` sorts the words, not the seniority. **Alternative:** the searched form `CASE WHEN rank = 'cadet' THEN 1 ...` works the same; in World 8, an `enum` type stores this order itself.",
		},
		{
			id: "ch05-ex07",
			title: "Round a division up",
			prompt:
				"Return the **name** of every ship and the **number of trips** it needs to haul **1000 units**: 1000 divided by its cargo_capacity, **rounded up** to a whole number. A ship with an unknown capacity gets NULL.",
			difficulty: 2,
			kind: "query",
			concepts: ["numeric-functions"],
			solutionSql: "SELECT name, ceil(1000.0 / cargo_capacity) AS trips FROM ships;",
			check: { type: "result" },
			hints: [
				"Rusty Bucket holds 900: it needs 2 trips, not 1.",
				"`ceil` rounds up. Make sure the division keeps its decimals before rounding.",
				"ceil(1000.0 / cargo_capacity)",
			],
			explanation:
				"`1000.0 / 900` is 1.11..., and `ceil` lifts it to 2. The Ghost Ship's NULL capacity gives a NULL division and a NULL ceiling.\n\n**Pitfall:** `ceil(1000 / cargo_capacity)` divides integers first (1000 / 900 = 1), so Rusty Bucket gets 1 trip instead of 2. `round` is wrong too: 8.33 trips round to 8. **Alternative:** `ceiling(1000 / cargo_capacity::numeric)`.",
		},
		{
			id: "ch05-ex08",
			title: "CASE branches need one type",
			prompt:
				"Fix the query: return the **name** of every pilot and a **label**: `frozen` when credits are unknown, `broke` when credits are exactly 0, and otherwise the credits **as text** (for example `98000.00`).",
			difficulty: 3,
			kind: "query",
			concepts: ["case-expression", "type-casting"],
			starterSql:
				"SELECT name,\n       CASE WHEN credits IS NULL THEN 'frozen'\n            WHEN credits = 0 THEN 'broke'\n            ELSE credits END AS label\nFROM pilots;",
			solutionSql:
				"SELECT name,\n       CASE WHEN credits IS NULL THEN 'frozen'\n            WHEN credits = 0 THEN 'broke'\n            ELSE credits::text END AS label\nFROM pilots;",
			check: { type: "result" },
			hints: [
				"Read the error: Postgres tries to turn 'frozen' into a number.",
				"All branches of a CASE must share one type. The ELSE returns a numeric, so the other branches are forced to be numbers too.",
				"Cast the ELSE branch to text: `ELSE credits::text`.",
			],
			explanation:
				"A CASE has a single result type. With `credits::text` in the ELSE, every branch is text and the labels fit.\n\n**Pitfall:** `WHEN credits = NULL THEN 'frozen'` runs but never matches (NULL comparisons, covered in *The Void*), so Lumen gets NULL instead of *frozen*. **Alternative:** `CAST(credits AS text)`, or `to_char(credits, 'FM999990.00')` when you want to control the format.",
		},
		{
			id: "ch05-ex09",
			title: "Boss: The Customs Invoice",
			story: "Combines arithmetic, COALESCE, simple and searched CASE, and round in one SELECT list.",
			prompt:
				"Return, for **every trade**, five columns in this order:\n\n1. **id**;\n2. **value**: `qty` times `unit_price`, where an **unknown** unit price counts as **0**;\n3. **rate**: `0.08` for a `sell`, `0.03` for a `buy`;\n4. **tax**: value times rate, rounded to **2 decimals**;\n5. **size**: `bulk` when qty is **100 or more**, otherwise `retail`.",
			difficulty: 4,
			kind: "query",
			concepts: ["arithmetic-expressions", "case-expression", "numeric-functions", "coalesce-nullif"],
			solutionSql:
				"SELECT id,\n       qty * COALESCE(unit_price, 0) AS value,\n       CASE side WHEN 'sell' THEN 0.08 ELSE 0.03 END AS rate,\n       round(qty * COALESCE(unit_price, 0) * CASE side WHEN 'sell' THEN 0.08 ELSE 0.03 END, 2) AS tax,\n       CASE WHEN qty >= 100 THEN 'bulk' ELSE 'retail' END AS size\nFROM trades;",
			check: { type: "result" },
			hints: [
				"Build it one column at a time and run after each one. Trade 37 is the tricky row.",
				"COALESCE replaces the unknown price by 0. The rate is a CASE on `side`; the tax repeats the value and rate expressions (an alias cannot be reused in the same SELECT).",
				"qty * COALESCE(unit_price, 0) ... CASE side WHEN 'sell' THEN 0.08 ELSE 0.03 END ... CASE WHEN qty >= 100 THEN 'bulk' ELSE 'retail' END",
			],
			explanation:
				"Each column is an independent expression on the same row: COALESCE for the missing price, a simple CASE for the rate, `round(..., 2)` for the tax and a searched CASE for the size. The tax has to repeat the expressions because aliases do not exist yet while the SELECT list is computed (alias scope comes back in *Tally the Loot*).\n\n**Pitfall:** forgetting COALESCE leaves trade 37 with a NULL value and a NULL tax; `qty > 100` turns the three 100 unit deals into retail. **Alternative:** `COALESCE(qty * unit_price, 0)` gives the same value.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch05-pr01",
			title: "Convert light years to parsecs",
			prompt:
				"Return the **from_planet_id**, **to_planet_id** and the length of every route **in parsecs**: `distance_ly` divided by **3.26**, rounded to **2 decimals**.",
			difficulty: 1,
			kind: "query",
			concepts: ["arithmetic-expressions"],
			solutionSql:
				"SELECT from_planet_id, to_planet_id, round(distance_ly / 3.26, 2) AS parsecs FROM routes;",
			check: { type: "result" },
			hints: [
				"Divide the distance column by 3.26.",
				"Wrap the division in round(..., 2).",
				"round(distance_ly / 3.26, 2)",
			],
			explanation:
				"`distance_ly` is numeric, so the division keeps its decimals and `round(..., 2)` trims them: the 25.0 ly route is 7.67 parsecs.\n\n**Pitfall:** `round(distance_ly, 2) / 3.26` rounds first and divides after, which brings back a long tail of decimals.",
		},
		{
			id: "ch05-pr02",
			title: "Remainder with %",
			prompt:
				"Return the **id** of every trade and the number of **leftover units**: what remains of `qty` after making as many full groups of **12** as possible.",
			difficulty: 2,
			kind: "query",
			concepts: ["arithmetic-expressions"],
			solutionSql: "SELECT id, qty % 12 AS leftover FROM trades;",
			check: { type: "result" },
			hints: [
				"You want the remainder of a division, not the quotient.",
				"`%` is the remainder operator (`mod(a, b)` is the same).",
				"qty % 12",
			],
			explanation:
				"`300 % 12` is 0 (25 full groups) and `20 % 12` is 8. **Pitfall:** `qty / 12` gives the number of full groups, not the leftovers. **Alternative:** `mod(qty, 12)`.",
		},
		{
			id: "ch05-pr03",
			title: "Timestamp to date",
			prompt:
				"Return the **name** of every pilot and **joined_at converted to a date** (no time of day).",
			difficulty: 1,
			kind: "query",
			concepts: ["type-casting"],
			solutionSql: "SELECT name, joined_at::date AS joined_on FROM pilots;",
			check: { type: "result" },
			hints: [
				"`joined_at` is a timestamp. You want a value of another type.",
				"Cast it with `::date` or `CAST(... AS date)`.",
				"joined_at::date",
			],
			explanation:
				"Casting a timestamp to `date` drops the time of day: Ada's `2041-03-15 09:00` becomes `2041-03-15`. Dates and times are covered in *Calendars and Clocks*.",
		},
		{
			id: "ch05-pr04",
			title: "Cast before or after?",
			prompt:
				"Return **one row** with two columns, in this order: the value of `(7 / 2)::numeric` and the value of `7 / 2::numeric`.",
			difficulty: 2,
			kind: "query",
			concepts: ["type-casting"],
			solutionSql: "SELECT (7 / 2)::numeric, 7 / 2::numeric;",
			check: { type: "result" },
			hints: [
				"`::` binds tighter than `/`. Where does each cast apply?",
				"In the first, the parentheses run the integer division first. In the second, only the 2 is cast.",
				"SELECT (7 / 2)::numeric, 7 / 2::numeric;",
			],
			explanation:
				"`(7 / 2)::numeric` divides integers first (3) and then casts 3. `7 / 2::numeric` casts the 2, so the division is decimal: 3.5.\n\n**Pitfall:** believing a cast at the end rescues a division. It only converts the already truncated result.",
		},
		{
			id: "ch05-pr05",
			title: "Boolean column in CASE",
			prompt:
				"Return the **name** of every commodity and a **status**: `contraband` when it is **not legal**, `legal` otherwise.",
			difficulty: 1,
			kind: "query",
			concepts: ["case-expression"],
			solutionSql:
				"SELECT name, CASE WHEN legal THEN 'legal' ELSE 'contraband' END AS status FROM commodities;",
			check: { type: "result" },
			hints: [
				"`legal` is a boolean: it can be a CASE condition by itself.",
				"CASE WHEN condition THEN value ELSE value END",
				"CASE WHEN legal THEN 'legal' ELSE 'contraband' END",
			],
			explanation:
				"`WHEN legal` means `WHEN legal = true`. `legal` is NOT NULL here, so the ELSE only catches rows where `legal` is false. **Alternative:** `CASE WHEN NOT legal THEN 'contraband' ELSE 'legal' END`.",
		},
		{
			id: "ch05-pr06",
			title: "Population classes with CASE",
			prompt:
				"Return the **name** of every planet and its **class**:\n\n- `unknown` when the population is unknown,\n- `abandoned` when it is exactly **0**,\n- `outpost` below **1,000,000**,\n- `colony` below **1,000,000,000**,\n- `metropolis` from **1,000,000,000** up.",
			difficulty: 3,
			kind: "query",
			concepts: ["case-expression"],
			solutionSql:
				"SELECT name,\n       CASE WHEN population IS NULL THEN 'unknown'\n            WHEN population = 0 THEN 'abandoned'\n            WHEN population < 1000000 THEN 'outpost'\n            WHEN population < 1000000000 THEN 'colony'\n            ELSE 'metropolis' END AS class\nFROM planets;",
			check: { type: "result" },
			hints: [
				"Five labels, one CASE. Order the branches so that the first true one is the right one.",
				"Handle NULL and 0 before the `<` tests, or 0 becomes an outpost.",
				"CASE WHEN population IS NULL THEN 'unknown' WHEN population = 0 THEN 'abandoned' WHEN population < 1000000 THEN ...",
			],
			explanation:
				"First match wins, so the special cases (NULL, 0) come first and the thresholds go from small to large.\n\n**Pitfall:** without the `= 0` branch, Mirage (0) satisfies `< 1000000` and becomes an outpost; without the NULL branch, Obsidian Reach and Hollow Moon fall into the ELSE as metropolises.",
		},
		{
			id: "ch05-pr07",
			title: "Absolute value",
			prompt:
				"Return the **name** of every pilot and the **absolute value** of their reputation.",
			difficulty: 1,
			kind: "query",
			concepts: ["numeric-functions"],
			solutionSql: "SELECT name, abs(reputation) AS distance FROM pilots;",
			check: { type: "result" },
			hints: [
				"Negative reputations should lose their minus sign.",
				"There is a function for the absolute value.",
				"abs(reputation)",
			],
			explanation:
				"`abs(-510)` is 510 and `abs(950)` is 950. **Alternative:** `CASE WHEN reputation < 0 THEN -reputation ELSE reputation END`, longer but equivalent.",
		},
		{
			id: "ch05-pr08",
			title: "Reputation in 4 buckets",
			prompt:
				"Return the **name** of every pilot and the **slice number** of their reputation: `width_bucket(reputation, -1000, 1000, 4)`.",
			difficulty: 2,
			kind: "query",
			concepts: ["numeric-functions"],
			solutionSql:
				"SELECT name, width_bucket(reputation, -1000, 1000, 4) AS slice FROM pilots;",
			check: { type: "result" },
			hints: [
				"width_bucket takes the value, the low end, the high end and the number of slices.",
				"Slices here are 500 points wide: -1000 to -500 is slice 1, 500 to 1000 is slice 4.",
				"width_bucket(reputation, -1000, 1000, 4)",
			],
			explanation:
				"`width_bucket` returns 1 to 4 for values inside the range (0 below it, 5 at or above 1000). A reputation of 0 starts slice 3 because each slice includes its lower bound.\n\n**Alternative:** a CASE with four thresholds, which `width_bucket` saves you from writing.",
		},
	],
};

export default chapter;
