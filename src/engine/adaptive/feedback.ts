import type { FeedbackPolicy } from "./types";

/** Failures before the next hint is revealed for free. */
export const PROACTIVE_HINT_AFTER = 2;
/** Failures before the concept refresher card appears. */
export const REFRESHER_AFTER = 3;
/** Failures before the "show solution" button is offered. */
export const OFFER_SOLUTION_AFTER = 5;

/**
 * Adapts feedback to repeated failures on one exercise.
 * Free hints are paced: one at 2 failures, a second at 3, and so on, so the
 * policy is stable when called again after the UI reveals a hint.
 */
export function feedbackPolicy(input: {
	failures: number;
	hintsShown: number;
	totalHints: number;
}): FeedbackPolicy {
	const { failures, hintsShown, totalHints } = input;
	const freeAllowed =
		failures >= PROACTIVE_HINT_AFTER
			? Math.min(totalHints, failures - PROACTIVE_HINT_AFTER + 1)
			: 0;
	return {
		proactiveHintIndex: hintsShown < freeAllowed ? hintsShown : null,
		showRefresher: failures >= REFRESHER_AFTER,
		offerSolution: failures >= OFFER_SOLUTION_AFTER,
	};
}
