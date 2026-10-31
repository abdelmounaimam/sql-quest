import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch11-queries-within-queries",
	order: 11,
	world: "The Nested Catacombs",
	tier: "adept",
	track: "query",
	title: "Queries within Queries",
	subtitle:
		"A query inside a query: as a value, as a list, as a table, and one that looks back at you",
	emoji: "🪆",
	datasetId: "guild",
	concepts: [
		"scalar-subquery",
		"in-subquery",
		"derived-tables",
		"correlated-subquery",
	],
	prerequisites: ["ch10-outer-gates-and-mirrors"],
	lesson: [
		{
			kind: "explain",
			title: "Welcome, archivist",
			body: "You leave the Starport for the **Guild of the Silver Dragon**, whose records fill the catacombs under Highmoor. Old Aldric Stormborn hands you the keys:\n\n- `guilds`: six guilds and the region of their hall\n- `heroes`: thirty adventurers, their level, gold, guild and mentor\n- `quests`: twenty quests across six regions, with rewards\n- `quest_completions`: who finished which quest\n\nSome heroes belong to no guild (`guild_id` NULL), and two never declared their gold.",
		},
		{
			kind: "explain",
			title: "A query as a value",
			body: "A SELECT in parentheses that returns **one row and one column** is a **scalar subquery**. Use it anywhere a single value fits:\n```sql\nSELECT name, gold\nFROM heroes\nWHERE gold > (SELECT avg(gold) FROM heroes);\n```\nThe inner query runs first and becomes a number. No need to copy 646.27 by hand, and the answer stays right when the gold changes.",
		},
		{
			kind: "example",
			title: "Richer than average",
			body: "The subquery can sit in SELECT too: here it shows the average next to each rich hero. Note that `avg` ignores the two heroes with NULL gold.",
			sql: "SELECT name, gold,\n       (SELECT avg(gold) FROM heroes) AS average\nFROM heroes\nWHERE gold > (SELECT avg(gold) FROM heroes);",
		},
		{
			kind: "quiz",
			question:
				"`SELECT name FROM heroes WHERE guild_id = (SELECT id FROM guilds WHERE hall_region = 'Highmoor');` What happens?",
			choices: [
				"It lists the heroes of the Highmoor guild",
				"It fails: two guilds have their hall in Highmoor, and `=` needs a single value (21000)",
				"It returns no rows",
				"It compares with the first Highmoor guild only",
			],
			answerIndex: 1,
			explanation:
				"The Silver Dragon and the Order of the Quiet Bell both live in Highmoor, so the subquery returns two rows: *more than one row returned by a subquery used as an expression*. For a list, use `IN (SELECT ...)`.",
		},
		{
			kind: "explain",
			title: "A query as a list, or as a table",
			body: "`x IN (SELECT col FROM ...)` tests membership in a **one-column list**, any length.\n\nA subquery in **FROM** is a **derived table**: a temporary table you can filter and join. Give it an alias (required before Postgres 16, still a good habit):\n```sql\nSELECT *\nFROM (SELECT guild_id, avg(level) AS avg_level\n      FROM heroes GROUP BY guild_id) AS g\nWHERE g.avg_level > 12;\n```",
		},
		{
			kind: "example",
			title: "Filtering a summary",
			body: "The inner query makes one row per guild; the outer query filters those rows like any table. Notice the row with an empty guild_id: the wanderers form their own group.",
			sql: "SELECT g.guild_id, round(g.avg_level, 1) AS avg_level\nFROM (SELECT guild_id, avg(level) AS avg_level\n      FROM heroes\n      GROUP BY guild_id) AS g\nWHERE g.avg_level > 10;",
		},
		{
			kind: "explain",
			title: "A query that looks back",
			body: "A **correlated** subquery mentions a column of the **outer** row, so it is re-run for every row:\n```sql\nSELECT h.name,\n       (SELECT max(x.gold) FROM heroes x\n        WHERE x.guild_id = h.guild_id) AS guild_max\nFROM heroes h;\n```\n`h` is the outer hero, `x` the heroes searched inside. Qualify both: an unqualified `guild_id` inside would mean `x.guild_id` and break the link.",
		},
		{
			kind: "example",
			title: "The richest of my guild",
			body: "Each hero next to the biggest purse of their own guild. Surprise: every wanderer gets NULL, because `x.guild_id = NULL` never matches anyone, not even another wanderer.",
			sql: "SELECT h.name, h.gold,\n       (SELECT max(x.gold) FROM heroes x\n        WHERE x.guild_id = h.guild_id) AS guild_max\nFROM heroes h;",
		},
		{
			kind: "try",
			title: "Your turn: above the bar",
			prompt:
				"Return the **name** and **level** of every hero whose level is **above the average level** of all heroes.",
			starterSql: "SELECT name, level\nFROM heroes\nWHERE level > avg(level);",
			solutionSql:
				"SELECT name, level FROM heroes WHERE level > (SELECT avg(level) FROM heroes);",
			check: { type: "result" },
			hints: [
				"The starter fails: aggregates are not allowed in WHERE. Compute the average in its own query.",
				"WHERE level > (SELECT avg(level) FROM heroes)",
			],
		},
	],
	exercises: [
		{
			id: "ch11-ex01",
			title: "Heavy purses",
			story:
				"The quartermaster wants to tax the rich, and to know by how much each one beats the average purse.",
			prompt:
				"Return the **name**, the **gold** and the **amount above the average gold** (gold minus the average) of every hero whose gold is **above the average gold**. Heroes with unknown gold do not count in the average and are not listed.",
			difficulty: 2,
			kind: "query",
			concepts: ["scalar-subquery"],
			solutionSql:
				"SELECT name, gold, gold - (SELECT avg(gold) FROM heroes) AS above_avg\nFROM heroes\nWHERE gold > (SELECT avg(gold) FROM heroes);",
			check: { type: "result", tolerance: 0.001 },
			hints: [
				"You need the average gold twice: once to filter, once to subtract.",
				"`(SELECT avg(gold) FROM heroes)` is a single value you can use in WHERE and in SELECT.",
				"SELECT name, gold, gold - (SELECT avg(gold) FROM heroes) ... WHERE gold > (SELECT avg(gold) FROM heroes)",
			],
			explanation:
				"The scalar subquery is computed once and used like a constant. `avg` skips Xander and Rhiannon, whose gold is unknown: the average is about 646.27.\n\n**Pitfall:** `avg(COALESCE(gold, 0))` treats the unknown purses as empty and lowers the average to about 603.18, so every difference is wrong.",
		},
		{
			id: "ch11-ex02",
			title: "Sons and daughters of Highmoor",
			story:
				"Aldric wants to invite every hero whose guild hall stands in Highmoor.",
			prompt:
				"Return the **name** of every hero whose guild has its **hall in Highmoor**. Use `IN (SELECT ...)`.",
			difficulty: 2,
			kind: "query",
			concepts: ["in-subquery"],
			solutionSql:
				"SELECT name\nFROM heroes\nWHERE guild_id IN (SELECT id FROM guilds WHERE hall_region = 'Highmoor');",
			check: { type: "result" },
			hints: [
				"First find the ids of the Highmoor guilds, then the heroes in those guilds.",
				"The inner query returns a list of guild ids.",
				"WHERE guild_id IN (SELECT id FROM guilds WHERE hall_region = 'Highmoor')",
			],
			explanation:
				"The subquery returns guilds 1 and 6; `IN` accepts the whole list. The Quiet Bell has no members, so only the five Silver Dragons come back.\n\n**Alternative:** `JOIN guilds g ON g.id = h.guild_id WHERE g.hall_region = 'Highmoor'` gives the same rows here, because each hero has one guild.",
		},
		{
			id: "ch11-ex03",
			title: "Too many answers",
			story:
				"The census of young guilds crashes with *more than one row returned by a subquery*. The scribe swears it worked last year, when only one guild was that young.",
			prompt:
				"Fix the query: return the **name** of every hero whose guild was **founded on or after 1 January 2021**.",
			difficulty: 2,
			kind: "query",
			concepts: ["in-subquery"],
			starterSql:
				"SELECT name\nFROM heroes\nWHERE guild_id = (SELECT id FROM guilds WHERE founded_on >= '2021-01-01');",
			solutionSql:
				"SELECT name\nFROM heroes\nWHERE guild_id IN (SELECT id FROM guilds WHERE founded_on >= '2021-01-01');",
			check: { type: "result" },
			hints: [
				"Run the subquery alone: how many guild ids does it return?",
				"`=` compares with one value; you need to test membership in a list.",
				"Replace `=` with `IN`.",
			],
			explanation:
				"Three guilds were founded since 2021, so `=` fails with SQLSTATE 21000. `IN` works for any number of rows, including one or zero.\n\n**Pitfall:** adding `LIMIT 1` to the subquery silences the error but silently keeps only one guild.",
		},
		{
			id: "ch11-ex04",
			title: "Distance to the summit",
			prompt:
				"Return every hero's **name**, **level**, and how many **levels they are below the highest level** of any hero (the maximum level minus their level).",
			difficulty: 2,
			kind: "query",
			concepts: ["scalar-subquery"],
			solutionSql:
				"SELECT name, level, (SELECT max(level) FROM heroes) - level AS to_go\nFROM heroes;",
			check: { type: "result" },
			hints: [
				"The maximum level is a single number. Where can a single number go?",
				"Put a scalar subquery inside the SELECT expression.",
				"(SELECT max(level) FROM heroes) - level",
			],
			explanation:
				"The scalar subquery returns 20, and every row subtracts its own level: Aldric and Nyx show 0.\n\n**Pitfall:** `max(level) - level` without a subquery mixes an aggregate with a plain column and fails with 42803 (must appear in GROUP BY).",
		},
		{
			id: "ch11-ex05",
			title: "Seasoned halls",
			story:
				"The council ranks guilds by experience. Only guilds whose heroes average **more than level 12** get a seat.",
			prompt:
				"Return the **guild_id** and the **average level** of its heroes, for every guild whose average level is **greater than 12**. Build the averages in a **subquery in FROM**, then filter outside.",
			difficulty: 3,
			kind: "query",
			concepts: ["derived-tables"],
			solutionSql:
				"SELECT g.guild_id, g.avg_level\nFROM (SELECT guild_id, avg(level) AS avg_level\n      FROM heroes\n      GROUP BY guild_id) AS g\nWHERE g.avg_level > 12;",
			check: { type: "result" },
			hints: [
				"Step 1: one row per guild with its average level. Step 2: keep the big ones.",
				"Wrap step 1 in parentheses in FROM, give it an alias, and filter its column in WHERE.",
				"FROM (SELECT guild_id, avg(level) AS avg_level FROM heroes GROUP BY guild_id) AS g WHERE g.avg_level > 12",
			],
			explanation:
				"The derived table is a real table for the outer query: its `avg_level` column can be filtered by WHERE. Guilds 1, 2 and 3 qualify.\n\n**Pitfall:** `WHERE level > 12` inside the subquery averages only the strong heroes, which is a different question.\n\n**Alternative:** `GROUP BY guild_id HAVING avg(level) > 12` does it in one level.",
		},
		{
			id: "ch11-ex06",
			title: "Quest tally",
			story:
				"The archive needs a card per hero with their number of completed quests. Lazy heroes get a 0.",
			prompt:
				"Return every hero's **name** and their **number of completed quests**, with **0** for heroes who completed none. Use a **correlated subquery** in the SELECT list.",
			difficulty: 3,
			kind: "query",
			concepts: ["correlated-subquery"],
			solutionSql:
				"SELECT h.name,\n       (SELECT count(*) FROM quest_completions qc WHERE qc.hero_id = h.id) AS quests\nFROM heroes h;",
			check: { type: "result" },
			hints: [
				"For each hero, count the completions that belong to *this* hero.",
				"The inner query must refer to the outer hero's id.",
				"(SELECT count(*) FROM quest_completions qc WHERE qc.hero_id = h.id)",
			],
			explanation:
				"The subquery runs once per hero with that hero's `h.id`. `count(*)` over zero rows is 0, so idle heroes get a real zero.\n\n**Pitfall:** forgetting the correlation (`SELECT count(*) FROM quest_completions`) gives every hero 46, the total for the whole guild.\n\n**Alternative:** `LEFT JOIN quest_completions ... GROUP BY h.id, h.name` with `count(qc.quest_id)`.",
		},
		{
			id: "ch11-ex07",
			title: "Above the local rate",
			story:
				"A quest pays well or badly depending on where it is. Morwen wants the quests that pay more than is usual **in their own region**.",
			prompt:
				"Return the **title**, **region** and **reward_gold** of every quest whose reward is **above the average reward of quests in the same region**.",
			difficulty: 3,
			kind: "query",
			concepts: ["correlated-subquery"],
			solutionSql:
				"SELECT q.title, q.region, q.reward_gold\nFROM quests q\nWHERE q.reward_gold > (SELECT avg(x.reward_gold)\n                       FROM quests x\n                       WHERE x.region = q.region);",
			check: { type: "result" },
			hints: [
				"The average depends on the row: it changes with the quest's region.",
				"Use two aliases of quests, and link the inner one to the outer region.",
				"WHERE q.reward_gold > (SELECT avg(x.reward_gold) FROM quests x WHERE x.region = q.region)",
			],
			explanation:
				"Each quest is compared with its own region's average. The Bandit King (150) beats Highmoor's average of 124, while the Ice Witch's Riddle (500) does not beat Frostspire's 587.\n\n**Pitfall:** without `WHERE x.region = q.region` you compare with the global average: the Bandit King drops out and the Riddle sneaks in.",
		},
		{
			id: "ch11-ex08",
			title: "Boss: The Archivist's Ledger",
			story:
				"Aldric wants the ledger of champions: for every guild, its richest member and the size of the guild. If two members of a guild ever share the top purse, both are champions.",
			prompt:
				"For each guild that **has heroes**, return:\n\n1. the **guild name**\n2. the **name** of its richest hero (every hero tied for the top gold of that guild)\n3. that hero's **gold**\n4. the guild's **number of heroes** (all members, including those with unknown gold)",
			difficulty: 4,
			kind: "query",
			concepts: [
				"correlated-subquery",
				"scalar-subquery",
				"derived-tables",
				"in-subquery",
			],
			solutionSql:
				"SELECT g.name AS guild, h.name, h.gold,\n       (SELECT count(*) FROM heroes x WHERE x.guild_id = g.id) AS members\nFROM guilds g\nJOIN heroes h ON h.guild_id = g.id\nWHERE h.gold = (SELECT max(x.gold) FROM heroes x WHERE x.guild_id = g.id);",
			check: { type: "result" },
			hints: [
				"Ulfric (Ember Fang) and Morwen (Moonlit Veil) both hold 2100.00 gold, in different guilds. A champion must be the richest of **their own** guild.",
				"Keep a hero when their gold equals the max gold of their guild (correlated), and count members with another correlated subquery.",
				"WHERE h.gold = (SELECT max(x.gold) FROM heroes x WHERE x.guild_id = g.id), plus (SELECT count(*) FROM heroes x WHERE x.guild_id = g.id)",
			],
			explanation:
				"The correlated `max` is recomputed per guild, so each hero is measured against their own hall. `count(*)` counts every member, gold or not. The Quiet Bell has no heroes, so the inner join leaves it out.\n\n**Pitfall:** computing `max(gold)` per guild in a derived table and joining back **on gold only** pairs Ember Fang's 2100.00 with Morwen of the Moonlit Veil too. Join back on guild **and** gold.\n\n**Alternative:** a derived table `(SELECT guild_id, max(gold) AS top, count(*) AS members FROM heroes GROUP BY guild_id)` joined on both columns.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch11-pr01",
			title: "The grand prize",
			prompt:
				"Return the **title** and **reward_gold** of the quest(s) paying the **highest reward** (all of them if several tie).",
			difficulty: 1,
			kind: "query",
			concepts: ["scalar-subquery"],
			solutionSql:
				"SELECT title, reward_gold FROM quests WHERE reward_gold = (SELECT max(reward_gold) FROM quests);",
			check: { type: "result" },
			hints: [
				"Find the highest reward first.",
				"Compare each quest with a scalar subquery.",
				"WHERE reward_gold = (SELECT max(reward_gold) FROM quests)",
			],
			explanation:
				"The Frozen Throne pays 1200. Unlike `ORDER BY ... LIMIT 1`, this version would return every quest tied for the top.",
		},
		{
			id: "ch11-pr02",
			title: "Veterans of the Siege",
			prompt:
				"Return the **name** of every hero who completed **quest 3** (Siege of Highmoor Keep). Use `IN (SELECT ...)`.",
			difficulty: 1,
			kind: "query",
			concepts: ["in-subquery"],
			solutionSql:
				"SELECT name FROM heroes WHERE id IN (SELECT hero_id FROM quest_completions WHERE quest_id = 3);",
			check: { type: "result" },
			hints: [
				"The completions table knows hero ids, the heroes table knows names.",
				"Select the hero ids who did quest 3, then test membership.",
				"WHERE id IN (SELECT hero_id FROM quest_completions WHERE quest_id = 3)",
			],
			explanation: "Aldric and Hilde held the walls of Highmoor Keep together.",
		},
		{
			id: "ch11-pr03",
			title: "Heavy kinds",
			prompt:
				"Return the **name** and **rarity** of every item whose rarity is **one of the rarities of items weighing more than 3** pounds.",
			difficulty: 2,
			kind: "query",
			concepts: ["in-subquery"],
			solutionSql:
				"SELECT name, rarity FROM items WHERE rarity IN (SELECT rarity FROM items WHERE weight > 3);",
			check: { type: "result" },
			hints: [
				"First: which rarities appear among items heavier than 3?",
				"Then keep every item whose rarity is in that list.",
				"WHERE rarity IN (SELECT rarity FROM items WHERE weight > 3)",
			],
			explanation:
				"The inner query yields common, legendary and rare (with repeats, which IN does not mind). The outer query then lists every item of those rarities, light ones included.",
		},
		{
			id: "ch11-pr04",
			title: "Crowded quests",
			prompt:
				"Return the **quest_id** and the **average party size** of every quest whose average party size is **greater than 3** (unknown party sizes are ignored). Compute the averages in a subquery in FROM.",
			difficulty: 2,
			kind: "query",
			concepts: ["derived-tables"],
			solutionSql:
				"SELECT q.quest_id, q.avg_party\nFROM (SELECT quest_id, avg(party_size) AS avg_party\n      FROM quest_completions GROUP BY quest_id) AS q\nWHERE q.avg_party > 3;",
			check: { type: "result" },
			hints: [
				"Build one row per quest with its average party size.",
				"Wrap that query in FROM with an alias, then filter.",
				"FROM (SELECT quest_id, avg(party_size) AS avg_party FROM quest_completions GROUP BY quest_id) AS q WHERE q.avg_party > 3",
			],
			explanation:
				"Five quests average more than 3 (the Siege needed parties of 6). Quests 2 and 10 average exactly 3 and stay out: *greater than* is strict.",
		},
		{
			id: "ch11-pr05",
			title: "Best of their class",
			prompt:
				"Return the **name**, **class** and **xp** of every hero whose xp is the **highest xp of their own class** (all of them in case of a tie).",
			difficulty: 3,
			kind: "query",
			concepts: ["correlated-subquery"],
			solutionSql:
				"SELECT h.name, h.class, h.xp\nFROM heroes h\nWHERE h.xp = (SELECT max(x.xp) FROM heroes x WHERE x.class = h.class);",
			check: { type: "result" },
			hints: [
				"The maximum depends on the hero's class.",
				"Correlate the inner query on class.",
				"WHERE h.xp = (SELECT max(x.xp) FROM heroes x WHERE x.class = h.class)",
			],
			explanation:
				"One champion per class. Without the correlation you would get only the two heroes at 98000 xp overall: Aldric and Nyx.",
		},
		{
			id: "ch11-pr06",
			title: "Fresh blood",
			prompt:
				"Return every guild's **name** and the **join date of its newest hero** (the latest `joined_on`), with NULL for a guild without heroes. Use a correlated subquery.",
			difficulty: 2,
			kind: "query",
			concepts: ["correlated-subquery"],
			solutionSql:
				"SELECT g.name,\n       (SELECT max(h.joined_on) FROM heroes h WHERE h.guild_id = g.id) AS newest\nFROM guilds g;",
			check: { type: "result" },
			hints: [
				"One value per guild: the latest join date of its members.",
				"A scalar subquery in SELECT, linked to the outer guild.",
				"(SELECT max(h.joined_on) FROM heroes h WHERE h.guild_id = g.id)",
			],
			explanation:
				"A scalar subquery that finds no row returns NULL, so the Order of the Quiet Bell keeps its place with an empty date. An inner join with GROUP BY would drop it.",
		},
	],
};

export default chapter;
