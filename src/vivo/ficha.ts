/**
 * Ficha dos procurados: quantos nocautes cada amigo já causou (NPCs, amigos e atropelos), desde sempre.
 * Fica no aparelho e no banco (`bar/ficha/{jogador}` = { k, t }); a regra só deixa subir até +10 por gravação, então
 * quem acumulou muito sem rede manda aos poucos.
 */
import type { PlayerId } from '../arena/sprites';
import { IDS } from '../turma/index';

export const ORDEM_FICHA: readonly PlayerId[] = IDS;
/** Quanto a regra deixa subir por gravação. */
export const PASSO_FICHA = 10;
/** Espaço mínimo entre gravações (a regra pede 2 s). */
export const ESPERA_FICHA_MS = 2100;

const inteiro = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** Lê o nó `ficha` do banco: jogador → total (lixo vira 0). */
export function sanitizeFicha(raw: unknown): Record<PlayerId, number> {
  const out = Object.fromEntries(ORDEM_FICHA.map((p) => [p, 0])) as Record<PlayerId, number>;
  if (!raw || typeof raw !== 'object') return out;
  for (const p of ORDEM_FICHA) {
    const e = (raw as Record<string, unknown>)[p];
    if (e && typeof e === 'object') out[p] = inteiro((e as { k?: unknown }).k);
  }
  return out;
}

/** O próximo valor a gravar (no máximo +PASSO_FICHA acima do banco), ou null se o banco já está em dia. */
export function proximoEnvio(local: number, banco: number): number | null {
  if (local <= banco) return null;
  return Math.min(local, banco + PASSO_FICHA);
}

/** O mais perigoso (maior total, desempate pela ordem fixa); ninguém com 0 é "o mais perigoso". */
export function maisPerigoso(f: Record<PlayerId, number>): PlayerId | null {
  let melhor: PlayerId | null = null;
  for (const p of ORDEM_FICHA) if (f[p] > 0 && (!melhor || f[p] > f[melhor])) melhor = p;
  return melhor;
}
