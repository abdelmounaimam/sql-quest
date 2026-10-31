### ch22-merge-and-upsert · Merge and Upsert 🔀
- **File** `src/content/chapters/ch22-merge-and-upsert.ts` · **World** The Forge · **Tier** adept · **Track** mutation · **Dataset** `starport`
- **Subtitle** Insert or update in one move, imports you can run twice, and chained writes
- **Concepts** `upsert-on-conflict`, `merge-statement`, `data-modifying-cte`, `bulk-load-copy`
- **Prerequisites** `ch21-the-pact`, `ch13-unions-and-named-spells`
- **Lesson** (10 steps)
  1. explain · The exchange's `price_feed` mixes known and new commodities: INSERT fails on known names (23505), UPDATE ignores new ones.
  2. example · `INSERT INTO commodities (name, base_price, unit) VALUES ('Comet Tea', 19.00, 'crate') ON CONFLICT (name) DO UPDATE SET base_price = EXCLUDED.base_price RETURNING name, base_price;`
  3. explain · Conflict target must match a unique index (42P10 otherwise); DO NOTHING; `EXCLUDED` is the proposed row; qualify the target's columns in expressions (`cargo_stock.qty + EXCLUDED.qty`, else 42702).
  4. quiz · Upserting the raw feed fails with 21000. Why? (Water Ice twice in one statement)
  5. explain · MERGE: `MERGE INTO target USING source ON ... WHEN MATCHED [AND ...] THEN UPDATE / DELETE / DO NOTHING, WHEN NOT MATCHED THEN INSERT, WHEN NOT MATCHED BY SOURCE`; first matching WHEN wins; `RETURNING merge_action()` (PG17), `old.*` / `new.*` (PG18).
  6. example · MERGE a two-row VALUES source (Comet Tea, Moon Cheese) with `RETURNING merge_action(), c.name, c.base_price`.
  7. explain · Data-modifying CTEs: `WITH moved AS (DELETE ... RETURNING *) INSERT INTO archive SELECT * FROM moved;` one statement, one snapshot.
  8. explain · Bulk loading: real servers use `COPY ... FROM` a CSV file (disabled in this sandbox). The pattern stays: raw text into a staging table, inspect, then INSERT ... SELECT with trims and casts; the header and blank lines must be skipped.
  9. example · Split a CSV blob into lines with `string_to_table(body, E'\n')` and fields with `split_part`.
  10. try · Upsert **Comet Tea** at **19.50** (starter is a plain INSERT: 23505).
- **Exercises**

| id | mission | diff | kind | check | concepts | style |
|---|---|---|---|---|---|---|
| ch22-ex01 | One INSERT of Asteroid Honey, Water Ice, Comet Tea that **skips** names already known (DO NOTHING): only Asteroid Honey is added | 2 | mutation | state | upsert-on-conflict | write |
| ch22-ex02 | One upsert: Void Pearls at 2100.00 (exists: only the price changes) and Moon Cheese (new) | 2 | mutation | state | upsert-on-conflict | write |
| ch22-ex03 | Fix the stock upsert `SET qty = qty + EXCLUDED.qty` (42702) on setupSql `cargo_stock`: deliveries add to existing stock, new goods are inserted | 3 | mutation | state | upsert-on-conflict | fix |
| ch22-ex04 | Error mission: upsert the raw `price_feed` with ON CONFLICT DO UPDATE: **21000** | 3 | mutation | error 21000 | upsert-on-conflict | predict |
| ch22-ex05 | Fix the MERGE over the raw feed (21000): MERGE only the **latest quote** per name (update price, insert new with unit crate) | 4 | mutation | state | merge-statement | fix |
| ch22-ex06 | Same MERGE, but update only when the price **changed**, and return `merge_action()`, **name**, **base_price** (4 UPDATE, 1 INSERT) | 4 | mutation | result+state | merge-statement, returning-clause | write |
| ch22-ex07 | Move seizures before 2077-01-01 into setupSql `seizure_archive` in **one statement** (WITH ... DELETE ... RETURNING, INSERT) | 4 | mutation | state | data-modifying-cte | write |
| ch22-ex08 | Staging import: setupSql `cargo_csv(line_no, line)` with a header and 3 lines (one padded with spaces): insert them as commodities, trimmed, price cast to numeric | 3 | mutation | state | bulk-load-copy, insert-select | write |
| ch22-ex09 | **Boss · The Smith's Ledger**: inside BEGIN/COMMIT, MERGE the latest quote per commodity (update only changed prices, insert unknown with unit crate) and log each touched row into setupSql `price_log(name, old_price, new_price, action)` with a data-modifying CTE around `MERGE ... RETURNING merge_action(), old.base_price, new.base_price` | 5 | transaction | state | merge-statement, data-modifying-cte, transactions-basics | write |

- **Practice**: `ch22-pr01` upsert-on-conflict: one upsert of tiers legend (800..1200, exists) and mythic (1201..2000, new); `ch22-pr02` upsert-on-conflict: error mission `ON CONFLICT (unit)` → **42P10**; `ch22-pr03` merge-statement: sync the lanes leaving Terra Nova with an official list (`WHEN NOT MATCHED BY SOURCE AND from_planet_id = 1 THEN DELETE`); `ch22-pr04` merge-statement: fix the WHEN order (unconditional UPDATE before `WHEN MATCHED AND retire THEN DELETE` → 42601); `ch22-pr05` data-modifying-cte: insert pilot Firefly Jones and her ship Firefly in one statement (`WITH new_pilot AS (INSERT ... RETURNING id) INSERT INTO ships ... SELECT ...`); `ch22-pr06` bulk-load-copy: count the staging lines whose price would fail a numeric cast (`pg_input_is_valid`); `ch22-pr07` bulk-load-copy: load routes from a CSV blob with `string_to_table`, skipping the header and the trailing empty line.
- **Negative cases to add**: DO UPDATE where DO NOTHING is asked (ex01), DO NOTHING where an update is needed (ex02), plain INSERT (23505, rejected), `qty = EXCLUDED.qty` (overwrites stock), plain INSERT instead of upsert in ex04 (23505 ≠ 21000), `DISTINCT ON ... quoted_at ASC` / `min(quoted_at)` (keeps the older 12.50), unconditional WHEN MATCHED in ex06 and the boss (logs Nebula Spice 455 → 455), header line imported (22P02), no trim, `ROLLBACK` in the boss. Accept: DISTINCT ON DESC, `max(quoted_at)` join, `IS DISTINCT FROM` vs `<>`, two statements (INSERT ... SELECT then DELETE) for ex07, ON CONFLICT version of ex05 over a deduplicated source.
- **Notes**: COPY is forbidden by the app and the validator: the explain card shows COPY as text only. DISTINCT ON is taught in ch16 (not a prerequisite), so solutions use a correlated `max(quoted_at)` subquery; DISTINCT ON is accepted. Verified: `MERGE ... RETURNING merge_action(), old.base_price, new.base_price` works inside a data-modifying CTE (Water Ice, Quantum Chips, Void Pearls, Comet Tea UPDATE; Asteroid Honey INSERT; old is NULL for the insert). Unique key for every commodity upsert: `commodities.name`.
