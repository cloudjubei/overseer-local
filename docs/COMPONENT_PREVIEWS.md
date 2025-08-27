# Component Previews and Mocks

This project ships with a lightweight, Storybook-like preview system so agents can see UI components in isolation and capture screenshots.

Quick start
- Ensure the dev server is running (vite/electron-vite). The base URL is typically http://localhost:PORT.
- Open preview.html with query params specifying a component id and optional props.
- Or use the preview_screenshot tool (preferred in automations) to capture images programmatically.

UI component mocks
- We provide ready-to-use previews for common UI components under:
  - src/renderer/components/ui/previews.tsx
- Each exported preview is a small wrapper component that renders the underlying UI with sensible default props, so you can see a result immediately without crafting props.
- You can still override props using the props query param.

Examples in the browser
- Button (default):
  /preview.html?id=renderer/components/ui/previews.tsx#Button_Default&theme=light

- Button variants:
  /preview.html?id=renderer/components/ui/previews.tsx#Button_Variants&theme=dark

- Input defaults:
  /preview.html?id=renderer/components/ui/previews.tsx#Input_Default

- Tooltip on a button:
  /preview.html?id=renderer/components/ui/previews.tsx#Tooltip_Default

- Modal (open):
  /preview.html?id=renderer/components/ui/previews.tsx#Modal_Default

Passing props
- Props are JSON-encoded via the props query param. Example: set Button label and variant
  /preview.html?id=renderer/components/ui/previews.tsx#Button_Default&props=%7B%22children%22%3A%22Save%22%2C%22variant%22%3A%22primary%22%7D
- For large props use props_b64=1 and pass base64-encoded JSON.

Theming and providers
- Use theme=light or theme=dark to toggle theme: /preview.html?...&theme=dark
- Core providers (theme, router, frame) are included by default via preview mocks (src/renderer/preview/mocks/coreMocks.tsx). If a component needs additional providers, pass needs=key1,key2 and register them in the preview registry.

Using the preview_screenshot tool
- The tool lives in src/tools/standardTools.js and can render any preview or arbitrary URL. It supports scripted interactions and before/after captures. You can call it from the agent integration.

Basic capture of Button default (JPEG 2x):
{
  "tool_name": "preview_screenshot",
  "arguments": {
    "id": "renderer/components/ui/previews.tsx#Button_Default",
    "theme": "light",
    "viewport": { "width": 600, "height": 260, "device_scale_factor": 2 },
    "wait_for_ready": true,
    "output": "artifacts/button_default.jpg",
    "format": "jpeg",
    "quality": 90
  }
}

Override props (primary and loading):
{
  "tool_name": "preview_screenshot",
  "arguments": {
    "id": "renderer/components/ui/previews.tsx#Button_Default",
    "props": { "children": "Saving...", "variant": "primary", "loading": true },
    "theme": "dark",
    "viewport": { "width": 600, "height": 260 },
    "output": "artifacts/button_saving.png"
  }
}

Scripted interaction example (hover to reveal a tooltip and capture after delay):
{
  "tool_name": "preview_screenshot",
  "arguments": {
    "id": "renderer/components/ui/previews.tsx#Tooltip_Default",
    "theme": "light",
    "viewport": { "width": 700, "height": 360 },
    "before": [
      { "action": "hover", "selector": "button" },
      { "action": "wait", "ms": 300 }
    ],
    "output": "artifacts/tooltip_hover.png"
  }
}

Other useful previews
- Select: id=renderer/components/ui/previews.tsx#Select_Default
- Switch: id=renderer/components/ui/previews.tsx#Switch_Default
- Skeleton: id=renderer/components/ui/previews.tsx#Skeleton_Default
- SegmentedControl: id=renderer/components/ui/previews.tsx#SegmentedControl_Default
- CollapsibleSidebar: id=renderer/components/ui/previews.tsx#CollapsibleSidebar_Default
- Toast: id=renderer/components/ui/previews.tsx#Toast_Default
- CommandMenu: id=renderer/components/ui/previews.tsx#CommandMenu_Default
- ShortcutsHelp: id=renderer/components/ui/previews.tsx#ShortcutsHelp_Default
- Alert: id=renderer/components/ui/previews.tsx#Alert_Default
- Modal: id=renderer/components/ui/previews.tsx#Modal_Default

Troubleshooting
- If a preview does not render and the console shows missing provider/context errors, add a dedicated wrapper export that supplies the provider locally, or register the provider and pass it via the needs query param.
- Ensure your id path is relative to src (omit leading src/). Example: renderer/components/ui/previews.tsx#Button_Default.
- Use preview:ready event or wait_for_ready in preview_screenshot to avoid racing before mount.
