/**
 * Efeitos da Dimensão GFA, a parte pura (sem three.js): partículas (faísca de batida, respingo de atropelo, fumaça de
 * pneu, fumaça do escapamento), tremor da câmera, marca de derrapagem e a luz da sirene. A tela só desenha o que sai
 * daqui. Cosmético e local: cada aparelho sorteia o seu (não viaja na rede).
 */
import type { Carro, Entrada, Gfa, TipoObjeto } from './simulacao';

export interface Particula {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Segundos vividos e o total. */
  vida: number;
  dura: number;
  cor: string;
  /** Tamanho (unidades do mundo) no começo e no fim da vida. */
  tam0: number;
  tam1: number;
  /** Opacidade no começo (cai até 0 no fim). */
  a0: number;
  grav: number;
  /** Fração da velocidade perdida por segundo. */
  arrasto: number;
  /** Soma luz (faísca, brilho) em vez de cobrir (fumaça, sangue). */
  luz: boolean;
  /** Para no chão em vez de afundar. */
  chao: boolean;
}

/** Fatia 5: pedaço de gente voando (cabeça, braço, perna), com o desenho do próprio boneco. */
export type ParteGfa = 'cabeca' | 'braco' | 'perna';
export interface Pedaco3d {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vrot: number;
  parte: ParteGfa;
  look: number;
  espelho: boolean;
  vida: number;
  /** Vem na direção da câmera (e gruda na tela se chegar). */
  praTela: boolean;
  parado: boolean;
}
/** O que grudou na tela: sangue (ou molho) e, às vezes, o pedaço. */
export interface NaTela {
  parte: ParteGfa | null;
  look: number;
  gore: boolean;
}

/** Fatia 6: caco de cenario quebrado (poste, banco, vidro...), um cubinho com fisica que quica e para. */
export interface Detrito {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vrot: number;
  /** Aresta do cubinho (m). */
  tam: number;
  cor: string;
  vida: number;
  parado: boolean;
}

export interface Fx {
  p: Particula[];
  /** Fatia 6: cacos do cenario quebrado e os relogios do jato d'agua e do fogo. */
  detritos: Detrito[];
  proxJato: number;
  proxFogo: number;
  /** Fatia 5: pedaços voando, o que chegou na tela e onde está a câmera (a tela informa a cada quadro). */
  pedacos: Pedaco3d[];
  naTela: NaTela[];
  cam: { x: number; y: number; z: number } | null;
  /** 0 a 1: quanto a câmera treme agora (cai sozinho). */
  tremor: number;
  /** Marcas de pneu pedidas desde a última leitura (a tela recicla as suas). */
  marcas: { x: number; z: number; ang: number }[];
  max: number;
  rnd: () => number;
  /** Relógio interno (s) para espaçar fumaça e marcas. */
  t: number;
  proxFumaca: number;
  proxMarca: number;
  proxEscape: number;
}

export const MAX_DETRITOS = 200;

export const MAX_PARTICULAS = 420;

function mulberry(s: number) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function novoFx(semente = 1, max = MAX_PARTICULAS): Fx {
  return { p: [], detritos: [], proxJato: 0, proxFogo: 0, pedacos: [], naTela: [], cam: null, tremor: 0, marcas: [], max, rnd: mulberry(semente), t: 0, proxFumaca: 0, proxMarca: 0, proxEscape: 0 };
}

function soltar(fx: Fx, q: Omit<Particula, 'vida'>) {
  if (fx.p.length >= fx.max) fx.p.shift(); // cheio: a mais velha cede o lugar
  fx.p.push({ ...q, vida: 0 });
}

const FAISCA = ['#fee761', '#feae34', '#f77622', '#ffffff'];
const SANGUE = ['#a22633', '#73172d', '#e43b44'];
const MOLHO = ['#ef7d57', '#e43b44', '#feae34'];

