/**
 * Música da jukebox, sintetizada na hora com Web Audio (nenhum arquivo). Cada amigo tem um estilo; toca o de quem
 * lidera o placar de hoje (empate ou ninguém pontuou = a música da casa). Só dentro do cômodo da jukebox.
 *
 * Cada música tem 4 compassos de 16 passos. Trilhas melódicas em texto: um item por passo, separados por espaço:
 * número = nota MIDI (acorde: 60+64+67), "-" segura a nota anterior, "." pausa. Bateria: um caractere por passo:
 * k bumbo, s caixa, h chimbal, o chimbal aberto, t triângulo/tamborim, c aro, "." nada.
 */
import { PLAYERS, type PlayerId } from '../arena/sprites';
import { PESSOAS, type Estilo } from '../turma/index';
import { isSoundEnabled } from '../utils/audio';

export type SongId = PlayerId | 'casa';

export interface Song {
  /** Id da faixa (as dos amigos e da casa são SongId; as da jukebox do Bar Vivo têm id próprio). */
  id: string;
  name: string;
  bpm: number;
  /** 0..0.5: atraso dos passos ímpares (balanço). */
  swing: number;
  lead?: { wave: OscillatorType; gain: number; notes: string };
  chords?: { wave: OscillatorType; gain: number; notes: string };
  bass: { wave: OscillatorType; gain: number; notes: string };
  drums: string[];
}

export const STEPS = 64;

