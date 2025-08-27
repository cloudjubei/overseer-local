# Agent Preview Screenshot Tool

Overview
- The preview_screenshot tool lets agents render a component (via preview.html) or any app URL and capture a screenshot for immediate visual feedback.
- It leverages the built-in component preview runtime (see docs/COMPONENT_PREVIEWS.md) and Puppeteer for headless capture.
- New: Supports scripted interactions (clicks, typing, etc.) and before/after screenshots to demonstrate component behavior.

Prerequisites
- Run the app in dev so the Vite dev server is serving preview.html (e.g., electron-forge start with the Vite plugin).
- Provide the dev server base URL via one of:
  - Pass base_url in the tool call, e.g., http://localhost:5173
  - Set environment variable PREVIEW_BASE_URL
  - Omit base_url and allow auto-detect to probe common localhost ports.
- Install Puppeteer:
  - npm i -D puppeteer
  - Or puppeteer-core and set PUPPETEER_EXECUTABLE_PATH/CHROME_PATH

Usage
1) Screenshot a component by module path (relative to src/) and optional variant/props
- name: preview_screenshot
- params:
  - mode: 'component'
  - id: 'renderer/components/ui/Button.tsx#default'
  - variant: 'loading'            // optional, selects a variant by name (hash)
  - props: { children: 'Click' }  // optional, merged with default/variant props
  - needs: ['frame']              // optional, additional providers
  - theme: 'light' | 'dark'       // optional
  - width, height, device_scale_factor: viewport sizing
  - wait_selector: CSS selector to wait for before capture (defaults to '#preview-stage' in component mode)
  - delay_ms: additional wait before capture
  - clip_selector: CSS selector to crop around
  - format: 'png' | 'jpeg' (default png)
  - quality: 0-100 (jpeg only)
  - out_file: optional file path to save image
  - base_url: optional dev server base URL (e.g., http://localhost:5173)
  - auto_detect: true (default) probe common ports if base_url not provided

Example
{
  name: 'preview_screenshot',
  arguments: {
    mode: 'component',
    id: 'renderer/components/ui/Button.tsx#default',
    variant: 'default',
    props: { children: 'Click me' },
    needs: ['frame'],
    theme: 'light',
    width: 900,
    height: 500,
    out_file: 'tmp/screenshots/button_default.png'
  }
}

2) Screenshot any app URL
- name: preview_screenshot
- params:
  - mode: 'url'
  - url: '/preview.html?id=renderer/screens/TasksView.tsx' (relative, resolved against base_url) or absolute 'http://localhost:5173/preview.html?...'
  - Other capture options same as above.

3) Interactions and Before/After capture
- You can script simple interactions and capture before/after screenshots to visualize state changes.
- New parameters:
  - interactions: Array of steps. Steps are performed in order before the final (after) capture.
  - capture_before: boolean. If true (default when interactions are provided), a 'before' screenshot is captured prior to interactions.
  - before_out_file: optional file path for saving the BEFORE image.
  - out_file: remains the file path for saving the AFTER image.

Supported interaction steps (examples):
- { type: 'wait', ms: 500 }                          // wait 500ms
- { type: 'wait', selector: '#preview-stage button'} // wait for selector to appear
- { type: 'click', selector: '#preview-stage button', button: 'left', clickCount: 1 }
- { type: 'hover', selector: '.menu' }
- { type: 'focus', selector: 'input[name="q"]' }
- { type: 'type', selector: 'input[name="q"]', text: 'hello', delay: 20 }
- { type: 'set_value', selector: 'input[name="q"]', value: 'Preset' } // sets value + dispatches input/change
- { type: 'keypress', key: 'Enter' }
- { type: 'blur', selector: 'input[name="q"]' }
- { type: 'dispatch', selector: '#id', event: 'mouseover' }
- { type: 'scroll', selector: '.list', x: 0, y: 200 } // or without selector to scroll window

Return Value
- On success (no interactions): { ok: true, dataUrl, width, height, format, url, file? }
- On success (with interactions and/or capture_before):
  {
    ok: true,
    url,
    width,
    height,
    format,
    dataUrl,                 // AFTER image data URL (for convenience)
    before?: { dataUrl, file? },
    after: { dataUrl, file? }
  }
- On failure: { ok: false, error, reason?, url? }
  - reason can be: missing_dependency, no_base_url, missing_param

Notes
- The preview runtime now wraps content in a stable container with id="#preview-stage" which serves as a convenient default for waiting and clipping.
- The runtime also sets window.__PREVIEW_READY and dispatches a 'preview:ready' event after mounting.
- The preview runtime auto-applies theme and router providers. Use needs to include additional providers/mocks (frame, tasksMock, notificationsMock, llmMock).
- For complex props, you can set props_b64: true to base64-encode the props JSON (preview runtime supports props_b64=1).
- Full application routes may rely on Electron APIs; for best reliability, prefer component previews for UI pieces.

Troubleshooting
- "Puppeteer is not installed" → npm i -D puppeteer
- "No base_url found" → Set PREVIEW_BASE_URL or pass base_url.
- Black/blank screenshot → Add wait_selector and/or delay_ms to ensure render is complete. In component mode, '#preview-stage' is default.
- Variant selection → Pass variant: 'name' to set the URL hash (#name).
