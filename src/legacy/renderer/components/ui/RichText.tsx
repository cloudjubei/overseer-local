import React from 'react'
import {
  RichText as RichTextPackage,
  type RichTextProps as PackageRichTextProps,
} from 'thefactory-ui/web'
import { useFiles } from '../../contexts/FilesContext'
import DependencyBullet from '../stories/DependencyBullet'

// Local connected wrapper around `thefactory-ui`'s decoupled `RichText`.
//
// The package primitive is intentionally context-free — it asks the consumer
// for `onResolveFile` and `renderDependency` callbacks. This wrapper wires
// them to overseer-local's `FilesContext` (for @file mention resolution) and
// `DependencyBullet` (for #story/#feature reference rendering), so every
// existing `@renderer/components/ui/RichText` import gets the desired
// behavior without changing call sites.

// Compatibility shim: re-export the package's prop type. We intentionally
// don't surface `onResolveFile` / `renderDependency` here because this
// wrapper supplies them — exposing those would let callers override and
// defeat the wrapper's purpose.
export type RichTextProps = Pick<
  PackageRichTextProps,
  'text' | 'variant' | 'inputEditRange' | 'onReadPreview'
>

export function RichText(props: RichTextProps) {
  const { filesByPath } = useFiles()

  const onResolveFile = React.useCallback(
    (token: string) => {
      // Prefer exact path; fall back to basename for short-form mentions
      // like `@foo.ts` when the user knows the project has only one match.
      const exact = filesByPath[token]
      if (exact) return exact
      const short = token.split('/').pop() ?? token
      return filesByPath[short] ?? null
    },
    [filesByPath],
  )

  const renderDependency = React.useCallback(
    (dep: string) => <DependencyBullet dependency={dep} interactive={false} />,
    [],
  )

  return (
    <RichTextPackage
      {...props}
      onResolveFile={onResolveFile}
      renderDependency={renderDependency}
    />
  )
}

export default RichText