/** Os estilos da jukebox. Cada pessoa da turma escolhe um (src/turma/turma.ts); o nome vira "Rock de garagem do Fulano". */
const ESTILOS: Record<Estilo | 'casa', Omit<Song, 'id' | 'name'> & { titulo: string }> = {
  rock: {
    titulo: 'Rock de garagem',
    bpm: 140,
    swing: 0,
    lead: {
      wave: 'square',
      gain: 0.05,
      notes:
        '64 - 67 - 69 - 67 - 64 - - - 62 - 64 - ' +
        '64 - 67 - 69 - 71 - 72 - 71 - 69 - 67 - ' +
        '60 - 64 - 67 - 64 - 62 - 66 - 69 - 66 - ' +
        '64 - - - 71 - - - 69 - 67 - 64 - - -',
    },
    bass: {
      wave: 'sawtooth',
      gain: 0.07,
      notes:
        '40 . 40 . 40 . 40 . 40 . 40 . 43 . 45 . ' +
        '40 . 40 . 40 . 40 . 40 . 40 . 43 . 45 . ' +
        '36 . 36 . 36 . 36 . 38 . 38 . 38 . 38 . ' +
        '40 . 40 . 40 . 40 . 47 . 47 . 45 . 43 .',
    },
    drums: ['k...s...k.k.s...k...s...k.k.s...k...s...k.k.s...k...s...k.k.s.ss', 'h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.o.'],
  },
  samba: {
    titulo: 'Samba de mesa',
    bpm: 100,
    swing: 0.08,
    chords: {
      wave: 'square',
      gain: 0.025,
      notes:
        '67+71+74 . 67+71+74 . . 67+71+74 . 67+71+74 . 67+71+74 . . 67+71+74 . . . ' +
        '64+68+74 . 64+68+74 . . 64+68+74 . 64+68+74 . 64+68+74 . . 64+68+74 . . . ' +
        '69+72+76 . 69+72+76 . . 69+72+76 . 69+72+76 . 69+72+76 . . 69+72+76 . . . ' +
        '62+66+72 . 62+66+72 . . 62+66+72 . 62+66+72 . 62+66+72 . . 62+66+72 . . .',
    },
    lead: {
      wave: 'triangle',
      gain: 0.06,
      notes:
        '79 . 78 . 79 . . 74 . . 71 . 74 . . . ' +
        '76 . 74 . 76 . . 71 . . 68 . 71 . . . ' +
        '72 . 74 . 76 . . 79 . . 76 . 72 . . . ' +
        '74 - - . 72 . 71 . 69 . 66 . 67 - - -',
    },
    bass: {
      wave: 'triangle',
      gain: 0.12,
      notes:
        '43 . . 43 . 43 . . 50 . . 50 . 50 . . ' +
        '40 . . 40 . 40 . . 47 . . 47 . 47 . . ' +
        '45 . . 45 . 45 . . 52 . . 52 . 52 . . ' +
        '38 . . 38 . 38 . . 45 . . 45 . 42 . .',
    },
    drums: ['....k.......k.......k.......k.......k.......k.......k.......k...', 't.tt.t.tt.t.t.ttt.tt.t.tt.t.t.ttt.tt.t.tt.t.t.ttt.tt.t.tt.t.t.tt', '..h...h...h...h...h...h...h...h...h...h...h...h...h...h...h...h.'],
  },
  synthwave: {
    titulo: 'Synthwave',
    bpm: 108,
    swing: 0,
    chords: {
      wave: 'sawtooth',
      gain: 0.022,
      notes:
        '57+60+64 - - - - - - - - - - - - - - - ' +
        '53+57+60 - - - - - - - - - - - - - - - ' +
        '48+52+55 - - - - - - - - - - - - - - - ' +
        '55+59+62 - - - - - - - - - - - - - - -',
    },
    lead: {
      wave: 'square',
      gain: 0.035,
      notes:
        '69 72 76 81 76 72 69 72 76 81 76 72 69 72 76 81 ' +
        '65 69 72 77 72 69 65 69 72 77 72 69 65 69 72 77 ' +
        '60 64 67 72 67 64 60 64 67 72 67 64 60 64 67 72 ' +
        '67 71 74 79 74 71 67 71 74 79 74 71 67 71 74 79',
    },
    bass: {
      wave: 'sawtooth',
      gain: 0.07,
      notes:
        '45 . 57 . 45 . 57 . 45 . 57 . 45 . 57 . ' +
        '41 . 53 . 41 . 53 . 41 . 53 . 41 . 53 . ' +
        '36 . 48 . 36 . 48 . 36 . 48 . 36 . 48 . ' +
        '43 . 55 . 43 . 55 . 43 . 55 . 43 . 55 .',
    },
    drums: ['k.......k.......k.......k.......k.......k.......k.......k...k.k.', '....s.......s.......s.......s.......s.......s.......s.......s...', 'h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.'],
  },
  baiao: {
    titulo: 'Baião',
    bpm: 120,
    swing: 0.04,
    lead: {
      wave: 'square',
      gain: 0.04,
      notes:
        '67 . 69 . 71 . 72 . 74 - - . 72 . 71 . ' +
        '69 . 71 . 72 . 74 . 76 - - . 77 . 76 . ' +
        '74 . 72 . 71 . 69 . 67 . 65 . 67 . 69 . ' +
        '71 - - . 69 . 67 . 65 . 67 - - . . .',
    },
    bass: {
      wave: 'triangle',
      gain: 0.13,
      notes:
        '43 . . 43 . . 50 . 43 . . 43 . . 50 . ' +
        '41 . . 41 . . 48 . 41 . . 41 . . 48 . ' +
        '43 . . 43 . . 50 . 43 . . 43 . . 50 . ' +
        '41 . . 41 . . 48 . 38 . . 38 . . 45 .',
    },
    drums: ['k..k....k..k....k..k....k..k....k..k....k..k....k..k....k..k.kk.', 't.ttt.ttt.ttt.ttt.ttt.ttt.ttt.ttt.ttt.ttt.ttt.ttt.ttt.ttt.ttt.tt', '....c.......c.......c.......c.......c.......c.......c.......c...'],
  },
  lofi: {
    titulo: 'Lo-fi',
    bpm: 80,
    swing: 0.18,
    chords: {
      wave: 'triangle',
      gain: 0.035,
      notes:
        '62+65+69+72 - - - - - - - - - - - - - - - ' +
        '55+59+65+69 - - - - - - - - - - - - - - - ' +
        '60+64+67+71 - - - - - - - - - - - - - - - ' +
        '57+61+64+67 - - - - - - - . . 57+61+64+67 - - - - -',
    },
    lead: {
      wave: 'sine',
      gain: 0.07,
      notes:
        '. . 76 - 74 - . . 72 - - - . . 69 - ' +
        '. . 71 - 72 - . . 74 - - - . . . . ' +
        '. . 76 - 79 - . . 76 - 74 - 72 - - - ' +
        '. . 73 - 72 - . . 69 - - - . . . .',
    },
    bass: {
      wave: 'sine',
      gain: 0.16,
      notes:
        '38 - - - . . . . . . 45 - - . . . ' +
        '43 - - - . . . . . . 38 - - . . . ' +
        '36 - - - . . . . . . 43 - - . . . ' +
        '45 - - - . . . . . . 40 - - . . .',
    },
    drums: ['k.....k...k.....k.....k...k.....k.....k...k.....k.....k...k.k...', '....s.......s.......s.......s.......s.......s.......s.......s...', 'h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.h.'],
  },
  casa: {
    titulo: 'Bossa da casa',
    bpm: 90,
    swing: 0.06,
    chords: {
      wave: 'triangle',
      gain: 0.035,
      notes:
        '60+64+67+71 . . 60+64+67+71 - - 60+64+67+71 - . . 60+64+67+71 . . 60+64+67+71 - - ' +
        '57+60+64+67 . . 57+60+64+67 - - 57+60+64+67 - . . 57+60+64+67 . . 57+60+64+67 - - ' +
        '62+65+69+72 . . 62+65+69+72 - - 62+65+69+72 - . . 62+65+69+72 . . 62+65+69+72 - - ' +
        '55+59+65+69 . . 55+59+65+69 - - 55+59+65+69 - . . 55+59+65+69 . . 55+59+65+69 - -',
    },
    lead: {
      wave: 'sine',
      gain: 0.06,
      notes:
        '76 - - - 74 - 72 - 71 - - - . . . . ' +
        '72 - - - 71 - 69 - 67 - - - . . . . ' +
        '69 - 71 - 72 - 74 - 77 - 76 - 74 - - - ' +
        '71 - - - 72 - 74 - 67 - - - . . . .',
    },
    bass: {
      wave: 'triangle',
      gain: 0.13,
      notes:
        '36 . . . . . 43 . 36 . . . . . 43 . ' +
        '45 . . . . . 40 . 45 . . . . . 40 . ' +
        '38 . . . . . 45 . 38 . . . . . 45 . ' +
        '43 . . . . . 38 . 43 . . . . . 38 .',
    },
    drums: ['k..k....k..k....k..k....k..k....k..k....k..k....k..k....k..k....', '..h...h...h...h...h...h...h...h...h...h...h...h...h...h...h...h.', '...c.....c..c......c.....c..c......c.....c..c......c.....c..c...'],
  },
};

