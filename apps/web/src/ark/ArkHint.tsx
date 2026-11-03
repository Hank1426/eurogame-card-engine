import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Delayed pointer dismissal must never leave two explanations open together.
let activeHint: { current: () => void } | null = null;
export function dismissArkHint() { activeHint?.current(); }

/** A focusable explanation that escapes the table's clipped/scrolling panels. */
export function ArkHint({ label, detail, children, className = '', testId, width = 280, onReveal, onDismiss, interactiveTooltip = true }: {
  label: string; detail: ReactNode; children: ReactNode; className?: string; testId?: string; width?: number;
  onReveal?: () => void; onDismiss?: () => void;
  interactiveTooltip?: boolean;
}) {
  const target = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = useRef<() => void>(() => {});
  const id = useId();
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  function cancelClose() { if (closeTimer.current) clearTimeout(closeTimer.current); }
  function close() { setPosition(null); onDismiss?.(); if (activeHint === dismiss) activeHint = null; }
  dismiss.current = close;
  function scheduleClose() { cancelClose(); closeTimer.current = setTimeout(close, 100); }
  function open() {
    cancelClose();
    if (activeHint !== dismiss) activeHint?.current();
    activeHint = dismiss;
    onReveal?.();
    const rect = target.current?.getBoundingClientRect();
    if (!rect) return;
    const fitsLeft = rect.left >= width + 18;
    const fitsRight = rect.right + width + 18 <= window.innerWidth;
    if (fitsLeft || fitsRight) {
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - (width > 280 ? 380 : 260)));
      setPosition({ left: fitsLeft ? rect.left - width - 10 : rect.right + 10, top, maxHeight: Math.min(520, window.innerHeight - top - 8) });
    } else {
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const maxHeight = Math.max(60, Math.min(520, Math.max(above, below)));
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: below >= above ? rect.bottom + 8 : Math.max(8, rect.top - maxHeight - 8), maxHeight });
    }
  }
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); if (activeHint === dismiss) { activeHint = null; dismiss.current(); } }, []);
  useEffect(() => {
    if (!position) return;
    const scroll = (event: Event) => { if (!(event.target as HTMLElement)?.closest?.('.ark-stat-tooltip')) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('keydown', escape); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', close); };
  }, [position]);
  return <span ref={target} className={`ark-hint ${className}`} tabIndex={0} role="group" aria-label={label} aria-describedby={position ? id : undefined} data-testid={testId}
    onMouseEnter={open} onMouseLeave={scheduleClose} onFocus={open} onBlur={close}>
    {children}{position && createPortal(<aside id={id} className="ark-stat-tooltip" role="tooltip" onMouseEnter={interactiveTooltip ? cancelClose : undefined} onMouseLeave={interactiveTooltip ? scheduleClose : undefined} style={{ ...position, width: `min(${width}px, calc(100vw - 16px))`, pointerEvents: interactiveTooltip ? 'auto' : 'none' }}><strong>{label}</strong><div>{detail}</div></aside>, document.body)}
  </span>;
}
