import { Task } from 'thefactory-tools';
import StatusControl from './StatusControl';

export default function TaskSummaryCard({ task, className = '' }: { task: Task; className?: string }) {
  return (
    <div className={`task-summary-card ${className}`}>
      <div className="summary-card__header">
        <h4 className="summary-card__title">{task.title}</h4>
        <StatusControl status={task.status} />
      </div>
      <p className="summary-card__description">{task.description}</p>
    </div>
  );
}