/** Batida em prédio ou muro: leque de faíscas e lascas, e a câmera treme pela força. */
export function faiscas(fx: Fx, x: number, z: number, forca: number) {
  const n = Math.min(40, 8 + Math.round(forca * 1.2));
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * Math.PI * 2;
    const v = 6 + fx.rnd() * (6 + forca * 0.5);
    soltar(fx, {
      x,
      y: 0.6 + fx.rnd() * 0.8,
      z,
      vx: Math.cos(a) * v,
      vy: 3 + fx.rnd() * 7,
      vz: Math.sin(a) * v,
      dura: 0.25 + fx.rnd() * 0.45,
      cor: FAISCA[Math.floor(fx.rnd() * FAISCA.length)],
      tam0: 0.35,
      tam1: 0.1,
      a0: 1,
      grav: 22,
      arrasto: 1.5,
      luz: true,
      chao: false,
    });
  }
  // Poeira da batida (cinza, sobe devagar).
  for (let i = 0; i < 6; i++)
    soltar(fx, {
      x: x + (fx.rnd() - 0.5) * 1.5,
      y: 0.5,
      z: z + (fx.rnd() - 0.5) * 1.5,
      vx: (fx.rnd() - 0.5) * 2,
      vy: 1 + fx.rnd(),
      vz: (fx.rnd() - 0.5) * 2,
      dura: 0.8 + fx.rnd() * 0.6,
      cor: '#8b9bb4',
      tam0: 0.8,
      tam1: 2.4,
      a0: 0.55,
      grav: 0,
      arrasto: 1.2,
      luz: false,
      chao: false,
    });
  fx.tremor = Math.min(1, fx.tremor + Math.min(0.9, forca / 22));
}

/** Atropelo: respingo para a frente do carro (sangue ou molho de tomate) e um tranco na câmera. */
export function respingo(fx: Fx, x: number, z: number, vel: number, angCarro: number, gore: boolean) {
  const cores = gore ? SANGUE : MOLHO;
  const n = Math.min(36, 12 + Math.round(vel));
  const fx0 = Math.sin(angCarro);
  const fz0 = Math.cos(angCarro);
  for (let i = 0; i < n; i++) {
    const v = vel * (0.25 + fx.rnd() * 0.45);
    soltar(fx, {
      x,
      y: 1 + fx.rnd() * 0.8,
      z,
      vx: fx0 * v + (fx.rnd() - 0.5) * 6,
      vy: 2 + fx.rnd() * 6,
      vz: fz0 * v + (fx.rnd() - 0.5) * 6,
      dura: 0.6 + fx.rnd() * 0.6,
      cor: cores[Math.floor(fx.rnd() * cores.length)],
      tam0: 0.3 + fx.rnd() * 0.2,
      tam1: 0.25,
      a0: 1,
      grav: 20,
      arrasto: 0.8,
      luz: false,
      chao: true,
    });
  }
  fx.tremor = Math.min(1, fx.tremor + 0.25);
}

export const MAX_PEDACOS_GFA = 70;
/** Quão perto da câmera o pedaço precisa chegar para grudar na tela (m). */
export const GRUDA = 1.8;
const GRAV_PEDACO = 20;

/**
 * Gente se despedaçando (Fatia 5): cabeça, dois braços e duas pernas voam girando, um jato de sangue e carne, e até
 * dois pedaços vêm direto na câmera. Sem sangue: ninguém perde nada; de perto, às vezes um molho gruda na tela.
 */
