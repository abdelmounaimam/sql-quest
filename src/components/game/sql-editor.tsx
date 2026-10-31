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

/** Table names known from the dataset get tok-table: "your spell touches this chest". */
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
	focus: () => void;
}

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
	placeholder = "-- write your spell here. Ctrl+Enter tests it, Ctrl+Shift+Enter casts it",
	ariaLabel = "SQL editor",
	bare,
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
	/** No frame (inside the spellbook frame). */
	bare?: boolean;
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
		focus() {
			viewRef.current?.focus();
		},
	}));

	const extensions = useMemo(() => {
		const exts = [
			sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true }),
			syntaxHighlighting(runeHighlight),
			gameTheme,
			EditorView.lineWrapping,
			EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
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
		return exts;
	}, [schema, functions, errorLine, ariaLabel]);

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
				minHeight={minHeight}
				height="100%"
				placeholder={placeholder}
				onCreateEditor={(view) => {
					viewRef.current = view;
				}}
				basicSetup={{
					autocompletion: autocomplete,
					foldGutter: false,
					highlightActiveLine: !readOnly,
					lineNumbers: !readOnly,
					searchKeymap: false,
				}}
				className="h-full"
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
