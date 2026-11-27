import { ArrowLeftRight, Delete } from 'lucide-react';

interface Props {
  onKey: (letter: string) => void;
  onBackspace: () => void;
  onToggle: () => void;
}

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export function VirtualKeyboard({ onKey, onBackspace, onToggle }: Props) {
  const prevent = (e: React.MouseEvent | React.PointerEvent) => e.preventDefault();
  return (
    <div className="vkb" role="group" aria-label="Teclado virtual">
      {ROWS.map((row, i) => (
        <div key={row} className="vkb-row">
          {i === 2 && (
            <button
              type="button"
              className="vkb-key vkb-wide"
              onMouseDown={prevent}
              onClick={onToggle}
              aria-label="Alternar direção"
              title="Alternar direção"
            >
              <ArrowLeftRight size={18} aria-hidden="true" />
            </button>
          )}
          {row.split('').map((ch) => (
            <button key={ch} type="button" className="vkb-key" onMouseDown={prevent} onClick={() => onKey(ch)}>
              {ch}
            </button>
          ))}
          {i === 2 && (
            <button
              type="button"
              className="vkb-key vkb-wide"
              onMouseDown={prevent}
              onClick={onBackspace}
              aria-label="Apagar"
              title="Apagar"
            >
              <Delete size={19} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
