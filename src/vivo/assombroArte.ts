/**
 * Desenho das coisas do banheiro assombrado (Fatia 4, lote E): tudo em pixel, com cara própria.
 */
import { Raster, hex } from '../bar/raster';
import type { Sprite } from '../bar/render';
import type { Susto } from './assombro';
import { polir, type Grid } from '../arena/sprites';

const OUTLINE = '#181425';

const C = (c: string) => hex(c);
const cache = new Map<string, Sprite>();
const feito = (k: string, f: () => Sprite) => {
  let s = cache.get(k);
  if (!s) {
    s = f();
    cache.set(k, s);
  }
  return s;
};

/**
 * O inquilino do box 3 (desenho nosso): bicho que sobe pelo ralo. Curvado, magro e comprido, cabeça de enguia
 * caída para a frente com uma fileira de olhos verdes acesos, boca larga babando, dedos compridos e um rabo fino
 * de chicote. Volume em 3 tons (luz de cima, à esquerda) e contorno colorido, no acabamento dos bonecos.
 */
function inquilino(passo: number): Sprite {
  const W = 32;
  const H = 47;
  /** Esticado para cima: mais alto e mais magro que antes (pedido do dono, 26/11). */
  const K = 1.12;
  const g: Grid = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  const pele = '#2e3b35';
  const barriga = '#55654f';
  const pinta = (x: number, y: number, c: string) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi >= 0 && xi < W && yi >= 0 && yi < H) g[yi][xi] = c;
  };
  const disco = (cx: number, cy: number, r: number, c: string) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.25) pinta(x, y, c);
  };
  /** Membro de (x0,y0) a (x1,y1), afinando de r0 para r1. */
  const osso = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, c = pele) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      disco(x0 + (x1 - x0) * f, (y0 + (y1 - y0) * f) * K, r0 + (r1 - r0) * f, c);
    }
  };
  const a = passo % 2;
  // Rabo de chicote (atrás de tudo), enrolando no chão.
  const rabo = [[19, 27], [23, 28], [26, 31], [28, 35], [27, 38], [24, 39], [22, 37]];
  for (let i = 0; i + 1 < rabo.length; i++) osso(rabo[i][0], rabo[i][1], rabo[i + 1][0], rabo[i + 1][1] + (i > 3 ? a : 0), 1.6 - i * 0.2, 1.4 - i * 0.2);
  // Pernas finas (a de trás primeiro), joelho para a frente, pé comprido.
  osso(18, 27, 21, 32, 1.6, 1.1);
  osso(21, 32, 19 + a, 37, 1.1, 0.9);
  osso(19 + a, 37, 22 + a, 39, 0.8, 0.7);
  osso(15, 27, 12, 32, 1.8, 1.2);
  osso(12, 32, 14 - a, 37, 1.2, 1);
  osso(14 - a, 37, 10 - a, 39, 0.9, 0.7);
  // Tronco curvado (corcunda) e a barriga clara.
  osso(13, 18, 17, 27, 3.2, 2.6);
  osso(15, 17, 20, 21, 2.6, 2.2);
  for (let y = 20; y <= 26; y++) pinta(12 + (y - 20) * 0.5, y * K, barriga);
  // Pescoço caído para a frente e a cabeça de enguia (bulbosa, larga, inclinada para baixo).
  osso(14, 17, 10, 13, 2, 1.8);
  osso(9, 12, 4, 15, 4, 3.2);
  osso(10, 10, 6, 11, 3.4, 3);
  // Braço da frente: comprido, cotovelo para fora, dedos de garra.
  osso(12, 19, 8, 24, 1.4, 1.1);
  osso(8, 24, 6, 30 - a, 1.1, 0.9);
  // Garras compridas e finas.
  for (const [dx, dy] of [[-3, 5], [-1, 6], [1, 5]]) osso(6, 30 - a, 6 + dx, 30 - a + dy, 0.6, 0.4);
  // Contorno.
  const temCor = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && !!g[y][x];
  const comAnel = g.map((r) => r.slice());
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (!g[y][x] && (temCor(x - 1, y) || temCor(x + 1, y) || temCor(x, y - 1) || temCor(x, y + 1))) comAnel[y][x] = OUTLINE;
  const out = polir(comAnel);
  const put = (x: number, y: number, c: string) => {
    const yy = Math.round(y * K);
    if (out[yy]?.[x] !== undefined && out[yy][x]) out[yy][x] = c;
  };
  // Boca larga e babando, com dentinhos.
  for (let x = 1; x <= 7; x++) put(x, 16, '#181425');
  for (let x = 2; x <= 6; x++) put(x, 17, '#73172d');
  for (const x of [2, 4, 6]) put(x, 16, '#c0cbdc');
  put(3, 18, '#63c74d');
  put(3, 19, '#63c74d');
  put(3, 20, '#3e8948');
  put(6, 19, '#3e8948');
  put(6, 18, '#63c74d');
  // Fileira de olhos verdes acesos ao longo da cabeça.
  for (const [x, y] of [[4, 12], [7, 10], [10, 9]]) {
    put(x, y, '#63c74d');
    put(x + 1, y, '#e4f8c8');
  }
  // Pintas e brilho molhado no dorso.
  for (const [x, y] of [[16, 19], [18, 22], [15, 24], [11, 8], [8, 13], [19, 21], [14, 26]]) put(x, y, '#1b221e');
  // Brilho molhado (escorre pelo dorso, pela cabeça e pelos braços).
  for (const [x, y] of [[13, 16], [16, 17], [9, 8], [17, 19], [18, 20], [6, 10], [12, 9], [10, 20], [8, 23], [20, 29]]) put(x, y, '#d8e8d0');
  return { raster: gridRaster(out), ax: 15, ay: 45 };
}

