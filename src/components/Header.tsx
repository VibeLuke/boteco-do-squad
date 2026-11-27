import type { CSSProperties } from 'react';
import { LayoutGrid, Moon, Sun, UserRound } from 'lucide-react';
import type { VisualTheme } from '../utils/storage';
import type { PlayerId } from '../arena/sprites';
import { PLAYER_BY_ID } from '../arena/sprites';
import { Sprite } from '../arena/Sprite';
import { NeonSign } from '../arena/NeonSign';

interface Props {
  view: 'studio' | 'game';
  visual: VisualTheme;
  onVisual: (v: VisualTheme) => void;
  onHome: () => void;
  player: PlayerId | null;
  onPlayer: () => void;
}

export function Header({ view, visual, onVisual, onHome, player, onPlayer }: Props) {
  const p = player ? PLAYER_BY_ID[player] : null;
  return (
    <header className="app-header">
      <button type="button" className="brand" onClick={onHome} aria-label="Boteco do Squad — voltar ao balcão">
        <NeonSign small />
      </button>

      <div className="header-actions">
        {view === 'game' && (
          <button type="button" className="btn btn-ghost header-studio" onClick={onHome}>
            <LayoutGrid size={16} aria-hidden="true" />
            <span>Balcão</span>
          </button>
        )}
        <button
          type="button"
          className={`player-chip${p ? '' : ' is-empty'}`}
          style={p ? ({ '--pc': p.color } as CSSProperties) : undefined}
          onClick={onPlayer}
          title="Trocar quem está jogando"
        >
          {p ? <Sprite id={p.id} scale={1} className="chip-sprite" /> : <UserRound size={16} aria-hidden="true" />}
          <span>{p ? p.name : 'Quem joga?'}</span>
        </button>
        <div className="segmented theme-switch" role="radiogroup" aria-label="Iluminação do bar">
          <button
            type="button"
            role="radio"
            aria-checked={visual === 'ink'}
            className={visual === 'ink' ? 'is-on' : ''}
            onClick={() => onVisual('ink')}
            title="Noite de neon"
          >
            <Moon size={15} aria-hidden="true" />
            <span>Noite</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={visual === 'paper'}
            className={visual === 'paper' ? 'is-on' : ''}
            onClick={() => onVisual('paper')}
            title="Happy hour"
          >
            <Sun size={15} aria-hidden="true" />
            <span>Happy hour</span>
          </button>
        </div>
      </div>
    </header>
  );
}
