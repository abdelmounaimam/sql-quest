import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Lightbulb,
	Play,
	Send,
	X,
} from "lucide-react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import type { Chapter, LessonStep } from "#/content/types";
import type { RunOutcome, Verdict } from "#/engine/checker/types";
import { sqlClient } from "#/engine/sql/client";
import { markLessonDone, recordAttempt, useGame } from "#/game/progress";
import { sfx } from "#/game/sound";
import { functionsQuery, useCatalog } from "#/game/sql-queries";
import { useIsDesktop } from "#/hooks/use-media";
import { tryStepAsExercise } from "#/lib/content";
import { cn } from "#/lib/utils";
import { burst } from "./fx";
import { Markdown } from "./markdown";
import { ResultGrid } from "./result-grid";
import { QuickKeys, SqlEditor, type SqlEditorHandle } from "./sql-editor";

type StepState = { done: boolean };

export function LessonPlayer({
	chapter,
	initialStep = 0,
	onFinish,
	onStep,
}: {
	chapter: Chapter;
	initialStep?: number;
	onFinish: () => void;
	onStep?: (i: number) => void;
}) {
	const steps = chapter.lesson;
	const [index, setIndex] = useState(Math.min(initialStep, steps.length - 1));
	const [dir, setDir] = useState(1);
	const [states, setStates] = useState<StepState[]>(() =>
		steps.map((s) => ({ done: s.kind === "explain" || s.kind === "example" })),
	);
	const step = steps[index];
	const canNext = states[index]?.done;
	const last = index === steps.length - 1;

	const go = (to: number) => {
		if (to < 0 || to >= steps.length) return;
		setDir(to > index ? 1 : -1);
		setIndex(to);
		onStep?.(to);
		sfx("tap");
	};
	const next = () => {
		if (!canNext) return;
		if (last) {
			markLessonDone(chapter.id);
			sfx("unlock");
			burst("small");
			onFinish();
			return;
		}
		go(index + 1);
	};
	const markDone = () =>
		setStates((s) => s.map((x, i) => (i === index ? { done: true } : x)));

	// Release dismisses past 30% of the width or with a flick (> 0.11 px/ms).
	const onDragEnd = (_: unknown, info: PanInfo) => {
		const w =
			typeof window === "undefined" ? 400 : Math.min(window.innerWidth, 768);
		const flick = Math.abs(info.velocity.x) > 110;
		if ((info.offset.x < -w * 0.3 || (flick && info.offset.x < 0)) && canNext)
			next();
		else if (info.offset.x > w * 0.3 || (flick && info.offset.x > 0))
			go(index - 1);
	};

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-5 pb-28 sm:pb-10">
			<div className="hud-bar mb-4">
				<Button
					asChild
					variant="ghost"
					size="icon-sm"
					aria-label="Leave the lesson"
				>
					<Link to="/">
						<X />
					</Link>
				</Button>
				<div className="seg" role="tablist" aria-label="Lesson steps">
					{steps.map((s, i) => (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: steps are a fixed, ordered list
							key={`${s.kind}-${i}`}
							type="button"
							role="tab"
							aria-selected={i === index}
							aria-label={`Step ${i + 1}`}
							onClick={() =>
								i <= index || states[i - 1]?.done ? go(i) : undefined
							}
							className={cn(
								"h-3.5 flex-1 rounded-full bg-muted shadow-[inset_0_2px_0_var(--ink-shadow)] transition-[background-color] duration-(--duration-fast)",
								i < index || (i === index && states[i]?.done)
									? "gloss bg-success shadow-none"
									: i === index && "bg-success/55 shadow-none",
							)}
						/>
					))}
				</div>
				<span className="text-sm font-extrabold text-muted-foreground tabular">
					{index + 1}/{steps.length}
				</span>
			</div>
			<div className="kicker mb-3 text-(--syn-keyword)">
				Learn · {chapter.title}
			</div>
			<div className="relative flex-1">
				<AnimatePresence mode="wait" custom={dir} initial={false}>
					<motion.div
						key={index}
						custom={dir}
						initial={{ scale: 0.96, opacity: 0 }}
						animate={{ x: 0, scale: 1, opacity: 1, rotate: 0 }}
						exit={{ x: `${dir * -110}%`, opacity: 0, rotate: dir * -6 }}
						transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
						drag="x"
						dragConstraints={{ left: 0, right: 0 }}
						dragElastic={0.25}
						dragDirectionLock
						onDragEnd={onDragEnd}
						className="panel touch-pan-y p-5 sm:p-7"
					>
						<StepView
							key={index}
							chapter={chapter}
							step={step}
							index={index}
							onDone={markDone}
							done={!!states[index]?.done}
						/>
					</motion.div>
				</AnimatePresence>
			</div>

			<div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[color-mix(in_oklab,var(--muted)_92%,transparent)] p-3 backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
				<div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
					<Button
						type="button"
						onClick={() => go(index - 1)}
						disabled={index === 0}
						variant="outline"
						size="lg"
						aria-label="Previous step"
					>
						<ChevronLeft className="size-5" />
					</Button>
					<div className="hidden text-xs text-muted-foreground sm:block">
						Swipe or use the arrows
					</div>
					<Button
						onClick={next}
						disabled={!canNext}
						size="lg"
						variant={last ? "success" : "default"}
						className="flex-1 sm:flex-none"
					>
						{last
							? "Start the missions"
							: canNext
								? "Next"
								: step.kind === "quiz"
									? "Answer to continue"
									: "Solve to continue"}
						<ChevronRight data-icon="inline-end" />
					</Button>
				</div>
			</div>
		</div>
	);
}