/** Grade de cores em Raster (para os desenhos feitos em grade). */
function gridRaster(g: Grid): Raster {
  const r = new Raster(g[0].length, g.length);
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) if (g[y][x]) r.set(x, y, C(g[y][x]!));
  return r;
}

/** A menina da descarga engatinhando: vestido branco encharcado, cabelo preto cobrindo o rosto. */
function meninaEngatinha(q: number): Sprite {
  const r = new Raster(24, 14);
  const cabelo = C('#0b0a10');
  r.rect(7, 4, 13, 5, C('#c0cbdc'));
  r.rect(8, 4, 11, 1, C('#e4e4e4'));
  r.rect(14, 8, 6, 2, C('#94b0c2'));
  // Braços e pernas pálidos, tortos (o quadro trava e troca).
  const t = q % 2;
  r.rect(4, 8 - t, 2, 5 + t, C('#c0cbdc'));
  r.rect(8, 8 + t, 2, 4 - t, C('#c0cbdc'));
  r.rect(19, 9, 2, 4, C('#c0cbdc'));
  r.rect(16, 9 + t, 2, 3, C('#c0cbdc'));
  // Cabeça baixa com o cabelo escorrendo até o chão.
  r.rect(1, 2, 7, 6, cabelo);
  for (const x of [1, 3, 5, 7]) r.rect(x, 8, 1, 4 + (x % 3), cabelo);
  r.set(4, 5, C('#c0cbdc'));
  return { raster: r, ax: 12, ay: 12 };
}

/** A menina de pé, do seu lado. */
function meninaEmPe(): Sprite {
  const r = new Raster(12, 32);
  const cabelo = C('#0b0a10');
  r.rect(3, 9, 7, 16, C('#c0cbdc'));
  r.rect(4, 9, 5, 15, C('#e4e4e4'));
  r.rect(2, 11, 1, 10, C('#c0cbdc'));
  r.rect(10, 11, 1, 10, C('#c0cbdc'));
  r.rect(4, 25, 2, 6, C('#94b0c2'));
  r.rect(7, 25, 2, 6, C('#94b0c2'));
  // Cabelo cobre o rosto e desce até a cintura.
  r.rect(2, 0, 9, 10, cabelo);
  for (let x = 2; x <= 10; x += 2) r.rect(x, 10, 1, 6 + ((x * 3) % 5), cabelo);
  r.set(6, 6, C('#e4e4e4')); // um olho entre os fios
  return { raster: r, ax: 6, ay: 31 };
}

/** Chapéu vivo: um bicho de casco claro com perninhas e a boca rosa por baixo. */
function chapeu(passo: number): Sprite {
  const r = new Raster(12, 9);
  r.rect(2, 1, 8, 4, C('#e8c9a0'));
  r.rect(3, 0, 6, 1, C('#e8c9a0'));
  r.rect(3, 1, 4, 1, C('#f4e9c8'));
  r.rect(2, 4, 8, 1, C('#b86f50'));
  r.rect(4, 5, 4, 1, C('#e43b44'));
  const a = passo % 2;
  for (const [x, d] of [[1, -1], [3, -1], [8, 1], [10, 1]] as const) {
    r.set(x, 5, C('#b86f50'));
    r.set(x + d * a, 6, C('#b86f50'));
    r.set(x + d, 7, C('#733e39'));
  }
  return { raster: r, ax: 6, ay: 7 };
}

