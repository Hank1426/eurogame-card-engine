export function ArkGlyph({ name }: { name: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const shape = name === 'money' ? <><circle cx="12" cy="12" r="9" /><path d="m12 6 5 6-5 6-5-6Z" /></>
    : name === 'appeal' ? <path d="M5 3h14v5a3 3 0 0 0 0 6v7H5v-7a3 3 0 0 0 0-6ZM9 7h6m-6 10h6" />
    : name === 'conservation' ? <><path d="m12 2 8 4v7q-1 6-8 9-7-3-8-9V6Z" /><path d="M9 16q-1-7 7-9-1 8-7 9m0 0 5-6" /></>
    : name === 'reputation' ? <><path d="m2 9 10-6 10 6-10 6Zm4 3v5q6 5 12 0v-5m4-3v9" /></>
    : name === 'worker' || name === 'association' ? <><circle cx="12" cy="7" r="4" /><path d="M5 21v-4q0-6 7-6t7 6v4Zm-2 0h18" /></>
    : name === 'science' ? <><path d="M9 2h6m-5 0v7L4 19q-1 3 3 3h10q4 0 3-3L14 9V2M7 15h10" /><circle cx="11" cy="18" r=".7" fill="currentColor" /></>
    : name === 'cards' ? <><path d="m5 7 11-3 5 15-11 3ZM3 3h11M2 7v12m8-8 5-1m-4 5 5-1" /></>
    : name === 'build' || name === 'enclosure' ? <><path d="m6 3 12 0 5 9-5 9H6l-5-9Z" /><path d="M7 7h10v10H7Z" /></>
    : name === 'sponsors' ? <><path d="M5 2h10l5 5v15H5Zm10 0v6h5" /><path d="m10 12 2 2 4-4m-7 8h7" /></>
    : name === 'animalsII' || name === 'sponsorsII' ? <><path d="M4 3h16v18H4Zm5 4v10m6-10v10" /></>
    : name === 'x' ? <path d="m5 5 14 14M19 5 5 19" />
    : name === 'water' ? <><path d="M12 2Q3 13 5 17a8 8 0 0 0 14 0Q21 13 12 2Z" fill="currentColor" stroke="none" /><path d="M8 15q0 3 3 4" stroke="#edf7f6" /></>
    : name === 'rock' ? <><path d="m2 18 4-12 9-3 7 12-4 6-13-1Z" fill="currentColor" /><path d="m6 6 6 7 3-10m-3 10L5 20m7-7 10 2" stroke="#d2c8b7" /></>
    : name === 'kiosk' ? <><path d="m3 9 3-6h12l3 6M5 10v11h14V10" /><path d="M2 9h20M8 4v5m8-5v5M8 14h8v7" /></>
    : name === 'pavilion' ? <><path d="M2 9q10-14 20 0ZM5 9v10m14-10v10M3 21h18M8 10v9m8-9v9" /></>
    : name === 'bird' ? <><path d="M3 13q4-3 8-2-2-7 4-8l2 4 5 1-5 3q1 10-10 10l2-5-6-3Z" /><circle cx="15" cy="6" r=".7" fill="currentColor" /></>
    : name === 'reptile' ? <path d="M3 20q12 3 10-7-2-4 2-5l5 2 2-3-6-3q-7-1-7 8 1 5-6 4m7-7L6 6m6 9 5 3" />
    : name === 'herbivore' ? <><path d="M6 21v-5L4 10l5-3h6l5 3-2 6v5M9 7 6 2m9 5 3-5M4 10 2 7m18 3 2-3M9 14h6" /></>
    : name === 'primate' || name === 'bear' || name === 'pet' ? <><circle cx="5" cy="7" r="3" /><circle cx="19" cy="7" r="3" /><path d="M4 13q0-9 8-9t8 9q0 9-8 9t-8-9Z" /><circle cx="9" cy="12" r=".8" fill="currentColor" /><circle cx="15" cy="12" r=".8" fill="currentColor" /><path d="m10 16 2 2 2-2m-5-1q3-3 6 0" />{name === 'pet' && <path d="M6 5 7 1m11 4-1-4" />}</>
    : name === 'africa' ? <path d="m6 2 9 1 2 4 5 2-5 5-1 5-4 3-3-8-5-2-2-5 4-5Z" />
    : name === 'americas' ? <path d="m2 4 11-2 4 4-7 5 4 3 6 1-5 7-3-5-1-5-5-1-4-7Z" />
    : name === 'asia' ? <path d="m2 7 5-4 8-1 7 5-3 4-4 1-2 7-4-7-5 2-2-7Zm14 10 5 3" />
    : name === 'europe' ? <path d="m5 3 5 1 3-2 3 3-1 4 6 2-3 4-7-1-4 7-3-4 3-5-5-4 3-5Z" />
    : name === 'australia' ? <path d="m4 10 7-3 3-4 3 5 5 4-3 6-8 1-8-4 1-5Zm13 12 2-1" />
    : name === 'Partner Zoo' || name === 'all-continents' ? <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2q-8 10 0 20 8-10 0-20Z" /></>
    : <><ellipse cx="7" cy="6" rx="2" ry="3" fill="currentColor" /><ellipse cx="17" cy="6" rx="2" ry="3" fill="currentColor" /><ellipse cx="3" cy="11" rx="2" ry="2.5" fill="currentColor" /><ellipse cx="21" cy="11" rx="2" ry="2.5" fill="currentColor" /><path d="M5 19q0-7 7-8 7 1 7 8-2 4-7 1-5 3-7-1Z" fill="currentColor" /></>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>{shape}</svg>;
}
