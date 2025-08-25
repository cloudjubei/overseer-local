"use strict";

import { createEl } from '../utils/dom.js';

// String list editor component used for context/acceptance/dependencies editors
// Returns { root: HTMLElement, getValues(): string[] }
export function stringListEditor({ idBase, label, initial = [], placeholder = "", suggestions = [] }) {
  const list = Array.isArray(initial) ? [...initial] : [];

  const datalistId = suggestions.length ? `${idBase}-datalist` : null;
  const root = createEl("div", { class: "string-list" });
  const ul = createEl("ul", { class: "string-list-rows" });

  function rowInput(value = "") {
    const inputAttrs = { type: "text", value, placeholder };
    if (datalistId) inputAttrs["list"] = datalistId;
    return createEl("input", inputAttrs);
  }

  function addRow(value = "") {
    const li = createEl("li", { class: "string-list-row" });
    const input = rowInput(value);
    const removeBtn = createEl("button", { type: "button", class: "btn-remove-row", onclick: () => {
      ul.removeChild(li);
    } }, "Remove");
    li.appendChild(input);
    li.appendChild(removeBtn);
    ul.appendChild(li);
  }

  // Initial rows (at least one empty row for better UX)
  if (list.length === 0) {
    addRow("");
  } else {
    list.forEach((v) => addRow(v));
  }

  const addBtn = createEl("button", { type: "button", class: "btn-add-row", onclick: () => addRow("") }, "Add row");

  const container = createEl("div", { class: "string-list-container" }, [ul, addBtn]);

  if (datalistId) {
    const dl = createEl("datalist", { id: datalistId }, suggestions.map(s => createEl("option", { value: s })));
    root.appendChild(dl);
  }

  function getValues() {
    const values = [];
    const inputs = ul.querySelectorAll('input[type="text"]');
    inputs.forEach((inp) => {
      const v = String(inp.value || "").trim();
      if (v.length > 0) values.push(v);
    });
    return values;
  }

  return { root: createEl("div", {}, [createEl("label", {}, label), container]), getValues };
}
