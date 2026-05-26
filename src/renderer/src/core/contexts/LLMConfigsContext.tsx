import type { ReactNode } from 'react'
import { LLMConfigsProvider as HeadlessLLMConfigsProvider } from 'thefactory-ui/headless'
import { localStorageAdapter } from '../storage/localStorageAdapter'

export { useLLMConfigs, type LLMConfigsContextValue } from 'thefactory-ui/headless'

/**
 * App-side adapter: feeds the `localStorage`-backed adapter into the
 * headless `LLMConfigsProvider` so its active / recents persistence works.
 */
export function LLMConfigsProvider({ children }: { children: ReactNode }) {
  return (
    <HeadlessLLMConfigsProvider storage={localStorageAdapter}>{children}</HeadlessLLMConfigsProvider>
  )
}
