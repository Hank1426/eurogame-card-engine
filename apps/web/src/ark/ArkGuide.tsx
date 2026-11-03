import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ArkView } from '@eurogame/game-ark-nova';
import { iconSources, relatedTags, type GuideFocus } from './guide-model.js';

interface Guide {
  player: ArkView['players'][number]; market: ArkView['market']; selectedBuilding: string | null;
  focus: GuideFocus | null; sourceCards: string[]; linkedTags: string[];
  reveal: (focus: GuideFocus) => void; clear: (id: string) => void;
}
const GuideContext = createContext<Guide | null>(null);
export function useArkGuide() { return useContext(GuideContext); }
export function ArkGuide({ view, selectedBuilding, inspectionKey, children }: { view: ArkView; selectedBuilding: string | null; inspectionKey: string | null; children: ReactNode }) {
  const [focus, setFocus] = useState<GuideFocus | null>(null);
  const owner = view.players.find(player => player.id === 'p1')!;
  const player = view.context?.action === 'animals' && view.context.cardOwner
    ? { ...owner, upgrades: view.context.upgraded ? [...new Set([...owner.upgrades, 'animals' as const])] : owner.upgrades.filter(action => action !== 'animals') } : owner;
  useEffect(() => { setFocus(null); }, [view.revision, inspectionKey]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFocus(null); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  const sources = focus?.kind === 'icon' ? iconSources(player, focus.key, focus.cardId) : [];
  return <GuideContext.Provider value={{ player, market: view.market, selectedBuilding, focus,
    sourceCards: sources.flatMap(source => source.cardId ? [source.cardId] : []),
    linkedTags: focus?.kind === 'icon' ? relatedTags(focus.key, focus.cardId) : [],
    reveal: setFocus, clear: id => setFocus(current => current?.id === id ? null : current)
  }}>{children}</GuideContext.Provider>;
}
