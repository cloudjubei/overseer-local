"use strict";

(function () {
  const STATUS_LABELS = {
    "+": "Done",
    "~": "In Progress",
    "-": "Pending",
    "?": "Blocked",
    "=": "Deferred",
  };

  const STATUS_OPTIONS = ["+", "~", "-", "?", "="];

  let editState = { featureId: null, saving: false };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function createEl(tag, attrs = {}, children = []) {
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

  function cssStatus(status) {
    switch (status) {
      case "+": return "done";
      case "~": return "inprogress";
      case "-": return "pending";
      case "?": return "blocked";
      case "=": return "deferred";
      default: return "unknown";
    }
  }

  function statusBadge(status) {
    const label = STATUS_LABELS[status] || String(status || "");
    return createEl("span", { class: `status-badge status-${cssStatus(status)}`, role: "img", "aria-label": label }, label);
  }

  function parseRoute(hash) {
    const m = /^#task\/(\d+)$/.exec(hash || "");
    if (m) return { name: "details", id: parseInt(m[1], 10) };
    return { name: "list" };
  }

  function toLines(arr) {
    if (!Array.isArray(arr)) return "";
    return arr.join("\n");
  }

  function fromLines(str) {
    if (typeof str !== "string") return [];
    return str.split("\n").map(s => s.trim()).filter(s => s.length > 0);
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

    // Editing form
    const statusSelect = createEl("select", { id: `feat-${f.id}-status`, "aria-label": "Status" }, STATUS_OPTIONS.map(s => createEl("option", { value: s, selected: f.status === s }, `${STATUS_LABELS[s]} (${s})`)));
    const titleInput = createEl("input", { id: `feat-${f.id}-title`, type: "text", value: f.title || "", "aria-label": "Title" });
    const descInput = createEl("textarea", { id: `feat-${f.id}-desc", rows: 3, "aria-label": "Description" }, f.description || "");
    const planInput = createEl("textarea", { id: `feat-${f.id}-plan", rows: 3, "aria-label": "Plan" }, f.plan || "");
    const contextInput = createEl("textarea", { id: `feat-${f.id}-context", rows: 3, "aria-label": "Context (one per line)" }, toLines(f.context || []));
    const acceptanceInput = createEl("textarea", { id: `feat-${f.id}-acceptance", rows: 3, "aria-label": "Acceptance (one per line)" }, toLines(f.acceptance || []));
    const dependenciesInput = createEl("textarea", { id: `feat-${f.id}-deps", rows: 2, "aria-label": "Dependencies (optional, one per line)" }, toLines(f.dependencies || []));
    const rejectionInput = createEl("textarea", { id: `feat-${f.id}-rejection", rows: 2, "aria-label": "Rejection (optional)" }, f.rejection || "");

    const saveBtn = createEl("button", { type: "button", class: "btn-save", onclick: async () => {
      if (editState.saving) return;
      editState.saving = true;
      saveBtn.disabled = true; cancelBtn.disabled = true;
      try {
        const payload = {
          status: statusSelect.value,
          title: titleInput.value || "",
          description: descInput.value || "",
          plan: planInput.value || "",
          context: fromLines(contextInput.value || ""),
          acceptance: fromLines(acceptanceInput.value || ""),
          dependencies: fromLines(dependenciesInput.value || ""),
          rejection: (rejectionInput.value || "").trim(),
        };
        const res = await window.tasksIndex.updateFeature(task.id, f.id, payload);
        if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Unknown error');
        editState.featureId = null;
        editState.saving = false;
        // Index rebuild will trigger rerender via subscription; fall back to local rerender
        rerender(task);
      } catch (e) {
        alert(`Failed to save feature: ${e.message || e}`);
        editState.saving = false;
        saveBtn.disabled = false; cancelBtn.disabled = false;
      }
    } }, "Save");

    const cancelBtn = createEl("button", { type: "button", class: "btn-cancel", onclick: () => {
      if (editState.saving) return;
      editState.featureId = null; rerender(task);
    } }, "Cancel");

    const form = createEl("div", { class: "feature-edit-form" }, [
      createEl("div", { class: "form-row" }, [createEl("label", { for: statusSelect.id }, "Status"), statusSelect]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: titleInput.id }, "Title"), titleInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: descInput.id }, "Description"), descInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: planInput.id }, "Plan"), planInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: contextInput.id }, "Context"), contextInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: acceptanceInput.id }, "Acceptance"), acceptanceInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: dependenciesInput.id }, "Dependencies"), dependenciesInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: rejectionInput.id }, "Rejection"), rejectionInput]),
      createEl("div", { class: "form-actions" }, [saveBtn, createEl("span", { class: "spacer" }), cancelBtn])
    ]);

    const row = createEl("div", { class: "feature-row editing", role: "group", "aria-label": `Editing Feature ${f.id}` }, [
      createEl("div", { class: "col col-id" }, f.id || ""),
      createEl("div", { class: "col col-form", style: "flex:1 1 auto;" }, form)
    ]);
    return row;
  }

  function renderFeatures(task) {
    const features = task.features || [];
    if (!Array.isArray(features) || features.length === 0) {
      return createEl("div", { class: "empty" }, "No features defined for this task.");
    }
    const ul = createEl("ul", { class: "features-list", role: "list", "aria-label": "Features" });
    features.forEach((f) => {
      const row = renderFeatureRow(task, f);
      const li = createEl("li", { class: "feature-item", role: "listitem" }, row);
      ul.appendChild(li);
    });
    return ul;
  }

  function renderTaskDetails(root, task) {
    root.innerHTML = "";
    const heading = createEl("h2", { id: "task-details-heading" }, `Task ${task.id}`);

    const backBtn = createEl("button", { type: "button", class: "btn-back", onclick: () => { location.hash = ""; } }, "Back to Tasks");

    const meta = createEl("div", { class: "task-meta" }, [
      createEl("div", { class: "task-title" }, [
        createEl("h3", {}, task.title || ""),
        statusBadge(task.status),
      ]),
      createEl("div", { class: "task-id" }, [createEl("strong", {}, "ID: "), String(task.id)]),
      createEl("div", { class: "task-desc" }, task.description || ""),
    ]);

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
    const root = $("#task-details-view");
    if (!root) return;

    let currentIndex = null;

    function updateVisibility() {
      const route = parseRoute(location.hash);
      const listView = $("#tasks-view");
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
        if (listView) listView.style.display = "";
      }
    }

    try {
      currentIndex = await window.tasksIndex.getSnapshot();
      updateVisibility();
      window.tasksIndex.onUpdate((idx) => {
        currentIndex = idx;
        // If the task being edited disappears or changes, keep edit state best-effort
        updateVisibility();
      });
    } catch (e) {
      // If index fails, still handle routing for Back button
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
