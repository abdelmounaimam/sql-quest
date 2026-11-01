import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId } from "react";
import type { Chapter, Exercise } from "#/content/types";
import { useGame } from "#/game/progress";
import { haptic, sfx } from "#/game/sound";
import { gameActions } from "#/game/store";
import { worldOfChapter } from "#/lib/content";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { GameIcon } from "./icons";
import { Markdown } from "./markdown";

/**
 * Boss intro (§7.3): ink overlay with the world motif, guardian banner slams
 * in, container shakes once, name letters stagger, hearts pop. It never
 * starts the fight on its own: the learner reads the story, picks clock or
 * no clock, then taps Fight. Fight and Retreat stay pinned at the bottom of
 * the screen, so the choice is always in view on a phone.
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
	// Same clock as the mission screen (mission.tsx: 120 s + 60 s per difficulty).
	const minutes = 2 + boss.difficulty;
	const clockId = useId();

	useEffect(() => {
		const t = window.setTimeout(() => {
			sfx("boss");
			haptic("boss");
		}, 250);
		return () => window.clearTimeout(t);
	}, []);

	return (
		<div
			className="boss-intro relative flex min-h-dvh flex-1 flex-col overflow-x-clip bg-[#0A0F1C]"
			data-world={world}
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
			{/* `safe center`: centered when it fits, top aligned (never clipped) when it does not. */}
			<motion.div
				className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-[safe_center] px-safe-4 pt-safe-5 pb-2 text-center text-[#F4ECDC]"
				initial={false}
				animate={reduce ? {} : { x: [0, -6, 6, -3, 3, 0] }}
				transition={{ delay: 0.5, duration: 0.3 }}
			>
				<div className="kicker text-(--syn-keyword)">
					Guardian of {chapter.title}
				</div>
				<motion.div
					initial={reduce ? false : { scale: 1.15, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ delay: 0.25, duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
					className="my-3 grid size-16 shrink-0 [@media(min-height:760px)]:my-6 [@media(min-height:760px)]:size-28 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-[0_8px_0_var(--destructive-edge)] gloss"
				>
					<GameIcon
						name="skull"
						solid={false}
						className="size-10 [@media(min-height:760px)]:size-16"
					/>
				</motion.div>
				<h1
					className="font-display text-[clamp(2rem,10vw,3.5rem)] leading-[1.05] text-balance"
					aria-label={name}
				>
					{reduce ? (
						<span aria-hidden="true">{name}</span>
					) : (
						name.split(" ").map((word, wi, words) => {
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
											initial={{ opacity: 0, y: 12 }}
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
									{wi < words.length - 1 ? " " : null}
								</span>
							);
						})
					)}
				</h1>
				{boss.story ? (
					<p className="mt-3 max-w-[46ch] text-[#A6AEC4]">
						<Markdown inline className="text-[#A6AEC4]">
							{boss.story}
						</Markdown>
					</p>
				) : null}
				<div className="mt-4 flex items-center justify-center gap-1.5">
					{[0, 1, 2].map((i) => (
						<motion.span
							key={i}
							initial={reduce ? false : { opacity: 0, scale: 0.6 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{
								delay: 1.1 + i * 0.12,
								type: "spring",
								duration: 0.35,
								bounce: 0.2,
							}}
							className="text-heart"
						>
							<GameIcon name="heart" className="size-6" />
						</motion.span>
					))}
					<span className="ml-1.5 text-sm font-bold text-[#A6AEC4]">
						3 hearts · bonus XP
					</span>
				</div>
				{/* The clock is optional: long bosses are a lot to write on a phone keyboard. */}
				<div className="mt-3 flex w-full max-w-xs items-center gap-3 rounded-2xl border-2 border-white/10 bg-white/5 px-4 py-2 text-left">
					<GameIcon name="clock" className="size-5 shrink-0 text-[#A6AEC4]" />
					<label
						htmlFor={clockId}
						className="min-w-0 flex-1 text-sm font-extrabold text-[#F4ECDC]"
					>
						{timer ? `${minutes} minute clock` : "No clock, take your time"}
					</label>
					<Switch
						id={clockId}
						checked={timer}
						onCheckedChange={(v) =>
							gameActions.updateSettings({ bossTimer: v })
						}
					/>
				</div>
			</motion.div>
			<div className="sticky bottom-0 z-10 bg-gradient-to-t from-[#0A0F1C] from-60% to-transparent px-safe-4 pt-5 pb-safe-3">
				<div className="mx-auto flex max-w-xs flex-col items-stretch gap-1">
					<Button variant="danger" size="lg" onClick={onFight} autoFocus>
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
			</div>
		</div>
	);
}
