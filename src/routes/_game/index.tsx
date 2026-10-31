import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Splash } from "#/components/game/splash";
import { NextUpCard, WorldMap } from "#/components/game/world-map";
import { useGame, useProgress } from "#/game/progress";
import { chapters, USING_SAMPLES } from "#/lib/content";

export const Route = createFileRoute("/_game/")({
	ssr: false,
	component: MapPage,
});

function MapPage() {
	const progress = useProgress();
	const name = useGame((s) => s.profile?.name);
	if (!progress.ready) return <Splash />;
	const complete = chapters.filter(
		(c) => progress.statuses[c.id]?.state === "complete",
	).length;

	return (
		<div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="mb-5 flex items-end justify-between gap-3"
			>
				<div>
					<p className="text-sm text-muted-foreground">
						{name ? `Welcome back, ${name}` : "Welcome, explorer"}
					</p>
					<h1 className="font-display text-3xl leading-none text-foreground sm:text-4xl">
						World map
					</h1>
				</div>
				<div className="text-right font-mono text-xs text-muted-foreground">
					{complete}/{chapters.length} levels
					{USING_SAMPLES ? (
						<div className="mt-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-reward">
							dev samples
						</div>
					) : null}
				</div>
			</motion.div>
			<div className="mb-6">
				<NextUpCard progress={progress} />
			</div>
			<WorldMap progress={progress} />
		</div>
	);
}
