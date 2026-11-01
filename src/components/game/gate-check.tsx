import { motion } from "motion/react";
import { useEffect } from "react";
import { Button } from "#/components/ui/button";
import type { Chapter } from "#/content/types";
import { GATE_MIN_AVG_STARS } from "#/engine/adaptive";
import type { ChapterStatus } from "#/engine/adaptive/types";
import { sfx } from "#/game/sound";
import { conceptName, findExercise } from "#/lib/content";
import { cn } from "#/lib/utils";
import { GameIcon } from "./icons";

/**
 * Animated gate: each criterion lights up in turn, then the boss door opens
 * or the drills appear. Unmet criteria are amber "to do" rows, not red
 * failures. The one action always sits in a bar pinned to the bottom of the
 * phone screen. After a win the gate offers a rematch and the next level.
 */
export function GateCheck({
	chapter,
	status,
	onBoss,
	onDrill,
	onHub,
	onNextLevel,
}: {
	chapter: Chapter;
	status: ChapterStatus;
	onBoss: () => void;
	onDrill: (id: string) => void;
	onHub: () => void;
	onNextLevel?: () => void;
}) {
	const c = status.gateCriteria;
	const cleared = status.bossCleared;
	const mainCount = chapter.exercises.filter((e) => !e.boss).length;
	const solvedMains = c.allMainSolved
		? mainCount
		: Math.min(mainCount, status.solvedMain - (cleared ? 1 : 0));
	const gauntletCleared = !!status.gauntlet?.cleared;
	const conceptsOk = c.masteryOk || gauntletCleared || cleared;
	const rows = [
		{
			ok: c.allMainSolved || cleared,
			label: `Missions solved: ${solvedMains}/${mainCount}`,
		},
		{
			ok: conceptsOk,
			label: conceptsOk
				? "Every concept solid"
				: `To practise: ${c.weakConcepts.map(conceptName).join(", ")}`,
		},
		{
			ok: c.starsOk || gauntletCleared || cleared,
			label: `Average stars ${status.averageStars.toFixed(1)} / ${GATE_MIN_AVG_STARS} needed`,
		},
	];
	if (status.gauntlet)
		rows.push({
			ok: status.gauntlet.cleared,
			label: `Practice drills ${status.gauntlet.clearedIds.length}/${status.gauntlet.exerciseIds.length}`,
		});
	const open = status.bossUnlocked || cleared;
	const delayEnd = 0.4 + rows.length * 0.45;
	const drillId = status.pendingDrillIds[0];

	useEffect(() => {
		const t = window.setTimeout(
			() => sfx(open ? "unlock" : "tap"),
			delayEnd * 1000,
		);
		return () => window.clearTimeout(t);
	}, [open, delayEnd]);

	return (
		<div
			className={cn(
				"mx-auto w-full max-w-xl px-4 pt-safe-6 roomy:pb-safe-16",
				// Room under the content for the pinned bar (one or two buttons).
				cleared && onNextLevel
					? "pb-[calc(13.5rem+var(--safe-bottom))]"
					: "pb-[calc(9.5rem+var(--safe-bottom))]",
			)}
		>
			<div className="text-center">
				<div className="kicker text-(--syn-keyword)">
					{cleared ? "Boss defeated" : "Gate check"}
				</div>
				<h1 className="font-display text-title text-balance">
					{chapter.title}
				</h1>
			</div>
			<motion.div
				className="gate-medal relative mx-auto my-4 grid place-items-center"
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
			>
				<motion.div
					className="map-node gloss"
					data-kind="boss"
					data-state={open ? "available" : "locked"}
					style={
						{
							"--w": open ? "var(--star)" : "var(--warning)",
							"--w-deep": open ? "var(--star-edge)" : "var(--warning-edge)",
							"--w-ink": open
								? "var(--reward-foreground)"
								: "var(--warning-foreground)",
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
						className="gate-medal-icon"
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
								: "border-warning/50 bg-warning-soft text-warning-soft-foreground",
						)}
					>
						<span
							className={cn(
								"grid size-7 shrink-0 place-items-center rounded-full",
								r.ok
									? "bg-success text-success-foreground"
									: "bg-warning text-warning-foreground",
							)}
						>
							<GameIcon
								name={r.ok ? "check" : "arrow-right"}
								className="size-4"
							/>
						</span>
						<span className="min-w-0 text-sm font-extrabold text-pretty">
							{r.label}
						</span>
					</motion.li>
				))}
			</ul>
			{!open && status.reasons.length ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: delayEnd }}
					className="mt-4 flex flex-col gap-1 text-center text-sm font-bold text-foreground"
				>
					{status.reasons.map((r) => (
						<p key={r.message}>{r.message}</p>
					))}
				</motion.div>
			) : null}

			{/* Pinned action bar: the next step is always on the first screen. */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: Math.min(delayEnd, 1.2) }}
				className="bottom-bar z-30 border-t-2 border-border bg-card px-safe-4 pt-3 pb-safe-2 roomy:static roomy:mt-6 roomy:border-0 roomy:bg-transparent roomy:p-0"
			>
				<div className="mx-auto flex max-w-xl flex-col gap-1 text-center">
					{cleared ? (
						<>
							{onNextLevel ? (
								<Button
									type="button"
									onClick={onNextLevel}
									size="lg"
									className="w-full"
								>
									Next level
									<GameIcon
										name="chevron-right"
										className="size-5"
										data-icon="inline-end"
									/>
								</Button>
							) : null}
							<Button
								type="button"
								onClick={onBoss}
								variant={onNextLevel ? "outline" : "destructive"}
								size="lg"
								className="w-full"
							>
								<GameIcon name="skull" data-icon="inline-start" /> Rematch the
								boss
							</Button>
						</>
					) : open ? (
						<Button
							type="button"
							onClick={onBoss}
							variant="destructive"
							size="lg"
							className="w-full text-lg"
						>
							<GameIcon name="skull" data-icon="inline-start" /> Face the boss
						</Button>
					) : drillId ? (
						<Button
							type="button"
							onClick={() => onDrill(drillId)}
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
									{findExercise(drillId)?.exercise.title}
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
					<button
						type="button"
						onClick={onHub}
						className="tap-target min-h-10 text-sm font-semibold text-muted-foreground hover:text-foreground"
					>
						Back to the level
					</button>
				</div>
			</motion.div>
		</div>
	);
}
