/**
 * Friendly aliases over the generated SDK shapes.
 *
 * Every entry here has to *do* something — pulling a sub-shape out of a
 * request/response, indexing into an array element, stripping `undefined`,
 * or expressing a structural shape the spec doesn't have. Pure renames
 * (e.g. `Story = GetStoryResponse`) live nowhere — callers use the
 * generated name directly. The bar to add to this file: "would the inlined
 * version be unreadable or duplicated across consumers?"
 */
import type {
  // Chats
  GetChatResponse,
  // Code intel
  DetectEnvironmentData,
  // Completions
  AbortCompletionData,
  ResumeCompletionData,
  SendCompletionData,
  SendCompletionWithToolsData,
  StartAgentRunData,
  // Coverage / tests
  CoverageResult,
  GetLastCoverageResponses,
  GetLastTestsRunResponses,
  RunCoverageData,
  RunTestsData,
  TestsResult,
  // Entities
  ListEntitiesData,
  SearchEntitiesData,
  // Git
  CreateGitBranchData,
  GetGitDiffResponses,
  GetGitStatusResponses,
  GitCommitData,
  GitPullData,
  GitPushData,
  GitResetData,
  GitStashApplyData,
  GitStashDropData,
  GitFetchData,
  GitStashData,
  ListUnifiedGitBranchesResponses,
  // Pricing
  GetPricingResponses,
  // Tools
  ExecuteToolResponses,
  ListToolsResponses,
  PreviewToolResponses,
  // Web search keys
  UpdateWebSearchKeysData,
} from '../generated/backend'

// --- Chats ---
//
// `ChatContext`, `ChatCreateInput`, `ChatEditInput`, `AddMessagesInput`,
// `RateChatInput`, `UpdateDynamicContextInput`, etc. are now promoted in
// the generated SDK — import them directly. The only sub-shape still
// reverse-engineered here is `ChatMessage`, which lives inline in
// `Chat.messages` and isn't independently named.
export type ChatMessage = NonNullable<GetChatResponse['messages']>[number]

// --- Completions ---
export type SendCompletionInput = SendCompletionData['body']
export type SendWithToolsInput = SendCompletionWithToolsData['body']
export type ResumeCompletionInput = ResumeCompletionData['body']
export type AbortCompletionInput = AbortCompletionData['body']
export type StartAgentRunInput = StartAgentRunData['body']

// --- Entities ---
//
// `Entity`, `EntityInput`, `EntityPatch`, `EntityWithScore` are all promoted
// in the generated SDK — import them directly from `@generated/backend`.
// Only the request bodies / query params still need aliases here.
export type EntitySearchInput = SearchEntitiesData['body']
export type ListEntitiesQuery = NonNullable<ListEntitiesData['query']>

// --- Files ---
export type FileMove = { src: string; dst: string }
export type GrepQuery = { path: string; pattern: string }
export type GrepHit = { path: string; pattern: string; matches: string }
export type GrepFailure = { path: string; pattern: string; error: string }
export type GrepResult = GrepHit | GrepFailure

// --- Git (envelope-unwrapped domain shapes) ---
type StatusEnvelope = GetGitStatusResponses[200]
type UnifiedBranchesEnvelope = ListUnifiedGitBranchesResponses[200]
type DiffEnvelope = GetGitDiffResponses[200]

export type GitStatus = NonNullable<StatusEnvelope['status']>
export type GitUnifiedBranch = NonNullable<UnifiedBranchesEnvelope['branches']>[number]
export type GitDiffFile = DiffEnvelope[number]
export type GitFileStatus = GitDiffFile['status']

// `GitCommitInput` exists in the generated SDK but is broader than the
// commit endpoint's request body (the body requires `message: string`,
// the named type marks it optional). Keep the body alias.
export type CommitInput = GitCommitData['body']
export type PushInput = GitPushData['body']
export type PullInput = GitPullData['body']
export type ResetInput = GitResetData['body']
export type CreateBranchInput = CreateGitBranchData['body']

export type StashInput = GitStashData['body']
export type StashApplyInput = GitStashApplyData['body']
export type StashDropInput = GitStashDropData['body']
export type FetchInput = GitFetchData['body']

// --- Live data ---
//
// `LiveDataProvider`, `LiveDataProviderCreateInput`, `LiveDataProviderEditInput`,
// and `LiveDataPayload` are all promoted in the generated SDK — import them
// directly. Only the WS `liveData:updated` event has no REST schema, so it's
// hand-written here.
export type LiveDataUpdatedEvent = {
  providerId: string
  status: 'fetching' | 'fresh' | 'error'
}

// --- Web search keys ---
//
// `WebSearchKeyEntry` is promoted in the generated SDK — import it directly.
// Only the upsert body still needs an alias.
export type WebSearchKeyUpsertInput = UpdateWebSearchKeysData['body']

// --- Tests ---
//
// `TestsResult`, `TestStats`, `TestResult`, `TestStatus`, `CoverageResult`,
// `CoverageFileResult` are all promoted in the generated SDK — import them
// directly. Only request bodies and the broadcast WS payload below need
// aliases here.
export type RunTestsInput = RunTestsData['body']
export type CoverageInput = RunCoverageData['body']
export type LastTestsRunRaw = GetLastTestsRunResponses[200]
export type LastCoverageRaw = GetLastCoverageResponses[200]

/**
 * Hand-written mirror of the backend's `tests:progress` WS payload — the
 * event shape is broadcast-only on the backend (no REST schema), so it has
 * no generated equivalent. Keep in sync with thefactory-tools'
 * `TestRunnerProgressEvent` / `CoverageProgressEvent` and
 * `src/utils/wsEvents.ts` on the backend.
 */
export type TestRunProgressEvent =
  | { type: 'started'; total?: number; paths?: string[] }
  | { type: 'file:start'; path: string; index?: number; total?: number }
  | { type: 'file:end'; path: string; index?: number; total?: number }
  | { type: 'finished'; result: TestsResult | CoverageResult }
  | { type: 'aborted'; partial: TestsResult | CoverageResult }
  | { type: 'error'; error: string }

export type TestsProgressData = {
  jobId: string
  projectId: string
  event: TestRunProgressEvent
}

// --- Ingestion ---
/**
 * Hand-written mirror of the backend's `ingestion:progress` WS payload —
 * keep in sync with `IngestionProgressEvent` in thefactory-tools and
 * `src/utils/wsEvents.ts` on the backend. The terminal `result` shape
 * matches `IngestionResult` (upserted / skipped / failed / durationMs).
 */
export type IngestionProgressEvent =
  | { type: 'started'; projectId: string; total: number }
  | { type: 'file'; projectId: string; path: string; index: number; total: number }
  | { type: 'batch'; projectId: string; upserted: number }
  | {
      type: 'finished'
      projectId: string
      result: { upserted: number; skipped: number; failed: number; durationMs: number }
    }
  | { type: 'error'; projectId: string; path?: string; error: string }

export type IngestionProgressData = {
  jobId: string
  event: IngestionProgressEvent
}

// --- Tools ---
export type ToolDescriptor = ListToolsResponses[200][number]
export type ToolExecuteResult = ExecuteToolResponses[200]
export type ToolExecuteStatus = ToolExecuteResult['type']
export type ToolPreviewResult = PreviewToolResponses[200]

// --- Pricing ---
export type PricingSnapshot = GetPricingResponses[200]
export type PricingEntry = PricingSnapshot['prices'][number]

// --- Code intel ---
export type DetectEnvironmentInput = DetectEnvironmentData['body']
