import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

// Dynamic module loader: all renderer TS/TSX files are importable.
const modules = import.meta.glob('/src/renderer/**/*.{tsx,ts}', { eager: false });

type LoadedModule = Record<string, any>;

type ProviderPreset = 'none' | 'app';

type PreviewParams = {
  id?: string; // e.g. renderer/components/ui/Button.tsx#default
  props?: string; // URL-encoded JSON or base64 if props_b64=1
  props_b64?: string; // '1' to indicate base64
  provider?: ProviderPreset;
  theme?: 'light' | 'dark';
};

function decodeProps(raw?: string, b64?: string): any {
  if (!raw) return undefined;
  try {
    const text = b64 === '1' ? atob(raw) : decodeURIComponent(raw);
    return JSON.parse(text);
  } catch (e) {
    console.warn('Failed to parse preview props:', e);
    return undefined;
  }
}

function resolveModulePath(id?: string): { path?: string; exportName: string } {
  if (!id) return { exportName: 'default' };
  const [maybePath, maybeExport] = id.split('#');
  const exportName = maybeExport || 'default';
  let desired = maybePath || '';

  // Normalize: allow 'renderer/...' or '/src/renderer/...'
  if (!desired.startsWith('/src/')) {
    if (desired.startsWith('src/')) desired = '/' + desired;
    else desired = '/src/' + desired;
  }

  // Attempt exact match first
  if (modules[desired]) return { path: desired, exportName };

  // Fallback: endsWith match across keys (for convenience)
  const entry = Object.keys(modules).find((k) => k.endsWith(desired.replace(/^\/src\//, '')) || k.endsWith(desired));
  return { path: entry, exportName };
}

function AppProviders({ children, theme }: PropsWithChildren<{ theme?: 'light' | 'dark' }>) {
  // Minimal theming: apply data-theme attr on html
  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.setAttribute('data-theme', theme);
    return () => {
      if (theme) root.removeAttribute('data-theme');
    };
  }, [theme]);

  return <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>;
}

function Providers({ children, preset, theme }: PropsWithChildren<{ preset: ProviderPreset; theme?: 'light' | 'dark' }>) {
  if (preset === 'app') return <AppProviders theme={theme}>{children}</AppProviders>;
  return <>{children}</>;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  constructor(props: any) {
    super(props);
    this.state = { error: undefined };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: 'var(--text-danger, #b00020)' }}>
          <h2>Preview Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error.stack || this.state.error.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function PreviewHost() {
  const params = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    const obj: PreviewParams = {
      id: sp.get('id') || undefined,
      props: sp.get('props') || undefined,
      props_b64: sp.get('props_b64') || undefined,
      provider: (sp.get('provider') as ProviderPreset) || 'app',
      theme: (sp.get('theme') as 'light' | 'dark') || 'light',
    };
    return obj;
  }, []);

  const [component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { path, exportName } = resolveModulePath(params.id);
  const props = decodeProps(params.props, params.props_b64);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!path) {
        setLoadError('No matching module found for id=' + (params.id ?? '(missing)'));
        return;
      }
      try {
        const loader = modules[path] as () => Promise<LoadedModule>;
        const mod = await loader();
        const exp = mod[exportName];
        if (!exp) throw new Error(`Export "${exportName}" not found in ${path}`);
        if (cancelled) return;
        setComponent(() => exp as React.ComponentType<any>);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || String(e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [path, exportName, params.id]);

  const providerPreset: ProviderPreset = params.provider || 'app';

  return (
    <div style={{
      background: 'var(--bg-surface, #0b0d12)',
      minHeight: '100vh',
      padding: 20,
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{
          border: '1px solid var(--border-subtle, #222)',
          background: 'var(--bg-elevated, #0e1117)',
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)'
        }}>
          <Providers preset={providerPreset} theme={params.theme}>
            <ErrorBoundary>
              {loadError && (
                <div style={{ color: 'var(--text-danger, #ff6b6b)' }}>
                  <strong>Load error:</strong>
                  <div>{loadError}</div>
                </div>
              )}
              {!loadError && !component && (
                <div style={{ color: 'var(--text-muted, #9aa0a6)' }}>Loading component…</div>
              )}
              {!loadError && component && React.createElement(component, props || {})}
            </ErrorBoundary>
          </Providers>
        </div>
        <InfoBar id={params.id} exportName={exportName} provider={providerPreset} />
      </div>
    </div>
  );
}

function InfoBar({ id, exportName, provider }: { id?: string; exportName: string; provider: string }) {
  const example = (() => {
    const sampleProps = encodeURIComponent(JSON.stringify({ children: 'Hello' }));
    const theme = 'light';
    const demoId = id || 'renderer/components/ui/Button.tsx#default';
    return `preview.html?id=${demoId}&props=${sampleProps}&provider=${provider}&theme=${theme}`;
  })();
  return (
    <div style={{
      marginTop: 12,
      fontSize: 12,
      color: 'var(--text-dim, #aaa)'
    }}>
      <div>
        <strong>Preview</strong>: {id || '(missing id)'}#{exportName} · provider={provider}
      </div>
      <div>
        Example URL: <code style={{ userSelect: 'all' }}>{example}</code>
      </div>
    </div>
  );
}
