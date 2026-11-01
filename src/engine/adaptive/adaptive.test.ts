import { describe, expect, it } from "vitest";
import type { Chapter, Exercise } from "#/content/types";
import {
	ACHIEVEMENTS,
	type AttemptRecord,
	bestStars,
	chapterStatus,
	comboMultiplier,
	computeMastery,
	evaluateAchievements,
	feedbackPolicy,
	type GateContext,
	levelFromXp,
	MASTERY_THRESHOLD,
	type MasteryMap,
	nextActivity,
	nextCombo,
	pickDrills,
	reviewQueue,
	skillRadar,
	starsFor,
	streakUpdate,
	xpForAttempt,
	xpToNext,
} from "./index";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 10, 12);

function ex(
	id: string,
	concepts: string[],
	extra: Partial<Exercise> = {},
): Exercise {
	return {
		id,
		title: id,
		prompt: "p",
		difficulty: 2,
		kind: "query",
		concepts,
		solutionSql: "select 1",
		check: { type: "result" },
		hints: ["h1", "h2", "h3"],
		explanation: "e",
		...extra,
	};
}

function chapter(id: string, extra: Partial<Chapter> = {}): Chapter {
	return {
		id,
		order: 1,
		world: "w",
		tier: "novice",
		track: "query",
		title: `Chapter ${id}`,
		subtitle: "",
		emoji: "x",
		datasetId: "d",
		concepts: ["select", "where"],
		prerequisites: [],
		lesson: [],
		exercises: [
			ex(`${id}-e1`, ["select"], { difficulty: 1 }),
			ex(`${id}-e2`, ["where"], { difficulty: 2 }),
			ex(`${id}-boss`, ["select", "where"], { difficulty: 3, boss: true }),
		],
		practice: [
			ex(`${id}-p1`, ["select"], { difficulty: 1 }),
			ex(`${id}-p2`, ["where"], { difficulty: 1 }),
			ex(`${id}-p3`, ["where"], { difficulty: 2 }),
			ex(`${id}-p4`, ["select"], { difficulty: 3 }),
		],
		...extra,
	};
}

let seq = 0;
function att(
	exerciseId: string,
	concepts: string[],
	t: number,
	extra: Partial<AttemptRecord> = {},
): AttemptRecord {
	seq += 1;
	return {
		id: `a${String(seq).padStart(4, "0")}`,
		exerciseId,
		chapterId: exerciseId.split("-")[0],
		kind: "exercise",
		concepts,
		difficulty: 2,
		startedAt: t - 60_000,
		finishedAt: t,
		timeToSolveMs: 60_000,
		runs: 1,
		failedSubmissions: 0,
		hintsUsed: 0,
		errorTypes: [],
		revealed: false,
		solved: true,
		...extra,
	};
}

function ctxFor(
	chapters: Chapter[],
	attempts: AttemptRecord[],
	now: number,
	lessons: string[] = chapters.map((c) => c.id),
): GateContext {
	return {
		chapters,
		mastery: computeMastery(attempts, now),
		lessonDone: (id) => lessons.includes(id),
		conceptName: (id) => id.toUpperCase(),
		now,
	};
}

/** Several clean solves on both concepts so mastery passes the gate. */
function strongPractice(ch: string, t: number): AttemptRecord[] {
	const out: AttemptRecord[] = [];
	for (let i = 0; i < 4; i++) {
		out.push(
			att(`${ch}-p1`, ["select"], t + i * 1000, {
				kind: "practice",
				difficulty: 3,
			}),
		);
		out.push(
			att(`${ch}-p2`, ["where"], t + i * 1000 + 500, {
				kind: "practice",
				difficulty: 3,
			}),
		);
	}
	return out;
}

describe("stars", () => {
	it("follows the star rules", () => {
		const base = {
			solved: true,
			revealed: false,
			failedSubmissions: 0,
			hintsUsed: 0,
		};
		expect(starsFor(base)).toBe(3);
		expect(starsFor({ ...base, hintsUsed: 1 })).toBe(2);
		expect(starsFor({ ...base, failedSubmissions: 2, hintsUsed: 1 })).toBe(2);
		expect(starsFor({ ...base, failedSubmissions: 3 })).toBe(1);
		expect(starsFor({ ...base, hintsUsed: 2 })).toBe(1);
		expect(starsFor({ ...base, revealed: true })).toBe(0);
		expect(starsFor({ ...base, solved: false })).toBe(0);
	});

	it("keeps the best stars per exercise", () => {
		const attempts = [
			att("c-e1", ["select"], T0, { failedSubmissions: 4 }),
			att("c-e1", ["select"], T0 + 1, { hintsUsed: 1 }),
		];
		expect(bestStars(attempts, "c-e1")).toBe(2);
		expect(bestStars(attempts, "nope")).toBe(0);
	});
});

