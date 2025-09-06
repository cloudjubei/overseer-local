# Client Online Mode Specification

This document outlines the implementation details for enabling a "backend-connected" (online) mode in the client application, while retaining the existing local-only functionality.

## 1. Overview

The application will support two operational modes:

*   **Local-only Mode**: All operations (project management, agent execution) are performed on the local filesystem using the embedded `factory-ts` library. This is the default and legacy mode.
*   **Online Mode**: Operations are routed to a remote backend service via a REST API. The client acts as a "thin client," and the backend manages the project state and agent execution.

A user should be able to switch between these modes. The choice of mode will be persisted.

## 2. Settings Model and Persistence

We will introduce a new settings model to store the application's configuration. This will be stored in a user-specific configuration file (e.g., in the app's user data directory managed by Electron).

```typescript
// src/main/services/settingsService.ts (conceptual)
interface AppSettings {
  mode: 'local' | 'online';
  backend: {
    url: string | null;
    apiToken: string | null;
  };
}
```

*   **`mode`**: Determines the operational mode. Defaults to `'local'`.
*   **`backend.url`**: The base URL of the backend API.
*   **`backend.apiToken`**: The authentication token for the backend API.

These settings will be persisted on disk and loaded at startup.

## 3. Configuration Sources and Priority

The backend configuration can be provided through multiple sources, with the following priority:

1.  **Persisted User Settings (UI)**: Values set by the user in the settings screen.
2.  **Environment Variables**: For easier configuration in development or CI/CD environments.
    *   `BACKEND_URL`
    *   `BACKEND_API_TOKEN`
3.  **Default Values**: `mode` defaults to `'local'`.

On startup, the application will resolve the configuration by checking these sources in order. If environment variables are present, they can be used to pre-fill the settings UI.

## 4. UI Specification

A new "Settings" screen will be added to the application. It will contain a section for "Mode".

*   **Mode Selector**: A radio button or dropdown to select "Local" or "Online".
*   **Backend Configuration (visible if "Online" is selected)**:
    *   **Backend URL**: A text input for the service URL.
    *   **API Token**: A password input for the API token.
    *   **"Test Connection" Button**: A button to validate the URL and token. It should provide feedback (e.g., "Connection successful" or "Error: ...").
*   **"Save" Button**: To persist the settings. The application might need to be restarted for the mode change to take full effect, which should be communicated to the user.

## 5. Connection Validation and Fallback

When in "Online" mode, the main process will attempt to connect to the backend at startup.

*   **Validation**: A dedicated endpoint on the backend (e.g., `/api/v1/health` or `/api/v1/status`) will be used to check the connection and authentication.
*   **Fallback**: If the connection fails at startup or during an operation:
    *   The UI will display a prominent, non-blocking notification that the backend is unreachable.
    *   The application will enter a read-only or degraded state for online-only features.
    *   It **will not** automatically fall back to local mode to avoid data conflicts or unexpected behavior. The user must explicitly switch back to local mode via settings.

## 6. Adapter API

To abstract the business logic from the transport layer, we will introduce an adapter pattern. A common interface will be defined, with two implementations:

*   **`LocalAdapter`**: Interacts directly with `factory-ts` and the local filesystem. This will encapsulate the existing logic.
*   **`BackendAdapter`**: Makes HTTP requests to the remote backend API.

This interface will cover all project and agent-related operations.

```typescript
// src/main/adapters/interface.ts (conceptual)

// Simplified example. This will be expanded to cover all operations.
interface IProjectAdapter {
  // Project Management
  listProjects(): Promise<Project[]>;
  openProject(path: string): Promise<ProjectDetails>;
  createProject(name: string, path: string): Promise<Project>;

  // Task Management
  getTasks(projectId: string): Promise<Task[]>;
  createTask(projectId: string, description: string): Promise<Task>;

  // Agent Operations
  runAgent(projectId: string, taskId: string, agentConfig: AgentConfig): Promise<AgentRun>;
  getAgentRunStatus(runId: string): Promise<AgentRunStatus>;
}
```

The main process will instantiate the appropriate adapter based on the configured `mode`.

## 7. IPC Contract Updates

The existing IPC channels between the renderer and the main process will be maintained. However, the handlers in the main process will be updated to delegate calls to the currently active adapter (`LocalAdapter` or `BackendAdapter`).

**Example Flow (Listing Projects):**

1.  **Renderer**: `ipcRenderer.invoke('projects:list')`
2.  **Main Process (`main.js`)**:
    *   Receives the `'projects:list'` call.
    *   Gets the active adapter instance from a service/manager.
    *   `const projects = await activeAdapter.listProjects();`
    *   Returns `projects` to the renderer.

This ensures the renderer remains agnostic to the operational mode. The logic is centralized in the main process.
