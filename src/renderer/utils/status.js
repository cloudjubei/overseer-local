"use strict";

import { createEl } from './dom.js';

export const STATUS_LABELS = {
  "+": "Done",
  "~": "In Progress",
  "-": "Pending",
  "?": "Blocked",
  "=": "Deferred",
};

export const STATUS_OPTIONS = ["+", "~", "-", "?", "="];

export function cssStatus(status) {
  switch (status) {
    case "+": return "done";
    case "~": return "inprogress";
    case "-": return "pending";
    case "?": return "blocked";
    case "=": return "deferred";
    default: return "unknown";
  }
}

export function statusBadge(status) {
  const label = STATUS_LABELS[status] || String(status || "");
  return createEl("span", { class: `status-badge status-${cssStatus(status)}`, role: "img", "aria-label": label }, label);
}
