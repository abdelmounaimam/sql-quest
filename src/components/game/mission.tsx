import { useDebouncedValue } from "@tanstack/react-pacer";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Chapter, Exercise } from "#/content/types";
import { feedbackPolicy, HINT_XP_COST } from "#/engine/adaptive";
import type { AttemptKind } from "#/engine/adaptive/types";
import { sqlErrorAdvice } from "#/engine/checker/errors";
import type { ErrorType, RunOutcome, Verdict } from "#/engine/checker/types";
import { sqlClient } from "#/engine/sql/client";
import { recordAttempt, useGame } from "#/game/progress";
import { haptic, sfx } from "#/game/sound";
import {
	functionsQuery,
	referencedTables,
	useCatalog,
} from "#/game/sql-queries";
import { useIsDesktop } from "#/hooks/use-media";
import { conceptById, conceptName, datasetById } from "#/lib/content";
import { cn } from "#/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "../ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "../ui/drawer";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "../ui/resizable";
import { Spinner } from "../ui/spinner";
import { prefersReducedMotion } from "./fx";
import { AetherStat, ComboChip, StreakStat } from "./hud";
import { GameIcon, Wick, type WickMood } from "./icons";
import { Markdown } from "./markdown";
import { DiffView, ResultGrid } from "./result-grid";
import { SchemaExplorer } from "./schema-explorer";
import { SqlComposer, type SqlComposerHandle } from "./sql-composer";
import { StatementLog } from "./statement-log";
import {
	ErrorLineQuote,
	type SolvedResult,
	VerdictSheet,
	verdictAdvice,
	verdictTitle,
} from "./verdict";

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

export interface Segment {
	id: string;
	done: boolean;
}

/** Level HUD: quit, segmented progress, combo, hearth, aether (+ hearts and clock for bosses). */
export function LevelHud({
	chapter,
	segments,
	currentId,
	lives,
	timeLeft,
}: {
	chapter: Chapter;
	segments: Segment[];
	currentId?: string;
	lives?: number;
	timeLeft?: number;
}) {
	return (
		<div className="px-3 pt-safe-2 lg:px-4 lg:pt-safe-3">
			<div className="hud-bar">
				<Button
					asChild
					variant="ghost"
					size="icon-sm"
					aria-label="Quit the level"
				>
					<Link
						to="/play/$chapterId"
						params={{ chapterId: chapter.id }}
						search={{ phase: "hub" }}
					>
						<GameIcon name="x" className="size-5" />
					</Link>
				</Button>
				<div
					className="seg"
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={segments.length}
					aria-valuenow={segments.filter((s) => s.done).length}
					aria-label="Level progress"
				>
					{segments.map((s) => (
						<i
							key={s.id}
							className={cn(
								s.done && "on",
								!s.done && s.id === currentId && "now",
							)}
						/>
					))}
				</div>
				{lives !== undefined ? (
					<span
						className="stat heart"
						role="img"
						aria-label={`${lives} hearts left`}
					>
						{(["heart-1", "heart-2", "heart-3"] as const).map((id, i) => (
							<GameIcon
								key={id}
								name="heart"
								className={cn(i >= lives && "opacity-25")}
							/>
						))}
					</span>
				) : null}
				{timeLeft !== undefined ? (
					<span
						className={cn(
							"stat",
							timeLeft < 30
								? "text-destructive-soft-foreground"
								: "text-muted-foreground",
						)}
					>
						<GameIcon name="clock" />
						{Math.floor(Math.max(0, timeLeft) / 60)}:
						{String(Math.max(0, timeLeft) % 60).padStart(2, "0")}
					</span>
				) : null}
				<ComboChip />
				<StreakStat className="hidden sm:inline-flex" />
				<AetherStat />
			</div>
		</div>
	);
}

