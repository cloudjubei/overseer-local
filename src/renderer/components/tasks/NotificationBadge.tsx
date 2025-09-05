import React from 'react';

export interface NotificationBadgeProps {
  className?: string;
  text: string;
  tooltipLabel?: string;
  isInformative?: boolean
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ className, text, tooltipLabel, isInformative = false }) => {

  return (
    <span
      className={`chip chip--badge ${isInformative ? 'chip--badge--blue' : 'chip--badge--red'} ${className}`}
      title={tooltipLabel}
      // aria-label={tooltipLabel}
    >
      {text}
    </span>
  );
};

export default NotificationBadge;
