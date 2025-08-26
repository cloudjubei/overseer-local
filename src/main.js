import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { TasksIndexer }  from './tasks/indexer';
import { URL } from 'node:url';
import { DocsIndexer } from './docs/indexer';
import { OpenAI } from 'openai';


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}
let mainWindow;
let indexer;
let docsIndexer;


const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // contextIsolation: true,
      // nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();

  const projectRoot = app.getAppPath();
  indexer = new TasksIndexer(projectRoot, mainWindow);
  indexer.init();

  docsIndexer = new DocsIndexer(projectRoot);
  docsIndexer.init();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  if (indexer) {
    indexer.stopWatching();
  }
  if (docsIndexer) {
    docsIndexer.stopWatching();
  }
});

ipcMain.handle('tasks-index:get', async () => {
  return indexer.getIndex();
});

ipcMain.handle('tasks:update', async (event, { taskId, data }) => {
  return await indexer.updateTask(taskId, data);
});

ipcMain.handle('tasks-feature:update', async (event, { taskId, featureId, data }) => {
  return await indexer.updateFeature(taskId, featureId, data);
});

ipcMain.handle('tasks-feature:add', async (event, { taskId, feature }) => {
  return await indexer.addFeature(taskId, feature);
});

ipcMain.handle('tasks-feature:delete', async (event, { taskId, featureId }) => {
  if (!indexer) {
    return { ok: false, error: 'Indexer not initialized' };
  }
  try {
    const result = await indexer.deleteFeature(taskId, featureId);
    return result;
  } catch (error) {
    console.error(`Failed to delete feature ${featureId} from task ${taskId}:`, error);
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('tasks-features:reorder', async (event, { taskId, payload }) => {
  return await indexer.reorderFeatures(taskId, payload);
});

ipcMain.handle('tasks:add', async (event, task) => {
  return await indexer.addTask(task);
});

ipcMain.handle('tasks:delete', async (event, { taskId }) => {
  if (!indexer) {
    return { ok: false, error: 'Indexer not initialized' };
  }
  try {
    const result = await indexer.deleteTask(taskId);
    return result;
  } catch (error) {
    console.error(`Failed to delete task ${taskId}:`, error);
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('tasks:reorder', async (event, payload) => {
  return await indexer.reorderTasks(payload);
});

const createModalWindow = (options) => {
  const window = new BrowserWindow({
    width: options.width || 800,
    height: options.height || 600,
    modal: true,
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    ...options.browserWindow,
  });

  // This is the magic: Load the MAIN app's URL, but add the
  // special hash that our App.tsx router will understand.
  // eslint-disable-next-line no-undef
  const devServerURL = MAIN_WINDOW_VITE_DEV_SERVER_URL;
  if (devServerURL) {
    const url = new URL(devServerURL);
    url.hash = options.hash;
    window.loadURL(url.href);
  } else {
    // eslint-disable-next-line no-undef
    const filePath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    const url = new URL(`file://${filePath}`);
    url.hash = options.hash;
    window.loadFile(url.pathname, { hash: url.hash.substring(1) });
  }

  // Optional: Open dev tools for the modal for debugging
  // window.webContents.openDevTools();

  return window;
};

ipcMain.handle('feature-create:open', (event, taskId) => {
  createModalWindow({
    width: 600,
    height: 800,
    browserWindow: { title: 'Create Feature' },
    hash: `feature-create/${taskId}`,
  });
});

ipcMain.handle('task-create:open', () => {
  createModalWindow({
    width: 600,
    height: 500,
    browserWindow: { title: 'Create Task' },
    hash: 'task-create',
  });
});

ipcMain.handle('task-edit:open', (event, taskId) => {
  createModalWindow({
    width: 600,
    height: 500,
    browserWindow: { title: 'Edit Task' },
    hash: `task-edit/${taskId}`,
  });
});

ipcMain.handle('feature-edit:open', (event, taskId, featureId) => {
  createModalWindow({
    width: 600,
    height: 800,
    browserWindow: { title: 'Edit Feature' },
    hash: `feature-edit/${taskId}/${featureId}`,
  });
});


ipcMain.handle('docs-index:get', async () => {
  return docsIndexer.getIndex();
});

ipcMain.handle('docs-file:get', async (event, { relPath }) => {
  return await docsIndexer.getFile(relPath);
});
ipcMain.handle('docs-file:save', async (event, { relPath, content }) => {
  return await docsIndexer.saveFile(relPath, content);
});

ipcMain.handle('chat:completion', async (event, {messages, config}) => {
  try {
    const openai = new OpenAI({baseURL: config.apiBaseUrl, apiKey: config.apiKey});
    const systemPrompt = {role: 'system', content: 'You are a helpful project assistant. Discuss tasks, documents, and related topics. Use tools to query project info. If user mentions @path, use read_doc.'};
    let chatMessages = [systemPrompt, ...messages];
    const tools = [
      {
        type: 'function',
        function: {
          name: 'list_tasks',
          description: 'List all tasks in the project. Returns an object mapping task IDs to task details.',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_docs',
          description: 'List the document tree in the project. Returns a tree structure of directories and files.',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'read_doc',
          description: 'Read the content of a specific document. The path is relative to the docs directory.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path to the document' }
            },
            required: ['path'],
            additionalProperties: false
          }
        }
      }
    ];
    const availableTools = {
      list_tasks: () => indexer.getIndex().tasksById,
      list_docs: () => docsIndexer.getIndex().tree,
      read_doc: (args) => {
        try {
          const fullPath = path.join(docsIndexer.getIndex().docsDir, args.path);
          const content = fs.readFileSync(fullPath, 'utf8');
          return { content };
        } catch (e) {
          return { error: e.message };
        }
      }
    };
    while (true) {
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: chatMessages,
        tools: tools.length > 0 ? tools : undefined,
        stream: false,
      });
      const message = response.choices[0].message;
      if (!message.tool_calls) {
        return message;
      }
      chatMessages.push(message);
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        if (!availableTools[toolName]) {
          throw new Error(`Unknown tool: ${toolName}`);
        }
        const result = await availableTools[toolName](args);
        chatMessages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      }
    }
  } catch (error) {
    console.error('Error in chat completion:', error);
    return { role: 'assistant', content: `An error occurred: ${error.message}` };
  }
});