/** Totó da janela: cachorro podre, costelas de fora e olho vermelho. */
function toto(passo: number): Sprite {
  const r = new Raster(20, 13);
  const pelo = C('#5a6b3a');
  r.rect(4, 3, 11, 5, pelo);
  r.rect(14, 1, 5, 4, pelo);
  r.rect(18, 3, 2, 2, C('#3a4a2a'));
  r.set(16, 2, C('#e43b44'));
  r.rect(15, 5, 4, 1, C('#f4f4f4')); // dentes
  for (const x of [6, 8, 10]) r.rect(x, 4, 1, 3, C('#c0cbdc')); // costelas
  r.rect(11, 3, 2, 2, C('#a22633'));
  r.rect(1, 2, 3, 1, pelo);
  const a = passo % 2;
  r.rect(4 + a, 8, 2, 4, pelo);
  r.rect(7 - a, 8, 2, 4, pelo);
  r.rect(11 + a, 8, 2, 4, pelo);
  r.rect(13 - a, 8, 2, 4, pelo);
  return { raster: r, ax: 10, ay: 12 };
}

/** O cara do corredor: silhueta alta de cabeça angulosa, arrastando uma lâmina enorme. */
function corredor(): Sprite {
  const r = new Raster(22, 40);
  const sombra = C('#0b0a10');
  r.rect(4, 0, 10, 2, sombra);
  r.rect(3, 2, 12, 5, sombra);
  r.rect(6, 7, 6, 2, sombra);
  r.rect(4, 9, 10, 14, sombra);
  r.rect(2, 10, 2, 12, sombra);
  r.rect(14, 10, 2, 10, sombra);
  r.rect(5, 23, 3, 15, sombra);
  r.rect(10, 23, 3, 15, sombra);
  // Lâmina larga arrastando no chão.
  for (let i = 0; i < 18; i++) r.rect(15 + Math.floor(i / 6), 20 + i, 3, 1, C(i % 5 ? '#5a6988' : '#8b9bb4'));
  r.rect(14, 19, 3, 2, C('#3a2a1c'));
  return { raster: r, ax: 9, ay: 38 };
}

/** O radinho em cima da pia. */
function radio(): Sprite {
  const r = new Raster(12, 10);
  r.rect(1, 3, 10, 6, C('#5c3620'));
  r.rect(2, 4, 5, 4, C('#3a2a1c'));
  for (const y of [4, 6]) r.rect(2, y, 5, 1, C('#8f563b'));
  r.rect(8, 4, 2, 2, C('#c28a1f'));
  r.rect(8, 7, 2, 1, C('#feae34'));
  r.rect(9, 0, 1, 3, C('#8b9bb4'));
  return { raster: r, ax: 6, ay: 9 };
}

/** Acabamento dos bonecos num desenho pronto: anel de contorno colorido e volume em 3 tons. */
function acabado(sp: Sprite): Sprite {
  const { w, h, data } = sp.raster;
  const g: Grid = Array.from({ length: h + 2 }, () => Array<string | null>(w + 2).fill(null));
  const hx = (v: number) => v.toString(16).padStart(2, '0');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (data[o + 3] > 128) g[y + 1][x + 1] = `#${hx(data[o])}${hx(data[o + 1])}${hx(data[o + 2])}`;
    }
  const tem = (x: number, y: number) => !!g[y]?.[x];
  const anel = g.map((r) => r.slice());
  for (let y = 0; y < h + 2; y++)
    for (let x = 0; x < w + 2; x++) if (!g[y][x] && (tem(x - 1, y) || tem(x + 1, y) || tem(x, y - 1) || tem(x, y + 1))) anel[y][x] = OUTLINE;
  return { raster: gridRaster(polir(anel)), ax: sp.ax + 1, ay: sp.ay + 1 };
}

/** O desenho de cada susto no quadro `q` (anda de 2 em 2 quadros). */
export function spriteSusto(k: Susto, q: number, extra = 0): Sprite | null {
  switch (k) {
    case 'inquilino':
      return feito(`inq${q % 2}`, () => inquilino(q));
    case 'menina':
      return extra ? feito('menina-pe', () => acabado(meninaEmPe())) : feito(`menina${q % 2}`, () => acabado(meninaEngatinha(q)));
    case 'chapeu':
      return feito(`chapeu${q % 2}`, () => acabado(chapeu(q)));
    case 'toto':
      return feito(`toto${q % 2}`, () => acabado(toto(q)));
    case 'corredor':
      return feito('corredor', () => acabado(corredor()));
    case 'radio':
      return feito('radio', () => acabado(radio()));
    default:
      return null;
  }
}

export const RADIO = () => feito('radio', () => acabado(radio()));
