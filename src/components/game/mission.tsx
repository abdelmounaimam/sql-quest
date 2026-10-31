import { useDebouncedCallback, useDebouncedValue } from "@tanstack/react-pacer";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	BookOpen,
	Code2,
	Eye,
	Heart,
	Lightbulb,
	Play,
	Send,
	Table2,
	Target,
	Timer,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import type { Chapter, Exercise } from "#/content/types";
import { feedbackPolicy, HINT_XP_COST } from "#/engine/adaptive";
import type { AttemptKind } from "#/engine/adaptive/types";
import type { ErrorType, RunOutcome, Verdict } from "#/engine/checker/types";
import { sqlClient } from "#/engine/sql/client";
import { type Reward, recordAttempt, useGame } from "#/game/progress";
import { sfx } from "#/game/sound";
import {
	functionsQuery,
	referencedTables,
	useCatalog,
} from "#/game/sql-queries";
import { useIsDesktop } from "#/hooks/use-media";
import { conceptById, conceptName } from "#/lib/content";
import { cn } from "#/lib/utils";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "../ui/resizable";
import { burst } from "./fx";
import { Markdown } from "./markdown";
import { DiffView, ResultGrid } from "./result-grid";
import { SchemaExplorer } from "./schema-explorer";
import { SolvedOverlay } from "./solved-overlay";
import { QuickKeys, SqlEditor, type SqlEditorHandle } from "./sql-editor";

export type MissionMode = "exercise" | "practice" | "boss" | "review";

const BOSS_LIVES = 3;

const draftKey = (id: string) => `sqlq-draft:${id}`;
function loadDraft(ex: Exercise): string {
	try {
		return localStorage.getItem(draftKey(ex.id)) ?? ex.starterSql ?? "";
	} catch {
		return ex.starterSql ?? "";
	}
}

export interface MissionResult {
	reward: Reward;
	solved: boolean;
	revealed: boolean;
}

