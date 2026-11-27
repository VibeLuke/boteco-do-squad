/**
 * Faixas da jukebox do Bar Vivo (Fatia 6): as 6 de antes (uma por amigo e a da casa) e 8 novas, todas originais e
 * sintetizadas na hora pelo tocador de `bar/music.ts` (nenhum arquivo). Cada faixa nova é montada de uma progressão
 * (um acorde por compasso), de um ritmo de baixo e de acorde por estilo e de uma melodia escrita à mão.
 *
 * A escolha é do bar inteiro: `bar/juke` = { s: faixa (-1 = desligada), p: quem escolheu, t: hora do servidor }.
 * Todo aparelho toca a mesma faixa no mesmo passo (conta pela hora da escolha).
 */
import { SONGS, SONG_IDS, STEPS, type Song } from '../bar/music';
import { IDS_RE } from '../turma/index';

/** Acorde: notas MIDI (a primeira é a fundamental). */
type Acorde = number[];

interface Receita {
  id: string;
  name: string;
  bpm: number;
  swing: number;
  /** Um acorde por compasso (4 compassos). */
  prog: [Acorde, Acorde, Acorde, Acorde];
  /** 16 caracteres por compasso: R fundamental, 5 quinta, 8 oitava, 3 terça, - segura, . pausa. */
  baixo: string;
  /** 16 caracteres: 1 toca o acorde, - segura, . pausa. Vazio = sem acorde. */
  acorde: string;
  /** 4 compassos de 16 passos (texto do tocador). */
  melodia: string;
  ondas: { lead: OscillatorType; chords: OscillatorType; bass: OscillatorType };
  ganhos?: { lead?: number; chords?: number; bass?: number };
  /** Bateria: cada linha tem 16 caracteres e repete; a última volta do compasso 4 pode trocar pela virada. */
  bateria: string[];
  virada?: string[];
}

/** Fundamental do acorde na região do baixo (36–47). */
function grave(a: Acorde): number {
  let n = a[0];
  while (n > 47) n -= 12;
  while (n < 36) n += 12;
  return n;
}

function trilhaBaixo(r: Receita): string {
  const out: string[] = [];
  for (const a of r.prog) {
    const f = grave(a);
    const terca = f + (a[1] - a[0]);
    for (const c of r.baixo) {
      if (c === 'R') out.push(String(f));
      else if (c === '5') out.push(String(f + 7));
      else if (c === '8') out.push(String(f + 12));
      else if (c === '3') out.push(String(terca));
      else if (c === '-') out.push('-');
      else out.push('.');
    }
  }
  return out.join(' ');
}

function trilhaAcorde(r: Receita): string {
  const out: string[] = [];
  for (const a of r.prog)
    for (const c of r.acorde) out.push(c === '1' ? a.join('+') : c === '-' ? '-' : '.');
  return out.join(' ');
}

function montar(r: Receita): Song {
  const g = r.ganhos ?? {};
  return {
    id: r.id,
    name: r.name,
    bpm: r.bpm,
    swing: r.swing,
    lead: { wave: r.ondas.lead, gain: g.lead ?? 0.05, notes: r.melodia },
    ...(r.acorde ? { chords: { wave: r.ondas.chords, gain: g.chords ?? 0.03, notes: trilhaAcorde(r) } } : {}),
    bass: { wave: r.ondas.bass, gain: g.bass ?? 0.09, notes: trilhaBaixo(r) },
    drums: r.bateria.map((l, i) => l.repeat(3) + (r.virada?.[i] ?? l)),
  };
}

const C = [60, 64, 67];
const F = [65, 69, 72];
const G = [67, 71, 74];
const Am = [57, 60, 64];
const E = [64, 68, 71];
const Em = [64, 67, 71];
const D = [62, 66, 69];
const Dm = [62, 65, 69];
const Gm = [55, 58, 62];
const A = [57, 61, 64];
const Bm = [59, 62, 66];
const Fm = [65, 68, 72];
const Db = [61, 65, 68];
const Eb = [63, 67, 70];
const Fmaj7 = [65, 69, 72, 76];
const Em7 = [64, 67, 71, 74];
const Dm7 = [62, 65, 69, 72];
const Cmaj7 = [60, 64, 67, 71];

