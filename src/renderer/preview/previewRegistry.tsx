import React, { ReactNode, useMemo } from 'react';
import type { PreviewRegistry, ProviderFactory, ProviderFactoryOptions, ProviderComposeResult } from './previewTypes';

export function createPreviewRegistry(seed?: Record<string, ProviderFactory>): PreviewRegistry {
  const factories = new Map<string, ProviderFactory>();
  if (seed) {
    for (const [k, f] of Object.entries(seed)) factories.set(k, f);
  }

  const register = (key: string, factory: ProviderFactory) => {
    factories.set(key, factory);
  };

  const compose = (keys: string[], options: ProviderFactoryOptions): ProviderComposeResult => {
    const deduped: string[] = [];
    for (const k of keys) if (!deduped.includes(k)) deduped.push(k);

    const layers: ProviderComposeResult[] = [];
    for (const key of deduped) {
      const f = factories.get(key);
      if (!f) continue;
      layers.push(f(options));
    }

    const wrap = (node: ReactNode) => {
      return layers.reduceRight((acc, layer) => {
        const Comp = ({ children }: { children: ReactNode }) => <>{children}</>;
        // layer.wrap is returned as a function; we call it directly rather than JSX wrapper components.
        return layer.wrap(acc);
      }, node);
    };

    const dispose = async () => {
      for (const layer of layers) {
        if (typeof layer.dispose === 'function') await layer.dispose();
      }
    };

    return { wrap, dispose };
  };

  const has = (key: string) => factories.has(key);

  return { register, compose, has };
}

// Helper to create a simple provider wrapper around a React component Provider
export function asProviderWrapper(Provider: React.ComponentType<{ children: React.ReactNode }>, before?: () => void | Promise<void>, after?: () => void | Promise<void>): ProviderFactory {
  return () => {
    let disposed = false;
    return {
      wrap: (node: ReactNode) => {
        return <Provider>{node}</Provider>;
      },
      dispose: async () => {
        if (disposed) return;
        disposed = true;
        if (after) await after();
      },
    };
  };
}

// Helper to inline a simple wrapper function
export function asWrapper(fn: (node: ReactNode) => ReactNode): ProviderFactory {
  return () => ({ wrap: fn });
}
