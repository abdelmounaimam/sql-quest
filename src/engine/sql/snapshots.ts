/**
 * IndexedDB cache of initialised dataset bases (PGlite dumpDataDir, gzip).
 * The first visit builds the dataset with its setupSql (dungeon creates a
 * 100k row table); later visits restore the dump instantly. Works in the
 * worker (IndexedDB is available in dedicated workers).
 *
 * The dump is stored as an ArrayBuffer, never as a Blob or File: WebKit
 * refuses Blob values in IndexedDB in several contexts (workers, private
 * windows, some PWA launches) and the save then fails silently, so every
 * visit rebuilt the dataset from scratch.
 */

const DB_NAME = "sqlq-pglite";
const STORE = "snapshots";
/** Bump when the PGlite build or the dump format changes. */
const FORMAT = "pglite-0.5.13-v2";
/** A restore that takes longer than this is abandoned: the caller rebuilds. */
const LOAD_TIMEOUT_MS = 8000;

interface StoredSnapshot {
	data: ArrayBuffer;
	type: string;
	savedAt: number;
}

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
		req.onblocked = () => reject(new Error("IndexedDB open blocked"));
	});
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
		p.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			(e) => {
				clearTimeout(t);
				reject(e);
			},
		);
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

function toBlob(value: unknown): Blob | undefined {
	if (!value) return undefined;
	if (value instanceof Blob) return value;
	const v = value as Partial<StoredSnapshot>;
	if (v.data instanceof ArrayBuffer && v.data.byteLength > 0)
		return new Blob([v.data], { type: v.type || "application/x-gzip" });
	return undefined;
}

async function readSnapshot(key: string): Promise<Blob | undefined> {
	const db = await open();
	try {
		return await new Promise<Blob | undefined>((resolve, reject) => {
			const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
			req.onsuccess = () => resolve(toBlob(req.result));
			req.onerror = () =>
				reject(req.error ?? new Error("IndexedDB read failed"));
		});
	} finally {
		db.close();
	}
}

/** The saved dump for this key, or undefined (missing, unreadable or too slow). */
export async function loadSnapshot(key: string): Promise<Blob | undefined> {
	if (typeof indexedDB === "undefined") return undefined;
	try {
		return await withTimeout(
			readSnapshot(key),
			LOAD_TIMEOUT_MS,
			"Snapshot read",
		);
	} catch (err) {
		console.warn("[sql] snapshot not restored", err);
		return undefined;
	}
}

export async function saveSnapshot(key: string, blob: Blob): Promise<void> {
	if (typeof indexedDB === "undefined") return;
	const value: StoredSnapshot = {
		data: await blob.arrayBuffer(),
		type: blob.type || "application/x-gzip",
		savedAt: Date.now(),
	};
	const db = await open();
	try {
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, "readwrite");
			const store = tx.objectStore(STORE);
			// Keep one snapshot per dataset: drop stale versions of the same id
			// and every entry written by an older FORMAT (keys: format:id:hash).
			const [, id] = key.split(":");
			const cursor = store.openCursor();
			cursor.onsuccess = () => {
				const c = cursor.result;
				if (!c) return;
				const [format, otherId] = String(c.key).split(":");
				if (c.key !== key && (format !== FORMAT || otherId === id)) c.delete();
				c.continue();
			};
			store.put(value, key);
			tx.oncomplete = () => resolve();
			tx.onerror = () =>
				reject(tx.error ?? new Error("IndexedDB write failed"));
			tx.onabort = () =>
				reject(tx.error ?? new Error("IndexedDB write aborted"));
		});
	} finally {
		db.close();
	}
}

/** True when a snapshot for this key is stored (the next visit is fast). */
export async function hasSnapshot(key: string): Promise<boolean> {
	if (typeof indexedDB === "undefined") return false;
	try {
		const db = await open();
		try {
			return await new Promise<boolean>((resolve, reject) => {
				const req = db
					.transaction(STORE, "readonly")
					.objectStore(STORE)
					.count(key);
				req.onsuccess = () => resolve(req.result > 0);
				req.onerror = () => reject(req.error);
			});
		} finally {
			db.close();
		}
	} catch {
		return false;
	}
}
