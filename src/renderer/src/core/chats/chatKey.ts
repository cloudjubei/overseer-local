/**
 * Re-export of `getChatContextKey` / `getChatContext` from
 * `thefactory-tools/utils`. Routing through this shim keeps the chatKey
 * form (URL slug + cost-aggregate key) in lock-step with the backend's
 * `chatContext → chatKey` derivation — see `thefactory-ui/docs/ARCHITECTURE.md`
 * for the narrowly-scoped exception to the "no `thefactory-tools` direct
 * import" rule. Mirrored in `thefactory-overseer-web` and `thefactory-overseer-mobile`.
 */
export { getChatContextKey, getChatContext } from 'thefactory-tools/utils'
