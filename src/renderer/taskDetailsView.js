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

  function renderFeatures(features) {
    if (!Array.isArray(features) || features.length === 0) {
      return createEl("div", { class: "empty" }, "No features defined for this task.");
    }
    const ul = createEl("ul", { class: "features-list", role: "list", "aria-label": "Features" });
    features.forEach((f) => {
      const row = createEl("div", { class: "feature-row", role: "group", "aria-label": `Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status] || f.status}` }, [
        createEl("div", { class: "col col-id" }, f.id || ""),
        createEl("div", { class: "col col-title" }, f.title || ""),
        createEl("div", { class: "col col-status" }, statusBadge(f.status)),
      ]);
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
    const featuresList = renderFeatures(task.features || []);

    root.appendChild(heading);
    root.appendChild(createEl("div", { class: "task-details-controls" }, backBtn));
    root.appendChild(meta);
    root.appendChild(featuresHeading);
    root.appendChild(featuresList);
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