export function despedacar(fx: Fx, x: number, z: number, vx: number, vz: number, look: number, gore: boolean) {
  const perto = fx.cam ? Math.hypot(fx.cam.x - x, fx.cam.z - z) : Infinity;
  if (!gore) {
    if (perto < 14 && fx.rnd() < 0.5) fx.naTela.push({ parte: null, look, gore: false });
    return;
  }
  const partes: [ParteGfa, boolean][] = [['cabeca', false], ['braco', false], ['braco', true], ['perna', false], ['perna', true]];
  let praTela = 0;
  for (const [parte, espelho] of partes) {
    if (fx.pedacos.length >= MAX_PEDACOS_GFA) fx.pedacos.shift();
    const pd: Pedaco3d = {
      x, y: parte === 'cabeca' ? 1.7 : parte === 'braco' ? 1.3 : 0.6, z,
      vx: vx * 0.6 + (fx.rnd() - 0.5) * 9, vy: 6 + fx.rnd() * 7, vz: vz * 0.6 + (fx.rnd() - 0.5) * 9,
      rot: fx.rnd() * 6.28, vrot: (fx.rnd() < 0.5 ? -1 : 1) * (8 + fx.rnd() * 12),
      parte, look, espelho, vida: 0, praTela: false, parado: false,
    };
    // Até dois vão na câmera (a cabeça primeiro), se ela estiver perto o bastante para valer o susto.
    if (fx.cam && perto < 26 && praTela < 2 && fx.rnd() < (parte === 'cabeca' ? 0.6 : 0.3)) {
      const T = 0.45 + fx.rnd() * 0.2;
      pd.vx = (fx.cam.x - pd.x) / T;
      pd.vz = (fx.cam.z - pd.z) / T;
      pd.vy = (fx.cam.y - pd.y) / T + 0.5 * GRAV_PEDACO * T;
      pd.praTela = true;
      praTela++;
    }
    fx.pedacos.push(pd);
  }
  // Jato de sangue para todo lado e pedacinhos de carne.
  respingo(fx, x, z, Math.max(14, Math.hypot(vx, vz)), Math.atan2(vx, vz), true);
  respingo(fx, x, z, 10, Math.atan2(-vx, -vz), true);
  for (let i = 0; i < 10; i++) {
    const a = fx.rnd() * Math.PI * 2;
    soltar(fx, { x, y: 1.1, z, vx: Math.cos(a) * 6, vy: 4 + fx.rnd() * 6, vz: Math.sin(a) * 6, dura: 2 + fx.rnd(), cor: fx.rnd() < 0.5 ? '#73172d' : '#a22633', tam0: 0.45, tam1: 0.4, a0: 1, grav: 20, arrasto: 0.5, luz: false, chao: true });
  }
  fx.tremor = Math.min(1, fx.tremor + 0.2);
}

/** Clarão do tiro na janela, a cápsula pulando e a fumacinha. */
export function clarao(fx: Fx, x: number, z: number, dx: number, dz: number) {
  const n = Math.hypot(dx, dz) || 1;
  const ux = dx / n;
  const uz = dz / n;
  soltar(fx, { x: x + ux * 0.6, y: 1.45, z: z + uz * 0.6, vx: 0, vy: 0, vz: 0, dura: 0.07, cor: '#ffffff', tam0: 2.6, tam1: 1.4, a0: 1, grav: 0, arrasto: 0, luz: true, chao: false });
  for (let i = 0; i < 7; i++)
    soltar(fx, { x: x + ux * 0.6, y: 1.45, z: z + uz * 0.6, vx: ux * (10 + fx.rnd() * 10) + (fx.rnd() - 0.5) * 4, vy: (fx.rnd() - 0.5) * 3, vz: uz * (10 + fx.rnd() * 10) + (fx.rnd() - 0.5) * 4, dura: 0.08 + fx.rnd() * 0.08, cor: FAISCA[i % FAISCA.length], tam0: 0.35, tam1: 0.1, a0: 1, grav: 0, arrasto: 4, luz: true, chao: false });
  soltar(fx, { x, y: 1.5, z, vx: -uz * 3 + (fx.rnd() - 0.5), vy: 4, vz: ux * 3 + (fx.rnd() - 0.5), dura: 0.9, cor: '#feae34', tam0: 0.18, tam1: 0.18, a0: 1, grav: 22, arrasto: 0.5, luz: false, chao: true });
  soltar(fx, { x: x + ux * 0.8, y: 1.45, z: z + uz * 0.8, vx: ux, vy: 0.6, vz: uz, dura: 0.6, cor: '#8b9bb4', tam0: 0.5, tam1: 1.6, a0: 0.4, grav: -0.5, arrasto: 2, luz: false, chao: false });
}

