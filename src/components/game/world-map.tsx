import { Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Chapter } from "#/content/types";
import type { ChapterStatus, NextActivity } from "#/engine/adaptive/types";
import type { Progress } from "#/game/progress";
import { sfx } from "#/game/sound";
import { useMediaQuery } from "#/hooks/use-media";
import {
	chapterById,
	conceptName,
	WORLD_GLYPHS,
	type World,
	worldNumber,
	worlds,
} from "#/lib/content";
import { cn } from "#/lib/utils";
import { Button } from "../ui/button";
import {
	GameIcon,
	type GameIconName,
	StarGlyph,
	Wick,
	WorldGlyph,
} from "./icons";

/** Path geometry (design-direction §9.1): 320px column, rows every 104px. */
const COLUMN = 320;
const CENTER = COLUMN / 2;
const X_OFFSETS = [0, 60, 76, 60, 0, -60, -76, -60];
const ROW = 104;
const BOSS_ROW = 116;
const TOP = 128;
const BOTTOM = 96;

const MOTIF_NAMES = [
	"Hearth",
	"Coin",
	"River",
	"Moss",
	"Night sky",
	"Molten",
	"Blueprint",
	"Potion",
	"Vellum",
	"Gunmetal",
	"Aurora",
];

type NodeState = "locked" | "available" | "current" | "completed" | "perfect";
type NodeKind = "normal" | "boss" | "review";

interface PlacedNode {
	chapter: Chapter;
	status: ChapterStatus | undefined;
	x: number;
	y: number;
	state: NodeState;
	kind: NodeKind;
	stars: number;
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

function averageStars(chapter: Chapter, status: ChapterStatus | undefined) {
	if (!status) return 0;
	const vals: number[] = chapter.exercises.map((e) => status.stars[e.id] ?? 0);
	return Math.round(vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length));
}