const RECEITAS: Receita[] = [
  {
    id: 'forro',
    name: 'Forró do Fiado',
    bpm: 125,
    swing: 0,
    prog: [C, C, F, G],
    baixo: 'R..R..5.R..R..5.',
    acorde: '',
    melodia:
      '72 - 74 - 76 - 74 - 72 - 70 - 72 - - - ' +
      '76 - 77 - 79 - 77 - 76 - 74 - 72 - - - ' +
      '77 - - 76 74 - 72 - 69 - 72 - 74 - - - ' +
      '79 - 77 - 76 - 74 - 72 - - - . . . .',
    ondas: { lead: 'square', chords: 'square', bass: 'triangle' },
    ganhos: { lead: 0.045, bass: 0.14 },
    bateria: ['k..k....k..k....', 't.t.t.ttt.t.t.tt'],
    virada: ['k..k....k.k.k.kk', 't.t.t.ttt.t.tttt'],
  },
  {
    id: 'brega',
    name: 'Brega da Saideira',
    bpm: 92,
    swing: 0,
    prog: [Am, F, C, E],
    baixo: 'R...5...R...5.3.',
    acorde: '..1...1...1...1.',
    melodia:
      '76 - - - 77 - 76 - 74 - - - 72 - - - ' +
      '72 - - - 74 - 72 - 69 - - - . . 69 71 ' +
      '72 - - - 76 - - - 79 - 77 - 76 - - - ' +
      '76 - - - 74 - 71 - 68 - - - . . . .',
    ondas: { lead: 'triangle', chords: 'sawtooth', bass: 'triangle' },
    ganhos: { lead: 0.07, chords: 0.018, bass: 0.13 },
    bateria: ['k...s...k.k.s...', 'h.h.h.h.h.h.h.h.'],
    virada: ['k...s...k.k.s.ss', 'h.h.h.h.h.h.o...'],
  },
  {
    id: 'pagode',
    name: 'Pagode da Mesa 4',
    bpm: 100,
    swing: 0.1,
    prog: [G, Em, Am, D],
    baixo: 'R.....5.R.8...5.',
    acorde: '1.11.1.11.11.1.1',
    melodia:
      '74 - 71 - 74 - 76 - 74 - 71 - 67 - - - ' +
      '71 - 67 - 71 - 74 - 76 - 74 - 71 - - - ' +
      '72 - 76 - 74 - 72 - 71 - 69 - 72 - 71 - ' +
      '69 - - - 71 - 72 - 74 - - - 78 - - -',
    ondas: { lead: 'square', chords: 'square', bass: 'sine' },
    ganhos: { lead: 0.04, chords: 0.022, bass: 0.18 },
    bateria: ['k.....k.k.......', 'h.hhh.hhh.hhh.hh', 'c..c..c...c..c..'],
    virada: ['k.....k.k...k.k.', 'h.hhh.hhh.hhhhhh', 'c..c..c...cccc..'],
  },
  {
    id: 'rock',
    name: 'Rock do Leão de Chácara',
    bpm: 152,
    swing: 0,
    prog: [Em, Em, G, A],
    baixo: 'R.R.R.R.R.R.R.R.',
    acorde: '1-..1-..1-..1-..',
    melodia:
      '64 - 67 - 69 - 70 - 69 - 67 - 64 - - - ' +
      '64 - 67 - 69 - 67 - 64 - 62 - 64 - - - ' +
      '67 - 69 - 71 - 74 - 71 - 69 - 67 - 69 - ' +
      '71 - - - 69 - - - 67 - 64 - 62 - 64 -',
    ondas: { lead: 'square', chords: 'sawtooth', bass: 'sawtooth' },
    ganhos: { lead: 0.05, chords: 0.02, bass: 0.07 },
    bateria: ['k...s...k.k.s...', 'h.h.h.h.h.h.h.h.'],
    virada: ['k...s...k.k.ssss', 'h.h.h.h.h.h.o...'],
  },
  {
    id: 'funk',
    name: 'Funk 8-bit do Beco',
    bpm: 130,
    swing: 0,
    prog: [Fm, Fm, Db, Eb],
    baixo: 'R..R..R...R.R...',
    acorde: '',
    melodia:
      '77 . 77 . 80 . . 77 . 75 . 77 . . . . ' +
      '77 . 77 . 80 . . 82 . 80 . 77 . . . . ' +
      '75 . 75 . 77 . . 75 . 72 . 75 . . . . ' +
      '72 - - - 75 - - - 77 - 80 - 77 - - -',
    ondas: { lead: 'square', chords: 'square', bass: 'sine' },
    ganhos: { lead: 0.045, bass: 0.2 },
    bateria: ['k..k..k...k.k...', '...s..s....s..s.', 'h.h.h.h.h.h.h.h.'],
    virada: ['k..k..k...k.kkkk', '...s..s....sssss', 'h.h.h.h.h.h.h.h.'],
  },
  {
    id: 'samba',
    name: 'Samba-canção do Bêbado',
    bpm: 84,
    swing: 0.08,
    prog: [Dm, Gm, A, Dm],
    baixo: 'R.....5.R.....5.',
    acorde: '1--.1--.1--.1--.',
    melodia:
      '74 - - 72 74 - 77 - 76 - 74 - 72 - - - ' +
      '70 - - 69 70 - 74 - 72 - 70 - 69 - - - ' +
      '73 - 76 - 79 - 76 - 73 - 71 - 69 - - - ' +
      '74 - - - 69 - - - 74 - - - . . . .',
    ondas: { lead: 'sine', chords: 'triangle', bass: 'triangle' },
    ganhos: { lead: 0.08, chords: 0.03, bass: 0.13 },
    bateria: ['k.......k.......', '..h...h...h...h.', 'c...c.....c.c...'],
  },
  {
    id: 'sertanejo',
    name: 'Sertanejo da Conta',
    bpm: 112,
    swing: 0,
    prog: [D, A, Bm, G],
    baixo: 'R...5...R...5...',
    acorde: '..1...1...1...1.',
    melodia:
      '78+74 - 76+73 - 78+74 - 81+78 - 78+74 - 76+73 - 74+71 - - - ' +
      '76+73 - 74+71 - 76+73 - 78+74 - 76+73 - - - 73+69 - - - ' +
      '74+71 - 76+73 - 78+74 - 76+73 - 74+71 - 73+69 - 71+67 - - - ' +
      '69+66 - - - 71+67 - 73+69 - 74+71 - - - . . . .',
    ondas: { lead: 'triangle', chords: 'square', bass: 'triangle' },
    ganhos: { lead: 0.08, chords: 0.018, bass: 0.13 },
    bateria: ['k...s...k...s...', 'h.h.h.h.h.h.h.h.'],
    virada: ['k...s...k...s.ss', 'h.h.h.h.h.h.o...'],
  },
  {
    id: 'lofi',
    name: 'Lo-fi da Madrugada',
    bpm: 76,
    swing: 0.12,
    prog: [Fmaj7, Em7, Dm7, Cmaj7],
    baixo: 'R.......5...R...',
    acorde: '1-------..1-----',
    melodia:
      '. . 81 - - - 79 - 76 - - - . . . . ' +
      '. . 79 - - - 76 - 74 - - - . . 72 - ' +
      '74 - - - 77 - 76 - 74 - 72 - - - . . ' +
      '71 - - - 72 - - - 76 - - - . . . .',
    ondas: { lead: 'sine', chords: 'triangle', bass: 'sine' },
    ganhos: { lead: 0.07, chords: 0.025, bass: 0.16 },
    bateria: ['k......k..k.....', '....s.......s...', '..h...h...h...h.'],
  },
];

