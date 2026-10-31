import {
	Background,
	Controls,
	type Edge,
	Handle,
	type Node,
	type NodeProps,
	Position,
	ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Eye, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, use, useMemo, useState } from "react";
import type {
	Catalog,
	CatalogColumn,
	CatalogTable,
} from "#/engine/checker/pglite-provider";
import { useCatalog, usePeek } from "#/game/sql-queries";
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

export function TypeBadge({ col }: { col: CatalogColumn }) {
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
			{col.dataType}
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
	return (
		<li
			className={cn(hot && "hot")}
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
							<TypeBadge col={col} />
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
				<TypeBadge col={col} />
			)}
		</li>
	);
}

export function Chest({
	table,
	compact,
}: {
	table: CatalogTable;
	compact?: boolean;
}) {
	const ctx = use(Ctx);
	const lit = !!ctx?.active.has(table.name);
	const dim =
		ctx?.hovered && ctx.hovered !== table.name && !ctx.related.has(table.name);
	return (
		<Card
			variant="chest"
			data-lit={lit}
			className={cn(
				"transition-opacity duration-(--duration-fast)",
				dim && "opacity-40",
				compact ? "w-60" : "w-full",
			)}
			onMouseEnter={() => ctx?.setHovered(table.name)}
			onMouseLeave={() => ctx?.setHovered(null)}
		>
			<button
				type="button"
				className="lid w-full text-left"
				onClick={() => ctx?.onPeek(table.name)}
				title="Peek at the loot"
			>
				<span className="ico">
					<GameIcon name="chest" />
				</span>
				<span className="nm truncate">{table.name}</span>
				<span className="rows flex items-center gap-1 tabular">
					{table.kind !== "table" ? `${table.kind} · ` : ""}
					{table.rowCount} rows <Eye className="size-3.5" />
				</span>
			</button>
			{!compact && ctx?.notes?.[table.name] ? (
				<p className="px-3 pt-2.5 text-xs text-muted-foreground">
					{ctx.notes[table.name]}
				</p>
			) : null}
			<ul className="chest-cols">
				{table.columns.map((c) => (
					<ChestColumn key={c.name} table={table} col={c} />
				))}
			</ul>
			{lit ? (
				<div className="px-3 pb-3">
					<span className="lit-tag">+ In your spell</span>
				</div>
			) : null}
		</Card>
	);
}

// ───────────────────────────── diagram (React Flow)

type TableNodeData = { table: CatalogTable };

function TableNode({ data }: NodeProps<Node<TableNodeData>>) {
	const t = data.table;
	return (
		<div className="relative">
			{t.columns.map((c, i) => (
				<span key={c.name}>
					<Handle
						type="target"
						position={Position.Left}
						id={`${c.name}-t`}
						className="!size-1.5 !border-0 !bg-transparent"
						style={{ top: 62 + i * 31 }}
						isConnectable={false}
					/>
					<Handle
						type="source"
						position={Position.Right}
						id={`${c.name}-s`}
						className="!size-1.5 !border-0 !bg-transparent"
						style={{ top: 62 + i * 31 }}
						isConnectable={false}
					/>
				</span>
			))}
			<Chest table={t} compact />
		</div>
	);
}

const nodeTypes = { table: TableNode };

function layout(catalog: Catalog): Node<TableNodeData>[] {
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
		const l = level.get(t.name) ?? 0;
		const row = cols.get(l) ?? 0;
		cols.set(l, row + t.columns.length * 31 + 110);
		return {
			id: t.name,
			type: "table",
			position: { x: l * 300, y: row },
			data: { table: t },
		};
	});
}

