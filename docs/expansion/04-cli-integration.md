# 04 - CLI Tool Integration

## Summary

Enable external CLI-based AI tools (Claude Code, Cursor, etc.) to function as completion/agent providers within the Overseer ecosystem -- both through the backend (server-hosted) and locally on the desktop app.

**Phase:** 2 (backend integration first, local integration after)

---

## Why This Exists

The current completion pipeline in `thefactory-tools` calls LLM APIs directly via HTTP (OpenAI, Anthropic, Gemini, DeepSeek, etc.). CLI tools like Claude Code and Cursor represent a different paradigm: they are interactive programs that accept prompts, execute tools, and produce output -- but they don't expose a simple HTTP API. Integrating them allows users to leverage these tools' unique capabilities (extended thinking, tool use, codebase awareness) within Overseer's project/story/chat workflow.

---

## Current Completion Architecture

From `thefactory-tools/src/completion/`:

```
CompletionTools.sendCompletion()
  → buildProviderRequest(llmConfig)     // provider-specific URL/headers/body
  → fetch(url, { body, headers })       // direct HTTP call to LLM API
  → parse response
  → return CompletionResponse

CompletionTools.sendCompletionWithTools()
  → sendCompletion (no tools, get agent envelope)
  → if tools required: runToolLoopAndFinalize()
    → sendCompletionWithToolsSingle() per turn
    → callCompletionTools() to execute tool calls
    → final text phase
```

Providers are dispatched by `LLMProvider` type: `'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'xai' | 'qwen' | 'llama' | 'custom'`

---

## Integration Model

CLI tools don't fit the "HTTP request → JSON response" model. They are:
- Long-running processes with their own internal state
- Interactive (accept input, produce streaming output)
- Capable of their own tool calling (file edits, terminal commands)
- Potentially stateful across turns

### Approach: CLI Tool as a Managed Process

```
┌─────────────────────────────────────────────┐
│  Overseer (backend or local)                │
│                                             │
│  CompletionTools                            │
│    │                                        │
│    ├── HTTP providers (existing)            │
│    │   openai, anthropic, gemini, etc.      │
│    │                                        │
│    └── CLI providers (new)                  │
│        │                                    │
│        ▼                                    │
│  CLIProviderManager                         │
│    ├── spawn/manage CLI process             │
│    ├── send prompt via stdin/pipe/API       │
│    ├── capture output (streaming)           │
│    ├── translate tool calls to/from         │
│    │   Overseer's ToolCall format           │
│    └── lifecycle (start, health, stop)      │
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Claude Code  │  │ Cursor CLI / other  │  │
│  │ (subprocess) │  │ (subprocess)        │  │
│  └─────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────┘
```

### New Provider Type

Add to `LLMProvider`:

```typescript
export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'xai'
  | 'qwen'
  | 'llama'
  | 'custom'
  | 'cli'    // new: CLI-based provider
```

The `LLMConfig` for CLI providers would include:

```typescript
interface CLIProviderConfig extends LLMConfig {
  provider: 'cli'
  cliTool: 'claude-code' | 'cursor' | string
  cliPath?: string           // path to CLI binary
  cliArgs?: string[]         // additional arguments
  workingDirectory?: string  // project root for the CLI
}
```

---

## Phase 2a: Backend CLI Integration

When the backend is running, CLI tools are managed as server-side processes:

1. **Process management:** Backend spawns and manages CLI tool processes. Each process is tied to a project workspace on the server.
2. **Communication protocol:** Depends on the CLI tool:
   - Claude Code: has a `--print` mode for non-interactive use and potentially an API mode. Also supports MCP (Model Context Protocol) which could be leveraged.
   - Cursor: investigate available CLI/API interfaces.
3. **Translation layer:** Converts between the CLI tool's I/O format and Overseer's `CompletionMessage` / `ToolCall` / `CompletionResponse` types.
4. **Concurrency:** Multiple users/projects may need separate CLI process instances. The backend manages a pool.
5. **Cost tracking:** CLI tools may have their own billing. Track usage metadata even if exact token counts aren't available.

### Backend endpoints

- `POST /cli-providers` -- register/configure a CLI tool
- `GET /cli-providers` -- list available CLI tools
- `POST /cli-providers/:id/health` -- check if tool is available/running
- Completions use existing `/completions/*` endpoints with `provider: 'cli'`

---

## Phase 2b: Local CLI Integration

After the backend version works, bring the same capability to overseer-local running locally:

1. The `CLIProviderManager` code from the backend is extracted or duplicated into a form usable by the Electron main process.
2. overseer-local spawns CLI tools as child processes on the user's machine.
3. The CLI tool operates on the user's local project directory (which is what these tools are designed for).
4. This is actually the more natural fit: CLI tools like Claude Code and Cursor are designed for local development.

### Local advantages

- CLI tools have direct access to the project filesystem
- No need for remote workspace management
- Lower latency
- Tools can use their own auth (user's API keys configured in their own config)

### Local challenges

- Managing external process lifecycle from Electron
- The CLI tool may conflict with the user's own running instance
- Error handling and crash recovery
- Different CLI tools have very different interfaces

---

## Tool Call Translation

The core challenge is mapping between Overseer's tool system and the CLI tool's native tool system.

### Overseer's tool calls

From `thefactory-tools/src/agent/agentTypes.ts`: `ToolCall` has `name`, `arguments`, and expects a `ToolResult` back. Tools include file operations, git operations, compile, search, etc.

### CLI tools' tool calls

Claude Code and Cursor have their own built-in tools (file edit, terminal, search, etc.) that may overlap with or differ from Overseer's tools.

### Options

1. **Passthrough mode:** Let the CLI tool use its own tools directly. Overseer just sends the prompt and receives the final output. Simple but loses visibility into what the tool did.
2. **Supervised mode:** Intercept the CLI tool's tool calls, map them to Overseer's tool system, execute via Overseer's tool pipeline, and feed results back. Full visibility and control but complex.
3. **Hybrid:** Passthrough for most operations, with Overseer-specific tools injected for project/story/chat operations that the CLI tool wouldn't know about.

Recommendation: start with **passthrough mode** for Phase 2a. It gets the integration working with minimal complexity. Add supervised mode later as needed.

---

## Open Questions

1. **Claude Code API stability:** Does Claude Code have a stable programmatic interface, or only the interactive CLI? The reference source in `thefactory-references` should be studied for available modes.
2. **MCP integration:** Claude Code supports MCP servers. Could Overseer expose an MCP server that CLI tools connect to, rather than Overseer managing them as subprocesses?
3. **Cursor integration:** What programmatic interface does Cursor expose? Can it be used headlessly?
4. **Security:** CLI tools may have access to the entire filesystem. How to sandbox them to the relevant project?
5. **Cost:** CLI tools use their own API keys/billing. How to track and attribute costs?
6. **Conflicting tool calls:** If the CLI tool edits a file that Overseer is also tracking, how to handle conflicts?

---

## Implementation Strategy

### Phase 2a (backend)

1. Study Claude Code's available interfaces (reference source in `thefactory-references/claude-code/`)
2. Build a `CLIProviderManager` that can spawn, communicate with, and stop Claude Code
3. Implement the translation layer for prompts and responses
4. Add `'cli'` to `LLMProvider` in thefactory-tools
5. Wire into the backend's completion endpoints
6. Test end-to-end: user sends chat message → backend routes to Claude Code → response returned

### Phase 2b (local)

7. Port `CLIProviderManager` to work in Electron's main process
8. Add CLI provider configuration to overseer-local settings
9. Wire into the local completion pipeline
10. Handle process lifecycle in the Electron app context