/** Todas as faixas, na ordem da jukebox: as 8 novas primeiro, depois as de antes. */
export const FAIXAS: readonly Song[] = [...RECEITAS.map(montar), ...SONG_IDS.map((id) => SONGS[id])];

/** Sem ninguém escolher: a faixa da hora (gira sozinha, igual em todo aparelho). */
export function faixaDaHora(t: number): number {
  return Math.floor(t / 3_600_000) % RECEITAS.length;
}

/** Passo da faixa agora, contando da hora da escolha (todo aparelho no mesmo compasso). */
export function passoAgora(f: Song, desde: number, agora: number): number {
  const passoMs = (60 / f.bpm / 4) * 1000;
  const n = Math.floor(Math.max(0, agora - desde) / passoMs);
  return ((n % STEPS) + STEPS) % STEPS;
}

export interface Juke {
  s: number;
  p: string;
  t: number;
}

/** Leitura do banco (`bar/juke`): só aceita faixa que existe (ou -1, desligada). */
export function sanitizeJuke(raw: unknown): Juke | null {
  const r = raw as Partial<Juke> | null;
  if (!r || typeof r !== 'object') return null;
  if (typeof r.s !== 'number' || !Number.isInteger(r.s) || r.s < -1 || r.s >= FAIXAS.length) return null;
  if (typeof r.p !== 'string' || !IDS_RE.test(r.p) || typeof r.t !== 'number') return null;
  return { s: r.s, p: r.p, t: r.t };
}

/**
 * Volume da jukebox para quem está em (x, y): cheio perto dela, cai com a distância no salão, abafado lá fora e
 * no banheiro. 0 = não toca.
 */
export function volumeJukebox(x: number, y: number, jx: number, jy: number, mesmaArea: boolean): number {
  if (!mesmaArea) return 0.12;
  const d = Math.hypot(x - jx, y - jy);
  return Math.max(0.25, Math.min(1, 1.15 - d / 16));
}
