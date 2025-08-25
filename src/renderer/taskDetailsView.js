"use strict";

import { createEl } from './utils/dom.js';
import { STATUS_LABELS, statusBadge } from './utils/status.js';
import { parseRoute } from './utils/routing.js';
import { stringListEditor } from './components/stringListEditor.js';

(function () {
  const STATUS_OPTIONS = ["+", "~", "-", "?", "="];

  // Keep the current index in module scope for dependency resolution/suggestions
  let currentIndex = null;
  let editState = { featureId: null, saving: false };
  let taskEditState = { editing: false, saving: false };

  function featureSuggestionsTitles() {
    const titles = [];
    if (!currentIndex || !currentIndex.tasksById) return titles;
    for (const task of Object.values(currentIndex.tasksById)) {
      const feats = Array.isArray(task.features) ? task.features : [];
      feats.forEach((f) => {
        if (f && typeof f.title === "string" && f.title.trim()) titles.push(f.title);
      });
    }
    // Deduplicate titles (case-sensitive keep first occurrence)
    const seen = new Set();
    const out = [];
    for (const t of titles) {
      if (!seen.has(t)) { seen.add(t); out.push(t); }
    }
    return out;
  }

  function resolveDependencies(deps, task) {
    if (!Array.isArray(deps) || deps.length === 0) return [];
    const out = [];
    const taskFeatures = Array.isArray(task.features) ? task.features : [];

    // Build maps for quick lookups
    const byIdCurrent = new Map(taskFeatures.map((f) => [f.id, f]));
    const byTitleCurrentCI = new Map(taskFeatures.map((f) => [String(f.title || "").toLowerCase(), f]));

    // Global lookup by title (case-insensitive) to unique feature
    const byTitleGlobalCI = new Map(); // titleLower -> { id, taskId } or null if ambiguous
    if (currentIndex && currentIndex.tasksById) {
      for (const t of Object.values(currentIndex.tasksById)) {
        const feats = Array.isArray(t.features) ? t.features : [];
        for (const f of feats) {
          const key = String(f.title || "").toLowerCase();
          if (!key) continue;
          if (!byTitleGlobalCI.has(key)) byTitleGlobalCI.set(key, { id: f.id, taskId: t.id });
          else {
            const prev = byTitleGlobalCI.get(key);
            // If conflict with different id or task, mark ambiguous
            if (!prev || prev.id !== f.id || prev.taskId !== t.id) byTitleGlobalCI.set(key, null);
          }
        }
      }
    }

    for (const dRaw of deps) {
      const d = String(dRaw || "").trim();
      if (!d) continue;
      // If exactly matches a feature id in current task, keep
      if (byIdCurrent.has(d)) { out.push(d); continue; }
      // If matches a title in current task (case-insensitive), map to that id
      const tMatch = byTitleCurrentCI.get(d.toLowerCase());
      if (tMatch) { out.push(tMatch.id); continue; }
      // Else try unique global title match
      const g = byTitleGlobalCI.get(d.toLowerCase());
      if (g && g.id) { out.push(g.id); continue; }
      // Fallback: preserve original string (could be cross-task id or freeform)
      out.push(d);
    }

    return out;
  }

  function renderFeatureRow(task, f) {
    const isEditing = editState.featureId === f.id;
    if (!isEditing) {
      const row = createEl("div", { class: "feature-row", role: "group", "aria-label": `Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status] || f.status}` }, [
        createEl("div", { class: "col col-id" }, f.id || ""),
        createEl("div", { class: "col col-title" }, f.title || ""),
        createEl("div", { class: "col col-status" }, statusBadge(f.status)),
        createEl("div", { class: "col col-actions" }, createEl("button", { type: "button", class: "btn-edit", onclick: () => { editState.featureId = f.id; rerender(task); } }, "Edit")),
      ]);
      return row;
    }

    // Editing form controls
    const statusSelect = createEl(
      "select",
      { id: `feat-${f.id}-status`, "aria-label": "Status" },
      STATUS_OPTIONS.map(s => createEl("option", { value: s, selected: f.status === s }, `${s}`))
    );
    const titleInput = createEl("input", { id: `feat-${f.id}-title`, type: "text", value: f.title || "", "aria-label": "Title" });
    const descInput = createEl("textarea", { id: `feat-${f.id}-desc`, rows: 3, "aria-label": "Description" }, f.description || "");
    const planInput = createEl("textarea", { id: `feat-${f.id}-plan`, rows: 3, "aria-label": "Plan" }, f.plan || "");

    const contextEditor = stringListEditor({ idBase: `feat-${f.id}-context`, label: "Context (one per row)", initial: f.context || [], placeholder: "Context item" });
    const acceptanceEditor = stringListEditor({ idBase: `feat-${f.id}-acceptance`, label: "Acceptance (one per row)", initial: f.acceptance || [], placeholder: "Acceptance criterion" });
    const depSuggestions = featureSuggestionsTitles();
    const dependenciesEditor = stringListEditor({ idBase: `feat-${f.id}-deps`, label: "Dependencies (feature id or title; one per row)", initial: f.dependencies || [], placeholder: "Feature id or title", suggestions: depSuggestions });

    const rejectionInput = createEl("textarea", { id: `feat-${f.id}-rejection`, rows: 2, "aria-label": "Rejection (optional)" }, f.rejection || "");

    const saveBtn = createEl("button", { type: "button", class: "btn-save" }, "Save");
    const cancelBtn = createEl("button", { type: "button", class: "btn-cancel", onclick: () => {
      if (editState.saving) return;
      editState.featureId = null; rerender(task);
    } }, "Cancel");

    saveBtn.addEventListener("click", async () => {
      if (editState.saving) return;
      editState.saving = true;
      saveBtn.disabled = true; cancelBtn.disabled = true;
      try {
        const payload = {
          status: statusSelect.value,
          title: titleInput.value || "",
          description: descInput.value || "",
          plan: planInput.value || "",
          context: contextEditor.getValues(),
          acceptance: acceptanceEditor.getValues(),
          // Resolve dependency titles to ids when possible
          dependencies: resolveDependencies(dependenciesEditor.getValues(), task),
          rejection: (rejectionInput.value || "").trim(),
        };
        const res = await window.tasksIndex.updateFeature(task.id, f.id, payload);
        if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Unknown error');
        editState.featureId = null;
        editState.saving = false;
        rerender(task);
      } catch (e) {
        alert(`Failed to save feature: ${e.message || e}`);
        editState.saving = false;
        saveBtn.disabled = false; cancelBtn.disabled = false;
      }
    });

    const form = createEl("div", { class: "feature-edit-form" }, [
      createEl("div", { class: "form-row" }, [createEl("label", { for: statusSelect.id }, "Status"), statusSelect]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: titleInput.id }, "Title"), titleInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: descInput.id }, "Description"), descInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: planInput.id }, "Plan"), planInput]),
      createEl("div", { class: "form-row" }, [contextEditor.root]),
      createEl("div", { class: "form-row" }, [acceptanceEditor.root]),
      createEl("div", { class: "form-row" }, [dependenciesEditor.root]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: rejectionInput.id }, "Rejection"), rejectionInput]),
      createEl("div", { class: "form-actions" }, [saveBtn, createEl("span", { class: "spacer" }), cancelBtn])
    ]);

    const row = createEl("div", { class: "feature-row editing", role: "group", "aria-label": `Editing Feature ${f.id}` }, [
      createEl("div", { class: "col col-id" }, f.id || ""),
      createEl("div", { class: "col col-form", style: "flex:1 1 auto;" }, form)
    ]);
    return row;
  }

  function renderCreateFeatureControls(task) {
    return createEl("div", { class: "feature-create-controls" },
      createEl("button", { type: "button", class: "btn-add-feature", onclick: async () => { try { await window.tasksIndex.openFeatureCreate(task.id); } catch (_) {} } }, "Add Feature")
    );
  }

  function renderFeatures(task) {
    const features = task.features || [];
    const container = createEl("div", { class: "features-container" });

    // Create button opens popup
    container.appendChild(renderCreateFeatureControls(task));

    if (!Array.isArray(features) || features.length === 0) {
      container.appendChild(createEl("div", { class: "empty" }, "No features defined for this task."));
      return container;
    }
    const ul = createEl("ul", { class: "features-list", role: "list", "aria-label": "Features" });
    features.forEach((f) => {
      const row = renderFeatureRow(task, f);
      const li = createEl("li", { class: "feature-item", role: "listitem" }, row);
      ul.appendChild(li);
    });
    container.appendChild(ul);
    return container;
  }

  function renderTaskMeta(task) {
    if (!taskEditState.editing) {
      const titleRow = createEl("div", { class: "task-title" }, [
        createEl("h3", {}, task.title || ""),
        statusBadge(task.status),
        createEl("span", { class: "spacer" }),
        createEl("button", { type: "button", class: "btn-edit-task", onclick: () => { taskEditState.editing = true; rerender(task); } }, "Edit Task")
      ]);
      return createEl("div", { class: "task-meta" }, [
        titleRow,
        createEl("div", { class: "task-id" }, [createEl("strong", {}, "ID: "), String(task.id)]),
        createEl("div", { class: "task-desc" }, task.description || ""),
      ]);
    }

    const titleInput = createEl("input", { id: `task-${task.id}-title`, type: "text", value: task.title || "", "aria-label": "Task Title" });
    const descInput = createEl("textarea", { id: `task-${task.id}-desc`, rows: 4, "aria-label": "Task Description" }, task.description || "");

    const saveBtn = createEl("button", { type: "button", class: "btn-save" }, "Save");
    const cancelBtn = createEl("button", { type: "button", class: "btn-cancel", onclick: () => {
      if (taskEditState.saving) return;
      taskEditState.editing = false; rerender(task);
    } }, "Cancel");

    saveBtn.addEventListener("click", async () => {
      if (taskEditState.saving) return;
      taskEditState.saving = true; saveBtn.disabled = true; cancelBtn.disabled = true;
      try {
        const payload = {
          title: titleInput.value || "",
          description: descInput.value || "",
        };
        const res = await window.tasksIndex.updateTask(task.id, payload);
        if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Unknown error');
        taskEditState.saving = false;
        taskEditState.editing = false;
        rerender(task);
      } catch (e) {
        alert(`Failed to update task: ${e.message || e}`);
        taskEditState.saving = false; saveBtn.disabled = false; cancelBtn.disabled = false;
      }
    });

    return createEl("div", { class: "task-meta editing" }, [
      createEl("div", { class: "form-row" }, [createEl("label", { for: titleInput.id }, "Title"), titleInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: descInput.id }, "Description"), descInput]),
      createEl("div", { class: "form-actions" }, [saveBtn, createEl("span", { class: "spacer" }), cancelBtn])
    ]);
  }

  function renderTaskDetails(root, task) {
    root.innerHTML = "";
    const heading = createEl("h2", { id: "task-details-heading" }, `Task ${task.id}`);

    const backBtn = createEl("button", { type: "button", class: "btn-back", onclick: () => { taskEditState.editing = false; location.hash = ""; } }, "Back to Tasks");

    const meta = renderTaskMeta(task);

    const featuresHeading = createEl("h3", {}, "Features");
    const featuresList = renderFeatures(task);

    root.appendChild(heading);
    root.appendChild(createEl("div", { class: "task-details-controls" }, backBtn));
    root.appendChild(meta);
    root.appendChild(featuresHeading);
    root.appendChild(featuresList);
  }

  function rerender(task) {
    const root = document.getElementById("task-details-view");
    if (!root || !task) return;
    renderTaskDetails(root, task);
  }

  async function init() {
    const root = document.getElementById("task-details-view");
    if (!root) return;

    function updateVisibility() {
      const route = parseRoute(location.hash);
      const listView = document.getElementById("tasks-view");
      if (route.name === "details") {
        root.style.display = "";
        if (listView) listView.style.display = "none";
        const task = currentIndex && currentIndex.tasksById ? currentIndex.tasksById[String(route.id)] : null;
        if (!task) {
          root.innerHTML = "";
          root.appendChild(createEl("div", { class: "empty" }, [
            createEl("p", {}, `Task ${route.id} not found.`),
            createEl("button", { type: "button", onclick: () => { location.hash = ""; } }, "Back to Tasks")
          ]));
        } else {
          renderTaskDetails(root, task);
        }
      } else {
        root.style.display = "none";
        taskEditState.editing = false;
        if (listView) listView.style.display = "";
      }
    }

    try {
      currentIndex = await window.tasksIndex.getSnapshot();
      updateVisibility();
      window.tasksIndex.onUpdate((idx) => {
        currentIndex = idx;
        updateVisibility();
      });
    } catch (e) {
      updateVisibility();
    }

    window.addEventListener("hashchange", updateVisibility);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
