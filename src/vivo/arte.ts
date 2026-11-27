/**
 * A arte do Bar Vivo, toda desenhada em código (pixel a pixel, sem imagens): um fundo por área (chão, paredes,
 * enfeites e a luz parada) e os móveis como sprites que entram na ordem de profundidade junto com as pessoas.
 */
import { TH, TW, tileToScreen } from '../bar/iso';
import { Raster, hex, type RGBA } from '../bar/raster';
import { propSprite as barProp, weaponSprite, type Sprite } from '../bar/render';
import { AREAS, COLS, ROWS, DIVISA, GRADE, PAREDE, PAREDE_H, ladoDeFora, pisoDe, zonaDe, type Area, type Kind, type Prop, type Arma, type Zona } from './mapa';
import { PODER, PODERES_NOVOS } from './poderes';

export const MARGIN = 10;
const HEADROOM = 10;

export interface Layout {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

function layoutDe(a: Area): Layout {
  const ox = MARGIN - (a.x0 - a.y1) * (TW / 2);
  const oy = MARGIN + HEADROOM + PAREDE_H - (a.x0 + a.y0) * (TH / 2);
  const w = (a.x1 - a.y0 - (a.x0 - a.y1)) * (TW / 2) + 2 * MARGIN;
  const h = (a.x1 + a.y1 - (a.x0 + a.y0)) * (TH / 2) + PAREDE_H + HEADROOM + 2 * MARGIN;
  return { w, h, ox, oy };
}

/** Uma tela lógica por área: a câmera só mostra a área de quem joga. */
export const LAYOUTS: Record<Zona, Layout> = { bar: layoutDe(AREAS.bar), banheiro: layoutDe(AREAS.banheiro) };
export const LAYOUT = LAYOUTS.bar;

/** Ponto da tela lógica da área onde ficam os pés de quem está em (x, y). */
export function telaDe(x: number, y: number, z: Zona = zonaDe(x, y)): { x: number; y: number } {
  const L = LAYOUTS[z];
  const p = tileToScreen(x, y);
  return { x: L.ox + p.x, y: L.oy + p.y };
}

const C = (c: string, a = 255) => hex(c, a);

/* ------------------------------------------------------------------ luz parada do cenário */

interface Luz {
  x: number;
  y: number;
  r: number;
  cor: readonly [number, number, number];
  forca: number;
}

/** Luzes quentes do salão, a fria da geladeira, o rosa do neon, os postes, o fogo do beco e a fluorescente do banheiro. */
export const LUZES: readonly Luz[] = [
  { x: 5, y: 4.5, r: 6.5, cor: [255, 196, 120], forca: 0.55 },
  { x: 9.5, y: 7, r: 5, cor: [255, 190, 110], forca: 0.4 },
  { x: 17.5, y: 4.5, r: 5.5, cor: [255, 210, 140], forca: 0.5 },
  { x: 12, y: 1.2, r: 3.2, cor: [150, 220, 255], forca: 0.45 },
  { x: 5.5, y: 0.6, r: 4.5, cor: [255, 80, 170], forca: 0.35 },
  { x: 15.5, y: 1.2, r: 3, cor: [60, 230, 245], forca: 0.4 },
  { x: 21.3, y: 13.3, r: 6, cor: [255, 200, 120], forca: 0.6 },
  { x: 6.5, y: 10.5, r: 4.5, cor: [255, 170, 90], forca: 0.25 },
  { x: 25.5, y: 5.5, r: 4.5, cor: [255, 140, 50], forca: 0.75 },
  { x: 27.3, y: 12.3, r: 5, cor: [255, 200, 120], forca: 0.5 },
  { x: 24.5, y: 10.5, r: 2.5, cor: [255, 120, 40], forca: 0.45 },
  { x: 32.8, y: 2.6, r: 6, cor: [200, 255, 220], forca: 0.55 },
];

/** Quanto de escuro em cada ponto (fora é noite; dentro é penumbra) e a cor da luz que chega. */
function iluminar(x: number, y: number, base: readonly [number, number, number], fora: boolean): RGBA {
  const amb = fora ? 0.38 : 0.6;
  let r = base[0] * amb;
  let g = base[1] * amb;
  let b = base[2] * amb;
  if (fora) b = Math.min(255, b + 10); // noite azulada
  for (const l of LUZES) {
    const d = Math.hypot(x - l.x, y - l.y);
    if (d >= l.r) continue;
    const k = (1 - d / l.r) ** 2 * l.forca;
    r += base[0] * k * (l.cor[0] / 255) + l.cor[0] * k * 0.08;
    g += base[1] * k * (l.cor[1] / 255) + l.cor[1] * k * 0.08;
    b += base[2] * k * (l.cor[2] / 255) + l.cor[2] * k * 0.08;
  }
  return [Math.min(255, r), Math.min(255, g), Math.min(255, b), 255];
}

const rgb = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

/* ------------------------------------------------------------------ chão */

function corDoChao(fx: number, fy: number): [number, number, number] | null {
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return null;
  const u = fx - tx;
  const v = fy - ty;
  const borda = u < 0.04 || v < 0.04;
  switch (pisoDe(tx, ty)) {
    case 'taco': {
      // Taco de madeira em espinha: blocos de 1/3 de ladrilho, alternando a direção.
      const alt = (tx + ty) % 2 === 0;
      const w = alt ? u : v;
      const lw = alt ? v : u;
      const tabua = Math.floor(w * 3);
      if (borda || (w * 3) % 1 < 0.08) return rgb('#3b2418');
      const tom = (tabua + tx * 3 + ty * 5) % 3;
      const veio = Math.sin(lw * 19 + tabua * 2.1) > 0.82;
      return rgb(veio ? '#5a3826' : tom === 0 ? '#7a4e33' : tom === 1 ? '#6c4430' : '#83563a');
    }
    case 'lajota': {
      // Lajota vermelha de 2×2 por ladrilho, com rejunte e desgaste.
      const su = (u * 2) % 1;
      const sv = (v * 2) % 1;
      if (su < 0.07 || sv < 0.07) return rgb('#5c2a20');
      const k = (Math.floor(u * 2) + Math.floor(v * 2) * 2 + tx * 7 + ty * 3) % 4;
      return rgb(k === 0 ? '#9c4a32' : k === 1 ? '#8f4430' : k === 2 ? '#a5533a' : '#93472f');
    }
    case 'pedra': {
      // Pedra portuguesa em ondas preto e branco, com o desenho contínuo pela calçada toda.
      const onda = fy * 1.25 + 0.42 * Math.sin(fx * 1.3);
      const preto = ((onda % 1) + 1) % 1 < 0.5;
      const pedrinha = Math.sin(fx * 41) * Math.sin(fy * 37) > 0.55;
      if (preto) return rgb(pedrinha ? '#3a3a44' : '#26262e');
      return rgb(pedrinha ? '#bdb6a8' : '#d8d1c2');
    }
    case 'beco': {
      // Concreto rachado com poças que refletem o fogo e o poste.
      const poca = Math.sin(fx * 1.7 + 1.3) * Math.sin(fy * 1.1 + 0.4) > 0.72;
      if (poca) return rgb(Math.sin(fx * 9 + fy * 3) > 0.6 ? '#3a4466' : '#262b44');
      const racha = Math.abs(Math.sin(fx * 3.1 + Math.sin(fy * 2.3) * 1.7)) < 0.05;
      if (racha) return rgb('#2e2a33');
      const mancha = Math.sin(fx * 23) * Math.sin(fy * 19) > 0.7;
      return rgb(mancha ? '#4e4a55' : (tx + ty) % 2 ? '#5a5560' : '#56515c');
    }
    case 'xadrez': {
      // Piso xadrez do banheiro, encardido.
      const su = (u * 2) % 1;
      const sv = (v * 2) % 1;
      if (su < 0.06 || sv < 0.06) return rgb('#6b6b70');
      const preto = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 0;
      const sujo = Math.sin(fx * 17 + 2) * Math.sin(fy * 13) > 0.65;
      if (sujo) return rgb(preto ? '#2c2a20' : '#b8ad7a');
      return rgb(preto ? '#1e1e26' : '#d8d8d2');
    }
    case 'soleira':
      if (v > 0.86) return rgb('#4a4f5c'); // trilho da porta de aço
      return rgb(borda ? '#5d6270' : '#7c818c');
    case 'meio-fio':
      if (v < 0.18) return rgb('#b9bcc4');
      if (v > 0.8) return rgb('#4a4d56');
      return rgb(Math.floor(fx * 1.5) % 2 === 0 ? '#8e929b' : '#9a9ea7');
    case 'rua': {
      if (v > 0.55 && v < 0.62 && fx % 2 < 1.2) return rgb('#feae34'); // faixa amarela
      const grao = Math.sin(fx * 53) * Math.sin(fy * 47) > 0.6;
      return rgb(grao ? '#34343e' : '#2a2a33');
    }
    case 'vazio':
      return null;
  }
}

/* ------------------------------------------------------------------ paredes */

function azulejo(u: number, v: number, faixa = true): [number, number, number] {
  // Azulejo branco 6×6 px com rejunte e uma faixa verde no topo (o "barrado" de boteco).
  if (faixa && v >= 26 && v < 30) return rgb('#2f6b5b');
  if (Math.floor(u) % 6 === 0 || Math.floor(v) % 6 === 0) return rgb('#9aa6a8');
  return (Math.floor(u / 6) + Math.floor(v / 6)) % 5 === 0 ? rgb('#cfd8d6') : rgb('#e2e8e4');
}

function tijolo(u: number, v: number): [number, number, number] {
  const row = Math.floor(v / 6);
  if (Math.floor(v) % 6 === 0 || (Math.floor(u) + (row % 2) * 8) % 16 === 0) return rgb('#5e2a2e');
  return (Math.floor(u / 16) + row) % 3 === 0 ? rgb('#86403f') : rgb('#7d3a3c');
}

function parede(u: number, v: number, lado: 'R' | 'L', t: number, z: Zona): [number, number, number] {
  if (v < 3) return rgb('#2e1d21'); // rodapé
  if (z === 'banheiro') {
    if (v >= PAREDE_H - 3) return rgb('#8b9bb4');
    const limo = Math.sin(u * 0.4 + v * 0.9) * Math.sin(v * 0.21) > 0.8 && v < 20;
    if (limo) return rgb('#6b7a4a');
    return azulejo(u, v, v < 40);
  }
  if (v >= PAREDE_H - 3) return rgb('#b08a5a'); // acabamento do topo
  if (lado === 'R' && t >= GRADE) {
    // Muro do beco: reboco cinza descascado mostrando o tijolo.
    const desc = Math.sin(u * 0.19 + 1) * Math.sin(v * 0.27 + u * 0.03) > 0.55;
    if (desc) return tijolo(u, v);
    return Math.sin(u * 3.1) * Math.sin(v * 2.7) > 0.7 ? rgb('#57525c') : rgb('#6b6670');
  }
  if (lado === 'R' && t >= DIVISA) return tijolo(u, v);
  if (v < 30) return azulejo(u, v);
  // Pintura de cima, verde-boteco descascando.
  const desc = Math.sin(u * 0.7 + v * 0.3) * Math.sin(u * 0.13 - v * 0.21) > 0.72;
  return rgb(desc ? '#c9b98f' : '#5f7a52');
}

/** Altura (px) de cada enfeite, da base para cima. */
export const ALTURA: Record<string, number> = {
  neon: 14,
  tv: 22,
  precos: 24,
  fiado: 14,
  banheiro: 36,
  relogio: 14,
  dardos: 20,
  cartaz: 22,
  calendario: 20,
  lousa: 26,
  grafite: 52,
  espelho: 20,
  porta: 36,
  deposito: 36,
  janela: 14,
  quiz: 20,
  portal: 58,
  procurados: 46,
};

/** Pinta um enfeite de parede no ponto (lu, lv) local (0..largura, 0..altura); devolve null se é transparente. */
function enfeite(kind: string, lu: number, lv: number, W: number, H: number): RGBA | null {
  if (lv < 0 || lv >= H) return null;
  switch (kind) {
    case 'neon': {
      // Placa de neon: a moldura escura; o letreiro em si é escrito em cima, na tela de verdade.
      if (lu < 1 || lu >= W - 1 || lv < 1 || lv >= 13) return C('#3a1030');
      return C('#1a0a18');
    }
    case 'tv': {
      if (lu < 2 || lu >= W - 2 || lv < 2 || lv >= 20) return C('#14101c');
      // Campo de futebol com as faixas e a bola.
      const listra = Math.floor((lu + lv * 0.5) / 4) % 2 === 0;
      if (Math.abs(lu - W / 2) < 0.6) return C('#e8f0e0');
      if (Math.abs(lu - W * 0.7) < 1 && Math.abs(lv - 11) < 1) return C('#ffffff');
      return C(listra ? '#3e8948' : '#4a9a52');
    }
    case 'precos':
    case 'lousa': {
      if (lu < 2 || lu >= W - 2 || lv < 2 || lv >= H - 2) return C('#7a4a2e');
      return (Math.floor(lu) * 7 + Math.floor(lv) * 3) % 29 === 0 ? C('#3d6b52') : C('#1f3a2c');
    }
    case 'fiado': {
      if (lu < 1 || lu >= W - 1 || lv < 1 || lv >= 13) return C('#c28a1f');
      return C('#f4e9c8');
    }
    case 'banheiro':
    case 'deposito':
    case 'porta': {
      // Porta: madeira e maçaneta; a do banheiro, com a faixa de interditado.
      if (lu < 2 || lu >= W - 2) return null;
      if (lu < 4 || lu >= W - 4 || lv >= 34) return C('#5c3620');
      if (kind === 'banheiro' && lv > 14 && lv < 19) return Math.floor(lu + lv) % 6 < 3 ? C('#feae34') : C('#181425');
      if (Math.abs(lu - (W - 8)) < 1 && Math.abs(lv - 17) < 2) return C('#c0cbdc');
      return C(Math.floor(lu) % 5 === 0 ? '#6b4426' : '#8f563b');
    }
    case 'relogio': {
      const d = Math.hypot(lu - W / 2, lv - 7);
      if (d > 6.5) return null;
      if (d > 5.5) return C('#a22633');
      if ((Math.abs(lu - W / 2) < 0.6 && lv > 3 && lv < 7.5) || (Math.abs(lv - 7) < 0.6 && lu > W / 2 && lu < W / 2 + 3.5)) return C('#181425');
      return C('#f4f4f4');
    }
    case 'dardos': {
      const d = Math.hypot(lu - W / 2, lv - 10);
      if (d > 9) return null;
      if (d > 8) return C('#181425');
      const fatia = Math.floor(((Math.atan2(lv - 10, lu - W / 2) + Math.PI) / (2 * Math.PI)) * 10);
      if (d < 1.3) return C('#e43b44');
      if (d < 2.6) return C('#3e8948');
      return C(fatia % 2 ? '#181425' : '#ead4aa');
    }
    case 'cartaz': {
      if (lu < 1 || lu >= W - 1) return null;
      if (lv < 9) return C('#e43b44');
      if (lv < 10) return C('#181425');
      return C(Math.floor(lv) % 3 === 0 ? '#feae34' : '#f4e9c8');
    }
    case 'calendario': {
      if (lu < 3 || lu >= W - 3) return null;
      if (lv < 10) return C('#2ce8f5');
      return Math.floor(lu) % 3 === 0 || Math.floor(lv) % 3 === 0 ? C('#c0cbdc') : C('#f4f4f4');
    }
    case 'grafite': {
      // Grafite colorido por cima do muro: manchas com contorno escuro (o texto vem por cima, na tela).
      const n = Math.sin(lu * 0.17) + Math.sin(lv * 0.29 + lu * 0.05) + Math.sin((lu + lv) * 0.11);
      if (n < 1.1) return null;
      if (n < 1.3) return C('#181425');
      const cores = ['#b55088', '#2ce8f5', '#feae34', '#63c74d'];
      return C(cores[Math.floor(lu / 22) % cores.length]);
    }
    case 'espelho': {
      if (lu < 1 || lu >= W - 1) return null;
      if (lu < 2 || lu >= W - 2 || lv < 1 || lv >= H - 1) return C('#8b9bb4');
      const racha = Math.abs(lu - W * 0.3 - lv * 0.5) < 0.6 || Math.abs(lu - W * 0.6 + lv * 0.3) < 0.5;
      if (racha) return C('#f4f4f4');
      return C(lv < 6 ? '#c7e6f0' : '#94b0c2');
    }
    case 'quiz': {
      // Placa do letreiro do quiz: fundo escuro com moldura (o neon é escrito por cima, na tela).
      if (lu < 1 || lu >= W - 1 || lv < 1 || lv >= H - 1) return C('#2a1240');
      return C('#120a1c');
    }
    case 'portal': {
      // Moldura do portal: anel de sucata (canos, parafusos e fita) em volta de um buraco escuro; o redemoinho é
      // desenhado por cima, quadro a quadro.
      const cx = W / 2;
      const cy = H / 2;
      const d = Math.hypot((lu - cx) / (W * 0.46), (lv - cy) / (H * 0.48));
      if (d > 1) return null;
      if (d > 0.84) {
        const ang = Math.atan2(lv - cy, lu - cx);
        const seg = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 16);
        if (d > 0.95) return C('#181425');
        return C(seg % 4 === 0 ? '#feae34' : seg % 2 ? '#5a6988' : '#8b9bb4');
      }
      return C('#05030a');
    }
    case 'procurados': {
      // Paredão dos procurados: cinco cartazes de papel velho (2 ladrilhos cada) presos com fita; o título, o
      // retrato, o nome e as mortes vêm por cima, na tela.
      const larg = W / 5;
      const k = Math.floor(lu / larg);
      const pu = lu - k * larg;
      const torto = (k % 2 ? 1 : -1) * 0.04 * (pu - larg / 2);
      const pv = lv + torto;
      if (pu < 2 || pu >= larg - 2 || pv < 1 || pv >= H - 1) return null;
      if ((pu < 5 || pu >= larg - 5) && pv < 3) return C('#c0cbdc', 210); // fita
      if (pu < 3 || pu >= larg - 3 || pv < 2 || pv >= H - 2) return C('#8a6a3a');
      if (pv >= 10 && pv < 28 && pu >= larg / 2 - 9 && pu < larg / 2 + 9) return C('#3a2a1c'); // moldura do retrato
      const mancha = Math.sin(pu * 0.9 + k) * Math.sin(pv * 0.7) > 0.8;
      return C(mancha ? '#c9b07a' : '#e6d3a0');
    }
    case 'janela': {
      if (lu < 3 || lu >= W - 3) return null;
      if (lu < 4 || lu >= W - 4 || lv < 1 || lv >= H - 1) return C('#5a6988');
      if (Math.floor(lu) % 3 === 0) return C('#4a4f5c'); // grade
      return C('#0e1a2e');
    }
  }
  return null;
}

