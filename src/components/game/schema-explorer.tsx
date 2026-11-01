import {
	Background,
	type Edge,
	Handle,
	type Node,
	type NodeProps,
	Panel,
	Position,
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMatch } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
	createContext,
	use,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	Catalog,
	CatalogColumn,
	CatalogTable,
} from "#/engine/checker/pglite-provider";
import { sqlClient } from "#/engine/sql/client";
import { useCatalog, usePeek } from "#/game/sql-queries";
import { useIsDesktop } from "#/hooks/use-media";
import { datasetById } from "#/lib/content";
import { cn } from "#/lib/utils";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Skeleton } from "../ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { GameIcon } from "./icons";
import { ResultGrid } from "./result-grid";

/** 13 data-type families (design-direction §3.5): hue + glyph, never color alone. */
const GEOMETRIC = new Set([
	"point",
	"line",
	"lseg",
	"box",
	"path",
	"polygon",
	"circle",
	"inet",
	"cidr",
]);
export function typeFamily(col: CatalogColumn): {
	type: string;
	glyph: string;
} {
	switch (col.category) {
		case "int":
			return { type: "int", glyph: "#" };
		case "numeric":
			return { type: "numeric", glyph: "#.#" };
		case "text":
			return { type: "text", glyph: "Aa" };
		case "bool":
			return { type: "bool", glyph: "T/F" };
		case "date":
		case "timestamp":
		case "time":
		case "interval":
			return { type: "datetime", glyph: "◷" };
		case "uuid":
			return { type: "uuid", glyph: "id" };
		case "json":
			return { type: "jsonb", glyph: "{ }" };
		case "array":
			return { type: "array", glyph: "[ ]" };
		case "enum":
			return { type: "enum", glyph: "⋯" };
		case "range":
			return { type: "range", glyph: "[ )" };
		case "vector":
			return { type: "vector", glyph: "→" };
		default:
			if (/^ts(vector|query)$/.test(col.udtName))
				return { type: "tsvector", glyph: "¶" };
			if (GEOMETRIC.has(col.udtName)) return { type: "geometric", glyph: "△" };
			return { type: "uuid", glyph: "id" };
	}
}

/**
 * Short spelling of long Postgres type names, for the compact diagram cards
 * ("timestamp with time zone" does not fit a 288px card). Every short form is
 * a valid Postgres type name too.
 */
export function shortType(dataType: string): string {
	return dataType
		.replace(/^timestamp(\(\d+\))? with time zone/, "timestamptz$1")
		.replace(/^timestamp(\(\d+\))? without time zone/, "timestamp$1")
		.replace(/^time(\(\d+\))? with time zone/, "timetz$1")
		.replace(/^time(\(\d+\))? without time zone/, "time$1")
		.replace(/^character varying/, "varchar")
		.replace(/^double precision/, "float8");
}

export function TypeBadge({
	col,
	short,
}: {
	col: CatalogColumn;
	short?: boolean;
}) {
	const f = typeFamily(col);
	return (
		<Badge
			variant="type"
			data-type={f.type}
			title={
				col.enumLabels
					? `enum: ${col.enumLabels.join(", ")}`
					: col.vectorDim
						? `${col.vectorDim}-dimensional vector`
						: col.dataType
			}
		>
			<span className="opacity-85" aria-hidden="true">
				{f.glyph}
			</span>
			{short ? shortType(col.dataType) : col.dataType}
		</Badge>
	);
}

/** Mini JSON tree: keys in function blue, strings green, numbers pink. */
function JsonTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
	if (value === null) return <span className="tok-null">null</span>;
	if (typeof value === "string")
		return <span className="tok-string">"{value}"</span>;
	if (typeof value === "number" || typeof value === "boolean")
		return <span className="tok-number">{String(value)}</span>;
	if (depth >= 3) return <span className="tok-comment">…</span>;
	if (Array.isArray(value))
		return (
			<span>
				[
				{value.slice(0, 8).map((v, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static preview
					<span key={i}>
						{i ? ", " : ""}
						<JsonTree value={v} depth={depth + 1} />
					</span>
				))}
				{value.length > 8 ? `, +${value.length - 8}` : ""}]
			</span>
		);
	const entries = Object.entries(value as Record<string, unknown>);
	return (
		<span>
			{"{ "}
			{entries.map(([k, v], i) => (
				<span key={k}>
					{i ? ", " : ""}
					<span className="tok-function">"{k}"</span>:{" "}
					<JsonTree value={v} depth={depth + 1} />
				</span>
			))}
			{" }"}
		</span>
	);
}

