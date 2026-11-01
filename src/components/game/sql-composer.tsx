import { LayoutGroup, motion } from "motion/react";
import {
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import type { Catalog } from "#/engine/checker/pglite-provider";
import { useGame } from "#/game/progress";
import { sfx } from "#/game/sound";
import {
	buildBank,
	firstGap,
	glued,
	layout,
	needsFix,
	render,
	type Suggestions,
	suggest,
	type Tile,
	taskHints,
	tokenize,
	toTiles,
} from "#/game/sql-tokens";
import { gameActions } from "#/game/store";
import { useMediaQuery } from "#/hooks/use-media";
import { cn } from "#/lib/utils";
import { GameIcon } from "./icons";
import { SqlEditor, type SqlEditorHandle } from "./sql-editor";

/** Sample values per "table.column", quoted as SQL literals, for suggestions. */
function sampleValues(catalog: Catalog): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const t of catalog.tables) {
		const { columns, rows } = t.sampleRows;
		columns.forEach((c, i) => {
			const col = t.columns.find((x) => x.name === c.name);
			if (!col) return;
			const lit = new Set<string>();
			for (const r of rows) {
				const v = r[i];
				if (v === null || v === undefined || typeof v === "object") continue;
				if (col.category === "int" || col.category === "numeric")
					lit.add(String(v));
				else if (col.category === "bool") lit.add(String(v).toUpperCase());
				else if (col.category === "text" || col.category === "enum")
					lit.add(`'${String(v).replaceAll("'", "''")}'`);
				if (lit.size >= 6) break;
			}
			if (lit.size) out[`${t.name}.${c.name}`] = [...lit];
		});
	}
	return out;
}

/** Skeleton placeholders ("...", "…") are gaps to fill, not SQL. */
function stripPlaceholders(sql: string | undefined): string | undefined {
	return sql?.replace(/\.{3}|…/g, " ");
}

const sameSql = (a: string, b: string) =>
	tokenize(stripPlaceholders(a) ?? "")
		.join(" ")
		.toUpperCase() ===
	tokenize(stripPlaceholders(b) ?? "")
		.join(" ")
		.toUpperCase();

const sameIds = (a: string[], b: string[] | null) =>
	!!b && a.length === b.length && a.every((x, i) => x === b[i]);

// ───────────────────────────── word bank

/** What a tile shows: a string of spaces gets visible ␣ marks. */
const label = (t: Tile) =>
	t.kind === "string" && /^'\s+'$/.test(t.text)
		? t.text.replace(/\s/g, "␣")
		: t.text;

function TileButton({
	tile,
	onClick,
	placed,
	disabled,
	count,
}: {
	tile: Tile;
	onClick: () => void;
	placed?: boolean;
	disabled?: boolean;
	/** Identical tiles left in this stack (badge when more than one). */
	count?: number;
}) {
	return (
		<motion.button
			layoutId={tile.id}
			layout="position"
			type="button"
			className={cn("wb-tile", placed && "is-placed")}
			data-kind={tile.kind}
			onClick={onClick}
			disabled={disabled}
			transition={{ type: "spring", duration: 0.32, bounce: 0.18 }}
		>
			{label(tile)}
			{count && count > 1 ? (
				<span className="wb-count">
					<span className="sr-only">, </span>
					{count}
					<span className="sr-only"> left</span>
				</span>
			) : null}
		</motion.button>
	);
}

/** The part of a long bank being built: the first with tiles left to place. */
function currentPage(bank: Tile[], used: Set<string>): number {
	let last = 0;
	let cur = Number.POSITIVE_INFINITY;
	for (const t of bank) {
		const p = t.page ?? 0;
		if (p < 0) continue;
		last = Math.max(last, p);
		if (!t.decoy && !t.spare && !used.has(t.id)) cur = Math.min(cur, p);
	}
	return Number.isFinite(cur) ? cur : last;
}

/**
 * Duolingo-style word bank: tap tiles to build the query, tap a placed tile to
 * send it back (new tiles then go where it was). No text field, so no
 * keyboard ever opens.
 */