/** Cores dos cacos de cada objeto (a tela usa as mesmas cores no objeto inteiro). */
export const COR_OBJETO: Record<TipoObjeto, string[]> = {
  poste: ['#5a6988', '#8b9bb4', '#feae34'],
  hidrante: ['#e43b44', '#a22633', '#c0cbdc'],
  lixeira: ['#3e8948', '#265c42', '#8b9bb4'],
  banca: ['#feae34', '#e43b44', '#f4f4f4'],
  banco: ['#b86f50', '#733e39', '#8b9bb4'],
  arvore: ['#3e8948', '#63c74d', '#733e39'],
  cone: ['#f77622', '#f4f4f4', '#f77622'],
  orelhao: ['#68aed4', '#2ce8f5', '#262b44'],
  placa: ['#0099db', '#f4f4f4', '#5a6988'],
  ponto: ['#feae34', '#68aed4', '#5a6988'],
};
/** Quantos cacos cada objeto solta (os grandes soltam mais). */
const CACOS: Record<TipoObjeto, number> = { poste: 8, hidrante: 7, lixeira: 7, banca: 14, banco: 9, arvore: 12, cone: 4, orelhao: 8, placa: 6, ponto: 14 };

function soltarDetrito(fx: Fx, d: Omit<Detrito, 'vida' | 'parado'>) {
  if (fx.detritos.length >= MAX_DETRITOS) fx.detritos.shift();
  fx.detritos.push({ ...d, vida: 0, parado: false });
}

/** Objeto quebrado: cacos voando na direção da batida (vx, vz), poeira e a câmera treme pela força. */
export function quebrarObjeto(fx: Fx, tipo: TipoObjeto, x: number, z: number, vx: number, vz: number, forca: number) {
  const cores = COR_OBJETO[tipo];
  const n = CACOS[tipo];
  for (let i = 0; i < n; i++)
    soltarDetrito(fx, {
      x: x + (fx.rnd() - 0.5) * 0.6,
      y: 0.3 + fx.rnd() * (tipo === 'arvore' || tipo === 'poste' ? 2.2 : 0.9),
      z: z + (fx.rnd() - 0.5) * 0.6,
      vx: vx * (0.5 + fx.rnd() * 0.6) + (fx.rnd() - 0.5) * 6,
      vy: 3 + fx.rnd() * (4 + forca * 0.15),
      vz: vz * (0.5 + fx.rnd() * 0.6) + (fx.rnd() - 0.5) * 6,
      rot: fx.rnd() * 6.28,
      vrot: (fx.rnd() - 0.5) * 20,
      tam: 0.12 + fx.rnd() * 0.2,
      cor: cores[i % cores.length],
    });
  for (let i = 0; i < 5; i++)
    soltar(fx, { x: x + (fx.rnd() - 0.5), y: 0.4, z: z + (fx.rnd() - 0.5), vx: (fx.rnd() - 0.5) * 3, vy: 1 + fx.rnd(), vz: (fx.rnd() - 0.5) * 3, dura: 0.7 + fx.rnd() * 0.5, cor: '#8b9bb4', tam0: 0.7, tam1: 2.2, a0: 0.5, grav: 0, arrasto: 1.2, luz: false, chao: false });
  fx.tremor = Math.min(1, fx.tremor + Math.min(0.4, forca / 40));
}

/** Vidro de loja estilhaçando: cacos azulados e brilhos. */
export function estilhacar(fx: Fx, x: number, z: number, eixo: 'x' | 'z') {
  for (let i = 0; i < 12; i++) {
    const along = (fx.rnd() - 0.5) * 3.4;
    soltarDetrito(fx, {
      x: x + (eixo === 'x' ? along : 0),
      y: 0.4 + fx.rnd() * 1.6,
      z: z + (eixo === 'z' ? along : 0),
      vx: (fx.rnd() - 0.5) * 6,
      vy: 1 + fx.rnd() * 3,
      vz: (fx.rnd() - 0.5) * 6,
      rot: fx.rnd() * 6.28,
      vrot: (fx.rnd() - 0.5) * 16,
      tam: 0.1 + fx.rnd() * 0.12,
      cor: fx.rnd() < 0.6 ? '#68aed4' : '#c0cbdc',
    });
  }
  for (let i = 0; i < 8; i++)
    soltar(fx, { x: x + (eixo === 'x' ? (fx.rnd() - 0.5) * 3 : 0), y: 0.5 + fx.rnd() * 1.5, z: z + (eixo === 'z' ? (fx.rnd() - 0.5) * 3 : 0), vx: (fx.rnd() - 0.5) * 3, vy: fx.rnd() * 2, vz: (fx.rnd() - 0.5) * 3, dura: 0.35, cor: '#ffffff', tam0: 0.3, tam1: 0.1, a0: 1, grav: 14, arrasto: 1, luz: true, chao: false });
  fx.tremor = Math.min(1, fx.tremor + 0.12);
}

