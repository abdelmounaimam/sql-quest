import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
	createCollection,
	localStorageCollectionOptions,
} from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import type { AttemptRecord } from "#/engine/adaptive/types";
import { getLeaderboard, type LeaderboardRow } from "#/server/functions";

/**
 * Local-first collections (TanStack DB).
 * - attempts: every finished attempt, persisted to localStorage, synced up.
 * - lessons: chapters whose learn phase is done.
 * - leaderboard: server data through a Query collection.
 * Collections are created lazily, on the client only.
 */

export type AttemptRow = AttemptRecord & { synced: boolean };
export interface LessonRow {
	id: string;
	completedAt: number;
	synced: boolean;
}

function makeAttempts() {
	return createCollection(
		localStorageCollectionOptions<AttemptRow, string>({
			id: "attempts",
			storageKey: "sqlq-attempts",
			getKey: (a) => a.id,
		}),
	);
}

function makeLessons() {
	return createCollection(
		localStorageCollectionOptions<LessonRow, string>({
			id: "lessons",
			storageKey: "sqlq-lessons",
			getKey: (l) => l.id,
		}),
	);
}

let attempts: ReturnType<typeof makeAttempts> | null = null;
let lessons: ReturnType<typeof makeLessons> | null = null;

export function attemptsCollection() {
	if (!attempts) attempts = makeAttempts();
	return attempts;
}

export function lessonsCollection() {
	if (!lessons) lessons = makeLessons();
	return lessons;
}

function makeLeaderboard(queryClient: QueryClient) {
	return createCollection(
		queryCollectionOptions({
			id: "leaderboard",
			queryKey: ["leaderboard"],
			queryFn: async () => {
				if (typeof navigator !== "undefined" && !navigator.onLine) return [];
				return getLeaderboard();
			},
			queryClient,
			getKey: (r: LeaderboardRow) => r.id,
			staleTime: 30_000,
			retry: 1,
		}),
	);
}

let leaderboard: ReturnType<typeof makeLeaderboard> | null = null;
export function leaderboardCollection(queryClient: QueryClient) {
	if (!leaderboard) leaderboard = makeLeaderboard(queryClient);
	return leaderboard;
}