function VectorBars({ value }: { value: unknown }) {
	const nums = String(value ?? "")
		.replace(/[[\]]/g, "")
		.split(",")
		.map(Number)
		.filter((n) => Number.isFinite(n))
		.slice(0, 64);
	if (!nums.length) return null;
	const max = Math.max(...nums.map(Math.abs), 1e-9);
	return (
		<div className="vbars" title={`${nums.length} dimensions`}>
			{nums.map((n, i) => (
				<i
					// biome-ignore lint/suspicious/noArrayIndexKey: positional dimensions
					key={i}
					style={{ height: `${Math.max(6, (Math.abs(n) / max) * 100)}%` }}
				/>
			))}
		</div>
	);
}

// ───────────────────────────── context

interface ExplorerCtx {
	hovered: string | null;
	setHovered: (t: string | null) => void;
	related: Set<string>;
	active: Set<string>;
	activeColumns: Set<string>;
	onPeek: (t: string) => void;
	notes?: Record<string, string>;
	columnNotes?: Record<string, string>;
	/** Tables ("t") and columns ("t.c") that appeared since the previous catalog. */
	fresh: Set<string>;
	/** Tables the current mission works with (from its starter and solution SQL). */
	mission: Set<string>;
	/** Inside a compact diagram card: short type names. */
	compact?: boolean;
}
const Ctx = createContext<ExplorerCtx | null>(null);

// ───────────────────────────── chest

function ChestColumn({
	table,
	col,
}: {
	table: CatalogTable;
	col: CatalogColumn;
}) {
	const ctx = use(Ctx);
	const hot =
		ctx?.active.has(table.name) &&
		ctx.activeColumns.has(col.name.toLowerCase());
	const sample = table.jsonSamples[col.name]?.[0];
	const vectorSample =
		col.category === "vector"
			? table.sampleRows.rows[0]?.[
					table.sampleRows.columns.findIndex((c) => c.name === col.name)
				]
			: undefined;
	const isNew = !!ctx?.fresh.has(`${table.name}.${col.name}`);
	return (
		<motion.li
			initial={isNew ? { opacity: 0, x: -8 } : false}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1], delay: 0.15 }}
			className={cn(
				hot && "hot",
				isNew && "shadow-[inset_3px_0_0_var(--success)]",
			)}
			title={ctx?.columnNotes?.[`${table.name}.${col.name}`]}
		>
			<span
				className={cn(
					"kk",
					col.isPrimaryKey ? "pk" : col.references ? "fk" : "",
				)}
			>
				{col.isPrimaryKey ? (
					<GameIcon name="key" />
				) : col.references ? (
					<GameIcon name="link" />
				) : null}
			</span>
			<span className="cn">
				{col.name}
				{col.nullable ? <span className="q"> ?</span> : null}
			</span>
			{sample !== undefined || vectorSample !== undefined ? (
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="rounded-sm"
							aria-label={`Preview ${col.name}`}
						>
							<TypeBadge col={col} short={ctx?.compact} />
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-80 text-sm">
						<div className="mb-2 font-extrabold">
							{table.name}.{col.name}
						</div>
						{sample !== undefined ? (
							<div className="preview-pop break-words">
								<JsonTree value={sample} />
							</div>
						) : (
							<>
								<VectorBars value={vectorSample} />
								<p className="mt-1 text-xs text-muted-foreground">
									{col.vectorDim} dimensions
								</p>
							</>
						)}
					</PopoverContent>
				</Popover>
			) : (
				<TypeBadge col={col} short={ctx?.compact} />
			)}
		</motion.li>
	);
}

export function Chest({
	table,
	compact,
	columns,
}: {
	table: CatalogTable;
	compact?: boolean;
	/** Subset of columns to list (diagram "keys only"); the rest are counted. */
	columns?: CatalogColumn[];
}) {
	const shown = columns ?? table.columns;
	const hidden = table.columns.length - shown.length;
	const ctx = use(Ctx);
	const lit = !!ctx?.active.has(table.name);
	const dim =
		ctx?.hovered && ctx.hovered !== table.name && !ctx.related.has(table.name);
	const isNew = !!ctx?.fresh.has(table.name);
	return (
		<motion.div
			initial={isNew ? { opacity: 0, y: 12, scale: 0.97 } : false}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ type: "spring", duration: 0.45, bounce: 0.2 }}
		>
			<Card
				variant="chest"
				data-lit={lit}
				className={cn(
					"transition-opacity duration-(--duration-fast)",
					dim && "opacity-40",
					compact ? "w-72" : "w-full",
				)}
				onMouseEnter={() => ctx?.setHovered(table.name)}
				onMouseLeave={() => ctx?.setHovered(null)}
			>
				<button
					type="button"
					className="lid w-full text-left"
					onClick={() => ctx?.onPeek(table.name)}
					title="Preview rows"
				>
					<span className="ico">
						<GameIcon name="table" />
					</span>
					<span className="nm truncate">{table.name}</span>
					<span className="rows flex items-center gap-1 tabular">
						{table.kind !== "table" ? `${table.kind} · ` : ""}
						{table.rowCount} rows <GameIcon name="eye" className="size-3.5" />
					</span>
				</button>
				{!compact && ctx?.notes?.[table.name] ? (
					<p className="px-3 pt-2.5 text-xs text-muted-foreground">
						{ctx.notes[table.name]}
					</p>
				) : null}
				<ul className="chest-cols">
					{shown.map((c) => (
						<ChestColumn key={c.name} table={table} col={c} />
					))}
				</ul>
				{hidden > 0 ? (
					<p className="-mt-1 px-3 pb-2.5 text-xs font-bold text-muted-foreground">
						+ {hidden} more column{hidden === 1 ? "" : "s"}
					</p>
				) : null}
				{lit || isNew ? (
					<div className="flex gap-2 px-3 pb-3">
						{isNew ? <Badge variant="success">New table</Badge> : null}
						{lit ? <span className="lit-tag">In your query</span> : null}
					</div>
				) : null}
			</Card>
		</motion.div>
	);
}

