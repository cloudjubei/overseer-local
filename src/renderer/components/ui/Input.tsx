import React from "react";

function cn(...xs: Array<string | false | undefined | null>) { return xs.filter(Boolean).join(" "); }

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
};

const sizeClass = {
  sm: "h-8 text-sm px-2.5",
  md: "h-9 text-sm px-3",
  lg: "h-10 text-base px-3.5",
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", size = "md", invalid = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border bg-surface-raised text-text-primary placeholder:text-text-muted",
          "focus:outline-none focus:ring-2",
          invalid ? "border-red-400 focus:ring-red-400" : "border border-border focus:ring",
          sizeClass[size],
          className
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
