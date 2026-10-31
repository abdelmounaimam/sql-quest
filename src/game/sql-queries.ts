import { queryOptions, useQuery } from "@tanstack/react-query";
import { sqlClient } from "#/engine/sql/client";

/** TanStack Query wrappers around the PGlite worker. */

export const catalogQuery = (datasetId: string) =>
	queryOptions({
		queryKey: ["catalog", datasetId],
		queryFn: () => sqlClient().catalog(datasetId),
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
		retry: 1,
	});

export const functionsQuery = (datasetId: string) =>
	queryOptions({
		queryKey: ["functions", datasetId],
		queryFn: () => sqlClient().functions(datasetId),
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
	});

export function useCatalog(datasetId: string) {
	return useQuery(catalogQuery(datasetId));
}

export function usePeek(datasetId: string, table: string | null) {
	return useQuery({
		queryKey: ["peek", datasetId, table],
		queryFn: () => sqlClient().peek(datasetId, table as string, 100),
		enabled: !!table,
		staleTime: Number.POSITIVE_INFINITY,
	});
}

/** Table names that appear as words in the SQL (for the live schema glow). */
export function referencedTables(sql: string, tables: string[]): Set<string> {
	const words = new Set(
		sql
			.replace(/--.*$/gm, " ")
			.toLowerCase()
			.split(/[^a-z0-9_]+/)
			.filter(Boolean),
	);
	return new Set(tables.filter((t) => words.has(t.toLowerCase())));
}