function WordBank({
	bank,
	placed,
	caret,
	onChange,
	readOnly,
	groupId,
	reference,
	fixing,
	preset,
}: {
	bank: Tile[];
	placed: string[];
	/** Where the next tile goes (index in `placed`), null for the end. */
	caret: number | null;
	onChange: (ids: string[], caret: number | null) => void;
	readOnly?: boolean;
	groupId: string;
	/** Starting SQL the tiles cannot lay out, shown to read while building. */
	reference?: string;
	/** The answer starts from a query with mistakes to repair. */
	fixing?: boolean;
	/** Tiles laid out from the starter: no empty slot while they stay placed. */
	preset?: string[] | null;
}) {
	const byId = useMemo(() => new Map(bank.map((t) => [t.id, t])), [bank]);
	const used = new Set(placed);
	const texts = placed.map((id) => byId.get(id)?.text ?? "");
	const lines = layout(texts);
	const at = caret !== null && caret < placed.length ? caret : null;
	const tap = (ids: string[], next: number | null) => {
		sfx("tap");
		onChange(ids, next !== null && next < ids.length ? next : null);
	};
	const remove = (i: number) =>
		tap(
			placed.filter((_, k) => k !== i),
			i,
		);
	const insert = (id: string) =>
		at === null
			? tap([...placed, id], null)
			: tap([...placed.slice(0, at), id, ...placed.slice(at)], at + 1);

	// Long banks come in parts; identical tiles stack into one slot.
	const pages = Math.max(0, ...bank.map((t) => t.page ?? 0)) + 1;
	const page = currentPage(bank, used);
	const slots = useMemo(() => {
		const out: { text: string; ids: string[] }[] = [];
		for (const t of bank) {
			const p = t.page ?? 0;
			if (p !== page && p !== -1) continue;
			const slot = out.find((s) => s.text === t.text);
			if (slot) slot.ids.push(t.id);
			else out.push({ text: t.text, ids: [t.id] });
		}
		return out;
	}, [bank, page]);

	// Keep the cursor (or the end of the query) in view as tiles land.
	const answerRef = useRef<HTMLUListElement>(null);
	const caretKey = `${placed.length}:${at}`;
	// biome-ignore lint/correctness/useExhaustiveDependencies: on each placement
	useEffect(() => {
		const el = answerRef.current;
		if (!el || el.scrollHeight <= el.clientHeight) return;
		const mark = el.querySelector<HTMLElement>(".wb-caret");
		if (mark) mark.scrollIntoView({ block: "nearest" });
		else el.scrollTop = el.scrollHeight;
	}, [caretKey]);

	// Tiles that sit together without a space ("count(*)", "name,") wrap as one.
	const items: React.ReactNode[] = [];
	let run: React.ReactNode[] = [];
	let runKey = "";
	const flush = () => {
		if (run.length)
			items.push(
				<li key={runKey} className="wb-run">
					{run}
				</li>,
			);
		run = [];
	};
	const caretMark = (
		<span key="caret" className="wb-caret" aria-hidden="true" />
	);
	placed.forEach((id, i) => {
		const t = byId.get(id);
		if (!t) return;
		const startRun = i === 0 || lines[i].brk || !glued(texts[i - 1], texts[i]);
		if (startRun) {
			// A cursor before a line break shows at the end of the line above.
			if (at === i && lines[i].brk && run.length) run.push(caretMark);
			flush();
			runKey = id;
			if (lines[i].brk) {
				items.push(
					<li key={`br-${id}`} className="wb-break" aria-hidden="true" />,
				);
				if (lines[i].indent)
					items.push(
						<li
							key={`in-${id}`}
							className="wb-indent"
							style={{ width: `${lines[i].indent * 18}px` }}
							aria-hidden="true"
						/>,
					);
			}
		}
		if (at === i && !(lines[i].brk && i > 0)) run.push(caretMark);
		run.push(
			<TileButton
				key={id}
				tile={t}
				placed
				disabled={readOnly}
				onClick={() => remove(i)}
			/>,
		);
	});
	flush();

	return (
		<LayoutGroup id={groupId}>
			<div className="wordbank">
				{reference ? (
					<>
						<div className="wb-label">Starting query</div>
						<pre className="wb-ref">{reference.trim()}</pre>
					</>
				) : null}
				<div className="wb-label">
					<span aria-hidden="true">
						{fixing ? "Fix this query" : "Your query"}
					</span>
					{at !== null && !readOnly ? (
						<button
							type="button"
							className="wb-label-action"
							onClick={() => onChange(placed, null)}
						>
							Add at the end
						</button>
					) : fixing && !readOnly && sameIds(placed, preset ?? null) ? (
						<span className="wb-label-hint">Tap a word to remove it</span>
					) : null}
				</div>
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: tiles inside are the keyboard path */}
				<ul
					ref={answerRef}
					className="wb-answer"
					aria-label="Your query, tap a tile to remove it"
					onClick={(e) => {
						if (e.target === e.currentTarget && at !== null)
							onChange(placed, null);
					}}
				>
					{placed.length ? (
						items
					) : (
						<li className="wb-empty">Tap the words below to build it</li>
					)}
				</ul>
				<div className="wb-label" aria-hidden="true">
					<span>Tap to add</span>
					{pages > 1 ? (
						<span className="wb-label-hint">
							Part {Math.min(page + 1, pages)} of {pages}
						</span>
					) : null}
				</div>
				<ul className="wb-bank" aria-label="Word bank">
					{slots.map((s) => {
						const free = s.ids.filter((x) => !used.has(x));
						const top = free[0] ? byId.get(free[0]) : undefined;
						if (!top && s.ids.every((x) => preset?.includes(x))) return null;
						const kind = byId.get(s.ids[0])?.kind;
						return (
							<li key={s.ids[0]} className="wb-slot">
								<span className="wb-ghost" data-kind={kind} aria-hidden="true">
									{byId.get(s.ids[0])
										? label(byId.get(s.ids[0]) as Tile)
										: s.text}
								</span>
								{top ? (
									<TileButton
										key={top.id}
										tile={top}
										count={free.length}
										disabled={readOnly}
										onClick={() => insert(top.id)}
									/>
								) : null}
							</li>
						);
					})}
				</ul>
			</div>
		</LayoutGroup>
	);
}

