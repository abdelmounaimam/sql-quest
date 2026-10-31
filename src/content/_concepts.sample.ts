import type { Concept } from "./types";

/** DEV SAMPLE concepts for the two underscore sample chapters. */
const concepts: Concept[] = [
	{
		id: "_select-basics",
		name: "SELECT basics",
		summary:
			"SELECT picks the columns you want, FROM names the table. Use * for every column, or list them separated by commas.",
	},
	{
		id: "_where-filter",
		name: "Filtering with WHERE",
		summary:
			"WHERE keeps only the rows whose condition is true. Combine conditions with AND / OR, and use IN, BETWEEN or LIKE for common patterns.",
		requires: ["_select-basics"],
	},
	{
		id: "_null-checks",
		name: "NULL checks",
		summary:
			"NULL means unknown, so `= NULL` is never true. Use IS NULL / IS NOT NULL, and COALESCE to swap NULL for a default.",
		requires: ["_where-filter"],
	},
	{
		id: "_order-limit",
		name: "ORDER BY and LIMIT",
		summary:
			"ORDER BY sorts the result (ASC by default, DESC to flip). LIMIT keeps the first N rows; add a tiebreaker column so the order is deterministic.",
		requires: ["_select-basics"],
	},
	{
		id: "_insert-rows",
		name: "INSERT",
		summary:
			"INSERT INTO table (columns) VALUES (...) adds rows. Columns you skip get their DEFAULT.",
		requires: ["_select-basics"],
	},
	{
		id: "_update-delete",
		name: "UPDATE and DELETE",
		summary:
			"UPDATE ... SET changes matching rows, DELETE FROM removes them. Always write the WHERE first: without it every row is hit.",
		requires: ["_where-filter"],
	},
	{
		id: "_returning",
		name: "RETURNING",
		summary:
			"Add RETURNING to INSERT, UPDATE or DELETE to get back the rows you changed, in the same statement.",
		requires: ["_update-delete"],
	},
	{
		id: "_constraints",
		name: "Constraints",
		summary:
			"PRIMARY KEY, UNIQUE, FOREIGN KEY and CHECK make Postgres refuse bad data with an error (23505, 23503, 23514...).",
		requires: ["_insert-rows"],
	},
	{
		id: "_jsonb-access",
		name: "jsonb operators",
		summary:
			'-> returns json, ->> returns text, #>> follows a path, and @> tests containment: specs @> \'{"fuel": "ion"}\'.',
		requires: ["_where-filter"],
	},
	{
		id: "_vector-knn",
		name: "Vector nearest neighbours",
		summary:
			"pgvector's <-> operator is the Euclidean distance. ORDER BY embedding <-> '[...]' LIMIT k returns the k most similar rows.",
		requires: ["_order-limit"],
	},
	{
		id: "_transactions",
		name: "Transactions",
		summary:
			"BEGIN ... COMMIT groups statements so they all succeed or all fail together. ROLLBACK cancels everything since BEGIN.",
		requires: ["_update-delete"],
	},
];

export default concepts;
