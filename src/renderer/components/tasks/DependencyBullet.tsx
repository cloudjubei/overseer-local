import React from 'react';

interface DependencyBulletProps {
  dependency : string;
  className?: string;
  onClick?: () => void;
}

export function DependencyBullet({ dependency, className = '', onClick }: DependencyBulletProps) {
  const parts = dependency.split(".")
  const isFeatureDependency = parts.length > 0
  const taskId = parts[0]
  return (
    <button
      className={`dependency-bullet ${isFeatureDependency ? "feature-dependency" : "task-dependency"} ${className}`}
      onClick={onClick}
    >
      {dependency}
    </button>
  );
}
