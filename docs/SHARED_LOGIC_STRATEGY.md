# Shared Logic and Multi-Platform Strategy

This document outlines the strategy for refactoring the existing Electron application to share code with new React web and React Native mobile clients. The goal is to maximize code reuse, maintain a clean separation of concerns, and establish a scalable architecture for future development.

## 1. Guiding Principles

- **Monorepo:** Adopt a monorepo structure to manage shared packages and platform-specific applications.
- **Offline-First:** Core logic should operate on a local data store, with synchronization to a central backend.
- **Platform Abstraction:** Isolate platform-specific code (e.g., file system access, notifications) behind common interfaces.
- **Share Everything Possible:** From UI components to business logic and types, aim for maximum sharing.

## 2. Proposed Package Structure

We will adopt a monorepo structure using a manager like pnpm or Yarn workspaces.

```
/
|-- apps/
|   |-- electron/   # The current Electron application, refactored
|   |-- web/        # The new React web application
|   `-- mobile/     # The new React Native mobile application
|-- packages/
|   |-- core/       # Shared business logic, services, and hooks
|   |-- ui/         # Shared UI components (React Native + react-native-web)
|   |-- types/      # Shared TypeScript types and interfaces
|   `-- config/     # Shared configurations (ESLint, Prettier, TypeScript)
|-- docs/
|-- package.json
`-- pnpm-workspace.yaml # Or similar workspace config
```

## 3. Logic to be Extracted and Shared

The following modules from the current Electron app (`src/`) will be extracted into shared packages.

| Source Path (`src/`)                        | Destination Package | Notes                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `types/`                                    | `packages/types`    | All TypeScript type definitions will be centralized here.                                                                                                                                              |
| `renderer/services/`                        | `packages/core`     | Core business logic for tasks, documents, projects, etc. Will be refactored to be platform-agnostic and communicate with abstracted data layers.                                                       |
| `renderer/hooks/`                           | `packages/core`     | Reusable React hooks that don't depend on Electron-specific APIs.                                                                                                                                      |
| `chat/`, `files/`, `projects/`, `tasks/`    | `packages/core`     | The underlying logic from these main-process modules will be extracted. Platform-specific parts (like Node.js file access) will be replaced by platform abstractions.                                  |
| `renderer/components/ui/`                   | `packages/ui`       | Generic UI components will be moved to the shared UI package.                                                                                                                                          |
| `renderer/components/tasks/`, `.../agents/` | `packages/ui`       | Domain-specific components will also be moved, potentially into sub-directories within `packages/ui`.                                                                                                  |
| `packages/factory-ts/`                      | (stays a package)   | This package contains agent orchestration logic. It's already well-structured. It will likely be consumed by a backend service that all clients communicate with, rather than directly by all clients. |

## 4. Platform-Specific Abstraction Layer

To handle platform differences (e.g., storage, APIs), `packages/core` will define interfaces that each application (`apps/*`) must implement. These implementations will be provided to the core logic via Dependency Injection.

**Example: Data Persistence**

1.  **Interface in `packages/core`:**
    ```typescript
    // packages/core/src/storage/IKeyValueStore.ts
    export interface IKeyValueStore {
      getItem(key: string): Promise<string | null>
      setItem(key: string, value: string): Promise<void>
      removeItem(key: string): Promise<void>
    }
    ```
2.  **Implementation in `apps/electron`:**
    Uses `electron-store` or Node.js `fs`.
3.  **Implementation in `apps/web`:**
    Uses `localStorage` or `IndexedDB`.
4.  **Implementation in `apps/mobile`:**
    Uses `AsyncStorage`.

This pattern will be applied to:

- File System Access
- Notifications
- Database/Storage (e.g., SQLite, WatermelonDB, IndexedDB)
- API clients (for backend communication)

## 5. Shared UI Components Strategy

We will use **React Native** as the primitive for building UI components in `packages/ui`.

- **Web & Electron (`apps/web`, `apps/electron`):** We will use `react-native-web` to compile React Native components to run in the browser. This allows us to write components once and share them across all platforms.
- **Mobile (`apps/mobile`):** The components will run natively via React Native.
- **Styling:** A consistent styling solution like `styled-components` (with its React Native variant) or a dedicated cross-platform styling library (e.g., part of Tamagui) will be used to ensure visual consistency.
- **Platform-specific extensions:** For components that need platform-specific variations, we will use file extensions like `MyComponent.native.tsx`, `MyComponent.web.tsx`, and `MyComponent.tsx` (for shared logic), allowing the bundler to pick the correct file for each platform.

## 6. Build and Packaging Strategy

- **Monorepo Tool:** `pnpm` (or Yarn) will manage workspaces, dependencies, and running scripts across the repo.
- **TypeScript:** We will use TypeScript project references (`tsconfig.json`'s `references` field) to ensure correct build order and type-checking across packages.
- **Bundling:**
  - Shared packages (`packages/*`) will be compiled with `tsc` or a modern bundler like `tsup` to produce standard JavaScript (ESM/CJS) and type definitions.
  - Applications (`apps/*`) will consume these packages directly via workspace linking. Each app will have its own bundler setup (Vite for Electron/Web, Metro for React Native).

## 7. Dependency Management

- **Hoisting:** The monorepo tool will hoist common dependencies to the root `node_modules` to reduce duplication and ensure version consistency.
- **Peer Dependencies:** Shared packages (`packages/ui`, `packages/core`) will declare `react` and `react-native` as `peerDependencies` to avoid version conflicts with the host application.
- **Single Version Policy:** We will enforce a single version for critical dependencies (React, TypeScript, etc.) across the entire monorepo using package manager features if available (like pnpm's `overrides`).

## 8. Backend and Data Sync

The current model runs everything locally within the Electron app. To support multiple clients, a backend service is required for:

- Centralized data storage (tasks, documents, user data).
- Real-time synchronization between clients.
- Authentication and Authorization.
- Running agent orchestrations (`factory-ts`) on behalf of clients.

An **offline-first** approach is critical. Clients will interact with a local database (e.g., WatermelonDB, PouchDB) which handles syncing with the remote backend. This ensures the applications remain functional offline. The architecture for this will be detailed in a separate document.
