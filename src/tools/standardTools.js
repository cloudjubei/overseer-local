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
    description: 'Render a component via the built-in preview.html (or any app URL) and return a screenshot as a data URL. Requires a running Vite dev server. Set PREVIEW_BASE_URL or pass base_url.',
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
        // Shared capture options
        width: { type: 'number', description: 'Viewport width (CSS px). Default 1024' },
        height: { type: 'number', description: 'Viewport height (CSS px). Default 768' },
        device_scale_factor: { type: 'number', description: 'Device scale factor (pixel ratio). Default 1' },
        delay_ms: { type: 'number', description: 'Additional delay before capture (ms)' },
        wait_selector: { type: 'string', description: 'CSS selector to wait for before capture' },
        clip_selector: { type: 'string', description: 'CSS selector of element to clip around for the screenshot' },
        base_url: { type: 'string', description: 'Base URL of the dev server, e.g., http://localhost:5173. Defaults to PREVIEW_BASE_URL or auto-detect.' },
        format: { type: 'string', enum: ['png', 'jpeg'], description: 'Screenshot format. Default png' },
        quality: { type: 'number', description: 'JPEG quality 0-100 (only for jpeg). Default 80' },
        out_file: { type: 'string', description: 'Optional file path to save the screenshot. If not provided, only dataUrl is returned.' },
        auto_detect: { type: 'boolean', description: 'If true, try common localhost ports for base_url if not provided. Default true' }
      },
      required: []
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
      wait_selector,
      clip_selector,
      base_url,
      format = 'png',
      quality = 80,
      out_file,
      auto_detect = true,
    } = params || {};

    // Resolve base URL
    let baseUrl = base_url || process.env.PREVIEW_BASE_URL || null;
    if ((!baseUrl || baseUrl.trim() === '') && auto_detect) {
      baseUrl = await probeBaseUrl();
    }

    if (mode === 'component') {
      if (!baseUrl) {
        const hint = 'No base_url found. Set PREVIEW_BASE_URL or pass base_url. Example: http://localhost:5173';
        return { ok: false, error: hint, reason: 'no_base_url', id };
      }
      const fullUrl = buildComponentPreviewUrl({ baseUrl, id, props, props_b64, needs, theme, variant });
      const result = await captureWithPuppeteer({ url: fullUrl, width, height, device_scale_factor, wait_selector, delay_ms, clip_selector, format, quality });
      if (result.ok && out_file) {
        const ext = format === 'jpeg' ? '.jpg' : '.png';
        const filePath = path.isAbsolute(out_file) ? out_file : path.join(process.cwd(), out_file);
        const finalPath = filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? filePath : (filePath + ext);
        const b64 = result.dataUrl.split(',')[1];
        await ensureDirForFile(finalPath);
        await fs.writeFile(finalPath, Buffer.from(b64, 'base64'));
        return { ...result, file: finalPath };
      }
      return result;
    }

    // mode === 'url'
    let finalUrl = urlParam || '';
    if (!finalUrl) return { ok: false, error: 'url parameter is required when mode="url"', reason: 'missing_param' };
    const isAbsolute = /^https?:\/\//i.test(finalUrl);
    if (!isAbsolute) {
      if (!baseUrl) {
        const hint = 'Relative url used but no base_url found. Set PREVIEW_BASE_URL or pass base_url.';
        return { ok: false, error: hint, reason: 'no_base_url' };
      }
      finalUrl = `${baseUrl.replace(/\/$/, '')}/${finalUrl.replace(/^\//, '')}`;
    }
    const result = await captureWithPuppeteer({ url: finalUrl, width, height, device_scale_factor, wait_selector, delay_ms, clip_selector, format, quality });
    if (result.ok && out_file) {
      const ext = format === 'jpeg' ? '.jpg' : '.png';
      const filePath = path.isAbsolute(out_file) ? out_file : path.join(process.cwd(), out_file);
      const finalPath = filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? filePath : (filePath + ext);
      const b64 = result.dataUrl.split(',')[1];
      await ensureDirForFile(finalPath);
      await fs.writeFile(finalPath, Buffer.from(b64, 'base64'));
      return { ...result, file: finalPath };
    }
    return result;
  }
};

module.exports = { standardToolSchemas, standardToolFunctions };