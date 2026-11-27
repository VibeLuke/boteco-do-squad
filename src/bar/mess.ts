/**
 * Bagunça que fica no cenário até a faxina das 6 h (Fase 2b). Funções puras; a gravação fica em presence.ts.
 *
 *   bar/mess/{cômodo}/{x-y}            = { d: caído?, by, t }    móvel derrubado ou levantado (1 por móvel)
 *   bar/poca/{cômodo}/{0..5}           = { x, y, by, seco, t }   poça de cerveja no chão (fila de 6 por cômodo)
 *   bar/molho/{cômodo}/{jogador}/{0..4} = { s: L|R, u, v, t }     molho de tomate na parede (5 por pessoa)
 *
 * Tudo vai junto com o carimbo de ritmo de 2 s (o mesmo do chat). Nada tem chave por dia: quem lê ignora o que
 * é de antes das 6 h, então a faxina acontece sozinha e o banco não cresce com os dias.
 * O que está caído continua ocupando o mesmo ladrilho: a grade de passagem não muda (os caminhos calculados em
 * dois aparelhos continuam iguais).
 */
import { isPlayerId, type PlayerId } from '../arena/sprites';
import { startOfDay } from './day';
import type { Tile } from './iso';
import { WALK_SPEED } from './motion';
import type { PropKind } from './room';

/** Móveis que dá para derrubar (o resto é pesado ou está pregado). */
export const KNOCKABLE: PropKind[] = ['stool', 'table', 'plant', 'barrel'];
export const POCA_SLOTS = 6;
export const MOLHO_SLOTS = 5;
/** Espera de cada bagunça no aparelho (o servidor ainda segura 2 s entre quaisquer duas ações). */
export const MESS_CD = { derrubar: 5_000, molho: 10_000, poca: 30_000, secar: 3_000 } as const;
/** Alcance para derrubar ou levantar um móvel, em ladrilhos. */
export const REACH = 1.6;
/** Escorregão: começa um pouco antes de pisar na poça e dura 0,7 s depois. */
export const SLIP_BEFORE_MS = 120;
export const SLIP_MS = 700;
/** Molho voando até a parede. */
export const SAUCE_FLIGHT_MS = 500;

export const propKey = (x: number, y: number) => `${x}-${y}`;

