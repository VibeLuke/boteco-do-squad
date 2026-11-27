/**
 * Rotina dos NPCs como função pura de (NPC, hora): dois aparelhos com a mesma hora do servidor veem o mesmo NPC no
 * mesmo lugar, sem trafegar nada. O ciclo é: andar até a parada (caminho A* entre centros de ladrilho), ficar o
 * tempo dela, seguir para a próxima, e repetir. Cada NPC tem um deslocamento próprio no ciclo (pelo id), para não
 * andarem todos juntos.
 */
import { findPath } from '../bar/path';
import { anda } from './mapa';
import { FICHAS, type Npc, type Pose } from './gente';

export interface NaRotina {
  x: number;
  y: number;
  /** Direção do último passo (para virar o boneco), em ladrilhos. */
  dx: number;
  dy: number;
  andando: boolean;
  pose: Pose;
  /** Índice da parada para onde vai (ou onde está). */
  i: number;
}

interface Perna {
  /** Pontos do caminho (centros), do começo da perna até a parada. */
  pts: [number, number][];
  /** Comprimento acumulado até cada ponto. */
  acc: number[];
  /** Tempo andando e tempo parado (ms). */
  anda: number;
  fica: number;
  pose: Pose;
}

export function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const cache = new Map<string, { pernas: Perna[]; ciclo: number; fase: number }>();

function montar(n: Npc) {
  const v = FICHAS[n.tipo].velocidade;
  const pernas: Perna[] = [];
  const k = n.rotina.length;
  for (let i = 0; i < k; i++) {
    const de = n.rotina[(i + k - 1) % k];
    const para = n.rotina[i];
    const a = { x: Math.floor(de.at[0]), y: Math.floor(de.at[1]) };
    const b = { x: Math.floor(para.at[0]), y: Math.floor(para.at[1]) };
    const path = findPath(anda, a, b);
    const pts: [number, number][] = [[de.at[0], de.at[1]]];
    // Os ladrilhos do meio pelo centro; o último é a própria parada (que pode não ser o centro).
    for (let j = 0; j < path.length - 1; j++) pts.push([path[j].x + 0.5, path[j].y + 0.5]);
    pts.push([para.at[0], para.at[1]]);
    const acc = [0];
    for (let j = 1; j < pts.length; j++) acc.push(acc[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    pernas.push({ pts, acc, anda: (acc[acc.length - 1] / v) * 1000, fica: para.ms, pose: para.pose ?? 'stand' });
  }
  let ciclo = pernas.reduce((s, p) => s + p.anda + p.fica, 0);
  if (n.ciclo && n.ciclo > ciclo) {
    pernas[0].fica += n.ciclo - ciclo;
    ciclo = n.ciclo;
  }
  return { pernas, ciclo, fase: n.ciclo ? 0 : hashId(n.id) % Math.max(1, Math.round(ciclo)) };
}

/** Onde o NPC está, pela rotina, na hora `t` (ms). */
export function rotinaEm(n: Npc, t: number): NaRotina {
  let c = cache.get(n.id);
  if (!c) {
    c = montar(n);
    cache.set(n.id, c);
  }
  let r = (((t + c.fase) % c.ciclo) + c.ciclo) % c.ciclo;
  for (let i = 0; i < c.pernas.length; i++) {
    const p = c.pernas[i];
    if (r < p.anda) {
      const d = (r / p.anda) * p.acc[p.acc.length - 1];
      let j = 1;
      while (j < p.acc.length - 1 && p.acc[j] < d) j++;
      const [x0, y0] = p.pts[j - 1];
      const [x1, y1] = p.pts[j];
      const seg = p.acc[j] - p.acc[j - 1] || 1;
      const f = Math.min(1, Math.max(0, (d - p.acc[j - 1]) / seg));
      return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, dx: x1 - x0, dy: y1 - y0, andando: true, pose: 'stand', i };
    }
    r -= p.anda;
    if (r < p.fica) {
      const last = p.pts[p.pts.length - 1];
      const prev = p.pts[Math.max(0, p.pts.length - 2)];
      return { x: last[0], y: last[1], dx: last[0] - prev[0], dy: last[1] - prev[1], andando: false, pose: p.pose, i };
    }
    r -= p.fica;
  }
  const p = c.pernas[0];
  const last = p.pts[p.pts.length - 1];
  return { x: last[0], y: last[1], dx: 0, dy: 1, andando: false, pose: p.pose, i: 0 };
}

/**
 * Pontos molhados pela rotina na hora `t`: cada parada (menos a primeira, o descanso) fica molhada da chegada até
 * `dura` ms depois da saída. Função pura da hora, então todo aparelho vê a mesma poça sem trafegar nada.
 */
export function molhadosEm(n: Npc, t: number, dura: number): { x: number; y: number; ate: number }[] {
  let c = cache.get(n.id);
  if (!c) {
    c = montar(n);
    cache.set(n.id, c);
  }
  const r = (((t + c.fase) % c.ciclo) + c.ciclo) % c.ciclo;
  const out: { x: number; y: number; ate: number }[] = [];
  let acc = 0;
  for (let i = 0; i < c.pernas.length; i++) {
    const p = c.pernas[i];
    const chega = acc + p.anda;
    acc = chega + p.fica;
    if (i === 0) continue;
    const desde = (((r - chega) % c.ciclo) + c.ciclo) % c.ciclo;
    const ate = t - desde + p.fica + dura;
    // `ate > t` também segura o arredondamento: poça que seca agora não conta.
    if (desde < p.fica + dura && ate > t) {
      const last = p.pts[p.pts.length - 1];
      out.push({ x: last[0], y: last[1], ate });
    }
  }
  return out;
}

/** Duração do ciclo inteiro (para os testes). */
export function cicloDe(n: Npc): number {
  rotinaEm(n, 0);
  return cache.get(n.id)!.ciclo;
}
