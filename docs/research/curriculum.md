# SQL Quest: authoritative curriculum

Target engine: PostgreSQL 18.6 running in PGlite 0.5.13 (WASM, single user), plus `@electric-sql/pglite-pgvector` 0.0.14.
Audience: absolute beginner to master. Consumers: the level designer (chapters, exercises, bosses) and the adaptive engine (prerequisites, mistakes, hints).
Research date: 2026-10-31. Every feasibility claim marked "verified" was executed against the installed PGlite build (scripts in the session scratchpad, results summarised in Appendix A).

Legend used throughout:

* **Tier**: `novice` < `apprentice` < `adept` < `expert` < `master`.
* **Track**: `query`, `mutation`, `schema`, `types`, `performance`, `advanced`.
* **Feasibility**: `R` runnable as is · `RC` runnable with a caveat (stated) · `C` conceptual only (teach with narrative, diagrams, scripted replays, predict-the-output).

---

## 1. Sources consulted

| Source | What was taken from it |
|---|---|
| Beaulieu, *Learning SQL*, 3rd ed. (O'Reilly 2020) | Canonical beginner order: query primer → filtering → multi-table → sets → data generation/conversion functions → grouping → subqueries → joins revisited → conditional logic → transactions → indexes/constraints → views → metadata → analytic functions → large databases. Basis for Worlds 1 to 4. (O'Reilly listing; page blocked, TOC from publisher description and known edition structure) |
| DeBarros, *Practical SQL*, 2nd ed. (No Starch 2022), [nostarch.com](https://nostarch.com/practical-sql-2nd-edition) | Learner creates a table in chapter 2 (ownership of data early), data types before math, import/export, stats functions, dates chapter, "inspecting and modifying data" (cleaning), text mining + FTS, JSON chapter, views/functions/triggers, maintenance (VACUUM). Story-driven real datasets. Basis for `data-cleaning`, `statistical-aggregates`, `bulk-load-copy`. |
| Fontaine, *The Art of PostgreSQL* (2nd ed.), [contents](https://theartofpostgresql.com/book/contents/) | "Order By, Limit, No Offset", dedicated chapters on NULLs and on window functions, data types as denormalization tools, normalization + modelization antipatterns, isolation/locking, computing and caching in SQL, triggers, LISTEN/NOTIFY, extensions (hstore audit, trigrams for typos, intarray tags, pgvector). Philosophy: business logic belongs in SQL, think in sets. |
| Obe & Hsu, *PostgreSQL: Up and Running*, 3rd ed. (O'Reilly 2017) | PostgreSQL-specific feature map: data types chapter (arrays, ranges, JSON, xml, FTS), tables/constraints/indexes, "PostgreSQL-specific SQL" (DISTINCT ON, LATERAL, FILTER, RETURNING, upsert), writing functions, performance tuning (EXPLAIN). Catalog record only; chapter list from library record. |
| Karwin, *SQL Antipatterns* vol. 1 (Pragmatic 2022), [pragprog.com](https://pragprog.com/titles/bksap1/sql-antipatterns-volume-1/) | 24 antipatterns in 4 groups (logical design, physical design, query, application). Each maps to a fix-the-design or refactor exercise: Jaywalking, Naive Trees, ID Required, Keyless Entry, EAV, Polymorphic Associations, Multicolumn Attributes, Metadata Tribbles, Rounding Errors, 31 Flavors, Phantom Files, Index Shotgun, Fear of the Unknown (NULL), Ambiguous Groups, Random Selection, Poor Man's Search Engine, Spaghetti Query, Implicit Columns, Readable Passwords, SQL Injection, Pseudokey Neat-Freak, See No Evil, Diplomatic Immunity, Standard Operating Procedures. |
| Winand, *SQL Performance Explained* / [use-the-index-luke.com](https://use-the-index-luke.com/sql/table-of-contents) | Performance sequence: anatomy of an index → WHERE (equality, concatenated keys, functions, bind variables, ranges, LIKE, partial indexes, obfuscated conditions) → joins (nested loop, hash, merge) → clustering / index-only scans → indexed ORDER BY / GROUP BY → top-N and "fetching the next page" (keyset) → DML cost. Myth directory ("SELECT * is bad", "most selective first"). Basis for World 10. |
| Hernandez, *Database Design for Mere Mortals*, 4th ed. (Pearson 2020) | Design process before DDL: mission/objectives, analyse existing data, establish table structures, keys, field specifications, relationships, business rules, views, review integrity. Basis for `er-modeling`, `relationship-cardinality`, the "Blueprints" chapter. |
| Celko, *SQL for Smarties*, 5th ed. (Morgan Kaufmann 2014) | Advanced idioms: NULLs and three-valued logic, temporal data, trees and hierarchies (nested sets, adjacency list), graphs, relational division, auxiliary tables (sequence, calendar), regions/runs/gaps, OLAP aggregation. Basis for `relational-division`, `gaps-and-islands`, `time-series-gap-fill`, `hierarchy-models`. |
| Schönig, *Mastering PostgreSQL* 15/17 (Packt) | Expert order: transactions & locking first (prerequisite to storage), indexes (types, operator classes), advanced SQL (grouping sets, ordered-set & hypothetical aggregates, windows), stats views, optimizing queries, stored procedures, security (roles, RLS). |
| PostgreSQL 18 docs: [Tutorial](https://www.postgresql.org/docs/current/tutorial.html), ch. 7 Queries, ch. 8 Data Types, ch. 9 Functions and Operators, ch. 5 DDL, ch. 6 DML, ch. 11 Indexes, ch. 13 Concurrency Control (MVCC), ch. 12 Full Text Search, ch. 14 Performance Tips | Reference for syntax and semantics; tutorial order (create table → populate → query → joins → aggregates → update → delete → views → FKs → transactions → windows). Full list of types and operators used in the types track. |
| [PostgreSQL 18 release notes](https://www.postgresql.org/about/news/postgresql-18-released-3142/) | New teachable features: virtual generated columns (now default), `OLD`/`NEW` in RETURNING, `uuidv7()`, temporal `WITHOUT OVERLAPS` / `PERIOD` constraints, B-tree skip scan, `casefold()`, `pg_unicode_fast`, EXPLAIN ANALYZE shows buffers by default. PG17: `JSON_TABLE`, SQL/JSON query functions, MERGE `RETURNING` and `WHEN NOT MATCHED BY SOURCE`. |
| [PostgreSQL wiki: Don't Do This](https://wiki.postgresql.org/wiki/Don't_Do_This) | Rules turned into "cursed scroll" exercises: no NOT IN, no BETWEEN on timestamps, no upper-case identifiers, no timestamp without tz, no char(n), no varchar(n) by default, no money, no serial, no rules, no table inheritance. |
| [pgvector README](https://github.com/pgvector/pgvector) | vector/halfvec/bit/sparsevec, operators `<-> <#> <=> <+> <~> <%>`, HNSW (m, ef_construction, ef_search) vs IVFFlat (lists, probes), opclasses per metric, iterative scans, filtering returns fewer rows, index used only with ORDER BY distance ASC + LIMIT, hybrid search with FTS (RRF). |
| [SQLBolt](https://sqlbolt.com/) | One concept per lesson + immediate in-browser exercise; order: SELECT → constraints (WHERE) → filtering/sorting → review → joins → outer joins → NULLs → expressions → aggregates → **order of execution** lesson → insert/update/delete → create/alter/drop. |
| [pgexercises.com](https://pgexercises.com/) | One single small dataset (members/facilities/bookings with self-referencing `recommendedby`) reused for every exercise; categories Basic → Joins & Subqueries → Modifying data → Aggregates → Date → String → Recursive. Note: site runs C locale, sort order surprises. |
| [Select Star SQL](https://selectstarsql.com/) | Mental-model-first, one real dataset across a story; progression single rows → whole-table aggregates → grouped aggregates → joins; ~30 min chapters. |
| Mode (now ThoughtSpot) SQL tutorial | 4 tracks: Basic (15 lessons), Intermediate (20), Advanced (9: data types, dates, data wrangling, subqueries, windows, performance tuning, pivoting), Analytics training (8 case studies). Confirms analytics patterns as a capstone layer. |
| LeetCode Top SQL 50 / HackerRank SQL (category structure; pages blocked to fetch, structure from public study plans) | What interview practice drills: Select, Basic Joins, Basic Aggregates, Sorting & Grouping, Advanced Select & Joins, Subqueries, Advanced String/Regex. Classic problems: second highest salary (NULL handling), department top-3 (top-N per group), consecutive numbers (gaps & islands), rising temperature (self-join/LAG on dates), customers who never order (anti-join), delete duplicate emails (dedup). |
| Taipalus, Siponen, Vartiainen 2018, "Errors and Complications in SQL Query Formulation", ACM TOCE 18(3) (33,000+ student queries) | Error classes: syntax, semantic, logical, complications. Recurring logical errors: AND vs OR, joining on unrelated columns, oversimplified queries. Feeds the hint engine's error classifier. |
| Miedema, Aivaloglou, Fletcher 2021, "Identifying SQL Misconceptions of Novices" (ICER, think-aloud) | Misconception sources: prior course knowledge, generalization, language (English meaning of keywords), incomplete mental model. Informs "predict-the-output" and the order-of-execution lesson. |
| Ahadi, Prior, Behbood, Lister 2016; "So many brackets!" (OU Netherlands) | Most semantic errors cluster on GROUP BY/aggregates, joins and nested subqueries; complexity (nesting) drives errors → scaffold nested queries via CTEs and named steps. |

---

## 2. Concept catalog

Prerequisites reference ids. "Mistakes" are the 1 to 3 most common learner errors, written so they can be matched by the hint engine (SQLSTATE in parentheses when the mistake raises one; logical mistakes have no error and must be detected by result diffing).

### 2.1 Query: foundations

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `relational-model` | Tables, rows, columns | A table is an unordered set of rows with typed, named columns; every query returns a table | none | novice | R | Assumes rows have a stable built-in order · treats a table like a spreadsheet with cell positions |
| `sql-statement-anatomy` | Statement anatomy | Clauses, keywords (case-insensitive), whitespace, `;`, `--` and `/* */` comments | relational-model | novice | R | Missing `;` between statements · smart quotes pasted from a doc · keyword typo (42601 `syntax error at or near "selec"`) |
| `select-columns` | SELECT ... FROM | Project chosen columns of one table; list order = output order | sql-statement-anatomy | novice | R | Trailing comma before FROM (42601) · missing comma silently turns the next word into an alias (`SELECT name gold` gives a column called gold containing names) · misspelled column (42703) |
| `select-star` | SELECT * and implicit columns | `*` expands to all columns; fine to explore, fragile in code (Karwin: Implicit Columns) | select-columns | novice | R | `INSERT ... SELECT *` breaking after a schema change · believing `*` is always slow (Winand myth) |
| `quotes-and-identifiers` | '...' vs "..." | Single quotes = values, double quotes = identifiers; unquoted identifiers fold to lower case | select-columns | novice | R | `WHERE name = "Aria"` (42703 column "Aria" does not exist) · created `"Hero"` then queried `hero` (42P01) · escaping `'` as `\'` instead of `''` |
| `column-aliases` | Column aliases | `expr AS alias`; double-quote aliases with spaces | select-columns | novice | R | Alias used in WHERE (42703) · single-quoted alias `'Total'` (42601) |
| `arithmetic-expressions` | Computed columns | `+ - * / % ^`, precedence, integer division | column-aliases | novice | R | `7/2 = 3` integer division · missing parentheses `(a+b)*c` · expects `^` to be XOR |
| `where-comparison` | WHERE comparisons | Filter rows with `= <> != < <= > >=` | select-columns | novice | R | `==` (42883 operator does not exist) · text compared without quotes (42703) · numbers stored as text compare lexically (`'10' < '9'`) |
| `boolean-logic` | AND, OR, NOT | Combine predicates; AND binds tighter than OR | where-comparison | novice | R | `a OR b AND c` precedence · AND where OR is needed (Taipalus) · `class = 'mage' OR 'rogue'` (42804 argument of OR must be boolean) |
| `in-and-between` | IN lists, BETWEEN | Membership, inclusive ranges | boolean-logic | novice | R | BETWEEN with reversed bounds returns nothing · BETWEEN on timestamps double-counts the end (Don't Do This) · `IN ('a, b')` as one string |
| `null-basics` | NULL, IS NULL | NULL = unknown/missing; test with `IS [NOT] NULL` | where-comparison | novice | R | `= NULL` returns no rows · NULL treated as 0 or `''` · expects `'' IS NULL` to be true |
| `three-valued-logic` | Three-valued logic | Predicates yield TRUE/FALSE/UNKNOWN; WHERE keeps TRUE only; NULL propagates | null-basics, boolean-logic | apprentice | R (verified truth table) | Expects `x <> 'mage'` to keep NULL rows · `NULL OR TRUE` thought NULL (it is TRUE) · `NOT (x = 1)` expected to include NULLs |
| `is-distinct-from` | IS [NOT] DISTINCT FROM | NULL-safe comparison | three-valued-logic | adept | R | Writes `a = b OR (a IS NULL AND b IS NULL)` by hand · confuses it with SELECT DISTINCT |
| `like-ilike` | LIKE / ILIKE | `%` and `_` wildcards, ESCAPE, case-insensitive ILIKE | where-comparison | novice | R | No `%` so LIKE acts like `=` · expects LIKE to ignore case · literal `_` not escaped |
| `order-by` | ORDER BY | Sort by columns, expressions, aliases, ordinals; ASC/DESC per key; NULLS FIRST/LAST | select-columns | novice | R | DESC applies only to the key it follows · assumes unsorted output follows id · forgets NULLs sort last in ASC and first in DESC |
| `collation-sorting` | Collations | Text order depends on the collation; `COLLATE "unicode"` | order-by | apprentice | RC: PGlite database collation is `C` (byte order). Verified: `Apple, Zed, apple, eagle, zebra, éclair`; with `COLLATE "unicode"`: `apple, Apple, eagle, éclair, zebra, Zed`. ICU collations exist | Expects dictionary order · surprised accented letters sort after z · puts COLLATE in the wrong place |
| `limit-offset` | LIMIT, OFFSET, FETCH FIRST | First n rows; `FETCH FIRST n ROWS WITH TIES` | order-by | novice | R | LIMIT without ORDER BY (nondeterministic) · page math `(page-1)*size` off by one · WITH TIES without ORDER BY (error) |
| `distinct` | SELECT DISTINCT | Remove duplicate result rows (whole row) | select-columns | novice | R | `DISTINCT(a), b` thought to apply to a only · DISTINCT used to hide join fan-out · ORDER BY a column not in the select list (42P10) |
| `logical-processing-order` | Logical processing order | FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT; explains alias and aggregate rules | column-aliases, group-by | apprentice | R | Believes SQL runs top to bottom as written · alias in WHERE · aggregate in WHERE (42803) |

### 2.2 Query: expressions and functions

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `case-expression` | CASE | Searched and simple CASE | boolean-logic | apprentice | R | Missing END (42601) · no ELSE silently yields NULL · incompatible branch types (42804) |
| `coalesce-nullif` | COALESCE, NULLIF, GREATEST/LEAST | Defaults for NULL, sentinel → NULL, safe division | null-basics | apprentice | R | `COALESCE(int_col, 'none')` (22P02) · forgets `NULLIF(den, 0)` (22012 division by zero) · expects GREATEST to return NULL when one arg is NULL (PG ignores NULLs) |
| `type-casting` | Casting | `CAST(x AS t)`, `x::t`, implicit casts, literal types | arithmetic-expressions | apprentice | R | `'12abc'::int` (22P02) · casts after integer division `(7/2)::numeric` = 3 · `'3.7'::int` fails while `3.7::int` rounds to 4 |
| `string-functions` | String functions | length, lower/upper, initcap, trim, substring, position, left/right, replace, split_part, lpad, concat/concat_ws, `\|\|`, format, reverse | type-casting | apprentice | R | `'a' \|\| NULL` is NULL (use concat) · 0-based positions (PG is 1-based) · substring length vs end index |
| `regex-matching` | Regular expressions | `~ ~* !~`, regexp_replace (`'g'`), regexp_matches, regexp_count/substr/like (PG15+), SIMILAR TO | like-ilike | adept | R | `~` is unanchored (forgets `^...$`) · no `'g'` flag replaces only first match · double escaping backslashes |
| `numeric-functions` | Math functions | round/trunc/ceil/floor/abs/mod/power/sqrt/random/width_bucket, to_char number formats | arithmetic-expressions | apprentice | R | `round(2.5::float8)` = 2 but `round(2.5)` (numeric) = 3 (verified) · random() not reproducible (use `setseed`) · `to_char` returns text that sorts as text |
| `date-time-basics` | Dates & timestamps 101 | ISO literals, current_date, now(), `date + int`, `date - date` | type-casting | novice | R | `'01/02/2026'` ambiguous (DateStyle MDY in PGlite) · now() frozen for the whole transaction · `ts = '2026-05-01'` misses the rest of the day |
| `date-functions` | Date functions | extract/date_part, date_trunc, age, to_char/to_date, make_date, make_interval | date-time-basics | apprentice | R | `extract(month)` merges January of every year · to_char `MM` (month) vs `MI` (minute) · age() vs subtraction |
| `interval-arithmetic` | Intervals | Interval literals, month math, justify_*, epoch | date-functions | adept | R | `'2026-01-31' + 1 month` → Feb 28, not invertible · `'1 day' ≠ '24 hours'` across DST (verified Europe/Paris: 01:30 vs 02:30) · dividing intervals by months |
| `data-cleaning` | Cleaning messy data | trim, `NULLIF(x,'')`, regex normalization, find unparseable rows before casting (Practical SQL ch. 10) | string-functions, regex-matching | adept | R | UPDATE before inspecting with SELECT · casting the whole column so one bad row aborts (22P02) · greedy regexp_replace destroying data |

### 2.3 Query: aggregation

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `aggregate-functions` | Aggregates | count/sum/avg/min/max collapse rows | select-columns | novice | R | `sum` over zero rows is NULL not 0 · avg of ints shows many decimals · plain column next to an aggregate without GROUP BY (42803) |
| `count-variants` | COUNT(*) / COUNT(col) / COUNT(DISTINCT) | Rows vs non-null values vs distinct values | aggregate-functions, null-basics | novice | R (verified `count(null)` = 0) | count(col) assumed to count NULLs · count(*) after LEFT JOIN counts unmatched as 1 · `count(DISTINCT a, b)` (42883; use `count(DISTINCT (a,b))`) |
| `group-by` | GROUP BY | One output row per group | aggregate-functions | apprentice | R | Non-grouped column in SELECT (42803, Karwin Ambiguous Groups) · assumes GROUP BY sorts · groups by too many columns |
| `having` | HAVING | Filter groups after aggregation | group-by | apprentice | R | Aggregate condition in WHERE (42803) · row filters in HAVING · SELECT alias in HAVING (42703) |
| `aggregate-filter` | FILTER and conditional aggregation | `count(*) FILTER (WHERE ...)`, `sum(CASE ...)` | group-by, case-expression | adept | R | Puts condition in WHERE and loses other groups · `ELSE 0` vs NULL changes avg · expects a PIVOT keyword |
| `collection-aggregates` | string_agg, array_agg, jsonb_agg, bool_and/bool_or, any_value | Collapse into string/array/json; ORDER BY inside the call; logical aggregates; any_value (PG16) | group-by | adept | R (verified) | ORDER BY outside the call doesn't order elements · missing separator arg · `max(boolean)` (42883; use bool_or) |
| `statistical-aggregates` | Statistical aggregates | stddev/variance (pop vs samp), corr, regr_slope/intercept/r2 | aggregate-functions | expert | R | stddev (sample) vs stddev_pop confusion · corr interpreted as causation · integer inputs |
| `ordered-set-aggregates` | Percentiles & mode | percentile_cont/disc, mode() WITHIN GROUP, hypothetical rank() WITHIN GROUP | aggregate-functions, order-by | expert | R | Looks for median() · percentile_cont interpolates a value that doesn't exist · forgets WITHIN GROUP |
| `grouping-sets` | GROUPING SETS / ROLLUP / CUBE | Several grouping levels in one pass; GROUPING() labels subtotal rows | group-by | expert | R (verified) | Subtotal NULL confused with real NULL (use GROUPING()) · ROLLUP column order · CUBE row explosion |

### 2.4 Query: joins

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `keys-and-relationships-intro` | Keys connect tables | PK identifies a row, FK points to a row elsewhere | relational-model | novice | R | Thinks names are good join keys · expects every fact duplicated in every table |
| `table-aliases` | Table aliases | `FROM hero h`, qualified `h.name` | select-columns | novice | R | Ambiguous column (42702) · using the full table name after aliasing (42P01 missing FROM-clause entry) |
| `inner-join` | INNER JOIN ... ON | Combine matching rows | table-aliases, keys-and-relationships-intro | novice | R | Joins unrelated columns (Taipalus) · missing ON (42601) · joins on names not ids |
| `multi-table-join` | Joining 3+ tables | Chains along FK paths, junction tables | inner-join | apprentice | R | Forgets one condition → cartesian explosion · wrong path through the junction table · mixes comma joins and JOIN (42P01 on references) |
| `join-using-natural` | USING and NATURAL | Shorthand conditions; NATURAL is fragile | inner-join | apprentice | R | NATURAL silently joins on every same-named column (`name`, `created_at`) · expects both key columns from `SELECT *` with USING |
| `cross-join` | CROSS JOIN, cartesian products | Every combination; accidental with `FROM a, b` | inner-join | apprentice | R | Comma join without WHERE · underestimates result size |
| `left-join` | LEFT JOIN | Keep all left rows, NULL-extend misses | inner-join, null-basics | apprentice | R | Filtering the right table in WHERE turns it into an inner join · `count(*)` instead of `count(right.id)` · tables in the wrong order |
| `right-full-join` | RIGHT / FULL OUTER JOIN | Keep right rows / both sides | left-join | apprentice | R | RIGHT where swapped LEFT is clearer · no COALESCE on keys after FULL · FULL JOIN on inequality (0A000) |
| `self-join` | Self joins | Two aliases of one table (mentor, pairs, previous day) | table-aliases, inner-join | apprentice | R | Row paired with itself (missing `a.id <> b.id`) · mirrored duplicate pairs (use `a.id < b.id`) · alias mix-up |
| `non-equi-join` | Range / non-equi joins | Join on `<`, BETWEEN, `&&` (level thresholds, price brackets) | inner-join | adept | R | Overlapping brackets duplicate rows · boundary inclusivity |
| `join-fanout` | Fan-out and double counting | Joining two child tables multiplies rows; pre-aggregate (Karwin Spaghetti Query) | group-by, multi-table-join | adept | R | Inflated sums after joining items and quests · `sum(DISTINCT)` as a wrong fix · one giant query instead of pre-aggregated CTEs |
| `semi-join-exists` | EXISTS (semi-join) | Rows with at least one match, no duplication | correlated-subquery | adept | R | Missing correlation (EXISTS always true) · JOIN + DISTINCT instead · thinks the select list inside EXISTS matters |
| `anti-join` | NOT EXISTS / LEFT JOIN ... IS NULL | Rows with no match | semi-join-exists, left-join | adept | R | Tests IS NULL on a nullable right column instead of its key · anti condition placed in ON |
| `not-in-null-trap` | NOT IN and NULL | One NULL in the subquery makes NOT IN return nothing (Don't Do This) | anti-join, three-valued-logic | adept | R (verified: 0 rows) | NOT IN on nullable column · assumes IN and NOT IN are symmetric |
| `lateral-join` | LATERAL | FROM-subquery that sees earlier tables; per-row top-N; set-returning functions | correlated-subquery, left-join | expert | R (verified) | Forgets LATERAL (42P01 invalid reference to FROM-clause entry) · `LEFT JOIN LATERAL ... ON true` syntax · uses it where a plain join suffices |

### 2.5 Query: subqueries, sets, CTEs

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `scalar-subquery` | Scalar subquery | Subquery used as a single value | aggregate-functions | apprentice | R | Returns several rows (21000) · zero rows → NULL unexpected · heavy subquery repeated per row |
| `in-subquery` | IN (subquery) | Membership in a query result | in-and-between, scalar-subquery | apprentice | R | Subquery with several columns (42601) · `=` instead of IN (21000) |
| `derived-tables` | Subqueries in FROM | Inline views; alias optional since PG16 | scalar-subquery | apprentice | R | Outer query referencing unselected inner columns (42703) · expects inner ORDER BY to persist |
| `correlated-subquery` | Correlated subqueries | Inner query references the outer row | scalar-subquery, table-aliases | adept | R | Unqualified column resolves to the wrong table · missing correlation · per-row cost on large tables |
| `any-all` | ANY / ALL / SOME | Compare to every element of a set or array | in-subquery | adept | R | `> ALL (empty)` is TRUE · a NULL makes ALL unknown · `IN (array_col)` instead of `= ANY(array_col)` |
| `set-operations` | UNION / INTERSECT / EXCEPT | Combine results vertically | select-columns | apprentice | R | UNION dedups (wanted UNION ALL) · column count (42601) or type mismatch (42804) · ORDER BY inside a branch without parentheses |
| `values-lists` | VALUES as a table | Inline literal tables | select-columns | apprentice | R | Missing `AS t(col, ...)` · mixed types per column (42804) |
| `cte-basics` | WITH (CTEs) | Named steps; several CTEs separated by commas | derived-tables | adept | R | Writes WITH twice · uses a CTE in a later separate statement (42P01) · believes a CTE is a temp table |
| `generate-series` | generate_series | Integer / timestamp sequences as tables | values-lists, date-time-basics | adept | R | Inclusive end surprise · timestamptz series across DST · missing step for dates |
| `recursive-cte` | Recursive CTEs | Anchor UNION ALL recursive member; walk trees and sequences | cte-basics, set-operations | expert | RC: `statement_timeout` is NOT enforced in PGlite (verified: 20M-row query ran 4.2 s with a 100 ms timeout). A runaway recursion hangs the engine, so the app needs a watchdog (see Appendix B) | No termination condition · anchor/recursive type mismatch (42804, varchar vs text) · UNION vs UNION ALL |
| `recursive-graph-walks` | Graph walks & cycles | Path arrays, depth, `SEARCH` / `CYCLE` clauses (PG14+) | recursive-cte, arrays | master | RC (same watchdog; SEARCH/CYCLE verified) | Cycles → infinite loop · path explosion in dense graphs · missing depth limit |
| `data-modifying-cte` | Data-modifying CTEs | `WITH moved AS (DELETE ... RETURNING *) INSERT ...` | cte-basics, returning-clause | expert | R | Expects a later CTE to see earlier changes (same snapshot) · modifies the same row twice |
| `cte-materialization` | CTE inlining vs MATERIALIZED | PG12+ inlines CTEs; MATERIALIZED = optimization fence | cte-basics, explain-basics | expert | R (verified: inlined plan filters the base table; MATERIALIZED shows CTE Scan) | Assumes all CTEs are fences · forces MATERIALIZED and loses index use |

### 2.6 Query: windows and analytic patterns

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `window-basics` | OVER () | Aggregate without collapsing rows | aggregate-functions | adept | R | Window function in WHERE (42P20) · confuses with GROUP BY · forgets windows run after WHERE |
| `window-partition-order` | PARTITION BY, ORDER BY, WINDOW clause | Per-group windows, named windows | window-basics, group-by | adept | R | No ORDER BY → running sum becomes a total · partitions on the wrong key |
| `ranking-functions` | row_number / rank / dense_rank / ntile / percent_rank | Rank within partitions | window-partition-order | adept | R | rank vs dense_rank on ties · row_number nondeterministic on ties · uneven ntile buckets |
| `lag-lead` | LAG / LEAD | Previous/next row: deltas, period over period | window-partition-order | adept | R | No PARTITION BY leaks values across players · NULL at the edges (use default arg) · wrong ORDER BY direction |
| `window-frames` | Frames, first/last/nth_value | ROWS / RANGE / GROUPS, default frame, EXCLUDE; value functions | lag-lead | expert | R (GROUPS + EXCLUDE verified) | `last_value` returns the current row (default frame ends at CURRENT ROW) · RANGE treats ties as peers · moving-average frame off by one |
| `running-totals` | Running totals & moving averages | `sum() OVER (ORDER BY ...)`, sliding windows | window-frames | adept | R | Ties jump with default RANGE · no partition · correlated subquery O(n²) |
| `distinct-on` | DISTINCT ON | PG first-row-per-group | order-by, distinct | adept | R | ORDER BY not starting with DISTINCT ON exprs (42P10) · no tie-breaker · expects portability |
| `top-n-per-group` | Top-N per group | row_number in subquery, DISTINCT ON, LATERAL | ranking-functions, distinct-on, lateral-join | expert | R (verified LATERAL variant) | Filters `rn` in the same SELECT (42703 / 42P20) · rank() returns > N on ties · max-then-join-back duplicates ties |
| `deduplication` | Finding & removing duplicates | GROUP BY HAVING count > 1, row_number, DELETE ... USING / ctid | top-n-per-group, delete-basic | expert | R | Deletes every copy · dedup key missing a column · no UNIQUE constraint afterwards |
| `date-bucketing` | Time buckets | date_trunc, date_bin (PG14+), width_bucket | date-functions, group-by | adept | R (date_bin verified) | date_trunc on timestamptz depends on session TimeZone · grouping by to_char text breaks order · ISO weeks start Monday |
| `time-series-gap-fill` | Gap filling & calendar tables | generate_series LEFT JOIN facts (Celko auxiliary tables) | generate-series, left-join, date-bucketing | expert | R | Filtering facts in WHERE removes empty days · `count(*)` = 1 for empty buckets · series and data in different time zones |
| `gaps-and-islands` | Gaps & islands | Consecutive runs via value − row_number or LAG flags + running sum | ranking-functions, lag-lead | master | R (verified) | Missing partition · duplicates break the arithmetic · off-by-one at edges |
| `sessionization` | Sessionization | Split events into sessions by inactivity gap | lag-lead, running-totals | master | R | Threshold comparison direction · no per-user partition · new-session flag on first row forgotten |
| `pivoting` | Pivot / crosstab | Rows → columns with FILTER/CASE; tablefunc `crosstab` | aggregate-filter | expert | RC (crosstab needs the tablefunc extension loaded at init; verified) | Looks for PIVOT keyword · crosstab source not ordered / output columns undeclared · 1-arg crosstab shifts values when categories are missing |
| `relational-division` | Relational division | "Heroes who completed ALL quests": double NOT EXISTS or count match (Celko) | anti-join, having | master | R | Counts without DISTINCT · empty divisor · duplicates inflate counts |
| `random-sampling` | Random rows & sampling | ORDER BY random() LIMIT (Karwin Random Selection), TABLESAMPLE, tsm_system_rows, setseed | order-by, limit-offset | adept | R (verified setseed reproducible) | Full sort on big tables · TABLESAMPLE SYSTEM is block-level · non-reproducible output in tests |

### 2.7 Mutation

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `insert-basic` | INSERT ... VALUES | Add a row with an explicit column list | select-columns | novice | R | No column list, relies on column order · value count mismatch (42601 INSERT has more expressions than target columns) · unquoted text (42703) |
| `insert-multi-row` | Multi-row INSERT | Many tuples in one statement | insert-basic | novice | R | Missing comma between tuples · one bad row aborts all |
| `default-values` | DEFAULT | Omitted columns get defaults; `DEFAULT` keyword; `DEFAULT VALUES` | insert-basic | apprentice | R | Inserts explicit NULL expecting the default · `now()` default evaluated at statement time |
| `returning-clause` | RETURNING (+ OLD/NEW, PG18) | Get generated ids and before/after values | insert-basic | apprentice | R (PG18 `old.gold`/`new.gold` verified) | Second SELECT to fetch new id (race) · `RETURNING *` in app code · forgets RETURNING works on UPDATE/DELETE |
| `insert-select` | INSERT ... SELECT | Copy/transform rows from a query | insert-basic, where-comparison | apprentice | R | Column order mismatch silently swaps same-typed data · re-running duplicates rows |
| `update-basic` | UPDATE | Change values of matching rows | where-comparison | novice | R | Forgets WHERE (every row) · `SET a = 1 AND b = 2` (assigns a boolean, or 42804) · expects `SET a = b, b = a` to be sequential (PG swaps) |
| `update-from` | UPDATE ... FROM | Update using another table | update-basic, inner-join | adept | R | Several source rows per target → arbitrary pick · repeating the target in FROM creates a self cross join |
| `delete-basic` | DELETE | Remove rows | where-comparison | novice | R | Forgets WHERE · children exist (23503) · DELETE vs DROP confusion |
| `delete-using` | DELETE ... USING | Delete with a join | delete-basic, inner-join | adept | R | Missing join predicate deletes everything · NOT IN subquery with NULLs deletes nothing |
| `truncate` | TRUNCATE | Fast empty; RESTART IDENTITY; CASCADE | delete-basic | apprentice | R | Table referenced by an FK (0A000) · expects ON DELETE triggers to fire · CASCADE wipes other tables |
| `sequences` | Sequences & gaps | nextval/currval/setval; gaps are normal (Karwin Pseudokey Neat-Freak) | default-values | adept | R | "Filling gaps" in ids · currval before nextval (55000) · manual ids collide later (23505) |
| `upsert-on-conflict` | INSERT ... ON CONFLICT | DO NOTHING / DO UPDATE SET ... = EXCLUDED.col | insert-basic, unique-constraint | adept | R (verified) | No unique index matching the target (42P10) · same key twice in one statement (21000) · `gold + excluded.gold` without table qualifier (42702) |
| `merge-statement` | MERGE | Conditional insert/update/delete; PG17 `RETURNING merge_action()` and `WHEN NOT MATCHED BY SOURCE` | upsert-on-conflict, update-from | expert | R (verified) | Duplicate source keys (21000) · assumes MERGE is race-safe like ON CONFLICT · WHEN clause order |
| `bulk-load-copy` | COPY & bulk loading | COPY FROM/TO with CSV options, staging tables | insert-multi-row | adept | RC: works against PGlite's in-memory virtual FS (verified `COPY ... TO '/tmp/out.csv'` then `COPY ... FROM` it) and `/dev/blob` for browser files; no server filesystem | Header imported as data · delimiter/quote mismatch · one bad value aborts the load (use a text staging table) |
| `transactions-basics` | BEGIN / COMMIT / ROLLBACK, ACID | Atomic groups of statements; autocommit by default; ACID properties | update-basic | apprentice | R (verified) | Continues after an error (25P02 current transaction is aborted) · forgets COMMIT · expects ROLLBACK after COMMIT to undo |
| `savepoints` | SAVEPOINT | Partial rollback | transactions-basics | adept | R (verified) | `ROLLBACK` instead of `ROLLBACK TO name` · thinks RELEASE commits |
| `constraint-errors` | Constraint violations & SQLSTATE | 23502 not null, 23503 FK, 23505 unique, 23514 check, 23P01 exclusion, 44000 check option; read DETAIL | transactions-basics, check-constraint | apprentice | R (error objects expose code, detail, constraint, table, position: verified) | Reads only the message, not DETAIL (`Key (x)=(1) already exists.`) · retries the same insert · drops the constraint instead of fixing data |
| `isolation-levels` | Isolation levels & anomalies | Read committed / repeatable read / serializable; dirty, non-repeatable, phantom, write skew; 40001 retry | transactions-basics | expert | C (`SET TRANSACTION ISOLATION LEVEL` runs, but there is no second session) | Assumes serializable by default · no retry loop for 40001 · thinks READ UNCOMMITTED gives dirty reads in PG |
| `row-locking` | Row locks, SKIP LOCKED, advisory locks, deadlocks | FOR UPDATE / FOR SHARE, job-queue pattern, pg_advisory_lock, deadlock 40P01 | isolation-levels | expert | RC: syntax runs, no contention observable (advisory lock is re-entrant in one session, verified) | Locks outside a transaction (no effect) · inconsistent lock order → deadlock · holding locks during user think-time |
| `optimistic-locking` | Lost updates & optimistic locking | Atomic `SET x = x + 1`; version column with `WHERE version = $v`, check row count | update-basic, row-locking | expert | RC (pattern runnable; race replayed by a scripted "ghost session") | Read-modify-write in app code · ignores affected-row count |
| `mvcc-concept` | MVCC | UPDATE writes a new row version; xmin/xmax/ctid; readers don't block writers | transactions-basics | expert | RC (ctid/xmin change after UPDATE and n_dead_tup are visible, verified) | Thinks UPDATE edits in place · expects DELETE to shrink the file |

### 2.8 Schema (DDL and design)

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `data-type-basics` | Choosing column types | int/bigint, numeric, text, boolean, date, timestamptz at a glance | type-casting | apprentice | R | Numbers/dates stored as text · `varchar(255)` by habit · float for money |
| `create-table` | CREATE TABLE | Columns, types, constraints | data-type-basics | apprentice | R | Trailing comma before `)` (42601) · reserved names (`user`, `order`) unquoted · no primary key |
| `primary-key` | PRIMARY KEY | Unique + not null identity; natural vs surrogate; composite keys (Karwin ID Required) | create-table | apprentice | R | Surrogate id on a junction table allowing duplicate pairs · mutable natural key (email) · no PK |
| `identity-columns` | Identity vs serial | `GENERATED ALWAYS/BY DEFAULT AS IDENTITY` over serial (Don't Do This) | primary-key, sequences | apprentice | R (428C9 verified) | Explicit id into ALWAYS column (428C9) without `OVERRIDING SYSTEM VALUE` · sequence out of sync after manual ids (23505) |
| `not-null-default` | NOT NULL & DEFAULT | Required columns, defaults | create-table | apprentice | R | Adding NOT NULL column to a populated table without default (23502) · defaults hiding missing data |
| `unique-constraint` | UNIQUE | Uniqueness; NULLs are distinct unless `NULLS NOT DISTINCT` (PG15) | create-table, null-basics | apprentice | R | Expects UNIQUE to block several NULLs · case variants (`Aria`/`aria`) slip through (use unique index on lower()) |
| `check-constraint` | CHECK | Row-level rules; NULL passes a CHECK | create-table, three-valued-logic | apprentice | R (23514 verified) | `CHECK (gold >= 0)` accepts NULL · cross-row rules attempted in CHECK · PG18 `NOT ENFORCED` mistaken for validation (verified: violating row accepted) |
| `foreign-key` | FOREIGN KEY | Referential integrity (Karwin Keyless Entry) | primary-key | apprentice | R (23503 verified) | FK/PK type mismatch (42804) · referencing a non-unique column (42830) · reversed direction |
| `fk-actions` | FK actions & deferrable constraints | ON DELETE CASCADE / SET NULL / RESTRICT / NO ACTION; DEFERRABLE INITIALLY DEFERRED | foreign-key, delete-basic | adept | R (verified) | CASCADE deletes more than intended · SET NULL on NOT NULL column (23502) · no index on the FK column (slow parent deletes) |
| `generated-columns` | Generated columns | VIRTUAL (PG18 default) vs STORED | create-table | adept | R (both verified) | Writing to a generated column (428C9) · volatile expression (42P17) · indexing a VIRTUAL column |
| `alter-table` | ALTER TABLE | Add/drop/rename columns, change type USING, add constraint NOT VALID + VALIDATE | create-table | adept | R (verified) | Type change without USING (42804) · drop a column used by a view (2BP01) · adding a constraint existing rows violate (23514) |
| `drop-objects` | DROP & dependencies | IF EXISTS, CASCADE, dependency errors | create-table | apprentice | R | CASCADE silently dropping views · DROP vs DELETE vs TRUNCATE |
| `views` | Views | Saved queries; simple views are updatable; WITH CHECK OPTION | cte-basics | adept | R (44000 verified) | Expects a view to store data · `SELECT *` view freezes its column list · ORDER BY inside the view |
| `materialized-views` | Materialized views | Stored results; REFRESH [CONCURRENTLY] needs a unique index | views | expert | R (verified) | Expects auto refresh · CONCURRENTLY without unique index (55000) |
| `schemas-search-path` | Schemas & search_path | Namespaces, qualified names, search_path | create-table | adept | R (verified) | "relation does not exist" because it is in another schema (42P01) · objects created in public by accident |
| `catalog-introspection` | Introspecting the catalog | information_schema, pg_catalog, regclass, COMMENT ON / obj_description | schemas-search-path | adept | RC: no psql `\d` meta-commands; provide equivalent queries or a schema panel | Looks for `\d` · case-sensitive name lookups in regclass |
| `naming-conventions` | Naming conventions | snake_case, lower case, consistent plurality, explicit FK/constraint names | create-table | apprentice | R | Mixed-case names needing quotes forever · reserved words · cryptic abbreviations |
| `er-modeling` | Conceptual modeling | Entities, attributes, relationships, business rules (Hernandez process) | keys-and-relationships-intro | adept | C (diagram/paper exercise, then validated by building the schema) | Models reports instead of entities · attributes that are really entities |
| `relationship-cardinality` | 1:1, 1:N, M:N | Junction tables, optional vs mandatory participation | er-modeling, foreign-key | adept | R | M:N stored as a list column (Jaywalking) · FK on the wrong side of 1:N |
| `normalization-1nf` | First normal form | Atomic values, no repeating groups (Karwin Jaywalking, Multicolumn Attributes) | relationship-cardinality | adept | R (refactor exercises) | Comma-separated lists · `tag1, tag2, tag3` columns |
| `normalization-2nf-3nf` | Functional dependencies, 2NF, 3NF | Remove partial and transitive dependencies | normalization-1nf | expert | R (refactor + lossless-join check) | Over-splitting · lossy decomposition · confusing FD with correlation |
| `normalization-bcnf-beyond` | BCNF, 4NF, 5NF | Every determinant is a key; multivalued and join dependencies | normalization-2nf-3nf | master | C | Believes 3NF always equals BCNF |
| `denormalization` | Denormalization trade-offs | Cached aggregates, arrays/jsonb, materialized views; protect with triggers/transactions (Fontaine) | normalization-2nf-3nf | expert | R | Denormalizes before measuring · cached counters drift |
| `design-antipatterns` | Logical design antipatterns | EAV, polymorphic associations, metadata tribbles, 31 flavors, phantom files (Karwin) | normalization-2nf-3nf, foreign-key | expert | R (detect & refactor) | EAV for "flexibility" losing types/constraints · one id column pointing at many tables · table per year |
| `hierarchy-models` | Trees in SQL | Adjacency list, path enumeration (ltree), nested sets, closure table (Karwin Naive Trees, Celko) | recursive-cte, foreign-key | expert | RC (ltree extension) | Fixed-depth self joins · nested-set update cost · no cycle prevention |
| `temporal-constraints` | Exclusion & WITHOUT OVERLAPS | No double booking: `EXCLUDE USING gist`, PG18 `PRIMARY KEY (room, during WITHOUT OVERLAPS)` | range-types, unique-constraint | expert | RC (btree_gist extension needed for `=` on scalars in GiST; both verified with 23P01) | UNIQUE on start/end columns · forgets btree_gist · inclusive end bounds collide on touching ranges |

### 2.9 Types (PostgreSQL in depth)

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `numeric-types` | Integer & numeric | smallint/int/bigint ranges, numeric(p,s), overflow | data-type-basics | apprentice | RC: values come back fine, but int8 is converted to a JS number by the driver (precision loss above 2^53) unless the app uses text parsers | `2147483647 + 1` (22003) · numeric(5,2) rejects 1000.00 (22003) · sum of ints in int column overflows |
| `floating-point` | Floating point | real/double are approximate; NaN, Infinity; round half even | numeric-types | adept | R (verified `0.1+0.2 = 0.30000000000000004`, `0.1::real` widens to 0.10000000149) | Float equality · float for money · real precision loss |
| `money-handling` | Money correctly | numeric with fixed scale + currency column; avoid `money` (Karwin Rounding Errors, Don't Do This) | numeric-types | adept | R (`money` locale is C: `$3.33`) | Uses `money` · uses float · rounds per line instead of on the total |
| `text-types` | text vs varchar(n) vs char(n) | Prefer text (+ CHECK on length) | data-type-basics | apprentice | R | char(n) padding comparisons · arbitrary varchar(n) limits (22001) |
| `boolean-type` | boolean | true/false/NULL, input literals, `WHERE flag` | data-type-basics | novice | R | `WHERE flag = 'true'` habits · unintended third state (missing NOT NULL) |
| `uuid-type` | UUIDs | gen_random_uuid / uuidv4, uuidv7 (PG18, time ordered), uuid-ossp | data-type-basics | adept | R (uuidv7 + uuid_extract_version verified) | UUID stored as text · random v4 PKs hurt index locality · treating UUIDs as secrets |
| `enum-types` | Enums | Ordered labels; ALTER TYPE ADD VALUE; vs CHECK vs lookup table (Karwin 31 Flavors) | data-type-basics | adept | R (verified) | Expects alphabetical sort (enum sorts by declaration) · removing a value is hard · invalid label (22P02) |
| `domain-types` | Domains | Reusable constrained types | check-constraint | expert | R (23514 verified) | Over-engineering · relying on domain NOT NULL through outer joins |
| `composite-types` | Composite / row types | CREATE TYPE AS, ROW(), `(col).field`, row comparison | data-type-basics | expert | R (verified) | `col.field` parsed as table.column (needs `(col).field`) · NULL composite vs composite of NULLs |
| `arrays` | Arrays | `'{...}'`, ARRAY[], 1-based subscripts, slices, `= ANY`, `@> <@ &&`, unnest, array_agg, cardinality, array_position/remove, array_sort/array_reverse (PG18) | data-type-basics, any-all | adept | R (verified incl. PG18 functions) | 0-based indexing · `IN (array_col)` · arrays used as FK lists (Jaywalking) |
| `json-vs-jsonb` | json vs jsonb | json keeps raw text (dup keys, order); jsonb is parsed and indexable | data-type-basics | adept | RC: the JS driver parses `json` into objects, so duplicate keys and key order vanish in the result grid (verified); show `::text` or use raw-text parsers | Picks json for querying · expects jsonb key order · stores everything as jsonb |
| `jsonb-operators` | jsonb operators | `-> ->> #> #>> @> <@ ? ?\| ?& - \|\|`, subscripting `doc['a']['b']` | json-vs-jsonb | adept | R (verified) | `->` vs `->>` in comparisons (42883 jsonb = text) · `->>` returns text, numeric compare needs a cast · `?` clashes with client placeholders |
| `jsonb-construction` | Building JSON | jsonb_build_object/array, to_jsonb, row_to_json, jsonb_agg, jsonb_object_agg, SQL/JSON `json_object`/`json_array` | collection-aggregates, json-vs-jsonb | adept | R (verified) | jsonb_agg over zero rows is NULL (COALESCE `'[]'`) · nested aggregates need subqueries |
| `jsonb-decomposition` | Unnesting JSON | jsonb_array_elements, jsonb_each(_text), jsonb_object_keys, jsonb_to_recordset | jsonb-operators, lateral-join | expert | R (verified) | SRF in SELECT instead of FROM/LATERAL · `_text` vs jsonb variants |
| `jsonb-modification` | Modifying JSON | jsonb_set, jsonb_insert, `\|\|`, `-`, `#-`, jsonb_strip_nulls | jsonb-operators, update-basic | expert | R (verified) | jsonb_set value given as text not jsonb (`'"rogue"'`) · `\|\|` is a shallow merge · create_missing flag |
| `sql-json-path` | SQL/JSON path | jsonpath, jsonb_path_query(_array/_first), `@?`, `@@`, filters `? (@.qty > 1)`, json_exists/json_value/json_query (PG17), `IS JSON` | jsonb-operators | expert | R (verified) | lax vs strict mode · `==` in path vs `=` in SQL · string quoting inside paths |
| `json-table` | JSON_TABLE | JSON → relational rows (PG17) with COLUMNS/PATH/NESTED | sql-json-path | expert | R (verified) | Wrong root path (`'$[*]'`) · errors silently become NULL (ON ERROR defaults) |
| `jsonb-indexing` | Indexing jsonb | GIN jsonb_ops vs jsonb_path_ops; B-tree on `(doc->>'k')` | jsonb-operators, gin-gist-brin-hash | expert | R (bitmap index plan verified) | Expects GIN to accelerate `->> =` · jsonb_path_ops doesn't support `?` |
| `hstore` | hstore | Flat text key/value maps; audit diffs (Fontaine) | json-vs-jsonb | expert | RC (extension) | Values are always text · hstore where jsonb fits better |
| `timezones` | timestamptz & time zones | timestamptz = instant; TimeZone setting controls display; AT TIME ZONE both ways; DST | interval-arithmetic | expert | RC: PGlite session TimeZone defaults to GMT; driver converts timestamptz to JS Date (offset and microseconds lost) unless raw-text parsers are used (verified) | Uses timestamp without tz (Don't Do This) · AT TIME ZONE direction · `date_trunc('day')` depends on session tz |
| `range-types` | Range types | int4range/numrange/daterange/tstzrange; `[)` bounds; `&& @> <@ -\|- * +`; lower/upper/isempty | date-time-basics, in-and-between | expert | R (verified) | `'[1,5]'` canonicalizes to `[1,6)` · empty ranges · two columns + BETWEEN instead |
| `multirange-types` | Multiranges | PG14+ sets of ranges; range_agg; availability calendars | range-types | master | R (verified) | `range + range` on disjoint ranges (22000 result would not be contiguous) |
| `network-types` | inet / cidr / macaddr | IP addresses, subnets, `<< >>`, masklen, host | data-type-basics | expert | R (verified) | IPs as text · host bits set in cidr (22P02) |
| `bytea-binary` | bytea | Binary data, hex output, encode/decode base64 | data-type-basics | expert | RC (driver returns Uint8Array; render as `\x...` hex) | Big files in rows · escape vs hex format |
| `geometric-types` | Geometry & earthdistance | point/box/circle/polygon, `<->`, `&&`, `@>`; earthdistance `ll_to_earth`, `<@>` | data-type-basics | expert | RC: no PostGIS. Built-in types + cube/earthdistance only (verified Paris→London 343 km) | lon/lat order in `point` · `<@>` returns statute miles |
| `ltree` | ltree paths | Materialized paths, `<@ @> ~` lquery, nlevel, subpath | hierarchy-models | expert | RC (extension; verified) | Invalid label characters · moving subtrees needs bulk updates |
| `case-insensitive-text` | Case-insensitive text | citext, lower() expression index, ICU nondeterministic collations, casefold (PG18) | text-types, collation-sorting | expert | RC (citext extension; ICU `CREATE COLLATION ... deterministic = false` verified; casefold verified) | ILIKE everywhere (no index) · unique constraint not case-insensitive |
| `pgcrypto-hashing` | Hashing & passwords | digest/hmac, crypt + gen_salt('bf'), gen_random_bytes (Karwin Readable Passwords) | bytea-binary | expert | RC (extension; verified) | Plaintext/MD5 passwords · comparing hashes without `crypt(input, stored)` |
| `full-text-search` | Full-text search | to_tsvector / to_tsquery / `@@`, plainto/websearch_to_tsquery, configs, stemming, stop words | string-functions | expert | RC: PGlite `default_text_search_config` is `simple` (no stemming). Always pass `'english'` or SET it per session (verified; 30 configs available incl. english, french) | `LIKE '%word%'` as search (Karwin Poor Man's Search Engine) · config mismatch between document and query · to_tsquery syntax errors on raw input (use websearch_to_tsquery) |
| `fts-ranking-highlighting` | Ranking & highlighting | ts_rank / ts_rank_cd, setweight A to D, ts_headline | full-text-search | expert | R (verified) | Sorting by rank without `@@` filter · weights on wrong fields · ts_headline on every row |
| `fts-indexing` | Indexing FTS | Generated tsvector column + GIN | full-text-search, generated-columns | expert | R (verified) | Index config differs from query config · recomputing to_tsvector per row |
| `trigram-search` | Trigram fuzzy search | pg_trgm similarity, `%`, `<->`, word_similarity; GIN/GiST trgm indexes for `LIKE '%x%'` | like-ilike | expert | RC (extension; verified) | similarity_threshold confusion · very short strings · expecting semantic matches |
| `fuzzy-string-matching` | Edit distance, phonetics, unaccent | levenshtein, soundex, metaphone, daitch_mokotoff (fuzzystrmatch); unaccent | string-functions | expert | RC (extensions; verified) | levenshtein on every row without prefilter · soundex on non-English names |
| `vector-basics` | Vectors & embeddings | pgvector vector(n), halfvec, sparsevec, bit; operators `<->` L2, `<=>` cosine, `<#>` negative inner product, `<+>` L1 | arrays | expert | RC: needs `@electric-sql/pglite-pgvector`; embeddings must be precomputed in the dataset (no model inside SQL). Verified incl. halfvec, sparsevec, binary_quantize | Mixed dimensions (22000) · forgets `<#>` is NEGATIVE inner product · cosine distance vs similarity (`1 - d`) |
| `vector-knn-search` | k-NN semantic search | `ORDER BY embedding <=> q LIMIT k`; "find similar items"; combine with WHERE | vector-basics, order-by | expert | RC (as above) | Sorts DESC by distance · no LIMIT · compares distances across metrics |
| `vector-indexes` | HNSW & IVFFlat | Approximate indexes; opclass per metric; m/ef_construction/ef_search; lists/probes; iterative scans; filtered queries return fewer rows | vector-knn-search, explain-basics | master | RC (both build in PGlite, verified; tiny tables make the planner prefer Seq Scan, so use ≥ 10k rows or `SET enable_seqscan = off` for the demo) | Opclass doesn't match operator (index unused) · IVFFlat built on an empty table · expects exact results |
| `hybrid-search` | Hybrid search | Fuse FTS rank and vector distance (Reciprocal Rank Fusion) | vector-knn-search, fts-ranking-highlighting, cte-basics | master | RC | Adds raw scores on different scales · no dedup across lists |

### 2.10 Performance

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `explain-basics` | EXPLAIN | Plan tree, node types, cost, rows, width; read inside-out | logical-processing-order | adept | R | Cost read as milliseconds · reads top-down · ignores row estimates |
| `explain-analyze` | EXPLAIN ANALYZE / BUFFERS | Actual time, rows, loops; buffers (default in PG18); estimate vs actual | explain-basics | expert | RC: WASM timings differ from a server; no parallel plans (`max_parallel_workers_per_gather = 0`); ANALYZE executes DML (wrap in BEGIN/ROLLBACK); `EXPLAIN (GENERIC_PLAN)` with `$1` must go through exec, not a parameterized query (verified) | EXPLAIN ANALYZE a DELETE without rollback · misreads per-loop time · trusts a cold first run |
| `scan-types` | Scan nodes | Seq Scan, Index Scan, Index Only Scan, Bitmap Index/Heap Scan | explain-basics, btree-index | expert | R (all four observed) | Seq Scan = always bad · doesn't know bitmap scans can combine indexes |
| `join-algorithms` | Join algorithms | Nested Loop, Hash Join, Merge Join; when each wins (Winand) | scan-types, inner-join | expert | R | Blames nested loops universally · no index on the inner side of a nested loop |
| `btree-index` | B-tree indexes | Anatomy (leaf chain + tree), CREATE INDEX, what they serve (=, ranges, ORDER BY, `LIKE 'prefix%'`) | explain-basics | adept | R | Index on every column (Karwin Index Shotgun) · expects it to help `LIKE '%x'` · forgets write cost |
| `multicolumn-index` | Multicolumn indexes | Column order: equality first, then range; PG18 skip scan | btree-index | expert | R (skip scan verified: `Index Searches: 6` on `(grp, v)` filtered by v only) | Range column first · two single-column indexes assumed equal to one composite · redundant prefixes |
| `partial-index` | Partial indexes | `WHERE` on the index (active rows, unique where not deleted) | btree-index | expert | R | Query predicate doesn't imply index predicate · parameterized predicate can't match |
| `expression-index` | Expression indexes | `lower(email)`, `(doc->>'k')`, date of a timestamp | btree-index, sargability | expert | R | Query expression differs from indexed one · non-IMMUTABLE function (42P17) |
| `covering-index` | Covering indexes & index-only scans | INCLUDE columns; visibility map | multicolumn-index, vacuum-mvcc | expert | RC: index-only scans appear only after a manual VACUUM because autovacuum never runs in PGlite (verified: Bitmap Heap Scan before, `Index Only Scan ... Heap Fetches: 0` after) | Expects index-only scans on a fresh table · INCLUDE vs key columns |
| `gin-gist-brin-hash` | Specialized index types | GIN (arrays, jsonb, FTS, trgm), GiST (ranges, geometry, exclusion), BRIN (huge naturally ordered tables), hash, bloom; physical correlation | btree-index | expert | R (all built, verified) | BRIN on random-order data · GIN for ordering · hash for ranges |
| `sargability` | Sargable predicates | Don't wrap indexed columns in functions/math/casts; leading wildcard; "smart logic" (Winand Obfuscated Conditions) | btree-index | expert | R (verified: `score + 0 = 42` → Seq Scan) | `WHERE date(ts) = ...` · `WHERE col + 0 = ...` · `WHERE ($1 IS NULL OR col = $1)` |
| `index-selection-reasons` | Why isn't my index used? | Selectivity, small tables, stale stats, type mismatch, opclass/collation (`text_pattern_ops`), ORDER BY + LIMIT | sargability, statistics | expert | RC (stats require explicit ANALYZE) | `enable_seqscan = off` as a fix · ignores that a seq scan wins at 30 % selectivity |
| `statistics` | Planner statistics | pg_stats (n_distinct, MCV, histogram, correlation), ANALYZE, CREATE STATISTICS | explain-analyze | expert | RC: autovacuum/autoanalyze never run in PGlite (single-user backend; verified `last_autovacuum` stays NULL with 50 % dead tuples). Run ANALYZE explicitly after loads | Bad estimates after bulk load · correlated columns underestimated |
| `vacuum-mvcc` | VACUUM & bloat | Dead tuples, VACUUM vs VACUUM FULL, visibility map, freezing / XID wraparound (conceptual) | mvcc-concept | expert | RC: VACUUM must be sent alone (fails in a multi-statement batch with 25001, verified); bloat visible via pg_relation_size (3584 kB → 1776 kB after VACUUM FULL, verified) | Expects DELETE to free space · VACUUM FULL as routine (exclusive lock) · VACUUM seen as optional |
| `pagination-performance` | OFFSET vs keyset pagination | `WHERE (score, id) < ($1, $2) ORDER BY score DESC, id DESC LIMIT n` + matching index (Winand, Fontaine "no offset") | limit-offset, multicolumn-index | expert | R (row comparison verified) | No unique tie-breaker · mixed ASC/DESC directions · deep OFFSET pages |
| `n-plus-one` | N+1 and set-based thinking | One query with JOIN / `= ANY($1)` instead of a loop | inner-join, btree-index | adept | RC: shown by the app replaying N queries (verified on 1M rows: 1000 point lookups 60 s without index vs 0.24 s with PK) | Loop of SELECTs · correlated subquery as hidden N+1 |
| `query-rewriting` | Query rewriting | EXISTS vs IN vs JOIN, UNION ALL instead of OR, pre-aggregation, removing needless DISTINCT/ORDER BY | explain-analyze, semi-join-exists | expert | R | Rewrites without measuring · assumes the planner can't flatten subqueries |
| `write-performance` | Write costs | Index overhead on DML, HOT updates, batching, COPY vs INSERT, unused indexes (pg_stat_user_indexes) | btree-index, bulk-load-copy | expert | RC | Over-indexing · row-by-row autocommit inserts |
| `partitioning` | Declarative partitioning | RANGE/LIST/HASH, pruning, default partition, detach/drop for retention (fix for Metadata Tribbles) | create-table, explain-basics | master | R (pruning verified) | Expects every query to get faster · partition key absent from WHERE · too many tiny partitions |
| `query-stats` | pg_stat_statements & stats views | Find heavy queries by total time; pg_stat_user_tables/indexes, pg_stat_io | explain-analyze | master | RC (pg_stat_statements must be in the `extensions` option at PGlite init; then works, verified) | Optimizes the slowest single query instead of total time · resets stats blindly |

### 2.11 Advanced

| id | name | summary | prereqs | tier | feas | mistakes |
|---|---|---|---|---|---|---|
| `sql-functions` | SQL functions | CREATE FUNCTION LANGUAGE sql, SQL-standard `RETURN` body, RETURNS TABLE/SETOF, IMMUTABLE/STABLE/VOLATILE | cte-basics | expert | R (verified) | IMMUTABLE on a function calling now() · overload ambiguity (42725) |
| `plpgsql-basics` | PL/pgSQL | DECLARE, IF/CASE, LOOP/FOR/FOREACH, RETURN QUERY, RAISE, EXCEPTION blocks, DO | sql-functions | expert | RC: RAISE NOTICE output must be captured with PGlite's `onNotice` and shown in a console panel | Row-by-row loops instead of set SQL · SELECT INTO without STRICT · variable shadows column (42702) |
| `procedures` | Procedures & transaction control | CREATE PROCEDURE, CALL, COMMIT/ROLLBACK inside | plpgsql-basics, transactions-basics | master | RC: COMMIT inside a procedure works only when CALL is sent as a lone statement (2D000 in a batch, verified) | Function used where transaction control is needed · procedure called in SELECT |
| `dynamic-sql` | Dynamic SQL | EXECUTE format('%I %L'), USING | plpgsql-basics, sql-injection | master | R | Concatenating user input · `%s` instead of `%I`/`%L` |
| `triggers` | Triggers | BEFORE/AFTER, ROW/STATEMENT, NEW/OLD, TG_OP, WHEN, transition tables; event triggers | plpgsql-basics | expert | R (row and event triggers verified) | BEFORE trigger returns NULL and silently skips the row · trigger recursion · hidden business logic |
| `audit-history` | Audit & history | Trigger writes to_jsonb(OLD/NEW) or hstore diffs with who/when | triggers, jsonb-construction | expert | R | No actor/timestamp captured · statement trigger without transition tables |
| `stored-logic-guidelines` | Where logic lives | Constraints first, then functions, then triggers; trade-offs vs app tier; rules are a "don't" | triggers, check-constraint | master | C | Everything in triggers · nothing in the DB, invariants only in app code |
| `listen-notify` | LISTEN / NOTIFY | Async events to clients, payload ≤ 8000 bytes, delivered at commit | triggers | master | RC (works inside one PGlite instance via `db.listen`, verified; no other clients) | Expects delivery before COMMIT · large payloads |
| `roles-privileges` | Roles & privileges | CREATE ROLE, GRANT/REVOKE, ownership, least privilege | create-table | expert | RC: single connection; simulate users with `SET ROLE` (verified 42501 permission denied) | Grants on table but not schema/sequence · app connects as superuser |
| `row-level-security` | Row-level security | ENABLE RLS, CREATE POLICY USING / WITH CHECK, FORCE | roles-privileges | master | RC: works after `SET ROLE` to a non-superuser (verified read filter and WITH CHECK 42501). Default PGlite user `postgres` is superuser and always bypasses RLS, even with FORCE (verified) | Tests as superuser and thinks RLS is broken · USING without WITH CHECK for writes · forgets RLS without policies = deny all |
| `sql-injection` | SQL injection & parameters | Bind parameters (`$1`), PREPARE/EXECUTE, quote_ident/quote_literal/format (Karwin SQL Injection) | where-comparison | adept | RC (PREPARE/EXECUTE verified; injection shown in a simulated "app" that concatenates strings) | Escapes by hand · tries to parameterize identifiers (use `%I`) |
| `upsert-patterns` | Idempotent loads & counters | Staging + MERGE/ON CONFLICT, atomic counters, insert-or-select | upsert-on-conflict, merge-statement | master | R | Read-then-write races · `ON CONFLICT DO NOTHING RETURNING` returns nothing for existing rows |
| `operations-overview` | Operations overview | Backups (pg_dump), replication, pooling, config tuning, upgrades | none | master | C | A replica is not a backup · tuning before measuring |

**Count**: 199 concepts (query 82, mutation 21, schema 26, types 37, performance 20, advanced 13; the query track spans 2.1 to 2.6: foundations 19, expressions 10, aggregation 9, joins 15, subqueries/CTEs 13, windows/patterns 16). Track per id: rows in 2.1 to 2.6 are `query`, 2.7 `mutation`, 2.8 `schema`, 2.9 `types`, 2.10 `performance`, 2.11 `advanced`.

---

## 3. Recommended sequence: worlds and chapters

Rules used to order: (a) single table before multi-table (SQLBolt, Select Star); (b) NULL right after filtering because every later topic leaks NULLs (Fontaine, Celko, Karwin "Fear of the Unknown"); (c) aggregates before joins so learners see one table collapse before two tables multiply (Select Star); (d) logical processing order taught explicitly once aggregates exist (SQLBolt lesson 12); (e) read before write, but a tiny CREATE TABLE early as ownership is motivating (Practical SQL ch. 2: offer it as a world 1 bonus level); (f) transactions before schema because DDL lessons need ROLLBACK as a safety net; (g) PostgreSQL types after the standard core; (h) performance after the learner can write non-trivial queries (Winand: indexing is a developer task, but needs joins/ORDER BY/top-N); (i) security and stored logic last.

The main path has 40 chapters in 11 worlds. Three extra chapters are marked **side quest** (optional branches on the map, unlock after the parent chapter): they hold conceptual or niche material.

### World 1: The Tavern of First Queries (novice)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 1 | Hello, Table | relational-model, sql-statement-anatomy, select-columns, select-star, column-aliases, quotes-and-identifiers | Smallest runnable unit; quote rules cause most early syntax errors |
| 2 | Sifting the Ledger | where-comparison, boolean-logic, in-and-between, like-ilike | Filtering is the next reflex; AND/OR precedence while queries are tiny |
| 3 | The Void | null-basics, three-valued-logic, is-distinct-from, coalesce-nullif (intro) | NULL breaks every later topic; teach it before aggregates and outer joins |
| 4 | Order in the Hall | order-by, limit-offset, distinct, collation-sorting | Completes single-table reading; C-collation surprise taught deliberately |
| Boss | "The Tavern Keeper's Ledger": multi-clause single-table report with NULLs and sorting |

### World 2: The Counting House (novice → adept)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 5 | Shaping Columns | arithmetic-expressions, type-casting, case-expression, coalesce-nullif, numeric-functions | Computed columns before aggregation; integer division and casts |
| 6 | Words and Patterns | string-functions, regex-matching, data-cleaning | Text manipulation; cleaning as a story (Practical SQL) |
| 7 | Calendars and Clocks | date-time-basics, date-functions, interval-arithmetic | Dates appear in every dataset; DST and month math traps |
| 8 | Tally the Loot | aggregate-functions, count-variants, group-by, having, logical-processing-order, aggregate-filter, collection-aggregates | Whole-table → grouped aggregates (Select Star order); order of execution explains 42803/42703 |
| Boss | "Audit of the Counting House": grouped report with CASE buckets, dates and HAVING |

### World 3: The Bridges (apprentice → adept)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 9 | Two Tables Meet | keys-and-relationships-intro, table-aliases, inner-join, multi-table-join, join-using-natural | Joins once one-table thinking is solid |
| 10 | Outer Bridges and Mirrors | left-join, right-full-join, self-join, cross-join, non-equi-join, join-fanout | Outer joins reuse NULL knowledge; fan-out connects joins to aggregates |
| Boss | "The Broken Bridge": find heroes with no guild, count quests without double counting |

### World 4: The Nested Catacombs (adept → expert)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 11 | Queries within Queries | scalar-subquery, in-subquery, derived-tables, correlated-subquery | Builds nesting gradually ("So many brackets" research) |
| 12 | Exists or Not | semi-join-exists, anti-join, not-in-null-trap, any-all | Semi/anti joins need correlation; NOT IN trap needs 3VL |
| 13 | Unions and Named Spells | set-operations, values-lists, cte-basics, generate-series | CTEs reduce nesting load before recursion and windows |
| 14 | The Endless Stair | recursive-cte, recursive-graph-walks, hierarchy-models (intro) | Recursion is the CTE capstone; org charts and skill trees |
| Boss | "Depths of the Catacombs": multi-CTE query with an anti-join and a recursive walk |

### World 5: The Observatory (adept → master)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 15 | Windows on the Ranks | window-basics, window-partition-order, ranking-functions, lag-lead, window-frames, running-totals | Windows after GROUP BY (contrast) and CTEs (to filter on window output) |
| 16 | Champions of Each Guild | distinct-on, top-n-per-group, lateral-join, deduplication | The most asked interview pattern, three solutions compared |
| 17 | Patterns in Time | date-bucketing, time-series-gap-fill, gaps-and-islands, sessionization | Combines dates + generate_series + windows |
| 18 | The Grand Report | grouping-sets, pivoting, statistical-aggregates, ordered-set-aggregates, relational-division, random-sampling | Analytics capstone (Mode advanced/analytics tracks, Celko) |
| Boss | "The Astronomer's Almanac": leaderboard with streaks, top 3 per season and a pivoted summary |

### World 6: The Forge (novice → expert; writing data)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 19 | Forging Rows | insert-basic, insert-multi-row, default-values, returning-clause, insert-select, sequences | Writing after reading: learners can verify inserts with SELECT |
| 20 | Reforging and Banishing | update-basic, update-from, delete-basic, delete-using, truncate | UPDATE/DELETE reuse WHERE and joins; "forgot WHERE" trap in a safe sandbox |
| 21 | The Pact | transactions-basics, savepoints, constraint-errors | Safety net before schema work; SQLSTATE literacy |
| 22 | Merge and Upsert | upsert-on-conflict, merge-statement, data-modifying-cte, bulk-load-copy | Advanced writes need unique constraints and transactions |
| 23 | **Side quest**: Many Hands | isolation-levels, row-locking, optimistic-locking, mvcc-concept | Concurrency is conceptual in PGlite; scripted two-session replays |
| Boss | "The Smith's Ledger": idempotent import of a supply feed with MERGE inside a transaction |

Note: World 6 chapters 19 and 20 can be unlocked right after World 2 for players who want to write early (novice tier). The adaptive engine should allow that branch.

### World 7: The Architect's Tower (apprentice → master)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 24 | Laying Foundations | data-type-basics, create-table, primary-key, identity-columns, not-null-default, naming-conventions, drop-objects | DDL basics once learners know what queries need |
| 25 | Binding Laws | unique-constraint, check-constraint, foreign-key, fk-actions, generated-columns, alter-table | Constraints fire errors learners already know from World 6 |
| 26 | Blueprints | er-modeling, relationship-cardinality, normalization-1nf, normalization-2nf-3nf, normalization-bcnf-beyond | Hernandez process; refactor messy tables |
| 27 | Lenses and Realms | views, materialized-views, schemas-search-path, catalog-introspection | Abstraction and namespaces after tables exist |
| 28 | Cursed Designs | design-antipatterns, denormalization, hierarchy-models, temporal-constraints (preview) | Karwin antipatterns need normalization vocabulary |
| Boss | "Raise the Tower": design a schema from a spec; hidden tests insert valid and invalid rows |

### World 8: The Alchemist's Vault (apprentice → master; PostgreSQL types)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 29 | Precise Measures | numeric-types, floating-point, money-handling, text-types, boolean-type, uuid-type | Type choice pitfalls (Don't Do This) |
| 30 | Shaped Data | enum-types, domain-types, composite-types, arrays | Arrays prepare ANY, unnest and vectors |
| 31 | Scrolls of JSON | json-vs-jsonb, jsonb-operators, jsonb-construction, jsonb-decomposition, jsonb-modification | Most requested modern skill; uses LATERAL from World 5 |
| 32 | Deep JSON | sql-json-path, json-table, jsonb-indexing, hstore | Standard SQL/JSON (PG17) once operators are fluent |
| 33 | Bound by Time | timezones, range-types, multirange-types, temporal-constraints | Bookings; exclusion constraints need ranges + schema |
| 34 | **Side quest**: Exotic Matter | network-types, bytea-binary, geometric-types, ltree, case-insensitive-text, pgcrypto-hashing | Niche types, each a short level |
| Boss | "The Philosopher's Inventory": JSONB inventories + ranges + arrays in one quest |

### World 9: The Oracle's Library (expert → master; search)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 35 | Words of Power | full-text-search, fts-ranking-highlighting, fts-indexing, trigram-search, fuzzy-string-matching | Replaces `LIKE '%x%'` (Karwin Poor Man's Search Engine) |
| 36 | Vector Constellations | vector-basics, vector-knn-search, vector-indexes, hybrid-search | Semantic search builds on arrays, ORDER BY/LIMIT and FTS ranking |
| Boss | "The Oracle's Riddle": hybrid search over lore scrolls with typo tolerance |

### World 10: The Clockwork Engine (adept → master; performance)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 37 | Reading the Runes | explain-basics, explain-analyze, scan-types, join-algorithms | Learn to read plans before changing anything |
| 38 | Index Forging | btree-index, multicolumn-index, partial-index, expression-index, covering-index, gin-gist-brin-hash | Winand order: anatomy → WHERE → concatenated keys → functions → partial → clustering |
| 39 | Why Not My Index? | sargability, index-selection-reasons, statistics, query-rewriting, cte-materialization | Diagnosis after construction |
| 40 | Undead Rows and Big Tables | vacuum-mvcc, pagination-performance, n-plus-one, write-performance, partitioning, query-stats | Scale concerns last, with MVCC from World 6 |
| Boss | "Overclock the Engine": bring 5 slow queries under a buffer budget |

### World 11: The Astral Spire (expert → master)
| # | Chapter | Concepts | Why here |
|---|---|---|---|
| 41 | Spellcrafting | sql-functions, plpgsql-basics, procedures, dynamic-sql | Code in the database after mastering set-based SQL (avoid loop habits) |
| 42 | Wards and Gatekeepers | triggers, audit-history, listen-notify, roles-privileges, row-level-security, sql-injection, upsert-patterns, stored-logic-guidelines | Enforcement and security close the loop with constraints |
| 43 | **Side quest**: Trials of Mastery | operations-overview + mixed capstones over all datasets | Post-game: timed, no hints, any technique |
| Final boss | "The Astral Throne": multi-tenant guild app schema with RLS, audit trigger, upsert import and a tuned leaderboard query |

Coverage check: every catalog id appears in at least one chapter above (`sql-injection` also previewed in World 6 when `$1` parameters appear; `hierarchy-models` spans chapters 14 and 28).

---

## 4. Pedagogy notes

### 4.1 What to teach before what (hard dependencies)
* NULL before aggregates and outer joins; 3VL before NOT IN and CHECK. Most "wrong count" bugs come from NULL.
* Aggregates before joins, then join fan-out right after outer joins (inflated sums are the most common silent error).
* Logical processing order as an explicit lesson once GROUP BY exists; revisit it for windows ("windows run after WHERE and GROUP BY, before ORDER BY").
* CTEs before recursive CTEs and before windows: filtering on `row_number()` requires a wrapping query.
* Transactions before DDL and before DELETE-heavy levels; every mutation exercise runs inside a transaction the app rolls back.
* Indexes after ORDER BY/LIMIT, joins and EXISTS: Winand's chapters assume them. MVCC before VACUUM and covering indexes.
* Set-based SQL before PL/pgSQL (prevents row-by-row loop habits; Fontaine, Karwin).

### 4.2 Classic misconceptions (to target with predict-the-output)
Grouped by Miedema et al. categories:
* **Language-based**: "DISTINCT is a function of one column"; "HAVING is another WHERE"; "BETWEEN is exclusive"; "LIKE ignores case"; "ORDER BY in a subquery/view persists"; `AND` in UPDATE SET.
* **Mental model**: SQL executes top to bottom as written; tables have an order; NULL is a value equal to itself; `count(col)` counts rows; GROUP BY sorts; a LEFT JOIN with a WHERE on the right table still keeps all left rows; CTEs are temp tables; UPDATE edits rows in place; DELETE frees disk.
* **Generalization**: "indexes always help" / "more indexes = faster" (Karwin Index Shotgun); "SELECT * is slow" (Winand myth); "UNION and UNION ALL are the same"; "rank and row_number are the same".
* **Prior knowledge** (from programming): 0-based arrays and substrings; `==`; double quotes for strings; float for money; loops instead of sets; dates as strings.
* **Logical (Taipalus)**: AND/OR swapped, joins on unrelated columns, oversimplified query (missing a condition or table).

### 4.3 Exercise styles and when they work
| Style | Use for | Grading |
|---|---|---|
| **Incantation** (Typing Club drill: type the shown query exactly) | Syntax fluency in the learn phase of novice chapters; muscle memory for `JOIN ... ON`, `GROUP BY`, `OVER (PARTITION BY ...)` | Keystroke accuracy + WPM, then run it |
| **Predict-the-output** | NULL logic, join row counts, window frames, ties, set operations, MVCC | Multiple choice or row count; reveal by running |
| **Write-from-spec** (target result grid shown) | Core of every chapter | Result-set equality (order-insensitive unless ORDER BY required; column names optional; numeric tolerance) |
| **Parsons / reorder clauses** | Clause order, CTE chains, recursive CTE anatomy | Order check |
| **Fix-the-bug** (broken query + its error or wrong output) | SQLSTATE literacy (42803, 42702, 42P20, 23505), NOT IN trap, LEFT JOIN + WHERE, fan-out | Must produce the expected result |
| **Refactor** | Correlated subquery → JOIN, NOT IN → NOT EXISTS, EAV → columns, Jaywalking → junction table, spaghetti → CTEs | Same result + structural check (AST/regex: e.g. no `NOT IN`) |
| **Optimize** | World 10: add an index or rewrite to hit a plan shape or buffer budget | `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`: node types, `Shared Hit Blocks + Read Blocks` ≤ budget. Use buffers, not ms (WASM timings vary) |
| **Mutate-to-state** | INSERT/UPDATE/DELETE/MERGE | Diff target table(s) against expected state after the statement; run inside BEGIN ... ROLLBACK |
| **Design-to-tests** | World 7 | Hidden test suite inserts valid rows (must succeed) and invalid rows (must fail with a given SQLSTATE) |
| **Explain-the-plan** | Reading runes | Click the node that causes the cost; choose the index that would help |

### 4.4 Scaffolding difficulty
* Inside a chapter: learn (2 to 4 micro-lessons with incantations) → guided exercises (partial query with blanks) → free exercises → boss. Mirrors SQLBolt (one concept, one exercise) and Typing Club pacing.
* Reuse one dataset per world (pgexercises, Select Star): learners spend cognitive load on SQL, not on the schema. Introduce a new dataset only at world boundaries, with a schema tour level.
* Fade scaffolds: show schema + sample rows → show schema only → no schema (learner introspects with `information_schema` from World 7 on).
* Nesting: CTE-first formulation for multi-step problems (reduces bracket load); later ask to inline or compare.
* Hints, escalating: (1) concept reminder linked to the catalog id; (2) SQLSTATE explanation in plain words, with the error `position` highlighted in the editor; (3) the misconception from the catalog row matching the diff (e.g. result has more rows than expected + query has JOIN + aggregate → `join-fanout`); (4) partial solution.
* Adaptive engine signals: SQLSTATE code, error position token, result diff shape (missing rows, extra rows, duplicated rows, NULL vs 0, wrong order, wrong column count), AST features (NOT IN, missing WHERE in UPDATE, window in WHERE). Map each to catalog mistakes.
* Spaced review: bosses mix concepts from earlier worlds; side quests unlock review "bounties" for concepts with high error rates.

---

## 5. Dataset suggestions

All generated deterministically (`SELECT setseed(0.42)` then random-based generators; verified reproducible) or shipped as `dumpDataDir` tarballs for instant load. Keep tables small (≤ 5k rows) for worlds 1 to 9 so result grids are readable; World 10 uses a "large mode" of the leaderboard (100k to 300k rows: 1M rows takes ~3.7 s to generate and ~175 MB in memory in Node, too heavy for a browser tab).

Use lower-case ASCII names for sortable labels where sort order matters early (C collation), and include a few accented and capitalized names on purpose for the collation lesson.

### 5.1 Starport Exchange (space trading post) · Worlds 1 to 3, 6
Tables: `factions(id, name, homeworld_id)`, `planets(id, name, sector, population bigint, discovered_on date)`, `pilots(id, name, callsign, faction_id NULL, rank, credits numeric(12,2), joined_at timestamptz)`, `ships(id, pilot_id, model, cargo_capacity int, hull_integrity numeric)`, `commodities(id, name, category, base_price numeric(10,2), legal boolean)`, `trades(id, ship_id, planet_id, commodity_id, qty int, unit_price numeric(10,2), traded_at timestamptz)`, `routes(from_planet_id, to_planet_id, distance_ly numeric)`, `contraband_seizures(id, ship_id, commodity_id, seized_at)`.
Good for: select-columns through distinct, null-basics (pilots without faction, unknown populations), arithmetic/casting (prices, qty), date functions on `traded_at`, aggregates, inner/left/self joins (`routes`), join-fanout (trades + seizures), insert/update/delete/transactions (trading a cargo), money-handling, numeric-types, sequences, upsert (price feed), merge, bulk-load-copy (manifest CSV).

### 5.2 Guild of the Silver Dragon (fantasy guild) · Worlds 4, 7, 8
Tables: `guilds(id, name, founded_on)`, `heroes(id, name, class rarity-like enum, level, guild_id, mentor_id → heroes, xp, gold numeric, stats composite(str,dex,int), tags text[])`, `quests(id, title, region, difficulty, reward_gold, prerequisite_quest_id)`, `quest_completions(hero_id, quest_id, completed_at)`, `items(id, name, rarity enum, base_value, attributes jsonb)`, `inventories(hero_id, doc jsonb)` (nested bags: `{"bags":[{"slot":1,"items":[{"item":"potion","qty":3,"enchant":{"fire":2}}]}]}`), `skill_tree(skill_id, parent_skill_id, class, name, path ltree)`, `adventurer_sheet_legacy(...)` (deliberately unnormalized: `party_members text` comma list, `item1,item2,item3`, EAV `hero_attributes(hero_id, attr, value)`).
Good for: subqueries, EXISTS/anti-join (heroes with no quests), relational-division (completed all quests of a region), recursive-cte (mentor lineage, quest prerequisites, skill tree), hierarchy-models + ltree, enum/domain/composite/arrays, all JSONB concepts + json-table + jsonb-indexing, normalization and design-antipatterns (refactor the legacy sheet), fk-actions (disbanding a guild), generated-columns (level from xp), triggers/audit (gold changes), RLS (each guild master sees own heroes).

### 5.3 Bardic Beats (music streaming) · Worlds 5, 9
Tables: `artists(id, name, country, formed_year)`, `albums(id, artist_id, title, released_on)`, `tracks(id, album_id, title, duration interval, genre, lyrics text, lyrics_tsv tsvector GENERATED, embedding vector(16))`, `listeners(id, handle, country, timezone text, signed_up_at)`, `plays(id, listener_id, track_id, played_at timestamptz, ms_played int)`, `playlists(id, listener_id, name, track_ids int[])`, `follows(follower_id, followee_id)`, `track_tags(track_id, tag)`.
Embeddings: precomputed small vectors (16 to 64 dims) where genre/mood clusters are visible, so "find similar tracks" gives intuitive answers; ship a few `query_vectors(label, embedding)` like "calm forest night".
Good for: window functions (rank tracks per artist, LAG between plays), running-totals (listening time), sessionization (plays gap > 30 min), gaps-and-islands (daily listening streaks), date-bucketing + gap-fill (plays per hour), timezones (listener local hour), top-n-per-group, pivoting (plays by weekday), FTS on lyrics (english config), trigram (typo'd artist search), fuzzy-string-matching, vector-basics/knn/indexes, hybrid-search, follows graph (recursive-graph-walks with cycles).

### 5.4 Dungeon Delve Leaderboard · Worlds 5, 10
Tables: `players(id, handle citext, region, created_at, banned_ip inet NULL)`, `seasons(id, name, during tstzrange)`, `runs(id, player_id, season_id, dungeon, started_at, ended_at, score int, floor_reached, seed bigint, death_cause NULL)` (partitioned by season in the performance world), `achievements(id, code, name)`, `player_achievements(player_id, achievement_id, unlocked_at)`, `ip_bans(network cidr, reason)`, `daily_logins(player_id, day date)` (with duplicates on purpose).
Sizes: small (2k runs) for World 5; large (100k to 300k runs) for World 10.
Good for: ranking-functions, distinct-on, top-n-per-group, deduplication (duplicate logins), gaps-and-islands (login streaks), keyset pagination of the leaderboard, n-plus-one (per-player best run), all index concepts (composite `(season_id, score DESC, id)`, partial index on unfinished runs, expression index on `lower(handle)`, covering index for leaderboard), sargability (`date(started_at)`), statistics/ANALYZE, vacuum-mvcc (mass delete of cheaters), partitioning by season, network-types (bans), grouping-sets (by region/dungeon), statistical/ordered-set aggregates (median score), random-sampling.

### 5.5 The Wandering Star Inn (bookings across realms) · Worlds 6, 8
Tables: `realms(id, name, timezone text)` (real IANA zones: Europe/Paris, Asia/Tokyo, America/Sao_Paulo, Pacific/Chatham), `rooms(id, realm_id, name, beds, nightly_rate numeric(8,2), amenities text[])`, `guests(id, name, email citext, realm_id)`, `bookings(id, room_id, guest_id, stay daterange or tstzrange, status enum, created_at)` with `EXCLUDE USING gist (room_id WITH =, stay WITH &&)` and the PG18 `WITHOUT OVERLAPS` variant, `rate_seasons(id, realm_id, period daterange, multiplier)`, `staff_shifts(staff_id, shift tstzrange)`, `price_feed_staging(...)` for MERGE.
Good for: range-types, multirange-types (free availability = all minus booked via range_agg), temporal-constraints, timezones and DST (check-in at local 15:00 across zones), interval-arithmetic (stays across month ends), non-equi-join (rate seasons), generate-series (calendar of a room), time-series-gap-fill (occupancy per day), merge-statement + upsert-patterns (price feeds), transactions/savepoints (booking + payment), isolation-levels and row-locking narrated as "two clerks book the last room", optimistic-locking.

### 5.6 The Great Library of Aethel (knowledge and hierarchy) · Worlds 4, 8, 9, 11
Tables: `sections(id, name, path ltree)` (Arcana.Fire.Dragons), `staff(id, name, title, reports_to → staff)`, `scrolls(id, section_id, title, author, language, body text, body_tsv tsvector GENERATED, embedding vector(32), written_on date, checksum bytea)`, `citations(citing_scroll_id, cited_scroll_id)` (graph with cycles), `loans(id, scroll_id, reader_id, loan_period tstzrange)`, `readers(id, name, password_hash text, clearance int)`, `access_log(id, reader_id, scroll_id, at, ip inet)`.
Good for: recursive-cte (org chart from `reports_to`), recursive-graph-walks with CYCLE (citations), ltree, FTS in two languages (`english` and `french` configs plus unaccent), ts_headline, hybrid-search, pgcrypto-hashing (readers), bytea (checksums), roles-privileges and row-level-security (readers only see scrolls under their clearance), triggers/audit-history (loan changes), listen-notify (overdue alerts), sql-functions/plpgsql (fine computation), dynamic-sql (per-section reports).

---

## Appendix A: PGlite feasibility, verified facts (PGlite 0.5.13, PostgreSQL 18.6, Node, 2026-10-31)

| Area | Result |
|---|---|
| Version | `PostgreSQL 18.6 (PGlite 0.5.13) on wasm32-unknown-emscripten, 32-bit` |
| Defaults | `TimeZone = GMT`, `DateStyle = ISO, MDY`, `default_text_search_config = simple`, DB collation `C` (ctype `C.UTF-8`), `max_parallel_workers_per_gather = 0`, `shared_preload_libraries = pg_stat_statements` |
| Extensions | All listed contrib extensions created successfully, plus `vector`. Additional bundled contrib present in the package: file_fdw, moddatetime, passwordcheck, pg_freespacemap, pg_surgery, pg_visibility, pg_walinspect. `postgres_fdw` and `postgis`: 0A000 not available |
| Timeouts | `statement_timeout` is **not enforced** (100 ms setting, 20M-row aggregate ran 4.2 s). Infinite recursion or huge cross joins will hang the engine |
| Batching | `db.query()` rejects multiple statements (42601 "cannot insert multiple commands into a prepared statement"); `db.exec()` runs a batch as one implicit transaction, so `VACUUM` (25001) and procedures that COMMIT (2D000) fail inside a batch but work alone |
| Errors | Error objects carry `code`, `message`, `detail`, `hint`, `position`, `constraint`, `table`, `column` (verified on 23505 and 42601) |
| Results | Object row mode collapses duplicate column names (`SELECT 1 AS a, 2 AS a` → `{a:2}`; also `?column?` collisions); `rowMode: 'array'` + `fields` keeps them. Default parsers: timestamptz → JS Date (UTC ISO, offset lost), json → parsed object (dup keys lost), int8 → JS number, numeric → string, bytea → Uint8Array. Custom `parsers` returning raw text give psql-like output (verified) |
| PG18 features | uuidv7, uuid_extract_version, virtual + stored generated columns, `RETURNING old.*/new.*`, `WITHOUT OVERLAPS` PK (23P01), B-tree skip scan (`Index Searches: 6`), `CHECK ... NOT ENFORCED`, casefold, array_sort, array_reverse, buffers shown by EXPLAIN ANALYZE |
| PG16/17 features | JSON_TABLE, json_exists/json_value/json_query, IS JSON, MERGE RETURNING merge_action(), WHEN NOT MATCHED BY SOURCE, any_value, EXPLAIN (GENERIC_PLAN), EXPLAIN (SERIALIZE, MEMORY), pg_stat_io |
| Concurrency | `BEGIN ISOLATION LEVEL SERIALIZABLE`, `FOR UPDATE SKIP LOCKED`, advisory locks, deferrable FKs, savepoints, cursors, PREPARE/EXECUTE all run; one session only, so no contention |
| Security | CREATE ROLE, GRANT, `SET ROLE` → 42501 permission denied works; RLS policies (USING and WITH CHECK) enforced for a non-superuser role; superuser `postgres` bypasses RLS even with FORCE |
| Misc | LISTEN/NOTIFY within the instance (`db.listen` received the payload); COPY to/from virtual FS files and `pg_read_file` on them; `CREATE DATABASE` succeeds but cannot be connected to (avoid); rules and event triggers work; updatable view WITH CHECK OPTION (44000) |
| Performance | Cold start ~1.1 to 1.3 s (Node); 1M-row CTAS 3.7 s; 1000 point lookups on 1M rows: 60 s without index vs 0.24 s with PK; index-only scan only after VACUUM; autovacuum/autoanalyze never ran (`last_autovacuum` NULL with 50k dead tuples); VACUUM FULL halved relation size |
| Numerics | `round(2.5::float8) = 2`, `round(2.5) = 3`, `round(-2.5) = -3`; `0.1::float8 + 0.2::float8 = 0.30000000000000004`; `1::money * 3.333 = $3.33` |
| Collation | `C` order: `Apple, Zed, apple, eagle, zebra, éclair`; ICU `unicode`, `und-x-icu`, `pg_unicode_fast`, `pg_c_utf8` available; `CREATE COLLATION ... (provider = icu, deterministic = false)` works |

## Appendix B: engineering implications for the level designer and app

1. **Run PGlite in a Web Worker with a watchdog** (e.g. 3 s). Because statement_timeout is ignored, the only way to stop a runaway query is to terminate the worker and restore the dataset from a `dumpDataDir()` snapshot (or re-create from `loadDataDir`). Also cap result rows rendered (e.g. 500) and wrap learner SQL in `SELECT * FROM (...) LIMIT n` only where semantics allow.
2. **Show results like psql**: use `rowMode: 'array'` and raw-text parsers for all types, otherwise timestamps, json and bigint lessons display wrong values.
3. **Session preamble per dataset**: `SET TimeZone`, `SET default_text_search_config = 'english'`, `SELECT setseed(...)` where needed, and decide on collation (keep `C` and teach it, or define columns with `COLLATE "unicode"`).
4. **Statement splitting**: learner input may contain several statements; send VACUUM, CALL and `CREATE INDEX CONCURRENTLY` alone; run other statements via exec. For mutation grading, wrap in BEGIN/ROLLBACK (except lessons that teach COMMIT; restore snapshot afterwards).
5. **Load extensions at init** per world (pg_trgm, btree_gist, tablefunc, ltree, hstore, citext, unaccent, fuzzystrmatch, pgcrypto, pg_stat_statements, vector) since `CREATE EXTENSION` fails if the extension wasn't passed to `PGlite.create`.
6. **Hint engine inputs**: SQLSTATE `code`, `position` (highlight token), `detail`, `constraint`; plus result diffs. Notices (RAISE NOTICE, VACUUM VERBOSE) need the `onNotice` callback.
7. **Plans for grading**: use `EXPLAIN (FORMAT JSON)` and compare node types and buffer counts, never wall time. Run `ANALYZE` (and `VACUUM` where index-only scans matter) after loading each dataset, since nothing does it automatically.
8. **Concurrency lessons**: build a scripted "ghost session" timeline (precomputed outcomes shown step by step) for isolation anomalies, lock waits and deadlocks; the learner predicts what happens at each step.

### SQLSTATE quick reference (codes learners will meet, all observed or standard)
`42601` syntax error · `42703` undefined column · `42P01` undefined table / missing FROM entry · `42702` ambiguous column · `42803` grouping error · `42P20` window function in WHERE · `42P10` invalid column reference (DISTINCT ON / ON CONFLICT target) · `42883` operator/function does not exist · `42804` datatype mismatch · `42501` insufficient privilege · `42P17` invalid object definition (non-immutable expression) · `22P02` invalid text representation · `22003` numeric out of range · `22012` division by zero · `22001` string too long · `22000` data exception (vector dims, range union) · `21000` cardinality violation (subquery > 1 row, upsert/merge row twice) · `23502` not null · `23503` foreign key · `23505` unique · `23514` check · `23P01` exclusion · `428C9` generated always · `44000` view check option · `25P02` transaction aborted · `25001` active transaction (VACUUM) · `2D000` invalid transaction termination · `2BP01` dependent objects · `55000` object not in prerequisite state · `0A000` feature not supported · `40001` serialization failure · `40P01` deadlock.
