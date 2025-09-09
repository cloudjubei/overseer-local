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

## Commit Analyzer

`CommitAnalyzer.js` can inspect a specific commit SHA or ref to locate `tasks/<taskId>/task.json` without checking out the branch. It uses `git ls-tree` and `git show` to:

- List candidate task.json files within the commit tree.
- Read and parse each `task.json`.
- Return a structured result that includes the raw file, parsed task object, and a compact summary (task id, status, features list with statuses).

Example (main process):

```js
import { CommitAnalyzer } from './CommitAnalyzer';

const analyzer = new CommitAnalyzer({ repoPath: '/path/to/repo' });
const report = await analyzer.analyze('features/1234'); // or a commit SHA
if (report.found) {
  for (const f of report.files) {
    if (f.parseOk) {
      console.log('Task summary:', f.summary);
    }
  }
}
```

## Task State Updater

`TaskStateUpdater.js` provides `updateLocalTaskFromCommit({ projectRoot, commitTask })` to synchronize the local `tasks/<taskId>/task.json` with data extracted from a commit's `task.json`.

Behavior:
- Updates only existing tasks and features (no implicit creation).
- Focuses on syncing statuses and key metadata (title, description, context, acceptance, blockers, rejection).
- Preserves local unknown fields.
- Respects local display order using `featureIdToDisplayIndex`.
- Validates the merged task using `TasksValidator` before writing.

Intended usage with CommitAnalyzer results:

```js
import { CommitAnalyzer } from './CommitAnalyzer';
import { updateLocalTaskFromCommit } from './TaskStateUpdater';

const analyzer = new CommitAnalyzer({ repoPath: projectRoot });
const report = await analyzer.analyze('features/<taskId>');
for (const file of report.files) {
  if (file.parseOk && file.task?.id) {
    await updateLocalTaskFromCommit({ projectRoot, commitTask: file.task });
  }
}
```
