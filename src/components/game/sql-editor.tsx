import { completeFromList } from "@codemirror/autocomplete";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Prec, RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	keymap,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import { useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "#/lib/utils";

/** Spellbook chrome: colors come from theme.css (.cm-editor, --editor-*). */
const gameTheme = EditorView.theme({
	".cm-content": { caretColor: "var(--lantern)", padding: "12px 0" },
	".cm-error-line": {
		backgroundColor: "var(--destructive-soft)",
		boxShadow: "inset 3px 0 0 var(--destructive)",
	},
	".cm-tooltip": {
		backgroundColor: "var(--popover)",
		border: "2px solid var(--border)",
		borderRadius: "14px",
		boxShadow: "0 4px 0 var(--ledge)",
		color: "var(--foreground)",
		overflow: "hidden",
	},
	".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)" },
	".cm-tooltip-autocomplete > ul > li[aria-selected]": {
		backgroundColor: "var(--accent)",
		color: "var(--foreground)",
	},
	".cm-placeholder": { color: "var(--syn-comment)", fontStyle: "italic" },
});

/** Syntax runes: lezer tags → .tok-* classes (theme.css, both modes). */
const runeHighlight = HighlightStyle.define([
	{ tag: [t.keyword, t.operatorKeyword, t.modifier], class: "tok-keyword" },
	{
		tag: [t.function(t.variableName), t.function(t.name), t.standard(t.name)],
		class: "tok-function",
	},
	{ tag: [t.string, t.special(t.string)], class: "tok-string" },
	{ tag: [t.number, t.integer, t.float], class: "tok-number" },
	{ tag: [t.bool], class: "tok-bool" },
	{ tag: [t.null], class: "tok-null" },
	{ tag: [t.typeName, t.className], class: "tok-type" },
	{
		tag: [t.operator, t.compareOperator, t.arithmeticOperator, t.logicOperator],
		class: "tok-operator",
	},
	{ tag: [t.comment, t.lineComment, t.blockComment], class: "tok-comment" },
	{ tag: [t.special(t.name), t.variableName], class: "tok-param" },
	{
		tag: [t.punctuation, t.bracket, t.separator, t.paren, t.squareBracket],
		class: "tok-punct",
	},
	{ tag: [t.name, t.propertyName, t.labelName], class: "tok-ident" },
]);

/** Table names known from the dataset get tok-table: "your query uses this table". */
function tableRunes(tables: string[]) {
	const names = new Set(tables.map((n) => n.toLowerCase()));
	const mark = Decoration.mark({ class: "tok-table" });
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = this.build(view);
			}
			update(u: ViewUpdate) {
				if (u.docChanged || u.viewportChanged)
					this.decorations = this.build(u.view);
			}
			build(view: EditorView) {
				const b = new RangeSetBuilder<Decoration>();
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					const re = /[A-Za-z_][A-Za-z0-9_]*/g;
					for (let m = re.exec(text); m; m = re.exec(text)) {
						if (names.has(m[0].toLowerCase()))
							b.add(from + m.index, from + m.index + m[0].length, mark);
					}
				}
				return b.finish();
			}
		},
		{ decorations: (v) => v.decorations },
	);
}

export interface SqlEditorHandle {
	insert: (text: string) => void;
	/** Insert a suggested token, replacing `partial` (the word being typed). */
	insertToken: (token: string, partial: string) => void;
	focus: () => void;
	blur: () => void;
}

const GLUE_LEFT = new Set([",", ")", ";", "."]);