export function MissionScreen({
	chapter,
	exercise,
	mode,
	onNext,
	onBossDefeat,
	nextLabel = "Next mission",
}: {
	chapter: Chapter;
	exercise: Exercise;
	mode: MissionMode;
	onNext: () => void;
	onBossDefeat?: () => void;
	nextLabel?: string;
}) {
	const isDesktop = useIsDesktop();
	const autocomplete = useGame((s) => s.settings.autocomplete);
	const bossTimerOn = useGame((s) => s.settings.bossTimer);
	const editorRef = useRef<SqlEditorHandle>(null);

	const [sql, setSql] = useState(() => loadDraft(exercise));
	const [startedAt] = useState(() => Date.now());
	const [runs, setRuns] = useState(0);
	const [failures, setFailures] = useState(0);
	const [errorTypes, setErrorTypes] = useState<ErrorType[]>([]);
	const [chargedHints, setChargedHints] = useState(0);
	const [freeHints, setFreeHints] = useState(0);
	const [revealed, setRevealed] = useState(false);
	const [lastRun, setLastRun] = useState<RunOutcome | null>(null);
	const [verdict, setVerdict] = useState<Verdict | null>(null);
	const [result, setResult] = useState<MissionResult | null>(null);
	const [bossLost, setBossLost] = useState(false);
	const [shakeKey, setShakeKey] = useState(0);
	const [tab, setTab] = useState<"mission" | "schema" | "code" | "result">(
		"mission",
	);

	const shownHints = Math.max(chargedHints, freeHints);
	const policy = feedbackPolicy({
		failures,
		hintsShown: shownHints,
		totalHints: exercise.hints.length,
	});

	// Proactive free hint after repeated failures.
	useEffect(() => {
		const idx = policy.proactiveHintIndex;
		if (idx !== null && idx + 1 > shownHints) {
			setFreeHints(idx + 1);
			sfx("hint");
		}
	}, [policy.proactiveHintIndex, shownHints]);

	const saveDraft = useDebouncedCallback(
		(v: string) => {
			try {
				localStorage.setItem(draftKey(exercise.id), v);
			} catch {
				// ignore
			}
		},
		{ wait: 600 },
	);

	const catalog = useCatalog(chapter.datasetId);
	const functions = useQuery(functionsQuery(chapter.datasetId));
	const schema = useMemo(() => {
		if (!catalog.data) return undefined;
		return Object.fromEntries(
			catalog.data.tables.map((t) => [t.name, t.columns.map((c) => c.name)]),
		);
	}, [catalog.data]);
	const [debouncedSql] = useDebouncedValue(sql, { wait: 250 });
	const activeTables = useMemo(
		() => referencedTables(debouncedSql, Object.keys(schema ?? {})),
		[debouncedSql, schema],
	);

	const runMut = useMutation({
		mutationFn: (text: string) =>
			sqlClient().run({
				datasetId: chapter.datasetId,
				setupSql: exercise.setupSql,
				sql: text,
			}),
		onSuccess: (out) => {
			setLastRun(out);
			setVerdict(null);
			if (!isDesktop) setTab("result");
			sfx(out.ok ? "run" : "fail");
		},
	});

	const kind: AttemptKind =
		mode === "boss"
			? "boss"
			: mode === "practice"
				? "practice"
				: mode === "review"
					? "review"
					: "exercise";

	const finish = (
		solved: boolean,
		wasRevealed: boolean,
		extra?: { failures?: number; errors?: ErrorType[] },
	) => {
		const reward = recordAttempt({
			exerciseId: exercise.id,
			chapterId: chapter.id,
			kind,
			concepts: exercise.concepts,
			difficulty: exercise.difficulty,
			startedAt,
			finishedAt: Date.now(),
			runs,
			failedSubmissions: extra?.failures ?? failures,
			errorTypes: extra?.errors ?? errorTypes,
			hintsUsed: chargedHints,
			revealed: wasRevealed,
			solved,
		});
		try {
			localStorage.removeItem(draftKey(exercise.id));
		} catch {
			// ignore
		}
		return reward;
	};

	const judgeMut = useMutation({
		mutationFn: (text: string) =>
			sqlClient().judge({
				datasetId: chapter.datasetId,
				setupSql: exercise.setupSql,
				solutionSql: exercise.solutionSql,
				check: exercise.check,
				learnerSql: text,
			}),
		onSuccess: (v) => {
			setVerdict(v);
			setLastRun(null);
			if (!isDesktop) setTab("result");
			if (v.pass) {
				const reward = finish(true, false);
				setResult({ reward, solved: true, revealed: false });
				sfx("success");
				burst(mode === "boss" ? "boss" : "small");
				return;
			}
			const f = failures + 1;
			const errs = v.errorType ? [...errorTypes, v.errorType] : errorTypes;
			setFailures(f);
			setErrorTypes(errs);
			setShakeKey((k) => k + 1);
			sfx("fail");
			if (mode === "boss" && f >= BOSS_LIVES) {
				finish(false, false, { failures: f, errors: errs });
				setBossLost(true);
			}
		},
	});

	const busy = runMut.isPending || judgeMut.isPending;
	const run = () => {
		if (busy || result || bossLost) return;
		setRuns((r) => r + 1);
		runMut.mutate(sql);
	};
	const submit = () => {
		if (busy || result || bossLost) return;
		judgeMut.mutate(sql);
	};
	const revealHint = () => {
		if (shownHints >= exercise.hints.length) return;
		setChargedHints(shownHints + 1);
		sfx("hint");
	};
	const revealSolution = () => {
		setSql(exercise.solutionSql);
		setRevealed(true);
		const reward = finish(true, true);
		setResult({ reward, solved: true, revealed: true });
	};

	// Optional boss timer.
	const bossSeconds = 120 + exercise.difficulty * 60;
	const [timeLeft, setTimeLeft] = useState(bossSeconds);
	const timerActive = mode === "boss" && bossTimerOn && !result && !bossLost;
	useEffect(() => {
		if (!timerActive) return;
		const id = window.setInterval(() => setTimeLeft((t) => t - 1), 1000);
		return () => window.clearInterval(id);
	}, [timerActive]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: fire once when the clock hits zero
	useEffect(() => {
		if (timerActive && timeLeft <= 0) {
			finish(false, false);
			setBossLost(true);
			sfx("fail");
		}
	}, [timeLeft, timerActive]);

	const errorLine = verdict?.sqlError?.line ?? lastRun?.error?.line;

	const missionCard = (
		<MissionCard
			chapter={chapter}
			exercise={exercise}
			mode={mode}
			failures={failures}
			shownHints={shownHints}
			freeHints={freeHints}
			onHint={revealHint}
			showRefresher={policy.showRefresher}
			offerSolution={policy.offerSolution && !revealed}
			onReveal={revealSolution}
			lives={mode === "boss" ? BOSS_LIVES - failures : undefined}
			timeLeft={timerActive ? timeLeft : undefined}
		/>
	);

	const editor = (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex items-center justify-between gap-2 px-1 pb-2">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<Code2 className="size-4 text-reward" />
					<span className="hidden sm:inline">
						<kbd className="rounded bg-secondary px-1 font-mono">Ctrl</kbd>+
						<kbd className="rounded bg-secondary px-1 font-mono">Enter</kbd> run
						· <kbd className="rounded bg-secondary px-1 font-mono">Shift</kbd>{" "}
						to submit
					</span>
					<span className="sm:hidden">
						{runs} run{runs === 1 ? "" : "s"}
					</span>
				</div>
				<div className="flex gap-2">
					<Button
						type="button"
						onClick={run}
						disabled={busy || !!result || bossLost}
						variant="secondary"
						size="sm"
					>
						<Play data-icon="inline-start" /> Run
					</Button>
					<Button
						onClick={submit}
						disabled={busy || !!result || bossLost}
						size="sm"
						variant={mode === "boss" ? "destructive" : "success"}
					>
						<Send data-icon="inline-start" /> Submit
					</Button>
				</div>
			</div>
			<motion.div
				key={shakeKey}
				className={cn("min-h-0 flex-1", shakeKey > 0 && "shake")}
			>
				<SqlEditor
					ref={editorRef}
					value={sql}
					onChange={(v) => {
						setSql(v);
						saveDraft(v);
					}}
					onRun={run}
					onSubmit={submit}
					schema={schema}
					functions={functions.data}
					autocomplete={autocomplete}
					errorLine={errorLine}
					className="h-full"
					minHeight={isDesktop ? "100%" : "180px"}
				/>
			</motion.div>
			{!isDesktop ? (
				<QuickKeys
					className="-mx-3 mt-2"
					onKey={(k) => editorRef.current?.insert(k)}
				/>
			) : null}
		</div>
	);

	const results = (
		<ResultsPanel busy={busy} lastRun={lastRun} verdict={verdict} />
	);

	return (
		<div className="relative flex min-h-0 flex-1 flex-col">
			{isDesktop ? (
				<div className="h-[calc(100dvh-3.5rem)] shrink-0 p-3">
					<ResizablePanelGroup orientation="horizontal" className="gap-0">
						<ResizablePanel defaultSize="36%" minSize="22%">
							<ResizablePanelGroup orientation="vertical">
								<ResizablePanel defaultSize="52%" minSize="20%">
									<div className="panel h-full overflow-auto p-4">
										{missionCard}
									</div>
								</ResizablePanel>
								<ResizableHandle className="my-1 bg-transparent" withHandle />
								<ResizablePanel defaultSize="48%" minSize="15%">
									<div className="panel h-full overflow-hidden">
										<SchemaExplorer
											datasetId={chapter.datasetId}
											activeTables={activeTables}
										/>
									</div>
								</ResizablePanel>
							</ResizablePanelGroup>
						</ResizablePanel>
						<ResizableHandle className="mx-1 bg-transparent" withHandle />
						<ResizablePanel defaultSize="64%" minSize="35%">
							<ResizablePanelGroup orientation="vertical">
								<ResizablePanel defaultSize="46%" minSize="20%">
									<div className="panel h-full p-3">{editor}</div>
								</ResizablePanel>
								<ResizableHandle className="my-1 bg-transparent" withHandle />
								<ResizablePanel defaultSize="54%" minSize="15%">
									<div className="panel h-full overflow-auto p-3">
										{results}
									</div>
								</ResizablePanel>
							</ResizablePanelGroup>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			) : (
				<>
					<div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-24">
						{tab === "mission" ? missionCard : null}
						{tab === "schema" ? (
							<div className="panel h-[calc(100dvh-12rem)] overflow-hidden">
								<SchemaExplorer
									datasetId={chapter.datasetId}
									activeTables={activeTables}
									defaultView="cards"
								/>
							</div>
						) : null}
						{tab === "code" ? editor : null}
						{tab === "result" ? results : null}
					</div>
					<MobileTabs
						tab={tab}
						setTab={setTab}
						hasResult={!!(lastRun || verdict)}
						failed={!!verdict && !verdict.pass}
					/>
				</>
			)}

			<AnimatePresence>
				{result ? (
					<SolvedOverlay
						key="solved"
						exercise={exercise}
						result={result}
						isBoss={mode === "boss"}
						onNext={onNext}
						nextLabel={nextLabel}
					/>
				) : null}
				{bossLost ? (
					<BossDefeat
						key="defeat"
						chapter={chapter}
						onContinue={onBossDefeat ?? onNext}
					/>
				) : null}
			</AnimatePresence>
		</div>
	);
}

function MobileTabs({
	tab,
	setTab,
	hasResult,
	failed,
}: {
	tab: string;
	setTab: (t: "mission" | "schema" | "code" | "result") => void;
	hasResult: boolean;
	failed: boolean;
}) {
	const items = [
		["mission", Target, "Mission"],
		["schema", BookOpen, "Schema"],
		["code", Code2, "Code"],
		["result", Table2, "Result"],
	] as const;
	return (
		<nav
			className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[color-mix(in_oklab,var(--muted)_92%,transparent)] backdrop-blur"
			aria-label="Mission panels"
		>
			<div className="grid grid-cols-4">
				{items.map(([id, Icon, label]) => (
					<button
						key={id}
						type="button"
						onClick={() => setTab(id)}
						aria-current={tab === id}
						className={cn(
							"relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold",
							tab === id ? "text-reward" : "text-muted-foreground",
						)}
					>
						{tab === id ? (
							<motion.span
								layoutId="mobile-tab"
								className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-reward"
							/>
						) : null}
						<Icon className="size-5" />
						{label}
						{id === "result" && hasResult ? (
							<span
								className={cn(
									"absolute top-2 right-[30%] size-2 rounded-full",
									failed ? "bg-destructive" : "bg-success",
								)}
							/>
						) : null}
					</button>
				))}
			</div>
		</nav>
	);
}

function MissionCard({
	chapter,
	exercise,
	mode,
	failures,
	shownHints,
	freeHints,
	onHint,
	showRefresher,
	offerSolution,
	onReveal,
	lives,
	timeLeft,
}: {
	chapter: Chapter;
	exercise: Exercise;
	mode: MissionMode;
	failures: number;
	shownHints: number;
	freeHints: number;
	onHint: () => void;
	showRefresher: boolean;
	offerSolution: boolean;
	onReveal: () => void;
	lives?: number;
	timeLeft?: number;
}) {
	const badge =
		mode === "boss"
			? {
					label: "Boss fight",
					cls: "bg-destructive text-destructive-foreground",
				}
			: mode === "practice"
				? { label: "Practice drill", cls: "bg-info text-info-foreground" }
				: mode === "review"
					? { label: "Review", cls: "bg-special text-special-foreground" }
					: { label: "Mission", cls: "bg-reward text-reward-foreground" };
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<span
					className={cn(
						"rounded-full px-2.5 py-0.5 font-display text-[11px]",
						badge.cls,
					)}
				>
					{badge.label}
				</span>
				<span className="text-xs text-muted-foreground">
					{"◆".repeat(exercise.difficulty)}
					<span className="opacity-30">
						{"◆".repeat(5 - exercise.difficulty)}
					</span>
				</span>
				<span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
					{exercise.kind}
				</span>
				{lives !== undefined ? (
					<span
						className="ml-auto flex items-center gap-0.5"
						role="img"
						aria-label={`${lives} lives left`}
					>
						{(["life-1", "life-2", "life-3"] as const).map((id, i) => (
							<motion.span
								key={id}
								animate={
									i >= lives ? { scale: [1, 1.4, 0.8], opacity: 0.25 } : {}
								}
							>
								<Heart
									className="size-5 text-destructive"
									fill={i < lives ? "currentColor" : "none"}
								/>
							</motion.span>
						))}
					</span>
				) : null}
				{timeLeft !== undefined ? (
					<span
						className={cn(
							"flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-mono text-xs font-bold tabular-nums",
							timeLeft < 30
								? "animate-pulse text-destructive"
								: "text-foreground",
						)}
						aria-live="off"
					>
						<Timer className="size-3.5" />
						{Math.floor(Math.max(0, timeLeft) / 60)}:
						{String(Math.max(0, timeLeft) % 60).padStart(2, "0")}
					</span>
				) : null}
			</div>
			<div>
				<h2 className="font-display text-xl leading-tight text-foreground">
					{exercise.title}
				</h2>
				{exercise.story ? (
					<p className="mt-2 border-l-2 border-reward/60 pl-3 text-sm text-muted-foreground italic">
						{exercise.story}
					</p>
				) : null}
			</div>
			<div className="rounded-xl border border-border bg-muted p-3">
				<Markdown className="text-foreground">{exercise.prompt}</Markdown>
			</div>
			<div className="flex flex-wrap gap-1.5">
				{exercise.concepts.map((c) => (
					<span
						key={c}
						className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
					>
						{conceptName(c)}
					</span>
				))}
			</div>

			<div className="space-y-2">
				<AnimatePresence initial={false}>
					{exercise.hints.slice(0, shownHints).map((h, i) => (
						<motion.div
							key={h}
							initial={{ opacity: 0, y: -6, height: 0 }}
							animate={{ opacity: 1, y: 0, height: "auto" }}
							className="flex gap-2 rounded-xl border border-reward/40 bg-[color-mix(in_oklab,var(--reward)_10%,var(--card))] p-3 text-sm"
						>
							<Lightbulb className="mt-0.5 size-4 shrink-0 text-reward" />
							<div>
								<div className="text-[10px] font-bold tracking-widest text-reward uppercase">
									Hint {i + 1}
									{i < freeHints ? " · free" : ""}
								</div>
								<Markdown className="text-foreground">{h}</Markdown>
							</div>
						</motion.div>
					))}
				</AnimatePresence>
				{shownHints < exercise.hints.length ? (
					<button
						type="button"
						onClick={onHint}
						className="flex w-full items-center justify-between rounded-xl border border-dashed border-reward/50 px-3 py-2 text-sm font-semibold text-reward hover:bg-[color-mix(in_oklab,var(--reward)_8%,transparent)]"
					>
						<span className="flex items-center gap-2">
							<Lightbulb className="size-4" /> Reveal hint {shownHints + 1}/
							{exercise.hints.length}
						</span>
						<span className="font-mono text-xs">−{HINT_XP_COST} XP</span>
					</button>
				) : null}
			</div>

			<AnimatePresence>
				{showRefresher ? (
					<motion.div
						initial={{ opacity: 0, scale: 0.96 }}
						animate={{ opacity: 1, scale: 1 }}
						className="rounded-xl border border-info/50 bg-[color-mix(in_oklab,var(--info)_8%,var(--card))] p-3"
					>
						<div className="mb-1 flex items-center gap-2 text-xs font-bold tracking-widest text-info uppercase">
							<BookOpen className="size-4" /> Quick refresher
						</div>
						<p className="mb-2 text-xs text-muted-foreground">
							{failures} tries so far. Here is the idea again:
						</p>
						<ul className="space-y-1.5">
							{exercise.concepts.map((c) => (
								<li key={c} className="text-sm">
									<span className="font-bold text-foreground">
										{conceptName(c)}
									</span>
									{conceptById.get(c)?.summary ? (
										<span className="text-muted-foreground">
											{" "}
											· {conceptById.get(c)?.summary}
										</span>
									) : null}
								</li>
							))}
						</ul>
						<Link
							to="/play/$chapterId"
							params={{ chapterId: chapter.id }}
							search={{ phase: "learn" }}
							className="mt-2 inline-block text-xs font-bold text-info"
						>
							Replay the lesson →
						</Link>
					</motion.div>
				) : null}
			</AnimatePresence>

			{offerSolution ? (
				<button
					type="button"
					onClick={onReveal}
					className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/50 px-3 py-2 text-sm font-semibold text-destructive hover:bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)]"
				>
					<Eye className="size-4" /> Show the solution (0 stars)
				</button>
			) : null}
		</div>
	);
}

