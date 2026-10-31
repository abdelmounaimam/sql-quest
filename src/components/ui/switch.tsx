import { cn } from "cn";
import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

function Switch({
	className,
	size = "default",
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
	size?: "sm" | "default";
}) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-size={size}
			className={cn(
				"peer group/switch inline-flex shrink-0 items-center rounded-full border-2 border-transparent p-0.5 outline-none transition-[background-color] duration-(--duration-fast) ease-out disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-7 data-[size=default]:w-12 data-[size=sm]:h-5 data-[size=sm]:w-9 data-[state=checked]:bg-success data-[state=unchecked]:bg-muted data-[state=unchecked]:shadow-[inset_0_2px_0_var(--ink-shadow)] data-[state=unchecked]:border-border",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					"pointer-events-none block rounded-full bg-white shadow-[0_2px_0_var(--ledge)] ring-0 transition-transform duration-(--duration-fast) ease-out group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-3.5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 group-data-[size=sm]/switch:data-[state=checked]:translate-x-4",
				)}
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
