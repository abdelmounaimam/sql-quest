import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server functions: anonymous profiles and progress sync.
 * The client is offline first; these are called opportunistically.
 */

const ProfileInput = z.object({
	id: z.string().min(8).max(64),
	name: z.string().min(1).max(40),
	avatar: z.string().min(1).max(16),
	xp: z.number().int().min(0),
	level: z.number().int().min(1),
	streak: z.number().int().min(0),
});

const AttemptInput = z.object({
	id: z.string().min(1).max(80),
	exerciseId: z.string().min(1).max(120),
	finishedAt: z.number(),
	data: z.string().max(20_000),
});

const SyncInput = z.object({
	profile: ProfileInput,
	attempts: z.array(AttemptInput).max(500),
	lessons: z
		.array(
			z.object({ chapterId: z.string().max(120), completedAt: z.number() }),
		)
		.max(500),
});

export const syncProgress = createServerFn({ method: "POST" })
	.validator((input: unknown) => SyncInput.parse(input))
	.handler(async ({ data }) => {
		const { repo } = await import("./repo");
		const profile = repo.upsertProfile(data.profile);
		const inserted = repo.putAttempts(profile.id, data.attempts);
		repo.putLessons(profile.id, data.lessons);
		return {
			profile,
			inserted,
			attempts: repo.listAttempts(profile.id),
			lessons: repo.listLessons(profile.id),
			syncedAt: Date.now(),
		};
	});

export const getLeaderboard = createServerFn({ method: "GET" }).handler(
	async () => {
		const { repo } = await import("./repo");
		return repo.leaderboard(25);
	},
);

export type LeaderboardRow = Awaited<ReturnType<typeof getLeaderboard>>[number];
