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

  let currentIndex = null;
  let task = null;

  function $(sel, root = document) { return root.querySelector(sel); }

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

  function parseRoute(hash) {
    const m = /^#task\/(\d+)$/.exec(hash || "");
    if (m) return { name: "create", id: parseInt(m[1], 10) };
    return { name: "invalid" };
  }

  function featureSuggestionsTitles() {
    const titles = [];
    if (!currentIndex || !currentIndex.tasksById) return titles;
    for (const task of Object.values(currentIndex.tasksById)) {
      const feats = Array.isArray(task.features) ? task.features : [];
      feats.forEach((f) => {
        if (f && typeof f.title === "string" && f.title.trim()) titles.push(f.title);
      });
    }
    const seen = new Set();
    const out = [];
    for (const t of titles) { if (!seen.has(t)) { seen.add(t); out.push(t); } }
    return out;
  }

  function stringListEditor({ idBase, label, initial = [], placeholder = "", suggestions = [] }) {
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
      const removeBtn = createEl("button", { type: "button", class: "btn-remove-row", onclick: () => { ul.removeChild(li); } }, "Remove");
      li.appendChild(input);
      li.appendChild(removeBtn);
      ul.appendChild(li);
    }

    if (list.length === 0) addRow(""); else list.forEach((v) => addRow(v));

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
            if (!prev || prev.id !== f.id || prev.taskId !== t.id) byTitleGlobalCI.set(key, null);
          }
        }
      }
    }

    for (const dRaw of deps) {
      const d = String(dRaw || "").trim();
      if (!d) continue;
      if (byIdCurrent.has(d)) { out.push(d); continue; }
      const tMatch = byTitleCurrentCI.get(d.toLowerCase());
      if (tMatch) { out.push(tMatch.id); continue; }
      const g = byTitleGlobalCI.get(d.toLowerCase());
      if (g && g.id) { out.push(g.id); continue; }
      out.push(d);
    }

    return out;
  }

  function computeNextFeatureId(task) {
    const base = String(task.id);
    const features = Array.isArray(task.features) ? task.features : [];
    let maxN = 0;
    for (const f of features) {
      const m = new RegExp('^' + base.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\.([0-9]+)$').exec(String(f.id || ''));
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n) && n > maxN) maxN = n;
      }
    }
    return `${base}.${maxN + 1}`;
  }

  function buildForm(task) {
    const root = $("#feature-create-view");
    root.innerHTML = "";

    const defaultId = computeNextFeatureId(task);

    const idInput = createEl("input", { id: `newfeat-id`, type: "text", value: defaultId, "aria-label": "Feature ID" });
    const statusSelect = createEl(
      "select",
      { id: `newfeat-status`, "aria-label": "Status" },
      STATUS_OPTIONS.map(s => createEl("option", { value: s, selected: s === "-" }, `${STATUS_LABELS[s]} (${s})`))
    );
    const titleInput = createEl("input", { id: `newfeat-title`, type: "text", value: "", "aria-label": "Title" });
    const descInput = createEl("textarea", { id: `newfeat-desc", rows: 3, "aria-label": "Description" });
    const planInput = createEl("textarea", { id: `newfeat-plan", rows: 3, "aria-label": "Plan" });

    const contextEditor = stringListEditor({ idBase: `newfeat-context`, label: "Context (one per row)", initial: [], placeholder: "Context item" });
    const acceptanceEditor = stringListEditor({ idBase: `newfeat-acceptance`, label: "Acceptance (one per row)", initial: [], placeholder: "Acceptance criterion" });
    const depSuggestions = featureSuggestionsTitles();
    const dependenciesEditor = stringListEditor({ idBase: `newfeat-deps`, label: "Dependencies (feature id or title; one per row)", initial: [], placeholder: "Feature id or title", suggestions: depSuggestions });
    const rejectionInput = createEl("textarea", { id: `newfeat-rejection`, rows: 2, "aria-label": "Rejection (optional)" });

    const createBtn = createEl("button", { type: "button", class: "btn-save" }, "Create");
    const cancelBtn = createEl("button", { type: "button", class: "btn-cancel", onclick: () => { window.close(); } }, "Cancel");

    createBtn.addEventListener("click", async () => {
      createBtn.disabled = true; cancelBtn.disabled = true;
      try {
        const depsResolved = resolveDependencies(dependenciesEditor.getValues(), task);
        const payload = {
          id: (idInput.value || '').trim(),
          status: statusSelect.value,
          title: titleInput.value || '',
          description: descInput.value || '',
          plan: planInput.value || '',
          context: contextEditor.getValues(),
          acceptance: acceptanceEditor.getValues(),
          dependencies: depsResolved,
        };
        const rej = (rejectionInput.value || '').trim();
        if (rej) payload.rejection = rej;
        const res = await window.tasksIndex.addFeature(task.id, payload);
        if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Unknown error');
        window.close();
      } catch (e) {
        alert(`Failed to add feature: ${e.message || e}`);
        createBtn.disabled = false; cancelBtn.disabled = false;
      }
    });

    const form = createEl("div", { class: "feature-create-form" }, [
      createEl("div", { class: "form-row" }, [createEl("label", { for: idInput.id }, "ID"), idInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: statusSelect.id }, "Status"), statusSelect]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: titleInput.id }, "Title"), titleInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: descInput.id }, "Description"), descInput]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: planInput.id }, "Plan"), planInput]),
      createEl("div", { class: "form-row" }, [contextEditor.root]),
      createEl("div", { class: "form-row" }, [acceptanceEditor.root]),
      createEl("div", { class: "form-row" }, [dependenciesEditor.root]),
      createEl("div", { class: "form-row" }, [createEl("label", { for: rejectionInput.id }, "Rejection"), rejectionInput]),
      createEl("div", { class: "form-actions" }, [createBtn, createEl("span", { class: "spacer" }), cancelBtn])
    ]);

    root.appendChild(form);
  }

  async function init() {
    const route = parseRoute(location.hash);
    const container = $("#feature-create-view");
    container.innerHTML = "Loading...";

    if (route.name !== 'create') {
      container.innerHTML = "Invalid route.";
      return;
    }

    try {
      currentIndex = await window.tasksIndex.getSnapshot();
      task = currentIndex && currentIndex.tasksById ? currentIndex.tasksById[String(route.id)] : null;
      if (!task) {
        container.innerHTML = '';
        container.appendChild(createEl('div', { class: 'empty' }, `Task ${route.id} not found.`));
        return;
      }
      buildForm(task);
      // subscribe to index updates to keep suggestions fresh
      window.tasksIndex.onUpdate((idx) => { currentIndex = idx; });
    } catch (e) {
      container.innerHTML = '';
      container.appendChild(createEl('div', { class: 'empty' }, 'Failed to load tasks index.'));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
