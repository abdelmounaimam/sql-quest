import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { Chapter, Exercise } from "#/content/types";
import { useGame } from "#/game/progress";
import { haptic, sfx } from "#/game/sound";
import { worldOfChapter } from "#/lib/content";
import { Button } from "../ui/button";
import { GameIcon } from "./icons";

/**
 * Boss intro (§7.3): ink overlay with the world motif, guardian banner slams
 * in, container shakes once, name letters stagger, hearts pop. Tap to skip;
 * continues on its own after the beat.
 */
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
	const reduce = useReducedMotion();
	const world = worldOfChapter(chapter.id);
	const name = boss.title.replace(/^boss:\s*/i, "");

	const fightRef = useRef(onFight);
	useLayoutEffect(() => {
		fightRef.current = onFight;
	});
	useEffect(() => {
		const t = window.setTimeout(() => {
			sfx("boss");
			haptic("boss");
		}, 250);
		const auto = window.setTimeout(() => fightRef.current(), 3200);
		return () => {
			window.clearTimeout(t);
			window.clearTimeout(auto);
		};
	}, []);

	return (
		<div
			className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-[#0A0F1C] px-4 py-16"
			data-world={world}
			onPointerDown={(e) => {
				if ((e.target as HTMLElement).closest("button")) return;
				onFight();
			}}
		>
			<div
				className="world-motif pointer-events-none absolute inset-0 opacity-20"
				data-world={world}
			/>
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						"radial-gradient(50% 45% at 50% 42%, color-mix(in oklab, var(--destructive) 34%, transparent), transparent 72%)",
				}}
			/>
			<motion.div
				className="relative flex max-w-xl flex-col items-center text-center text-[#F4ECDC]"
				initial={false}
				animate={reduce ? {} : { x: [0, -6, 6, -3, 3, 0] }}
				transition={{ delay: 0.5, duration: 0.3 }}
			>
				<div className="kicker text-(--syn-keyword)">
					Guardian of {chapter.title}
				</div>
				<motion.div
					initial={reduce ? { opacity: 0 } : { scale: 1.15, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ delay: 0.25, duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
					className="my-6 grid size-28 place-items-center rounded-full bg-destructive text-destructive-foreground gloss"
					style={{ filter: "drop-shadow(0 8px 0 var(--destructive-edge))" }}
				>
					<GameIcon name="skull" solid={false} className="size-16" />
				</motion.div>
				<h1 className="font-display text-hero" aria-label={name}>
					{name.split(" ").map((word, wi, words) => {
						const offset = words.slice(0, wi).join(" ").length + (wi ? 1 : 0);
						return (
							<span
								key={`${offset}-${word}`}
								className="inline-block whitespace-nowrap"
								aria-hidden="true"
							>
								{word.split("").map((ch, ci) => (
									<motion.span
										// biome-ignore lint/suspicious/noArrayIndexKey: letters of a fixed word
										key={ci}
										className="inline-block"
										initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{
											delay: 0.6 + (offset + ci) * 0.025,
											duration: 0.22,
											ease: [0.23, 1, 0.32, 1],
										}}
									>
										{ch}
									</motion.span>
								))}
								{wi < words.length - 1 ? "\u00a0" : null}
							</span>
						);
					})}
				</h1>
				{boss.story ? (
					<p className="mt-3 max-w-[46ch] text-[#A6AEC4]">{boss.story}</p>
				) : null}
				<div className="mt-6 flex items-center gap-2">
					{[0, 1, 2].map((i) => (
						<motion.span
							key={i}
							initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{
								delay: 1.1 + i * 0.12,
								type: "spring",
								duration: 0.35,
								bounce: 0.2,
							}}
							className="text-heart"
						>
							<GameIcon name="heart" className="size-9" />
						</motion.span>
					))}
				</div>
				<p className="mt-2 text-sm font-bold text-[#A6AEC4]">
					3 hearts{timer ? ` · ${2 + boss.difficulty} minute clock` : ""} ·
					bonus aether
				</p>
				<div className="mt-8 flex flex-col items-center gap-2">
					<Button
						variant="danger"
						size="lg"
						className="min-w-56"
						onClick={onFight}
						autoFocus
					>
						<GameIcon name="wand" data-icon="inline-start" /> Fight
					</Button>
					<Button
						variant="ghost"
						className="text-[#A6AEC4] hover:text-[#F4ECDC]"
						onClick={onRetreat}
					>
						Not yet, retreat
					</Button>
				</div>
			</motion.div>
		</div>
	);
}
