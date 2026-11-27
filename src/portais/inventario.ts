/**
 * Inventário dos portais (Fatia 13): prêmios que só crescem (união de conjuntos), Pó de Dimensão (ganho e gasto que
 * só crescem, saldo = ganho − gasto), pity e contas do dia. Fica no aparelho e vai ao banco (o banco junta pelo maior,
 * como a carteira), para trocar de aparelho sem perder nada.
 */
import { PITY_ZERO, PO_PRECO, PORTAIS_DO_DIA, PREMIOS, premioPorId, type IdPortal, type Pity } from './portal';

export interface Inventario {
  itens: string[];
  po: { g: number; s: number };
  pity: Pity;
  /** Runs com sorteio já usadas hoje, por portal (o dia do bar). */
  runs: { dia: string; n: Partial<Record<IdPortal, number>> };
  /** Quando entrou por último em cada portal (espera de 5 min). */
  ultima: Partial<Record<IdPortal, number>>;
}

export const INVENTARIO_VAZIO: Inventario = { itens: [], po: { g: 0, s: 0 }, pity: PITY_ZERO, runs: { dia: '', n: {} }, ultima: {} };

const inteiro = (v: unknown, max = 1e6) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);

/** Só passa o que existe (o armazenamento pode ter lixo ou versão antiga). */
export function limparInventario(raw: unknown): Inventario {
  if (!raw || typeof raw !== 'object') return { ...INVENTARIO_VAZIO, runs: { dia: '', n: {} }, ultima: {} };
  const r = raw as Record<string, unknown>;
  const itens = Array.isArray(r.itens) ? [...new Set(r.itens.filter((x): x is string => typeof x === 'string' && !!premioPorId(x)))] : [];
  const po = (r.po && typeof r.po === 'object' ? r.po : {}) as Record<string, unknown>;
  const pity = (r.pity && typeof r.pity === 'object' ? r.pity : {}) as Record<string, unknown>;
  const runs = (r.runs && typeof r.runs === 'object' ? r.runs : {}) as Record<string, unknown>;
  const n = (runs.n && typeof runs.n === 'object' ? runs.n : {}) as Record<string, unknown>;
  const ultima = (r.ultima && typeof r.ultima === 'object' ? r.ultima : {}) as Record<string, unknown>;
  return {
    itens,
    po: { g: inteiro(po.g), s: Math.min(inteiro(po.g), inteiro(po.s)) },
    pity: { semRaro: inteiro(pity.semRaro, 1000), semLendario: inteiro(pity.semLendario, 1000) },
    // Uma conta por portal da lista (portal novo entra sozinho; nenhum some ao gravar).
    runs: { dia: typeof runs.dia === 'string' ? runs.dia : '', n: Object.fromEntries(PORTAIS_DO_DIA.map((p) => [p, inteiro(n[p], 1000)])) },
    ultima: Object.fromEntries(PORTAIS_DO_DIA.map((p) => [p, inteiro(ultima[p], 1e15)])),
  };
}

/** Junta dois inventários (aparelho e banco): itens unidos, contadores pelo maior. */
export function juntar(a: Inventario, b: Inventario): Inventario {
  const g = Math.max(a.po.g, b.po.g);
  return limparInventario({
    itens: [...new Set([...a.itens, ...b.itens])],
    po: { g, s: Math.min(g, Math.max(a.po.s, b.po.s)) },
    pity: a.pity.semRaro + a.pity.semLendario >= b.pity.semRaro + b.pity.semLendario ? a.pity : b.pity,
    runs: a.runs.dia >= b.runs.dia ? a.runs : b.runs,
    ultima: Object.fromEntries(PORTAIS_DO_DIA.map((p) => [p, Math.max(a.ultima[p] ?? 0, b.ultima[p] ?? 0)])),
  });
}

export const saldoPo = (inv: Inventario) => inv.po.g - inv.po.s;

/** Runs com sorteio já usadas hoje no portal. */
export const runsHoje = (inv: Inventario, dia: string, portal: IdPortal) => (inv.runs.dia === dia ? (inv.runs.n[portal] ?? 0) : 0);

/** Comprar com Pó um prêmio que falta (do portal dele). */
export function comprarComPo(inv: Inventario, id: string): Inventario | null {
  if (!premioPorId(id) || inv.itens.includes(id) || saldoPo(inv) < PO_PRECO) return null;
  return { ...inv, itens: [...inv.itens, id], po: { g: inv.po.g, s: inv.po.s + PO_PRECO } };
}

/** Cores de visual liberadas (as de prêmio só para quem tem). */
export function coresLiberadas(inv: Inventario): Set<string> {
  return new Set(PREMIOS.filter((p) => inv.itens.includes(p.id)).map((p) => p.cor));
}

const chave = (jogador: string) => `cruzadabotecos.portais.v1.${jogador}`;
export function carregarInventario(jogador: string): Inventario {
  try {
    return limparInventario(JSON.parse(localStorage.getItem(chave(jogador)) ?? 'null'));
  } catch {
    return limparInventario(null);
  }
}
export function salvarInventario(jogador: string, inv: Inventario) {
  localStorage.setItem(chave(jogador), JSON.stringify(limparInventario(inv)));
}
