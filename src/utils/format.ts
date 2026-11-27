import type { DifficultyLevel } from '../types/crossword';

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatMultiplier(value: number): string {
  return `×${String(value).replace('.', ',')}`;
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const DIFFICULTY_LETTER: Record<DifficultyLevel, string> = { easy: 'F', medium: 'M', hard: 'D' };
export const LETTER_DIFFICULTY: Record<string, DifficultyLevel> = { F: 'easy', M: 'medium', D: 'hard' };

export interface ShareCode {
  seed: string;
  difficulty: DifficultyLevel;
  themeId: string;
}

/** Código completo: SEED.NIVEL.TEMA — reproduz exatamente o mesmo tabuleiro. */
export function buildShareCode(seed: string, difficulty: DifficultyLevel, themeId: string): string {
  return `${seed}.${DIFFICULTY_LETTER[difficulty]}.${themeId}`;
}

/**
 * Aceita "LEX-AB12" (usa nível/tema atuais) ou "LEX-AB12.M.astronomia" (completo).
 */
export function parseShareCode(
  raw: string,
  fallback: { difficulty: DifficultyLevel; themeId: string },
): ShareCode | null {
  const text = decodeURIComponent(raw).trim();
  if (!text) return null;
  const parts = text.split('.');
  const seed = (parts[0] ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,30}$/.test(seed)) return null;
  const lvl = parts[1] ? LETTER_DIFFICULTY[parts[1].trim().toUpperCase()] : undefined;
  const themeId = parts[2] ? parts.slice(2).join('.').trim() : fallback.themeId;
  return { seed, difficulty: lvl ?? fallback.difficulty, themeId: themeId || fallback.themeId };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* cai no fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
