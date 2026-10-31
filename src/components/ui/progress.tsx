import { cn } from "cn";
import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";

function Progress({
	className,
	value,
	indicatorClassName,
	...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
	/** e.g. "bg-success" (lesson), "bg-(--w)" (world). Default bg-xp. */
	indicatorClassName?: string;
}) {
	return (
		<ProgressPrimitive.Root
			data-slot="progress"
			className={cn(
				"relative h-3 w-full overflow-hidden rounded-full bg-muted shadow-[inset_0_2px_0_var(--ink-shadow)]",
				className,
			)}
			{...props}
		>
			<ProgressPrimitive.Indicator
				data-slot="progress-indicator"
				className={cn(
					"gloss h-full w-full flex-1 rounded-full bg-xp transition-transform duration-600 ease-out",
					indicatorClassName,
				)}
				style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
			/>
		</ProgressPrimitive.Root>
	);
}

export { Progress };
