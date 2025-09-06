# Git-Based Project Storage Conventions

## 1. Introduction

This document specifies the canonical data model and layout for projects stored within a Git repository. The goal is to create a single source of truth for project data that can be accessed and manipulated by various clients—such as the desktop application and a backend service—in a consistent manner, whether online or offline.

All project metadata (tasks, features, etc.) is stored in version-controlled files, while the project's source code resides naturally within the same repository. This approach ensures that the entire project context is portable, versioned, and resilient.

## 2. Repository Structure

A project repository follows a standardized directory layout to separate application code from project management metadata.

```
/
├── .project-manifest.json   # Core project definition and metadata.
├── tasks/                   # Contains all task definitions.
│   ├── {task-id-1}.json
│   └── {task-id-2}.json
├── features/                # Contains all feature definitions.
│   ├── {feature-id-1}.json
│   └── {feature-id-2}.json
├── runs/                    # Logs and artifacts from agent runs.
│   └── {run-id}/
│       ├── run.json         # Metadata for the run.
│       ├── log.txt          # Agent's standard output/log.
│       └── artifacts/       # Directory for any files produced by the agent.
├── src/                     # Project source code (example directory).
└── ...                    # Other project files and directories.
```

## 3. Data Models & Schemas

All metadata files are in JSON format for universal compatibility and ease of parsing.

### 3.1. Project Manifest (`.project-manifest.json`)

This file is the entry point for a project. It defines the project's identity and core properties.

**Schema:**
```json
{
  "schema_version": "1.0",
  "id": "uuid",
  "name": "string",
  "description": "string"
}
```

**Example:**
```json
{
  "schema_version": "1.0",
  "id": "prj-c4a7f3d5-a8e5-4e7b-b4f1-3e2c6a9d8b7c",
  "name": "My Awesome Project",
  "description": "A project to demonstrate the git-based storage convention."
}
```

### 3.2. Task (`tasks/{task-id}.json`)

Tasks represent high-level goals or work items. Each task is stored in its own file, named with its unique ID.

**Schema:**
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "'todo' | 'in_progress' | 'done' | 'rejected'",
  "features": [
    "feature-id-1",
    "feature-id-2"
  ]
}
```

**Example:**
```json
{
  "id": "tsk-f9b3e1a2-c7d6-4a5b-8e1d-9f0c3a8b4e5d",
  "title": "Implement User Authentication",
  "description": "Set up the complete authentication flow, including sign-up, login, and logout.",
  "status": "in_progress",
  "features": [
    "feat-a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
  ]
}
```

### 3.3. Feature (`features/{feature-id}.json`)

Features are concrete, implementable units of work that belong to a single task.

**Schema:**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "title": "string",
  "description": "string",
  "status": "'todo' | 'in_progress' | 'review' | 'done' | 'rejected'",
  "rejection_reason": "string | null"
}
```

**Example:**
```json
{
  "id": "feat-a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "task_id": "tsk-f9b3e1a2-c7d6-4a5b-8e1d-9f0c3a8b4e5d",
  "title": "Create Login API Endpoint",
  "description": "Develop a REST API endpoint for user login with email and password.",
  "status": "todo",
  "rejection_reason": null
}
```

### 3.4. Agent Run (`runs/{run-id}/run.json`)

This directory captures the complete context of an agent's execution for a given feature.

**Schema for `run.json`:**
```json
{
  "id": "uuid",
  "feature_id": "uuid",
  "agent_id": "string",
  "timestamp_start": "iso8601-string",
  "timestamp_end": "iso8601-string | null",
  "status": "'running' | 'completed' | 'failed'",
  "commit_hash_before": "string",
  "commit_hash_after": "string | null",
  "branch": "string"
}
```

## 4. Handling Large Files (Big Blobs)

Large binary assets (e.g., images, datasets, compiled artifacts) should not be committed directly to the Git repository. Instead, they are stored externally, and the repository contains lightweight "pointer files."

[Git LFS (Large File Storage)](https://git-lfs.github.com/) is the recommended tool for this purpose. When Git LFS is not feasible, a manual pointer file convention can be used.

**Pointer File Convention (`{original-filename}.ptr.json`):**

A pointer file is a JSON file that references a file in an external blob store (like AWS S3, Google Cloud Storage, etc.).

**Schema:**
```json
{
  "schema_version": "1.0",
  "type": "blob-pointer",
  "storage_provider": "string", // e.g., "s3", "gcs"
  "uri": "string",             // The full URI to access the blob
  "size_bytes": "number",
  "sha256": "string"           // SHA256 hash of the file content
}
```

**Example (`assets/logo.png.ptr.json`):**
```json
{
  "schema_version": "1.0",
  "type": "blob-pointer",
  "storage_provider": "s3",
  "uri": "s3://my-project-assets/images/logo.png",
  "size_bytes": 152048,
  "sha256": "c137a5651f524e41f2394639918c5e665123d4c06e8c8959c9b3f3a8b7e2b8d4"
}
```

## 5. Git Conventions

To ensure traceability and prevent conflicts, all automated changes made by agents must follow strict Git conventions.

### 5.1. Branching Strategy

- **`main` / `master`**: This is the primary stable branch. It should always be in a deployable state. Direct commits are discouraged.
- **`feature/{feature-id}`**: All work on a feature is done in a dedicated branch named after the feature's ID. This isolates work, simplifies code reviews, and allows for parallel development. An agent starts its work by creating a branch with this naming scheme from an up-to-date `main` branch.

### 5.2. Commit Messages

Automated commits made by agents must be deterministic and information-rich. They should follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

**Format:**
```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**Recommended Structure for Agent Commits:**

```
feat(agent): Implement user login API

This commit introduces the /api/login endpoint and integrates the
authentication service.

Agent: agent-dev-007
Feature-ID: feat-a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d
Run-ID: run-b9e8c7d6-f5a4-3b2c-1d0e-9f8a7b6c5d4e
```

- **Type**: `feat` for new features, `fix` for bug fixes, `chore` for maintenance.
- **Scope**: `agent` is a good default for automated changes.
- **Footer Metadata**: Includes machine-readable identifiers to link the commit back to the project management data.
