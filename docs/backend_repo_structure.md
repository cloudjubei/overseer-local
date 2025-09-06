# Backend Repository Structure

This document outlines the proposed repository structure for the new backend service. The backend will be built with Node.js and Express.js.

## High-Level Overview

The structure is designed to be modular and scalable, separating concerns and making it easy to add new features.

```
/
├── config/             # Environment-based configuration
├── dist/               # Compiled TypeScript output (if using TS)
├── docs/               # Project documentation
├── node_modules/       # Node.js dependencies
├── src/                # Source code
│   ├── api/            # API routes and controllers
│   │   ├── auth/       # Authentication routes (login, logout, register)
│   │   ├── projects/   # Project management routes (git operations)
│   │   ├── tasks/      # Task/feature management routes (file I/O)
│   │   ├── runs/       # Agent run management routes
│   │   └── index.js    # API router aggregation
│   ├── core/           # Core application logic and services
│   │   ├── auth/       # Authentication services (JWT, passport)
│   │   ├── git/        # Git client service wrapper
│   │   ├── runner/     # Client for the agent runner service
│   │   └── storage/    # File storage and I/O services
│   ├── gateways/       # Real-time communication (WebSockets)
│   │   └── event.gateway.js # WebSocket gateway for streaming events
│   ├── jobs/           # Background jobs (e.g., project cloning)
│   ├── middleware/     # Express middleware (auth, logging, error handling)
│   ├── models/         # Data models (if using an ORM/ODM)
│   ├── utils/          # Utility functions and helpers
│   ├── app.js          # Express application setup
│   └── server.js       # Server entry point
├── scripts/            # Automation and utility scripts
├── test/               # Automated tests (unit, integration)
│   ├── api/            # Tests for API endpoints
│   └── services/       # Tests for core services
├── .env.example        # Example environment variables
├── .eslintrc.js        # ESLint configuration
├── .gitignore          # Git ignore file
├── jest.config.js      # Jest test runner configuration
├── package.json        # Project manifest and dependencies
└── README.md           # Project README
```

## Module Breakdown

### `src/api`
-   **Purpose:** Defines the public REST API endpoints. Each subdirectory corresponds to a resource (e.g., `projects`, `tasks`).
-   **Contains:** Express routers and controller functions that handle incoming HTTP requests, validate input, and call the appropriate services from `src/core`.

### `src/core`
-   **Purpose:** Contains the core business logic of the application.
-   **`auth/`**: Handles user authentication, token generation, and verification.
-   **`git/`**: A wrapper around a git client library (e.g., `isomorphic-git` or `simple-git`) to manage project repositories.
-   **`runner/`**: A client to communicate with the separate agent runner micro-service. This might be a gRPC or REST client.
-   **`storage/`**: Abstracts file system operations for tasks and features.

### `src/gateways`
-   **Purpose:** Manages real-time communication with clients using WebSockets.
-   **`event.gateway.js`**: A single gateway to stream events related to agent runs, project updates, etc., to connected clients. It will use a library like `socket.io` or `ws`.

### `src/middleware`
-   **Purpose:** Custom Express middleware for tasks like request logging, authentication checks, error handling, etc.

### `config`
-   **Purpose:** Manages application configuration for different environments (development, staging, production). Libraries like `dotenv` and `convict` could be used.

### `test`
-   **Purpose:** Contains all automated tests. The structure mirrors the `src/` directory.
-   **Technology:** Jest will be used as the test runner, with `supertest` for API endpoint testing.

### Logging
-   A robust logging library like `winston` or `pino` will be integrated for structured, level-based logging. A logging utility will be placed in `src/utils`.

## Shared Library
- If significant code needs to be shared between this backend and the Electron client (e.g., data models, validation schemas), it should be extracted into a separate private NPM package and consumed by both projects.
