const { contextBridge, ipcRenderer } = require('electron');
const marked = require('marked');
const hljs = require('highlight.js');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const { window } = new JSDOM('');
const DOMPurify = createDOMPurify(window);

marked.setOptions({
  gfm: true,
  tables: true,
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
});

contextBridge.exposeInMainWorld('tasksIndex', {
  getSnapshot: async () => {
    return await ipcRenderer.invoke('tasks-index:get');
  },
  onUpdate: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('tasks-index:update', listener);
    return () => ipcRenderer.removeListener('tasks-index:update', listener);
  },
  updateTask: async (taskId, data) => {
    return await ipcRenderer.invoke('tasks:update', { taskId, data });
  },
  updateFeature: async (taskId, featureId, data) => {
    return await ipcRenderer.invoke('tasks-feature:update', { taskId, featureId, data });
  },
  addFeature: async (taskId, feature) => {
    return await ipcRenderer.invoke('tasks-feature:add', { taskId, feature });
  },
  addTask: async (task) => {
    return await ipcRenderer.invoke('tasks:add', task);
  }
});

contextBridge.exposeInMainWorld('docsIndex', {
  getSnapshot: async () => {
    return await ipcRenderer.invoke('docs-index:get');
  },
  onUpdate: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('docs-index:update', listener);
    return () => ipcRenderer.removeListener('docs-index:update', listener);
  },
  getFile: async (relativePath) => {
    return await ipcRenderer.invoke('docs-file:get', relativePath);
  },
  getRenderedMarkdown: async (relativePath) => {
    const content = await ipcRenderer.invoke('docs-file:get', relativePath);
    const html = marked.parse(content);
    const sanitized = DOMPurify.sanitize(html);
    return sanitized;
  }
});