function ResultsPanel({
	busy,
	lastRun,
	verdict,
}: {
	busy: boolean;
	lastRun: RunOutcome | null;
	verdict: Verdict | null;
}) {
	if (busy)
		return (
			<div className="grid h-full min-h-40 place-items-center">
				<div className="flex items-center gap-3 text-sm text-muted-foreground">
					<span className="size-6 animate-spin rounded-full border-4 border-secondary border-t-info" />
					Postgres is thinking…
				</div>
			</div>
		);
	if (!lastRun && !verdict)
		return (
			<div className="grid h-full min-h-40 place-items-center text-center text-sm text-muted-foreground">
				<div>
					<Table2 className="mx-auto mb-2 size-8 opacity-50" />
					Run your query to see the result here.
					<br />
					Submit when you think it is right.
				</div>
			</div>
		);

	if (lastRun) {
		return (
			<div className="space-y-3">
				{lastRun.ok ? (
					<div className="text-xs text-muted-foreground">
						Ran in {lastRun.durationMs} ms · {lastRun.results.length} statement
						{lastRun.results.length === 1 ? "" : "s"}. Not judged yet: press
						Submit.
					</div>
				) : (
					<ErrorBanner
						title={lastRun.errorType === "timeout" ? "Timeout" : "Error"}
						message={lastRun.error?.message ?? "Query failed"}
						code={lastRun.error?.code}
						where={
							lastRun.error?.line
								? `line ${lastRun.error.line}, col ${lastRun.error.column}`
								: undefined
						}
						hint={lastRun.error?.hint}
					/>
				)}
				{lastRun.ok ? (
					<ResultGrid
						table={lastRun.last ?? lastRun.results.at(-1)}
						caption="Your result"
					/>
				) : null}
			</div>
		);
	}

	const v = verdict as Verdict;
	return (
		<div className="space-y-3">
			<motion.div
				initial={{ y: -8, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				className={cn(
					"rounded-xl border-2 p-3",
					v.pass
						? "border-success bg-[color-mix(in_oklab,var(--success)_10%,var(--card))]"
						: "border-destructive bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))]",
				)}
				role="status"
			>
				<div
					className={cn(
						"font-display text-base",
						v.pass ? "text-success" : "text-destructive",
					)}
				>
					{v.pass ? "✓ " : "✗ "}
					{v.title}
				</div>
				<p className="mt-1 text-sm text-foreground">{v.message}</p>
				{v.sqlError?.code ? (
					<div className="mt-1 font-mono text-[11px] text-muted-foreground">
						SQLSTATE {v.sqlError.code}
						{v.sqlError.line
							? ` · line ${v.sqlError.line}, col ${v.sqlError.column}`
							: ""}
					</div>
				) : null}
			</motion.div>
			{v.learnerLast || v.learnerResults.length ? (
				<ResultGrid
					table={v.learnerLast ?? v.learnerResults.at(-1)}
					caption="Your result"
				/>
			) : null}
			{v.diff && !v.pass ? (
				<div>
					<div className="mb-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase">
						Expected vs yours
					</div>
					<DiffView diff={v.diff} expected={v.expected} got={v.learnerLast} />
				</div>
			) : null}
			{v.stateDiff && !v.pass ? (
				<div>
					<div className="mb-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase">
						Final state of the database
					</div>
					<DiffView
						diff={v.stateDiff}
						expected={v.stateExpected}
						got={v.stateGot}
						labels={["Expected state", "Your state"]}
					/>
				</div>
			) : null}
		</div>
	);
}

function ErrorBanner({
	title,
	message,
	code,
	where,
	hint,
}: {
	title: string;
	message: string;
	code?: string;
	where?: string;
	hint?: string;
}) {
	return (
		<div
			className="rounded-xl border-2 border-destructive bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] p-3"
			role="alert"
		>
			<div className="font-display text-sm text-destructive">{title}</div>
			<p className="mt-1 font-mono text-xs text-foreground">{message}</p>
			{code || where ? (
				<div className="mt-1 font-mono text-[11px] text-muted-foreground">
					{code ? `SQLSTATE ${code}` : ""}
					{where ? ` · ${where}` : ""}
				</div>
			) : null}
			{hint ? (
				<p className="mt-1 text-xs text-muted-foreground">Hint: {hint}</p>
			) : null}
		</div>
	);
}

function BossDefeat({
	chapter,
	onContinue,
}: {
	chapter: Chapter;
	onContinue: () => void;
}) {
	useEffect(() => {
		sfx("boss");
	}, []);
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur"
			role="dialog"
			aria-labelledby="defeat-title"
		>
			<motion.div
				initial={{ scale: 0.8, y: 30 }}
				animate={{ scale: 1, y: 0 }}
				transition={{ type: "spring", stiffness: 200, damping: 16 }}
				className="panel max-w-md p-6 text-center"
			>
				<div className="text-6xl">💀</div>
				<h2
					id="defeat-title"
					className="mt-2 font-display text-2xl text-destructive"
				>
					The boss won this round
				</h2>
				<p className="mt-2 text-sm text-muted-foreground">
					No shame in it. A short training gauntlet targeted at the concepts of{" "}
					<b className="text-foreground">{chapter.title}</b> is now open. Clear
					it and the boss gate opens again.
				</p>
				<Button
					type="button"
					onClick={onContinue}
					variant="destructive"
					size="lg"
					className="mt-5"
				>
					To the training grounds
				</Button>
			</motion.div>
		</motion.div>
	);
}
