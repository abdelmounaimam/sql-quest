import { Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Chapter } from "#/content/types";
import type { ChapterStatus, NextActivity } from "#/engine/adaptive/types";
import type { Progress } from "#/game/progress";
import { haptic, sfx } from "#/game/sound";
import { useMediaQuery } from "#/hooks/use-media";
import {
	chapterById,
	conceptName,
	isSideQuest,
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
const ROW = 116;
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
type NodeKind = "normal" | "boss" | "review" | "side";

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

/** What the map looked like last time (to play unlock and walk sequences once). */
interface MapMemory {
	states: Record<string, NodeState>;
	current: string | null;
	openWorlds: number[];
}
const MEMORY_KEY = "sqlq-map-memory";
function readMemory(): MapMemory | null {
	try {
		const raw = localStorage.getItem(MEMORY_KEY);
		return raw ? (JSON.parse(raw) as MapMemory) : null;
	} catch {
		return null;
	}
}

function nodeState(
	ch: Chapter,
	st: ChapterStatus | undefined,
	current: string | null,
): NodeState {
	const stars = averageStars(ch, st);
	return !st || st.state === "locked"
		? "locked"
		: st.state === "complete"
			? stars >= 3
				? "perfect"
				: "completed"
			: current === ch.id
				? "current"
				: "available";
}

export function WorldMap({ progress }: { progress: Progress }) {
	const { statuses, next, reviews } = progress;
	const current = activityChapter(next);
	const currentRef = useRef<HTMLDivElement | null>(null);
	const [offscreen, setOffscreen] = useState(false);
	// Snapshot of the previous visit, read once on mount.
	const [memory] = useState(readMemory);

	const reviewByChapter = useMemo(() => {
		const m = new Map<string, Progress["reviews"]>();
		for (const r of reviews)
			m.set(r.chapterId, [...(m.get(r.chapterId) ?? []), r]);
		return m;
	}, [reviews]);

	const nowStates = useMemo(() => {
		const out: Record<string, NodeState> = {};
		for (const w of worlds)
			for (const ch of w.chapters)
				out[ch.id] = nodeState(ch, statuses[ch.id], current);
		return out;
	}, [statuses, current]);
	const openWorlds = worlds
		.filter((w) => w.chapters.some((c) => nowStates[c.id] !== "locked"))
		.map((w) => w.index);

	// Newly unlocked nodes and worlds since the last visit (first visit: none).
	const fresh = useMemo(() => {
		const out = new Set<string>();
		if (!memory) return out;
		for (const [id, st] of Object.entries(nowStates))
			if (st !== "locked" && memory.states[id] === "locked") out.add(id);
		return out;
	}, [memory, nowStates]);
	const freshWorlds = new Set(
		memory
			? openWorlds.filter((w) => !memory.openWorlds.includes(w) && w > 0)
			: [],
	);
	const walkFrom =
		memory?.current && memory.current !== current ? memory.current : null;

	useEffect(() => {
		const save = () => {
			try {
				localStorage.setItem(
					MEMORY_KEY,
					JSON.stringify({
						states: nowStates,
						current,
						openWorlds,
					} satisfies MapMemory),
				);
			} catch {
				// ignore
			}
		};
		// Let the sequences play, then remember the new state.
		const t = window.setTimeout(save, 1600);
		return () => {
			window.clearTimeout(t);
			save();
		};
	}, [nowStates, current, openWorlds]);

	useEffect(() => {
		if (fresh.size === 0 && freshWorlds.size === 0) return;
		const t = window.setTimeout(() => {
			sfx("unlock");
			haptic("unlock");
			currentRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "center",
			});
		}, 400);
		return () => window.clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fresh.size, freshWorlds.size]);

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
						states={nowStates}
						reviewByChapter={reviewByChapter}
						currentRef={currentRef}
						fresh={fresh}
						freshWorld={freshWorlds.has(w.index)}
						walkFrom={walkFrom}
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
	states,
	reviewByChapter,
	currentRef,
	fresh,
	freshWorld,
	walkFrom,
}: {
	world: World;
	startIndex: number;
	statuses: Record<string, ChapterStatus>;
	states: Record<string, NodeState>;
	reviewByChapter: Map<string, Progress["reviews"]>;
	currentRef: React.RefObject<HTMLDivElement | null>;
	fresh: Set<string>;
	freshWorld: boolean;
	walkFrom: string | null;
}) {
	const n = worldNumber(world.index);
	const reduce = useReducedMotion();
	// Phones: a tighter wiggle so side labels fit in 390px.
	const wide = useMediaQuery("(min-width: 640px)", true);
	const sway = wide ? 1 : 0.45;
	const nodes: PlacedNode[] = [];
	let y = TOP;
	let mainIndex = 0;
	world.chapters.forEach((ch) => {
		const st = statuses[ch.id];
		const state = states[ch.id] ?? "locked";
		const side = isSideQuest(ch.id);
		const kind: NodeKind = side
			? "side"
			: st?.state === "boss-ready"
				? "boss"
				: st?.state === "gauntlet"
					? "review"
					: "normal";
		const prevMain = [...nodes].reverse().find((p) => p.kind !== "side");
		if (side) {
			// Side quest: branches off the previous main node, dashed, never on the road.
			// Branch away from the anchor's label (labels sit toward the center line).
			const anchorX = prevMain?.x ?? CENTER;
			const dir = anchorX > CENTER ? 1 : -1;
			nodes.push({
				chapter: ch,
				status: st,
				x: Math.min(COLUMN + 40, Math.max(-40, anchorX + dir * 130 * sway)),
				y: (prevMain?.y ?? y) + ROW * 0.62,
				state,
				kind,
				stars: averageStars(ch, st),
			});
			y += ROW * 0.45;
			return;
		}
		if (mainIndex > 0) y += kind === "boss" ? BOSS_ROW : ROW;
		nodes.push({
			chapter: ch,
			status: st,
			x: CENTER + X_OFFSETS[(startIndex + mainIndex) % X_OFFSETS.length] * sway,
			y,
			state,
			kind,
			stars: averageStars(ch, st),
		});
		mainIndex++;
	});
	const height = Math.max(...nodes.map((p) => p.y)) + BOTTOM;
	const main = nodes.filter((p) => p.kind !== "side");
	const traveledUntil = (() => {
		const idx = main.findIndex((p) => p.state === "current");
		if (idx >= 0) return idx;
		let last = -1;
		main.forEach((p, i) => {
			if (p.state === "completed" || p.state === "perfect") last = i;
		});
		return last;
	})();
	const pts = main.map((p) => ({ x: p.x, y: p.y }));
	const traveled =
		traveledUntil > 0 ? smoothPath(pts.slice(0, traveledUntil + 1)) : "";
	const ahead = smoothPath(pts.slice(Math.max(0, traveledUntil)));
	const done = nodes.filter(
		(p) => p.state === "completed" || p.state === "perfect",
	).length;
	const locked = nodes.every((p) => p.state === "locked");
	const opensAfter = locked
		? world.chapters[0].prerequisites
				.map((id) => chapterById.get(id)?.title)
				.filter(Boolean)
				.join(" and ")
		: "";

	// Wick walks the road from the previous current node to the new one.
	const cur = main.find((p) => p.state === "current");
	const fromIdx = walkFrom
		? main.findIndex((p) => p.chapter.id === walkFrom)
		: -1;
	const curIdx = cur ? main.indexOf(cur) : -1;
	const walkPath =
		fromIdx >= 0 && curIdx > fromIdx
			? smoothPath(pts.slice(fromIdx, curIdx + 1))
			: "";

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
			<motion.div
				className="unit-banner world-motif"
				data-world={n}
				initial={
					freshWorld && !reduce ? { clipPath: "inset(0 100% 0 0)" } : false
				}
				animate={{ clipPath: "inset(0 0% 0 0)" }}
				transition={{ duration: 0.6, ease: [0.77, 0, 0.175, 1], delay: 0.3 }}
			>
				<div className="min-w-0">
					<div className="wn">
						World {world.index + 1} ·{" "}
						{MOTIF_NAMES[(n - 1) % MOTIF_NAMES.length]}
						{freshWorld ? " · newly unlocked!" : ""}
					</div>
					<h2 id={`world-${world.index}`} className="wt">
						{world.name}
					</h2>
					{locked && opensAfter ? (
						<div className="mt-1 text-xs font-extrabold opacity-85">
							Opens after {opensAfter}
						</div>
					) : null}
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
			</motion.div>
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
						{nodes
							.filter((p) => p.kind === "side")
							.map((p) => {
								const anchor =
									[...main].reverse().find((m) => m.y < p.y) ?? main[0];
								return anchor ? (
									<path
										key={`branch-${p.chapter.id}`}
										d={`M ${anchor.x} ${anchor.y} C ${(anchor.x + p.x) / 2} ${anchor.y}, ${(anchor.x + p.x) / 2} ${p.y}, ${p.x} ${p.y}`}
										fill="none"
										stroke="var(--special)"
										strokeOpacity=".75"
										strokeWidth="4"
										strokeDasharray="8 8"
										strokeLinecap="round"
									/>
								) : null;
							})}
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
							fresh={fresh.has(p.chapter.id)}
						/>
					))}
					{cur ? (
						<WalkingWick target={cur} path={reduce ? "" : walkPath} />
					) : null}
				</div>
			</div>
		</section>
	);
}

