// As mesmas regras de database.rules.json, em JavaScript, para o Firebase falso e para os testes.
// Qualquer mudança nas regras de verdade tem de ser repetida aqui (e o teste das regras confere os dois lados).

// A turma vem de src/turma/turma.ts, igual às regras geradas (scripts/gerar-regras.mjs).
import { TURMA } from '../src/turma/turma.ts';
const IDS_ALT = TURMA.pessoas.map((p) => p.id).join('|');
export const PLAYERS = new RegExp(`^(${IDS_ALT})$`);
/** Fatia 6: os 11 poderes (dano até 100 no vgolpe; `q` no vivo diz qual disparou). */
const PODERES = /^(rajada|tampinhas|arroto|furacao|chope|pagode|raio|torresmo|garcom|pinga|ima)$/;
const KINDS = /^(emoji|tapa|amendoim|cerveja|bigode|bola|brinde|reviver)$/;

const getAt = (tree, keys) => keys.reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), tree);
const coord = (v) => typeof v === 'number' && v >= 0 && v <= 63;
const exactKeys = (v, keys) => !!v && typeof v === 'object' && keys.every((k) => k in v) && Object.keys(v).every((k) => keys.includes(k));

export function setAt(tree, keys, value) {
  const root = structuredClone(tree ?? {});
  if (!keys.length) return value ?? {};
  let n = root;
  for (const k of keys.slice(0, -1)) n = n[k] && typeof n[k] === 'object' ? n[k] : (n[k] = {});
  if (value === null) delete n[keys.at(-1)];
  else n[keys.at(-1)] = value;
  return root;
}

/**
 * Uma gravação seria aceita? `tree` = banco antes; `next` = banco depois de toda a gravação (numa gravação em
 * várias posições, as regras enxergam o resultado inteiro, como o Firebase). Horário do servidor já resolvido.
 */
