import type { Chapter } from "#/content/types";
import { starsFor } from "./stars";
import type { AttemptRecord } from "./types";

export const HINT_XP_COST = 5;
export const REVEAL_XP = 2;
export const BOSS_XP_BONUS = 50;
export const LESSON_TRY_XP = 5;
export const MAX_COMBO_MULTIPLIER = 3;
const STAR_MULTIPLIER = [0, 1, 1.2, 1.5] as const;

export interface XpBreakdown {
	base: number;
	starBonus: number;
	bossBonus: number;
	hintPenalty: number;
	comboMultiplier: number;
	total: number;
}

/** Combo multiplier for a combo count (the combo including the current solve). */
export function comboMultiplier(combo: number): number {
	if (combo <= 1) return 1;
	return Math.min(MAX_COMBO_MULTIPLIER, 1 + 0.25 * (combo - 1));
}

/**
 * XP earned by one attempt. `combo` is the combo AFTER this attempt
 * (use `nextCombo(prev, attempt)`).
 */
export function xpForAttempt(
	attempt: AttemptRecord,
	combo: number,
): XpBreakdown {
	const zero = {
		base: 0,
		starBonus: 0,
		bossBonus: 0,
		hintPenalty: 0,
		comboMultiplier: 1,
	};
	if (attempt.revealed) return { ...zero, base: REVEAL_XP, total: REVEAL_XP };
	if (!attempt.solved) return { ...zero, total: 0 };
	if (attempt.kind === "lesson-try")
		return { ...zero, base: LESSON_TRY_XP, total: LESSON_TRY_XP };

	const base = 10 * attempt.difficulty;
	const stars = starsFor(attempt);
	const starBonus = Math.round(base * STAR_MULTIPLIER[stars]) - base;
	const bossBonus = attempt.kind === "boss" ? BOSS_XP_BONUS : 0;
	const hintPenalty = HINT_XP_COST * attempt.hintsUsed;
	const mult = comboMultiplier(combo);
	const total = Math.max(
		1,
		Math.round((base + starBonus + bossBonus - hintPenalty) * mult),
	);
	return {
		base,
		starBonus,
		bossBonus,
		hintPenalty,
		comboMultiplier: mult,
		total,
	};
}

/** Combo grows on first-try, hint-free solves, resets otherwise. Lesson tries do not touch it. */
export function nextCombo(prevCombo: number, attempt: AttemptRecord): number {
	if (attempt.kind === "lesson-try") return prevCombo;
	return starsFor(attempt) === 3 ? prevCombo + 1 : 0;
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
	return 100 + 40 * (level - 1) + 5 * (level - 1) ** 2;
}

export interface LevelInfo {
	level: number;
	/** XP earned inside the current level. */
	current: number;
	/** XP the current level needs. */
	needed: number;
	progress: number;
}

export function levelFromXp(xp: number): LevelInfo {
	let level = 1;
	let rest = Math.max(0, Math.floor(xp));
	while (rest >= xpToNext(level)) {
		rest -= xpToNext(level);
		level += 1;
	}
	const needed = xpToNext(level);
	return { level, current: rest, needed, progress: rest / needed };
}

