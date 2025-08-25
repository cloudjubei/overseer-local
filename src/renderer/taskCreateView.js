"use strict";

import { createEl } from './utils/dom.js';
import { STATUS_LABELS, STATUS_OPTIONS } from './utils/status.js';
import { computeNextTaskId } from './utils/tasks.js';

(function () {
  async function buildForm() {
    const container = document.querySelector("#task-create-view");
    container.innerHTML = "";

    let index = null;
    try { index = await window.tasksIndex.getSnapshot(); } catch (_) { index = null; }

    const defaultId = computeNextTaskId(index);

    const idInput = createEl("input", { id: "newtask-id", type: "number", value: String(defaultId), min: 1, step: 1, "aria-label": "Task ID" });
    const statusSelect = createEl(
      "select",
      { id: "newtask-status", "aria-label": "Status" },
      STATUS_OPTIONS.map(s => createEl("option", { value: s, selected: s === "-" }, `${STATUS_LABELS[s]} (${s})`))
    );
    const titleInput = createEl("input", { id: "newtask-title", type: "text", placeholder: "Title", "aria-label": "Task Title" });
    const descInput = createEl("textarea", { id: "newtask-desc", rows: 4, placeholder: "Description", "aria-label": "Task Description" });

    const createBtn = createEl("button", { type: "button", class: "btn-save" }, "Create");
    const cancelBtn = createEl("button", { type: "button", class: "btn-cancel", onclick: () => window.close() }, "Cancel");

    createBtn.addEventListener("click", async () => {
      const idVal = parseInt(idInput.value, 10);
      if (!Number.isInteger(idVal) || idVal <= 0) {
        alert("Please provide a valid positive integer ID");
        idInput.focus();
        return;
      }
      const payload = {
        id: idVal,
        status: statusSelect.value,
        title: titleInput.value || "",
        description: descInput.value || "",
      };
      createBtn.disabled = true; cancelBtn.disabled = true;
      try {
        const res = await window.tasksIndex.addTask(payload);
        if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Unknown error');
        window.close();
      } catch (e) {
        alert(`Failed to create task: ${e.message || e}`);
        createBtn.disabled = false; cancelBtn.disabled = false;
      }
    });

    const form = createEl("div", { class: "task-create-form" }, [
      createEl("div", { class: "form-row" }, [createEl("label", { for: idInput.id }, "ID"), idInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: statusSelect.id }, "Status"), statusSelect]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: titleInput.id }, "Title"), titleInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: descInput.id }, "Description"), descInput]),
      createEl("div", { class: "form-actions" }, [createBtn, createEl("span", { class: "spacer" }), cancelBtn])
    ]);

    container.appendChild(form);

    // keep the default id up to date if index updates while open
    try {
      window.tasksIndex.onUpdate((idx) => {
        const nextId = computeNextTaskId(idx);
        // only update if the user hasn't changed the value manually
        if (String(idInput.value) === String(defaultId)) idInput.value = String(nextId);
      });
    } catch (_) {}
  }

  async function init() {
    const container = document.querySelector("#task-create-view");
    if (!container) return;
    container.innerHTML = "Loading...";
    try {
      await buildForm();
    } catch (_) {
      container.innerHTML = "";
      container.appendChild(createEl("div", { class: "empty" }, "Failed to initialize create form."));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
