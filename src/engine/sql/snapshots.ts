/**
 * IndexedDB cache of initialised dataset bases (PGlite dumpDataDir, gzip).
 * The first visit builds the dataset with its setupSql (dungeon creates a
 * 100k row table); later visits restore the dump instantly. Works in the
 * worker (IndexedDB is available in dedicated workers).
 */

const DB_NAME = "sqlq-pglite";
const STORE = "snapshots";
/** Bump when the PGlite build or the dump format changes. */
const FORMAT = "pglite-0.5.13-v1";

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function hash(text: string): Promise<string> {
	const buf = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);
	return Array.from(new Uint8Array(buf).slice(0, 12), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");
}

export async function snapshotKey(def: {
	id: string;
	setupSql: string;
	extensions?: string[];
}) {
	return `${FORMAT}:${def.id}:${await hash(`${(def.extensions ?? []).join(",")}\n${def.setupSql}`)}`;
}

export async function loadSnapshot(key: string): Promise<Blob | undefined> {
	if (typeof indexedDB === "undefined") return undefined;
	const db = await open();
	try {
		return await new Promise<Blob | undefined>((resolve, reject) => {
			const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
			req.onsuccess = () => resolve(req.result as Blob | undefined);
			req.onerror = () => reject(req.error);
		});
	} finally {
		db.close();
	}
}

export async function saveSnapshot(key: string, blob: Blob): Promise<void> {
	if (typeof indexedDB === "undefined") return;
	const db = await open();
	try {
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, "readwrite");
			const store = tx.objectStore(STORE);
			// Keep one snapshot per dataset: drop stale versions of the same id.
			const prefix = key.slice(0, key.lastIndexOf(":") + 1);
			const cursor = store.openCursor();
			cursor.onsuccess = () => {
				const c = cursor.result;
				if (!c) return;
				if (String(c.key).startsWith(prefix) && c.key !== key) c.delete();
				c.continue();
			};
			store.put(blob, key);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} finally {
		db.close();
	}
}
