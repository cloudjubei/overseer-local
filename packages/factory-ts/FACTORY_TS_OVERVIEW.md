# Factory TS Overview

This document provides an overview of the factory-ts TypeScript library that powers agent orchestration for Overseer (Electron, React + Vite). It covers the architecture, public API, event model, and integration patterns used by Overseer and the Node CLI bridge.

Goals:
- Launch agents on a specific project/task/feature with an LLM configuration and budget.
- Stream progress, usage (tokens, cost, speed), and errors via a typed event model.
- Propose file changes safely (no destructive writes until accepted), compute diffs, and commit on acceptance (git service).
- Persist rich run history and export/import archives for sharing and review.

## High-level Architecture

The library is organized into modules under packages/factory-ts/src:

- events/: Typed event system used by runs, with a lightweight event emitter.
  - types.ts: IPC-serializable payload types and EventBus/RunHandle interfaces.
  - runtime.ts: A default event emitter and RunHandle implementation.
- adapters/
  - electronShim.ts: IPC-agnostic tools to bridge events to/from Electron (or any message bus), Observables, and JSONL.
- files/
  - fileChangeManager.ts: Validates proposed file changes, computes diffs, and tracks proposal state in-memory.
  - sandboxOverlay.ts: Sandboxed filesystem overlay for staging writes before user acceptance.
- git/
  - gitService.ts: Feature-branch creation, apply proposals, commit/revert changes; emits git events and optionally records SHAs.
- db/
  - store.ts: HistoryStore persistence with SQLite for runs, steps, errors, usage, and commit metadata.
- artifacts/
  - recorder.ts: Subscribes to a RunHandle and records its lifecycle, proposals, diffs, usage, and metadata.
  - exporter.ts: Exports a redacted JSON archive (v1) with optional file snapshots and size limits.
  - importer.ts: Validates and imports an archive, with optional event replay.
- errors/
  - types.ts: FactoryError, error codes, classification utilities, and safe serialization.
  - redact.ts: Redaction helpers for messages and objects.

The orchestrator composes these pieces to run an agent, stage file changes safely, and surface an event stream for UI or CLI consumption.

## Core Concepts

- Project: A managed repository described by projects/<id>.json, with tasks under that project's folder (tasks/).
- Task: A unit of work defined by tasks/{id}/task.json. May contain multiple features.
- Feature: A focused sub-task under a task (e.g., 7.2).
- Run: A single execution of an agent on a task or feature.
- Proposal: The agent's proposed file changes (writes, deletions, renames, moves) staged in a sandbox overlay.
- Diff: Unified diffs for a proposal—used for human review inside Overseer.

## Public API (library surface)

Note: The names below describe the intended public surface exported from src/index.ts. Minor naming differences may exist; prefer the barrel exports from the package.

- events
  - types: RunEvent, RunHandle, EventBus types
  - runtime: createEventBus(), DefaultRunHandle
- adapters
  - electronShim: bridgeToSender(run, channel, sendFn), toObservable(run), toEventSourceLike(run), streamJSONL(run)
- files
  - fileChangeManager: createFileChangeManager()
  - sandboxOverlay: createSandboxOverlay()
- git
  - gitService: createGitService({ repoPath, branchPrefix? })
- db
  - store: createHistoryStore({ dbPath })
- artifacts
  - recorder: createRecorder(runHandle)
  - exporter: exportRun(runId, options)
  - importer: importRun(filePath)
- errors
  - FactoryError, fromUnknown, classifyError, redact

- Orchestrator (typical facade used by Overseer and CLI; exposed from index.ts)
  - createOrchestrator({ projectRoot, projectId?, db?, git?, files?, adapters? })
  - orchestrator.startRun({ taskId, featureId?, llmConfig, budget?, metadata? }): RunHandle
  - orchestrator.reviewService: acceptAll, acceptFiles, rejectAll, rejectFiles, finalize (applies via gitService)
  - orchestrator.cancel(runId)

