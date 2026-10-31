import type { ErrorType } from "#/engine/checker/types";

export type AttemptKind =
	| "lesson-try"
	| "exercise"
	| "practice"
	| "boss"
	| "review";

/**
 * One learner session on one exercise, recorded when it ends
 * (solved, solution revealed, or given up / boss failed).
 */
export interface AttemptRecord {
	id: string;
	exerciseId: string;
	chapterId: string;
	kind: AttemptKind;
	concepts: string[];
	difficulty: 1 | 2 | 3 | 4 | 5;
	startedAt: number;
	finishedAt: number;
	/** finishedAt - startedAt, kept for convenience. */
	timeToSolveMs: number;
	runs: number;
	failedSubmissions: number;
	errorTypes: ErrorType[];
	hintsUsed: number;
	revealed: boolean;
	solved: boolean;
}

export interface ConceptMastery {
	conceptId: string;
	/** Learned probability 0..1 (BKT style, difficulty weighted). */
	mastery: number;
	/** mastery after time decay, what gates and the radar use. */
	effective: number;
	attempts: number;
	lastSeen: number | null;
	/** Struggle score 0..1 from recent failures, hints and reveals. */
	struggle: number;
	/** True when the concept was mastered but has decayed below the review threshold. */
	needsReview: boolean;
	/** Successful spaced reviews (drives the decay half-life). */
	reviews: number;
	/** Totals over non-lesson attempts, used for "why you are blocked" messages. */
	totalFailures: number;
	totalHints: number;
	reveals: number;
}

export type MasteryMap = Record<string, ConceptMastery>;

export type BlockReasonKind =
	| "exercises-unsolved"
	| "low-stars"
	| "low-mastery"
	| "struggle"
	| "gauntlet"
	| "boss-failed"
	| "prerequisites";

export interface BlockReason {
	kind: BlockReasonKind;
	conceptId?: string;
	/** Human sentence, e.g. "You needed 4 tries on LEFT JOIN: clear 3 practice drills to unlock the boss". */
	message: string;
}

export interface Gauntlet {
	/** When the gauntlet was triggered (attempt finishedAt). */
	triggeredAt: number;
	/** struggle = too many failures/hints/reveals; low-mastery = main missions done but gate not met; boss-failed = lost the boss. */
	reason: "struggle" | "boss-failed" | "low-mastery";
	targetConcepts: string[];
	exerciseIds: string[];
	clearedIds: string[];
	cleared: boolean;
}

export type ChapterState =
	| "locked"
	| "available"
	| "in-progress"
	| "gauntlet"
	| "boss-ready"
	| "complete";

export interface ChapterStatus {
	chapterId: string;
	state: ChapterState;
	/** Best stars per exercise id (main exercises incl. boss). */
	stars: Record<string, 0 | 1 | 2 | 3>;
	solvedMain: number;
	totalMain: number;
	averageStars: number;
	lessonDone: boolean;
	bossUnlocked: boolean;
	bossCleared: boolean;
	gauntlet: Gauntlet | null;
	reasons: BlockReason[];
	/** Id of the boss exercise, if the chapter has one. */
	bossId: string | null;
	/** First unsolved non-boss main exercise, if any. */
	nextExerciseId: string | null;
	/** Ids of the gauntlet drills not cleared yet (empty when no active gauntlet). */
	pendingDrillIds: string[];
	/** Gate criteria, for progress bars. */
	gateCriteria: {
		allMainSolved: boolean;
		masteryOk: boolean;
		starsOk: boolean;
		weakConcepts: string[];
	};
}

export type NextActivity =
	| { kind: "lesson"; chapterId: string; label: string }
	| { kind: "exercise"; chapterId: string; exerciseId: string; label: string }
	| { kind: "gauntlet"; chapterId: string; exerciseId: string; label: string }
	| { kind: "boss"; chapterId: string; exerciseId: string; label: string }
	| {
			kind: "review";
			conceptId: string;
			chapterId: string;
			exerciseId: string;
			label: string;
	  }
	| { kind: "done"; label: string };

export interface FeedbackPolicy {
	/** Index of a hint to reveal proactively (not charged), or null. */
	proactiveHintIndex: number | null;
	showRefresher: boolean;
	offerSolution: boolean;
}
