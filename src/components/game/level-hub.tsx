import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { GameIcon } from "#/components/game/icons";
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
}: {
	chapter: Chapter;
	status: ChapterStatus;
	progress: Progress;
	onLearn: () => void;
	onMission: (id: string) => void;
	onGate: () => void;
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
				<div className="relative grid gap-3 px-5 pt-4 pb-5 sm:grid-cols-2 sm:px-6">
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
						onClick={onGate}
						forceClickable={status.lessonDone}
					/>
				) : null}
			</ol>
		</div>
	);
}

function HubStep({
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
