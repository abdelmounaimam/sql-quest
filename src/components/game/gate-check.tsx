import { Check, Crown, Swords, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect } from "react";
import { Button } from "#/components/ui/button";
import type { Chapter } from "#/content/types";
import { GATE_MIN_AVG_STARS, MASTERY_THRESHOLD } from "#/engine/adaptive";
import type { ChapterStatus } from "#/engine/adaptive/types";
import { sfx } from "#/game/sound";
import { conceptName, findExercise } from "#/lib/content";
import { cn } from "#/lib/utils";

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
			label: `Practice gauntlet ${status.gauntlet.clearedIds.length}/${status.gauntlet.exerciseIds.length}`,
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
		<div className="mx-auto w-full max-w-xl px-4 pt-8 pb-16">
			<div className="text-center">
				<div className="text-[11px] font-bold tracking-[0.25em] text-reward uppercase">
					Gate check
				</div>
				<h1 className="font-display text-3xl text-foreground">
					{chapter.title}
				</h1>
			</div>
			<motion.div
				className="relative mx-auto my-8 grid size-40 place-items-center"
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
			>
				<motion.div
					className={cn(
						"absolute inset-0 rounded-[2.5rem] border-4",
						open ? "border-reward" : "border-destructive",
					)}
					initial={{ rotate: 0 }}
					animate={{ rotate: open ? 45 : 0, scale: open ? [1, 1.08, 1] : 1 }}
					transition={{ delay: delayEnd, duration: 0.6 }}
					style={{
						boxShadow: `0 0 50px ${open ? "var(--reward-glow)" : "var(--destructive-glow)"}`,
					}}
				/>
				<motion.div
					initial={{ scale: 0 }}
					animate={{ scale: 1 }}
					transition={{
						delay: delayEnd,
						type: "spring",
						stiffness: 300,
						damping: 12,
					}}
				>
					{open ? (
						<Crown className="size-16 text-reward" />
					) : (
						<Swords className="size-16 text-destructive" />
					)}
				</motion.div>
			</motion.div>
			<ul className="space-y-2">
				{rows.map((r, i) => (
					<motion.li
						key={r.label}
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.4 + i * 0.45 }}
						className={cn(
							"flex items-center gap-3 rounded-xl border p-3",
							r.ok
								? "border-success/40 bg-[color-mix(in_oklab,var(--success)_8%,var(--card))]"
								: "border-destructive/40 bg-[color-mix(in_oklab,var(--destructive)_8%,var(--card))]",
						)}
					>
						<span
							className={cn(
								"grid size-7 place-items-center rounded-full",
								r.ok
									? "bg-success text-success-foreground"
									: "bg-destructive text-destructive-foreground",
							)}
						>
							{r.ok ? <Check className="size-4" /> : <X className="size-4" />}
						</span>
						<span className="text-sm font-semibold text-foreground">
							{r.label}
						</span>
					</motion.li>
				))}
			</ul>
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: delayEnd + 0.3 }}
				className="mt-6 space-y-3 text-center"
			>
				{open ? (
					<Button
						type="button"
						onClick={onBoss}
						variant="destructive"
						size="lg"
						className="w-full text-lg"
					>
						<Crown className="size-5" /> Enter the boss arena
					</Button>
				) : (
					<>
						<div className="space-y-1 text-sm text-foreground">
							{status.reasons.map((r) => (
								<p key={r.message}>{r.message}</p>
							))}
						</div>
						{status.pendingDrillIds.length ? (
							<Button
								type="button"
								onClick={() => onDrill(status.pendingDrillIds[0])}
								variant="destructive"
								size="lg"
								className="w-full"
							>
								<Swords className="size-5" /> Start drill:{" "}
								{findExercise(status.pendingDrillIds[0])?.exercise.title}
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
					className="text-sm font-semibold text-muted-foreground hover:text-foreground"
				>
					Back to the level
				</button>
			</motion.div>
		</div>
	);
}