function StepView({
	chapter,
	step,
	index,
	onDone,
	done,
}: {
	chapter: Chapter;
	step: LessonStep;
	index: number;
	onDone: () => void;
	done: boolean;
}) {
	switch (step.kind) {
		case "explain":
			return (
				<div>
					<StepKind label="Concept" color="text-info-soft-foreground" />
					<h2 className="mb-3 font-display text-2xl leading-tight text-foreground">
						{step.title}
					</h2>
					<Markdown className="text-base text-foreground">{step.body}</Markdown>
				</div>
			);
		case "example":
			return <ExampleStep chapter={chapter} step={step} />;
		case "quiz":
			return <QuizStep step={step} onDone={onDone} done={done} />;
		case "try":
			return (
				<TryStep
					chapter={chapter}
					step={step}
					index={index}
					onDone={onDone}
					done={done}
				/>
			);
	}
}

function StepKind({ label, color }: { label: string; color: string }) {
	return (
		<div
			className={cn(
				"mb-1 text-[11px] font-bold tracking-[0.2em] uppercase",
				color,
			)}
		>
			{label}
		</div>
	);
}

function ExampleStep({
	chapter,
	step,
}: {
	chapter: Chapter;
	step: Extract<LessonStep, { kind: "example" }>;
}) {
	const runMut = useMutation({
		mutationFn: () =>
			sqlClient().run({ datasetId: chapter.datasetId, sql: step.sql }),
		onSuccess: () => sfx("run"),
	});
	const out: RunOutcome | undefined = runMut.data;
	return (
		<div>
			<StepKind label="Worked example" color="text-(--syn-keyword)" />
			<h2 className="mb-2 font-display text-2xl leading-tight text-foreground">
				{step.title}
			</h2>
			<Markdown className="text-foreground">{step.body}</Markdown>
			<div className="mt-4" onPointerDownCapture={(e) => e.stopPropagation()}>
				<SqlEditor
					value={step.sql}
					readOnly
					minHeight="60px"
					ariaLabel="Example SQL"
				/>
			</div>
			<Button
				type="button"
				onClick={() => runMut.mutate()}
				disabled={runMut.isPending}
				variant="secondary"
				size="lg"
				className="mt-3"
			>
				<Play className="size-4" fill="currentColor" />
				{runMut.isPending ? "Running…" : out ? "Run again" : "Run it"}
			</Button>
			<div className="mt-3" onPointerDownCapture={(e) => e.stopPropagation()}>
				{runMut.error ? (
					<p className="text-sm text-destructive">
						The SQL engine failed: {(runMut.error as Error).message}
					</p>
				) : null}
				{out ? (
					out.ok ? (
						<ResultGrid
							table={out.last ?? out.results.at(-1)}
							caption="Result"
							maxHeight="16rem"
						/>
					) : (
						<p className="font-mono text-sm text-destructive">
							{out.error?.message}
						</p>
					)
				) : null}
			</div>
		</div>
	);
}

