import { motion } from "motion/react";
import { useEffect } from "react";
import { Button } from "#/components/ui/button";
import type { Chapter } from "#/content/types";
import { GATE_MIN_AVG_STARS, MASTERY_THRESHOLD } from "#/engine/adaptive";
import type { ChapterStatus } from "#/engine/adaptive/types";
import { sfx } from "#/game/sound";
import { conceptName, findExercise } from "#/lib/content";
import { cn } from "#/lib/utils";
import { GameIcon } from "./icons";

/** Animated gate: each criterion lights up in turn, then the boss door opens or the gauntlet appears. */
export function GateCheck({
	chapter,
	status,
	onBoss,
	onDrill,
	onHub,
}: {
	chapter: Chapter;
	status: ChapterStatus;
	onBoss: () => void;
	onDrill: (id: string) => void;
	onHub: () => void;
}) {
	const c = status.gateCriteria;
	const mainCount = chapter.exercises.filter((e) => !e.boss).length;
	const solvedMains = c.allMainSolved
		? mainCount
		: Math.min(mainCount, status.solvedMain - (status.bossCleared ? 1 : 0));
	const gauntletCleared = !!status.gauntlet?.cleared;
	const rows = [
		{
			ok: c.allMainSolved,
			label: `Missions solved: ${solvedMains}/${mainCount}`,
		},
		{
			ok: c.masteryOk || gauntletCleared,
			label: c.masteryOk
				? `Mastery above ${Math.round(MASTERY_THRESHOLD * 100)}% on every concept`
				: `Weak spots: ${c.weakConcepts.map(conceptName).join(", ") || "none"}`,
		},
		{
			ok: c.starsOk || gauntletCleared,
			label: `Average stars ${status.averageStars.toFixed(1)} / ${GATE_MIN_AVG_STARS} needed`,
		},
	];
	if (status.gauntlet)
		rows.push({
			ok: status.gauntlet.cleared,
			label: `Practice drills ${status.gauntlet.clearedIds.length}/${status.gauntlet.exerciseIds.length}`,
		});
	const open = status.bossUnlocked;
	const delayEnd = 0.4 + rows.length * 0.45;

	useEffect(() => {
		const t = window.setTimeout(
			() => sfx(open ? "unlock" : "fail"),
			delayEnd * 1000,
		);
		return () => window.clearTimeout(t);
	}, [open, delayEnd]);

	return (
		<div className="mx-auto w-full max-w-xl px-4 pt-safe-8 pb-safe-16">
			<div className="text-center">
				<div className="kicker text-(--syn-keyword)">Gate check</div>
				<h1 className="font-display text-title">{chapter.title}</h1>
			</div>
			<motion.div
				className="relative mx-auto my-8 grid size-40 place-items-center"
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
			>
				<motion.div
					className="map-node gloss"
					data-kind="boss"
					data-state={open ? "available" : "locked"}
					style={
						{
							"--node-size": "8rem",
							"--w": open ? "var(--star)" : "var(--destructive)",
							"--w-deep": open ? "var(--star-edge)" : "var(--destructive-edge)",
							"--w-ink": open
								? "var(--reward-foreground)"
								: "var(--destructive-foreground)",
						} as React.CSSProperties
					}
					initial={{ scale: 0.92 }}
					animate={{ scale: open ? [0.92, 1.06, 1] : 1 }}
					transition={{
						delay: delayEnd,
						duration: 0.5,
						ease: [0.34, 1.56, 0.64, 1],
					}}
				>
					<GameIcon
						name={open ? "crown" : "lock"}
						className="size-14"
						solid={open}
					/>
				</motion.div>
			</motion.div>
			<ul className="flex flex-col gap-2">
				{rows.map((r, i) => (
					<motion.li
						key={r.label}
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.4 + i * 0.45 }}
						className={cn(
							"flex items-center gap-3 rounded-xl border-2 p-3",
							r.ok
								? "border-success/40 bg-success-soft text-success-soft-foreground"
								: "border-destructive/40 bg-destructive-soft text-destructive-soft-foreground",
						)}
					>
						<span
							className={cn(
								"grid size-7 shrink-0 place-items-center rounded-full",
								r.ok
									? "bg-success text-success-foreground"
									: "bg-destructive text-destructive-foreground",
							)}
						>
							{r.ok ? (
								<GameIcon name="check" className="size-4" />
							) : (
								<GameIcon name="x" className="size-4" />
							)}
						</span>
						<span className="min-w-0 text-sm font-extrabold text-pretty">
							{r.label}
						</span>
					</motion.li>
				))}
			</ul>
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: delayEnd + 0.3 }}
				className="mt-6 flex flex-col gap-3 text-center"
			>
				{open ? (
					<Button
						type="button"
						onClick={onBoss}
						variant="destructive"
						size="lg"
						className="w-full text-lg"
					>
						<GameIcon name="skull" data-icon="inline-start" /> Face the boss
					</Button>
				) : (
					<>
						<div className="flex flex-col gap-1 text-sm font-bold text-foreground">
							{status.reasons.map((r) => (
								<p key={r.message}>{r.message}</p>
							))}
						</div>
						{status.pendingDrillIds.length ? (
							<Button
								type="button"
								onClick={() => onDrill(status.pendingDrillIds[0])}
								variant="info"
								size="lg"
								className="h-auto min-h-14 w-full py-2.5 whitespace-normal"
							>
								<GameIcon name="dumbbell" className="size-6" />
								<span className="flex min-w-0 flex-col items-start text-left leading-tight">
									<span className="text-xs tracking-wider opacity-80">
										Start drill
									</span>
									<span className="text-pretty">
										{findExercise(status.pendingDrillIds[0])?.exercise.title}
									</span>
								</span>
							</Button>
						) : status.nextExerciseId ? (
							<Button
								type="button"
								onClick={() => onDrill(status.nextExerciseId as string)}
								variant="default"
								size="lg"
								className="w-full"
							>
								Next mission
							</Button>
						) : null}
					</>
				)}
				<button
					type="button"
					onClick={onHub}
					className="tap-target text-sm font-semibold text-muted-foreground hover:text-foreground"
				>
					Back to the level
				</button>
			</motion.div>
		</div>
	);
}