describe("mastery", () => {
	it("rises with clean solves and falls with failures", () => {
		const up = computeMastery(
			[att("c-e1", ["select"], T0), att("c-e1", ["select"], T0 + 1000)],
			T0 + 2000,
		);
		expect(up.select.mastery).toBeGreaterThan(0.5);
		const down = computeMastery(
			[
				att("c-e1", ["select"], T0),
				att("c-e1", ["select"], T0 + 1000),
				att("c-e2", ["select"], T0 + 2000, {
					solved: false,
					failedSubmissions: 4,
				}),
			],
			T0 + 3000,
		);
		expect(down.select.mastery).toBeLessThan(up.select.mastery);
	});

	it("weights by difficulty: hard solves gain more, easy failures drop more", () => {
		const easy = computeMastery(
			[att("c-e1", ["x"], T0, { difficulty: 1 })],
			T0,
		);
		const hard = computeMastery(
			[att("c-e1", ["x"], T0, { difficulty: 5 })],
			T0,
		);
		expect(hard.x.mastery).toBeGreaterThan(easy.x.mastery);

		const seed = [0, 1, 2].map((i) =>
			att("c-e1", ["x"], T0 + i, { difficulty: 3 }),
		);
		const before = computeMastery(seed, T0 + 10).x.mastery;
		const failEasy = computeMastery(
			[...seed, att("c-e2", ["x"], T0 + 5, { difficulty: 1, solved: false })],
			T0 + 10,
		).x.mastery;
		const failHard = computeMastery(
			[...seed, att("c-e2", ["x"], T0 + 5, { difficulty: 5, solved: false })],
			T0 + 10,
		).x.mastery;
		expect(failEasy).toBeLessThan(failHard);
		expect(failHard).toBeLessThan(before);
	});

	it("gives lesson tries a low weight", () => {
		const lesson = computeMastery(
			[att("c-t", ["x"], T0, { kind: "lesson-try" })],
			T0,
		);
		const real = computeMastery([att("c-e1", ["x"], T0)], T0);
		expect(lesson.x.mastery).toBeLessThan(real.x.mastery);
		expect(lesson.x.mastery).toBeGreaterThan(0.1);
	});

	it("decays over time and flags reviews; spaced reviews slow the decay", () => {
		const attempts = [0, 1, 2].map((i) =>
			att("c-e1", ["x"], T0 + i, { difficulty: 3 }),
		);
		const fresh = computeMastery(attempts, T0 + 10).x;
		expect(fresh.mastery).toBeGreaterThanOrEqual(MASTERY_THRESHOLD);
		expect(fresh.needsReview).toBe(false);
		const later = computeMastery(attempts, T0 + 20 * DAY).x;
		expect(later.effective).toBeLessThan(fresh.effective);
		expect(later.needsReview).toBe(true);

		const spaced = [0, 2, 6].map((d) =>
			att("c-e1", ["x"], T0 + d * DAY, { difficulty: 3 }),
		);
		const s = computeMastery(spaced, T0 + 6 * DAY + 10 * DAY).x;
		const crammedFromSameLast = computeMastery(
			[0, 1, 2].map((i) =>
				att("c-e1", ["x"], T0 + 6 * DAY + i, { difficulty: 3 }),
			),
			T0 + 6 * DAY + 10 * DAY,
		).x;
		expect(s.reviews).toBe(2);
		expect(s.effective / s.mastery).toBeGreaterThan(
			crammedFromSameLast.effective / crammedFromSameLast.mastery,
		);
	});

	it("lifts a concept past the threshold with the lesson try and one clean solve", () => {
		for (const difficulty of [1, 2] as const) {
			const lessonTry = att("c-t", ["x"], T0, {
				kind: "lesson-try",
				difficulty: 1,
			});
			const clean = computeMastery(
				[lessonTry, att("c-e1", ["x"], T0 + 1000, { difficulty })],
				T0 + 2000,
			).x;
			expect(clean.mastery).toBeGreaterThanOrEqual(MASTERY_THRESHOLD);
			// A hint or a failed submission is weaker evidence: still under.
			const hinted = computeMastery(
				[
					lessonTry,
					att("c-e1", ["x"], T0 + 1000, { difficulty, hintsUsed: 1 }),
				],
				T0 + 2000,
			).x;
			expect(hinted.mastery).toBeLessThan(MASTERY_THRESHOLD);
		}
	});

	it("scores struggle from recent attempts", () => {
		const m = computeMastery(
			[att("c-e1", ["x"], T0, { failedSubmissions: 3, hintsUsed: 2 })],
			T0,
		);
		expect(m.x.struggle).toBeGreaterThan(0.5);
		expect(m.x.totalFailures).toBe(3);
		expect(m.x.totalHints).toBe(2);
	});
});

