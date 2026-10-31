import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { Button } from "#/components/ui/button";
import type { Exercise } from "#/content/types";
import type { MasteryMap } from "#/engine/adaptive/types";
import { sfx } from "#/game/sound";
import { conceptName } from "#/lib/content";
import { cn } from "#/lib/utils";
import { burst, prefersReducedMotion } from "./fx";
import { Markdown } from "./markdown";
import type { MissionResult } from "./mission";
import { StarBurst } from "./stars";

export function CountUp({ to, className }: { to: number; className?: string }) {
	const v = useMotionValue(0);
	const rounded = useTransform(v, (x) => Math.round(x).toString());
	useEffect(() => {
		if (prefersReducedMotion()) {
			v.set(to);
			return;
		}
		const c = animate(v, to, { duration: 1.1, ease: "easeOut", delay: 0.6 });
		return () => c.stop();
	}, [to, v]);
	return <motion.span className={className}>{rounded}</motion.span>;
}

export function MasteryDeltas({
	concepts,
	before,
	after,
}: {
	concepts: string[];
	before: MasteryMap;
	after: MasteryMap;
}) {
	return (
		<div className="space-y-2">
			{concepts.map((c, i) => {
				const b = before[c]?.effective ?? 0;
				const a = after[c]?.effective ?? 0;
				const d = Math.round((a - b) * 100);
				return (
					<div key={c}>
						<div className="mb-1 flex justify-between text-xs">
							<span className="font-semibold text-foreground">
								{conceptName(c)}
							</span>
							<span
								className={cn(
									"font-mono",
									d >= 0 ? "text-success" : "text-destructive",
								)}
							>
								{d >= 0 ? "+" : ""}
								{d}%
							</span>
						</div>
						<div className="relative h-2 overflow-hidden rounded-full bg-secondary">
							<div
								className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/40"
								style={{ width: `${b * 100}%` }}
							/>
							<motion.div
								className="absolute inset-y-0 left-0 rounded-full bg-success"
								initial={{ width: `${b * 100}%` }}
								animate={{ width: `${a * 100}%` }}
								transition={{ delay: 0.9 + i * 0.15, duration: 0.8 }}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}

export function SolvedOverlay({
	exercise,
	result,
	isBoss,
	onNext,
	nextLabel,
}: {
	exercise: Exercise;
	result: MissionResult;
	isBoss: boolean;
	onNext: () => void;
	nextLabel: string;
}) {
	const { reward } = result;
	const stars = reward.stars;

	useEffect(() => {
		if (reward.newAchievements.length) {
			const t = window.setTimeout(() => sfx("unlock"), 1600);
			return () => window.clearTimeout(t);
		}
	}, [reward.newAchievements.length]);
	useEffect(() => {
		if (reward.levelAfter > reward.levelBefore) burst("big");
	}, [reward.levelAfter, reward.levelBefore]);

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 z-50 overflow-y-auto bg-[color-mix(in_oklab,var(--background)_75%,transparent)] p-4 backdrop-blur-md"
			role="dialog"
			aria-labelledby="solved-title"
		>
			<div className="grid min-h-full place-items-center">
				<motion.div
					initial={{ scale: 0.85, y: 40 }}
					animate={{ scale: 1, y: 0 }}
					transition={{ type: "spring", stiffness: 220, damping: 18 }}
					className="panel w-full max-w-lg space-y-5 p-6"
				>
					<div className="text-center">
						<div className="text-[11px] font-bold tracking-[0.25em] text-success uppercase">
							{result.revealed
								? "Solution revealed"
								: isBoss
									? "Boss defeated"
									: "Mission complete"}
						</div>
						<h2
							id="solved-title"
							className="font-display text-2xl text-foreground"
						>
							{exercise.title}
						</h2>
					</div>
					<StarBurst stars={stars} onStar={() => sfx("star")} />
					<div className="grid grid-cols-3 gap-2 text-center">
						<div className="rounded-xl bg-muted p-2">
							<div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
								XP
							</div>
							<div className="font-display text-2xl text-reward">
								+<CountUp to={reward.xp.total} />
							</div>
						</div>
						<div className="rounded-xl bg-muted p-2">
							<div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
								Combo
							</div>
							<div className="font-display text-2xl text-info">
								x{reward.xp.comboMultiplier.toFixed(2).replace(/\.?0+$/, "")}
							</div>
						</div>
						<div className="rounded-xl bg-muted p-2">
							<div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
								Level
							</div>
							<div className="font-display text-2xl text-foreground">
								{reward.levelAfter}
								{reward.levelAfter > reward.levelBefore ? (
									<motion.span
										initial={{ scale: 0 }}
										animate={{ scale: 1 }}
										transition={{ delay: 1.4 }}
										className="ml-1 text-sm text-success"
									>
										UP!
									</motion.span>
								) : null}
							</div>
						</div>
					</div>
					{reward.xp.hintPenalty > 0 || reward.xp.bossBonus > 0 ? (
						<div className="flex flex-wrap justify-center gap-2 font-mono text-[11px] text-muted-foreground">
							<span>base {reward.xp.base}</span>
							{reward.xp.starBonus ? (
								<span>stars +{reward.xp.starBonus}</span>
							) : null}
							{reward.xp.bossBonus ? (
								<span>boss +{reward.xp.bossBonus}</span>
							) : null}
							{reward.xp.hintPenalty ? (
								<span className="text-destructive">
									hints −{reward.xp.hintPenalty}
								</span>
							) : null}
						</div>
					) : null}
					<MasteryDeltas
						concepts={exercise.concepts}
						before={reward.masteryBefore}
						after={reward.masteryAfter}
					/>
					{reward.newAchievements.length ? (
						<div className="space-y-2">
							{reward.newAchievements.map((a, i) => (
								<motion.div
									key={a.id}
									initial={{ x: -30, opacity: 0 }}
									animate={{ x: 0, opacity: 1 }}
									transition={{ delay: 1.6 + i * 0.2, type: "spring" }}
									className="flex items-center gap-3 rounded-xl border border-reward/50 bg-[color-mix(in_oklab,var(--reward)_10%,var(--card))] p-2.5"
								>
									<span className="text-2xl">{a.emoji}</span>
									<div>
										<div className="text-[10px] font-bold tracking-widest text-reward uppercase">
											Achievement unlocked
										</div>
										<div className="font-bold text-foreground">{a.name}</div>
										<div className="text-xs text-muted-foreground">
											{a.description}
										</div>
									</div>
								</motion.div>
							))}
						</div>
					) : null}
					{exercise.explanation ? (
						<details className="rounded-xl bg-muted p-3" open={result.revealed}>
							<summary className="cursor-pointer text-sm font-bold text-foreground">
								Why it works
							</summary>
							<Markdown className="mt-2">{exercise.explanation}</Markdown>
							{result.revealed ? (
								<pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--editor)] p-2 font-mono text-xs text-foreground">
									{exercise.solutionSql}
								</pre>
							) : null}
						</details>
					) : null}
					<Button
						type="button"
						onClick={onNext}
						variant="success"
						size="lg"
						className="w-full"
						autoFocus
					>
						{nextLabel} →
					</Button>
				</motion.div>
			</div>
		</motion.div>
	);
}