/* ------------------------------------------------------------------ o fundo de cada área */

export function pintarFundo(z: Zona = 'bar'): Raster {
  const L = LAYOUTS[z];
  const a = AREAS[z];
  const r = new Raster(L.w, L.h);
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) r.set(x, y, C(y < L.h * 0.5 ? '#0e0b16' : '#120e1c'));
  // Chão, pixel a pixel (amostra no centro do pixel) com a luz parada.
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      const pa = (x + 0.5 - L.ox) / (TW / 2);
      const pb = (y + 0.5 - L.oy) / (TH / 2);
      const fx = (pa + pb) / 2;
      const fy = (pb - pa) / 2;
      if (fx < a.x0 || fx >= a.x1 || fy < a.y0 || fy >= a.y1) continue;
      const c = corDoChao(fx, fy);
      if (!c) continue;
      r.set(x, y, iluminar(fx, fy, c, ladoDeFora(Math.floor(fx), Math.floor(fy))));
    }
  }
  // Paredes do fundo: 'R' ao longo de x (em y = y0), 'L' ao longo de y (em x = x0) até onde a área manda.
  const o = telaDe(a.x0, a.y0, z);
  const fimR = telaDe(a.x1, a.y0, z).x;
  const fimL = telaDe(a.x0, a.paredeL, z).x;
  for (let y = 0; y < L.h; y++) {
    for (let x = Math.floor(o.x); x < Math.ceil(fimR); x++) {
      const u = x + 0.5 - o.x;
      const v = o.y + u / 2 - (y + 0.5);
      if (v < 0 || v >= PAREDE_H) continue;
      const tx = a.x0 + Math.floor(u / (TW / 2));
      if (pisoDe(tx, a.y0) === 'vazio') continue;
      let c: RGBA | null = null;
      for (const e of PAREDE) {
        if (e.side !== 'R' || e.zona !== z || tx < e.from || tx > e.to) continue;
        const W = (e.to - e.from + 1) * (TW / 2);
        c = enfeite(e.kind, u - (e.from - a.x0) * (TW / 2), e.h + ALTURA[e.kind] - v, W, ALTURA[e.kind]);
        if (c) break;
      }
      if (!c) c = [...parede(u, v, 'R', tx, z), 255] as RGBA;
      const fx = Math.min(a.x1 - 0.01, a.x0 + u / (TW / 2));
      r.set(x, y, iluminar(fx, a.y0 + 0.3, [c[0], c[1], c[2]], ladoDeFora(Math.floor(fx), a.y0)));
    }
    for (let x = Math.floor(fimL); x < Math.ceil(o.x); x++) {
      const u = o.x - (x + 0.5);
      const v = o.y + u / 2 - (y + 0.5);
      if (v < 0 || v >= PAREDE_H) continue;
      const ty = a.y0 + Math.floor(u / (TW / 2));
      let c: RGBA | null = null;
      for (const e of PAREDE) {
        if (e.side !== 'L' || e.zona !== z || ty < e.from || ty > e.to) continue;
        const W = (e.to - e.from + 1) * (TW / 2);
        // Coordenada local: lu ao longo da parede (da esquerda para a direita de quem olha), lv de cima para baixo.
        c = enfeite(e.kind, W - (u - (e.from - a.y0) * (TW / 2)), e.h + ALTURA[e.kind] - v, W, ALTURA[e.kind]);
        if (c) break;
      }
      if (!c) c = [...parede(u, v, 'L', ty, z), 255] as RGBA;
      // A parede da esquerda pega menos luz.
      const fy = Math.min(a.paredeL - 0.01, a.y0 + u / (TW / 2));
      r.set(x, y, iluminar(a.x0 + 0.3, fy, [c[0] * 0.82, c[1] * 0.82, c[2] * 0.82], false));
    }
  }
  // Ponta da parede da esquerda (espessura) onde ela acaba.
  const ponta = telaDe(a.x0, a.paredeL, z);
  r.rect(Math.round(ponta.x) - 3, Math.round(ponta.y) - PAREDE_H, 3, PAREDE_H, C('#3a2a2e'));
  return r;
}

