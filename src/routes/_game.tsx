import {
	createFileRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { AppEffects } from "#/components/game/app-effects";
import { Hud, LeftRail, TabBar } from "#/components/game/hud";
import { GameIcon, IconSprite } from "#/components/game/icons";
import { Onboarding } from "#/components/game/onboarding";
import { activityLink } from "#/components/game/world-map";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
import { useGame, useProgress } from "#/game/progress";
import { SyncAgent } from "#/game/sync";
import { useMediaQuery } from "#/hooks/use-media";

/**
 * Game shell. Client only (ssr: false): PGlite, localStorage collections and
 * the game store all live in the browser.
 */
export const Route = createFileRoute("/_game")({
	ssr: false,
	component: GameLayout,
});

function GameLayout() {
	const profile = useGame((s) => s.profile);
	const motionPref = useGame((s) => s.settings.reducedMotion);
	// Inside a level (lesson, mission, gate, boss, complete) the level HUD replaces the top bar.
	const inLevel = useRouterState({
		select: (s) =>
			s.location.pathname.startsWith("/play/") &&
			(s.location.search as { phase?: string }).phase !== "hub",
	});
	// Toasts go bottom-right only on real desktops; a phone in landscape (393px
	// tall) keeps them top-center, clear of the verdict sheet and the Cast bar.
	const desktop = useMediaQuery(
		"(min-width: 768px) and (min-height: 600px)",
		true,
	);
	return (
		<MotionConfig
			reducedMotion={
				motionPref === "reduce"
					? "always"
					: motionPref === "full"
						? "never"
						: "user"
			}
		>
			<TooltipProvider delayDuration={400} skipDelayDuration={0}>
				<IconSprite />
				<AppEffects />
				<SyncAgent />
				<div className="relative flex min-h-dvh flex-col">
					{inLevel ? null : <Hud />}
					<div
						className={
							inLevel
								? "flex min-h-0 flex-1 flex-col"
								: "flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)]"
						}
					>
						{inLevel ? null : <LeftRail practice={<PracticeLink />} />}
						<main
							className={
								inLevel
									? "flex min-h-0 flex-1 flex-col"
									: "flex min-h-0 min-w-0 flex-1 flex-col pb-[calc(64px+var(--safe-bottom))] phone-land:pb-safe md:pb-0"
							}
						>
							<Outlet />
						</main>
					</div>
					{inLevel ? null : <TabBar />}
				</div>
				{profile ? null : <Onboarding />}
				<Toaster
					position={desktop ? "bottom-right" : "top-center"}
					duration={3500}
					offset={{
						top: "calc(12px + var(--safe-top))",
						right: "calc(24px + var(--safe-right))",
						bottom: "calc(24px + var(--safe-bottom))",
						left: "calc(24px + var(--safe-left))",
					}}
					mobileOffset={{
						top: "calc(12px + var(--safe-top))",
						left: "calc(16px + var(--safe-left))",
						right: "calc(16px + var(--safe-right))",
					}}
				/>
			</TooltipProvider>
		</MotionConfig>
	);
}

/** Rail entry to the next drill or fading review, when one is due. */
function PracticeLink() {
	const progress = useProgress();
	const next = progress.next;
	const review = progress.reviews[0];
	const link =
		next.kind === "gauntlet" || next.kind === "review"
			? activityLink(next)
			: review
				? {
						to: "/play/$chapterId" as const,
						params: { chapterId: review.chapterId },
						search: {
							phase: "mission" as const,
							ex: review.exerciseId,
							review: true,
						},
					}
				: null;
	if (!link) return null;
	return (
		<Link
			{...link}
			className="flex h-12 items-center gap-3 rounded-lg px-4 text-[15px] font-extrabold text-info-soft-foreground hover:bg-accent"
		>
			<GameIcon name="dumbbell" className="size-6" />
			Practice
			<span
				className="ml-auto size-2 rounded-full bg-info"
				role="img"
				aria-label="due"
			/>
		</Link>
	);
}
