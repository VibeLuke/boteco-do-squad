/**
 * Fatia 17: bestiário II, o dragão no telhado e o dinossauro fugido do circo. Como a ratazana (Fatia 10), tudo aqui é
 * função pura da semente do evento e do tempo desde o início: todo aparelho vê a mesma cabeça no mesmo furo, o mesmo
 * sopro de fogo e a mesma investida, e cada aparelho só decide o que acerta o próprio jogador.
 *
 * O que muda por aparelho (e nunca mexe na rota nem no ritmo): a cachaça (golpe de molotov) deixa o dragão sonolento e
 * a geladeira aberta perto do dinossauro o atordoa, e os dois só dobram o dano de quem fez.
 */
import { rng, type Ponto } from './eventos';
import { anda } from './mapa';

/* ------------------------------------------------------------------ o dragão no telhado */

/** Vida base (escala com os jogadores da abertura, como a ratazana). */
export const DRAGAO_VIDA = 520;
export const DRAGAO_RAIO = 0.8;
/** Os 3 furos do forro por onde a cabeça desce (chão livre do salão, no corredor do meio). */
export const DRAGAO_FUROS: readonly Ponto[] = [
  [4.5, 5.5],
  [10.5, 4.5],
  [18.5, 5.5],
];
/** A cabeça troca de furo a cada 30 s (e o pisão no telhado derruba os móveis em volta do furo novo). */
export const DRAGAO_TROCA_MS = 30_000;
export const PISAO_RAIO = 2.4;
/** Sopro: linha vermelha no chão 1,2 s antes, fogo por 0,5 s, a cada 5 s (o primeiro 3 s depois de trocar de furo). */
export const FOGO_AVISO_MS = 1200;
export const FOGO_ATIVO_MS = 500;
export const FOGO_CADA_MS = 5000;
export const FOGO_PRIMEIRO_MS = 3000;
export const FOGO_COMPR = 7;
export const FOGO_LARG = 0.55;
/** O que o sopro deixa no chão queima por 8 s; quem fica em cima leva um pouco por segundo. */
export const POCA_FOGO_MS = 8000;
export const POCA_RAIO = 0.6;
export const DANO_FOGO = 14;
export const DANO_POCA = 4;
/** Golpe de molotov (cachaça) na cabeça: o dragão fica sonolento e o seu dano dobra por 10 s. */
export const SONO_MS = 10_000;
export const PREMIO_DRAGAO = 40;

/** O furo de cada fase de 30 s (nunca o mesmo duas vezes seguidas). */
export function furosDragao(semente: number, dura: number): number[] {
  const r = rng((semente ^ 0x5a17) >>> 0);
  const out: number[] = [];
  let ant = -1;
  for (let i = 0; i * DRAGAO_TROCA_MS < dura; i++) {
    let k = Math.floor(r() * DRAGAO_FUROS.length);
    if (k === ant) k = (k + 1) % DRAGAO_FUROS.length;
    out.push(k);
    ant = k;
  }
  return out;
}

/** Onde está a cabeça `dt` ms depois do início (o furo da fase). */
export function cabecaDragao(furos: readonly number[], dt: number): { fase: number; furo: Ponto } {
  const fase = Math.max(0, Math.min(furos.length - 1, Math.floor(dt / DRAGAO_TROCA_MS)));
  return { fase, furo: DRAGAO_FUROS[furos[fase]] };
}

export interface Sopro {
  id: number;
  de: Ponto;
  /** Direção unitária no chão (uma das 8). */
  dx: number;
  dy: number;
  /** Começo do fogo (ms desde o início); o aviso começa `FOGO_AVISO_MS` antes. */
  t0: number;
  /** Até onde o fogo vai: para no primeiro ladrilho bloqueado (parede ou móvel), no máximo `FOGO_COMPR`. */
  alc?: number;
}

/** Sopro mínimo que vale sortear (direção quase encostada na parede não serve). */
export const FOGO_ALC_MIN = 2.5;

/** Alcance do fogo do furo `de` na direção (dx, dy): o trecho livre a partir da boca. */
export function alcanceFogo(de: Ponto, dx: number, dy: number): number {
  for (let k = 0.4; k <= FOGO_COMPR; k += 0.05) if (!anda(Math.floor(de[0] + dx * k), Math.floor(de[1] + dy * k))) return Math.round(k * 100) / 100;
  return FOGO_COMPR;
}

