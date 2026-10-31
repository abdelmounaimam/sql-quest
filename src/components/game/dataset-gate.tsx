import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sqlClient } from "#/engine/sql/client";
import { datasetById } from "#/lib/content";
import { Wick } from "./icons";

const fmt = new Intl.NumberFormat("en-US");

/**
 * Themed loading state while a dataset's Postgres base is built (first
 * visit) or restored from the IndexedDB snapshot (next visits). The time is
 * measured and kept per dataset (localStorage "sqlq-warm-ms:<id>").
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
	const warm = useQuery({
		queryKey: ["warm", datasetId, setupSql ?? ""],
		queryFn: async () => {
			const ms = await sqlClient().warm(datasetId, setupSql);
			if (ms > 0) {
				try {
					localStorage.setItem(`sqlq-warm-ms:${datasetId}`, String(ms));
				} catch {
					// ignore
				}
				console.info(`[sql] ${datasetId} ready in ${ms} ms`);
			}
			return ms;
		},
		staleTime: Number.POSITIVE_INFINITY,
		retry: 1,
		enabled: !already,
	});
	const [elapsed, setElapsed] = useState(0);
	useEffect(() => {
		if (already || warm.isSuccess) return;
		const t0 = performance.now();
		const id = window.setInterval(
			() => setElapsed(performance.now() - t0),
			100,
		);
		return () => window.clearInterval(id);
	}, [already, warm.isSuccess]);

	if (already || warm.isSuccess) return <>{children}</>;

	const previous = (() => {
		try {
			return Number(localStorage.getItem(`sqlq-warm-ms:${datasetId}`) ?? 0);
		} catch {
			return 0;
		}
	})();

	return (
		<section
			className="grid min-h-dvh place-items-center px-6"
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
							transform: `scaleX(${previous ? Math.min(0.95, elapsed / previous) : Math.min(0.9, 1 - Math.exp(-elapsed / 2500))})`,
							transition: "transform 100ms linear",
						}}
					/>
				</div>
				<p className="text-sm font-bold text-muted-foreground tabular">
					{warm.isError
						? `The vault would not open: ${(warm.error as Error).message}`
						: `${(elapsed / 1000).toFixed(1)} s · ${
								previous
									? "opening the saved vault"
									: "first visit: Postgres builds the vault, next time it opens instantly"
							}`}
				</p>
				{previous ? (
					<p className="text-xs text-muted-foreground">
						Last build took {fmt.format(previous)} ms
					</p>
				) : null}
			</div>
		</section>
	);
}
