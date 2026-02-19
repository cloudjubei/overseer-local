# Cost tracking (ledger)

## Goal
We need a **running, append-only tally of LLM costs per project** that survives deletion or refresh of chats and agent runs.

Today, UI cost is computed by summing `usage` embedded in persisted chat/agent-run messages. When a chat is restarted/refreshed or an agent run is deleted, the underlying messages disappear and the computed cost drops. We want costs to be durable and independent.

The solution is a **per-project cost ledger**: an append-only log of usage events with the pricing snapshot used at the time.

This document describes the **minimal data model** and **APIs** needed (likely implemented in `thefactory-tools`, then exposed in Overseer Local via IPC).

---

## Non-goals
- Not a general accounting system.
- Not a billing export.
- Not storing full prompts/completions.
- Not storing arbitrary metadata beyond what is needed to attribute cost.

---

## Requirements

### R1: Persistence is independent of chats/runs
Ledger entries must be stored separately from:
- chat transcripts
- agent run history artifacts

Deleting/restarting a chat or deleting an agent run must **not** remove ledger entries.

### R2: Append-only
Ledger is append-only. No edits, no deletes (unless a future explicit ‘admin purge’ is added).

### R3: Minimal entry fields
Each ledger entry must contain **only**:
- `timestamp` (ISO8601)
- `usage` (token usage)
- `price` (pricing snapshot)
- `source` (string)

Additionally, we need to be able to attribute costs to a specific chat context / run. This can be done without adding extra fields by encoding a stable identifier into `source`.

Recommended approach:
- `source` is a single string of the form:
  - `chat:<chatKey>`
  - `agentRun:<agentRunId>`
  - `agentRunFeature:<agentRunId>:<featureId>` (optional)

Where `chatKey` is `getChatContextPath(context)` (already available in `thefactory-tools/utils`).

This keeps the schema minimal while enabling per-chat/per-run rollups.

### R4: Totals and filtering
We must be able to:
- compute **total cost per project**
- compute **total cost per source prefix** (e.g. all `agentRun:*` vs all `chat:*`)
- compute **total cost for a specific chat** (`chat:<chatKey>`) or a run (`agentRun:<id>`)

### R5: Pricing snapshot
Ledger must store the **prices used at the time of the completion** (not a reference to a mutable price table).

This prevents retroactive cost changes when pricing tables update.

### R6: Works for both chats and agent runs
Ledger must track:
- ad-hoc chat completions
- agent run completions (which are also stored as chat messages inside `AgentRunHistory.conversations[].messages[]`)

---

## Data model

### Types (TypeScript)
These types should live in `thefactory-tools` (names are suggestions).

```ts
import type { CompletionUsage } from 'thefactory-tools'

export type CostLedgerPriceSnapshot = {
  currency: 'USD' | string
  inputPerMTokensUSD: number
  outputPerMTokensUSD: number
  // optional but recommended to support OpenAI/Anthropic cache pricing
  cacheReadInputPerMTokensUSD?: number
  // reserved for future, keep optional
  cacheWriteInputPerMTokensUSD?: number
}

export type CostLedgerEntry = {
  timestamp: string // ISO8601
  usage: CompletionUsage
  price: CostLedgerPriceSnapshot
  source: string
}
```

Notes:
- `CompletionUsage` already includes:
  - `promptTokens`
  - `completionTokens`
  - optional `cachedReadInputTokens`, `cachedWriteInputTokens`
  - optional `provider`, `model`

### Cost computation (reference)
Cost is computed as:

```ts
costUSD = (price.inputPerMTokensUSD * usage.promptTokens) / 1_000_000
        + (price.outputPerMTokensUSD * usage.completionTokens) / 1_000_000

// optional: cache reads billed at a different rate
if (usage.cachedReadInputTokens && price.cacheReadInputPerMTokensUSD != null) {
  costUSD += (price.cacheReadInputPerMTokensUSD * usage.cachedReadInputTokens) / 1_000_000
}

// optional: cache writes if priced
if (usage.cachedWriteInputTokens && price.cacheWriteInputPerMTokensUSD != null) {
  costUSD += (price.cacheWriteInputPerMTokensUSD * usage.cachedWriteInputTokens) / 1_000_000
}
```

