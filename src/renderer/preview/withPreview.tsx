import React from 'react'
import type { PreviewMeta, PreviewRegistry, ThemeMode } from './previewTypes'
import { DEFAULT_DEPENDENCIES } from './previewTypes'
import { createDefaultMocksRegistry } from './mocks/coreMocks'

export type WithPreviewOptions = {
  theme?: ThemeMode
  needs?: string[]
  registry?: PreviewRegistry
  params: URLSearchParams
}

export function resolvePreviewProviders(
  meta: PreviewMeta | undefined,
  options: WithPreviewOptions,
) {
  const registry = options.registry ?? createDefaultMocksRegistry()
  const theme = options.theme ?? meta?.theme ?? ((options.params.get('theme') as any) || 'light')

  const needs = Array.from(
    new Set([
      ...DEFAULT_DEPENDENCIES,
      ...(meta?.needs ?? []),
      ...(options.needs ?? []),
      ...(options.params.get('needs')?.split(',') ?? []),
    ]),
  )

  const composed = registry.compose(needs, { theme, state: {}, params: options.params })

  return { registry, composed }
}

export function applyWrapper(
  wrapper: ((n: React.ReactNode) => React.ReactNode) | undefined,
  node: React.ReactNode,
) {
  return wrapper ? wrapper(node) : node
}
