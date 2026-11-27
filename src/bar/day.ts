/**
 * O "dia" do bar vira às 6 h de Brasília (UTC−3), sempre pela hora do servidor.
 * A mesma conta está nas regras do banco: início do dia = now − ((now − 32400000) % 86400000).
 */
export const DAY_MS = 86_400_000;
/** 6 h de Brasília = 9 h UTC. */
export const DAY_SHIFT_MS = 9 * 3_600_000;

/** Número do dia (ex.: "20783"). */
export function dayKey(t: number): string {
  return String(Math.floor((t - DAY_SHIFT_MS) / DAY_MS));
}

/** Hora em que o dia de `t` começou (mesma expressão das regras). */
export function startOfDay(t: number): number {
  return t - ((t - DAY_SHIFT_MS) % DAY_MS);
}

export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}
