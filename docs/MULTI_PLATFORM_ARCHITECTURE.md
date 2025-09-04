# Multi-Platform Architecture Plan

This document outlines the architectural plan for evolving the application into a multi-platform solution supporting the existing Electron app, a new React web app, and a new React Native mobile app. The core goal is to maximize code sharing, ensure a consistent user experience, and enable robust offline-first capabilities.

## 1. High-Level Architecture

The new architecture will shift from a local-only Electron application to a client-server model with strong offline support.

```
+----------------+      +----------------+      +---------------------+
| Electron App   |      | React Web App  |      | React Native Mobile |
| (Existing)     |      | (New)          |      | (New)               |
+-------+--------+      +-------+--------+      +----------+----------+
        |                       |                          |
        | (Local DB & Sync)     | (Local DB & Sync)        | (Local DB & Sync)
        +-----------------------+--------------------------+
                                |
                                | HTTP/GraphQL & WebSockets
                                |
                      +---------v---------+
                      |   Backend Service   |
                      |   (Node.js/TS)    |
                      +---------+---------+
                                |
                      +---------v---------+
                      |     Database      |
                      |   (PostgreSQL)    |
                      +-------------------+
```

- **Clients**: Three primary clients will be supported. They will share a common core logic but handle platform-specific UI and capabilities.
- **Backend Service**: A new, centralized backend service will manage data, authentication, and business logic that cannot reside on the client. It will expose a unified API for all clients.
- **API Layer**: A GraphQL API will be used for flexible data fetching, tailored to the needs of different clients. WebSockets will be used for real-time data synchronization.
- **Database**: PostgreSQL will serve as the primary database for its robustness and rich feature set.
- **Authentication**: A centralized authentication system (e.g., JWT-based) will manage user identity across all platforms.

---

## 2. Shared Logic Organization and Extraction Strategy

A monorepo architecture is proposed to manage the codebase for all clients and shared packages efficiently.

### Monorepo Structure

We will use a tool like **Nx** or **Turborepo** to manage dependencies and build processes. The `packages/` directory will be expanded to house shared libraries.

```
/
├── apps/
│   ├── electron-app/
│   ├── web-app/
│   ├── mobile-app/
├── packages/
│   ├── core/           # Shared business logic, types, services
│   ├── ui/             # Shared React components (web & native)
│   ├── api-client/     # Generated GraphQL client
│   └── ...
└── ...
```

### Shared Packages

- **`@acme/core`**: This package will contain all platform-agnostic logic:
    - TypeScript types and interfaces for all data models.
    - Business logic and services (e.g., task management, project logic).
    - Validation schemas.
- **`@acme/ui`**: A shared component library built with React and React Native.
    - We will use a strategy like React Native Web or platform-specific file extensions (`*.web.tsx`, `*.native.tsx`) to maximize code reuse.
    - Storybook will be used for isolated component development and documentation.
- **`@acme/api-client`**: An auto-generated client for our GraphQL API, providing type-safe ways to interact with the backend.

### Extraction Strategy

1.  **Identify**: Systematically identify pure business logic and UI components within the existing Electron app's renderer process.
2.  **Abstract**: Move identified logic into the new shared packages (`@acme/core`, `@acme/ui`). Ensure this code has no direct dependency on Electron or Node.js APIs.
3.  **Refactor**: Update the Electron app to consume the logic from the new shared packages, removing the old implementation. This will be an incremental process.

---

## 3. Offline-First Sync Strategy

The application must be highly functional in offline mode. This will be achieved through a local database and a robust synchronization engine on each client.

### Core Concepts

- **Local Database**: Each client will have its own local database.
    - **Web**: IndexedDB
    - **Mobile**: SQLite
    - **Electron**: SQLite or the existing file-based system initially.
- **Abstraction Layer**: A library like **WatermelonDB** or **RxDB** will be used. These libraries provide a reactive data layer that abstracts over the underlying database and comes with built-in sync protocols.
- **Sync Engine**: The engine will run in the background, observing changes in the local database and synchronizing them with the backend.
    - **Push**: Local changes are queued and sent to the backend as mutations.
    - **Pull**: The client subscribes to backend changes (via WebSockets or periodic polling) and applies them to the local database.
- **Conflict Resolution**: We will favor a CRDT (Conflict-free Replicated Data Type) based approach where possible to automatically handle merge conflicts from concurrent edits. For more complex conflicts, a "last-write-wins" policy or user-driven resolution might be implemented.

