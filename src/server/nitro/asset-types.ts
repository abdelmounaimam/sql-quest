import { definePlugin } from "nitro";

/**
 * Nitro runtime plugin: fix how PGlite assets are served.
 * - *.data (Postgres filesystem bundle) is not text/plain.
 * - Extension tarballs (vector.tar-<hash>.gz) are gzip *files* that PGlite
 *   unpacks itself. The static handler treats any .gz as a precompressed
 *   variant and adds `Content-Encoding: gzip`, which makes the browser
 *   decompress them on the fly and breaks the extension load. Drop it.
 */
const TYPES: [RegExp, string][] = [
	[/\.data$/, "application/octet-stream"],
	[/\.tar(-[\w-]+)?\.gz$/, "application/gzip"],
	[/\.wasm$/, "application/wasm"],
];

export default definePlugin((nitro) => {
	nitro.hooks.hook("response", (res, event) => {
		const path = new URL(event.req.url).pathname;
		for (const [re, type] of TYPES) {
			if (re.test(path)) {
				res.headers.set("content-type", type);
				if (type === "application/gzip") res.headers.delete("content-encoding");
				return;
			}
		}
	});
});
