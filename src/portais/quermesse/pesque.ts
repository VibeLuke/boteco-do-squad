/**
 * PESQUE (pescaria de papelão): o peixe nada de um lado a outro na lagoa, sempre na mesma velocidade, e volta pelo
 * mesmo lado quando sai. O anzol anda com o stick, mais devagar que o peixe (não dá para ir atrás dele: tem de esperar
 * no caminho). Um puxão só: com a boca do peixe embaixo do anzol, fisgou; fora, assusta o peixe e perde.
 * A janela é o tempo que a boca leva para passar embaixo do anzol: 300 ms na velocidade 1.
 */
import { base, janela, relogio, type Base, type EntradaQ, type Micro } from './tipos';

interface E extends Base {
  /** Peixe: x (0 a 1), sentido (+1 vai para a direita) e quanto anda por passo. */
  px: number;
  dir: 1 | -1;
  dv: number;
  /** Anzol: x e quanto anda por passo. */
  ax: number;
  da: number;
  fisgou: number;
}

const V1 = 0.55; // peixe, larguras por segundo na velocidade 1
const A1 = 0.4; // anzol
const TOL = (V1 * janela(1)) / 2;
const boca = (e: E) => e.px + e.dir * 0.06;

export const micro: Micro<E> = {
  id: 'pesque',
  verbo: 'PESQUE',
  nome: 'Pescaria',
  segundos: 5,
  iniciar(r, vel) {
    const dir = r() < 0.5 ? 1 : -1;
    return { ...base(vel, this.segundos), px: dir > 0 ? -0.15 : 1.15, dir, dv: (V1 * vel) / 60, ax: 0.35 + r() * 0.3, da: (A1 * vel) / 60, fisgou: -1 };
  },
  passo(e, ent: EntradaQ) {
    // Depois do resultado o relógio segue só para a animação (o regente ainda chama na pausa do resultado).
    if (e.res !== 'andando') {
      e.t++;
      return;
    }
    e.px += e.dir * e.dv;
    if (e.px > 1.2) e.px = -0.2;
    if (e.px < -0.2) e.px = 1.2;
    e.ax = Math.max(0.05, Math.min(0.95, e.ax + Math.max(-1, Math.min(1, ent.mx)) * e.da));
    if (ent.acao) {
      if (Math.abs(e.ax - boca(e)) < TOL) {
        e.res = 'ganhou';
        e.fisgou = e.t;
      } else e.res = 'perdeu';
      return;
    }
    relogio(e);
  },
  resultado: (e) => e.res,
  pronto: (e) => e.res === 'andando' && Math.abs(e.ax - boca(e)) < TOL,
  // Perfeito: leva o anzol para o meio e espera a boca passar bem embaixo.
  bot: (e) => ({ mx: Math.abs(e.ax - 0.5) > e.da ? -Math.sign(e.ax - 0.5) : 0, my: 0, acao: e.res === 'andando' && Math.abs(e.ax - boca(e)) < TOL * 0.3 }),
  resposta: () => ({ mx: 0, my: 0, acao: true }),
  tempo: (e) => ({ t: e.t, dur: e.dur }),
  desenhar(c, e, w, h, q) {
    const agua = 110;
    // Barraca: toldo listrado e fundo de lona.
    c.fillStyle = '#3e2731';
    c.fillRect(0, 0, w, agua);
    for (let i = 0; i < w / 20; i++) {
      c.fillStyle = i % 2 ? '#f4f4f4' : '#e43b44';
      c.fillRect(i * 20, 0, 20, 16);
    }
    c.fillStyle = '#feae34';
    c.font = '10px VT323, monospace';
    c.fillText('PESCARIA · 3 FICHAS', 12, 32);
    // Lagoa de papelão azul com ondinhas.
    c.fillStyle = '#124e89';
    c.fillRect(0, agua, w, h - agua);
    c.fillStyle = '#0099db';
    for (let i = 0; i < 12; i++) c.fillRect(((i * 61 + q) % (w + 40)) - 20, agua + 18 + ((i * 37) % (h - agua - 30)), 14, 2);
    c.fillStyle = '#8f563b';
    c.fillRect(0, agua - 4, w, 6);
    // Peixe de papelão (boca para onde nada).
    const fx = Math.round(e.px * w);
    const sobe = e.fisgou >= 0 ? Math.min(60, (e.t - e.fisgou) * 6) : 0;
    const fy = agua + 60 + Math.round(Math.sin(e.t / 9) * 3) - sobe;
    const d = e.dir;
    c.fillStyle = '#f77622';
    c.fillRect(fx - 18, fy - 8, 36, 16);
    c.fillStyle = '#feae34';
    c.fillRect(fx - 14, fy - 6, 20, 4);
    c.fillStyle = '#e43b44';
    c.fillRect(fx - d * 22 - 4, fy - 9, 8, 18); // rabo
    c.fillStyle = '#181425';
    c.fillRect(fx + d * 10 - 1, fy - 4, 3, 3); // olho
    c.fillStyle = '#3e2731';
    c.fillRect(Math.round(boca(e) * w) - 3, fy + 1, 6, 4); // boca aberta
    // Vara, linha e anzol (sobe com o peixe quando fisga).
    const ax = Math.round(e.ax * w);
    const ay = fy - 2;
    c.strokeStyle = '#c0cbdc';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(ax, 40);
    c.lineTo(ax, ay);
    c.stroke();
    c.fillStyle = '#c0cbdc';
    c.fillRect(ax - 1, ay - 2, 3, 6);
    c.fillRect(ax + 1, ay + 3, 3, 2);
    c.fillStyle = '#8f563b';
    c.fillRect(ax - 30, 38, 32, 3);
  },
};