/** Todos os sopros do evento, com direção sorteada entre as 8 (sem repetir a anterior). */
export function soprosDragao(semente: number, dura: number): Sopro[] {
  const furos = furosDragao(semente, dura);
  const r = rng((semente ^ 0xf090) >>> 0);
  const out: Sopro[] = [];
  let ant = -1;
  for (let f = 0; f < furos.length; f++) {
    const fim = Math.min(dura, (f + 1) * DRAGAO_TROCA_MS) - 1000;
    const de = DRAGAO_FUROS[furos[f]];
    const dirs = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => {
      const a = (d * Math.PI) / 4;
      const dx = Math.round(Math.cos(a) * 1e6) / 1e6;
      const dy = Math.round(Math.sin(a) * 1e6) / 1e6;
      return { d, dx, dy, alc: alcanceFogo(de, dx, dy) };
    });
    const boas = dirs.filter((o) => o.alc >= FOGO_ALC_MIN);
    for (let t0 = f * DRAGAO_TROCA_MS + FOGO_PRIMEIRO_MS; t0 + FOGO_ATIVO_MS <= fim; t0 += FOGO_CADA_MS) {
      let k = Math.floor(r() * boas.length);
      if (boas[k].d === ant && boas.length > 1) k = (k + 1) % boas.length;
      const o = boas[k];
      ant = o.d;
      out.push({ id: out.length, de, dx: o.dx, dy: o.dy, t0, alc: o.alc });
    }
  }
  return out;
}

/** O sopro em aviso ou em fogo na hora `dt` (no máximo um por vez). */
export function soproEm(sopros: readonly Sopro[], dt: number): { s: Sopro; fase: 'aviso' | 'ativo' } | null {
  for (const s of sopros) {
    if (dt >= s.t0 - FOGO_AVISO_MS && dt < s.t0) return { s, fase: 'aviso' };
    if (dt >= s.t0 && dt < s.t0 + FOGO_ATIVO_MS) return { s, fase: 'ativo' };
  }
  return null;
}

/** O ponto está na faixa de fogo do sopro? (da boca até 7 ladrilhos, meia largura 0,55). */
export function naLinhaFogo(s: Sopro, x: number, y: number): boolean {
  const px = x - s.de[0];
  const py = y - s.de[1];
  const ao = px * s.dx + py * s.dy;
  const lado = Math.abs(px * s.dy - py * s.dx);
  return ao >= 0.4 && ao <= (s.alc ?? FOGO_COMPR) && lado <= FOGO_LARG;
}

/** As poças de fogo acesas na hora `dt` (só em chão onde se anda, para não pegar fogo na parede). */
export function pocasFogo(sopros: readonly Sopro[], dt: number): { x: number; y: number; ate: number; id: string }[] {
  const out: { x: number; y: number; ate: number; id: string }[] = [];
  for (const s of sopros) {
    if (dt < s.t0 || dt >= s.t0 + POCA_FOGO_MS) continue;
    for (let d = 1.2, k = 0; d <= (s.alc ?? FOGO_COMPR); d += 1.4, k++) {
      const x = s.de[0] + s.dx * d;
      const y = s.de[1] + s.dy * d;
      if (!anda(Math.floor(x), Math.floor(y))) break;
      out.push({ x, y, ate: s.t0 + POCA_FOGO_MS, id: `${s.id}.${k}` });
    }
  }
  return out;
}

/** Pisões no telhado: um em cada troca de furo (a cabeça some de um furo e desce no outro). */
export function pisoesDragao(semente: number, dura: number): { t: number; furo: Ponto }[] {
  const furos = furosDragao(semente, dura);
  return furos.slice(1).map((k, i) => ({ t: (i + 1) * DRAGAO_TROCA_MS, furo: DRAGAO_FUROS[k] }));
}

/* ------------------------------------------------------------------ o dinossauro fugido do circo */

export const DINO_VIDA = 320;
export const DINO_RAIO = 0.7;
/** Trote entre as investidas, a investida em linha reta, a preparação (patas raspando) e a tontura na parede. */
export const DINO_TROTE = 2.2;
export const DINO_INVESTE = 7;
export const DINO_PREPARA_MS = 1000;
export const DINO_TONTO_MS = 2200;
export const DANO_DINO = 18;
/** Abrir a geladeira com ele a até 4 ladrilhos o atordoa por 4 s (no seu aparelho: ele não te pega e apanha em dobro). */
export const GELADEIRA_RAIO = 4;
export const ATORDOA_MS = 4000;
export const PREMIO_DINO = 30;

/** As faixas livres do salão onde ele investe (ponta a ponta; testado que todo ladrilho é chão livre). */
export const FAIXAS_DINO: readonly (readonly [Ponto, Ponto])[] = [
  [
    [1, 4.5],
    [21, 4.5],
  ],
  [
    [1, 5.5],
    [21, 5.5],
  ],
  [
    [14.5, 0.8],
    [14.5, 9.4],
  ],
  [
    [11.5, 1.5],
    [11.5, 9.4],
  ],
];

export type FaseDino = 'anda' | 'prepara' | 'investe' | 'tonto';
export interface TrechoDino {
  de: Ponto;
  para: Ponto;
  t0: number;
  t1: number;
  fase: FaseDino;
  /** Número da investida (as fases da mesma investida têm o mesmo). */
  id: number;
}

