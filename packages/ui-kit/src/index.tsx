import type { ReactNode } from 'react';

export function LeafMark({ small = false }: { small?: boolean }) {
  return <svg width={small ? 24 : 36} height={small ? 24 : 36} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="M31 7C15 6 7 14 10 25c9 7 23 1 21-18Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="m8 33 17-18M17 24l-1-9m1 9 10-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

export function BotanicalArt({ variant = 'habitat' }: { variant?: string }) {
  const research = variant === 'research';
  return <svg className="botanical-art" viewBox="0 0 220 110" fill="none" aria-hidden="true">
    <circle cx="164" cy="32" r="20" fill="currentColor" opacity=".09" />
    <path d="M22 97h176M109 97V27M109 72C70 76 58 45 68 34c31-6 43 14 41 38ZM109 54c27 1 47-18 40-35-29-5-43 12-40 35ZM109 89c24 2 44-10 47-29-23-5-45 5-47 29Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m109 70-31-25m31 7 29-24m-29 59 35-18" stroke="currentColor" strokeWidth="1.1" opacity=".6" />
    {research ? <><circle cx="53" cy="76" r="15" stroke="currentColor" strokeWidth="1.5" /><path d="m64 87 9 10M48 76h10m-5-5v10" stroke="currentColor" strokeWidth="1.5" /></> : <path d="M42 97V76m0 9c-13 0-17-10-14-15 12-2 17 5 14 15Zm0-6c12 0 18-10 14-15-10-1-16 5-14 15Z" stroke="currentColor" strokeWidth="1.5" />}
  </svg>;
}

export function SectionHeading({ eyebrow, title, extra }: { eyebrow: string; title: string; extra?: ReactNode }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{extra}</div>;
}

export function ResourceCounter({ label, value, symbol, variant }: { label: string; value: number; symbol: string; variant: string }) {
  return <div className={`resource-counter ${variant}`}><span className="resource-symbol" aria-hidden="true">{symbol}</span><div><span>{label}</span><strong>{value}</strong></div></div>;
}
