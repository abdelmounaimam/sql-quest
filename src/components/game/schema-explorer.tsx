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
import {
	Braces,
	Eye,
	KeyRound,
	LayoutGrid,
	Link2,
	Network,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, use, useMemo, useState } from "react";
import type {
	Catalog,
	CatalogColumn,
	CatalogTable,
	ColumnCategory,
} from "#/engine/checker/pglite-provider";
import { useCatalog, usePeek } from "#/game/sql-queries";
import { datasetById } from "#/lib/content";
import { cn } from "#/lib/utils";
import { ResultGrid } from "./result-grid";

const CATEGORY_COLOR: Record<ColumnCategory, string> = {
	int: "var(--type-number)",
	numeric: "var(--type-number)",
	text: "var(--type-text)",
	bool: "var(--type-bool)",
	date: "var(--type-time)",
	timestamp: "var(--type-time)",
	time: "var(--type-time)",
	interval: "var(--type-time)",
	json: "var(--type-json)",
	vector: "var(--type-vector)",
	array: "var(--type-other)",
	enum: "var(--type-bool)",
	range: "var(--type-time)",
	uuid: "var(--type-other)",
	other: "var(--type-other)",
};

export function TypeBadge({ col }: { col: CatalogColumn }) {
	const color = CATEGORY_COLOR[col.category];
	return (
		<span
			className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold"
			style={{
				color,
				background: `color-mix(in oklab, ${color} 16%, transparent)`,
				border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
			}}
			title={
				col.enumLabels
					? `enum: ${col.enumLabels.join(", ")}`
					: col.vectorDim
						? `${col.vectorDim}-dimensional vector`
						: col.dataType
			}
		>
			{col.dataType}
		</span>
	);
}

function ColumnRow({ col, note }: { col: CatalogColumn; note?: string }) {
	return (
		<div className="flex items-center gap-1.5 py-[3px]" title={note}>
			<span className="grid w-4 place-items-center">
				{col.isPrimaryKey ? (
					<KeyRound className="size-3.5 text-reward" aria-label="primary key" />
				) : col.references ? (
					<Link2 className="size-3.5 text-info" aria-label="foreign key" />
				) : null}
			</span>
			<span
				className={cn(
					"min-w-0 flex-1 truncate font-mono text-xs",
					col.isPrimaryKey ? "font-bold text-foreground" : "text-foreground/90",
				)}
			>
				{col.name}
				{col.nullable ? null : <span className="text-destructive">*</span>}
			</span>
			<TypeBadge col={col} />
		</div>
	);
}

// ------------------------------------------------------------- React Flow

interface ExplorerCtx {
	hovered: string | null;
	setHovered: (t: string | null) => void;
	related: Set<string>;
	active: Set<string>;
	onPeek: (t: string) => void;
	accent: string;
}
const Ctx = createContext<ExplorerCtx | null>(null);

type TableNodeData = { table: CatalogTable };

function TableNode({ data }: NodeProps<Node<TableNodeData>>) {
	const ctx = use(Ctx);
	const t = data.table;
	const dim =
		ctx?.hovered && ctx.hovered !== t.name && !ctx.related.has(t.name);
	const live = ctx?.active.has(t.name);
	return (
		<section
			aria-label={`Table ${t.name}`}
			onMouseEnter={() => ctx?.setHovered(t.name)}
			onMouseLeave={() => ctx?.setHovered(null)}
			className={cn(
				"w-60 rounded-xl border-2 bg-card shadow-xl transition-[opacity,border-color] duration-200",
				dim ? "opacity-35" : "opacity-100",
				live ? "glow-live border-info" : "border-border",
			)}
		>
			<button
				type="button"
				onClick={() => ctx?.onPeek(t.name)}
				className="flex w-full items-center justify-between gap-2 rounded-t-[10px] px-3 py-2 text-left"
				style={{
					background: `linear-gradient(90deg, color-mix(in oklab, ${ctx?.accent ?? "var(--reward)"} 30%, var(--secondary)), var(--secondary))`,
				}}
				title="Peek at rows"
			>
				<span className="truncate font-display text-sm text-foreground">
					{t.name}
				</span>
				<span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
					{t.kind !== "table" ? t.kind : null}
					{t.rowCount} rows <Eye className="size-3" />
				</span>
			</button>
			<div className="relative px-2.5 py-1.5">
				{t.columns.map((c) => (
					<div key={c.name} className="relative">
						<ColumnRow col={c} />
						<Handle
							type="target"
							position={Position.Left}
							id={`${c.name}-t`}
							className="!size-1.5 !border-0 !bg-info/70"
							style={{ top: "50%", left: -10 }}
							isConnectable={false}
						/>
						<Handle
							type="source"
							position={Position.Right}
							id={`${c.name}-s`}
							className="!size-1.5 !border-0 !bg-info/70"
							style={{ top: "50%", right: -10 }}
							isConnectable={false}
						/>
					</div>
				))}
			</div>
		</section>
	);
}

