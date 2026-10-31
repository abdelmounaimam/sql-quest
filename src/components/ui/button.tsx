import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import type * as React from "react"

/**
 * Lantern Atlas buttons (docs/design/design-direction.md §6.2).
 * Game actions are "juicy": Lilita label, ink on candy fill, a solid ledge
 * that sinks on press (filter: drop-shadow, composited). UI actions are flat.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap outline-none select-none transition-[transform,filter,background-color] duration-(--duration-press) ease-out disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "juicy juicy-primary juicy-label",
        game: "juicy juicy-primary juicy-label",
        success: "juicy juicy-success juicy-label",
        danger: "juicy juicy-danger juicy-label",
        destructive: "juicy juicy-danger juicy-label",
        info: "juicy juicy-info juicy-label",
        special: "juicy juicy-special juicy-label",
        gem: "juicy juicy-gem juicy-label",
        world: "juicy juicy-world juicy-label",
        secondary: "juicy juicy-paper font-extrabold",
        outline:
          "rounded-md border-2 border-border bg-transparent font-extrabold hover:bg-accent active:scale-[0.97]",
        ghost: "rounded-md font-extrabold hover:bg-accent active:scale-[0.97]",
        "ghost-glow":
          "rounded-md font-extrabold text-(--syn-keyword) hover:bg-accent active:scale-[0.97] [&_svg]:drop-shadow-[0_0_6px_var(--lantern-glow)]",
        link: "font-extrabold text-info-soft-foreground underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 rounded-md px-3.5 text-sm [--j-ledge:var(--ledge-sm)] [&_svg:not([class*='size-'])]:size-4",
        default: "h-12 px-5 text-[17px]",
        lg: "h-14 px-7 text-xl",
        xl: "h-15 w-full text-[21px]",
        icon: "size-12",
        "icon-sm": "size-9 [--j-ledge:var(--ledge-sm)]",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