/** Local calendar day "YYYY-MM-DD". */
export function dayKey(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function dayNumber(day: string): number {
	const [y, m, d] = day.split("-").map(Number);
	return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Daily streak: same day keeps it, the next day extends it, a gap resets it to 1. */
export function streakUpdate(
	lastActiveDay: string | null,
	today: string,
	streak: number,
): { streak: number; lastActiveDay: string } {
	if (!lastActiveDay) return { streak: 1, lastActiveDay: today };
	const gap = dayNumber(today) - dayNumber(lastActiveDay);
	if (gap <= 0)
		return { streak: Math.max(1, streak), lastActiveDay: lastActiveDay };
	if (gap === 1) return { streak: streak + 1, lastActiveDay: today };
	return { streak: 1, lastActiveDay: today };
}

// ---------------------------------------------------------------- achievements

export interface AchievementStats {
	xp: number;
	streak: number;
	combo: number;
}

export interface AchievementContext extends AchievementStats {
	attempts: readonly AttemptRecord[];
	chapters: readonly Chapter[];
	level: number;
	bestCombo: number;
	threeStarCount: number;
	bossesCleared: number;
}

export interface Achievement {
	id: string;
	name: string;
	description: string;
	emoji: string;
	test: (ctx: AchievementContext) => boolean;
}

const real = (a: AttemptRecord) => a.kind !== "lesson-try";

export const ACHIEVEMENTS: readonly Achievement[] = [
	{
		id: "first-blood",
		name: "First Blood",
		description: "Solve your first mission.",
		emoji: "🩸",
		test: (c) => c.attempts.some((a) => real(a) && a.solved && !a.revealed),
	},
	{
		id: "combo-5",
		name: "On Fire",
		description: "Five first-try solves in a row.",
		emoji: "🔥",
		test: (c) => c.bestCombo >= 5,
	},
	{
		id: "three-star-10",
		name: "Constellation",
		description: "Earn 3 stars on 10 different missions.",
		emoji: "✨",
		test: (c) => c.threeStarCount >= 10,
	},
	{
		id: "boss-slayer",
		name: "Boss Slayer",
		description: "Defeat your first boss.",
		emoji: "🐉",
		test: (c) => c.bossesCleared >= 1,
	},
	{
		id: "no-hint-chapter",
		name: "Unassisted",
		description: "Clear a whole chapter without a single hint.",
		emoji: "🧠",
		test: (c) =>
			c.chapters.some((ch) => {
				const mine = c.attempts.filter((a) => a.chapterId === ch.id && real(a));
				const allSolved = ch.exercises.every((e) =>
					mine.some((a) => a.exerciseId === e.id && a.solved && !a.revealed),
				);
				return (
					ch.exercises.length > 0 &&
					allSolved &&
					mine.every((a) => a.hintsUsed === 0 && !a.revealed)
				);
			}),
	},
	{
		id: "night-owl",
		name: "Night Owl",
		description: "Solve a mission between midnight and 5 am.",
		emoji: "🦉",
		test: (c) =>
			c.attempts.some(
				(a) => real(a) && a.solved && new Date(a.finishedAt).getHours() < 5,
			),
	},
	{
		id: "comeback",
		name: "Comeback",
		description: "Beat a boss that beat you before.",
		emoji: "🥊",
		test: (c) =>
			c.attempts.some(
				(win) =>
					win.kind === "boss" &&
					win.solved &&
					!win.revealed &&
					c.attempts.some(
						(loss) =>
							loss.kind === "boss" &&
							loss.exerciseId === win.exerciseId &&
							(!loss.solved || loss.revealed) &&
							loss.finishedAt < win.finishedAt,
					),
			),
	},
	{
		id: "speedrun",
		name: "Speedrunner",
		description:
			"Solve a mission of difficulty 2+ first try in under 30 seconds.",
		emoji: "⚡",
		test: (c) =>
			c.attempts.some(
				(a) =>
					real(a) &&
					a.difficulty >= 2 &&
					starsFor(a) === 3 &&
					a.timeToSolveMs < 30_000,
			),
	},
	{
		id: "streak-3",
		name: "Habit",
		description: "Play 3 days in a row.",
		emoji: "📅",
		test: (c) => c.streak >= 3,
	},
	{
		id: "streak-7",
		name: "Devoted",
		description: "Play 7 days in a row.",
		emoji: "🗓️",
		test: (c) => c.streak >= 7,
	},
	{
		id: "level-5",
		name: "Query Knight",
		description: "Reach player level 5.",
		emoji: "🛡️",
		test: (c) => c.level >= 5,
	},
	{
		id: "persistent",
		name: "Never Give Up",
		description: "Solve a mission after 5 or more failed submissions.",
		emoji: "🧗",
		test: (c) =>
			c.attempts.some(
				(a) => real(a) && a.solved && !a.revealed && a.failedSubmissions >= 5,
			),
	},
];

/** Ids of every achievement the learner has earned. */
export function evaluateAchievements(
	attempts: readonly AttemptRecord[],
	stats: AchievementStats,
	chapters: readonly Chapter[] = [],
): string[] {
	const sorted = [...attempts].sort((a, b) => a.finishedAt - b.finishedAt);
	let combo = 0;
	let bestCombo = stats.combo;
	for (const a of sorted) {
		combo = nextCombo(combo, a);
		if (combo > bestCombo) bestCombo = combo;
	}
	const threeStar = new Set(
		sorted.filter((a) => real(a) && starsFor(a) === 3).map((a) => a.exerciseId),
	);
	const bosses = new Set(
		sorted
			.filter((a) => a.kind === "boss" && a.solved && !a.revealed)
			.map((a) => a.exerciseId),
	);
	const ctx: AchievementContext = {
		...stats,
		attempts: sorted,
		chapters,
		level: levelFromXp(stats.xp).level,
		bestCombo,
		threeStarCount: threeStar.size,
		bossesCleared: bosses.size,
	};
	return ACHIEVEMENTS.filter((a) => a.test(ctx)).map((a) => a.id);
}