/** Smooth path through points (Catmull-Rom to cubic Bezier). */
function smoothPath(points: { x: number; y: number }[]): string {
	if (points.length < 2) return "";
	let d = `M ${points[0].x} ${points[0].y}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[i + 2] ?? p2;
		d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
	}
	return d;
}

export function WorldMap({ progress }: { progress: Progress }) {
	const { statuses, next, reviews } = progress;
	const current = activityChapter(next);
	const currentRef = useRef<HTMLDivElement | null>(null);
	const [offscreen, setOffscreen] = useState(false);

	const reviewByChapter = useMemo(() => {
		const m = new Map<string, Progress["reviews"]>();
		for (const r of reviews)
			m.set(r.chapterId, [...(m.get(r.chapterId) ?? []), r]);
		return m;
	}, [reviews]);

	useEffect(() => {
		const el = currentRef.current;
		if (!el) return;
		const io = new IntersectionObserver(
			([e]) => setOffscreen(!e.isIntersecting),
			{
				rootMargin: "-80px 0px -80px 0px",
			},
		);
		io.observe(el);
		return () => io.disconnect();
	});

	let offset = 0;
	return (
		<div className="relative flex flex-col gap-8">
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
						reviewByChapter={reviewByChapter}
						currentRef={currentRef}
					/>
				);
			})}
			{offscreen && current ? (
				<Button
					variant="secondary"
					size="icon"
					className="fixed right-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 rounded-full md:bottom-8"
					aria-label="Back to my level"
					onClick={() =>
						currentRef.current?.scrollIntoView({
							behavior: "smooth",
							block: "center",
						})
					}
				>
					<Wick className="h-7 w-6" />
				</Button>
			) : null}
		</div>
	);
}

function WorldSection({
	world,
	startIndex,
	statuses,
	current,
	reviewByChapter,
	currentRef,
}: {
	world: World;
	startIndex: number;
	statuses: Record<string, ChapterStatus>;
	current: string | null;
	reviewByChapter: Map<string, Progress["reviews"]>;
	currentRef: React.RefObject<HTMLDivElement | null>;
}) {
	const n = worldNumber(world.index);
	// Phones: a tighter wiggle so side labels fit in 390px.
	const wide = useMediaQuery("(min-width: 640px)", true);
	const sway = wide ? 1 : 0.45;
	const nodes: PlacedNode[] = [];
	let y = TOP;
	world.chapters.forEach((ch, i) => {
		const st = statuses[ch.id];
		const stars = averageStars(ch, st);
		const state: NodeState =
			!st || st.state === "locked"
				? "locked"
				: st.state === "complete"
					? stars >= 3
						? "perfect"
						: "completed"
					: current === ch.id
						? "current"
						: "available";
		const kind: NodeKind =
			st?.state === "boss-ready"
				? "boss"
				: st?.state === "gauntlet"
					? "review"
					: "normal";
		if (i > 0) y += kind === "boss" ? BOSS_ROW : ROW;
		nodes.push({
			chapter: ch,
			status: st,
			x: CENTER + X_OFFSETS[(startIndex + i) % X_OFFSETS.length] * sway,
			y,
			state,
			kind,
			stars,
		});
	});
	const height = y + BOTTOM;
	const traveledUntil = (() => {
		const idx = nodes.findIndex((p) => p.state === "current");
		if (idx >= 0) return idx;
		let last = -1;
		nodes.forEach((p, i) => {
			if (p.state === "completed" || p.state === "perfect") last = i;
		});
		return last;
	})();
	const pts = nodes.map((p) => ({ x: p.x, y: p.y }));
	const traveled =
		traveledUntil > 0 ? smoothPath(pts.slice(0, traveledUntil + 1)) : "";
	const ahead = smoothPath(pts.slice(Math.max(0, traveledUntil)));
	const done = nodes.filter(
		(p) => p.state === "completed" || p.state === "perfect",
	).length;
	const locked = nodes.every((p) => p.state === "locked");

	return (
		<section
			data-world={n}
			aria-labelledby={`world-${world.index}`}
			className="map-frame overflow-clip"
			style={{
				contentVisibility: "auto",
				containIntrinsicSize: `auto ${height + 90}px`,
			}}
		>
			<div className="unit-banner world-motif" data-world={n}>
				<div className="min-w-0">
					<div className="wn">
						World {world.index + 1} ·{" "}
						{MOTIF_NAMES[(n - 1) % MOTIF_NAMES.length]}
					</div>
					<h2 id={`world-${world.index}`} className="wt">
						{world.name}
					</h2>
				</div>
				<span className="ml-auto flex items-center gap-2">
					<span className="rounded-full bg-[color-mix(in_oklab,var(--w-ink)_14%,transparent)] px-2.5 py-1 text-xs font-extrabold tabular">
						{locked ? "Locked" : `${done}/${nodes.length}`}
					</span>
					<WorldGlyph
						name={WORLD_GLYPHS[n - 1]}
						className="size-10 opacity-90"
					/>
				</span>
			</div>
			<div className="map-body" style={{ height }}>
				<svg
					className="layer-far"
					viewBox={`0 0 420 ${height}`}
					preserveAspectRatio="xMidYMid slice"
					aria-hidden="true"
				>
					<g
						fill="none"
						stroke="var(--w)"
						strokeOpacity=".28"
						strokeWidth="3"
						strokeLinecap="round"
					>
						<path d="M-10 160 q30 -14 60 0 t60 0 t60 0" />
						<path d={`M300 ${height * 0.4} q30 -14 60 0 t60 0`} />
						<path d={`M-20 ${height * 0.75} q30 -14 60 0 t60 0 t60 0`} />
					</g>
					<g fill="var(--w)" fillOpacity=".22">
						<path d={`M330 ${height * 0.62} a40 40 0 0 1 80 0 v60 h-80z`} />
						<path d={`M10 ${height * 0.5} a30 30 0 0 1 60 0 v50 h-60z`} />
					</g>
				</svg>
				<div className="map-canvas" style={{ height }}>
					<svg
						className="trail"
						width={COLUMN}
						height={height}
						viewBox={`0 0 ${COLUMN} ${height}`}
						aria-hidden="true"
					>
						{ahead ? (
							<path
								d={ahead}
								fill="none"
								stroke="color-mix(in oklab, var(--w) 45%, transparent)"
								strokeWidth="9"
								strokeLinecap="round"
								strokeDasharray="0 18"
							/>
						) : null}
						{traveled ? (
							<>
								<path
									d={traveled}
									fill="none"
									stroke="var(--w-deep)"
									strokeWidth="14"
									strokeLinecap="round"
									transform="translate(0 4)"
								/>
								<RoadFace d={traveled} />
							</>
						) : null}
					</svg>
					{nodes.map((p) => (
						<LevelNode
							key={p.chapter.id}
							node={p}
							reviews={reviewByChapter.get(p.chapter.id) ?? []}
							nodeRef={p.state === "current" ? currentRef : undefined}
						/>
					))}
				</div>
			</div>
		</section>
	);
}

/** Traveled road: drawn once when it comes into view (one path, acceptable paint). */
function RoadFace({ d }: { d: string }) {
	const reduce = useReducedMotion();
	return (
		<motion.path
			d={d}
			fill="none"
			stroke="var(--w)"
			strokeWidth="14"
			strokeLinecap="round"
			initial={reduce ? false : { pathLength: 0 }}
			whileInView={{ pathLength: 1 }}
			viewport={{ once: true }}
			transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
		/>
	);
}

function nodeIcon(p: PlacedNode): GameIconName {
	if (p.state === "locked") return "lock";
	if (p.kind === "boss") return "skull";
	if (p.kind === "review") return "dumbbell";
	if (p.state === "perfect") return "crown";
	if (p.state === "completed") return "check";
	return "play";
}

function LevelNode({
	node: p,
	reviews,
	nodeRef,
}: {
	node: PlacedNode;
	reviews: Progress["reviews"];
	nodeRef?: React.RefObject<HTMLDivElement | null>;
}) {
	const navigate = useNavigate();
	const reduce = useReducedMotion();
	const { chapter, status } = p;
	const locked = p.state === "locked";

	const onClick = () => {
		if (locked) {
			sfx("fail");
			const pre = chapter.prerequisites
				.map((id) => chapterById.get(id)?.title)
				.filter(Boolean)
				.join(", ");
			toast(
				status?.reasons[0]?.message ??
					`Finish ${pre || "the previous level"} first`,
				{
					icon: <GameIcon name="lock" className="text-muted-foreground" />,
				},
			);
			return;
		}
		sfx("tap");
		void navigate({
			to: "/play/$chapterId",
			params: { chapterId: chapter.id },
			search: status?.lessonDone ? { phase: "hub" } : { phase: "learn" },
		});
	};

	// Label sits away from the edge the node leans to; Wick and reviews take the other side.
	const labelSide = p.x > CENTER ? -1 : 1;
	const side = -labelSide;
	const reviewStyle =
		p.kind === "review"
			? ({
					"--w": "var(--info)",
					"--w-deep": "var(--info-edge)",
					"--w-ink": "var(--info-foreground)",
				} as React.CSSProperties)
			: undefined;

	return (
		<div
			ref={nodeRef}
			className={cn("mn", p.state === "current" && "z-10")}
			style={{ left: p.x, top: p.y }}
		>
			{p.state === "current" ? (
				<div className="start-bubble">
					<span className="speech-bubble">
						<span className="display">START</span>
					</span>
				</div>
			) : null}
			{p.kind === "boss" && !locked ? (
				<span className="boss-tag">BOSS</span>
			) : null}
			<motion.button
				type="button"
				onClick={onClick}
				className="map-node"
				data-state={p.state}
				data-kind={p.kind === "boss" ? "boss" : undefined}
				style={reviewStyle}
				initial={reduce ? false : { opacity: 0, scale: 0.92 }}
				whileInView={{ opacity: 1, scale: 1 }}
				viewport={{ once: true, margin: "-40px" }}
				transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
				aria-label={`${chapter.title}: ${locked ? "locked" : (status?.state ?? "available").replace("-", " ")}`}
			>
				<GameIcon
					name={nodeIcon(p)}
					solid={["play", "crown", "skull"].includes(nodeIcon(p))}
				/>
			</motion.button>
			{locked ? (
				<span className="lockbadge" aria-hidden="true">
					<GameIcon name="lock" />
				</span>
			) : null}
			{p.state === "completed" || p.state === "perfect" ? (
				<div className="stars3" role="img" aria-label={`${p.stars} of 3 stars`}>
					{[0, 1, 2].map((i) => (
						<StarGlyph key={i} filled={i < p.stars} />
					))}
				</div>
			) : null}
			<span
				className="label"
				style={
					labelSide > 0
						? {
								top: "50%",
								left: "calc(100% + 16px)",
								transform: "translateY(-50%)",
								textAlign: "left",
							}
						: {
								top: "50%",
								right: "calc(100% + 16px)",
								transform: "translateY(-50%)",
								textAlign: "right",
							}
				}
			>
				<small>{chapter.tier}</small>
				{chapter.title}
			</span>
			{p.state === "current" ? (
				<motion.div
					layoutId="wick-walker"
					className="pointer-events-none absolute top-1/2"
					style={{
						left: side > 0 ? "calc(100% + 18px)" : undefined,
						right: side < 0 ? "calc(100% + 18px)" : undefined,
					}}
					transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
				>
					<Wick className="h-[58px] w-12 -translate-y-1/2" />
				</motion.div>
			) : null}
			{reviews.length && !locked ? (
				<Link
					to="/play/$chapterId"
					params={{ chapterId: chapter.id }}
					search={{ phase: "mission", ex: reviews[0].exerciseId, review: true }}
					className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 no-underline"
					style={
						side > 0
							? { right: "calc(100% + 22px)" }
							: { left: "calc(100% + 22px)" }
					}
					onClick={() => sfx("tap")}
				>
					<span
						className="map-node"
						data-kind="side"
						data-state="available"
						style={
							{
								"--w": "var(--info)",
								"--w-deep": "var(--info-edge)",
								"--w-ink": "var(--info-foreground)",
							} as React.CSSProperties
						}
					>
						<GameIcon name="dumbbell" className="size-6" />
					</span>
					<span className="max-w-24 text-center text-[11px] leading-tight font-extrabold text-(--w-tint-fg)">
						Review {conceptName(reviews[0].conceptId)}
					</span>
				</Link>
			) : null}
		</div>
	);
}

export function NextUpCard({ progress }: { progress: Progress }) {
	const { next } = progress;
	const link = activityLink(next);
	const chapter = next.kind === "done" ? null : chapterById.get(next.chapterId);
	const cta =
		next.kind === "lesson"
			? "Start lesson"
			: next.kind === "boss"
				? "Face the guardian"
				: next.kind === "gauntlet"
					? "Train"
					: next.kind === "review"
						? "Review"
						: "Play";
	return (
		<section
			className="panel relative flex flex-col gap-4 overflow-hidden p-5"
			style={{
				background:
					"radial-gradient(60% 90% at 90% 20%, color-mix(in oklab, var(--lantern) 26%, transparent), transparent 70%), var(--card)",
			}}
			aria-label="Next up"
		>
			<div className="flex items-start gap-3">
				<Wick
					className="h-[58px] w-12 shrink-0"
					mood={next.kind === "done" ? "cheering" : "idle"}
				/>
				<div className="min-w-0">
					<div className="kicker text-(--syn-keyword)">Next up</div>
					<div className="font-display text-2xl leading-tight">
						{next.label}
					</div>
					{chapter ? (
						<p className="text-sm text-muted-foreground">{chapter.subtitle}</p>
					) : null}
				</div>
			</div>
			{link ? (
				<Button
					asChild
					size="lg"
					className="w-full"
					variant={
						next.kind === "boss" || next.kind === "gauntlet"
							? "danger"
							: next.kind === "review"
								? "info"
								: "default"
					}
				>
					<Link {...link} onClick={() => sfx("tap")}>
						<GameIcon
							name={
								next.kind === "boss"
									? "skull"
									: next.kind === "review"
										? "dumbbell"
										: "play"
							}
							data-icon="inline-start"
						/>
						{cta}
					</Link>
				</Button>
			) : null}
		</section>
	);
}
