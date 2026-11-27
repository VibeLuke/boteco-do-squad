/**
 * Som da Moscaria (Fatia 13), todo sintetizado no Web Audio (sem arquivo): o zumbido do enxame (dois osciladores de
 * 180 a 260 Hz que engrossam com a contagem de moscas), o jingle de nível e a chegada da rainha. Os estalos de golpe
 * reaproveitam os sons do bar (`tocar`). Um compressor na saída segura o volume quando tudo toca junto.
 */
import { contextoAudio, tocar } from '../../vivo/som';

interface Enxame {
  a: AudioContext;
  saida: DynamicsCompressorNode;
  g: GainNode;
  o1: OscillatorNode;
  o2: OscillatorNode;
  lfo: OscillatorNode;
}

let enxame: Enxame | null = null;

export function ligarEnxame() {
  const c = contextoAudio();
  if (!c || enxame) return;
  const a = c.a;
  const saida = a.createDynamicsCompressor();
  saida.threshold.value = -18;
  saida.ratio.value = 6;
  saida.connect(a.destination);
  const g = a.createGain();
  g.gain.value = 0;
  const filtro = a.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = 420;
  filtro.Q.value = 0.9;
  const o1 = a.createOscillator();
  const o2 = a.createOscillator();
  o1.type = 'sawtooth';
  o2.type = 'sawtooth';
  o1.frequency.value = 180;
  o2.frequency.value = 186;
  // Tremor de asa: um oscilador lento mexe na altura.
  const lfo = a.createOscillator();
  const lg = a.createGain();
  lfo.frequency.value = 23;
  lg.gain.value = 9;
  lfo.connect(lg);
  lg.connect(o1.frequency);
  lg.connect(o2.frequency);
  o1.connect(filtro);
  o2.connect(filtro);
  filtro.connect(g).connect(saida);
  o1.start();
  o2.start();
  lfo.start();
  enxame = { a, saida, g, o1, o2, lfo };
}

/** Volume e altura do zumbido pela quantidade de moscas (0 a 220). */
export function enxameCom(n: number) {
  if (!enxame) return;
  const k = Math.min(1, n / 90);
  const t = enxame.a.currentTime;
  enxame.g.gain.setTargetAtTime(0.02 + k * 0.09, t, 0.15);
  enxame.o1.frequency.setTargetAtTime(180 + k * 80, t, 0.3);
  enxame.o2.frequency.setTargetAtTime(186 + k * 74, t, 0.3);
}

export function desligarEnxame() {
  if (!enxame) return;
  const e = enxame;
  enxame = null;
  const t = e.a.currentTime;
  e.g.gain.setTargetAtTime(0, t, 0.05);
  for (const o of [e.o1, e.o2, e.lfo]) o.stop(t + 0.3);
  setTimeout(() => e.saida.disconnect(), 500);
}

function nota(freq: number, quando: number, dur: number, vol: number, tipo: OscillatorType = 'triangle') {
  const c = contextoAudio();
  if (!c) return;
  const a = c.a;
  const t = a.currentTime + quando;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(enxame?.saida ?? a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export type SomMosca = 'chinelada' | 'morreu' | 'dano' | 'nivel' | 'grito' | 'cuspe' | 'rainha' | 'venceu' | 'perdeu';

export function somMosca(s: SomMosca) {
  switch (s) {
    case 'chinelada':
      tocar('soco');
      break;
    case 'morreu':
      nota(900 + Math.random() * 300, 0, 0.05, 0.05, 'square');
      break;
    case 'dano':
      tocar('parede');
      break;
    case 'nivel':
      [523, 659, 784].forEach((f, i) => nota(f, i * 0.08, 0.16, 0.12));
      break;
    case 'grito':
      tocar('grito');
      break;
    case 'cuspe':
      tocar('chiado');
      break;
    case 'rainha':
      [196, 185, 175, 147].forEach((f, i) => nota(f, i * 0.18, 0.3, 0.14, 'sawtooth'));
      break;
    case 'venceu':
      [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.1, 0.22, 0.13));
      break;
    case 'perdeu':
      [392, 330, 262].forEach((f, i) => nota(f, i * 0.14, 0.28, 0.12, 'square'));
      break;
  }
}
