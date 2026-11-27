/** Controle: o joystick e o teclado dão a direção na tela; o jogo anda em ladrilhos. */
import { TH, TW } from '../bar/iso';

/** Joystick/teclado (direção na tela) para direção em ladrilhos, mantendo a intensidade. */
export function telaParaLadrilho(ux: number, uy: number): { mx: number; my: number } {
  const len = Math.min(1, Math.hypot(ux, uy));
  if (len < 0.08) return { mx: 0, my: 0 };
  const tx = (ux / (TW / 2) + uy / (TH / 2)) / 2;
  const ty = (uy / (TH / 2) - ux / (TW / 2)) / 2;
  const n = Math.hypot(tx, ty) || 1;
  return { mx: (tx / n) * len, my: (ty / n) * len };
}

