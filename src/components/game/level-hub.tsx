import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { GameIcon } from "#/components/game/icons";
import { Button } from "#/components/ui/button";
import type { Chapter } from "#/content/types";
import { MASTERY_THRESHOLD } from "#/engine/adaptive";
import type { ChapterStatus } from "#/engine/adaptive/types";
import type { Progress } from "#/game/progress";
import { sfx } from "#/game/sound";
import {
	bossOf,
	conceptName,
	datasetById,
	findExercise,
	WORLD_GLYPHS,
	worldOfChapter,
} from "#/lib/content";
import { cn } from "#/lib/utils";
import { WorldGlyph } from "./icons";
import { StarRow } from "./stars";

export function MasteryBar({
	value,
	className,
}: {
	value: number;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"relative h-2 overflow-hidden rounded-full bg-secondary",
				className,
			)}
		>
			<motion.div
				className={cn(
					"absolute inset-y-0 left-0 rounded-full",
					value >= MASTERY_THRESHOLD ? "bg-success" : "bg-reward",
				)}
				initial={{ width: 0 }}
				animate={{ width: `${Math.round(value * 100)}%` }}
				transition={{ duration: 0.8, ease: "easeOut" }}
			/>
			<div
				className="absolute inset-y-0 w-0.5 bg-foreground/50"
				style={{ left: `${MASTERY_THRESHOLD * 100}%` }}
				title="Gate threshold"
			/>
		</div>
	);
}

