/**
 * ACERTE (tiro ao pato de lata): o pato anda em linha reta pela barraca e quica nas bordas, sempre na mesma
 * velocidade; a mira anda com o stick nos dois eixos, um pouco mais devagar que o pato. Um tiro só: com a mira em
 * cima do pato, derruba; fora, a rolha bate no fundo e perde. A janela é o tempo que o pato leva para atravessar a
 * mira parada: 300 ms na velocidade 1.
 */
import { base, janela, relogio, type Base, type EntradaQ, type Micro } from './tipos';

interface E extends Base {
  /** Pato: posição (x de 0 a 1, y de 0 a 0,6) e velocidade por passo. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Mira e quanto anda por passo. */
  mx: number;
  my: number;
  dm: number;
  caiu: number;
}

const V1 = 0.45;
const M1 = 0.4;
const TOL = (V1 * janela(1)) / 2;
const CAIXA = { x0: 0.1, x1: 0.9, y0: 0.12, y1: 0.5 };
const perto = (e: E, k = 1) => Math.hypot(e.x - e.mx, e.y - e.my) < TOL * k;

export const micro: Micro<E> = {
  id: 'acerte',
  verbo: 'ACERTE',
  nome: 'Tiro ao pato',
  segundos: 5,
  iniciar(r, vel) {
    // O pato sai de um canto em diagonal; a mira começa no meio.
    const a = (r() < 0.5 ? 0.35 : -0.35) + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.3;
    const v = (V1 * vel) / 60;
    const x = Math.cos(a) > 0 ? CAIXA.x0 : CAIXA.x1;
    return { ...base(vel, this.segundos), x, y: CAIXA.y0 + r() * (CAIXA.y1 - CAIXA.y0), vx: Math.cos(a) * v, vy: Math.sin(a) * v, mx: 0.5, my: 0.31, dm: (M1 * vel) / 60, caiu: -1 };
  },
  passo(e, ent: EntradaQ) {
    if (e.res !== 'andando') {
      e.t++;
      return;
    }
    e.x += e.vx;
    e.y += e.vy;
    if (e.x < CAIXA.x0 || e.x > CAIXA.x1) e.vx = -e.vx;
    if (e.y < CAIXA.y0 || e.y > CAIXA.y1) e.vy = -e.vy;
    e.x = Math.max(CAIXA.x0, Math.min(CAIXA.x1, e.x));
    e.y = Math.max(CAIXA.y0, Math.min(CAIXA.y1, e.y));
    const n = Math.hypot(ent.mx, ent.my);
    if (n > 0.01) {
      const k = Math.min(1, n);
      e.mx = Math.max(0, Math.min(1, e.mx + (ent.mx / n) * k * e.dm));
      e.my = Math.max(0, Math.min(0.6, e.my + (ent.my / n) * k * e.dm));
    }
    if (ent.acao) {
      if (perto(e)) {
        e.res = 'ganhou';
        e.caiu = e.t;
      } else e.res = 'perdeu';
      return;
    }
    relogio(e);
  },
  resultado: (e) => e.res,
  pronto: (e) => e.res === 'andando' && perto(e),
  // Perfeito: não persegue (a mira é mais lenta); prevê onde o pato vai estar, com os quiques, no primeiro instante em
  // que a mira consegue chegar lá antes, espera no ponto e atira com o pato bem no meio.
  bot: (e) => {
    const acao = e.res === 'andando' && perto(e, 0.35);
    let { x, y, vx, vy } = e;
    for (let k = 1; k < 600; k++) {
      x += vx;
      y += vy;
      if (x < CAIXA.x0 || x > CAIXA.x1) vx = -vx;
      if (y < CAIXA.y0 || y > CAIXA.y1) vy = -vy;
      x = Math.max(CAIXA.x0, Math.min(CAIXA.x1, x));
      y = Math.max(CAIXA.y0, Math.min(CAIXA.y1, y));
      const d = Math.hypot(x - e.mx, y - e.my);
      if (d <= e.dm * (k - 2)) {
        if (d <= e.dm) return { mx: 0, my: 0, acao };
        return { mx: (x - e.mx) / d, my: (y - e.my) / d, acao };
      }
    }
    return { mx: 0, my: 0, acao };
  },
  resposta: () => ({ mx: 0, my: 0, acao: true }),
  tempo: (e) => ({ t: e.t, dur: e.dur }),
  desenhar(c, e, w, h, q) {
    const ky = h / 0.6;
    // Fundo da barraca: lona verde, prateleira de prêmios embaixo.
    c.fillStyle = '#265c42';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#193c3e';
    for (let i = 0; i < w; i += 24) c.fillRect(i, 0, 12, h);
    c.fillStyle = '#8f563b';
    c.fillRect(0, h - 34, w, 34);
    const premios = ['#e43b44', '#feae34', '#2ce8f5', '#b55088', '#63c74d'];
    for (let i = 0; i < 9; i++) {
      c.fillStyle = premios[i % premios.length];
      c.fillRect(14 + i * 44, h - 52, 18, 18);
    }
    // Pato de lata (amarelo, bico laranja), olhando para onde anda; caído vira de lado.
    const px = Math.round(e.x * w);
    const py = Math.round(e.y * ky);
    const d = e.vx >= 0 ? 1 : -1;
    if (e.caiu < 0) {
      c.fillStyle = '#c28a1f';
      c.fillRect(px - 13, py - 6, 26, 14);
      c.fillStyle = '#fee761';
      c.fillRect(px - 12, py - 7, 24, 12);
      c.fillRect(px + d * 6 - 5, py - 17, 10, 11);
      c.fillStyle = '#f77622';
      c.fillRect(px + d * 11 - (d < 0 ? 5 : 0), py - 13, 5, 3);
      c.fillStyle = '#181425';
      c.fillRect(px + d * 8 - 1, py - 14, 2, 2);
      c.fillStyle = '#c28a1f';
      c.fillRect(px - d * 4 - 4, py - 4, 8, 4);
    } else {
      const u = Math.min(1, (e.t - e.caiu) / 20);
      c.fillStyle = '#fee761';
      c.fillRect(px - 12, py - 4 + u * 20, 24, 8);
      c.fillStyle = '#c28a1f';
      c.fillRect(px - 12, py + 4 + u * 20, 24, 3);
    }
    // Mira (anel com cruz); pisca de leve quando está em cima do pato.
    const mx = Math.round(e.mx * w);
    const my = Math.round(e.my * ky);
    const r = Math.round(TOL * w);
    c.strokeStyle = perto(e) && q % 10 < 5 ? '#fee761' : '#f4f4f4';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(mx, my, r, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = c.strokeStyle;
    c.fillRect(mx - r - 4, my - 1, 8, 2);
    c.fillRect(mx + r - 4, my - 1, 8, 2);
    c.fillRect(mx - 1, my - r - 4, 2, 8);
    c.fillRect(mx - 1, my + r - 4, 2, 8);
  },
};
