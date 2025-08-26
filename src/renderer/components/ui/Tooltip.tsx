import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type TooltipProps = {
  children: React.ReactElement;
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delayMs?: number;
  disabled?: boolean;
};

function getAnchorRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
}

export default function Tooltip({ children, content, placement = 'right', delayMs = 200, disabled }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<number | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  const child = React.Children.only(children);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const a = anchorRef.current as HTMLElement;
    const r = a.getBoundingClientRect();
    const spacing = 8;
    const tw = 260;
    const th = 36;
    let top = 0, left = 0;
    switch (placement) {
      case 'right':
        top = r.top + window.scrollY + r.height / 2 - th / 2;
        left = r.left + window.scrollX + r.width + spacing;
        break;
      case 'left':
        top = r.top + window.scrollY + r.height / 2 - th / 2;
        left = r.left + window.scrollX - spacing - tw;
        break;
      case 'top':
        top = r.top + window.scrollY - spacing - th;
        left = r.left + window.scrollX + r.width / 2 - tw / 2;
        break;
      case 'bottom':
        top = r.top + window.scrollY + r.height + spacing;
        left = r.left + window.scrollX + r.width / 2 - tw / 2;
        break;
    }
    setCoords({ top, left });
  }, [open, placement]);

  const show = () => {
    if (disabled) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(true), delayMs) as any;
  };
  const hide = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setOpen(false);
  };

  return (
    <>
      {React.cloneElement(child, {
        ref: (el: HTMLElement) => {
          // merge ref if provided
          const anyChild: any = child as any;
          if (typeof anyChild.ref === 'function') anyChild.ref(el);
          else if (anyChild.ref) (anyChild.ref as any).current = el;
          anchorRef.current = el;
        },
        onMouseEnter: (e: any) => { child.props.onMouseEnter?.(e); show(); },
        onMouseLeave: (e: any) => { child.props.onMouseLeave?.(e); hide(); },
        onFocus: (e: any) => { child.props.onFocus?.(e); show(); },
        onBlur: (e: any) => { child.props.onBlur?.(e); hide(); },
        'aria-describedby': open ? 'tooltip' : undefined,
      })}
      {open && coords && createPortal(
        <div className="ui-tooltip" role="tooltip" style={{ top: coords.top, left: coords.left }}>
          <div className="ui-tooltip__content">{content}</div>
        </div>,
        document.body
      )}
    </>
  );
}
