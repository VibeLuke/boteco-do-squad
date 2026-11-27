/**
 * Movimento e clarões (Fatia 7).
 * - Preferência salva no aparelho: 'sistema' (padrão: obedece ao "reduzir movimento" do celular ou do PC), 'cheio' ou
 *   'reduzido'. Reduzido = tremor de tela zero e clarão trocado por um brilho suave.
 * - Limitador de clarões: no máximo 3 clarões de tela cheia começam a cada 1 s (WCAG 2.3.1, "três clarões"); os que
 *   passarem disso são cortados. Vale para o bar inteiro (rajada, poderes) e para o GFA.
 */
export type PrefMovimento = 'sistema' | 'cheio' | 'reduzido';
export const PREFS_MOVIMENTO: readonly PrefMovimento[] = ['sistema', 'reduzido', 'cheio'];
const KEY = 'cruzadabotecos.movimento.v1';

export function lerPrefMovimento(): PrefMovimento {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'cheio' || v === 'reduzido' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function salvarPrefMovimento(p: PrefMovimento) {
  try {
    if (p === 'sistema') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
}

export function sistemaPedeReduzido(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A conta pura: a preferência manda; em 'sistema', vale o que o aparelho pede. */
export function movimentoReduzido(pref: PrefMovimento = lerPrefMovimento(), sistema: boolean = sistemaPedeReduzido()): boolean {
  return pref === 'reduzido' || (pref === 'sistema' && sistema);
}

/** Próxima preferência do botão do menu (gira: sistema → reduzido → cheio → sistema). */
export function proximaPref(p: PrefMovimento): PrefMovimento {
  return PREFS_MOVIMENTO[(PREFS_MOVIMENTO.indexOf(p) + 1) % PREFS_MOVIMENTO.length];
}

export const MAX_CLAROES_POR_S = 3;
/** No modo reduzido o clarão vira um brilho: no máximo esta opacidade. */
export const BRILHO_REDUZIDO = 0.18;

/**
 * Limitador de clarões. Cada clarão tem uma chave (o disparo que o causou): na primeira vez que a chave aparece ele é
 * contado; se já começaram MAX_CLAROES_POR_S na janela de 1 s, esse fica cortado (fator 0) até o fim.
 */
export class LimiteClarao {
  private inicios: number[] = [];
  private decisao = new Map<string, number>();

  /** Fator (0 a 1) que multiplica a opacidade do clarão `chave` visto agora (ms). */
  fator(chave: string, agora: number): number {
    let f = this.decisao.get(chave);
    if (f === undefined) {
      this.inicios = this.inicios.filter((t) => agora - t < 1000);
      f = this.inicios.length < MAX_CLAROES_POR_S ? 1 : 0;
      if (f) this.inicios.push(agora);
      this.decisao.set(chave, f);
      if (this.decisao.size > 200) this.decisao.delete(this.decisao.keys().next().value as string);
    }
    return f;
  }

  /** Opacidade final do clarão: corta o excesso e, no modo reduzido, vira brilho suave. */
  opacidade(chave: string, agora: number, alpha: number, reduzido: boolean): number {
    const a = alpha * this.fator(chave, agora);
    return reduzido ? Math.min(a, BRILHO_REDUZIDO) : a;
  }
}
