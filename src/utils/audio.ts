/**
 * Sons sintetizados com Web Audio API — nenhum arquivo externo.
 */

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let enabled = true;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export const isSoundEnabled = (): boolean => enabled;

function getCtx(): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

interface ToneOpts {
  freq: number;
  start?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  attack?: number;
}

function tone(c: Ctx, out: AudioNode, o: ToneOpts): void {
  const t0 = c.currentTime + (o.start ?? 0);
  const dur = o.dur ?? 0.15;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  const peak = o.gain ?? 0.2;
  const attack = o.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function master(c: Ctx): AudioNode {
  const comp = c.createDynamicsCompressor();
  const g = c.createGain();
  g.gain.value = 0.9;
  comp.connect(g);
  g.connect(c.destination);
  return comp;
}

const NOTE = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

/** Clique de tecla: "tick" de madeira curto, com leve variação de altura. */
export function playKey(): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const out = master(c);
  const f = 520 + Math.random() * 90;
  tone(c, out, { freq: f, slideTo: f * 0.55, dur: 0.05, type: 'triangle', gain: 0.16, attack: 0.002 });
  tone(c, out, { freq: f * 2.01, slideTo: f, dur: 0.025, type: 'sine', gain: 0.05, attack: 0.001 });
}

export function playBackspace(): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const out = master(c);
  tone(c, out, { freq: 330, slideTo: 200, dur: 0.05, type: 'triangle', gain: 0.1, attack: 0.002 });
}

/** Palavra correta: arpejo ascendente curto. */
export function playWord(): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const out = master(c);
  [72, 76, 79].forEach((n, i) =>
    tone(c, out, { freq: NOTE(n), start: i * 0.075, dur: 0.22, type: 'sine', gain: 0.17 }),
  );
  tone(c, out, { freq: NOTE(84), start: 0.22, dur: 0.3, type: 'triangle', gain: 0.07 });
}

/** Revelar: brilho agudo. */
export function playReveal(): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const out = master(c);
  tone(c, out, { freq: NOTE(88), slideTo: NOTE(95), dur: 0.2, type: 'sine', gain: 0.1 });
  tone(c, out, { freq: NOTE(95), start: 0.07, dur: 0.22, type: 'sine', gain: 0.07 });
}

/** Erro: dois tons graves descendentes. */
export function playError(): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const out = master(c);
  tone(c, out, { freq: 196, dur: 0.14, type: 'sawtooth', gain: 0.06 });
  tone(c, out, { freq: 164, start: 0.12, dur: 0.22, type: 'sawtooth', gain: 0.06 });
}

export function playOk(): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const out = master(c);
  tone(c, out, { freq: NOTE(79), dur: 0.12, type: 'sine', gain: 0.12 });
  tone(c, out, { freq: NOTE(84), start: 0.08, dur: 0.2, type: 'sine', gain: 0.12 });
}

/** Fanfarra de vitória: fanfarra de metais sintetizada + brilho final. */
export function playVictory(): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const out = master(c);
  const seq: Array<[number, number, number]> = [
    [67, 0, 0.14],
    [72, 0.14, 0.14],
    [76, 0.28, 0.14],
    [79, 0.42, 0.32],
    [76, 0.78, 0.12],
    [79, 0.9, 0.12],
    [84, 1.02, 0.7],
  ];
  seq.forEach(([n, s, d]) => {
    tone(c, out, { freq: NOTE(n), start: s, dur: d + 0.12, type: 'sawtooth', gain: 0.07, attack: 0.012 });
    tone(c, out, { freq: NOTE(n + 12), start: s, dur: d + 0.1, type: 'sine', gain: 0.07, attack: 0.01 });
  });
  [72, 76, 79, 84].forEach((n) =>
    tone(c, out, { freq: NOTE(n), start: 1.02, dur: 1.1, type: 'triangle', gain: 0.07, attack: 0.02 }),
  );
  [96, 100, 103, 108].forEach((n, i) =>
    tone(c, out, { freq: NOTE(n), start: 1.35 + i * 0.09, dur: 0.5, type: 'sine', gain: 0.04 }),
  );
}
