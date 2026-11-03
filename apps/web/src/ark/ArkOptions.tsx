import type { ReactNode } from 'react';
import { ArkIcon } from './ArkIcon.js';

export interface ArkOption { value: string; label: string; displayLabel?: string; icon?: string; detail?: string; badge?: ReactNode; disabled?: boolean }
export function ArkOptions({ label, value, options, onChange, assets = {}, disabled = false }: {
  label: string; value: string | number | undefined; options: ArkOption[]; onChange: (value: string) => void;
  assets?: Record<string, string>; disabled?: boolean;
}) {
  return <div className="ark-option-group" role="radiogroup" aria-label={label}><span className="ark-option-label">{label}</span><div className="ark-option-buttons">{options.map(option =>
    <button type="button" role="radio" aria-checked={String(value) === option.value} aria-label={option.label} data-value={option.value} key={option.value} title={option.detail ?? option.label} disabled={disabled || option.disabled} onClick={() => onChange(option.value)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const index = buttons.indexOf(event.currentTarget);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus(); buttons[next]?.click();
    }}>
      {option.icon && <ArkIcon name={option.icon} assets={assets} />}<span>{option.displayLabel ?? option.label}{option.detail && <small>{option.detail}</small>}</span>{option.badge !== undefined && <b>{option.badge}</b>}
    </button>)}</div></div>;
}
