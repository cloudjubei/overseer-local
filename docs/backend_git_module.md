# Backend Git Module Specification

## 1. Overview

This document specifies the design for a backend module responsible for all git operations. This module will act as a safe wrapper around git, providing a clear interface for other backend services to interact with project repositories. It will manage local caches of git repositories, handle concurrency, and define strategies for branching, committing, and conflict resolution.

## 2. Disk Layout and Caching

To manage repositories efficiently and support concurrent operations, a specific disk layout will be used.

-   **Base Cache Directory**: A configurable base directory on the backend server (e.g., `/var/app/repo-cache/`).
-   **Repository Cache Structure**: Each repository will be cloned into a subdirectory named after a unique project identifier.
    -   `/<base_cache_dir>/<project_id>/repo.git`: A bare clone of the remote repository. This serves as the local mirror and is updated from the remote. All reads and branch creations happen from here.
    -   `/<base_cache_dir>/<project_id>/worktrees/<operation_id>/`: Short-lived worktrees created from `repo.git` for specific mutating operations (e.g., applying changes for a feature). Using worktrees allows for parallel operations on different branches without cloning the whole repository multiple times.
-   **Locking**: To prevent race conditions during git operations on the same project's bare repository.
    -   A lock file (e.g., `.lock`) will be used within each project's cache directory (`/<base_cache_dir>/<project_id>/.lock`).
    -   Operations modifying the bare repo (like `fetch` or preparing a worktree) must acquire an exclusive lock.
    -   The locking mechanism must have timeouts to prevent deadlocks and should be managed by a library like `proper-lockfile`.

## 3. Core Operations and Interfaces

The module will expose a `GitService` with the following methods. All methods are asynchronous and should be idempotent where possible.

### 3.1. Repository Management

-   `initializeRepository(projectId: string, remoteUrl: string): Promise<void>`
    -   Clones the repository from `remoteUrl` into the cache as a bare repository if it doesn't exist.
    -   Performs an initial fetch of all branches and tags.
-   `syncRepository(projectId: string): Promise<void>`
    -   Fetches updates from the remote repository for all branches (`git fetch --all`).
    -   Prunes remote branches that no longer exist.
    -   This should be called periodically by a background job and before any operation that needs the latest state.

### 3.2. Branching Strategy

-   **Main Branch**: A designated main branch (e.g., `main`) representing the stable state. Direct modifications by agents are disallowed.
-   **Feature Branches**: All automated work will be on feature branches.
    -   **Naming Convention**: `agent/<feature_id>/<short-description>`
-   `createFeatureBranch(projectId: string, featureId: string, baseBranch: string = 'main'): Promise<string>`
    -   Creates a new branch for a feature from the latest version of the `baseBranch` in the local cache.
    -   Returns the name of the new branch.

### 3.3. File Operations

-   `getFilesInBranch(projectId: string, branchName: string, path: string = '.'): Promise<string[]>`
    -   Lists files and directories in a given path on a specific branch.
-   `readFileInBranch(projectId: string, branchName: string, filePath: string): Promise<string | null>`
    -   Reads the content of a file from a specific branch. Returns `null` if the file doesn't exist.
-   `applyChanges(projectId: string, branchName: string, changes: FileChange[], commitMessage: string): Promise<CommitInfo>`
    -   **FileChange**: Interface `{ filePath: string, content: string | null }` (`null` content means deletion).
    -   **CommitInfo**: Interface `{ commitHash: string, branchName: string, remotePushed: boolean }`.
    -   **Logic**:
        1.  Acquire lock for the project repository.
        2.  Create a temporary worktree for the operation from `branchName`.
        3.  Apply file changes (create, update, delete) within the worktree.
        4.  Commit the changes with the provided message.
        5.  Push the branch to the remote origin.
        6.  Clean up the worktree.
        7.  Release the lock.
    -   Returns information about the commit.

### 3.4. Merging and Conflict Resolution

-   `mergeBranch(projectId: string, sourceBranch: string, targetBranch: string): Promise<MergeResult>`
    -   **MergeResult**: Interface `{ success: boolean, conflict: boolean, commitHash?: string }`
    -   Attempts to merge `sourceBranch` into `targetBranch`.
-   **Conflict Resolution Policy**:
    -   **Automated**: The system will use a standard merge strategy (e.g., `ort`). If the merge is clean, it will be pushed.
    -   **On Conflict**: If a merge conflict occurs, the operation will fail (`conflict: true`). The system **will not** attempt to automatically resolve content conflicts. The conflict must be flagged for human intervention.

## 4. Background Synchronization

-   A background job will periodically call `syncRepository` for all active projects to keep the local caches up-to-date.
-   The sync interval should be configurable (e.g., every 5 minutes).
-   This minimizes latency for user-initiated operations.

## 5. Error Handling, Retries, and Timeouts

-   **Retry Policy**: Network-related operations (`clone`, `fetch`, `push`) should implement an exponential backoff retry mechanism for transient errors (e.g., up to 3 retries with 1s, 2s, 4s delays).
-   **Timeouts**: All external git operations must have a configurable timeout (e.g., 5 minutes for `clone`, 1 minute for `push`) to prevent indefinite hangs.
-   **Error Types**: The service should throw distinct error types for different failure modes (e.g., `RepoNotFound`, `BranchNotFound`, `MergeConflict`, `NetworkError`).

## 6. Security Considerations

-   **Credentials**: Git credentials (SSH keys or tokens) must be managed securely, e.g., via a secrets management service like HashiCorp Vault or AWS Secrets Manager.
-   **Command Injection**: All git operations must be executed through a safe library (e.g., `isomorphic-git`, `nodegit`) instead of constructing raw shell commands to prevent command injection vulnerabilities.
-   **Path Traversal**: Input parameters like `projectId`, `branchName`, and `filePath` must be strictly validated and sanitized to prevent path traversal attacks on the file system.