/** Explosão: bola de fogo, fumaça preta, cacos de lataria e um tranco na câmera que cai com a distância. */
export function explosao(fx: Fx, x: number, z: number) {
  for (let i = 0; i < 26; i++) {
    const a = fx.rnd() * Math.PI * 2;
    const v = 3 + fx.rnd() * 13;
    soltar(fx, { x, y: 0.8 + fx.rnd() * 1.2, z, vx: Math.cos(a) * v, vy: 2 + fx.rnd() * 9, vz: Math.sin(a) * v, dura: 0.35 + fx.rnd() * 0.5, cor: FAISCA[i % FAISCA.length], tam0: 1.6, tam1: 0.4, a0: 1, grav: 6, arrasto: 2, luz: true, chao: false });
  }
  for (let i = 0; i < 12; i++)
    soltar(fx, { x: x + (fx.rnd() - 0.5) * 3, y: 1 + fx.rnd(), z: z + (fx.rnd() - 0.5) * 3, vx: (fx.rnd() - 0.5) * 5, vy: 2 + fx.rnd() * 3, vz: (fx.rnd() - 0.5) * 5, dura: 1.4 + fx.rnd() * 1.1, cor: fx.rnd() < 0.5 ? '#181425' : '#262b44', tam0: 1.6, tam1: 5, a0: 0.7, grav: -1.2, arrasto: 1, luz: false, chao: false });
  for (let i = 0; i < 14; i++) {
    const a = fx.rnd() * Math.PI * 2;
    const v = 4 + fx.rnd() * 9;
    soltarDetrito(fx, { x, y: 0.8 + fx.rnd(), z, vx: Math.cos(a) * v, vy: 5 + fx.rnd() * 8, vz: Math.sin(a) * v, rot: fx.rnd() * 6.28, vrot: (fx.rnd() - 0.5) * 24, tam: 0.18 + fx.rnd() * 0.3, cor: fx.rnd() < 0.5 ? '#262b44' : '#5a6988' });
  }
  const d = fx.cam ? Math.hypot(fx.cam.x - x, fx.cam.z - z) : 0;
  fx.tremor = Math.min(1, fx.tremor + Math.max(0.25, 0.9 * (1 - d / 45)));
}

/** Um filete de água do hidrante quebrado (sobe e cai em arco). */
export function jatoAgua(fx: Fx, x: number, z: number) {
  for (let i = 0; i < 2; i++)
    soltar(fx, { x, y: 0.9, z, vx: (fx.rnd() - 0.5) * 2.4, vy: 8 + fx.rnd() * 4, vz: (fx.rnd() - 0.5) * 2.4, dura: 1.0, cor: fx.rnd() < 0.5 ? '#68aed4' : '#c0cbdc', tam0: 0.4, tam1: 0.25, a0: 0.85, grav: 20, arrasto: 0.2, luz: false, chao: true });
}

/** Uma labareda e um fio de fumaça de carro pegando fogo. */
export function chamas(fx: Fx, x: number, z: number) {
  soltar(fx, { x: x + (fx.rnd() - 0.5) * 1.4, y: 0.9, z: z + (fx.rnd() - 0.5) * 2, vx: (fx.rnd() - 0.5) * 0.8, vy: 2.5 + fx.rnd() * 2, vz: (fx.rnd() - 0.5) * 0.8, dura: 0.5, cor: fx.rnd() < 0.5 ? '#f77622' : '#fee761', tam0: 1.0, tam1: 0.2, a0: 0.95, grav: -2, arrasto: 1, luz: true, chao: false });
  soltar(fx, { x, y: 1.4, z, vx: fx.rnd() - 0.5, vy: 2.2, vz: fx.rnd() - 0.5, dura: 1.3, cor: '#262b44', tam0: 0.8, tam1: 2.8, a0: 0.5, grav: -1, arrasto: 1, luz: false, chao: false });
}

