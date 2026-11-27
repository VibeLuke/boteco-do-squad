/**
 * Vozes do bar (Fatia 6): NPCs, você e os amigos "falam" num balbucio sintetizado na hora (nenhum arquivo, nenhuma
 * palavra de verdade), com a altura e o jeito de cada um tirados do id. Tipos: fala (o balão do narrador ou do NPC),
 * dor (apanhou), nocaute (gemido longo que cai), risada, grito e escorregão.
 *
 * Técnica: onda dente-de-serra (as pregas vocais) passando por dois filtros passa-banda nas formantes da vogal
 * (F1 e F2), com um envelope por sílaba e um sopro de ruído na consoante. A parte que decide (sílabas, alturas,
 * vogais) é pura e testável; a parte que toca aceita qualquer contexto de áudio (o de verdade ou o offline do teste).
 */
import { PESSOAS } from '../turma/index';

export type TipoVoz = 'fala' | 'dor' | 'ko' | 'risada' | 'grito' | 'escorrega';

/** Formantes (Hz) das vogais: F1 e F2. */
export const VOGAIS: Record<string, [number, number]> = {
  a: [800, 1250],
  e: [450, 1950],
  i: [300, 2300],
  o: [480, 900],
  u: [330, 750],
};
const LETRAS = Object.keys(VOGAIS);

export interface Silaba {
  /** Início (s) a partir do começo da fala. */
  t: number;
  dur: number;
  /** Altura no começo e no fim da sílaba (Hz). */
  f0: number;
  f1: number;
  vogal: string;
  /** Vogal para onde desliza (ditongo); igual = parada. */
  vogal2: string;
  /** Força (0..1). */
  forte: number;
  /** Sopro de consoante no ataque. */
  sopro: boolean;
  /** Tremido (Hz de vibrato; 0 = sem). */
  vibrato: number;
}

export interface Timbre {
  /** Altura base (Hz). */
  base: number;
  /** Fator de velocidade da fala (bêbado fala devagar). */
  ritmo: number;
  /** Quanto a altura passeia (0..1). */
  melodia: number;
  /** Brilho: desloca as formantes (voz fina > 1, grossa < 1). */
  brilho: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Quem tem voz fina (as personagens femininas do bar e as amigas). */
const VOZ_FINA = new Set<string>(['maria', 'cida', 'kelly', 'happy3', ...PESSOAS.filter((p) => 'vozFina' in p && p.vozFina).map((p) => p.id)]);
/** Quem fala devagar e arrastado. */
const ARRASTADO = new Set(['pinguco', 'biriba', 'chorao', 'tiozao', 'happy1']);
/** Quem fala grosso. */
const GROSSO = new Set(['tonhao', 'ze', 'marrento', 'cabeca', 'mano', 'tubarao', 'happy2', 'rocky']);

/** O jeito de falar de cada um, fixo pelo id. */
export function timbreDe(id: string): Timbre {
  const r = rng(hash(id));
  const fina = VOZ_FINA.has(id);
  const grosso = GROSSO.has(id);
  const arrastado = ARRASTADO.has(id);
  const base = fina ? 195 + r() * 70 : grosso ? 82 + r() * 20 : 105 + r() * 50;
  return {
    base,
    ritmo: arrastado ? 0.65 : 0.9 + r() * 0.3,
    melodia: 0.15 + r() * 0.25,
    brilho: fina ? 1.15 : grosso ? 0.85 : 0.95 + r() * 0.1,
  };
}

/** As sílabas de uma fala (pura: mesmo id, tipo, tamanho e semente = mesma voz). */
export function silabas(tipo: TipoVoz, id: string, tamanho = 12, semente = 1): Silaba[] {
  const tb = timbreDe(id);
  const r = rng(hash(id) ^ (semente * 2654435761));
  const out: Silaba[] = [];
  const v = () => LETRAS[Math.floor(r() * LETRAS.length)];
  const b = tb.base;
  if (tipo === 'fala') {
    const n = Math.max(3, Math.min(9, Math.round(tamanho / 5)));
    let t = 0;
    for (let i = 0; i < n; i++) {
      const dur = (0.07 + r() * 0.06) / tb.ritmo;
      // Fala sobe no começo e cai no fim da frase, com um passeio por sílaba.
      const arco = 1 + tb.melodia * (Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 0.6 - (i === n - 1 ? 0.35 : 0));
      const f = b * arco * (1 + (r() - 0.5) * tb.melodia);
      const vg = v();
      out.push({ t, dur, f0: f, f1: f * (0.95 + r() * 0.1), vogal: vg, vogal2: r() < 0.25 ? v() : vg, forte: 0.7 + r() * 0.3, sopro: r() < 0.6, vibrato: 0 });
      t += dur + (r() < 0.2 ? 0.06 : 0.015) / tb.ritmo;
    }
  } else if (tipo === 'dor') {
    out.push({ t: 0, dur: 0.17, f0: b * 1.7, f1: b * 1.15, vogal: 'a', vogal2: 'i', forte: 1, sopro: false, vibrato: 0 });
  } else if (tipo === 'ko') {
    out.push({ t: 0, dur: 0.12, f0: b * 1.5, f1: b * 1.35, vogal: 'a', vogal2: 'a', forte: 1, sopro: false, vibrato: 0 });
    out.push({ t: 0.13, dur: 0.62, f0: b * 1.3, f1: b * 0.55, vogal: 'a', vogal2: 'o', forte: 0.85, sopro: false, vibrato: 5 });
  } else if (tipo === 'risada') {
    const n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const f = b * (1.35 - i * 0.06) * (1 + (r() - 0.5) * 0.08);
      out.push({ t: i * 0.15, dur: 0.09, f0: f, f1: f * 0.92, vogal: r() < 0.7 ? 'a' : 'e', vogal2: 'a', forte: 0.9 - i * 0.08, sopro: true, vibrato: 0 });
    }
  } else if (tipo === 'grito') {
    out.push({ t: 0, dur: 0.48, f0: b * 2.1, f1: b * 1.7, vogal: 'a', vogal2: 'e', forte: 1, sopro: false, vibrato: 7 });
  } else {
    // Escorregão: "uôôa" que sobe e despenca.
    out.push({ t: 0, dur: 0.2, f0: b * 1.1, f1: b * 1.9, vogal: 'u', vogal2: 'o', forte: 0.9, sopro: false, vibrato: 0 });
    out.push({ t: 0.2, dur: 0.22, f0: b * 1.9, f1: b * 0.8, vogal: 'o', vogal2: 'a', forte: 1, sopro: false, vibrato: 0 });
  }
  return out;
}

