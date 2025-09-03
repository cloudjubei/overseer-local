const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const os = require('os');
const { Writable } = require('stream');
const { fileTools } = require('packages/factory-ts/src/fileTools')

// Try to load puppeteer, fall back to puppeteer-core, otherwise null
let puppeteer = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  puppeteer = require('puppeteer');
} catch (e) {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    puppeteer = require('puppeteer-core');
  } catch (e2) {
    puppeteer = null;
  }
}

const standardToolSchemas = [
  {
    name: 'write_file',
    description: 'Create or overwrite a file.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'read_files',
    description: 'Get content of files.',
    parameters: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string' } }
      },
      required: ['files']
    }
  },
  {
    name: 'list_files',
    description: 'Get content of directory at given path.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' } 
      },
      required: ['path']
    }
  },
  {
    name: 'search_files',
    description: 'Look for keywords inside files and their names.',
    parameters: {
      type: 'object',
      properties: {
        keywords: { type: 'array', items: { type: 'string' } }
      },
      required: ['keywords']
    }
  },
  {
    name: 'run_test',
    description: 'Run tests and get result.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'web_search_duckduckgo',
    description: 'Search the web using DuckDuckGo.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },
  {
    name: 'web_search_serpapi',
    description: 'Search the web using Google via SerpAPI. Requires SERPAPI_KEY in environment.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },
  {
    name: 'preview_screenshot',
    description: 'Render a component via the built-in preview.html (or any app URL) and return a screenshot as a data URL. Supports scripted interactions and before/after capture. Requires a running Vite dev server. Set PREVIEW_BASE_URL or pass base_url.',
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['component', 'url'], description: 'component: build preview.html URL; url: use provided absolute/relative URL' },
        // Component mode parameters
        id: { type: 'string', description: 'Module path under src/ with optional #ExportName, e.g., renderer/components/ui/Button.tsx#default' },
        props: { type: 'object', description: 'Props override object for the target export' },
        props_b64: { type: 'boolean', description: 'If true, encode props as base64 and set props_b64=1' },
        needs: { type: 'array', items: { type: 'string' }, description: 'Additional preview provider keys' },
        theme: { type: 'string', enum: ['light', 'dark', 'system'], description: 'Preview theme' },
        variant: { type: 'string', description: 'Variant name to select (hash portion), e.g., "loading"' },
        // URL mode parameter
        url: { type: 'string', description: 'Absolute or relative URL (relative resolved against base_url)' },
        // Interactions
        interactions: { type: 'array', description: 'Array of interaction steps to perform before the final capture', items: { type: 'object' } },
        capture_before: { type: 'boolean', description: 'If true (default when interactions provided), capture a before screenshot prior to interactions.' },
        // Shared capture options
        width: { type: 'number', description: 'Viewport width (CSS px). Default 1024' },
        height: { type: 'number', description: 'Viewport height (CSS px). Default 768' },
        device_scale_factor: { type: 'number', description: 'Device scale factor (pixel ratio). Default 1' },
        delay_ms: { type: 'number', description: 'Additional delay before capture (ms)' },
        wait_selector: { type: 'string', description: 'CSS selector to wait for before capture; defaults to #preview-stage in component mode' },
        clip_selector: { type: 'string', description: 'CSS selector of element to clip around for the screenshot' },
        base_url: { type: 'string', description: 'Base URL of the dev server, e.g., http://localhost:5173. Defaults to PREVIEW_BASE_URL or auto-detect.' },
        format: { type: 'string', enum: ['png', 'jpeg'], description: 'Screenshot format. Default png' },
        quality: { type: 'number', description: 'JPEG quality 0-100 (only for jpeg). Default 80' },
        out_file: { type: 'string', description: 'Optional file path to save the final (after) screenshot. If not provided, only dataUrl is returned.' },
        before_out_file: { type: 'string', description: 'Optional file path to save the before screenshot (when capture_before is true).' },
        auto_detect: { type: 'boolean', description: 'If true, try common localhost ports for base_url if not provided. Default true' }
      },
      required: []
    }
  },
  {
    name: 'ts_compile_check',
    description: 'Type-check and compile-validate a list of TypeScript/TSX files using the project\'s tsconfig.json. Returns per-file status and diagnostics without emitting output.',
    parameters: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string' }, description: 'List of file paths (relative to repo root) to check.' },
        tsconfig_path: { type: 'string', description: 'Optional path to tsconfig.json relative to repo root. Default tsconfig.json' }
      },
      required: ['files']
    }
  },
  {
    name: 'format_files',
    description: 'Format a list of files using Prettier and return per-file statuses (changed/unchanged/skipped/errors). Writes changes by default.',
    parameters: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string' }, description: 'List of file paths (relative to repo root) to format.' },
        write: { type: 'boolean', description: 'If true (default), write formatted content back to files. If false, only check and report if changes would be made.' },
        ignore_path: { type: 'string', description: 'Optional custom .prettierignore path (relative to repo root).' }
      },
      required: ['files']
    }
  },
  {
    name: 'preview_run',
    description: 'Load a component via preview.html (or any app URL) in an isolated headless browser, perform scripted interactions, and evaluate assertions or custom script to verify outcomes.',
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['component', 'url'], description: 'component: build preview.html URL; url: use provided absolute/relative URL' },
        id: { type: 'string', description: 'Module path under src/ with optional #ExportName, e.g., renderer/components/ui/Button.tsx#default' },
        props: { type: 'object', description: 'Props override object for the target export' },
        props_b64: { type: 'boolean', description: 'If true, encode props as base64 and set props_b64=1' },
        needs: { type: 'array', items: { type: 'string' }, description: 'Additional preview provider keys' },
        theme: { type: 'string', enum: ['light', 'dark', 'system'], description: 'Preview theme' },
        variant: { type: 'string', description: 'Variant name to select (hash portion)' },
        url: { type: 'string', description: 'Absolute or relative URL (relative resolved against base_url) when mode=url' },
        base_url: { type: 'string', description: 'Dev server base URL (e.g., http://localhost:5173). Defaults to PREVIEW_BASE_URL or auto-detect.' },
        auto_detect: { type: 'boolean', description: 'If true, try common localhost ports for base_url if not provided. Default true' },
        width: { type: 'number', description: 'Viewport width (CSS px). Default 1024' },
        height: { type: 'number', description: 'Viewport height (CSS px). Default 768' },
        device_scale_factor: { type: 'number', description: 'Device scale factor (pixel ratio). Default 1' },
        wait_selector: { type: 'string', description: 'CSS selector to wait for initial readiness; defaults to #preview-stage in component mode' },
        delay_ms: { type: 'number', description: 'Additional delay before running assertions (ms)' },
        interactions: { type: 'array', description: 'Array of interaction steps to perform before assertions (see preview_screenshot docs)', items: { type: 'object' } },
        asserts: { type: 'array', description: 'List of assertion objects to evaluate in the page. Supported types: dom_text, exists, count, has_class, attr, eval', items: { type: 'object' } },
        script: { type: 'string', description: 'Optional custom JS code to evaluate in the page context; should return a JSON-serializable value.' },
        html_selector: { type: 'string', description: 'Optional selector to return outerHTML for inspection (default none). Common: #preview-stage' },
        timeout_ms: { type: 'number', description: 'Overall timeout for navigation + waits (ms). Default 30000' }
      },
      required: []
    }
  },
  {
    name: 'docker_run',
    description: 'Run a command in an isolated, ephemeral Docker container using dockerode. Optionally mount provided files, capture stdout/stderr, enforce timeouts, and collect output files from the mounted workspace.',
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Docker image to run (e.g., node:20, python:3.11, ubuntu:latest).' },
        cmd: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'Command to run. If a string, executed via /bin/sh -lc.' },
        workdir: { type: 'string', description: 'Working directory inside the container. Defaults to mount_path.' },
        files: { type: 'object', description: 'Map of relative file paths to string content to be written into the mounted workspace before running.', additionalProperties: { type: 'string' } },
        mount_path: { type: 'string', description: 'Path in container where files are mounted. Default /workspace' },
        env: { type: 'array', items: { type: 'string' }, description: 'Environment variables as KEY=VALUE strings.' },
        stdin: { type: 'string', description: 'Optional stdin to pipe to the process.' },
        timeout_ms: { type: 'number', description: 'Max execution time in milliseconds before the container is stopped. Default 60000' },
        network: { type: 'boolean', description: 'If false, run with network disabled (NetworkMode=none). Default false' },
        mem_limit_mb: { type: 'number', description: 'Optional memory limit in megabytes.' },
        cpu_shares: { type: 'number', description: 'Optional relative CPU shares.' },
        pull: { type: 'boolean', description: 'If true, pull image before running even if present. Default true' },
        collect: { type: 'array', items: { type: 'string' }, description: 'Relative file paths under the workspace to read and return after run.' },
        max_collect_bytes: { type: 'number', description: 'Max bytes per collected file. Default 1048576 (1MB)' }
      },
      required: ['image']
    }
  }
];