export function MissionScreen({
	chapter,
	exercise,
	mode,
	world,
	segments,
	onNext,
	onBossDefeat,
	nextLabel = "Continue",
}: {
	chapter: Chapter;
	exercise: Exercise;
	mode: MissionMode;
	world: number;
	segments: Segment[];
	onNext: () => void;
	onBossDefeat?: () => void;
	nextLabel?: string;
}) {
	const isDesktop = useIsDesktop();
	const autocomplete = useGame((s) => s.settings.autocomplete);
	const bossTimerOn = useGame((s) => s.settings.bossTimer);
	const editorRef = useRef<SqlComposerHandle>(null);

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
	const [sheetOpen, setSheetOpen] = useState(false);
	const [result, setResult] = useState<SolvedResult | null>(null);
	const [bossLost, setBossLost] = useState(false);
	const [shakeKey, setShakeKey] = useState(0);
	const [drawer, setDrawer] = useState<null | "schema" | "results">(null);
	const [snap, setSnap] = useState<number | string | null>(0.45);
	const [mood, setMood] = useState<WickMood>("idle");
	const [submittedSql, setSubmittedSql] = useState("");
	const [judgeSeq, setJudgeSeq] = useState(0);
	// Last learner SQL replayed in a sandbox so the chests show what it created.
	const [liveRun, setLiveRun] = useState({ sql: "", seq: 0 });

	// A new mission (Continue remounts this screen) starts at the top: HUD,
	// title and goal first, wherever the previous one was scrolled.
	useLayoutEffect(() => {
		window.scrollTo(0, 0);
	}, []);

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

	// Written on every change (localStorage is synchronous and cheap), so
	// quitting right after the last tap or keystroke never loses the draft.
	const saveDraft = (v: string) => {
		try {
			localStorage.setItem(draftKey(exercise.id), v);
		} catch {
			// ignore
		}
	};

	const catalog = useCatalog(chapter.datasetId);
	const functions = useQuery(functionsQuery(chapter.datasetId));
	const schema = useMemo(() => {
		if (!catalog.data) return undefined;
		return Object.fromEntries(
			catalog.data.tables.map((t) => [t.name, t.columns.map((c) => c.name)]),
		);
	}, [catalog.data]);
	const [debouncedSql] = useDebouncedValue(sql, { wait: 150 });
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
		onMutate: () => setMood("thinking"),
		onSuccess: (out, text) => {
			setLiveRun((r) => ({ sql: text, seq: r.seq + 1 }));
			setLastRun(out);
			setVerdict(null);
			setSheetOpen(false);
			setMood(out.ok ? "idle" : "sad");
			if (!isDesktop) {
				setSnap(0.45);
				setDrawer("results");
			}
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
		// The sheet rises the moment Submit is pressed ("Checking…") and turns
		// into the verdict in place, so the wait never feels like a dead tap.
		onMutate: (text) => {
			sfx("run");
			setMood("thinking");
			setSubmittedSql(text);
			setVerdict(null);
			setDrawer(null);
			setJudgeSeq((n) => n + 1);
			setSheetOpen(true);
		},
		onError: () => {
			// The worker failed, not the learner: same sheet as an engine hiccup.
			setVerdict({
				pass: false,
				errorType: "internal",
				title: "Engine hiccup",
				message: "",
				learnerResults: [],
				statements: [],
				durationMs: 0,
			});
			setMood("idle");
		},
		onSuccess: (v, text) => {
			setLiveRun((r) => ({ sql: text, seq: r.seq + 1 }));
			setVerdict(v);
			setLastRun(null);
			setDrawer(null);
			setSheetOpen(true);
			if (v.pass) {
				const reward = finish(true, false);
				setResult({ reward, revealed: false });
				setMood("happy");
				sfx("success");
				if (reward.combo >= 2)
					window.setTimeout(() => sfx("combo", reward.combo), 220);
				return;
			}
			// The engine failed, not the learner: no failure, no lost heart, no
			// mastery penalty. The sheet says so and offers a retry.
			if (v.errorType === "internal") {
				setMood("idle");
				return;
			}
			const f = failures + 1;
			const errs = v.errorType ? [...errorTypes, v.errorType] : errorTypes;
			setFailures(f);
			setErrorTypes(errs);
			setShakeKey((k) => k + 1);
			setMood("sad");
			sfx("fail");
			if (mode === "boss" && f >= BOSS_LIVES) {
				finish(false, false, { failures: f, errors: errs });
				setSheetOpen(false);
				setBossLost(true);
			}
		},
	});

	const busy = runMut.isPending || judgeMut.isPending;
	const locked = busy || !!result || bossLost;
	const empty = !sql.trim();
	const run = () => {
		if (locked || empty) return;
		setRuns((r) => r + 1);
		runMut.mutate(sql);
	};
	const cast = () => {
		if (locked || empty) return;
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
		setResult({ reward, revealed: true });
		setSheetOpen(true);
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
	const dataset = datasetById.get(chapter.datasetId);

	const missionCard = (
		<MissionCard
			chapter={chapter}
			exercise={exercise}
			mode={mode}
			world={world}
			datasetName={dataset?.name}
			failures={failures}
			shownHints={shownHints}
			freeHints={freeHints}
			onHint={revealHint}
			showRefresher={policy.showRefresher}
			offerSolution={policy.offerSolution && !revealed && !result}
			onReveal={revealSolution}
			collapsible={!isDesktop}
		/>
	);

	const castLabel = "Submit";
	const castButton = (
		<Button
			onClick={cast}
			disabled={(locked && !busy) || empty}
			title={empty ? "Build a query first" : undefined}
			data-pressed={judgeMut.isPending ? "true" : undefined}
			variant={mode === "boss" ? "danger" : "default"}
			size={isDesktop ? "lg" : "xl"}
			className={cn(
				isDesktop
					? "min-w-[180px]"
					: "min-w-0 flex-1 max-[374px]:gap-0 max-[374px]:px-2 max-[374px]:text-lg max-[374px]:[&_svg]:hidden",
			)}
			aria-keyshortcuts="Control+Shift+Enter"
		>
			{judgeMut.isPending ? (
				<Spinner data-icon="inline-start" />
			) : (
				<GameIcon name="wand" data-icon="inline-start" />
			)}
			{judgeMut.isPending ? "Checking" : castLabel}
		</Button>
	);

	const lanternButton =
		shownHints < exercise.hints.length && !result ? (
			<Button
				variant="ghost-glow"
				onClick={revealHint}
				aria-label={`Reveal a hint, costs ${HINT_XP_COST} XP`}
			>
				<GameIcon name="bulb" data-icon="inline-start" />
				<span className={cn(!isDesktop && "sr-only")}>Hint</span>
				<Badge variant="xp">−{HINT_XP_COST}</Badge>
			</Button>
		) : null;

	const spellbook = (
		<motion.div
			key={shakeKey}
			className={cn(
				"spell-frame",
				isDesktop && "h-full min-h-0",
				shakeKey > 0 && "shake",
			)}
			data-casting={busy}
		>
			<span className="rune-sweep" aria-hidden="true" />
			{isDesktop ? (
				<div className="spell-top">
					<Wick mood={mood} className="h-8 w-7" />
					<span className="font-extrabold">Query</span>
					<span className="hidden text-xs text-muted-foreground xl:inline">
						<kbd className="keycap">Ctrl</kbd> +{" "}
						<kbd className="keycap">Enter</kbd> test ·{" "}
						<kbd className="keycap">Shift</kbd> submits
					</span>
					<span className="ml-auto" />
					<Button
						variant="secondary"
						size="sm"
						onClick={run}
						disabled={locked || empty}
						aria-keyshortcuts="Control+Enter"
					>
						{runMut.isPending ? (
							<Spinner data-icon="inline-start" />
						) : (
							<GameIcon
								name="play"
								className="size-5"
								data-icon="inline-start"
							/>
						)}
						Test
					</Button>
				</div>
			) : null}
			<div className={cn(isDesktop && "min-h-0 flex-1")}>
				<SqlComposer
					ref={editorRef}
					value={sql}
					onChange={(v) => {
						setSql(v);
						saveDraft(v);
					}}
					solutionSql={exercise.solutionSql}
					starterSql={exercise.starterSql}
					seed={exercise.id}
					catalog={catalog.data}
					onRun={run}
					onSubmit={cast}
					functions={functions.data}
					autocomplete={autocomplete}
					errorLine={errorLine}
					fill={isDesktop}
					minHeight={isDesktop ? "100%" : "8.5rem"}
					prompt={<FocusTask prompt={exercise.prompt} />}
					keyboardActions={
						<>
							<button
								type="button"
								className="suggest-icon"
								aria-label="Test the query"
								onClick={run}
								disabled={locked || empty}
							>
								<GameIcon name="play" className="size-5" />
							</button>
							<Button
								size="sm"
								onClick={cast}
								disabled={(locked && !busy) || empty}
							>
								{castLabel}
							</Button>
						</>
					}
				/>
			</div>
			{isDesktop ? (
				<div className="spell-bottom">
					{lanternButton}
					<span className="flex-1" />
					{castButton}
				</div>
			) : null}
		</motion.div>
	);

	const results = (
		<ResultsPanel
			busy={busy}
			lastRun={lastRun}
			verdict={verdict}
			sql={liveRun.sql}
			solutionSql={exercise.solutionSql}
		/>
	);

	return (
		<div className="relative flex min-h-dvh flex-col" data-world={world}>
			<LevelHud
				chapter={chapter}
				segments={segments}
				currentId={exercise.id}
				lives={mode === "boss" ? BOSS_LIVES - failures : undefined}
				timeLeft={timerActive ? timeLeft : undefined}
			/>
			{isDesktop ? (
				<div className="h-[calc(100dvh-4.75rem-var(--safe-top))] p-3 lg:px-4">
					<ResizablePanelGroup orientation="horizontal">
						<ResizablePanel defaultSize="32%" minSize="22%">
							<ResizablePanelGroup orientation="vertical">
								<ResizablePanel defaultSize="50%" minSize="20%">
									<div className="h-full overflow-y-auto overscroll-contain pr-1 pb-2">
										{missionCard}
									</div>
								</ResizablePanel>
								<ResizableHandle withHandle className="my-1" />
								<ResizablePanel defaultSize="50%" minSize="15%">
									<div className="panel h-full overflow-hidden">
										<SchemaExplorer
											datasetId={chapter.datasetId}
											activeTables={activeTables}
											sql={debouncedSql}
											setupSql={exercise.setupSql}
											liveSql={liveRun.sql}
											liveSeq={liveRun.seq}
										/>
									</div>
								</ResizablePanel>
							</ResizablePanelGroup>
						</ResizablePanel>
						<ResizableHandle withHandle className="mx-1" />
						<ResizablePanel defaultSize="68%" minSize="35%">
							<ResizablePanelGroup orientation="vertical">
								<ResizablePanel defaultSize="55%" minSize="25%">
									<div className="h-full pb-1">{spellbook}</div>
								</ResizablePanel>
								<ResizableHandle withHandle className="my-1" />
								<ResizablePanel defaultSize="45%" minSize="15%">
									<div
										className={cn(
											"h-full overflow-y-auto overscroll-contain",
											sheetOpen && "pb-56",
										)}
									>
										{results}
									</div>
								</ResizablePanel>
							</ResizablePanelGroup>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			) : (
				<>
					<div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pt-3 pb-[calc(6.5rem+var(--safe-bottom)+var(--kb-inset))]">
						{missionCard}
						{spellbook}
					</div>
					<div
						data-bottom-bar
						// Hidden under the verdict sheet, so its ledge never peeks out.
						data-covered={sheetOpen && !bossLost ? "" : undefined}
						className="bottom-bar z-30 border-t-2 border-border bg-card px-safe-3 pt-2 pb-safe"
					>
						<div className="flex items-center gap-2 pb-2">
							<Button
								variant="secondary"
								size="icon"
								className="max-[374px]:size-11"
								aria-label="Schema"
								onClick={() => {
									// Full height: the chest list is long and the diagram needs the room.
									setSnap(0.92);
									setDrawer("schema");
								}}
							>
								<GameIcon name="database" />
							</Button>
							<Button
								variant="secondary"
								size="icon"
								className="max-[374px]:size-11"
								aria-label="Results"
								onClick={() => {
									setSnap(0.45);
									setDrawer("results");
								}}
							>
								<GameIcon name="table" />
							</Button>
							<Button
								variant="secondary"
								className="px-3.5 max-[374px]:size-11 max-[374px]:px-0 max-[374px]:[&>span]:sr-only"
								onClick={run}
								disabled={locked || empty}
								aria-keyshortcuts="Control+Enter"
							>
								{runMut.isPending ? (
									<Spinner data-icon="inline-start" />
								) : (
									<GameIcon
										name="play"
										className="size-5"
										data-icon="inline-start"
									/>
								)}
								<span>Test</span>
							</Button>
							{castButton}
						</div>
					</div>
					<Drawer
						open={drawer !== null}
						onOpenChange={(o) => !o && setDrawer(null)}
						snapPoints={[0.45, 0.92]}
						activeSnapPoint={snap}
						setActiveSnapPoint={setSnap}
					>
						<DrawerContent
							className="h-[96dvh] overscroll-contain"
							data-world={world}
						>
							{/* The results panel names itself (with the row count): no second title. */}
							<DrawerTitle
								className={cn(
									"px-4 pt-2 font-display text-xl",
									drawer !== "schema" && "sr-only",
								)}
							>
								{drawer === "schema" ? "Schema" : "Results"}
							</DrawerTitle>
							<div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4">
								{drawer === "schema" ? (
									<SchemaExplorer
										datasetId={chapter.datasetId}
										activeTables={activeTables}
										sql={debouncedSql}
										setupSql={exercise.setupSql}
										liveSql={liveRun.sql}
										liveSeq={liveRun.seq}
									/>
								) : (
									<div className="px-2">{results}</div>
								)}
							</div>
						</DrawerContent>
					</Drawer>
				</>
			)}

			<AnimatePresence>
				{sheetOpen && !bossLost ? (
					<VerdictSheet
						key={result?.revealed ? "revealed" : `judge-${judgeSeq}`}
						exercise={exercise}
						verdict={verdict}
						solved={result}
						checking={judgeMut.isPending}
						sql={submittedSql}
						isBoss={mode === "boss"}
						onContinue={onNext}
						onRetry={() => {
							setSheetOpen(false);
							setMood("idle");
							editorRef.current?.focus();
						}}
						onDismiss={() => {
							setSheetOpen(false);
							setMood("idle");
						}}
						onHint={
							shownHints < exercise.hints.length
								? () => {
										revealHint();
										setSheetOpen(false);
									}
								: undefined
						}
						continueLabel={nextLabel}
					/>
				) : null}
			</AnimatePresence>
			<BossDefeat
				open={bossLost}
				chapter={chapter}
				onContinue={onBossDefeat ?? onNext}
			/>
		</div>
	);
}

