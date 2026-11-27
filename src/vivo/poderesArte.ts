/**
 * Desenho dos 10 poderes novos (Fatia 6) no canvas do bar, todo feito à mão em código (nada de sprite com dono).
 * Cada forma tem o seu efeito, nas mesmas horas que o motor usa para acertar (`quando`): tampinhas caindo, ondas do
 * arroto, o redemoinho, a onda de chope, o anel e as rachaduras do pagode, os raios, o meteoro, o garçom fantasma, a
 * bola de fogo e o ímã. O que acontece uma vez só (estouro, faíscas) é marcado por disparo para não repetir.
 */
import { telaDe } from './arte';
import { type Zona } from './mapa';
import { FOGO_RAIO, IMA_PUXA, PODER, centroFuracao, vooPinga, type Disparo, type Poder } from './poderes';

export interface PalcoPoder {
  lc: CanvasRenderingContext2D;
  z: Zona;
  /** Canto da câmera (tela lógica) e o tamanho da vista. */
  cx: number;
  cy: number;
  vw: number;
  vh: number;
  /** Hora do mundo (ms) e do relógio (ms, para tremer). */
  t: number;
  agora: number;
  posDe: (id: string) => { x: number; y: number } | null;
  espirrar: (x: number, y: number, alt: number, dx: number, dy: number, n: number, cores: readonly string[], forca?: number, mancha?: boolean, tam?: number) => void;
  onda: (x: number, y: number, raio: number, cor: string, atraso?: number) => void;
  texto: (x: number, y: number, texto: string, cor: string) => void;
  tremer: (k: number) => void;
  /** Opacidade final de um clarão de tela cheia (limite de 3 por segundo e modo reduzido); `chave` = qual clarão. */
  clarao: (chave: string, alpha: number) => number;
}

const feitos = new WeakMap<object, Set<string>>();
/** Verdadeiro só na primeira vez que `chave` acontece neste disparo. */
function uma(d: object, chave: string): boolean {
  let s = feitos.get(d);
  if (!s) feitos.set(d, (s = new Set()));
  if (s.has(chave)) return false;
  s.add(chave);
  return true;
}

