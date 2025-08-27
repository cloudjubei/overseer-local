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
  // hash like #default; but location.hash is '#default', we pass query id includes '#Export', so here use location.hash for variant name
  const targetName = hash?.startsWith('#') ? hash.substring(1) : hash ?? undefined;
  const v = meta.variants.find((x) => x.name === targetName) || meta.variants[0];
  return { variant: v, name: v?.name };
}

async function main() {
  const params = parseQuery();
  const id = params.get('id');
  if (!id) {
    document.body.textContent = 'Missing ?id parameter';
    return;
  }

  const { Comp, meta } = await loadTargetModule(id);

  const urlProps = decodeProps(params) ?? {};
  const { variant } = getVariant(meta, window.location.hash);
  const variantProps = variant?.props ?? {};
  const defaultProps = meta?.defaultProps ?? {};
  const props = { ...defaultProps, ...variantProps, ...urlProps } as any;

  const themeParam = (params.get('theme') as any) || meta?.theme || 'light';
  const { composed } = resolvePreviewProviders(meta, { theme: themeParam, params, needs: [], registry: undefined });

  const rootEl = document.getElementById('root')!;
  const root = ReactDOM.createRoot(rootEl);

  // Apply optional wrappers: composed providers, meta.wrapper, variant.wrapper, in that order
  let tree: React.ReactNode = <Comp {...props} />;
  tree = composed.wrap(tree);
  tree = applyWrapper(meta?.wrapper, tree);
  tree = applyWrapper(variant?.wrapper, tree);

  root.render(<React.StrictMode>{tree}</React.StrictMode>);
}

main().catch((err) => {
  console.error(err);
  document.body.textContent = 'Error loading preview. See console.';
});
