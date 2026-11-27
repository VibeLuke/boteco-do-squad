import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Copy,
  Keyboard,
  Lightbulb,
  RefreshCw,
  SpellCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { GameApi } from '../utils/useGame';
import { WORD_HINT_COST } from '../utils/useGame';

interface Props {
  game: GameApi;
  soundOn: boolean;
  onSound: () => void;
  keyboardOn: boolean;
  onKeyboard: () => void;
  onNew: () => void;
  onCopy: () => void;
  copied: boolean;
}

export function Toolbar({ game, soundOn, onSound, keyboardOn, onKeyboard, onNew, onCopy, copied }: Props) {
  const { hintsLeft, state } = game;
  const disabled = state.status === 'won';
  const [confirmNew, setConfirmNew] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const run = (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    fn();
  };

  const clickNew = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    if (game.filled === 0 || state.status === 'won' || confirmNew) {
      window.clearTimeout(timer.current);
      setConfirmNew(false);
      onNew();
      return;
    }
    setConfirmNew(true);
    timer.current = window.setTimeout(() => setConfirmNew(false), 3200);
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Ferramentas do jogo">
      <div className="tool-group">
        <button
          type="button"
          className="tool"
          disabled={disabled}
          onClick={run(game.revealLetter)}
          title={hintsLeft > 0 ? 'Revelar a letra da célula atual (1 dica)' : 'Sem dicas grátis: custa 20 pts'}
        >
          <Lightbulb size={18} aria-hidden="true" />
          <span className="tool-label">Revelar Letra</span>
          <span className="tool-badge mono">1</span>
        </button>
        <button
          type="button"
          className="tool"
          disabled={disabled}
          onClick={run(game.revealWord)}
          title={`Revelar a palavra ativa (${WORD_HINT_COST} dicas)`}
        >
          <SpellCheck size={18} aria-hidden="true" />
          <span className="tool-label">Revelar Palavra</span>
          <span className="tool-badge mono">{WORD_HINT_COST}</span>
        </button>
        <button
          type="button"
          className="tool"
          disabled={disabled}
          onClick={run(game.check)}
          title="Verificar erros (−10 pts se houver erros)"
        >
          <CheckCheck size={18} aria-hidden="true" />
          <span className="tool-label">Verificar Erros</span>
        </button>
      </div>
      <div className="tool-group">
        <button
          type="button"
          className={`tool${confirmNew ? ' is-warn' : ''}`}
          onClick={clickNew}
          title="Gerar um novo tabuleiro"
        >
          <RefreshCw size={18} aria-hidden="true" />
          <span className="tool-label">{confirmNew ? 'Descartar este?' : 'Novo Tabuleiro'}</span>
        </button>
        <button type="button" className="tool" onClick={run(onCopy)} title="Copiar código do tabuleiro (seed)">
          {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          <span className="tool-label">{copied ? 'Copiado!' : 'Copiar Seed'}</span>
        </button>
        <button
          type="button"
          className={`tool tool-icon${soundOn ? ' is-on' : ''}`}
          onClick={run(onSound)}
          aria-pressed={soundOn}
          title={soundOn ? 'Som ligado' : 'Som desligado'}
          aria-label={soundOn ? 'Desligar som' : 'Ligar som'}
        >
          {soundOn ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
          <span className="tool-label">Som {soundOn ? 'On' : 'Off'}</span>
        </button>
        <button
          type="button"
          className={`tool tool-icon${keyboardOn ? ' is-on' : ''}`}
          onClick={run(onKeyboard)}
          aria-pressed={keyboardOn}
          title={keyboardOn ? 'Teclado do jogo ligado (toque para usar o do celular)' : 'Ligar o teclado do jogo'}
          aria-label="Alternar entre o teclado do jogo e o do aparelho"
        >
          <Keyboard size={18} aria-hidden="true" />
          <span className="tool-label">Teclado</span>
        </button>
      </div>
    </div>
  );
}
