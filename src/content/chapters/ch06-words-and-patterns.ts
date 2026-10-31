import type { Chapter } from "../types";

const chapter: Chapter = {
	id: "ch06-words-and-patterns",
	order: 6,
	world: "The Counting House",
	tier: "apprentice",
	track: "query",
	title: "Words and Patterns",
	subtitle: "Slice, glue and scrub text, then let regular expressions do the heavy lifting",
	emoji: "🔤",
	datasetId: "starport",
	concepts: ["string-functions", "regex-matching", "data-cleaning"],
	prerequisites: ["ch05-shaping-columns"],
	lesson: [
		{
			kind: "explain",
			title: "The text toolbox",
			body: "The accountants hate messy labels. Postgres ships a full kit:\n\n- `upper(s)`, `lower(s)`, `initcap(s)`: change case;\n- `length(s)`: number of characters;\n- `trim(s)`: remove spaces at both ends;\n- `left(s, n)`, `right(s, n)`: the first or last n characters.\n\nPositions in SQL text **start at 1**, not 0.",
		},
		{
			kind: "example",
			title: "Shouting planets",
			body: "`length` counts **characters**. Look at Éclat: 5 characters, but `octet_length` says 6 bytes, because É takes two bytes in UTF-8.",
			sql: "SELECT name, upper(name), length(name),\n       octet_length(name), left(name, 3)\nFROM planets;",
		},
		{
			kind: "explain",
			title: "Gluing text together",
			body: "`||` concatenates: `'Ada' || ' ' || 'Quasar'`.\n\nBut one NULL piece makes the **whole result NULL**: `'a' || NULL` is NULL.\n\n`concat(a, b, ...)` treats NULL as empty text, and `concat_ws(sep, a, b, ...)` puts a separator between the pieces and **skips** NULLs entirely:\n\n```sql\nconcat_ws(' / ', 'Starling', NULL, 'Bay 7')\n-- Starling / Bay 7\n```",
		},
		{
			kind: "quiz",
			question:
				"Dax Morrow has no callsign (NULL). What does `SELECT 'Pilot ' || callsign FROM pilots WHERE name = 'Dax Morrow';` return?",
			choices: ["'Pilot '", "NULL", "'Pilot NULL'", "An error"],
			answerIndex: 1,
			explanation:
				"`||` follows the NULL rule of every operator: one unknown piece makes the result unknown. `concat('Pilot ', callsign)` would give `'Pilot '`.",
		},
		{
			kind: "explain",
			title: "Cutting text apart",
			body: "```sql\nsplit_part('a;b;c', ';', 2)        -- b\nsubstring('Starport' from 2 for 3)  -- tar\nposition('port' in 'Starport')      -- 5\nreplace('water-ice', '-', ' ')      -- water ice\n```\n\n`split_part` numbers its pieces from 1 (0 is an error). `position` returns 0 when the text is not found.",
		},
		{
			kind: "example",
			title: "Manifest parts",
			body: "Dock workers type `commodity;quantity unit`. `split_part` cuts on the `;`. Notice line 8 (empty text gives empty parts), line 12 (NULL stays NULL) and the stray spaces everywhere.",
			sql: "SELECT id, raw,\n       split_part(raw, ';', 1) AS item,\n       split_part(raw, ';', 2) AS amount\nFROM manifest_lines;",
		},
		{
			kind: "explain",
			title: "Regular expressions",
			body: "`s ~ 'pattern'` tests a regex (case sensitive), `~*` ignores case, `!~` negates.\n\nA regex matches **anywhere** in the text unless you anchor it: `^` = start, `$` = end. `[0-9]` = one digit, `+` = one or more, `\\s` = a space.\n\n```sql\nregexp_replace(s, '\\s+', ' ', 'g')  -- 'g' = every match\nsubstring(s from '[0-9]+')          -- first match\n```",
		},
		{
			kind: "example",
			title: "Squeezing spaces",
			body: "Every run of spaces becomes one space. Compare line 13 (`Plasma  Cells`, two spaces) before and after. Without the `'g'` flag, only the **first** run would be replaced.",
			sql: "SELECT id, raw,\n       regexp_replace(raw, '\\s+', ' ', 'g') AS squeezed\nFROM manifest_lines;",
		},
		{
			kind: "try",
			title: "Your turn: shout the callsigns",
			prompt:
				"Return the **name** and the **callsign in upper case** of every pilot who **has** a callsign.",
			starterSql: "SELECT name, callsign\nFROM pilots\nWHERE callsign IS NOT NULL;",
			solutionSql: "SELECT name, upper(callsign) FROM pilots WHERE callsign IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"The filter is already right. Change the second column.",
				"upper(callsign)",
			],
		},
	],
	exercises: [
		{
			id: "ch06-ex01",
			title: "Long names",
			story: "The sign painter charges by the letter and wants the longest ship names first.",
			prompt:
				"Return the **name** of every ship and its **length in characters**, longest first. Ties are broken by **name A to Z**.",
			difficulty: 1,
			kind: "query",
			concepts: ["string-functions"],
			solutionSql: "SELECT name, length(name) AS letters FROM ships ORDER BY length(name) DESC, name;",
			check: { type: "result", orderMatters: true },
			hints: [
				"There is a function that counts characters.",
				"Sort by that length, descending, then by name.",
				"ORDER BY length(name) DESC, name",
			],
			explanation:
				"`length` counts characters, so *Belle Étoile* has 12 like four other ships, and the name breaks the tie.\n\n**Pitfall:** `octet_length` counts bytes: É takes two, and Belle Étoile would jump ahead with 13. **Alternative:** `ORDER BY 2 DESC, 1` or `char_length(name)`.",
		},
		{
			id: "ch06-ex02",
			title: "Radio labels",
			story:
				"The radio board shows `Ada Quasar (Nova)` for each pilot. Three lines of the board are blank, and the pilots without a callsign are furious.",
			prompt:
				"Fix the query: return the **name** of every pilot and a **label**: the name followed by the callsign in parentheses (`Ada Quasar (Nova)`), or **just the name** when the pilot has no callsign.",
			difficulty: 2,
			kind: "query",
			concepts: ["string-functions", "coalesce-nullif"],
			starterSql: "SELECT name, name || ' (' || callsign || ')' AS label\nFROM pilots;",
			solutionSql:
				"SELECT name, name || COALESCE(' (' || callsign || ')', '') AS label FROM pilots;",
			check: { type: "result" },
			hints: [
				"Run the starter: who gets a NULL label, and why?",
				"`||` with a NULL gives NULL. The part `' (' || callsign || ')'` is NULL exactly when the callsign is. Give that part a fallback.",
				"name || COALESCE(' (' || callsign || ')', '')",
			],
			explanation:
				"When the callsign is NULL, the whole bracket part is NULL, and COALESCE swaps it for empty text. The name is never NULL, so the label is safe.\n\n**Pitfall:** `concat(name, ' (', callsign, ')')` survives the NULL but prints `Dax Morrow ()`. **Alternative:** `concat(name, ' (' || callsign || ')')` (concat ignores the NULL part) or a CASE on `callsign IS NULL`.",
		},
		{
			id: "ch06-ex03",
			title: "Three-letter codes",
			story: "The cargo scanners only read three capital letters per commodity.",
			prompt:
				"Return the **name** of every commodity and its **code**: the first **3 characters** of the name, in **upper case** (`Water Ice` gives `WAT`).",
			difficulty: 1,
			kind: "query",
			concepts: ["string-functions"],
			solutionSql: "SELECT name, upper(left(name, 3)) AS code FROM commodities;",
			check: { type: "result" },
			hints: [
				"Two steps: cut, then change the case (the order does not matter).",
				"`left(s, n)` gives the first n characters.",
				"upper(left(name, 3))",
			],
			explanation:
				"Functions nest: `left` cuts three characters and `upper` shouts them.\n\n**Pitfall:** `substring(name from 0 for 3)` counts from a position 0 that does not exist and returns only **2** characters (`Wa`): SQL text starts at position 1. **Alternative:** `substr(upper(name), 1, 3)`.",
		},
		{
			id: "ch06-ex04",
			title: "What is in the hold?",
			story: "Before cleaning anything, the clerk wants to see the raw commodity part of each manifest line.",
			prompt:
				"Return the **id** of every manifest line and the **text before the first `;`** of its raw value, untouched (spaces included). Skip the lines whose raw value is **NULL**; keep the empty one.",
			difficulty: 2,
			kind: "query",
			concepts: ["string-functions"],
			solutionSql:
				"SELECT id, split_part(raw, ';', 1) AS item FROM manifest_lines WHERE raw IS NOT NULL;",
			check: { type: "result" },
			hints: [
				"One function cuts a text on a separator and returns the piece you ask for.",
				"`split_part(text, separator, n)` numbers the pieces from 1.",
				"split_part(raw, ';', 1) ... WHERE raw IS NOT NULL",
			],
			explanation:
				"`split_part(raw, ';', 1)` returns everything before the first `;`, or the whole text when there is none. The empty line gives an empty piece.\n\n**Pitfall:** `split_part(raw, ';', 0)` is an error (22023): pieces start at 1. **Alternative:** `substring(raw from '^[^;]*')`, a regex meaning *every non-; character from the start*.",
		},
		{
			id: "ch06-ex05",
			title: "Numbered pilots",
			story: "Synths often carry a serial number in their name. The Census Bureau wants them all.",
			prompt: "Return the **name** of every pilot whose name **contains a digit**.",
			difficulty: 2,
			kind: "query",
			concepts: ["regex-matching"],
			solutionSql: "SELECT name FROM pilots WHERE name ~ '[0-9]';",
			check: { type: "result" },
			hints: [
				"LIKE has no wildcard for *a digit*. Regular expressions do.",
				"`[0-9]` matches one digit, anywhere in the text when unanchored.",
				"WHERE name ~ '[0-9]'",
			],
			explanation:
				"`~` searches the regex anywhere in the text, so one digit is enough: Kree-7 and Umbra-3.\n\n**Pitfall:** `name LIKE '%[0-9]%'` is SQL Server syntax: in Postgres the brackets are plain characters and nothing matches. **Alternative:** `name ~ '\\d'` (`\\d` = a digit).",
		},
		{
			id: "ch06-ex06",
			title: "Quiet callsigns",
			story:
				"The comms officer wants callsigns made **only** of lower-case letters (they are easier to whisper). The current query lets in Nova, Halo, and even `shadow_99`.",
			prompt:
				"Fix the query: return every **callsign** made **only** of lower-case letters `a` to `z`, from its first to its last character.",
			difficulty: 3,
			kind: "query",
			concepts: ["regex-matching"],
			starterSql: "SELECT callsign\nFROM pilots\nWHERE callsign ~ '[a-z]+';",
			solutionSql: "SELECT callsign FROM pilots WHERE callsign ~ '^[a-z]+$';",
			check: { type: "result" },
			hints: [
				"Run the starter: `Nova` matches because `ova` is somewhere inside it.",
				"A regex matches anywhere unless anchored. `^` pins the start, `$` pins the end.",
				"WHERE callsign ~ '^[a-z]+$'",
			],
			explanation:
				"With `^` and `$`, the whole callsign has to be lower-case letters, not just a piece of it: viper, fizz, ace, pipsqueak, zigzag, tiko.\n\n**Pitfall:** `~*` ignores case, so `~* '^[a-z]+$'` lets Nova back in. **Alternative:** `callsign !~ '[^a-z]'` (no character outside a to z) gives the same rows here.",
		},
		{
			id: "ch06-ex07",
			title: "Fish out the number",
			story: "The quartermaster wants the quantity of every manifest line as a real number, whatever junk surrounds it.",
			prompt:
				"Return the **id** of every manifest line and the **first number** found in its raw value, as an **integer**. Lines without any number (or without raw text) get NULL.",
			difficulty: 3,
			kind: "query",
			concepts: ["regex-matching", "type-casting"],
			starterSql: "SELECT id, split_part(raw, ';', 2)::int AS qty\nFROM manifest_lines;",
			solutionSql: "SELECT id, substring(raw from '[0-9]+')::int AS qty FROM manifest_lines;",
			check: { type: "result" },
			hints: [
				"Run the starter: `' 300 t '` is not an integer, and one bad row kills the whole query (22P02).",
				"`substring(text from 'regex')` returns the first match, or NULL. `[0-9]+` is a run of digits.",
				"substring(raw from '[0-9]+')::int",
			],
			explanation:
				"The regex keeps only the digits, so the cast always gets clean input, and lines with no digits give NULL, which casts to NULL without complaint.\n\n**Pitfall:** `[0-9]` without `+` grabs a single digit (300 becomes 3). Casting the whole raw piece fails on the first messy line. **Alternative:** `(regexp_match(raw, '[0-9]+'))[1]::int`.",
		},
		{
			id: "ch06-ex08",
			title: "One spelling per commodity",
			story:
				"`  WATER ICE `, `water-ice` and `water ice` are the same thing. The accountants need one spelling.",
			prompt:
				"For every manifest line whose raw value is **neither NULL nor empty**, return the **id** and the **clean commodity**: the part before the first `;`, with every `-` replaced by a space, runs of spaces collapsed into **one** space, spaces **trimmed** at both ends, and everything in **lower case** (`water ice`, `plasma cells`).",
			difficulty: 3,
			kind: "query",
			concepts: ["data-cleaning"],
			solutionSql:
				"SELECT id,\n       lower(trim(regexp_replace(replace(split_part(raw, ';', 1), '-', ' '), '\\s+', ' ', 'g'))) AS commodity\nFROM manifest_lines\nWHERE raw <> '';",
			check: { type: "result" },
			hints: [
				"Look at the raw values first (the lesson example helps). Then apply one fix at a time and run after each.",
				"split_part, then replace for the dash, regexp_replace with 'g' for the spaces, then trim and lower. `raw <> ''` also drops NULL (NULL is never different from anything).",
				"lower(trim(regexp_replace(replace(split_part(raw, ';', 1), '-', ' '), '\\s+', ' ', 'g')))",
			],
			explanation:
				"Cleaning is a pipeline of small, testable steps; nesting functions applies them from the inside out. `WHERE raw <> ''` drops both the empty line and the NULL one, because a comparison with NULL is never true.\n\n**Pitfall:** skipping the collapse leaves `plasma  cells` (two spaces) different from `plasma cells`, and skipping `trim` leaves a trailing space on `synth silk `. **Alternative:** `WHERE NULLIF(raw, '') IS NOT NULL`.",
		},
		{
			id: "ch06-ex09",
			title: "Boss: The Manifest Cleanup",
			story:
				"Audit day. The Counting House wants a clean table out of the dock workers' scribbles, and customs wants to know which crates are fragile.",
			prompt:
				"For every manifest line whose raw value is **neither NULL nor empty**, return four columns:\n\n1. **id**;\n2. **commodity**, cleaned exactly as in the previous mission;\n3. **qty**: the first number of the raw value as an **integer**, NULL when there is none;\n4. **fragile**: a **boolean**, true when the raw value mentions `fragile` in **any case**.",
			difficulty: 5,
			kind: "query",
			concepts: ["data-cleaning", "regex-matching", "string-functions", "type-casting"],
			solutionSql:
				"SELECT id,\n       lower(trim(regexp_replace(replace(split_part(raw, ';', 1), '-', ' '), '\\s+', ' ', 'g'))) AS commodity,\n       substring(raw from '[0-9]+')::int AS qty,\n       raw ~* 'fragile' AS fragile\nFROM manifest_lines\nWHERE raw <> '';",
			check: { type: "result" },
			hints: [
				"Reuse your cleaning expression, then add the two new columns one at a time.",
				"The quantity is the regex extraction from *Fish out the number*. A condition such as `raw ~* 'x'` can be a column: it returns true or false.",
				"substring(raw from '[0-9]+')::int ... raw ~* 'fragile' AS fragile",
			],
			explanation:
				"Four independent expressions on one filtered set of rows. A comparison or regex test in the SELECT list returns a boolean, so `raw ~* 'fragile'` is the fragile column itself. Line 7 (`n/a`) keeps a NULL quantity instead of crashing the query.\n\n**Pitfall:** `raw ~ 'fragile'` is case sensitive and misses `FRAGILE`; casting `split_part(raw, ';', 2)` directly fails with 22P02. **Alternative:** `raw ILIKE '%fragile%'` for the flag.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch06-pr01",
			title: "Capital categories",
			prompt:
				"Return the **name** of every commodity and its **category with a capital first letter** (`essentials` gives `Essentials`). An unknown category stays NULL.",
			difficulty: 1,
			kind: "query",
			concepts: ["string-functions"],
			solutionSql: "SELECT name, initcap(category) AS category FROM commodities;",
			check: { type: "result" },
			hints: [
				"There is a function that capitalises the first letter of each word.",
				"Its name is a contraction of *initial capital*.",
				"initcap(category)",
			],
			explanation:
				"`initcap` upper-cases the first letter of each word and lower-cases the rest. Like most functions it returns NULL for a NULL input (Comet Tea).",
		},
		{
			id: "ch06-pr02",
			title: "Name and model",
			prompt:
				"Return, for every ship, **one column**: its name and its model separated by ` / ` (`Starling / Courier Mk II`). A ship with **no model** shows **just its name**.",
			difficulty: 2,
			kind: "query",
			concepts: ["string-functions"],
			solutionSql: "SELECT concat_ws(' / ', name, model) AS label FROM ships;",
			check: { type: "result" },
			hints: [
				"`name || ' / ' || model` is NULL for the Ghost Ship.",
				"One function takes a separator first and skips NULL pieces.",
				"concat_ws(' / ', name, model)",
			],
			explanation:
				"`concat_ws` puts the separator only between non-NULL pieces, so the Ghost Ship shows `Ghost Ship` with no dangling slash.\n\n**Pitfall:** `concat(name, ' / ', model)` gives `Ghost Ship / `.",
		},
		{
			id: "ch06-pr03",
			title: "Where is the space?",
			prompt:
				"Return the **name** of every planet whose name **contains a space**, and the **position** of that first space (counting from 1).",
			difficulty: 2,
			kind: "query",
			concepts: ["string-functions"],
			solutionSql:
				"SELECT name, position(' ' in name) AS pos FROM planets WHERE position(' ' in name) > 0;",
			check: { type: "result" },
			hints: [
				"One function returns where a piece of text appears, or 0 when it does not.",
				"`position(' ' in name)`; keep the rows where it is not 0.",
				"WHERE position(' ' in name) > 0",
			],
			explanation:
				"`position` counts from 1 and returns 0 when nothing is found, so `> 0` keeps the two-word names. **Alternative:** `strpos(name, ' ')`, or filter with `name LIKE '% %'`.",
		},
		{
			id: "ch06-pr04",
			title: "Quiet first letters",
			prompt: "Return every **callsign** that **starts with** a lower-case letter `a` to `z`.",
			difficulty: 2,
			kind: "query",
			concepts: ["regex-matching"],
			solutionSql: "SELECT callsign FROM pilots WHERE callsign ~ '^[a-z]';",
			check: { type: "result" },
			hints: [
				"You need *a lower-case letter* and *at the start*.",
				"`^` anchors a regex to the start of the text.",
				"WHERE callsign ~ '^[a-z]'",
			],
			explanation:
				"`^[a-z]` = a lower-case letter in first position: viper, fizz, ace, shadow_99, pipsqueak, zigzag, tiko.\n\n**Pitfall:** without `^`, any callsign with a lower-case letter anywhere matches, so Nova and Halo sneak in. **Alternative:** `callsign LIKE` cannot express a letter range, but `left(callsign, 1) BETWEEN 'a' AND 'z'` works in the C collation.",
		},
		{
			id: "ch06-pr05",
			title: "Plasma anywhere",
			prompt:
				"Return the **id** and **raw** value of every manifest line that mentions **plasma**, in **any case**.",
			difficulty: 1,
			kind: "query",
			concepts: ["regex-matching"],
			solutionSql: "SELECT id, raw FROM manifest_lines WHERE raw ~* 'plasma';",
			check: { type: "result" },
			hints: [
				"`~` is case sensitive. Its sibling is not.",
				"Add a star: `~*`.",
				"WHERE raw ~* 'plasma'",
			],
			explanation:
				"`~*` ignores case, so it finds `plasma cells` and `Plasma  Cells`. **Alternative:** `raw ILIKE '%plasma%'`.",
		},
		{
			id: "ch06-pr06",
			title: "Unreadable quantities",
			story: "Before casting anything, find the lines that would break the cast.",
			prompt:
				"Return the **id** of every manifest line whose quantity **cannot be read**: the raw value is NULL, or it has no `;` followed (after optional spaces) by a digit.",
			difficulty: 3,
			kind: "query",
			concepts: ["data-cleaning"],
			solutionSql: "SELECT id FROM manifest_lines WHERE raw IS NULL OR raw !~ ';\\s*[0-9]';",
			check: { type: "result" },
			hints: [
				"`!~` keeps the rows that do **not** match a regex.",
				"`;\\s*[0-9]` = a semicolon, any spaces, a digit. And NULL never satisfies `!~`: test it separately.",
				"WHERE raw IS NULL OR raw !~ ';\\s*[0-9]'",
			],
			explanation:
				"Finding the bad rows first is the cleaning reflex: lines 7 (`n/a`), 8 (empty) and 12 (NULL).\n\n**Pitfall:** without `raw IS NULL`, line 12 disappears, because `NULL !~ ...` is NULL, not true.",
		},
		{
			id: "ch06-pr07",
			title: "Empty means unknown",
			prompt:
				"Return the **id** of every manifest line and its raw value **trimmed**, where a value that is **empty after trimming** becomes **NULL**.",
			difficulty: 2,
			kind: "query",
			concepts: ["data-cleaning"],
			solutionSql: "SELECT id, NULLIF(trim(raw), '') AS raw FROM manifest_lines;",
			check: { type: "result" },
			hints: [
				"Two steps: trim, then turn `''` into NULL.",
				"NULLIF(a, b) returns NULL when a equals b.",
				"NULLIF(trim(raw), '')",
			],
			explanation:
				"`trim` first, so a line of pure spaces would also become `''` and then NULL. Empty text and NULL now mean the same thing: *nothing was typed*.",
		},
		{
			id: "ch06-pr08",
			title: "Ship slugs",
			story: "The new docking app wants web-friendly ship names.",
			prompt:
				"Return the **name** of every ship and its **slug**: the name in **lower case** with **every** space replaced by `-` (`Ace of Wings` gives `ace-of-wings`). Use `regexp_replace`.",
			difficulty: 2,
			kind: "query",
			concepts: ["regex-matching"],
			starterSql: "SELECT name, regexp_replace(lower(name), ' ', '-') AS slug\nFROM ships;",
			solutionSql: "SELECT name, regexp_replace(lower(name), ' ', '-', 'g') AS slug FROM ships;",
			check: { type: "result" },
			hints: [
				"Run the starter and look at Ace of Wings.",
				"regexp_replace only replaces the first match unless told otherwise.",
				"Add the 'g' flag as a fourth argument.",
			],
			explanation:
				"The `'g'` (global) flag replaces every match, not just the first: `ace-of wings` becomes `ace-of-wings`.\n\n**Alternative:** plain `replace(lower(name), ' ', '-')` always replaces every occurrence.",
		},
	],
};

export default chapter;
