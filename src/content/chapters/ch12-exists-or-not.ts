import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch12-exists-or-not",
	order: 12,
	world: "The Nested Catacombs",
	tier: "adept",
	track: "query",
	title: "Exists or Not",
	subtitle: "EXISTS, NOT EXISTS, anti-joins, NOT IN with NULLs, ANY and ALL",
	emoji: "❓",
	datasetId: "guild",
	concepts: ["semi-join-exists", "anti-join", "not-in-null-trap", "any-all"],
	prerequisites: ["ch11-queries-within-queries"],
	lesson: [
		{
			kind: "explain",
			title: "EXISTS",
			body: "`EXISTS (subquery)` is true as soon as the subquery finds **one row**. What it selects does not matter, so the convention is `SELECT 1`:\n```sql\nSELECT h.name\nFROM heroes h\nWHERE EXISTS (SELECT 1 FROM quest_completions qc\n              WHERE qc.hero_id = h.id);\n```\nThe subquery must be **correlated** (`qc.hero_id = h.id`): without that link it asks *does any row exist?*, and the answer is yes for every hero.",
		},
		{
			kind: "example",
			title: "A semi-join with EXISTS",
			body: "Aldric has five completions, yet he appears **once**: EXISTS only answers yes or no. This is a **semi-join**.",
			sql: "SELECT h.id, h.name\nFROM heroes h\nWHERE EXISTS (SELECT 1 FROM quest_completions qc\n              WHERE qc.hero_id = h.id);",
		},
		{
			kind: "explain",
			title: "Anti-joins",
			body: "To find rows with **no** match, use `NOT EXISTS`, or the LEFT JOIN anti-join pattern, covered in *Outer Gates and Mirrors*:\n```sql\nFROM quests q\nLEFT JOIN quest_completions qc ON qc.quest_id = q.id\nWHERE qc.quest_id IS NULL\n```\nTest a column that is never NULL in a real match (a key), not a nullable one like `party_size`.",
		},
		{
			kind: "example",
			title: "Quests with no completion",
			body: "Two quests have no row in `quest_completions`: the Kraken and the Golem.",
			sql: "SELECT q.id, q.title\nFROM quests q\nWHERE NOT EXISTS (SELECT 1 FROM quest_completions qc\n                  WHERE qc.quest_id = q.id);",
		},
		{
			kind: "quiz",
			question:
				"Heroes who are nobody's mentor: `SELECT name FROM heroes WHERE id NOT IN (SELECT mentor_id FROM heroes);` How many rows?",
			choices: [
				"17, the heroes without apprentices",
				"30, every hero",
				"0, no rows at all",
				"An error, because mentor_id can be NULL",
			],
			answerIndex: 2,
			explanation:
				"Several heroes have a NULL `mentor_id`. `id NOT IN (2, 5, NULL, ...)` means `id <> 2 AND id <> 5 AND id <> NULL ...`, and `id <> NULL` is unknown, so the whole test is never true. Zero rows, no error.",
		},
		{
			kind: "example",
			title: "NOT IN versus NOT EXISTS",
			body: "Same question, two queries. NOT IN returns nothing; NOT EXISTS finds the 17 heroes who mentor nobody, because it never compares with the NULLs.",
			sql: "SELECT\n  (SELECT count(*) FROM heroes\n   WHERE id NOT IN (SELECT mentor_id FROM heroes)) AS with_not_in,\n  (SELECT count(*) FROM heroes h\n   WHERE NOT EXISTS (SELECT 1 FROM heroes a\n                     WHERE a.mentor_id = h.id)) AS with_not_exists;",
		},
		{
			kind: "explain",
			title: "ANY and ALL",
			body: "Compare with **every** value of a list:\n\n- `x > ALL (SELECT ...)`: bigger than each of them\n- `x = ANY (SELECT ...)`: equal to at least one (same as IN)\n\nThey work on arrays too: `'scout' = ANY (tags)`. Write `= ANY(tags)`, never `IN (tags)`.\n\nEdge cases: `> ALL` of an **empty** list is true, and a NULL in the list makes ALL unknown.",
		},
		{
			kind: "quiz",
			question:
				"You want each hero who completed a Highmoor quest, once. Which query is safe as written?",
			choices: [
				"`SELECT h.name FROM heroes h JOIN quest_completions qc ON qc.hero_id = h.id JOIN quests q ON q.id = qc.quest_id WHERE q.region = 'Highmoor'`",
				"`SELECT h.name FROM heroes h WHERE EXISTS (SELECT 1 FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id WHERE qc.hero_id = h.id AND q.region = 'Highmoor')`",
				"Both return the same rows",
			],
			answerIndex: 1,
			explanation:
				"The JOIN returns one row per completion: Aldric five times. EXISTS returns each hero at most once. JOIN + DISTINCT also works, but it builds the duplicates first and then removes them.",
		},
		{
			kind: "try",
			title: "Try it: quests with a completion",
			prompt:
				"Return the **id** and **title** of every quest that **at least one hero completed**, each quest once. Use EXISTS.",
			starterSql:
				"SELECT q.id, q.title\nFROM quests q\nWHERE EXISTS (SELECT 1 FROM quest_completions qc);",
			solutionSql:
				"SELECT q.id, q.title FROM quests q WHERE EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.quest_id = q.id);",
			check: { type: "result" },
			hints: [
				"The starter lists all 20 quests: its subquery is not linked to the outer quest.",
				"Add WHERE qc.quest_id = q.id inside the subquery.",
			],
		},
	],
	exercises: [
		{
			id: "ch12-ex01",
			title: "Heroes with a completion",
			prompt:
				"Return the **name** of every hero who completed **at least one** quest, each hero **once**.",
			difficulty: 1,
			kind: "query",
			concepts: ["semi-join-exists"],
			solutionSql:
				"SELECT h.name\nFROM heroes h\nWHERE EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.hero_id = h.id);",
			check: { type: "result" },
			hints: [
				"You do not need any column from quest_completions, only to know a row exists.",
				"Use EXISTS with a subquery linked to the outer hero.",
				"WHERE EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.hero_id = h.id)",
			],
			explanation:
				"EXISTS stops at the first match, so a hero with five completions still appears once: 25 names.\n\n**Pitfall:** a plain JOIN returns one row per completion (46 rows), with Aldric five times.\n\n**Alternative:** `WHERE h.id IN (SELECT hero_id FROM quest_completions)`.",
		},
		{
			id: "ch12-ex02",
			title: "Heroes with no completion",
			prompt:
				"Return the **name** of every hero who has **never completed** a quest.",
			difficulty: 2,
			kind: "query",
			concepts: ["anti-join"],
			solutionSql:
				"SELECT h.name\nFROM heroes h\nWHERE NOT EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.hero_id = h.id);",
			check: { type: "result" },
			hints: [
				"You want the heroes for whom no completion row exists.",
				"NOT EXISTS with a correlated subquery.",
				"WHERE NOT EXISTS (SELECT 1 FROM quest_completions qc WHERE qc.hero_id = h.id)",
			],
			explanation:
				"NOT EXISTS keeps a hero when the correlated search finds nothing: lyra, Tamsin, Xander, Bors and Mabel.\n\n**Pitfall:** `NOT EXISTS (SELECT 1 FROM quest_completions)` without the link is false for everyone, because the table is not empty.\n\n**Alternative:** `LEFT JOIN quest_completions qc ON qc.hero_id = h.id WHERE qc.hero_id IS NULL`.",
		},
		{
			id: "ch12-ex03",
			title: "Replace NOT IN with NOT EXISTS",
			prompt:
				"Fix the query: return the **id** and **name** of every hero who is **nobody's mentor**.",
			difficulty: 3,
			kind: "query",
			concepts: ["not-in-null-trap"],
			starterSql:
				"SELECT id, name\nFROM heroes\nWHERE id NOT IN (SELECT mentor_id FROM heroes);",
			solutionSql:
				"SELECT h.id, h.name\nFROM heroes h\nWHERE NOT EXISTS (SELECT 1 FROM heroes a WHERE a.mentor_id = h.id);",
			check: { type: "result" },
			hints: [
				"Run `SELECT mentor_id FROM heroes` alone: some values are NULL.",
				"`x NOT IN (..., NULL)` is never true. NOT EXISTS does not have this problem.",
				"WHERE NOT EXISTS (SELECT 1 FROM heroes a WHERE a.mentor_id = h.id)",
			],
			explanation:
				"NOT EXISTS only asks whether a hero with this mentor exists, and NULL mentor ids never match: 17 heroes.\n\n**Pitfall:** NOT IN against a nullable column. It works in your tests, then one NULL arrives and the result is silently empty.\n\n**Alternative:** keep NOT IN but exclude the NULLs: `NOT IN (SELECT mentor_id FROM heroes WHERE mentor_id IS NOT NULL)`.",
		},
		{
			id: "ch12-ex04",
			title: "Quests nobody completed",
			prompt:
				"Return the **id** and **title** of every quest that **nobody completed**. Use a **LEFT JOIN**.",
			difficulty: 2,
			kind: "query",
			concepts: ["anti-join"],
			solutionSql:
				"SELECT q.id, q.title\nFROM quests q\nLEFT JOIN quest_completions qc ON qc.quest_id = q.id\nWHERE qc.quest_id IS NULL;",
			check: { type: "result" },
			hints: [
				"Keep every quest, then keep the ones that found no completion.",
				"Test a column of quest_completions that is never NULL when a match exists.",
				"LEFT JOIN quest_completions qc ON qc.quest_id = q.id WHERE qc.quest_id IS NULL",
			],
			explanation:
				"A quest without completion keeps one row with every `qc` column NULL; key columns are never NULL in a real completion, so the test is exact.\n\n**Pitfall:** `WHERE qc.party_size IS NULL` also catches completions with a NULL `party_size`, and lists Rats in the Cellar and Festival Escort (twice).",
		},
		{
			id: "ch12-ex05",
			title: "Guilds with a hero of level 15+",
			prompt:
				"Return the **name** of every guild that has **at least one hero of level 15 or more**, each guild once.",
			difficulty: 2,
			kind: "query",
			concepts: ["semi-join-exists"],
			solutionSql:
				"SELECT g.name\nFROM guilds g\nWHERE EXISTS (SELECT 1 FROM heroes h WHERE h.guild_id = g.id AND h.level >= 15);",
			check: { type: "result" },
			hints: [
				"The question is about guilds; heroes only serve as a test.",
				"EXISTS with two conditions inside: the link to the guild and the level.",
				"WHERE EXISTS (SELECT 1 FROM heroes h WHERE h.guild_id = g.id AND h.level >= 15)",
			],
			explanation:
				"Four guilds have a hero of level 15 or more. Extra conditions go inside the subquery, next to the correlation.\n\n**Pitfall:** a JOIN lists the Silver Dragon twice (Aldric and Hilde) and the Moonlit Veil three times.",
		},
		{
			id: "ch12-ex06",
			title: "Greater than ALL",
			prompt:
				"Return the **id**, **title** and **difficulty** of every quest whose difficulty is **greater than the difficulty of every Highmoor quest**. Use `ALL`.",
			difficulty: 2,
			kind: "query",
			concepts: ["any-all"],
			solutionSql:
				"SELECT id, title, difficulty\nFROM quests\nWHERE difficulty > ALL (SELECT difficulty FROM quests WHERE region = 'Highmoor');",
			check: { type: "result" },
			hints: [
				"Greater than every value of a list.",
				"`> ALL (subquery)` compares with each value the subquery returns.",
				"WHERE difficulty > ALL (SELECT difficulty FROM quests WHERE region = 'Highmoor')",
			],
			explanation:
				"The hardest Highmoor quest is difficulty 4, so only the five difficulty 5 quests pass.\n\n**Pitfall:** `> ANY` means greater than **at least one**, here greater than 1: almost every quest.\n\n**Alternative:** `difficulty > (SELECT max(difficulty) ...)`, careful: with an empty list `> ALL` is true but `> max(...)` compares with NULL and is never true.",
		},
		{
			id: "ch12-ex07",
			title: "Search an array with ANY",
			prompt:
				"Return the **id** and **name** of every hero whose **tags** contain `scout`.",
			difficulty: 2,
			kind: "query",
			concepts: ["any-all"],
			solutionSql: "SELECT id, name\nFROM heroes\nWHERE 'scout' = ANY (tags);",
			check: { type: "result" },
			hints: [
				"`tags` is a `text[]`: one column holding a list.",
				"`value = ANY (array)` is true when one element equals the value.",
				"WHERE 'scout' = ANY (tags)",
			],
			explanation:
				"`= ANY` walks the array. Heroes with NULL tags or `{}` do not match.\n\n**Pitfall:** `'scout' IN (tags)` compares the text with the **whole array** and fails (malformed array literal). IN wants a list of values, not an array.\n\n**Alternative:** `tags @> ARRAY['scout']` (array containment, covered in *The Alchemist's Vault*).",
		},
		{
			id: "ch12-ex08",
			title: "Remove duplicates with EXISTS",
			prompt:
				"Fix the query: return the **name** of every hero who completed **at least one Highmoor quest**, each hero **once**. The current query returns Aldric five times and Hilde three times.",
			difficulty: 3,
			kind: "query",
			concepts: ["semi-join-exists"],
			starterSql:
				"SELECT h.name\nFROM heroes h\nJOIN quest_completions qc ON qc.hero_id = h.id\nJOIN quests q ON q.id = qc.quest_id\nWHERE q.region = 'Highmoor';",
			solutionSql:
				"SELECT h.name\nFROM heroes h\nWHERE EXISTS (SELECT 1\n              FROM quest_completions qc\n              JOIN quests q ON q.id = qc.quest_id\n              WHERE qc.hero_id = h.id AND q.region = 'Highmoor');",
			check: { type: "result" },
			hints: [
				"The join produces one row per completion, not per hero.",
				"Move the completions and quests into an EXISTS test so each hero is checked once.",
				"WHERE EXISTS (SELECT 1 FROM quest_completions qc JOIN quests q ON q.id = qc.quest_id WHERE qc.hero_id = h.id AND q.region = 'Highmoor')",
			],
			explanation:
				"The subquery can contain any joins: EXISTS only reports yes or no for each hero. Eight heroes qualify.\n\n**Pitfall:** `SELECT DISTINCT h.name` also works here, but it removes duplicates the join created, and would merge two different heroes who share a name.",
		},
		{
			id: "ch12-ex09",
			title: "Boss: Unfinished Business",
			story:
				"Combines EXISTS, NOT EXISTS over a two-join subquery and a correlated count, where NOT IN would fail on a NULL.",
			prompt:
				"Return the **name** and the **number of heroes** of every guild that **has at least one hero** but where **none of its heroes completed a secret quest** (`is_secret` true). Guilds with no heroes are excluded.",
			difficulty: 4,
			kind: "query",
			concepts: ["anti-join", "semi-join-exists", "not-in-null-trap"],
			solutionSql:
				"SELECT g.name,\n       (SELECT count(*) FROM heroes h WHERE h.guild_id = g.id) AS heroes\nFROM guilds g\nWHERE EXISTS (SELECT 1 FROM heroes h WHERE h.guild_id = g.id)\n  AND NOT EXISTS (SELECT 1\n                  FROM heroes h\n                  JOIN quest_completions qc ON qc.hero_id = h.id\n                  JOIN quests q ON q.id = qc.quest_id\n                  WHERE h.guild_id = g.id AND q.is_secret);",
			check: { type: "result" },
			hints: [
				"Three tests per guild: it has heroes, none of them did a secret quest, and how many heroes it has.",
				"EXISTS for the first, NOT EXISTS (heroes joined to completions and quests) for the second, a correlated count for the third.",
				"WHERE EXISTS (SELECT 1 FROM heroes h WHERE h.guild_id = g.id) AND NOT EXISTS (SELECT 1 FROM heroes h JOIN quest_completions qc ON qc.hero_id = h.id JOIN quests q ON q.id = qc.quest_id WHERE h.guild_id = g.id AND q.is_secret)",
			],
			explanation:
				"Only the Silver Dragon (5 heroes) and the Iron Anvil (4) have no secret quest completion. The Quiet Bell is excluded by the EXISTS test.\n\n**Pitfall:** `g.id NOT IN (SELECT h.guild_id FROM heroes h JOIN ... WHERE q.is_secret)` returns **nothing**: Nyx completed two secret quests and has no guild, so the list contains a NULL. It is the same NOT IN problem as before, harder to spot because the NULL comes from two joins.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch12-pr01",
			title: "Guilds with a hero who completed quest 8",
			prompt:
				"Return the **name** of every guild with at least one hero who completed **quest 8** (Heart of the Mist).",
			difficulty: 2,
			kind: "query",
			concepts: ["semi-join-exists"],
			solutionSql:
				"SELECT g.name\nFROM guilds g\nWHERE EXISTS (SELECT 1 FROM heroes h\n              JOIN quest_completions qc ON qc.hero_id = h.id\n              WHERE h.guild_id = g.id AND qc.quest_id = 8);",
			check: { type: "result" },
			hints: [
				"A guild qualifies if one of its heroes has a completion of quest 8.",
				"EXISTS over heroes joined with quest_completions.",
				"WHERE EXISTS (SELECT 1 FROM heroes h JOIN quest_completions qc ON qc.hero_id = h.id WHERE h.guild_id = g.id AND qc.quest_id = 8)",
			],
			explanation:
				"Morwen's completion makes the Moonlit Veil qualify. Nyx also completed the quest, but her guild_id is NULL.",
		},
		{
			id: "ch12-pr02",
			title: "Guilds with no heroes",
			prompt: "Return the **name** of every guild that has **no heroes**.",
			difficulty: 1,
			kind: "query",
			concepts: ["anti-join"],
			solutionSql:
				"SELECT g.name FROM guilds g WHERE NOT EXISTS (SELECT 1 FROM heroes h WHERE h.guild_id = g.id);",
			check: { type: "result" },
			hints: [
				"No hero row points at the guild.",
				"NOT EXISTS with a correlated subquery.",
				"WHERE NOT EXISTS (SELECT 1 FROM heroes h WHERE h.guild_id = g.id)",
			],
			explanation:
				"The Order of the Quiet Bell has no members. Here `id NOT IN (SELECT guild_id FROM heroes)` would return nothing: some heroes have a NULL guild_id.",
		},
		{
			id: "ch12-pr03",
			title: "Heroes never a listener",
			prompt:
				"Return the **name** of every hero who was **never told** a rumor (never a `listener_id` in `rumors`).",
			difficulty: 2,
			kind: "query",
			concepts: ["anti-join"],
			solutionSql:
				"SELECT h.name FROM heroes h WHERE NOT EXISTS (SELECT 1 FROM rumors r WHERE r.listener_id = h.id);",
			check: { type: "result" },
			hints: [
				"Look for heroes with no rumor row where they are the listener.",
				"NOT EXISTS, correlated on listener_id.",
				"WHERE NOT EXISTS (SELECT 1 FROM rumors r WHERE r.listener_id = h.id)",
			],
			explanation:
				"Twenty heroes qualify. Be precise about the role: correlating on `teller_id` would answer *who never spread a rumor* instead.",
		},
		{
			id: "ch12-pr04",
			title: "Quests that are no prerequisite",
			prompt:
				"Fix the query: return the **id** and **title** of every quest that is **no other quest's prerequisite**.",
			difficulty: 3,
			kind: "query",
			concepts: ["not-in-null-trap"],
			starterSql:
				"SELECT id, title\nFROM quests\nWHERE id NOT IN (SELECT prerequisite_quest_id FROM quests);",
			solutionSql:
				"SELECT q.id, q.title\nFROM quests q\nWHERE NOT EXISTS (SELECT 1 FROM quests n WHERE n.prerequisite_quest_id = q.id);",
			check: { type: "result" },
			hints: [
				"Starting quests have a NULL prerequisite_quest_id.",
				"One NULL in a NOT IN list makes every test unknown. Switch to NOT EXISTS.",
				"WHERE NOT EXISTS (SELECT 1 FROM quests n WHERE n.prerequisite_quest_id = q.id)",
			],
			explanation:
				"Nine quests unlock nothing. NOT EXISTS ignores the NULL prerequisites instead of being broken by them.",
		},
		{
			id: "ch12-pr05",
			title: "Predict a NOT IN result",
			prompt:
				"Check, do not guess: how many rows does `SELECT id FROM guilds WHERE id NOT IN (SELECT guild_id FROM heroes)` return? Return that **number** as a single value.",
			difficulty: 2,
			kind: "query",
			concepts: ["not-in-null-trap"],
			solutionSql: "SELECT 0 AS row_count;",
			check: { type: "result" },
			hints: [
				"Guild 6 has no heroes, so you might expect 1. Does `heroes.guild_id` contain NULLs?",
				"Some heroes have no guild: the list contains NULL, so `NOT IN` can never be true.",
				"SELECT 0;",
			],
			explanation:
				"Zero. Even the Quiet Bell, which has no heroes, is lost, because `6 <> NULL` is unknown. You can check with `SELECT count(*) FROM guilds WHERE id NOT IN (SELECT guild_id FROM heroes)`.",
		},
		{
			id: "ch12-pr06",
			title: "Greater than ANY",
			prompt:
				"Return the **name** and **level** of every hero whose level is **greater than at least one** level found in **guild 5**. Use `ANY`.",
			difficulty: 2,
			kind: "query",
			concepts: ["any-all"],
			solutionSql:
				"SELECT name, level FROM heroes WHERE level > ANY (SELECT level FROM heroes WHERE guild_id = 5);",
			check: { type: "result" },
			hints: [
				"Greater than at least one value of a list.",
				"`> ANY (subquery)`",
				"WHERE level > ANY (SELECT level FROM heroes WHERE guild_id = 5)",
			],
			explanation:
				"`> ANY` is the same as *greater than the smallest*: the lowest level in guild 5 is Mabel's level 2, so every hero above level 2 qualifies.",
		},
		{
			id: "ch12-pr07",
			title: "At least as high as ALL",
			prompt:
				"Return the **title** and **reward_gold** of every quest whose reward is **at least as high as every Mistwood quest's reward**. Use `ALL`.",
			difficulty: 2,
			kind: "query",
			concepts: ["any-all"],
			solutionSql:
				"SELECT title, reward_gold FROM quests WHERE reward_gold >= ALL (SELECT reward_gold FROM quests WHERE region = 'Mistwood');",
			check: { type: "result" },
			hints: [
				"At least as high as each value of a list.",
				"`>= ALL (subquery)`",
				"WHERE reward_gold >= ALL (SELECT reward_gold FROM quests WHERE region = 'Mistwood')",
			],
			explanation:
				"Mistwood's best reward is 900 (Heart of the Mist itself), so four quests qualify, including Heart of the Mist: `>=` accepts a value equal to itself.",
		},
	],
};

export default chapter;
