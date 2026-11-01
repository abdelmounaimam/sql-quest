import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sqlClient } from "#/engine/sql/client";
import { hasSnapshot, snapshotKey } from "#/engine/sql/snapshots";
import { datasetById } from "#/lib/content";
import { Button } from "../ui/button";
import { Wick } from "./icons";

const fmt = new Intl.NumberFormat("en-US");

/** After this long (or 2.5x the usual time) the gate offers a restart. */
const SLOW_MS = 15000;

type Mode = "restore" | "build";

function readMs(datasetId: string, mode: Mode): number {
	try {
		return Number(
			localStorage.getItem(`sqlq-warm-ms:${datasetId}:${mode}`) ?? 0,
		);
	} catch {
		return 0;
	}
}

function writeMs(datasetId: string, mode: Mode, ms: number) {
	try {
		localStorage.setItem(`sqlq-warm-ms:${datasetId}:${mode}`, String(ms));
	} catch {
		// private mode: estimates just stay generic
	}
}

/**
 * Themed loading state while a dataset's Postgres base is built (first
 * visit) or restored from the IndexedDB snapshot (next visits). Whether a
 * snapshot exists is checked up front, so the screen says which of the two
 * is happening, and the estimate comes from the last time of that same kind
 * (localStorage "sqlq-warm-ms:<id>:restore|build"). A load that stalls
 * offers a restart of the SQL engine instead of spinning forever.
 */
export function DatasetGate({
	datasetId,
	setupSql,
	children,
}: {
	datasetId: string;
	setupSql?: string;
	children: React.ReactNode;
}) {
	const dataset = datasetById.get(datasetId);
	const already =
		typeof window !== "undefined" && sqlClient().isWarm(datasetId, setupSql);
	const saved = useQuery({
		queryKey: ["snapshot-saved", datasetId],
		queryFn: async () =>
			dataset ? hasSnapshot(await snapshotKey(dataset)) : false,
		enabled: !already && !!dataset,
		staleTime: 0,
		gcTime: 0,
		retry: false,
	});
	const mode: Mode | undefined = saved.isSuccess
		? saved.data
			? "restore"
			: "build"
		: undefined;
	const warm = useQuery({
		queryKey: ["warm", datasetId, setupSql ?? ""],
		queryFn: async () => {
			const restoring = saved.data === true;
			const ms = await sqlClient().warm(datasetId, setupSql);
			if (ms > 0) {
				writeMs(datasetId, restoring ? "restore" : "build", ms);
				console.info(
					`[sql] ${datasetId} ready in ${ms} ms (${restoring ? "saved copy" : "first build"})`,
				);
			}
			return ms;
		},
		staleTime: Number.POSITIVE_INFINITY,
		// Forget the result once the gate unmounts: the worker may have dropped
		// this base since (LRU, restart), and sqlClient().isWarm() is the truth.
		gcTime: 0,
		retry: 1,
		// Wait for the snapshot check (a few ms) so the timing is filed right.
		enabled: !already && (saved.isFetched || !dataset),
	});
	const [attempt, setAttempt] = useState(0);
	const [elapsed, setElapsed] = useState(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: restart the clock on each attempt
	useEffect(() => {
		if (already || warm.isSuccess) return;
		const t0 = performance.now();
		setElapsed(0);
		const id = window.setInterval(
			() => setElapsed(performance.now() - t0),
			100,
		);
		return () => window.clearInterval(id);
	}, [already, warm.isSuccess, attempt]);

	if (already || warm.isSuccess) return <>{children}</>;

	const previous = mode ? readMs(datasetId, mode) : 0;
	const slow = elapsed > Math.max(SLOW_MS, previous * 2.5);
	const restart = () => {
		sqlClient().restart();
		setAttempt((a) => a + 1);
		void warm.refetch();
	};

	return (
		<section
			className="grid min-h-dvh place-items-center px-6 pt-safe pb-safe"
			aria-live="polite"
			aria-label="Loading the dataset"
		>
			<div className="flex max-w-sm flex-col items-center gap-4 text-center">
				<Wick mood="thinking" className="h-24 w-20" />
				<div className="kicker text-(--syn-keyword)">Lighting the lantern</div>
				<h1 className="font-display text-title leading-none">
					{dataset?.name ?? datasetId}
				</h1>
				{dataset?.tagline ? (
					<p className="text-muted-foreground">{dataset.tagline}</p>
				) : null}
				<div className="xp-track h-3 w-64">
					<i
						className="!bg-lantern"
						style={{
							transform: `scaleX(${previous ? Math.min(0.95, elapsed / previous) : Math.min(0.9, 1 - Math.exp(-elapsed / 4000))})`,
							transition: "transform 100ms linear",
						}}
					/>
				</div>
				<p className="text-sm font-bold text-muted-foreground tabular">
					{warm.isError
						? `The data would not load: ${(warm.error as Error).message}`
						: `${(elapsed / 1000).toFixed(1)} s · ${
								mode === "restore"
									? "opening the saved copy of the data"
									: mode === "build"
										? "first visit: Postgres builds the tables and saves a copy, so next time is faster"
										: "checking for a saved copy"
							}`}
				</p>
				{previous && !warm.isError ? (
					<p className="text-xs text-muted-foreground">
						Usually takes about {fmt.format(Math.round(previous / 100) / 10)} s
						on this device
					</p>
				) : null}
				{warm.isError || slow ? (
					<div className="flex flex-col items-center gap-2">
						{warm.isError ? null : (
							<p className="text-sm text-muted-foreground">
								This is taking longer than usual.
							</p>
						)}
						<Button type="button" variant="secondary" onClick={restart}>
							Restart the SQL engine
						</Button>
					</div>
				) : null}
			</div>
		</section>
	);
}