/** Duração total da fala (s). */
export function duracaoVoz(s: Silaba[]): number {
  return s.reduce((m, x) => Math.max(m, x.t + x.dur), 0);
}

/** Tema da frase → tipo de voz (o narrador zoando ri, a confusão grita, o resto fala). */
export function vozDoTema(tema: string | undefined): TipoVoz {
  if (!tema) return 'fala';
  if (['ko', 'combo', 'chao', 'eu_ko', 'bigode', 'escorregou', 'rocky'].includes(tema)) return 'risada';
  if (['leao_vem', 'treta', 'foge', 'mutila', 'mutila_cabeca', 'atropelo'].includes(tema)) return 'grito';
  return 'fala';
}

/**
 * Toca as sílabas em `destino` a partir de `t0`, com o timbre de `id` e volume `vol` (0..1). Funciona com
 * AudioContext e com OfflineAudioContext (o teste mede o que sai).
 */
export function tocarSilabas(a: BaseAudioContext, destino: AudioNode, t0: number, id: string, s: Silaba[], vol: number, ruido: AudioBuffer | null) {
  const tb = timbreDe(id);
  for (const x of s) {
    const t = t0 + x.t;
    const fim = t + x.dur;
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(x.f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, x.f1), fim);
    if (x.vibrato) {
      const lfo = a.createOscillator();
      const lg = a.createGain();
      lfo.frequency.value = x.vibrato;
      lg.gain.value = x.f0 * 0.04;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(fim + 0.02);
    }
    const ganho = a.createGain();
    const pico = 0.22 * vol * x.forte;
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + Math.min(0.025, x.dur * 0.3));
    ganho.gain.setValueAtTime(Math.max(0.0002, pico * 0.8), Math.max(t + 0.03, fim - 0.04));
    ganho.gain.exponentialRampToValueAtTime(0.0001, fim);
    const [a1, b1] = VOGAIS[x.vogal];
    const [a2, b2] = VOGAIS[x.vogal2];
    for (const [ini, fin, q, g] of [
      [a1, a2, 6, 1],
      [b1, b2, 9, 0.6],
    ] as const) {
      const f = a.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = q;
      f.frequency.setValueAtTime(ini * tb.brilho, t);
      f.frequency.linearRampToValueAtTime(fin * tb.brilho, fim);
      const fg = a.createGain();
      fg.gain.value = g * 3;
      o.connect(f).connect(fg).connect(ganho);
    }
    ganho.connect(destino);
    o.start(t);
    o.stop(fim + 0.02);
    if (x.sopro && ruido) {
      const n = a.createBufferSource();
      n.buffer = ruido;
      const nf = a.createBiquadFilter();
      nf.type = 'highpass';
      nf.frequency.value = 2500;
      const ng = a.createGain();
      ng.gain.setValueAtTime(0.06 * vol, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      n.connect(nf).connect(ng).connect(destino);
      n.start(t, (x.t * 7) % 0.3);
      n.stop(t + 0.05);
    }
  }
}

/** Volume pela distância de quem ouve (mesma área): cheio até 2 ladrilhos, some aos 12. */
export function volumePorDistancia(d: number): number {
  return Math.max(0, Math.min(1, 1.2 - d / 10));
}
