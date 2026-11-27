/**
 * Som da Quermesse Maluca (Fatia 14), todo sintetizado no Web Audio (sem arquivo): sanfona em dente de serra com
 * vibrato (a frase do aviso de cada microjogo, mais rápida com a velocidade), estalo de fogueira em ruído filtrado
 * (fogueira apagando), sino no acerto e buzina no erro. Um compressor na saída segura o volume.
 */
import { contextoAudio } from '../../vivo/som';

let saida: { a: AudioContext; no: DynamicsCompressorNode } | null = null;

function destino(): { a: AudioContext; no: AudioNode; ruido: AudioBuffer } | null {
  const c = contextoAudio();
  if (!c) return null;
  if (!saida || saida.a !== c.a) {
    const no = c.a.createDynamicsCompressor();
    no.threshold.value = -16;
    no.ratio.value = 5;
    no.connect(c.a.destination);
    saida = { a: c.a, no };
  }
  return { a: c.a, no: saida.no, ruido: c.ruido };
}

/** Uma nota de sanfona: duas serras quase iguais (o batimento do fole), vibrato de 6 Hz e filtro passa-baixa. */
function sanfona(freq: number, quando: number, dur: number, vol = 0.07) {
  const d = destino();
  if (!d) return;
  const { a } = d;
  const t = a.currentTime + quando;
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1800;
  const lfo = a.createOscillator();
  const lg = a.createGain();
  lfo.frequency.value = 6;
  lg.gain.value = freq * 0.012;
  lfo.connect(lg);
  for (const det of [0, 3]) {
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq + det;
    lg.connect(o.frequency);
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  lfo.start(t);
  lfo.stop(t + dur + 0.02);
  f.connect(g).connect(d.no);
}

function tom(freq: number, quando: number, dur: number, vol: number, tipo: OscillatorType) {
  const d = destino();
  if (!d) return;
  const { a } = d;
  const t = a.currentTime + quando;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(d.no);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Estalo de fogueira: rajadas curtas de ruído passando por um passa-banda. */
function estalo(n: number) {
  const d = destino();
  if (!d) return;
  const { a } = d;
  for (let i = 0; i < n; i++) {
    const t = a.currentTime + i * 0.05 + Math.random() * 0.03;
    const s = a.createBufferSource();
    s.buffer = d.ruido;
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500 + Math.random() * 1500;
    f.Q.value = 4;
    const g = a.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(f).connect(g).connect(d.no);
    s.start(t, Math.random() * 0.4, 0.05);
  }
}

// Frases de 4 notas em Sol maior (forró de quermesse), uma por microjogo da sequência.
const FRASES = [
  [392, 494, 587, 494],
  [440, 523, 659, 587],
  [392, 440, 494, 587],
  [587, 494, 440, 392],
];

export type SomQ = 'aviso' | 'chefe' | 'ganhou' | 'perdeu' | 'acelerou' | 'venceu' | 'fim';

export function somQuermesse(s: SomQ, i = 0, vel = 1) {
  const b = 0.11 / vel;
  switch (s) {
    case 'aviso':
      FRASES[i % FRASES.length].forEach((f, k) => sanfona(f, k * b, b * 0.95));
      break;
    case 'chefe':
      [392, 392, 523, 659, 784].forEach((f, k) => sanfona(f, k * 0.09, 0.12, 0.09));
      break;
    case 'ganhou':
      tom(1568, 0, 0.35, 0.08, 'sine');
      tom(2093, 0.06, 0.4, 0.05, 'sine');
      break;
    case 'perdeu':
      tom(196, 0, 0.3, 0.09, 'square');
      tom(185, 0.1, 0.3, 0.08, 'square');
      estalo(6);
      break;
    case 'acelerou':
      [523, 659, 784].forEach((f, k) => sanfona(f, k * 0.06, 0.08, 0.06));
      break;
    case 'venceu':
      [392, 494, 587, 784, 587, 784].forEach((f, k) => sanfona(f, k * 0.12, 0.16, 0.09));
      break;
    case 'fim':
      [392, 330, 262].forEach((f, k) => tom(f, k * 0.15, 0.3, 0.09, 'square'));
      estalo(10);
      break;
  }
}