export function allowedPath(tree, next, keys, value, now) {
  // Fatia 10: o evento inteiro pode ser apagado 1 h depois da abertura (ou se nem abriu). Fora isso, ninguém apaga nada.
  if (keys.length === 4 && keys[0] === 'cruzadabotecos' && keys[1] === 'bar' && keys[2] === 'evento' && (value === null || value === undefined)) {
    if (!EPOCA.test(keys[3])) return false;
    const ab = getAt(tree, [...keys, 'abertura']);
    return !ab || now - ab.at > 3600000;
  }
  if (value === null || value === undefined) return false; // ninguém apaga nada
  // cruzadabotecos/v1/scores/{player}/{code}
  if (keys.length === 5 && keys[0] === 'cruzadabotecos' && keys[1] === 'v1' && keys[2] === 'scores') {
    const [, , , player, code] = keys;
    if (!PLAYERS.test(player) || !/^[A-Za-z0-9_-]{3,64}$/.test(code)) return false;
    if (!exactKeys(value, ['s', 't'])) return false;
    if (typeof value.s !== 'number' || value.s < 0 || value.s > 20000 || typeof value.t !== 'number' || value.t > now) return false;
    const cur = getAt(tree, keys);
    return !cur || value.s >= cur.s;
  }
  if (keys.length === 3 && keys[0] === 'cruzadabotecos' && keys[1] === 'bar' && keys[2] === 'sino') return sinoAllowed(tree, next, value, now);
  // Jukebox do Bar Vivo (Fatia 6): faixa escolhida por qualquer amigo, troca no máximo a cada 3 s.
  if (keys.length === 3 && keys[0] === 'cruzadabotecos' && keys[1] === 'bar' && keys[2] === 'juke') {
    if (!exactKeys(value, ['s', 'p', 't']) || !inteiro(value.s, -1, 31) || typeof value.p !== 'string' || !PLAYERS.test(value.p) || value.t !== now) return false;
    const cur = getAt(tree, keys);
    return !cur || now - cur.t >= 3000;
  }
  if (keys.length < 4 || keys[0] !== 'cruzadabotecos' || keys[1] !== 'bar') return false;
  if (keys[2] === 'kills') return killsAllowed(tree, keys, value, now);
  if (keys[2] === 'config' || keys[2] === 'evento' || keys[2] === 'trofeus') return eventoAllowed(tree, next, keys, value, now);
  if (keys[2] === 'inventario' || keys[2] === 'po' || keys[2] === 'portais') return portalAllowed(tree, keys, value, now);
  const node = keys[2];
  const player = keys[3];
  if (!['mess', 'poca', 'molho', 'mesa'].includes(node) && !PLAYERS.test(player)) return false;
  const rateNow = (p) => getAt(next, ['cruzadabotecos', 'bar', 'rate', p, 'at']) === now;
  if (node === 'presence' && keys.length === 4) {
    if (!exactKeys(value, ['r', 'x', 'y', 'tx', 'ty', 'at', 'on'])) return false;
    if (typeof value.r !== 'string' || !/^[a-z]{1,16}$/.test(value.r)) return false;
    if (![value.x, value.y, value.tx, value.ty].every(coord)) return false;
    if (value.at !== now || typeof value.on !== 'boolean') return false;
    const cur = getAt(tree, keys);
    return !cur || now - cur.at >= 200;
  }
  // Ao vivo (Fatia 3): posição de quem está no Bar Vivo, golpes entre amigos e o retrato dos NPCs de cada um.
  if (node === 'vivo' && keys.length === 4) {
    const req = ['x', 'y', 'fx', 'fy', 'mx', 'my', 'e', 'vi', 'lk', 'at', 'on', 'sv'];
    if (!value || typeof value !== 'object' || !req.every((k) => k in value)) return false;
    if (!Object.keys(value).every((k) => req.includes(k) || k === 'a' || k === 'por' || k === 'w' || k === 'r' || k === 'q')) return false;
    if ('q' in value && (typeof value.q !== 'string' || !PODERES.test(value.q))) return false;
    if ('w' in value && (typeof value.w !== 'string' || !NA_MAO.test(value.w))) return false;
    if ('r' in value && (typeof value.r !== 'number' || value.r < now - 10000 || value.r > now + 5000)) return false;
    const um = (v) => typeof v === 'number' && v >= -1 && v <= 1;
    if (!coord(value.x) || !coord(value.y) || ![value.fx, value.fy, value.mx, value.my].every(um)) return false;
    if (typeof value.e !== 'string' || !/^[nksv]$/.test(value.e)) return false;
    if (typeof value.vi !== 'number' || value.vi < 0 || value.vi > 100) return false;
    if (typeof value.lk !== 'string' || !/^[0-9a-z-]{8,16}$/.test(value.lk)) return false;
    if ('a' in value && value.a !== 1) return false;
    if ('por' in value && (typeof value.por !== 'string' || !PLAYERS.test(value.por) || value.por === player)) return false;
    if (typeof value.at !== 'number' || value.at < now - 5000 || value.at > now + 5000) return false;
    if (typeof value.on !== 'boolean' || value.sv !== now) return false;
    const cur = getAt(tree, keys);
    return !cur || value.at - cur.at >= 100;
  }
  if (node === 'vgolpe' && keys.length === 5) {
    if (!/^[0-9]$/.test(keys[4]) || !exactKeys(value, ['to', 'd', 'kx', 'ky', 'w', 'f', 't'])) return false;
    if (typeof value.to !== 'string' || !/^[a-z0-9]{2,16}$/.test(value.to) || value.to === player) return false;
    if (typeof value.d !== 'number' || value.d < 1 || value.d > (typeof value.w === 'string' && PODERES.test(value.w) ? 100 : 40)) return false;
    if (![value.kx, value.ky].every((v) => typeof v === 'number' && v >= -1 && v <= 1)) return false;
    if (typeof value.w !== 'string' || !GOLPES.test(value.w) || typeof value.f !== 'boolean' || value.t !== now) return false;
    const cur = getAt(tree, keys);
    return !cur || now - cur.t >= 1000;
  }
  if (node === 'npc' && keys.length === 4) {
    if (!exactKeys(value, ['at', 'l']) || value.at !== now || typeof value.l !== 'string' || value.l.length > 1500) return false;
    const cur = getAt(tree, keys);
    return !cur || now - cur.at >= 150;
  }
  // Carteira (gasto e achado só sobem) e mesas de sinuca (a jogada n só avança de 1 em 1, ou recomeça).
  if (node === 'loja' && keys.length === 4) {
    if (!exactKeys(value, ['g', 'a', 't']) || !inteiro(value.g, 0, 1e7) || !inteiro(value.a, 0, 1e7) || value.t !== now) return false;
    const cur = getAt(tree, keys);
    return !cur || (now - cur.t >= 500 && value.g >= cur.g && value.a >= cur.a);
  }
  // Ficha dos procurados: total de nocautes, só sobe e no máximo +10 por gravação (a cada 2 s).
  if (node === 'ficha' && keys.length === 4) {
    if (!exactKeys(value, ['k', 't']) || !inteiro(value.k, 0, 1e7) || value.t !== now) return false;
    const cur = getAt(tree, keys);
    return cur ? now - cur.t >= 2000 && value.k >= cur.k && value.k <= cur.k + 10 : value.k <= 10;
  }
  if (node === 'mesa' && keys.length === 4) {
    if (!/^[01]$/.test(keys[3]) || !exactKeys(value, ['a', 'b', 'v', 'e', 'n', 'tq', 'at'])) return false;
    if (typeof value.a !== 'string' || !VAGA.test(value.a) || typeof value.b !== 'string' || !VAGA.test(value.b)) return false;
    if (value.v !== 0 && value.v !== 1) return false;
    if (typeof value.e !== 'string' || value.e.length > 300 || typeof value.tq !== 'string' || value.tq.length > 60) return false;
    if (!inteiro(value.n, 0, 100000) || value.at !== now) return false;
    const cur = getAt(tree, keys);
    return !cur || value.n === cur.n + 1 || value.n === 0 || now - cur.at > 600000;
  }
  if (node === 'rate' && keys.length === 4) {
    if (!exactKeys(value, ['at']) || value.at !== now) return false;
    const cur = getAt(tree, keys);
    return !cur || now - cur.at >= 2000;
  }
  if (node === 'chat' && keys.length === 5) {
    if (!/^1?[0-9]$/.test(keys[4]) || !exactKeys(value, ['m', 't'])) return false;
    if (typeof value.m !== 'string' || value.m.length < 1 || value.m.length > 140 || value.t !== now) return false;
    return rateNow(player);
  }
  if (node === 'fx' && keys.length === 5) {
    if (!/^[0-9]$/.test(keys[4]) || !exactKeys(value, ['k', 'to', 'e', 't'])) return false;
    if (typeof value.k !== 'string' || !KINDS.test(value.k)) return false;
    if (typeof value.to !== 'string' || !(value.to === '' || PLAYERS.test(value.to))) return false;
    if (typeof value.e !== 'string' || value.e.length > 8 || value.t !== now) return false;
    return rateNow(player);
  }
  if (node === 'marks' && keys.length === 4) {
    if (!exactKeys(value, ['by', 'n', 't'])) return false;
    if (typeof value.by !== 'string' || !PLAYERS.test(value.by)) return false;
    if (typeof value.n !== 'number' || value.n < 0 || value.n > 6 || value.t !== now) return false;
    return rateNow(value.by);
  }
  // Modo sangue: espera de cada arma e geral, golpes e ficha corrida.
  if (node === 'cd' && keys.length === 5) {
    const wait = CD_MS[keys[4]];
    if (wait === undefined || !exactKeys(value, ['at']) || value.at !== now) return false;
    const cur = getAt(tree, keys);
    return !cur || now - cur.at >= wait;
  }
  if (node === 'hit' && keys.length === 5) {
    if (!/^([0-9]|[12][0-9])$/.test(keys[4]) || !exactKeys(value, ['w', 'to', 'r', 'x', 'y', 't'])) return false;
    if (typeof value.r !== 'string' || !/^[a-z]{1,16}$/.test(value.r)) return false;
    if (typeof value.w !== 'string' || !WEAPONS.test(value.w)) return false;
    if (typeof value.to !== 'string' || !PLAYERS.test(value.to) || value.to === player) return false;
    if (!coord(value.x) || !coord(value.y) || value.t !== now) return false;
    const cd = (k) => getAt(next, ['cruzadabotecos', 'bar', 'cd', player, k, 'at']);
    if (cd('geral') !== now || cd(value.w) !== now) return false;
    const target = getAt(tree, ['cruzadabotecos', 'bar', 'presence', value.to]);
    return !!target && target.on === true && target.r !== 'mesa' && target.r === value.r && now - target.at < 90000;
  }
  // Bagunça que fica até as 6 h: móvel caído, poça, molho na parede (sempre com o carimbo de ritmo de 2 s).
  if (node === 'mess' && keys.length === 5) {
    if (!/^[a-z]{1,16}$/.test(keys[3]) || !/^[0-9]{1,2}-[0-9]{1,2}$/.test(keys[4])) return false;
    if (!exactKeys(value, ['d', 'by', 't']) || typeof value.d !== 'boolean' || typeof value.by !== 'string' || !PLAYERS.test(value.by) || value.t !== now) return false;
    return rateNow(value.by);
  }
  if (node === 'poca' && keys.length === 5) {
    if (!/^[a-z]{1,16}$/.test(keys[3]) || !/^[0-5]$/.test(keys[4])) return false;
    if (!exactKeys(value, ['x', 'y', 'by', 'seco', 't']) || !coord(value.x) || !coord(value.y) || typeof value.seco !== 'boolean') return false;
    if (typeof value.by !== 'string' || !PLAYERS.test(value.by) || value.t !== now) return false;
    return rateNow(value.by);
  }
  if (node === 'molho' && keys.length === 6) {
    const p = keys[4];
    if (!/^[a-z]{1,16}$/.test(keys[3]) || !PLAYERS.test(p) || !/^[0-4]$/.test(keys[5])) return false;
    if (!exactKeys(value, ['s', 'u', 'v', 't']) || (value.s !== 'L' && value.s !== 'R') || value.t !== now) return false;
    if (typeof value.u !== 'number' || value.u < 0 || value.u > 400 || typeof value.v !== 'number' || value.v < 0 || value.v > 80) return false;
    return rateNow(p);
  }
  // Quiz da sinuca: abrir a pergunta (o = agora) uma vez por dia; responder uma vez (a = agora, o igual).
  if (node === 'quiz' && keys.length === 5) {
    if (!/^[0-9]$/.test(keys[4]) || !exactKeys(value, ['o', 'k', 'a'])) return false;
    if (typeof value.o !== 'number' || typeof value.a !== 'number') return false;
    if (typeof value.k !== 'number' || !Number.isInteger(value.k) || value.k < -1 || value.k > 3) return false;
    const cur = getAt(tree, keys);
    if (!cur || cur.o < sod(now)) return value.o === now && value.k === -1 && value.a === 0;
    return cur.k === -1 && value.o === cur.o && value.k >= 0 && value.a === now;
  }
  // Anagrama da Saideira: um registro por palavra (0..4); letras reveladas só sobem; depois do acerto, travado.
  if (node === 'ana' && keys.length === 5) {
    if (!/^[0-4]$/.test(keys[4])) return false;
    if (!exactKeys(value, ['r', 'ok', 't']) || value.t !== now || typeof value.ok !== 'boolean') return false;
    if (typeof value.r !== 'number' || !Number.isInteger(value.r) || value.r < 0 || value.r > 9) return false;
    const cur = getAt(tree, keys);
    if (cur && cur.t >= sod(now)) return cur.ok === false && value.r >= cur.r;
    return true;
  }
  // Palavra do Dia: um registro por pessoa; cresce 1 chute por vez, até 6, nada depois do acerto.
  if (node === 'dia' && keys.length === 4) {
    if (!exactKeys(value, ['g', 'n', 'ok', 't']) || value.t !== now) return false;
    if (typeof value.g !== 'string' || !/^[VAX]{5,7}(\|[VAX]{5,7}){0,5}$/.test(value.g)) return false;
    if (typeof value.n !== 'number' || value.n < 1 || value.n > 6 || typeof value.ok !== 'boolean') return false;
    // Duas expressões porque o Firebase só aceita ^ no começo (o mesmo das regras publicadas).
    if (value.ok && !/^V{5,7}$/.test(value.g) && !/\|V{5,7}$/.test(value.g)) return false;
    const cur = getAt(tree, keys);
    if (cur && cur.t >= sod(now)) return cur.ok === false && cur.n < 6 && value.n === cur.n + 1 && value.g.startsWith(cur.g + '|');
    return value.n === 1;
  }
  return false;
}

