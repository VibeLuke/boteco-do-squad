/**
 * Efeitos de ambiente do Bar Vivo (Fatia 4, FX): o que se mexe sozinho em cada canto, sem mexer no jogo.
 * - Beco e pátio: fagulhas e fumaça dos barris de fogo, fumaça do churrasquinho, moscas nas caçambas, o portal girando.
 * - Calçada e rua: postes (um deles falha), farol e fumaça dos carros.
 * - Salão: poeira no ar, vapor gelado das chopeiras e do freezer, luz fria das geladeiras, notas saindo da jukebox,
 *   brilho dos fliperamas.
 * - Banheiro: a pia pingando.
 * Partículas em ladrilhos (x, y) mais a altura em pixels (h): a tela converte com telaDe. Cosmético e local (cada
 * aparelho sorteia o seu); a luz que pisca, por outro lado, é função pura da hora (igual para todos).
 */
import { PROPS, PORTAL, DIVISA, FACHADA, GRADE, zonaDe, type Zona } from './mapa';

export type TipoFagulha = 'brasa' | 'fumaca' | 'poeira' | 'nota' | 'gota' | 'respingo' | 'portal' | 'escape' | 'nevoa';

export interface Fagulha {
  tipo: TipoFagulha;
  zona: Zona;
  x: number;
  y: number;
  h: number;
  /** ladrilhos/s no chão e pixels/s na altura. */
  vx: number;
  vy: number;
  vh: number;
  vida: number;
  dura: number;
  cor: string;
  tam: number;
  /** Para o portal: ângulo e raio da espiral. */
  ang?: number;
  raio?: number;
}

export type TipoEmissor = 'fogo' | 'churrasco' | 'jukebox' | 'pia' | 'portal' | 'gelado';

export interface Emissor {
  tipo: TipoEmissor;
  x: number;
  y: number;
  zona: Zona;
  /** Partículas por segundo (média). */
  taxa: number;
}

export interface Luz {
  tipo: 'fogo' | 'poste' | 'portal' | 'fliperama' | 'jukebox' | 'geladeira';
  x: number;
  y: number;
  /** Altura da fonte de luz (px) e o raio do brilho (px). */
  h: number;
  r: number;
  cor: string;
  /** Variação do móvel (o poste 1 é o que falha). */
  v: number;
  zona: Zona;
}

const TAXA: Record<TipoEmissor, number> = { fogo: 16, churrasco: 6, jukebox: 0.8, pia: 0.6, portal: 18, gelado: 2.5 };

/** Emissores e luzes tirados dos móveis do mapa (e do portal), uma vez. */
export function montarAmbiente(): { emissores: Emissor[]; luzes: Luz[]; moscas: { x: number; y: number; zona: Zona }[] } {
  const emissores: Emissor[] = [];
  const luzes: Luz[] = [];
  const moscas: { x: number; y: number; zona: Zona }[] = [];
  const em = (tipo: TipoEmissor, x: number, y: number) => emissores.push({ tipo, x, y, zona: zonaDe(x, y), taxa: TAXA[tipo] });
  for (const p of PROPS) {
    const cx = p.x + 0.5;
    const cy = p.y + 0.5;
    const zona = zonaDe(p.x, p.y);
    if (p.kind === 'barril-fogo') {
      em('fogo', cx, cy);
      luzes.push({ tipo: 'fogo', x: cx, y: cy, h: 18, r: 60, cor: '#f77622', v: p.v, zona });
    } else if (p.kind === 'churrasqueira') em('churrasco', cx, cy);
    else if (p.kind === 'jukebox') {
      em('jukebox', cx, cy);
      luzes.push({ tipo: 'jukebox', x: cx, y: cy, h: 20, r: 22, cor: '#ff4fb0', v: p.v, zona });
    } else if (p.kind === 'pia') em('pia', cx, cy);
    else if (p.kind === 'poste') luzes.push({ tipo: 'poste', x: cx, y: cy, h: 54, r: 52, cor: '#feae34', v: p.v, zona });
    else if (p.kind === 'fliperama') luzes.push({ tipo: 'fliperama', x: cx, y: cy, h: 22, r: 18, cor: p.v ? '#2ce8f5' : '#63c74d', v: p.v, zona });
    else if (p.kind === 'cacamba') moscas.push({ x: cx, y: cy, zona });
    else if (p.kind === 'chopeira' || p.kind === 'freezer') em('gelado', cx, cy);
    else if (p.kind === 'geladeira') luzes.push({ tipo: 'geladeira', x: cx, y: cy + 0.4, h: 26, r: 34, cor: '#9ad0ff', v: p.v, zona });
  }
  const [px, py] = PORTAL;
  em('portal', px + 0.5, py + 0.6);
  luzes.push({ tipo: 'portal', x: px + 0.5, y: py + 0.6, h: 22, r: 40, cor: '#b55088', v: 0, zona: zonaDe(px, py) });
  return { emissores, luzes, moscas };
}

