import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import Spinner from "./Spinner"

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ")
}

// Linear-like density, subtle animations, and token-based colors
const buttonVariants = cva(
  // base
  "inline-flex items-center justify-center select-none whitespace-nowrap rounded-md font-medium transition-colors transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: cn(
          // colors
          "bg-brand-600 text-text-inverted",
          "hover:bg-brand-700 active:bg-brand-800",
          // ring
          "focus-visible:ring"
        ),
        secondary: cn(
          "border bg-surface-raised text-text-primary",
          "hover:bg-gray-100/60 dark:hover:bg-gray-800/60",
          "focus-visible:ring"
        ),
        subtle: cn(
          "bg-transparent text-text-primary",
          "hover:bg-gray-100/60 dark:hover:bg-gray-800/60",
          "focus-visible:ring"
        ),
        ghost: cn(
          "bg-transparent text-text-secondary",
          "hover:bg-gray-100/60 dark:hover:bg-gray-800/60",
          "focus-visible:ring"
        ),
        danger: cn(
          "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
          "focus-visible:ring"
        ),
        link: cn(
          "bg-transparent text-brand-600 underline-offset-4 hover:underline",
          "focus-visible:ring-0 focus-visible:outline-none"
        ),
        outline: cn(
          "border text-text-primary bg-transparent hover:bg-gray-100/60 dark:hover:bg-gray-800/60",
          "focus-visible:ring"
        ),
      },
      size: {
        sm: "h-8 px-3 text-sm gap-2",
        md: "h-9 px-3.5 text-sm gap-2",
        lg: "h-10 px-4 text-base gap-2.5",
        icon: "h-9 w-9 p-0",
      },
      tone: {
        // optional density/tone tweaks if needed later
        normal: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      tone: "normal",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          // subtle press transform for non-link buttons
          variant !== "link" ? "active:translate-y-[0.5px]" : "",
          loading ? "relative" : "",
          className
        )}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner size={16} />
          </span>
        ) : null}
        <span className={loading ? "opacity-0" : ""}>{children}</span>
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
