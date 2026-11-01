import {
	animate,
	motion,
	type PanInfo,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import { useEffect, useRef } from "react";
import type { Exercise } from "#/content/types";
import type { MasteryMap } from "#/engine/adaptive/types";
import {
	errorLineOf,
	sqlErrorAdvice,
	sqlstateName,
} from "#/engine/checker/errors";
import type { SqlErrorInfo, Verdict } from "#/engine/checker/types";
import type { Reward } from "#/game/progress";
import { haptic, sfx } from "#/game/sound";
import { conceptName } from "#/lib/content";
import { cn } from "#/lib/utils";
import { Button } from "../ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../ui/collapsible";
import { Spinner } from "../ui/spinner";
import { achievementToast } from "./app-effects";
import { burst, prefersReducedMotion } from "./fx";
import { GameIcon, StarGlyph } from "./icons";
import { Markdown } from "./markdown";

const fmt = new Intl.NumberFormat("en-US");

/** Count-up written to textContent through a motion value (no per-frame React state). */
export function CountUp({
	to,
	delay = 0.4,
	className,
}: {
	to: number;
	delay?: number;
	className?: string;
}) {
	const v = useMotionValue(0);
	const text = useTransform(v, (x) => fmt.format(Math.round(x)));
	useEffect(() => {
		if (prefersReducedMotion()) {
			v.set(to);
			return;
		}
		const c = animate(v, to, {
			duration: 0.75,
			ease: [0.23, 1, 0.32, 1],
			delay,
		});
		return () => c.stop();
	}, [to, v, delay]);
	return <motion.span className={cn("tabular", className)}>{text}</motion.span>;
}

export function MasteryDeltas({
	concepts,
	before,
	after,
}: {
	concepts: string[];
	before: MasteryMap;
	after: MasteryMap;
}) {
	return (
		<div className="flex flex-col gap-2">
			{concepts.map((c) => {
				const b = before[c]?.effective ?? 0;
				const a = after[c]?.effective ?? 0;
				const d = Math.round((a - b) * 100);
				return (
					<div key={c}>
						<div className="mb-1 flex justify-between text-xs font-extrabold">
							<span>{conceptName(c)}</span>
							<span className="tabular">
								{d >= 0 ? "+" : ""}
								{d}%
							</span>
						</div>
						<div className="xp-track h-2.5">
							<i
								className="bg-success!"
								style={{ transform: `scaleX(${Math.max(0.02, a)})` }}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}

/** The "+15" token flies from the sheet to the HUD aether stat (WAAPI, composited). */
function flyAether(from: HTMLElement | null, amount: number) {
	if (!from || amount <= 0 || prefersReducedMotion()) return;
	const target = document.querySelector<HTMLElement>("[data-hud-aether]");
	if (!target) return;
	const a = from.getBoundingClientRect();
	const b = target.getBoundingClientRect();
	const token = document.createElement("span");
	token.textContent = `+${amount}`;
	token.className =
		"stat xp pointer-events-none fixed z-[70] font-display text-xl";
	token.style.left = `${a.left + a.width / 2}px`;
	token.style.top = `${a.top}px`;
	document.body.appendChild(token);
	const dx = b.left + b.width / 2 - (a.left + a.width / 2);
	const dy = b.top - a.top;
	const anim = token.animate(
		[
			{ transform: "translate(-50%, 0) scale(1)", opacity: 1 },
			{
				transform: `translate(calc(-50% + ${dx * 0.4}px), ${dy * 0.7 - 40}px) scale(1.1)`,
				opacity: 1,
				offset: 0.45,
			},
			{
				transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(0.7)`,
				opacity: 0.2,
			},
		],
		{ duration: 520, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
	);
	anim.onfinish = () => {
		token.remove();
		target.animate(
			[
				{ transform: "scale(1)" },
				{ transform: "scale(1.18)" },
				{ transform: "scale(1)" },
			],
			{
				duration: 280,
				easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
			},
		);
	};
}

export interface SolvedResult {
	reward: Reward;
	revealed: boolean;
}

const SQL_ERROR_TYPES = new Set([
	"syntax",
	"unknown_table",
	"unknown_column",
	"unknown_function",
	"runtime",
]);

/**
 * What the "Not quite" sheet says. SQL errors get plain advice (no raw
 * SQLSTATE or line and column: the line is quoted under it), and the row
 * count advice only mentions joins when the query is about joins.
 */
export function verdictAdvice(
	verdict: Verdict,
	sql: string,
	solutionSql: string,
): string {
	if (verdict.sqlError && SQL_ERROR_TYPES.has(verdict.errorType ?? "")) {
		const advice = sqlErrorAdvice(verdict.sqlError);
		const raw = verdict.sqlError.message;
		const base = advice ?? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}.`;
		const hint = verdict.sqlError.hint;
		return hint ? `${base} Postgres adds: ${hint}` : base;
	}
	if (
		verdict.errorType === "wrong_row_count" &&
		!/\bjoin\b/i.test(`${sql} ${solutionSql}`)
	)
		return verdict.message.replace(/ or a join (duplicates|drops) rows\./, ".");
	return verdict.message;
}

/** Headline of a wrong verdict, with "Error 42702 (ambiguous_column)" as plain words. */
export function verdictTitle(verdict: Verdict): string {
	const code = verdict.sqlError?.code;
	if (
		code === "42P01" &&
		/missing FROM-clause entry/.test(verdict.sqlError?.message ?? "")
	)
		return "Unknown alias";
	if (verdict.errorType === "runtime" && code) {
		const name = sqlstateName(code)?.replaceAll("_", " ");
		return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : "Error";
	}
	return verdict.title;
}

/** The line Postgres points at, with a caret under the spot. */
export function ErrorLineQuote({
	sql,
	error,
	className,
}: {
	sql: string;
	error: SqlErrorInfo;
	className?: string;
}) {
	const at = errorLineOf(sql, error);
	if (!at) return null;
	const lead = at.text.length - at.text.trimStart().length;
	const line = at.text.trim();
	const pos = Math.max(0, Math.min(line.length, at.column - 1 - lead));
	// A long line starts a little before the spot, so the mark is on screen.
	const cut = pos > 24 ? pos - 16 : 0;
	const shown = cut ? `…${line.slice(cut)}` : line;
	const caret = cut ? pos - cut + 1 : pos;
	return (
		<figure className={cn("err-quote", className)}>
			<figcaption>
				{sql.includes("\n") ? `Line ${at.line} of your query` : "Your query"}
			</figcaption>
			<pre>
				<code>
					{shown.slice(0, caret)}
					<mark>{shown.slice(caret, caret + 1) || " "}</mark>
					{shown.slice(caret + 1)}
				</code>
			</pre>
		</figure>
	);
}

/**
 * Bottom verdict sheet: "Checking" the moment Submit is pressed, then
 * "Correct!" or "Not quite" in the same sheet. A wrong verdict can be dragged
 * down to look at the query.
 */
export function VerdictSheet({
	exercise,
	verdict,
	solved,
	checking,
	sql = "",
	isBoss,
	onContinue,
	onRetry,
	onDismiss,
	onHint,
	continueLabel = "Continue",
}: {
	exercise: Exercise;
	verdict: Verdict | null;
	solved: SolvedResult | null;
	/** Submitted, verdict not back yet. */
	checking?: boolean;
	/** The submitted SQL, to quote the line an error points at. */
	sql?: string;
	isBoss?: boolean;
	onContinue: () => void;
	onRetry: () => void;
	/** Closes a wrong verdict without focusing the editor (drag down). */
	onDismiss?: () => void;
	onHint?: () => void;
	continueLabel?: string;
}) {
	const reduce = useReducedMotion();
	const medalRef = useRef<HTMLDivElement>(null);
	const ok = !!solved;

	useEffect(() => {
		if (!solved) return;
		haptic("correct");
		if (!solved.revealed) burst("small");
		flyAether(medalRef.current, solved.reward.xp.total);
		const timers = [0, 1, 2]
			.filter((i) => i < solved.reward.stars)
			.map((i) =>
				window.setTimeout(
					() => {
						sfx("star", i);
						haptic("star");
					},
					360 + i * 220,
				),
			);
		for (const a of solved.reward.newAchievements)
			window.setTimeout(() => achievementToast(a), 900);
		return () => {
			for (const t of timers) window.clearTimeout(t);
		};
	}, [solved]);

	useEffect(() => {
		if (!ok && verdict && !verdict.pass) haptic("wrong");
	}, [ok, verdict]);

	const pending = !ok && !!checking;
	if (!ok && !pending && (!verdict || verdict.pass)) return null;
	const r = solved?.reward;
	const sqlstate = verdict?.sqlError?.code;
	const bad = !ok && !pending;
	const dismiss = (_: unknown, info: PanInfo) => {
		if (info.offset.y > 70 || info.velocity.y > 500) (onDismiss ?? onRetry)();
	};

	return (
		<motion.div
			role="status"
			aria-live="polite"
			aria-busy={pending}
			initial={reduce ? { opacity: 0 } : { y: "110%" }}
			animate={reduce ? { opacity: 1 } : { y: 0 }}
			exit={reduce ? { opacity: 0 } : { y: "110%" }}
			transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
			drag={bad && !reduce ? "y" : false}
			dragConstraints={{ top: 0, bottom: 0 }}
			dragElastic={{ top: 0, bottom: 0.7 }}
			dragSnapToOrigin
			onDragEnd={bad ? dismiss : undefined}
			className="bottom-bar z-50 px-safe-3 pb-safe-3 lg:px-safe-6"
		>
			<div
				className={cn(
					"verdict mx-auto max-w-3xl shadow-[0_12px_24px_-12px_var(--ink-shadow)]",
					ok ? "ok" : pending ? "checking" : "bad",
				)}
			>
				{bad ? <span className="verdict-grip" aria-hidden="true" /> : null}
				<div className="top">
					<div className="medal" ref={medalRef}>
						{pending ? (
							<Spinner className="size-7" />
						) : (
							<GameIcon name={ok ? "check" : "x"} className="size-7" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<div className="ttl">
							{pending
								? "Checking…"
								: ok
									? solved?.revealed
										? "Solution revealed"
										: isBoss
											? "Guardian defeated!"
											: "Correct!"
									: verdict?.errorType === "internal"
										? "Engine hiccup"
										: verdict?.errorType === "timeout"
											? "Query timed out"
											: "Not quite"}
						</div>
						{pending ? (
							<div className="msg">
								Running your query and comparing it with the expected result.
							</div>
						) : ok && r ? (
							<div className="msg flex flex-wrap items-center gap-x-2">
								<span className="tabular">+{r.xp.total} XP</span>
								{r.combo >= 2 ? <span>· combo x{r.combo}</span> : null}
								{r.xp.hintPenalty ? (
									<span>· hint −{r.xp.hintPenalty}</span>
								) : null}
								{r.levelAfter > r.levelBefore ? (
									<span>· level {r.levelAfter}!</span>
								) : null}
							</div>
						) : (
							<div className="msg">
								{verdict?.errorType === "internal" ? (
									<span className="font-extrabold">
										The SQL engine failed, not your query. Nothing was counted:
										try again.{" "}
									</span>
								) : (
									<span className="font-extrabold">
										{verdict ? verdictTitle(verdict) : null}.{" "}
									</span>
								)}
								{verdict?.errorType === "internal" || !verdict
									? null
									: verdictAdvice(verdict, sql, exercise.solutionSql)}{" "}
								{sqlstate ? (
									<span className="rune whitespace-nowrap">
										Error code {sqlstate}
									</span>
								) : null}
							</div>
						)}
					</div>
					{ok && r ? (
						<div
							className="verdict-stars flex items-end gap-0.5"
							role="img"
							aria-label={`${r.stars} of 3 stars`}
						>
							{[0, 1, 2].map((i) => (
								<span
									key={i}
									className={cn(
										i < r.stars && "animate-star-land",
										i === 1 && "-translate-y-1.5",
									)}
									style={
										i < r.stars
											? { animationDelay: `${300 + i * 220}ms` }
											: undefined
									}
								>
									<StarGlyph
										filled={i < r.stars}
										className={
											i === 1 ? "size-8 sm:size-10" : "size-6 sm:size-8"
										}
									/>
								</span>
							))}
						</div>
					) : null}
				</div>
				{bad && verdict?.sqlError ? (
					<ErrorLineQuote sql={sql} error={verdict.sqlError} />
				) : null}
				{ok && r ? (
					<div className="grid gap-3 text-foreground sm:grid-cols-2">
						<MasteryDeltas
							concepts={exercise.concepts}
							before={r.masteryBefore}
							after={r.masteryAfter}
						/>
						{exercise.explanation ? (
							<Collapsible defaultOpen={solved?.revealed}>
								<CollapsibleTrigger className="tap-target flex items-center gap-1 text-sm font-extrabold text-success-soft-foreground">
									<GameIcon name="scroll" className="size-4" /> Why it works
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-card p-3">
									<Markdown>{exercise.explanation}</Markdown>
									{solved?.revealed ? (
										<pre className="mt-2 overflow-x-auto rounded-md bg-editor p-2 font-mono text-xs">
											{exercise.solutionSql}
										</pre>
									) : null}
								</CollapsibleContent>
							</Collapsible>
						) : null}
					</div>
				) : null}
				<div className="flex items-center gap-2">
					{pending ? (
						<Button variant="secondary" size="lg" className="flex-1" disabled>
							Checking
						</Button>
					) : ok ? (
						<Button
							variant="success"
							size="lg"
							className="flex-1"
							onClick={onContinue}
							autoFocus
						>
							{continueLabel}
						</Button>
					) : (
						<>
							{onHint ? (
								<Button
									variant="ghost"
									onClick={onHint}
									className="text-destructive-soft-foreground"
								>
									<GameIcon name="bulb" data-icon="inline-start" /> Hint
								</Button>
							) : null}
							<Button
								variant="danger"
								size="lg"
								className="flex-1"
								onClick={onRetry}
								autoFocus
							>
								Try again
							</Button>
						</>
					)}
				</div>
			</div>
		</motion.div>
	);
}