describe("gate", () => {
	it("is available, then in progress with reasons", () => {
		const ch = chapter("c");
		const empty = chapterStatus(ch, [], ctxFor([ch], [], T0, []));
		expect(empty.state).toBe("available");
		expect(empty.bossUnlocked).toBe(false);

		const attempts = [att("c-e1", ["select"], T0, { difficulty: 1 })];
		const st = chapterStatus(ch, attempts, ctxFor([ch], attempts, T0 + 1));
		expect(st.state).toBe("in-progress");
		expect(st.nextExerciseId).toBe("c-e2");
		expect(st.reasons.map((r) => r.message)).toContain(
			"Solve 1 more mission to reach the boss",
		);
	});

	it("opens the boss when missions, mastery and stars are good", () => {
		const ch = chapter("c");
		const attempts = [
			...strongPractice("c", T0),
			att("c-e1", ["select"], T0 + 10_000, { difficulty: 3 }),
			att("c-e2", ["where"], T0 + 11_000, { difficulty: 3 }),
		];
		const st = chapterStatus(ch, attempts, ctxFor([ch], attempts, T0 + 12_000));
		expect(st.gateCriteria).toMatchObject({
			allMainSolved: true,
			masteryOk: true,
			starsOk: true,
		});
		expect(st.state).toBe("boss-ready");
		expect(st.bossUnlocked).toBe(true);
		expect(st.reasons).toEqual([]);

		const won = [
			...attempts,
			att("c-boss", ["select", "where"], T0 + 13_000, { kind: "boss" }),
		];
		const done = chapterStatus(ch, won, ctxFor([ch], won, T0 + 14_000));
		expect(done.state).toBe("complete");
		expect(done.bossCleared).toBe(true);
	});

	it("triggers a struggle gauntlet with a clear reason, and clearing it opens the boss", () => {
		const ch = chapter("c");
		const attempts = [
			att("c-e1", ["select"], T0, { difficulty: 1 }),
			att("c-e2", ["where"], T0 + 1000, { failedSubmissions: 3 }),
		];
		const st = chapterStatus(ch, attempts, ctxFor([ch], attempts, T0 + 2000));
		expect(st.state).toBe("gauntlet");
		expect(st.gauntlet?.reason).toBe("struggle");
		expect(st.gauntlet?.targetConcepts).toEqual(["where"]);
		expect(st.gauntlet?.exerciseIds).toEqual(["c-p2", "c-p3"]);
		expect(st.bossUnlocked).toBe(false);
		expect(st.reasons.find((r) => r.kind === "struggle")?.message).toBe(
			"You needed 4 tries on WHERE: clear 2 practice drills to unlock the boss",
		);

		const cleared = [
			...attempts,
			att("c-p2", ["where"], T0 + 3000, { kind: "practice", difficulty: 1 }),
			att("c-p3", ["where"], T0 + 4000, { kind: "practice" }),
		];
		const after = chapterStatus(ch, cleared, ctxFor([ch], cleared, T0 + 5000));
		expect(after.gauntlet?.cleared).toBe(true);
		expect(after.bossUnlocked).toBe(true);
		expect(after.state).toBe("boss-ready");
	});

	it("practice solved before the trigger does not count, revealed drills do not clear", () => {
		const ch = chapter("c");
		const attempts = [
			att("c-p2", ["where"], T0 - 1000, { kind: "practice" }),
			att("c-e1", ["select"], T0),
			att("c-e2", ["where"], T0 + 1000, { revealed: true, solved: true }),
			att("c-p3", ["where"], T0 + 2000, { kind: "practice", revealed: true }),
		];
		const st = chapterStatus(ch, attempts, ctxFor([ch], attempts, T0 + 3000));
		expect(st.gauntlet?.reason).toBe("struggle");
		// fresh drill (p3) preferred over one solved before the trigger (p2)
		expect(st.gauntlet?.exerciseIds[0]).toBe("c-p3");
		expect(st.gauntlet?.clearedIds).toEqual([]);
		expect(st.reasons[0].message).toContain(
			"You revealed the solution on WHERE",
		);
	});

	it("triggers a low-mastery gauntlet when missions are done but the gate fails", () => {
		const ch = chapter("c");
		const attempts = [
			att("c-e1", ["select"], T0, { difficulty: 1, hintsUsed: 1 }),
			att("c-e2", ["where"], T0 + 1000, {
				difficulty: 1,
				failedSubmissions: 1,
			}),
		];
		const st = chapterStatus(ch, attempts, ctxFor([ch], attempts, T0 + 2000));
		expect(st.gateCriteria.allMainSolved).toBe(true);
		expect(st.gateCriteria.masteryOk).toBe(false);
		expect(st.gauntlet?.reason).toBe("low-mastery");
		expect(st.gauntlet?.triggeredAt).toBe(T0 + 1000);
		expect(st.state).toBe("gauntlet");
		expect(st.reasons.some((r) => r.kind === "gauntlet")).toBe(true);
	});

	it("keeps the low-mastery gauntlet stable while its drills raise mastery", () => {
		const ch = chapter("c");
		const attempts = [
			att("c-e1", ["select"], T0, { difficulty: 1, failedSubmissions: 3 }),
			att("c-e2", ["where"], T0 + 1000, { difficulty: 1, hintsUsed: 1 }),
		];
		const first = chapterStatus(
			ch,
			attempts,
			ctxFor([ch], attempts, T0 + 2000),
		);
		expect(first.gauntlet).not.toBeNull();
		const triggeredAt = first.gauntlet?.triggeredAt;
		// Clear every drill of that gauntlet.
		const cleared = [
			...attempts,
			...(first.gauntlet?.exerciseIds ?? []).map((id, i) =>
				att(id, ["select", "where"], T0 + 5000 + i * 1000, {
					kind: "practice",
					difficulty: 3,
				}),
			),
		];
		const after = chapterStatus(
			ch,
			cleared,
			ctxFor([ch], cleared, T0 + 20_000),
		);
		expect(after.gauntlet?.triggeredAt).toBe(triggeredAt);
		expect(after.gauntlet?.cleared).toBe(true);
		expect(after.bossUnlocked).toBe(true);
	});

	it("sends a failed boss to targeted practice", () => {
		const ch = chapter("c");
		const attempts = [
			...strongPractice("c", T0),
			att("c-e1", ["select"], T0 + 10_000, { difficulty: 3 }),
			att("c-e2", ["where"], T0 + 11_000, { difficulty: 3 }),
			att("c-boss", ["select", "where"], T0 + 12_000, {
				kind: "boss",
				solved: false,
				failedSubmissions: 3,
			}),
		];
		const st = chapterStatus(ch, attempts, ctxFor([ch], attempts, T0 + 13_000));
		expect(st.state).toBe("gauntlet");
		expect(st.gauntlet?.reason).toBe("boss-failed");
		expect(st.gauntlet?.targetConcepts).toEqual(["select", "where"]);
		expect(st.gauntlet?.exerciseIds).toHaveLength(3);
		expect(st.bossUnlocked).toBe(false);
		expect(st.reasons[0].kind).toBe("boss-failed");
	});

	it("opens the boss after a flawless run, even with one mission per concept", () => {
		const ch = chapter("c");
		// No lesson try, the weakest evidence: clean solves alone must pass.
		const attempts = [
			att("c-e1", ["select"], T0, { difficulty: 1 }),
			att("c-e2", ["where"], T0 + 1000, { difficulty: 1 }),
		];
		const st = chapterStatus(ch, attempts, ctxFor([ch], attempts, T0 + 2000));
		expect(st.gateCriteria.masteryOk).toBe(true);
		expect(st.gateCriteria.weakConcepts).toEqual([]);
		expect(st.gauntlet).toBeNull();
		expect(st.bossUnlocked).toBe(true);
		expect(st.reasons).toEqual([]);
	});

	it("never gates on a concept only the boss practises", () => {
		const ch = chapter("c", {
			concepts: ["select", "where", "join"],
			exercises: [
				ex("c-e1", ["select"], { difficulty: 1 }),
				ex("c-e2", ["where"], { difficulty: 2 }),
				ex("c-boss", ["select", "where", "join"], {
					difficulty: 3,
					boss: true,
				}),
			],
		});
		const attempts = [
			att("c-e1", ["select"], T0, { difficulty: 1 }),
			att("c-e2", ["where"], T0 + 1000),
		];
		const st = chapterStatus(ch, attempts, ctxFor([ch], attempts, T0 + 2000));
		expect(st.gateCriteria.weakConcepts).not.toContain("join");
		expect(st.bossUnlocked).toBe(true);
	});

	it("waives a low-mastery gauntlet once live mastery and stars meet the gate", () => {
		const ch = chapter("c");
		const attempts = [
			att("c-e1", ["select"], T0, { difficulty: 1, hintsUsed: 1 }),
			att("c-e2", ["where"], T0 + 1000, { difficulty: 1, hintsUsed: 1 }),
		];
		const first = chapterStatus(
			ch,
			attempts,
			ctxFor([ch], attempts, T0 + 2000),
		);
		expect(first.gauntlet?.reason).toBe("low-mastery");
		// One drill and a clean replay lift both concepts: no more drills owed.
		const later = [
			...attempts,
			att("c-p1", ["select", "where"], T0 + 3000, {
				kind: "practice",
				difficulty: 3,
			}),
			att("c-e1", ["select"], T0 + 4000, { difficulty: 1 }),
		];
		const st = chapterStatus(ch, later, ctxFor([ch], later, T0 + 5000));
		expect(st.gateCriteria.masteryOk).toBe(true);
		expect(st.gauntlet).toBeNull();
		expect(st.bossUnlocked).toBe(true);
		const mastery = st.reasons.some((r) => r.kind === "gauntlet");
		expect(mastery).toBe(false);
	});

	it("keeps an open boss open while mastery decays", () => {
		const ch = chapter("c");
		const attempts = [
			...strongPractice("c", T0),
			att("c-e1", ["select"], T0 + 10_000, { difficulty: 3 }),
			att("c-e2", ["where"], T0 + 11_000, { difficulty: 3 }),
		];
		const later = T0 + 10 * DAY;
		const ctx = ctxFor([ch], attempts, later);
		expect(ctx.mastery.select.effective).toBeLessThan(MASTERY_THRESHOLD);
		const st = chapterStatus(ch, attempts, ctx);
		expect(st.bossUnlocked).toBe(true);
	});

	it("locks a chapter until its prerequisites are complete", () => {
		const a = chapter("a");
		const b = chapter("b", { order: 2, prerequisites: ["a"] });
		const st = chapterStatus(b, [], ctxFor([a, b], [], T0));
		expect(st.state).toBe("locked");
		expect(st.reasons[0]).toMatchObject({
			kind: "prerequisites",
			message: 'Finish "Chapter a" first',
		});

		const attempts = [
			...strongPractice("a", T0),
			att("a-e1", ["select"], T0 + 10_000, { difficulty: 3 }),
			att("a-e2", ["where"], T0 + 11_000, { difficulty: 3 }),
			att("a-boss", ["select", "where"], T0 + 12_000, { kind: "boss" }),
		];
		const after = chapterStatus(
			b,
			attempts,
			ctxFor([a, b], attempts, T0 + 13_000, ["a"]),
		);
		expect(after.state).toBe("available");
	});

	it("picks drills deterministically, round-robin over targets", () => {
		const ch = chapter("c");
		expect(
			pickDrills(ch, [], { at: T0, targets: ["select", "where"] }),
		).toEqual(["c-p1", "c-p2", "c-p4"]);
		expect(
			pickDrills(chapter("c", { practice: [] }), [], {
				at: T0,
				targets: ["x"],
			}),
		).toEqual([]);
	});
});

