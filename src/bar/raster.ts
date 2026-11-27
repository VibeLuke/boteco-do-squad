/**
 * Rasterizador pixel-a-pixel (sem suavização), em memória, sem DOM: preenche polígonos por varredura amostrando
 * o centro de cada pixel. É o que deixa as diagonais 2:1 do isométrico em degrau limpo.
 */
export type RGBA = readonly [number, number, number, number];

export function hex(c: string, a = 255): RGBA {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), a];
}

export class Raster {
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly w: number;
  readonly h: number;
  // Campos explícitos (sem "parameter properties"): o Node roda este arquivo nos testes só tirando os tipos.
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  }

  set(x: number, y: number, c: RGBA) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (c[3] === 255) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = 255;
      return;
    }
    const a = c[3] / 255;
    this.data[i] = this.data[i] * (1 - a) + c[0] * a;
    this.data[i + 1] = this.data[i + 1] * (1 - a) + c[1] * a;
    this.data[i + 2] = this.data[i + 2] * (1 - a) + c[2] * a;
    this.data[i + 3] = Math.max(this.data[i + 3], c[3]);
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }

  /** Polígono por varredura (regra par-ímpar, amostra no centro do pixel). Devolve quantos pixels pintou. */
  poly(pts: ReadonlyArray<readonly [number, number]>, c: RGBA): number {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    let painted = 0;
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if (y0 === y1) continue;
        if ((sy >= y0 && sy < y1) || (sy >= y1 && sy < y0)) xs.push(x0 + ((sy - y0) * (x1 - x0)) / (y1 - y0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const from = Math.ceil(xs[k] - 0.5);
        const to = Math.floor(xs[k + 1] - 0.5);
        for (let x = from; x <= to; x++) {
          this.set(x, y, c);
          painted++;
        }
      }
    }
    return painted;
  }

  /** Losango centrado em (cx, cy), meia-largura hw e meia-altura hh. */
  diamond(cx: number, cy: number, hw: number, hh: number, c: RGBA): number {
    return this.poly(
      [
        [cx, cy - hh],
        [cx + hw, cy],
        [cx, cy + hh],
        [cx - hw, cy],
      ],
      c,
    );
  }

  /**
   * Caixa isométrica: base em losango centrado em (cx, cy) e altura h (px).
   * Cores: topo, face esquerda (mais clara) e face direita (mais escura).
   */
  box(cx: number, cy: number, hw: number, hh: number, h: number, top: RGBA, left: RGBA, right: RGBA) {
    this.poly(
      [
        [cx - hw, cy - h],
        [cx, cy + hh - h],
        [cx, cy + hh],
        [cx - hw, cy],
      ],
      left,
    );
    this.poly(
      [
        [cx, cy + hh - h],
        [cx + hw, cy - h],
        [cx + hw, cy],
        [cx, cy + hh],
      ],
      right,
    );
    this.diamond(cx, cy - h, hw, hh, top);
  }
}
