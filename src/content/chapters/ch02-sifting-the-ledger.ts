import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch02-sifting-the-ledger",
	order: 2,
	world: "The Starport Docks",
	tier: "novice",
	track: "query",
	title: "Sifting the Ledger",
	subtitle: "WHERE, AND/OR, IN, BETWEEN and LIKE: keep only the rows you need",
	emoji: "🔎",
	datasetId: "starport",
	concepts: ["where-comparison", "boolean-logic", "in-and-between", "like-ilike"],
	prerequisites: ["ch01-hello-table"],
	lesson: [
		{
			kind: "explain",
			title: "Keep only some rows",
			body: "**WHERE** comes after FROM and keeps only the rows where a condition is **true**.\n\n```sql\nSELECT name, credits\nFROM pilots\nWHERE credits > 40000;\n```\n\nComparison operators: `=` `<>` (or `!=`) `<` `<=` `>` `>=`. There is no `==` in SQL.",
		},
		{
			kind: "example",
			title: "The wealthy few",
			body: "Run it: only pilots with more than 40,000 credits survive the filter.",
			sql: "SELECT name, credits\nFROM pilots\nWHERE credits > 40000;",
		},
		{
			kind: "explain",
			title: "Comparing text",
			body: "Text values go in **single quotes**, and the comparison is exact, case included:\n\n```sql\nWHERE rank = 'captain'   -- matches\nWHERE rank = 'Captain'   -- matches nothing here\nWHERE rank = \"captain\"   -- error: that's a column name!\n```",
		},
		{
			kind: "explain",
			title: "AND, OR, NOT",
			body: "Combine conditions:\n- `a AND b`: both must be true.\n- `a OR b`: at least one.\n- `NOT a`: the opposite.\n\n**AND binds tighter than OR**, like × before + in math. `a OR b AND c` means `a OR (b AND c)`. When you mix them, add parentheses.",
		},
		{
			kind: "quiz",
			question:
				"Which query finds Synth **or** Vulpine pilots that have a **positive** reputation?",
			choices: [
				"WHERE species = 'Synth' OR species = 'Vulpine' AND reputation > 0",
				"WHERE (species = 'Synth' OR species = 'Vulpine') AND reputation > 0",
				"WHERE species = 'Synth' OR 'Vulpine' AND reputation > 0",
				"WHERE species = 'Synth' AND species = 'Vulpine' AND reputation > 0",
			],
			answerIndex: 1,
			explanation:
				"Without parentheses, AND is evaluated first, so the first query keeps *every* Synth. The third is an error (`'Vulpine'` is not a condition) and the fourth asks for a pilot of two species at once.",
		},
		{
			kind: "example",
			title: "Shortcuts: IN and BETWEEN",
			body: "`IN (...)` matches any value of a list. `BETWEEN low AND high` includes **both** ends.",
			sql: "SELECT name, category, base_price\nFROM commodities\nWHERE category IN ('fuel', 'tech')\n  AND base_price BETWEEN 90 AND 900;",
		},
		{
			kind: "explain",
			title: "Patterns with LIKE",
			body: "`LIKE` matches text patterns:\n- `%` = any number of characters (even zero)\n- `_` = exactly one character\n\n```sql\nWHERE name LIKE 'S%'     -- starts with S\nWHERE name LIKE '%ship%' -- contains ship\n```\n\n`LIKE` is case sensitive. `ILIKE` ignores case. To match a real `%` or `_`, escape it: `'%\\_%'`.",
		},
		{
			kind: "example",
			title: "Ships with an apostrophe",
			body: "`''` inside quotes is one apostrophe, so `'%''%'` means *contains an apostrophe*.",
			sql: "SELECT name\nFROM ships\nWHERE name LIKE '%''%';",
		},
		{
			kind: "try",
			title: "Your turn: the zero-credit club",
			prompt:
				"Return the **name** of every pilot whose credits are exactly **0**.",
			starterSql: "SELECT name\nFROM pilots\nWHERE ",
			solutionSql: "SELECT name FROM pilots WHERE credits = 0;",
			check: { type: "result" },
			hints: ["Compare the credits column with a number.", "WHERE credits = 0"],
		},
	],
	exercises: [
		{
			id: "ch02-ex01",
			title: "Heavy haulers",
			story:
				"A mining colony needs a ship that can carry at least 500 units of ore.",
			prompt:
				"Return the **name** and **cargo_capacity** of every ship with a cargo capacity of **500 or more**.",
			difficulty: 1,
			kind: "query",
			concepts: ["where-comparison"],
			starterSql: "SELECT name, cargo_capacity\nFROM ships\nWHERE ",
			solutionSql:
				"SELECT name, cargo_capacity FROM ships WHERE cargo_capacity >= 500;",
			check: { type: "result" },
			hints: [
				"\"500 or more\" includes 500 itself.",
				"Use the >= operator.",
				"WHERE cargo_capacity >= 500",
			],
			explanation:
				"`>=` keeps the Sentinels (exactly 500) as well as the bigger haulers. With `>` you would lose three ships.\n\n**Note:** the Ghost Ship has no known capacity: a comparison with an unknown value is never true, so it is filtered out. More about that in *The Void*.",
		},
		{
			id: "ch02-ex02",
			title: "Captains, report!",
			story: "The Admiralty is calling a meeting of every captain.",
			prompt: "Return the **name** of every pilot whose rank is **captain**.",
			difficulty: 1,
			kind: "query",
			concepts: ["where-comparison"],
			solutionSql: "SELECT name FROM pilots WHERE rank = 'captain';",
			check: { type: "result" },
			hints: [
				"Filter on the rank column.",
				"Text values go in single quotes; ranks are stored in lower case.",
				"WHERE rank = 'captain'",
			],
			explanation:
				"Text comparison with `=` is exact. `'Captain'` with a capital C would return nothing, and `\"captain\"` would look for a column.",
		},
		{
			id: "ch02-ex03",
			title: "Kepler's Rest",
			story:
				"A courier needs the details of Kepler's Rest, but the clerk's query keeps exploding.",
			prompt:
				"Return the **sector** and **population** of the planet named **Kepler's Rest**.",
			difficulty: 2,
			kind: "query",
			concepts: ["where-comparison"],
			starterSql:
				"SELECT sector, population\nFROM planets\nWHERE name = 'Kepler's Rest';",
			solutionSql:
				"SELECT sector, population FROM planets WHERE name = 'Kepler''s Rest';",
			check: { type: "result" },
			hints: [
				"The apostrophe in the name closes the text too early.",
				"Inside single quotes, an apostrophe is written twice.",
				"'Kepler''s Rest'",
			],
			explanation:
				"`''` inside a text value stands for one apostrophe. The starter ends the string after `Kepler` and Postgres sees garbage after it.",
		},
		{
			id: "ch02-ex04",
			title: "Human captains",
			prompt:
				"Return the **name** of every pilot who is a **captain** and whose species is **Human**.",
			difficulty: 2,
			kind: "query",
			concepts: ["boolean-logic", "where-comparison"],
			solutionSql:
				"SELECT name FROM pilots WHERE rank = 'captain' AND species = 'Human';",
			check: { type: "result" },
			hints: [
				"Two conditions must both be true.",
				"Join them with AND.",
				"WHERE rank = 'captain' AND species = ...",
			],
			explanation:
				"`AND` keeps a row only when both conditions hold. Grimble Tusk is a captain but a Zorblax, so he is out.",
		},
		{
			id: "ch02-ex05",
			title: "The precedence trap",
			story:
				"Security asked for Synth or Vulpine pilots with a positive reputation. The report includes two Synths with a reputation of exactly 0. Something is off.",
			prompt:
				"Fix the query: return the **name** of every pilot whose species is **Synth or Vulpine** and whose reputation is **greater than 0**.",
			difficulty: 2,
			kind: "query",
			concepts: ["boolean-logic"],
			starterSql:
				"SELECT name\nFROM pilots\nWHERE species = 'Synth' OR species = 'Vulpine' AND reputation > 0;",
			solutionSql:
				"SELECT name FROM pilots WHERE (species = 'Synth' OR species = 'Vulpine') AND reputation > 0;",
			check: { type: "result" },
			hints: [
				"Which operator does Postgres evaluate first, AND or OR?",
				"AND binds tighter, so the reputation test only applies to Vulpines.",
				"Wrap the two species tests in parentheses.",
			],
			explanation:
				"`a OR b AND c` is read as `a OR (b AND c)`: every Synth slipped through. Parentheses force the OR first.\n\n**Alternative:** `WHERE species IN ('Synth', 'Vulpine') AND reputation > 0` avoids the trap entirely.",
		},
		{
			id: "ch02-ex06",
			title: "Fuel and tech",
			prompt:
				"Return the **name** and **category** of every commodity whose category is **fuel** or **tech**.",
			difficulty: 2,
			kind: "query",
			concepts: ["in-and-between"],
			solutionSql:
				"SELECT name, category FROM commodities WHERE category IN ('fuel', 'tech');",
			check: { type: "result" },
			hints: [
				"You could write two conditions with OR... or use a list.",
				"`column IN ('a', 'b')` matches any value in the list.",
				"WHERE category IN ('fuel', 'tech')",
			],
			explanation:
				"`IN` is shorthand for a chain of `=` joined by `OR`. Each value is quoted separately: `IN ('fuel, tech')` would look for one single (weird) category.",
		},
		{
			id: "ch02-ex07",
			title: "Mid-sized deals",
			prompt:
				"Return the **id** and **qty** of every trade whose quantity is between **20 and 50, both included**.",
			difficulty: 2,
			kind: "query",
			concepts: ["in-and-between"],
			solutionSql: "SELECT id, qty FROM trades WHERE qty BETWEEN 20 AND 50;",
			check: { type: "result" },
			hints: [
				"Both ends count.",
				"BETWEEN low AND high includes both bounds.",
				"WHERE qty BETWEEN 20 AND 50",
			],
			explanation:
				"`BETWEEN 20 AND 50` is exactly `qty >= 20 AND qty <= 50`.\n\n**Pitfalls:** the low bound must come first (`BETWEEN 50 AND 20` returns nothing), and with timestamps BETWEEN includes the very first instant of the next day, so `>= ... AND < ...` is safer there.",
		},
		{
			id: "ch02-ex08",
			title: "L is for Launch",
			prompt: "Return the **name** of every ship whose name starts with a capital **L**.",
			difficulty: 2,
			kind: "query",
			concepts: ["like-ilike"],
			solutionSql: "SELECT name FROM ships WHERE name LIKE 'L%';",
			check: { type: "result" },
			hints: [
				"You need a pattern, not an exact match.",
				"`%` stands for any number of characters.",
				"WHERE name LIKE 'L%'",
			],
			explanation:
				"`'L%'` = an L followed by anything. Without the `%`, LIKE behaves like `=` and matches only a ship called exactly *L*.",
		},
		{
			id: "ch02-ex09",
			title: "Boss: The Customs Sweep",
			story:
				"Customs is raiding the yard tonight. They want every ship that is either a worn-out model they distrust, or registered by someone fond of apostrophes (they find it suspicious).",
			prompt:
				"Return the **name**, **model** and **hull_integrity** of every ship that matches **at least one** of these rules:\n\n1. its model is **Viper X**, **Gambit 3** or **Hauler 9**, **and** its hull integrity is between **10 and 60** (both included);\n2. its name contains an **apostrophe** (`'`).",
			difficulty: 4,
			kind: "query",
			concepts: ["boolean-logic", "in-and-between", "like-ilike", "where-comparison"],
			solutionSql:
				"SELECT name, model, hull_integrity\nFROM ships\nWHERE (model IN ('Viper X', 'Gambit 3', 'Hauler 9') AND hull_integrity BETWEEN 10 AND 60)\n   OR name LIKE '%''%';",
			check: { type: "result" },
			hints: [
				"Write rule 1 and rule 2 separately, then join them. Which operator joins \"at least one\"?",
				"Rule 1 is an IN plus a BETWEEN joined by AND. Rule 2 is a LIKE with a doubled apostrophe.",
				"WHERE (model IN (...) AND hull_integrity BETWEEN 10 AND 60) OR name LIKE '%''%'",
			],
			explanation:
				"Two rules joined by `OR`, the first one built with `AND`. Parentheses are not strictly needed (AND binds tighter) but they make the intent obvious.\n\n**Pitfall:** `(model IN ... OR name LIKE ...) AND hull_integrity BETWEEN 10 AND 60` applies the hull test to rule 2 as well and loses Halo's Edge, Pike's Peak and Raven's Claw.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch02-pr01",
			title: "Bargain bin",
			prompt:
				"Return the **name** and **base_price** of every commodity cheaper than **20** credits.",
			difficulty: 1,
			kind: "query",
			concepts: ["where-comparison"],
			solutionSql:
				"SELECT name, base_price FROM commodities WHERE base_price < 20;",
			check: { type: "result" },
			hints: [
				"\"Cheaper than\" is a strict comparison.",
				"Use < on base_price.",
				"WHERE base_price < 20",
			],
			explanation:
				"`<` excludes 20 itself. Star Charts has no price at all (NULL), so it never passes a comparison.",
		},
		{
			id: "ch02-pr02",
			title: "No cadets allowed",
			prompt: "Return the **name** and **rank** of every pilot who is **not** a cadet.",
			difficulty: 1,
			kind: "query",
			concepts: ["where-comparison"],
			solutionSql: "SELECT name, rank FROM pilots WHERE rank <> 'cadet';",
			check: { type: "result" },
			hints: [
				"You need \"not equal\".",
				"SQL writes it <> (or !=).",
				"WHERE rank <> 'cadet'",
			],
			explanation: "`<>` and `!=` mean the same thing. `NOT rank = 'cadet'` works too.",
		},
		{
			id: "ch02-pr03",
			title: "Rising stars or troublemakers",
			prompt:
				"Return the **name** of every pilot who is a **lieutenant** or whose reputation is **below 0**.",
			difficulty: 2,
			kind: "query",
			concepts: ["boolean-logic"],
			solutionSql:
				"SELECT name FROM pilots WHERE rank = 'lieutenant' OR reputation < 0;",
			check: { type: "result" },
			hints: [
				"At least one of the two conditions must hold.",
				"That is OR.",
				"WHERE rank = 'lieutenant' OR reputation < 0",
			],
			explanation:
				"`OR` keeps a row when either side is true. A lieutenant with a negative reputation (Nox) appears once, not twice.",
		},
		{
			id: "ch02-pr04",
			title: "Not by the crate",
			prompt:
				"Return the **name** of every commodity that is **legal** and **not** sold by the `crate` (its `unit` is something else).",
			difficulty: 2,
			kind: "query",
			concepts: ["boolean-logic"],
			solutionSql:
				"SELECT name FROM commodities WHERE legal AND NOT unit = 'crate';",
			check: { type: "result" },
			hints: [
				"`legal` is a boolean column: it can be used as a condition by itself.",
				"Combine it with a negated unit test.",
				"WHERE legal AND NOT unit = 'crate'",
			],
			explanation:
				"A boolean column is already a condition: `WHERE legal` means `WHERE legal = true`. `NOT unit = 'crate'` and `unit <> 'crate'` are equivalent.",
		},
		{
			id: "ch02-pr05",
			title: "The golden age of discovery",
			prompt:
				"Return the **name** and **discovered_on** of every planet discovered from **2050-01-01** to **2069-12-31**, both days included.",
			difficulty: 2,
			kind: "query",
			concepts: ["in-and-between"],
			solutionSql:
				"SELECT name, discovered_on FROM planets WHERE discovered_on BETWEEN '2050-01-01' AND '2069-12-31';",
			check: { type: "result" },
			hints: [
				"Dates are written as text in ISO format: 'YYYY-MM-DD'.",
				"BETWEEN works on dates too and includes both ends.",
				"WHERE discovered_on BETWEEN '2050-01-01' AND '2069-12-31'",
			],
			explanation:
				"`discovered_on` is a `date`, so BETWEEN with two ISO dates is safe here. Mirage, discovered on a leap day in 2068, is in.",
		},
		{
			id: "ch02-pr06",
			title: "Four-letter callsigns",
			prompt:
				"Return the **callsign** of every pilot whose callsign is **exactly 4 characters** long.",
			difficulty: 3,
			kind: "query",
			concepts: ["like-ilike"],
			solutionSql: "SELECT callsign FROM pilots WHERE callsign LIKE '____';",
			check: { type: "result" },
			hints: [
				"One LIKE wildcard matches exactly one character.",
				"`_` is that wildcard. How many do you need?",
				"WHERE callsign LIKE '____'",
			],
			explanation:
				"Four underscores = exactly four characters, no more, no less. (`length(callsign) = 4` works too: string functions arrive in World 2.)",
		},
		{
			id: "ch02-pr07",
			title: "The underscore suspect",
			story: "Intel says a smuggler uses a callsign with an underscore in it.",
			prompt:
				"Return the **name** and **callsign** of every pilot whose callsign contains an underscore (`_`).",
			difficulty: 3,
			kind: "query",
			concepts: ["like-ilike"],
			starterSql: "SELECT name, callsign\nFROM pilots\nWHERE callsign LIKE '%_%';",
			solutionSql:
				"SELECT name, callsign FROM pilots WHERE callsign LIKE '%\\_%';",
			check: { type: "result" },
			hints: [
				"Run the starter: why does it return every callsign?",
				"`_` is a wildcard. A backslash before it makes it a plain underscore.",
				"LIKE '%\\_%'",
			],
			explanation:
				"In a LIKE pattern `_` means *any character*, so `'%_%'` matches any non-empty text. `\\_` (or a custom `ESCAPE` character) turns it back into a real underscore.",
		},
		{
			id: "ch02-pr08",
			title: "Zzz",
			story: "Radio static garbled a callsign. All the operator heard was a buzzing \"z\".",
			prompt:
				"Return the **callsign** of every pilot whose callsign contains the letter **z**, in upper or lower case.",
			difficulty: 2,
			kind: "query",
			concepts: ["like-ilike"],
			solutionSql: "SELECT callsign FROM pilots WHERE callsign ILIKE '%z%';",
			check: { type: "result" },
			hints: [
				"The z may be anywhere, and may be Z or z.",
				"LIKE is case sensitive; its sibling is not.",
				"WHERE callsign ILIKE '%z%'",
			],
			explanation:
				"`ILIKE` ignores case, so it finds *fizz*, *Zed* and *zigzag*. With `LIKE '%z%'` you would miss *Zed*.",
		},
	],
};

export default chapter;
