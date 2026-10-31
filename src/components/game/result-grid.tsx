import {
	createColumnHelper,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { motion } from "motion/react";
import { useMemo } from "react";
import type { DiffRow, ResultTable, TableDiff } from "#/engine/checker/types";
import { cn } from "#/lib/utils";

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

export function Cell({
	value,
	typeName,
}: {
	value: unknown;
	typeName?: string;
}) {
	if (value === null || value === undefined)
		return (
			<span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-muted-foreground">
				NULL
			</span>
		);
	if (typeof value === "boolean")
		return (
			<span
				className={cn(
					"font-mono text-xs font-bold",
					value ? "text-success" : "text-destructive",
				)}
			>
				{value ? "true" : "false"}
			</span>
		);
	if (typeof value === "object") {
		const text = JSON.stringify(value);
		return (
			<span
				className="block max-w-[22rem] truncate font-mono text-xs text-special"
				title={JSON.stringify(value, null, 2)}
			>
				{text}
			</span>
		);
	}
	const s = String(value);
	if (typeName === "vector" || typeName === "halfvec")
		return <span className="font-mono text-xs text-special">{s}</span>;
	if (typeName === "json" || typeName === "jsonb")
		return (
			<span
				className="block max-w-[22rem] truncate font-mono text-xs text-special"
				title={s}
			>
				{s}
			</span>
		);
	return (
		<span
			className={cn(
				"font-mono text-xs whitespace-pre",
				(typeof value === "number" ||
					(typeName && NUMERIC_TYPES.has(typeName))) &&
					"text-reward",
			)}
		>
			{s.length > 160 ? `${s.slice(0, 160)}…` : s}
		</span>
	);
}

const STATUS_STYLE: Record<DiffRow["status"], string> = {
	match: "",
	missing:
		"bg-[color-mix(in_oklab,var(--destructive)_16%,transparent)] shadow-[inset_3px_0_0_var(--destructive)]",
	extra:
		"bg-[color-mix(in_oklab,var(--reward)_16%,transparent)] shadow-[inset_3px_0_0_var(--reward)]",
	moved:
		"bg-[color-mix(in_oklab,var(--info)_12%,transparent)] shadow-[inset_3px_0_0_var(--info)]",
	changed:
		"bg-[color-mix(in_oklab,var(--destructive)_10%,transparent)] shadow-[inset_3px_0_0_var(--destructive)]",
};

const STATUS_LABEL: Record<DiffRow["status"], string> = {
	match: "",
	missing: "missing",
	extra: "extra",
	moved: "moved",
	changed: "wrong",
};

/** Result set grid (TanStack Table). Optional per-row diff statuses. */
export function ResultGrid({
	table,
	rows,
	columnNames,
	typeNames,
	className,
	maxHeight = "22rem",
	caption,
	animate = true,
}: {
	table?: ResultTable;
	/** Diff rows override table rows. */
	rows?: DiffRow[];
	columnNames?: string[];
	typeNames?: (string | undefined)[];
	className?: string;
	maxHeight?: string;
	caption?: string;
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
		return helper.columns([
			helper.display({
				id: "__n",
				header: "#",
				cell: (ctx) => (
					<span className="font-mono text-[10px] text-muted-foreground">
						{ctx.row.index + 1}
					</span>
				),
			}),
			...colNames.map((name, i) =>
				helper.accessor((r) => r.cells[i], {
					id: `c${i}`,
					header: () => (
						<span className="flex flex-col">
							<span>{name}</span>
							{colTypes[i] ? (
								<span className="font-mono text-[9px] font-normal tracking-normal text-muted-foreground normal-case">
									{colTypes[i]}
								</span>
							) : null}
						</span>
					),
					cell: (ctx) => <Cell value={ctx.getValue()} typeName={colTypes[i]} />,
				}),
			),
		]);
	}, [namesKey, typesKey]);

	const t = useTable({ features, columns, data });

	if (names.length === 0)
		return (
			<div
				className={cn(
					"rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground",
					className,
				)}
			>
				{table?.command
					? `${table.command} done${typeof table.affectedRows === "number" ? `, ${table.affectedRows} row(s) affected` : ""}. No result set.`
					: "No result set."}
			</div>
		);

	return (
		<div
			className={cn(
				"overflow-hidden rounded-xl border border-border",
				className,
			)}
		>
			{caption ? (
				<div className="flex items-center justify-between border-b border-border bg-muted px-3 py-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
					<span>{caption}</span>
					<span className="font-mono normal-case">
						{data.length} row{data.length === 1 ? "" : "s"}
						{table?.truncated ? " (truncated)" : ""}
					</span>
				</div>
			) : null}
			<div className="overflow-auto" style={{ maxHeight }}>
				<table className="w-full border-collapse text-left text-sm">
					<thead className="sticky top-0 z-10 bg-card">
						{t.getHeaderGroups().map((g) => (
							<tr key={g.id}>
								{g.headers.map((h) => (
									<th
										key={h.id}
										className="border-b border-border px-3 py-2 text-[11px] font-bold tracking-wide whitespace-nowrap text-foreground uppercase"
									>
										<t.FlexRender header={h} />
									</th>
								))}
								{showStatus ? (
									<th className="border-b border-border px-2" />
								) : null}
							</tr>
						))}
					</thead>
					<tbody>
						{t.getRowModel().rows.map((row, ri) => {
							const status = row.original.status;
							return (
								<motion.tr
									key={row.id}
									initial={animate ? { opacity: 0, x: -6 } : false}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: Math.min(ri, 20) * 0.02 }}
									className={cn(
										"border-b border-border/60 last:border-0 even:bg-[color-mix(in_oklab,var(--muted)_60%,transparent)]",
										status && STATUS_STYLE[status],
									)}
								>
									{row.getAllCells().map((cell, ci) => (
										<td
											key={cell.id}
											className={cn(
												"px-3 py-1.5 align-top",
												ci > 0 &&
													row.original.changed?.includes(ci - 1) &&
													"bg-[color-mix(in_oklab,var(--destructive)_22%,transparent)]",
											)}
										>
											<t.FlexRender cell={cell} />
										</td>
									))}
									{showStatus ? (
										<td className="px-2 py-1.5 text-right">
											{status && status !== "match" ? (
												<span
													className={cn(
														"rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
														status === "missing" &&
															"bg-destructive text-destructive-foreground",
														status === "extra" &&
															"bg-reward text-reward-foreground",
														status === "moved" &&
															"bg-info text-info-foreground",
														status === "changed" &&
															"bg-destructive text-destructive-foreground",
													)}
												>
													{STATUS_LABEL[status]}
												</span>
											) : null}
										</td>
									) : null}
								</motion.tr>
							);
						})}
					</tbody>
				</table>
				{data.length === 0 ? (
					<div className="p-4 text-center text-sm text-muted-foreground">
						0 rows
					</div>
				) : null}
			</div>
		</div>
	);
}

/** Expected vs got, side by side on desktop, stacked on phones. */
export function DiffView({
	diff,
	expected,
	got,
	labels = ["Expected", "Your result"],
}: {
	diff: TableDiff;
	expected?: ResultTable;
	got?: ResultTable;
	labels?: [string, string];
}) {
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap gap-2 text-xs">
				{diff.missingCount ? (
					<span className="rounded-full bg-destructive px-2 py-0.5 font-bold text-destructive-foreground">
						{diff.missingCount} missing
					</span>
				) : null}
				{diff.extraCount ? (
					<span className="rounded-full bg-reward px-2 py-0.5 font-bold text-reward-foreground">
						{diff.extraCount} extra
					</span>
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
