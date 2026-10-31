import type { Concept } from "./types";

/**
 * Concept catalog (docs/research/curriculum.md, section 2).
 * Order follows the catalog: query, mutation, schema, types, performance, advanced.
 */
const concepts: Concept[] = [
	{
		id: "relational-model",
		name: "Tables, rows and columns",
		summary:
			"A table is a set of rows that all share the same named, typed columns. Rows have no built-in order, and every query answers with a new table.",
	},
	{
		id: "sql-statement-anatomy",
		name: "Anatomy of a statement",
		summary:
			"A statement is made of clauses like SELECT and FROM, ends with a semicolon, and can hold -- line or /* block */ comments. Keywords are not case sensitive.",
		requires: ["relational-model"],
	},
	{
		id: "select-columns",
		name: "SELECT ... FROM",
		summary:
			"SELECT lists the columns you want, FROM names the table. Columns come back in the order you list them.",
		requires: ["sql-statement-anatomy"],
	},
	{
		id: "select-star",
		name: "SELECT *",
		summary:
			"The star expands to every column of the table. Great for exploring, fragile in saved code because the column list changes with the table.",
		requires: ["select-columns"],
	},
	{
		id: "quotes-and-identifiers",
		name: "Quotes: 'values' vs \"names\"",
		summary:
			"Single quotes make text values, double quotes make identifiers (table and column names). Unquoted names are folded to lower case; write O'Hara as 'O''Hara'.",
		requires: ["select-columns"],
	},
	{
		id: "column-aliases",
		name: "Column aliases",
		summary:
			"AS gives an output column a new name: SELECT credits AS wallet. Use double quotes for names with spaces or capitals.",
		requires: ["select-columns"],
	},
	{
		id: "arithmetic-expressions",
		name: "Computed columns",
		summary:
			"Columns can be computed with + - * / % and parentheses. Dividing two integers drops the fraction: 7 / 2 is 3.",
		requires: ["column-aliases"],
	},
	{
		id: "where-comparison",
		name: "WHERE comparisons",
		summary:
			"WHERE keeps only rows whose condition is true, using = <> < <= > >=. Text values go in single quotes.",
		requires: ["select-columns"],
	},
	{
		id: "boolean-logic",
		name: "AND, OR, NOT",
		summary:
			"Combine conditions with AND, OR and NOT. AND binds tighter than OR, so add parentheses when you mix them.",
		requires: ["where-comparison"],
	},
	{
		id: "in-and-between",
		name: "IN and BETWEEN",
		summary:
			"x IN (a, b, c) matches any value of a list; x BETWEEN low AND high includes both ends.",
		requires: ["boolean-logic"],
	},
	{
		id: "null-basics",
		name: "NULL and IS NULL",
		summary:
			"NULL means missing or unknown, not zero and not empty text. Test it with IS NULL or IS NOT NULL, never with = NULL.",
		requires: ["where-comparison"],
	},
	{
		id: "three-valued-logic",
		name: "Three-valued logic",
		summary:
			"A comparison with NULL is neither true nor false but UNKNOWN, and WHERE keeps only TRUE rows. That is why x <> 'a' silently drops rows where x is NULL.",
		requires: ["null-basics", "boolean-logic"],
	},
	{
		id: "is-distinct-from",
		name: "IS DISTINCT FROM",
		summary:
			"A NULL-safe comparison: IS DISTINCT FROM treats two NULLs as equal and a NULL vs a value as different, always answering true or false.",
		requires: ["three-valued-logic"],
	},
	{
		id: "like-ilike",
		name: "LIKE and ILIKE",
		summary:
			"Pattern matching on text: % matches any run of characters, _ exactly one. LIKE is case sensitive, ILIKE is not.",
		requires: ["where-comparison"],
	},
	{
		id: "order-by",
		name: "ORDER BY",
		summary:
			"Sort the result by one or more keys, each ASC or DESC. Without ORDER BY the row order is not guaranteed; NULLs sort last in ASC and first in DESC.",
		requires: ["select-columns"],
	},
	{
		id: "collation-sorting",
		name: "Collations and text order",
		summary:
			"How text sorts depends on the collation. This database uses C (byte) order, so 'Zed' comes before 'apple'; COLLATE \"unicode\" gives dictionary order.",
		requires: ["order-by"],
	},
	{
		id: "limit-offset",
		name: "LIMIT and OFFSET",
		summary:
			"LIMIT n keeps the first n rows, OFFSET skips some. Always pair them with ORDER BY, and use FETCH FIRST n ROWS WITH TIES to keep ties.",
		requires: ["order-by"],
	},
	{
		id: "distinct",
		name: "SELECT DISTINCT",
		summary:
			"DISTINCT removes duplicate result rows, comparing the whole row (every selected column), not just the first column.",
		requires: ["select-columns"],
	},
	{
		id: "logical-processing-order",
		name: "Logical processing order",
		summary:
			"A query runs FROM, WHERE, GROUP BY, HAVING, SELECT, DISTINCT, ORDER BY, LIMIT. That order explains why an alias works in ORDER BY but not in WHERE.",
		requires: ["column-aliases", "group-by"],
	},
	{
		id: "case-expression",
		name: "CASE",
		summary:
			"CASE WHEN condition THEN value ... ELSE value END picks a value per row, like an if/else inside a query. Without ELSE, unmatched rows get NULL.",
		requires: ["boolean-logic"],
	},
	{
		id: "coalesce-nullif",
		name: "COALESCE, NULLIF, GREATEST, LEAST",
		summary:
			"COALESCE returns its first non-NULL argument, NULLIF(a, b) turns a into NULL when it equals b (handy against division by zero).",
		requires: ["null-basics"],
	},
	{
		id: "type-casting",
		name: "Casting types",
		summary:
			"Convert values with CAST(x AS type) or x::type. Invalid input such as '12abc'::int raises an error.",
		requires: ["arithmetic-expressions"],
	},
	{
		id: "string-functions",
		name: "String functions",
		summary:
			"lower, upper, length, trim, substring, replace, split_part, concat and || reshape text. Positions start at 1, and 'a' || NULL is NULL.",
		requires: ["type-casting"],
	},
	{
		id: "regex-matching",
		name: "Regular expressions",
		summary:
			"~ and ~* match a regex (case sensitive or not); regexp_replace, regexp_matches and friends extract or rewrite text.",
		requires: ["like-ilike"],
	},
	{
		id: "numeric-functions",
		name: "Math functions",
		summary:
			"round, trunc, ceil, floor, abs, mod, power, sqrt and width_bucket shape numbers; to_char formats them as text.",
		requires: ["arithmetic-expressions"],
	},
	{
		id: "date-time-basics",
		name: "Dates and timestamps 101",
		summary:
			"Write dates as ISO literals like '2026-05-01'. Add days to a date with +, subtract two dates to get days, and use current_date or now().",
		requires: ["type-casting"],
	},
	{
		id: "date-functions",
		name: "Date functions",
		summary:
			"extract pulls out a field (year, month, dow), date_trunc rounds down to a unit, age and to_char compute and format.",
		requires: ["date-time-basics"],
	},
	{
		id: "interval-arithmetic",
		name: "Intervals",
		summary:
			"An interval is a duration like '3 days' or '1 month'. Month arithmetic clamps to the end of the month, and a day is not always 24 hours.",
		requires: ["date-functions"],
	},
	{
		id: "data-cleaning",
		name: "Cleaning messy data",
		summary:
			"Inspect first with SELECT, then normalise with trim, lower, NULLIF(x, '') and regexp_replace, and find rows that would break a cast before casting.",
		requires: ["string-functions", "regex-matching"],
	},
	{
		id: "aggregate-functions",
		name: "Aggregate functions",
		summary:
			"count, sum, avg, min and max collapse many rows into one value. Over zero rows, sum and avg return NULL, not 0.",
		requires: ["select-columns"],
	},
	{
		id: "count-variants",
		name: "COUNT(*) vs COUNT(col)",
		summary:
			"count(*) counts rows, count(col) counts non-NULL values, count(DISTINCT col) counts different non-NULL values.",
		requires: ["aggregate-functions", "null-basics"],
	},
	{
		id: "group-by",
		name: "GROUP BY",
		summary:
			"GROUP BY makes one output row per group. Every selected column must be grouped or wrapped in an aggregate.",
		requires: ["aggregate-functions"],
	},
	{
		id: "having",
		name: "HAVING",
		summary:
			"HAVING filters groups after aggregation, so it can use aggregates; WHERE filters rows before grouping.",
		requires: ["group-by"],
	},
	{
		id: "aggregate-filter",
		name: "FILTER and conditional aggregates",
		summary:
			"count(*) FILTER (WHERE ...) or sum(CASE ...) computes several conditional totals in one pass, one per column.",
		requires: ["group-by", "case-expression"],
	},
	{
		id: "collection-aggregates",
		name: "string_agg, array_agg, bool_or",
		summary:
			"Collapse a group into text, an array or JSON, ordered with ORDER BY inside the call; bool_and and bool_or aggregate booleans.",
		requires: ["group-by"],
	},
	{
		id: "statistical-aggregates",
		name: "Statistical aggregates",
		summary:
			"stddev, variance, corr and the regr_ family describe spread and relationships. Sample and population versions differ.",
		requires: ["aggregate-functions"],
	},
	{
		id: "ordered-set-aggregates",
		name: "Percentiles and mode",
		summary:
			"percentile_cont, percentile_disc and mode() use WITHIN GROUP (ORDER BY ...) to compute medians, quartiles and the most common value.",
		requires: ["aggregate-functions", "order-by"],
	},
	{
		id: "grouping-sets",
		name: "GROUPING SETS, ROLLUP, CUBE",
		summary:
			"Compute several grouping levels (details, subtotals, grand total) in one query; GROUPING() tells a subtotal row from real NULLs.",
		requires: ["group-by"],
	},
	{
		id: "keys-and-relationships-intro",
		name: "Keys connect tables",
		summary:
			"A primary key identifies each row; a foreign key stores the id of a row in another table. Joins follow these links.",
		requires: ["relational-model"],
	},
	{
		id: "table-aliases",
		name: "Table aliases",
		summary:
			"FROM pilots p lets you write p.name; qualify columns whenever two tables share a column name.",
		requires: ["select-columns"],
	},
	{
		id: "inner-join",
		name: "INNER JOIN",
		summary:
			"JOIN ... ON combines rows from two tables where the condition matches; rows without a partner disappear.",
		requires: ["table-aliases", "keys-and-relationships-intro"],
	},
	{
		id: "multi-table-join",
		name: "Joining three or more tables",
		summary:
			"Chain joins along the foreign keys, one ON condition per join, often through a junction table.",
		requires: ["inner-join"],
	},
	{
		id: "join-using-natural",
		name: "USING and NATURAL JOIN",
		summary:
			"JOIN ... USING (col) is shorthand when both sides share a column name. NATURAL JOIN guesses the columns and is fragile.",
		requires: ["inner-join"],
	},
	{
		id: "cross-join",
		name: "CROSS JOIN",
		summary:
			"Every row of one table paired with every row of the other. Useful on purpose, dangerous by accident.",
		requires: ["inner-join"],
	},
	{
		id: "left-join",
		name: "LEFT JOIN",
		summary:
			"Keeps every row of the left table and fills the right side with NULLs when nothing matches. A WHERE on the right table can undo that.",
		requires: ["inner-join", "null-basics"],
	},
	{
		id: "right-full-join",
		name: "RIGHT and FULL JOIN",
		summary:
			"RIGHT JOIN keeps all right rows, FULL JOIN keeps unmatched rows from both sides.",
		requires: ["left-join"],
	},
	{
		id: "self-join",
		name: "Self joins",
		summary:
			"Join a table to itself with two aliases to compare rows: mentors and apprentices, pairs, before and after.",
		requires: ["table-aliases", "inner-join"],
	},
	{
		id: "non-equi-join",
		name: "Non-equi joins",
		summary:
			"Join on <, BETWEEN or range overlap instead of =, for brackets, tiers and time windows.",
		requires: ["inner-join"],
	},
	{
		id: "join-fanout",
		name: "Join fan-out",
		summary:
			"Joining a parent to two child tables multiplies rows and inflates sums. Aggregate each child first, then join.",
		requires: ["group-by", "multi-table-join"],
	},
	{
		id: "semi-join-exists",
		name: "EXISTS",
		summary:
			"WHERE EXISTS (subquery) keeps rows that have at least one match, without duplicating them.",
		requires: ["correlated-subquery"],
	},
	{
		id: "anti-join",
		name: "Anti-joins",
		summary:
			"Find rows with no match using NOT EXISTS or LEFT JOIN ... WHERE right.key IS NULL.",
		requires: ["semi-join-exists", "left-join"],
	},
	{
		id: "not-in-null-trap",
		name: "The NOT IN NULL trap",
		summary:
			"If the subquery behind NOT IN returns a single NULL, NOT IN returns no rows at all. Prefer NOT EXISTS.",
		requires: ["anti-join", "three-valued-logic"],
	},
	{
		id: "lateral-join",
		name: "LATERAL",
		summary:
			"A LATERAL subquery in FROM can see columns of the tables before it, perfect for top-N per row and set-returning functions.",
		requires: ["correlated-subquery", "left-join"],
	},
	{
		id: "scalar-subquery",
		name: "Scalar subqueries",
		summary:
			"A subquery in parentheses that returns one value can be used anywhere a value fits, like comparing with the average.",
		requires: ["aggregate-functions"],
	},
	{
		id: "in-subquery",
		name: "IN (subquery)",
		summary:
			"x IN (SELECT ...) tests membership in the result of another query.",
		requires: ["in-and-between", "scalar-subquery"],
	},
	{
		id: "derived-tables",
		name: "Subqueries in FROM",
		summary:
			"A query in FROM acts as a temporary table you can filter, join and aggregate.",
		requires: ["scalar-subquery"],
	},
	{
		id: "correlated-subquery",
		name: "Correlated subqueries",
		summary:
			"A subquery that refers to the current outer row is re-evaluated for each row: the best score of this player, the count for this guild.",
		requires: ["scalar-subquery", "table-aliases"],
	},
	{
		id: "any-all",
		name: "ANY and ALL",
		summary:
			"x > ALL (subquery) beats every value, x = ANY (array) matches any element. Watch out for empty sets and NULLs.",
		requires: ["in-subquery"],
	},
	{
		id: "set-operations",
		name: "UNION, INTERSECT, EXCEPT",
		summary:
			"Stack or compare results with the same columns. UNION removes duplicates, UNION ALL keeps them.",
		requires: ["select-columns"],
	},
	{
		id: "values-lists",
		name: "VALUES lists",
		summary:
			"VALUES (1, 'a'), (2, 'b') builds a small inline table; name its columns with AS t(id, label).",
		requires: ["select-columns"],
	},
	{
		id: "cte-basics",
		name: "WITH (CTEs)",
		summary:
			"WITH name AS (query) gives a query step a name so the next steps can read it like a table. Separate several CTEs with commas.",
		requires: ["derived-tables"],
	},
	{
		id: "generate-series",
		name: "generate_series",
		summary:
			"Generates a column of numbers or timestamps, perfect for calendars, gap filling and test data.",
		requires: ["values-lists", "date-time-basics"],
	},
	{
		id: "recursive-cte",
		name: "Recursive CTEs",
		summary:
			"WITH RECURSIVE starts from an anchor query and repeatedly joins back to its own output until no new rows appear: ideal for trees.",
		requires: ["cte-basics", "set-operations"],
	},
	{
		id: "recursive-graph-walks",
		name: "Graph walks and cycles",
		summary:
			"Walk graphs with a recursive CTE, track the path in an array, and stop loops with the CYCLE clause or a depth limit.",
		requires: ["recursive-cte"],
	},
	{
		id: "data-modifying-cte",
		name: "Data-modifying CTEs",
		summary:
			"A CTE can INSERT, UPDATE or DELETE with RETURNING and pass the affected rows to the rest of the statement.",
		requires: ["cte-basics", "returning-clause"],
	},
	{
		id: "cte-materialization",
		name: "CTE inlining and MATERIALIZED",
		summary:
			"PostgreSQL usually inlines CTEs into the main query; MATERIALIZED forces it to compute the CTE once, as a fence.",
		requires: ["cte-basics", "explain-basics"],
	},
	{
		id: "window-basics",
		name: "Window functions: OVER ()",
		summary:
			"An aggregate with OVER () is computed across rows without collapsing them, so each row keeps its details and sees the total.",
		requires: ["aggregate-functions"],
	},
	{
		id: "window-partition-order",
		name: "PARTITION BY and ORDER BY in windows",
		summary:
			"PARTITION BY restarts the window per group, ORDER BY inside OVER makes it cumulative. WINDOW w AS (...) names a window.",
		requires: ["window-basics", "group-by"],
	},
	{
		id: "ranking-functions",
		name: "Ranking functions",
		summary:
			"row_number, rank, dense_rank and ntile number rows within a partition; they differ only on ties.",
		requires: ["window-partition-order"],
	},
	{
		id: "lag-lead",
		name: "LAG and LEAD",
		summary:
			"Read a value from the previous or next row of the window to compute deltas and compare periods.",
		requires: ["window-partition-order"],
	},
	{
		id: "window-frames",
		name: "Window frames",
		summary:
			"ROWS, RANGE or GROUPS BETWEEN ... decide which neighbours a window sees; first_value, last_value and nth_value read from the frame.",
		requires: ["lag-lead"],
	},
	{
		id: "running-totals",
		name: "Running totals and moving averages",
		summary:
			"sum() OVER (ORDER BY ...) accumulates; a ROWS BETWEEN n PRECEDING AND CURRENT ROW frame makes a sliding window.",
		requires: ["window-frames"],
	},
	{
		id: "distinct-on",
		name: "DISTINCT ON",
		summary:
			"PostgreSQL's DISTINCT ON (key) keeps the first row of each key according to ORDER BY: one best row per group.",
		requires: ["order-by", "distinct"],
	},
	{
		id: "top-n-per-group",
		name: "Top-N per group",
		summary:
			"Keep the best N rows of each group with row_number in a subquery, DISTINCT ON or a LATERAL subquery.",
		requires: ["ranking-functions", "distinct-on", "lateral-join"],
	},
	{
		id: "deduplication",
		name: "Finding and removing duplicates",
		summary:
			"Spot duplicates with GROUP BY ... HAVING count(*) > 1, keep one copy with row_number, then add a UNIQUE constraint.",
		requires: ["top-n-per-group"],
	},
	{
		id: "date-bucketing",
		name: "Time buckets",
		summary:
			"Group events by hour, day or week with date_trunc or date_bin, keeping the bucket as a real timestamp.",
		requires: ["date-functions", "group-by"],
	},
	{
		id: "time-series-gap-fill",
		name: "Gap filling",
		summary:
			"LEFT JOIN facts onto a generate_series calendar so empty periods show up as zero instead of vanishing.",
		requires: ["generate-series", "left-join", "date-bucketing"],
	},
	{
		id: "gaps-and-islands",
		name: "Gaps and islands",
		summary:
			"Find runs of consecutive values (streaks) by subtracting row_number from the sequence, or with LAG flags and a running sum.",
		requires: ["ranking-functions", "lag-lead"],
	},
	{
		id: "sessionization",
		name: "Sessionization",
		summary:
			"Split an event stream into sessions whenever the gap since the previous event exceeds a threshold.",
		requires: ["lag-lead", "running-totals"],
	},
	{
		id: "pivoting",
		name: "Pivoting",
		summary:
			"Turn rows into columns with FILTER or CASE per column, or with the tablefunc crosstab function.",
		requires: ["aggregate-filter"],
	},
	{
		id: "relational-division",
		name: "Relational division",
		summary:
			"Find who did ALL of something (every quest, every badge) with a count match or a double NOT EXISTS.",
		requires: ["anti-join", "having"],
	},
	{
		id: "random-sampling",
		name: "Random sampling",
		summary:
			"Pick random rows with ORDER BY random() LIMIT n or TABLESAMPLE; setseed makes it reproducible.",
		requires: ["order-by", "limit-offset"],
	},
	{
		id: "insert-basic",
		name: "INSERT",
		summary:
			"INSERT INTO table (columns) VALUES (values) adds a row. Always name the columns.",
		requires: ["select-columns"],
	},
	{
		id: "insert-multi-row",
		name: "Multi-row INSERT",
		summary:
			"One INSERT can add many rows: VALUES (...), (...), (...). If one row fails, none are inserted.",
		requires: ["insert-basic"],
	},
	{
		id: "default-values",
		name: "DEFAULT values",
		summary:
			"Columns you leave out get their default; the DEFAULT keyword asks for it explicitly.",
		requires: ["insert-basic"],
	},
	{
		id: "returning-clause",
		name: "RETURNING",
		summary:
			"INSERT, UPDATE and DELETE can return the rows they touched, including generated ids and, in PostgreSQL 18, old and new values.",
		requires: ["insert-basic"],
	},
	{
		id: "insert-select",
		name: "INSERT ... SELECT",
		summary:
			"Insert the result of a query instead of literal values, to copy or transform rows.",
		requires: ["insert-basic", "where-comparison"],
	},
	{
		id: "update-basic",
		name: "UPDATE",
		summary:
			"UPDATE table SET col = value WHERE ... changes matching rows. Forget the WHERE and every row changes.",
		requires: ["where-comparison"],
	},
	{
		id: "update-from",
		name: "UPDATE ... FROM",
		summary:
			"Update rows using values joined from another table.",
		requires: ["update-basic", "inner-join"],
	},
	{
		id: "delete-basic",
		name: "DELETE",
		summary:
			"DELETE FROM table WHERE ... removes matching rows; without WHERE it removes them all.",
		requires: ["where-comparison"],
	},
	{
		id: "delete-using",
		name: "DELETE ... USING",
		summary:
			"Delete rows based on a join with another table.",
		requires: ["delete-basic", "inner-join"],
	},
	{
		id: "truncate",
		name: "TRUNCATE",
		summary:
			"Empties whole tables at once, much faster than DELETE; RESTART IDENTITY resets ids.",
		requires: ["delete-basic"],
	},
	{
		id: "sequences",
		name: "Sequences and id gaps",
		summary:
			"Sequences hand out ids with nextval; failed inserts and rollbacks leave gaps, and that is normal.",
		requires: ["default-values"],
	},
	{
		id: "upsert-on-conflict",
		name: "INSERT ... ON CONFLICT",
		summary:
			"Insert, or when a unique key already exists, DO NOTHING or DO UPDATE SET col = EXCLUDED.col.",
		requires: ["insert-basic", "constraint-errors"],
	},
	{
		id: "merge-statement",
		name: "MERGE",
		summary:
			"MERGE compares a source with a target and inserts, updates or deletes per WHEN clause in one statement.",
		requires: ["upsert-on-conflict", "update-from"],
	},
	{
		id: "bulk-load-copy",
		name: "Bulk loading",
		summary:
			"Load many rows at once through a staging table (COPY in real servers), then clean and insert them with INSERT ... SELECT.",
		requires: ["insert-multi-row"],
	},
	{
		id: "transactions-basics",
		name: "Transactions",
		summary:
			"BEGIN ... COMMIT groups statements so they all happen or none do; ROLLBACK undoes everything since BEGIN.",
		requires: ["update-basic"],
	},
	{
		id: "savepoints",
		name: "Savepoints",
		summary:
			"SAVEPOINT marks a point inside a transaction that ROLLBACK TO can return to without losing earlier work.",
		requires: ["transactions-basics"],
	},
	{
		id: "constraint-errors",
		name: "Constraint violations and SQLSTATE",
		summary:
			"Broken rules raise coded errors: 23502 not null, 23503 foreign key, 23505 unique, 23514 check. Read the DETAIL line.",
		requires: ["transactions-basics"],
	},
	{
		id: "isolation-levels",
		name: "Isolation levels",
		summary:
			"Read committed, repeatable read and serializable decide which anomalies concurrent transactions can see.",
		requires: ["transactions-basics"],
	},
	{
		id: "row-locking",
		name: "Row locks",
		summary:
			"SELECT ... FOR UPDATE locks rows until commit; SKIP LOCKED builds job queues; inconsistent lock order causes deadlocks.",
		requires: ["isolation-levels"],
	},
	{
		id: "optimistic-locking",
		name: "Lost updates and optimistic locking",
		summary:
			"Use atomic SET x = x + 1, or a version column checked in the WHERE, so two writers cannot silently overwrite each other.",
		requires: ["update-basic", "row-locking"],
	},
	{
		id: "mvcc-concept",
		name: "MVCC",
		summary:
			"An UPDATE writes a new row version and leaves the old one for readers, so readers never block writers.",
		requires: ["transactions-basics"],
	},
	{
		id: "data-type-basics",
		name: "Choosing column types",
		summary:
			"Pick int or bigint for counts, numeric for exact amounts, text for strings, boolean, date and timestamptz for time.",
		requires: ["type-casting"],
	},
	{
		id: "create-table",
		name: "CREATE TABLE",
		summary:
			"Define a table with its columns, types and constraints.",
		requires: ["data-type-basics"],
	},
	{
		id: "primary-key",
		name: "PRIMARY KEY",
		summary:
			"A primary key is unique and never NULL: the identity of each row. It can span several columns.",
		requires: ["create-table"],
	},
	{
		id: "identity-columns",
		name: "Identity columns",
		summary:
			"GENERATED ALWAYS AS IDENTITY numbers rows automatically; prefer it over the older serial.",
		requires: ["primary-key", "sequences"],
	},
	{
		id: "not-null-default",
		name: "NOT NULL and DEFAULT",
		summary:
			"NOT NULL makes a column required, DEFAULT fills it when an insert leaves it out.",
		requires: ["create-table"],
	},
	{
		id: "unique-constraint",
		name: "UNIQUE",
		summary:
			"UNIQUE forbids duplicate values; several NULLs are still allowed unless NULLS NOT DISTINCT.",
		requires: ["create-table", "null-basics"],
	},
	{
		id: "check-constraint",
		name: "CHECK",
		summary:
			"CHECK (condition) rejects rows where the condition is false. NULL makes it unknown, which passes.",
		requires: ["create-table", "three-valued-logic"],
	},
	{
		id: "foreign-key",
		name: "FOREIGN KEY",
		summary:
			"A foreign key guarantees that a referenced row exists in the parent table.",
		requires: ["primary-key"],
	},
	{
		id: "fk-actions",
		name: "Foreign key actions",
		summary:
			"ON DELETE CASCADE, SET NULL or RESTRICT decide what happens to children when a parent row goes away.",
		requires: ["foreign-key", "delete-basic"],
	},
	{
		id: "generated-columns",
		name: "Generated columns",
		summary:
			"A column computed from other columns of the row, either VIRTUAL (computed on read) or STORED.",
		requires: ["create-table"],
	},
	{
		id: "alter-table",
		name: "ALTER TABLE",
		summary:
			"Add, drop or rename columns, change types with USING, and add constraints to existing tables.",
		requires: ["create-table"],
	},
	{
		id: "drop-objects",
		name: "DROP and dependencies",
		summary:
			"DROP removes objects; IF EXISTS avoids errors and CASCADE also drops what depends on them.",
		requires: ["create-table"],
	},
	{
		id: "views",
		name: "Views",
		summary:
			"A view is a saved query you can select from like a table. It stores no data of its own.",
		requires: ["cte-basics"],
	},
	{
		id: "materialized-views",
		name: "Materialized views",
		summary:
			"A materialized view stores the result of its query until you REFRESH it.",
		requires: ["views"],
	},
	{
		id: "schemas-search-path",
		name: "Schemas and search_path",
		summary:
			"Schemas are namespaces inside a database; search_path decides where unqualified names are looked up.",
		requires: ["create-table"],
	},
	{
		id: "catalog-introspection",
		name: "Introspecting the catalog",
		summary:
			"information_schema and pg_catalog describe every table, column and constraint, queryable with plain SQL.",
		requires: ["schemas-search-path"],
	},
	{
		id: "naming-conventions",
		name: "Naming conventions",
		summary:
			"Use lower case snake_case names, avoid reserved words and quotes, and name constraints explicitly.",
		requires: ["create-table"],
	},
	{
		id: "er-modeling",
		name: "Conceptual modeling",
		summary:
			"Before writing DDL, list entities, their attributes, how they relate and the business rules.",
		requires: ["keys-and-relationships-intro"],
	},
	{
		id: "relationship-cardinality",
		name: "One-to-one, one-to-many, many-to-many",
		summary:
			"A foreign key models one-to-many; many-to-many needs a junction table with two foreign keys.",
		requires: ["er-modeling", "foreign-key"],
	},
	{
		id: "normalization-1nf",
		name: "First normal form",
		summary:
			"One value per cell: no comma separated lists and no item1, item2, item3 columns.",
		requires: ["relationship-cardinality"],
	},
	{
		id: "normalization-2nf-3nf",
		name: "Second and third normal form",
		summary:
			"Every non-key column should depend on the whole key and nothing but the key; move repeated facts to their own table.",
		requires: ["normalization-1nf"],
	},
	{
		id: "normalization-bcnf-beyond",
		name: "BCNF and beyond",
		summary:
			"In BCNF every determinant is a key; 4NF and 5NF remove multivalued and join dependencies.",
		requires: ["normalization-2nf-3nf"],
	},
	{
		id: "denormalization",
		name: "Denormalization trade-offs",
		summary:
			"Sometimes you copy or cache data for speed; then you must keep the copies in sync.",
		requires: ["normalization-2nf-3nf"],
	},
	{
		id: "design-antipatterns",
		name: "Design antipatterns",
		summary:
			"EAV tables, polymorphic ids, one table per year and comma lists look flexible but lose types, keys and constraints.",
		requires: ["normalization-2nf-3nf", "foreign-key"],
	},
	{
		id: "hierarchy-models",
		name: "Trees in SQL",
		summary:
			"Store trees as adjacency lists (parent_id), materialized paths (ltree), nested sets or closure tables, each with trade-offs.",
		requires: ["recursive-cte", "foreign-key"],
	},
	{
		id: "temporal-constraints",
		name: "No overlaps allowed",
		summary:
			"EXCLUDE USING gist or PostgreSQL 18 WITHOUT OVERLAPS forbids two bookings of the same room overlapping in time.",
		requires: ["range-types", "unique-constraint"],
	},
	{
		id: "numeric-types",
		name: "Integers and numeric",
		summary:
			"smallint, int and bigint have fixed ranges; numeric(p, s) stores exact decimals. Overflow raises an error.",
		requires: ["data-type-basics"],
	},
	{
		id: "floating-point",
		name: "Floating point",
		summary:
			"real and double precision are approximate: 0.1 + 0.2 is not exactly 0.3. Never compare floats with =.",
		requires: ["numeric-types"],
	},
	{
		id: "money-handling",
		name: "Handling money",
		summary:
			"Store amounts as numeric with a fixed scale plus a currency code; avoid float and the money type.",
		requires: ["numeric-types"],
	},
	{
		id: "text-types",
		name: "text, varchar, char",
		summary:
			"Prefer text (with a CHECK for length if needed); char(n) pads with spaces and varchar(n) limits are often arbitrary.",
		requires: ["data-type-basics"],
	},
	{
		id: "boolean-type",
		name: "Booleans",
		summary:
			"A boolean is true, false or NULL; filter with WHERE flag or WHERE NOT flag.",
		requires: ["data-type-basics"],
	},
	{
		id: "uuid-type",
		name: "UUIDs",
		summary:
			"Universally unique ids: gen_random_uuid() for random v4, uuidv7() for time-ordered ids.",
		requires: ["data-type-basics"],
	},
	{
		id: "enum-types",
		name: "Enums",
		summary:
			"An enum is a fixed list of labels that sorts in declaration order, not alphabetically.",
		requires: ["data-type-basics"],
	},
	{
		id: "domain-types",
		name: "Domains",
		summary:
			"A domain is a reusable type with constraints, like a positive amount or a valid email.",
		requires: ["check-constraint"],
	},
	{
		id: "composite-types",
		name: "Composite types",
		summary:
			"A composite type bundles fields into one value; read a field with (col).field.",
		requires: ["data-type-basics"],
	},
	{
		id: "arrays",
		name: "Arrays",
		summary:
			"A column can hold an array. Indexes start at 1; use = ANY, @>, && and unnest to query it.",
		requires: ["data-type-basics", "any-all"],
	},
	{
		id: "json-vs-jsonb",
		name: "json vs jsonb",
		summary:
			"json keeps the raw text, jsonb is parsed, deduplicated and indexable. Use jsonb for querying.",
		requires: ["data-type-basics"],
	},
	{
		id: "jsonb-operators",
		name: "jsonb operators",
		summary:
			"-> returns jsonb, ->> returns text, #> follows a path, @> tests containment and ? tests for a key.",
		requires: ["json-vs-jsonb"],
	},
	{
		id: "jsonb-construction",
		name: "Building JSON",
		summary:
			"jsonb_build_object, jsonb_build_array, to_jsonb and jsonb_agg build JSON documents from rows.",
		requires: ["collection-aggregates", "json-vs-jsonb"],
	},
	{
		id: "jsonb-decomposition",
		name: "Unnesting JSON",
		summary:
			"jsonb_array_elements, jsonb_each and jsonb_to_recordset turn JSON back into rows.",
		requires: ["jsonb-operators", "lateral-join"],
	},
	{
		id: "jsonb-modification",
		name: "Modifying JSON",
		summary:
			"jsonb_set, ||, - and #- update, merge and remove parts of a jsonb document.",
		requires: ["jsonb-operators", "update-basic"],
	},
	{
		id: "sql-json-path",
		name: "SQL/JSON path",
		summary:
			"jsonpath expressions like '$.bags[*].items[*] ? (@.qty > 1)' query deep inside documents.",
		requires: ["jsonb-operators"],
	},
	{
		id: "json-table",
		name: "JSON_TABLE",
		summary:
			"JSON_TABLE turns a JSON document into rows and typed columns in one standard SQL expression.",
		requires: ["sql-json-path"],
	},
	{
		id: "jsonb-indexing",
		name: "Indexing jsonb",
		summary:
			"A GIN index speeds up @>, ? and jsonpath; a B-tree on (doc->>'key') speeds up equality on one key.",
		requires: ["jsonb-operators"],
	},
	{
		id: "hstore",
		name: "hstore",
		summary:
			"hstore stores flat text key/value pairs, an older and simpler cousin of jsonb.",
		requires: ["json-vs-jsonb"],
	},
	{
		id: "timezones",
		name: "timestamptz and time zones",
		summary:
			"timestamptz is an absolute instant shown in the session time zone; AT TIME ZONE converts to local wall time.",
		requires: ["interval-arithmetic"],
	},
	{
		id: "range-types",
		name: "Range types",
		summary:
			"daterange, tstzrange and numrange store an interval with bounds; && tests overlap and @> containment.",
		requires: ["date-time-basics", "in-and-between"],
	},
	{
		id: "multirange-types",
		name: "Multiranges",
		summary:
			"A multirange is a set of non-overlapping ranges, great for availability calendars; range_agg builds one.",
		requires: ["range-types"],
	},
	{
		id: "network-types",
		name: "inet and cidr",
		summary:
			"Store IP addresses and networks with real types and test subnet membership with << and >>.",
		requires: ["data-type-basics"],
	},
	{
		id: "bytea-binary",
		name: "bytea",
		summary:
			"bytea holds raw bytes, shown as hex; encode and decode convert to base64 or hex.",
		requires: ["data-type-basics"],
	},
	{
		id: "geometric-types",
		name: "Geometry and earth distance",
		summary:
			"point, box, circle and polygon types with distance and overlap operators, plus earthdistance for lat/lon.",
		requires: ["data-type-basics"],
	},
	{
		id: "ltree",
		name: "ltree paths",
		summary:
			"ltree stores tree paths like arcana.fire.dragons and finds ancestors and descendants with <@ and @>.",
		requires: ["hierarchy-models"],
	},
	{
		id: "case-insensitive-text",
		name: "Case-insensitive text",
		summary:
			"Compare text without case with citext, lower() indexes or nondeterministic collations.",
		requires: ["text-types", "collation-sorting"],
	},
	{
		id: "pgcrypto-hashing",
		name: "Hashing and passwords",
		summary:
			"pgcrypto hashes passwords with crypt and gen_salt, and checks them with crypt(input, stored_hash).",
		requires: ["bytea-binary"],
	},
	{
		id: "full-text-search",
		name: "Full-text search",
		summary:
			"to_tsvector turns text into searchable lexemes, to_tsquery into a query, and @@ matches them with stemming.",
		requires: ["string-functions"],
	},
	{
		id: "fts-ranking-highlighting",
		name: "Ranking and highlighting",
		summary:
			"ts_rank orders matches by relevance, setweight boosts titles, ts_headline highlights the matched words.",
		requires: ["full-text-search"],
	},
	{
		id: "fts-indexing",
		name: "Indexing full-text search",
		summary:
			"Store a generated tsvector column and index it with GIN so searches stay fast.",
		requires: ["full-text-search", "generated-columns"],
	},
	{
		id: "trigram-search",
		name: "Trigram fuzzy search",
		summary:
			"pg_trgm compares strings by shared three-letter chunks, finding near matches and typos.",
		requires: ["like-ilike"],
	},
	{
		id: "fuzzy-string-matching",
		name: "Edit distance and sounds-like",
		summary:
			"levenshtein counts edits between strings, soundex and metaphone match names that sound alike, unaccent drops accents.",
		requires: ["string-functions"],
	},
	{
		id: "vector-basics",
		name: "Vectors and embeddings",
		summary:
			"pgvector stores embeddings as vector(n); <-> is Euclidean distance, <=> cosine distance, <#> negative inner product.",
		requires: ["arrays"],
	},
	{
		id: "vector-knn-search",
		name: "Nearest-neighbour search",
		summary:
			"ORDER BY embedding <=> query LIMIT k returns the k most similar items.",
		requires: ["vector-basics", "order-by"],
	},
	{
		id: "vector-indexes",
		name: "HNSW and IVFFlat",
		summary:
			"Approximate vector indexes trade a little accuracy for speed; the operator class must match the distance operator.",
		requires: ["vector-knn-search"],
	},
	{
		id: "hybrid-search",
		name: "Hybrid search",
		summary:
			"Combine keyword ranking and vector similarity, for example with reciprocal rank fusion.",
		requires: ["vector-knn-search", "fts-ranking-highlighting", "cte-basics"],
	},
	{
		id: "explain-basics",
		name: "EXPLAIN",
		summary:
			"EXPLAIN shows the plan the database picked: a tree of nodes with estimated cost and rows, read from the inside out.",
		requires: ["logical-processing-order"],
	},
	{
		id: "explain-analyze",
		name: "EXPLAIN ANALYZE",
		summary:
			"EXPLAIN ANALYZE runs the query and shows actual rows, loops, time and buffers next to the estimates.",
		requires: ["explain-basics"],
	},
	{
		id: "scan-types",
		name: "Scan types",
		summary:
			"Seq Scan reads the whole table, Index Scan follows an index, Index Only Scan never touches the table, Bitmap scans batch lookups.",
		requires: ["explain-basics"],
	},
	{
		id: "join-algorithms",
		name: "Join algorithms",
		summary:
			"Nested Loop, Hash Join and Merge Join each win in different situations.",
		requires: ["scan-types", "inner-join"],
	},
	{
		id: "btree-index",
		name: "B-tree indexes",
		summary:
			"A B-tree index finds rows by equality, ranges, prefix LIKE and ORDER BY without reading the whole table.",
		requires: ["explain-basics"],
	},
	{
		id: "multicolumn-index",
		name: "Multicolumn indexes",
		summary:
			"Column order matters: put equality columns first, then the range or sort column.",
		requires: ["btree-index"],
	},
	{
		id: "partial-index",
		name: "Partial indexes",
		summary:
			"CREATE INDEX ... WHERE indexes only the rows you query, like active or unfinished ones.",
		requires: ["btree-index"],
	},
	{
		id: "expression-index",
		name: "Expression indexes",
		summary:
			"Index an expression such as lower(handle) so queries that use the same expression can use it.",
		requires: ["btree-index"],
	},
	{
		id: "covering-index",
		name: "Covering indexes",
		summary:
			"INCLUDE extra columns so an Index Only Scan answers the query without visiting the table.",
		requires: ["multicolumn-index"],
	},
	{
		id: "gin-gist-brin-hash",
		name: "GIN, GiST, BRIN and hash",
		summary:
			"Specialised indexes for arrays, jsonb and text search (GIN), ranges and geometry (GiST), huge ordered tables (BRIN).",
		requires: ["btree-index"],
	},
	{
		id: "sargability",
		name: "Sargable predicates",
		summary:
			"Keep indexed columns bare in WHERE: date(ts) = ... or col + 0 = ... hide the column from the index.",
		requires: ["btree-index"],
	},
	{
		id: "index-selection-reasons",
		name: "Why is my index not used?",
		summary:
			"Low selectivity, tiny tables, stale statistics, type mismatches and wrong operator classes make the planner skip an index.",
		requires: ["sargability", "statistics"],
	},
	{
		id: "statistics",
		name: "Planner statistics",
		summary:
			"ANALYZE gathers statistics (distinct values, common values, histograms) that the planner uses to estimate rows.",
		requires: ["explain-analyze"],
	},
	{
		id: "vacuum-mvcc",
		name: "VACUUM and bloat",
		summary:
			"Deleted and updated rows leave dead versions; VACUUM reclaims them and VACUUM FULL rewrites the table.",
		requires: ["mvcc-concept"],
	},
	{
		id: "pagination-performance",
		name: "Keyset pagination",
		summary:
			"Instead of a deep OFFSET, continue after the last row seen: WHERE (score, id) < (last_score, last_id).",
		requires: ["limit-offset", "multicolumn-index"],
	},
	{
		id: "n-plus-one",
		name: "N+1 queries",
		summary:
			"One query per item is slow; fetch everything with one JOIN or = ANY(array) instead.",
		requires: ["inner-join", "btree-index"],
	},
	{
		id: "query-rewriting",
		name: "Query rewriting",
		summary:
			"Rewrite the same question differently (EXISTS, JOIN, UNION ALL, pre-aggregation) and measure which plan wins.",
		requires: ["explain-analyze", "semi-join-exists"],
	},
	{
		id: "write-performance",
		name: "Write performance",
		summary:
			"Every index slows writes down; batch inserts and drop unused indexes.",
		requires: ["btree-index", "bulk-load-copy"],
	},
	{
		id: "partitioning",
		name: "Partitioning",
		summary:
			"Split a big table into partitions by range, list or hash so queries can skip the irrelevant ones.",
		requires: ["create-table", "explain-basics"],
	},
	{
		id: "query-stats",
		name: "Query statistics",
		summary:
			"pg_stat_statements and the pg_stat views show which queries use the most time in total.",
		requires: ["explain-analyze"],
	},
	{
		id: "sql-functions",
		name: "SQL functions",
		summary:
			"CREATE FUNCTION wraps a query under a name with parameters; mark it IMMUTABLE, STABLE or VOLATILE honestly.",
		requires: ["cte-basics"],
	},
	{
		id: "plpgsql-basics",
		name: "PL/pgSQL",
		summary:
			"A procedural language with variables, IF, loops and exception blocks, for logic that plain SQL cannot express.",
		requires: ["sql-functions"],
	},
	{
		id: "procedures",
		name: "Procedures",
		summary:
			"CREATE PROCEDURE and CALL; unlike functions, procedures can COMMIT and ROLLBACK inside.",
		requires: ["plpgsql-basics", "transactions-basics"],
	},
	{
		id: "dynamic-sql",
		name: "Dynamic SQL",
		summary:
			"EXECUTE format('... %I ... %L', ...) builds statements at runtime, quoting names and values safely.",
		requires: ["plpgsql-basics", "sql-injection"],
	},
	{
		id: "triggers",
		name: "Triggers",
		summary:
			"A trigger runs a function automatically before or after INSERT, UPDATE or DELETE, with OLD and NEW rows.",
		requires: ["plpgsql-basics"],
	},
	{
		id: "audit-history",
		name: "Audit history",
		summary:
			"A trigger can record who changed what and when into a history table.",
		requires: ["triggers", "jsonb-construction"],
	},
	{
		id: "stored-logic-guidelines",
		name: "Where logic lives",
		summary:
			"Constraints first, then functions, then triggers; keep rules visible and avoid hiding business logic.",
		requires: ["triggers", "check-constraint"],
	},
	{
		id: "listen-notify",
		name: "LISTEN and NOTIFY",
		summary:
			"NOTIFY sends a message to every session that LISTENs on a channel, delivered at commit.",
		requires: ["triggers"],
	},
	{
		id: "roles-privileges",
		name: "Roles and privileges",
		summary:
			"Roles own objects and receive privileges with GRANT and REVOKE; give each role only what it needs.",
		requires: ["create-table"],
	},
	{
		id: "row-level-security",
		name: "Row-level security",
		summary:
			"Policies filter which rows each role can see or change, enforced by the database itself.",
		requires: ["roles-privileges"],
	},
	{
		id: "sql-injection",
		name: "SQL injection and parameters",
		summary:
			"Never glue user input into SQL text; use parameters ($1) or format with %I and %L.",
		requires: ["where-comparison"],
	},
	{
		id: "upsert-patterns",
		name: "Idempotent loads",
		summary:
			"Design imports that can safely run twice: staging tables, MERGE or ON CONFLICT, and atomic counters.",
		requires: ["upsert-on-conflict", "merge-statement"],
	},
	{
		id: "operations-overview",
		name: "Operations overview",
		summary:
			"Backups, replication, connection pooling, configuration and upgrades keep a real PostgreSQL server healthy.",
	},
];

export default concepts;
