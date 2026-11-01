import { useLiveQuery } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	createColumnHelper,
	createSortedRowModel,
	rowSortingFeature,
	sortFn_alphanumeric,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { motion } from "motion/react";
import { useMemo } from "react";
import { GameIcon } from "#/components/game/icons";
import { SkillRadar } from "#/components/game/skill-radar";
import { Splash } from "#/components/game/splash";
import { StarRow } from "#/components/game/stars";
import {
	ACHIEVEMENTS,
	conceptRadar,
	levelFromXp,
	skillRadar,
	starsFor,
} from "#/engine/adaptive";
import { leaderboardCollection } from "#/game/collections";
import { type Progress, useGame, useProgress } from "#/game/progress";
import { chapters, conceptName, findExercise } from "#/lib/content";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_game/profile")({
	ssr: false,
	component: ProfilePage,
});

function ProfilePage() {
	const progress = useProgress();
	const s = useGame((x) => x);
	if (!progress.ready) return <Splash />;
	const lv = levelFromXp(s.xp);
	const real = progress.attempts.filter((a) => a.kind !== "lesson-try");
	const solved = new Set(real.filter((a) => a.solved).map((a) => a.exerciseId))
		.size;
	const threeStars = new Set(
		real.filter((a) => starsFor(a) === 3).map((a) => a.exerciseId),
	).size;
	const seenConcepts = Object.keys(progress.mastery).filter(
		(c) => progress.mastery[c].attempts > 0,
	);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-6 pb-16 sm:px-6">
			<motion.section
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="panel flex flex-wrap items-center gap-5 p-5"
			>
				<div className="grid size-20 place-items-center rounded-3xl bg-reward text-5xl shadow-md">
					{s.profile?.avatar ?? "🦊"}
				</div>
				{/* min-w: the stats wrap below instead of crushing the name column. */}
				<div className="min-w-48 flex-1">
					<h1 className="font-display text-3xl text-foreground">
						{s.profile?.name ?? "Explorer"}
					</h1>
					<p className="text-sm text-muted-foreground">
						Level {lv.level} · {s.xp} XP · best combo x{s.bestCombo} ·{" "}
						{s.streak} day streak
					</p>
					<p className="font-mono text-[11px] text-muted-foreground">
						{s.lastSyncAt
							? `Synced ${new Date(s.lastSyncAt).toLocaleString()}`
							: "Not synced yet (offline first)"}
					</p>
				</div>
				<div className="grid w-full grid-cols-3 gap-2 text-center sm:w-auto">
					<Stat label="Solved" value={solved} />
					<Stat label="3 stars" value={threeStars} />
					<Stat label="Badges" value={Object.keys(s.achievements).length} />
				</div>
			</motion.section>

			<div className="grid gap-6 lg:grid-cols-2">
				<section className="panel p-5">
					<h2 className="mb-3 font-display text-lg text-foreground">
						Skill radar
					</h2>
					<div className="grid place-items-center">
						<SkillRadar points={skillRadar(chapters, progress.mastery)} />
					</div>
					{seenConcepts.length >= 3 ? (
						<>
							<h3 className="mt-4 mb-2 text-xs font-bold tracking-widest text-muted-foreground uppercase">
								Concepts
							</h3>
							<div className="grid place-items-center">
								<SkillRadar
									points={conceptRadar(
										seenConcepts.slice(0, 10),
										progress.mastery,
									)}
									label={conceptName}
									size={300}
								/>
							</div>
						</>
					) : null}
				</section>
				<section className="panel p-5">
					<h2 className="mb-3 font-display text-lg text-foreground">
						Achievements
					</h2>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{ACHIEVEMENTS.map((a) => {
							const got = !!s.achievements[a.id];
							return (
								<div
									key={a.id}
									className={cn(
										"rounded-xl border p-3 text-center",
										got
											? "border-lantern/60 bg-accent"
											: "border-border opacity-45 grayscale",
									)}
									title={a.description}
								>
									<div className="text-3xl">{a.emoji}</div>
									<div className="mt-1 text-xs font-bold text-foreground">
										{a.name}
									</div>
									<div className="text-[10px] text-muted-foreground">
										{a.description}
									</div>
								</div>
							);
						})}
					</div>
				</section>
			</div>

			<ConceptTable progress={progress} />
			<HistoryTable progress={progress} />
			<Leaderboard />
		</div>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl bg-muted px-3 py-2">
			<div className="font-display text-xl text-foreground">{value}</div>
			<div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
				{label}
			</div>
		</div>
	);
}

