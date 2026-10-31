import {
	createColumnHelper,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import type { DiffRow, ResultTable, TableDiff } from "#/engine/checker/types";
import { cn } from "#/lib/utils";
import { Badge } from "../ui/badge";
import { GameIcon } from "./icons";

const features = tableFeatures({});
type GridRow = {
	cells: unknown[];
	status?: DiffRow["status"];
	changed?: number[];
};
const helper = createColumnHelper<typeof features, GridRow>();

const NUMERIC_TYPES = new Set([
	"int2",
	"int4",
	"int8",
	"numeric",
	"float4",
	"float8",
	"money",
	"oid",
]);

function isNumeric(value: unknown, typeName?: string) {
	return (
		typeof value === "number" ||
		(typeName ? NUMERIC_TYPES.has(typeName) : false)
	);
}

/** One cell of the loot ledger. NULL is the Void: a dashed pill, never empty. */
export function Cell({
	value,
	typeName,
}: {
	value: unknown;
	typeName?: string;
}) {
	if (value === null || value === undefined)
		return <span className="null-pill">NULL</span>;
	if (typeof value === "boolean")
		return (
			<span
				className={cn(
					"font-bold",
					value
						? "text-success-soft-foreground"
						: "text-destructive-soft-foreground",
				)}
			>
				{value ? "true" : "false"}
			</span>
		);
	if (typeof value === "object") {
		const text = JSON.stringify(value);
		return (
			<span
				className="block max-w-[22rem] truncate text-(--type-jsonb)"
				title={JSON.stringify(value, null, 2)}
			>
				{text}
			</span>
		);
	}
	const s = String(value);
	if (typeName === "vector" || typeName === "halfvec")
		return <span className="text-(--type-vector-fg)">{s}</span>;
	if (typeName === "json" || typeName === "jsonb")
		return (
			<span
				className="block max-w-[22rem] truncate text-(--type-jsonb)"
				title={s}
			>
				{s}
			</span>
		);
	return (
		<span className="whitespace-pre">
			{s.length > 160 ? `${s.slice(0, 160)}…` : s}
		</span>
	);
}

const STATUS_GLYPH: Record<DiffRow["status"], string> = {
	match: "",
	missing: "−",
	extra: "+",
	moved: "↕",
	changed: "≠",
};
const STATUS_LABEL: Record<DiffRow["status"], string> = {
	match: "matches",
	missing: "expected row missing",
	extra: "extra row",
	moved: "wrong position",
	changed: "values differ",
};

/** The loot ledger (TanStack Table). Optional per-row diff statuses. */
export function ResultGrid({
	table,
	rows,
	columnNames,
	typeNames,
	className,
	maxHeight = "22rem",
	caption = "Loot ledger",
	meta,
	animate = true,
}: {
	table?: ResultTable;
	rows?: DiffRow[];
	columnNames?: string[];
	typeNames?: (string | undefined)[];
	className?: string;
	maxHeight?: string;
	caption?: string;
	meta?: React.ReactNode;
	animate?: boolean;
}) {
	const names = columnNames ?? table?.columns.map((c) => c.name) ?? [];
	const types = typeNames ?? table?.columns.map((c) => c.typeName) ?? [];
	const showStatus = !!rows;

	const data = useMemo<GridRow[]>(
		() =>
			rows
				? rows.map((r) => ({
						cells: r.cells,
						status: r.status,
						changed: r.changedCells,
					}))
				: (table?.rows ?? []).map((cells) => ({ cells })),
		[rows, table],
	);

	const namesKey = names.join("\u0000");
	const typesKey = types.map((t) => t ?? "").join("\u0000");
	const columns = useMemo(() => {
		const colNames = namesKey ? namesKey.split("\u0000") : [];
		const colTypes = typesKey.split("\u0000").map((t) => t || undefined);
		return helper.columns(
			colNames.map((name, i) =>
				helper.accessor((r) => r.cells[i], {
					id: `c${i}`,
					header: () => (
						<>
							{name}
							{colTypes[i] ? <span className="ty">{colTypes[i]}</span> : null}
						</>
					),
					cell: (ctx) => <Cell value={ctx.getValue()} typeName={colTypes[i]} />,
					meta: { typeName: colTypes[i] },
				}),
			),
		);
	}, [namesKey, typesKey]);

	const t = useTable({ features, columns, data });
	const modelRows = t.getRowModel().rows;

	// TanStack Virtual: only the visible rows are in the DOM (up to 10k rows).
	const scrollRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: modelRows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 35,
		overscan: 12,
	});
	const items = virtualizer.getVirtualItems();
	const padTop = items.length ? items[0].start : 0;
	const padBottom = items.length
		? virtualizer.getTotalSize() - items[items.length - 1].end
		: 0;

	const head = (
		<div className="ledger-head">
			<GameIcon name="table" className="text-muted-foreground" />
			<span className="t">{caption}</span>
			<span className="text-sm text-muted-foreground tabular">
				{data.length} row{data.length === 1 ? "" : "s"}
				{table?.truncated
					? ` (first ${data.length.toLocaleString("en-US")})`
					: ""}
			</span>
			{meta ? <span className="ml-auto">{meta}</span> : null}
		</div>
	);

	if (names.length === 0)
		return (
			<div className={cn("panel ledger", className)}>
				{head}
				<p className="p-4 text-sm text-muted-foreground">
					{table && table.rowCount > 0
						? `${table.rowCount} rows came back with no columns at all: name the columns you want after SELECT.`
						: table?.command
							? `${table.command} done${typeof table.affectedRows === "number" ? `, ${table.affectedRows} row(s) affected` : ""}. This spell returned no loot.`
							: "No result set."}
				</p>
			</div>
		);

	return (
		<div className={cn("panel ledger", className)}>
			{head}
			<div
				ref={scrollRef}
				className="overflow-auto overscroll-contain"
				style={{ maxHeight }}
			>
				<table className="loot">
					<thead>
						{t.getHeaderGroups().map((g) => (
							<tr key={g.id}>
								{showStatus ? (
									<th aria-label="Diff" />
								) : (
									<th aria-label="Row" />
								)}
								{g.headers.map((h, i) => (
									<th
										key={h.id}
										className={cn(
											isNumeric(undefined, types[i]) && "text-right",
										)}
									>
										<t.FlexRender header={h} />
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{padTop > 0 ? (
							<tr>
								<td style={{ height: padTop, padding: 0, border: 0 }} />
							</tr>
						) : null}
						{items.map((vi) => {
							const ri = vi.index;
							const row = modelRows[ri];
							const status = row.original.status;
							return (
								<tr
									key={row.id}
									data-index={ri}
									ref={virtualizer.measureElement}
									className={cn(
										animate && ri < 12 && "rise",
										status && `diff-${status}`,
									)}
									style={
										animate && ri < 12
											? { animationDelay: `${ri * 30}ms` }
											: undefined
									}
								>
									<td
										className="rn"
										title={status ? STATUS_LABEL[status] : undefined}
									>
										{showStatus ? (
											<span className="font-bold">
												{status ? STATUS_GLYPH[status] : ""}
											</span>
										) : (
											ri + 1
										)}
									</td>
									{row.getAllCells().map((cell, ci) => (
										<td
											key={cell.id}
											className={cn(
												isNumeric(cell.getValue(), types[ci]) && "num",
												row.original.changed?.includes(ci) && "cell-changed",
											)}
										>
											<t.FlexRender cell={cell} />
										</td>
									))}
								</tr>
							);
						})}
						{padBottom > 0 ? (
							<tr>
								<td style={{ height: padBottom, padding: 0, border: 0 }} />
							</tr>
						) : null}
					</tbody>
				</table>
				{data.length === 0 ? (
					<p className="p-4 text-center text-sm text-muted-foreground">
						0 rows: the chest was empty.
					</p>
				) : null}
			</div>
		</div>
	);
}

/** Expected vs got, side by side on wide screens, stacked on phones. */
export function DiffView({
	diff,
	expected,
	got,
	labels = ["Expected loot", "Your loot"],
}: {
	diff: TableDiff;
	expected?: ResultTable;
	got?: ResultTable;
	labels?: [string, string];
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap gap-2">
				{diff.missingCount ? (
					<Badge variant="danger">− {diff.missingCount} missing</Badge>
				) : null}
				{diff.extraCount ? (
					<Badge variant="warning">+ {diff.extraCount} extra</Badge>
				) : null}
			</div>
			<div className="grid gap-3 xl:grid-cols-2">
				<ResultGrid
					caption={labels[0]}
					rows={diff.expected}
					columnNames={expected?.columns.map((c) => c.name) ?? diff.columns}
					typeNames={expected?.columns.map((c) => c.typeName)}
					maxHeight="16rem"
				/>
				<ResultGrid
					caption={labels[1]}
					rows={diff.got}
					columnNames={got?.columns.map((c) => c.name) ?? diff.columns}
					typeNames={got?.columns.map((c) => c.typeName)}
					maxHeight="16rem"
				/>
			</div>
		</div>
	);
}