function Diagram({ catalog }: { catalog: Catalog }) {
	const ctx = use(Ctx);
	const nodes = useMemo(() => layout(catalog), [catalog]);
	const edges = useMemo<Edge[]>(() => {
		const out: Edge[] = [];
		for (const t of catalog.tables)
			for (const c of t.columns)
				if (c.references) {
					const both =
						!!ctx?.active.has(t.name) && !!ctx.active.has(c.references.table);
					out.push({
						id: `${t.name}.${c.name}`,
						source: c.references.table,
						sourceHandle: `${c.references.column}-s`,
						target: t.name,
						targetHandle: `${c.name}-t`,
						type: "smoothstep",
						className: both ? "is-referenced" : undefined,
					});
				}
		return out;
	}, [catalog, ctx?.active]);
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
			minZoom={0.25}
			maxZoom={1.5}
			nodesConnectable={false}
			proOptions={{ hideAttribution: true }}
			colorMode={dark ? "dark" : "light"}
		>
			<Background gap={22} size={1.2} color="var(--border)" />
			<Controls showInteractive={false} position="bottom-right" />
		</ReactFlow>
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
			aria-label={`Loot in ${table}`}
		>
			<div className="mb-2 flex items-center justify-between gap-2">
				<div className="font-mono text-base font-bold">{table}</div>
				<button
					type="button"
					onClick={onClose}
					className="grid size-9 place-items-center rounded-md hover:bg-accent"
					aria-label="Close"
				>
					<X className="size-5" />
				</button>
			</div>
			{peek.isLoading ? (
				<Skeleton className="h-40 w-full" />
			) : peek.data ? (
				<ResultGrid
					table={peek.data}
					maxHeight="16rem"
					caption="First loot"
					animate={false}
				/>
			) : null}
		</motion.div>
	);
}

// ───────────────────────────── explorer

/** Words of the query: tables and columns the spell touches. */
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
}: {
	datasetId: string;
	activeTables?: Set<string>;
	sql?: string;
	defaultView?: "diagram" | "chests";
	className?: string;
	showTabs?: boolean;
}) {
	const catalog = useCatalog(datasetId);
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
	const active = activeTables ?? new Set<string>();
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
		notes: dataset?.tableNotes,
		columnNotes: dataset?.columnNotes,
	};

	const tables = catalog.data
		? [...catalog.data.tables].sort(
				(a, b) => Number(active.has(b.name)) - Number(active.has(a.name)),
			)
		: [];

	const chests = (
		<div className="flex h-full flex-col gap-4 overflow-y-auto overscroll-contain p-3 pb-6">
			{unknownHint ? (
				<Badge variant="info" className="self-start">
					No chest named <code className="font-mono">{unknownHint.n}</code>
					{unknownHint.near ? (
						<>
							, did you mean{" "}
							<code className="font-mono">{unknownHint.near}</code>?
						</>
					) : null}
				</Badge>
			) : null}
			{tables.map((t) => (
				<Chest key={t.name} table={t} />
			))}
		</div>
	);

	return (
		<Ctx value={ctx}>
			<div className={cn("relative flex h-full min-h-0 flex-col", className)}>
				{catalog.isLoading ? (
					<div className="flex flex-col gap-3 p-3">
						<Skeleton className="h-32 w-full rounded-xl" />
						<Skeleton className="h-24 w-full rounded-xl" />
						<p className="text-sm text-muted-foreground">
							Lighting the lantern: Postgres is waking up…
						</p>
					</div>
				) : catalog.error ? (
					<p className="p-4 text-sm text-destructive-soft-foreground">
						Could not read the chests: {(catalog.error as Error).message}
					</p>
				) : catalog.data ? (
					showTabs ? (
						<Tabs
							value={view}
							onValueChange={(v) => setView(v as "diagram" | "chests")}
							className="h-full min-h-0 gap-0"
						>
							<div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
								<div className="min-w-0 text-sm font-extrabold">
									<span className="truncate">{dataset?.name ?? datasetId}</span>
									<span className="ml-2 font-bold text-muted-foreground tabular">
										{catalog.data.tables.length} chests
									</span>
								</div>
								<TabsList>
									<TabsTrigger value="chests">Chests</TabsTrigger>
									<TabsTrigger value="diagram">Diagram</TabsTrigger>
								</TabsList>
							</div>
							<TabsContent value="chests" className="min-h-0">
								{chests}
							</TabsContent>
							<TabsContent value="diagram" className="min-h-0">
								<Diagram catalog={catalog.data} />
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