const features = tableFeatures({
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	sortFns: { alphanumeric: sortFn_alphanumeric },
});

type ConceptRow = {
	id: string;
	name: string;
	mastery: number;
	attempts: number;
	failures: number;
	hints: number;
	review: boolean;
};
const ch = createColumnHelper<typeof features, ConceptRow>();
const conceptColumns = ch.columns([
	ch.accessor("name", { header: "Concept", sortFn: "alphanumeric" }),
	ch.accessor("mastery", {
		header: "Mastery",
		cell: (c) => (
			<div className="flex items-center gap-2">
				<div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
					<div
						className="h-full rounded-full bg-success"
						style={{ width: `${c.getValue() * 100}%` }}
					/>
				</div>
				<span className="font-mono text-xs">
					{Math.round(c.getValue() * 100)}%
				</span>
			</div>
		),
	}),
	ch.accessor("attempts", { header: "Attempts" }),
	ch.accessor("failures", { header: "Failed tries" }),
	ch.accessor("hints", { header: "Hints" }),
	ch.accessor("review", {
		header: "Status",
		cell: (c) =>
			c.getValue() ? (
				<span className="rounded bg-info px-1.5 text-[11px] font-bold text-info-foreground">
					review
				</span>
			) : null,
	}),
]);

function SortableTable({
	table,
	empty,
}: {
	// biome-ignore lint/suspicious/noExplicitAny: generic table instance
	table: any;
	empty: string;
}) {
	const rows = table.getRowModel().rows;
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-left text-sm">
				<thead>
					{/* biome-ignore lint/suspicious/noExplicitAny: header groups */}
					{table.getHeaderGroups().map((g: any) => (
						<tr key={g.id} className="border-b border-border">
							{/* biome-ignore lint/suspicious/noExplicitAny: headers */}
							{g.headers.map((h: any) => {
								const sorted = h.column.getIsSorted?.();
								return (
									<th
										key={h.id}
										className="px-3 py-2 text-[11px] font-bold tracking-wide whitespace-nowrap text-muted-foreground uppercase"
									>
										<button
											type="button"
											onClick={h.column.getToggleSortingHandler?.()}
											className="inline-flex items-center gap-1 hover:text-foreground"
										>
											<table.FlexRender header={h} />
											{sorted === "asc" ? (
												<GameIcon name="arrow-up" className="size-3" />
											) : sorted === "desc" ? (
												<GameIcon name="arrow-down" className="size-3" />
											) : null}
										</button>
									</th>
								);
							})}
						</tr>
					))}
				</thead>
				<tbody>
					{/* biome-ignore lint/suspicious/noExplicitAny: rows */}
					{rows.map((r: any) => (
						<tr key={r.id} className="border-b border-border/50 last:border-0">
							{/* biome-ignore lint/suspicious/noExplicitAny: cells */}
							{r.getAllCells().map((c: any) => (
								<td key={c.id} className="px-3 py-2 text-foreground">
									<table.FlexRender cell={c} />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			{rows.length === 0 ? (
				<p className="p-4 text-center text-sm text-muted-foreground">{empty}</p>
			) : null}
		</div>
	);
}

function ConceptTable({ progress }: { progress: Progress }) {
	const data = useMemo<ConceptRow[]>(
		() =>
			Object.values(progress.mastery)
				.filter((m) => m.attempts > 0)
				.map((m) => ({
					id: m.conceptId,
					name: conceptName(m.conceptId),
					mastery: m.effective,
					attempts: m.attempts,
					failures: m.totalFailures,
					hints: m.totalHints,
					review: m.needsReview,
				})),
		[progress.mastery],
	);
	const table = useTable({
		features,
		columns: conceptColumns,
		data,
		initialState: { sorting: [{ id: "mastery", desc: false }] },
	});
	return (
		<section className="panel p-5">
			<h2 className="mb-3 font-display text-lg text-foreground">
				Concept stats
			</h2>
			<SortableTable table={table} empty="Play a mission to see your stats." />
		</section>
	);
}

type HistoryRow = {
	id: string;
	when: number;
	title: string;
	kind: string;
	stars: number;
	time: number;
	fails: number;
	hints: number;
};
const hh = createColumnHelper<typeof features, HistoryRow>();
const historyColumns = hh.columns([
	hh.accessor("when", {
		header: "When",
		cell: (c) => (
			<span className="font-mono text-xs">
				{new Date(c.getValue()).toLocaleString()}
			</span>
		),
	}),
	hh.accessor("title", { header: "Mission", sortFn: "alphanumeric" }),
	hh.accessor("kind", { header: "Kind", sortFn: "alphanumeric" }),
	hh.accessor("stars", {
		header: "Stars",
		cell: (c) => <StarRow stars={c.getValue()} />,
	}),
	hh.accessor("time", {
		header: "Time",
		cell: (c) => (
			<span className="font-mono text-xs">
				{Math.round(c.getValue() / 1000)}s
			</span>
		),
	}),
	hh.accessor("fails", { header: "Fails" }),
	hh.accessor("hints", { header: "Hints" }),
]);

function HistoryTable({ progress }: { progress: Progress }) {
	const data = useMemo<HistoryRow[]>(
		() =>
			progress.attempts
				.filter((a) => a.kind !== "lesson-try")
				.map((a) => ({
					id: a.id,
					when: a.finishedAt,
					title: findExercise(a.exerciseId)?.exercise.title ?? a.exerciseId,
					kind: a.kind,
					stars: starsFor(a),
					time: a.timeToSolveMs,
					fails: a.failedSubmissions,
					hints: a.hintsUsed,
				})),
		[progress.attempts],
	);
	const table = useTable({
		features,
		columns: historyColumns,
		data,
		initialState: { sorting: [{ id: "when", desc: true }] },
	});
	return (
		<section className="panel p-5">
			<h2 className="mb-3 font-display text-lg text-foreground">
				Attempt history
			</h2>
			<SortableTable table={table} empty="No attempts yet." />
		</section>
	);
}

function Leaderboard() {
	const qc = useQueryClient();
	const me = useGame((s) => s.profile?.id);
	const { data, isLoading } = useLiveQuery({
		query: (q) => q.from({ r: leaderboardCollection(qc) }),
	});
	const rows = [...(data ?? [])].sort((a, b) => b.xp - a.xp);
	return (
		<section className="panel p-5">
			<h2 className="mb-3 flex items-center gap-2 font-display text-lg text-foreground">
				<GameIcon name="trophy" className="size-5 text-(--syn-keyword)" />{" "}
				Leaderboard
			</h2>
			{isLoading ? (
				<p className="text-sm text-muted-foreground">Loading…</p>
			) : rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					Offline or nobody synced yet.
				</p>
			) : (
				<ol className="space-y-1.5">
					{rows.map((r, i) => (
						<li
							key={r.id}
							className={cn(
								"flex items-center gap-3 rounded-xl px-3 py-2",
								r.id === me ? "bg-accent" : "bg-muted",
							)}
						>
							<span className="w-6 font-display text-muted-foreground">
								{i + 1}
							</span>
							<span className="text-xl">{r.avatar}</span>
							<span className="flex-1 truncate font-semibold text-foreground">
								{r.name}
							</span>
							<span className="font-mono text-xs text-muted-foreground">
								lvl {r.level} · {r.solved} solved
							</span>
							<span className="font-display text-xp-text tabular">{r.xp}</span>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
