"use strict";

// DOM utility helpers used across legacy and modernized renderer code

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "dataset") {
      for (const [dk, dv] of Object.entries(v || {})) el.dataset[dk] = dv;
    } else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "text") {
      el.textContent = v;
    } else if (v !== undefined && v !== null) {
      el.setAttribute(k, String(v));
    }
  }
  if (!Array.isArray(children)) children = [children];
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  }
  return el;
}
