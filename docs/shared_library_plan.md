# Shared Library Plan

This document outlines the plan for a shared library to be used by the backend and frontend clients. The purpose of this library is to ensure consistency, reduce code duplication, and provide a single source of truth for data structures and protocols.

## 1. Library Contents

The shared library will be an npm package containing the following:

### 1.1. TypeScript API Models

- **Source**: Automatically generated from an OpenAPI 3.0 specification file (`openapi.yaml`) which will be maintained in the shared library's repository.
- **Generation**: We will use a tool like `openapi-typescript` to convert the OpenAPI spec into TypeScript interfaces.
- **Purpose**: To provide strongly-typed interfaces for all API requests and responses, enabling type safety and autocompletion in both the backend and frontend.

### 1.2. JSON Schemas

- **Purpose**: To define the structure of data files stored within the project's git repository, such as `project.json` or `task.json`.
- **Usage**: These schemas will be used for validation on the client-side (before committing) and server-side (when processing data). This ensures data integrity.
- **Location**: They will be stored as `.schema.json` files within the library.

### 1.3. Common Utilities

- **Purpose**: A set of common functions needed by both client and server to handle project data consistently.
- **Examples**:
    - `contentHashing`: A function to generate a consistent hash of file contents (e.g., using SHA-256).
    - `commitMetadata`: Helper functions to embed and parse metadata within Git commit messages, which can be used for agent communication or tracking.
    - Other shared logic as identified during development.

## 2. Repository and Package Structure

The library will live in its own dedicated Git repository. It will be set up as a standard TypeScript project and published as an npm package.

### Proposed Directory Structure:

```
project-shared/
├── .github/
│   └── workflows/
│       └── publish.yml       # CI/CD for publishing to registry
├── openapi/
│   └── spec.yaml             # Single source of truth for the API
├── src/
│   ├── schemas/
│   │   ├── project.schema.json
│   │   └── task.schema.json
│   ├── types/
│   │   └── api.ts              # Generated from openapi/spec.yaml
│   ├── utils/
│   │   ├── hashing.ts
│   │   └── commit.ts
│   └── index.ts                # Main export file for the package
├── package.json
├── tsconfig.json
└── README.md
```

## 3. Publishing and Versioning

### 3.1. Publishing Strategy

We recommend publishing the library as a private package to **GitHub Packages**.

- **Rationale**:
    - It integrates well with GitHub repositories.
    - It's free for private repositories within an organization.
    - It provides a robust, standard way to manage package dependencies compared to using Git tags, which can be less reliable for dependency management.

A CI/CD workflow (`.github/workflows/publish.yml`) will be set up to automatically publish a new version to GitHub Packages whenever a new tag is pushed to the `main` branch.

### 3.2. Versioning

The package will follow **Semantic Versioning (SemVer)**.

- **MAJOR** version change for incompatible API changes (e.g., breaking changes in API models or JSON schemas).
- **MINOR** version change for adding functionality in a backward-compatible manner (e.g., adding a new utility or an optional API field).
- **PATCH** version change for backward-compatible bug fixes.

## 4. Integration Plan

### 4.1. Backend Integration

1.  Add the shared package as a dependency in the backend's `package.json`.
2.  Import types from `@<scope>/project-shared` for request handlers, response objects, and service layers.
3.  Use JSON schemas to validate incoming data and data read from repositories.
4.  Use utility functions for consistent operations like hashing.

### 4.2. Frontend (Client) Integration

1.  Add the shared package as a dependency in the client's `package.json`.
2.  Import types for the API client/service layer to ensure calls to the backend are type-safe.
3.  Use JSON schemas for client-side validation of project files before they are saved or committed.
4.  Use utility functions where needed.

## 5. Development Workflow

1.  **Change Required**: A developer identifies a need for a change in a shared component (e.g., a new API endpoint).
2.  **Update Spec**: The `openapi/spec.yaml` in the shared library repository is updated first.
3.  **Generate Types**: The developer runs a script (e.g., `npm run generate:types`) to update the TypeScript interfaces in `src/types/`.
4.  **Implement Changes**: Any other necessary changes (schemas, utils) are made.
5.  **Pull Request**: A PR is created, reviewed, and merged into the `main` branch of the shared library repository.
6.  **Publish**: A new version number is determined based on SemVer, a Git tag is created, and the new version is published to GitHub Packages (this can be automated).
7.  **Update Consumers**: The backend and frontend projects are updated to use the new version of the shared package.
