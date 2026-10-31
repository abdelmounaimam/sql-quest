/**
 * Validates everything under src/content/ against a real PGlite.
 *
 *   pnpm validate:content                    every chapter
 *   pnpm validate:content ch01 ch03-the-void chapters whose id equals or starts with an argument
 *   options: --jobs=N (parallel workers, default 4)  --timeout=MS (per item, default 30000)
 *            --verbose (list warnings and every item)
 *
 * Files whose name starts with "_" (dev samples) are ignored.
 *
 * Structural checks: ids, file names, references, quiz answers, hints,
 * explanations, bosses, practice coverage per concept.
 *
 * Execution checks (one worker thread per chapter, killed on timeout):
 *   - lesson examples must run;
 *   - every try / exercise / practice solution must behave as its Check says
 *     (result: returns a result set; state: verifySql runs; error: fails with
 *     exactly that SQLSTATE);
 *   - discrimination: starterSql, a no-op for state checks, and every
 *     `reject` case of scripts/negative-cases.ts must be judged WRONG, every
 *     `accept` case must be judged RIGHT, using the app's own comparison
 *     rules (src/engine/checker).
 */
import { readdirSync } from "node:fs";
import { availableParallelism } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import type {
	Chapter,
	Check,
	Concept,
	Dataset,
	ExtensionName,
} from "../src/content/types";

const ROOT = resolve(import.meta.dirname, "..");
const CONTENT = join(ROOT, "src/content");

const KNOWN_EXTENSIONS: ExtensionName[] = [
	"vector",
	"pg_trgm",
	"hstore",
	"ltree",
	"citext",
	"cube",
	"earthdistance",
	"fuzzystrmatch",
	"pgcrypto",
	"tablefunc",
	"unaccent",
	"uuid-ossp",
	"btree_gin",
	"btree_gist",
	"intarray",
	"seg",
	"isn",
];

// ---------------------------------------------------------------------------
// Shared: loading content and turning a chapter into runnable items
// ---------------------------------------------------------------------------

async function importDefault<T>(file: string): Promise<T> {
	const mod = await import(pathToFileURL(file).href);
	return mod.default as T;
}

