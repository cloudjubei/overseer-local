
import { IconExclamation } from '../ui/Icons';

export default function ExclamationChip({ title, tooltip }: { title : string, tooltip: string }) {

  return (
    <span className="rejection-badge" aria-label={tooltip} title={title}>
      <IconExclamation className="w-4 h-4" />
    </span>
  );
}
