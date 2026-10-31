import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function useActionMotion(order: readonly string[], enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<string, DOMRect>());
  const key = order.join('/');
  useLayoutEffect(() => {
    const elements = root.current?.querySelectorAll<HTMLElement>('[data-action]') ?? [];
    const animations: Animation[] = [];
    for (const element of elements) {
      const id = element.dataset.action!;
      const rect = element.getBoundingClientRect();
      const old = previous.current.get(id);
      if (old && enabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && Math.abs(old.left - rect.left) > 1) {
        animations.push(element.animate([{ transform: `translateX(${old.left - rect.left}px)` }, { transform: 'translateX(0)' }], { duration: 190, easing: 'cubic-bezier(.2,.7,.3,1)' }));
      }
      previous.current.set(id, rect);
    }
    return () => animations.forEach(animation => animation.cancel());
  }, [key, enabled]);
  return root;
}
export function useResourceChanges(values: Record<string, number | string>) {
  const previous = useRef(values);
  const [changes, setChanges] = useState<Record<string, number>>({});
  const signature = JSON.stringify(values);
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const [name, value] of Object.entries(values)) {
      const old = previous.current[name];
      if (typeof old === 'number' && typeof value === 'number' && value !== old) next[name] = value - old;
    }
    previous.current = values;
    if (!Object.keys(next).length) return;
    setChanges(next);
    const timer = setTimeout(() => setChanges({}), 1300);
    return () => clearTimeout(timer);
  }, [signature]);
  return changes;
}
