# Agent Preview Run Tool

Overview
- The preview_run tool loads a component (via preview.html) or any app URL in a headless browser, performs scripted interactions, and evaluates DOM assertions or custom scripts to verify outcomes.
- It reuses the Preview Host runtime and Puppeteer, providing an isolated environment to self-check new code changes.

Prerequisites
- Dev server running and serving preview.html (e.g., Vite via electron-forge start).
- Provide base URL:
  - Pass base_url (e.g., http://localhost:5173),
  - Or set PREVIEW_BASE_URL,
  - Or rely on auto_detect (default) to probe common localhost ports.
- Install Puppeteer:
  - npm i -D puppeteer
  - Or puppeteer-core with PUPPETEER_EXECUTABLE_PATH/CHROME_PATH.

Parameters
- mode: 'component' | 'url' (default 'component')
- id: component module path under src/ with optional #ExportName (component mode)
- props, props_b64, needs, theme, variant: preview parameters
- url: absolute or relative (mode='url')
- base_url, auto_detect: resolve dev server base
- width, height, device_scale_factor: viewport
- wait_selector: selector to await before interactions/assertions (defaults to '#preview-stage' in component mode)
- delay_ms: extra wait before assertions
- interactions: array of steps to simulate behavior, same format as preview_screenshot tool
- asserts: array of assertion objects (see below)
- script: custom JS code to run in page context (returns JSON-serializable value)
- html_selector: optional selector to return outerHTML (e.g., '#preview-stage')
- timeout_ms: overall navigation wait timeout (default 30000)

Assertions
Supported assert types (each object should include type and relevant fields):
- dom_text: { type: 'dom_text', selector, equals?: string, contains?: string, regex?: string, regex_flags?: string }
- exists: { type: 'exists', selector, present?: boolean } // default present=true
- count: { type: 'count', selector, op?: 'eq'|'gte'|'lte'|'gt'|'lt', value: number }
- has_class: { type: 'has_class', selector, class: string, present?: boolean } // default present=true
- attr: { type: 'attr', selector, name: string, equals?: string, contains?: string, regex?: string, regex_flags?: string, present?: boolean }
- eval: { type: 'eval', expr?: string, fn?: Function, expect?: any }

Return Value
{
  ok: boolean,                  // true if all assertions passed
  url: string,                  // resolved URL used
  results: Array<{             // one result per assertion
    ok: boolean,               // evaluation succeeded (no execution error)
    type: string,
    pass?: boolean,            // assertion pass/fail (true if condition met)
    expected?: any,
    actual?: any,
    message?: string,
    error?: string
  }>,
  failures_count: number,      // number of failed assertions
  console_logs: Array<{ type?: string, text?: string }>,
  page_errors: string[],
  script_result?: any,         // result of custom script (if provided)
  html?: string,               // outerHTML if html_selector provided
  width: number,
  height: number
}

Examples
1) Verify button renders text
{
  name: 'preview_run',
  arguments: {
    mode: 'component',
    id: 'renderer/components/ui/Button.tsx#default',
    props: { children: 'Run' },
    asserts: [
      { type: 'dom_text', selector: '#preview-stage button', contains: 'Run' },
      { type: 'exists', selector: '#preview-stage button' }
    ]
  }
}

2) Interact then assert
{
  name: 'preview_run',
  arguments: {
    mode: 'component',
    id: 'renderer/components/ui/Button.tsx#default',
    interactions: [
      { type: 'click', selector: '#preview-stage button' },
      { type: 'wait', ms: 200 }
    ],
    asserts: [
      { type: 'has_class', selector: '#preview-stage button', class: 'active', present: true }
    ]
  }
}

3) Custom evaluation
{
  name: 'preview_run',
  arguments: {
    mode: 'url',
    url: '/preview.html?id=renderer/screens/TasksView.tsx',
    script: 'return document.querySelectorAll("[data-task]").length;'
  }
}

Notes
- The preview runtime exposes window.__PREVIEW_READY and renders content inside #preview-stage.
- For reliability, use #preview-stage-scoped selectors.
- Avoid non-serializable values from script.
- If you also need a screenshot for visual confirmation, combine with preview_screenshot.
