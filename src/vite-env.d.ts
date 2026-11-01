/// <reference types="vite/client" />

declare module "virtual:chapter-index" {
	import type { Chapter } from "#/content/types";
	/** Light chapters (no lesson bodies, prompts, solutions or hints). */
	const entries: { file: string; sample: boolean; chapter: Chapter }[];
	export default entries;
}

/** Unique per build (vite.config.ts), same value on client and server. */
declare const __BUILD_ID__: string;
