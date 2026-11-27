/**
 * Fatia 8: marcas novas no chão (gravadas uma vez na camada de manchas, sem custo nos quadros seguintes).
 * Funções puras: devolvem os pixels relativos ao centro, com a semente fixa (o mesmo desenho em todo aparelho).
 *
 * - Queimado: mancha escura irregular, mais forte no meio (pinga, raio, torresmo).
 * - Rachadura: 3 a 5 trincas tortas que saem do centro e se dividem (pagode, torresmo, marreta).
 * - Poça em degrau: poça com borda escura, miolo e um brilho de 1 px no alto, em tons duros (nocaute, chope).
 * - Pegada: quem pisa na poça deixa pegadas que vão sumindo em 8 passos.
 */

/** Um pixel da marca: deslocamento do centro, tom (0 = escuro … 2 = claro) e opacidade 0 a 255. */
export interface PixelMarca {
  dx: number;
  dy: number;
  tom: 0 | 1 | 2;
  a: number;
}

/** Sorteio com semente (mulberry32). */
export function sorteio(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Queimado de raio `r` px (achatado na perspectiva do chão: metade da altura). */
export function queimado(r: number, semente: number): PixelMarca[] {
  const rnd = sorteio(semente);
  // Borda irregular: 12 raios sorteados e interpolados em volta.
  const bordas = Array.from({ length: 12 }, () => 0.7 + rnd() * 0.45);
  const out: PixelMarca[] = [];
  const R = Math.ceil(r * 1.2);
  for (let y = -Math.ceil(R / 2); y <= Math.ceil(R / 2); y++)
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y * 2) / r;
      const ang = ((Math.atan2(y * 2, x) / (Math.PI * 2)) * 12 + 12) % 12;
      const i = Math.floor(ang);
      const f = ang - i;
      const borda = bordas[i] * (1 - f) + bordas[(i + 1) % 12] * f;
      if (d > borda) continue;
      const k = d / borda;
      // Furinhos perto da borda (a fuligem não é lisa).
      if (k > 0.7 && rnd() < 0.35) continue;
      out.push({ dx: x, dy: y, tom: k < 0.45 ? 0 : 1, a: Math.round(210 - 120 * k) });
    }
  return out;
}

/** Rachadura de raio `r` px: trincas em passos de 1 px, tortas, que às vezes se dividem. */
export function rachadura(r: number, semente: number): PixelMarca[] {
  const rnd = sorteio(semente);
  const vistos = new Set<string>();
  const out: PixelMarca[] = [];
  const marca = (x: number, y: number, tom: 0 | 1, a: number) => {
    const k = `${x},${y}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    out.push({ dx: x, dy: y, tom, a });
  };
  const trinca = (x0: number, y0: number, ang: number, len: number, prof: number) => {
    let x = x0;
    let y = y0;
    for (let i = 0; i < len; i++) {
      ang += (rnd() - 0.5) * 0.9;
      x += Math.cos(ang);
      y += Math.sin(ang) * 0.5;
      const px = Math.round(x);
      const py = Math.round(y);
      marca(px, py, 0, 220 - Math.round((i / len) * 90));
      // Lábio claro de 1 px embaixo da trinca (a luz pega na borda quebrada).
      if (i % 2 === 0) marca(px, py + 1, 1, 90);
      if (prof < 2 && i > 2 && rnd() < 0.12) trinca(x, y, ang + (rnd() < 0.5 ? -0.8 : 0.8), Math.round((len - i) * 0.6), prof + 1);
    }
  };
  const n = 3 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) trinca(0, 0, (k / n) * Math.PI * 2 + rnd() * 0.8, Math.round(r * (0.6 + rnd() * 0.4)), 0);
  marca(0, 0, 0, 230);
  return out;
}

/** Poça em degrau de raio `r` px: borda escura (tom 0), miolo (1) e brilho de 1 px no alto à esquerda (2). */
export function pocaDegrau(r: number, semente: number): PixelMarca[] {
  const rnd = sorteio(semente);
  // Poça é uma soma de 3 bolhas (não um círculo perfeito).
  const bolhas = [
    [0, 0, 1],
    [(rnd() - 0.5) * r, (rnd() - 0.5) * r * 0.5, 0.55 + rnd() * 0.25],
    [(rnd() - 0.5) * r, (rnd() - 0.5) * r * 0.5, 0.45 + rnd() * 0.25],
  ];
  // Achatada na perspectiva do chão, mas não tanto quanto a elipse da sombra (poça baixa demais vira risco).
  const dentro = (x: number, y: number) => bolhas.some(([bx, by, br]) => Math.hypot(x - bx, (y - by) * 1.6) <= r * br);
  const out: PixelMarca[] = [];
  const R = Math.ceil(r * 1.6);
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      if (!dentro(x, y)) continue;
      const borda = !dentro(x - 1, y) || !dentro(x + 1, y) || !dentro(x, y - 1) || !dentro(x, y + 1);
      out.push({ dx: x, dy: y, tom: borda ? 0 : 1, a: borda ? 235 : 215 });
    }
  // Brilho: o pixel mais alto à esquerda do miolo, e o vizinho dele.
  const miolo = out.filter((p) => p.tom === 1).sort((a, b) => a.dy - b.dy || a.dx - b.dx);
  for (const p of miolo.slice(0, 2)) {
    p.tom = 2;
    p.a = 200;
  }
  return out;
}

/** Quantos passos a pegada dura depois de pisar na poça. */
export const PASSOS_PEGADA = 8;

/** Opacidade da pegada no passo `k` depois de sair da poça (0 = some). */
export function alfaPegada(k: number): number {
  if (!(k >= 0) || k >= PASSOS_PEGADA) return 0;
  return Math.round(190 * (1 - k / PASSOS_PEGADA));
}

/** Pisou na poça? Elipse achatada como a do chão (`r` na largura, `r/2` na altura). */
export function naPoca(px: number, py: number, poca: { x: number; y: number; r: number }): boolean {
  return Math.hypot(px - poca.x, (py - poca.y) * 2) <= poca.r;
}
