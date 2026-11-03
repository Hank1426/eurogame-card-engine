import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** A focusable explanation that escapes the table's clipped/scrolling panels. */
export function ArkHint({ label, detail, children, className = '', testId }: {
  label: string; detail: ReactNode; children: ReactNode; className?: string; testId?: string;
}) {
  const target = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  function cancelClose() { if (closeTimer.current) clearTimeout(closeTimer.current); }
  function scheduleClose() { cancelClose(); closeTimer.current = setTimeout(() => setPosition(null), 100); }
  function open() {
    cancelClose();
    const rect = target.current?.getBoundingClientRect();
    if (rect) setPosition({ left: Math.max(8, Math.min(rect.left - 220, window.innerWidth - 288)), top: Math.max(8, Math.min(rect.bottom + 7, window.innerHeight - 260)) });
  }
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    const scroll = (event: Event) => { if (!(event.target as HTMLElement)?.closest?.('.ark-stat-tooltip')) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('keydown', escape); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', close); };
  }, [position]);
  return <span ref={target} className={`ark-hint ${className}`} tabIndex={0} role="group" aria-label={label} aria-describedby={position ? id : undefined} data-testid={testId}
    onMouseEnter={open} onMouseLeave={scheduleClose} onFocus={open} onBlur={() => setPosition(null)}>
    {children}{position && createPortal(<aside id={id} className="ark-stat-tooltip" role="tooltip" onMouseEnter={cancelClose} onMouseLeave={scheduleClose} style={{ ...position, maxHeight: `min(440px, calc(100dvh - ${position.top + 8}px))` }}><strong>{label}</strong><div>{detail}</div></aside>, document.body)}
  </span>;
}
