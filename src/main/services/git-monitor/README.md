# Git Monitor Service

This service watches Git repositories for new commits and branch head changes to keep the app in sync with active tasks and features.

## Branch naming helper

This folder contains `branchNaming.js`, a small utility that defines the task-to-branch naming convention used by the monitor:

- Convention: `features/<taskId>`
- Exposed helpers:
  - `toBranchName(taskId)` -> `features/<taskId>`
  - `isFeatureBranch(branchName)` -> boolean
  - `parseTaskIdFromBranch(branchName)` -> `<taskId> | null`

Use these helpers anywhere you need to map between tasks and their corresponding Git branches.
