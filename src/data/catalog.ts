import type { ThemePack, ThemedWordEntry } from '../types/crossword';

export const ALL_THEME_ID = 'all';

const modules = import.meta.glob('./packs/*.json', { eager: true }) as Record<
  string,
  { default?: ThemePack } & Partial<ThemePack>
>;

function isPack(value: unknown): value is ThemePack {
  const v = value as Partial<ThemePack> | undefined;
  return !!v && typeof v.id === 'string' && typeof v.name === 'string' && Array.isArray(v.entries);
}

function loadPacks(): ThemePack[] {
  const packs: ThemePack[] = [];
  for (const path of Object.keys(modules).sort()) {
    const mod = modules[path];
    const candidate = (mod && 'default' in mod && mod.default ? mod.default : mod) as unknown;
    if (isPack(candidate)) packs.push(candidate);
  }
  return packs;
}

export const THEME_PACKS: ThemePack[] = loadPacks();

export const ALL_ENTRIES: ThemedWordEntry[] = THEME_PACKS.flatMap((pack) =>
  pack.entries.map((entry) => ({ ...entry, themeId: pack.id, themeName: pack.name })),
);

/** Pseudo-tema para o Desafio Misto. */
export const ALL_PACK: ThemePack = {
  id: ALL_THEME_ID,
  name: 'Misto / Todos os Temas',
  description: 'Palavras de todos os temas misturadas em um único tabuleiro.',
  icon: 'Shuffle',
  color: '#d97706',
  entries: ALL_ENTRIES,
};

export function getTheme(id: string): ThemePack | undefined {
  if (id === ALL_THEME_ID) return ALL_PACK;
  return THEME_PACKS.find((p) => p.id === id);
}

export function totalWords(): number {
  return ALL_ENTRIES.length;
}
