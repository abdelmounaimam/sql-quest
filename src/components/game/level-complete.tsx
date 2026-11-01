import { useEffect, useState } from "react";
import type { Chapter } from "#/content/types";
import { MASTERY_THRESHOLD, xpForAttempt } from "#/engine/adaptive";
import type { ChapterStatus } from "#/engine/adaptive/types";
import type { Progress } from "#/game/progress";
import { haptic, sfx } from "#/game/sound";
import { conceptName, worldOfChapter } from "#/lib/content";
import { cn } from "#/lib/utils";
import { Button } from "../ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "../ui/dialog";
import { burst, prefersReducedMotion } from "./fx";
import { GameIcon, StarGlyph, Wick } from "./icons";
import { CountUp } from "./verdict";

function formatTime(ms: number) {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Concept chips shown before collapsing the rest into "+N". */
const MAX_CHIPS = 2;

/** Level complete: the one "big" moment. Stars land one by one, stats count up. */
export function LevelComplete({
	chapter,
	status,
	progress,
	onMap,
	onNextLevel,
}: {
	chapter: Chapter;
	status: ChapterStatus;
	progress: Progress;
	onMap: () => void;
	onNextLevel?: () => void;
}) {
	const [skipped, setSkipped] = useState(false);
	const world = worldOfChapter(chapter.id);
	const values: number[] = chapter.exercises.map(
		(e) => status.stars[e.id] ?? 0,
	);
	const stars = Math.round(
		values.reduce((a, b) => a + b, 0) / Math.max(1, values.length),
	);
	const attempts = progress.attempts.filter(
		(a) => a.chapterId === chapter.id && a.kind !== "lesson-try",
	);
	const xp = attempts.reduce((s, a) => s + xpForAttempt(a, 1).total, 0);
	const solved = attempts.filter((a) => a.solved && !a.revealed).length;
	const fails = attempts.reduce((s, a) => s + a.failedSubmissions, 0);
	const accuracy = Math.round((solved / Math.max(1, solved + fails)) * 100);
	const time = attempts.reduce((s, a) => s + a.timeToSolveMs, 0);
	// Only concepts actually practised, with learned mastery (what the gate
	// uses): never a row of "0%" that reads as "you learned nothing".
	const concepts = chapter.concepts
		.map((c) => ({ id: c, m: progress.mastery[c] }))
		.filter((c) => (c.m?.attempts ?? 0) > 0)
		.sort((a, b) => (b.m?.mastery ?? 0) - (a.m?.mastery ?? 0));
	const shownConcepts = concepts.slice(0, MAX_CHIPS);
	const moreConcepts = concepts.length - shownConcepts.length;

	useEffect(() => {
		sfx("levelup");
		haptic("levelComplete");
		burst("big");
		if (prefersReducedMotion()) return;
		const timers = [0, 1, 2]
			.filter((i) => i < stars)
			.map((i) =>
				window.setTimeout(
					() => {
						sfx("star", i);
						haptic("star");
					},
					300 + i * 220,
				),
			);
		return () => {
			for (const t of timers) window.clearTimeout(t);
		};
	}, [stars]);

	return (
		<div className="lc-overlay relative grid min-h-dvh place-items-center overflow-hidden px-4 pt-36 pb-10">
			<Dialog open modal={false}>
				<DialogContent
					showCloseButton={false}
					onInteractOutside={(e) => e.preventDefault()}
					onPointerDown={() => setSkipped(true)}
					// A full-screen scroller, the card centered in it: on a short screen
					// (phone in landscape) the card scrolls instead of running off the
					// bottom with its buttons, and the stars above it are never clipped.
					// Flex column (not the dialog's grid): an auto grid track grew to
					// the card's max-content and pushed it 31px past a 393px phone.
					className="!inset-0 !top-0 !left-0 !flex !max-h-none !w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col !gap-0 !rounded-none !border-0 !bg-transparent !px-safe-4 !pt-safe-24 !pb-safe-6 !shadow-none [@media(min-height:760px)]:!pt-safe-28"
					data-world={world}
				>
					<div className="relative mx-auto my-auto w-full max-w-[440px] min-w-0 rounded-2xl border-2 bg-card px-5 pt-14 pb-5 text-center shadow-[0_8px_0_var(--ledge),0_30px_60px_-20px_rgb(0_0_0/0.6)]">
						<div
							className={cn(
								"big-stars",
								skipped && "[&_.lit]:![animation:none]",
							)}
							role="img"
							aria-label={`${stars} of 3 stars`}
						>
							{[0, 1, 2].map((i) => (
								<StarGlyph
									key={i}
									filled={i < stars}
									className={cn(i === 1 && "s2", i < stars && "lit")}
								/>
							))}
						</div>
						<div className="lc-ribbon">
							<span>Chapter cleared</span>
						</div>
						<DialogTitle className="mt-2 text-center text-[clamp(26px,8vw,34px)] leading-tight text-balance">
							{chapter.title}
						</DialogTitle>
						<DialogDescription className="mt-1.5 text-center text-[15px]">
							{chapter.subtitle}
						</DialogDescription>
						<div className={cn("lc-stats my-4", time < 1000 && "lc-stats-2")}>
							<div className="lc-stat xp">
								<div className="h">XP</div>
								<div className="v">
									<GameIcon name="zap" />
									<CountUp to={xp} delay={skipped ? 0 : 1.05} />
								</div>
							</div>
							<div className="lc-stat acc">
								<div className="h">Accuracy</div>
								<div className="v">
									<GameIcon name="target" />
									<CountUp to={accuracy} delay={skipped ? 0 : 1.05} />%
								</div>
							</div>
							{time >= 1000 ? (
								<div className="lc-stat time">
									<div className="h">Time</div>
									<div className="v">
										<GameIcon name="clock" />
										{formatTime(time)}
									</div>
								</div>
							) : null}
						</div>
						{shownConcepts.length ? (
							<div className="mb-4 flex flex-wrap justify-center gap-1.5">
								{shownConcepts.map(({ id, m }) => {
									const solid = (m?.mastery ?? 0) >= MASTERY_THRESHOLD;
									return (
										<span
											key={id}
											className={cn(
												"inline-flex max-w-full items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-extrabold",
												solid
													? "bg-success-soft text-success-soft-foreground"
													: "bg-secondary text-foreground",
											)}
										>
											{solid ? (
												<GameIcon name="check" className="size-3 shrink-0" />
											) : null}
											<span className="truncate">{conceptName(id)}</span>
											{solid
												? null
												: ` ${Math.round((m?.mastery ?? 0) * 100)}%`}
										</span>
									);
								})}
								{moreConcepts > 0 ? (
									<span className="rounded-sm bg-secondary px-2 py-0.5 text-xs font-extrabold text-muted-foreground">
										+{moreConcepts}
									</span>
								) : null}
							</div>
						) : null}
						<div className="flex flex-col gap-1.5">
							<Button size="xl" onClick={onNextLevel ?? onMap} autoFocus>
								{onNextLevel ? "Next level" : "Continue"}
							</Button>
							<Button variant="ghost" onClick={onMap}>
								<GameIcon name="map" data-icon="inline-start" />
								{stars < 3
									? "Back to the map, replay for 3 stars"
									: "Back to the map"}
							</Button>
						</div>
						<Wick mood="cheering" className="wick-cheer" />
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