export interface PropState {
  d: boolean;
  by: PlayerId;
  t: number;
}
export interface Poca {
  slot: number;
  x: number;
  y: number;
  by: PlayerId;
  t: number;
}
export interface Molho {
  p: PlayerId;
  slot: number;
  s: 'L' | 'R';
  u: number;
  v: number;
  t: number;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** Móveis caídos hoje, por cômodo: { salao: { "3-2": {...} } }. Levantado (d: false) some da lista. */
export function sanitizeProps(raw: unknown, now: number): Record<string, Record<string, PropState>> {
  const out: Record<string, Record<string, PropState>> = {};
  const sod = startOfDay(now);
  for (const [room, props] of Object.entries(obj(raw))) {
    if (!/^[a-z]{1,16}$/.test(room)) continue;
    for (const [k, v] of Object.entries(obj(props))) {
      const e = obj(v);
      if (!/^[0-9]{1,2}-[0-9]{1,2}$/.test(k) || e.d !== true || !isPlayerId(e.by) || typeof e.t !== 'number' || e.t < sod) continue;
      (out[room] ??= {})[k] = { d: true, by: e.by, t: e.t };
    }
  }
  return out;
}

export function isDown(props: Record<string, Record<string, PropState>>, room: string, x: number, y: number): boolean {
  return !!props[room]?.[propKey(x, y)];
}

/** Poças de hoje que ninguém secou, por cômodo. */
export function sanitizePocas(raw: unknown, now: number): Record<string, Poca[]> {
  const out: Record<string, Poca[]> = {};
  const sod = startOfDay(now);
  for (const [room, slots] of Object.entries(obj(raw))) {
    if (!/^[a-z]{1,16}$/.test(room)) continue;
    for (const [k, v] of Object.entries(obj(slots))) {
      const e = obj(v);
      const slot = Number(k);
      if (!int(slot, 0, POCA_SLOTS - 1) || e.seco !== false || !int(e.x, 0, 63) || !int(e.y, 0, 63)) continue;
      if (!isPlayerId(e.by) || typeof e.t !== 'number' || e.t < sod) continue;
      (out[room] ??= []).push({ slot, x: e.x as number, y: e.y as number, by: e.by, t: e.t });
    }
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.t - b.t);
  return out;
}

export function pocaAt(pocas: Poca[] | undefined, x: number, y: number): Poca | undefined {
  return pocas?.find((p) => p.x === x && p.y === y);
}

/** Posição para uma poça nova: a vazia, senão a mais antiga (seca ou de ontem contam como vazia). */
export function nextPocaSlot(raw: unknown, room: string, now: number): number {
  const live = sanitizePocas(raw, now)[room] ?? [];
  for (let i = 0; i < POCA_SLOTS; i++) if (!live.some((p) => p.slot === i)) return i;
  return live[0].slot;
}

/** Molho de hoje na parede, por cômodo. */
export function sanitizeMolho(raw: unknown, now: number): Record<string, Molho[]> {
  const out: Record<string, Molho[]> = {};
  const sod = startOfDay(now);
  for (const [room, players] of Object.entries(obj(raw))) {
    if (!/^[a-z]{1,16}$/.test(room)) continue;
    for (const [p, slots] of Object.entries(obj(players))) {
      if (!isPlayerId(p)) continue;
      for (const [k, v] of Object.entries(obj(slots))) {
        const e = obj(v);
        const slot = Number(k);
        if (!int(slot, 0, MOLHO_SLOTS - 1) || (e.s !== 'L' && e.s !== 'R') || !int(e.u, 0, 400) || !int(e.v, 0, 80)) continue;
        if (typeof e.t !== 'number' || e.t < sod) continue;
        (out[room] ??= []).push({ p, slot, s: e.s, u: e.u as number, v: e.v as number, t: e.t });
      }
    }
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.t - b.t);
  return out;
}

/** Posição para o próximo molho de alguém: a vazia (ou de ontem), senão a mais antiga. */
export function nextMolhoSlot(raw: unknown, room: string, p: PlayerId, now: number): number {
  const mine = (sanitizeMolho(raw, now)[room] ?? []).filter((m) => m.p === p);
  for (let i = 0; i < MOLHO_SLOTS; i++) if (!mine.some((m) => m.slot === i)) return i;
  return mine[0].slot;
}

/**
 * Quando quem anda escorrega: em cada ladrilho do caminho que tem poça, de um pouco antes de pisar até 0,7 s
 * depois (em ms contados desde o começo do caminho, como positionAt). Só visual: a chegada não atrasa, então os
 * dois aparelhos continuam com a mesma posição.
 */
export function slipWindows(from: Tile, path: Tile[], pocas: Tile[], speed = WALK_SPEED): [number, number][] {
  if (!pocas.length) return [];
  const wet = new Set(pocas.map((p) => propKey(p.x, p.y)));
  const out: [number, number][] = [];
  let px = from.x;
  let py = from.y;
  let dist = 0;
  for (const t of path) {
    dist += px !== t.x && py !== t.y ? Math.SQRT2 : 1;
    px = t.x;
    py = t.y;
    if (wet.has(propKey(t.x, t.y))) {
      const at = (dist / speed) * 1000;
      out.push([at - SLIP_BEFORE_MS, at + SLIP_MS]);
    }
  }
  return out;
}

export function slippingAt(windows: [number, number][], elapsedMs: number): number | null {
  for (const [a, b] of windows) if (elapsedMs >= a && elapsedMs < b) return (elapsedMs - a) / (b - a);
  return null;
}
