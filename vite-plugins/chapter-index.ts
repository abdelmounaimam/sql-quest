import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";
import type { Plugin } from "vite";
import type { Chapter, Exercise, LessonStep } from "../src/content/types";

/**
 * virtual:chapter-index — a light index of every chapter (map, unlock graph,
 * adaptive engine) without lessons, prompts, solutions or hints. The full
 * chapter modules are lazy chunks loaded when a level opens.
 */
const ID = "virtual:chapter-index";
const RESOLVED = `\0${ID}`;

function lightExercise(e: Exercise): Exercise {
	return {
		id: e.id,
		title: e.title,
		difficulty: e.difficulty,
		kind: e.kind,
		concepts: e.concepts,
		boss: e.boss,
		check: { type: "result" },
		prompt: "",
		solutionSql: "",
		hints: [],
		explanation: "",
	};
}

function lightLesson(s: LessonStep): LessonStep {
	switch (s.kind) {
		case "explain":
			return { kind: "explain", title: s.title, body: "" };
		case "example":
			return { kind: "example", title: s.title, body: "", sql: "" };
		case "quiz":
			return { kind: "quiz", question: "", choices: [], answerIndex: 0, explanation: "" };
		case "try":
			return { kind: "try", title: s.title, prompt: "", solutionSql: "", check: { type: "result" }, hints: [] };
	}
}

export function chapterIndex(): Plugin {
	const dir = resolve(process.cwd(), "src/content/chapters");
	return {
		name: "sql-quest-chapter-index",
		resolveId(id) {
			return id === ID ? RESOLVED : undefined;
		},
		async load(id) {
			if (id !== RESOLVED) return;
			const files = readdirSync(dir)
				.filter((f) => f.endsWith(".ts"))
				.sort();
			const entries = [];
			for (const file of files) {
				const path = join(dir, file);
				this.addWatchFile(path);
				// A cache-busting query so edits are picked up in dev.
				const mod = (await tsImport(`${pathToFileURL(path).href}?t=${Date.now()}`, import.meta.url)) as {
					default: Chapter;
				};
				const c = mod.default;
				if (!c) continue;
				entries.push({
					file,
					sample: file.startsWith("_"),
					chapter: {
						...c,
						lesson: c.lesson.map(lightLesson),
						exercises: c.exercises.map(lightExercise),
						practice: c.practice.map(lightExercise),
					},
				});
			}
			return `export default ${JSON.stringify(entries)};`;
		},
	};
}