/** Início do dia (6 h de Brasília), a mesma expressão das regras. */
const sod = (now) => now - ((now - 32400000) % 86400000);

/** bar/sino = { p, t }: o primeiro do dia, e só junto com o próprio acerto na mesma gravação. */
function sinoAllowed(tree, next, value, now) {
  if (!exactKeys(value, ['p', 't']) || typeof value.p !== 'string' || !PLAYERS.test(value.p) || value.t !== now) return false;
  const cur = getAt(tree, ['cruzadabotecos', 'bar', 'sino']);
  if (cur && cur.t >= sod(now)) return false;
  const dia = getAt(next, ['cruzadabotecos', 'bar', 'dia', value.p]);
  return !!dia && dia.ok === true && dia.t === now;
}

/** bar/kills/{matador}/{vítima} = { n, t }: no dia, sobe de 1 em 1 a cada 13 s ou mais; no 1º abate do dia, 1. */
function killsAllowed(tree, keys, value, now) {
  if (keys.length !== 5) return false;
  const [, , , killer, victim] = keys;
  if (!PLAYERS.test(killer) || !PLAYERS.test(victim) || killer === victim) return false;
  if (!exactKeys(value, ['n', 't']) || typeof value.n !== 'number' || value.t !== now) return false;
  const cur = getAt(tree, keys);
  const step = cur && cur.t >= sod(now) ? value.n === cur.n + 1 && now - cur.t >= 13000 : value.n === 1;
  const lastHit = getAt(tree, ['cruzadabotecos', 'bar', 'cd', killer, 'geral', 'at']);
  return step && typeof lastHit === 'number' && now - lastHit < 15000;
}