export function SqlEditor({
	ref,
	value,
	onChange,
	onRun,
	onSubmit,
	schema,
	functions,
	autocomplete = true,
	errorLine,
	readOnly,
	className,
	minHeight = "160px",
	placeholder = "-- write your SQL here",
	ariaLabel = "SQL editor",
	bare,
	fill,
	onCursor,
	onFocusChange,
}: {
	ref?: React.Ref<SqlEditorHandle>;
	value: string;
	onChange?: (v: string) => void;
	onRun?: () => void;
	onSubmit?: () => void;
	schema?: Record<string, string[]>;
	functions?: string[];
	autocomplete?: boolean;
	errorLine?: number;
	readOnly?: boolean;
	className?: string;
	minHeight?: string;
	placeholder?: string;
	ariaLabel?: string;
	/** No frame (inside the editor frame). */
	bare?: boolean;
	/** Fill the parent's height (desktop panel); otherwise grow with the text. */
	fill?: boolean;
	/** SQL before the cursor, on every edit or caret move. */
	onCursor?: (before: string) => void;
	onFocusChange?: (focused: boolean) => void;
}) {
	const viewRef = useRef<EditorView | null>(null);
	const runRef = useRef(onRun);
	const submitRef = useRef(onSubmit);
	useLayoutEffect(() => {
		runRef.current = onRun;
		submitRef.current = onSubmit;
	});

	useImperativeHandle(ref, () => ({
		insert(text: string) {
			const view = viewRef.current;
			if (!view) return;
			const { from, to } = view.state.selection.main;
			const before = view.state.sliceDoc(Math.max(0, from - 1), from);
			const needsSpace =
				/^[A-Z]/.test(text) && before !== "" && !/[\s(]/.test(before);
			const insert = (needsSpace ? " " : "") + text;
			let cursor = from + insert.length;
			if (text === "()" || text === "''") cursor -= 1;
			view.dispatch({
				changes: { from, to, insert },
				selection: { anchor: cursor },
				scrollIntoView: true,
			});
			view.focus();
		},
		insertToken(token: string, partial: string) {
			const view = viewRef.current;
			if (!view) return;
			const { from, to } = view.state.selection.main;
			const start = Math.max(0, from - partial.length);
			const before = view.state.sliceDoc(Math.max(0, start - 1), start);
			const glued =
				GLUE_LEFT.has(token) ||
				token.endsWith(".") ||
				before === "(" ||
				before === ".";
			const lead = before === "" || /\s/.test(before) || glued ? "" : " ";
			// Words get a trailing space so the next suggestion follows on; an
			// opening paren, a qualifier ("p.") or a function call stay open.
			const trail =
				token === "(" || token.endsWith("(") || token.endsWith(".") ? "" : " ";
			const insert = lead + token + trail;
			view.dispatch({
				changes: { from: start, to, insert },
				selection: { anchor: start + insert.length },
				scrollIntoView: true,
			});
			view.focus();
		},
		focus() {
			viewRef.current?.focus();
		},
		blur() {
			viewRef.current?.contentDOM.blur();
		},
	}));
	const cursorRef = useRef(onCursor);
	const focusRef = useRef(onFocusChange);
	useLayoutEffect(() => {
		cursorRef.current = onCursor;
		focusRef.current = onFocusChange;
	});

	const extensions = useMemo(() => {
		const exts = [
			sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true }),
			syntaxHighlighting(runeHighlight),
			gameTheme,
			EditorView.lineWrapping,
			EditorView.contentAttributes.of({
				"aria-label": ariaLabel,
				// Phone keyboards: no auto-capitals, autocorrect or spell check in code.
				autocapitalize: "off",
				autocorrect: "off",
				spellcheck: "false",
				enterkeyhint: "enter",
			}),
			EditorView.updateListener.of((u) => {
				if (u.focusChanged) focusRef.current?.(u.view.hasFocus);
				if (u.docChanged || u.selectionSet || u.focusChanged) {
					const pos = u.state.selection.main.head;
					cursorRef.current?.(u.state.sliceDoc(0, pos));
				}
			}),
			// Keep the caret clear of a fixed bottom bar (Cast / Next), which sits on
			// top of the keyboard on phones.
			EditorView.scrollMargins.of(() => ({ bottom: bottomBarHeight() })),
			Prec.highest(
				keymap.of([
					{
						key: "Mod-Enter",
						run: () => {
							runRef.current?.();
							return true;
						},
					},
					{
						key: "Shift-Mod-Enter",
						run: () => {
							submitRef.current?.();
							return true;
						},
					},
				]),
			),
		];
		if (schema) exts.push(tableRunes(Object.keys(schema)));
		if (functions?.length) {
			exts.push(
				PostgreSQL.language.data.of({
					autocomplete: completeFromList(
						functions.map((f) => ({
							label: f,
							type: "function",
							apply: `${f}(`,
							boost: -1,
						})),
					),
				}),
			);
		}
		if (errorLine) {
			exts.push(
				EditorView.decorations.of((view) => {
					const b = new RangeSetBuilder<Decoration>();
					if (errorLine <= view.state.doc.lines) {
						const line = view.state.doc.line(errorLine);
						b.add(
							line.from,
							line.from,
							Decoration.line({ class: "cm-error-line" }),
						);
					}
					return b.finish();
				}),
			);
		}
		// Min height lives on the content and the gutter (not the editor box), so
		// the line-number gutter runs the full height and a tap anywhere in the
		// empty area lands in the editor.
		exts.push(
			EditorView.theme({
				".cm-content, .cm-gutter": { minHeight: minHeight },
			}),
		);
		return exts;
	}, [schema, functions, errorLine, ariaLabel, minHeight]);

	return (
		<div
			className={cn(
				"overflow-hidden bg-editor",
				!bare && "rounded-lg border-2 border-border",
				className,
			)}
		>
			<CodeMirror
				value={value}
				onChange={(v: string, _vu: ViewUpdate) => onChange?.(v)}
				extensions={extensions}
				editable={!readOnly}
				readOnly={readOnly}
				theme="none"
				height={fill ? "100%" : undefined}
				placeholder={placeholder}
				onCreateEditor={(view) => {
					viewRef.current = view;
					// Dev only: lets browser playtests set the spell without typing.
					if (import.meta.env.DEV && !readOnly)
						(window as unknown as { __sqlqEditor?: EditorView }).__sqlqEditor =
							view;
				}}
				basicSetup={{
					autocompletion: autocomplete,
					foldGutter: false,
					highlightActiveLine: !readOnly,
					lineNumbers: !readOnly,
					searchKeymap: false,
				}}
				className={fill ? "h-full" : undefined}
			/>
		</div>
	);
}

