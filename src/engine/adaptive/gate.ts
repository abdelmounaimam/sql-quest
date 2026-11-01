import type { Chapter, Exercise } from "#/content/types";
import { computeMastery, MASTERY_THRESHOLD, masteryOf } from "./mastery";
import { bestStars, isSolved, type Stars } from "./stars";
import type {
	AttemptRecord,
	BlockReason,
	ChapterState,
	ChapterStatus,
	Gauntlet,
	MasteryMap,
} from "./types";

/** Average stars (non-boss main missions) needed to open the boss. */
export const GATE_MIN_AVG_STARS = 1.8;
/** Failures on one concept (since the last gauntlet) that trigger a gauntlet. */
export const STRUGGLE_FAILURES = 3;
/** Hints on one concept (since the last gauntlet) that trigger a gauntlet. */
export const STRUGGLE_HINTS = 2;
/** Reveals on one concept that trigger a gauntlet. */
export const STRUGGLE_REVEALS = 1;
/** Drills per gauntlet. */
export const GAUNTLET_SIZE = 3;
/** Max concepts targeted by one gauntlet. */
export const GAUNTLET_MAX_CONCEPTS = 3;

export interface GateContext {
	chapters: readonly Chapter[];
	mastery: MasteryMap;
	lessonDone: (chapterId: string) => boolean;
	conceptName?: (conceptId: string) => string;
	now: number;
}

interface ConceptCounters {
	failures: number;
	hints: number;
	reveals: number;
	tries: number;
}

interface Trigger {
	at: number;
	reason: Gauntlet["reason"];
	targets: string[];
	/** Counters of the struggled concepts, for messages. */
	counters?: Record<string, ConceptCounters>;
}

const byTime = (a: AttemptRecord, b: AttemptRecord) =>
	a.finishedAt - b.finishedAt || a.id.localeCompare(b.id);

/** True when the chapter is finished: boss cleared, or (no boss) every mission solved and the gate met. */
export function isChapterComplete(
	chapter: Chapter,
	attempts: readonly AttemptRecord[],
	ctx: GateContext,
): boolean {
	return coreStatus(chapter, attempts, ctx).complete;
}

/** Full status of a chapter for the map, the level screen and the gate check. */
export function chapterStatus(
	chapter: Chapter,
	attempts: readonly AttemptRecord[],
	ctx: GateContext,
): ChapterStatus {
	const name = ctx.conceptName ?? ((id: string) => id);
	const missingPrereqs = chapter.prerequisites
		.map((id) => ctx.chapters.find((c) => c.id === id))
		.filter((c): c is Chapter => !!c)
		.filter((c) => !coreStatus(c, attempts, ctx).complete);

	const core = coreStatus(chapter, attempts, ctx);
	const reasons: BlockReason[] = [];

	if (missingPrereqs.length > 0) {
		for (const c of missingPrereqs)
			reasons.push({
				kind: "prerequisites",
				message: `Finish "${c.title}" first`,
			});
		return { ...core.status, state: "locked", bossUnlocked: false, reasons };
	}

	const { status } = core;
	const remaining =
		status.totalMain - (status.bossId ? 1 : 0) - core.solvedNonBoss;
	if (remaining > 0)
		reasons.push({
			kind: "exercises-unsolved",
			message: `Solve ${remaining} more mission${remaining > 1 ? "s" : ""} to reach the boss`,
		});

	const g = status.gauntlet;
	if (g && !g.cleared) {
		const left = g.exerciseIds.length - g.clearedIds.length;
		const drills = `clear ${left} practice drill${left > 1 ? "s" : ""}`;
		const target = status.bossId ? "unlock the boss" : "finish the chapter";
		if (g.reason === "boss-failed") {
			reasons.push({
				kind: "boss-failed",
				conceptId: g.targetConcepts[0],
				message: `The boss beat you: ${drills} on ${list(g.targetConcepts.map(name))} to retry it`,
			});
		} else if (g.reason === "struggle" && core.trigger?.counters) {
			const [cid, cnt] = worstCounter(core.trigger.counters, g.targetConcepts);
			let what: string;
			if (cnt.reveals > 0) what = `You revealed the solution on ${name(cid)}`;
			else if (cnt.failures >= STRUGGLE_FAILURES)
				what = `You needed ${cnt.tries} tries on ${name(cid)}`;
			else what = `You used ${cnt.hints} hints on ${name(cid)}`;
			reasons.push({
				kind: "struggle",
				conceptId: cid,
				message: `${what}: ${drills} to ${target}`,
			});
		} else {
			reasons.push({
				kind: "gauntlet",
				conceptId: g.targetConcepts[0],
				message: `Warm up on ${list(g.targetConcepts.map(name))}: ${drills} to ${target}`,
			});
		}
	}

	if (!status.bossUnlocked && !status.bossCleared && !(g && !g.cleared)) {
		for (const cid of status.gateCriteria.weakConcepts) {
			const m = masteryOf(ctx.mastery, cid);
			reasons.push({
				kind: "low-mastery",
				conceptId: cid,
				message: `${name(cid)} mastery ${pct(m.mastery)} / ${pct(MASTERY_THRESHOLD)} needed`,
			});
		}
		if (!status.gateCriteria.starsOk && core.solvedNonBoss > 0)
			reasons.push({
				kind: "low-stars",
				message: `Average stars ${status.averageStars.toFixed(1)} / ${GATE_MIN_AVG_STARS} needed`,
			});
	}

	let state: ChapterState;
	if (core.complete) state = "complete";
	else if (g && !g.cleared) state = "gauntlet";
	else if (status.bossUnlocked) state = "boss-ready";
	else if (
		!status.lessonDone &&
		!attempts.some((a) => a.chapterId === chapter.id && a.kind !== "lesson-try")
	)
		state = "available";
	else state = "in-progress";

	return { ...status, state, reasons: core.complete ? [] : reasons };
}

