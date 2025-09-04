import React, { useEffect, useState } from 'react';
import Tooltip from '../ui/Tooltip';
import { getPrice as getPricingRecord } from '../../services/pricingService';

export type CostChipProps = {
  provider?: string;
  model?: string;
  costUSD?: number;
};

function formatUSD(n?: number) {
  if (n == null) return '—';
  return `$${n.toFixed(4)}`;
}

export default function CostChip({ provider, model, costUSD }: CostChipProps) {
  const [price, setPrice] = useState<{ inputPerMTokensUSD: number; outputPerMTokensUSD: number } | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rec = await getPricingRecord(provider, model);
        if (mounted) setPrice(rec ? { inputPerMTokensUSD: rec.inputPerMTokensUSD, outputPerMTokensUSD: rec.outputPerMTokensUSD } : undefined);
      } catch {
        if (mounted) setPrice(undefined);
      }
    })();
    return () => { mounted = false; };
  }, [provider, model]);

  const content = (
    <div className="text-xs">
      <div className="font-semibold mb-1">{provider || 'Unknown'} · {model || 'Unknown'}</div>
      {price ? (
        <div className="space-y-0.5">
          <div><span className="text-neutral-400">Input:</span> ${price.inputPerMTokensUSD} per 1M tokens</div>
          <div><span className="text-neutral-400">Output:</span> ${price.outputPerMTokensUSD} per 1M tokens</div>
        </div>
      ) : (
        <div className="text-neutral-400">Pricing unavailable</div>
      )}
    </div>
  );

  return (
    <Tooltip content={content} placement="top">
      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-neutral-50 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
        <span>{formatUSD(costUSD)}</span>
      </span>
    </Tooltip>
  );
}