function rnd(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (h: string, a: number) => {
  const [r, g, b] = rgb(h);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

/** Cores da carga (luz em volta, halo da esfera, esfera, miolo, faíscas, raiozinhos) de cada poder. */
export function coresCarga(tipo: Poder): { luz: string; halo: string; corpo: string; miolo: string; faiscas: string[]; raio: string } {
  if (tipo === 'rajada') return { luz: '#feae34', halo: '#ff4fb0', corpo: '#feae34', miolo: '#fee761', faiscas: ['#fee761', '#ffffff', '#ff4fb0', '#feae34'], raio: '#2ce8f5' };
  const [a, b, c] = PODER[tipo].cores;
  return { luz: b, halo: c, corpo: b, miolo: a, faiscas: [a, '#ffffff', b, c], raio: a };
}
export { rgba as rgbaDe };

export function desenharPoder(p: PalcoPoder, d: Disparo) {
  const def = PODER[d.tipo];
  const vida = p.t - d.t0;
  if (vida < 0 || vida > def.dura + 600) return;
  const { lc, z, cx, cy, agora } = p;
  const [c0, c1, c2] = def.cores;
  const fim = vida <= def.dura ? 1 : Math.max(0, 1 - (vida - def.dura) / 600);
  const S = (x: number, y: number) => {
    const q = telaDe(x, y, z);
    return { x: q.x - cx, y: q.y - cy };
  };
  /** Contorno de um círculo do chão (no mundo) na tela. */
  const anel = (x: number, y: number, r: number, cor: string, larg: number, alpha: number, fill = false) => {
    if (r <= 0 || alpha <= 0) return;
    lc.globalAlpha = Math.min(1, alpha);
    lc.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const s = S(x + Math.cos(a) * r, y + Math.sin(a) * r);
      if (i === 0) lc.moveTo(s.x, s.y);
      else lc.lineTo(s.x, s.y);
    }
    if (fill) {
      lc.fillStyle = cor;
      lc.fill();
    } else {
      lc.strokeStyle = cor;
      lc.lineWidth = larg;
      lc.stroke();
    }
    lc.globalAlpha = 1;
  };
  const bola = (x: number, y: number, r: number, cor: string, alpha = 1) => {
    if (r <= 0) return;
    lc.globalAlpha = alpha;
    lc.fillStyle = cor;
    lc.beginPath();
    lc.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2);
    lc.fill();
    lc.globalAlpha = 1;
  };
  const clarao = (cor: string, k: number, qual: string) => {
    const a = p.clarao(`${d.de}:${d.t0}:${qual}`, k);
    if (a <= 0) return;
    lc.fillStyle = rgba(cor, a);
    lc.fillRect(0, 0, p.vw, p.vh);
  };
  const o = S(d.x, d.y);
  const r = rnd(d.t0 ^ (d.tipo.charCodeAt(0) * 131));

  switch (def.forma) {
    case 'circulo': {
      // Tampinhas caindo do céu em volta (cada uma na sua hora), quicando e ficando no chão.
      const R = def.p.raio!;
      if (vida < def.dura) anel(d.x, d.y, R, c1, 1, 0.25 + 0.15 * Math.sin(agora / 90));
      for (let i = 0; i < 40; i++) {
        const a = r() * Math.PI * 2;
        const dist = Math.sqrt(r()) * R;
        const ti = 200 + r() * 1400;
        const s = S(d.x + Math.cos(a) * dist, d.y + Math.sin(a) * dist);
        const u = vida - ti;
        if (u < -260) continue;
        const alt = u < 0 ? (-u / 260) * 110 : Math.max(0, Math.sin(Math.min(1, u / 180) * Math.PI) * 6 * (u < 180 ? 1 : 0));
        const al = fim;
        lc.globalAlpha = al;
        lc.fillStyle = c2;
        lc.fillRect(Math.round(s.x - 2), Math.round(s.y - 2 - alt), 5, 2);
        lc.fillStyle = c1;
        lc.fillRect(Math.round(s.x - 1), Math.round(s.y - 3 - alt), 3, 1);
        lc.fillStyle = c0;
        lc.fillRect(Math.round(s.x), Math.round(s.y - 3 - alt), 1, 1);
        lc.globalAlpha = 1;
        if (u >= 0 && uma(d, `t${i}`)) p.espirrar(s.x + cx, s.y + cy, 2, 0, -1, 2, [c0, '#ffffff'], 0.8, false, 1);
      }
      break;
    }
    case 'cone': {
      // Três frentes de pressão saindo da boca, abrindo no ângulo do cone, e o bafo verde.
      const A = def.p.meioAngulo!;
      const base = Math.atan2(d.fy, d.fx);
      if (vida < 60 && uma(d, 'ini')) p.tremer(0.35);
      lc.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const rr = ((vida - k * 90) / 1000) * def.p.vel!;
        if (rr <= 0.2 || rr > def.p.alcance!) continue;
        const al = (1 - rr / def.p.alcance!) * fim;
        for (const [cor, w] of [[c2, 4], [c1, 2], [c0, 1]] as const) {
          lc.globalAlpha = al;
          lc.strokeStyle = cor;
          lc.lineWidth = w;
          lc.beginPath();
          for (let j = 0; j <= 12; j++) {
            const a = base - A + (j / 12) * A * 2;
            const s = S(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr);
            if (j === 0) lc.moveTo(s.x, s.y - 14);
            else lc.lineTo(s.x, s.y - 14);
          }
          lc.stroke();
        }
      }
      lc.globalAlpha = 1;
      lc.globalCompositeOperation = 'source-over';
      if (vida < def.dura && Math.random() < 0.6) {
        const a = base + (Math.random() * 2 - 1) * A;
        const rr = Math.random() * Math.min(def.p.alcance!, (vida / 1000) * def.p.vel!);
        const s = S(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr);
        p.espirrar(s.x + cx, s.y + cy, 14, d.fx, d.fy, 2, [c1, c2], 0.8, false, 2);
      }
      break;
    }
    case 'tornado': {
      // Funil de guardanapo girando que anda reto; guardanapos voando em volta e poeira no pé.
      const c = centroFuracao(d, Math.min(vida, def.dura));
      const s = S(c.x, c.y);
      const al = fim;
      for (let j = 0; j < 11; j++) {
        const h = j * 7;
        const rr = 4 + j * 1.9;
        const dx = Math.sin(agora / 85 + j * 0.7) * (1 + j * 0.4);
        lc.globalAlpha = al * (0.45 + 0.4 * (j % 2));
        lc.strokeStyle = j % 2 ? c1 : c2;
        lc.lineWidth = 2;
        lc.beginPath();
        lc.ellipse(Math.round(s.x + dx), Math.round(s.y - h), rr, rr * 0.32, 0, 0, Math.PI * 2);
        lc.stroke();
      }
      for (let i = 0; i < 16; i++) {
        const a = (agora / 110) * (1 + (i % 3) * 0.35) + i * 1.7;
        const rr = 6 + (i % 5) * 3.2;
        const h = (i * 9 + agora / 14) % 74;
        lc.globalAlpha = al;
        lc.fillStyle = i % 4 ? c0 : c1;
        const fr = Math.cos(a) > 0;
        lc.fillRect(Math.round(s.x + Math.cos(a) * (rr + h * 0.2)), Math.round(s.y - h + Math.sin(a) * rr * 0.3), fr ? 3 : 1, 2);
      }
      lc.globalAlpha = 1;
      if (vida < def.dura && Math.random() < 0.5) p.espirrar(s.x + cx, s.y + cy, 1, Math.random() - 0.5, -0.5, 2, ['#8b9bb4', '#c0cbdc'], 0.8, false, 1);
      break;
    }
    case 'onda': {
      // Onda de chope: corpo âmbar, crista de espuma na frente, respingos.
      const L = def.p.largura!;
      const f = Math.min(d.len, (vida / 1000) * def.p.vel!);
      const px = -d.fy;
      const py = d.fx;
      const tras = Math.max(0, f - 3.2);
      const quad = (a: number, b: number, cor: string, alpha: number, alt: number) => {
        const p1 = S(d.x + d.fx * a + px * L, d.y + d.fy * a + py * L);
        const p2 = S(d.x + d.fx * b + px * L, d.y + d.fy * b + py * L);
        const p3 = S(d.x + d.fx * b - px * L, d.y + d.fy * b - py * L);
        const p4 = S(d.x + d.fx * a - px * L, d.y + d.fy * a - py * L);
        lc.globalAlpha = alpha;
        lc.fillStyle = cor;
        lc.beginPath();
        lc.moveTo(p1.x, p1.y - alt);
        lc.lineTo(p2.x, p2.y - alt);
        lc.lineTo(p3.x, p3.y - alt);
        lc.lineTo(p4.x, p4.y - alt);
        lc.closePath();
        lc.fill();
        lc.globalAlpha = 1;
      };
      quad(Math.max(0, f - 6), tras, c2, 0.3 * fim, 0);
      quad(tras, f, c1, 0.62 * fim, 2);
      for (let i = -8; i <= 8; i++) {
        const w = (i / 8) * L;
        const s = S(d.x + d.fx * f + px * w, d.y + d.fy * f + py * w);
        const bob = Math.sin(agora / 70 + i) * 2;
        bola(s.x, s.y - 9 + bob, 4 + (i & 1), c0, fim);
        bola(s.x - 1, s.y - 11 + bob, 2, '#ffffff', fim);
      }
      if (vida < def.dura && Math.random() < 0.8) {
        const w = (Math.random() * 2 - 1) * L;
        const s = S(d.x + d.fx * f + px * w, d.y + d.fy * f + py * w);
        p.espirrar(s.x + cx, s.y + cy, 10, d.fx, d.fy - 0.6, 3, [c0, c1, '#ffffff'], 1.2, true, 1);
      }
      break;
    }
    case 'anel': {
      // O pisão: o chão treme, o anel corre para fora e as rachaduras ficam.
      const R = def.p.raio!;
      const rr = Math.min(R, (vida / 1000) * def.p.vel!);
      if (uma(d, 'ini')) {
        p.tremer(0.7);
        p.onda(o.x + cx, o.y + cy, 40, c0);
      }
      lc.strokeStyle = '#2a1a10';
      lc.lineWidth = 1;
      lc.globalAlpha = 0.75 * fim;
      for (let i = 0; i < 11; i++) {
        const a0 = r() * Math.PI * 2;
        let a = a0;
        lc.beginPath();
        let s = S(d.x, d.y);
        lc.moveTo(s.x, s.y);
        const passos = 6;
        for (let k = 1; k <= passos; k++) {
          const dist = (k / passos) * rr * (0.6 + 0.4 * r());
          a += (r() - 0.5) * 0.6;
          s = S(d.x + Math.cos(a) * dist, d.y + Math.sin(a) * dist);
          lc.lineTo(s.x, s.y);
        }
        lc.stroke();
      }
      lc.globalAlpha = 1;
      if (vida < def.dura) {
        const al = 1 - (rr / R) * 0.6;
        anel(d.x, d.y, rr, c2, 4, al * 0.6);
        anel(d.x, d.y, rr, c0, 2, al);
        anel(d.x, d.y, rr * 0.82, c1, 1, al * 0.8);
        if (Math.random() < 0.9) {
          const a = Math.random() * Math.PI * 2;
          const s = S(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr);
          p.espirrar(s.x + cx, s.y + cy, 2, Math.cos(a), Math.sin(a) - 0.5, 3, ['#8f563b', '#5c3620', c0], 1, false, 2);
        }
      }
      break;
    }
    case 'alvos': {
      const atraso = def.p.atraso!;
      const passo = def.p.passo!;
      const pos = d.alvos.map((id) => p.posDe(id));
      if (d.tipo === 'raio') {
        // Nuvem carregada em cima de quem chamou e um raio por alvo, na hora dele.
        if (vida < def.dura + 300) {
          const al = fim * Math.min(1, vida / 200);
          for (let i = 0; i < 7; i++) bola(o.x - 30 + i * 10, o.y - 104 + Math.sin(agora / 200 + i) * 2, 9 + (i % 3) * 2, i % 2 ? '#3a3f58' : '#2a2d40', al * 0.85);
          if (Math.floor(agora / 90) % 5 === 0) bola(o.x + (r() - 0.5) * 40, o.y - 104, 6, c1, al * 0.5);
        }
        pos.forEach((q, i) => {
          if (!q) return;
          const ti = atraso + i * passo;
          const u = vida - ti;
          if (u < -70 || u > 170) return;
          const s = S(q.x, q.y);
          const topo = { x: o.x + (i - pos.length / 2) * 6, y: o.y - 100 };
          lc.globalCompositeOperation = 'lighter';
          for (const [cor, w] of [[c2, 5], [c1, 3], ['#ffffff', 1]] as const) {
            lc.strokeStyle = cor;
            lc.lineWidth = w;
            lc.globalAlpha = u < 0 ? 0.35 : 1 - u / 170;
            lc.beginPath();
            lc.moveTo(topo.x, topo.y);
            const rr = rnd(d.t0 + i * 17 + Math.floor(agora / 45));
            for (let k = 1; k < 7; k++) {
              const f = k / 7;
              lc.lineTo(topo.x + (s.x - topo.x) * f + (rr() - 0.5) * 14, topo.y + (s.y - 20 - topo.y) * f);
            }
            lc.lineTo(s.x, s.y - 6);
            lc.stroke();
          }
          lc.globalAlpha = 1;
          lc.globalCompositeOperation = 'source-over';
          if (u >= 0 && uma(d, `r${i}`)) {
            p.tremer(0.45);
            p.onda(s.x + cx, s.y + cy, 30, c1);
            p.espirrar(s.x + cx, s.y + cy, 14, 0, -1, 14, [c0, c1, '#ffffff'], 1.6, false, 1);
          }
          if (u >= 0 && u < 60) clarao('#e8f7ff', 0.28 * (1 - u / 60), `r${i}`);
        });
      } else {
        // Garçom fantasma: sai de quem chamou e passa de alvo em alvo dando bandejada.
        const pontos = [{ x: d.x, y: d.y }, ...pos.map((q, i) => q ?? pos[i - 1] ?? { x: d.x, y: d.y })];
        const horas = [0, ...pontos.slice(1).map((_, i) => atraso + i * passo)];
        let gx = pontos[pontos.length - 1].x;
        let gy = pontos[pontos.length - 1].y;
        let sobe = 0;
        const ult = horas[horas.length - 1];
        if (vida <= ult) {
          for (let i = 1; i < horas.length; i++)
            if (vida <= horas[i]) {
              const k = Math.max(0, (vida - horas[i - 1]) / Math.max(1, horas[i] - horas[i - 1]));
              const e = k * k * (3 - 2 * k);
              gx = pontos[i - 1].x + (pontos[i].x - pontos[i - 1].x) * e;
              gy = pontos[i - 1].y + (pontos[i].y - pontos[i - 1].y) * e;
              break;
            }
        } else sobe = (vida - ult) / 6;
        const s = S(gx, gy);
        const al = (0.55 + 0.2 * Math.sin(agora / 60)) * (vida > def.dura ? fim : 1) * Math.min(1, vida / 150);
        const bx = Math.round(s.x - 10);
        const by = Math.round(s.y - 34 - sobe + Math.sin(agora / 140) * 3);
        lc.globalAlpha = al;
        // Rabo ondulado, corpo, avental, cabeça, gravata e a bandeja erguida.
        for (let k = 0; k < 4; k++) {
          lc.fillStyle = k % 2 ? c1 : c0;
          lc.fillRect(bx + 3 + k * 2 + Math.round(Math.sin(agora / 80 + k) * 2), by + 26 + k * 2, 6 - k, 2);
        }
        lc.fillStyle = c0;
        lc.fillRect(bx + 3, by + 10, 10, 17);
        lc.fillStyle = c1;
        lc.fillRect(bx + 3, by + 10, 2, 17);
        lc.fillStyle = '#ffffff';
        lc.fillRect(bx + 6, by + 16, 5, 9);
        bola(bx + 8, by + 6, 5, c0, al);
        lc.globalAlpha = al;
        lc.fillStyle = c2;
        lc.fillRect(bx + 5, by + 5, 2, 2);
        lc.fillRect(bx + 9, by + 5, 2, 2);
        lc.fillRect(bx + 6, by + 11, 4, 2);
        // Bandeja: erguida, desce na hora de cada pancada.
        let baixa = 0;
        horas.slice(1).forEach((h) => {
          const u = vida - h;
          if (u > -120 && u < 120) baixa = Math.max(baixa, 1 - Math.abs(u) / 120);
        });
        lc.fillStyle = '#c0cbdc';
        lc.fillRect(bx + 13, by + 9 + Math.round(baixa * 12), 3, 2);
        lc.fillStyle = '#e4e4e4';
        lc.fillRect(bx + 11 - Math.round(baixa * 2), by + 3 + Math.round(baixa * 14), 12, 2);
        lc.globalAlpha = 1;
        pos.forEach((q, i) => {
          if (!q || vida < horas[i + 1] || !uma(d, `g${i}`)) return;
          const t2 = S(q.x, q.y);
          p.onda(t2.x + cx, t2.y + cy - 18, 24, '#e4e4e4');
          p.espirrar(t2.x + cx, t2.y + cy, 18, 0, -1, 8, [c0, '#ffffff', c1], 1.2, false, 1);
          p.texto(t2.x + cx + 6, t2.y + cy - 40, 'PLÉÉNG!', c0);
          p.tremer(0.25);
        });
      }
      break;
    }
    case 'ponto': {
      // Meteoro de torresmo: aviso no chão, a queda em diagonal com rastro de fogo, o estouro e a cratera.
      const at = def.p.atraso!;
      const alvo = S(d.cx, d.cy);
      if (vida < at) {
        const k = vida / at;
        anel(d.cx, d.cy, def.p.raio!, '#e43b44', 1, 0.3 + 0.4 * Math.abs(Math.sin(agora / 80)));
        lc.globalAlpha = 0.25 + 0.35 * k;
        lc.fillStyle = '#000000';
        lc.beginPath();
        lc.ellipse(alvo.x, alvo.y, 4 + 14 * k, 2 + 6 * k, 0, 0, Math.PI * 2);
        lc.fill();
        lc.globalAlpha = 1;
        // Vem do alto, do lado de quem chamou (a câmera segue você; do outro lado ele nasceria fora da tela).
        const vx = (o.x - alvo.x) * 0.45;
        const mx = alvo.x + vx * (1 - k);
        const my = alvo.y - 8 - 200 * (1 - k);
        const sx = Math.sign(vx) || 1;
        lc.globalCompositeOperation = 'lighter';
        for (let i = 9; i >= 1; i--) bola(mx + sx * i * 4, my - i * 13, 3 + i * 0.6, i % 2 ? '#c0282c' : '#ff8a2a', 0.55 - i * 0.05);
        bola(mx, my, 18, '#ff8a2a', 0.35);
        lc.globalCompositeOperation = 'source-over';
        // O torresmo: couro estufado (bolhas claras), a gordura embaixo e a borda escura.
        lc.fillStyle = '#4a2410';
        lc.fillRect(Math.round(mx - 13), Math.round(my - 8), 26, 17);
        lc.fillStyle = c2;
        lc.fillRect(Math.round(mx - 12), Math.round(my - 7), 24, 15);
        lc.fillStyle = c1;
        lc.fillRect(Math.round(mx - 11), Math.round(my - 9), 22, 10);
        lc.fillStyle = '#f4f4f4';
        lc.fillRect(Math.round(mx - 11), Math.round(my + 3), 22, 3);
        lc.fillStyle = c0;
        for (let i = 0; i < 9; i++) lc.fillRect(Math.round(mx - 10 + i * 2.5), Math.round(my - 8 + (i % 3)), 2, 1);
        if (Math.random() < 0.7) p.espirrar(mx + cx, my + cy + 8, 0, 0.5, -1, 1, ['#ff8a2a', '#fee761'], 0.6, false, 1);
      } else {
        if (uma(d, 'boom')) {
          p.tremer(1);
          p.onda(alvo.x + cx, alvo.y + cy - 4, 70, c0);
          p.onda(alvo.x + cx, alvo.y + cy - 4, 46, '#e43b44', 90);
          p.espirrar(alvo.x + cx, alvo.y + cy, 10, 0, -1, 44, [c1, c2, '#5c3620', '#fee761'], 2.2, true, 2);
        }
        const u = vida - at;
        if (u < 110) clarao('#fff2b0', 0.55 * (1 - u / 110), 'boom');
        anel(d.cx, d.cy, 1.3, '#1a0e08', 1, 0.55 * fim, true);
        lc.globalAlpha = fim;
        lc.fillStyle = c2;
        lc.fillRect(Math.round(alvo.x - 7), Math.round(alvo.y - 6), 14, 7);
        lc.fillStyle = c1;
        lc.fillRect(Math.round(alvo.x - 6), Math.round(alvo.y - 7), 12, 5);
        lc.globalAlpha = 1;
        if (u < 500) {
          lc.globalCompositeOperation = 'lighter';
          bola(alvo.x, alvo.y - 8, 26 * (1 - u / 500) + 4, '#ff8a2a', 0.5 * (1 - u / 500));
          lc.globalCompositeOperation = 'source-over';
        }
      }
      break;
    }
    case 'projetil': {
      // Bola de fogo da pinga: voa na altura da mão com rastro, explode e o fogo fica (desenhado à parte).
      const voo = vooPinga(d);
      const alvo = S(d.cx, d.cy);
      if (vida < voo) {
        const k = vida / Math.max(1, voo);
        const bx = o.x + (alvo.x - o.x) * k;
        const by = o.y + (alvo.y - o.y) * k - 16;
        const pul = 1 + 0.15 * Math.sin(agora / 30);
        lc.globalCompositeOperation = 'lighter';
        bola(bx, by, 11 * pul, c2, 0.45);
        bola(bx, by, 7 * pul, c1, 0.9);
        bola(bx, by, 4, c0, 1);
        lc.globalCompositeOperation = 'source-over';
        p.espirrar(bx + cx, by + cy + 16, 16, -d.fx * 0.5, -0.6, 2, [c1, c2, '#fee761'], 0.7, false, 1);
      } else {
        if (uma(d, 'boom')) {
          p.tremer(0.75);
          p.onda(alvo.x + cx, alvo.y + cy - 6, 56, c1);
          p.onda(alvo.x + cx, alvo.y + cy - 6, 34, c0, 80);
          p.espirrar(alvo.x + cx, alvo.y + cy, 14, 0, -1, 30, [c0, c1, c2, '#5c3620'], 2, true, 2);
        }
        const u = vida - voo;
        if (u < 400) {
          lc.globalCompositeOperation = 'lighter';
          bola(alvo.x, alvo.y - 10, 30 * (1 - u / 400) + 6, c1, 0.6 * (1 - u / 400));
          bola(alvo.x, alvo.y - 10, 14 * (1 - u / 400) + 2, c0, 0.8 * (1 - u / 400));
          lc.globalCompositeOperation = 'source-over';
        }
        if (u < 80) clarao('#fff6c0', 0.4 * (1 - u / 80), 'boom');
      }
      break;
    }
    case 'ima': {
      // Ímã: o campo puxando (faíscas em espiral e anéis que fecham), o miolo escuro crescendo e a implosão.
      const at = def.p.atraso!;
      const s = S(d.cx, d.cy);
      if (vida < at) {
        const k = vida / at;
        const fr = (vida % 420) / 420;
        anel(d.cx, d.cy, IMA_PUXA * (1 - fr), c1, 1, 0.5 * fr + 0.1);
        anel(d.cx, d.cy, IMA_PUXA * (1 - ((fr + 0.5) % 1)), c2, 1, 0.35);
        lc.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 36; i++) {
          const fz = (agora / 800 + i * 0.137) % 1;
          const rr = (1 - fz) * 78;
          const a = i * 2.4 + fz * 5;
          lc.globalAlpha = fz;
          lc.fillStyle = i % 3 ? c1 : c0;
          lc.fillRect(Math.round(s.x + Math.cos(a) * rr), Math.round(s.y - 12 + Math.sin(a) * rr * 0.5), i % 4 ? 1 : 2, 1);
        }
        lc.globalAlpha = 1;
        bola(s.x, s.y - 12, 6 + 10 * k, c2, 0.5);
        lc.globalCompositeOperation = 'source-over';
        bola(s.x, s.y - 12, 3 + 6 * k, '#1a0818', 1);
        lc.strokeStyle = c0;
        lc.lineWidth = 1;
        lc.beginPath();
        lc.arc(s.x, s.y - 12, 3 + 6 * k + Math.sin(agora / 40), 0, Math.PI * 2);
        lc.stroke();
      } else {
        if (uma(d, 'boom')) {
          p.tremer(0.9);
          p.onda(s.x + cx, s.y + cy - 10, 80, c1);
          p.onda(s.x + cx, s.y + cy - 10, 50, c0, 70);
          p.espirrar(s.x + cx, s.y + cy, 12, 0, -1, 36, [c0, c1, c2, '#ffffff'], 2.1, false, 1);
        }
        const u = vida - at;
        if (u < 90) clarao('#ffd0f0', 0.5 * (1 - u / 90), 'boom');
        if (u < 450) {
          lc.globalCompositeOperation = 'lighter';
          bola(s.x, s.y - 12, 4 + 36 * (u / 450), c1, 0.55 * (1 - u / 450));
          lc.globalCompositeOperation = 'source-over';
        }
      }
      break;
    }
  }
}

