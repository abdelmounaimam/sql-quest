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
	lineStarts,
	render,
	type Suggestions,
	suggest,
	type Tile,
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

const sameSql = (a: string, b: string) =>
	tokenize(a).join(" ") === tokenize(b).join(" ");
/** True when the solution can be reached by appending tiles to `start`. */
function isPrefix(start: string, solution: string): boolean {
	const a = tokenize(start).map((t) => t.toUpperCase());
	const b = tokenize(solution).map((t) => t.toUpperCase());
	return a.length <= b.length && a.every((t, i) => t === b[i]);
}

// ───────────────────────────── word bank

function TileButton({
	tile,
	onClick,
	placed,
	disabled,
}: {
	tile: Tile;
	onClick: () => void;
	placed?: boolean;
	disabled?: boolean;
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
			{tile.text}
		</motion.button>
	);
}

/**
 * Duolingo-style word bank: tap tiles to build the query, tap a placed tile to
 * send it back. No text field, so no keyboard ever opens.
 */
function WordBank({
	bank,
	placed,
	onChange,
	readOnly,
	groupId,
	reference,
}: {
	/** Starting SQL to look at while rebuilding it (fix-the-query exercises). */
	reference?: string;
	bank: Tile[];
	placed: string[];
	onChange: (ids: string[]) => void;
	readOnly?: boolean;
	groupId: string;
}) {
	const byId = useMemo(() => new Map(bank.map((t) => [t.id, t])), [bank]);
	const used = new Set(placed);
	const breaks = lineStarts(placed.map((id) => byId.get(id)?.text ?? ""));
	const tap = (ids: string[]) => {
		sfx("tap");
		onChange(ids);
	};
	return (
		<LayoutGroup id={groupId}>
			<div className="wordbank">
				{reference ? (
					<>
						<div className="wb-label">Query to fix</div>
						<pre className="wb-ref">{reference.trim()}</pre>
					</>
				) : null}
				<div className="wb-label" aria-hidden="true">
					Your query
				</div>
				<ul
					className="wb-answer"
					aria-label="Your query, tap a tile to remove it"
				>
					{placed.length ? (
						placed.map((id, i) => {
							const t = byId.get(id);
							if (!t) return null;
							return (
								<li key={id} className="contents">
									{breaks[i] ? (
										<span className="wb-break" aria-hidden="true" />
									) : null}
									<TileButton
										tile={t}
										placed
										disabled={readOnly}
										onClick={() => tap(placed.filter((x) => x !== id))}
									/>
								</li>
							);
						})
					) : (
						<li className="wb-empty">Tap the words below to build it</li>
					)}
				</ul>
				<div className="wb-label" aria-hidden="true">
					Tap to add
				</div>
				<ul className="wb-bank" aria-label="Word bank">
					{bank.map((t) => (
						<li key={t.id} className="wb-slot">
							<span className="wb-ghost" aria-hidden="true">
								{t.text}
							</span>
							{used.has(t.id) ? null : (
								<TileButton
									tile={t}
									disabled={readOnly}
									onClick={() => tap([...placed, t.id])}
								/>
							)}
						</li>
					))}
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
	starterSql,
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
		() => (schema ? buildBank(solutionSql, seed, schema) : null),
		[solutionSql, seed, schema],
	);

	const wantTiles = pref === "tiles" || (pref === "auto" && touch);
	const mode: "tiles" | "keyboard" = wantTiles && bank ? "tiles" : "keyboard";

	// Tiles: placed tile ids. Typed SQL the bank cannot express is stashed so
	// switching back to the keyboard gives it back.
	const [placed, setPlaced] = useState<string[]>([]);
	const [stash, setStash] = useState<string | null>(null);
	// Pre-filled SQL that tiles cannot extend (a query to fix): shown read-only.
	const [droppedStarter, setDroppedStarter] = useState(false);
	const synced = useRef<string | null>(null);
	useEffect(() => {
		if (mode !== "tiles" || !bank) return;
		const texts = (ids: string[]) =>
			render(ids.map((id) => bank.find((t) => t.id === id)?.text ?? ""));
		if (synced.current !== null && value === texts(placed)) return;
		// Tiles only append, so pre-filled SQL with a gap to fill in the middle
		// ("SELECT … FROM pilots;") cannot be completed by tapping: start empty.
		if (
			starterSql?.trim() &&
			sameSql(value, starterSql) &&
			!isPrefix(starterSql, solutionSql)
		) {
			setPlaced([]);
			setStash(null);
			setDroppedStarter(true);
			synced.current = "";
			if (value) onChange("");
			return;
		}
		const ids = value.trim() ? toTiles(value, bank) : [];
		if (ids) {
			setPlaced(ids);
			setStash(null);
		} else {
			setPlaced([]);
			setStash(value);
		}
		synced.current = value;
	}, [mode, bank, value, placed, starterSql, solutionSql, onChange]);

	const setTiles = (ids: string[]) => {
		if (!bank) return;
		setPlaced(ids);
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
	const [before, setBefore] = useState("");
	const showBar = mode === "keyboard" && touch && focused && !readOnly;
	const suggestions = useMemo(
		() => (showBar ? suggest(before, { schema, samples, functions }) : null),
		[showBar, before, schema, samples, functions],
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
					onChange={setTiles}
					readOnly={readOnly}
					groupId={`wb-${seed}`}
					reference={droppedStarter ? starterSql : undefined}
				/>
				<div className="composer-foot">
					{toggle}
					<span className="flex-1" />
					{placed.length && !readOnly ? (
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
					onCursor={setBefore}
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
