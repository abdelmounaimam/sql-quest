import { useLiveQuery } from "@tanstack/react-db";
import { useSelector } from "@tanstack/react-store";
import { useMemo } from "react";
import {
	ACHIEVEMENTS,
	type ChapterStatus,
	chapterStatus,
	computeMastery,
	evaluateAchievements,
	levelFromXp,
	type MasteryMap,
	type NextActivity,
	nextActivity,
	nextCombo,
	reviewQueue,
	starsFor,
	type XpBreakdown,
	xpForAttempt,
} from "#/engine/adaptive";
import type { AttemptRecord } from "#/engine/adaptive/types";
import { chapters, conceptName } from "#/lib/content";
import {
	type AttemptRow,
	attemptsCollection,
	lessonsCollection,
} from "./collections";
import { sfx } from "./sound";
import { gameActions, gameStore } from "./store";

export interface Progress {
	attempts: AttemptRow[];
	lessonDone: (chapterId: string) => boolean;
	mastery: MasteryMap;
	statuses: Record<string, ChapterStatus>;
	next: NextActivity;
	reviews: ReturnType<typeof reviewQueue>;
	ready: boolean;
}

/** Live progress: attempts + lessons from TanStack DB, derived through the adaptive engine. */
export function useProgress(): Progress {
	const { data: attemptData, isReady: aReady } = useLiveQuery({
		query: (q) => q.from({ a: attemptsCollection() }),
	});
	const { data: lessonData, isReady: lReady } = useLiveQuery({
		query: (q) => q.from({ l: lessonsCollection() }),
	});

	return useMemo(() => {
		const attempts = [...(attemptData ?? [])].sort(
			(a, b) => a.finishedAt - b.finishedAt,
		) as AttemptRow[];
		const done = new Set((lessonData ?? []).map((l) => l.id));
		const lessonDone = (id: string) => done.has(id);
		const now = Date.now();
		const mastery = computeMastery(attempts, now);
		const statuses: Record<string, ChapterStatus> = {};
		for (const ch of chapters) {
			statuses[ch.id] = chapterStatus(ch, attempts, {
				chapters,
				mastery,
				lessonDone,
				conceptName,
				now,
			});
		}
		const next = nextActivity(
			chapters,
			statuses,
			mastery,
			attempts,
			now,
			lessonDone,
			conceptName,
		);
		return {
			attempts,
			lessonDone,
			mastery,
			statuses,
			next,
			reviews: reviewQueue(mastery, chapters),
			ready: aReady && lReady,
		};
	}, [attemptData, lessonData, aReady, lReady]);
}

export interface Reward {
	stars: 0 | 1 | 2 | 3;
	xp: XpBreakdown;
	combo: number;
	levelBefore: number;
	levelAfter: number;
	newAchievements: typeof ACHIEVEMENTS;
	masteryBefore: MasteryMap;
	masteryAfter: MasteryMap;
}

/** Persist an attempt, award XP/combo/streak, unlock achievements. */
export function recordAttempt(
	attempt: Omit<AttemptRecord, "id" | "timeToSolveMs"> & { id?: string },
): Reward {
	const coll = attemptsCollection();
	const before = [...coll.values()] as AttemptRow[];
	const full: AttemptRow = {
		...attempt,
		id: attempt.id ?? `${attempt.exerciseId}@${attempt.finishedAt}`,
		timeToSolveMs: attempt.finishedAt - attempt.startedAt,
		synced: false,
	};
	coll.insert(full);

	const state = gameStore.state;
	const combo = nextCombo(state.combo, full);
	const xp = xpForAttempt(full, combo);
	const levelBefore = levelFromXp(state.xp).level;
	gameActions.applyReward(xp.total, combo);
	const after = gameStore.state;
	const all = [...before, full];
	const unlocked = gameActions.unlockAchievements(
		evaluateAchievements(
			all,
			{ xp: after.xp, streak: after.streak, combo: after.combo },
			chapters,
		),
	);
	const now = Date.now();
	const levelAfter = levelFromXp(after.xp).level;
	if (levelAfter > levelBefore) sfx("levelup");
	return {
		stars: starsFor(full),
		xp,
		combo,
		levelBefore,
		levelAfter,
		newAchievements: ACHIEVEMENTS.filter((a) => unlocked.includes(a.id)),
		masteryBefore: computeMastery(before, now),
		masteryAfter: computeMastery(all, now),
	};
}

export function markLessonDone(chapterId: string) {
	const coll = lessonsCollection();
	if (coll.has(chapterId)) return;
	coll.insert({ id: chapterId, completedAt: Date.now(), synced: false });
}

export function useGame<T>(select: (s: typeof gameStore.state) => T): T {
	return useSelector(gameStore, select);
}