describe("recommendations", () => {
	function statusesFor(
		chapters: Chapter[],
		attempts: AttemptRecord[],
		now: number,
		lessons: string[],
	) {
		const ctx = ctxFor(chapters, attempts, now, lessons);
		return {
			ctx,
			statuses: Object.fromEntries(
				chapters.map((c) => [c.id, chapterStatus(c, attempts, ctx)]),
			),
		};
	}

	it("orders gauntlet, lesson, mission, boss, next chapter", () => {
		const a = chapter("a");
		const b = chapter("b", { order: 2, prerequisites: ["a"] });
		const chapters = [a, b];

		let attempts: AttemptRecord[] = [];
		let s = statusesFor(chapters, attempts, T0, []);
		expect(
			nextActivity(
				chapters,
				s.statuses,
				s.ctx.mastery,
				attempts,
				T0,
				s.ctx.lessonDone,
			),
		).toMatchObject({
			kind: "lesson",
			chapterId: "a",
		});

		s = statusesFor(chapters, attempts, T0, ["a"]);
		expect(
			nextActivity(
				chapters,
				s.statuses,
				s.ctx.mastery,
				attempts,
				T0,
				s.ctx.lessonDone,
			),
		).toMatchObject({
			kind: "exercise",
			exerciseId: "a-e1",
		});

		attempts = [
			att("a-e1", ["select"], T0),
			att("a-e2", ["where"], T0 + 1, { failedSubmissions: 3 }),
		];
		s = statusesFor(chapters, attempts, T0 + 2, ["a"]);
		expect(
			nextActivity(
				chapters,
				s.statuses,
				s.ctx.mastery,
				attempts,
				T0 + 2,
				s.ctx.lessonDone,
			),
		).toMatchObject({
			kind: "gauntlet",
			exerciseId: "a-p2",
		});

		attempts = [
			...strongPractice("a", T0),
			att("a-e1", ["select"], T0 + 10_000, { difficulty: 3 }),
			att("a-e2", ["where"], T0 + 11_000, { difficulty: 3 }),
		];
		s = statusesFor(chapters, attempts, T0 + 12_000, ["a"]);
		expect(
			nextActivity(
				chapters,
				s.statuses,
				s.ctx.mastery,
				attempts,
				T0,
				s.ctx.lessonDone,
			),
		).toMatchObject({
			kind: "boss",
			exerciseId: "a-boss",
		});

		attempts = [
			...attempts,
			att("a-boss", ["select", "where"], T0 + 13_000, { kind: "boss" }),
		];
		s = statusesFor(chapters, attempts, T0 + 14_000, ["a"]);
		expect(
			nextActivity(
				chapters,
				s.statuses,
				s.ctx.mastery,
				attempts,
				T0,
				s.ctx.lessonDone,
			),
		).toMatchObject({
			kind: "lesson",
			chapterId: "b",
		});
	});

	it("schedules reviews for fading concepts before new chapters", () => {
		const a = chapter("a");
		const b = chapter("b", { order: 2, prerequisites: ["a"] });
		const attempts = [
			...strongPractice("a", T0),
			att("a-e1", ["select"], T0 + 10_000, { difficulty: 3 }),
			att("a-e2", ["where"], T0 + 11_000, { difficulty: 3 }),
			att("a-boss", ["select", "where"], T0 + 12_000, { kind: "boss" }),
		];
		const now = T0 + 30 * DAY;
		const ctx = ctxFor([a, b], attempts, now, ["a"]);
		const queue = reviewQueue(ctx.mastery, [a, b]);
		expect(queue.length).toBe(2);
		expect(queue[0]).toMatchObject({ chapterId: "a" });
		const statuses = Object.fromEntries(
			[a, b].map((c) => [c.id, chapterStatus(c, attempts, ctx)]),
		);
		expect(statuses.a.state).toBe("complete");
		expect(
			nextActivity([a, b], statuses, ctx.mastery, attempts, now, ctx.lessonDone)
				.kind,
		).toBe("review");
	});

	it("builds a 6-axis skill radar", () => {
		const mastery: MasteryMap = computeMastery(
			strongPractice("a", T0),
			T0 + 10_000,
		);
		const radar = skillRadar([chapter("a")], mastery);
		expect(radar.map((r) => r.axis)).toEqual([
			"query",
			"mutation",
			"schema",
			"types",
			"performance",
			"advanced",
		]);
		expect(radar[0].value).toBeGreaterThan(0.6);
		expect(radar[1].value).toBe(0);
	});
});