/** Ruído suave e determinístico (soma de senos com frequências que não batem). */
const ondula = (t: number, s: number) => Math.sin(t * 0.0131 + s) * 0.5 + Math.sin(t * 0.0377 + s * 2.1) * 0.3 + Math.sin(t * 0.0917 + s * 3.7) * 0.2;

/**
 * Força da luz (0 a 1) na hora `t` (ms do relógio do bar): o fogo tremula, o poste 0 fica firme, o poste 1 falha
 * (apaga uns instantes a cada ~7 s), o portal pulsa e a jukebox troca de cor no compasso.
 */
export function forcaLuz(l: Luz, t: number): number {
  switch (l.tipo) {
    case 'fogo':
      return 0.72 + 0.28 * ondula(t, l.x * 3.1 + l.y);
    case 'poste': {
      if (l.v !== 1) return 1;
      const c = t % 7000;
      // Pisca duas vezes e apaga meio segundo, depois volta.
      if (c < 120 || (c > 240 && c < 330)) return 0.15;
      if (c > 900 && c < 1400) return 0.05;
      return 1;
    }
    case 'portal':
      return 0.6 + 0.4 * Math.sin(t / 260);
    case 'jukebox':
      return 0.7 + 0.3 * Math.sin(t / 134);
    case 'fliperama':
      return 0.55 + 0.45 * (Math.floor(t / (300 + l.v * 170)) % 2);
    case 'geladeira':
      // Luz fria quase firme, com o zumbido do compressor (uma piscadinha a cada ~11 s).
      return (t + l.v * 4100) % 11000 < 90 ? 0.4 : 0.85 + 0.15 * Math.sin(t / 900 + l.v);
  }
}

/** Cor da jukebox no compasso (rosa, ciano, amarelo). */
export function corJukebox(t: number): string {
  return ['#ff4fb0', '#2ce8f5', '#fee761'][Math.floor(t / 535) % 3];
}

/** Moscas em volta da caçamba: 3 por caçamba, em órbitas tortas (função da hora). Devolve [x, y, h] em ladrilho/px. */
export function moscasEm(m: { x: number; y: number }, t: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const a = t / (210 + i * 57) + i * 2.1 + m.x;
    out.push([m.x + Math.cos(a) * 0.45, m.y + Math.sin(a * 1.3) * 0.3, 20 + Math.sin(a * 2.7) * 5 + i * 3]);
  }
  return out;
}

/** A área do salão onde a poeira aparece (dentro do bar, debaixo do teto). */
export function noSalao(x: number, y: number): boolean {
  return zonaDe(x, y) === 'bar' && y <= FACHADA && x < GRADE && x >= 0 && !(x >= DIVISA && x < DIVISA + 1);
}

export interface Ambiente {
  p: Fagulha[];
  acum: Map<Emissor, number>;
  rnd: () => number;
  max: number;
}

export const MAX_FAGULHAS = 260;

export function novoAmbiente(rnd: () => number = Math.random, max = MAX_FAGULHAS): Ambiente {
  return { p: [], acum: new Map(), rnd, max };
}

function solta(a: Ambiente, f: Omit<Fagulha, 'vida'>) {
  if (a.p.length >= a.max) return;
  a.p.push({ ...f, vida: 0 });
}

const BRASA = ['#fee761', '#feae34', '#f77622', '#e43b44'];