export function LevelHub({
	chapter,
	status,
	progress,
	onLearn,
	onMission,
	onGate,
	onBoss,
	onNextLevel,
}: {
	chapter: Chapter;
	status: ChapterStatus;
	progress: Progress;
	onLearn: () => void;
	onMission: (id: string) => void;
	onGate: () => void;
	/** Straight to the boss intro (rematch after a win). */
	onBoss: () => void;
	onNextLevel?: () => void;
}) {
	const dataset = datasetById.get(chapter.datasetId);
	const world = worldOfChapter(chapter.id);
	const boss = bossOf(chapter);
	const mains = chapter.exercises.filter((e) => !e.boss);
	const solved = new Set(
		progress.attempts.filter((a) => a.solved).map((a) => a.exerciseId),
	);
	const gauntlet =
		status.gauntlet && !status.gauntlet.cleared ? status.gauntlet : null;
	const [showConcepts, setShowConcepts] = useState(false);
	const weak = status.gateCriteria.weakConcepts.length;
	const total = chapter.concepts.length;

	// The one next step, pinned above the tab bar so the first screen always has an action.
	const next = nextStep(
		status,
		chapter,
		onLearn,
		onMission,
		onGate,
		onNextLevel,
	);
	// Index of the row that holds the next step (0 = Learn, mains, then boss).
	const currentIndex = !status.lessonDone
		? 0
		: status.nextExerciseId
			? mains.findIndex((e) => e.id === status.nextExerciseId) + 1
			: mains.length + 1;
	const currentRef = useRef<HTMLLIElement>(null);
	// Bring the current row into view when it opens below the fold (the world map
	// does the same). Not for the lesson row: the header is worth seeing first
	// and the pinned button already says "Learn the basics".
	const scrollOnMount = useRef(currentIndex > 0);
	useEffect(() => {
		if (!scrollOnMount.current) return;
		const t = window.setTimeout(() => {
			const el = currentRef.current;
			if (!el) return;
			const r = el.getBoundingClientRect();
			if (r.bottom > window.innerHeight - 160)
				el.scrollIntoView({ behavior: "smooth", block: "center" });
		}, 350);
		return () => window.clearTimeout(t);
	}, []);

	return (
		<div className="mx-auto w-full max-w-4xl px-4 pt-5 pb-16 sm:px-6">
			<Link
				to="/"
				className="tap-target mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground no-underline hover:text-foreground"
			>
				<GameIcon name="chevron-left" className="size-4" /> World map
			</Link>
			<motion.header
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
				className="panel relative mb-6 overflow-hidden"
				data-world={world}
			>
				<div className="mission-ribbon world-motif" data-world={world}>
					<div className="min-w-0 flex-1">
						<div className="k">
							{chapter.world} · {chapter.tier} · {chapter.track}
						</div>
						<h1 className="t text-[28px]">{chapter.title}</h1>
					</div>
					<WorldGlyph
						name={WORLD_GLYPHS[world - 1]}
						className="size-12 opacity-90"
					/>
				</div>
				<div className="px-5 pt-4 sm:px-6">
					<p className="text-muted-foreground">{chapter.subtitle}</p>
					<p className="mt-1 text-xs font-bold text-muted-foreground">
						Dataset: {dataset?.name}
					</p>
				</div>
				{/* Phones: one summary line, bars on demand. Wider screens: always shown. */}
				<button
					type="button"
					onClick={() => setShowConcepts((v) => !v)}
					aria-expanded={showConcepts}
					className="mx-5 mt-3 mb-4 flex min-h-11 w-[calc(100%-2.5rem)] items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-left text-sm font-bold text-foreground sm:hidden"
				>
					<GameIcon
						name={weak === 0 ? "check" : "target"}
						className={cn(
							"size-4 shrink-0",
							weak === 0 ? "text-success" : "text-muted-foreground",
						)}
					/>
					<span className="min-w-0 flex-1">
						{weak === 0
							? `All ${total} concepts solid`
							: `${total - weak} of ${total} concepts solid`}
					</span>
					<GameIcon
						name="chevron-down"
						className={cn(
							"size-4 shrink-0 text-muted-foreground transition-transform",
							showConcepts && "rotate-180",
						)}
					/>
				</button>
				<div
					className={cn(
						"relative gap-3 px-5 pb-5 sm:grid sm:grid-cols-2 sm:px-6 sm:pt-4",
						showConcepts ? "grid" : "hidden",
					)}
				>
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
			</motion.header>

			<ol className="relative space-y-3 before:absolute before:top-4 before:bottom-4 before:left-[27px] before:w-1 before:rounded-full before:bg-secondary">
				<HubStep
					index={0}
					itemRef={currentIndex === 0 ? currentRef : undefined}
					icon={<GameIcon name="book" className="size-5" />}
					title="Learn"
					subtitle={`${chapter.lesson.length} cards: concepts, examples, a quiz, a guided try`}
					state={status.lessonDone ? "done" : "open"}
					action={status.lessonDone ? "Replay" : "Start"}
					onClick={onLearn}
				/>
				{mains.map((e, i) => {
					const isSolved = solved.has(e.id);
					const open =
						status.lessonDone &&
						(i === 0 || solved.has(mains[i - 1].id) || isSolved);
					return (
						<HubStep
							key={e.id}
							index={i + 1}
							itemRef={currentIndex === i + 1 ? currentRef : undefined}
							icon={<span className="font-display text-sm">{i + 1}</span>}
							title={e.title}
							subtitle={`${"◆".repeat(e.difficulty)} · ${e.concepts.map(conceptName).join(", ")}`}
							state={isSolved ? "done" : open ? "open" : "locked"}
							stars={isSolved ? (status.stars[e.id] ?? 0) : undefined}
							action={isSolved ? "Replay" : "Play"}
							onClick={() => onMission(e.id)}
						/>
					);
				})}
				{gauntlet ? (
					<motion.li
						initial={{ scale: 0.95, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						className="relative ml-16 rounded-2xl border-2 border-info/50 bg-info-soft p-4 text-info-soft-foreground"
					>
						<div className="flex items-center gap-2 font-display text-xl">
							<GameIcon name="swords" className="size-5" /> Practice gauntlet
						</div>
						<ul className="mt-1 space-y-0.5 text-sm text-foreground">
							{status.reasons.map((r) => (
								<li key={r.message}>· {r.message}</li>
							))}
						</ul>
						<div className="mt-3 grid gap-2 sm:grid-cols-3">
							{gauntlet.exerciseIds.map((id) => {
								const ex = findExercise(id)?.exercise;
								const cleared = gauntlet.clearedIds.includes(id);
								return (
									<button
										key={id}
										type="button"
										disabled={cleared}
										onClick={() => {
											sfx("tap");
											onMission(id);
										}}
										className={cn(
											"rounded-xl border p-3 text-left text-sm",
											cleared
												? "border-success/50 bg-muted opacity-70"
												: "border-border bg-muted hover:border-destructive",
										)}
									>
										<div className="flex items-center justify-between gap-2">
											<span className="font-bold text-foreground">
												{ex?.title ?? id}
											</span>
											{cleared ? (
												<GameIcon
													name="check"
													className="size-4 text-success"
												/>
											) : (
												<GameIcon
													name="play"
													className="size-4 text-destructive"
												/>
											)}
										</div>
										<div className="mt-0.5 text-xs text-muted-foreground">
											{ex?.concepts.map(conceptName).join(", ")}
										</div>
									</button>
								);
							})}
						</div>
					</motion.li>
				) : null}
				{boss ? (
					<HubStep
						index={mains.length + 1}
						itemRef={currentIndex === mains.length + 1 ? currentRef : undefined}
						icon={<GameIcon name="crown" className="size-5" />}
						title={
							/^boss\b/i.test(boss.title) ? boss.title : `Boss: ${boss.title}`
						}
						subtitle={
							status.bossCleared
								? "Defeated"
								: status.bossUnlocked
									? "The gate is open"
									: (status.reasons[0]?.message ??
										"Clear the missions to open the gate")
						}
						state={
							status.bossCleared
								? "done"
								: status.bossUnlocked
									? "boss"
									: "locked"
						}
						stars={
							status.bossCleared ? (status.stars[boss.id] ?? 0) : undefined
						}
						action={status.bossCleared ? "Rematch" : "Gate check"}
						onClick={status.bossCleared ? onBoss : onGate}
						forceClickable={status.lessonDone}
					/>
				) : null}
			</ol>
			{next ? (
				<div className="sticky bottom-[calc(66px+var(--safe-bottom)+0.75rem)] z-20 mt-6 md:bottom-4">
					<Button
						type="button"
						size="lg"
						variant={next.variant}
						onClick={() => {
							sfx("tap");
							next.run();
						}}
						className="h-auto min-h-14 w-full py-2.5 whitespace-normal shadow-[0_10px_30px_-8px_rgb(0_0_0/0.5)]"
					>
						<span className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight">
							<span className="text-xs tracking-wider opacity-80">
								{next.kicker}
							</span>
							<span className="truncate text-pretty">{next.label}</span>
						</span>
						<GameIcon name="chevron-right" className="size-5 shrink-0" />
					</Button>
				</div>
			) : null}
		</div>
	);
}

type NextStep = {
	kicker: string;
	label: string;
	variant: "default" | "info" | "destructive" | "success";
	run: () => void;
};

/** What the pinned button does: lesson, drill, next mission, boss, then the next level. */
function nextStep(
	status: ChapterStatus,
	chapter: Chapter,
	onLearn: () => void,
	onMission: (id: string) => void,
	onGate: () => void,
	onNextLevel?: () => void,
): NextStep | null {
	if (!status.lessonDone)
		return {
			kicker: "Start here",
			label: "Learn the basics",
			variant: "default",
			run: onLearn,
		};
	const drill = status.pendingDrillIds[0];
	if (drill)
		return {
			kicker: "Practice drill",
			label: findExercise(drill)?.exercise.title ?? "Next drill",
			variant: "info",
			run: () => onMission(drill),
		};
	if (status.nextExerciseId) {
		const id = status.nextExerciseId;
		const n = chapter.exercises.findIndex((e) => e.id === id) + 1;
		return {
			kicker: `Continue: mission ${n}`,
			label: findExercise(id)?.exercise.title ?? "Next mission",
			variant: "default",
			run: () => onMission(id),
		};
	}
	if (status.bossUnlocked)
		return {
			kicker: "The gate is open",
			label: "Face the boss",
			variant: "destructive",
			run: onGate,
		};
	if (status.bossCleared || status.state === "complete")
		return onNextLevel
			? {
					kicker: "Chapter cleared",
					label: "Next level",
					variant: "success",
					run: onNextLevel,
				}
			: null;
	return {
		kicker: "Almost there",
		label: "Gate check",
		variant: "default",
		run: onGate,
	};
}

function HubStep({
	itemRef,
	index,
	icon,
	title,
	subtitle,
	state,
	stars,
	action,
	onClick,
	forceClickable,
}: {
	itemRef?: React.Ref<HTMLLIElement>;
	index: number;
	icon: React.ReactNode;
	title: string;
	subtitle: string;
	state: "done" | "open" | "locked" | "boss";
	stars?: number;
	action: string;
	onClick: () => void;
	forceClickable?: boolean;
}) {
	const clickable = state !== "locked" || forceClickable;
	return (
		<motion.li
			ref={itemRef}
			initial={{ x: -16, opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			transition={{ delay: index * 0.05 }}
			className="relative flex items-center gap-3"
		>
			<div
				className="map-node relative z-10 shrink-0"
				data-state={state === "locked" ? "locked" : "available"}
				style={
					{
						"--node-size": "3.5rem",
						...(state === "done"
							? {
									"--w": "var(--success)",
									"--w-deep": "var(--success-edge)",
									"--w-ink": "var(--success-foreground)",
								}
							: state === "boss"
								? {
										"--w": "var(--destructive)",
										"--w-deep": "var(--destructive-edge)",
										"--w-ink": "var(--destructive-foreground)",
									}
								: {}),
					} as React.CSSProperties
				}
			>
				{state === "done" ? (
					<GameIcon name="check" className="size-6" />
				) : state === "locked" ? (
					<GameIcon name="lock" className="size-5" />
				) : (
					icon
				)}
			</div>
			<button
				type="button"
				disabled={!clickable}
				onClick={() => {
					sfx("tap");
					onClick();
				}}
				className={cn(
					"panel flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left transition",
					clickable
						? "hover:-translate-y-0.5 hover:border-reward/60"
						: "cursor-not-allowed opacity-60",
				)}
			>
				<div className="min-w-0 flex-1">
					<div className="truncate font-bold text-foreground">{title}</div>
					<div className="truncate text-xs text-muted-foreground">
						{subtitle}
					</div>
				</div>
				{stars !== undefined ? <StarRow stars={stars} /> : null}
				{clickable ? (
					<span className="hidden rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold text-foreground sm:inline">
						{action}
					</span>
				) : null}
			</button>
		</motion.li>
	);
}
