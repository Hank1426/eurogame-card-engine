import type { ComponentType } from 'react';
import { exportArchive } from '@eurogame/engine-core';
import type { GameSummary, MatchRuntime, PanelProps, RuntimeSession } from './types.js';

/** Session types remain inside their adapter; the application handles only metadata. */
export function gameRuntime<S extends RuntimeSession>(session: S, Panel: ComponentType<PanelProps<S>>, summarize: (session: S) => GameSummary): MatchRuntime {
  return {
    gameId: session.manifest.gameId, manifest: session.manifest, revision: session.state.revision,
    summary: summarize(session), archive: exportArchive(session),
    render: props => <Panel session={session} active={props.active} readOnly={props.readOnly}
      onChange={next => props.onChange(gameRuntime(next, Panel, summarize))}
      onFork={next => props.onFork(gameRuntime(next, Panel, summarize))} />
  };
}