/** Derrapando: de lado rápido, ou freando forte em velocidade. */
export function emDerrapagem(c: Carro, e: Entrada): boolean {
  return Math.abs(c.lado) > 2.6 || (e.freio && Math.abs(c.vel) > 9) || (e.acel < 0 && c.vel > 12);
}

/** As duas rodas de trás no mundo. */
export function rodasTras(c: Carro): [number, number][] {
  const fx = Math.sin(c.ang);
  const fz = Math.cos(c.ang);
  // Direita do carro = (cos, -sin) no plano.
  return [-1, 1].map((l) => [c.x - fx * 1.3 + fz * l, c.z - fz * 1.3 - fx * l] as [number, number]);
}

/**
 * Anda os efeitos `dt` segundos: física das partículas, tremor caindo e o que o carro solta sozinho (fumaça de pneu
 * e marca no asfalto quando derrapa, fumacinha do escapamento acelerando).
 */
export function passoFx(fx: Fx, dt: number, g?: Gfa, e?: Entrada) {
  fx.t += dt;
  for (let i = fx.p.length - 1; i >= 0; i--) {
    const p = fx.p[i];
    p.vida += dt;
    if (p.vida >= p.dura) {
      fx.p.splice(i, 1);
      continue;
    }
    const k = Math.max(0, 1 - p.arrasto * dt);
    p.vx *= k;
    p.vz *= k;
    p.vy -= p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (p.y < 0.05) {
      p.y = 0.05;
      if (p.chao) {
        p.vx = p.vy = p.vz = 0;
      } else p.vy = Math.abs(p.vy) * 0.3; // faísca quica
    }
  }
  fx.tremor = Math.max(0, fx.tremor - dt * 2.2);
  // Cacos do cenário: caem girando, quicam e param (somem depois de 16 s).
  for (let i = fx.detritos.length - 1; i >= 0; i--) {
    const d = fx.detritos[i];
    d.vida += dt;
    if (d.vida > 16) {
      fx.detritos.splice(i, 1);
      continue;
    }
    if (d.parado) continue;
    d.vy -= 24 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;
    d.rot += d.vrot * dt;
    if (d.y < d.tam / 2 && d.vy < 0) {
      d.y = d.tam / 2;
      d.vy = -d.vy * 0.35;
      d.vx *= 0.6;
      d.vz *= 0.6;
      d.vrot *= 0.5;
      if (Math.hypot(d.vx, d.vy, d.vz) < 0.8) d.parado = true;
    }
  }
  // Hidrantes quebrados soltam jato e carros em chamas soltam fogo (os 3 mais perto, para não lotar as partículas).
  if (g && !g.acabou) {
    const perto = (a: { x: number; z: number }) => Math.hypot(a.x - g.carro.x, a.z - g.carro.z);
    if (fx.t >= fx.proxJato) {
      fx.proxJato = fx.t + 0.06;
      const jatos = (g.objetos ?? []).filter((o) => o.estado === 'quebrado' && o.jatoAte > g.t && perto(o) < 50);
      jatos.sort((a, b) => perto(a) - perto(b));
      for (const o of jatos.slice(0, 3)) jatoAgua(fx, o.x, o.z);
    }
    if (fx.t >= fx.proxFogo) {
      fx.proxFogo = fx.t + 0.09;
      const fogos = (g.civis ?? []).filter((v) => v.fogo && perto(v) < 45);
      fogos.sort((a, b) => perto(a) - perto(b));
      for (const v of fogos.slice(0, 3)) chamas(fx, v.x, v.z);
    }
  }
  // Pedaços: caem girando, quicam deixando sangue, param; os que vêm na câmera grudam na tela.
  for (let i = fx.pedacos.length - 1; i >= 0; i--) {
    const pd = fx.pedacos[i];
    pd.vida += dt;
    if (pd.vida > 12) {
      fx.pedacos.splice(i, 1);
      continue;
    }
    if (pd.parado) continue;
    pd.vy -= GRAV_PEDACO * dt;
    pd.x += pd.vx * dt;
    pd.y += pd.vy * dt;
    pd.z += pd.vz * dt;
    pd.rot += pd.vrot * dt;
    if (pd.praTela && fx.cam && Math.hypot(pd.x - fx.cam.x, pd.y - fx.cam.y, pd.z - fx.cam.z) < GRUDA) {
      fx.naTela.push({ parte: pd.parte, look: pd.look, gore: true });
      fx.pedacos.splice(i, 1);
      continue;
    }
    if (pd.y < 0.2 && pd.vy < 0) {
      pd.y = 0.2;
      pd.vy = -pd.vy * 0.25;
      pd.vx *= 0.55;
      pd.vz *= 0.55;
      pd.vrot *= 0.5;
      pd.praTela = false;
      if (Math.hypot(pd.vx, pd.vy, pd.vz) < 1.2) pd.parado = true;
      soltar(fx, { x: pd.x, y: 0.3, z: pd.z, vx: (fx.rnd() - 0.5) * 3, vy: 2, vz: (fx.rnd() - 0.5) * 3, dura: 0.8, cor: '#a22633', tam0: 0.3, tam1: 0.3, a0: 1, grav: 20, arrasto: 0.5, luz: false, chao: true });
    }
  }
  if (!g || !e || g.acabou) return;
  const c = g.carro;
  if (emDerrapagem(c, e) && fx.t >= fx.proxFumaca) {
    fx.proxFumaca = fx.t + 0.035;
    for (const [x, z] of rodasTras(c))
      soltar(fx, {
        x: x + (fx.rnd() - 0.5) * 0.4,
        y: 0.3,
        z: z + (fx.rnd() - 0.5) * 0.4,
        vx: (fx.rnd() - 0.5) * 1.5,
        vy: 0.8 + fx.rnd() * 0.8,
        vz: (fx.rnd() - 0.5) * 1.5,
        dura: 0.9 + fx.rnd() * 0.7,
        cor: fx.rnd() < 0.5 ? '#c0cbdc' : '#8b9bb4',
        tam0: 0.9,
        tam1: 3.2,
        a0: 0.5,
        grav: -0.4,
        arrasto: 1.5,
        luz: false,
        chao: false,
      });
  }
  if (emDerrapagem(c, e) && Math.abs(c.vel) > 4 && fx.t >= fx.proxMarca) {
    fx.proxMarca = fx.t + 0.05;
    for (const [x, z] of rodasTras(c)) fx.marcas.push({ x, z, ang: c.ang });
  }
  if (e.acel > 0 && fx.t >= fx.proxEscape) {
    fx.proxEscape = fx.t + 0.09;
    const [x, z] = rodasTras(c)[0];
    soltar(fx, {
      x,
      y: 0.5,
      z,
      vx: -Math.sin(c.ang) * 2,
      vy: 0.6,
      vz: -Math.cos(c.ang) * 2,
      dura: 0.6,
      cor: '#5d275d',
      tam0: 0.4,
      tam1: 1.4,
      a0: 0.45,
      grav: -0.5,
      arrasto: 2,
      luz: false,
      chao: false,
    });
  }
}

/** Luz da sirene na tela: a viatura mais perto decide a força (0 longe de 32 m) e a cor alterna vermelho e azul. */
export function luzSirene(g: Gfa, agoraMs: number): { cor: 'vermelho' | 'azul'; forca: number } {
  let d = Infinity;
  for (const v of g.viaturas) d = Math.min(d, Math.hypot(v.x - g.carro.x, v.z - g.carro.z));
  const forca = d === Infinity ? 0 : Math.max(0, Math.min(1, 1 - d / 32));
  return { cor: Math.floor(agoraMs / 180) % 2 === 0 ? 'vermelho' : 'azul', forca };
}

/** Linhas de velocidade: nada até 55% da máxima, cheio na máxima. */
export function linhasVelocidade(vel: number, velMax: number): number {
  return Math.max(0, Math.min(1, (Math.abs(vel) / velMax - 0.55) / 0.45));
}
