
import { AgentRunHistory } from 'thefactory-tools';
import StatusChip from './StatusChip';

export default function AgentRunBullet({ run, onClick }: { run: AgentRunHistory; onClick?: (e: any) => void }) {
  const label = `Agent ${run.id.slice(0, 8)} · ${run.state}${run.statusMessage ? ` · ${run.statusMessage}` : ''} · ${run.llmConfig.provider} · ${run.llmConfig.model}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center p-0 m-0 bg-transparent border-0"
      style={{ lineHeight: 1 }}
    >
      <StatusChip state={run.state} />
    </button>
  );
}
