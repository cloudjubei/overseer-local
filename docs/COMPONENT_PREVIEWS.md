# Component Previews: Stubs and Mocks System

This documentation describes how to declare preview requirements for React components and how the preview runtime provides sensible default providers and mock data.

Overview
- A dedicated preview runtime (preview.html) renders components in isolation.
- Components can export a `preview` metadata object (or `getPreview()` function) to declare required dependencies (providers, mocks) and provide example variants with props.
- A registry provides default providers for common needs (theme, router) and optional mocks (tasks, notifications, LLM config).

Quick Start
1. Open http://localhost:<vite-port>/preview.html?id=renderer/components/ui/Button.tsx#default&props=%7B%22children%22%3A%22Click%20me%22%7D&provider=app&theme=light
2. Add a `preview` export to your component module to tailor its preview:

```ts
import type { PreviewMeta } from '../../preview/previewTypes';

export const preview: PreviewMeta = {
  title: 'UI/Button',
  theme: 'light',
  needs: ['frame'], // theme + router are auto-applied
  defaultProps: { variant: 'primary' },
  variants: [
    { name: 'default', props: { children: 'Click me' } },
    { name: 'loading', props: { children: 'Saving…', loading: true } },
  ],
};
```

URL Parameters
- id: Module path under src/ with optional `#ExportName` (default: `default`). Example: `renderer/components/ui/Button.tsx#default`.
- theme: `light` | `dark`. Applies `data-theme` on `<html>`.
- props: URL-encoded JSON props for the target export.
- props_b64: If `1`, decode props as base64.
- needs: Comma-separated provider keys to include in addition to those declared by the component.

Declaring Dependencies (needs)
The preview runtime composes provider wrappers based on dependency keys. The following are available by default:
- theme: Sets `<html data-theme>` to the requested theme. Applied by default.
- router: Wraps with a MemoryRouter. Applied by default.
- frame: Adds a padded frame around the component for visual clarity.
- tasksMock: In-memory tasks context providing sample tasks. Available for components that rely on tasks data.
- notificationsMock: In-memory notifications context.
- llmMock: In-memory LLM providers configuration.

Notes:
- Static imports cannot be overridden at runtime; these mocks are made available via React Context for components that consume context-driven dependencies or for purpose-built preview-only wrappers.
- If your component directly imports service modules and calls them during render, add a thin prop or context to inject data for previewing, or create a small wrapper component that adapts to preview contexts.

Variants
- Variants allow you to define multiple named prop sets for a component preview.
- Navigate variants via URL hash, e.g., `#loading` selects the `loading` variant.

Advanced: Dynamic preview metadata
- For cases where you need data fetching or async work to prepare preview props, export a `getPreview()` function that returns a `PreviewMeta` object.

Examples

Button.tsx
```ts
// src/renderer/components/ui/Button.tsx
export default function Button(props: { variant?: 'primary'|'secondary'; loading?: boolean; children?: React.ReactNode }) { /* ... */ }

export const preview: PreviewMeta = {
  title: 'UI/Button',
  needs: ['frame'],
  defaultProps: { variant: 'primary' },
  variants: [
    { name: 'default', props: { children: 'Click me' } },
    { name: 'secondary', props: { children: 'Click', variant: 'secondary' } },
  ],
};
```

TasksListView.tsx
```ts
// A screen that needs router + tasks data
export const preview: PreviewMeta = {
  title: 'Screens/TasksList',
  needs: ['tasksMock', 'frame'],
  variants: [{ name: 'default' }],
};
```

Extending the Registry
- Register additional providers/mocks in `src/renderer/preview/mocks/` and wire them up in `createDefaultMocksRegistry()`.
- Use keys that reflect the dependency (e.g., `authMock`, `docsMock`).

Limitations and Guidance
- Prefer components that accept data via props or context to keep them preview-friendly.
- Avoid hard side effects during initial render.
- Keep preview mocks small, deterministic, and in-memory.

Troubleshooting
- If your component does not render, check console for import path or export name errors.
- Validate `props` parameter formatting; use `props_b64=1` for complicated JSON.
- Use `needs` query param to experiment with providers: `&needs=frame,tasksMock`.