**Important:** The ledger should store `usage` and `price`. Derived `costUSD` can be computed on read, or optionally stored separately (but that would violate the ‘nothing more nothing less’ preference).

---

## Storage format
Any durable store is acceptable, but a simple approach is:

### Option A: JSONL (recommended)
Per project file:
- `.factory/cost-ledger/<projectId>.jsonl`

Each line is a JSON object of `CostLedgerEntry`.

Pros:
- append-only by default
- resilient to large histories
- easy to stream/aggregate

Cons:
- no random access; totals require scanning (can be mitigated with caching)

### Option B: SQLite
A `cost_ledger` table keyed by `projectId`.

Pros:
- fast aggregation
- easy filtering/grouping

Cons:
- heavier dependency

---

## API surface
These functions are needed from `thefactory-tools` (and then exposed by Overseer Local main process as IPC).

```ts
export type AppendCostLedgerEntryParams = {
  projectId: string
  entry: CostLedgerEntry
}

export type ListCostLedgerEntriesParams = {
  projectId: string
  // optional filters
  sourcePrefix?: string // e.g. 'chat:' or 'agentRun:'
  sourceEquals?: string
  fromTimestamp?: string
  toTimestamp?: string
}

export type CostTotals = {
  entries: number
  promptTokens: number
  completionTokens: number
  cachedReadInputTokens: number
  cachedWriteInputTokens: number
  costUSD: number
}

export type GetCostTotalsParams = ListCostLedgerEntriesParams

export interface CostLedgerService {
  append(params: AppendCostLedgerEntryParams): Promise<void>
  list(params: ListCostLedgerEntriesParams): Promise<CostLedgerEntry[]>
  totals(params: GetCostTotalsParams): Promise<CostTotals>
}
```

Implementation detail: `totals()` may be computed by scanning JSONL; the service can cache rolling aggregates per project.

---

## Where to append ledger entries (hook points)
Ledger entries must be appended at the time we receive definitive usage.

### Chat completions
When the app performs a completion for a chat context (via `completionService.sendCompletionTools/resume/retry`), the backend sees:
- `projectId`
- `chatContext`
- final `CompletionUsage`
- the pricing snapshot used for the call

It must append:
- `timestamp`: completion `completedAt` (preferred) or `new Date().toISOString()`
- `usage`: the returned `CompletionUsage`
- `price`: snapshot resolved at execution time
- `source`: `chat:<chatKey>` where `chatKey = getChatContextPath(chatContext)`

### Agent runs
Agent runs ultimately also generate `ChatMessage.completionMessage.usage` in their conversation messages.

Append entries either:
- per completion message as it is produced (best accuracy), with `source = agentRun:<agentRunId>` (or include feature id when available), OR
- once at run completion, by summing usage across messages (less granular, but fewer entries)

Prefer per completion message if the backend already sees each completion.

---

## UI usage (Overseer Local)

### AgentsView
`AgentsView.tsx` should display **total cost** per project for:
- agent runs
- chats

Instead of deriving totals solely from `runsHistory` / chat transcripts, it should query ledger totals:
- `totals({ projectId, sourcePrefix: 'agentRun:' })`
- `totals({ projectId, sourcePrefix: 'chat:' })`

### Per-chat current cost display
For the chat currently open (context), compute:
- `chatKey = getChatContextPath(context)`
- `totals({ projectId, sourceEquals: 'chat:' + chatKey })`

This must remain correct even if the chat transcript is cleared/restarted.

---

## Edge cases / notes
- If pricing cannot be resolved, still append an entry with `price` set to zeros and currency `USD`, but preserve usage.
- If usage is missing, do not append (or append with zeros) — prefer not to append garbage.
- Ensure the ledger write is atomic and resilient to crashes.
- Consider idempotency: retries should not double-count the same completion. If needed, future enhancement: deterministic `entryId`, but that would add a field. For now, accept that each completion call appends once.

---

## Acceptance criteria
- Deleting an agent run does not reduce project total cost.
- Restarting/deleting a chat does not reduce project total cost.
- AgentsView shows total costs based on the ledger.
- A chat view can show the current total cost for that chat based on ledger entries.
