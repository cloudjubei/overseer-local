import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";

function cn(...xs: Array<string | false | undefined | null>) { return xs.filter(Boolean).join(" "); }

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { size?: "sm" | "md" | "lg" }
>(({ className = "", children, size = "md", ...props }, ref) => {
  const sizeCls = size === "sm" ? "h-8 text-sm px-2.5" : size === "lg" ? "h-10 text-base px-3.5" : "h-9 text-sm px-3";
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex items-center justify-between rounded-md border bg-surface-raised text-text-primary",
        "placeholder:text-text-muted focus:outline-none focus:ring-2",
        "border-border focus:ring",
        sizeCls,
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="ml-2 text-text-muted">▾</SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className = "", children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "z-[2000] min-w-[10rem] overflow-hidden rounded-md border bg-surface-raised text-text-primary shadow-md",
        "border-border",
        className
      )}
      position={position}
      sideOffset={6}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1 text-text-muted">▲</SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1 text-text-muted">▼</SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className = "", children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none",
      "data-[highlighted]:bg-gray-100 data-[highlighted]:text-text-primary",
      "dark:data-[highlighted]:bg-gray-800",
      "data-[state=checked]:font-semibold",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="standard-picker__check" aria-hidden>✓</SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;