async function ensureDirForFile(filePath) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  } catch (_) {
    // ignore
  }
}

function buildComponentPreviewUrl({ baseUrl, id, props, props_b64, needs, theme, variant }) {
  if (!id || typeof id !== 'string') throw new Error('preview_screenshot: id is required for mode="component"');
  const usp = new URLSearchParams();
  usp.set('id', id);
  if (props && typeof props === 'object') {
    const json = JSON.stringify(props);
    if (props_b64) {
      const b64 = Buffer.from(json, 'utf8').toString('base64');
      usp.set('props', b64);
      usp.set('props_b64', '1');
    } else {
      usp.set('props', encodeURIComponent(json));
    }
  }
  if (Array.isArray(needs) && needs.length) usp.set('needs', needs.join(','));
  if (theme) usp.set('theme', theme);
  const hash = variant ? `#${encodeURIComponent(variant)}` : '';
  return `${baseUrl.replace(/\/$/, '')}/preview.html?${usp.toString()}${hash}`;
}

async function probeBaseUrl(hint) {
  const candidates = [];
  if (hint) candidates.push(hint);
  if (process.env.PREVIEW_BASE_URL) candidates.push(process.env.PREVIEW_BASE_URL);
  // Common dev ports
  const portsA = Array.from({ length: 8 }, (_, i) => 5173 + i);
  const portsB = Array.from({ length: 11 }, (_, i) => 3000 + i);
  for (const p of [...portsA, ...portsB]) {
    candidates.push(`http://localhost:${p}`);
    candidates.push(`http://127.0.0.1:${p}`);
  }
  // Dedupe while preserving order
  const seen = new Set();
  const unique = candidates.filter((c) => {
    if (!c) return false;
    const k = c.replace(/\/$/, '').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (const base of unique) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/preview.html`, { method: 'GET' });
      if (res.ok) return base;
    } catch (_) {
      // try next
    }
  }
  return null;
}

async function saveDataUrlToFile(dataUrl, outPath, format) {
  if (!outPath) return null;
  const ext = format === 'jpeg' ? '.jpg' : '.png';
  const filePath = path.isAbsolute(outPath) ? outPath : path.join(process.cwd(), outPath);
  const finalPath = filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? filePath : (filePath + ext);
  const b64 = dataUrl.split(',')[1];
  await ensureDirForFile(finalPath);
  await fs.writeFile(finalPath, Buffer.from(b64, 'base64'));
  return finalPath;
}

async function capturePage(page, { wait_selector, delay_ms, clip_selector, format, quality }) {
  if (wait_selector) {
    await page.waitForSelector(wait_selector, { timeout: 20000 });
  }
  if (delay_ms && delay_ms > 0) {
    await new Promise((r) => setTimeout(r, delay_ms));
  }
  let clip;
  if (clip_selector) {
    const rect = await page.$eval(clip_selector, (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(0, r.width), height: Math.max(0, r.height) };
    });
    if (rect && rect.width > 0 && rect.height > 0) {
      clip = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
    }
  }
  const opts = { type: format === 'jpeg' ? 'jpeg' : 'png', encoding: 'base64' };
  if (clip) opts.clip = clip;
  if (opts.type === 'jpeg') opts.quality = typeof quality === 'number' ? Math.max(0, Math.min(100, Math.floor(quality))) : 80;
  const base64 = await page.screenshot(opts);
  const mime = opts.type === 'jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = `data:${mime};base64,${base64}`;
  return { dataUrl, format: opts.type };
}

async function performInteractions(page, steps = []) {
  for (const step of steps) {
    const { type } = step || {};
    try {
      switch (type) {
        case 'wait': {
          const { ms, selector, timeout = 20000 } = step;
          if (selector) await page.waitForSelector(selector, { timeout });
          else if (typeof ms === 'number') await page.waitForTimeout(ms);
          break;
        }
        case 'click': {
          const { selector, button = 'left', clickCount = 1, delay } = step;
          await page.click(selector, { button, clickCount, delay });
          break;
        }
        case 'hover': {
          const { selector } = step;
          await page.hover(selector);
          break;
        }
        case 'focus': {
          const { selector } = step;
          await page.focus(selector);
          break;
        }
        case 'blur': {
          const { selector } = step;
          await page.$eval(selector, (el) => (el instanceof HTMLElement ? el.blur() : undefined));
          break;
        }
        case 'type': {
          const { selector, text = '', delay = 0 } = step;
          await page.type(selector, text, { delay });
          break;
        }
        case 'set_value': {
          const { selector, value } = step;
          await page.$eval(
            selector,
            (el, v) => {
              const anyEl = el;
              if ('value' in anyEl) {
                anyEl.value = v;
                anyEl.dispatchEvent(new Event('input', { bubbles: true }));
                anyEl.dispatchEvent(new Event('change', { bubbles: true }));
              }
            },
            value
          );
          break;
        }
        case 'keypress': {
          const { key } = step;
          await page.keyboard.press(key);
          break;
        }
        case 'dispatch': {
          const { selector, event = 'click' } = step;
          await page.$eval(
            selector,
            (el, evt) => {
              el.dispatchEvent(new Event(evt, { bubbles: true }));
            },
            event
          );
          break;
        }
        case 'scroll': {
          const { selector, x = 0, y = 0 } = step;
          if (selector) {
            await page.$eval(selector, (el, dx, dy) => el.scrollBy(dx, dy), x, y);
          } else {
            await page.evaluate((dx, dy) => window.scrollBy(dx, dy), x, y);
          }
          break;
        }
        default:
          // unknown step: ignore
          break;
      }
    } catch (e) {
      // Continue on interaction errors to avoid blocking overall capture
      // eslint-disable-next-line no-console
      console.warn('Interaction step failed:', step, e);
    }
  }
}

async function captureWithPuppeteer({ url, width = 1024, height = 768, device_scale_factor = 1, wait_selector, delay_ms, clip_selector, format = 'png', quality = 80 }) {
  if (!puppeteer) {
    return {
      ok: false,
      error: 'Puppeteer is not installed. Please add devDependency "puppeteer" or "puppeteer-core", or supply screenshots by another means.',
      reason: 'missing_dependency',
      url
    };
  }
  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };
  // For puppeteer-core, allow executable path via env
  if (puppeteer && (!puppeteer.executablePath || typeof puppeteer.executablePath !== 'function')) {
    const exe = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || process.env.CHROMIUM_PATH;
    if (exe) launchOptions.executablePath = exe;
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: device_scale_factor || 1 });

    await page.goto(url, { waitUntil: wait_selector ? 'domcontentloaded' : 'networkidle0', timeout: 30000 });
    if (wait_selector) {
      await page.waitForSelector(wait_selector, { timeout: 15000 });
    }
    if (delay_ms && delay_ms > 0) {
      await new Promise((r) => setTimeout(r, delay_ms));
    }

    let clip;
    if (clip_selector) {
      const rect = await page.$eval(clip_selector, (el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(0, r.width), height: Math.max(0, r.height) };
      });
      if (rect && rect.width > 0 && rect.height > 0) {
        clip = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
      }
    }

    const opts = { type: format === 'jpeg' ? 'jpeg' : 'png', encoding: 'base64' };
    if (clip) opts.clip = clip;
    if (opts.type === 'jpeg') opts.quality = typeof quality === 'number' ? Math.max(0, Math.min(100, Math.floor(quality))) : 80;

    const base64 = await page.screenshot(opts);
    const mime = opts.type === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = `data:${mime};base64,${base64}`;

    await page.close();
    await browser.close();

    return { ok: true, dataUrl, width, height, format: opts.type, url };
  } catch (error) {
    try { if (browser) await browser.close(); } catch (_) {}
    return { ok: false, error: String(error?.message || error), url };
  }
}

async function makeTempDir(prefix = 'agent-run-') {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return base;
}

async function writeFilesToDir(root, filesMap) {
  if (!filesMap || typeof filesMap !== 'object') return [];
  const written = [];
  for (const [rel, content] of Object.entries(filesMap)) {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
    written.push(rel);
  }
  return written;
}

async function collectFilesFromDir(root, pathsList = [], maxBytes = 1048576) {
  const results = [];
  for (const rel of pathsList) {
    try {
      const full = path.join(root, rel);
      const stat = await fs.stat(full);
      if (!stat.isFile()) {
        results.push({ path: rel, ok: false, reason: 'not_file' });
        continue;
      }
      const size = stat.size;
      let truncated = false;
      let data;
      if (size > maxBytes) {
        const fh = await fs.open(full, 'r');
        const buf = Buffer.allocUnsafe(maxBytes);
        await fh.read(buf, 0, maxBytes, 0);
        await fh.close();
        data = buf;
        truncated = true;
      } else {
        data = await fs.readFile(full);
      }
      const base64 = data.toString('base64');
      results.push({ path: rel, ok: true, size, base64, truncated });
    } catch (e) {
      results.push({ path: rel, ok: false, reason: 'error', message: String(e?.message || e) });
    }
  }
  return results;
}

const standardToolFunctions = {
  async write_file({ filename, content }) {
    return await fileTools.writeFile(filename, content)
  },
  async read_files({ files }) {
    return await fileTools.readFiles(files)
  },
  async list_files({ path }) {
    return await fileTools.listFiles(path)
  },
  async search_files({ keywords }) {
    const results = new Set();
    for (const keyword of keywords) {
        const matches = await fileTools.searchFiles(keyword);
        matches.forEach(match => results.add(match));
    }
    return contents;
  },
  run_test() {
    return 'Test results.';
  },
  async web_search_duckduckgo({ query }) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    let results = data.Abstract ? [data.Abstract] : [];
    if (data.RelatedTopics) {
      results = results.concat(data.RelatedTopics.map(t => t.Text));
    }
    return results.join('\n') || 'No results found.';
  },
  async web_search_serpapi({ query }) {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) return 'SerpAPI key not set.';
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const results = data.organic_results ? data.organic_results.map(r => `${r.title}: ${r.snippet}`) : [];
    return results.join('\n') || 'No results found.';
  },
  async preview_screenshot(params = {}) {
    const {
      mode = 'component',
      id,
      props,
      props_b64 = false,
      needs = [],
      theme,
      variant,
      url: urlParam,
      width = 1024,
      height = 768,
      device_scale_factor = 1,
      delay_ms = 0,
      wait_selector: waitSelectorParam,
      clip_selector,
      base_url,
      format = 'png',
      quality = 80,
      out_file,
      before_out_file,
      auto_detect = true,
      interactions = [],
      capture_before,
    } = params || {};

    // Resolve base URL
    let baseUrl = base_url || process.env.PREVIEW_BASE_URL || null;
    if ((!baseUrl || baseUrl.trim() === '') && auto_detect) {
      baseUrl = await probeBaseUrl();
    }

    // If interactions are provided, we run an interactive session in Puppeteer to allow before/after.
    const hasInteractions = Array.isArray(interactions) && interactions.length > 0;
    const shouldCaptureBefore = typeof capture_before === 'boolean' ? capture_before : hasInteractions;

    // Build final URL
    let finalUrl = '';
    if (mode === 'component') {
      if (!baseUrl) {
        const hint = 'No base_url found. Set PREVIEW_BASE_URL or pass base_url. Example: http://localhost:5173';
        return { ok: false, error: hint, reason: 'no_base_url', id };
      }
      finalUrl = buildComponentPreviewUrl({ baseUrl, id, props, props_b64, needs, theme, variant });
    } else {
      finalUrl = urlParam || '';
      const isAbsolute = /^https?:\/\//i.test(finalUrl);
      if (!isAbsolute) {
        if (!baseUrl) {
          const hint = 'Relative url used but no base_url found. Set PREVIEW_BASE_URL or pass base_url.';
          return { ok: false, error: hint, reason: 'no_base_url' };
        }
        finalUrl = `${baseUrl.replace(/\/$/, '')}/${finalUrl.replace(/^\//, '')}`;
      }
    }

    // Default wait selector for component previews is the stage container
    const wait_selector = waitSelectorParam || (mode === 'component' ? '#preview-stage' : undefined);

    if (hasInteractions || shouldCaptureBefore) {
      if (!puppeteer) {
        return {
          ok: false,
          error: 'Puppeteer is not installed. Install "puppeteer" or "puppeteer-core" to use interactions/before-after capture.',
          reason: 'missing_dependency',
          url: finalUrl,
        };
      }

      const launchOptions = {
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      };
      if (puppeteer && (!puppeteer.executablePath || typeof puppeteer.executablePath !== 'function')) {
        const exe = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || process.env.CHROMIUM_PATH;
        if (exe) launchOptions.executablePath = exe;
      }

      let browser;
      try {
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        await page.setViewport({ width, height, deviceScaleFactor: device_scale_factor || 1 });

        await page.goto(finalUrl, { waitUntil: wait_selector ? 'domcontentloaded' : 'networkidle0', timeout: 30000 });
        if (wait_selector) {
          await page.waitForSelector(wait_selector, { timeout: 20000 });
        }
        // Also wait for preview readiness event/flag if present
        try {
          await page.waitForFunction(() => !!window.__PREVIEW_READY, { timeout: 5000 });
        } catch (_) { /* ignore */ }

        const before = shouldCaptureBefore ? await capturePage(page, { wait_selector, delay_ms, clip_selector, format, quality }) : null;

        if (hasInteractions) {
          await performInteractions(page, interactions);
        }

        const after = await capturePage(page, { wait_selector, delay_ms, clip_selector, format, quality });

        await page.close();
        await browser.close();

        // Save files if requested
        let beforeFile = null;
        let afterFile = null;
        if (before && before_out_file) beforeFile = await saveDataUrlToFile(before.dataUrl, before_out_file, before.format);
        if (after && out_file) afterFile = await saveDataUrlToFile(after.dataUrl, out_file, after.format);

        return {
          ok: true,
          url: finalUrl,
          width,
          height,
          format: after.format,
          dataUrl: after.dataUrl, // final capture (after interactions)
          before: { dataUrl: before ? before.dataUrl : undefined, file: before ? beforeFile : undefined },
          after: { dataUrl: after.dataUrl, file: afterFile },
        };
      } catch (error) {
        try { if (browser) await browser.close(); } catch (_) {}
        return { ok: false, error: String(error?.message || error), url: finalUrl };
      }
    }

    // No interactions and no before/after requested: do a simple one-shot capture
    const result = await captureWithPuppeteer({ url: finalUrl, width, height, device_scale_factor, wait_selector, delay_ms, clip_selector, format, quality });
    if (result.ok && out_file) {
      const saved = await saveDataUrlToFile(result.dataUrl, out_file, format);
      return { ...result, file: saved };
    }
    return result;
  },
  async ts_compile_check({ files, tsconfig_path = 'tsconfig.json' }) {
    if (!Array.isArray(files) || files.length === 0) {
      return { ok: false, error: 'files array is required and must be non-empty.' };
    }

    let ts;
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies, global-require
      ts = require('typescript');
    } catch (e) {
      return { ok: false, error: 'TypeScript is not installed. Please add devDependency "typescript".' };
    }

    const cwd = process.cwd();
    const resolveRel = (p) => path.isAbsolute(p) ? p : path.join(cwd, p);

    // Load tsconfig
    const tsconfigFull = resolveRel(tsconfig_path);
    let compilerOptions = {};
    let basePath = cwd;
    try {
      const cfg = ts.readConfigFile(tsconfigFull, ts.sys.readFile);
      if (cfg.error) {
        // Continue with defaults but report config error at top-level
        const msg = ts.flattenDiagnosticMessageText(cfg.error.messageText, '\n');
        return { ok: false, error: `Failed to read tsconfig: ${msg}` };
      }
      basePath = path.dirname(tsconfigFull);
      const parsed = ts.parseJsonConfigFileContent(cfg.config || {}, ts.sys, basePath);
      if (parsed.errors && parsed.errors.length) {
        const msgs = parsed.errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n');
        return { ok: false, error: `Failed to parse tsconfig: ${msgs}` };
      }
      compilerOptions = parsed.options || {};
      // Ensure noEmit true for checking only
      compilerOptions.noEmit = true;
    } catch (e) {
      // Fallback to sane defaults if cannot read config
      compilerOptions = { noEmit: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, moduleResolution: ts.ModuleResolutionKind.Bundler };
      basePath = cwd;
    }

    // Helper to format diagnostics into plain objects
    const formatDiag = (diag) => {
      const categoryMap = { 0: 'Warning', 1: 'Error', 2: 'Suggestion', 3: 'Message' };
      const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
      const code = diag.code;
      const category = categoryMap[diag.category] || String(diag.category);
      let file = undefined;
      let line = undefined;
      let character = undefined;
      let endLine = undefined;
      let endCharacter = undefined;
      if (diag.file && typeof diag.start === 'number') {
        const sf = diag.file;
        const { line: l, character: c } = sf.getLineAndCharacterOfPosition(diag.start);
        file = path.relative(cwd, sf.fileName);
        line = l + 1;
        character = c + 1;
        if (typeof diag.length === 'number') {
          const endPos = diag.start + diag.length;
          const ec = sf.getLineAndCharacterOfPosition(endPos);
          endLine = ec.line + 1;
          endCharacter = ec.character + 1;
        }
      }
      return { category, code, message, file, line, character, endLine, endCharacter };
    };

    const results = [];
    let errorsTotal = 0;
    let warningsTotal = 0;

    // Check existence first
    const existMap = new Map();
    for (const rel of files) {
      const full = resolveRel(rel);
      try {
        const stat = await fs.stat(full);
        if (!stat.isFile()) throw new Error('Not a file');
        existMap.set(rel, { full, exists: true });
      } catch (_) {
        existMap.set(rel, { full, exists: false });
      }
    }

    for (const rel of files) {
      const info = existMap.get(rel);
      if (!info || !info.exists) {
        results.push({ file: rel, ok: false, reason: 'not_found', errors_count: 1, warnings_count: 0, diagnostics: [{ category: 'Error', code: 0, message: 'File not found', file: rel }] });
        errorsTotal += 1;
        continue;
      }

      const start = Date.now();
      try {
        const rootNames = [info.full];
        const program = ts.createProgram({ rootNames, options: compilerOptions });
        const sourceFile = program.getSourceFile(info.full);

        // Collect diagnostics scoped to this file
        const syntactic = sourceFile ? program.getSyntacticDiagnostics(sourceFile) : program.getSyntacticDiagnostics();
        const semantic = sourceFile ? program.getSemanticDiagnostics(sourceFile) : program.getSemanticDiagnostics();
        const optionsDiags = program.getOptionsDiagnostics();

        // Merge and filter to this file when possible
        const all = [...syntactic, ...semantic, ...optionsDiags];
        const formatted = all.map(formatDiag);

        const errors = formatted.filter(d => d.category === 'Error');
        const warnings = formatted.filter(d => d.category === 'Warning');
        errorsTotal += errors.length;
        warningsTotal += warnings.length;

        const ok = errors.length === 0;
        const time_ms = Date.now() - start;
        results.push({ file: rel, ok, errors_count: errors.length, warnings_count: warnings.length, diagnostics: formatted, time_ms });
      } catch (e) {
        const time_ms = Date.now() - start;
        results.push({ file: rel, ok: false, errors_count: 1, warnings_count: 0, diagnostics: [{ category: 'Error', code: 0, message: String(e?.message || e), file: rel }], time_ms });
        errorsTotal += 1;
      }
    }

    const okAll = results.every(r => r.ok);
    return { ok: okAll, results, errors_total: errorsTotal, warnings_total: warningsTotal };
  },
  async format_files({ files, write = true, ignore_path }) {
    if (!Array.isArray(files) || files.length === 0) {
      return { ok: false, error: 'files array is required and must be non-empty.' };
    }

    // Prettier is ESM in v3+, import dynamically
    let prettier;
    try {
      // eslint-disable-next-line global-require
      const mod = await import('prettier');
      prettier = mod;
    } catch (e) {
      return { ok: false, error: 'Prettier is not installed. Please add devDependency "prettier".' };
    }

    const cwd = process.cwd();
    const resolveRel = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));

    const results = [];
    let changedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const rel of files) {
      const full = resolveRel(rel);
      const start = Date.now();
      try {
        // Ensure file exists
        const st = await fs.stat(full).catch(() => null);
        if (!st || !st.isFile()) {
          errorCount += 1;
          results.push({ file: rel, ok: false, reason: 'not_found', message: 'File not found', changed: false, skipped: false, time_ms: Date.now() - start });
          continue;
        }

        // Check ignore rules and infer parser
        const info = await prettier.getFileInfo(full, {
          ignorePath: ignore_path ? resolveRel(ignore_path) : undefined,
          // Let prettier search for plugins relative to project root
          pluginSearchDirs: [cwd]
        });
        if (info.ignored) {
          skippedCount += 1;
          results.push({ file: rel, ok: true, skipped: true, reason: 'ignored', changed: false, time_ms: Date.now() - start });
          continue;
        }

        const source = await fs.readFile(full, 'utf8');
        const config = await prettier.resolveConfig(full).catch(() => null);
        const options = { ...(config || {}), filepath: full };

        let formatted;
        try {
          formatted = await prettier.format(source, options);
        } catch (formatErr) {
          errorCount += 1;
          results.push({ file: rel, ok: false, skipped: false, changed: false, reason: 'format_error', message: String(formatErr?.message || formatErr), time_ms: Date.now() - start });
          continue;
        }

        const changed = formatted !== source;
        if (changed && write) {
          await fs.writeFile(full, formatted, 'utf8');
        }
        if (changed) changedCount += 1;

        results.push({ file: rel, ok: true, skipped: false, changed, written: Boolean(write && changed), time_ms: Date.now() - start });
      } catch (e) {
        errorCount += 1;
        results.push({ file: rel, ok: false, skipped: false, changed: false, reason: 'error', message: String(e?.message || e), time_ms: Date.now() - start });
      }
    }

    const okAll = results.every(r => r.ok);
    return { ok: okAll, results, changed_count: changedCount, skipped_count: skippedCount, error_count: errorCount };
  },
  async preview_run(params = {}) {
    const {
      mode = 'component',
      id,
      props,
      props_b64 = false,
      needs = [],
      theme,
      variant,
      url: urlParam,
      base_url,
      auto_detect = true,
      width = 1024,
      height = 768,
      device_scale_factor = 1,
      wait_selector: waitSelectorParam,
      delay_ms = 0,
      interactions = [],
      asserts = [],
      script,
      html_selector,
      timeout_ms = 30000,
    } = params || {};

    if (!puppeteer) {
      return { ok: false, error: 'Puppeteer is not installed. Install "puppeteer" or "puppeteer-core" to use preview_run.', reason: 'missing_dependency' };
    }

    // Resolve base URL
    let baseUrl = base_url || process.env.PREVIEW_BASE_URL || null;
    if ((!baseUrl || baseUrl.trim() === '') && auto_detect) {
      baseUrl = await probeBaseUrl();
    }

    // Build final URL
    let finalUrl = '';
    if (mode === 'component') {
      if (!baseUrl) {
        const hint = 'No base_url found. Set PREVIEW_BASE_URL or pass base_url. Example: http://localhost:5173';
        return { ok: false, error: hint, reason: 'no_base_url', id };
      }
      finalUrl = buildComponentPreviewUrl({ baseUrl, id, props, props_b64, needs, theme, variant });
    } else {
      finalUrl = urlParam || '';
      const isAbsolute = /^https?:\/\//i.test(finalUrl);
      if (!isAbsolute) {
        if (!baseUrl) {
          const hint = 'Relative url used but no base_url found. Set PREVIEW_BASE_URL or pass base_url.';
          return { ok: false, error: hint, reason: 'no_base_url' };
        }
        finalUrl = `${baseUrl.replace(/\/$/, '')}/${finalUrl.replace(/^\//, '')}`;
      }
    }

    // Default wait selector for component previews is the stage container
    const wait_selector = waitSelectorParam || (mode === 'component' ? '#preview-stage' : undefined);

    // Launch browser
    const launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (puppeteer && (!puppeteer.executablePath || typeof puppeteer.executablePath !== 'function')) {
      const exe = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || process.env.CHROMIUM_PATH;
      if (exe) launchOptions.executablePath = exe;
    }

    let browser;
    let page;
    const consoleLogs = [];
    const pageErrors = [];

    try {
      browser = await puppeteer.launch(launchOptions);
      page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: device_scale_factor || 1 });

      page.on('console', (msg) => {
        try {
          const args = msg.args ? msg.args().map(() => null) : [];
          consoleLogs.push({ type: msg.type?.(), text: msg.text?.(), location: msg.location?.() || null, args_count: args.length });
        } catch (_) {
          consoleLogs.push({ type: 'log', text: msg.text?.() });
        }
      });
      page.on('pageerror', (err) => {
        pageErrors.push(String(err?.message || err));
      });

      await page.goto(finalUrl, { waitUntil: wait_selector ? 'domcontentloaded' : 'networkidle0', timeout: timeout_ms });
      if (wait_selector) {
        await page.waitForSelector(wait_selector, { timeout: Math.max(5000, Math.min(20000, timeout_ms)) });
      }
      try {
        await page.waitForFunction(() => !!window.__PREVIEW_READY, { timeout: 5000 });
      } catch (_) { /* ignore */ }

      if (delay_ms && delay_ms > 0) {
        await page.waitForTimeout(delay_ms);
      }

      if (Array.isArray(interactions) && interactions.length > 0) {
        await performInteractions(page, interactions);
      }

      const results = [];

      // Assertion runners executed in page context
      async function runOne(a) {
        try {
          const res = await page.evaluate((assert) => {
            function toRegex(rx, flags) {
              try { return new RegExp(rx, flags || undefined); } catch (_) { return null; }
            }
            function cmpText(actual, assert) {
              if (typeof assert.equals === 'string') return { pass: actual === assert.equals, expected: assert.equals, actual };
              if (typeof assert.contains === 'string') return { pass: actual.includes(assert.contains), expected: `contains:${assert.contains}`, actual };
              if (typeof assert.regex === 'string') {
                const re = toRegex(assert.regex, assert.regex_flags);
                if (!re) return { pass: false, expected: `regex:${assert.regex}`, actual, message: 'Invalid regex' };
                return { pass: re.test(actual), expected: `regex:${assert.regex}` , actual };
              }
              return { pass: true, actual };
            }
            function countCompare(count, op, value) {
              switch (op) {
                case 'eq': return { pass: count === value };
                case 'gte': return { pass: count >= value };
                case 'lte': return { pass: count <= value };
                case 'gt': return { pass: count > value };
                case 'lt': return { pass: count < value };
                default: return { pass: false, message: `Unknown op ${op}` };
              }
            }

            const type = assert.type || 'eval';
            if (type === 'dom_text') {
              const el = document.querySelector(assert.selector);
              if (!el) return { type, pass: false, message: `Element not found: ${assert.selector}` };
              const text = (el.textContent || '').trim();
              const c = cmpText(text, assert);
              return { type, pass: c.pass, expected: c.expected, actual: c.actual, message: c.message };
            }
            if (type === 'exists') {
              const count = document.querySelectorAll(assert.selector).length;
              const present = count > 0;
              const expected = assert.present !== false; // default true
              const pass = expected ? present : !present;
              return { type, pass, expected, actual: present, count };
            }
            if (type === 'count') {
              const count = document.querySelectorAll(assert.selector).length;
              const op = assert.op || 'eq';
              const value = Number(assert.value || 0);
              const r = countCompare(count, op, value);
              return { type, pass: r.pass, op, value, actual: count, message: r.message };
            }
            if (type === 'has_class') {
              const el = document.querySelector(assert.selector);
              if (!el) return { type, pass: assert.present === false ? true : false, message: `Element not found: ${assert.selector}` };
              const present = el.classList.contains(assert.class);
              const expected = assert.present !== false; // default true
              const pass = expected ? present : !present;
              return { type, pass, expected, class: assert.class, actual: present };
            }
            if (type === 'attr') {
              const el = document.querySelector(assert.selector);
              if (!el) return { type, pass: false, message: `Element not found: ${assert.selector}` };
              const val = el.getAttribute(assert.name);
              if (typeof assert.equals === 'string' || typeof assert.contains === 'string' || typeof assert.regex === 'string') {
                const c = cmpText(val ?? '', assert);
                return { type, pass: c.pass, expected: c.expected, actual: c.actual, message: c.message, name: assert.name };
              }
              const present = val != null;
              const expected = assert.present !== false; // default true
              const pass = expected ? present : !present;
              return { type, pass, expected, name: assert.name, actual: val };
            }
            if (type === 'eval') {
              let value;
              try {
                // Treat expr as a JS expression; avoid Function constructor for safety if possible
                if (typeof assert.expr === 'string' && assert.expr.trim()) {
                  // eslint-disable-next-line no-new-func
                  const fn = new Function(`return (${assert.expr})`);
                  value = fn();
                } else if (typeof assert.fn === 'function') {
                  value = assert.fn();
                } else {
                  value = null;
                }
              } catch (e) {
                return { type, pass: false, error: String(e?.message || e) };
              }
              if (Object.prototype.hasOwnProperty.call(assert, 'expect')) {
                const pass = JSON.stringify(value) === JSON.stringify(assert.expect);
                return { type, pass, expected: assert.expect, actual: value };
              }
              return { type, pass: true, actual: value };
            }

            return { type, pass: false, message: `Unknown assertion type: ${type}` };
          }, a);
          return { ok: true, ...res };
        } catch (e) {
          return { ok: false, type: a?.type, error: String(e?.message || e) };
        }
      }

      for (const a of Array.isArray(asserts) ? asserts : []) {
        // eslint-disable-next-line no-await-in-loop
        const r = await runOne(a);
        results.push(r);
      }

      let scriptResult = undefined;
      if (typeof script === 'string' && script.trim()) {
        try {
          // eslint-disable-next-line no-new-func
          const code = `(function(){ ${script}\n})();`;
          scriptResult = await page.evaluate(new Function(`return ${JSON.stringify(code)}`));
        } catch (e) {
          scriptResult = { error: String(e?.message || e) };
        }
      }

      let html = undefined;
      if (typeof html_selector === 'string' && html_selector.trim()) {
        try {
          html = await page.$eval(html_selector, (el) => el.outerHTML);
        } catch (e) {
          html = undefined;
        }
      }

      const failed = results.filter((r) => !(r && r.ok !== false && r.pass !== false)).length;

      await page.close();
      await browser.close();

      return {
        ok: failed === 0,
        url: finalUrl,
        results,
        failures_count: failed,
        console_logs: consoleLogs,
        page_errors: pageErrors,
        script_result: scriptResult,
        html,
        width,
        height
      };
    } catch (error) {
      try { if (page) await page.close(); } catch (_) {}
      try { if (browser) await browser.close(); } catch (_) {}
      return { ok: false, error: String(error?.message || error), url: finalUrl };
    }
  },
  async docker_run(params = {}) {
    const {
      image,
      cmd,
      workdir,
      files,
      mount_path = '/workspace',
      env = [],
      stdin,
      timeout_ms = 60000,
      network = false,
      mem_limit_mb,
      cpu_shares,
      pull = true,
      collect = [],
      max_collect_bytes = 1048576,
    } = params || {};

    if (!image || typeof image !== 'string') {
      return { ok: false, error: 'image is required' };
    }

    let Docker;
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies, global-require
      Docker = require('dockerode');
    } catch (e) {
      return { ok: false, error: 'dockerode is not installed. Please add dependency "dockerode".' };
    }

    let docker;
    try {
      docker = new Docker();
      await docker.ping();
    } catch (e) {
      return { ok: false, error: 'Docker daemon not available. Ensure Docker is installed and running.' };
    }

    async function ensureImage(img, doPull) {
      try {
        await docker.getImage(img).inspect();
        if (!doPull) return;
      } catch (_) {
        // not present, will pull regardless of doPull
      }
      if (doPull) {
        const stream = await docker.pull(img);
        await new Promise((resolve, reject) => {
          docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
        });
      }
    }

    const startTime = Date.now();
    let tempDir;
    let container;
    let attachStream;
    let timedOut = false;
    const stdoutChunks = [];
    const stderrChunks = [];

    try {
      await ensureImage(image, !!pull);

      tempDir = await makeTempDir('agent-docker-');
      const written = await writeFilesToDir(tempDir, files);

      const finalCmd = Array.isArray(cmd) ? cmd : ['/bin/sh', '-lc', typeof cmd === 'string' && cmd.trim() ? cmd : ''];

      const createOpts = {
        Image: image,
        Cmd: finalCmd,
        WorkingDir: workdir || mount_path,
        Tty: false,
        OpenStdin: typeof stdin === 'string',
        StdinOnce: typeof stdin === 'string',
        Env: Array.isArray(env) && env.length ? env : undefined,
        HostConfig: {
          Binds: [`${tempDir}:${mount_path}:rw`],
          AutoRemove: true,
          NetworkMode: network ? undefined : 'none',
          Memory: mem_limit_mb ? Math.max(0, Math.floor(mem_limit_mb)) * 1024 * 1024 : undefined,
          CpuShares: cpu_shares ? Number(cpu_shares) : undefined,
        },
      };

      container = await docker.createContainer(createOpts);

      // Attach before start to catch all output
      attachStream = await container.attach({ stream: true, stdout: true, stderr: true, stdin: typeof stdin === 'string' });

      // Demux stdout/stderr
      const outWritable = new Writable({
        write(chunk, enc, cb) { stdoutChunks.push(chunk); cb(); }
      });
      const errWritable = new Writable({
        write(chunk, enc, cb) { stderrChunks.push(chunk); cb(); }
      });
      docker.modem.demuxStream(attachStream, outWritable, errWritable);

      await container.start();

      if (typeof stdin === 'string') {
        attachStream.write(stdin);
        try { attachStream.end(); } catch (_) { /* ignore */ }
      }

      let timeoutHandle = null;
      if (timeout_ms && timeout_ms > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          // Force stop immediately
          container.stop({ t: 0 }).catch(() => {});
        }, timeout_ms);
      }

      const waitRes = await container.wait();
      if (timeoutHandle) clearTimeout(timeoutHandle);

      const exitCode = waitRes?.StatusCode ?? null;

      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');

      // Collect requested files from mounted workspace
      const collected = Array.isArray(collect) && collect.length
        ? await collectFilesFromDir(tempDir, collect, typeof max_collect_bytes === 'number' ? max_collect_bytes : 1048576)
        : [];

      const duration_ms = Date.now() - startTime;

      return { ok: !timedOut && (exitCode === 0), image, cmd: finalCmd, exit_code: exitCode, timed_out: timedOut, duration_ms, stdout, stderr, written_files: Array.isArray(files) ? files : undefined, collected, mount_path, workdir: workdir || mount_path };
    } catch (e) {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      return { ok: false, error: String(e?.message || e), image, timed_out: timedOut, stdout, stderr };
    } finally {
      try { if (attachStream) attachStream.destroy(); } catch (_) {}
      // temp dirs are auto-removed if possible
      try { if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
};

module.exports = { standardToolSchemas, standardToolFunctions };