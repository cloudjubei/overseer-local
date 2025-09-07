import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'node:url';

export type ModelPrice = {
  provider: string; // e.g., openai
  model: string;    // e.g., gpt-4o-mini
  inputPerMTokensUSD: number;    // cost per 1,000,000 input tokens in USD
  outputPerMTokensUSD: number;   // cost per 1,000,000 output tokens in USD
  currency?: 'USD';
};

export type PricingState = {
  updatedAt: string;
  prices: ModelPrice[];
};

export type PricingConfig = {
  // Optional mapping to JSON endpoints you can refresh from per provider
  supplierUrls?: Record<string, string>;
};

function ensureDir(p: string) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

function nowIso() { return new Date().toISOString(); }

// Resolve the package root relative to this file so the package can be relocated
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export class PricingManager {
  private readonly root: string;
  private readonly storeFile: string;
  private readonly configFile: string;
  private state: PricingState;
  private readonly defaults: PricingState;

  constructor(projectRoot?: string, defaults?: PricingState) {
    this.root = path.resolve(projectRoot || process.cwd());
    const confDir = path.join(this.root, '.factory');
    ensureDir(confDir);
    this.storeFile = path.join(confDir, 'prices.json');
    this.configFile = path.join(confDir, 'pricing.config.json');
    this.defaults = defaults || { updatedAt: nowIso(), prices: loadBuiltInDefaults() };
    this.state = this.loadFromDisk() || this.defaults;
  }

  private loadFromDisk(): PricingState | null {
    try {
      const raw = fs.readFileSync(this.storeFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.prices)) return parsed as PricingState;
    } catch {}
    return null;
  }

  private saveToDisk() {
    try {
      ensureDir(path.dirname(this.storeFile));
      fs.writeFileSync(this.storeFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch {}
  }

  listPrices(): PricingState {
    return this.state;
  }

  upsertPrices(prices: ModelPrice[], updatedAt?: string) {
    const map = new Map<string, ModelPrice>();
    for (const p of this.state.prices) map.set(`${p.provider}:${p.model}`, p);
    for (const p of prices) map.set(`${p.provider}:${p.model}`, p);
    this.state = { updatedAt: updatedAt || nowIso(), prices: Array.from(map.values()) };
    this.saveToDisk();
  }

  getPrice(provider: string | undefined, model: string | undefined): ModelPrice | undefined {
    if (!provider || !model) return undefined;
    const key = `${provider}:${model}`.toLowerCase();
    return this.state.prices.find(p => `${p.provider}:${p.model}`.toLowerCase() === key);
  }

  async refresh(provider?: string, urlOverride?: string): Promise<PricingState> {
    const cfg = this.loadConfig();
    const provs = provider ? [provider] : Object.keys(cfg.supplierUrls || {});
    const newPrices: ModelPrice[] = [];

    for (const prov of provs) {
      const url = urlOverride || cfg.supplierUrls?.[prov];
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Expect either array of ModelPrice or an object { prices: ModelPrice[] }
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.prices) ? data.prices : []);
        for (const raw of arr) {
          // Best-effort normalization
          if (raw && raw.provider && raw.model) {
            const input = Number(raw.inputPerMTokensUSD ?? raw.input_per_m_tokens_usd ?? raw.inputPerKTokensUSD * 1000 );
            const output = Number(raw.outputPerMTokensUSD ?? raw.output_per_m_tokens_usd ?? raw.outputPerKTokensUSD * 1000 );
            if (!isFinite(input) || !isFinite(output)) continue;
            newPrices.push({ provider: String(raw.provider), model: String(raw.model), inputPerMTokensUSD: input, outputPerMTokensUSD: output, currency: 'USD' });
          }
        }
      } catch (e) {
        // Ignore provider errors; keep previous values
      }
    }
    if (newPrices.length) this.upsertPrices(newPrices);
    return this.state;
  }

  loadConfig(): PricingConfig {
    try {
      const raw = fs.readFileSync(this.configFile, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed || {};
    } catch {}
    return { supplierUrls: {} };
  }

  saveConfig(cfg: PricingConfig) {
    ensureDir(path.dirname(this.configFile));
    fs.writeFileSync(this.configFile, JSON.stringify(cfg, null, 2), 'utf8');
  }
}

function loadBuiltInDefaults(): ModelPrice[] {
  try {
    const p = path.join(PACKAGE_ROOT, 'assets', 'default-prices.json');
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw) as { prices: ModelPrice[] };
    const arr: ModelPrice[] = Array.isArray(data) ? data : (Array.isArray(data?.prices) ? data.prices : []);
    return arr
  } catch {
    // Minimal safe defaults if asset missing
    return [
      { provider: 'openai', model: 'gpt-4o-mini', inputPerMTokensUSD: 150, outputPerMTokensUSD: 600, currency: 'USD' },
      { provider: 'openai', model: 'gpt-4o', inputPerMTokensUSD: 5000, outputPerMTokensUSD: 15000, currency: 'USD' },
      { provider: 'openai', model: 'gpt-3.5-turbo', inputPerMTokensUSD: 1500, outputPerMTokensUSD: 2000, currency: 'USD' },
    ];
  }
}

export function createPricingManager(opts?: { projectRoot?: string; defaults?: PricingState }) {
  return new PricingManager(opts?.projectRoot, opts?.defaults);
}

export function estimateCostUSD(tokensIn: number, tokensOut: number, price?: ModelPrice): number | undefined {
  if (!price) return undefined;
  const inCost = (tokensIn / 1_000_000) * price.inputPerMTokensUSD;
  const outCost = (tokensOut / 1_000_000) * price.outputPerMTokensUSD;
  const total = inCost + outCost;
  return isFinite(total) ? Number(total.toFixed(8)) : undefined;
}
