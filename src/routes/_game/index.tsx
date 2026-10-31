import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { z } from "zod";
import { GameIcon } from "#/components/game/icons";
import { Splash } from "#/components/game/splash";
import {
	activityLink,
	NextUpCard,
	WorldMap,
} from "#/components/game/world-map";
import { Badge } from "#/components/ui/badge";
import { useGame, useProgress } from "#/game/progress";
import { chapters, conceptName, USING_SAMPLES } from "#/lib/content";

export const Route = createFileRoute("/_game/")({
	ssr: false,
	// ?continue=1 (PWA shortcut "Continue"): jump straight to the next activity.
	validateSearch: z.object({ continue: z.coerce.number().optional() }),
	component: MapPage,
});

function MapPage() {
	const progress = useProgress();
	const name = useGame((s) => s.profile?.name);
	const streak = useGame((s) => s.streak);
	const search = Route.useSearch();
	if (!progress.ready) return <Splash />;
	const next = activityLink(progress.next);
	if (search.continue && next) return <Navigate {...next} replace />;
	const complete = chapters.filter(
		(c) => progress.statuses[c.id]?.state === "complete",
	).length;

	return (
		<div className="mx-auto grid w-full max-w-[1240px] gap-6 px-4 pt-6 pb-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
			<div className="flex min-w-0 flex-col gap-5">
				<div className="flex items-end justify-between gap-3">
					<div>
						<p className="text-sm font-bold text-muted-foreground">
							{name ? `Welcome back, ${name}` : "Welcome, explorer"}
						</p>
						<h1 className="font-display text-title">The Atlas</h1>
					</div>
					<div className="flex flex-col items-end gap-1">
						<Badge variant="outline" className="tabular">
							{complete}/{chapters.length} levels
						</Badge>
						{USING_SAMPLES ? (
							<Badge variant="warning">dev samples</Badge>
						) : null}
					</div>
				</div>
				<div className="lg:hidden">
					<NextUpCard progress={progress} />
				</div>
				<WorldMap progress={progress} />
			</div>
			<aside className="hidden flex-col gap-5 lg:flex lg:sticky lg:top-20 lg:self-start">
				<NextUpCard progress={progress} />
				<section
					className="panel flex items-center gap-4 p-5"
					aria-label="Hearth"
				>
					<span className="grid size-14 place-items-center rounded-2xl bg-warning-soft text-streak">
						<GameIcon name="flame" className="size-8" />
					</span>
					<div>
						<div className="font-display text-3xl leading-none text-streak-text tabular">
							{streak} day{streak === 1 ? "" : "s"}
						</div>
						<p className="text-sm text-muted-foreground">
							{streak > 0
								? "Hearth is lit. Cast once a day to keep it burning."
								: "Cast a spell today to light your hearth."}
						</p>
					</div>
				</section>
				{progress.reviews.length ? (
					<section
						className="panel flex flex-col gap-3 p-5"
						aria-label="Reviews due"
					>
						<div className="kicker text-info-soft-foreground">Fading runes</div>
						{progress.reviews.slice(0, 4).map((r) => (
							<Link
								key={r.conceptId}
								to="/play/$chapterId"
								params={{ chapterId: r.chapterId }}
								search={{ phase: "mission", ex: r.exerciseId, review: true }}
								className="flex items-center gap-3 rounded-lg bg-info-soft px-3 py-2 font-extrabold text-info-soft-foreground no-underline"
							>
								<GameIcon name="dumbbell" />
								{conceptName(r.conceptId)}
							</Link>
						))}
					</section>
				) : null}
			</aside>
		</div>
	);
}
