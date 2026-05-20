/**
 * Re-export of `getChatContextKey` / `getChatContext` from
 * `thefactory-tools/utils`. The renderer imports these directly from
 * upstream so the chatKey form (URL slug + cost-aggregate key) stays in
 * lock-step with the backend's `chatContext → chatKey` derivation —
 * matching how the legacy renderer wired up `costsService` directly to
 * `FactoryLLMCostsManager`. Mirrors the same shim in
 * `thefactory-overseer-web/src/core/chats/chatKey.ts`.
 */
export { getChatContextKey, getChatContext } from 'thefactory-tools/utils'
