import type { ReactNode, ComponentType } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

export type PreviewVariant = {
  name: string
  description?: string
  // Props used for this variant; can be overridden by URL props
  props?: Record<string, unknown>
  // Optional additional dependency keys needed for this variant
  needs?: string[]
  // Optional wrapper specific to the variant
  wrapper?: (node: ReactNode) => ReactNode
  // Optional setup hook
  beforeMount?: (ctx: PreviewRuntimeContext) => void | Promise<void>
}

export type PreviewMeta = {
  title?: string
  // Default props applicable to all variants
  defaultProps?: Record<string, unknown>
  // Required dependencies for this component to render
  needs?: string[]
  // Optional default theme
  theme?: ThemeMode
  // One or more example variants
  variants?: PreviewVariant[]
  // Custom root wrapper (applied after registry providers)
  wrapper?: (node: ReactNode) => ReactNode
}

export type LoadedComponentExport = {
  default?: ComponentType<any>
  [key: string]: any
}

export type ProviderComposeResult = {
  wrap: (node: ReactNode) => ReactNode
  dispose?: () => void | Promise<void>
}

export type ProviderFactory = (options: ProviderFactoryOptions) => ProviderComposeResult

export type ProviderFactoryOptions = {
  theme: ThemeMode
  // Arbitrary registry state
  state: Record<string, any>
  // URL params for advanced scenarios
  params: URLSearchParams
}

export type PreviewRegistry = {
  // Register a provider factory
  register: (key: string, factory: ProviderFactory) => void
  // Compose multiple providers by keys (deduped, order preserved by input)
  compose: (keys: string[], options: ProviderFactoryOptions) => ProviderComposeResult
  // Check if a key is registered
  has: (key: string) => boolean
}

export type PreviewRuntimeContext = {
  registry: PreviewRegistry
  params: URLSearchParams
  setState: (key: string, value: any) => void
  getState: <T = any>(key: string) => T | undefined
}

export const DEFAULT_DEPENDENCIES: string[] = ['theme', 'router']
