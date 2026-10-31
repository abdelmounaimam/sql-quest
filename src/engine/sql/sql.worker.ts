/// <reference lib="webworker" />
import { judge, runSql } from "#/engine/checker";
import {
	createPGliteProvider,
	functionNames,
	introspectCatalog,
	peekTable,
} from "#/engine/checker/pglite-provider";
import type { DatasetDef, WorkerEnvelope, WorkerReply } from "./protocol";

/**
 * PGlite lives here, off the main thread. One base DB per dataset is cached;
 * every run / judge works on throwaway clones so learners cannot break
 * anything. Infinite queries are handled by the main thread terminating
 * this worker (PGlite ignores statement_timeout).
 */

const known = new Map<string, DatasetDef>();
const provider = createPGliteProvider({ getDataset: (id) => known.get(id) });

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
			return runSql(provider, r.input);
		case "judge":
			return judge(provider, r.input);
		case "catalog":
			return introspectCatalog(provider, r.datasetId);
		case "peek":
			return peekTable(provider, r.datasetId, r.table, r.limit);
		case "functions":
			return functionNames(provider, r.datasetId);
	}
}

// Serialise requests: PGlite instances are single threaded anyway.
let chain: Promise<unknown> = Promise.resolve();

self.onmessage = (ev: MessageEvent<WorkerEnvelope>) => {
	const env = ev.data;
	chain = chain.then(async () => {
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
