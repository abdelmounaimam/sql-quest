import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";

const alertVariants = cva(
	"relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border-2 px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*5)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-5 [&>svg]:translate-y-0.5 [&>svg]:text-current",
	{
		variants: {
			variant: {
				default: "border-border bg-card text-card-foreground",
				info: "border-[color-mix(in_oklab,var(--info)_40%,transparent)] bg-info-soft text-info-soft-foreground",
				warning:
					"border-[color-mix(in_oklab,var(--warning)_40%,transparent)] bg-warning-soft text-warning-soft-foreground",
				success:
					"border-[color-mix(in_oklab,var(--success)_40%,transparent)] bg-success-soft text-success-soft-foreground",
				destructive:
					"border-[color-mix(in_oklab,var(--destructive)_40%,transparent)] bg-destructive-soft text-destructive-soft-foreground",
				lore: "border-[color-mix(in_oklab,var(--w,var(--lantern))_40%,transparent)] bg-(--w-tint,var(--accent)) text-(--w-tint-fg,var(--foreground))",
				lantern: "border-[color-mix(in_oklab,var(--lantern)_45%,transparent)] bg-accent text-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn(
				"col-start-2 min-h-4 font-extrabold",
				className,
			)}
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				"col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
				className,
			)}
			{...props}
		/>
	);
}

export { Alert, AlertTitle, AlertDescription };
