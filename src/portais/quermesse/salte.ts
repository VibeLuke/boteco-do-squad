/**
 * SALTE (corrida da fogueira): o caipira corre parado no lugar e a fogueira vem da direita. Um pulo só: tem de estar
 * no ar o tempo todo em que passa por cima do fogo. Pulou cedo, desce em cima da brasa; tarde, tropeça na lenha.
 * A janela é a sobra do pulo além da travessia: 300 ms na velocidade 1.
 */
import { base, janela, relogio, type Base, type EntradaQ, type Micro } from './tipos';

interface E extends Base {
  /** Fogueira (centro, x de 0 a 1) e quanto anda por passo. */
  xf: number;
  du: number;
  /** Passo em que pulou (−1: no chão, não pulou). */
  pulo: number;
  /** Duração do pulo em passos. */
  jp: number;
}

const X = 0.22; // o corredor
const RW = 0.03;
const FW = 0.05;
const U1 = 0.45; // velocidade da fogueira na velocidade 1 (larguras por segundo)
const toca = (xf: number) => Math.abs(xf - X) < FW + RW;
const noAr = (e: E, t: number) => e.pulo >= 0 && t - e.pulo < e.jp;

/** Se pular agora: em quantos passos o fogo começa e termina de passar por baixo (k = 0 é este passo). */
function travessia(e: E): { entra: number; sai: number } {
  let entra = -1;
  let sai = -1;
  for (let k = 0; k < 600; k++) {
    const xf = e.xf - (k + 1) * e.du;
    if (toca(xf)) {
      if (entra < 0) entra = k;
      sai = k;
    } else if (entra >= 0) break;
  }
  return { entra, sai };
}

/** Pular agora cobre a travessia inteira? Devolve a folga dos dois lados (ou null). */
function folga(e: E): { antes: number; depois: number } | null {
  if (e.pulo >= 0 || e.res !== 'andando') return null;
  const { entra, sai } = travessia(e);
  if (entra < 0) return null;
  const depois = e.jp - 1 - sai;
  return entra >= 0 && depois >= 0 ? { antes: entra, depois } : null;
}

export const micro: Micro<E> = {
  id: 'salte',
  verbo: 'SALTE',
  nome: 'Pula-fogueira',
  segundos: 5,
  iniciar(r, vel) {
    const u = U1 * vel;
    // A travessia (fogo + corpo) leva 2·(FW+RW)/u; o pulo dura isso mais a janela.
    const jp = Math.round(((2 * (FW + RW)) / u + janela(vel)) * 60);
    // O fogo encosta entre 1,5 e 2,3 s (na velocidade 1) depois do começo.
    const chega = (1.5 + r() * 0.8) / vel;
    return { ...base(vel, this.segundos), xf: X + FW + RW + u * chega, du: u / 60, pulo: -1, jp };
  },
  passo(e, ent: EntradaQ) {
    // Depois do resultado o relógio segue só para a animação (o regente ainda chama na pausa do resultado).
    if (e.res !== 'andando') {
      e.t++;
      return;
    }
    if (ent.acao && e.pulo < 0) e.pulo = e.t;
    e.xf -= e.du;
    if (toca(e.xf) && !noAr(e, e.t)) {
      e.res = 'perdeu';
      return;
    }
    if (e.xf + FW < X - RW) {
      e.res = 'ganhou';
      return;
    }
    relogio(e);
  },
  resultado: (e) => e.res,
  pronto: (e) => folga(e) !== null,
  // Perfeito: pula no meio da janela (quando a folga de antes já não é maior que a de depois).
  bot: (e) => {
    const f = folga(e);
    return { mx: 0, my: 0, acao: !!f && f.antes <= f.depois };
  },
  resposta: () => ({ mx: 0, my: 0, acao: true }),
  tempo: (e) => ({ t: e.t, dur: e.dur }),
  desenhar(c, e, w, h, q) {
    const chao = h - 60;
    c.fillStyle = '#20163a';
    c.fillRect(0, 0, w, h);
    // Estrelas e lua.
    c.fillStyle = '#f4f4f4';
    for (let i = 0; i < 24; i++) c.fillRect((i * 97) % w, (i * 53) % (chao - 40), 1, 1);
    c.fillStyle = '#fee761';
    c.fillRect(w - 60, 20, 18, 18);
    c.fillStyle = '#20163a';
    c.fillRect(w - 54, 18, 14, 14);
    // Chão de terra batida com marcas que correm (dá a sensação de corrida).
    c.fillStyle = '#5c3620';
    c.fillRect(0, chao, w, h - chao);
    c.fillStyle = '#3e2731';
    const off = Math.round((e.t * e.du * w) % 40);
    for (let i = -1; i < w / 40 + 1; i++) c.fillRect(i * 40 - off, chao + 14, 18, 3);
    // Fogueira: lenha em X e chamas que dançam.
    const fx = Math.round(e.xf * w);
    c.fillStyle = '#8f563b';
    c.fillRect(fx - 18, chao - 6, 36, 6);
    c.fillStyle = '#5c3620';
    c.fillRect(fx - 14, chao - 10, 28, 4);
    const chama = ['#e43b44', '#f77622', '#feae34', '#fee761'];
    for (let k = 0; k < 4; k++) {
      const alt = 26 - k * 6 + ((q + k * 7) % 6);
      const larg = 30 - k * 7;
      c.fillStyle = chama[k];
      c.fillRect(fx - larg / 2, chao - 8 - alt, larg, alt);
    }
    // O corredor: no ar segue uma parábola.
    let alt = 0;
    if (e.pulo >= 0) {
      const u = (e.t - e.pulo) / e.jp;
      if (u < 1) alt = Math.round(4 * u * (1 - u) * 56);
    }
    const rx = Math.round(X * w);
    const ry = chao - alt;
    const passo = alt ? 0 : Math.floor(q / 6) % 2;
    c.fillStyle = '#262b44';
    c.fillRect(rx - 5 + passo * 2, ry - 10, 4, 10);
    c.fillRect(rx + 1 - passo * 2, ry - 10, 4, 10);
    c.fillStyle = '#e43b44';
    c.fillRect(rx - 7, ry - 26, 14, 16);
    c.fillStyle = '#f4f4f4';
    for (let i = 0; i < 3; i++) c.fillRect(rx - 6 + i * 5, ry - 24 + (i % 2) * 6, 2, 2);
    c.fillStyle = '#e8b796';
    c.fillRect(rx - 5, ry - 36, 10, 10);
    // Chapéu de palha.
    c.fillStyle = '#feae34';
    c.fillRect(rx - 9, ry - 38, 18, 3);
    c.fillRect(rx - 5, ry - 43, 10, 5);
  },
};
