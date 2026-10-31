import { createHash } from "node:crypto";
import {
	createReadStream,
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";
import { chapterIndex } from "./vite-plugins/chapter-index";

/**
 * Dev only: Vite does not serve unknown extensions from node_modules, and
 * PGlite fetches its filesystem bundle `pglite.data` next to its module.
 * Serve those files raw (the production build emits them as assets).
 */
function servePgliteData(): Plugin {
	return {
		name: "serve-pglite-data",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const url = (req.url ?? "").split("?")[0];
				if (!/\.(data|tar\.gz)$/.test(url) || !url.includes("/node_modules/"))
					return next();
				const file = resolve(server.config.root, `.${decodeURIComponent(url)}`);
				if (!file.startsWith(server.config.root) || !existsSync(file))
					return next();
				res.setHeader("Content-Type", "application/octet-stream");
				res.setHeader("Content-Length", statSync(file).size);
				createReadStream(file).pipe(res);
			});
		},
	};
}

/**
 * Emits /sw.js into the client build with a precache list of every client
 * asset (JS, CSS, PGlite WASM + data, extension tarballs) plus public/ files,
 * so the game works offline after the first load. Template: scripts/sw.template.js.
 */
function pwaServiceWorker(): Plugin {
	const walk = (dir: string): string[] =>
		existsSync(dir)
			? readdirSync(dir).flatMap((n) => {
					const p = join(dir, n);
					return statSync(p).isDirectory() ? walk(p) : [p];
				})
			: [];
	return {
		name: "sql-quest-service-worker",
		apply: "build",
		generateBundle(_options, bundle) {
			if (this.environment?.name !== "client") return;
			const publicDir = resolve(process.cwd(), "public");
			const files = [
				...Object.keys(bundle),
				...walk(publicDir).map((p) =>
					relative(publicDir, p).split("\\").join("/"),
				),
			].filter((f) => !f.endsWith(".map") && f !== "sw.js");
			const version = createHash("sha256")
				.update(files.sort().join("\n"))
				.digest("hex")
				.slice(0, 12);
			const template = readFileSync(
				resolve(process.cwd(), "scripts/sw.template.js"),
				"utf8",
			);
			const source = template
				.replace("__VERSION__", version)
				.replace(
					"__PRECACHE__",
					JSON.stringify(["/", ...files.map((f) => `/${f}`)]),
				);
			this.emitFile({ type: "asset", fileName: "sw.js", source });
			this.info(
				`[sw] ${files.length + 1} entries precached, version ${version}`,
			);
		},
	};
}

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	// PGlite ships its own WASM + data bundles; pre-bundling breaks their URLs.
	optimizeDeps: {
		exclude: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector"],
	},
	worker: { format: "es" },
	// The server-side SQLite store lives in .data/: never watch it (writes would reload the page).
	server: { watch: { ignored: ["**/.data/**", "**/.output/**"] } },
	plugins: [
		devtools(),
		servePgliteData(),
		pwaServiceWorker(),
		chapterIndex(),
		nitro({
			rollupConfig: { external: [/^@sentry\//, "node:sqlite"] },
			// MIME fixes for PGlite assets (*.data, *.tar.gz).
			plugins: ["./src/server/nitro/asset-types.ts"],
			routeRules: {
				// Hashed build assets: cache forever.
				"/assets/**": {
					headers: { "cache-control": "public, max-age=31536000, immutable" },
				},
				// The service worker and manifest must always revalidate.
				"/sw.js": { headers: { "cache-control": "no-cache" } },
				"/manifest.webmanifest": { headers: { "cache-control": "no-cache" } },
				"/api/**": { headers: { "cache-control": "no-store" } },
			},
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
	],
});

export default config;