const deEstilo = (e: Estilo | 'casa', id: string, name: string): Song => {
  const { titulo: _t, ...resto } = ESTILOS[e];
  return { ...resto, id, name };
};
export const SONGS: Record<SongId, Song> = {
  ...(Object.fromEntries(PESSOAS.map((p) => [p.id, deEstilo(p.musica, p.id, `${ESTILOS[p.musica].titulo} ${p.artigo} ${p.name}`)])) as Record<PlayerId, Song>),
  casa: deEstilo('casa', 'casa', ESTILOS.casa.titulo),
};

export type Step = number[] | 'hold' | null;

/** Texto de uma trilha → um item por passo: notas, "segura" ou pausa. */
export function parseTrack(s: string): Step[] {
  return s
    .trim()
    .split(/\s+/)
    .map((tok) => (tok === '.' ? null : tok === '-' ? 'hold' : tok.split('+').map(Number)));
}

/** Quantos passos a nota do passo `i` dura (ela mais os "-" seguintes). */
export function noteLength(steps: Step[], i: number): number {
  let n = 1;
  while (steps[(i + n) % steps.length] === 'hold' && n < steps.length) n++;
  return n;
}

/**
 * Música da vez: a de quem lidera o placar de hoje sozinho. Empate no topo ou ninguém com ponto → a da casa.
 * Recebe os totais de hoje já ordenados (maior primeiro).
 */
export function songFor(today: { id: PlayerId; total: number }[]): SongId {
  const [a, b] = today;
  if (!a || a.total <= 0 || (b && b.total === a.total)) return 'casa';
  return a.id;
}

export const SONG_IDS: SongId[] = [...PLAYERS.map((p) => p.id), 'casa'];

