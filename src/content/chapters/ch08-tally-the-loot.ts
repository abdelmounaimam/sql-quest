import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch08-tally-the-loot",
	order: 8,
	world: "The Counting House",
	tier: "apprentice",
	track: "query",
	title: "Tally the Loot",
	subtitle: "Count, sum and group: from one big total to one row per group",
	emoji: "💰",
	datasetId: "starport",
	concepts: [
		"aggregate-functions",
		"count-variants",
		"group-by",
		"having",
		"logical-processing-order",
		"aggregate-filter",
		"collection-aggregates",
	],
	prerequisites: ["ch06-words-and-patterns", "ch07-calendars-and-clocks"],
	lesson: [
		{
			kind: "explain",
			title: "Many rows in, one row out",
			body: "Time to count the loot. **Aggregate functions** squash a whole column into one value:\n\n- `count(*)`: how many rows;\n- `sum(x)`, `avg(x)`: total and mean;\n- `min(x)`, `max(x)`: smallest and largest (numbers, text, dates).\n\nA query with aggregates and no GROUP BY returns **exactly one row**, even from an empty table.",
		},
		{
			kind: "example",
			title: "The whole ledger in one row",
			body: "Forty trades, one line. Notice the long tail of decimals on `avg`, and that it averages **39** prices, not 40: trade 37's unknown price is skipped.",
			sql: "SELECT count(*) AS trades, sum(qty) AS units,\n       avg(unit_price) AS avg_price,\n       min(traded_at) AS first, max(traded_at) AS last\nFROM trades;",
		},
		{
			kind: "explain",
			title: "Three ways to count",
			body: "```sql\ncount(*)                  -- rows\ncount(callsign)           -- non-NULL callsigns\ncount(DISTINCT faction_id) -- different non-NULL factions\n```\n\nEvery aggregate **ignores NULLs**, except `count(*)`, which counts rows whatever they contain. And over zero rows, `sum` and `avg` return NULL, not 0.",
		},
		{
			kind: "quiz",
			question:
				"The Starport has 24 pilots and 3 of them have no callsign. What does `SELECT count(callsign) FROM pilots;` return?",
			choices: ["24", "21", "3", "An error: callsign is text"],
			answerIndex: 1,
			explanation:
				"`count(column)` counts the **non-NULL** values, so the three pilots without a callsign are left out: 21. `count(*)` would return 24. Counting works on any type.",
		},
		{
			kind: "explain",
			title: "GROUP BY: one row per group",
			body: "`GROUP BY side` splits the rows into piles, one per value of `side`, and the aggregates run **per pile**.\n\nRule: every column in SELECT is either **in the GROUP BY** or **inside an aggregate**. Otherwise Postgres cannot know which row's value to show:\n\n```sql\nSELECT side, ship_id, count(*) FROM trades GROUP BY side;\n-- error 42803: ship_id must appear in GROUP BY\n```\n\nNULLs form a group of their own.",
		},
		{
			kind: "example",
			title: "Buys versus sells",
			body: "Two piles, two rows, each with its own count and total.",
			sql: "SELECT side, count(*) AS trades, sum(qty) AS units\nFROM trades\nGROUP BY side;",
		},
		{
			kind: "explain",
			title: "The order the database really follows",
			body: "You **write** SELECT first, but Postgres **runs** the clauses in this order:\n\n`FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `DISTINCT` → `ORDER BY` → `LIMIT`\n\nSo WHERE filters **rows** before any group exists: no aggregates there (42803), and no SELECT aliases (42703). **HAVING** filters **groups** after aggregation. ORDER BY runs after SELECT, so aliases work there.",
		},
		{
			kind: "example",
			title: "HAVING keeps the big haulers",
			body: "Only ships that moved more than 500 units in total. The alias `units` works in ORDER BY, but HAVING must repeat `sum(qty)`.",
			sql: "SELECT ship_id, count(*) AS trades, sum(qty) AS units\nFROM trades\nGROUP BY ship_id\nHAVING sum(qty) > 500\nORDER BY units DESC;",
		},
		{
			kind: "explain",
			title: "Conditional and collection aggregates",
			body: "```sql\ncount(*) FILTER (WHERE side = 'sell')        -- count some rows only\nstring_agg(callsign, ', ' ORDER BY callsign) -- 'Halo, Nova, ...'\narray_agg(name)                              -- {Ada,Bram,...}\nbool_or(NOT legal)                           -- any contraband?\n```\n\n`FILTER` gives several conditional totals in one pass. The `ORDER BY` **inside** `string_agg` orders the pieces; without it their order is anyone's guess.",
		},
		{
			kind: "try",
			title: "Your turn: species census",
			prompt: "Return each **species** and the **number of pilots** of that species.",
			starterSql: "SELECT species, count(*)\nFROM pilots;",
			solutionSql: "SELECT species, count(*) FROM pilots GROUP BY species;",
			check: { type: "result" },
			hints: [
				"Run the starter: error 42803. Postgres does not know you want one row per species.",
				"Add GROUP BY species at the end.",
			],
		},
	],
	exercises: [
		{
			id: "ch08-ex01",
			title: "The grand total",
			story: "The Counting House closes its books on two years of trading.",
			prompt:
				"Return **one row** with two columns: the **number of trades** and the **total quantity** traded (the sum of `qty`).",
			difficulty: 1,
			kind: "query",
			concepts: ["aggregate-functions"],
			solutionSql: "SELECT count(*) AS trades, sum(qty) AS units FROM trades;",
			check: { type: "result" },
			hints: [
				"No GROUP BY: the whole table is one group.",
				"count(*) counts rows, sum(qty) adds the quantities.",
				"SELECT count(*), sum(qty) FROM trades;",
			],
			explanation:
				"Without GROUP BY, aggregates collapse the whole table into one row: 40 trades, 4443 units.\n\n**Pitfall:** `count(unit_price)` returns 39, because the flare-damaged trade has no price. When the question is *how many rows*, use `count(*)`.",
		},
		{
			id: "ch08-ex02",
			title: "Census of the pilots",
			story: "The Census Bureau's form has three boxes, and each one counts something different.",
			prompt:
				"Return **one row** with three columns, in this order: the **number of pilots**, the number of pilots **with a callsign**, and the number of **different factions** pilots belong to (freelancers do not count as a faction).",
			difficulty: 2,
			kind: "query",
			concepts: ["count-variants"],
			solutionSql:
				"SELECT count(*) AS pilots, count(callsign) AS with_callsign, count(DISTINCT faction_id) AS factions FROM pilots;",
			check: { type: "result" },
			hints: [
				"Three variants of count, one per box.",
				"`count(col)` skips NULLs; `count(DISTINCT col)` also removes repeats.",
				"count(*), count(callsign), count(DISTINCT faction_id)",
			],
			explanation:
				"24 rows, 21 non-NULL callsigns, 5 distinct non-NULL factions. `count(DISTINCT ...)` ignores NULL too, so the freelancers are not a sixth faction.\n\n**Pitfall:** `count(faction_id)` returns 20: it counts pilots who have a faction, not factions.",
		},
		{
			id: "ch08-ex03",
			title: "Buy side, sell side",
			story: "The treasurer wants a two-line summary pinned above her desk.",
			prompt:
				"For each **side** (`buy` and `sell`), return four columns: the **side**, the **number of trades**, the **total value** (sum of `qty * unit_price`), and the **average unit price** rounded to **2 decimals**. Unknown prices are simply left out of the total and the average.",
			difficulty: 2,
			kind: "query",
			concepts: ["group-by", "aggregate-functions"],
			solutionSql:
				"SELECT side, count(*) AS trades, sum(qty * unit_price) AS total, round(avg(unit_price), 2) AS avg_price\nFROM trades\nGROUP BY side;",
			check: { type: "result" },
			hints: [
				"One output row per side: that is a GROUP BY.",
				"An aggregate can wrap an expression: `sum(qty * unit_price)`. Aggregates already skip NULLs.",
				"SELECT side, count(*), sum(qty * unit_price), round(avg(unit_price), 2) FROM trades GROUP BY side;",
			],
			explanation:
				"Each aggregate runs once per side. The NULL price of trade 37 is skipped by `sum` and `avg`, but the trade is still counted by `count(*)`.\n\n**Pitfall:** `avg(COALESCE(unit_price, 0))` counts the lost price as a real 0 and drags the sell average down to 547.51. **Alternative:** `GROUP BY 1` refers to the first selected column.",
		},
		{
			id: "ch08-ex04",
			title: "Faction purses",
			story: "Each faction wants to know its headcount and its combined wealth. The freelancers want their own line too.",
			prompt:
				"For each **faction_id**, including the pilots with **no faction** (who form their own group), return the **faction_id**, the **number of pilots** and their **total credits**.",
			difficulty: 2,
			kind: "query",
			concepts: ["group-by"],
			solutionSql:
				"SELECT faction_id, count(*) AS pilots, sum(credits) AS purse FROM pilots GROUP BY faction_id;",
			check: { type: "result" },
			hints: [
				"Group by the faction column. What happens to the NULLs?",
				"GROUP BY puts all NULLs in one group. Count the pilots with count(*).",
				"SELECT faction_id, count(*), sum(credits) FROM pilots GROUP BY faction_id;",
			],
			explanation:
				"GROUP BY treats all NULL faction ids as one group: the four freelancers. Lumen's frozen credits are skipped by `sum`, but Lumen still counts as a pilot.\n\n**Pitfall:** `count(credits)` would say the freelancers are 3, because it skips Lumen's NULL wallet.",
		},
		{
			id: "ch08-ex05",
			title: "Best sellers",
			story: "The market board only lists commodities that changed hands often.",
			prompt:
				"Return the **commodity_id** and the **number of trades** of every commodity traded **more than 3 times**.",
			difficulty: 2,
			kind: "query",
			concepts: ["having"],
			solutionSql:
				"SELECT commodity_id, count(*) AS trades FROM trades GROUP BY commodity_id HAVING count(*) > 3;",
			check: { type: "result" },
			hints: [
				"The condition is on the count of a group, not on a single row.",
				"Conditions on groups go in HAVING, after GROUP BY.",
				"GROUP BY commodity_id HAVING count(*) > 3",
			],
			explanation:
				"HAVING runs after grouping, so it can test `count(*)`: Water Ice (1) and Plasma Cells (3) were traded 5 times each.\n\n**Pitfall:** `WHERE count(*) > 3` fails with 42803, because WHERE runs before any group exists. And *more than 3* means `> 3`: `>= 3` would let in six more commodities.",
		},
		{
			id: "ch08-ex06",
			title: "Respected species",
			story:
				"The diplomatic corps wants the species that are both numerous and well regarded. The clerk's query fails before it even starts.",
			prompt:
				"Fix the query: return each **species** that has **more than 2 pilots** and an **average reputation above 100**, with its **number of pilots**.",
			difficulty: 3,
			kind: "query",
			concepts: ["logical-processing-order", "having"],
			starterSql:
				"SELECT species, count(*) AS n\nFROM pilots\nWHERE n > 2 AND avg(reputation) > 100\nGROUP BY species;",
			solutionSql:
				"SELECT species, count(*) AS n\nFROM pilots\nGROUP BY species\nHAVING count(*) > 2 AND avg(reputation) > 100;",
			check: { type: "result" },
			hints: [
				"Read the error: column `n` does not exist. When does WHERE run, compared with SELECT?",
				"WHERE runs before grouping and before SELECT names anything. Both conditions are about groups.",
				"Move them to HAVING, written with the aggregates themselves: HAVING count(*) > 2 AND avg(reputation) > 100",
			],
			explanation:
				"WHERE runs before GROUP BY and before SELECT, so it knows neither the alias `n` nor any aggregate. HAVING runs after grouping and sees `count(*)` and `avg(...)`: Humans, Synths and Zorblax qualify, Vulpines (average -108) do not.\n\n**Pitfall:** `WHERE reputation > 100 ... HAVING count(*) > 2` answers another question: it drops individual pilots first, then counts the survivors.",
		},
		{
			id: "ch08-ex07",
			title: "Buyers and sellers",
			story: "The harbor wants to know whether each ship mostly buys or mostly sells.",
			prompt:
				"For every ship that **has trades**, return three columns: the **ship_id**, its number of **buys** and its number of **sells**.",
			difficulty: 3,
			kind: "query",
			concepts: ["aggregate-filter"],
			solutionSql:
				"SELECT ship_id,\n       count(*) FILTER (WHERE side = 'buy') AS buys,\n       count(*) FILTER (WHERE side = 'sell') AS sells\nFROM trades\nGROUP BY ship_id;",
			check: { type: "result" },
			hints: [
				"One row per ship, but two different counts on that row.",
				"`count(*) FILTER (WHERE condition)` counts only the rows of the group that pass the condition.",
				"count(*) FILTER (WHERE side = 'buy'), count(*) FILTER (WHERE side = 'sell')",
			],
			explanation:
				"FILTER applies a condition to one aggregate only, so the two counts live side by side on one row. Ship 9 shows 0 buys: a FILTERed count of nothing is 0.\n\n**Pitfall:** `count(side = 'buy')` counts every row, because `false` is a value too (only NULL is skipped). A `WHERE side = 'buy'` would remove the sells from every group. **Alternative:** `sum(CASE WHEN side = 'buy' THEN 1 ELSE 0 END)`.",
		},
		{
			id: "ch08-ex08",
			title: "Roll call",
			story: "The radio officer wants one line per species with every callsign on it.",
			prompt:
				"For each **species**, return the species and the **list of its callsigns** in one text, separated by a comma and a space (`, `), sorted the way `ORDER BY callsign` sorts them in this database (capitals first). Pilots without a callsign are left out of the list.",
			difficulty: 3,
			kind: "query",
			concepts: ["collection-aggregates"],
			solutionSql:
				"SELECT species, string_agg(callsign, ', ' ORDER BY callsign) AS callsigns FROM pilots GROUP BY species;",
			check: { type: "result" },
			hints: [
				"One aggregate glues text values together with a separator.",
				"`string_agg(value, separator ORDER BY ...)`. NULL values are skipped for you.",
				"string_agg(callsign, ', ' ORDER BY callsign)",
			],
			explanation:
				"`string_agg` concatenates the group's values, and the `ORDER BY` **inside** the call sorts them before gluing: `Thorn, shadow_99, viper` for the Vulpines (byte order puts capitals first).\n\n**Pitfall:** an `ORDER BY` at the end of the query sorts the result rows, not the names inside each list. **Alternative:** `array_agg(callsign ORDER BY callsign)` builds an array instead of a text.",
		},
		{
			id: "ch08-ex09",
			title: "Boss: Audit of the Counting House",
			story:
				"The Grand Auditor arrives. She wants a monthly report, but only for the busy months, and she reads it in calendar order.",
			prompt:
				"For every **calendar month** with **at least 3 trades**, return four columns, sorted by **month** from oldest to newest:\n\n1. the **month**, as the first instant of the month (`date_trunc('month', traded_at)`);\n2. the **number of trades** of that month (buys and sells);\n3. the **total sell value**: the sum of `qty * unit_price` over the **sells** only (unknown prices ignored);\n4. the **largest quantity** of a single trade that month.",
			difficulty: 5,
			kind: "query",
			concepts: ["group-by", "having", "aggregate-filter", "aggregate-functions", "logical-processing-order", "date-functions"],
			solutionSql:
				"SELECT date_trunc('month', traded_at) AS month,\n       count(*) AS trades,\n       sum(qty * unit_price) FILTER (WHERE side = 'sell') AS sell_value,\n       max(qty) AS biggest\nFROM trades\nGROUP BY date_trunc('month', traded_at)\nHAVING count(*) >= 3\nORDER BY month;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Group by an expression: `date_trunc('month', traded_at)`. Then build one column at a time.",
				"The sell total needs FILTER (a WHERE would also remove the buys from the count). The *at least 3* condition is on groups.",
				"GROUP BY date_trunc('month', traded_at) HAVING count(*) >= 3 ORDER BY 1, with sum(qty * unit_price) FILTER (WHERE side = 'sell')",
			],
			explanation:
				"GROUP BY works on any expression, so `date_trunc` turns 40 instants into monthly piles. FILTER restricts only the sell total, HAVING keeps the busy months, and ORDER BY (which runs last) can use the alias `month`. Four months survive: January, February, March and July 2076.\n\n**Pitfall:** `WHERE side = 'sell'` before grouping removes the buys from every count, and no month has 3 sells: the report comes back empty. `HAVING count(*) > 3` keeps January alone. **Alternative:** `sum(CASE WHEN side = 'sell' THEN qty * unit_price END)`.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch08-pr01",
			title: "Price range",
			prompt:
				"Return **one row** with the **lowest** and the **highest** base_price among commodities, in that order.",
			difficulty: 1,
			kind: "query",
			concepts: ["aggregate-functions"],
			solutionSql: "SELECT min(base_price), max(base_price) FROM commodities;",
			check: { type: "result" },
			hints: ["Two aggregates, one row.", "min and max.", "SELECT min(base_price), max(base_price) FROM commodities;"],
			explanation:
				"`min` and `max` skip NULLs, so Star Charts (no price) does not count as the cheapest: Space Kelp (8.25) does.",
		},
		{
			id: "ch08-pr02",
			title: "Average hull",
			prompt:
				"Return **one row**: the **average hull_integrity** of the ships whose hull **was inspected**, rounded to **2 decimals**.",
			difficulty: 2,
			kind: "query",
			concepts: ["aggregate-functions"],
			solutionSql: "SELECT round(avg(hull_integrity), 2) FROM ships;",
			check: { type: "result" },
			hints: [
				"`avg` already ignores the NULL hulls.",
				"Wrap it in round(..., 2).",
				"SELECT round(avg(hull_integrity), 2) FROM ships;",
			],
			explanation:
				"`avg` divides by the number of non-NULL values (18 hulls), giving 68.32.\n\n**Pitfall:** `sum(hull_integrity) / count(*)` divides by 21 ships and gives 58.56: the uninspected ships count as zeros.",
		},
		{
			id: "ch08-pr03",
			title: "Counted worlds",
			prompt:
				"Return **one row** with two columns: the **number of planets**, and the number of planets whose **population is known**.",
			difficulty: 1,
			kind: "query",
			concepts: ["count-variants"],
			solutionSql: "SELECT count(*), count(population) FROM planets;",
			check: { type: "result" },
			hints: [
				"Rows versus non-NULL values.",
				"count(*) and count(population).",
				"SELECT count(*), count(population) FROM planets;",
			],
			explanation:
				"12 planets, 10 known populations. Mirage's population is 0, a known value, so it is counted.",
		},
		{
			id: "ch08-pr04",
			title: "How many models?",
			prompt: "Return **one row**: the number of **different** ship models on record (an unknown model is not a model).",
			difficulty: 2,
			kind: "query",
			concepts: ["count-variants"],
			solutionSql: "SELECT count(DISTINCT model) FROM ships;",
			check: { type: "result" },
			hints: [
				"Repeated models must count once.",
				"DISTINCT works inside count.",
				"SELECT count(DISTINCT model) FROM ships;",
			],
			explanation:
				"`count(DISTINCT model)` counts 8 different non-NULL models. **Pitfall:** `count(model)` returns 20, one per registered ship.",
		},
		{
			id: "ch08-pr05",
			title: "Fleet by model",
			prompt:
				"Return each **model** and the **number of ships** of that model, including the group of ships with an **unknown** model.",
			difficulty: 2,
			kind: "query",
			concepts: ["group-by"],
			solutionSql: "SELECT model, count(*) FROM ships GROUP BY model;",
			check: { type: "result" },
			hints: [
				"One row per model.",
				"GROUP BY model, and count the rows.",
				"SELECT model, count(*) FROM ships GROUP BY model;",
			],
			explanation:
				"The Ghost Ship forms a NULL group of its own, counted by `count(*)`.\n\n**Pitfall:** `count(model)` would show 0 for that group, since its only model is NULL.",
		},
		{
			id: "ch08-pr06",
			title: "Crowded sectors",
			prompt:
				"Return each **sector** and its **number of planets**, for the sectors with **more than 2** planets.",
			difficulty: 2,
			kind: "query",
			concepts: ["having"],
			solutionSql: "SELECT sector, count(*) FROM planets GROUP BY sector HAVING count(*) > 2;",
			check: { type: "result" },
			hints: [
				"Group, count, then filter the groups.",
				"Conditions on a count go in HAVING.",
				"GROUP BY sector HAVING count(*) > 2",
			],
			explanation:
				"Core, Inner Rim and Frontier have 3 planets each; Outer Rim has only 2. **Pitfall:** `>= 2` would let Outer Rim in.",
		},
		{
			id: "ch08-pr07",
			title: "The alias that was not there yet",
			story:
				"A clerk lists the rich pilots in thousands of credits. Postgres claims the column `kilo` does not exist, yet it is right there in the SELECT.",
			prompt:
				"Fix the query: return the **name** and the **credits divided by 1000** (titled `kilo`) of every pilot with **more than 20** thousand credits, largest first, ties by **name A to Z**.",
			difficulty: 2,
			kind: "query",
			concepts: ["logical-processing-order"],
			starterSql:
				"SELECT name, credits / 1000 AS kilo\nFROM pilots\nWHERE kilo > 20\nORDER BY kilo DESC, name;",
			solutionSql:
				"SELECT name, credits / 1000 AS kilo FROM pilots WHERE credits / 1000 > 20 ORDER BY kilo DESC, name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Which clause fails: WHERE or ORDER BY?",
				"WHERE runs before SELECT creates the alias; ORDER BY runs after it.",
				"Repeat the expression in WHERE: WHERE credits / 1000 > 20 (or credits > 20000).",
			],
			explanation:
				"The alias is born in SELECT, which runs after WHERE but before ORDER BY. So `ORDER BY kilo` is fine, and only the WHERE needs the full expression.\n\n**Alternative:** `WHERE credits > 20000` says the same thing without division.",
		},
		{
			id: "ch08-pr08",
			title: "Legal and not",
			prompt:
				"Return **one row** with two columns: the number of **legal** commodities and the number of **illegal** ones.",
			difficulty: 2,
			kind: "query",
			concepts: ["aggregate-filter"],
			solutionSql:
				"SELECT count(*) FILTER (WHERE legal) AS legal, count(*) FILTER (WHERE NOT legal) AS illegal FROM commodities;",
			check: { type: "result" },
			hints: [
				"Two counts with different conditions, on the same row.",
				"FILTER (WHERE ...) after each count.",
				"count(*) FILTER (WHERE legal), count(*) FILTER (WHERE NOT legal)",
			],
			explanation:
				"13 legal, 3 illegal, in a single pass over the table. **Alternative:** `sum(CASE WHEN legal THEN 1 ELSE 0 END)`.",
		},
		{
			id: "ch08-pr09",
			title: "Any contraband?",
			prompt:
				"Return each **category** of commodity (the uncategorised ones form their own group) and a **boolean** that is true when **at least one** commodity of the category is **not legal**.",
			difficulty: 3,
			kind: "query",
			concepts: ["collection-aggregates"],
			solutionSql: "SELECT category, bool_or(NOT legal) AS has_contraband FROM commodities GROUP BY category;",
			check: { type: "result" },
			hints: [
				"You want an OR over all the rows of a group.",
				"`bool_or(condition)` is true when the condition holds for at least one row.",
				"bool_or(NOT legal)",
			],
			explanation:
				"`bool_or` is the aggregate version of OR: fuel is flagged because of Antimatter Pods. Its sibling `bool_and` is the aggregate AND.\n\n**Pitfall:** `max(NOT legal)` fails with 42883: there is no max for booleans.",
		},
		{
			id: "ch08-pr10",
			title: "Ranks by headcount",
			prompt:
				"Return each **rank** and its **number of pilots**, the most crowded rank first, ties by **rank A to Z**.",
			difficulty: 2,
			kind: "query",
			concepts: ["group-by"],
			solutionSql: "SELECT rank, count(*) AS pilots FROM pilots GROUP BY rank ORDER BY pilots DESC, rank;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Group, count, then sort.",
				"GROUP BY does not sort anything: add an ORDER BY with two keys.",
				"ORDER BY count(*) DESC, rank",
			],
			explanation:
				"Captains and lieutenants tie at 6, cadets and commanders at 3: the second key settles them.\n\n**Pitfall:** believing GROUP BY returns groups in order. It does not promise any order.",
		},
	],
};

export default chapter;
