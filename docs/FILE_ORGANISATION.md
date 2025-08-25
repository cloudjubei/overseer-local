# File Organisation

This document describes how files and directories are organised in this repository to keep the project navigable, consistent, and easy to evolve.

## Top-Level Directory Layout
- docs/: Project documentation and specifications.
  - docs/tasks/: Canonical task schema and examples.
- tasks/: Per-task workspaces containing task metadata and tests.
  - tasks/{id}/task.json: Canonical task definition for a single task.
  - tasks/{id}/tests/: Deterministic tests validating each feature in the task.
- .env, and other setup files may exist as needed.

Notes:
- All changes should be localized to the smallest reasonable scope (task- or doc-specific) to reduce coupling.
- Documentation in docs/ is the single source of truth for specs and formats.

## File Naming Conventions
- Tasks and features:
  - Task directories are numeric IDs: tasks/{id}/ (e.g., tasks/1/).
  - Tests are named per-feature: tasks/{task_id}/tests/test_{task_id}_{feature_number}.py (e.g., tasks/15/tests/test_15_3.py).
- Python modules: snake_case.py (e.g., task_format.py, run_local_agent.py).
- Javascript modules: camelCase.js (e.g., taskFormat.js, runLocalAgent.js).
- Documentation files: UPPERCASE or Title_Case for project-wide specs (e.g., TESTING.md, FILE_ORGANISATION.md). Place task-related docs under docs/tasks/.
- JSON examples/templates: Use .json with clear, descriptive names (e.g., task_example.json).

## Evolution Guidance
- Make minimal, incremental changes that are easy to review and test.
- Keep documentation authoritative: update docs first when changing schemas or protocols.
- Introduce shared utilities only when multiple tasks need them; otherwise keep helpers local to a task.
- Deprecate gradually: create new files/specs alongside old ones, migrate, then remove deprecated artifacts when tests prove stability.
- Each feature must have deterministic tests; do not mark features complete until tests pass.

## Example Tree (illustrative)
The following tree is graphical and illustrative of a typical repository layout:

```
repo_root/
├─ .env
├─ .gitignore
├─ LICENSE
├─ docs/
│  ├─ FILE_ORGANISATION.md
└─ tasks/
   ├─ 1/
   │  ├─ task.json
   │  └─ tests/
   │     └─ test_1_3.py
   └─ 2/
      ├─ task.json
      └─ tests/
```

This diagram shows how documentation, scripts, and per-task artifacts are arranged, including where tests for each feature live and where child project submodules reside under projects/.