function emitir(a: Ambiente, e: Emissor) {
  const r = a.rnd;
  switch (e.tipo) {
    case 'fogo':
      if (r() < 0.8)
        solta(a, { tipo: 'brasa', zona: e.zona, x: e.x + (r() - 0.5) * 0.3, y: e.y + (r() - 0.5) * 0.3, h: 14, vx: (r() - 0.5) * 0.3, vy: (r() - 0.5) * 0.3, vh: 22 + r() * 26, dura: 0.6 + r() * 0.9, cor: BRASA[Math.floor(r() * BRASA.length)], tam: 1 });
      else solta(a, { tipo: 'fumaca', zona: e.zona, x: e.x, y: e.y, h: 20, vx: 0.15 + r() * 0.1, vy: -0.05, vh: 9 + r() * 5, dura: 2.2 + r(), cor: '#3a3a48', tam: 2 });
      break;
    case 'churrasco':
      solta(a, { tipo: 'fumaca', zona: e.zona, x: e.x + (r() - 0.5) * 0.4, y: e.y, h: 12, vx: 0.2 + r() * 0.15, vy: -0.08, vh: 10 + r() * 6, dura: 2 + r() * 1.2, cor: r() < 0.5 ? '#c0cbdc' : '#8b9bb4', tam: 2 });
      if (r() < 0.25) solta(a, { tipo: 'brasa', zona: e.zona, x: e.x, y: e.y, h: 10, vx: (r() - 0.5) * 0.2, vy: 0, vh: 18 + r() * 10, dura: 0.5 + r() * 0.4, cor: '#feae34', tam: 1 });
      break;
    case 'jukebox':
      solta(a, { tipo: 'nota', zona: e.zona, x: e.x + (r() - 0.5) * 0.4, y: e.y, h: 26, vx: (r() - 0.5) * 0.2, vy: 0.1, vh: 10, dura: 1.8, cor: ['#ff4fb0', '#2ce8f5', '#fee761'][Math.floor(r() * 3)], tam: 1 });
      break;
    case 'gelado':
      solta(a, { tipo: 'nevoa', zona: e.zona, x: e.x + (r() - 0.5) * 0.4, y: e.y + (r() - 0.5) * 0.3, h: 22 + r() * 6, vx: (r() - 0.5) * 0.1, vy: 0, vh: -3 - r() * 3, dura: 1.2 + r() * 0.6, cor: '#e8f4ff', tam: 1 });
      break;
    case 'pia':
      solta(a, { tipo: 'gota', zona: e.zona, x: e.x - 0.1, y: e.y - 0.2, h: 16, vx: 0, vy: 0, vh: 0, dura: 0.42, cor: '#4b7ab8', tam: 2 });
      break;
    case 'portal': {
      const ang = r() * Math.PI * 2;
      solta(a, { tipo: 'portal', zona: e.zona, x: e.x, y: e.y, h: 22, vx: 0, vy: 0, vh: 0, dura: 0.9 + r() * 0.5, cor: r() < 0.5 ? '#2ce8f5' : r() < 0.5 ? '#b55088' : '#f4f4f4', tam: 1, ang, raio: 14 + r() * 6 });
      break;
    }
  }
}

/**
 * Anda o ambiente `dt` segundos na zona que está na tela (as outras não gastam nada): solta o que cada emissor
 * solta, mexe e tira o que acabou. `extra` são os emissores de agora (carros na rua soltando fumaça).
 */
export function passoAmbiente(a: Ambiente, emissores: readonly Emissor[], zona: Zona, dt: number, extra: readonly { x: number; y: number; dir: number }[] = []) {
  for (const e of emissores) {
    if (e.zona !== zona) continue;
    let n = (a.acum.get(e) ?? 0) + e.taxa * dt;
    while (n >= 1) {
      emitir(a, e);
      n -= 1;
    }
    a.acum.set(e, n);
  }
  // Poeira no ar do salão (só quando se está no bar: aparece pela sala toda, devagar).
  if (zona === 'bar' && a.rnd() < dt * 10) {
    const x = a.rnd() * DIVISA * 1.6;
    const y = a.rnd() * FACHADA;
    if (noSalao(x, y)) solta(a, { tipo: 'poeira', zona, x, y, h: 8 + a.rnd() * 50, vx: (a.rnd() - 0.5) * 0.12, vy: (a.rnd() - 0.5) * 0.12, vh: (a.rnd() - 0.4) * 3, dura: 4 + a.rnd() * 3, cor: '#f4e0c0', tam: 1 });
  }
  // Escapamento dos carros na rua.
  if (zona === 'bar')
    for (const c of extra)
      if (a.rnd() < dt * 8) solta(a, { tipo: 'escape', zona, x: c.x - c.dir * 0.9, y: c.y, h: 3, vx: -c.dir * 0.4, vy: -0.05, vh: 6, dura: 1.1, cor: '#8b9bb4', tam: 2 });
  for (let i = a.p.length - 1; i >= 0; i--) {
    const f = a.p[i];
    f.vida += dt;
    if (f.vida >= f.dura) {
      // A gota que cai na pia vira respingo.
      if (f.tipo === 'gota') for (const s of [-1, 1]) solta(a, { tipo: 'respingo', zona: f.zona, x: f.x, y: f.y, h: f.h, vx: s * 0.35, vy: 0, vh: 14, dura: 0.25, cor: '#c8e8ff', tam: 1 });
      a.p.splice(i, 1);
      continue;
    }
    if (f.tipo === 'gota') f.vh -= 90 * dt; // cai
    if (f.tipo === 'respingo') f.vh -= 120 * dt;
    if (f.tipo === 'brasa') f.vx += Math.sin(f.vida * 9 + f.x * 7) * 0.6 * dt; // sobe sambando
    if (f.tipo === 'portal' && f.raio !== undefined && f.ang !== undefined) {
      // Espiral para dentro do portal.
      f.ang += dt * 5;
      f.raio = Math.max(0, f.raio - dt * 14);
      continue;
    }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.h = Math.max(0, f.h + f.vh * dt);
  }
}
