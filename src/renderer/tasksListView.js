"use strict";

(function () {
  const STATUS_LABELS = {
    "+": "Done",
    "~": "In Progress",
    "-": "Pending",
    "?": "Blocked",
    "=": "Deferred",
  };

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

  function renderList(listEl, tasks) {
    listEl.innerHTML = "";
    if (!tasks || tasks.length === 0) {
      listEl.appendChild(createEl("div", { class: "empty" }, "No tasks found."));
      return;
    }

    const ul = createEl("ul", { class: "tasks-list", role: "list", "aria-label": "Tasks" });

    tasks.forEach((t, idx) => {
      const { done, total } = countFeatures(t);
      const row = createEl(
        "div",
        {
          class: "task-row",
          tabindex: 0,
          role: "group",
          dataset: { index: idx },
          onkeydown: (e) => onRowKeyDown(e, ul),
          "aria-label": `Task ${t.id}: ${t.title}. Status ${STATUS_LABELS[t.status] || t.status}. Features ${done} of ${total} done.`,
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

  function onRowKeyDown(e, ul) {
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

    const controls = createEl("div", { class: "tasks-controls", role: "search" }, [
      createEl("div", { class: "control" }, [searchLabel, searchInput]),
      createEl("div", { class: "control" }, [statusLabel, statusSelect]),
      createEl("div", { class: "control control-buttons" }, [clearBtn])
    ]);

    const countEl = createEl("div", { id: "tasks-count", class: "tasks-count", "aria-live": "polite" }, "");

    const resultsEl = createEl("div", { id: "tasks-results", class: "tasks-results", tabindex: -1 });

    rootEl.appendChild(heading);
    rootEl.appendChild(controls);
    rootEl.appendChild(countEl);
    rootEl.appendChild(resultsEl);

    return { searchInput, statusSelect, countEl, resultsEl };
  }

  function updateCount(countEl, filtered, total) {
    countEl.textContent = `Showing ${filtered} of ${total} tasks`;
  }

  async function init() {
    const root = document.getElementById("tasks-view");
    if (!root) return;

    const { searchInput, statusSelect, countEl, resultsEl } = buildControls(root);

    let allTasks = [];
    let state = { query: "", status: "any" };

    function applyRender(index) {
      allTasks = toTasksArray(index || {});
      const filtered = filterTasks(allTasks, state);
      updateCount(countEl, filtered.length, allTasks.length);
      renderList(resultsEl, filtered);
    }

    function onFiltersChange() {
      state = { query: searchInput.value || "", status: statusSelect.value || "any" };
      applyRender(currentIndex);
    }

    let currentIndex = null;

    // Hook up events
    searchInput.addEventListener("input", () => root.dispatchEvent(new CustomEvent("filters:change")));
    statusSelect.addEventListener("change", () => root.dispatchEvent(new CustomEvent("filters:change")));
    root.addEventListener("filters:change", onFiltersChange);

    try {
      currentIndex = await window.tasksIndex.getSnapshot();
      applyRender(currentIndex);
      // Subscribe to updates
      window.tasksIndex.onUpdate((idx) => {
        currentIndex = idx;
        applyRender(currentIndex);
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
