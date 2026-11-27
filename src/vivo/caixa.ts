/**
 * Livro do caixa (Fatia 7): quanto dinheiro entra e sai por dia e de onde, para medir a economia antes de mexer em
 * preço ou teto (decisão do dono: o GFA fica sem teto, só medido). Guardado no aparelho de cada um, por jogador, nos
 * últimos 30 dias; o dia vira às 6 h de Brasília, como o resto do bar.
 */
import { dayKey } from '../bar/day';

export type Lado = 'e' | 's';
/** Um dia: entradas e saídas somadas por origem (chão, gfa, nome do item comprado...). */
export interface DiaCaixa {
  e: Record<string, number>;
  s: Record<string, number>;
}
export type Caixa = Record<string, DiaCaixa>;

export const DIAS_GUARDADOS = 30;
const KEY = (p: string) => `cruzadabotecos.caixa.v1.${p}`;

/** Lança `v` reais no lado `lado` com a origem dada; devolve o livro novo (puro, não muda o de entrada). */
export function lancar(c: Caixa, agora: number, lado: Lado, origem: string, v: number): Caixa {
  if (!(v > 0) || !Number.isFinite(v)) return c;
  const d = dayKey(agora);
  const dia: DiaCaixa = c[d] ? { e: { ...c[d].e }, s: { ...c[d].s } } : { e: {}, s: {} };
  dia[lado][origem] = (dia[lado][origem] ?? 0) + Math.round(v);
  const novo: Caixa = { ...c, [d]: dia };
  const dias = Object.keys(novo).sort((a, b) => Number(a) - Number(b));
  for (const k of dias.slice(0, Math.max(0, dias.length - DIAS_GUARDADOS))) delete novo[k];
  return novo;
}

const soma = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

export interface Resumo {
  hoje: { entrou: number; saiu: number; origens: [string, number][] };
  semana: { entrou: number; saiu: number; dias: number };
}

/** Hoje (com as origens das entradas, maior primeiro) e os últimos 7 dias. */
export function resumo(c: Caixa, agora: number): Resumo {
  const hoje = Number(dayKey(agora));
  const d = c[String(hoje)] ?? { e: {}, s: {} };
  let entrou = 0;
  let saiu = 0;
  let dias = 0;
  for (let k = hoje - 6; k <= hoje; k++) {
    const x = c[String(k)];
    if (!x) continue;
    dias++;
    entrou += soma(x.e);
    saiu += soma(x.s);
  }
  return {
    hoje: { entrou: soma(d.e), saiu: soma(d.s), origens: Object.entries(d.e).sort((a, b) => b[1] - a[1]) },
    semana: { entrou, saiu, dias },
  };
}

export function sanitizeCaixa(raw: unknown): Caixa {
  const out: Caixa = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{1,7}$/.test(k) || !v || typeof v !== 'object') continue;
    const dia: DiaCaixa = { e: {}, s: {} };
    for (const lado of ['e', 's'] as const) {
      const r = (v as Record<string, unknown>)[lado];
      if (!r || typeof r !== 'object') continue;
      for (const [o, n] of Object.entries(r as Record<string, unknown>)) if (/^[a-z0-9_-]{1,24}$/.test(o) && typeof n === 'number' && n > 0 && Number.isFinite(n)) dia[lado][o] = Math.round(n);
    }
    out[k] = dia;
  }
  return out;
}

export function carregarCaixa(p: string): Caixa {
  try {
    return sanitizeCaixa(JSON.parse(localStorage.getItem(KEY(p)) ?? '{}'));
  } catch {
    return {};
  }
}

export function salvarCaixa(p: string, c: Caixa) {
  try {
    localStorage.setItem(KEY(p), JSON.stringify(c));
  } catch {
    /* cheio ou bloqueado: o livro vale só nesta aba */
  }
}
