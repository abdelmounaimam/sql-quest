import type { Chapter } from "#/content/types";
import { masteryOf } from "./mastery";
import type {
	AttemptRecord,
	ChapterStatus,
	MasteryMap,
	NextActivity,
} from "./types";

export type Track = Chapter["track"];
export const TRACKS: readonly Track[] = [
	"query",
	"mutation",
	"schema",
	"types",
	"performance",
	"advanced",
];

export interface ReviewItem {
	conceptId: string;
	chapterId: string;
	exerciseId: string;
	/** Effective mastery, lowest first. */
	effective: number;
}

/**
 * Concepts that were mastered but are fading, each paired with a drill
 * (practice item of the first chapter, by order, that teaches the concept).
 */
export function reviewQueue(
	mastery: MasteryMap,
	chapters: readonly Chapter[],
): ReviewItem[] {
	const sorted = [...chapters].sort((a, b) => a.order - b.order);
	const items: ReviewItem[] = [];
	for (const m of Object.values(mastery)) {
		if (!m.needsReview) continue;
		for (const ch of sorted) {
			if (!ch.concepts.includes(m.conceptId)) continue;
			const pool = [...ch.practice, ...ch.exercises.filter((e) => !e.boss)]
				.map((e, i) => ({ e, i }))
				.filter(({ e }) => e.concepts.includes(m.conceptId))
				.sort((a, b) => a.e.difficulty - b.e.difficulty || a.i - b.i);
			if (pool.length === 0) continue;
			items.push({
				conceptId: m.conceptId,
				chapterId: ch.id,
				exerciseId: pool[0].e.id,
				effective: m.effective,
			});
			break;
		}
	}
	return items.sort(
		(a, b) =>
			a.effective - b.effective || a.conceptId.localeCompare(b.conceptId),
	);
}

/**
 * Next best activity: an open gauntlet first, then the chapter in progress
 * (lesson, next mission, boss), then fading concepts, then the next chapter.
 */
export function nextActivity(
	chapters: readonly Chapter[],
	statuses: Record<string, ChapterStatus>,
	mastery: MasteryMap,
	_attempts: readonly AttemptRecord[],
	_now: number,
	lessonDone: (chapterId: string) => boolean,
	conceptName: (conceptId: string) => string = (id) => id,
): NextActivity {
	const sorted = [...chapters].sort((a, b) => a.order - b.order);

	for (const ch of sorted) {
		const st = statuses[ch.id];
		if (st?.state === "gauntlet" && st.pendingDrillIds.length > 0)
			return {
				kind: "gauntlet",
				chapterId: ch.id,
				exerciseId: st.pendingDrillIds[0],
				label: `Practice gauntlet: ${ch.title}`,
			};
	}

	const fromChapter = (ch: Chapter): NextActivity | null => {
		const st = statuses[ch.id];
		if (!st) return null;
		if (!lessonDone(ch.id))
			return { kind: "lesson", chapterId: ch.id, label: `Learn: ${ch.title}` };
		if (st.nextExerciseId) {
			const ex = ch.exercises.find((e) => e.id === st.nextExerciseId);
			return {
				kind: "exercise",
				chapterId: ch.id,
				exerciseId: st.nextExerciseId,
				label: `Mission: ${ex?.title ?? st.nextExerciseId}`,
			};
		}
		if (st.bossUnlocked && st.bossId)
			return {
				kind: "boss",
				chapterId: ch.id,
				exerciseId: st.bossId,
				label: `Boss fight: ${ch.title}`,
			};
		return null;
	};

	for (const ch of sorted) {
		if (
			statuses[ch.id]?.state !== "in-progress" &&
			statuses[ch.id]?.state !== "boss-ready"
		)
			continue;
		const act = fromChapter(ch);
		if (act) return act;
	}

	const review = reviewQueue(mastery, sorted)[0];
	if (review)
		return {
			kind: "review",
			conceptId: review.conceptId,
			chapterId: review.chapterId,
			exerciseId: review.exerciseId,
			label: `Review: ${conceptName(review.conceptId)}`,
		};

	for (const ch of sorted) {
		if (statuses[ch.id]?.state !== "available") continue;
		const act = fromChapter(ch);
		if (act) return act;
	}

	return { kind: "done", label: "Every level cleared. Legend." };
}

export interface RadarPoint {
	axis: string;
	value: number;
}

/** Average effective mastery of each track's concepts (0 when unseen). */
export function skillRadar(
	chapters: readonly Chapter[],
	mastery: MasteryMap,
): RadarPoint[] {
	return TRACKS.map((track) => {
		const concepts = [
			...new Set(
				chapters.filter((c) => c.track === track).flatMap((c) => c.concepts),
			),
		];
		const value =
			concepts.length === 0
				? 0
				: concepts.reduce((s, c) => s + masteryOf(mastery, c).effective, 0) /
					concepts.length;
		return { axis: track, value: round2(value) };
	});
}

/** One axis per concept, effective mastery. */
export function conceptRadar(
	conceptIds: readonly string[],
	mastery: MasteryMap,
): RadarPoint[] {
	return conceptIds.map((id) => ({
		axis: id,
		value: round2(masteryOf(mastery, id).effective),
	}));
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
