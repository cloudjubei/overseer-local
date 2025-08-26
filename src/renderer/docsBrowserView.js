(function () {
  // Simple state for docs browser and editor
  const state = {
    index: null,
    currentFile: null, // relPath
    currentContent: '',
    mode: 'view', // 'view' | 'edit'
    editor: null,
  };

  const docsView = document.getElementById('docs-view');
  if (!docsView) return;

  // Build layout: sidebar with files, content area with viewer/editor and toolbar
  docsView.innerHTML = `
    <div id="docs-layout" style="display:flex; height: 100%; gap: 12px;">
      <aside id="docs-sidebar" style="width: 280px; overflow:auto; border-right: 1px solid #e5e5e5; padding-right: 8px;"></aside>
      <section id="docs-content" style="flex: 1; display:flex; flex-direction: column; min-width:0;">
        <div id="docs-toolbar" style="display:flex; gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid #e5e5e5;">
          <button id="docs-edit-btn" disabled>Edit</button>
          <button id="docs-save-btn" style="display:none;">Save</button>
          <button id="docs-cancel-btn" style="display:none;">Cancel</button>
          <span id="docs-path" style="margin-left:auto; font-size: 12px; color: #666;"></span>
        </div>
        <div id="docs-viewer" style="flex:1; overflow:auto; padding: 8px;"></div>
        <div id="docs-editor" style="flex:1; overflow:auto; display:none;"></div>
      </section>
    </div>
  `;

  const sidebarEl = document.getElementById('docs-sidebar');
  const viewerEl = document.getElementById('docs-viewer');
  const editorEl = document.getElementById('docs-editor');
  const editBtn = document.getElementById('docs-edit-btn');
  const saveBtn = document.getElementById('docs-save-btn');
  const cancelBtn = document.getElementById('docs-cancel-btn');
  const pathEl = document.getElementById('docs-path');

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderSidebarTree(node) {
    if (!node) return '';
    if (node.type === 'dir') {
      const children = [
        ...node.dirs.map(renderSidebarTree),
        ...node.files.map((f) => `
          <li class="docs-file" data-rel="${escapeHtml(f.relPath)}">
            <a href="#docs:${encodeURIComponent(f.relPath)}">${escapeHtml(f.title || f.name)}</a>
          </li>
        `),
      ].join('');
      const label = node.relPath === '' ? 'docs' : node.name;
      return `
        <details open>
          <summary>${escapeHtml(label)}</summary>
          <ul style="margin-left: 12px; list-style: none; padding-left: 8px;">${children}</ul>
        </details>
      `;
    }
    return '';
  }

  async function loadIndex() {
    try {
      const snapshot = await window.docsIndex.get();
      state.index = snapshot;
      sidebarEl.innerHTML = renderSidebarTree(snapshot.tree);
      // Add click handler (delegated) for sidebar
      sidebarEl.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.tagName === 'A' && target.getAttribute('href')?.startsWith('#docs:')) {
          e.preventDefault();
          const rel = decodeURIComponent(target.getAttribute('href').slice('#docs:'.length));
          openFile(rel);
        }
      });
    } catch (e) {
      sidebarEl.innerHTML = `<div style="color:red;">Failed to load docs index: ${escapeHtml(String(e?.message || e))}</div>`;
    }
  }

  async function openFile(relPath) {
    try {
      const content = await window.docsIndex.getFile(relPath);
      state.currentFile = relPath;
      state.currentContent = content;
      pathEl.textContent = relPath;
      editBtn.disabled = false;
      setMode('view');
      renderViewer(content);
      // update hash for deep linking
      try { window.location.hash = `docs:${encodeURIComponent(relPath)}`; } catch {}
    } catch (e) {
      viewerEl.innerHTML = `<div style="color:red;">Failed to load file: ${escapeHtml(String(e?.message || e))}</div>`;
    }
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === 'view') {
      viewerEl.style.display = '';
      editorEl.style.display = 'none';
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      editBtn.style.display = '';
    } else {
      viewerEl.style.display = 'none';
      editorEl.style.display = '';
      saveBtn.style.display = '';
      cancelBtn.style.display = '';
      editBtn.style.display = 'none';
    }
  }

  function renderViewer(md) {
    // Use Toast UI Viewer if available; otherwise fallback to basic rendering
    if (window.toastui && window.toastui.Editor) {
      // Destroy previous viewer content
      viewerEl.innerHTML = '';
      const Viewer = window.toastui.Editor.factory;
      // Toast UI Editor factory with viewer config
      new Viewer({
        el: viewerEl,
        viewer: true,
        initialValue: md,
        usageStatistics: false,
        // sanitize is enabled by default in viewer
      });
    } else {
      // naive fallback - preformatted safe output
      viewerEl.innerHTML = `<pre>${escapeHtml(md)}</pre>`;
    }
  }

  function openEditor(md) {
    // Lazy initialize ToastUI Editor in edit mode
    editorEl.innerHTML = '';
    if (window.toastui && window.toastui.Editor) {
      state.editor = new window.toastui.Editor({
        el: editorEl,
        height: '100%',
        initialEditType: 'markdown',
        previewStyle: 'vertical',
        initialValue: md,
        usageStatistics: false,
      });
    } else {
      // Simple textarea fallback
      const ta = document.createElement('textarea');
      ta.style.width = '100%';
      ta.style.height = '100%';
      ta.value = md;
      editorEl.appendChild(ta);
      state.editor = {
        getMarkdown: () => ta.value,
        setMarkdown: (v) => (ta.value = v),
      };
    }
  }

  editBtn.addEventListener('click', () => {
    if (!state.currentFile) return;
    setMode('edit');
    openEditor(state.currentContent);
  });

  cancelBtn.addEventListener('click', () => {
    setMode('view');
    // No change; re-render viewer to reflect latest saved content
    renderViewer(state.currentContent);
  });

  saveBtn.addEventListener('click', async () => {
    if (!state.currentFile || !state.editor) return;
    const next = state.editor.getMarkdown();
    try {
      await window.docsIndex.saveFile(state.currentFile, next);
      state.currentContent = next;
      setMode('view');
      renderViewer(next);
      // Optional: basic toast via alert
      // In real app, integrate with a toast component.
    } catch (e) {
      alert('Failed to save: ' + String(e?.message || e));
    }
  });

  // Handle hash navigation for deep linking
  function handleHash() {
    const h = window.location.hash;
    if (h && h.startsWith('#docs:')) {
      const rel = decodeURIComponent(h.slice('#docs:'.length));
      openFile(rel);
    }
  }
  window.addEventListener('hashchange', handleHash);

  // Subscribe to index updates; refresh sidebar and if current file changed, reload it
  const unsubscribe = window.docsIndex.subscribe((snapshot) => {
    state.index = snapshot;
    sidebarEl.innerHTML = renderSidebarTree(snapshot.tree);
    if (state.currentFile) {
      // reload content to reflect external changes
      window.docsIndex.getFile(state.currentFile).then((content) => {
        state.currentContent = content;
        if (state.mode === 'view') renderViewer(content);
      }).catch(() => {});
    }
  });

  // Initialize
  loadIndex().then(handleHash);

  // Expose for debugging
  window.__docsView = { state };
})();