/** Espera de cada arma e a geral (as mesmas de src/bar/blood.ts e de database.rules.json; o teste confere). */
export const CD_MS = { geral: 10000, soco: 20000, garrafa: 60000, taco: 75000, dardo: 45000, banqueta: 120000, frigideira: 90000 };
const WEAPONS = /^(soco|garrafa|taco|dardo|banqueta|frigideira)$/;
const GOLPES = /^(soco|empurrao|garrafa|caco|banqueta|taco|cadeira|cano|desentupidor|cadeirao|vaso|engradado|lixeira|faca|socoingles|machadinha|serra|frigideira|bastao|violao|extintor|guardasol|tijolo|espeto|placa|rodo|katana|marreta|rajada|tampinhas|arroto|furacao|chope|pagode|raio|torresmo|garcom|pinga|ima|pano|prego|fita|raquete|molotov|tacoprego|espuma|sococaco)$/;
const NA_MAO = /^(garrafa|caco|banqueta|taco|cadeira|cano|desentupidor|cadeirao|vaso|engradado|lixeira|faca|socoingles|machadinha|serra|frigideira|bastao|violao|extintor|guardasol|tijolo|espeto|placa|rodo|katana|marreta|rajada|tampinhas|arroto|furacao|chope|pagode|raio|torresmo|garcom|pinga|ima|pano|prego|fita|raquete|molotov|tacoprego|espuma|sococaco)$/;
const VAGA = new RegExp(`^(${IDS_ALT}|bot[123]|)$`);
const inteiro = (v, a, b) => typeof v === 'number' && Number.isInteger(v) && v >= a && v <= b;

