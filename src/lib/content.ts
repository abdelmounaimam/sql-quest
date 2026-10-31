import type {
	Chapter,
	Concept,
	Dataset,
	Exercise,
	LessonStep,
} from "#/content/types";

/**
 * Content registry. Discovers datasets, chapters and concepts with
 * import.meta.glob. Files whose name starts with "_" are dev samples:
 * they are used only while no real (non underscore) chapter exists.
 */

type Mod<T> = { default: T };

const datasetMods = import.meta.glob<Mod<Dataset>>("../content/datasets/*.ts", {
	eager: true,
});
const chapterMods = import.meta.glob<Mod<Chapter>>("../content/chapters/*.ts", {
	eager: true,
});
const conceptMods = import.meta.glob<Mod<Concept[]>>(
	["../content/concepts.ts", "../content/_concepts*.ts"],
	{ eager: true },
);

const isSample = (path: string) =>
	(path.split("/").pop() ?? "").startsWith("_");

function pick<T>(mods: Record<string, Mod<T>>, useSamples: boolean): T[] {
	return Object.entries(mods)
		.filter(([path, m]) => m?.default && isSample(path) === useSamples)
		.map(([, m]) => m.default);
}

const realChapters = pick(chapterMods, false);
/**
 * True while the app runs on the underscore dev samples.
 * VITE_SQLQ_CONTENT=samples forces the samples (handy for testing every UI path).
 */
export const USING_SAMPLES =
	import.meta.env.VITE_SQLQ_CONTENT === "samples" || realChapters.length === 0;

export const chapters: Chapter[] = (
	USING_SAMPLES ? pick(chapterMods, true) : realChapters
)
	.slice()
	.sort((a, b) => a.order - b.order);

const neededDatasets = new Set(chapters.map((c) => c.datasetId));
export const datasets: Dataset[] = [
	...pick(datasetMods, false),
	...pick(datasetMods, true),
].filter(
	(d, i, all) =>
		neededDatasets.has(d.id) && all.findIndex((x) => x.id === d.id) === i,
);

export const concepts: Concept[] = (() => {
	const real = pick(conceptMods, false).flat();
	const sample = pick(conceptMods, true).flat();
	const merged = USING_SAMPLES ? [...sample, ...real] : [...real, ...sample];
	const seen = new Set<string>();
	return merged.filter((c) => (seen.has(c.id) ? false : seen.add(c.id)));
})();

export const datasetById = new Map(datasets.map((d) => [d.id, d]));
export const chapterById = new Map(chapters.map((c) => [c.id, c]));
export const conceptById = new Map(concepts.map((c) => [c.id, c]));

export function conceptName(id: string): string {
	return (
		conceptById.get(id)?.name ??
		id.replace(/^_/, "").replace(/-/g, " ").toUpperCase()
	);
}

export interface ExerciseRef {
	chapter: Chapter;
	exercise: Exercise;
	pool: "main" | "practice";
}

const exerciseIndex = new Map<string, ExerciseRef>();
for (const chapter of chapters) {
	for (const exercise of chapter.exercises)
		exerciseIndex.set(exercise.id, { chapter, exercise, pool: "main" });
	for (const exercise of chapter.practice)
		exerciseIndex.set(exercise.id, { chapter, exercise, pool: "practice" });
}

export function findExercise(id: string): ExerciseRef | undefined {
	return exerciseIndex.get(id);
}

export function bossOf(chapter: Chapter): Exercise | undefined {
	return chapter.exercises.find((e) => e.boss);
}

export function mainExercises(chapter: Chapter): Exercise[] {
	return chapter.exercises.filter((e) => !e.boss);
}

export interface World {
	name: string;
	index: number;
	chapters: Chapter[];
}

/** Chapters grouped by world, in map order. */
export const worlds: World[] = (() => {
	const out: World[] = [];
	for (const ch of chapters) {
		let w = out.find((x) => x.name === ch.world);
		if (!w) {
			w = { name: ch.world, index: out.length, chapters: [] };
			out.push(w);
		}
		w.chapters.push(ch);
	}
	return out;
})();

/** A lesson "try" step as a pseudo exercise, so the same editor/judge works. */
export function tryStepAsExercise(
	chapter: Chapter,
	step: Extract<LessonStep, { kind: "try" }>,
	index: number,
): Exercise {
	return {
		id: `${chapter.id}::try-${index}`,
		title: step.title,
		prompt: step.prompt,
		difficulty: 1,
		kind: "query",
		concepts: chapter.concepts,
		starterSql: step.starterSql,
		solutionSql: step.solutionSql,
		check: step.check,
		hints: step.hints,
		explanation: "",
	};
}

/** World tokens are 1-based (--world-1 … --world-11), one per world. */
export const WORLD_TOKEN_COUNT = 11;

/** 1-based world number for data-world="N" (wraps past 11 worlds). */
export function worldNumber(index: number): number {
	return (index % WORLD_TOKEN_COUNT) + 1;
}

export function worldTheme(index: number) {
	const v = `var(--world-${worldNumber(index)})`;
	return { glow: v, sky: v, ground: v, n: worldNumber(index) };
}

/** World glyph per world number (icons.tsx WorldGlyph names). */
export const WORLD_GLYPHS = [
	"mug",
	"coin",
	"bridge",
	"arch",
	"scope",
	"anvil",
	"tower",
	"flask",
	"book",
	"gear",
	"spire",
] as const;

/** 1-based world number of a chapter (for data-world). */
export function worldOfChapter(chapterId: string): number {
	const w = worlds.find((x) => x.chapters.some((c) => c.id === chapterId));
	return worldNumber(w?.index ?? 0);
}