interface Core {
	status: Omit<ChapterStatus, "state" | "reasons">;
	complete: boolean;
	solvedNonBoss: number;
	trigger: Trigger | null;
}

function coreStatus(
	chapter: Chapter,
	allAttempts: readonly AttemptRecord[],
	ctx: GateContext,
): Core {
	const attempts = allAttempts
		.filter((a) => a.chapterId === chapter.id && a.finishedAt <= ctx.now)
		.sort(byTime);
	const boss = chapter.exercises.find((e) => e.boss) ?? null;
	const main = chapter.exercises.filter((e) => !e.boss);

	const stars: Record<string, Stars> = {};
	for (const e of chapter.exercises) stars[e.id] = bestStars(attempts, e.id);
	const solvedIds = main
		.filter((e) => isSolved(attempts, e.id))
		.map((e) => e.id);
	const allMainSolved = solvedIds.length === main.length;
	const averageStars =
		main.length === 0
			? 3
			: main.reduce((s, e) => s + stars[e.id], 0) / main.length;

	const gated = gatedConcepts(chapter);
	const weakConcepts = weakAmong(gated, main, ctx.mastery, attempts);
	const masteryOk = weakConcepts.length === 0;
	const starsOk = averageStars >= GATE_MIN_AVG_STARS;

	const bossCleared =
		!!boss &&
		attempts.some((a) => a.exerciseId === boss.id && a.solved && !a.revealed);

	// --- gauntlet triggers, derived from attempts only ---
	const triggers: Trigger[] = struggleAndBossTriggers(chapter, attempts, boss);
	if (allMainSolved && main.length > 0) {
		// Judge the gate as it stood when the last mission was solved, so the
		// trigger stays stable once drills raise mastery afterwards.
		const completedAt = mainCompletedAt(attempts, main);
		const m = computeMastery(
			allAttempts.filter((a) => a.finishedAt <= completedAt),
			completedAt,
		);
		const weakThen = weakAmong(
			gated,
			main,
			m,
			attempts.filter((a) => a.finishedAt <= completedAt),
		);
		const failedAtCompletion = !starsOk || weakThen.length > 0;
		// Waived as soon as the live gate is met (drills or replays lifted the
		// weak concepts): the screen never says "mastery OK" and "not solid
		// yet" at once, and nobody drills a concept they have since shown.
		const liveGateMet = masteryOk && starsOk;
		if (
			failedAtCompletion &&
			!liveGateMet &&
			!triggers.some((t) => t.at >= completedAt)
		) {
			let targets = [...weakThen].sort(
				(a, b) =>
					masteryOf(m, a).mastery - masteryOf(m, b).mastery ||
					a.localeCompare(b),
			);
			if (targets.length === 0) {
				// Mastery fine but stars low: target the concepts of the weakest missions.
				const weakest = [...main].sort(
					(a, b) => stars[a.id] - stars[b.id] || a.id.localeCompare(b.id),
				);
				targets = unique(weakest.flatMap((e) => e.concepts));
			}
			triggers.push({
				at: completedAt,
				reason: "low-mastery",
				targets: targets.slice(0, GAUNTLET_MAX_CONCEPTS),
			});
			triggers.sort((a, b) => a.at - b.at);
		}
	}

	const trigger = triggers.length > 0 ? triggers[triggers.length - 1] : null;
	let gauntlet: Gauntlet | null = null;
	if (trigger && !bossCleared) {
		const exerciseIds = pickDrills(chapter, allAttempts, trigger);
		const clearedIds = exerciseIds.filter((id) =>
			attempts.some(
				(a) =>
					a.exerciseId === id &&
					a.kind === "practice" &&
					a.solved &&
					!a.revealed &&
					a.finishedAt > trigger.at,
			),
		);
		gauntlet = {
			triggeredAt: trigger.at,
			reason: trigger.reason,
			targetConcepts: trigger.targets,
			exerciseIds,
			clearedIds,
			cleared: clearedIds.length === exerciseIds.length,
		};
	}

	const gauntletBlocks = !!gauntlet && !gauntlet.cleared;
	const gateMet = (masteryOk && starsOk) || (!!gauntlet && gauntlet.cleared);
	const bossUnlocked =
		!!boss && !bossCleared && allMainSolved && gateMet && !gauntletBlocks;
	const complete = boss
		? bossCleared
		: allMainSolved && gateMet && !gauntletBlocks;

	return {
		complete,
		solvedNonBoss: solvedIds.length,
		trigger,
		status: {
			chapterId: chapter.id,
			stars,
			solvedMain:
				solvedIds.length + (boss && isSolved(attempts, boss.id) ? 1 : 0),
			totalMain: chapter.exercises.length,
			averageStars: Math.round(averageStars * 100) / 100,
			lessonDone: ctx.lessonDone(chapter.id),
			bossUnlocked,
			bossCleared,
			gauntlet: bossCleared ? null : gauntlet,
			bossId: boss?.id ?? null,
			nextExerciseId: main.find((e) => !isSolved(attempts, e.id))?.id ?? null,
			pendingDrillIds: gauntlet
				? gauntlet.exerciseIds.filter((id) => !gauntlet.clearedIds.includes(id))
				: [],
			gateCriteria: { allMainSolved, masteryOk, starsOk, weakConcepts },
		},
	};
}

