import React from "react";

export type AlertVariant = "default" | "info" | "success" | "warning" | "destructive";

function variantClasses(variant: AlertVariant) {
  switch (variant) {
    case "info":
      // Use blue soft tokens
      return "bg-[color:var(--status-review-soft-bg)] text-[color:var(--status-review-soft-fg)] border-[color:var(--status-review-soft-border)]";
    case "success":
      return "bg-[color:var(--status-done-soft-bg)] text-[color:var(--status-done-soft-fg)] border-[color:var(--status-done-soft-border)]";
    case "warning":
      return "bg-[color:var(--status-working-soft-bg)] text-[color:var(--status-working-soft-fg)] border-[color:var(--status-working-soft-border)]";
    case "destructive":
      return "bg-[color:var(--status-stuck-soft-bg)] text-[color:var(--status-stuck-soft-fg)] border-[color:var(--status-stuck-soft-border)]";
    default:
      return "bg-surface-raised text-text-primary border-border";
  }
}

export function Alert({
  title,
  description,
  variant = "default",
  icon,
  actions,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: AlertVariant;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-md border p-3 ${variantClasses(variant)}`} role="alert">
      {icon ? <div className="pt-0.5 text-xl">{icon}</div> : null}
      <div className="flex-1">
        {title ? <div className="text-sm font-semibold">{title}</div> : null}
        {description ? <div className="mt-0.5 text-sm opacity-90">{description}</div> : null}
      </div>
      {actions ? <div className="ml-2 flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
