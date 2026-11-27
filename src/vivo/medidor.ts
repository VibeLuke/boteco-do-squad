/**
 * Medidor de quadro (Fatia 7): quadros por segundo, quanto custa cada quadro (simulação + rede + desenho) e só o
 * desenho, com mediana e p95 dos últimos ~2 s. Serve para a sessão nos celulares de verdade. Liga com `?medidor=1` na
 * URL (fica ligado no aparelho; `?medidor=0` desliga) ou com F2 no teclado.
 */
const KEY = 'cruzadabotecos.medidor.v1';
const N = 120;

export interface ResumoQuadro {
  qps: number;
  quadroP50: number;
  quadroP95: number;
  desenhoP95: number;
  piorIntervalo: number;
  /** Fração dos quadros com intervalo acima de 34 ms (abaixo de ~30 qps naquele quadro). */
  lentos: number;
  n: number;
}

function pct(v: number[], p: number): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))];
}

export class Medidor {
  private intervalos: number[] = [];
  private quadros: number[] = [];
  private desenhos: number[] = [];

  /** Um quadro: intervalo desde o anterior, custo total e custo do desenho (ms). */
  anotar(intervalo: number, quadro: number, desenho: number) {
    if (!(intervalo > 0) || intervalo > 1000) return; // aba escondida ou pausa: não é quadro de verdade
    this.intervalos.push(intervalo);
    this.quadros.push(quadro);
    this.desenhos.push(desenho);
    if (this.intervalos.length > N) {
      this.intervalos.shift();
      this.quadros.shift();
      this.desenhos.shift();
    }
  }

  resumo(): ResumoQuadro {
    const n = this.intervalos.length;
    const media = n ? this.intervalos.reduce((a, b) => a + b, 0) / n : 0;
    return {
      qps: media ? 1000 / media : 0,
      quadroP50: pct(this.quadros, 0.5),
      quadroP95: pct(this.quadros, 0.95),
      desenhoP95: pct(this.desenhos, 0.95),
      piorIntervalo: n ? Math.max(...this.intervalos) : 0,
      lentos: n ? this.intervalos.filter((x) => x > 34).length / n : 0,
      n,
    };
  }
}

export function textoMedidor(r: ResumoQuadro): string {
  const f = (x: number) => x.toFixed(1).replace('.', ',');
  return `${Math.round(r.qps)} qps · quadro ${f(r.quadroP50)}/${f(r.quadroP95)} ms · desenho p95 ${f(r.desenhoP95)} ms · pior ${Math.round(r.piorIntervalo)} ms · lentos ${Math.round(r.lentos * 100)}%`;
}

/** Ligado? Lê `?medidor=1|0` (e guarda no aparelho) ou o que ficou guardado. */
export function medidorLigado(busca: string = typeof location === 'undefined' ? '' : location.search): boolean {
  try {
    const q = new URLSearchParams(busca).get('medidor');
    if (q === '1') localStorage.setItem(KEY, '1');
    if (q === '0') localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function guardarMedidor(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
}
