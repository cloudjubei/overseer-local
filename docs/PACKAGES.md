# PACKAGES

Purpose

- Central registry for internal and external packages used by this repository.
- For each package, describe its purpose and the main interfaces it exposes so agents and contributors can integrate correctly.
- Keep this up to date when adding, removing, or significantly changing a package.

Editing Rules

- One entry per package with: name, location (if local), purpose, primary interfaces (surface APIs), and key docs/links.
- Keep interface lists high-level (modules/classes/functions/types). Link to source or local README for details.
- Do not duplicate detailed API docs; link to the canonical source in the package.

Template

- Name: <package-name>
- Location: <path or external registry>
- Purpose: <short description>
- Primary Interfaces:
  - <module or class/function>: <what it does / why it matters>
- Key Docs:
  - <link to README / docs>

Packages

1) Name: factory-ts
- Location: packages/factory-ts
- Purpose: Local agent orchestration library used by this app and tooling to run agents, construct prompts, track history, compute pricing, and integrate with git and DB. It centralizes agent run lifecycle and shared utilities.
- Primary Interfaces:
  - orchestrator:
    - Orchestrator: High-level class that coordinates multi-step agent runs, role assignment, tool availability, and message routing.
    - constructSystemPrompt(config): Builds the system prompt for agents from project context (used by tools like the orchestrator and app-specific glue code).
  - pricing:
    - PricingService / getModelPricing(modelId): Pricing lookup and cost computation for token usage per model provider.
  - history:
    - HistoryStore: Persists and retrieves run history, messages, and artifacts for reproducibility and audit.
  - completion:
    - CompletionClient: Unified interface over model providers (LLMs) for chat/completion calls; supports token usage reporting.
  - git:
    - GitIntegration: Utilities to read diffs, HEAD state, and repository metadata for context injection into agent runs.
- Key Docs:
  - packages/factory-ts/README.md (overview and quickstart)
  - packages/factory-ts/docs (agent roles and deeper guides; e.g., AGENT_*.md)

Notes

- When introducing a new package, add an entry here and link any authoritative API docs.
- If a package's public surface changes (modules/classes renamed, new primary interfaces), update this file in the same PR.