/** O fogo que a Pinga deixa no chão: chão queimado e labaredas que tremem, apagando no fim. */
export function desenharFogo(p: PalcoPoder, f: { x: number; y: number; ate: number }) {
  const resta = f.ate - p.t;
  if (resta <= 0) return;
  const al = Math.min(1, resta / 900);
  const { lc, cx, cy, agora, z } = p;
  const q = telaDe(f.x, f.y, z);
  const sx = q.x - cx;
  const sy = q.y - cy;
  lc.globalAlpha = 0.35 * al;
  lc.fillStyle = '#1a0e08';
  lc.beginPath();
  const rx = FOGO_RAIO * 16;
  lc.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI * 2);
  lc.fill();
  lc.globalCompositeOperation = 'lighter';
  const r = rnd(Math.round(f.x * 1000 + f.y * 77));
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * FOGO_RAIO;
    const t2 = telaDe(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, z);
    const fx = Math.round(t2.x - cx);
    const fy = Math.round(t2.y - cy);
    const h = Math.round((6 + 4 * r()) * (0.75 + 0.25 * Math.sin(agora / 60 + i * 1.3)) * al);
    lc.globalAlpha = 0.85 * al;
    lc.fillStyle = '#c0282c';
    lc.fillRect(fx - 2, fy - h, 4, h);
    lc.fillStyle = '#ff8a2a';
    lc.fillRect(fx - 1, fy - h - 1, 2, h - 1);
    lc.fillStyle = '#fff6c0';
    lc.fillRect(fx, fy - h - 2, 1, Math.max(1, h >> 1));
  }
  lc.globalAlpha = 1;
  lc.globalCompositeOperation = 'source-over';
  if (Math.random() < 0.25 * al) p.espirrar(sx + cx + (Math.random() - 0.5) * 20, sy + cy, 10, 0, -1, 1, ['#ff8a2a', '#fee761'], 0.6, false, 1);
}
