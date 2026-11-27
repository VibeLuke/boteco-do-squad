/** O que o resto do jogo usa da turma (derivado de turma.ts; não edite aqui). */
import { TURMA, type PessoaDef } from './turma';

export { TURMA };
export type { PessoaDef, Estilo } from './turma';

export type PlayerId = (typeof TURMA.pessoas)[number]['id'];
export const IDS = TURMA.pessoas.map((p) => p.id) as readonly PlayerId[];
export const ADMIN = TURMA.admin as PlayerId;
export const PESSOAS: readonly (PessoaDef & { id: PlayerId })[] = TURMA.pessoas;
export const NOME_DE = Object.fromEntries(TURMA.pessoas.map((p) => [p.id, p.name])) as Record<PlayerId, string>;
/** `id1|id2|…`: o miolo da regex dos ids (o mesmo que vai para as regras do banco). */
export const IDS_ALT = IDS.join('|');
export const IDS_RE = new RegExp(`^(${IDS_ALT})$`);
export const MAX_TURMA = 5;
