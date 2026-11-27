const COMBINING_DIACRITICS_RE = /[\u0300-\u036f]/g;
const NON_ASCII_UPPER_LETTER_RE = /[^A-Z]/g;

/**
 * Normalizes a string by decomposing diacritics (NFD), converting to uppercase,
 * and keeping only plain ASCII letters A-Z.
 */
export function normalizeWord(str: string): string {
  if (!str) {
    return '';
  }

  return str
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_RE, '')
    .toUpperCase()
    .replace(NON_ASCII_UPPER_LETTER_RE, '');
}

/**
 * Normalizes a single character (or key input) to an uppercase ASCII letter A-Z,
 * returning an empty string if the input has no valid letter.
 */
export function normalizeLetter(ch: string): string {
  const normalized = normalizeWord(ch);
  return normalized.length > 0 ? normalized.charAt(0) : '';
}