// ------------------------------------------------------------------------------------------- tocador

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class JukeboxPlayer {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private song: Song | null = null;
  private parsed: { lead?: Step[]; chords?: Step[]; bass: Step[] } | null = null;
  private step = 0;
  private nextAt = 0;
  private volume = 0.5;

  /** Toca a música (ou troca, se já tocava outra). Sem som ligado, não faz nada. */
  play(id: SongId): void {
    this.playSong(SONGS[id]);
  }

  /**
   * Toca uma faixa qualquer, começando no passo `passo0` (para todo aparelho tocar no mesmo compasso). Mesma faixa
   * já tocando: não reinicia.
   */
  playSong(song: Song, passo0 = 0): void {
    if (!isSoundEnabled()) {
      this.stop();
      return;
    }
    if (this.song?.id === song.id && this.timer) return;
    const ctx = this.ensure();
    if (!ctx || !this.out) return;
    this.song = song;
    this.parsed = {
      lead: this.song.lead ? parseTrack(this.song.lead.notes) : undefined,
      chords: this.song.chords ? parseTrack(this.song.chords.notes) : undefined,
      bass: parseTrack(this.song.bass.notes),
    };
    this.step = ((passo0 % STEPS) + STEPS) % STEPS;
    this.nextAt = ctx.currentTime + 0.08;
    this.out.gain.cancelScheduledValues(ctx.currentTime);
    this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.out.gain.exponentialRampToValueAtTime(this.volume * 0.35, ctx.currentTime + 0.6);
    if (!this.timer) this.timer = setInterval(() => this.tick(), 60);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song = null;
    if (this.ctx && this.out) {
      const t = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
      this.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    }
  }

  /** Volume de 0 a 1 (a jukebox do Bar Vivo baixa com a distância). */
  setVolume(v: number): void {
    const nv = Math.max(0, Math.min(1, v)) * 0.5;
    if (Math.abs(nv - this.volume) < 0.01) return;
    this.volume = nv;
    if (this.ctx && this.out && this.timer) {
      const t = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
      this.out.gain.linearRampToValueAtTime(Math.max(0.0001, this.volume * 0.35), t + 0.3);
    }
  }

  playing(): string | null {
    return this.timer && this.song ? this.song.id : null;
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
      const comp = this.ctx.createDynamicsCompressor();
      comp.connect(this.ctx.destination);
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.0001;
      this.out.connect(comp);
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        d[i] = (seed / 4294967296) * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  private tick(): void {
    const ctx = this.ctx;
    const song = this.song;
    if (!ctx || !song || !this.parsed) return;
    if (!isSoundEnabled()) {
      this.stop();
      return;
    }
    const stepDur = 60 / song.bpm / 4;
    // Ficou para trás (aba dormiu): recomeça do agora, sem despejar uma rajada de notas.
    if (this.nextAt < ctx.currentTime - 0.2) this.nextAt = ctx.currentTime + 0.05;
    while (this.nextAt < ctx.currentTime + 0.3) {
      const at = this.nextAt + (this.step % 2 ? song.swing * stepDur : 0);
      this.playStep(song, this.step, at, stepDur);
      this.step = (this.step + 1) % STEPS;
      this.nextAt += stepDur;
    }
  }

  private playStep(song: Song, i: number, at: number, stepDur: number): void {
    const p = this.parsed!;
    const mel = (steps: Step[] | undefined, inst: { wave: OscillatorType; gain: number } | undefined, short: number) => {
      if (!steps || !inst) return;
      const s = steps[i % steps.length];
      if (!Array.isArray(s)) return;
      const len = noteLength(steps, i) * stepDur * short;
      for (const n of s) this.tone(NOTE(n), at, len, inst.wave, inst.gain / Math.sqrt(s.length));
    };
    mel(p.bass, song.bass, 0.9);
    mel(p.chords, song.chords, 0.85);
    mel(p.lead, song.lead, 0.92);
    for (const track of song.drums) {
      const c = track[i % track.length];
      if (c === 'k') this.kick(at);
      else if (c === 's') this.hit(at, 0.12, 'bandpass', 1800, 0.22, 190);
      else if (c === 'h') this.hit(at, 0.03, 'highpass', 7000, 0.07);
      else if (c === 'o') this.hit(at, 0.16, 'highpass', 6000, 0.07);
      else if (c === 't') this.hit(at, 0.04, 'highpass', 4500, 0.06, 2400);
      else if (c === 'c') this.hit(at, 0.025, 'bandpass', 2600, 0.1, 1600);
    }
  }

  private tone(freq: number, at: number, dur: number, wave: OscillatorType, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    g.gain.setValueAtTime(gain, at + Math.max(0.01, dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(this.out!);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private kick(at: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    g.gain.setValueAtTime(0.5, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    o.connect(g);
    g.connect(this.out!);
    o.start(at);
    o.stop(at + 0.18);
  }

  /** Batida de ruído filtrado (caixa, chimbal, triângulo, aro), com um tom opcional por baixo. */
  private hit(at: number, dur: number, type: BiquadFilterType, freq: number, gain: number, toneHz?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.out!);
    src.start(at, Math.random() * 0.3);
    src.stop(at + dur + 0.02);
    if (toneHz) this.tone(toneHz, at, dur, 'triangle', gain * 0.5);
  }
}

export const jukebox = new JukeboxPlayer();