// ───────────────────────────── diagram (React Flow)

type TableNodeData = { table: CatalogTable; columns: CatalogColumn[] };

/** Column handle geometry, matched to the compact table card. */
const HANDLE_TOP = 62;
const ROW_H = 31;

function TableNode({ data }: NodeProps<Node<TableNodeData>>) {
	const t = data.table;
	return (
		<div className="relative">
			{data.columns.map((c, i) => (
				<span key={c.name}>
					<Handle
						type="target"
						position={Position.Left}
						id={`${c.name}-t`}
						className="!size-1.5 !border-0 !bg-transparent"
						style={{ top: HANDLE_TOP + i * ROW_H }}
						isConnectable={false}
					/>
					<Handle
						type="source"
						position={Position.Right}
						id={`${c.name}-s`}
						className="!size-1.5 !border-0 !bg-transparent"
						style={{ top: HANDLE_TOP + i * ROW_H }}
						isConnectable={false}
					/>
				</span>
			))}
			<CompactCtx>
				<Chest table={t} compact columns={data.columns} />
			</CompactCtx>
		</div>
	);
}

/** Diagram cards read the explorer context with short type names. */
function CompactCtx({ children }: { children: React.ReactNode }) {
	const ctx = use(Ctx);
	const value = useMemo(() => (ctx ? { ...ctx, compact: true } : null), [ctx]);
	return <Ctx value={value}>{children}</Ctx>;
}

const nodeTypes = { table: TableNode };

/** Columns drawn in the diagram: all, or only keys (PK, FK, referenced). */
function diagramColumns(catalog: Catalog, keysOnly: boolean) {
	const referenced = new Set<string>();
	for (const t of catalog.tables)
		for (const c of t.columns)
			if (c.references)
				referenced.add(`${c.references.table}.${c.references.column}`);
	const out = new Map<string, CatalogColumn[]>();
	for (const t of catalog.tables)
		out.set(
			t.name,
			keysOnly
				? t.columns.filter(
						(c) =>
							c.isPrimaryKey ||
							!!c.references ||
							referenced.has(`${t.name}.${c.name}`),
					)
				: t.columns,
		);
	return out;
}

function layout(
	catalog: Catalog,
	columns: Map<string, CatalogColumn[]>,
): Node<TableNodeData>[] {
	const level = new Map<string, number>();
	const tables = catalog.tables;
	const depth = (name: string, seen = new Set<string>()): number => {
		if (level.has(name)) return level.get(name) as number;
		if (seen.has(name)) return 0;
		seen.add(name);
		const t = tables.find((x) => x.name === name);
		const parents = (t?.columns ?? [])
			.map((c) => c.references?.table)
			.filter((p): p is string => !!p && p !== name);
		const d = parents.length
			? 1 + Math.max(...parents.map((p) => depth(p, seen)))
			: 0;
		level.set(name, d);
		return d;
	};
	for (const t of tables) depth(t.name);
	const cols = new Map<number, number>();
	return tables.map((t) => {
		const shown = columns.get(t.name) ?? t.columns;
		const l = level.get(t.name) ?? 0;
		const row = cols.get(l) ?? 0;
		const extra = shown.length < t.columns.length ? 26 : 0;
		cols.set(l, row + shown.length * ROW_H + 110 + extra);
		return {
			id: t.name,
			type: "table",
			position: { x: l * 340, y: row },
			data: { table: t, columns: shown },
		};
	});
}

/** Tables one foreign key away from `name` (both directions). */
function relatedTables(catalog: Catalog, name: string | null): Set<string> {
	const s = new Set<string>();
	if (!name) return s;
	for (const t of catalog.tables)
		for (const c of t.columns)
			if (c.references) {
				if (t.name === name) s.add(c.references.table);
				if (c.references.table === name) s.add(t.name);
			}
	s.delete(name);
	return s;
}

