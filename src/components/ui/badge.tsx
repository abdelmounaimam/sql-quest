import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

const badgeVariants = cva(
	"inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 py-0.5 text-xs font-extrabold whitespace-nowrap transition-[color,background-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3.5",
	{
		variants: {
			variant: {
				default: "bg-muted text-muted-foreground",
				secondary: "bg-secondary text-secondary-foreground",
				success: "bg-success-soft text-success-soft-foreground",
				danger: "bg-destructive-soft text-destructive-soft-foreground",
				destructive: "bg-destructive-soft text-destructive-soft-foreground",
				info: "bg-info-soft text-info-soft-foreground",
				warning: "bg-warning-soft text-warning-soft-foreground",
				special: "bg-special-soft text-special-soft-foreground",
				xp: "bg-xp text-info-foreground",
				gem: "bg-gem text-[var(--gem-foreground)]",
				streak: "bg-streak text-warning-foreground",
				star: "bg-star text-reward-foreground",
				lantern: "lit-tag",
				type: "type-badge",
				outline: "border-2 border-border text-foreground",
				ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
				link: "text-info-soft-foreground underline-offset-4 [a&]:hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	asChild = false,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "span";

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
