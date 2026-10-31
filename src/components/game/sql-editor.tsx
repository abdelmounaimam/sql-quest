import { completeFromList } from "@codemirror/autocomplete";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Prec, RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	keymap,
	type ViewUpdate,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import { useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "#/lib/utils";

const gameTheme = EditorView.theme({
	"&": {
		backgroundColor: "var(--editor)",
		color: "var(--foreground)",
	},
	".cm-content": { caretColor: "var(--reward)", padding: "12px 0" },
	".cm-cursor, .cm-dropCursor": {
		borderLeftColor: "var(--reward)",
		borderLeftWidth: "2px",
	},
	"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
		{
			backgroundColor:
				"color-mix(in oklab, var(--info) 26%, transparent) !important",
		},
	".cm-gutters": {
		backgroundColor: "var(--editor)",
		color: "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
		border: "none",
	},
	".cm-activeLine": {
		backgroundColor: "color-mix(in oklab, var(--info) 6%, transparent)",
	},
	".cm-activeLineGutter": {
		backgroundColor: "transparent",
		color: "var(--reward)",
	},
	".cm-error-line": {
		backgroundColor: "color-mix(in oklab, var(--destructive) 18%, transparent)",
		boxShadow: "inset 3px 0 0 var(--destructive)",
	},
	".cm-tooltip": {
		backgroundColor: "var(--card)",
		border: "1px solid var(--border)",
		color: "var(--foreground)",
	},
	".cm-tooltip-autocomplete > ul > li[aria-selected]": {
		backgroundColor: "var(--reward)",
		color: "var(--reward-foreground)",
	},
	".cm-completionIcon": { opacity: 0.8 },
	".cm-placeholder": { color: "var(--muted-foreground)", fontStyle: "italic" },
});

const gameHighlight = HighlightStyle.define([
	{ tag: t.keyword, color: "var(--destructive)", fontWeight: "700" },
	{ tag: [t.typeName, t.standard(t.name)], color: "var(--special)" },
	{ tag: [t.string, t.special(t.string)], color: "var(--success)" },
	{ tag: [t.number, t.bool, t.null], color: "var(--reward)" },
	{
		tag: [t.comment, t.lineComment, t.blockComment],
		color: "var(--muted-foreground)",
		fontStyle: "italic",
	},
	{
		tag: [t.operator, t.punctuation, t.bracket],
		color: "var(--muted-foreground)",
	},
	{ tag: [t.name, t.propertyName], color: "var(--info)" },
	{ tag: t.special(t.name), color: "var(--info)" },
]);

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
	placeholder = "-- write your SQL here, Ctrl+Enter runs it",
	ariaLabel = "SQL editor",
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
			syntaxHighlighting(gameHighlight),
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
				"overflow-hidden rounded-xl border border-border bg-[var(--editor)]",
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

const QUICK_KEYS = [
	"SELECT",
	"FROM",
	"WHERE",
	"JOIN",
	"ON",
	"GROUP BY",
	"ORDER BY",
	"*",
	",",
	";",
	"''",
	"()",
	"=",
	"<",
	">",
	"AND",
	"OR",
	"NULL",
	"LIMIT",
	"AS",
	"->>",
	"<->",
];

/** Horizontal SQL keyboard for phones. Sits above the on-screen keyboard. */
export function QuickKeys({
	onKey,
	className,
}: {
	onKey: (text: string) => void;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"no-scrollbar flex gap-1.5 overflow-x-auto border-t border-border bg-muted px-2 py-2",
				className,
			)}
			role="toolbar"
			aria-label="SQL quick keys"
		>
			{QUICK_KEYS.map((k) => (
				<button
					key={k}
					type="button"
					onPointerDown={(e) => e.preventDefault()}
					onClick={() => onKey(k)}
					className="h-9 shrink-0 rounded-lg border border-border bg-card px-3 font-mono text-xs font-bold text-foreground shadow-[0_2px_0_var(--secondary)] active:translate-y-0.5 active:shadow-none"
				>
					{k}
				</button>
			))}
		</div>
	);
}
