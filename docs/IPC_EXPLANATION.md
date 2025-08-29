# IPC in Electron: Why and How It's Used in This Project

## Overview
In Electron applications, there are two main types of processes: the **main process** (running Node.js) and **renderer processes** (running web content like React apps). These processes are isolated for security and performance reasons. Inter-Process Communication (IPC) is the mechanism Electron provides to allow these processes to communicate safely.

This document explains the IPC setup in this project, including the roles of key files like `main.js`, `preload.js`, `external.d.ts`, and renderer services (e.g., `fileService.ts`). It also addresses why we can't simply create services in `main.js` and import them directly into the renderer via standard imports.

## Why IPC? Key Reasons
Electron's architecture enforces separation between the main process and renderer processes:

- **Security**: Renderer processes run untrusted web code (e.g., from the internet or user input). To prevent security vulnerabilities, renderers have limited access to Node.js APIs. Enabling full Node integration in renderers is discouraged as it can lead to exploits (e.g., remote code execution).
- **Isolation**: The main process manages app lifecycle, windows, and system resources (like file I/O, native modules). Renderers focus on UI rendering and user interactions. Direct access from renderer to main could break this isolation.
- **Context Isolation**: Modern Electron apps use `contextIsolation: true` (as in this project) to further protect the preload script's Node environment from the renderer's web environment.
- **Asynchronous Nature**: Many operations (e.g., file reading) are async and need to cross process boundaries, which IPC handles efficiently.

Without IPC, the renderer couldn't safely perform tasks like reading files or managing tasks, as these require main-process privileges.

## Why Not Direct Imports?
You might wonder: "Why not create a service like `FileService` in `main.js` and import it directly into the renderer (e.g., via `import { FileService } from '../../main.js'`) ?"

This isn't possible due to Electron's process model:
- **Process Separation**: Code in `main.js` runs in the main process, while renderer code (e.g., React components) runs in a separate renderer process. You can't directly import and call main-process code from a renderer—it's like trying to import a module from a different running program.
- **No Shared Memory**: Processes don't share memory or modules. Direct imports would require bundling everything into one process, which defeats isolation and security.
- **Build and Runtime Constraints**: The renderer is built with tools like Vite for web (ES modules), while main uses Node.js. Mixing them directly isn't supported and would disable features like hot module replacement (HMR).

Instead, we use IPC to "route" requests from the renderer to the main process. The renderer asks the main process to perform an action (e.g., read a file) and receives the result back via IPC channels.

### Alternatives Considered
- **Node Integration**: Enabling `nodeIntegration: true` in BrowserWindow options would allow renderers to use Node.js directly, but this is insecure and deprecated.
- **Remote Modules**: Electron's `electron-remote` allowed some cross-process calls, but it's removed in recent versions for security.

IPC is the recommended, secure way to bridge processes.

## How IPC Works in This Project

### 1. Main Process (`src/main.js`)
- Sets up the Electron app and creates the BrowserWindow.
- Initializes indexers/managers (e.g., `TaskIndexer`, `FileIndexer`, `ChatManager`).
- Registers IPC handlers using `ipcMain.handle(channel, handler)`. These handlers:
  - Perform privileged operations (e.g., file I/O, task updates).
  - Interact with indexers to read/write data.
  - Return results to the renderer.
- Examples:
  - `'files:read'`: Reads a file from disk.
  - `'tasks:update'`: Updates a task via the indexer.
- Watches directories for changes and notifies renderers via `webContents.send`.

### 2. Preload Script (`src/preload.js`)
- Runs in a privileged context (has Node.js access but is isolated from the renderer).
- Uses `contextBridge.exposeInMainWorld` to expose safe APIs to the renderer's `window` object.
- These APIs wrap `ipcRenderer.invoke(channel, args)` calls to communicate with main's handlers.
- Examples:
  - `window.files.get()`: Invokes `'files-index:get'` to fetch the file index.
  - `window.tasksIndex.updateTask(taskId, data)`: Invokes `'tasks:update'`.
- Also sets up event listeners (e.g., `ipcRenderer.on('files-index:update', callback)`) for subscriptions.

### 3. Type Definitions (`src/types/external.d.ts`)
- Provides TypeScript interfaces for the exposed APIs (e.g., `TasksIndexAPI`, `FileIndexAPI`).
- Declares `interface Window { tasksIndex: TasksIndexAPI; ... }` so renderer code gets type safety and autocompletion.
- Ensures consistency between main handlers, preload wrappers, and renderer usage.

### 4. Renderer Services (e.g., `src/renderer/services/fileService.ts`)
- Consume the exposed APIs to provide higher-level abstractions.
- Handle fallbacks, caching, and UI-specific logic (e.g., polling if no events).
- Examples:
  - `fileService.getIndex()`: Calls `window.files.get()` and normalizes the data.
  - `useFilesIndex()` hook: Subscribes to updates via `window.files.subscribe()`.
- Services don't directly access the file system; they route everything through IPC to main.

## Flow Example: Reading a File
1. Renderer calls `fileService.readFileText('path/to/file.txt')`.
2. Service invokes `window.files.readFile('path/to/file.txt', 'utf8')` (from preload).
3. Preload sends IPC to main via `ipcRenderer.invoke('files:read', ...)`.
4. Main's handler reads the file using `fs.readFileSync` and returns the content.
5. Response flows back through IPC to the renderer.

## Advantages of This Setup
- **Security**: Renderer can't access sensitive APIs directly.
- **Modularity**: Easy to change backends (e.g., switch from local files to cloud) without rewriting the renderer.
- **Testability**: IPC channels can be mocked in tests.
- **Performance**: Main handles heavy tasks, keeping UI responsive.

## Potential Drawbacks and Mitigations
- **Latency**: IPC adds overhead for frequent calls. Mitigated by batching, caching (e.g., index snapshots), and subscriptions.
- **Complexity**: More files/boilerplate. Mitigated by clear conventions and types.

For more details, see Electron's [IPC documentation](https://www.electronjs.org/docs/latest/tutorial/ipc) and [process model](https://www.electronjs.org/docs/latest/tutorial/process-model).