import { motion } from "motion/react";
import { useEffect } from "react";
import { Button } from "#/components/ui/button";
import type { Chapter, Exercise } from "#/content/types";
import { useGame } from "#/game/progress";
import { sfx } from "#/game/sound";

export function BossIntro({
	chapter,
	boss,
	onFight,
	onRetreat,
}: {
	chapter: Chapter;
	boss: Exercise;
	onFight: () => void;
	onRetreat: () => void;
}) {
	const timer = useGame((s) => s.settings.bossTimer);
	useEffect(() => {
		const t = window.setTimeout(() => sfx("boss"), 250);
		return () => window.clearTimeout(t);
	}, []);
	return (
		<div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
			<motion.div
				className="pointer-events-none absolute inset-0"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.8 }}
				style={{
					background:
						"radial-gradient(60% 50% at 50% 45%, color-mix(in oklab, var(--destructive) 30%, transparent), transparent 70%), repeating-linear-gradient(135deg, transparent 0 22px, color-mix(in oklab, var(--destructive) 6%, transparent) 22px 24px)",
				}}
			/>
			<div className="relative max-w-xl text-center">
				<motion.div
					initial={{ y: -20, opacity: 0, letterSpacing: "1em" }}
					animate={{ y: 0, opacity: 1, letterSpacing: "0.35em" }}
					transition={{ duration: 0.9 }}
					className="text-xs font-bold text-destructive uppercase"
				>
					Boss fight · {chapter.title}
				</motion.div>
				<motion.div
					initial={{ scale: 3, opacity: 0, rotate: -8 }}
					animate={{ scale: 1, opacity: 1, rotate: 0, x: [0, -6, 6, -3, 3, 0] }}
					transition={{
						delay: 0.3,
						duration: 0.7,
						x: { delay: 0.95, duration: 0.4 },
					}}
					className="my-6 text-8xl drop-shadow-[0_0_30px_var(--destructive-glow)]"
					aria-hidden="true"
				>
					{chapter.emoji}
				</motion.div>
				<motion.h1
					initial={{ y: 30, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ delay: 0.9, type: "spring" }}
					className="font-display text-4xl leading-none text-foreground sm:text-5xl"
				>
					{boss.title}
				</motion.h1>
				{boss.story ? (
					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 1.3 }}
						className="mt-4 text-muted-foreground italic"
					>
						{boss.story}
					</motion.p>
				) : null}
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 1.6 }}
					className="mt-8 flex flex-col items-center gap-3"
				>
					<div className="text-sm text-muted-foreground">
						3 lives{timer ? ` · ${2 + boss.difficulty} minute timer` : ""} ·
						bonus XP for the win
					</div>
					<Button
						type="button"
						onClick={onFight}
						variant="destructive"
						size="lg"
						className="px-10 text-xl"
						autoFocus
					>
						FIGHT
					</Button>
					<button
						type="button"
						onClick={onRetreat}
						className="text-sm font-semibold text-muted-foreground hover:text-foreground"
					>
						Not yet, retreat
					</button>
				</motion.div>
			</div>
		</div>
	);
}
