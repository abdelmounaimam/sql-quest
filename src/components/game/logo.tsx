import { cn } from "#/lib/utils";

/** Wordmark: a tiny database "cartridge" + arcade lettering. */
export function Logo({
	className,
	compact,
}: {
	className?: string;
	compact?: boolean;
}) {
	return (
		<span className={cn("inline-flex items-center gap-2", className)}>
			<svg
				viewBox="0 0 32 32"
				className="size-8 shrink-0 drop-shadow-[0_0_10px_var(--reward-glow)]"
				aria-hidden="true"
			>
				<rect x="2" y="2" width="28" height="28" rx="8" fill="var(--reward)" />
				<ellipse
					cx="16"
					cy="10"
					rx="8"
					ry="3.2"
					fill="var(--reward-foreground)"
				/>
				<path
					d="M8 10v10c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V10"
					fill="none"
					stroke="var(--reward-foreground)"
					strokeWidth="2.4"
				/>
				<path
					d="M8 15c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2"
					fill="none"
					stroke="var(--reward-foreground)"
					strokeWidth="2.4"
				/>
			</svg>
			{compact ? null : (
				<span className="font-display text-lg leading-none text-foreground">
					SQL<span className="text-reward">Quest</span>
				</span>
			)}
		</span>
	);
}
