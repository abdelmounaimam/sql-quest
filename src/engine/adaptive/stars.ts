import type { AttemptRecord } from "./types";

export type Stars = 0 | 1 | 2 | 3;

/**
 * 3 = solved first submission without hints
 * 2 = solved with at most 2 failures and at most 1 hint
 * 1 = solved otherwise
 * 0 = solution revealed, or not solved
 */
export function starsFor(
	attempt: Pick<
		AttemptRecord,
		"solved" | "revealed" | "failedSubmissions" | "hintsUsed"
	>,
): Stars {
	if (!attempt.solved || attempt.revealed) return 0;
	if (attempt.failedSubmissions === 0 && attempt.hintsUsed === 0) return 3;
	if (attempt.failedSubmissions <= 2 && attempt.hintsUsed <= 1) return 2;
	return 1;
}

/** Best stars ever earned on an exercise (0 when never solved). */
export function bestStars(
	attempts: readonly AttemptRecord[],
	exerciseId: string,
): Stars {
	let best: Stars = 0;
	for (const a of attempts) {
		if (a.exerciseId !== exerciseId) continue;
		const s = starsFor(a);
		if (s > best) best = s;
	}
	return best;
}

/** True when at least one attempt on the exercise was solved (reveal included). */
export function isSolved(
	attempts: readonly AttemptRecord[],
	exerciseId: string,
): boolean {
	return attempts.some((a) => a.exerciseId === exerciseId && a.solved);
}