/* ------------------------------------------------------------------ Fatia 10: diretor de eventos */

const EPOCA = /^[0-9]{1,9}$/;
const TIPOS_EVENTO = /^(ratazana|apagao|alien|dragao|dino)$/;
const FINS = /^(morto|religado)$/;
const TROFEUS = /^(rabo|vela|gorjeta|antena|sumiuze|dente|ovo)$/;
const ENTIDADES = /^(rato|alien|grande|disco[0-5]|dragao|dino)$/;

/** config do dono, abertura e fim criados uma vez, livro de dano que só cresce e troféus que só crescem. */
function eventoAllowed(tree, next, keys, value, now) {
  const cur = getAt(tree, keys);
  if (keys[2] === 'config') {
    if (keys.length !== 4 || keys[3] !== 'eventos') return false;
    if (!value || typeof value !== 'object' || value.p !== TURMA.admin || value.t !== now) return false;
    if (Object.keys(value).some((k) => !['mult', 'p', 't', 'forcar'].includes(k))) return false;
    if (typeof value.mult !== 'number' || value.mult < 0 || value.mult > 3) return false;
    if (value.forcar !== undefined) {
      if (!value.forcar || typeof value.forcar !== 'object') return false;
      for (const [k, v] of Object.entries(value.forcar)) if (!EPOCA.test(k) || typeof v !== 'string' || !TIPOS_EVENTO.test(v)) return false;
    }
    return true;
  }
  if (keys[2] === 'trofeus') {
    if (keys.length !== 5 || !TROFEUS.test(keys[3]) || !PLAYERS.test(keys[4])) return false;
    return cur === undefined && value === now;
  }
  // evento/{época}/...
  if (!EPOCA.test(keys[3])) return false;
  const ev = [...keys.slice(0, 4)];
  const parte = keys[4];
  if (parte === 'abertura' && keys.length === 5) {
    if (cur !== undefined || !exactKeys(value, ['n', 'at'])) return false;
    return inteiro(value.n, 1, 5) && value.at === now;
  }
  if (parte === 'fim' && keys.length === 5) {
    if (cur !== undefined || !getAt(tree, [...ev, 'abertura']) || !exactKeys(value, ['como', 'p', 'at'])) return false;
    return typeof value.como === 'string' && FINS.test(value.como) && typeof value.p === 'string' && PLAYERS.test(value.p) && value.at === now;
  }
  if (parte === 'dano' && keys.length === 7) {
    if (!ENTIDADES.test(keys[5]) || !PLAYERS.test(keys[6]) || !getAt(tree, [...ev, 'abertura'])) return false;
    if (!inteiro(value, 0, 100000)) return false;
    return cur === undefined || value >= cur;
  }
  return false;
}