/**
 * Wick beside the current node. When the current node moved since the last
 * visit, Wick walks the road: 12 samples from getPointAtLength, WAAPI on
 * transform with a small hop per sample, 700ms per node, then a squash.
 */
function WalkingWick({ target, path }: { target: PlacedNode; path: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const pathRef = useRef<SVGPathElement>(null);
	// Wick rests on the side opposite the node's label.
	const side = target.x > CENTER ? 1 : -1;
	const rest = { x: target.x + side * 70, y: target.y };
	useEffect(() => {
		const el = ref.current;
		const p = pathRef.current;
		if (!el || !p || !path) return;
		const len = p.getTotalLength();
		const steps = 12;
		const frames: Keyframe[] = [];
		for (let i = 0; i <= steps; i++) {
			const pt = p.getPointAtLength((len * i) / steps);
			const hop = i % 2 === 1 ? -6 : 0;
			frames.push({
				transform: `translate(${pt.x - rest.x}px, ${pt.y - rest.y + hop - 30}px)`,
			});
		}
		frames.push({
			transform: "translate(0px, 0px) scale(1.1, 0.9)",
			offset: 0.97,
		});
		frames.push({ transform: "translate(0px, 0px) scale(1, 1)" });
		const nodes = Math.max(1, Math.round(len / ROW));
		const anim = el.animate(frames, {
			duration: 700 * nodes + 120,
			easing: "cubic-bezier(0.77, 0, 0.175, 1)",
			delay: 500,
		});
		return () => anim.cancel();
	}, [path, rest.x, rest.y]);
	return (
		<>
			{path ? (
				<svg
					className="pointer-events-none absolute inset-0 overflow-visible opacity-0"
					width={COLUMN}
					aria-hidden="true"
				>
					<path ref={pathRef} d={path} />
				</svg>
			) : null}
			<div
				ref={ref}
				className="wick-walker"
				style={{ left: rest.x, top: rest.y }}
			>
				<Wick className="h-[58px] w-12" />
			</div>
		</>
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
	if (p.kind === "side")
		return p.state === "completed" || p.state === "perfect"
			? "check"
			: "sparkle";
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
	fresh,
}: {
	node: PlacedNode;
	reviews: Progress["reviews"];
	nodeRef?: React.RefObject<HTMLDivElement | null>;
	/** Unlocked since the last visit: the lock pops off, the node bounces. */
	fresh?: boolean;
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
			: p.kind === "side" && !locked
				? ({
						"--w": "var(--special)",
						"--w-deep": "var(--special-edge)",
						"--w-ink": "var(--special-foreground)",
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
				data-kind={p.kind === "boss" || p.kind === "side" ? p.kind : undefined}
				style={reviewStyle}
				initial={
					reduce ? false : fresh ? { scale: 0.92 } : { opacity: 0, scale: 0.92 }
				}
				whileInView={
					fresh && !reduce
						? { opacity: 1, scale: [0.92, 1.06, 1] }
						: { opacity: 1, scale: 1 }
				}
				viewport={{ once: true, margin: "-40px" }}
				transition={
					fresh
						? { delay: 0.75, duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }
						: { type: "spring", duration: 0.35, bounce: 0.2 }
				}
				aria-label={`${chapter.title}: ${locked ? "locked" : (status?.state ?? "available").replace("-", " ")}`}
			>
				<GameIcon
					name={nodeIcon(p)}
					solid={["play", "crown", "skull", "sparkle"].includes(nodeIcon(p))}
				/>
			</motion.button>
			{locked ? (
				<span className="lockbadge" aria-hidden="true">
					<GameIcon name="lock" />
				</span>
			) : fresh && !reduce ? (
				<motion.span
					className="lockbadge"
					aria-hidden="true"
					initial={{ opacity: 1, y: 0, rotate: 0 }}
					animate={{ opacity: 0, y: -12, rotate: 20 }}
					transition={{ delay: 0.6, duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
				>
					<GameIcon name="lock" />
				</motion.span>
			) : null}
			{p.kind === "side" ? (
				<span className="boss-tag !bg-special !text-special-foreground !shadow-[0_2px_0_var(--special-edge)]">
					◇ SIDE
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
