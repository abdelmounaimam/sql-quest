import { cn } from "#/lib/utils";
import { Wick } from "./icons";

/** Wordmark: Wick the lantern flame + Lilita lettering. */
export function Logo({
	className,
	compact,
}: {
	className?: string;
	compact?: boolean;
}) {
	return (
		<span className={cn("inline-flex items-center gap-2", className)}>
			<Wick className="h-10 w-[34px]" />
			{compact ? null : (
				<span className="font-display text-2xl leading-none text-foreground">
					SQL Quest
				</span>
			)}
		</span>
	);
}