/**
 * Concepts the gate checks: the chapter concepts that at least one non-boss
 * mission practises. A concept only the boss uses cannot be shown before the
 * boss, so it never blocks the door.
 */
export function gatedConcepts(chapter: Chapter): string[] {
	const practised = new Set(
		chapter.exercises.filter((e) => !e.boss).flatMap((e) => e.concepts),
	);
	return chapter.concepts.filter((c) => practised.has(c));
}

/**
 * Gated concepts still weak. A concept is solid when its learned mastery
 * (before time decay: decay schedules reviews, it never re-locks a door) is
 * at the threshold, or when every mission that practises it was solved
 * cleanly (first submission, no hint). The second rule is the guarantee:
 * a flawless run always passes the gate, whatever the tagging.
 */
function weakAmong(
	concepts: readonly string[],
	main: readonly Exercise[],
	mastery: MasteryMap,
	attempts: readonly AttemptRecord[],
): string[] {
	return concepts.filter((c) => {
		if (masteryOf(mastery, c).mastery >= MASTERY_THRESHOLD) return false;
		const covering = main.filter((e) => e.concepts.includes(c));
		const clean =
			covering.length > 0 &&
			covering.every((e) => bestStars(attempts, e.id) === 3);
		return !clean;
	});
}

/** Walks main-mission attempts in order; counters reset after each trigger. */
function struggleAndBossTriggers(
	chapter: Chapter,
	attempts: readonly AttemptRecord[],
	boss: Exercise | null,
): Trigger[] {
	const triggers: Trigger[] = [];
	const mainIds = new Set(
		chapter.exercises.filter((e) => !e.boss).map((e) => e.id),
	);
	let counters: Record<string, ConceptCounters> = {};

	for (const a of attempts) {
		if (boss && a.exerciseId === boss.id) {
			if (!a.solved || a.revealed) {
				triggers.push({
					at: a.finishedAt,
					reason: "boss-failed",
					targets: unique(boss.concepts).slice(0, GAUNTLET_MAX_CONCEPTS),
				});
				counters = {};
			}
			continue;
		}
		if (a.kind !== "exercise" || !mainIds.has(a.exerciseId)) continue;
		for (const cid of unique(a.concepts)) {
			const c = counters[cid] ?? {
				failures: 0,
				hints: 0,
				reveals: 0,
				tries: 0,
			};
			counters[cid] = c;
			c.failures += a.failedSubmissions;
			c.hints += a.hintsUsed;
			c.reveals += a.revealed ? 1 : 0;
			c.tries += a.failedSubmissions + (a.solved ? 1 : 0);
		}
		const struggled = Object.entries(counters)
			.filter(
				([, c]) =>
					c.failures >= STRUGGLE_FAILURES ||
					c.hints >= STRUGGLE_HINTS ||
					c.reveals >= STRUGGLE_REVEALS,
			)
			.sort(
				([ia, a], [ib, b]) => severity(b) - severity(a) || ia.localeCompare(ib),
			)
			.map(([id]) => id);
		if (struggled.length > 0) {
			triggers.push({
				at: a.finishedAt,
				reason: "struggle",
				targets: struggled.slice(0, GAUNTLET_MAX_CONCEPTS),
				counters,
			});
			counters = {};
		}
	}
	return triggers;
}