function QuizStep({
	step,
	onDone,
	done,
}: {
	step: Extract<LessonStep, { kind: "quiz" }>;
	onDone: () => void;
	done: boolean;
}) {
	const [picked, setPicked] = useState<number | null>(
		done ? step.answerIndex : null,
	);
	const [wrong, setWrong] = useState<number[]>([]);
	const correct = picked === step.answerIndex;
	return (
		<div>
			<StepKind label="Quick quiz" color="text-special-soft-foreground" />
			<Markdown className="mb-4 text-lg font-semibold text-foreground">
				{step.question}
			</Markdown>
			<div className="grid gap-2">
				{step.choices.map((c, i) => {
					const isWrong = wrong.includes(i);
					const isRight = correct && i === step.answerIndex;
					return (
						<motion.button
							key={c}
							type="button"
							disabled={correct || isWrong}
							onClick={() => {
								setPicked(i);
								if (i === step.answerIndex) {
									sfx("success");
									burst("small");
									onDone();
								} else {
									sfx("fail");
									setWrong((w) => [...w, i]);
								}
							}}
							animate={isWrong ? { x: [0, -6, 6, -3, 3, 0] } : {}}
							transition={{ duration: 0.42 }}
							data-state={isRight ? "right" : isWrong ? "wrong" : undefined}
							className="juicy juicy-paper quiz-tile flex items-center gap-3 px-4 py-3 text-left text-sm font-bold disabled:cursor-default"
						>
							<span
								className={cn(
									"grid size-8 shrink-0 place-items-center rounded-md font-display text-sm",
									isRight
										? "bg-success text-success-foreground"
										: isWrong
											? "bg-destructive text-destructive-foreground"
											: "bg-secondary text-foreground",
								)}
							>
								{isRight ? (
									<Check className="size-4" />
								) : isWrong ? (
									<X className="size-4" />
								) : (
									String.fromCharCode(65 + i)
								)}
							</span>
							<span className="font-mono text-[13px] text-foreground">{c}</span>
						</motion.button>
					);
				})}
			</div>
			<AnimatePresence>
				{correct ? (
					<motion.div
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						className="mt-4 rounded-xl border border-success/50 bg-muted p-3"
					>
						<Markdown className="text-foreground">{step.explanation}</Markdown>
					</motion.div>
				) : wrong.length ? (
					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="mt-3 text-sm text-destructive"
					>
						Not quite. Try another answer.
					</motion.p>
				) : null}
			</AnimatePresence>
		</div>
	);
}