const nodeTypes = { table: TableNode };

function layout(catalog: Catalog): Node<TableNodeData>[] {
	// Layered layout: referenced (parent) tables on the left.
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
		cols.set(l, row + t.columns.length * 27 + 90);
		return {
			id: t.name,
			type: "table",
			position: { x: l * 320, y: row },
			data: { table: t },
		};
	});
}

function edgesOf(catalog: Catalog, hovered: string | null): Edge[] {
	const out: Edge[] = [];
	for (const t of catalog.tables)
		for (const c of t.columns)
			if (c.references) {
				const hot =
					hovered && (hovered === t.name || hovered === c.references.table);
				out.push({
					id: `${t.name}.${c.name}`,
					source: c.references.table,
					sourceHandle: `${c.references.column}-s`,
					target: t.name,
					targetHandle: `${c.name}-t`,
					animated: true,
					style: {
						stroke: hot ? "var(--reward)" : undefined,
						strokeWidth: hot ? 2.5 : 1.5,
						opacity: hovered && !hot ? 0.2 : 1,
					},
				});
			}
	return out;
}

function Diagram({ catalog }: { catalog: Catalog }) {
	const ctx = use(Ctx);
	const nodes = useMemo(() => layout(catalog), [catalog]);
	const edges = useMemo(
		() => edgesOf(catalog, ctx?.hovered ?? null),
		[catalog, ctx?.hovered],
	);
	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={nodeTypes}
			fitView
			fitViewOptions={{ padding: 0.15 }}
			minZoom={0.3}
			maxZoom={1.6}
			nodesConnectable={false}
			proOptions={{ hideAttribution: true }}
			colorMode={
				typeof document !== "undefined" &&
				document.documentElement.classList.contains("dark")
					? "dark"
					: "light"
			}
		>
			<Background gap={22} size={1} color="var(--border)" />
			<Controls showInteractive={false} position="bottom-right" />
		</ReactFlow>
	);
}

// ------------------------------------------------------------- cards

function TableCard({
	table,
	notes,
	columnNotes,
}: {
	table: CatalogTable;
	notes?: string;
	columnNotes?: Record<string, string>;
}) {
	const ctx = use(Ctx);
	const live = ctx?.active.has(table.name);
	return (
		<div
			className={cn(
				"w-[82vw] max-w-72 shrink-0 snap-center rounded-2xl border-2 bg-card sm:w-64",
				live ? "glow-live border-info" : "border-border",
			)}
		>
			<button
				type="button"
				onClick={() => ctx?.onPeek(table.name)}
				className="flex w-full items-center justify-between rounded-t-[14px] bg-secondary px-3 py-2.5 text-left"
			>
				<span className="font-display text-sm text-foreground">
					{table.name}
				</span>
				<span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
					{table.rowCount} rows <Eye className="size-3" />
				</span>
			</button>
			{notes ? (
				<p className="px-3 pt-2 text-xs text-muted-foreground">{notes}</p>
			) : null}
			<div className="px-3 py-2">
				{table.columns.map((c) => (
					<div key={c.name}>
						<ColumnRow
							col={c}
							note={columnNotes?.[`${table.name}.${c.name}`]}
						/>
						{c.references ? (
							<div className="ml-5 -mt-0.5 mb-0.5 font-mono text-[10px] text-info">
								→ {c.references.table}.{c.references.column}
							</div>
						) : null}
					</div>
				))}
			</div>
		</div>
	);
}

// ------------------------------------------------------------- peek

function PeekPanel({
	datasetId,
	table,
	catalog,
	onClose,
}: {
	datasetId: string;
	table: string;
	catalog: Catalog;
	onClose: () => void;
}) {
	const peek = usePeek(datasetId, table);
	const meta = catalog.tables.find((t) => t.name === table);
	const dataset = datasetById.get(datasetId);
	const jsonCols = Object.entries(meta?.jsonSamples ?? {});
	const vectorCols = meta?.columns.filter((c) => c.vectorDim) ?? [];
	return (
		<motion.div
			initial={{ y: "100%" }}
			animate={{ y: 0 }}
			exit={{ y: "100%" }}
			transition={{ type: "spring", stiffness: 260, damping: 28 }}
			className="absolute inset-x-0 bottom-0 z-20 max-h-[75%] overflow-auto rounded-t-2xl border-t-2 border-reward bg-muted p-3 shadow-2xl"
			role="dialog"
			aria-label={`Rows of ${table}`}
		>
			<div className="mb-2 flex items-center justify-between gap-2">
				<div>
					<div className="font-display text-base text-foreground">{table}</div>
					{dataset?.tableNotes?.[table] ? (
						<div className="text-xs text-muted-foreground">
							{dataset.tableNotes[table]}
						</div>
					) : null}
				</div>
				<button
					type="button"
					onClick={onClose}
					className="grid size-8 place-items-center rounded-lg hover:bg-secondary"
					aria-label="Close"
				>
					<X className="size-4" />
				</button>
			</div>
			{vectorCols.length ? (
				<div className="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
					{vectorCols.map((c) => (
						<span key={c.name} className="rounded-md bg-secondary px-2 py-1">
							<span className="font-mono text-[var(--type-vector)]">
								{c.name}
							</span>
							: {c.vectorDim} dimensions
						</span>
					))}
				</div>
			) : null}
			{jsonCols.length ? (
				<div className="mb-3 grid gap-2 sm:grid-cols-2">
					{jsonCols.map(([col, samples]) => (
						<div
							key={col}
							className="rounded-lg border border-border bg-card p-2"
						>
							<div className="mb-1 flex items-center gap-1 text-xs font-bold text-special">
								<Braces className="size-3.5" /> {col} sample shape
							</div>
							<pre className="max-h-40 overflow-auto font-mono text-[11px] text-foreground">
								{JSON.stringify(samples[0], null, 2)}
							</pre>
						</div>
					))}
				</div>
			) : null}
			{peek.isLoading ? (
				<div className="p-4 text-sm text-muted-foreground">Fetching rows…</div>
			) : peek.data ? (
				<ResultGrid
					table={peek.data}
					maxHeight="18rem"
					caption="First rows"
					animate={false}
				/>
			) : null}
		</motion.div>
	);
}