function contentFiles(dir: string): string[] {
	try {
		return readdirSync(dir)
			.filter(
				(f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.startsWith("_"),
			)
			.map((f) => join(dir, f))
			.sort();
	} catch {
		return [];
	}
}

export interface NegativeCase {
	sql: string;
	/** Why this answer is wrong (shown when the checker wrongly accepts it). */
	why: string;
}
export interface CaseSet {
	reject?: NegativeCase[];
	accept?: string[];
}

interface Item {
	key: string;
	label: string;
	kind: "example" | "try" | "exercise";
	setupSql?: string;
	solutionSql: string;
	check?: Check;
	starterSql?: string;
	cases?: CaseSet;
}

function lessonKey(chapterId: string, i: number) {
	return `${chapterId}/lesson-${i}`;
}

function chapterItems(ch: Chapter, cases: Record<string, CaseSet>): Item[] {
	const items: Item[] = [];
	ch.lesson.forEach((s, i) => {
		const key = lessonKey(ch.id, i);
		if (s.kind === "example")
			items.push({ key, label: `lesson[${i}] example "${s.title}"`, kind: "example", solutionSql: s.sql });
		if (s.kind === "try")
			items.push({
				key,
				label: `lesson[${i}] try "${s.title}"`,
				kind: "try",
				solutionSql: s.solutionSql,
				check: s.check,
				starterSql: s.starterSql,
				cases: cases[key],
			});
	});
	for (const ex of [...ch.exercises, ...ch.practice])
		items.push({
			key: ex.id,
			label: ex.id,
			kind: "exercise",
			setupSql: ex.setupSql,
			solutionSql: ex.solutionSql,
			check: ex.check,
			starterSql: ex.starterSql,
			cases: cases[ex.id],
		});
	return items;
}

// Cases live in scripts/negative-cases.ts (World 1) plus one file per chapter
// in scripts/negative-cases/<chapter-id>.ts, so parallel writers never share a file.
async function loadCases(): Promise<Record<string, CaseSet>> {
	const merged: Record<string, CaseSet> = {};
	const files = [join(ROOT, "scripts/negative-cases.ts")];
	try {
		const dir = join(ROOT, "scripts/negative-cases");
		for (const f of readdirSync(dir).sort())
			if (f.endsWith(".ts")) files.push(join(dir, f));
	} catch {
		// no per-chapter case files yet
	}
	for (const file of files) {
		let cases: Record<string, CaseSet>;
		try {
			cases = await importDefault<Record<string, CaseSet>>(file);
		} catch (e) {
			if ((e as { code?: string }).code === "ERR_MODULE_NOT_FOUND") continue;
			throw e;
		}
		for (const [key, set] of Object.entries(cases)) {
			if (merged[key]) throw new Error(`negative-cases: duplicate key ${key} in ${basename(file)}`);
			merged[key] = set;
		}
	}
	return merged;
}

// ---------------------------------------------------------------------------
// Worker: runs the SQL of one chapter
// ---------------------------------------------------------------------------

interface WorkerInput {
	chapterFile: string;
	datasetFile: string;
	start: number;
}
type WorkerMsg =
	| { type: "start"; index: number }
	| { type: "done"; index: number; failures: string[] }
	| { type: "fatal"; message: string }
	| { type: "end" };

async function workerMain(input: WorkerInput) {
	const post = (m: WorkerMsg) => parentPort?.postMessage(m);
	const { createPGliteProvider } = await import(
		"../src/engine/checker/pglite-provider"
	);
	const { toResultTable } = await import("../src/engine/checker/checker");
	const { compareTables } = await import("../src/engine/checker/compare");
	const { findForbidden } = await import("../src/engine/checker/forbidden");
	type ResultTable = ReturnType<typeof toResultTable>;
	type Sandbox = Awaited<
		ReturnType<ReturnType<typeof createPGliteProvider>["open"]>
	>;

	const chapter = await importDefault<Chapter>(input.chapterFile);
	const dataset = await importDefault<Dataset>(input.datasetFile);
	const cases = await loadCases();
	const items = chapterItems(chapter, cases);
	const provider = createPGliteProvider({
		getDataset: (id) => (id === dataset.id ? dataset : undefined),
	});

	const errText = (e: unknown) => {
		const err = e as { code?: string; message?: string };
		return `${err.code ? `[${err.code}] ` : ""}${err.message ?? String(e)}`;
	};
	const lastWithColumns = (tables: ResultTable[]) => {
		for (let i = tables.length - 1; i >= 0; i--)
			if (tables[i].columns.length > 0) return tables[i];
		return undefined;
	};
	type Outcome =
		| { ok: true; tables: ResultTable[]; state?: ResultTable }
		| { ok: false; code?: string; message: string };

	/** Runs sql (+ verifySql) in a fresh sandbox, the way the app does. */
	async function run(item: Item, sql: string): Promise<Outcome> {
		let box: Sandbox | undefined;
		try {
			box = await provider.open(dataset.id, item.setupSql);
			let tables: ResultTable[];
			try {
				tables = (await box.exec(sql)).map(toResultTable);
			} catch (e) {
				return { ok: false, code: (e as { code?: string }).code, message: errText(e) };
			}
			const check = item.check;
			if (check && (check.type === "state" || check.type === "result+state")) {
				try {
					const v = (await box.exec(check.verifySql)).map(toResultTable);
					const state = lastWithColumns(v) ?? v.at(-1);
					return { ok: true, tables, state };
				} catch (e) {
					return { ok: true, tables, state: undefined };
				}
			}
			return { ok: true, tables };
		} finally {
			await box?.close().catch(() => {});
		}
	}

	/** Same decision as the app's judge(), against a precomputed expected outcome. */
	function verdict(check: Check, expected: Outcome, got: Outcome): string | null {
		if (check.type === "error") {
			if (got.ok) return "ran without error";
			return got.code === check.sqlstate ? null : `failed with ${got.code ?? "?"} instead`;
		}
		if (!got.ok) return `error ${got.message}`;
		if (!expected.ok) return "reference failed";
		if (check.type === "result" || check.type === "result+state") {
			const exp = lastWithColumns(expected.tables);
			const g = lastWithColumns(got.tables);
			if (!exp) return "reference has no result set";
			if (!g) return "no result set";
			const c = compareTables(exp, g, {
				orderMatters: check.orderMatters,
				matchColumnNames: check.matchColumnNames,
				tolerance: check.type === "result" ? check.tolerance : undefined,
			});
			if (!c.equal) return c.errorType ?? "mismatch";
		}
		if (check.type === "state" || check.type === "result+state") {
			if (!expected.state) return "reference state missing";
			if (!got.state) return "state could not be verified";
			const c = compareTables(expected.state, got.state, {
				orderMatters: check.orderMatters,
				matchColumnNames: check.matchColumnNames,
			});
			if (!c.equal) return `wrong_final_state (${c.errorType})`;
		}
		return null;
	}

	async function checkItem(item: Item): Promise<string[]> {
		const failures: string[] = [];
		const reason = findForbidden(item.solutionSql);
		if (reason) failures.push(`solution uses a statement learners cannot run: ${reason}`);
		const expected = await run(item, item.solutionSql);

		if (item.kind === "example" || !item.check) {
			if (!expected.ok) failures.push(`example fails: ${expected.message}`);
			return failures;
		}
		const check = item.check;
		if (check.type === "error") {
			if (expected.ok) failures.push(`solution succeeded, expected SQLSTATE ${check.sqlstate}`);
			else if (expected.code !== check.sqlstate)
				failures.push(`expected SQLSTATE ${check.sqlstate}, got ${expected.message}`);
		} else {
			if (!expected.ok) {
				failures.push(`solution fails: ${expected.message}`);
				return failures;
			}
			if ((check.type === "result" || check.type === "result+state") && !lastWithColumns(expected.tables))
				failures.push("result check but the solution returns no result set");
			if ((check.type === "state" || check.type === "result+state") && !expected.state)
				failures.push("verifySql fails or returns nothing after the solution");
		}
		if (failures.length) return failures;

		// Discrimination: what must be rejected, what must be accepted.
		const judge = async (sql: string) =>
			findForbidden(sql) ? "forbidden" : verdict(check, expected, await run(item, sql));
		if (item.starterSql?.trim()) {
			if ((await judge(item.starterSql)) === null)
				failures.push("starterSql already passes the check");
		}
		if (check.type === "state") {
			if ((await judge("SELECT 1")) === null)
				failures.push("a no-op (SELECT 1) passes the state check: verifySql does not see the change");
		}
		for (const neg of item.cases?.reject ?? []) {
			if ((await judge(neg.sql)) === null)
				failures.push(`wrong answer accepted (${neg.why}): ${oneLine(neg.sql)}`);
		}
		for (const acc of item.cases?.accept ?? []) {
			const v = await judge(acc);
			if (v !== null) failures.push(`correct alternative rejected (${v}): ${oneLine(acc)}`);
		}
		return failures;
	}

	try {
		for (let i = input.start; i < items.length; i++) {
			post({ type: "start", index: i });
			let failures: string[];
			try {
				failures = await checkItem(items[i]);
			} catch (e) {
				failures = [`crashed: ${errText(e)}`];
			}
			post({ type: "done", index: i, failures });
		}
	} catch (e) {
		post({ type: "fatal", message: errText(e) });
	} finally {
		await provider.dispose().catch(() => {});
		post({ type: "end" });
	}
}

function oneLine(sql: string) {
	const s = sql.replace(/\s+/g, " ").trim();
	return s.length > 90 ? `${s.slice(0, 87)}...` : s;
}

// ---------------------------------------------------------------------------
// Main thread
// ---------------------------------------------------------------------------

type Problem = { where: string; message: string };

async function main() {
	const t0 = Date.now();
	const args = process.argv.slice(2);
	const opt = (name: string) =>
		args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
	const verbose = args.includes("--verbose");
	const jobs = Number(opt("jobs") ?? Math.min(4, availableParallelism()));
	const timeoutMs = Number(opt("timeout") ?? 30000);
	const filters = [
		...args.filter((a) => !a.startsWith("--")),
		...(opt("only") ? [opt("only") as string] : []),
	];

	const problems: Problem[] = [];
	const warnings: Problem[] = [];
	const fail = (where: string, message: string) => problems.push({ where, message });
	const warn = (where: string, message: string) => warnings.push({ where, message });

	// --- load ------------------------------------------------------------
	const concepts = await importDefault<Concept[]>(join(CONTENT, "concepts.ts"));
	const datasetFiles = contentFiles(join(CONTENT, "datasets"));
	const chapterFiles = contentFiles(join(CONTENT, "chapters"));
	const datasets = new Map<string, { ds: Dataset; file: string }>();
	for (const file of datasetFiles) {
		const ds = await importDefault<Dataset>(file);
		if (datasets.has(ds.id)) fail(`dataset ${ds.id}`, "duplicate dataset id");
		if (basename(file, ".ts") !== ds.id)
			fail(`dataset ${ds.id}`, `file name ${basename(file)} does not match id`);
		datasets.set(ds.id, { ds, file });
	}
	const chapters: { ch: Chapter; file: string }[] = [];
	for (const file of chapterFiles)
		chapters.push({ ch: await importDefault<Chapter>(file), file });
	chapters.sort((a, b) => a.ch.order - b.ch.order);
	const cases = await loadCases();

	// --- concepts --------------------------------------------------------
	const conceptIds = new Set<string>();
	for (const c of concepts) {
		if (conceptIds.has(c.id)) fail(`concept ${c.id}`, "duplicate concept id");
		conceptIds.add(c.id);
		if (!c.name?.trim() || !c.summary?.trim()) fail(`concept ${c.id}`, "empty name or summary");
	}
	const byId = new Map(concepts.map((c) => [c.id, c]));
	for (const c of concepts)
		for (const r of c.requires ?? [])
			if (!conceptIds.has(r)) fail(`concept ${c.id}`, `requires unknown concept ${r}`);
	{
		const state = new Map<string, 1 | 2>();
		const visit = (id: string, path: string[]) => {
			if (state.get(id) === 2) return;
			if (state.get(id) === 1) {
				fail(`concept ${id}`, `prerequisite cycle: ${[...path, id].join(" -> ")}`);
				return;
			}
			state.set(id, 1);
			for (const r of byId.get(id)?.requires ?? []) if (byId.has(r)) visit(r, [...path, id]);
			state.set(id, 2);
		};
		for (const c of concepts) visit(c.id, []);
	}

	// --- datasets --------------------------------------------------------
	for (const { ds } of datasets.values()) {
		const w = `dataset ${ds.id}`;
		for (const e of ds.extensions ?? []) {
			if (!KNOWN_EXTENSIONS.includes(e)) fail(w, `unknown extension ${e}`);
			const re = new RegExp(`create\\s+extension\\s+(if\\s+not\\s+exists\\s+)?"?${e}"?`, "i");
			if (!re.test(ds.setupSql)) fail(w, `extension ${e} listed but no CREATE EXTENSION`);
		}
		if (!ds.tableNotes || Object.keys(ds.tableNotes).length === 0)
			warn(w, "no tableNotes");
	}

	// --- chapters --------------------------------------------------------
	const chapterIds = new Map(chapters.map(({ ch }) => [ch.id, ch]));
	const exerciseIds = new Set<string>();
	const orders = new Map<number, string>();
	const itemKeys = new Set<string>();
	const taught = new Set<string>();
	for (const { ch, file } of chapters) {
		for (const c of ch.concepts) taught.add(c);
		const w = `chapter ${ch.id}`;
		if (basename(file, ".ts") !== ch.id) fail(w, `file name ${basename(file)} does not match id`);
		const m = /^ch(\d{2})-[a-z0-9]+(-[a-z0-9]+)*$/.exec(ch.id);
		if (!m) fail(w, "id must look like chNN-slug");
		else if (Number(m[1]) !== ch.order) fail(w, `order ${ch.order} does not match id number ${m[1]}`);
		const nn = m?.[1] ?? "??";
		if (orders.has(ch.order)) fail(w, `order ${ch.order} also used by ${orders.get(ch.order)}`);
		orders.set(ch.order, ch.id);
		if (!datasets.has(ch.datasetId)) fail(w, `unknown datasetId ${ch.datasetId}`);
		for (const p of ch.prerequisites) {
			const pre = chapterIds.get(p);
			if (!pre) fail(w, `unknown prerequisite ${p}`);
			else if (pre.order >= ch.order) fail(w, `prerequisite ${p} comes later on the map`);
		}
		for (const c of ch.concepts) if (!conceptIds.has(c)) fail(w, `unknown concept ${c}`);
		if (ch.lesson.length < 4 || ch.lesson.length > 10)
			fail(w, `lesson has ${ch.lesson.length} steps (expected 4 to 10)`);
		ch.lesson.forEach((s, i) => {
			const lw = `${ch.id} lesson[${i}]`;
			itemKeys.add(lessonKey(ch.id, i));
			if (s.kind === "quiz") {
				if (s.answerIndex < 0 || s.answerIndex >= s.choices.length)
					fail(lw, "quiz answerIndex out of range");
				if (s.choices.length < 2) fail(lw, "quiz needs at least 2 choices");
				if (!s.explanation?.trim()) fail(lw, "quiz without explanation");
			}
			if ((s.kind === "explain" || s.kind === "example") && !s.body?.trim())
				fail(lw, "empty body");
			if (s.kind === "try" && s.hints.length === 0) fail(lw, "try without hints");
			if ((s.kind === "explain" || s.kind === "example") && s.body.split(/\s+/).length > 110)
				warn(lw, `card is long (${s.body.split(/\s+/).length} words)`);
		});
		const bosses = ch.exercises.filter((e) => e.boss);
		if (bosses.length > 1) fail(w, "more than one boss");
		if (bosses.length === 1 && ch.exercises.at(-1) !== bosses[0])
			warn(w, "boss is not the last exercise");
		if (ch.practice.some((p) => p.boss)) fail(w, "a practice drill is marked boss");
		if (ch.exercises.length === 0) fail(w, "no exercises");
		const all = [
			...ch.exercises.map((e) => ({ e, pool: "ex" })),
			...ch.practice.map((e) => ({ e, pool: "pr" })),
		];
		for (const { e: ex, pool } of all) {
			const ew = `exercise ${ex.id}`;
			itemKeys.add(ex.id);
			if (exerciseIds.has(ex.id)) fail(ew, "duplicate exercise id");
			exerciseIds.add(ex.id);
			if (!new RegExp(`^ch${nn}-${pool}\\d{2}$`).test(ex.id))
				fail(ew, `id must look like ch${nn}-${pool}MM`);
			for (const c of ex.concepts) {
				if (!conceptIds.has(c)) fail(ew, `unknown concept ${c}`);
				else if (!taught.has(c)) warn(ew, `concept ${c} is not taught by this chapter or an earlier one`);
			}
			if (ex.concepts.length === 0) fail(ew, "no concepts");
			if (!ex.prompt?.trim()) fail(ew, "empty prompt");
			if (!ex.explanation?.trim()) fail(ew, "empty explanation");
			if (ex.hints.length === 0 || ex.hints.some((h) => !h.trim())) fail(ew, "missing or empty hints");
			else if (ex.hints.length !== 3) warn(ew, `${ex.hints.length} hints (style guide: 3)`);
			if ((ex.check.type === "state" || ex.check.type === "result+state") && !ex.check.verifySql.trim())
				fail(ew, "empty verifySql");
		}
		for (const c of ch.concepts)
			if (!ch.practice.some((p) => p.concepts.includes(c)))
				fail(w, `no practice drill for concept ${c}`);
	}
	for (const key of Object.keys(cases))
		if (!itemKeys.has(key)) fail(`negative-cases`, `key ${key} matches no exercise or lesson try`);

	// --- dataset builds (full runs only) ---------------------------------
	if (filters.length === 0) {
		const { createPGliteProvider } = await import("../src/engine/checker/pglite-provider");
		for (const { ds } of datasets.values()) {
			const provider = createPGliteProvider({ getDataset: (id) => (id === ds.id ? ds : undefined) });
			const t = Date.now();
			try {
				const box = await provider.open(ds.id);
				const ms = Date.now() - t;
				for (const e of ds.extensions ?? []) {
					const r = await box.exec(`SELECT count(*)::int FROM pg_extension WHERE extname = '${e}'`);
					if (Number(r[0]?.rows[0]?.[0]) !== 1) fail(`dataset ${ds.id}`, `extension ${e} listed but not created`);
				}
				await box.close();
				console.log(`ok   dataset ${ds.id.padEnd(22)} builds in ${(ms / 1000).toFixed(1)}s`);
				if (ms > 4000) warn(`dataset ${ds.id}`, `setup + first clone took ${ms} ms`);
			} catch (e) {
				fail(`dataset ${ds.id}`, `setupSql failed: ${(e as Error).message}`);
			} finally {
				await provider.dispose().catch(() => {});
			}
		}
	}

	// --- execution -------------------------------------------------------
	const selected = chapters.filter(
		({ ch }) =>
			filters.length === 0 || filters.some((f) => ch.id === f || ch.id.startsWith(f)),
	);
	if (filters.length && selected.length === 0)
		fail("arguments", `no chapter matches ${filters.join(", ")}`);

	interface Report {
		id: string;
		total: number;
		ok: number;
		ms: number;
		failures: Problem[];
	}
	const reports: Report[] = [];

	const runChapter = (ch: Chapter, file: string): Promise<Report> =>
		new Promise((done) => {
			const items = chapterItems(ch, cases);
			const ds = datasets.get(ch.datasetId);
			const report: Report = { id: ch.id, total: items.length, ok: 0, ms: 0, failures: [] };
			const t = Date.now();
			if (!ds || items.length === 0) {
				done(report);
				return;
			}
			const spawn = (start: number) => {
				if (start >= items.length) {
					report.ms = Date.now() - t;
					done(report);
					return;
				}
				const worker = new Worker(new URL(import.meta.url), {
					workerData: { chapterFile: file, datasetFile: ds.file, start } satisfies WorkerInput,
				});
				let current = start;
				let timer: NodeJS.Timeout | undefined;
				let finished = false;
				const finish = (next: number | null) => {
					if (finished) return;
					finished = true;
					clearTimeout(timer);
					worker.terminate().catch(() => {});
					if (next === null) {
						report.ms = Date.now() - t;
						done(report);
					} else spawn(next);
				};
				worker.on("message", (m: WorkerMsg) => {
					if (m.type === "start") {
						current = m.index;
						clearTimeout(timer);
						timer = setTimeout(() => {
							report.failures.push({
								where: items[current].label,
								message: `timed out after ${timeoutMs / 1000}s (runaway query?)`,
							});
							finish(current + 1);
						}, timeoutMs);
					} else if (m.type === "done") {
						clearTimeout(timer);
						if (m.failures.length === 0) report.ok++;
						for (const f of m.failures)
							report.failures.push({ where: items[m.index].label, message: f });
						if (verbose)
							console.log(`   ${m.failures.length ? "FAIL" : "ok  "} ${ch.id} ${items[m.index].label}`);
					} else if (m.type === "fatal") {
						report.failures.push({ where: ch.id, message: `worker failed: ${m.message}` });
					} else if (m.type === "end") {
						finish(null);
					}
				});
				worker.on("error", (e) => {
					report.failures.push({ where: items[current]?.label ?? ch.id, message: `worker crashed: ${e.message}` });
					finish(current + 1);
				});
				worker.on("exit", () => {
					if (finished) return;
					report.failures.push({ where: items[current]?.label ?? ch.id, message: "worker exited unexpectedly" });
					finish(current + 1);
				});
			};
			spawn(0);
		});

	const queue = [...selected];
	const runners = Array.from({ length: Math.max(1, jobs) }, async () => {
		for (let next = queue.shift(); next; next = queue.shift()) {
			const r = await runChapter(next.ch, next.file);
			reports.push(r);
			console.log(
				`${r.failures.length === 0 && r.ok === r.total ? "ok  " : "FAIL"} ${r.id.padEnd(30)} ${String(r.ok).padStart(3)}/${String(r.total).padEnd(3)} items  ${(r.ms / 1000).toFixed(1)}s`,
			);
			for (const f of r.failures) console.log(`       - ${f.where}: ${f.message}`);
		}
	});
	await Promise.all(runners);

	// --- summary ---------------------------------------------------------
	const ran = reports.reduce((n, r) => n + r.total, 0);
	const ok = reports.reduce((n, r) => n + r.ok, 0);
	const execFailures = reports.reduce((n, r) => n + r.failures.length, 0);
	console.log(
		`\n${datasets.size} datasets, ${chapters.length} chapters, ${concepts.length} concepts, ${exerciseIds.size} exercises, ${Object.keys(cases).length} negative-case sets`,
	);
	console.log(`SQL: ${ok}/${ran} items passed in ${selected.length} chapter(s), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
	if (warnings.length) {
		console.log(`${warnings.length} warning(s)${verbose ? ":" : " (use --verbose to list)"}`);
		if (verbose) for (const p of warnings) console.log(`  ~ ${p.where}: ${p.message}`);
	}
	if (problems.length) {
		console.log(`\n${problems.length} structural problem(s):`);
		for (const p of problems) console.log(`  - ${p.where}: ${p.message}`);
	}
	if (problems.length || execFailures) {
		console.log("\nFAILED");
		process.exit(1);
	}
	console.log("All content valid.");
	process.exit(0);
}

if (isMainThread) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
} else {
	workerMain(workerData as WorkerInput).catch((e) => {
		parentPort?.postMessage({ type: "fatal", message: String(e) });
		parentPort?.postMessage({ type: "end" });
	});
}
