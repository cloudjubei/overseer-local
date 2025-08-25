"use strict";

export function routeName(hash) {
  return /^#task\/\d+$/.test(hash || "") ? "details" : "list";
}

export function parseRoute(hash) {
  const m = /^#task\/(\d+)$/.exec(hash || "");
  if (m) return { name: "details", id: parseInt(m[1], 10) };
  return { name: "list" };
}

export function parseTaskIdFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('taskId');
  if (fromQuery && /^\d+$/.test(fromQuery)) return parseInt(fromQuery, 10);
  const m = /^#?task\/(\d+)$/.exec(window.location.hash || '');
  if (m) return parseInt(m[1], 10);
  return null;
}
