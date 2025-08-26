import React from "react";

export type AlertVariant = "default" | "info" | "success" | "warning" | "destructive";

function variantClasses(variant: AlertVariant) {
  switch (variant) {
    case "info":
      return "bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/50 dark:text-sky-100 dark:border-sky-900";
    case "success":
      return "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-100 dark:border-emerald-900";
    case "warning":
      return "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-900";
    case "destructive":
      return "bg-red-50 text-red-900 border-red-200 dark:bg-red-950/50 dark:text-red-100 dark:border-red-900";
    default:
      return "bg-neutral-50 text-neutral-900 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800";
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
