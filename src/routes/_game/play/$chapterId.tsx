import {
	createFileRoute,
	Navigate,
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { BossIntro } from "#/components/game/boss-intro";
import { GateCheck } from "#/components/game/gate-check";
import { LessonPlayer } from "#/components/game/lesson-player";
import { LevelComplete } from "#/components/game/level-complete";
import { LevelHub } from "#/components/game/level-hub";
import { type MissionMode, MissionScreen } from "#/components/game/mission";
import { Splash } from "#/components/game/splash";
import { useProgress } from "#/game/progress";
import {
	bossOf,
	chapterById,
	chapters,
	findExercise,
	worldOfChapter,
} from "#/lib/content";

const searchSchema = z.object({
	phase: z
		.enum(["learn", "hub", "mission", "gate", "boss", "complete"])
		.catch("hub")
		.default("hub"),
	ex: z.string().optional(),
	step: z.number().int().min(0).optional(),
	review: z.boolean().optional(),
	fight: z.boolean().optional(),
});

export type PlaySearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_game/play/$chapterId")({
	ssr: false,
	validateSearch: searchSchema,
	loader: ({ params }) => {
		const chapter = chapterById.get(params.chapterId);
		if (!chapter) throw notFound();
		return { chapterId: chapter.id };
	},
	component: PlayPage,
	notFoundComponent: () => (
		<div className="p-10 text-center text-muted-foreground">
			This level does not exist.
		</div>
	),
});

function PlayPage() {
	const { chapterId } = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const progress = useProgress();
	const chapter = chapterById.get(chapterId);
	if (!chapter) return null;
	if (!progress.ready) return <Splash label="Loading your progress" />;

	const status = progress.statuses[chapter.id];
	const world = worldOfChapter(chapter.id);
	const solvedIds = new Set(
		progress.attempts.filter((a) => a.solved).map((a) => a.exerciseId),
	);
	const mainSegments = chapter.exercises.map((e) => ({
		id: e.id,
		done: solvedIds.has(e.id),
	}));
	const drillSegments = (status.gauntlet?.exerciseIds ?? []).map((id) => ({
		id,
		done: status.gauntlet?.clearedIds.includes(id) ?? false,
	}));
	const setSearch = (s: PlaySearch) => void navigate({ search: s });
	const toHub = () => setSearch({ phase: "hub" });

	if (search.phase === "learn")
		return (
			<LessonPlayer
				key={chapter.id}
				chapter={chapter}
				initialStep={search.step ?? 0}
				onStep={(step) =>
					void navigate({ search: { phase: "learn", step }, replace: true })
				}
				onFinish={toHub}
			/>
		);

	if (search.phase === "mission" && search.ex) {
		const ref = findExercise(search.ex);
		if (!ref || ref.chapter.id !== chapter.id)
			return (
				<div className="p-10 text-center text-muted-foreground">
					Unknown mission.
				</div>
			);
		const { exercise } = ref;
		if (exercise.boss)
			return <Navigate to="." search={{ phase: "boss" }} replace />;
		const mode: MissionMode = search.review
			? "review"
			: ref.pool === "practice"
				? "practice"
				: "exercise";

		const onNext = () => {
			// Progress has been recomputed from the live collections by now.
			const st = progress.statuses[chapter.id];
			if (mode === "review") {
				void navigate({ to: "/" });
				return;
			}
			const pendingDrill = st.pendingDrillIds.find((id) => id !== exercise.id);
			if (mode === "practice" && pendingDrill) {
				setSearch({ phase: "mission", ex: pendingDrill });
				return;
			}
			const nextMain = chapter.exercises.find(
				(e) =>
					!e.boss &&
					e.id !== exercise.id &&
					!isSolvedIn(progress.attempts, e.id),
			);
			if (mode === "exercise" && nextMain) {
				setSearch({ phase: "mission", ex: nextMain.id });
				return;
			}
			setSearch({ phase: "gate" });
		};

		return (
			<MissionScreen
				key={exercise.id}
				chapter={chapter}
				exercise={exercise}
				mode={mode}
				world={world}
				segments={
					mode === "practice" && drillSegments.length
						? drillSegments
						: mainSegments
				}
				onNext={onNext}
				nextLabel={mode === "review" ? "Back to the map" : "Continue"}
			/>
		);
	}

	if (search.phase === "gate")
		return (
			<GateCheck
				chapter={chapter}
				status={status}
				onBoss={() => setSearch({ phase: "boss" })}
				onDrill={(id) => setSearch({ phase: "mission", ex: id })}
				onHub={toHub}
			/>
		);

	if (search.phase === "boss") {
		const boss = bossOf(chapter);
		// While fighting, keep the screen even if the gate closes (defeat overlay).
		if (!boss || (!status.bossUnlocked && !search.fight))
			return <Navigate to="." search={{ phase: "gate" }} replace />;
		if (!search.fight)
			return (
				<BossIntro
					chapter={chapter}
					boss={boss}
					onFight={() => setSearch({ phase: "boss", fight: true })}
					onRetreat={toHub}
				/>
			);
		return (
			<MissionScreen
				key={boss.id}
				chapter={chapter}
				exercise={boss}
				mode="boss"
				world={world}
				segments={mainSegments}
				onNext={() => setSearch({ phase: "complete" })}
				onBossDefeat={() => setSearch({ phase: "gate" })}
				nextLabel="Claim your rewards"
			/>
		);
	}

	if (search.phase === "complete") {
		const idx = chapters.findIndex((c) => c.id === chapter.id);
		const nextChapter = chapters[idx + 1];
		return (
			<LevelComplete
				chapter={chapter}
				status={status}
				progress={progress}
				onMap={() => void navigate({ to: "/" })}
				onNextLevel={
					nextChapter && progress.statuses[nextChapter.id]?.state !== "locked"
						? () =>
								void navigate({
									to: "/play/$chapterId",
									params: { chapterId: nextChapter.id },
									search: { phase: "learn" },
								})
						: undefined
				}
			/>
		);
	}

	return (
		<LevelHub
			chapter={chapter}
			status={status}
			progress={progress}
			onLearn={() => setSearch({ phase: "learn" })}
			onMission={(id) => setSearch({ phase: "mission", ex: id })}
			onGate={() => setSearch({ phase: "gate" })}
		/>
	);
}

function isSolvedIn(
	attempts: { exerciseId: string; solved: boolean }[],
	id: string,
) {
	return attempts.some((a) => a.exerciseId === id && a.solved);
}