function TryStep({
	chapter,
	step,
	index,
	onDone,
	done,
}: {
	chapter: Chapter;
	step: Extract<LessonStep, { kind: "try" }>;
	index: number;
	onDone: () => void;
	done: boolean;
}) {
	const isDesktop = useIsDesktop();
	const autocomplete = useGame((s) => s.settings.autocomplete);
	const editorRef = useRef<SqlEditorHandle>(null);
	const [sql, setSql] = useState(step.starterSql ?? "");
	const [startedAt] = useState(Date.now());
	const [failures, setFailures] = useState(0);
	const [hints, setHints] = useState(0);
	const [runs, setRuns] = useState(0);
	const catalog = useCatalog(chapter.datasetId);
	const functions = useQuery(functionsQuery(chapter.datasetId));
	const schema = catalog.data
		? Object.fromEntries(
				catalog.data.tables.map((t) => [t.name, t.columns.map((c) => c.name)]),
			)
		: undefined;
	const ex = tryStepAsExercise(chapter, step, index);

	const judgeMut = useMutation({
		mutationFn: () =>
			sqlClient().judge({
				datasetId: chapter.datasetId,
				solutionSql: step.solutionSql,
				check: step.check,
				learnerSql: sql,
			}),
		onSuccess: (v: Verdict) => {
			setRuns((r) => r + 1);
			if (v.pass) {
				sfx("success");
				burst("small");
				recordAttempt({
					exerciseId: ex.id,
					chapterId: chapter.id,
					kind: "lesson-try",
					concepts: chapter.concepts,
					difficulty: 1,
					startedAt,
					finishedAt: Date.now(),
					runs: runs + 1,
					failedSubmissions: failures,
					errorTypes: [],
					hintsUsed: hints,
					revealed: false,
					solved: true,
				});
				onDone();
			} else {
				sfx("fail");
				setFailures((f) => f + 1);
				if (failures + 1 >= 2 && hints < step.hints.length)
					setHints((h) => Math.max(h, 1));
			}
		},
	});
	const v = judgeMut.data;

	return (
		<div>
			<StepKind label="Your turn" color="text-success-soft-foreground" />
			<h2 className="mb-2 font-display text-2xl leading-tight text-foreground">
				{step.title}
			</h2>
			<Markdown className="text-foreground">{step.prompt}</Markdown>
			<div className="mt-4" onPointerDownCapture={(e) => e.stopPropagation()}>
				<SqlEditor
					ref={editorRef}
					value={sql}
					onChange={setSql}
					onRun={() => judgeMut.mutate()}
					onSubmit={() => judgeMut.mutate()}
					schema={schema}
					functions={functions.data}
					autocomplete={autocomplete}
					errorLine={v?.sqlError?.line}
					minHeight="110px"
					readOnly={done}
				/>
				{!isDesktop && !done ? (
					<QuickKeys
						className="mt-2 rounded-xl"
						onKey={(k) => editorRef.current?.insert(k)}
					/>
				) : null}
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<Button
					type="button"
					onClick={() => judgeMut.mutate()}
					disabled={judgeMut.isPending || done}
					variant="success"
					size="lg"
				>
					<Send className="size-4" />
					{done ? "Solved" : judgeMut.isPending ? "Checking…" : "Check"}
				</Button>
				{!done && hints < step.hints.length ? (
					<button
						type="button"
						onClick={() => {
							setHints((h) => h + 1);
							sfx("hint");
						}}
						className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-(--syn-keyword) hover:bg-secondary"
					>
						<Lightbulb className="size-4" /> Hint
					</button>
				) : null}
				{!done && failures >= 3 ? (
					<button
						type="button"
						onClick={() => {
							setSql(step.solutionSql);
							onDone();
						}}
						className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary"
					>
						Show me and continue
					</button>
				) : null}
			</div>
			{step.hints.slice(0, hints).map((h, i) => (
				<div
					key={h}
					className="mt-2 flex gap-2 rounded-lg bg-info-soft text-info-soft-foreground p-2.5 text-sm"
				>
					<Lightbulb className="mt-0.5 size-4 shrink-0 text-(--syn-keyword)" />
					<span>
						<b className="text-(--syn-keyword)">Hint {i + 1}:</b>{" "}
						<Markdown className="inline text-foreground">{h}</Markdown>
					</span>
				</div>
			))}
			<div className="mt-3" onPointerDownCapture={(e) => e.stopPropagation()}>
				{v ? (
					<div className="space-y-2">
						<div
							className={cn(
								"rounded-lg p-2.5 text-sm",
								v.pass
									? "bg-success-soft text-success-soft-foreground"
									: "bg-destructive-soft text-destructive-soft-foreground",
							)}
						>
							<b>{v.title.replace(/[.!]$/, "")}.</b>{" "}
							<span className="text-foreground">{v.message}</span>
						</div>
						{v.learnerLast ? (
							<ResultGrid
								table={v.learnerLast}
								caption="Your result"
								maxHeight="14rem"
							/>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