// ───────────────────────────── suggestion strip

/**
 * Predictive strip pinned on top of the phone keyboard: the words that can
 * come next (tables after FROM, columns, operators, sample values), plus the
 * screen's main actions so they stay reachable while typing.
 */
function SuggestionBar({
	suggestions,
	onPick,
	onDone,
	actions,
}: {
	suggestions: Suggestions;
	onPick: (token: string) => void;
	onDone: () => void;
	actions?: React.ReactNode;
}) {
	const scroller = useRef<HTMLDivElement>(null);
	const key = suggestions.items.join("|");
	// Chips act on pointerup: their pointerdown is cancelled to keep the editor
	// focused (and the keyboard up), which on iOS also swallows the click. A
	// horizontal swipe cancels the pointer, so scrolling the strip picks nothing.
	const suppressClick = useRef(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on a new list
	useEffect(() => {
		scroller.current?.scrollTo({ left: 0 });
	}, [key]);
	return createPortal(
		<div data-suggest-bar className="suggest-bar">
			<div
				ref={scroller}
				className="suggest-chips"
				role="toolbar"
				aria-label="Suggestions"
			>
				{suggestions.items.length ? (
					suggestions.items.map((s) => (
						<button
							key={s}
							type="button"
							className="suggest-chip"
							data-kind={
								/^[A-Z][A-Z ]+$/.test(s)
									? "keyword"
									: s.startsWith("'")
										? "string"
										: undefined
							}
							onPointerDown={(e) => e.preventDefault()}
							onPointerUp={(e) => {
								if (e.pointerType === "mouse") return;
								suppressClick.current = Date.now() + 500;
								onPick(s);
							}}
							onClick={() => {
								if (Date.now() < suppressClick.current) return;
								onPick(s);
							}}
						>
							{s}
						</button>
					))
				) : (
					<span className="px-2 text-xs font-bold text-muted-foreground">
						Keep typing
					</span>
				)}
			</div>
			<div className="suggest-actions">
				{actions}
				<button
					type="button"
					className="suggest-icon"
					aria-label="Hide the keyboard"
					onClick={onDone}
				>
					<GameIcon name="chevron-down" className="size-5" />
				</button>
			</div>
		</div>,
		document.body,
	);
}

// ───────────────────────────── composer

export interface SqlComposerHandle {
	focus: () => void;
}

/**
 * Where the learner writes SQL. Touch screens start on the word bank
 * (tap to build, like Duolingo); "Use keyboard" switches to the editor with a
 * suggestion strip on the keyboard. The choice is remembered.
 */
export function SqlComposer({
	ref,
	value,
	onChange,
	solutionSql,
	seed,
	catalog,
	functions,
	autocomplete = true,
	errorLine,
	readOnly,
	onRun,
	onSubmit,
	minHeight = "8.5rem",
	fill,
	keyboardActions,
	prompt,
	starterSql: starterRaw,
	className,
}: {
	ref?: React.Ref<SqlComposerHandle>;
	value: string;
	onChange: (v: string) => void;
	solutionSql: string;
	/** Stable id (exercise id) so the bank shuffles the same way each visit. */
	seed: string;
	catalog?: Catalog;
	functions?: string[];
	autocomplete?: boolean;
	errorLine?: number;
	readOnly?: boolean;
	onRun?: () => void;
	onSubmit?: () => void;
	minHeight?: string;
	fill?: boolean;
	/** Compact actions shown on the suggestion strip while typing (Test, Submit). */
	keyboardActions?: React.ReactNode;
	/** Pre-filled SQL of the exercise, dropped in tile mode when it cannot be extended. */
	starterSql?: string;
	/** The task, repeated above the editor while typing full screen on a phone. */
	prompt?: React.ReactNode;
	className?: string;
}) {
	// "..." / "…" in a starter mark a gap to fill, not tiles: drop them.
	const starterSql = useMemo(() => stripPlaceholders(starterRaw), [starterRaw]);
	const touch = useMediaQuery("(pointer: coarse)", false);
	const pref = useGame((s) => s.settings.composer);
	const editorRef = useRef<SqlEditorHandle>(null);

	const schema = useMemo(
		() =>
			catalog
				? Object.fromEntries(
						catalog.tables.map((t) => [t.name, t.columns.map((c) => c.name)]),
					)
				: undefined,
		[catalog],
	);
	const samples = useMemo(
		() => (catalog ? sampleValues(catalog) : undefined),
		[catalog],
	);
	// Built once the schema is known, so distractors do not reshuffle later.
	const bank = useMemo(
		() =>
			schema ? buildBank(solutionSql, seed, schema, { starterSql }) : null,
		[solutionSql, seed, schema, starterSql],
	);
	const task = useMemo(
		() => taskHints(solutionSql, starterSql, schema, seed),
		[solutionSql, starterSql, schema, seed],
	);

	const wantTiles = pref === "tiles" || (pref === "auto" && touch);
	const mode: "tiles" | "keyboard" = wantTiles && bank ? "tiles" : "keyboard";

	// Pre-filled SQL is laid out as tiles to start from: a skeleton with the
	// cursor in its gap, or a query to fix by swapping tiles. When the tiles
	// cannot express it, it is shown to read above an empty answer instead.
	const starterIds = useMemo(
		() => (bank && starterSql?.trim() ? toTiles(starterSql, bank) : null),
		[bank, starterSql],
	);
	const fixing = !!starterIds && needsFix(starterSql ?? "", solutionSql);
	const starterCaret = useMemo(
		() => (starterSql?.trim() ? firstGap(starterSql, solutionSql) : null),
		[starterSql, solutionSql],
	);

	// Tiles: placed tile ids. Typed SQL the bank cannot express is stashed so
	// switching back to the keyboard gives it back.
	const [placed, setPlaced] = useState<string[]>([]);
	const [caret, setCaret] = useState<number | null>(null);
	const [stash, setStash] = useState<string | null>(null);
	const [droppedStarter, setDroppedStarter] = useState(false);
	const synced = useRef<string | null>(null);
	useEffect(() => {
		if (mode !== "tiles" || !bank) return;
		const texts = (ids: string[]) =>
			render(ids.map((id) => bank.find((t) => t.id === id)?.text ?? ""));
		if (
			synced.current !== null &&
			(value === synced.current || value === texts(placed))
		)
			return;
		const atStarter = !!starterSql?.trim() && sameSql(value, starterSql);
		if (atStarter && !starterIds) {
			setPlaced([]);
			setCaret(null);
			setStash(null);
			setDroppedStarter(true);
			synced.current = "";
			if (value) onChange("");
			return;
		}
		const ids = value.trim() ? toTiles(value, bank) : [];
		if (ids) {
			setPlaced(ids);
			setCaret(atStarter ? starterCaret : null);
			setStash(null);
		} else {
			setPlaced([]);
			setCaret(null);
			setStash(value);
		}
		synced.current = value;
	}, [
		mode,
		bank,
		value,
		placed,
		starterSql,
		starterIds,
		starterCaret,
		onChange,
	]);

	const setTiles = (ids: string[], next: number | null = null) => {
		if (!bank) return;
		setPlaced(ids);
		setCaret(next);
		const sql = render(
			ids.map((id) => bank.find((t) => t.id === id)?.text ?? ""),
		);
		synced.current = sql;
		if (ids.length) setStash(null);
		onChange(sql);
	};

	const switchTo = (next: "tiles" | "keyboard") => {
		gameActions.updateSettings({ composer: next });
		if (next === "keyboard" && stash !== null && !placed.length) {
			onChange(stash);
			setStash(null);
		}
		synced.current = null;
	};

	// Keyboard mode: suggestions follow the caret while the editor has focus.
	const [focused, setFocused] = useState(false);
	const [cursor, setCursor] = useState({ before: "", after: "" });
	const showBar = mode === "keyboard" && touch && focused && !readOnly;
	const suggestions = useMemo(
		() =>
			showBar
				? suggest(cursor.before, {
						schema,
						samples,
						functions,
						after: cursor.after,
						task,
					})
				: null,
		[showBar, cursor, schema, samples, functions, task],
	);
	useEffect(() => {
		const root = document.documentElement;
		if (showBar) root.dataset.composing = "true";
		else delete root.dataset.composing;
		return () => {
			delete root.dataset.composing;
		};
	}, [showBar]);

	useImperativeHandle(ref, () => ({
		focus() {
			if (mode === "keyboard") editorRef.current?.focus();
		},
	}));

	const toggle =
		bank && !readOnly ? (
			<button
				type="button"
				className="composer-toggle"
				onClick={() => switchTo(mode === "tiles" ? "keyboard" : "tiles")}
				aria-label={mode === "tiles" ? "Use the keyboard" : "Use the word bank"}
			>
				<GameIcon
					name={mode === "tiles" ? "keyboard" : "tiles"}
					className="size-5"
				/>
				{mode === "tiles" ? "Keyboard" : "Word bank"}
			</button>
		) : null;

	if (mode === "tiles" && bank)
		return (
			<div className={cn("composer flex flex-col", className)}>
				<WordBank
					bank={bank}
					placed={placed}
					caret={caret}
					onChange={setTiles}
					readOnly={readOnly}
					groupId={`wb-${seed}`}
					reference={droppedStarter ? starterRaw : undefined}
					fixing={fixing}
					preset={starterIds}
				/>
				<div className="composer-foot">
					{toggle}
					<span className="flex-1" />
					{readOnly ? null : starterIds && !sameIds(placed, starterIds) ? (
						<button
							type="button"
							className="composer-toggle"
							onClick={() => setTiles(starterIds, starterCaret)}
						>
							<GameIcon name="rewind" className="size-5" /> Start over
						</button>
					) : !starterIds && placed.length ? (
						<button
							type="button"
							className="composer-toggle"
							onClick={() => setTiles([])}
						>
							<GameIcon name="rewind" className="size-5" /> Clear
						</button>
					) : null}
				</div>
			</div>
		);

	// Phones: while typing, the composer leaves the page and fills exactly the
	// visible area above the keyboard (task on top, editor, suggestion strip),
	// so iOS never has to scroll the page around the caret. Same element, only
	// its position changes, so the editor keeps focus and the keyboard stays up.
	const focusMode = showBar;
	return (
		<div
			className={cn(
				"composer flex flex-col",
				fill && !focusMode && "h-full",
				focusMode && "composer-focus",
				className,
			)}
		>
			{focusMode && prompt ? (
				<div className="composer-focus-task">{prompt}</div>
			) : null}
			<div className={cn((fill || focusMode) && "min-h-0 flex-1")}>
				<SqlEditor
					ref={editorRef}
					value={value}
					onChange={onChange}
					onRun={onRun}
					onSubmit={onSubmit}
					schema={schema}
					functions={functions}
					autocomplete={autocomplete && !touch}
					closeBrackets={!touch}
					errorLine={errorLine}
					readOnly={readOnly}
					bare
					fill={fill || focusMode}
					className={cn((fill || focusMode) && "h-full")}
					minHeight={focusMode ? "100%" : minHeight}
					onCursor={(before, after) => setCursor({ before, after })}
					onFocusChange={setFocused}
				/>
			</div>
			{toggle && touch && !focusMode ? (
				<div className="composer-foot">{toggle}</div>
			) : null}
			{showBar && suggestions ? (
				<SuggestionBar
					suggestions={suggestions}
					onPick={(t) => editorRef.current?.insertToken(t, suggestions.partial)}
					onDone={() => editorRef.current?.blur()}
					actions={keyboardActions}
				/>
			) : null}
		</div>
	);
}
