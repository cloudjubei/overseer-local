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

  function isDocsRoute(hash) {
    return hash === "#docs";
  }

  function buildTreeNode(node, parentUl) {
    const li = createEl("li");
    if (node.type === "directory") {
      li.className = "directory";
      const summary = createEl("summary", {}, node.name || "docs");
      const details = createEl("details", {}, [summary]);
      const subUl = createEl("ul");
      details.appendChild(subUl);
      li.appendChild(details);
      // Sort directories first, then files
      const sortedChildren = [...node.children].sort((a, b) => (a.type === "directory" ? -1 : 1));
      sortedChildren.forEach((child) => buildTreeNode(child, subUl));
    } else if (node.type === "file") {
      li.className = "file";
      const link = createEl("a", { href: "#", onclick: (e) => { e.preventDefault(); selectFile(node.path); } }, node.name);
      li.appendChild(link);
    }
    parentUl.appendChild(li);
  }

  function resolveRelativePath(currentPath, href) {
    const parts = currentPath.split('/');
    parts.pop(); // remove current file
    const hrefParts = href.split('/');
    while (hrefParts.length > 0 && hrefParts[0] === '..') {
      hrefParts.shift();
      if (parts.length > 0) parts.pop();
    }
    if (hrefParts[0] === '.') hrefParts.shift();
    return [...parts, ...hrefParts].join('/');
  }

  async function selectFile(path) {
    contentContainer.innerHTML = "";
    contentContainer.appendChild(createEl("div", {}, "Loading..."));
    try {
      const res = await window.docsIndex.getRenderedMarkdown(path);
      if (!res.ok) throw new Error(res.error || "Unknown error");
      contentContainer.innerHTML = "";
      const mdDiv = createEl("div", { class: "markdown-body" });
      mdDiv.innerHTML = res.content;
      // Handle internal links
      mdDiv.querySelectorAll('a[href]').forEach(a => {
        let href = a.getAttribute('href');
        if (href.endsWith('.md') || href.endsWith('.MD')) {
          a.addEventListener('click', e => {
            e.preventDefault();
            const targetPath = resolveRelativePath(path, href);
            selectFile(targetPath);
          });
        }
      });
      contentContainer.appendChild(mdDiv);
    } catch (e) {
      contentContainer.innerHTML = "";
      contentContainer.appendChild(createEl("div", { class: "error" }, `Failed to load file: ${e.message || e}`));
    }
  }

  function render(index, treeContainer, contentContainer, errorsContainer) {
    treeContainer.innerHTML = "";
    errorsContainer.innerHTML = "";
    if (!index || !index.docsTree) {
      treeContainer.appendChild(createEl("div", { class: "empty" }, "Failed to load documentation index."));
      return;
    }
    if (index.docsTree.children.length === 0) {
      treeContainer.appendChild(createEl("div", { class: "empty" }, "No documentation files found."));
    } else {
      const ul = createEl("ul", { class: "docs-tree" });
      buildTreeNode(index.docsTree, ul);
      treeContainer.appendChild(ul);
    }
    if (index.errors && index.errors.length > 0) {
      const errList = createEl("ul", {}, index.errors.map((err) => createEl("li", {}, err)));
      errorsContainer.appendChild(createEl("div", { class: "errors" }, [createEl("h3", {}, "Indexing Errors"), errList]));
    }
    // For initial, show select message
    contentContainer.innerHTML = "";
    contentContainer.appendChild(createEl("div", {}, "Select a file to view its content."));
  }

  async function init() {
    const root = document.getElementById("docs-view");
    if (!root) return;

    const heading = createEl("h2", { id: "docs-view-heading" }, "Documentation");

    const treeContainer = createEl("div", { class: "docs-tree-container" });
    const contentContainerLocal = createEl("div", { class: "docs-content-container" });
    const errorsContainer = createEl("div", { class: "docs-errors-container" });

    const browser = createEl("div", { class: "docs-browser" }, [treeContainer, contentContainerLocal]);

    root.appendChild(heading);
    root.appendChild(browser);
    root.appendChild(errorsContainer);

    let currentIndex = null;
    let selectedPath = null;

    function updateVisibility() {
      root.style.display = isDocsRoute(location.hash) ? "" : "none";
    }

    window.addEventListener("hashchange", updateVisibility);
    updateVisibility();

    try {
      currentIndex = await window.docsIndex.getSnapshot();
      render(currentIndex, treeContainer, contentContainerLocal, errorsContainer);
      window.docsIndex.onUpdate((idx) => {
        currentIndex = idx;
        render(idx, treeContainer, contentContainerLocal, errorsContainer);
        if (selectedPath && idx.filesByPath && idx.filesByPath[selectedPath]) {
          selectFile(selectedPath);
        }
      });
    } catch (e) {
      treeContainer.appendChild(createEl("div", { class: "error" }, "Failed to load docs index."));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
