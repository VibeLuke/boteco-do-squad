/**
 * QUEBRE (barraca do quebra-pote): o pote de barro balança no alto como pêndulo; o vendado está embaixo, no meio, com
 * o pau. Um aperto só: com o pote passando pelo meio, quebra (doce para todo lado); fora do meio, o pau acerta o ar.
 * A janela é o tempo que o pote fica perto do meio, onde anda mais rápido: 300 ms na velocidade 1.
 */
import { base, janela, relogio, type Base, type EntradaQ, type Micro } from './tipos';

interface E extends Base {
  /** Fase do pêndulo (rad) e velocidade angular (rad/s). */
  fase: number;
  w: number;
  /** Quebrado em que passo (para o doce voar). */
  quebrou: number;
  errou: number;
}

const A = 0.36;
const W1 = Math.PI; // rad/s na velocidade 1 (um balanço a cada 2 s)
/** Distância do meio que ainda quebra: a janela no meio dá `janela(1)` na velocidade 1. */
const TOL = Math.sin(((W1 * janela(1)) / 2)) * A;
const x = (e: E) => 0.5 + A * Math.sin(e.fase);

export const micro: Micro<E> = {
  id: 'quebre',
  verbo: 'QUEBRE',
  nome: 'Quebra-pote',
  segundos: 5,
  iniciar(r, vel) {
    // Começa perto de uma ponta (o pote leva ~0,5 s até o meio), de um lado ou do outro.
    const lado = r() < 0.5 ? 1 : -1;
    return { ...base(vel, this.segundos), fase: lado * (Math.PI / 2) + (r() - 0.5) * 0.4, w: W1 * vel, quebrou: -1, errou: -1 };
  },
  passo(e, ent: EntradaQ) {
    // Depois do resultado o relógio segue só para a animação (o regente ainda chama na pausa do resultado).
    if (e.res !== 'andando') {
      e.t++;
      return;
    }
    e.fase += e.w / 60;
    if (ent.acao) {
      if (Math.abs(x(e) - 0.5) < TOL) {
        e.res = 'ganhou';
        e.quebrou = e.t;
      } else {
        e.res = 'perdeu';
        e.errou = e.t;
      }
      return;
    }
    relogio(e);
  },
  resultado: (e) => e.res,
  pronto: (e) => e.res === 'andando' && Math.abs(x(e) - 0.5) < TOL,
  bot: (e) => ({ mx: 0, my: 0, acao: e.res === 'andando' && Math.abs(x(e) - 0.5) < TOL * 0.3 }),
  resposta: () => ({ mx: 0, my: 0, acao: true }),
  tempo: (e) => ({ t: e.t, dur: e.dur }),
  desenhar(c, e, w, h, q) {
    // Céu de festa e varal de bandeirinhas.
    c.fillStyle = '#1b2848';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#3b2a20';
    c.fillRect(0, h - 40, w, 40);
    const cores = ['#e43b44', '#feae34', '#2ce8f5', '#63c74d', '#b55088'];
    for (let i = 0; i < 16; i++) {
      c.fillStyle = cores[i % cores.length];
      const bx = i * 26 + 4;
      const by = 18 + Math.round(Math.sin(i * 0.9) * 2);
      c.beginPath();
      c.moveTo(bx, by);
      c.lineTo(bx + 16, by);
      c.lineTo(bx + 8, by + 12);
      c.fill();
    }
    // Pêndulo: corda do alto até o pote.
    const px = Math.round(x(e) * w);
    const piv = { x: w / 2, y: 8 };
    const py = 92 - Math.round(Math.abs(x(e) - 0.5) * 40);
    c.strokeStyle = '#c0cbdc';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(piv.x, piv.y);
    c.lineTo(px, py - 12);
    c.stroke();
    if (e.quebrou < 0) {
      // Pote de barro com faixa pintada.
      c.fillStyle = '#5c3620';
      c.fillRect(px - 13, py - 10, 26, 22);
      c.fillStyle = '#b86f50';
      c.fillRect(px - 12, py - 11, 24, 20);
      c.fillStyle = '#feae34';
      c.fillRect(px - 12, py - 4, 24, 3);
      c.fillStyle = '#e8b796';
      c.fillRect(px - 9, py - 9, 6, 3);
      c.fillStyle = '#5c3620';
      c.fillRect(px - 6, py - 14, 12, 4);
    } else {
      // Quebrou: cacos e doces voando.
      const u = Math.min(1, (e.t - e.quebrou + (q % 1)) / 30);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.fillStyle = i % 3 ? ['#e43b44', '#feae34', '#2ce8f5', '#63c74d'][i % 4] : '#b86f50';
        c.fillRect(Math.round(px + Math.cos(a) * 40 * u) - 2, Math.round(py + Math.sin(a) * 30 * u + 40 * u * u) - 2, 4, 4);
      }
    }
    // Onde quebra: duas estacas de giz no chão marcam o meio (antes era uma coluna clara do chão ao teto, que lia
    // como defeito de desenho).
    const e0 = Math.round((0.5 - TOL) * w);
    const e1 = Math.round((0.5 + TOL) * w);
    c.fillStyle = '#c0cbdc';
    for (const ex of [e0, e1]) {
      c.fillRect(ex - 1, h - 52, 3, 14);
      c.fillRect(ex - 3, h - 54, 7, 3);
    }
    for (let xx = e0 + 6; xx < e1 - 4; xx += 10) c.fillRect(xx, h - 39, 5, 2);
    // O vendado com o pau levantado (desce quando aperta).
    const bx = w / 2;
    const by = h - 40;
    const bateu = e.quebrou >= 0 || e.errou >= 0;
    c.fillStyle = '#262b44';
    c.fillRect(bx - 7, by - 26, 14, 26);
    c.fillStyle = '#e8b796';
    c.fillRect(bx - 6, by - 38, 12, 12);
    c.fillStyle = '#e43b44';
    c.fillRect(bx - 7, by - 34, 14, 3);
    c.strokeStyle = '#8f563b';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(bx + 6, by - 22);
    c.lineTo(bateu ? bx + 4 : bx + 10, bateu ? by - 70 : by - 60);
    c.stroke();
  },
};
