import type { StatementOutcome } from "#/engine/checker/types";
import { cn } from "#/lib/utils";
import { Badge } from "../ui/badge";

/**
 * Per-statement log of a learner script (psql style): one line per
 * statement with its outcome. Inside a transaction block an error does not
 * stop the script; the following statements show "aborted" (25P02) until a
 * ROLLBACK or ROLLBACK TO SAVEPOINT recovers.
 */
export function StatementLog({
	statements,
	className,
}: {
	statements: StatementOutcome[];
	className?: string;
}) {
	if (statements.length < 2) return null;
	const failed = statements.filter((s) => !s.ok).length;
	return (
		<div className={cn("panel overflow-hidden", className)}>
			<div className="flex items-center gap-2 border-b-2 border-border px-3.5 py-2.5">
				<span className="font-extrabold">Spell log</span>
				<span className="text-sm text-muted-foreground tabular">
					{statements.length} statements
				</span>
				{failed ? (
					<Badge variant="danger" className="ml-auto">
						{failed} failed
					</Badge>
				) : (
					<Badge variant="success" className="ml-auto">
						all ran
					</Badge>
				)}
			</div>
			<ol className="max-h-64 overflow-y-auto overscroll-contain">
				{statements.map((s) => (
					<li
						key={s.index}
						className={cn(
							"flex items-start gap-2.5 border-t border-border px-3.5 py-2 first:border-t-0",
							!s.ok &&
								!s.aborted &&
								"bg-destructive-soft text-destructive-soft-foreground",
							s.aborted && "text-muted-foreground",
						)}
					>
						<span className="w-5 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground tabular">
							{s.index + 1}
						</span>
						<span
							className={cn(
								"mt-1.5 size-2 shrink-0 rounded-full",
								s.ok
									? "bg-success"
									: s.aborted
										? "bg-muted-foreground"
										: "bg-destructive",
							)}
							aria-hidden="true"
						/>
						<span className="min-w-0 flex-1">
							<code className="block truncate font-mono text-xs" title={s.sql}>
								{s.sql}
							</code>
							{s.error ? (
								<span className="mt-0.5 block text-xs">
									{s.aborted ? "skipped: transaction aborted" : s.error.message}
									{s.error.line ? ` · line ${s.error.line}` : ""}
								</span>
							) : null}
						</span>
						<span className="shrink-0">
							{s.ok ? (
								<Badge variant="success" className="font-mono">
									{s.command ?? "OK"}
									{typeof s.rowCount === "number" ? ` ${s.rowCount}` : ""}
								</Badge>
							) : s.error?.code ? (
								<span className="rune">{s.error.code}</span>
							) : null}
						</span>
					</li>
				))}
			</ol>
		</div>
	);
}