/** Onde fica cada enfeite (para escrever texto por cima na inclinação da parede). */
export function enfeiteDe(kind: string): { zona: Zona; side: 'R' | 'L'; u0: number; u1: number; base: number; altura: number } | null {
  const e = PAREDE.find((p) => p.kind === kind);
  if (!e) return null;
  const a = AREAS[e.zona];
  const ini = e.side === 'R' ? e.from - a.x0 : e.from - a.y0;
  return { zona: e.zona, side: e.side, u0: ini * (TW / 2), u1: (ini + e.to - e.from + 1) * (TW / 2), base: e.h, altura: ALTURA[e.kind] };
}

/** Compatível com a Fatia 1: enfeite da parede do fundo do bar. */
export function enfeiteR(kind: string): { u0: number; u1: number; base: number } | null {
  const e = enfeiteDe(kind);
  return e && e.side === 'R' ? e : null;
}

/* ------------------------------------------------------------------ móveis */

function nova(top = 60, w = TW + 2): { r: Raster; cx: number; cy: number } {
  const r = new Raster(w, top + TH + 2);
  return { r, cx: Math.floor(w / 2), cy: top + TH / 2 };
}

function garrafa(r: Raster, x: number, y: number, cor: string, alta = 7) {
  r.rect(x, y - alta, 3, alta, C(cor));
  r.rect(x + 1, y - alta - 3, 1, 3, C(cor));
  r.set(x, y - alta + 1, C('#ffffff', 200));
  r.rect(x, y - 3, 3, 1, C('#f4e9c8', 200)); // rótulo
}

