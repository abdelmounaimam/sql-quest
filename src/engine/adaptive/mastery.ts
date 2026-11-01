import { starsFor } from "./stars";
import type { AttemptRecord, ConceptMastery, MasteryMap } from "./types";

/** Effective mastery a concept needs to count as mastered. */
export const MASTERY_THRESHOLD = 0.6;
/** Starting probability that a concept is already known. */
export const MASTERY_PRIOR = 0.1;
/** Half-life of retention before any spaced review, in days. */
export const BASE_HALF_LIFE_DAYS = 3;
/** Maximum half-life, in days. */
export const MAX_HALF_LIFE_DAYS = 60;
/** Effective mastery never decays below this fraction of learned mastery. */
export const DECAY_FLOOR = 0.4;
/** Weight of a lesson "try" step compared to a real exercise. */
export const LESSON_TRY_WEIGHT = 0.35;
/** Number of recent attempts used for the struggle score. */
export const STRUGGLE_WINDOW = 3;
/**
 * How much a clean solve (first submission, no hint) cuts the guess rate.
 * Writing a whole query right on the first try is hard to do by luck, so a
 * clean solve is stronger evidence than the base guess rate says: with the
 * lesson try, one clean mission lifts a concept past MASTERY_THRESHOLD,
 * while a solve with a hint or a failed try stays under it.
 */
export const CLEAN_SOLVE_GUESS_CUT = 0.4;

const DAY_MS = 86_400_000;
/** Two successes must be at least this far apart to count as a spaced review. */
const SPACING_MS = 20 * 3_600_000;

export interface MasteryOptions {
	prior?: number;
	threshold?: number;
}

export interface BktParams {
	guess: number;
	slip: number;
	learn: number;
}

/**
 * Difficulty shapes the BKT parameters:
 * harder exercises are harder to guess (a solve is stronger evidence, bigger gain)
 * and easier to slip on (a failure is weaker evidence, smaller drop).
 */
export function bktParams(difficulty: number): BktParams {
	const d = Math.min(5, Math.max(1, difficulty)) - 1;
	return {
		guess: 0.25 - 0.04 * d,
		slip: 0.05 + 0.03 * d,
		learn: 0.12 + 0.02 * d,
	};
}

/** Observation quality 0..1: how "correct" the attempt was. */
export function observationQuality(attempt: AttemptRecord): number {
	if (attempt.revealed || !attempt.solved) return 0;
	const stars = starsFor(attempt);
	if (stars === 3) return 1;
	if (stars === 2) return 0.75;
	return 0.45;
}

/** One BKT step with soft evidence `quality` (1 = correct, 0 = wrong). */
export function bktUpdate(
	prior: number,
	quality: number,
	difficulty: number,
	revealed = false,
): number {
	const base = bktParams(difficulty);
	const { slip, learn } = base;
	const guess = base.guess * (1 - CLEAN_SOLVE_GUESS_CUT * quality);
	const pCorrect = prior * (1 - slip) + (1 - prior) * guess;
	const postCorrect = (prior * (1 - slip)) / pCorrect;
	const postWrong = (prior * slip) / (prior * slip + (1 - prior) * (1 - guess));
	const posterior = quality * postCorrect + (1 - quality) * postWrong;
	// Reading a revealed solution teaches a little, but much less than solving.
	const transit = revealed ? learn * 0.3 : learn * (0.4 + 0.6 * quality);
	return clamp01(posterior + (1 - posterior) * transit);
}

/** Struggle of a single attempt, 0..1. */
export function attemptStruggle(a: AttemptRecord): number {
	return clamp01(
		0.15 * a.failedSubmissions +
			0.2 * a.hintsUsed +
			(a.revealed ? 0.6 : 0) +
			(!a.solved ? 0.4 : 0),
	);
}

/** Half-life in days after `reviews` successful spaced reviews. */
export function halfLifeDays(reviews: number): number {
	return Math.min(MAX_HALF_LIFE_DAYS, BASE_HALF_LIFE_DAYS * 2 ** reviews);
}