Example of starting a run:

```ts
import { createOrchestrator } from 'factory-ts';

const orchestrator = await createOrchestrator({
  projectRoot: '/path/to/project',
  projectId: 'my-project',
  db: { dbPath: './factory.history.sqlite' },
});

const run = orchestrator.startRun({
  taskId: 7,
  featureId: '7.2',
  llmConfig: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    temperature: 0.2,
  },
  budget: { usd: 10 },
});

run.onEvent((e) => console.log('event', e.type));
```

## Event Model

All events are plain JSON (IPC-serializable). A RunEvent has at minimum:
- type: string (namespaced, e.g., 'run/start')
- ts: ISO timestamp
- runId: string
- payload: object (shape depends on type)

Common event types:
- run/start: { taskId, featureId?, projectId?, metadata? }
- run/progress: { message, step, total? }
- run/log: { level: 'debug'|'info'|'warn'|'error', message, context? }
- run/usage: { provider, model, promptTokens, completionTokens, costUsd, elapsedMs }
- run/budget-exceeded: { limitUsd, costUsd }
- run/error: { code, message, stack?, cause? }
- run/cancelled: {}
- run/complete: { summary?, stats? }
- file/proposal: { proposalId, summary: { added, modified, deleted, moved } }
- file/diff: { proposalId, files: Array<{ path, diff, hunks }>, summary }
- file/proposal-state: { proposalId, state: 'pending'|'accepted'|'rejected'|'partial', acceptedFiles?, rejectedFiles? }
- git/commit: { proposalId, branch, commitSha, title, filesChanged }

These types are defined in events/types.ts and used consistently by the Electron adapter and CLI.

## Filesystem Safety and Review

- sandboxOverlay stages all writes in an overlay; the real workspace is unchanged until acceptance.
- fileChangeManager holds the current proposal, validates paths, and computes diffs.
- reviewService applies decisions:
  - acceptAll(proposalId)
  - acceptFiles(proposalId, paths[])
  - rejectAll(proposalId)
  - rejectFiles(proposalId, paths[])
- On acceptance, gitService applies changes onto a feature branch and commits. A git/commit event is emitted.

## Persistence and Sharing

- HistoryStore (db/store) persists runs, steps, usage, errors, and commit metadata for historical views.
- artifacts/recorder captures a run in-memory; exporter writes a redacted JSON archive (v1), with optional file snapshots.
- importer validates and can replay events for auditability.

## Electron Integration

- Use adapters/electronShim to bridge a RunHandle to the renderer via ipcMain/ipcRenderer.
- In the renderer, consume events via IPC listener, Observable, or EventSource-like interface.
- See docs/OVERSEER_INTEGRATION.md for wiring examples.

## CLI Bridge

- scripts/runAgent.ts launches a run and prints JSONL events (one per line) to stdout.
- See docs/RUN_AGENT_CLI.md for arguments and output protocol.

## LLM Configurations and Budgets

- llmConfig is a serializable object reused across Overseer and the CLI. Example:
  - OpenAI: { provider: 'openai', model: 'gpt-4o-mini', apiKeyEnv: 'OPENAI_API_KEY', temperature?: number, maxTokens?: number }
  - Anthropic: { provider: 'anthropic', model: 'claude-3-5-sonnet', apiKeyEnv: 'ANTHROPIC_API_KEY', temperature?: number }
- Budget: { usd: number }. The orchestrator emits run/usage and run/budget-exceeded.

## Errors and Redaction

- Errors are serialized via errors/types: FactoryError with code and message. Use errors/redact to remove secrets.
- Do not pass raw Error instances across IPC; always serialize.

## Versioning and Stability

- Event payloads are designed to be stable and IPC-safe. Changes are made under SemVer.
- The archive format has an explicit version (artifacts v1). Future versions may add fields with backward compatibility.
