import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch13-unions-and-named-spells",
	order: 13,
	world: "The Nested Catacombs",
	tier: "adept",
	track: "query",
	title: "Unions and Named Spells",
	subtitle:
		"Stack results, conjure inline tables, name your steps with WITH, and summon series",
	emoji: "📜",
	datasetId: "guild",
	concepts: ["set-operations", "values-lists", "cte-basics", "generate-series"],
	prerequisites: ["ch11-queries-within-queries"],
	lesson: [
		{
			kind: "explain",
			title: "Stacking scrolls",
			body: "Set operators combine two queries **vertically**:\n\n- `UNION`: rows from both, **duplicates removed**\n- `UNION ALL`: rows from both, duplicates kept (and faster)\n- `INTERSECT`: rows found in both\n- `EXCEPT`: rows of the first that are not in the second\n\nBoth sides need the **same number of columns** with compatible types. Column names come from the first query.",
		},
		{
			kind: "example",
			title: "Every region on the map",
			body: "Quest regions and guild hall regions in one list. Highmoor appears in both tables (and twice in guilds), yet UNION shows it once.",
			sql: "SELECT region FROM quests\nUNION\nSELECT hall_region FROM guilds;",
		},
		{
			kind: "quiz",
			question:
				"`quests` has 20 rows over 6 regions, `guilds` has 6 rows over 5 regions. How many rows do `SELECT region FROM quests UNION SELECT hall_region FROM guilds` and the same with `UNION ALL` return?",
			choices: ["6 and 6", "6 and 26", "11 and 26", "26 and 26"],
			answerIndex: 1,
			explanation:
				"UNION removes every duplicate row, even duplicates inside one side: 6 distinct regions. UNION ALL keeps all 20 + 6 = 26 rows. They are not the same operator!",
		},
		{
			kind: "explain",
			title: "A table out of thin air",
			body: "`VALUES` builds a small table right inside the query. Name it and its columns with `AS t(col, ...)`:\n```sql\nSELECT *\nFROM (VALUES ('Rats in the Cellar', 5),\n             ('Yeti Tracks', 40)) AS b(title, bonus);\n```\nWithout the column list, Postgres names them `column1`, `column2`.",
		},
		{
			kind: "example",
			title: "A bounty board",
			body: "The board joins like any table. Bonuses for quests that do not exist simply find no partner.",
			sql: "SELECT q.title, q.region, b.bonus\nFROM (VALUES ('Rats in the Cellar', 5),\n             ('Golem in the Deep', 70),\n             ('Unicorn Rodeo', 12)) AS b(title, bonus)\nJOIN quests q ON q.title = b.title;",
		},
		{
			kind: "explain",
			title: "Name your steps: WITH",
			body: "A **CTE** (common table expression) gives a subquery a **name**, defined before the main query:\n```sql\nWITH tally AS (\n  SELECT hero_id, count(*) AS n\n  FROM quest_completions GROUP BY hero_id\n), top AS (\n  SELECT * FROM tally WHERE n >= 3\n)\nSELECT * FROM top;\n```\nOne `WITH`, several steps separated by **commas**. The names live for **one statement** only: after the final `;` they are gone.",
		},
		{
			kind: "example",
			title: "Above the guild's pace",
			body: "Step 1 counts completions per hero, step 2 compares with the average of those counts. Read it top to bottom, like a recipe.",
			sql: "WITH tally AS (\n  SELECT hero_id, count(*) AS n\n  FROM quest_completions\n  GROUP BY hero_id\n)\nSELECT h.name, t.n\nFROM tally t\nJOIN heroes h ON h.id = t.hero_id\nWHERE t.n > (SELECT avg(n) FROM tally);",
		},
		{
			kind: "explain",
			title: "Summoning a series",
			body: "`generate_series(start, stop, step)` returns one row per value, **both ends included**:\n```sql\nSELECT * FROM generate_series(1, 5);          -- 1..5\nSELECT * FROM generate_series(date '2025-01-01',\n  date '2025-12-01', interval '1 month');     -- 12 months\n```\nJoin facts onto it with a **LEFT JOIN** and empty buckets show up as 0 instead of disappearing.",
		},
		{
			kind: "example",
			title: "Month ends are slippery",
			body: "Start on 31 January and add a month each step. February has no 31st, so the series lands on the 28th, and **stays** on the 28th afterwards: each step adds to the previous value. Start series on the 1st.",
			sql: "SELECT d::date AS day\nFROM generate_series(date '2025-01-31', date '2025-06-30',\n                     interval '1 month') AS d;",
		},
		{
			kind: "try",
			title: "Your turn: every difficulty counts",
			prompt:
				"Return every difficulty from **1 to 5** and its **number of Highmoor quests**, with **0** for difficulties that have none.",
			starterSql:
				"SELECT q.difficulty, count(*)\nFROM quests q\nWHERE q.region = 'Highmoor'\nGROUP BY q.difficulty;",
			solutionSql:
				"SELECT d, count(q.id) FROM generate_series(1, 5) AS d LEFT JOIN quests q ON q.difficulty = d AND q.region = 'Highmoor' GROUP BY d;",
			check: { type: "result" },
			hints: [
				"The starter has no row for difficulty 5. Start from a series of all five difficulties instead.",
				"FROM generate_series(1, 5) AS d LEFT JOIN quests q ON q.difficulty = d AND q.region = 'Highmoor', then count(q.id)",
			],
		},
	],
	exercises: [
		{
			id: "ch13-ex01",
			title: "The atlas of the realm",
			story:
				"The cartographer needs every region where something happens: a quest, a guild hall, or both.",
			prompt:
				"Return every **region** that has a quest **or** a guild hall, each region **once**.",
			difficulty: 1,
			kind: "query",
			concepts: ["set-operations"],
			solutionSql:
				"SELECT region FROM quests\nUNION\nSELECT hall_region FROM guilds;",
			check: { type: "result" },
			hints: [
				"Two lists of regions from two tables: stack them.",
				"Pick the set operator that removes duplicates.",
				"SELECT region FROM quests UNION SELECT hall_region FROM guilds",
			],
			explanation:
				"UNION stacks the two lists and removes duplicates, including the repeats inside each list: 6 regions.\n\n**Pitfall:** UNION ALL returns 26 rows, Highmoor seven times.",
		},
		{
			id: "ch13-ex02",
			title: "Wild lands",
			story:
				"Some regions have quests but no guild to defend them. Aldric wants to found a new hall there.",
			prompt:
				"Return every **region** that has at least one quest but **no guild hall**. Use `EXCEPT`.",
			difficulty: 2,
			kind: "query",
			concepts: ["set-operations"],
			solutionSql:
				"SELECT region FROM quests\nEXCEPT\nSELECT hall_region FROM guilds;",
			check: { type: "result" },
			hints: [
				"Start from the quest regions, remove the hall regions.",
				"EXCEPT keeps the rows of the first query that the second does not return.",
				"SELECT region FROM quests EXCEPT SELECT hall_region FROM guilds",
			],
			explanation:
				"Only Frostspire is left: a cold, guildless frontier. Order matters: `guilds EXCEPT quests` asks the opposite question (and returns nothing here).\n\n**Alternative:** `SELECT DISTINCT region FROM quests q WHERE NOT EXISTS (SELECT 1 FROM guilds g WHERE g.hall_region = q.region)`.",
		},
		{
			id: "ch13-ex03",
			title: "The coin count",
			story:
				"The treasurer stacks every quest reward and every hero's purse into one column to feed the abacus. The total comes out far too low.",
			prompt:
				"Fix the query: return one column **amount** with every quest's **reward_gold** and every hero's **gold**, **keeping duplicates** (one row per quest and one per hero). Heroes with unknown gold are left out.",
			difficulty: 2,
			kind: "query",
			concepts: ["set-operations"],
			starterSql:
				"SELECT reward_gold AS amount FROM quests\nUNION\nSELECT gold FROM heroes WHERE gold IS NOT NULL;",
			solutionSql:
				"SELECT reward_gold AS amount FROM quests\nUNION ALL\nSELECT gold FROM heroes WHERE gold IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"Count the rows of the starter: 20 quests plus 28 known purses should give 48.",
				"UNION silently removes duplicate amounts (many quests pay 10, 60 or 150).",
				"Use UNION ALL.",
			],
			explanation:
				"`UNION ALL` keeps every row: 48 amounts. Plain UNION threw away every repeated value, so two quests paying 10 counted as one.\n\n**Pitfall:** UNION is not *the* union, it is *union without duplicates*. When you want every row, and that is most of the time, say ALL.",
		},
		{
			id: "ch13-ex04",
			title: "Bonus board",
			story:
				"A rich merchant pins extra bonuses on the board for three quests. One of them was clearly invented at the tavern.",
			prompt:
				"Build the board `('Rats in the Cellar', 5), ('Yeti Tracks', 40), ('Dragon Tea Party', 99)` with **VALUES**, and return the **title**, **region** and **bonus** of each board quest that **exists** in `quests`.",
			difficulty: 2,
			kind: "query",
			concepts: ["values-lists"],
			starterSql:
				"SELECT q.title, q.region, b.bonus\nFROM (VALUES ('Rats in the Cellar', 5),\n             ('Yeti Tracks', 40),\n             ('Dragon Tea Party', 99)) AS b\nJOIN quests q ON q.title = b.title;",
			solutionSql:
				"SELECT q.title, q.region, b.bonus\nFROM (VALUES ('Rats in the Cellar', 5),\n             ('Yeti Tracks', 40),\n             ('Dragon Tea Party', 99)) AS b(title, bonus)\nJOIN quests q ON q.title = b.title;",
			check: { type: "result" },
			hints: [
				"Run the starter: column b.title does not exist. What are the VALUES columns called?",
				"Without a column list they are column1 and column2. Name them in the alias.",
				"... ) AS b(title, bonus)",
			],
			explanation:
				"`AS b(title, bonus)` names the inline table and its columns. The Dragon Tea Party finds no quest, so the inner join drops it.\n\n**Alternative:** keep the anonymous names and write `b.column1`, `b.column2`. It works, but nobody enjoys reading it.",
		},
		{
			id: "ch13-ex05",
			title: "Big earners",
			story:
				"Each completion pays the quest's reward. The treasurer wants the heroes who earned more than a typical earner.",
			prompt:
				"Using a **CTE** that totals, per hero, the **reward_gold** of the quests they completed, return the **name** and **total** of every hero whose total is **above the average of those totals** (the average over heroes who completed at least one quest).",
			difficulty: 3,
			kind: "query",
			concepts: ["cte-basics"],
			solutionSql:
				"WITH earned AS (\n  SELECT qc.hero_id, sum(q.reward_gold) AS total\n  FROM quest_completions qc\n  JOIN quests q ON q.id = qc.quest_id\n  GROUP BY qc.hero_id\n)\nSELECT h.name, e.total\nFROM earned e\nJOIN heroes h ON h.id = e.hero_id\nWHERE e.total > (SELECT avg(total) FROM earned);",
			check: { type: "result" },
			hints: [
				"Step 1: one row per hero with the sum of rewards. Step 2: compare each row with the average of step 1.",
				"Put step 1 in `WITH earned AS (...)`; the main query can read `earned` twice, once in a subquery.",
				"... WHERE e.total > (SELECT avg(total) FROM earned)",
			],
			explanation:
				"The CTE is computed once and read twice: as a table in FROM and inside the scalar subquery. The average total is 359.60, and seven heroes beat it.\n\n**Pitfall:** `avg(q.reward_gold)` straight from the joined completions averages **per completion** (about 195), not per hero, and lets five more heroes in.",
		},
		{
			id: "ch13-ex06",
			title: "A spell that forgets",
			story:
				"The scribe named a step `veterans`, used it, then tried to use it again in the next statement. The second statement cannot find it.",
			prompt:
				"Fix the script so that **one statement** returns the **name** of every **veteran** (hero of level **15 or more**) who belongs to a guild, and the **name of their guild**.",
			difficulty: 2,
			kind: "query",
			concepts: ["cte-basics"],
			starterSql:
				"WITH veterans AS (\n  SELECT id, name, guild_id FROM heroes WHERE level >= 15\n)\nSELECT count(*) FROM veterans;\n\nSELECT v.name, g.name AS guild\nFROM veterans v\nJOIN guilds g ON g.id = v.guild_id;",
			solutionSql:
				"WITH veterans AS (\n  SELECT id, name, guild_id FROM heroes WHERE level >= 15\n)\nSELECT v.name, g.name AS guild\nFROM veterans v\nJOIN guilds g ON g.id = v.guild_id;",
			check: { type: "result" },
			hints: [
				"Read the error of the second statement: relation \"veterans\" does not exist.",
				"A CTE belongs to the single statement that defines it. It is not a table saved for later.",
				"Put the WITH directly in front of the SELECT that joins guilds, in one statement.",
			],
			explanation:
				"A CTE is part of its statement, like a subquery with a name. Once the `;` passes, it is gone.\n\n**Pitfall:** believing a CTE is a temporary table. If you need a result across statements, that is a job for a view or a temp table (the Architect's Tower).",
		},
		{
			id: "ch13-ex07",
			title: "Wanderers by level",
			story:
				"The registry tracks guildless wanderers. Morwen wants a full ladder from level 1 to 20, empty rungs included.",
			prompt:
				"Return every **level from 1 to 20** and the **number of heroes without a guild** at that level, with **0** for empty levels, sorted by **level** ascending.",
			difficulty: 2,
			kind: "query",
			concepts: ["generate-series"],
			solutionSql:
				"SELECT s.lvl AS level, count(h.id) AS wanderers\nFROM generate_series(1, 20) AS s(lvl)\nLEFT JOIN heroes h ON h.level = s.lvl AND h.guild_id IS NULL\nGROUP BY s.lvl\nORDER BY s.lvl;",
			check: { type: "result", orderMatters: true },
			hints: [
				"Most levels have no wanderer, so they must come from somewhere else than the heroes table.",
				"Generate 1 to 20, LEFT JOIN the wanderers. Put the 'no guild' test in ON, not WHERE.",
				"FROM generate_series(1, 20) AS s(lvl) LEFT JOIN heroes h ON h.level = s.lvl AND h.guild_id IS NULL ... count(h.id)",
			],
			explanation:
				"The series provides all 20 rungs; the LEFT JOIN attaches wanderers where they exist; `count(h.id)` turns the empty ones into 0.\n\n**Pitfall:** `LEFT JOIN heroes h ON h.level = s.lvl WHERE h.guild_id IS NULL` throws away every level whose heroes all have a guild: only 6 rungs survive. Filters on the joined side belong in ON.",
		},
		{
			id: "ch13-ex08",
			title: "The 2025 calendar",
			story:
				"The guild chronicle needs one line per month of 2025, even the months when nobody finished anything.",
			prompt:
				"Return every **month of 2025**, as the **date of its first day**, and the **number of quest completions** in that month, with **0** for quiet months.",
			difficulty: 3,
			kind: "query",
			concepts: ["generate-series", "cte-basics"],
			solutionSql:
				"WITH months AS (\n  SELECT m::date AS month\n  FROM generate_series(date '2025-01-01', date '2025-12-01', interval '1 month') AS m\n)\nSELECT mo.month, count(qc.hero_id) AS completions\nFROM months mo\nLEFT JOIN quest_completions qc\n  ON qc.completed_at >= mo.month\n AND qc.completed_at < mo.month + interval '1 month'\nGROUP BY mo.month;",
			check: { type: "result" },
			hints: [
				"Generate the 12 first-of-month dates, then attach completions to them.",
				"A completion belongs to a month when it happened on or after its first day and before the next month's first day.",
				"generate_series(date '2025-01-01', date '2025-12-01', interval '1 month'), cast to date, LEFT JOIN on that range, count(qc.hero_id)",
			],
			explanation:
				"The series is the calendar, the range in ON drops each completion into its month, and LEFT JOIN keeps August, September, November and December at 0.\n\n**Pitfall:** grouping `date_trunc('month', completed_at)` straight from quest_completions only lists months that had completions.\n\n**Alternative:** `ON date_trunc('month', qc.completed_at) = mo.month`.",
		},
		{
			id: "ch13-ex09",
			title: "Boss: Census of the Catacombs",
			story:
				"The council wants one ledger per region: how many heroes live there (by guild hall), how many quests it offers, and how many times those quests were completed. Every region where a quest or a hall exists must appear.",
			prompt:
				"Return, for every **region** that has a quest or a guild hall:\n\n1. **region**\n2. **heroes**: heroes whose guild hall is in that region\n3. **quests**: quests in that region\n4. **completions**: completions of quests in that region\n\nShow **0**, not NULL, when there is nothing to count. Build one CTE per source and join them onto the full region list.",
			difficulty: 4,
			kind: "query",
			concepts: ["cte-basics", "set-operations", "join-fanout", "left-join"],
			solutionSql:
				"WITH regions AS (\n  SELECT region FROM quests\n  UNION\n  SELECT hall_region FROM guilds\n), hero_counts AS (\n  SELECT g.hall_region AS region, count(*) AS n\n  FROM heroes h JOIN guilds g ON g.id = h.guild_id\n  GROUP BY g.hall_region\n), quest_counts AS (\n  SELECT region, count(*) AS n FROM quests GROUP BY region\n), completion_counts AS (\n  SELECT q.region, count(*) AS n\n  FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id\n  GROUP BY q.region\n)\nSELECT r.region,\n       COALESCE(hc.n, 0) AS heroes,\n       COALESCE(qc.n, 0) AS quests,\n       COALESCE(cc.n, 0) AS completions\nFROM regions r\nLEFT JOIN hero_counts hc ON hc.region = r.region\nLEFT JOIN quest_counts qc ON qc.region = r.region\nLEFT JOIN completion_counts cc ON cc.region = r.region;",
			check: { type: "result" },
			hints: [
				"Joining heroes, quests and completions in one go multiplies the rows (fan-out, remember the Broken Gate).",
				"Four CTEs: the region list (UNION), then one count per source grouped by region. LEFT JOIN the three counts onto the region list.",
				"WITH regions AS (SELECT region FROM quests UNION SELECT hall_region FROM guilds), hero_counts AS (...), quest_counts AS (...), completion_counts AS (...) SELECT r.region, COALESCE(hc.n, 0), ...",
			],
			explanation:
				"Each CTE produces one row per region, so the final joins cannot multiply anything; the UNION list makes sure Frostspire (no hall) is present, and COALESCE turns its missing hero count into 0.\n\n**Pitfall:** a single query joining guilds, heroes, quests and completions reports Highmoor with 75 heroes. Count each source separately, then join.\n\n**Alternative:** correlated subqueries in SELECT over the region list.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch13-pr01",
			title: "Defended lands",
			prompt:
				"Return every **region** that has **both** a quest and a guild hall. Use `INTERSECT`.",
			difficulty: 1,
			kind: "query",
			concepts: ["set-operations"],
			solutionSql: "SELECT region FROM quests\nINTERSECT\nSELECT hall_region FROM guilds;",
			check: { type: "result" },
			hints: [
				"Rows that appear in both lists.",
				"INTERSECT, like UNION, removes duplicates.",
				"SELECT region FROM quests INTERSECT SELECT hall_region FROM guilds",
			],
			explanation: "Five regions are both dangerous and defended. Frostspire is the odd one out.",
		},
		{
			id: "ch13-pr02",
			title: "The roll of names",
			prompt:
				"Return one list with two columns: **kind** (`hero` or `guild`) and **name**, containing every hero name and every guild name.",
			difficulty: 2,
			kind: "query",
			concepts: ["set-operations"],
			solutionSql:
				"SELECT 'hero' AS kind, name FROM heroes\nUNION ALL\nSELECT 'guild', name FROM guilds;",
			check: { type: "result" },
			hints: [
				"Both sides need the same two columns, in the same order.",
				"Add a constant column on each side to say where the row came from.",
				"SELECT 'hero' AS kind, name FROM heroes UNION ALL SELECT 'guild', name FROM guilds",
			],
			explanation:
				"A constant column labels each branch. 30 heroes + 6 guilds = 36 rows. With UNION the result would be the same here (every pair differs), but UNION ALL says what you mean and skips a useless sort.",
		},
		{
			id: "ch13-pr03",
			title: "Weather report",
			prompt:
				"With the VALUES list `('Highmoor', 'windy'), ('Ashlands', 'scorching'), ('Mistwood', 'foggy'), ('Deepforge', 'smoky'), ('Saltmarsh', 'damp')` as region climates, return every guild's **name** and the **climate** of its hall region.",
			difficulty: 2,
			kind: "query",
			concepts: ["values-lists"],
			solutionSql:
				"SELECT g.name, c.climate\nFROM guilds g\nJOIN (VALUES ('Highmoor', 'windy'), ('Ashlands', 'scorching'), ('Mistwood', 'foggy'),\n             ('Deepforge', 'smoky'), ('Saltmarsh', 'damp')) AS c(region, climate)\n  ON c.region = g.hall_region;",
			check: { type: "result" },
			hints: [
				"Turn the list into a table with VALUES.",
				"Name its columns so you can join on them.",
				"JOIN (VALUES (...), ...) AS c(region, climate) ON c.region = g.hall_region",
			],
			explanation:
				"An inline VALUES table is perfect for small lookup lists you do not want to store. Both Highmoor guilds get the wind.",
		},
		{
			id: "ch13-pr04",
			title: "Fat purses",
			prompt:
				"With **two chained CTEs** (first: total known gold per guild_id; second: only totals **above 1000**), return the **guild name** and its **total gold**.",
			difficulty: 2,
			kind: "query",
			concepts: ["cte-basics"],
			solutionSql:
				"WITH totals AS (\n  SELECT guild_id, sum(gold) AS total FROM heroes WHERE guild_id IS NOT NULL GROUP BY guild_id\n), rich AS (\n  SELECT * FROM totals WHERE total > 1000\n)\nSELECT g.name, r.total\nFROM rich r\nJOIN guilds g ON g.id = r.guild_id;",
			check: { type: "result" },
			hints: [
				"First CTE: GROUP BY guild_id with sum(gold). Second CTE reads the first.",
				"Separate the two CTEs with a comma, a single WITH in front.",
				"WITH totals AS (...), rich AS (SELECT * FROM totals WHERE total > 1000) SELECT ...",
			],
			explanation:
				"The second CTE reads the first like a table. Four guilds pass; the Wandering Lanterns (690.95) do not. Writing `WITH` twice is a syntax error.",
		},
		{
			id: "ch13-pr05",
			title: "Frost ladder",
			prompt:
				"Return every difficulty from **1 to 5** and its **number of Frostspire quests**, with **0** where there are none.",
			difficulty: 2,
			kind: "query",
			concepts: ["generate-series"],
			solutionSql:
				"SELECT d, count(q.id)\nFROM generate_series(1, 5) AS d\nLEFT JOIN quests q ON q.difficulty = d AND q.region = 'Frostspire'\nGROUP BY d;",
			check: { type: "result" },
			hints: [
				"The five difficulties come from a series.",
				"LEFT JOIN the Frostspire quests, with the region test in ON.",
				"FROM generate_series(1, 5) AS d LEFT JOIN quests q ON q.difficulty = d AND q.region = 'Frostspire'",
			],
			explanation:
				"Frostspire has quests of difficulty 2, 4 and 5 only. With the region test in WHERE, difficulties 1 and 3 would vanish.",
		},
		{
			id: "ch13-pr06",
			title: "Whisper week",
			prompt:
				"Return every **day** from **1 to 7 October 2025** (as a date) and the **number of rumors told** that day, with **0** for silent days.",
			difficulty: 3,
			kind: "query",
			concepts: ["generate-series"],
			solutionSql:
				"SELECT s.d::date AS day, count(r.id) AS rumors\nFROM generate_series(date '2025-10-01', date '2025-10-07', interval '1 day') AS s(d)\nLEFT JOIN rumors r ON r.told_at >= s.d AND r.told_at < s.d + interval '1 day'\nGROUP BY s.d;",
			check: { type: "result" },
			hints: [
				"Seven days: a date series with a one-day step.",
				"Attach the rumors whose told_at falls inside each day.",
				"LEFT JOIN rumors r ON r.told_at >= s.d AND r.told_at < s.d + interval '1 day'",
			],
			explanation:
				"The week ends with a silent 7 October. The end of a series is included, so 1 to 7 gives seven rows.",
		},
	],
};

export default chapter;