### Data Flow

1.  User action triggers a change.
2.  Data is written immediately to the local database.
3.  The UI updates optimistically based on the local data.
4.  The sync engine detects the change and pushes it to the backend API.
5.  The backend processes, validates, and persists the change, then broadcasts it to other connected clients for the same user.
6.  Other clients receive the update and apply it to their local database, triggering a UI refresh.

---

## 4. Client-Specific Adaptation Plans

- **Electron App**:
    - The primary focus will be on refactoring the renderer process to use the shared `@acme/core` and `@acme/ui` packages.
    - The main process logic will be reviewed to determine what should be moved to the backend versus what is inherently desktop-specific (e.g., deep OS integrations, file system access).
    - It will be the first client to integrate the new sync engine, serving as a pilot for the architecture.

- **React Web App**:
    - A new single-page application (SPA) built with React.
    - It will be composed primarily from the shared packages.
    - Will require its own routing, build configuration, and deployment pipeline.

- **React Native Mobile App**:
    - A new application for iOS and Android.
    - Will reuse `@acme/core` and `@acme/api-client` directly.
    - The `@acme/ui` package will provide the foundation for the UI, with platform-specific adjustments and components created as needed.

---

## 5. Migration Roadmap

The migration will be phased to minimize risk and deliver value incrementally.

- **Phase 1: Foundation (Current Quarter)**
    - [ ] Set up the monorepo with Turborepo.
    - [ ] Develop the v1 backend service with user authentication and core data models (e.g., projects, tasks).
    - [ ] Create the `@acme/core` package and begin migrating shared types and services.
    - [ ] Define the GraphQL schema and set up `@acme/api-client`.

- **Phase 2: Electron App Integration (Next Quarter)**
    - [ ] Integrate the sync engine into the Electron app.
    - [ ] Refactor the app to use the backend as its source of truth, mediated by the local database.
    - [ ] Deprecate the old local storage mechanism in favor of the new sync-based persistence.

- **Phase 3: Web App Launch (Following Quarter)**
    - [ ] Develop the React web application, reusing all shared packages.
    - [ ] Achieve feature-parity for core functionalities.
    - [ ] Set up hosting and a CI/CD pipeline for the web app.

- **Phase 4: Mobile App Launch (TBD)**
    - [ ] Develop the React Native mobile application.
    - [ ] Extend the `@acme/ui` package for mobile-specific needs.
    - [ ] Publish to App Store and Google Play.

---

## 6. Technology Stack Decisions

- **Monorepo**: **Turborepo** (for its speed and simplicity).
- **Backend**: **Node.js** with **NestJS** (for a structured, scalable architecture) and **TypeScript**.
- **API**: **GraphQL** with **Apollo Server/Client**.
- **Database**: **PostgreSQL**.
- **Authentication**: **JWT** with **Passport.js**.
- **Offline Sync**: **WatermelonDB** (for its focus on performance with large datasets and React/React Native integration).
- **Shared UI**: **React / React Native** with **Storybook**. **Styled Components** or **Tamagui** for styling.

---

## 7. Data Flow and State Management

- **Source of Truth**: The local, offline database (managed by WatermelonDB) will be the single source of truth for all domain data within the clients.
- **UI Subscriptions**: React components will subscribe directly to queries on the local database. The UI will re-render automatically when data changes, whether from a user action or a background sync.
- **Client UI State**: For non-persistent UI state (e.g., form state, modal visibility), a lightweight state manager like **Zustand** or **Jotai** will be used.
- **Separation of Concerns**: This approach creates a clean separation:
    - **Domain Data**: Handled by the reactive database layer.
    - **Remote State**: Managed implicitly by the sync engine.
    - **Local UI State**: Managed by a minimal state manager.

---

## 8. Development Workflow

- **Centralized Scripts**: The monorepo root `package.json` will contain scripts to build, test, and lint the entire project or individual apps/packages.
- **CI/CD**: GitHub Actions will be configured to:
    - Run linting and unit tests on every pull request.
    - Run integration tests against a test backend.
    - Deploy the backend and client applications on merge to the main branch.
- **Component Development**: `@acme/ui` components will be developed in isolation using Storybook, with visual regression testing to prevent unintended changes.
- **Type Safety**: End-to-end type safety will be a priority, from the database schema to the API layer (via GraphQL Code Generator) to the UI components.
