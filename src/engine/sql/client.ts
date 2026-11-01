import { timeoutRunOutcome, timeoutVerdict } from "#/engine/checker";
import type { JudgeInput, RunInput } from "#/engine/checker/types";
import { datasetById } from "#/lib/content";
import type {
	DatasetDef,
	SqlRequest,
	SqlResponseMap,
	WorkerEnvelope,
	WorkerReply,
} from "./protocol";

/**
 * Main thread client for the PGlite worker.
 * - One request in flight at a time, so the wall clock timer measures only
 *   that request.
 * - Learner SQL gets a short budget (RUN_TIMEOUT_MS). When it is exceeded the
 *   worker is terminated (the only way to stop a runaway WASM query) and a new
 *   one is spawned; queued requests continue on the new worker.
 * - Before running learner SQL the dataset is warmed with a generous budget,
 *   so slow first boots never count as learner timeouts.
 */

export const RUN_TIMEOUT_MS = 6000;
export const JUDGE_TIMEOUT_MS = 12000;
const WARM_TIMEOUT_MS = 120000;

interface Pending {
	request: SqlRequest;
	timeoutMs: number;
	resolve: (v: unknown) => void;
	reject: (e: Error) => void;
	onTimeout?: () => unknown;
	/** Replayed once after the worker reported an unknown dataset. */
	retried?: boolean;
}

type Listener = (s: EngineStatus) => void;
export type EngineStatus = "idle" | "booting" | "busy" | "restarting";

class SqlClient {
	private worker: Worker | null = null;
	private queue: Pending[] = [];
	private current: (Pending & { id: number; timer: number }) | null = null;
	private seq = 0;
	private sentDatasets = new Set<string>();
	private warmed = new Set<string>();
	private listeners = new Set<Listener>();
	status: EngineStatus = "idle";

	subscribe(fn: Listener) {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}

	private setStatus(s: EngineStatus) {
		this.status = s;
		for (const l of this.listeners) l(s);
	}

	private spawn() {
		this.worker = new Worker(new URL("./sql.worker.ts", import.meta.url), {
			type: "module",
			name: "sql-quest-pglite",
		});
		this.sentDatasets.clear();
		this.warmed.clear();
		this.worker.onmessage = (ev: MessageEvent<WorkerReply>) =>
			this.onReply(ev.data);
		this.worker.onerror = (ev) => {
			console.error("[sql worker]", ev.message);
		};
	}

	private onReply(reply: WorkerReply) {
		const cur = this.current;
		if (!cur || cur.id !== reply.id) return;
		window.clearTimeout(cur.timer);
		this.current = null;
		// The worker lost its dataset definitions (a fresh module instance):
		// send them again and replay the request once.
		if (!reply.ok && /Unknown dataset/i.test(reply.error) && !cur.retried) {
			this.sentDatasets.clear();
			this.queue.unshift({ ...cur, retried: true });
			this.pump();
			return;
		}
		if (reply.ok) cur.resolve(reply.result);
		else cur.reject(new Error(reply.error));
		this.pump();
	}

	private pump() {
		if (this.current) return;
		const next = this.queue.shift();
		if (!next) {
			this.setStatus("idle");
			return;
		}
		if (!this.worker) this.spawn();
		const id = ++this.seq;
		const datasetId = datasetOf(next.request);
		const datasets: DatasetDef[] = [];
		if (datasetId && !this.sentDatasets.has(datasetId)) {
			const d = datasetById.get(datasetId);
			if (d)
				datasets.push({
					id: d.id,
					setupSql: d.setupSql,
					extensions: d.extensions,
				});
			this.sentDatasets.add(datasetId);
		}
		const timer = window.setTimeout(() => this.onTimeout(), next.timeoutMs);
		this.current = { ...next, id, timer };
		this.setStatus(next.request.type === "warm" ? "booting" : "busy");
		const env: WorkerEnvelope = { id, datasets, request: next.request };
		this.worker?.postMessage(env);
	}

	private onTimeout() {
		const cur = this.current;
		if (!cur) return;
		this.current = null;
		this.worker?.terminate();
		this.worker = null;
		this.setStatus("restarting");
		if (cur.onTimeout) cur.resolve(cur.onTimeout());
		else
			cur.reject(new Error(`SQL engine timed out after ${cur.timeoutMs} ms`));
		this.pump();
	}

	private send<T extends SqlRequest["type"]>(
		request: Extract<SqlRequest, { type: T }>,
		timeoutMs: number,
		onTimeout?: () => SqlResponseMap[T],
	): Promise<SqlResponseMap[T]> {
		return new Promise((resolve, reject) => {
			this.queue.push({
				request,
				timeoutMs,
				resolve: resolve as (v: unknown) => void,
				reject,
				onTimeout,
			});
			this.pump();
		});
	}

	/** Builds (or restores) the dataset base and the exercise base. Returns the time spent in ms (0 if already warm). */
	async warm(datasetId: string, setupSql?: string): Promise<number> {
		const key = `${datasetId}\u0000${setupSql ?? ""}`;
		if (this.warmed.has(key) && this.worker) return 0;
		const r = await this.send(
			{ type: "warm", datasetId, setupSql },
			WARM_TIMEOUT_MS,
		);
		this.warmed.add(key);
		return r.ms;
	}

	isWarm(datasetId: string, setupSql?: string): boolean {
		return (
			!!this.worker && this.warmed.has(`${datasetId}\u0000${setupSql ?? ""}`)
		);
	}

	async run(input: RunInput) {
		await this.warm(input.datasetId, input.setupSql);
		return this.send({ type: "run", input }, RUN_TIMEOUT_MS, () =>
			timeoutRunOutcome(RUN_TIMEOUT_MS),
		);
	}

	async judge(input: JudgeInput) {
		await this.warm(input.datasetId, input.setupSql);
		return this.send({ type: "judge", input }, JUDGE_TIMEOUT_MS, () =>
			timeoutVerdict(JUDGE_TIMEOUT_MS),
		);
	}

	catalog(datasetId: string) {
		return this.send({ type: "catalog", datasetId }, WARM_TIMEOUT_MS);
	}

	/** Catalog after setupSql and the learner's SQL (World 7 CREATE/ALTER, World 8 types, World 11 functions). */
	async liveCatalog(datasetId: string, setupSql?: string, sql?: string) {
		await this.warm(datasetId, setupSql);
		return this.send(
			{ type: "liveCatalog", datasetId, setupSql, sql },
			JUDGE_TIMEOUT_MS,
		);
	}

	peek(datasetId: string, table: string, limit = 50) {
		return this.send(
			{ type: "peek", datasetId, table, limit },
			WARM_TIMEOUT_MS,
		);
	}

	functions(datasetId: string) {
		return this.send({ type: "functions", datasetId }, WARM_TIMEOUT_MS);
	}
}

function datasetOf(r: SqlRequest): string | undefined {
	switch (r.type) {
		case "run":
		case "judge":
			return r.input.datasetId;
		default:
			return r.datasetId;
	}
}

let client: SqlClient | null = null;

/** Browser-only singleton. Never call during SSR. */
export function sqlClient(): SqlClient {
	if (typeof window === "undefined")
		throw new Error("sqlClient() is browser only");
	if (!client) client = new SqlClient();
	return client;
}
