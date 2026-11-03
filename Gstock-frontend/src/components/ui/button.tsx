import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Habillage « Marché » : voir design-system/gstock/MASTER.md, section Composants.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        /** Action principale de l'écran (une seule par écran). */
        action: "pressable bg-action text-action-foreground text-base font-extrabold",
        /** Bouton principal : indigo. */
        default: "pressable bg-primary text-primary-foreground",
        /** Bouton discret : blanc avec contour, sans ombre. */
        outline: "border-2 border-foreground bg-card text-foreground hover:bg-muted active:bg-muted",
        ghost: "text-foreground hover:bg-muted active:bg-muted",
        destructive: "border-2 border-destructive bg-destructive-bg text-destructive hover:bg-destructive hover:text-primary-foreground",
        link: "text-primary underline underline-offset-4",
      },
      size: {
        default: "h-12 px-5 text-[15px]",
        lg: "h-[50px] px-6 text-base",
        sm: "h-10 px-4 text-sm",
        icon: "size-11",
        "icon-sm": "size-10",
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
