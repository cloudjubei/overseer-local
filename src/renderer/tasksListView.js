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

  function toTasksArray(index) {
    const tasksById = (index && index.tasksById) || {};
    const arr = Object.values(tasksById);
    // Sort by id numeric asc
    arr.sort((a, b) => (a.id || 0) - (b.id || 0));
    return arr;
  }

  function countFeatures(task) {
    const features = Array.isArray(task.features) ? task.features : [];
    const total = features.length;
    const done = features.filter((f) => f.status === "+").length;
    return { done, total };
  }

  function matchesQuery(task, q) {
    if (!q) return true;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const idStr = String(task.id || "");
    return (
      idStr.includes(s) ||
      (task.title && task.title.toLowerCase().includes(s)) ||
      (task.description && task.description.toLowerCase().includes(s))
    );
  }

  function filterTasks(tasks, { query, status }) {
    return tasks.filter((t) => {
      const byStatus = !status || status === "any" ? true : t.status === status;
      return byStatus && matchesQuery(t, query || "");
    });
  }

  function statusBadge(status) {
    const label = STATUS_LABELS[status] || String(status || "");
    return createEl("span", { class: `status-badge status-${cssStatus(status)}`, role: "img", "aria-label": label }, label);
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

  function routeName(hash) {
    return /^#task\/\d+$/.test(hash || "") ? "details" : "list";
  }

  function onRowKeyDown(e, ul, taskId) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      location.hash = `#task/${taskId}`;
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const rows = Array.from(ul.querySelectorAll(".task-row"));
    const current = e.currentTarget;
    const i = rows.indexOf(current);
    if (i === -1) return;
    let nextIndex = i + (e.key === "ArrowDown" ? 1 : -1);
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= rows.length) nextIndex = rows.length - 1;
    rows[nextIndex].focus();
  }

  function computeNextTaskId(index) {
    const tasksById = (index && index.tasksById) || {};
    let max = 0;
    for (const t of Object.values(tasksById)) {
      const id = parseInt((t && t.id) || 0, 10);
      if (Number.isInteger(id) && id > max) max = id;
    }
    return (max + 1) || 1;
  }

  function buildControls(rootEl) {
    const heading = createEl("h2", { id: "tasks-view-heading" }, "Tasks");

    const searchId = "tasks-search-input";
    const statusId = "tasks-status-select";

    const searchLabel = createEl("label", { for: searchId }, "Search");
    const searchInput = createEl("input", {
      id: searchId,
      type: "search",
      placeholder: "Search by id, title, or description",
      "aria-label": "Search tasks",
    });

    const statusLabel = createEl("label", { for: statusId }, "Status");
    const statusSelect = createEl(
      "select",
      { id: statusId, "aria-label": "Filter by status" },
      [
        createEl("option", { value: "any" }, "All statuses"),
        createEl("option", { value: "+" }, "Done (+)"),
        createEl("option", { value: "~" }, "In Progress (~)"),
        createEl("option", { value: "-" }, "Pending (-)"),
        createEl("option", { value: "?" }, "Blocked (?)"),
        createEl("option", { value: "=" }, "Deferred (=)"),
      ]
    );

    const clearBtn = createEl("button", { type: "button", class: "btn-clear", onclick: () => {
      searchInput.value = "";
      statusSelect.value = "any";
      rootEl.dispatchEvent(new CustomEvent("filters:change"));
      searchInput.focus();
    }}, "Clear");

    const addTaskContainer = createEl("div", { class: "add-task-container" });

    const controls = createEl("div", { class: "tasks-controls", role: "search" }, [
      createEl("div", { class: "control" }, [searchLabel, searchInput]),
      createEl("div", { class: "control" }, [statusLabel, statusSelect]),
      createEl("div", { class: "control control-buttons" }, [clearBtn]),
      createEl("div", { class: "control control-add-task" }, [addTaskContainer])
    ]);

    const countEl = createEl("div", { id: "tasks-count", class: "tasks-count", "aria-live": "polite" }, "");

    const resultsEl = createEl("div", { id: "tasks-results", class: "tasks-results", tabindex: -1 });

    rootEl.appendChild(heading);
    rootEl.appendChild(controls);
    rootEl.appendChild(countEl);
    rootEl.appendChild(resultsEl);

    return { searchInput, statusSelect, countEl, resultsEl, addTaskContainer };
  }

  function updateCount(countEl, filtered, total) {
    countEl.textContent = `Showing ${filtered} of ${total} tasks`;
  }

  async function init() {
    const root = document.getElementById("tasks-view");
    if (!root) return;

    const { searchInput, statusSelect, countEl, resultsEl, addTaskContainer } = buildControls(root);

    let allTasks = [];
    let state = { query: "", status: "any" };
    let currentIndex = null;
    let createOpen = false;
    let createSaving = false;

    function renderCreateUI() {
      addTaskContainer.innerHTML = "";
      if (!createOpen) {
        const btn = createEl("button", { type: "button", class: "btn-add-task", onclick: () => { createOpen = true; renderCreateUI(); } }, "Add Task");
        addTaskContainer.appendChild(btn);
        return;
      }

      const defaultId = computeNextTaskId(currentIndex);
      const idInput = createEl("input", { id: "newtask-id", type: "number", value: String(defaultId), min: 1, step: 1, "aria-label": "Task ID" });
      const statusSelectNew = createEl(
        "select",
        { id: "newtask-status", "aria-label": "Status" },
        STATUS_OPTIONS.map(s => createEl("option", { value: s, selected: s === "-" }, `${STATUS_LABELS[s]} (${s})`))
      );
      const titleInput = createEl("input", { id: "newtask-title", type: "text", placeholder: "Title", "aria-label": "Task Title" });
      const descInput = createEl("textarea", { id: "newtask-desc", rows: 3, placeholder: "Description", "aria-label": "Task Description" });

      const saveBtn = createEl("button", { type: "button", class: "btn-save" }, "Create Task");
      const cancelBtn = createEl("button", { type: "button", class: "btn-cancel", onclick: () => { if (createSaving) return; createOpen = false; renderCreateUI(); } }, "Cancel");

      saveBtn.addEventListener("click", async () => {
        if (createSaving) return;
        const idVal = parseInt(idInput.value, 10);
        if (!Number.isInteger(idVal) || idVal <= 0) {
          alert("Please provide a valid positive integer ID");
          idInput.focus();
          return;
        }
        const payload = {
          id: idVal,
          status: statusSelectNew.value,
          title: titleInput.value || "",
          description: descInput.value || "",
        };
        try {
          createSaving = true; saveBtn.disabled = true; cancelBtn.disabled = true;
          const res = await window.tasksIndex.addTask(payload);
          if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Unknown error');
          createSaving = false;
          createOpen = false;
          renderCreateUI();
          // Navigate to new task
          if (res.id) location.hash = `#task/${res.id}`;
        } catch (e) {
          alert(`Failed to create task: ${e.message || e}`);
          createSaving = false; saveBtn.disabled = false; cancelBtn.disabled = false;
        }
      });

      const form = createEl("div", { class: "task-create-form" }, [
        createEl("div", { class: "form-row" }, [createEl("label", { for: idInput.id }, "ID"), idInput]),
        createEl("div", { class: "form-row" }, [createEl("label", { for: statusSelectNew.id }, "Status"), statusSelectNew]),
        createEl("div", { class: "form-row" }, [createEl("label", { for: titleInput.id }, "Title"), titleInput]),
        createEl("div", { class: "form-row" }, [createEl("label", { for: descInput.id }, "Description"), descInput]),
        createEl("div", { class: "form-actions" }, [saveBtn, createEl("span", { class: "spacer" }), cancelBtn])
      ]);

      addTaskContainer.appendChild(createEl("div", { class: "task-create" }, [
        createEl("h4", {}, "Add New Task"),
        form
      ]));
    }

    function renderList(listEl, tasks) {
      listEl.innerHTML = "";
      if (!tasks || tasks.length === 0) {
        listEl.appendChild(createEl("div", { class: "empty" }, "No tasks found."));
        return;
      }

      const ul = createEl("ul", { class: "tasks-list", role: "list", "aria-label": "Tasks" });

      tasks.forEach((t, idx) => {
        const { done, total } = countFeatures(t);
        const goToDetails = () => { location.hash = `#task/${t.id}`; };
        const row = createEl(
          "div",
          {
            class: "task-row",
            tabindex: 0,
            role: "button",
            dataset: { index: idx },
            onclick: goToDetails,
            onkeydown: (e) => onRowKeyDown(e, ul, t.id),
            "aria-label": `Task ${t.id}: ${t.title}. Status ${STATUS_LABELS[t.status] || t.status}. Features ${done} of ${total} done. Press Enter to view details.`,
          },
          [
            createEl("div", { class: "col col-id" }, String(t.id)),
            createEl("div", { class: "col col-title" }, t.title || ""),
            createEl("div", { class: "col col-status" }, statusBadge(t.status)),
            createEl("div", { class: "col col-features" }, `${done}/${total}`),
          ]
        );
        const li = createEl("li", { class: "task-item", role: "listitem" }, row);
        ul.appendChild(li);
      });

      listEl.appendChild(ul);
    }

    function applyRender(index) {
      currentIndex = index || {};
      allTasks = toTasksArray(currentIndex);
      const filtered = filterTasks(allTasks, state);
      updateCount(countEl, filtered.length, allTasks.length);
      renderList(resultsEl, filtered);
      renderCreateUI();
    }

    function onFiltersChange() {
      state = { query: searchInput.value || "", status: statusSelect.value || "any" };
      applyRender(currentIndex);
    }

    function updateVisibility() {
      const name = routeName(location.hash);
      root.style.display = name === "list" ? "" : "none";
    }

    // Hook up events
    searchInput.addEventListener("input", () => root.dispatchEvent(new CustomEvent("filters:change")));
    statusSelect.addEventListener("change", () => root.dispatchEvent(new CustomEvent("filters:change")));
    root.addEventListener("filters:change", onFiltersChange);
    window.addEventListener("hashchange", updateVisibility);

    try {
      currentIndex = await window.tasksIndex.getSnapshot();
      applyRender(currentIndex);
      updateVisibility();
      // Subscribe to updates
      window.tasksIndex.onUpdate((idx) => {
        applyRender(idx);
      });
    } catch (e) {
      resultsEl.innerHTML = "";
      resultsEl.appendChild(createEl("div", { class: "empty" }, "Failed to load tasks index."));
      updateCount(countEl, 0, 0);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