function paint(kind: Kind, v: number): Sprite {
  switch (kind) {
    case 'prateleira': {
      const { r, cx, cy } = nova(64);
      r.box(cx, cy, 16, 8, 44, C('#5c3620'), C('#4a2c22'), C('#3a2219'));
      const cores = ['#3e8948', '#b86f50', '#c0cbdc', '#733e39', '#feae34', '#2ce8f5', '#e43b44', '#63c74d'];
      for (let s = 0; s < 3; s++) {
        const by = cy - 8 - s * 13;
        r.rect(cx - 15, by, 30, 2, C('#8f563b'));
        for (let i = 0; i < 5; i++) garrafa(r, cx - 13 + i * 6, by, cores[(v * 3 + s * 2 + i) % cores.length], 6 + ((i + s + v) % 3));
      }
      return { raster: r, ax: cx, ay: cy };
    }
    case 'balcao':
    case 'chopeira': {
      const { r, cx, cy } = nova(56);
      const H = 20;
      // Frente de azulejo (as duas faces), tampo de fórmica creme com friso de alumínio.
      r.box(cx, cy, 16, 8, H, C('#d8d0b8'), C('#d6dedb'), C('#aab5b3'));
      for (let k = 2; k < H - 2; k += 5) {
        r.poly([[cx - 16, cy - k], [cx, cy + 8 - k], [cx, cy + 8 - k - 1], [cx - 16, cy - k - 1]], C('#8a9694'));
        r.poly([[cx, cy + 8 - k], [cx + 16, cy - k], [cx + 16, cy - k - 1], [cx, cy + 8 - k - 1]], C('#7b8785'));
      }
      r.poly([[cx - 16, cy - H + 2], [cx, cy + 8 - H + 2], [cx, cy + 8 - H + 4], [cx - 16, cy - H + 4]], C('#2f6b5b'));
      r.poly([[cx, cy + 8 - H + 2], [cx + 16, cy - H + 2], [cx + 16, cy - H + 4], [cx, cy + 8 - H + 4]], C('#265c4b'));
      r.diamond(cx, cy - H, 16, 8, C('#c0cbdc'));
      r.diamond(cx, cy - H, 14, 7, C('#e8dcc0'));
      if (kind === 'chopeira') {
        r.rect(cx - 1, cy - H - 16, 3, 14, C('#8b9bb4'));
        r.rect(cx - 5, cy - H - 17, 11, 3, C('#c0cbdc'));
        r.rect(cx - 5, cy - H - 14, 1, 4, C('#c0cbdc'));
        r.rect(cx + 5, cy - H - 14, 1, 4, C('#c0cbdc'));
        r.rect(cx - 4, cy - H - 20, 9, 3, C('#feae34'));
      } else if (v === 2) {
        // A caderneta das cruzadas, aberta, com a caneta.
        r.poly([[cx - 8, cy - H - 1], [cx, cy - H + 3], [cx + 8, cy - H - 1], [cx, cy - H - 5]], C('#f4f4f4'));
        r.rect(cx - 1, cy - H - 4, 1, 6, C('#5a6988'));
        r.rect(cx - 5, cy - H - 2, 3, 1, C('#181425'));
        r.rect(cx + 2, cy - H - 1, 3, 1, C('#181425'));
        r.rect(cx + 3, cy - H - 6, 5, 1, C('#e43b44'));
      } else {
        // Copo americano, porção, paliteiro.
        const it = v % 3;
        if (it === 0) {
          r.rect(cx - 6, cy - H - 6, 3, 5, C('#feae34', 230));
          r.rect(cx - 6, cy - H - 7, 3, 1, C('#f4f4f4'));
          r.rect(cx + 3, cy - H - 5, 3, 4, C('#feae34', 230));
        } else if (it === 1) {
          r.diamond(cx, cy - H - 2, 5, 2, C('#f4f4f4'));
          r.diamond(cx, cy - H - 3, 4, 2, C('#c28a1f'));
          r.set(cx - 1, cy - H - 4, C('#e8b86a'));
          r.set(cx + 2, cy - H - 3, C('#a86b28'));
        } else {
          r.rect(cx + 4, cy - H - 5, 2, 4, C('#c0cbdc'));
          r.rect(cx - 6, cy - H - 4, 4, 3, C('#e43b44'));
          r.rect(cx - 6, cy - H - 5, 4, 1, C('#f4f4f4'));
        }
      }
      return { raster: r, ax: cx, ay: cy };
    }
    case 'banqueta': {
      const { r, cx, cy } = nova(40);
      r.rect(cx - 1, cy - 13, 1, 13, C('#8b9bb4'));
      r.rect(cx + 1, cy - 13, 1, 13, C('#5a6988'));
      r.diamond(cx, cy - 4, 4, 2, C('#5a6988'));
      r.box(cx, cy - 13, 6, 3, 3, C('#e43b44'), C('#a22633'), C('#73172d'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'geladeira': {
      const { r, cx, cy } = nova(66);
      const H = 46;
      r.box(cx, cy, 15, 7, H, C('#c0cbdc'), C('#e43b44'), C('#a22633'));
      // Porta de vidro na face da esquerda, com 4 prateleiras de garrafa e luz fria.
      for (let k = 0; k < 15; k++)
        for (let h = 4; h < H - 6; h++) {
          const x = cx - 15 + k;
          const y = cy - h + Math.floor(k / 2);
          const shelf = h % 10 === 4;
          const bott = !shelf && (k + Math.floor(h / 10)) % 3 !== 0 && h % 10 > 5;
          r.set(x, y, shelf ? C('#c0cbdc') : bott ? C(['#3e8948', '#b86f50', '#feae34'][(k + Math.floor(h / 10) + v) % 3]) : C('#a8e0ff', 255));
        }
      r.rect(cx - 2, cy - H + 14, 1, 10, C('#f4f4f4'));
      r.rect(cx - 13, cy - H + 2, 10, 3, C('#f4f4f4')); // adesivo "gelada"
      return { raster: r, ax: cx, ay: cy };
    }
    case 'freezer': {
      const { r, cx, cy } = nova(36);
      r.box(cx, cy, 15, 7, 16, C('#e8eef0'), C('#c9d4d8'), C('#9fabb0'));
      r.diamond(cx, cy - 16, 12, 5, C('#a8e0ff'));
      r.poly([[cx - 15, cy - 9], [cx, cy - 2], [cx, cy - 5], [cx - 15, cy - 12]], C('#0099db'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'mesa-bar': {
      const { r, cx, cy } = nova(40);
      r.rect(cx - 1, cy - 13, 3, 13, C('#2b1912'));
      r.diamond(cx, cy, 6, 3, C('#2b1912'));
      r.box(cx, cy - 13, 13, 6, 3, C('#a96a40'), C('#7a4a2e'), C('#5c3620'));
      r.rect(cx - 6, cy - 22, 3, 5, C('#feae34', 230));
      r.rect(cx - 6, cy - 23, 3, 1, C('#f4f4f4'));
      garrafa(r, cx + 3, cy - 16, v ? '#3e8948' : '#b86f50', 8);
      r.diamond(cx - 1, cy - 16, 3, 1, C('#ead4aa'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'cadeira-bar': {
      const { r, cx, cy } = nova(36);
      r.rect(cx - 5, cy - 8, 1, 8, C('#4a2c22'));
      r.rect(cx + 4, cy - 8, 1, 8, C('#3a2219'));
      r.box(cx, cy - 8, 6, 3, 2, C('#a96a40'), C('#7a4a2e'), C('#5c3620'));
      r.rect(cx + 2, cy - 20, 1, 12, C('#5c3620'));
      r.rect(cx + 5, cy - 18, 1, 12, C('#5c3620'));
      r.rect(cx + 2, cy - 20, 4, 2, C('#7a4a2e'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'mesa-sol': {
      // Mesa de plástico amarela com guarda-sol listrado (sem marca: só as cores de cerveja de boteco).
      const w = 52;
      const { r, cx, cy } = nova(74, w);
      for (const [lx, ly] of [[-7, 0], [7, 0], [0, 4], [0, -3]]) r.rect(cx + lx, cy - 11 + ly, 1, 11 - ly, C('#c28a1f'));
      r.box(cx, cy - 11, 11, 5, 2, C('#feae34'), C('#e09a20'), C('#c28a1f'));
      r.rect(cx - 5, cy - 18, 3, 5, C('#feae34', 230));
      r.rect(cx - 5, cy - 19, 3, 1, C('#f4f4f4'));
      garrafa(r, cx + 3, cy - 13, '#b86f50', 8);
      r.rect(cx, cy - 58, 1, 45, C('#c0cbdc'));
      // Copa do guarda-sol: losango grande com gomos alternados.
      const tc = cy - 58;
      for (let yy = -11; yy <= 9; yy++)
        for (let xx = -24; xx <= 24; xx++) {
          const dentro = Math.abs(xx) / 24 + Math.abs(yy - (yy < 0 ? 0 : 0)) / (yy < 0 ? 11 : 9) <= 1;
          if (!dentro) continue;
          const ang = Math.atan2(yy * 2, xx);
          const gomo = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 8) % 2;
          const borda = Math.abs(xx) / 24 + Math.abs(yy) / (yy < 0 ? 11 : 9) > 0.86;
          const cores = v === 1 ? ['#e43b44', '#f4f4f4'] : v === 2 ? ['#0099db', '#f4f4f4'] : ['#feae34', '#e43b44'];
          r.set(cx + xx, tc + yy, C(borda ? '#73172d' : cores[gomo]));
        }
      for (let xx = -24; xx <= 24; xx += 4) r.rect(cx + xx, tc + 9 - Math.round((Math.abs(xx) / 24) * 9), 2, 2, C('#f4f4f4'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'cadeira-plastico': {
      const { r, cx, cy } = nova(36);
      const cor = v ? '#f4f4f4' : '#feae34';
      const sombra = v ? '#c0cbdc' : '#c28a1f';
      r.rect(cx - 5, cy - 7, 1, 7, C(sombra));
      r.rect(cx + 4, cy - 7, 1, 7, C(sombra));
      r.box(cx, cy - 7, 6, 3, 2, C(cor), C(sombra), C(sombra));
      r.rect(cx - 6, cy - 18, 1, 11, C(sombra));
      r.rect(cx + 5, cy - 18, 1, 11, C(sombra));
      r.rect(cx - 6, cy - 19, 12, 4, C(cor));
      r.rect(cx - 6, cy - 14, 12, 1, C(sombra));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'engradados': {
      const { r, cx, cy } = nova(46);
      const cores = [['#e43b44', '#a22633', '#73172d'], ['#feae34', '#c28a1f', '#8a5a14']];
      for (let k = 0; k < 3; k++) {
        const c = cores[(k + v) % 2];
        const y = cy - k * 9;
        r.box(cx, y, 10, 5, 9, C(c[0]), C(c[1]), C(c[2]));
        for (let i = -6; i <= 6; i += 3) r.rect(cx + i, y - 10 - (k === 2 ? 2 : 0), 2, k === 2 ? 3 : 1, C('#5c3620'));
      }
      return { raster: r, ax: cx, ay: cy };
    }
    case 'poste': {
      const { r, cx, cy } = nova(96);
      r.rect(cx - 1, cy - 88, 3, 88, C('#4a4f5c'));
      r.rect(cx - 1, cy - 88, 1, 88, C('#6b7280'));
      r.rect(cx - 8, cy - 90, 10, 2, C('#4a4f5c'));
      r.rect(cx - 10, cy - 88, 6, 3, C('#feae34'));
      r.rect(cx - 9, cy - 85, 4, 1, C('#fff2c0'));
      r.diamond(cx, cy, 4, 2, C('#2e2e38'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'lixeira': {
      const { r, cx, cy } = nova(30);
      r.box(cx, cy, 6, 3, 14, C('#ef7d57'), C('#e06030'), C('#b8481f'));
      r.diamond(cx, cy - 14, 5, 2, C('#2b1912'));
      r.rect(cx - 2, cy - 17, 3, 3, C('#f4f4f4')); // lata de lixo de verdade
      return { raster: r, ax: cx, ay: cy };
    }
    case 'mureta': {
      // Mureta de tijolo ao longo de y (fina em x) com tampo de madeira e vasinhos: separa os dois salões.
      const { r, cx, cy } = nova(40);
      const H = 13;
      const P = (dx: number, dy: number, h = 0): [number, number] => [cx + (dx - dy) * (TW / 2), cy + (dx + dy) * (TH / 2) - h];
      const x0 = -0.16;
      const x1 = 0.16;
      const y0 = -0.5;
      const y1 = 0.5;
      // Face comprida (virada para +x) e a pontinha (virada para +y).
      r.poly([P(x1, y0, H), P(x1, y1, H), P(x1, y1), P(x1, y0)], C('#7d3a3c'));
      r.poly([P(x0, y1, H), P(x1, y1, H), P(x1, y1), P(x0, y1)], C('#5e2a2e'));
      for (let k = 2; k < H; k += 4) {
        const a = P(x1, y0, k);
        const b = P(x1, y1, k);
        for (let q = 0; q <= 1; q += 1 / 24) r.set(Math.round(a[0] + (b[0] - a[0]) * q), Math.round(a[1] + (b[1] - a[1]) * q), C('#5e2a2e'));
      }
      r.poly([P(x0, y0, H), P(x1, y0, H), P(x1, y1, H), P(x0, y1, H)], C('#5c3620'));
      r.poly([P(x0, y0, H + 1), P(x1, y0, H + 1), P(x1, y1, H + 1), P(x0, y1, H + 1)], C('#7a4a2e'));
      if (v % 2 === 1) {
        const [px, py] = P(0, 0, H + 1);
        r.rect(px - 2, py - 4, 4, 4, C('#a23d26'));
        for (const [dx, dy] of [[-3, -7], [1, -8], [-1, -10], [2, -6], [-4, -5]]) r.rect(px + dx, py + dy, 2, 2, C(dy < -7 ? '#63c74d' : '#3e8948'));
      }
      return { raster: r, ax: cx, ay: cy };
    }
    case 'fliperama': {
      const { r, cx, cy } = nova(62);
      const H = 40;
      r.box(cx, cy, 11, 5, H, C('#181425'), C('#262b44'), C('#181425'));
      // Tela brilhando na face da esquerda e o letreiro no alto.
      const tela = v ? ['#b55088', '#2ce8f5'] : ['#2ce8f5', '#63c74d'];
      for (let k = 2; k < 10; k++)
        for (let h = 20; h < 31; h++) r.set(cx - 11 + k, cy - h + Math.floor(k / 2), C((k + h) % 4 === 0 ? tela[1] : tela[0]));
      r.poly([[cx - 11, cy - H], [cx, cy + 5 - H], [cx, cy + 5 - H + 5], [cx - 11, cy - H + 5]], C(v ? '#e43b44' : '#feae34'));
      r.rect(cx - 8, cy - 15, 1, 2, C('#e43b44'));
      r.rect(cx - 5, cy - 14, 1, 1, C('#feae34'));
      r.rect(cx - 3, cy - 13, 1, 1, C('#2ce8f5'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'sofa': {
      const { r, cx, cy } = nova(36);
      r.box(cx, cy, 14, 7, 8, C('#a22633'), C('#73172d'), C('#5a1020'));
      r.box(cx + 7, cy - 3, 7, 3, 16, C('#a22633'), C('#8a1c2a'), C('#5a1020'));
      if (v === 0) r.box(cx - 2, cy - 7, 4, 2, 6, C('#a22633'), C('#8a1c2a'), C('#5a1020'));
      r.rect(cx - 6, cy - 10, 4, 2, C('#feae34')); // moeda perdida entre as almofadas
      return { raster: r, ax: cx, ay: cy };
    }
    case 'pilar': {
      const { r, cx, cy } = nova(PAREDE_H + 8);
      r.box(cx, cy, 5, 3, PAREDE_H, C('#b08a5a'), C('#8a8f99'), C('#6b707a'));
      r.box(cx, cy, 5, 3, 26, C('#2f6b5b'), C('#d6dedb'), C('#aab5b3'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'grade': {
      // Grade de ferro ao longo de y (fina em x): barras, corrimão e o cadeado enferrujado.
      const { r, cx, cy } = nova(44);
      const P = (dx: number, dy: number, h = 0): [number, number] => [cx + (dx - dy) * (TW / 2), cy + (dx + dy) * (TH / 2) - h];
      const H = 24;
      for (let q = 0; q <= 1.0001; q += 1 / 6) {
        const [bx, by] = P(0, -0.5 + q);
        r.rect(Math.round(bx), Math.round(by) - H, 1, H, C(q === 0 || q > 0.99 ? '#6b7280' : '#4a4f5c'));
      }
      for (const h of [2, H - 1, H]) {
        const a0 = P(0, -0.5, h);
        const a1 = P(0, 0.5, h);
        for (let q = 0; q <= 1; q += 1 / 20) r.set(Math.round(a0[0] + (a1[0] - a0[0]) * q), Math.round(a0[1] + (a1[1] - a0[1]) * q), C('#6b7280'));
      }
      if (v % 4 === 1) r.rect(cx - 1, cy - 12, 3, 3, C('#b86f50'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'lona': {
      // Fundo da barraca do mercado negro: lona listrada esticada em dois paus, com uma lâmpada pendurada.
      const { r, cx, cy } = nova(70);
      const listras = ['#3a1030', '#181425'];
      for (let y = 0; y < 44; y++) r.rect(cx - 15, cy - 52 + y + Math.floor(Math.abs(Math.sin(y * 0.3)) * 1), 30, 1, C(listras[Math.floor((y + v * 3) / 4) % 2]));
      for (const dx of [-15, 14]) r.rect(cx + dx, cy - 60, 2, 60, C('#5c3620'));
      r.rect(cx - 15, cy - 60, 31, 2, C('#4a2c22'));
      if (v === 1) {
        r.rect(cx, cy - 58, 1, 8, C('#4a4f5c'));
        r.rect(cx - 2, cy - 50, 5, 4, C('#fff2c0'));
        r.rect(cx - 1, cy - 46, 3, 1, C('#feae34'));
      }
      return { raster: r, ax: cx, ay: cy };
    }
    case 'banca': {
      // Banca do Muambeiro: caixotes com pano preto por cima e a mercadoria exposta (faca, serra, soco-inglês).
      const { r, cx, cy } = nova(34);
      r.box(cx, cy, 15, 7, 14, C('#8f563b'), C('#6b3d2a'), C('#5c3620'));
      r.box(cx, cy - 14, 15, 7, 2, C('#181425'), C('#262b44'), C('#0b0a10'));
      r.rect(cx - 14, cy - 12, 28, 5, C('#181425')); // pano caindo na frente
      const itens: [number, number, string, number][] =
        v === 0 ? [[-8, -19, '#c0cbdc', 8], [2, -18, '#8b9bb4', 6]] : v === 1 ? [[-6, -19, '#e43b44', 9], [4, -18, '#feae34', 5]] : [[-7, -18, '#c0cbdc', 4], [1, -19, '#5c3620', 9]];
      for (const [dx, dy, c, w] of itens) r.rect(cx + dx, cy + dy, w, 2, C(c));
      if (v === 2) r.rect(cx + 5, cy - 22, 7, 5, C('#f4e9c8')); // plaquinha "SEM NOTA"
      return { raster: r, ax: cx, ay: cy };
    }
    case 'cacamba': {
      const { r, cx, cy } = nova(40);
      r.box(cx, cy, 15, 7, 18, C('#265c42'), C('#3e8948'), C('#2a6a3c'));
      r.diamond(cx, cy - 18, 13, 6, C('#181425'));
      // Sacos pretos e lixo saindo.
      for (const [dx, dy, c] of [[-6, -21, '#262b44'], [2, -22, '#181425'], [7, -19, '#3a4466'], [-1, -24, '#f4f4f4']] as const) r.rect(cx + dx, cy + dy, 5, 4, C(c));
      if (v === 0) r.rect(cx - 12, cy - 12, 8, 3, C('#feae34', 220)); // faixa de "não estacione"
      return { raster: r, ax: cx, ay: cy };
    }
    case 'barril-fogo': {
      const { r, cx, cy } = nova(44);
      r.box(cx, cy, 6, 3, 14, C('#5c3620'), C('#8a4a2a'), C('#6b3d2a'));
      r.rect(cx - 6, cy - 6, 6, 1, C('#4a2a1c'));
      r.rect(cx, cy - 5, 6, 1, C('#4a2a1c'));
      // Fogo: três línguas e as brasas.
      const fogo: [number, number, string][] = [
        [-3, -18, '#e43b44'], [0, -21, '#feae34'], [3, -17, '#e43b44'], [-1, -24, '#feae34'], [1, -19, '#fff2c0'], [-2, -16, '#ef7d57'], [2, -22, '#ef7d57'],
      ];
      for (const [dx, dy, c] of fogo) r.rect(cx + dx, cy + dy, 2, 3, C(c));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'churrasqueira': {
      // Churrasquinho de rua: grelha nos pés, espetinhos, fumaça e a plaquinha de preço.
      const { r, cx, cy } = nova(48);
      for (const dx of [-8, 8]) r.rect(cx + dx, cy - 14, 1, 14, C('#4a4f5c'));
      r.box(cx, cy - 14, 10, 4, 3, C('#262b44'), C('#4a4f5c'), C('#333845'));
      for (let i = -7; i <= 7; i += 3) {
        r.rect(cx + i - 2, cy - 19, 5, 1, C('#c0cbdc'));
        r.rect(cx + i - 1, cy - 20, 3, 2, C(i % 2 ? '#8a3f1f' : '#b86f50'));
      }
      for (const [dx, dy] of [[-3, -26], [1, -30], [-1, -34], [3, -38]]) r.rect(cx + dx, cy + dy, 4, 3, C('#c0cbdc', 90));
      r.rect(cx + 9, cy - 28, 9, 6, C('#f4e9c8'));
      r.rect(cx + 10, cy - 26, 7, 1, C('#e43b44'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'privada': {
      const { r, cx, cy } = nova(40);
      r.box(cx + 3, cy - 3, 6, 3, 18, C('#e2e8e4'), C('#c9d4d8'), C('#9fabb0')); // caixa encostada na parede
      r.box(cx - 2, cy + 1, 5, 3, 9, C('#f4f4f4'), C('#d6dedb'), C('#aab5b3'));
      r.diamond(cx - 2, cy - 8, 4, 2, C(v ? '#8fb8a0' : '#5a7a4a')); // água… de cor duvidosa
      r.rect(cx + 2, cy - 22, 4, 1, C('#8b9bb4'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'pia': {
      const { r, cx, cy } = nova(40);
      r.rect(cx - 1, cy - 12, 3, 12, C('#c9d4d8'));
      r.box(cx, cy - 12, 7, 4, 4, C('#e2e8e4'), C('#c9d4d8'), C('#9fabb0'));
      r.diamond(cx, cy - 16, 5, 2, C('#94b0c2'));
      r.rect(cx - 4, cy - 21, 2, 5, C('#c0cbdc'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'mictorio': {
      const { r, cx, cy } = nova(44);
      r.box(cx, cy - 10, 5, 3, 16, C('#f4f4f4'), C('#d6dedb'), C('#aab5b3'));
      r.rect(cx - 3, cy - 20, 4, 8, C('#c9d4d8'));
      r.rect(cx - 1, cy - 16, 2, 2, C('#feae34')); // pedrinha cheirosa (há anos)
      r.rect(cx, cy - 30, 1, 4, C('#c0cbdc'));
      return { raster: r, ax: cx, ay: cy };
    }
    case 'sinuca':
      return barProp({ kind: 'pool', x: 0, y: 0 });
    case 'jukebox':
      return barProp({ kind: 'jukebox', x: 0, y: 0 });
    case 'vaso':
      return barProp({ kind: 'plant', x: 0, y: 0 });
    case 'void':
      return { raster: new Raster(1, 1), ax: 0, ay: 0 };
  }
}

const cache = new Map<string, Sprite>();
export function spriteDe(p: Prop): Sprite {
  const k = `${p.kind}:${p.v}`;
  let s = cache.get(k);
  if (!s) {
    s = paint(p.kind, p.v);
    cache.set(k, s);
  }
  return s;
}

/* ------------------------------------------------------------------ armas no chão e na mão */

/** Carros da rua (cores) e o desenho de cada um, olhando para `dir` (±1 em x). */
const CORES_CARRO: readonly [string, string, string][] = [
  ['#e43b44', '#a22633', '#73172d'],
  ['#f4f4f4', '#c0cbdc', '#8b9bb4'],
  ['#0099db', '#124e89', '#0b2f55'],
  ['#feae34', '#c28a1f', '#8a5a14'],
  ['#3e8948', '#265c42', '#193c3e'],
  ['#262b44', '#181425', '#0b0a10'],
];
const carros = new Map<string, Sprite>();
export function carroSprite(cor: number, dir: 1 | -1): Sprite {
  const k = `${cor}|${dir}`;
  const pronto = carros.get(k);
  if (pronto) return pronto;
  const r = new Raster(72, 64);
  const cx = 36;
  const cy = 40;
  const P = (dx: number, dy: number, h: number): [number, number] => [cx + (dx - dy) * (TW / 2), cy + (dx + dy) * (TH / 2) - h];
  const [topo, lado, frente] = CORES_CARRO[cor % CORES_CARRO.length].map((c) => C(c));
  const caixa = (x0: number, x1: number, y0: number, y1: number, h0: number, h1: number, cTopo: RGBA, cLado: RGBA, cFim: RGBA) => {
    r.poly([P(x0, y1, h0), P(x1, y1, h0), P(x1, y1, h1), P(x0, y1, h1)], cLado); // lado de quem olha
    r.poly([P(x1, y0, h0), P(x1, y1, h0), P(x1, y1, h1), P(x1, y0, h1)], cFim); // ponta (+x)
    r.poly([P(x0, y0, h1), P(x1, y0, h1), P(x1, y1, h1), P(x0, y1, h1)], cTopo);
  };
  // Sombra, rodas, lataria, cabine com vidro e o farol (ou a lanterna) na ponta que aparece.
  r.poly([P(-1.35, -0.5, 0), P(1.35, -0.5, 0), P(1.35, 0.55, 0), P(-1.35, 0.55, 0)], C('#000000', 90));
  for (const wx of [-0.8, 0.75]) {
    const [x, y] = P(wx, 0.45, 2);
    r.rect(Math.round(x) - 3, Math.round(y) - 3, 6, 6, C('#181425'));
    r.rect(Math.round(x) - 1, Math.round(y) - 1, 2, 2, C('#8b9bb4'));
  }
  caixa(-1.25, 1.25, -0.42, 0.42, 3, 11, topo, lado, frente);
  caixa(-0.55 + dir * 0.1, 0.45 + dir * 0.1, -0.36, 0.36, 11, 19, topo, C('#5a6988'), C('#94b0c2'));
  const luz = dir > 0 ? C('#fff2c0') : C('#e43b44');
  for (const ly of [-0.28, 0.28]) {
    const [x, y] = P(1.25, ly, 8);
    r.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 2, luz);
  }
  const s = { raster: r, ax: cx, ay: cy };
  carros.set(k, s);
  return s;
}

/** Bolinha de poder: borda, corpo, brilho e uma marca de 2×2 em posição própria (são 10 marcas diferentes). */
function orbePoder(cores: [string, string, string], i: number): Sprite {
  const r = new Raster(10, 12);
  r.rect(3, 2, 4, 1, C(cores[2]));
  r.rect(2, 3, 6, 5, C(cores[2]));
  r.rect(3, 8, 4, 1, C(cores[2]));
  r.rect(3, 3, 4, 5, C(cores[1]));
  r.rect(3 + (i % 3), 3 + (Math.floor(i / 3) % 4), 2, 2, C(cores[0]));
  r.set(4, 4, C('#ffffff'));
  return { raster: r, ax: 5, ay: 10 };
}

/** Desenho das armas novas (móveis pegos e o que vem do mercado negro). */
const NOVAS: Partial<Record<Arma, () => Sprite>> = {
  cadeirao: () => {
    const r = new Raster(16, 22);
    const m1 = C('#8f563b');
    const m2 = C('#5c3620');
    r.rect(3, 12, 1, 8, m2);
    r.rect(11, 12, 1, 8, m2);
    r.box(8, 12, 5, 2, 2, C('#a96a40'), m1, m2);
    r.rect(3, 2, 1, 10, m2);
    r.rect(12, 2, 1, 10, m2);
    for (const y of [3, 6, 9]) r.rect(3, y, 10, 1, m1);
    return { raster: r, ax: 8, ay: 20 };
  },
  // Rajada do Fiado guardada na mão: uma bolinha dourada com borda magenta (a carga e o feixe são desenhados à parte).
  rajada: () => {
    const r = new Raster(10, 12);
    r.rect(3, 2, 4, 1, C('#b55088'));
    r.rect(2, 3, 6, 5, C('#b55088'));
    r.rect(3, 8, 4, 1, C('#b55088'));
    r.rect(3, 3, 4, 5, C('#feae34'));
    r.rect(4, 4, 2, 2, C('#fee761'));
    r.set(4, 4, C('#ffffff'));
    return { raster: r, ax: 5, ay: 10 };
  },
  // Fatia 6: cada poder guardado na mão é uma bolinha nas cores dele, com uma marca própria no meio.
  ...Object.fromEntries(PODERES_NOVOS.map((p, i) => [p, () => orbePoder(PODER[p].cores, i)])),
  vaso: () => {
    const r = new Raster(14, 18);
    r.rect(3, 9, 8, 7, C('#a96a40'));
    r.rect(2, 8, 10, 2, C('#c28a1f'));
    r.rect(4, 15, 6, 1, C('#5c3620'));
    for (const [x, y] of [[4, 3], [6, 1], [8, 2], [9, 4], [5, 5], [7, 5]] as const) r.rect(x, y, 2, 4, C(x % 4 ? '#3e8948' : '#63c74d'));
    return { raster: r, ax: 7, ay: 16 };
  },
  engradado: () => {
    const r = new Raster(16, 14);
    r.rect(1, 4, 14, 9, C('#a22633'));
    r.rect(1, 4, 14, 1, C('#e43b44'));
    r.rect(3, 7, 10, 2, C('#73172d'));
    for (const x of [3, 6, 9, 12]) r.rect(x, 1, 2, 4, C('#3e8948'));
    return { raster: r, ax: 8, ay: 12 };
  },
  lixeira: () => {
    const r = new Raster(14, 18);
    r.rect(2, 5, 10, 11, C('#8b9bb4'));
    for (const x of [4, 7, 10]) r.rect(x, 6, 1, 9, C('#5a6988'));
    r.rect(1, 3, 12, 2, C('#c0cbdc'));
    r.rect(6, 1, 2, 2, C('#5a6988'));
    return { raster: r, ax: 7, ay: 16 };
  },
  faca: () => {
    const r = new Raster(8, 18);
    r.rect(3, 1, 2, 10, C('#e4e4e4'));
    r.rect(4, 1, 1, 10, C('#94b0c2'));
    r.rect(2, 11, 4, 1, C('#5a6988'));
    r.rect(3, 12, 2, 5, C('#5c3620'));
    return { raster: r, ax: 4, ay: 16 };
  },
  socoingles: () => {
    const r = new Raster(12, 8);
    r.rect(1, 2, 10, 3, C('#feae34'));
    for (const x of [1, 4, 7]) r.rect(x + 1, 2, 1, 1, C('#181425'));
    r.rect(2, 5, 8, 1, C('#c28a1f'));
    return { raster: r, ax: 6, ay: 6 };
  },
  machadinha: () => {
    const r = new Raster(14, 22);
    r.rect(6, 4, 2, 17, C('#8f563b'));
    r.rect(1, 2, 6, 6, C('#c0cbdc'));
    r.rect(1, 3, 1, 4, C('#f4f4f4'));
    r.rect(7, 3, 3, 3, C('#5a6988'));
    return { raster: r, ax: 7, ay: 20 };
  },
  serra: () => {
    const r = new Raster(26, 16);
    r.rect(1, 6, 10, 7, C('#ef7d57'));
    r.rect(2, 5, 7, 1, C('#feae34'));
    r.rect(3, 9, 3, 2, C('#181425'));
    r.rect(4, 2, 5, 3, C('#262b44'));
    r.rect(11, 8, 13, 3, C('#8b9bb4'));
    for (let x = 11; x < 24; x += 2) {
      r.set(x, 7, C('#e4e4e4'));
      r.set(x + 1, 11, C('#e4e4e4'));
    }
    return { raster: r, ax: 6, ay: 13 };
  },
  // Fatia 4: os achados pelo bar e o que o muambeiro trouxe de novo.
  frigideira: () => {
    const r = new Raster(14, 20);
    r.rect(2, 1, 10, 8, C('#181425'));
    r.rect(1, 2, 12, 6, C('#181425'));
    r.rect(2, 2, 10, 6, C('#262b44'));
    r.rect(3, 2, 8, 5, C('#3a4466'));
    r.rect(4, 3, 3, 1, C('#5a6988'));
    r.rect(6, 9, 2, 10, C('#181425'));
    r.rect(6, 9, 2, 1, C('#8b9bb4'));
    r.rect(6, 16, 2, 2, C('#5c3620'));
    return { raster: r, ax: 7, ay: 18 };
  },
  bastao: () => {
    const r = new Raster(10, 24);
    r.rect(3, 1, 4, 9, C('#c28a1f'));
    r.rect(4, 10, 3, 6, C('#c28a1f'));
    r.rect(4, 16, 2, 6, C('#a96a40'));
    r.rect(3, 22, 4, 1, C('#5c3620'));
    r.rect(4, 2, 1, 8, C('#feae34'));
    r.rect(4, 17, 2, 1, C('#181425'));
    r.rect(4, 19, 2, 1, C('#181425'));
    return { raster: r, ax: 5, ay: 22 };
  },
  violao: () => {
    const r = new Raster(14, 24);
    r.rect(5, 0, 4, 2, C('#3a2a1c'));
    r.rect(6, 1, 2, 10, C('#5c3620'));
    r.rect(3, 10, 8, 4, C('#c28a1f'));
    r.rect(2, 13, 10, 9, C('#c28a1f'));
    r.rect(2, 13, 2, 9, C('#a96a40'));
    r.rect(3, 22, 8, 1, C('#a96a40'));
    r.rect(6, 15, 2, 2, C('#181425'));
    r.rect(5, 19, 4, 1, C('#3a2a1c'));
    r.rect(7, 2, 1, 17, C('#e4e4e4'));
    return { raster: r, ax: 7, ay: 22 };
  },
  extintor: () => {
    const r = new Raster(10, 20);
    r.rect(1, 1, 6, 1, C('#8b9bb4'));
    r.rect(3, 2, 4, 3, C('#181425'));
    r.rect(7, 3, 2, 1, C('#181425'));
    r.rect(8, 4, 1, 7, C('#181425'));
    r.rect(2, 5, 6, 14, C('#e43b44'));
    r.rect(6, 5, 2, 14, C('#a22633'));
    r.rect(3, 6, 1, 11, C('#f4a6a8'));
    r.rect(3, 9, 3, 3, C('#f4f4f4'));
    return { raster: r, ax: 5, ay: 18 };
  },
  guardasol: () => {
    const r = new Raster(18, 24);
    for (let y = 0; y < 6; y++) {
      const w = 3 + y * 3;
      const x0 = 9 - Math.ceil(w / 2);
      for (let x = 0; x < w; x++) r.set(x0 + x, y + 1, C(Math.floor((x0 + x) / 3) % 2 ? '#f4f4f4' : '#e43b44'));
    }
    r.rect(1, 7, 16, 1, C('#a22633'));
    r.rect(8, 7, 2, 16, C('#c0cbdc'));
    r.rect(9, 7, 1, 16, C('#8b9bb4'));
    return { raster: r, ax: 9, ay: 22 };
  },
  tijolo: () => {
    const r = new Raster(12, 8);
    r.rect(1, 1, 10, 6, C('#b86f50'));
    r.rect(1, 5, 10, 2, C('#733e39'));
    r.rect(1, 1, 10, 1, C('#d9a066'));
    r.rect(3, 2, 2, 2, C('#5c3620'));
    r.rect(7, 2, 2, 2, C('#5c3620'));
    return { raster: r, ax: 6, ay: 6 };
  },
  espeto: () => {
    const r = new Raster(6, 22);
    r.rect(2, 0, 1, 18, C('#c0cbdc'));
    r.rect(1, 2, 3, 3, C('#8f563b'));
    r.rect(1, 6, 3, 3, C('#a22633'));
    r.rect(1, 10, 3, 3, C('#8f563b'));
    r.set(1, 2, C('#c28a1f'));
    r.set(1, 10, C('#c28a1f'));
    r.rect(2, 17, 2, 4, C('#5c3620'));
    return { raster: r, ax: 3, ay: 20 };
  },
  placa: () => {
    const r = new Raster(12, 20);
    r.rect(2, 1, 8, 15, C('#feae34'));
    r.rect(2, 1, 8, 1, C('#c28a1f'));
    r.rect(2, 15, 8, 1, C('#c28a1f'));
    r.rect(2, 16, 1, 3, C('#c28a1f'));
    r.rect(9, 16, 1, 3, C('#c28a1f'));
    r.rect(5, 4, 2, 6, C('#181425'));
    r.rect(5, 11, 2, 2, C('#181425'));
    return { raster: r, ax: 6, ay: 18 };
  },
  rodo: () => {
    const r = new Raster(14, 24);
    r.rect(1, 0, 12, 1, C('#181425'));
    r.rect(1, 1, 12, 3, C('#262b44'));
    r.rect(2, 1, 10, 1, C('#5a6988'));
    r.rect(6, 4, 2, 19, C('#a96a40'));
    r.rect(6, 4, 1, 19, C('#c28a1f'));
    return { raster: r, ax: 7, ay: 22 };
  },
  katana: () => {
    const r = new Raster(8, 26);
    r.rect(3, 1, 2, 16, C('#e4e4e4'));
    r.rect(4, 1, 1, 16, C('#94b0c2'));
    r.set(3, 0, C('#e4e4e4'));
    r.rect(1, 17, 6, 1, C('#feae34'));
    r.rect(3, 18, 2, 7, C('#262b44'));
    for (const y of [19, 21, 23]) r.set(3, y, C('#c0cbdc'));
    return { raster: r, ax: 4, ay: 24 };
  },
  marreta: () => {
    const r = new Raster(16, 24);
    r.rect(2, 1, 12, 6, C('#5a6988'));
    r.rect(2, 5, 12, 2, C('#3a4466'));
    r.rect(3, 2, 10, 1, C('#8b9bb4'));
    r.rect(1, 2, 1, 4, C('#3a4466'));
    r.rect(14, 2, 1, 4, C('#3a4466'));
    r.rect(7, 7, 2, 16, C('#8f563b'));
    r.rect(7, 7, 1, 16, C('#a96a40'));
    return { raster: r, ax: 8, ay: 22 };
  },
  // Fatia 12: ingredientes, raquete e receitas.
  pano: () => {
    // Pano de prato xadrez dobrado, com a ponta caindo.
    const r = new Raster(12, 18);
    r.rect(2, 2, 8, 9, C('#e4e4e4'));
    for (let y = 2; y < 11; y += 2) for (let x = 2 + ((y / 2) % 2) * 2; x < 10; x += 4) r.rect(x, y, 2, 2, C('#e43b44'));
    r.rect(4, 11, 4, 5, C('#e4e4e4'));
    r.rect(4, 13, 2, 2, C('#e43b44'));
    r.rect(2, 10, 8, 1, C('#c0cbdc'));
    return { raster: r, ax: 6, ay: 16 };
  },
  prego: () => {
    const r = new Raster(8, 16);
    r.rect(1, 1, 6, 2, C('#8b9bb4'));
    r.rect(1, 1, 6, 1, C('#c0cbdc'));
    r.rect(3, 3, 2, 10, C('#8b9bb4'));
    r.rect(3, 3, 1, 10, C('#c0cbdc'));
    r.set(3, 13, C('#8b9bb4'));
    r.set(4, 14, C('#5a6988'));
    return { raster: r, ax: 4, ay: 14 };
  },
  fita: () => {
    // Rolo de fita isolante preta com a ponta solta.
    const r = new Raster(12, 12);
    r.rect(2, 2, 8, 7, C('#181425'));
    r.rect(1, 3, 10, 5, C('#181425'));
    r.rect(4, 4, 4, 3, C('#c0cbdc'));
    r.rect(5, 5, 2, 1, C('#8b9bb4'));
    r.rect(2, 2, 3, 1, C('#3a4466'));
    r.rect(9, 7, 2, 4, C('#262b44'));
    return { raster: r, ax: 6, ay: 10 };
  },
  raquete: () => {
    // Raquete elétrica mata-moscas: aro amarelo, tela azul, cabo com botão vermelho.
    const r = new Raster(14, 26);
    r.rect(2, 1, 10, 12, C('#feae34'));
    r.rect(3, 2, 8, 10, C('#124e89'));
    for (let x = 3; x < 11; x += 2) r.rect(x, 2, 1, 10, C('#2ce8f5'));
    for (let y = 3; y < 12; y += 2) r.rect(3, y, 8, 1, C('#0099db'));
    r.rect(6, 13, 2, 11, C('#feae34'));
    r.rect(6, 13, 1, 11, C('#f77622'));
    r.set(7, 16, C('#e43b44'));
    return { raster: r, ax: 7, ay: 24 };
  },
  molotov: () => {
    // Garrafa de cachaça com o pano enfiado no gargalo (a ponta laranja de fogo).
    const r = new Raster(12, 22);
    r.rect(3, 9, 6, 11, C('#94b0c2'));
    r.rect(4, 10, 4, 9, C('#feae34'));
    r.rect(4, 10, 1, 9, C('#fee761'));
    r.rect(5, 4, 2, 5, C('#94b0c2'));
    r.rect(4, 1, 4, 4, C('#e4e4e4'));
    r.rect(5, 2, 2, 2, C('#e43b44'));
    r.set(6, 0, C('#f77622'));
    r.set(5, 0, C('#fee761'));
    return { raster: r, ax: 6, ay: 20 };
  },
  tacoprego: () => {
    // O taco de sinuca com pregos atravessados na ponta grossa.
    const r = new Raster(14, 26);
    r.rect(6, 1, 2, 23, C('#c28a1f'));
    r.rect(6, 1, 1, 23, C('#e8b796'));
    r.rect(6, 1, 2, 2, C('#124e89'));
    for (const y of [5, 8, 11]) {
      r.rect(3, y, 8, 1, C('#8b9bb4'));
      r.set(3, y, C('#c0cbdc'));
      r.set(10, y, C('#c0cbdc'));
    }
    return { raster: r, ax: 7, ay: 24 };
  },
  espuma: () => {
    // O extintor com espuma branca escorrendo do bico.
    const r = new Raster(14, 22);
    r.rect(4, 6, 6, 14, C('#a22633'));
    r.rect(4, 6, 2, 14, C('#e43b44'));
    r.rect(5, 3, 4, 3, C('#181425'));
    r.rect(8, 2, 4, 2, C('#181425'));
    r.rect(10, 0, 4, 3, C('#f4f4f4'));
    r.rect(11, 3, 3, 3, C('#f4f4f4'));
    r.rect(12, 6, 2, 2, C('#c0cbdc'));
    r.rect(5, 11, 4, 3, C('#f4f4f4'));
    return { raster: r, ax: 7, ay: 20 };
  },
  sococaco: () => {
    // Caco de garrafa preso na mão com voltas de fita preta.
    const r = new Raster(12, 14);
    r.rect(4, 1, 3, 4, C('#3e8948'));
    r.rect(3, 4, 5, 3, C('#63c74d'));
    r.set(4, 0, C('#c0cbdc'));
    r.set(6, 0, C('#c0cbdc'));
    r.rect(2, 7, 7, 5, C('#181425'));
    r.rect(2, 8, 7, 1, C('#3a4466'));
    r.rect(2, 10, 7, 1, C('#3a4466'));
    return { raster: r, ax: 6, ay: 12 };
  },
};

export function armaSprite(a: Arma): Sprite {
  const k = `arma:${a}`;
  let s = cache.get(k);
  if (s) return s;
  if (a === 'garrafa' || a === 'taco' || a === 'banqueta') s = weaponSprite(a);
  else if (NOVAS[a]) s = NOVAS[a]!();
  else if (a === 'cano') {
    const r = new Raster(16, 24);
    for (let i = 0; i < 20; i++) r.rect(4 + Math.floor(i / 3), 22 - i, 2, 1, C(i % 6 === 0 ? '#8a4a2a' : '#6b7280'));
    r.rect(9, 2, 3, 2, C('#4a4f5c'));
    s = { raster: r, ax: 8, ay: 22 };
  } else if (a === 'desentupidor') {
    const r = new Raster(14, 24);
    r.rect(6, 4, 1, 14, C('#a96a40'));
    r.rect(3, 17, 7, 3, C('#a22633'));
    r.rect(2, 20, 9, 2, C('#73172d'));
    s = { raster: r, ax: 7, ay: 22 };
  } else if (a === 'caco') {
    const r = new Raster(10, 12);
    r.rect(4, 2, 2, 4, C('#3e8948'));
    r.rect(3, 6, 4, 3, C('#3e8948'));
    r.set(3, 9, C('#c0cbdc'));
    r.set(6, 9, C('#c0cbdc'));
    r.set(5, 10, C('#c0cbdc'));
    s = { raster: r, ax: 5, ay: 10 };
  } else {
    const r = new Raster(16, 22);
    r.rect(3, 12, 1, 8, C('#c28a1f'));
    r.rect(11, 12, 1, 8, C('#c28a1f'));
    r.box(8, 12, 5, 2, 2, C('#feae34'), C('#e09a20'), C('#c28a1f'));
    r.rect(3, 3, 1, 9, C('#c28a1f'));
    r.rect(12, 3, 1, 9, C('#c28a1f'));
    r.rect(3, 2, 10, 4, C('#feae34'));
    s = { raster: r, ax: 8, ay: 20 };
  }
  cache.set(k, s);
  return s;
}