/**
 * Rota do dinossauro: entra pela calçada, trota até a ponta de uma faixa, raspa as patas, investe até a outra ponta,
 * fica tonto na parede e repete (faixa sorteada, nunca a mesma em seguida); sai pela calçada antes do fim.
 */
export function rotaDino(semente: number, entrada: Ponto, dura: number): TrechoDino[] {
  const r = rng((semente ^ 0xd1e0) >>> 0);
  const ms = (a: Ponto, b: Ponto, v: number) => (Math.hypot(b[0] - a[0], b[1] - a[1]) / v) * 1000;
  const out: TrechoDino[] = [];
  let aqui = entrada;
  let t = 0;
  let ant = -1;
  for (let id = 0; id < 40; id++) {
    let f = Math.floor(r() * FAIXAS_DINO.length);
    if (f === ant) f = (f + 1) % FAIXAS_DINO.length;
    const vai = r() < 0.5;
    const [a, b] = vai ? FAIXAS_DINO[f] : [FAIXAS_DINO[f][1], FAIXAS_DINO[f][0]];
    const ida = ms(aqui, a, DINO_TROTE);
    const corre = ms(a, b, DINO_INVESTE);
    if (t + ida + DINO_PREPARA_MS + corre + DINO_TONTO_MS + ms(b, entrada, DINO_TROTE) > dura) break;
    ant = f;
    out.push({ de: aqui, para: a, t0: t, t1: t + ida, fase: 'anda', id });
    t += ida;
    out.push({ de: a, para: a, t0: t, t1: t + DINO_PREPARA_MS, fase: 'prepara', id });
    t += DINO_PREPARA_MS;
    out.push({ de: a, para: b, t0: t, t1: t + corre, fase: 'investe', id });
    t += corre;
    out.push({ de: b, para: b, t0: t, t1: t + DINO_TONTO_MS, fase: 'tonto', id });
    t += DINO_TONTO_MS;
    aqui = b;
  }
  out.push({ de: aqui, para: entrada, t0: t, t1: t + ms(aqui, entrada, DINO_TROTE), fase: 'anda', id: -1 });
  return out;
}

export interface PosDino {
  x: number;
  y: number;
  fx: number;
  fy: number;
  fase: FaseDino;
  id: number;
  /** Na preparação: para onde vai investir (o aviso no chão). */
  alvo: Ponto | null;
  fora: boolean;
}

export function posDino(rota: readonly TrechoDino[], dt: number): PosDino {
  const ult = rota[rota.length - 1];
  if (!(dt >= 0) || dt >= ult.t1) return { x: ult.para[0], y: ult.para[1], fx: 0, fy: 1, fase: 'anda', id: -1, alvo: null, fora: true };
  const i = rota.findIndex((p) => dt < p.t1);
  const tr = rota[i];
  const k = tr.t1 > tr.t0 ? (dt - tr.t0) / (tr.t1 - tr.t0) : 1;
  // Parado (preparando ou tonto) ele olha para onde vai ou para onde veio.
  const ref = tr.fase === 'prepara' ? rota[i + 1] : tr.fase === 'tonto' ? rota[i - 1] : tr;
  const dx = ref.para[0] - ref.de[0];
  const dy = ref.para[1] - ref.de[1];
  const n = Math.hypot(dx, dy) || 1;
  return {
    x: tr.de[0] + (tr.para[0] - tr.de[0]) * k,
    y: tr.de[1] + (tr.para[1] - tr.de[1]) * k,
    fx: dx / n,
    fy: dy / n,
    fase: tr.fase,
    id: tr.id,
    alvo: tr.fase === 'prepara' ? rota[i + 1].para : null,
    fora: false,
  };
}

/**
 * A investida pegou quem está em (x, y) entre `dtAnt` e `dt`? Teste varrido (o trecho que ele correu, não só o ponto
 * do quadro: a 7 ladrilhos/s, num quadro lento ele pularia por cima). Devolve o número da investida, ou null.
 */
export function batidaDino(rota: readonly TrechoDino[], dtAnt: number, dt: number, x: number, y: number): number | null {
  const a = Math.max(dtAnt, dt - 250);
  for (const tr of rota) {
    if (tr.fase !== 'investe' || tr.t1 <= a || tr.t0 > dt) continue;
    const p = (u: number) => {
      const k = Math.max(0, Math.min(1, (u - tr.t0) / (tr.t1 - tr.t0)));
      return [tr.de[0] + (tr.para[0] - tr.de[0]) * k, tr.de[1] + (tr.para[1] - tr.de[1]) * k] as const;
    };
    const [x0, y0] = p(Math.max(a, tr.t0));
    const [x1, y1] = p(Math.min(dt, tr.t1));
    const vx = x1 - x0;
    const vy = y1 - y0;
    const l2 = vx * vx + vy * vy;
    const k = l2 ? Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / l2)) : 0;
    if (Math.hypot(x - (x0 + vx * k), y - (y0 + vy * k)) <= DINO_RAIO + 0.3) return tr.id;
  }
  return null;
}