// ------------------------------------------------------------- explorer

export function SchemaExplorer({
	datasetId,
	activeTables,
	defaultView,
	className,
}: {
	datasetId: string;
	activeTables?: Set<string>;
	defaultView?: "diagram" | "cards";
	className?: string;
}) {
	const catalog = useCatalog(datasetId);
	const dataset = datasetById.get(datasetId);
	const [hovered, setHovered] = useState<string | null>(null);
	const [peek, setPeek] = useState<string | null>(null);
	const [view, setView] = useState<"diagram" | "cards">(
		defaultView ??
			(typeof window !== "undefined" && window.innerWidth < 768
				? "cards"
				: "diagram"),
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

	const ctx: ExplorerCtx = {
		hovered,
		setHovered,
		related,
		active: activeTables ?? new Set(),
		onPeek: setPeek,
		accent: dataset?.accent ?? "var(--reward)",
	};

	return (
		<Ctx value={ctx}>
			<div
				className={cn(
					"relative flex h-full min-h-0 flex-col overflow-hidden",
					className,
				)}
			>
				<div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
					<div className="flex min-w-0 items-center gap-2">
						<span className="text-lg" aria-hidden="true">
							{dataset?.emoji}
						</span>
						<div className="min-w-0">
							<div className="truncate font-display text-sm text-foreground">
								{dataset?.name ?? datasetId}
							</div>
							<div className="truncate text-[11px] text-muted-foreground">
								{catalog.data
									? `${catalog.data.tables.length} tables${catalog.data.extensions.length ? ` · ${catalog.data.extensions.join(", ")}` : ""}`
									: dataset?.tagline}
							</div>
						</div>
					</div>
					<div
						className="flex rounded-lg bg-muted p-0.5"
						role="tablist"
						aria-label="Schema view"
					>
						{(
							[
								["diagram", Network, "Diagram"],
								["cards", LayoutGrid, "Cards"],
							] as const
						).map(([v, Icon, label]) => (
							<button
								key={v}
								type="button"
								role="tab"
								aria-selected={view === v}
								onClick={() => setView(v)}
								className={cn(
									"flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
									view === v
										? "bg-secondary text-foreground"
										: "text-muted-foreground",
								)}
							>
								<Icon className="size-3.5" />
								<span className="hidden sm:inline">{label}</span>
							</button>
						))}
					</div>
				</div>
				<div className="relative min-h-0 flex-1">
					{catalog.isLoading ? (
						<div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
							<div className="flex flex-col items-center gap-2">
								<div className="size-8 animate-spin rounded-full border-4 border-secondary border-t-reward" />
								Booting Postgres and reading the catalog…
							</div>
						</div>
					) : catalog.error ? (
						<div className="p-4 text-sm text-destructive">
							Could not read the schema: {(catalog.error as Error).message}
						</div>
					) : catalog.data ? (
						view === "diagram" ? (
							<Diagram catalog={catalog.data} />
						) : (
							<div className="no-scrollbar flex h-full snap-x snap-mandatory items-start gap-3 overflow-x-auto p-3">
								{catalog.data.tables.map((t) => (
									<TableCard
										key={t.name}
										table={t}
										notes={dataset?.tableNotes?.[t.name]}
										columnNotes={dataset?.columnNotes}
									/>
								))}
							</div>
						)
					) : null}
					<AnimatePresence>
						{peek && catalog.data ? (
							<PeekPanel
								key={peek}
								datasetId={datasetId}
								table={peek}
								catalog={catalog.data}
								onClose={() => setPeek(null)}
							/>
						) : null}
					</AnimatePresence>
				</div>
			</div>
		</Ctx>
	);
}