/* ------------------------------------------------------------------ Fatia 13: portais */

const ITENS_PORTAL = /^(mc-camisa-verde|mc-calca-caqui|mc-cabelo-melado|mc-camisa-inseticida|mc-cabelo-asa|mc-camisa-rainha|mc-calca-enxame|mc-cabelo-coroa|qm-camisa-chita|qm-calca-remendo|qm-cabelo-milho|qm-camisa-bandeirinha|qm-calca-quadrilha|qm-cabelo-fogueira|mc-chapeu-bone|qm-chapeu-palha|qm-chapeu-cartola|ch-camisa-avental|ch-calca-carvao|ch-cabelo-fumaca|ch-camisa-samambaia|ch-calca-lava|ch-cabelo-brasa)$/;
const PORTAIS = /^(moscas|quermesse|churrasco)$/;

/** Prêmio criado uma vez (= now), Pó com ganho e gasto que só sobem (gasto ≤ ganho), placar do dia que só sobe. */
function portalAllowed(tree, keys, value, now) {
  const cur = getAt(tree, keys);
  if (keys[2] === 'inventario') {
    if (keys.length !== 5 || !PLAYERS.test(keys[3]) || !ITENS_PORTAL.test(keys[4])) return false;
    return cur === undefined && value === now;
  }
  if (keys[2] === 'po') {
    if (keys.length !== 4 || !PLAYERS.test(keys[3]) || !exactKeys(value, ['g', 's', 't'])) return false;
    if (!inteiro(value.g, 0, 1e7) || !inteiro(value.s, 0, 1e7) || value.s > value.g || value.t !== now) return false;
    return !cur || (now - cur.t >= 500 && value.g >= cur.g && value.s >= cur.s);
  }
  // portais/{portal}/{jogador}: novo dia recomeça; no mesmo dia só sobe, a cada 2 s.
  if (keys.length !== 5 || !PORTAIS.test(keys[3]) || !PLAYERS.test(keys[4]) || !exactKeys(value, ['s', 'f', 'v', 't'])) return false;
  if (!inteiro(value.s, 0, 100000) || !inteiro(value.v, 1, 99) || value.t !== now) return false;
  if (typeof value.f !== 'string' || value.f.length > 2400 || value.f.length % 4 || !/^[0-9a-z]*$/.test(value.f)) return false;
  return !cur || cur.t < sod(now) || (now - cur.t >= 2000 && value.s >= cur.s);
}

/** PUT num caminho. */
export function allowed(tree, keys, value, now = Date.now()) {
  return allowedPath(tree, setAt(tree, keys, value), keys, value, now);
}

/** PATCH em várias posições a partir de `base`: tudo ou nada. Devolve o banco novo ou null. */
export function applyUpdate(tree, base, updates, now = Date.now()) {
  if (!updates || typeof updates !== 'object' || !Object.keys(updates).length) return null;
  let next = tree;
  const paths = Object.entries(updates).map(([rel, v]) => [[...base, ...rel.split('/').filter(Boolean)], v]);
  for (const [keys, v] of paths) next = setAt(next, keys, v);
  for (const [keys, v] of paths) if (!allowedPath(tree, next, keys, v, now)) return null;
  return next;
}