/**
 * The task, repeated above the editor while typing full screen on a phone.
 * Two lines by default so the editor keeps the room; "More" shows it all
 * (long boss specs scroll inside). The toggle never takes focus from the
 * editor, so the keyboard stays up.
 */
export function FocusTask({ prompt }: { prompt: string }) {
	const [open, setOpen] = useState(false);
	const [long, setLong] = useState(false);
	const textRef = useRef<HTMLDivElement>(null);
	const suppressClick = useRef(0);
	useLayoutEffect(() => {
		const el = textRef.current;
		if (!el) return;
		const measure = () =>
			setLong(open || el.scrollHeight > el.clientHeight + 2);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [open]);
	const toggle = () => setOpen((o) => !o);
	return (
		<div className="focus-task" data-open={open ? "" : undefined}>
			<div className="focus-task-head">
				<span>Your task</span>
				{long ? (
					<button
						type="button"
						className="focus-task-more"
						aria-expanded={open}
						onPointerDown={(e) => e.preventDefault()}
						onPointerUp={(e) => {
							if (e.pointerType === "mouse") return;
							suppressClick.current = Date.now() + 500;
							toggle();
						}}
						onClick={() => {
							if (Date.now() < suppressClick.current) return;
							toggle();
						}}
					>
						{open ? "Less" : "More"}
						<GameIcon
							name="chevron-down"
							className={cn("size-4", open && "rotate-180")}
						/>
					</button>
				) : null}
			</div>
			<div
				ref={textRef}
				className="focus-task-text"
				data-fade={long && !open ? "" : undefined}
			>
				<Markdown className="text-foreground">{prompt}</Markdown>
			</div>
		</div>
	);
}

function MissionCard({
	chapter,
	exercise,
	mode,
	world,
	datasetName,
	failures,
	shownHints,
	freeHints,
	onHint,
	showRefresher,
	offerSolution,
	onReveal,
	collapsible,
}: {
	chapter: Chapter;
	exercise: Exercise;
	mode: MissionMode;
	world: number;
	datasetName?: string;
	failures: number;
	shownHints: number;
	freeHints: number;
	onHint: () => void;
	showRefresher: boolean;
	offerSolution: boolean;
	onReveal: () => void;
	collapsible: boolean;
}) {
	// Phones: compact by default (title + the goal in three lines), so the
	// query and the word bank are on screen together. Help (hints, refresher,
	// the solution offer) never hides behind the collapse.
	const [open, setOpen] = useState(!collapsible);
	const [clipped, setClipped] = useState(false);
	const goalRef = useRef<HTMLDivElement>(null);
	const compact = collapsible && !open;
	useLayoutEffect(() => {
		const el = goalRef.current;
		if (!el || !compact) {
			setClipped(false);
			return;
		}
		const measure = () => setClipped(el.scrollHeight > el.clientHeight + 2);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [compact]);

	// A new hint (paid, free, or asked from the verdict sheet) scrolls into view.
	const helpRef = useRef<HTMLDivElement>(null);
	const seenHints = useRef(shownHints);
	useEffect(() => {
		if (shownHints <= seenHints.current) return;
		seenHints.current = shownHints;
		const id = window.setTimeout(() => {
			helpRef.current
				?.querySelector<HTMLElement>(`[data-hint="${shownHints - 1}"]`)
				?.scrollIntoView({
					block: "nearest",
					behavior: prefersReducedMotion() ? "auto" : "smooth",
				});
		}, 60);
		return () => window.clearTimeout(id);
	}, [shownHints]);

	const kicker =
		mode === "boss"
			? "Guardian"
			: mode === "practice"
				? "Practice drill"
				: mode === "review"
					? "Review"
					: "Mission";

	const ribbon = (
		<div className="mission-ribbon world-motif" data-world={world}>
			<div className="min-w-0 flex-1">
				<div className="k">
					<span className="whitespace-nowrap">{kicker} · </span>
					{datasetName ? (
						<span
							className={cn(
								"whitespace-nowrap",
								collapsible && "max-sm:hidden",
							)}
						>
							{datasetName} ·{" "}
						</span>
					) : null}
					<span
						className="whitespace-nowrap"
						role="img"
						aria-label={`Difficulty ${exercise.difficulty} of 3`}
					>
						{"◆".repeat(exercise.difficulty)}
					</span>
				</div>
				<h2 className="t">{exercise.title}</h2>
			</div>
			{collapsible ? (
				<CollapsibleTrigger asChild>
					<button
						type="button"
						className="tap-target grid size-9 place-items-center rounded-md"
						aria-label={open ? "Show less" : "Show the whole mission"}
					>
						<GameIcon
							name="chevron-down"
							className={cn(
								"size-5 transition-transform duration-200 ease-out",
								open && "rotate-180",
							)}
						/>
					</button>
				</CollapsibleTrigger>
			) : null}
		</div>
	);

	const hintsLeft = shownHints < exercise.hints.length;
	const hintButton = hintsLeft ? (
		<Button
			variant="ghost-glow"
			size="sm"
			className="self-start"
			onClick={onHint}
			aria-label={`Show hint ${shownHints + 1} of ${exercise.hints.length}, costs ${HINT_XP_COST} XP`}
		>
			<GameIcon name="bulb" data-icon="inline-start" />
			{collapsible ? "Hint" : "Show hint"} {shownHints + 1}/
			{exercise.hints.length}
			<Badge variant="xp">−{HINT_XP_COST} XP</Badge>
		</Button>
	) : null;

	const goal = (
		<div className="goal-box" data-clamped={compact ? "" : undefined}>
			<GameIcon name="target" className="size-5" />
			<div className="min-w-0 flex-1">
				<div
					ref={goalRef}
					className="goal-text"
					data-fade={clipped || undefined}
				>
					<Markdown className="min-w-0 text-foreground">
						{exercise.prompt}
					</Markdown>
				</div>
				{collapsible && (clipped || hintButton) ? (
					<div className="goal-tools">
						{clipped ? (
							<button
								type="button"
								className="goal-more"
								onClick={() => setOpen(true)}
							>
								Read all
								<GameIcon name="chevron-down" className="size-4" />
							</button>
						) : null}
						<span className="flex-1" />
						{hintButton}
					</div>
				) : null}
			</div>
		</div>
	);

	const badges = (
		<div className="flex flex-wrap gap-1.5">
			{exercise.concepts.map((c) => (
				<Badge key={c} variant="success">
					{conceptName(c)}
				</Badge>
			))}
			<Badge variant="outline">{exercise.kind}</Badge>
		</div>
	);

	const help = (
		<div ref={helpRef} className="flex flex-col gap-3 empty:hidden">
			<AnimatePresence initial={false}>
				{exercise.hints.slice(0, shownHints).map((h, i) => (
					<motion.div
						key={h}
						data-hint={i}
						className="scroll-mt-[calc(var(--safe-top)+1rem)] scroll-mb-[calc(6.5rem+var(--safe-bottom))]"
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
					>
						<Alert variant="info">
							<GameIcon name="bulb" />
							<AlertTitle>
								Hint {i + 1}
								{i < freeHints ? " · free" : ""}
							</AlertTitle>
							<AlertDescription>
								<Markdown className="text-info-soft-foreground">{h}</Markdown>
							</AlertDescription>
						</Alert>
					</motion.div>
				))}
			</AnimatePresence>
			{!collapsible ? hintButton : null}
			{showRefresher ? (
				<Alert variant="lore">
					<GameIcon name="scroll" />
					<AlertTitle>Quick refresher</AlertTitle>
					<AlertDescription>
						<p className="mb-1 text-sm">
							{failures} attempts so far. Here is the idea again:
						</p>
						<ul className="flex flex-col gap-1">
							{exercise.concepts.map((c) => (
								<li key={c} className="text-sm">
									<b>{conceptName(c)}</b>
									{conceptById.get(c)?.summary ? (
										<span> · {conceptById.get(c)?.summary}</span>
									) : null}
								</li>
							))}
						</ul>
						<Link
							to="/play/$chapterId"
							params={{ chapterId: chapter.id }}
							search={{ phase: "learn" }}
							className="mt-1 inline-block text-sm font-extrabold underline underline-offset-4"
						>
							Replay the lesson
						</Link>
					</AlertDescription>
				</Alert>
			) : null}
			{offerSolution ? (
				<Button
					variant="outline"
					size="sm"
					className="self-start text-destructive-soft-foreground"
					onClick={onReveal}
				>
					<GameIcon name="eye" className="size-5" data-icon="inline-start" />{" "}
					Show the solution (0 stars)
				</Button>
			) : null}
		</div>
	);

	if (collapsible)
		return (
			<Collapsible open={open} onOpenChange={setOpen} asChild>
				<Card variant="mission" data-world={world} data-compact="">
					{ribbon}
					<div className="flex flex-col gap-3 p-3">
						{exercise.story && open ? (
							<p className="text-sm text-muted-foreground">{exercise.story}</p>
						) : null}
						{goal}
						{help}
						<CollapsibleContent>{badges}</CollapsibleContent>
					</div>
				</Card>
			</Collapsible>
		);

	return (
		<Card variant="mission" data-world={world}>
			{ribbon}
			<div className="flex flex-col gap-3 p-4">
				{exercise.story ? (
					<p className="text-muted-foreground">{exercise.story}</p>
				) : null}
				{goal}
				{badges}
				{help}
			</div>
		</Card>
	);
}

function ResultsPanel({
	busy,
	lastRun,
	verdict,
	sql,
	solutionSql,
}: {
	busy: boolean;
	lastRun: RunOutcome | null;
	verdict: Verdict | null;
	/** The SQL that produced lastRun or verdict, to quote the failing line. */
	sql: string;
	solutionSql: string;
}) {
	if (busy)
		return (
			<div className="panel grid h-full min-h-40 place-items-center p-6">
				<div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
					<Spinner className="size-6 text-lantern" />
					Running…
				</div>
			</div>
		);
	if (!lastRun && !verdict)
		return (
			<div className="panel grid h-full min-h-40 place-items-center p-6 text-center">
				<div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
					<Wick mood="sleeping" className="h-14 w-12" />
					<span className="font-bold">Results appear here.</span>
					<span>
						Test your query to preview the result, submit it when you are sure.
					</span>
				</div>
			</div>
		);

	if (lastRun) {
		return (
			<div className="flex flex-col gap-3">
				{lastRun.ok ? null : (
					<Alert variant="destructive">
						<GameIcon name="x" />
						<AlertTitle>
							{lastRun.errorType === "timeout" ? "Query timed out" : "Error"}
							{lastRun.error?.code ? (
								<span className="rune ml-2">
									Error code {lastRun.error.code}
								</span>
							) : null}
						</AlertTitle>
						<AlertDescription>
							{lastRun.error && sqlErrorAdvice(lastRun.error) ? (
								<p>{sqlErrorAdvice(lastRun.error)}</p>
							) : null}
							<p className="font-mono text-xs">
								{lastRun.error?.message ?? "Query failed"}
							</p>
							{lastRun.error ? (
								<ErrorLineQuote sql={sql} error={lastRun.error} />
							) : null}
							{lastRun.error?.hint ? (
								<p className="text-xs">Postgres adds: {lastRun.error.hint}</p>
							) : null}
						</AlertDescription>
					</Alert>
				)}
				{(lastRun.statements?.length ?? 0) > 1 ? (
					<StatementLog statements={lastRun.statements} />
				) : null}
				{lastRun.ok ? (
					<ResultGrid
						table={lastRun.last ?? lastRun.results.at(-1)}
						meta={
							<Badge variant="info" className="tabular">
								test · {lastRun.durationMs} ms
							</Badge>
						}
					/>
				) : null}
			</div>
		);
	}

	const v = verdict as Verdict;
	return (
		<div className="flex flex-col gap-3">
			{!v.pass && !v.learnerLast && !v.learnerResults.length ? (
				<Alert variant="destructive">
					<GameIcon name="x" />
					<AlertTitle>
						{verdictTitle(v)}
						{v.sqlError?.code ? (
							<span className="rune ml-2">Error code {v.sqlError.code}</span>
						) : null}
					</AlertTitle>
					<AlertDescription>
						<p>{verdictAdvice(v, sql, solutionSql)}</p>
						{v.sqlError?.message ? (
							<p className="font-mono text-xs">{v.sqlError.message}</p>
						) : null}
						{v.sqlError ? (
							<ErrorLineQuote sql={sql} error={v.sqlError} />
						) : null}
					</AlertDescription>
				</Alert>
			) : null}
			{(v.statements?.length ?? 0) > 1 ? (
				<StatementLog statements={v.statements} />
			) : null}
			{v.learnerLast || v.learnerResults.length ? (
				<ResultGrid
					table={v.learnerLast ?? v.learnerResults.at(-1)}
					meta={
						<Badge variant={v.pass ? "success" : "danger"}>
							{v.pass ? "✓ matches" : `✗ ${v.title.toLowerCase()}`}
						</Badge>
					}
				/>
			) : null}
			{v.diff && !v.pass ? (
				<DiffView diff={v.diff} expected={v.expected} got={v.learnerLast} />
			) : null}
			{v.stateDiff && !v.pass ? (
				<DiffView
					diff={v.stateDiff}
					expected={v.stateExpected}
					got={v.stateGot}
					labels={["Expected world state", "Your world state"]}
				/>
			) : null}
		</div>
	);
}

function BossDefeat({
	open,
	chapter,
	onContinue,
}: {
	open: boolean;
	chapter: Chapter;
	onContinue: () => void;
}) {
	useEffect(() => {
		if (!open) return;
		sfx("boss");
		haptic("wrong");
	}, [open]);
	return (
		<Dialog open={open}>
			<DialogContent
				showCloseButton={false}
				className="max-w-md text-center"
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<div className="mx-auto grid size-20 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-[0_6px_0_var(--destructive-edge)]">
					<GameIcon name="skull" className="size-11" />
				</div>
				<DialogTitle className="text-center text-3xl">
					The guardian held
				</DialogTitle>
				<DialogDescription className="text-center">
					No shame in it. A few short practice drills aimed at the concepts of{" "}
					<b className="text-foreground">{chapter.title}</b> is now open. Clear
					it and the gate opens again.
				</DialogDescription>
				<Button variant="danger" size="lg" onClick={onContinue} autoFocus>
					To the training grounds
				</Button>
			</DialogContent>
		</Dialog>
	);
}
