import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { AppEffects } from "#/components/game/app-effects";
import { Hud } from "#/components/game/hud";
import { Onboarding } from "#/components/game/onboarding";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
import { useGame } from "#/game/progress";
import { SyncAgent } from "#/game/sync";

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
			<TooltipProvider delayDuration={300}>
				<AppEffects />
				<SyncAgent />
				<div className="relative z-10 flex min-h-dvh flex-col">
					<Hud />
					<main className="flex min-h-0 flex-1 flex-col">
						<Outlet />
					</main>
				</div>
				{profile ? null : <Onboarding />}
				<Toaster position="top-center" richColors />
			</TooltipProvider>
		</MotionConfig>
	);
}
