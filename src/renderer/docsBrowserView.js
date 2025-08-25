"use strict";

(function () {
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

  function buildTreeEl(tree, selectHandler) {
    const ul = createEl("ul", { class: "docs-tree" });
    tree.children.forEach((child) => {
      const li = createEl("li");
      if (child.type === "directory") {
        const details = createEl("details");
        const summary = createEl("summary", { text: child.name });
        details.appendChild(summary);
        const subUl = buildTreeEl(child, selectHandler);
        details.appendChild(subUl);
        li.appendChild(details);
      } else {
        li.className = "file";
        li.dataset.path = child.path;
        li.textContent = child.name;
        li.onclick = () => selectHandler(child.path);
        li.tabindex = 0;
        li.role = "button";
        li.setAttribute("aria-label", `Select file ${child.name}`);
      }
      ul.appendChild(li);
    });
    return ul;
  }

  async function init() {
    const root = $("#docs-view");
    if (!root) return;

    const browser = createEl("div", { class: "docs-browser" });
    const treeContainer = createEl("div", { class: "docs-tree-container" });
    const contentContainer = createEl("div", { class: "docs-content-container" });
    browser.appendChild(treeContainer);
    browser.appendChild(contentContainer);

    root.appendChild(createEl("h2", { id: "docs-view-heading", text: "Documentation" }));
    root.appendChild(browser);

    let currentIndex = null;
    let selectedPath = null;

    function resolvePath(base, rel) {
      if (rel.startsWith('/')) {
        return rel.slice(1);
      }
      const baseParts = base.split('/').slice(0, -1);
      const relParts = rel.split('/');
      const parts = baseParts.slice();
      for (let i = 0; i < relParts.length; i++) {
        const part = relParts[i];
        if (part === '' || part === '.') continue;
        if (part === '..') {
          if (parts.length > 0) parts.pop();
        } else {
          parts.push(part);
        }
      }
      return parts.join('/');
    }

    async function selectFile(path) {
      selectedPath = path;
      const allFiles = root.querySelectorAll(".file");
      allFiles.forEach((el) => el.classList.toggle("selected", el.dataset.path === path));
      try {
        const html = await window.docsIndex.getRenderedMarkdown(path);
        contentContainer.innerHTML = "";
        const mdDiv = createEl("div", { class: "markdown-body" });
        mdDiv.innerHTML = html;
        contentContainer.appendChild(mdDiv);

        mdDiv.addEventListener('click', (e) => {
          const link = e.target.closest('a');
          if (!link) return;
          const href = link.getAttribute('href');
          if (!href) return;
          const [pathPart, hashPart] = href.split('#');
          const hash = hashPart || null;
          if (pathPart.startsWith('http:') || pathPart.startsWith('https:') || pathPart.startsWith('//')) return;
          if (pathPart && !pathPart.endsWith('.md')) return;
          e.preventDefault();
          const targetPath = pathPart ? resolvePath(selectedPath, pathPart) : selectedPath;
          if (targetPath === selectedPath) {
            if (hash) {
              const el = contentContainer.querySelector(`[id="${hash}"]`);
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
          } else {
            selectFile(targetPath).then(() => {
              if (hash) {
                const el = contentContainer.querySelector(`[id="${hash}"]`);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }
            });
          }
        });
      } catch (e) {
        contentContainer.innerHTML = "";
        contentContainer.appendChild(createEl("div", { class: "error", text: `Failed to load file: ${e.message}` }));
      }
    }

    function render() {
      treeContainer.innerHTML = "";
      contentContainer.innerHTML = "";
      const tree = currentIndex?.docsTree;
      if (!tree || tree.children.length === 0) {
        treeContainer.appendChild(createEl("div", { class: "empty", text: "No documentation files found." }));
        contentContainer.appendChild(createEl("div", { class: "empty", text: "Select a file to view its content." }));
        return;
      }
      const treeEl = buildTreeEl(tree, selectFile);
      treeContainer.appendChild(treeEl);
      if (currentIndex.errors?.length > 0) {
        const errDiv = createEl("div", { class: "errors" });
        currentIndex.errors.forEach((err) => errDiv.appendChild(createEl("p", { text: err })));
        treeContainer.appendChild(errDiv);
      }
      if (selectedPath && currentIndex.filesByPath?.[selectedPath]) {
        selectFile(selectedPath);
      } else {
        contentContainer.appendChild(createEl("div", { class: "empty", text: "Select a file to view its content." }));
      }
    }

    function updateVisibility() {
      root.style.display = location.hash === "#docs" ? "" : "none";
    }

    window.addEventListener("hashchange", updateVisibility);
    updateVisibility();

    try {
      currentIndex = await window.docsIndex.getSnapshot();
      render();
      window.docsIndex.onUpdate((idx) => {
        currentIndex = idx;
        render();
      });
    } catch (e) {
      treeContainer.appendChild(createEl("div", { class: "error", text: "Failed to load docs index." }));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
