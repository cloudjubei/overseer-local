import React from 'react';

import '../styles/components/badges.css'; // Assuming styles are imported if needed, but typically global

interface DependencyBulletProps {
  className?: string;
  onClick?: () => void;
  title?: string;
}

export function TaskDependencyBullet({ taskId, className = '', onClick, title }: DependencyBulletProps & { taskId: string }) {
  return (
    <button
      className={`dependency-bullet task-dependency ${className}`}
      onClick={onClick}
      title={title || `Task #${taskId}`}
    >
      T#{taskId}
    </button>
  );
}

export function FeatureDependencyBullet({ taskId, featureId, className = '', onClick, title }: DependencyBulletProps & { taskId: string; featureId: string }) {
  return (
    <button
      className={`dependency-bullet feature-dependency ${className}`}
      onClick={onClick}
      title={title || `Feature #${taskId}.${featureId}`}
    >
      F#{taskId}.{featureId}
    </button>
  );
}
