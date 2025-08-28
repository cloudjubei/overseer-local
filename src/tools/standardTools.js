const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

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

const standardToolFunctions = {
  async write_file({ filename, content }) {
    const fullPath = path.join(process.cwd(), filename);
    await fs.writeFile(fullPath, content, 'utf8');
    return 'File written.';
  },
  async read_files({ files }) {
    const contents = [];
    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(process.cwd(), file), 'utf8');
        contents.push(content);
      } catch (e) {
        contents.push(`Error: ${e.message}`);
      }
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
  }
};

module.exports = { standardToolSchemas, standardToolFunctions };