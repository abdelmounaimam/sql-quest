import { useAsyncDebouncedCallback } from "@tanstack/react-pacer";
import { useEffect } from "react";
import { levelFromXp } from "#/engine/adaptive";
import type { AttemptRecord } from "#/engine/adaptive/types";
import { syncProgress } from "#/server/functions";
import {
	type AttemptRow,
	attemptsCollection,
	lessonsCollection,
} from "./collections";
import { gameActions, gameStore } from "./store";

/**
 * Offline-first sync: local collections are the source of truth; unsynced
 * rows are pushed to the server when online, server rows missing locally
 * are pulled in (e.g. a reinstall on the same profile id).
 */
export async function syncNow(force = false): Promise<boolean> {
	const s = gameStore.state;
	if (!s.profile || (typeof navigator !== "undefined" && !navigator.onLine))
		return false;
	const attempts = attemptsCollection();
	const lessons = lessonsCollection();
	const pending = [...attempts.values()].filter((a) => !a.synced);
	const pendingLessons = [...lessons.values()].filter((l) => !l.synced);
	// Nothing new and synced recently: skip the round trip.
	if (
		!force &&
		pending.length === 0 &&
		pendingLessons.length === 0 &&
		s.lastSyncAt &&
		Date.now() - s.lastSyncAt < 5 * 60_000
	)
		return false;
	const res = await syncProgress({
		data: {
			profile: {
				id: s.profile.id,
				name: s.profile.name,
				avatar: s.profile.avatar,
				xp: s.xp,
				level: levelFromXp(s.xp).level,
				streak: s.streak,
			},
			attempts: pending.slice(0, 500).map(({ synced: _s, ...a }) => ({
				id: a.id,
				exerciseId: a.exerciseId,
				finishedAt: a.finishedAt,
				data: JSON.stringify(a),
			})),
			lessons: pendingLessons.map((l) => ({
				chapterId: l.id,
				completedAt: l.completedAt,
			})),
		},
	});
	for (const a of pending.slice(0, 500))
		attempts.update(a.id, (d) => {
			d.synced = true;
		});
	for (const l of pendingLessons)
		lessons.update(l.id, (d) => {
			d.synced = true;
		});
	for (const row of res.attempts) {
		if (attempts.has(row.id)) continue;
		try {
			const a = JSON.parse(row.data) as AttemptRecord;
			attempts.insert({ ...a, synced: true } as AttemptRow);
		} catch {
			// ignore corrupt rows
		}
	}
	for (const l of res.lessons) {
		if (!lessons.has(l.chapterId))
			lessons.insert({
				id: l.chapterId,
				completedAt: l.completedAt,
				synced: true,
			});
	}
	gameActions.markSynced(res.syncedAt, res.profile.xp);
	return true;
}

/** Mount once: syncs on startup, on reconnect, and (debounced) after progress changes. */
export function SyncAgent() {
	const sync = useAsyncDebouncedCallback(
		async () => {
			try {
				await syncNow();
			} catch (e) {
				console.warn("[sync] deferred:", (e as Error).message);
			}
		},
		{ wait: 2000 },
	);

	useEffect(() => {
		void sync();
		const onOnline = () => void sync();
		window.addEventListener("online", onOnline);
		const sub = attemptsCollection().subscribeChanges(() => void sync());
		const sub2 = lessonsCollection().subscribeChanges(() => void sync());
		return () => {
			window.removeEventListener("online", onOnline);
			sub.unsubscribe();
			sub2.unsubscribe();
		};
	}, [sync]);

	return null;
}
