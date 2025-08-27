import React from 'react';
import ReactDOM from 'react-dom/client';
import type { LoadedComponentExport, PreviewMeta } from './previewTypes';
import { resolvePreviewProviders, applyWrapper } from './withPreview';

function parseQuery() {
  return new URLSearchParams(window.location.search);
}

function decodeProps(params: URLSearchParams): any | undefined {
  const props_b64 = params.get('props_b64');
  const raw = params.get('props');
  if (!raw) return undefined;
  try {
    const json = props_b64 === '1' ? atob(raw) : decodeURIComponent(raw);
    return JSON.parse(json);
  } catch (e) {
    console.warn('Failed to parse props:', e);
    return undefined;
  }
}

async function loadTargetModule(idParam: string): Promise<{ Comp: any; exportName: string; meta: PreviewMeta | undefined }> {
  // id path is like renderer/components/ui/Button.tsx#default relative to src/
  const [path, exportName = 'default'] = idParam.split('#');
  const mod = (await import(/* @vite-ignore */ `../../${path}`)) as LoadedComponentExport;

  const Comp = (mod as any)[exportName];
  if (!Comp) throw new Error(`Export ${exportName} not found in ${path}`);

  // preview meta may be in named export 'preview' or 'getPreview' returning PreviewMeta
  let meta: PreviewMeta | undefined = undefined;
  if ((mod as any).preview) meta = (mod as any).preview as PreviewMeta;
  if (!meta && typeof (mod as any).getPreview === 'function') meta = await (mod as any).getPreview();

  return { Comp, exportName, meta };
}

function getVariant(meta: PreviewMeta | undefined, hash: string | null) {
  if (!meta?.variants?.length) return { variant: undefined, name: undefined };
  const targetName = hash?.startsWith('#') ? hash.substring(1) : hash ?? undefined;
  const v = meta.variants.find((x) => x.name === targetName) || meta.variants[0];
  return { variant: v, name: v?.name };
}

export function PreviewHost() {
  const [error, setError] = React.useState<string | null>(null);
  const [content, setContent] = React.useState<React.ReactNode>(null);

  React.useEffect(() => {
    const run = async () => {
      const params = parseQuery();
      const id = params.get('id');
      if (!id) {
        setError('Missing ?id parameter');
        return;
      }

      try {
        const { Comp, exportName, meta } = await loadTargetModule(id);
        document.title = meta?.title || exportName || 'Preview';

        const urlProps = decodeProps(params) ?? {};
        const { variant } = getVariant(meta, window.location.hash);
        const variantProps = variant?.props ?? {};
        const defaultProps = meta?.defaultProps ?? {};
        const props = { ...defaultProps, ...variantProps, ...urlProps } as any;

        const themeParam = (params.get('theme') as any) || meta?.theme || 'light';
        const { composed } = resolvePreviewProviders(meta, { theme: themeParam, params, needs: [], registry: undefined });

        // Build tree with a stable stage container for interactions and clipping
        let tree: React.ReactNode = (
          <div id="preview-stage" data-preview-stage>
            <Comp {...props} />
          </div>
        );
        tree = composed.wrap(tree);
        tree = applyWrapper(meta?.wrapper, tree);
        tree = applyWrapper(variant?.wrapper, tree);

        setContent(tree);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || String(e));
      }
    };

    run();
  }, []);

  React.useEffect(() => {
    // Signal readiness once content is set to help external automation
    if (content && typeof window !== 'undefined') {
      (window as any).__PREVIEW_READY = true;
      window.dispatchEvent(new CustomEvent('preview:ready'));
    }
  }, [content]);

  if (error) return <div style={{ padding: 16, color: 'red' }}>Error loading preview: {error}</div>;
  if (!content) return <div style={{ padding: 16 }}>Loading preview…</div>;
  return <>{content}</>;
}

// For direct mounting without main.tsx (backward compatibility) if needed
export function mountPreviewHost() {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <PreviewHost />
    </React.StrictMode>
  );
}

// Auto-mount if this module is loaded directly (not via main.tsx)
if (typeof window !== 'undefined' && (import.meta as any).env?.MODE) {
  // Heuristic: if there is no global flag set by main.tsx, mount ourselves.
  if (!(window as any).__PREVIEW_MAIN_MOUNTED) {
    try {
      mountPreviewHost();
    } catch (_) {
      // ignore
    }
  }
}