function FlowControls({ onExpand }: { onExpand?: () => void }) {
	return (
		<Panel position="bottom-right" className="flow-controls">
			<ZoomButtons />
			{onExpand ? (
				<button type="button" aria-label="Open full screen" onClick={onExpand}>
					<GameIcon name="expand" />
				</button>
			) : null}
		</Panel>
	);
}

/** Zoom in, zoom out, fit everything. Needs a React Flow provider above it. */
function ZoomButtons() {
	const rf = useReactFlow();
	return (
		<>
			<button
				type="button"
				aria-label="Zoom in"
				onClick={() => rf.zoomIn({ duration: 200 })}
			>
				<GameIcon name="plus" />
			</button>
			<button
				type="button"
				aria-label="Zoom out"
				onClick={() => rf.zoomOut({ duration: 200 })}
			>
				<GameIcon name="minus" />
			</button>
			<button
				type="button"
				aria-label="Fit the whole schema"
				onClick={() => rf.fitView({ padding: 0.12, duration: 300 })}
			>
				<GameIcon name="fit" />
			</button>
		</>
	);
}

/**
 * Frames the focused table, else the mission's tables, else the whole schema,
 * when focus or layout changes. Framed tables open at a readable zoom (at
 * least 0.6, so 13px text stays legible); the rest is one pan away.
 */
function FocusFit({
	focus,
	frame,
	layoutKey,
}: {
	focus: string | null;
	frame: string[];
	layoutKey: string;
}) {
	const rf = useReactFlow();
	const mounted = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: refit on focus or layout change
	useEffect(() => {
		// First run waits for React Flow to measure the nodes.
		const delay = mounted.current ? 30 : 280;
		mounted.current = true;
		const t = setTimeout(
			() =>
				// A focused table is framed on its own, readable; its links glow
				// off toward the neighbours (dimmed tables stay in place).
				rf.fitView({
					nodes: focus
						? [{ id: focus }]
						: frame.length
							? frame.map((id) => ({ id }))
							: undefined,
					padding: focus || frame.length ? 0.16 : 0.12,
					minZoom: focus || frame.length ? 0.6 : undefined,
					maxZoom: 1,
					duration: 320,
				}),
			delay,
		);
		return () => clearTimeout(t);
	}, [focus, layoutKey]);
	return null;
}

function Flow({
	catalog,
	keysOnly = false,
	focus = null,
	onFocus,
	interactive = true,
	controls = interactive,
	frame,
	onExpand,
}: {
	catalog: Catalog;
	keysOnly?: boolean;
	focus?: string | null;
	onFocus?: (t: string | null) => void;
	interactive?: boolean;
	/** Zoom buttons floating on the canvas (the full screen view has a bar instead). */
	controls?: boolean;
	/** Tables to frame when nothing is focused (the mission's tables). */
	frame?: string[];
	onExpand?: () => void;
}) {
	const ctx = use(Ctx);
	const columns = useMemo(
		() => diagramColumns(catalog, keysOnly),
		[catalog, keysOnly],
	);
	const nodes = useMemo(() => layout(catalog, columns), [catalog, columns]);
	const edges = useMemo<Edge[]>(() => {
		const out: Edge[] = [];
		for (const t of catalog.tables)
			for (const c of t.columns)
				if (c.references) {
					const touchesFocus =
						!!focus && (t.name === focus || c.references.table === focus);
					const both =
						!!ctx?.active.has(t.name) && !!ctx.active.has(c.references.table);
					out.push({
						id: `${t.name}.${c.name}`,
						source: c.references.table,
						sourceHandle: `${c.references.column}-s`,
						target: t.name,
						targetHandle: `${c.name}-t`,
						type: "smoothstep",
						className: focus
							? touchesFocus
								? "is-referenced"
								: "is-dim"
							: both
								? "is-referenced"
								: undefined,
					});
				}
		return out;
	}, [catalog, ctx?.active, focus]);
	const dark =
		typeof document !== "undefined" &&
		document.documentElement.classList.contains("dark");
	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={nodeTypes}
			fitView
			fitViewOptions={{ padding: 0.12 }}
			minZoom={0.15}
			maxZoom={2.5}
			nodesConnectable={false}
			nodesDraggable={false}
			elementsSelectable={false}
			panOnDrag={interactive}
			zoomOnPinch={interactive}
			zoomOnScroll={interactive}
			zoomOnDoubleClick={interactive}
			preventScrolling={interactive}
			onNodeClick={onFocus ? (_, n) => onFocus(n.id) : undefined}
			onPaneClick={onFocus ? () => onFocus(null) : undefined}
			proOptions={{ hideAttribution: true }}
			colorMode={dark ? "dark" : "light"}
		>
			<Background gap={22} size={1.2} color="var(--border)" />
			{controls ? <FlowControls onExpand={onExpand} /> : null}
			{interactive ? (
				<FocusFit
					focus={focus}
					frame={frame ?? []}
					layoutKey={String(keysOnly)}
				/>
			) : null}
		</ReactFlow>
	);
}

