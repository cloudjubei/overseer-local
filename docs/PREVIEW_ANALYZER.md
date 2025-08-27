# Preview Analyzer

A lightweight static analyzer that scans React TSX component files and determines whether they are previewable in the built-in preview runtime, which providers/mocks are required, and why some components may be blocked.

What it detects:
- External dependencies from import statements.
- Provider/mocks needed based on heuristics (router, theme, tasksMock, notificationsMock, llmMock).
- Use of Electron/Node built-ins that block preview in a browser context.
- Exported components that return JSX and their props (best effort), including required vs optional.
- Presence of `export const preview = { ... }` metadata and its `needs` field.

Outputs a JSON report with:
- summary: counts of previewable, needs_providers, and blocked components.
- analyses: per-file breakdown with reasons and needs.

Usage
- Analyze all components under a directory and print to stdout:
  node scripts/preview-scan.js --dir src/renderer/components

- Write to a file and use compact JSON:
  node scripts/preview-scan.js --dir src/renderer/components --out preview-metadata.json --compact

Interpreting Results
- status:
  - previewable: No blockers and no extra providers required.
  - needs_providers: Previewable with providers/mocks specified in `needs`.
  - blocked: Cannot be previewed in the browser preview; see reasons.
- reasons: Human-readable explanations (e.g., requires providers, uses Electron APIs, or no JSX export).
- needs: Provider keys to include when launching preview:
  - router: Provides react-router context.
  - theme: Provides theme context (applied by default in preview runtime, but listed for clarity).
  - tasksMock: In-memory tasks service.
  - notificationsMock: In-memory notifications service.
  - llmMock: In-memory chat/LLM service.

Enhancing Detection via Module Metadata
Components can export preview metadata to declare needs and variants:

export const preview = {
  needs: ['router', 'tasksMock'],
  variants: {
    default: { props: { children: 'Click me' } },
    danger: { props: { variant: 'danger', children: 'Delete' } }
  }
};

The analyzer will pick up `needs` and include them in the report. The preview runtime (see docs/COMPONENT_PREVIEWS.md) can use `variants` as well.

Notes and Limitations
- Props inference is best-effort and works reliably for inline type literals and locally-declared interfaces/type aliases referenced by the props parameter. External or generic types will be marked as incomplete.
- Detection is import-based; if you use Electron or Node APIs via global shims without import statements, they may not be detected.
- The theme provider is auto-applied in the preview runtime, but we still list it when detected.

