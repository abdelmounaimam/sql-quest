/// <reference lib="webworker" />
import { judge, runSql } from "#/engine/checker";
import {
	createPGliteProvider,
	execScript,
	functionNames,
	introspectCatalog,
	introspectDatabase,
	peekTable,
} from "#/engine/checker/pglite-provider";
import type { DatasetDef, WorkerEnvelope, WorkerReply } from "./protocol";
import { loadSnapshot, saveSnapshot, snapshotKey } from "./snapshots";

/**
 * PGlite lives here, off the main thread. One base DB per dataset is cached;
 * every run / judge works on throwaway clones so learners cannot break
 * anything. Infinite queries are handled by the main thread terminating
 * this worker (PGlite ignores statement_timeout).
 */

/** Rows kept for display (the grid is virtualized); comparison always uses every row. */
const DISPLAY = { displayLimit: 10_000 };

/**
 * WebKit can evaluate this module twice (PGlite extension chunks import a
 * helper from the worker entry chunk, and Safari does not dedupe that import
 * with the worker's own script). State therefore lives on the worker global,
 * so a second evaluation reuses the same datasets, PGlite instances and queue
 * instead of starting empty ("Unknown dataset").
 */
type WorkerState = {
	known: Map<string, DatasetDef>;
	provider: ReturnType<typeof createPGliteProvider>;
	chain: Promise<unknown>;
};
const g = globalThis as typeof globalThis & { __sqlqWorker?: WorkerState };
if (!g.__sqlqWorker) {
	const known = new Map<string, DatasetDef>();
	g.__sqlqWorker = {
		known,
		// Initialised bases are cached in IndexedDB: the second visit restores
		// the dump instead of re-running the dataset setupSql (dungeon: 100k rows).
		provider: createPGliteProvider(
			{ getDataset: (id) => known.get(id) },
			{
				restore: async (def) => loadSnapshot(await snapshotKey(def)),
				persist: async (def, dump) =>
					saveSnapshot(await snapshotKey(def), dump),
			},
		),
		chain: Promise.resolve(),
	};
}
const state = g.__sqlqWorker;
const { known, provider } = state;

async function handle(env: WorkerEnvelope): Promise<unknown> {
	for (const d of env.datasets) {
		const prev = known.get(d.id);
		if (prev && prev.setupSql !== d.setupSql) await provider.invalidate(d.id);
		known.set(d.id, d);
	}
	const r = env.request;
	switch (r.type) {
		case "warm": {
			const t = performance.now();
			const sb = await provider.open(r.datasetId, r.setupSql);
			await sb.close();
			return { ms: Math.round(performance.now() - t) };
		}
		case "run":
			return runSql(provider, r.input, DISPLAY);
		case "judge":
			return judge(provider, r.input, DISPLAY);
		case "catalog":
			return introspectCatalog(provider, r.datasetId);
		case "liveCatalog": {
			const box = await provider.openDb(r.datasetId, r.setupSql);
			try {
				// psql-style replay of the learner script; errors just stop it.
				if (r.sql?.trim()) await execScript(box.db, r.sql);
				return await introspectDatabase(box.db, { datasetId: r.datasetId });
			} finally {
				await box.close();
			}
		}
		case "peek":
			return peekTable(provider, r.datasetId, r.table, r.limit);
		case "functions":
			return functionNames(provider, r.datasetId);
	}
}

// Serialise requests: PGlite instances are single threaded anyway. The queue
// is shared too, so a second evaluation of this module keeps the ordering.
self.onmessage = (ev: MessageEvent<WorkerEnvelope>) => {
	const env = ev.data;
	state.chain = state.chain.then(async () => {
		let reply: WorkerReply;
		try {
			reply = { id: env.id, ok: true, result: await handle(env) };
		} catch (e) {
			reply = {
				id: env.id,
				ok: false,
				error: describeError(e),
			};
		}
		self.postMessage(reply);
	});
};

function describeError(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (e && typeof e === "object") {
		const o = e as Record<string, unknown>;
		if (typeof o.message === "string") return o.message;
		try {
			return `${o.constructor?.name ?? "Error"}: ${JSON.stringify(o)}`;
		} catch {
			return String(e);
		}
	}
	return String(e);
}
