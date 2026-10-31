import type { Chapter } from "../types";

const PILOT_CREDITS = "SELECT id, credits FROM pilots ORDER BY id;";
const PRICES = "SELECT id, base_price FROM commodities ORDER BY id;";
const ROUTES_STATE =
	"SELECT from_planet_id, to_planet_id, distance_ly, hazard FROM routes ORDER BY from_planet_id, to_planet_id;";

const chapter: Chapter = {
	id: "ch21-the-pact",
	order: 21,
	world: "The Forge",
	tier: "apprentice",
	track: "mutation",
	title: "The Pact",
	subtitle: "All or nothing: transactions, savepoints and reading constraint errors",
	emoji: "🤝",
	datasetId: "starport",
	concepts: ["transactions-basics", "savepoints", "constraint-errors"],
	prerequisites: ["ch20-reforging-and-banishing"],
	lesson: [
		{
			kind: "explain",
			title: "A pact between statements",
			body: "A credit transfer is **two** UPDATEs: one wallet down, one wallet up. If the power fails between them, credits vanish.\n\nA **transaction** binds them:\n```sql\nBEGIN;\nUPDATE pilots SET credits = credits - 500 WHERE id = 1;\nUPDATE pilots SET credits = credits + 500 WHERE id = 4;\nCOMMIT;\n```\nAll of it happens, or none of it (**atomic**), the rules hold at the end (**consistent**), others never see it half done (**isolated**), and once committed it stays (**durable**).",
		},
		{
			kind: "example",
			title: "Ada pays Dax",
			body: "The admiral lends 500 credits to young Dax. Both wallets change together.",
			sql: "BEGIN;\nUPDATE pilots SET credits = credits - 500 WHERE id = 1;\nUPDATE pilots SET credits = credits + 500 WHERE id = 4;\nCOMMIT;\n\nSELECT id, name, credits FROM pilots WHERE id IN (1, 4);",
		},
		{
			kind: "explain",
			title: "ROLLBACK, and when it is too late",
			body: "`ROLLBACK;` cancels everything since `BEGIN`, as if nothing happened.\n\nWithout BEGIN, Postgres runs in **autocommit**: each statement is its own little transaction, committed the moment it ends. A ROLLBACK afterwards has nothing to undo (it only prints a warning).\n\nSame after COMMIT: committed is final.",
		},
		{
			kind: "quiz",
			question:
				"Inside a BEGIN, the second UPDATE fails with a constraint error. You keep typing more UPDATEs. What happens to them?",
			choices: [
				"They run normally; only the failed statement is lost",
				"They are all refused with 25P02 (transaction aborted) until you ROLLBACK",
				"Postgres commits what succeeded so far and starts a new transaction",
				"They run, but COMMIT will fail at the end",
			],
			answerIndex: 1,
			explanation:
				"After an error the whole transaction is **aborted**: every statement fails with 25P02 *current transaction is aborted* until you ROLLBACK (or ROLLBACK TO a savepoint taken before the error). And a final COMMIT turns into a ROLLBACK.",
		},
		{
			kind: "explain",
			title: "Savepoints: an undo point inside",
			body: "```sql\nBEGIN;\nUPDATE ...;            -- keep this\nSAVEPOINT risky;\nUPDATE ...;            -- maybe not\nROLLBACK TO SAVEPOINT risky;\nCOMMIT;\n```\n`ROLLBACK TO SAVEPOINT` undoes only what came **after** the mark; the transaction stays open. `RELEASE SAVEPOINT` just forgets the mark: it commits nothing. A plain `ROLLBACK` still throws away everything.",
		},
		{
			kind: "example",
			title: "Keep one price, drop the other",
			body: "The first change survives, the second is undone by the savepoint.",
			sql: "BEGIN;\nUPDATE commodities SET base_price = 13.00 WHERE name = 'Water Ice';\nSAVEPOINT before_kelp;\nUPDATE commodities SET base_price = 0.01 WHERE name = 'Space Kelp';\nROLLBACK TO SAVEPOINT before_kelp;\nCOMMIT;\n\nSELECT name, base_price FROM commodities WHERE name IN ('Water Ice', 'Space Kelp');",
		},
		{
			kind: "explain",
			title: "Reading constraint errors",
			body: "Broken rules raise coded errors (SQLSTATE):\n\n| code | rule |\n|---|---|\n| 23502 | NOT NULL |\n| 23503 | foreign key |\n| 23505 | unique |\n| 23514 | CHECK |\n\nRead the **DETAIL** line, it names the culprit: `Key (callsign)=(Nova) already exists.` Note that two NULL callsigns never collide: NULL is not equal to NULL.",
		},
		{
			kind: "quiz",
			question:
				"An INSERT fails with `DETAIL: Key (name)=(Mirage) already exists.` Which SQLSTATE did it raise?",
			choices: ["23502", "23503", "23505", "23514"],
			answerIndex: 2,
			explanation:
				"*Already exists* is a unique violation, 23505. A foreign key error (23503) says *is not present in table* or *is still referenced*.",
		},
		{
			kind: "try",
			title: "Your turn: a safe transfer",
			prompt:
				"Inside **BEGIN** / **COMMIT**, move **300** credits from **Kree-7** (pilot 10) to **Tiko** (pilot 19).",
			starterSql: "BEGIN;\nUPDATE pilots SET credits = credits - 300 WHERE id = 10;\nCOMMIT;",
			solutionSql:
				"BEGIN;\nUPDATE pilots SET credits = credits - 300 WHERE id = 10;\nUPDATE pilots SET credits = credits + 300 WHERE id = 19;\nCOMMIT;",
			check: { type: "state", verifySql: PILOT_CREDITS },
			hints: [
				"The starter takes the credits but never gives them.",
				"Add the UPDATE for pilot 19 before the COMMIT.",
			],
		},
	],
	exercises: [
		{
			id: "ch21-ex01",
			title: "Vera's gift",
			story:
				"Captain Vera Lux sponsors young Yuki Hoshino. The bank only accepts transfers sealed in a pact.",
			prompt:
				"Inside **BEGIN** / **COMMIT**, move **1000** credits from **Vera Lux** (pilot 21) to **Yuki Hoshino** (pilot 24).",
			difficulty: 1,
			kind: "transaction",
			concepts: ["transactions-basics"],
			solutionSql:
				"BEGIN;\nUPDATE pilots SET credits = credits - 1000 WHERE id = 21;\nUPDATE pilots SET credits = credits + 1000 WHERE id = 24;\nCOMMIT;",
			check: { type: "state", verifySql: PILOT_CREDITS },
			hints: [
				"Two UPDATEs between BEGIN and COMMIT.",
				"One subtracts from pilot 21, the other adds to pilot 24.",
				"BEGIN; UPDATE pilots SET credits = credits - 1000 WHERE id = 21; UPDATE ... + 1000 WHERE id = 24; COMMIT;",
			],
			explanation:
				"Between BEGIN and COMMIT the two UPDATEs form one unit: no observer can ever see the credits in flight, and a crash in the middle loses nothing.\n\n**Pitfall:** two separate autocommit UPDATEs give the same result on a good day, and a missing 1000 credits on a bad one.",
		},
		{
			id: "ch21-ex02",
			title: "The test that was not a test",
			story:
				"A clerk wanted to *see what happens* if the hazardous lanes were closed. He ran the DELETE, then ROLLBACK to undo it, then opened a new lane. The Harbor Master now finds seven lanes missing.",
			prompt:
				"Fix the script so the **test DELETE is undone** and the new lane **9 → 3** (5.5 ly, hazard `ion storm`) is opened. In the end every original route still exists, plus the new one.",
			difficulty: 2,
			kind: "transaction",
			concepts: ["transactions-basics"],
			starterSql:
				"DELETE FROM routes WHERE hazard IS NOT NULL;\nROLLBACK;\nINSERT INTO routes (from_planet_id, to_planet_id, distance_ly, hazard)\nVALUES (9, 3, 5.5, 'ion storm');",
			solutionSql:
				"BEGIN;\nDELETE FROM routes WHERE hazard IS NOT NULL;\nROLLBACK;\nINSERT INTO routes (from_planet_id, to_planet_id, distance_ly, hazard)\nVALUES (9, 3, 5.5, 'ion storm');",
			check: { type: "state", verifySql: ROUTES_STATE },
			hints: [
				"What does ROLLBACK undo when no transaction was started?",
				"Without BEGIN, the DELETE committed on its own the moment it finished.",
				"Start with BEGIN; so the ROLLBACK has something to cancel.",
			],
			explanation:
				"With `BEGIN` first, the DELETE lives inside a transaction and ROLLBACK erases it. The INSERT then runs in autocommit and stays.\n\n**Pitfall:** believing ROLLBACK is an undo button. In autocommit mode every statement is committed immediately; ROLLBACK just warns *there is no transaction in progress*.",
		},
		{
			id: "ch21-ex03",
			title: "Jax cannot pay",
			story:
				"Jax O'Hara owes the docks 50 credits. His wallet holds exactly 0.00, and the bank's rule says `credits >= 0`.",
			prompt:
				"Write the UPDATE that takes **50** credits from **Jax O'Hara** (pilot 9). It must **fail**: run it and read the error code.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["constraint-errors"],
			solutionSql: "UPDATE pilots SET credits = credits - 50 WHERE id = 9;",
			check: { type: "error", sqlstate: "23514" },
			hints: [
				"A normal UPDATE that subtracts 50.",
				"The table has a CHECK on credits.",
				"UPDATE pilots SET credits = credits - 50 WHERE id = 9;",
			],
			explanation:
				"23514 is a **check violation**: -50.00 breaks `credits >= 0`, and the message names the constraint `pilots_credits_check`. The row keeps 0.00.\n\n**Pitfall:** retrying the same statement, or dropping the CHECK to \"make it work\". The data is telling you a business rule: Jax needs a loan, not a negative wallet.",
		},
		{
			id: "ch21-ex04",
			title: "Two Mirages?",
			story:
				"A surveyor insists he found a second planet called Mirage. The registers disagree.",
			prompt:
				"Write the INSERT that registers a planet named **Mirage** in sector **Outer Rim**. It must **fail**: run it and read the error code.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["constraint-errors"],
			solutionSql: "INSERT INTO planets (name, sector) VALUES ('Mirage', 'Outer Rim');",
			check: { type: "error", sqlstate: "23505" },
			hints: [
				"A normal INSERT.",
				"`planets.name` is UNIQUE.",
				"INSERT INTO planets (name, sector) VALUES ('Mirage', 'Outer Rim');",
			],
			explanation:
				"23505 is a **unique violation**; DETAIL says `Key (name)=(Mirage) already exists.` Note the sequence still handed out an id for the failed row: one more gap.\n\n**Pitfall:** reading only the message. The DETAIL line tells you *which* key collided, which matters on tables with several unique columns.",
		},
		{
			id: "ch21-ex05",
			title: "A typo in the price list",
			story:
				"The quartermaster updates two prices. Halfway through, he notices he typed 99.99 for Void Pearls instead of 1999.99.",
			prompt:
				"In **one transaction**: set **Water Ice**'s base_price to **13.00**, take a savepoint named **before_pearls**, set **Void Pearls** to **99.99**, roll back **to the savepoint**, then **COMMIT**. Water Ice keeps its new price, Void Pearls its old one.",
			difficulty: 3,
			kind: "transaction",
			concepts: ["savepoints"],
			solutionSql:
				"BEGIN;\nUPDATE commodities SET base_price = 13.00 WHERE name = 'Water Ice';\nSAVEPOINT before_pearls;\nUPDATE commodities SET base_price = 99.99 WHERE name = 'Void Pearls';\nROLLBACK TO SAVEPOINT before_pearls;\nCOMMIT;",
			check: { type: "state", verifySql: PRICES },
			hints: [
				"Six statements: BEGIN, UPDATE, SAVEPOINT, UPDATE, ROLLBACK TO, COMMIT.",
				"`ROLLBACK TO SAVEPOINT before_pearls` undoes only the Void Pearls change.",
				"... SAVEPOINT before_pearls; UPDATE ... 'Void Pearls'; ROLLBACK TO SAVEPOINT before_pearls; COMMIT;",
			],
			explanation:
				"The savepoint splits the transaction: rolling back to it erases the typo while keeping the Water Ice change, which COMMIT then makes permanent.\n\n**Pitfall:** a plain `ROLLBACK` throws away the whole transaction, Water Ice included.",
		},
		{
			id: "ch21-ex06",
			title: "RELEASE is not COMMIT",
			story:
				"Customs fines two smugglers 100 reputation each. The clerk thought `RELEASE SAVEPOINT` saved his work, ended with ROLLBACK to tidy up, and both fines evaporated.",
			prompt:
				"Fix the script so that **both** fines stick: Nox (pilot 13) and Sable Ironwood (pilot 18) each lose **100** reputation.",
			difficulty: 3,
			kind: "transaction",
			concepts: ["savepoints", "transactions-basics"],
			starterSql:
				"BEGIN;\nUPDATE pilots SET reputation = reputation - 100 WHERE id = 13;\nSAVEPOINT second_fine;\nUPDATE pilots SET reputation = reputation - 100 WHERE id = 18;\nRELEASE SAVEPOINT second_fine;\nROLLBACK;",
			solutionSql:
				"BEGIN;\nUPDATE pilots SET reputation = reputation - 100 WHERE id = 13;\nSAVEPOINT second_fine;\nUPDATE pilots SET reputation = reputation - 100 WHERE id = 18;\nRELEASE SAVEPOINT second_fine;\nCOMMIT;",
			check: { type: "state", verifySql: "SELECT id, reputation FROM pilots ORDER BY id;" },
			hints: [
				"Which statement actually ends the transaction, and how?",
				"RELEASE only forgets the savepoint. The final ROLLBACK cancels everything since BEGIN.",
				"End with COMMIT instead of ROLLBACK.",
			],
			explanation:
				"`RELEASE SAVEPOINT` removes the mark; the changes stay *pending* until the transaction ends. COMMIT makes both fines permanent.\n\n**Pitfall:** thinking a released savepoint is saved for good. Only COMMIT persists anything; a ROLLBACK afterwards still wipes released work.",
		},
		{
			id: "ch21-ex07",
			title: "Nested savepoints",
			story:
				"The bank replays Ada Quasar's busiest day (she starts with 98000.00 credits).",
			prompt:
				"Ada's day was this script:\n```sql\nBEGIN;\nUPDATE pilots SET credits = credits + 100 WHERE id = 1;\nSAVEPOINT a;\nUPDATE pilots SET credits = credits + 200 WHERE id = 1;\nSAVEPOINT b;\nUPDATE pilots SET credits = credits + 400 WHERE id = 1;\nROLLBACK TO SAVEPOINT a;\nUPDATE pilots SET credits = credits + 800 WHERE id = 1;\nCOMMIT;\n```\n**Return** one value: Ada's **credits** at the end of the day. Predict first, then run the script followed by a SELECT to check.",
			difficulty: 3,
			kind: "transaction",
			concepts: ["savepoints"],
			solutionSql:
				"BEGIN;\nUPDATE pilots SET credits = credits + 100 WHERE id = 1;\nSAVEPOINT a;\nUPDATE pilots SET credits = credits + 200 WHERE id = 1;\nSAVEPOINT b;\nUPDATE pilots SET credits = credits + 400 WHERE id = 1;\nROLLBACK TO SAVEPOINT a;\nUPDATE pilots SET credits = credits + 800 WHERE id = 1;\nCOMMIT;\nSELECT credits FROM pilots WHERE id = 1;",
			check: { type: "result" },
			hints: [
				"Which updates came after savepoint `a`?",
				"Rolling back to `a` undoes the +200 and the +400 (and forgets savepoint `b`, which was taken after it).",
				"98000 + 100 + 800",
			],
			explanation:
				"98900.00: ROLLBACK TO `a` erases everything after `a`, including the later savepoint `b` and its +400, then the +800 lands and COMMIT keeps it.\n\n**Pitfall:** thinking ROLLBACK TO only undoes the last step. It rewinds to the named mark, however many statements and savepoints came after it.",
		},
		{
			id: "ch21-ex08",
			title: "Boss: The Cargo Pact",
			story:
				"Bram Kettle buys a hold full of Space Kelp. His mentor Grimble takes a commission, and the dock chief offers a loyalty refund... until Customs vetoes it. One pact, or the trade never happened.",
			prompt:
				"In **one transaction**:\n\n1. Record the trade: ship **2** **buy**s **300** units of commodity **11** on planet **5** at **8.50** each, at **2078-01-15 09:00 UTC**.\n2. Bram (pilot **2**) pays for it: **2550.00** credits.\n3. Take a savepoint **commission**, then Bram pays Grimble (pilot **7**) a commission of **51.00** credits.\n4. Take a savepoint **refund**, then give Bram a refund of **255.00** credits.\n5. Customs vetoes the refund: roll back to the savepoint **refund**.\n6. **COMMIT**.",
			difficulty: 5,
			kind: "transaction",
			concepts: ["transactions-basics", "savepoints", "insert-basic"],
			solutionSql:
				"BEGIN;\nINSERT INTO trades (ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at)\nVALUES (2, 5, 11, 'buy', 300, 8.50, '2078-01-15 09:00:00+00');\nUPDATE pilots SET credits = credits - 2550.00 WHERE id = 2;\nSAVEPOINT commission;\nUPDATE pilots SET credits = credits - 51.00 WHERE id = 2;\nUPDATE pilots SET credits = credits + 51.00 WHERE id = 7;\nSAVEPOINT refund;\nUPDATE pilots SET credits = credits + 255.00 WHERE id = 2;\nROLLBACK TO SAVEPOINT refund;\nCOMMIT;",
			check: {
				type: "state",
				verifySql:
					"SELECT 'pilot' AS kind, id, credits::text AS detail FROM pilots\nUNION ALL\nSELECT 'trade', id, concat_ws(',', ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at) FROM trades\nORDER BY 1, 2;",
			},
			hints: [
				"Write it step by step: BEGIN, INSERT, UPDATE, SAVEPOINT, two UPDATEs, SAVEPOINT, UPDATE, ROLLBACK TO, COMMIT.",
				"The commission is a transfer: one UPDATE for Bram, one for Grimble. The refund only touches Bram.",
				"Step 5 is `ROLLBACK TO SAVEPOINT refund;`, not a plain ROLLBACK.",
			],
			explanation:
				"The trade (id 41), the payment and the commission survive: Bram ends at 9899.50, Grimble at 27801.00. Only the refund, after the last savepoint, is undone.\n\n**Pitfall:** a plain `ROLLBACK` at step 5 wipes the whole pact, trade included; `ROLLBACK TO SAVEPOINT commission` would also cancel Grimble's fee.",
			boss: true,
		},
	],
	practice: [
		{
			id: "ch21-pr01",
			title: "Lanes in a pact",
			prompt:
				"Inside **BEGIN** / **COMMIT**, open the lanes **11 → 2** and **2 → 11**, both **3.9** light years, no hazard.",
			difficulty: 1,
			kind: "transaction",
			concepts: ["transactions-basics"],
			solutionSql:
				"BEGIN;\nINSERT INTO routes (from_planet_id, to_planet_id, distance_ly) VALUES (11, 2, 3.9);\nINSERT INTO routes (from_planet_id, to_planet_id, distance_ly) VALUES (2, 11, 3.9);\nCOMMIT;",
			check: { type: "state", verifySql: ROUTES_STATE },
			hints: [
				"BEGIN, two INSERTs, COMMIT.",
				"Each lane is one row of routes.",
				"INSERT INTO routes (from_planet_id, to_planet_id, distance_ly) VALUES (11, 2, 3.9);",
			],
			explanation:
				"A lane open in only one direction would strand ships, so both inserts belong to one pact.\n\n**Pitfall:** ending with ROLLBACK by habit: nothing would be opened.",
		},
		{
			id: "ch21-pr02",
			title: "The payroll that never paid",
			story: "The cadets complain: the clerk's payroll script ran without error, yet nobody got paid.",
			prompt:
				"Fix the script so every **cadet** really gets **50** credits (a NULL balance stays NULL).",
			difficulty: 1,
			kind: "transaction",
			concepts: ["transactions-basics"],
			starterSql:
				"BEGIN;\nUPDATE pilots SET credits = credits + 50 WHERE rank = 'cadet';\nROLLBACK;",
			solutionSql:
				"BEGIN;\nUPDATE pilots SET credits = credits + 50 WHERE rank = 'cadet';\nCOMMIT;",
			check: { type: "state", verifySql: PILOT_CREDITS },
			hints: [
				"Look at the last line of the script.",
				"ROLLBACK cancels the transaction.",
				"End with COMMIT.",
			],
			explanation:
				"COMMIT makes the payroll permanent; ROLLBACK discarded it.\n\n**Pitfall:** \"no error\" does not mean \"saved\". Always look at how the transaction ends.",
		},
		{
			id: "ch21-pr03",
			title: "Back to the first mark",
			prompt:
				"In **one transaction**: set **Medical Gel** to **220.00**; savepoint **one**; set **Robot Parts** to **99.00**; savepoint **two**; set **Synth Silk** to **270.00**; roll back to savepoint **one**; COMMIT.",
			difficulty: 2,
			kind: "transaction",
			concepts: ["savepoints"],
			solutionSql:
				"BEGIN;\nUPDATE commodities SET base_price = 220.00 WHERE name = 'Medical Gel';\nSAVEPOINT one;\nUPDATE commodities SET base_price = 99.00 WHERE name = 'Robot Parts';\nSAVEPOINT two;\nUPDATE commodities SET base_price = 270.00 WHERE name = 'Synth Silk';\nROLLBACK TO SAVEPOINT one;\nCOMMIT;",
			check: { type: "state", verifySql: PRICES },
			hints: [
				"Follow the steps literally.",
				"Rolling back to `one` also cancels everything after `two`.",
				"ROLLBACK TO SAVEPOINT one; COMMIT;",
			],
			explanation:
				"Only Medical Gel changes: everything after savepoint `one`, savepoint `two` included, is rewound.\n\n**Pitfall:** `ROLLBACK TO SAVEPOINT two` would keep Robot Parts at 99.00.",
		},
		{
			id: "ch21-pr04",
			title: "A ship with no hold",
			prompt:
				"Write the INSERT that registers a ship **Paper Moon** with cargo capacity **0**. It must **fail**: read the error code.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["constraint-errors"],
			solutionSql: "INSERT INTO ships (name, cargo_capacity) VALUES ('Paper Moon', 0);",
			check: { type: "error", sqlstate: "23514" },
			hints: [
				"A normal INSERT with two columns.",
				"ships has CHECK (cargo_capacity > 0).",
				"INSERT INTO ships (name, cargo_capacity) VALUES ('Paper Moon', 0);",
			],
			explanation:
				"23514: the CHECK `cargo_capacity > 0` refuses a hold of size zero. NULL would pass: a CHECK only rejects FALSE, not unknown.\n\n**Pitfall:** confusing 23514 (a rule on the value) with 23502 (a missing value).",
		},
		{
			id: "ch21-pr05",
			title: "A pilot from nowhere in time",
			prompt:
				"Write the INSERT that registers pilot **Nemo**, a **Human** **cadet**, without giving `joined_at`. It must **fail**: read the error code.",
			difficulty: 1,
			kind: "mutation",
			concepts: ["constraint-errors"],
			solutionSql: "INSERT INTO pilots (name, species, rank) VALUES ('Nemo', 'Human', 'cadet');",
			check: { type: "error", sqlstate: "23502" },
			hints: [
				"Leave joined_at out of the column list.",
				"joined_at is NOT NULL and has no default.",
				"INSERT INTO pilots (name, species, rank) VALUES ('Nemo', 'Human', 'cadet');",
			],
			explanation:
				"23502 is a **not-null violation**: leaving out a NOT NULL column without a default stores NULL, which is refused.\n\n**Pitfall:** \"fixing\" it with a fake date. Ask for the real one.",
		},
		{
			id: "ch21-pr06",
			title: "The phantom ship",
			prompt:
				"Write the INSERT that records a trade for ship **99** (it does not exist): planet 1, commodity 1, side buy, qty 1, unit price 1.00, at 2078-01-01 00:00 UTC. It must **fail**: read the error code.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["constraint-errors"],
			solutionSql:
				"INSERT INTO trades (ship_id, planet_id, commodity_id, side, qty, unit_price, traded_at)\nVALUES (99, 1, 1, 'buy', 1, 1.00, '2078-01-01 00:00:00+00');",
			check: { type: "error", sqlstate: "23503" },
			hints: [
				"A normal INSERT with seven columns.",
				"trades.ship_id references ships(id).",
				"VALUES (99, 1, 1, 'buy', 1, 1.00, '2078-01-01 00:00:00+00')",
			],
			explanation:
				"23503: `Key (ship_id)=(99) is not present in table \"ships\"`. Foreign keys refuse rows pointing at nothing.\n\n**Pitfall:** creating a fake ship 99 to silence the error. Fix the id instead.",
		},
		{
			id: "ch21-pr07",
			title: "Two Novas",
			prompt:
				"Write the INSERT that registers pilot **Nova Jr**, a **Human** **cadet** joined at **2078-01-01 00:00 UTC**, with callsign **Nova**. It must **fail**: read the error code.",
			difficulty: 2,
			kind: "mutation",
			concepts: ["constraint-errors"],
			solutionSql:
				"INSERT INTO pilots (name, species, rank, callsign, joined_at)\nVALUES ('Nova Jr', 'Human', 'cadet', 'Nova', '2078-01-01 00:00:00+00');",
			check: { type: "error", sqlstate: "23505" },
			hints: [
				"A normal INSERT with five columns.",
				"callsign is UNIQUE and Ada already flies as Nova.",
				"VALUES ('Nova Jr', 'Human', 'cadet', 'Nova', '2078-01-01 00:00:00+00')",
			],
			explanation:
				"23505: `Key (callsign)=(Nova) already exists.` A NULL callsign would have been fine: Dax, Lumen and Umbra-3 already share NULL callsigns.\n\n**Pitfall:** `'nova'` in lower case is a different text and would pass the unique check.",
		},
	],
};

export default chapter;
