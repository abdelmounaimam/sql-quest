import { motion } from "motion/react";
import { useEffect } from "react";
import { Button } from "#/components/ui/button";
import type { Chapter } from "#/content/types";
import { ACHIEVEMENTS, xpForAttempt } from "#/engine/adaptive";
import type { ChapterStatus } from "#/engine/adaptive/types";
import { type Progress, useGame } from "#/game/progress";
import { sfx } from "#/game/sound";
import { conceptName } from "#/lib/content";
import { burst } from "./fx";
import { MasteryBar } from "./level-hub";
import { CountUp } from "./solved-overlay";
import { StarBurst, StarRow } from "./stars";

export function LevelComplete({
	chapter,
	status,
	progress,
	onMap,
	onNextLevel,
}: {
	chapter: Chapter;
	status: ChapterStatus;
	progress: Progress;
	onMap: () => void;
	onNextLevel?: () => void;
}) {
	const achievements = useGame((s) => s.achievements);
	const values: number[] = chapter.exercises.map(
		(e) => status.stars[e.id] ?? 0,
	);
	const avg = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
	const overall = Math.round(avg);
	const chapterAttempts = progress.attempts.filter(
		(a) => a.chapterId === chapter.id,
	);
	const xp = chapterAttempts.reduce((s, a) => s + xpForAttempt(a, 1).total, 0);
	const since = Math.min(
		...chapterAttempts.map((a) => a.startedAt),
		Date.now(),
	);
	const recent = ACHIEVEMENTS.filter((a) => (achievements[a.id] ?? 0) >= since);

	useEffect(() => {
		burst("boss");
		sfx("levelup");
	}, []);

	return (
		<div className="mx-auto w-full max-w-xl px-4 pt-8 pb-16 text-center">
			<motion.div
				initial={{ scale: 0.6, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: "spring", stiffness: 200, damping: 14 }}
			>
				<div className="text-[11px] font-bold tracking-[0.3em] text-success uppercase">
					Level complete
				</div>
				<h1 className="mt-1 font-display text-4xl text-foreground">
					{chapter.title}
				</h1>
			</motion.div>
			<div className="my-8">
				<StarBurst stars={overall} onStar={() => sfx("star")} />
			</div>
			<div className="panel space-y-5 p-5 text-left">
				<div className="flex items-center justify-between">
					<span className="text-sm font-bold text-muted-foreground uppercase">
						XP earned
					</span>
					<span className="font-display text-3xl text-reward">
						+<CountUp to={xp} />
					</span>
				</div>
				<ul className="space-y-1.5">
					{chapter.exercises.map((e, i) => (
						<motion.li
							key={e.id}
							initial={{ opacity: 0, x: -10 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.8 + i * 0.1 }}
							className="flex items-center justify-between gap-2 text-sm"
						>
							<span className="truncate text-foreground">
								{e.boss ? "👑 " : ""}
								{e.title}
							</span>
							<StarRow stars={status.stars[e.id] ?? 0} />
						</motion.li>
					))}
				</ul>
				<div className="space-y-2.5">
					<div className="text-sm font-bold text-muted-foreground uppercase">
						Mastery
					</div>
					{chapter.concepts.map((c) => (
						<div key={c}>
							<div className="mb-1 flex justify-between text-xs">
								<span className="font-semibold text-foreground">
									{conceptName(c)}
								</span>
								<span className="font-mono text-muted-foreground">
									{Math.round((progress.mastery[c]?.effective ?? 0) * 100)}%
								</span>
							</div>
							<MasteryBar value={progress.mastery[c]?.effective ?? 0} />
						</div>
					))}
				</div>
				{recent.length ? (
					<div className="flex flex-wrap gap-2">
						{recent.map((a) => (
							<span
								key={a.id}
								className="rounded-full border border-reward/50 px-3 py-1 text-sm text-foreground"
								title={a.description}
							>
								{a.emoji} {a.name}
							</span>
						))}
					</div>
				) : null}
			</div>
			<div className="mt-6 flex flex-col gap-3 sm:flex-row">
				<Button
					type="button"
					onClick={onMap}
					variant="outline"
					size="lg"
					className="flex-1"
				>
					World map
				</Button>
				{onNextLevel ? (
					<Button
						type="button"
						onClick={onNextLevel}
						variant="success"
						size="lg"
						className="flex-1"
					>
						Next level →
					</Button>
				) : null}
			</div>
		</div>
	);
}