/** Every foreign key as a readable line: child.column → parent.column. */
function Relationships({
	catalog,
	onPick,
}: {
	catalog: Catalog;
	onPick: (table: string) => void;
}) {
	const rels = catalog.tables.flatMap((t) =>
		t.columns
			.filter((c) => c.references)
			.map((c) => ({
				id: `${t.name}.${c.name}`,
				from: t.name,
				col: c.name,
				to: c.references?.table ?? "",
				toCol: c.references?.column ?? "",
			})),
	);
	return (
		<section aria-label="Relationships">
			<h3 className="mb-2 px-1 text-xs font-extrabold tracking-[.08em] text-muted-foreground uppercase">
				Relationships (foreign keys)
			</h3>
			{rels.length ? (
				<ul className="rel-list">
					{rels.map((r) => (
						<li key={r.id}>
							<button type="button" onClick={() => onPick(r.from)}>
								<span className="rel-from">
									<GameIcon name="link" className="size-4" />
									<span>
										{r.from}.<b>{r.col}</b>
									</span>
								</span>
								<span className="rel-to">
									<GameIcon name="arrow-right" className="size-4" />
									<span>
										{r.to}.<b>{r.toCol}</b>
									</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			) : (
				<p className="px-1 text-sm text-muted-foreground">
					No foreign keys in this schema: the tables stand alone.
				</p>
			)}
		</section>
	);
}

/**
 * Full screen diagram: the whole viewport for pinch and pan (no sheet to fight
 * with), zoom buttons, a table picker that frames a table and its neighbours,
 * and a "keys only" switch that shrinks every table to its key columns.
 */
function DiagramFullscreen({
	open,
	onOpenChange,
	catalog,
	datasetId,
	initialFocus,
	world,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	catalog: Catalog;
	datasetId: string;
	initialFocus: string | null;
	world?: string;
}) {
	const parent = use(Ctx);
	const [focus, setFocus] = useState<string | null>(initialFocus);
	const [keysOnly, setKeysOnly] = useState(false);
	const [peek, setPeek] = useState<string | null>(null);
	useEffect(() => {
		if (open) {
			setFocus(initialFocus);
			setPeek(null);
		}
	}, [open, initialFocus]);
	const related = useMemo(
		() => relatedTables(catalog, focus),
		[catalog, focus],
	);
	const ctx: ExplorerCtx | null = parent
		? {
				...parent,
				hovered: focus,
				setHovered: () => {},
				related,
				onPeek: (t) => setFocus(t),
			}
		: null;
	const focused = catalog.tables.find((t) => t.name === focus);
	const missionTables = useMemo(
		() =>
			catalog.tables
				.filter((t) => parent?.mission.has(t.name))
				.map((t) => t.name),
		[catalog, parent?.mission],
	);
	// The mission's tables first, then the rest in schema order.
	const chipTables = useMemo(
		() =>
			[...catalog.tables].sort(
				(a, b) =>
					Number(!!parent?.mission.has(b.name)) -
					Number(!!parent?.mission.has(a.name)),
			),
		[catalog, parent?.mission],
	);
	const chipsRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!focus) return;
		chipsRef.current
			?.querySelector<HTMLElement>(`[data-table="${CSS.escape(focus)}"]`)
			?.scrollIntoView({
				inline: "center",
				block: "nearest",
				behavior: "smooth",
			});
	}, [focus]);
	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Content
					className="diagram-full fixed inset-0 z-[60] flex flex-col bg-background pt-safe pb-safe outline-none"
					data-world={world}
					aria-describedby={undefined}
				>
					<header className="flex items-center gap-2 border-b-2 border-border bg-card px-safe-3 py-2">
						<DialogPrimitive.Title className="min-w-0 flex-1 truncate font-display text-xl">
							Schema diagram
						</DialogPrimitive.Title>
						<button
							type="button"
							className="diagram-chip tap-target"
							aria-pressed={keysOnly}
							onClick={() => setKeysOnly((k) => !k)}
						>
							<GameIcon name="key" className="size-4" /> Keys only
						</button>
						<DialogPrimitive.Close
							className="grid size-11 place-items-center rounded-md hover:bg-accent"
							aria-label="Close the diagram"
						>
							<GameIcon name="x" className="size-6" />
						</DialogPrimitive.Close>
					</header>
					<div
						ref={chipsRef}
						className="diagram-chips"
						role="toolbar"
						aria-label="Focus a table"
					>
						{chipTables.map((t) => (
							<button
								key={t.name}
								type="button"
								data-table={t.name}
								data-mission={parent?.mission.has(t.name) || undefined}
								className="diagram-chip tap-target"
								aria-pressed={focus === t.name}
								onClick={() => setFocus(focus === t.name ? null : t.name)}
							>
								{t.name}
							</button>
						))}
					</div>
					<ReactFlowProvider>
						<div className="relative min-h-0 flex-1">
							<Ctx value={ctx}>
								<Flow
									catalog={catalog}
									keysOnly={keysOnly}
									focus={focus}
									onFocus={setFocus}
									controls={false}
									frame={missionTables}
								/>
							</Ctx>
							<AnimatePresence>
								{peek ? (
									<PeekPanel
										key={peek}
										datasetId={datasetId}
										table={peek}
										onClose={() => setPeek(null)}
									/>
								) : null}
							</AnimatePresence>
						</div>
						{/* A bar under the canvas, not over it: the zoom buttons never
						    hide a table. */}
						<footer className="diagram-foot px-safe-3">
							{focused ? (
								<div className="flex min-w-0 flex-1 items-center gap-2">
									<div className="min-w-0 flex-1">
										<div className="truncate font-mono text-sm font-bold">
											{focused.name}
										</div>
										<div className="text-xs font-bold text-muted-foreground tabular">
											{focused.rowCount} rows · {focused.columns.length} columns
											{related.size ? ` · linked to ${related.size}` : ""}
										</div>
									</div>
									<button
										type="button"
										className="diagram-chip tap-target"
										onClick={() => setPeek(focused.name)}
									>
										<GameIcon name="eye" className="size-4" /> Rows
									</button>
								</div>
							) : (
								<p className="min-w-0 flex-1 text-xs font-bold text-muted-foreground">
									{missionTables.length
										? "Showing this mission's tables. Pinch or drag to see the rest."
										: "Pinch to zoom, drag to move, tap a table to focus it."}
								</p>
							)}
							<div className="flow-controls flow-controls-row">
								<ZoomButtons />
							</div>
						</footer>
					</ReactFlowProvider>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

/**
 * Diagram tab. Desktop: the live diagram in the panel. Phone: a still preview
 * that opens the full screen viewer (pinching inside a sheet drags the sheet),
 * plus the foreign keys as a list that reads without zooming.
 */
function DiagramView({
	catalog,
	datasetId,
}: {
	catalog: Catalog;
	datasetId: string;
}) {
	const isDesktop = useIsDesktop();
	const [open, setOpen] = useState(false);
	const [focus, setFocus] = useState<string | null>(null);
	const [world, setWorld] = useState<string | undefined>();
	const rootRef = useRef<HTMLDivElement>(null);
	const openAt = (t: string | null) => {
		setWorld(
			rootRef.current?.closest("[data-world]")?.getAttribute("data-world") ??
				undefined,
		);
		setFocus(t);
		setOpen(true);
	};
	const full = (
		<DiagramFullscreen
			open={open}
			onOpenChange={setOpen}
			catalog={catalog}
			datasetId={datasetId}
			initialFocus={focus}
			world={world}
		/>
	);
	if (isDesktop)
		return (
			<div ref={rootRef} className="relative h-full">
				<Flow catalog={catalog} onExpand={() => openAt(null)} />
				{full}
			</div>
		);
	return (
		<div
			ref={rootRef}
			className="flex h-full flex-col gap-4 overflow-y-auto overscroll-contain p-3 pb-6"
		>
			<div className="diagram-preview shrink-0">
				<div className="pointer-events-none h-60 w-full" inert>
					<Flow catalog={catalog} keysOnly interactive={false} />
				</div>
				<button
					type="button"
					className="absolute inset-0 flex items-end justify-center pb-3"
					onClick={() => openAt(null)}
					aria-label="Open the schema diagram full screen"
				>
					<span className="diagram-preview-cta">
						<GameIcon name="expand" className="size-5" /> Open full screen
					</span>
				</button>
			</div>
			<Relationships catalog={catalog} onPick={(t) => openAt(t)} />
			{full}
		</div>
	);
}

// ───────────────────────────── peek

function PeekPanel({
	datasetId,
	table,
	onClose,
}: {
	datasetId: string;
	table: string;
	onClose: () => void;
}) {
	const peek = usePeek(datasetId, table);
	return (
		<motion.div
			initial={{ y: "100%" }}
			animate={{ y: 0 }}
			exit={{ y: "100%" }}
			transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
			className="absolute inset-x-0 bottom-0 z-20 max-h-[80%] overflow-auto rounded-t-2xl border-t-2 border-border bg-card p-3"
			role="dialog"
			aria-label={`Rows in ${table}`}
		>
			<div className="mb-2 flex items-center justify-between gap-2">
				<div className="font-mono text-base font-bold">{table}</div>
				<button
					type="button"
					onClick={onClose}
					className="grid size-9 place-items-center rounded-md hover:bg-accent"
					aria-label="Close"
				>
					<GameIcon name="x" className="size-5" />
				</button>
			</div>
			{peek.isLoading ? (
				<Skeleton className="h-40 w-full" />
			) : peek.data ? (
				<ResultGrid
					table={peek.data}
					maxHeight="16rem"
					caption="First rows"
					animate={false}
				/>
			) : null}
		</motion.div>
	);
}

// ───────────────────────────── explorer

/** Tables/columns present now but not in the previous catalog of this dataset. */
function useFreshKeys(
	datasetId: string,
	catalog: Catalog | undefined,
): Set<string> {
	const prev = useRef<{ id: string; keys: Set<string> } | null>(null);
	const keys = useMemo(() => {
		const k = new Set<string>();
		for (const t of catalog?.tables ?? []) {
			k.add(t.name);
			for (const c of t.columns) k.add(`${t.name}.${c.name}`);
		}
		return k;
	}, [catalog]);
	const fresh = useMemo(() => {
		const p = prev.current;
		if (!p || p.id !== datasetId || !catalog) return new Set<string>();
		return new Set([...keys].filter((k) => !p.keys.has(k)));
	}, [keys, datasetId, catalog]);
	useEffect(() => {
		if (catalog) prev.current = { id: datasetId, keys };
	}, [keys, datasetId, catalog]);
	return fresh;
}

/** Words of the query: tables and columns the spell touches. */
/**
 * Starter and solution SQL of the exercise on screen, read from the play
 * route (mission, drill or boss), so the explorer knows the mission's tables
 * before the learner types anything.
 */
function useMissionSql(): string | undefined {
	const match = useMatch({
		from: "/_game/play/$chapterId",
		shouldThrow: false,
	});
	const chapter = match?.loaderData?.chapter;
	const search = match?.search;
	return useMemo(() => {
		if (!chapter || !search) return undefined;
		const all = [...chapter.exercises, ...(chapter.practice ?? [])];
		const ex =
			(search.ex ? all.find((e) => e.id === search.ex) : undefined) ??
			(search.phase === "boss" ? all.find((e) => e.boss) : undefined);
		return ex ? `${ex.starterSql ?? ""}\n${ex.solutionSql}` : undefined;
	}, [chapter, search]);
}

function queryWords(sql: string): Set<string> {
	return new Set(
		sql
			.replace(/--.*$/gm, " ")
			.toLowerCase()
			.split(/[^a-z0-9_]+/)
			.filter(Boolean),
	);
}

export function SchemaExplorer({
	datasetId,
	activeTables,
	sql = "",
	defaultView,
	className,
	showTabs = true,
	setupSql,
	liveSql,
	liveSeq = 0,
}: {
	datasetId: string;
	activeTables?: Set<string>;
	sql?: string;
	defaultView?: "diagram" | "chests";
	className?: string;
	showTabs?: boolean;
	/** Exercise setupSql: the chests show the sandbox catalog, not the bare dataset. */
	setupSql?: string;
	/** Learner SQL of the last run/cast, replayed in a sandbox to show what it created. */
	liveSql?: string;
	/** Bumped after each run/cast. */
	liveSeq?: number;
}) {
	const base = useCatalog(datasetId);
	const liveEnabled = !!setupSql?.trim() || liveSeq > 0;
	const live = useQuery({
		queryKey: ["liveCatalog", datasetId, setupSql ?? "", liveSeq],
		queryFn: () =>
			sqlClient().liveCatalog(
				datasetId,
				setupSql,
				liveSeq > 0 ? liveSql : undefined,
			),
		enabled: liveEnabled,
		placeholderData: keepPreviousData,
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});
	const catalog = liveEnabled && live.data ? live : base;
	const fresh = useFreshKeys(datasetId, catalog.data);
	const dataset = datasetById.get(datasetId);
	const [hovered, setHovered] = useState<string | null>(null);
	const [peek, setPeek] = useState<string | null>(null);
	const [view, setView] = useState<"diagram" | "chests">(
		defaultView ?? "chests",
	);

	const related = useMemo(() => {
		const s = new Set<string>();
		if (!hovered || !catalog.data) return s;
		for (const t of catalog.data.tables)
			for (const c of t.columns)
				if (c.references) {
					if (t.name === hovered) s.add(c.references.table);
					if (c.references.table === hovered) s.add(t.name);
				}
		return s;
	}, [hovered, catalog.data]);

	const words = useMemo(() => queryWords(sql), [sql]);
	const missionSql = useMissionSql();
	// The mission's own tables (named in its starter or solution SQL): listed
	// first and framed by the diagram, before the learner has typed anything.
	const mission = useMemo(() => {
		const out = new Set<string>();
		if (!missionSql) return out;
		const named = queryWords(missionSql);
		for (const t of catalog.data?.tables ?? [])
			if (named.has(t.name.toLowerCase())) out.add(t.name);
		return out;
	}, [missionSql, catalog.data]);
	const [showOthers, setShowOthers] = useState(false);
	// Lit chests: what the caller passed plus any table of the LIVE catalog the spell names
	// (a table the learner just created is not in the base schema).
	const active = useMemo(() => {
		const out = new Set(activeTables ?? []);
		for (const t of catalog.data?.tables ?? [])
			if (words.has(t.name.toLowerCase())) out.add(t.name);
		return out;
	}, [activeTables, catalog.data, words]);
	const unknownHint = useMemo(() => {
		// "FROM pilot" where only "pilots" exists: suggest the near chest.
		if (!catalog.data) return null;
		const m = /\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi;
		const names = catalog.data.tables.map((t) => t.name);
		for (let r = m.exec(sql); r; r = m.exec(sql)) {
			const n = r[1].toLowerCase();
			if (names.includes(n)) continue;
			const near = names.find(
				(t) =>
					t.startsWith(n) ||
					n.startsWith(t) ||
					t.replace(/s$/, "") === n.replace(/s$/, ""),
			);
			return { n, near };
		}
		return null;
	}, [sql, catalog.data]);

	const ctx: ExplorerCtx = {
		hovered,
		setHovered,
		related,
		active,
		activeColumns: words,
		onPeek: setPeek,
		fresh,
		mission,
		notes: dataset?.tableNotes,
		columnNotes: dataset?.columnNotes,
	};

	const tables = catalog.data
		? [...catalog.data.tables].sort(
				(a, b) =>
					Number(fresh.has(b.name)) - Number(fresh.has(a.name)) ||
					Number(active.has(b.name)) - Number(active.has(a.name)) ||
					Number(mission.has(b.name)) - Number(mission.has(a.name)),
			)
		: [];
	// With a mission, the tables it does not touch fold under one button.
	const isMain = (name: string) =>
		mission.has(name) || active.has(name) || fresh.has(name);
	const folded =
		mission.size > 0 && !showOthers
			? tables.filter((t) => !isMain(t.name))
			: [];
	const shownTables = folded.length
		? tables.filter((t) => isMain(t.name))
		: tables;

	const chests = (
		<div className="flex h-full flex-col gap-4 overflow-y-auto overscroll-contain p-3 pb-6">
			{unknownHint ? (
				<Badge variant="info" className="self-start">
					No table named <code className="font-mono">{unknownHint.n}</code>
					{unknownHint.near ? (
						<>
							, did you mean{" "}
							<code className="font-mono">{unknownHint.near}</code>?
						</>
					) : null}
				</Badge>
			) : null}
			{shownTables.map((t) => (
				<Chest key={t.name} table={t} />
			))}
			{folded.length ? (
				<button
					type="button"
					className="schema-more"
					onClick={() => setShowOthers(true)}
				>
					<GameIcon name="table" className="size-5" />
					<span className="min-w-0 flex-1 text-left">
						{folded.length} more table{folded.length === 1 ? "" : "s"}
						<span className="block truncate font-mono text-xs font-bold text-muted-foreground">
							{folded.map((t) => t.name).join(", ")}
						</span>
					</span>
					<GameIcon name="chevron-down" className="size-5" />
				</button>
			) : null}
		</div>
	);

	return (
		<Ctx value={ctx}>
			<div className={cn("relative flex h-full min-h-0 flex-col", className)}>
				{catalog.isLoading ? (
					<div className="flex flex-col gap-3 p-3">
						<Skeleton className="h-32 w-full rounded-xl" />
						<Skeleton className="h-24 w-full rounded-xl" />
						<p className="text-sm text-muted-foreground">Starting Postgres…</p>
					</div>
				) : catalog.error ? (
					<p className="p-4 text-sm text-destructive-soft-foreground">
						Could not read the schema: {(catalog.error as Error).message}
					</p>
				) : catalog.data ? (
					showTabs ? (
						<Tabs
							value={view}
							onValueChange={(v) => setView(v as "diagram" | "chests")}
							className="h-full min-h-0 gap-0"
						>
							<div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
								<div className="min-w-0 leading-tight">
									<div className="truncate text-sm font-extrabold">
										{dataset?.name ?? datasetId}
									</div>
									<div className="text-xs font-bold text-muted-foreground tabular">
										{catalog.data.tables.length} tables
									</div>
								</div>
								<TabsList>
									<TabsTrigger value="chests">Tables</TabsTrigger>
									<TabsTrigger value="diagram">Diagram</TabsTrigger>
								</TabsList>
							</div>
							<TabsContent value="chests" className="min-h-0">
								{chests}
							</TabsContent>
							<TabsContent value="diagram" className="min-h-0">
								<DiagramView catalog={catalog.data} datasetId={datasetId} />
							</TabsContent>
						</Tabs>
					) : (
						chests
					)
				) : null}
				<AnimatePresence>
					{peek ? (
						<PeekPanel
							key={peek}
							datasetId={datasetId}
							table={peek}
							onClose={() => setPeek(null)}
						/>
					) : null}
				</AnimatePresence>
			</div>
		</Ctx>
	);
}
