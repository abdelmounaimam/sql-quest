import { Link, useNavigate } from "@tanstack/react-router";
import {
	Clock,
	Crown,
	Lock,
	Play,
	RotateCcw,
	Sparkles,
	Swords,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import type { Chapter } from "#/content/types";
import type { ChapterStatus, NextActivity } from "#/engine/adaptive/types";
import type { Progress } from "#/game/progress";
import { useGame } from "#/game/progress";
import { sfx } from "#/game/sound";
import {
	chapterById,
	conceptName,
	type World,
	worlds,
	worldTheme,
} from "#/lib/content";
import { cn } from "#/lib/utils";
import { StarRow } from "./stars";

const STEP_Y = 150;
const TOP_PAD = 110;

function nodeX(globalIndex: number): number {
	// Gentle winding path between 22% and 78%.
	return 50 + 28 * Math.sin(globalIndex * 1.15);
}

/** Smooth path through points (Catmull-Rom to cubic Bezier), in a 100 x H box. */
function smoothPath(points: { x: number; y: number }[]): string {
	if (points.length === 0) return "";
	let d = `M ${points[0].x} ${points[0].y}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[i + 2] ?? p2;
		const c1x = p1.x + (p2.x - p0.x) / 6;
		const c1y = p1.y + (p2.y - p0.y) / 6;
		const c2x = p2.x - (p3.x - p1.x) / 6;
		const c2y = p2.y - (p3.y - p1.y) / 6;
		d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
	}
	return d;
}

export function activityChapter(next: NextActivity): string | null {
	return next.kind === "done" ? null : next.chapterId;
}

export function activityLink(next: NextActivity) {
	switch (next.kind) {
		case "lesson":
			return {
				to: "/play/$chapterId" as const,
				params: { chapterId: next.chapterId },
				search: { phase: "learn" as const },
			};
		case "exercise":
		case "gauntlet":
		case "review":
			return {
				to: "/play/$chapterId" as const,
				params: { chapterId: next.chapterId },
				search: {
					phase: "mission" as const,
					ex: next.exerciseId,
					...(next.kind === "review" ? { review: true } : {}),
				},
			};
		case "boss":
			return {
				to: "/play/$chapterId" as const,
				params: { chapterId: next.chapterId },
				search: { phase: "gate" as const },
			};
		default:
			return null;
	}
}

export function WorldMap({ progress }: { progress: Progress }) {
	const { statuses, next, reviews } = progress;
	const avatar = useGame((s) => s.profile?.avatar ?? "🦊");
	const current = activityChapter(next);

	const reviewByChapter = useMemo(() => {
		const m = new Map<string, typeof reviews>();
		for (const r of reviews) {
			const list = m.get(r.chapterId) ?? [];
			list.push(r);
			m.set(r.chapterId, list);
		}
		return m;
	}, [reviews]);

	let offset = 0;
	return (
		<div className="flex flex-col gap-6 pb-24">
			{worlds.map((w) => {
				const start = offset;
				offset += w.chapters.length;
				return (
					<WorldSection
						key={w.name}
						world={w}
						startIndex={start}
						statuses={statuses}
						current={current}
						avatar={avatar}
						reviewByChapter={reviewByChapter}
					/>
				);
			})}
		</div>
	);
}

function WorldSection({
	world,
	startIndex,
	statuses,
	current,
	avatar,
	reviewByChapter,
}: {
	world: World;
	startIndex: number;
	statuses: Record<string, ChapterStatus>;
	current: string | null;
	avatar: string;
	reviewByChapter: Map<string, Progress["reviews"]>;
}) {
	const theme = worldTheme(world.index);
	const height = TOP_PAD + world.chapters.length * STEP_Y + 10;
	const points = world.chapters.map((_, i) => ({
		x: nodeX(startIndex + i),
		y: TOP_PAD + i * STEP_Y + 40,
	}));
	const completeCount = world.chapters.filter(
		(c) => statuses[c.id]?.state === "complete",
	).length;
	const donePoints = points.slice(
		0,
		Math.min(points.length, completeCount + 1),
	);
	const worldLocked = world.chapters.every(
		(c) => statuses[c.id]?.state === "locked",
	);

	return (
		<section
			aria-labelledby={`world-${world.index}`}
			className="relative overflow-hidden rounded-[2rem] border border-border"
			style={{
				// Lazy rendering for long maps: off-screen worlds skip layout and paint.
				contentVisibility: "auto",
				containIntrinsicSize: `auto ${height}px`,
				background: `color-mix(in oklab, ${theme.glow} 10%, var(--card))`,
			}}
		>
			<div className="relative flex items-center justify-between gap-3 px-5 pt-5">
				<div>
					<div
						className="text-[11px] font-bold tracking-[0.2em] uppercase"
						style={{ color: theme.glow }}
					>
						World {world.index + 1}
					</div>
					<h2
						id={`world-${world.index}`}
						className="font-display text-xl text-foreground sm:text-2xl"
					>
						{world.name}
					</h2>
				</div>
				<div className="rounded-full bg-background/70 px-3 py-1 font-mono text-xs text-muted-foreground">
					{worldLocked ? (
						<span className="flex items-center gap-1">
							<Lock className="size-3" /> locked
						</span>
					) : (
						`${completeCount}/${world.chapters.length}`
					)}
				</div>
			</div>

			<div className="relative mx-auto max-w-xl" style={{ height }}>
				<svg
					className="absolute inset-0 h-full w-full"
					viewBox={`0 0 100 ${height}`}
					preserveAspectRatio="none"
					aria-hidden="true"
				>
					<path
						d={smoothPath(points)}
						fill="none"
						stroke="var(--border)"
						strokeWidth="10"
						strokeLinecap="round"
						vectorEffect="non-scaling-stroke"
					/>
					<path
						d={smoothPath(points)}
						fill="none"
						stroke="var(--muted-foreground)"
						strokeWidth="2.5"
						strokeDasharray="2 12"
						strokeLinecap="round"
						vectorEffect="non-scaling-stroke"
						className="path-march"
					/>
					{donePoints.length > 1 ? (
						<motion.path
							d={smoothPath(donePoints)}
							fill="none"
							stroke={theme.glow}
							strokeWidth="6"
							strokeLinecap="round"
							vectorEffect="non-scaling-stroke"
							initial={{ pathLength: 0 }}
							whileInView={{ pathLength: 1 }}
							viewport={{ once: true }}
							transition={{ duration: 1.2, ease: "easeInOut" }}
						/>
					) : null}
				</svg>
				{world.chapters.map((ch, i) => (
					<LevelNode
						key={ch.id}
						chapter={ch}
						status={statuses[ch.id]}
						x={points[i].x}
						y={points[i].y}
						glow={theme.glow}
						isCurrent={current === ch.id}
						avatar={avatar}
						reviews={reviewByChapter.get(ch.id) ?? []}
						side={points[i].x > 50 ? "left" : "right"}
					/>
				))}
			</div>
		</section>
	);
}

function LevelNode({
	chapter,
	status,
	x,
	y,
	glow,
	isCurrent,
	avatar,
	reviews,
	side,
}: {
	chapter: Chapter;
	status: ChapterStatus | undefined;
	x: number;
	y: number;
	glow: string;
	isCurrent: boolean;
	avatar: string;
	reviews: Progress["reviews"];
	side: "left" | "right";
}) {
	const navigate = useNavigate();
	const state = status?.state ?? "locked";
	const locked = state === "locked";
	const totalStars = status
		? Math.round(
				Object.values(status.stars).reduce<number>((a, b) => a + b, 0) /
					Math.max(1, chapter.exercises.length),
			)
		: 0;
	const progressFrac = status
		? status.solvedMain / Math.max(1, status.totalMain)
		: 0;

	const onClick = () => {
		if (locked) {
			sfx("fail");
			const reason = status?.reasons[0]?.message;
			const pre = chapter.prerequisites
				.map((p) => chapterById.get(p)?.title)
				.filter(Boolean)
				.join(", ");
			toast(reason ?? `Finish ${pre || "the previous level"} first`, {
				icon: "🔒",
			});
			return;
		}
		sfx("tap");
		void navigate({
			to: "/play/$chapterId",
			params: { chapterId: chapter.id },
			search: status?.lessonDone ? { phase: "hub" } : { phase: "learn" },
		});
	};

	return (
		<div
			className="absolute -translate-x-1/2 -translate-y-1/2"
			style={{ left: `${x}%`, top: y }}
		>
			<motion.button
				type="button"
				onClick={onClick}
				initial={{ scale: 0.4, opacity: 0 }}
				whileInView={{ scale: 1, opacity: 1 }}
				viewport={{ once: true, margin: "-40px" }}
				whileHover={locked ? { x: [0, -3, 3, 0] } : { scale: 1.08, y: -3 }}
				whileTap={{ scale: 0.94 }}
				transition={{ type: "spring", stiffness: 300, damping: 18 }}
				className={cn(
					"relative grid size-[76px] place-items-center rounded-full border-4 text-3xl",
					locked
						? "cursor-not-allowed border-border bg-muted text-muted-foreground grayscale"
						: "border-foreground/70 bg-card",
				)}
				style={
					locked
						? undefined
						: {
								boxShadow: `0 0 0 4px color-mix(in oklab, ${glow} 35%, transparent)`,
							}
				}
				aria-label={`${chapter.title}: ${state.replace("-", " ")}`}
			>
				{!locked && state !== "complete" ? (
					<svg
						className="absolute -inset-[7px] -rotate-90"
						viewBox="0 0 100 100"
						aria-hidden="true"
					>
						<circle
							cx="50"
							cy="50"
							r="46"
							fill="none"
							stroke={glow}
							strokeWidth="5"
							strokeDasharray={`${progressFrac * 289} 289`}
							strokeLinecap="round"
						/>
					</svg>
				) : null}
				{isCurrent ? (
					<span
						className="pulse-ring absolute inset-0 rounded-full border-4"
						style={{ borderColor: glow }}
					/>
				) : null}
				<span aria-hidden="true">
					{locked ? <Lock className="size-7" /> : chapter.emoji}
				</span>
				{state === "gauntlet" ? (
					<span className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg">
						<Swords className="size-4" />
					</span>
				) : null}
				{state === "boss-ready" ? (
					<span className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-reward text-reward-foreground shadow-lg">
						<Crown className="size-4" />
					</span>
				) : null}
			</motion.button>

			{isCurrent ? (
				<motion.div
					layoutId="map-avatar"
					className="absolute -top-14 left-1/2 -translate-x-1/2"
					transition={{ type: "spring", stiffness: 160, damping: 18 }}
				>
					<motion.div
						animate={{ y: [0, -6, 0] }}
						transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.6 }}
						className="grid size-11 place-items-center rounded-2xl border-2 border-background bg-reward text-2xl shadow-md"
					>
						{avatar}
					</motion.div>
				</motion.div>
			) : null}

			<div
				className={cn(
					"absolute top-1/2 w-36 -translate-y-1/2 sm:w-44",
					side === "right"
						? "left-[92px] text-left"
						: "right-[92px] text-right",
				)}
			>
				<div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
					{chapter.tier} · {chapter.track}
				</div>
				<div
					className={cn(
						"font-display text-sm leading-tight sm:text-base",
						locked ? "text-muted-foreground" : "text-foreground",
					)}
				>
					{chapter.title}
				</div>
				{state === "complete" || totalStars > 0 ? (
					<StarRow stars={totalStars} className="mt-1 text-foreground" />
				) : null}
				{reviews.length ? (
					<Link
						to="/play/$chapterId"
						params={{ chapterId: chapter.id }}
						search={{
							phase: "mission",
							ex: reviews[0].exerciseId,
							review: true,
						}}
						className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-info px-2 py-0.5 text-[11px] font-bold text-info-foreground no-underline shadow"
					>
						<Clock className="size-3" />
						Review {conceptName(reviews[0].conceptId)}
					</Link>
				) : null}
			</div>
		</div>
	);
}

export function NextUpCard({ progress }: { progress: Progress }) {
	const { next } = progress;
	const link = activityLink(next);
	const icon =
		next.kind === "boss" ? (
			<Crown className="size-5" />
		) : next.kind === "gauntlet" ? (
			<Swords className="size-5" />
		) : next.kind === "review" ? (
			<RotateCcw className="size-5" />
		) : next.kind === "lesson" ? (
			<Sparkles className="size-5" />
		) : (
			<Play className="size-5" />
		);
	const chapter = next.kind === "done" ? null : chapterById.get(next.chapterId);
	return (
		<motion.div
			initial={{ y: 16, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5"
		>
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl">
					{chapter?.emoji ?? "🏆"}
				</div>
				<div className="min-w-0">
					<div className="text-[11px] font-bold tracking-[0.18em] text-reward uppercase">
						Next up
					</div>
					<div className="truncate font-display text-base text-foreground sm:text-lg">
						{next.label}
					</div>
					{chapter ? (
						<div className="truncate text-sm text-muted-foreground">
							{chapter.subtitle}
						</div>
					) : null}
				</div>
			</div>
			{link ? (
				<Button
					asChild
					size="lg"
					variant={
						next.kind === "boss" || next.kind === "gauntlet"
							? "destructive"
							: next.kind === "review"
								? "secondary"
								: "default"
					}
				>
					<Link {...link} onClick={() => sfx("tap")}>
						{icon}
						{next.kind === "lesson"
							? "Start lesson"
							: next.kind === "boss"
								? "Face the boss"
								: "Play"}
					</Link>
				</Button>
			) : null}
		</motion.div>
	);
}
