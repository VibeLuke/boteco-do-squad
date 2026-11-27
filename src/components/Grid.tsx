import { memo, useCallback, useLayoutEffect, useMemo, useRef, type CSSProperties, type RefObject } from 'react';
import type { Direction } from '../types/crossword';
import type { GameApi } from '../utils/useGame';
import { cellKey } from '../utils/puzzle';

interface CellProps {
  r: number;
  c: number;
  num: number | undefined;
  letter: string;
  locked: boolean;
  flagged: boolean;
  inWord: boolean;
  focus: boolean;
  done: boolean;
  dir: Direction;
  shake: number;
  onSelect: (r: number, c: number) => void;
}

const Cell = memo(function Cell({
  r,
  c,
  num,
  letter,
  locked,
  flagged,
  inWord,
  focus,
  done,
  dir,
  shake,
  onSelect,
}: CellProps) {
  const cls = [
    'cell',
    'tile',
    inWord ? 'in-word' : '',
    focus ? `focus dir-${dir}` : '',
    locked ? 'revealed' : '',
    flagged ? 'error' : '',
    done ? 'done' : '',
    letter ? 'has-letter' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      role="gridcell"
      aria-selected={focus}
      aria-label={`Linha ${r + 1}, coluna ${c + 1}${num ? `, pista ${num}` : ''}${letter ? `, letra ${letter}` : ', vazia'}`}
      onClick={() => onSelect(r, c)}
    >
      <div className="cell-face" key={flagged ? shake : 0}>
        {num !== undefined && <span className="cell-num mono">{num}</span>}
        <span className="cell-letter">{letter}</span>
      </div>
    </div>
  );
});

interface Props {
  game: GameApi;
  /** Usa o teclado do próprio aparelho: um campo de texto invisível sobre a casa ativa. */
  nativeInput?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  onTyping?: (on: boolean) => void;
}

/** Caractere-sentinela: com o campo nunca vazio, o "apagar" do teclado do celular sempre gera evento. */
const SENTINEL = '\u200b';

function resetField(el: HTMLInputElement): void {
  el.value = SENTINEL;
  try {
    el.setSelectionRange(1, 1);
  } catch {
    /* alguns navegadores não deixam em campo sem foco */
  }
}

export function Grid({ game, nativeInput = false, inputRef, onTyping }: Props) {
  const { puzzle, state, activeKeys, flaggedSet, doneCells, select, type, backspace, clearCell, move, tab, toggleDir } = game;
  const gridRef = useRef<HTMLDivElement>(null);
  const ownRef = useRef<HTMLInputElement>(null);
  const fieldRef = inputRef ?? ownRef;

  // Tocar na casa abre o teclado do celular: o foco tem de acontecer dentro do próprio toque (iOS exige).
  const onSelect = useCallback(
    (r: number, c: number) => {
      select(r, c);
      if (nativeInput) fieldRef.current?.focus();
    },
    [select, nativeInput, fieldRef],
  );

  // O campo acompanha a casa ativa (o navegador rola até ele quando o teclado abre).
  useLayoutEffect(() => {
    const el = fieldRef.current;
    const cell = gridRef.current?.querySelector<HTMLElement>('.cell.focus');
    if (!nativeInput || !el || !cell) return;
    el.style.left = `${cell.offsetLeft}px`;
    el.style.top = `${cell.offsetTop}px`;
    el.style.width = `${cell.offsetWidth}px`;
    el.style.height = `${cell.offsetHeight}px`;
  });

  const onInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      const ne = e.nativeEvent as InputEvent;
      const v = el.value;
      const typed = v.split(SENTINEL).join('');
      if (!typed) {
        if (!v.includes(SENTINEL)) backspace();
      } else {
        // Teclado com composição (Android) pode reenviar o trecho inteiro: fica só com a última letra.
        const chars = ne.inputType === 'insertCompositionText' ? typed.slice(-1) : typed;
        for (const ch of chars) {
          if (ch === ' ') toggleDir();
          else type(ch);
        }
      }
      resetField(el);
    },
    [backspace, toggleDir, type],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Letras e "apagar" chegam pelo evento de input (no Android o keydown vem como "Unidentified").
      const k = e.key;
      const nav: Record<string, () => void> = {
        ArrowLeft: () => move(0, -1),
        ArrowRight: () => move(0, 1),
        ArrowUp: () => move(-1, 0),
        ArrowDown: () => move(1, 0),
        Tab: () => tab(e.shiftKey ? -1 : 1),
        Enter: () => tab(1),
        Delete: () => clearCell(),
      };
      const fn = nav[k];
      if (!fn) return;
      e.preventDefault();
      fn();
    },
    [move, tab, clearCell],
  );

  const cells = useMemo(() => {
    const out: JSX.Element[] = [];
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const cell = puzzle.grid[r][c];
        const k = cellKey(r, c);
        if (!cell.letter) {
          out.push(<div key={k} className="cell block" aria-hidden="true" />);
          continue;
        }
        out.push(
          <Cell
            key={k}
            r={r}
            c={c}
            num={cell.number}
            letter={state.letters[r][c]}
            locked={state.locked[r][c]}
            flagged={flaggedSet.has(k)}
            inWord={activeKeys.has(k)}
            focus={state.r === r && state.c === c}
            done={doneCells.has(k)}
            dir={state.dir}
            shake={state.flagNonce}
            onSelect={onSelect}
          />,
        );
      }
    }
    return out;
  }, [puzzle, state.letters, state.locked, state.r, state.c, state.dir, state.flagNonce, flaggedSet, activeKeys, doneCells, onSelect]);

  return (
    <div className="board" style={{ '--cols': puzzle.cols, '--rows': puzzle.rows } as CSSProperties}>
      <div
        ref={gridRef}
        className="grid"
        role="grid"
        aria-label="Tabuleiro de palavras cruzadas"
        aria-rowcount={puzzle.rows}
        aria-colcount={puzzle.cols}
      >
        {cells}
        {nativeInput && (
          <input
            ref={fieldRef}
            className="native-field"
            type="text"
            inputMode="text"
            enterKeyHint="next"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label="Letra da casa selecionada"
            defaultValue={SENTINEL}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onFocus={(e) => {
              resetField(e.currentTarget);
              onTyping?.(true);
            }}
            onBlur={() => onTyping?.(false)}
          />
        )}
      </div>
    </div>
  );
}