function severity(c: ConceptCounters): number {
	return c.failures + 2 * c.hints + 4 * c.reveals;
}

/** finishedAt of the first-solve that completed the set of main missions. */
function mainCompletedAt(
	attempts: readonly AttemptRecord[],
	main: readonly Exercise[],
): number {
	let at = 0;
	for (const e of main) {
		const first = attempts.find((a) => a.exerciseId === e.id && a.solved);
		if (first && first.finishedAt > at) at = first.finishedAt;
	}
	return at;
}

/**
 * Deterministic drill choice: round-robin over target concepts, preferring
 * drills never solved before the trigger, then lower difficulty, then pool order.
 */
export function pickDrills(
	chapter: Chapter,
	attempts: readonly AttemptRecord[],
	trigger: { at: number; targets: readonly string[] },
	size = GAUNTLET_SIZE,
): string[] {
	const pool = chapter.practice;
	if (pool.length === 0) return [];
	const solvedBefore = (id: string) =>
		attempts.some(
			(a) => a.exerciseId === id && a.solved && a.finishedAt <= trigger.at,
		);
	const rank = (e: Exercise) => (solvedBefore(e.id) ? 10 : 0) + e.difficulty;
	const ordered = pool
		.map((e, i) => ({ e, i }))
		.sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i)
		.map(({ e }) => e);

	const picked: string[] = [];
	const take = (e: Exercise | undefined) => {
		if (e && !picked.includes(e.id) && picked.length < size) picked.push(e.id);
	};
	const targets =
		trigger.targets.length > 0 ? trigger.targets : chapter.concepts;
	// Round-robin over targets until the gauntlet is full or no target has a fresh drill.
	let progress = true;
	while (picked.length < size && progress) {
		progress = false;
		for (const t of targets) {
			const next = ordered.find(
				(e) => e.concepts.includes(t) && !picked.includes(e.id),
			);
			if (next) {
				take(next);
				progress = true;
			}
		}
	}
	// No drill covers the targets at all: fall back to the easiest drills of the pool.
	if (picked.length === 0) for (const e of ordered) take(e);
	return picked;
}

function worstCounter(
	counters: Record<string, ConceptCounters>,
	targets: readonly string[],
): [string, ConceptCounters] {
	const id = targets.find((t) => counters[t]) ?? Object.keys(counters)[0];
	return [id, counters[id]];
}

function unique<T>(xs: readonly T[]): T[] {
	return [...new Set(xs)];
}

function pct(n: number): string {
	return `${Math.round(n * 100)}%`;
}

function list(names: readonly string[]): string {
	if (names.length <= 1) return names[0] ?? "";
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