const KEYWORD_KEYS = [
	"SELECT",
	"FROM",
	"WHERE",
	"JOIN",
	"ON",
	"GROUP BY",
	"ORDER BY",
	"AND",
	"LIMIT",
];
const SYMBOL_KEYS = [
	"*",
	",",
	"()",
	"''",
	"=",
	"<",
	">",
	";",
	"->>",
	"<->",
	"NULL",
	"AS",
];

/** Height of the fixed bars over the bottom edge (action bar, suggestion strip). */
function bottomBarHeight(): number {
	let h = 0;
	for (const bar of document.querySelectorAll<HTMLElement>(
		"[data-bottom-bar], [data-suggest-bar]",
	)) {
		const cs = getComputedStyle(bar);
		if (cs.position !== "fixed" || cs.display === "none") continue;
		h = Math.max(h, Math.round(bar.getBoundingClientRect().height));
	}
	return h ? h + 8 : 0;
}

/**
 * Quick-key bar: keycaps that insert at the cursor (no animation, typing
 * tier). Context keys = table names from the dataset in the table rune color.
 */
export function QuickKeys({
	onKey,
	tables = [],
	className,
}: {
	onKey: (text: string) => void;
	tables?: string[];
	className?: string;
}) {
	const key = (k: string, kind: "kw" | "sym" | "tbl") => (
		<button
			key={`${kind}-${k}`}
			type="button"
			onPointerDown={(e) => e.preventDefault()}
			onClick={() => onKey(kind === "tbl" ? `${k} ` : k)}
			className={cn("keycap", kind === "kw" && "kw", kind === "tbl" && "tbl")}
		>
			{k === "()" ? "( )" : k === "''" ? "' '" : k}
		</button>
	);
	return (
		<div className={className}>
			<div className="qk-label">Quick keys</div>
			<div className="quickkeys" role="toolbar" aria-label="SQL quick keys">
				{KEYWORD_KEYS.map((k) => key(k, "kw"))}
				{SYMBOL_KEYS.map((k) => key(k, "sym"))}
				{tables.map((k) => key(k, "tbl"))}
			</div>
		</div>
	);
}
