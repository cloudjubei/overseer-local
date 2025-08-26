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

  // Resolve path like ./a/b.md, ../b.md relative to currentPath (docs-relative)
  function resolveRelativePath(currentPath, hrefPath) {
    const currentParts = currentPath.split('/');
    currentParts.pop(); // remove current file name
    const hrefParts = hrefPath.split('/');
    while (hrefParts.length > 0 && hrefParts[0] === '..') {
      hrefParts.shift();
      if (currentParts.length > 0) currentParts.pop();
    }
    if (hrefParts[0] === '.') hrefParts.shift();
    return [...currentParts, ...hrefParts].join('/');
  }

  function buildTreeFromNewIndex(node, parentUl, selectFile) {
    if (!node) return;
    if (node.type === 'dir') {
      const li = createEl('li');
      li.className = 'directory';
      const details = createEl('details');
      const summary = createEl('summary', {}, node.relPath ? node.name : 'docs');
      details.appendChild(summary);

      const subUl = createEl('ul');
      // Sort directories then files by name
      const dirs = Array.isArray(node.dirs) ? [...node.dirs].sort((a, b) => a.name.localeCompare(b.name)) : [];
      const files = Array.isArray(node.files) ? [...node.files].sort((a, b) => a.name.localeCompare(b.name)) : [];

      for (const d of dirs) buildTreeFromNewIndex(d, subUl, selectFile);
      for (const f of files) {
        const fLi = createEl('li');
        fLi.className = 'file';
        const link = createEl('a', { href: '#', onclick: (e) => { e.preventDefault(); selectFile(f.relPath); } }, f.name);
        fLi.appendChild(link);
        subUl.appendChild(fLi);
      }

      details.appendChild(subUl);
      li.appendChild(details);
      parentUl.appendChild(li);
    }
  }

  function buildTreeNodeLegacy(node, parentUl, selectFile) {
    const li = createEl("li");
    if (node.type === "directory") {
      li.className = "directory";
      const summary = createEl("summary", {}, node.name || "docs");
      const details = createEl("details", {}, [summary]);
      const subUl = createEl("ul");
      details.appendChild(subUl);
      li.appendChild(details);
      const sortedChildren = [...(node.children || [])].sort((a, b) => (a.type === "directory" ? -1 : 1));
      sortedChildren.forEach((child) => buildTreeNodeLegacy(child, subUl, selectFile));
    } else if (node.type === "file") {
      li.className = "file";
      const link = createEl("a", { href: "#", onclick: (e) => { e.preventDefault(); selectFile(node.path); } }, node.name);
      li.appendChild(link);
    }
    parentUl.appendChild(li);
  }

  function render(index, treeContainer, contentContainer, errorsContainer, selectFile) {
    treeContainer.innerHTML = "";
    errorsContainer.innerHTML = "";

    if (!index) {
      treeContainer.appendChild(createEl("div", { class: "empty" }, "Failed to load documentation index."));
      return;
    }

    // Build tree based on either legacy shape (docsTree) or new shape (tree)
    const hasLegacyTree = !!index.docsTree;
    const hasNewTree = !!index.tree;

    if (!hasLegacyTree && !hasNewTree) {
      treeContainer.appendChild(createEl("div", { class: "empty" }, "No documentation files found."));
    } else {
      const ul = createEl("ul", { class: "docs-tree" });
      if (hasLegacyTree) {
        buildTreeNodeLegacy(index.docsTree, ul, selectFile);
      } else {
        buildTreeFromNewIndex(index.tree, ul, selectFile);
      }
      treeContainer.appendChild(ul);
    }

    if (index.errors && index.errors.length > 0) {
      const errList = createEl("ul", {}, index.errors.map((err) => createEl("li", {}, typeof err === 'string' ? err : (err.message || JSON.stringify(err)))));
      errorsContainer.appendChild(createEl("div", { class: "errors" }, [createEl("h3", {}, "Indexing Errors"), errList]));
    }

    // Initial message
    contentContainer.innerHTML = "";
    contentContainer.appendChild(createEl("div", {}, "Select a file to view its content."));
  }

  function toSlug(s) {
    const text = (s || '').trim().toLowerCase();
    return text
      .replace(/[\u2000-\u206F\u2E00-\u2E7F'"!#$%&()*+,./:;<=>?@\[\]^`{|}~]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function scrollToFragment(container, fragment) {
    if (!fragment) return;
    const raw = decodeURIComponent(fragment);
    try {
      const idSel = `#${CSS && CSS.escape ? CSS.escape(raw) : raw.replace(/"/g, '\\"')}`;
      let target = container.querySelector(idSel);
      if (!target) target = container.querySelector(`[name="${raw}"]`);
      if (!target) {
        // Try GitHub-style slug from the fragment
        const slug = toSlug(raw);
        if (slug) {
          target = container.querySelector(`#${slug}`) || container.querySelector(`[id="${slug}"]`);
        }
      }
      if (!target) {
        // Fallback: match heading text
        const slug = toSlug(raw);
        const headings = container.querySelectorAll('h1,h2,h3,h4,h5,h6');
        for (const h of headings) {
          const ht = h.textContent ? toSlug(h.textContent) : '';
          if (ht === slug || (h.id && h.id === raw)) { target = h; break; }
        }
      }
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (_) {
      // ignore scrolling errors
    }
  }

  async function init() {
    const root = document.getElementById("docs-view");
    if (!root) return;

    const heading = createEl("h2", { id: "docs-view-heading" }, "Documentation");

    const treeContainer = createEl("div", { class: "docs-tree-container" });
    const contentContainer = createEl("div", { class: "docs-content-container" });
    const errorsContainer = createEl("div", { class: "docs-errors-container" });

    const browser = createEl("div", { class: "docs-browser" }, [treeContainer, contentContainer]);

    root.appendChild(heading);
    root.appendChild(browser);
    root.appendChild(errorsContainer);

    let currentIndex = null;
    let selectedPath = null;
    let editor = null;
    let isEditMode = false;

    // Intercept all clicks on links inside the content container for internal navigation
    contentContainer.addEventListener('click', (e) => {
      const a = e.target && (e.target.closest ? e.target.closest('a[href]') : null);
      if (!a) return;
      const href = a.getAttribute('href') || '';
      // External or absolute http(s) links: allow default
      if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)) return;
      if (href.startsWith('#')) {
        e.preventDefault();
        const fragment = href.slice(1);
        const mdDiv = contentContainer.querySelector('.markdown-body') || contentContainer;
        scrollToFragment(mdDiv, fragment);
        return;
      }
      // Internal .md links (with optional fragment)
      // Ignore protocol-like strings
      if (/^[a-zA-Z]+:/.test(href)) return;

      const [hrefPath, fragment = ''] = href.split('#');
      if (/\.md$/i.test(hrefPath)) {
        e.preventDefault();
        const targetPath = resolveRelativePath(selectedPath || '', hrefPath);
        selectFile(targetPath, fragment);
      }
    });

    async function enterEditMode(path, contentContainer) {
      // Optional editing support kept; not part of this feature
      const getFile = window.docsIndex && typeof window.docsIndex.getFile === 'function'
        ? window.docsIndex.getFile
        : null;
      if (!getFile) return;
      let markdown = '';
      try {
        const res = await getFile(path);
        if (typeof res === 'string') markdown = res;
        else if (res && res.ok && typeof res.content === 'string') markdown = res.content;
        else if (res && typeof res.content === 'string') markdown = res.content;
      } catch (err) {
        contentContainer.appendChild(createEl("div", { class: "error" }, `Failed to load file content: ${err && err.message || err}`));
        return;
      }

      contentContainer.innerHTML = '';
      const editorEl = createEl('div', { id: 'editor' });
      contentContainer.appendChild(editorEl);

      if (window.toastui && window.toastui.Editor) {
        editor = new window.toastui.Editor({
          el: editorEl,
          initialEditType: 'wysiwyg',
          previewStyle: 'vertical',
          height: '500px',
          initialValue: markdown
        });
      } else {
        editorEl.textContent = markdown;
      }

      const actions = createEl('div', { class: 'editor-actions' });
      const cancelBtn = createEl('button', { onclick: () => {
        exitEditMode(contentContainer);
        viewFile(path, contentContainer);
      } }, 'Cancel');
      actions.appendChild(cancelBtn);
      contentContainer.appendChild(actions);

      isEditMode = true;
    }

    function exitEditMode(contentContainer) {
      if (editor && editor.destroy) {
        editor.destroy();
        editor = null;
      }
      contentContainer.innerHTML = '';
      isEditMode = false;
    }

    async function viewFile(path, contentContainer, fragment) {
      contentContainer.innerHTML = '';
      contentContainer.appendChild(createEl("div", {}, "Loading..."));
      try {
        let html = null;
        let markdown = null;

        const hasRendered = window.docsIndex && typeof window.docsIndex.getRenderedMarkdown === 'function';
        if (hasRendered) {
          const res = await window.docsIndex.getRenderedMarkdown(path);
          if (res && res.ok) html = res.content;
          else if (res && typeof res === 'string') html = res;
        }
        if (html == null) {
          // Fallback: get raw markdown; very basic rendering (pre) so anchors may not work without IDs
          const res = await (window.docsIndex && window.docsIndex.getFile ? window.docsIndex.getFile(path) : Promise.resolve(''));
          if (typeof res === 'string') markdown = res;
          else if (res && res.ok && typeof res.content === 'string') markdown = res.content;
          else if (res && typeof res.content === 'string') markdown = res.content;
        }

        contentContainer.innerHTML = '';
        const mdDiv = createEl("div", { class: "markdown-body" });
        if (html != null) {
          mdDiv.innerHTML = html;
        } else if (markdown != null) {
          // Minimal fallback rendering: wrap in <pre>; internal anchors won't be present
          const pre = createEl('pre');
          pre.textContent = markdown;
          mdDiv.appendChild(pre);
        } else {
          mdDiv.textContent = 'Failed to load content.';
        }

        contentContainer.appendChild(mdDiv);

        // After rendering, if a fragment was requested, scroll to it
        if (fragment) scrollToFragment(mdDiv, fragment);

        // Optional edit button (no-op if toastui not present)
        const editBtn = createEl('button', { onclick: () => enterEditMode(path, contentContainer) }, 'Edit');
        contentContainer.appendChild(editBtn);
      } catch (e) {
        contentContainer.innerHTML = '';
        contentContainer.appendChild(createEl("div", { class: "error" }, `Failed to load file: ${e.message || e}`));
      }
    }

    async function selectFile(path, fragment) {
      selectedPath = path;
      if (isEditMode) exitEditMode(contentContainer);
      await viewFile(path, contentContainer, fragment);
    }

    function updateVisibility() {
      root.style.display = isDocsRoute(location.hash) ? "" : "none";
    }

    window.addEventListener("hashchange", updateVisibility);
    updateVisibility();

    try {
      // Support both legacy and new preload APIs
      const getIndex = window.docsIndex && typeof window.docsIndex.get === 'function'
        ? window.docsIndex.get
        : (window.docsIndex && window.docsIndex.getSnapshot) ? window.docsIndex.getSnapshot : null;

      const subscribe = window.docsIndex && typeof window.docsIndex.subscribe === 'function'
        ? window.docsIndex.subscribe
        : (window.docsIndex && window.docsIndex.onUpdate) ? window.docsIndex.onUpdate : null;

      currentIndex = getIndex ? await getIndex() : null;
      render(currentIndex, treeContainer, contentContainer, errorsContainer, selectFile);

      if (subscribe) {
        subscribe((idx) => {
          currentIndex = idx;
          render(idx, treeContainer, contentContainer, errorsContainer, selectFile);
          if (selectedPath) {
            // try to keep selection
            selectFile(selectedPath);
          }
        });
      }
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