/** Retention-weighted mastery after `elapsedMs` without practice. */
export function decayed(
	mastery: number,
	elapsedMs: number,
	reviews: number,
): number {
	if (elapsedMs <= 0) return mastery;
	const retention = 0.5 ** (elapsedMs / DAY_MS / halfLifeDays(reviews));
	return mastery * (DECAY_FLOOR + (1 - DECAY_FLOOR) * retention);
}

interface Acc {
	mastery: number;
	attempts: number;
	lastSeen: number | null;
	lastSuccess: number | null;
	reviews: number;
	recent: AttemptRecord[];
	failures: number;
	hints: number;
	reveals: number;
}

/**
 * Replays attempts chronologically and returns per-concept mastery.
 * Pure: same attempts + same `now` = same map.
 */
export function computeMastery(
	attempts: readonly AttemptRecord[],
	now: number,
	opts: MasteryOptions = {},
): MasteryMap {
	const prior = opts.prior ?? MASTERY_PRIOR;
	const threshold = opts.threshold ?? MASTERY_THRESHOLD;
	const sorted = [...attempts]
		.filter((a) => a.finishedAt <= now)
		.sort((a, b) => a.finishedAt - b.finishedAt || a.id.localeCompare(b.id));
	const acc = new Map<string, Acc>();

	for (const a of sorted) {
		const quality = observationQuality(a);
		const weight = a.kind === "lesson-try" ? LESSON_TRY_WEIGHT : 1;
		for (const conceptId of new Set(a.concepts)) {
			let c = acc.get(conceptId);
			if (!c) {
				c = {
					mastery: prior,
					attempts: 0,
					lastSeen: null,
					lastSuccess: null,
					reviews: 0,
					recent: [],
					failures: 0,
					hints: 0,
					reveals: 0,
				};
				acc.set(conceptId, c);
			}
			const full = bktUpdate(c.mastery, quality, a.difficulty, a.revealed);
			c.mastery = clamp01(c.mastery + weight * (full - c.mastery));
			c.attempts += 1;
			if (a.kind !== "lesson-try") {
				c.failures += a.failedSubmissions;
				c.hints += a.hintsUsed;
				if (a.revealed) c.reveals += 1;
				c.recent.push(a);
				if (c.recent.length > STRUGGLE_WINDOW) c.recent.shift();
			}
			if (quality >= 0.75) {
				if (
					c.lastSuccess !== null &&
					a.finishedAt - c.lastSuccess >= SPACING_MS
				)
					c.reviews += 1;
				c.lastSuccess = a.finishedAt;
			}
			c.lastSeen = a.finishedAt;
		}
	}

	const map: MasteryMap = {};
	for (const [conceptId, c] of acc) {
		const elapsed = c.lastSeen === null ? 0 : now - c.lastSeen;
		const effective = decayed(c.mastery, elapsed, c.reviews);
		const struggle =
			c.recent.length === 0
				? 0
				: c.recent.reduce((s, a) => s + attemptStruggle(a), 0) /
					c.recent.length;
		map[conceptId] = {
			conceptId,
			mastery: round4(c.mastery),
			effective: round4(effective),
			attempts: c.attempts,
			lastSeen: c.lastSeen,
			struggle: round4(struggle),
			needsReview: c.mastery >= threshold && effective < threshold,
			reviews: c.reviews,
			totalFailures: c.failures,
			totalHints: c.hints,
			reveals: c.reveals,
		};
	}
	return map;
}

/** Mastery entry for a concept, with neutral defaults when unseen. */
export function masteryOf(map: MasteryMap, conceptId: string): ConceptMastery {
	return (
		map[conceptId] ?? {
			conceptId,
			mastery: 0,
			effective: 0,
			attempts: 0,
			lastSeen: null,
			struggle: 0,
			needsReview: false,
			reviews: 0,
			totalFailures: 0,
			totalHints: 0,
			reveals: 0,
		}
	);
}

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

function round4(n: number): number {
	return Math.round(n * 10_000) / 10_000;
}