describe("feedback policy", () => {
	it("escalates help with failures", () => {
		expect(
			feedbackPolicy({ failures: 1, hintsShown: 0, totalHints: 3 }),
		).toEqual({
			proactiveHintIndex: null,
			showRefresher: false,
			offerSolution: false,
		});
		expect(
			feedbackPolicy({ failures: 2, hintsShown: 0, totalHints: 3 })
				.proactiveHintIndex,
		).toBe(0);
		expect(
			feedbackPolicy({ failures: 2, hintsShown: 1, totalHints: 3 })
				.proactiveHintIndex,
		).toBeNull();
		const three = feedbackPolicy({ failures: 3, hintsShown: 1, totalHints: 3 });
		expect(three.proactiveHintIndex).toBe(1);
		expect(three.showRefresher).toBe(true);
		expect(three.offerSolution).toBe(false);
		expect(
			feedbackPolicy({ failures: 5, hintsShown: 3, totalHints: 3 }),
		).toEqual({
			proactiveHintIndex: null,
			showRefresher: true,
			offerSolution: true,
		});
	});
});

describe("xp, combo, level, streak, achievements", () => {
	it("computes xp with stars, boss bonus, hint cost and combo", () => {
		const clean = att("c-e1", ["x"], T0, { difficulty: 2 });
		expect(xpForAttempt(clean, 1).total).toBe(30);
		expect(xpForAttempt(clean, 3).total).toBe(45);
		expect(xpForAttempt(clean, 20).comboMultiplier).toBe(3);
		expect(xpForAttempt({ ...clean, hintsUsed: 1 }, 0).total).toBe(19);
		expect(xpForAttempt({ ...clean, kind: "boss" }, 1).total).toBe(80);
		expect(xpForAttempt({ ...clean, revealed: true }, 1).total).toBe(2);
		expect(xpForAttempt({ ...clean, solved: false }, 1).total).toBe(0);
		expect(comboMultiplier(5)).toBe(2);
	});

	it("tracks combo on first-try solves only", () => {
		const clean = att("c-e1", ["x"], T0);
		expect(nextCombo(2, clean)).toBe(3);
		expect(nextCombo(2, { ...clean, failedSubmissions: 1 })).toBe(0);
		expect(
			nextCombo(2, { ...clean, kind: "lesson-try", failedSubmissions: 2 }),
		).toBe(2);
	});

	it("maps xp to levels on a growing curve", () => {
		expect(levelFromXp(0)).toEqual({
			level: 1,
			current: 0,
			needed: 100,
			progress: 0,
		});
		expect(levelFromXp(100).level).toBe(2);
		expect(xpToNext(3)).toBeGreaterThan(xpToNext(2));
		const l = levelFromXp(150);
		expect(l.level).toBe(2);
		expect(l.current).toBe(50);
		expect(l.progress).toBeCloseTo(50 / 145);
	});

	it("updates the daily streak", () => {
		expect(streakUpdate(null, "2026-01-10", 0)).toEqual({
			streak: 1,
			lastActiveDay: "2026-01-10",
		});
		expect(streakUpdate("2026-01-10", "2026-01-10", 4).streak).toBe(4);
		expect(streakUpdate("2026-01-10", "2026-01-11", 4).streak).toBe(5);
		expect(streakUpdate("2026-02-28", "2026-03-01", 4).streak).toBe(5);
		expect(streakUpdate("2026-01-10", "2026-01-13", 4).streak).toBe(1);
	});

	it("evaluates achievements", () => {
		const ch = chapter("c");
		const attempts = [
			...[1, 2, 3, 4, 5].map((i) =>
				att(`c-p${i}`, ["x"], T0 + i * 1000, { kind: "practice" }),
			),
			att("c-e1", ["select"], T0 + 10_000),
			att("c-e2", ["where"], T0 + 11_000, { timeToSolveMs: 12_000 }),
			att("c-boss", ["select"], T0 + 12_000, { kind: "boss", solved: false }),
			att("c-boss", ["select"], T0 + 13_000, { kind: "boss" }),
		];
		const ids = evaluateAchievements(
			attempts,
			{ xp: 2000, streak: 3, combo: 0 },
			[ch],
		);
		for (const id of [
			"first-blood",
			"combo-5",
			"boss-slayer",
			"comeback",
			"speedrun",
			"streak-3",
			"level-5",
		])
			expect(ids).toContain(id);
		expect(ids).not.toContain("streak-7");
		expect(ids).not.toContain("three-star-10");
		expect(ids).toContain("no-hint-chapter");
		expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(
			ACHIEVEMENTS.length,
		);
	});
});
