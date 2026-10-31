import {
	createFileRoute,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { AppEffects } from "#/components/game/app-effects";
import { Hud, TabBar } from "#/components/game/hud";
import { IconSprite } from "#/components/game/icons";
import { Onboarding } from "#/components/game/onboarding";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
import { useGame } from "#/game/progress";
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
	const desktop = useMediaQuery("(min-width: 768px)", true);
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
					<main
						className={
							inLevel
								? "flex min-h-0 flex-1 flex-col"
								: "flex min-h-0 flex-1 flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0"
						}
					>
						<Outlet />
					</main>
					{inLevel ? null : <TabBar />}
				</div>
				{profile ? null : <Onboarding />}
				<Toaster
					position={desktop ? "bottom-right" : "top-center"}
					duration={3500}
					offset={{ top: "calc(12px + env(safe-area-inset-top))" }}
				/>
			</TooltipProvider>
		</MotionConfig>
	);
}
