// Testes da Fatia 3 (rede pura): dois mundos (Will e Vini) ligados por um "banco" em memória com atraso, relógio
// torto, retrato inteiro na reconexão, golpes repetidos e nocaute contado uma vez só.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({
  resolve(spec, ctx, next) {
    if ((spec.startsWith('./') || spec.startsWith('../')) && !path.extname(spec) && ctx.parentURL) {
      const cand = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), `${spec}.ts`);
      if (fs.existsSync(cand)) return next(pathToFileURL(cand).href, ctx);
    }
    return next(spec, ctx);
  },
});

const B = await import('../src/vivo/briga.ts');
const R = await import('../src/vivo/rede.ts');
const mapa = await import('../src/vivo/mapa.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

const T0 = 1_800_000_300_000;
const DT = 1 / 60;
const LK = '01234567';

/** Banco em memória: grava com atraso (ms), e quem lê vê só o que já "chegou". */
function banco(atraso = 170) {
  const fila = [];
  const vivo = {};
  const golpes = {};
  return {
    vivo,
    golpes,
    gravarVivo(agora, p, s) {
      fila.push({ chega: agora + atraso, f: () => (vivo[p] = { ...s, at: agora, on: true }) });
    },
    gravarGolpe(agora, p, slot, g) {
      fila.push({ chega: agora + atraso, f: () => ((golpes[p] ??= {})[slot] = { ...g, t: agora }) });
    },
    sair(agora, p) {
      fila.push({ chega: agora + atraso, f: () => vivo[p] && (vivo[p] = { ...vivo[p], on: false, at: agora + atraso }) });
    },
    entregar(agora) {
      for (let i = 0; i < fila.length; ) {
        if (fila[i].chega <= agora) {
          fila[i].f();
          fila.splice(i, 1);
        } else i++;
      }
    },
  };
}

/** Um jogador: mundo próprio, elo, envio e anel de golpes. */
function jogador(id, db, semente = 7) {
  const m = B.novoMundo(id, T0, semente);
  // Sem NPCs no caminho: os testes são da rede.
  for (const c of m.corpos) if (c.quem === 'npc') {
    c.x = 33;
    c.y = 2;
    c.estado = 'ko';
    c.koAte = Infinity;
    c.vida = 0;
    c.ausente = true;
  }
  const elo = new R.Elo(id);
  let slot = 0;
  return {
    id,
    m,
    elo,
    retrato: 1,
    quadro(agora, ent = {}) {
      elo.receber(m, R.sanitizeVivo(db.vivo), R.sanitizeVGolpes(db.golpes), this.retrato, agora, DT);
      B.passo(m, { ...B.PARADO, ...ent }, DT);
      for (const e of m.eventos) if (e.k === 'acerto') db.gravarGolpe(agora, id, slot++ % R.GOLPE_SLOTS, R.golpeDoEvento(e));
      const s = elo.enviar(m, { mx: ent.mx ?? 0, my: ent.my ?? 0 }, LK, agora);
      if (s) db.gravarVivo(agora, id, s);
      const ev = [...m.eventos];
      m.eventos.length = 0;
      return ev;
    },
  };
}

function rodar(db, js, ms, agora, ents = {}) {
  const n = Math.round(ms / 1000 / DT);
  const ev = Object.fromEntries(js.map((j) => [j.id, []]));
  for (let i = 0; i < n; i++) {
    agora.t += DT * 1000;
    db.entregar(agora.t);
    for (const j of js) ev[j.id].push(...j.quadro(agora.t, (ents[j.id] ?? (() => ({})))(i)));
  }
  return ev;
}

const corpoDe = (j, outro) => B.achar(j.m, `amigo:${outro}`);

/* ------------------------------------------------------------------ estado e envio */

test('sanitizeVivo: aceita o estado certo e recusa lixo (fora do mapa, roupa torta, jogador falso)', () => {
  const bom = { x: 5, y: 6, fx: 1, fy: 0, mx: 0.71, my: 0.71, e: 'n', vi: 90, lk: LK, at: 1, on: true };
  const out = R.sanitizeVivo({ vini: bom, ze: bom, will: { ...bom, x: 99 }, bia: { ...bom, lk: 'AB' }, tati: { ...bom, e: 'x' } });
  assert.deepEqual(Object.keys(out), ['vini']);
  assert.equal(R.sanitizeVivo({ vini: { ...bom, a: 1 } }).vini.a, 1);
  assert.equal(R.sanitizeVivo({ vini: { ...bom, por: 'will' } }).vini.por, 'will');
  assert.equal(R.sanitizeVivo({ vini: { ...bom, por: 'ze' } }).vini.por, undefined);
  assert.deepEqual(R.sanitizeVivo(null), {});
});

test('online: some depois de 25 s sem envio ou com on falso', () => {
  const e = { x: 5, y: 6, fx: 1, fy: 0, mx: 0, my: 0, e: 'n', vi: 90, lk: LK, at: 1000, on: true };
  assert.ok(R.online(e, 1000 + 24_000));
  assert.ok(!R.online(e, 1000 + 25_000));
  assert.ok(!R.online({ ...e, on: false }, 1001));
  assert.ok(!R.online(undefined, 1001));
});

test('direcao8: arredonda para 8 sentidos e parado é 0,0', () => {
  assert.deepEqual(R.direcao8(0.02, 0.03), { mx: 0, my: 0 });
  assert.deepEqual(R.direcao8(1, 0.1), { mx: 1, my: 0 });
  assert.deepEqual(R.direcao8(0.6, 0.55), { mx: 0.71, my: 0.71 });
  assert.deepEqual(R.direcao8(-0.1, -1), { mx: 0, my: -1 });
});

test('deveEnviar: muda de direção manda já, andando corrige a cada 1 s, parado bate a cada 10 s, nunca < 120 ms', () => {
  const s = { x: 5, y: 5, fx: 1, fy: 0, mx: 1, my: 0, e: 'n', vi: 100, lk: LK };
  assert.ok(R.deveEnviar(null, s, 0));
  const ant = { s, em: 1000 };
  assert.ok(!R.deveEnviar(ant, { ...s, mx: 0 }, 1100), 'mandou antes de 120 ms');
  assert.ok(R.deveEnviar(ant, { ...s, mx: 0 }, 1130));
  assert.ok(!R.deveEnviar(ant, { ...s, x: 6 }, 1900));
  assert.ok(R.deveEnviar(ant, { ...s, x: 6 }, 2000));
  const parado = { s: { ...s, mx: 0 }, em: 1000 };
  assert.ok(!R.deveEnviar(parado, { ...s, mx: 0, x: 5.2 }, 9000));
  assert.ok(R.deveEnviar(parado, { ...s, mx: 0, x: 5.4 }, 1200), 'empurrão parado não corrigiu');
  assert.ok(R.deveEnviar(parado, { ...s, mx: 0 }, 11_000));
  assert.ok(!R.deveEnviar(ant, { ...s, vi: 97 }, 1200));
  assert.ok(R.deveEnviar(ant, { ...s, vi: 95 }, 1200));
  assert.ok(R.deveEnviar(ant, { ...s, e: 'k' }, 1200));
  assert.ok(R.deveEnviar(ant, { ...s, a: 1 }, 1200));
});

test('prever: anda até 1,6 s na direção mandada e para na parede', () => {
  const e = { x: 5.5, y: 8.5, fx: 1, fy: 0, mx: 1, my: 0, e: 'n', vi: 100, lk: LK, at: 0, on: true };
  const p = R.prever(e, 500);
  assert.ok(Math.abs(p.x - (5.5 + B.VEL_EU * 0.5)) < 0.05, `x ${p.x}`);
  const p2 = R.prever(e, 5000);
  assert.ok(Math.abs(p2.x - (5.5 + B.VEL_EU * 1.6)) < 0.05, 'passou de 1,6 s');
  assert.equal(p2.andando, false);
  const parede = R.prever({ ...e, x: 2, y: 8.5, mx: -1 }, 1600);
  assert.ok(parede.x >= 0.3 && parede.x < 2, `atravessou: ${parede.x}`);
  assert.deepEqual(R.prever({ ...e, e: 'k' }, 500), { x: 5.5, y: 8.5, andando: false });
});

test('passoRelogio: atrasado puxa até 50 % por quadro, muito atrasado salta, adiantado anda devagar (nunca volta)', () => {
  const dt = 1000 / 60;
  assert.ok(Math.abs(R.passoRelogio(dt, 0, dt) - dt) < 1e-9);
  const atr = R.passoRelogio(dt, 0, dt + 400);
  assert.ok(atr > dt && atr <= dt * 1.5);
  assert.equal(R.passoRelogio(dt, 0, 5000), 5000);
  const adi = R.passoRelogio(dt, 1000, dt);
  assert.ok(adi >= dt * 0.5 && adi < dt);
  // Com a diferença constante, em ~3 s o mundo alcança a hora do servidor.
  let tm = 0;
  let ts = 1500;
  for (let i = 0; i < 180; i++) {
    tm += R.passoRelogio(dt, tm, ts + dt);
    ts += dt;
  }
  assert.ok(Math.abs(ts - tm) < 30, `ficou ${ts - tm} ms longe`);
});

test('sanitizeVGolpes: só a fila de quem bate, slot 0–9, dano 1–40, arma conhecida, sem bater em si mesmo', () => {
  const g = { to: 'vini', d: 12, kx: 1, ky: 0, w: 'soco', f: false, t: 5 };
  const out = R.sanitizeVGolpes({ will: { 0: g, 3: { ...g, d: 99 }, 10: g, 4: { ...g, w: 'bazuca' }, 5: { ...g, to: 'will' } }, ze: { 0: g } });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { de: 'will', slot: 0, ...g });
  assert.equal(R.sanitizeVGolpes({ will: { 0: { ...g, w: 'garrafa' } } }).length, 1);
});

/* ------------------------------------------------------------------ dois aparelhos */

test('presença: o Vini entra, anda e o Will vê ele chegar perto do lugar certo; sai e volta a dormir no canto', () => {
  const db = banco(170);
  const agora = { t: T0 };
  const will = jogador('will', db);
  const vini = jogador('vini', db);
  B.eu(vini.m).x = 8.5;
  B.eu(vini.m).y = 9.5;
  corpoDe(will, 'vini').ink = 2; // dormia rabiscado
  const ev = rodar(db, [will, vini], 600, agora);
  const cm = corpoDe(will, 'vini');
  assert.equal(cm.quem, 'remoto');
  assert.equal(cm.ink, 0, 'acordou com o bigode');
  assert.ok(ev.will.some((e) => e.k === 'aviso' && /Vini entrou/.test(e.texto)));
  rodar(db, [will, vini], 1500, agora, { vini: () => ({ mx: 1, my: 0 }) });
  const real = B.eu(vini.m);
  assert.ok(Math.hypot(cm.x - real.x, cm.y - real.y) < 0.6, `Will vê Vini em ${cm.x.toFixed(2)} e ele está em ${real.x.toFixed(2)}`);
  assert.ok(cm.andando);
  // Parou: chega lá e para.
  rodar(db, [will, vini], 800, agora);
  assert.ok(Math.hypot(cm.x - real.x, cm.y - real.y) < 0.1);
  assert.ok(!cm.andando);
  // Saiu (on falso): volta a dormir no canto.
  db.sair(agora.t, 'vini');
  const ev2 = rodar(db, [will], 400, agora);
  assert.equal(cm.quem, 'amigo');
  assert.equal(cm.estado, 'ko');
  assert.deepEqual([cm.x, cm.y], [...mapa.CANTOS.vini.at]);
  assert.ok(ev2.will.some((e) => e.k === 'aviso' && /Vini saiu/.test(e.texto)));
});

test('presença: sem envio por 25 s (aba fechada sem avisar) também volta a dormir', () => {
  const db = banco(100);
  const agora = { t: T0 };
  const will = jogador('will', db);
  const vini = jogador('vini', db);
  rodar(db, [will, vini], 300, agora);
  assert.equal(corpoDe(will, 'vini').quem, 'remoto');
  rodar(db, [will], 26_000, agora);
  assert.equal(corpoDe(will, 'vini').quem, 'amigo');
});

test('briga: o Will soca o Vini; quem bate decide, o Vini leva no aparelho dele (uma vez) e o Will só vê o sangue', () => {
  const db = banco(170);
  const agora = { t: T0 };
  const will = jogador('will', db);
  const vini = jogador('vini', db);
  const eo = B.eu(will.m);
  const em = B.eu(vini.m);
  eo.x = 8.5; eo.y = 9.5; eo.fx = 1; eo.fy = 0;
  em.x = 9.2; em.y = 9.5; em.fx = -1; em.fy = 0;
  rodar(db, [will, vini], 500, agora);
  assert.equal(corpoDe(will, 'vini').quem, 'remoto');
  const vidaRemota = corpoDe(will, 'vini').vida;
  const ev = rodar(db, [will, vini], 900, agora, { will: (i) => ({ soco: i === 0 }) });
  // No Will: acerto saiu pela rede, a vida do Vini só muda quando o estado dele volta.
  assert.ok(ev.will.some((e) => e.k === 'acerto' && e.em === 'vini'), 'o soco do Will não acertou');
  assert.ok(ev.will.some((e) => e.k === 'golpe' && e.em === 'amigo:vini'));
  assert.ok(em.vida < B.VIDA_EU, 'o Vini não levou');
  const levou = B.VIDA_EU - em.vida;
  assert.ok(levou >= 4 && levou <= 40, `levou ${levou}`);
  assert.equal(ev.vini.filter((e) => e.k === 'golpe' && e.em === 'eu').length, 1, 'aplicou o mesmo golpe 2 vezes');
  // Sem novo soco, nada mais acontece com ele.
  const vida = em.vida;
  rodar(db, [will, vini], 600, agora);
  assert.equal(em.vida, vida);
  assert.ok(corpoDe(will, 'vini').vida <= vidaRemota);
});

test('reconexão: o retrato inteiro que chega de novo não reaplica golpes antigos; golpe com mais de 5 s não vale', () => {
  const db = banco(100);
  const agora = { t: T0 };
  const will = jogador('will', db);
  const vini = jogador('vini', db);
  const g = { to: 'vini', d: 10, kx: 1, ky: 0, w: 'soco', f: false };
  db.gravarGolpe(agora.t, 'will', 0, g);
  rodar(db, [will, vini], 300, agora);
  const em = B.eu(vini.m);
  assert.equal(em.vida, B.VIDA_EU - 10);
  // Reconexão: o mesmo golpe vem no retrato novo.
  vini.retrato++;
  rodar(db, [will, vini], 300, agora);
  assert.equal(em.vida, B.VIDA_EU - 10);
  // Golpe novo chega antes do retrato mudar: vale.
  db.gravarGolpe(agora.t, 'will', 1, g);
  rodar(db, [will, vini], 300, agora);
  assert.equal(em.vida, B.VIDA_EU - 20);
  // Golpe velho (atrasado 6 s): ignorado.
  db.golpes.will[2] = { ...g, t: agora.t - 6000 };
  rodar(db, [will, vini], 100, agora);
  assert.equal(em.vida, B.VIDA_EU - 20);
  // Primeiro retrato de quem acabou de entrar: o que já estava lá não vale.
  const dani = jogador('dani', db);
  db.golpes.will[3] = { ...g, to: 'dani', t: agora.t };
  rodar(db, [dani], 100, agora);
  assert.equal(B.eu(dani.m).vida, B.VIDA_EU);
});

test('nocaute: o Vini cai pela mão do Will, manda por=will, e o Will conta o nocaute uma vez só', () => {
  const db = banco(170);
  const agora = { t: T0 };
  const will = jogador('will', db);
  const vini = jogador('vini', db);
  rodar(db, [will, vini], 400, agora);
  const em = B.eu(vini.m);
  em.vida = 12;
  db.gravarGolpe(agora.t, 'will', 0, { to: 'vini', d: 30, kx: 1, ky: 0, w: 'soco', f: true });
  const ev = rodar(db, [will, vini], 1500, agora);
  assert.equal(em.estado, 'ko');
  assert.equal(vini.elo.ultimo().por, 'will');
  assert.equal(will.m.nocautes, 1);
  assert.equal(ev.will.filter((e) => e.k === 'ko' && e.em === 'amigo:vini').length, 1);
  assert.equal(corpoDe(will, 'vini').estado, 'ko');
  // Continua caído vários envios depois: não conta de novo.
  rodar(db, [will, vini], 3000, agora);
  assert.equal(will.m.nocautes, 1);
});

test('antecipação: quem apanha vê o amigo armando o soco (pose de golpe) antes de levar', () => {
  const db = banco(60);
  const agora = { t: T0 };
  const will = jogador('will', db);
  const vini = jogador('vini', db);
  rodar(db, [will, vini], 300, agora);
  let viu = false;
  rodar(db, [will, vini], 400, agora, {
    will: (i) => {
      if (B.poseDe(corpoDe(vini, 'will'), agora.t) === 'punch') viu = true;
      return { soco: i === 0 };
    },
  });
  assert.ok(viu, 'o Vini nunca viu o Will armar');
  // O corpo remoto nunca solta golpe no mundo do Vini (quem decide é o Will).
  const ev = rodar(db, [vini], 600, agora);
  assert.ok(!ev.vini.some((e) => e.k === 'golpe' && e.de === 'amigo:will'));
});

test('arrastado: o Will segurava o Vini desmaiado e ele entrou; larga na hora', () => {
  const db = banco(100);
  const agora = { t: T0 };
  const will = jogador('will', db);
  const eo = B.eu(will.m);
  const cm = corpoDe(will, 'vini');
  eo.x = cm.x + 0.5;
  eo.y = cm.y;
  eo.fx = -1;
  eo.fy = 0;
  rodar(db, [will], 100, agora, { will: (i) => ({ agarra: i === 0 }) });
  assert.equal(eo.segurando, 'amigo:vini');
  const vini = jogador('vini', db);
  rodar(db, [will, vini], 400, agora);
  assert.equal(eo.segurando, null);
  assert.equal(cm.quem, 'remoto');
});

test('relógio: com o relógio do aparelho 7 s torto, a amostra mais rápida acerta; amostra lenta não estraga', () => {
  const torto = 7000; // servidor = aparelho + 7 s
  const r = { offset: 0, rtt: Infinity, em: -Infinity };
  // Ida 40 ms, volta 160 ms (amostra ruim, assimétrica): erro de 60 ms.
  assert.ok(R.aprenderRelogio(r, 1000 + 40 + torto, 1000, 1200));
  assert.ok(Math.abs(r.offset - torto) <= 60);
  // Ida e volta de 30 ms cada: o meio é exato.
  assert.ok(R.aprenderRelogio(r, 2030 + torto, 2000, 2060));
  assert.equal(r.offset, torto);
  // Uma lenta (800 ms) logo depois não é aceita.
  assert.ok(!R.aprenderRelogio(r, 3100 + torto, 3000, 3800));
  assert.equal(r.offset, torto);
  // 60 s sem amostra boa: aceita a que vier.
  assert.ok(R.aprenderRelogio(r, 70_400 + torto, 70_000, 70_800));
  assert.ok(Math.abs(r.offset - torto) <= 400);
  assert.ok(!R.aprenderRelogio(r, 'x', 1, 2));
  // O mundo com esse relógio anda junto do servidor (passoRelogio puxa a diferença que sobrou).
  const dt = 1000 / 60;
  let tm = 1000;
  let ts = 1000 + 900;
  for (let i = 0; i < 240; i++) {
    tm += R.passoRelogio(dt, tm, ts + dt);
    ts += dt;
  }
  assert.ok(Math.abs(ts - tm) < 20);
});

test('soRapido: posição, golpe e NPC não redesenham os painéis; chat, bigode e placar sim', () => {
  assert.ok(R.soRapido('put', '/vivo/will', {}));
  assert.ok(R.soRapido('put', '/vgolpe/will/3', {}));
  assert.ok(R.soRapido('put', '/npc', null));
  assert.ok(R.soRapido('patch', '/', { 'vivo/will': {}, 'npc/will': {} }));
  assert.ok(!R.soRapido('patch', '/', { 'vivo/will': {}, 'rate/will': {} }));
  assert.ok(!R.soRapido('put', '/', {}));
  assert.ok(!R.soRapido('put', '/marks/vini', {}));
  assert.ok(!R.soRapido('put', '/vivox', {}));
  assert.ok(!R.soRapido('patch', '/', {}));
});

/* ------------------------------------------------------------------ NPC quente com dono */

/** Dois jogadores com um NPC de verdade (o Marrento) no mesmo lugar, e o retrato de NPC passando pelo banco. */
function comNpc(atraso = 150) {
  const db = banco(atraso);
  db.npc = {};
  const fila = [];
  const agora = { t: T0 };
  const mk = (id) => {
    const j = jogador(id, db);
    const mar = B.achar(j.m, 'marrento');
    Object.assign(mar, { ausente: false, estado: 'normal', vida: mar.vidaMax, koAte: 0, x: 9.5, y: 9.5, humor: 'voltando', rota: null });
    let em = -1e9;
    let ult = '';
    const quadro = j.quadro.bind(j);
    j.quadro = (t, ent) => {
      j.elo.receberNpc(j.m, db.npc, t, DT);
      const ev = quadro(t, ent);
      if (t - em >= R.NPC_ENVIO_MS) {
        const l = j.elo.linhaNpc(j.m);
        if (l || ult) {
          fila.push({ chega: t + atraso, f: () => (db.npc[id] = { at: t, l }) });
          ult = l;
          em = t;
        }
      }
      return ev;
    };
    return j;
  };
  const entregar = db.entregar.bind(db);
  db.entregar = (t) => {
    entregar(t);
    for (let i = 0; i < fila.length; )
      if (fila[i].chega <= t) {
        fila[i].f();
        fila.splice(i, 1);
      } else i++;
  };
  return { db, agora, mk };
}

test('linha do NPC: ida e volta, lixo recusado, até 30 NPCs e os móveis quebrados', () => {
  const m = B.novoMundo('will', T0, 3);
  const c = B.achar(m, 'marrento');
  c.quenteAte = m.t + 3000;
  c.x = 9.256;
  c.fase = 'antes';
  B.quebrar(m, mapa.PROPS.findIndex((p) => mapa.QUEBRAVEIS.has(p.kind)));
  const l = R.linhaNpc(m);
  const { npcs, quebrados } = R.lerLinhaNpc(l);
  assert.equal(npcs.length, 1);
  assert.equal(npcs[0].id, 'marrento');
  assert.equal(npcs[0].x, 9.26);
  assert.equal(npcs[0].a, true);
  assert.equal(quebrados.length, 1);
  assert.equal(R.lerLinhaNpc('marrento,99,1,1,n,0,0,0;ZZ,1,1,1,n,0,0,0;ok1,1,1,1,x,0,0,0').npcs.length, 0);
  assert.equal(R.lerLinhaNpc('x'.repeat(1501)).npcs.length, 0);
  // Móvel que não existe (ou não quebra) não entra: índice torto travava o laço de quadros de quem recebe.
  const parede = mapa.PROPS.findIndex((p) => !mapa.QUEBRAVEIS.has(p.kind));
  assert.deepEqual(R.lerLinhaNpc(`marrento,1,1,1,n,0,0,0|9999,${mapa.PROPS.length},${parede}`).quebrados, []);
  const will = B.novoMundo('will', T0, 3);
  const elo = new R.Elo('will');
  elo.receberNpc(will, { vini: { at: T0, l: 'marrento,1,1,1,n,0,0,0|9999' } }, T0, DT); // não pode lançar erro
  for (const o of m.corpos) if (o.quem === 'npc') o.quenteAte = m.t + 3000;
  assert.ok(R.linhaNpc(m).length <= 1500, `linha com ${R.linhaNpc(m).length} caracteres`);
  // Esfriou: linha vazia.
  for (const o of m.corpos) o.quenteAte = 0;
  assert.equal(R.linhaNpc(m), '');
});

test('NPC com dono: o Will bate no Marrento, ele vira marionete do Will no Vini; o soco do Vini nele vai para o Will', () => {
  const { db, agora, mk } = comNpc();
  const will = mk('will');
  const vini = mk('vini');
  const eo = B.eu(will.m);
  Object.assign(eo, { x: 8.8, y: 9.5, fx: 1, fy: 0 });
  Object.assign(B.eu(vini.m), { x: 10.5, y: 10.5 });
  rodar(db, [will, vini], 300, agora, { will: (i) => ({ soco: i === 0 }) });
  const marDono = B.achar(will.m, 'marrento');
  const marOutro = B.achar(vini.m, 'marrento');
  assert.ok(marDono.quenteAte > will.m.t, 'o Marrento não esquentou no Will');
  rodar(db, [will, vini], 400, agora);
  assert.equal(marOutro.dono, 'will', 'no Vini o Marrento não é do Will');
  assert.equal(marDono.dono, null);
  // O Marrento anda no Will e o Vini vê ele no mesmo lugar.
  rodar(db, [will, vini], 600, agora);
  assert.ok(Math.hypot(marDono.x - marOutro.x, marDono.y - marOutro.y) < 0.5, `Will ${marDono.x.toFixed(2)} × Vini ${marOutro.x.toFixed(2)}`);
  assert.equal(marOutro.vida, Math.round(marDono.vida));
  // O Vini soca o Marrento (marionete): só o sangue no Vini; a vida cai no Will.
  const em = B.eu(vini.m);
  Object.assign(em, { x: marOutro.x - 0.7, y: marOutro.y, fx: 1, fy: 0 });
  const vidaDono = marDono.vida;
  const ev = rodar(db, [will, vini], 700, agora, { vini: (i) => ({ soco: i === 0 }) });
  assert.ok(ev.vini.some((e) => e.k === 'acerto' && e.em === 'marrento'), 'o soco do Vini não saiu pela rede');
  assert.ok(marDono.vida < vidaDono, 'o Will não aplicou o soco do Vini');
  assert.ok(marDono.quenteAte > will.m.t, 'o Marrento esfriou no meio da briga');
});

test('NPC com dono: esfriou (3 s sem contato) e volta à rotina nos dois; caído, o Seu Zé recolhe no Vini também', () => {
  const { db, agora, mk } = comNpc();
  const will = mk('will');
  const vini = mk('vini');
  const marDono = B.achar(will.m, 'marrento');
  const marOutro = B.achar(vini.m, 'marrento');
  marDono.quenteAte = will.m.t + 600;
  marDono.vida = 0;
  marDono.estado = 'ko';
  marDono.koAte = Infinity;
  rodar(db, [will, vini], 400, agora);
  assert.equal(marOutro.dono, 'will');
  assert.equal(marOutro.estado, 'ko');
  rodar(db, [will, vini], 1500, agora);
  assert.equal(marOutro.dono, null, 'não soltou');
  assert.equal(marOutro.estado, 'ko');
  assert.ok(vini.m.tarefas.some((x) => x.k === 'corpo' && x.id === 'marrento'), 'o Zé do Vini não vai recolher');
});

test('NPC com dono: marionete não pensa (não bate em ninguém); dono some sem avisar e em 1,5 s o NPC volta', () => {
  const { db, agora, mk } = comNpc();
  const will = mk('will');
  const vini = mk('vini');
  const marDono = B.achar(will.m, 'marrento');
  const marOutro = B.achar(vini.m, 'marrento');
  marDono.quenteAte = Infinity;
  marDono.atordoadoAte = Infinity; // parado no Will
  rodar(db, [will, vini], 400, agora);
  assert.equal(marOutro.dono, 'will');
  // No Vini, a marionete com raiva dele e colada nele: quem decide é o Will (que deixou o Marrento parado).
  const em = B.eu(vini.m);
  Object.assign(marOutro, { humor: 'briga', alvo: 'eu', humorAte: Infinity });
  Object.assign(em, { x: marOutro.x + 0.6, y: marOutro.y });
  const ev = rodar(db, [will, vini], 1500, agora);
  assert.ok(!ev.vini.some((e) => e.k === 'golpe' && e.de === 'marrento'), 'a marionete bateu sozinha');
  assert.equal(em.vida, B.VIDA_EU);
  // Longe do Vini, com raiva: a marionete fica onde o retrato do Will manda (não anda atrás dele sozinha).
  Object.assign(em, { x: marOutro.x + 2.5, y: marOutro.y });
  rodar(db, [will, vini], 500, agora);
  let longe = 0;
  for (let i = 0; i < 40; i++) {
    rodar(db, [will, vini], 50, agora);
    const r = R.lerLinhaNpc(db.npc.will.l).npcs.find((n) => n.id === 'marrento');
    longe = Math.max(longe, Math.hypot(marOutro.x - r.x, marOutro.y - r.y));
  }
  assert.ok(longe < 0.05, `a marionete andou sozinha (${longe.toFixed(2)} longe do retrato)`);
  // O Will fecha a aba (para de mandar, sem linha vazia): o Vini solta o Marrento.
  rodar(db, [vini], 1000, agora);
  assert.equal(marOutro.dono, 'will', 'soltou cedo demais');
  rodar(db, [vini], 800, agora);
  assert.equal(marOutro.dono, null, 'retrato velho segurou o NPC');
});

test('NPC com dono: o Vini provoca o Marrento do Will e sai; toda pancada que o Vini leva vem com o Marrento como marionete do Will', () => {
  const { db, agora, mk } = comNpc();
  const will = mk('will');
  const vini = mk('vini');
  const marDono = B.achar(will.m, 'marrento');
  const marOutro = B.achar(vini.m, 'marrento');
  Object.assign(B.eu(will.m), { x: 5.5, y: 12.5 });
  const em = B.eu(vini.m);
  Object.assign(em, { x: 8.8, y: 9.5, fx: 1, fy: 0 });
  marDono.quenteAte = will.m.t + 3000; // o Will pegou o Marrento antes
  rodar(db, [will, vini], 400, agora);
  assert.equal(marOutro.dono, 'will');
  // O Vini bate e fica parado: o Marrento (no Will) vem atrás dele e revida pela rede.
  Object.assign(em, { x: marOutro.x - 0.7, y: marOutro.y, fx: 1, fy: 0 });
  const fantasmas = [];
  let vida = em.vida;
  let levou = 0;
  for (let i = 0; i < 160; i++) {
    rodar(db, [will, vini], 50, agora, { vini: (k) => ({ soco: i === 0 && k === 0 }) });
    if (em.vida < vida - 0.5) {
      levou++;
      if (marOutro.dono !== 'will') fantasmas.push(`${i * 50} ms: dono ${marOutro.dono}`);
    }
    vida = em.vida;
  }
  assert.ok(levou > 0, 'o Marrento nem revidou (o teste não provou nada)');
  assert.deepEqual(fantasmas, [], `pancada de NPC solto: ${fantasmas.join(', ')}`);
});

test('NPC com dono: os dois batem no mesmo NPC livre ao mesmo tempo; fica com o primeiro da ordem (Vini) nos dois', () => {
  const { db, agora, mk } = comNpc(100);
  const will = mk('will');
  const vini = mk('vini');
  for (const j of [will, vini]) B.achar(j.m, 'marrento').quenteAte = j.m.t + 3000;
  rodar(db, [will, vini], 500, agora);
  assert.equal(B.achar(will.m, 'marrento').dono, 'vini');
  assert.equal(B.achar(vini.m, 'marrento').dono, null);
  assert.ok(R.ORDEM.indexOf('vini') < R.ORDEM.indexOf('will'));
});

test('treta sozinha: dono é o primeiro online na ordem', () => {
  const db = banco(100);
  const agora = { t: T0 };
  const will = jogador('will', db);
  assert.ok(will.elo.primeiroOnline(), 'sozinho no bar não é dono');
  const vini = jogador('vini', db);
  rodar(db, [will, vini], 400, agora);
  assert.ok(!will.elo.primeiroOnline());
  assert.ok(vini.elo.primeiroOnline());
});

test('relógio no começo: espera a 1ª medida (até 1,5 s); aparelho 5 s adiantado ou atrasado refaz o mundo; perto, mantém', () => {
  assert.equal(R.decidirRelogio(false, 200, 1000, 6000), 'esperar');
  assert.equal(R.decidirRelogio(true, 200, 1000, 6000), 'refazer', 'adiantado 5 s');
  assert.equal(R.decidirRelogio(true, 200, 6000, 1000), 'refazer', 'atrasado 5 s');
  assert.equal(R.decidirRelogio(true, 200, 1000, 1600), 'manter');
  assert.equal(R.decidirRelogio(false, 1600, 1000, 6000), 'refazer', 'sem medida depois de 1,5 s decide com o que tem');
  // O que o ajuste fino faria sem refazer: 5 s adiantado = ~10 s em câmera lenta (meia velocidade).
  const dt = 1000 / 60;
  let tm = 6000;
  let ts = 1000;
  let lentos = 0;
  for (let i = 0; i < 1200; i++) {
    const p = R.passoRelogio(dt, tm, ts + dt);
    if (p < dt * 0.9) lentos++;
    tm += p;
    ts += dt;
  }
  assert.ok(lentos * dt > 5000, `só ${Math.round(lentos * dt)} ms lentos (o refazer não faria falta)`);
});

/* ------------------------------------------------------------------ regras do banco (as mesmas do Firebase falso) */

const regras = await import('./mock-rules.mjs');

test('regras vivo: aceita o que o jogo manda, recusa campo a mais, hora torta e envio a menos de 100 ms', () => {
  const now = 2_000_000;
  const k = ['cruzadabotecos', 'bar', 'vivo', 'will'];
  const m = B.novoMundo('will', T0, 1);
  const elo = new R.Elo('will');
  const s = elo.enviar(m, { mx: 1, my: 0 }, LK, now);
  const v = { ...s, at: now, on: true, sv: now };
  assert.ok(regras.allowed({}, k, v, now), 'o envio do jogo foi recusado');
  assert.ok(regras.allowed({}, k, { ...v, a: 1, e: 'k', por: 'vini' }, now));
  assert.ok(!regras.allowed({}, k, { ...v, por: 'will' }, now), 'nocaute por si mesmo');
  assert.ok(!regras.allowed({}, k, { ...v, hp: 1 }, now));
  assert.ok(!regras.allowed({}, k, { ...v, at: now + 6000 }, now));
  assert.ok(!regras.allowed({}, k, { ...v, sv: now - 1 }, now));
  assert.ok(!regras.allowed({}, k, { ...v, x: 70 }, now));
  assert.ok(!regras.allowed({}, ['cruzadabotecos', 'bar', 'vivo', 'ze'], v, now));
  const db = regras.setAt({}, k, v);
  assert.ok(!regras.allowed(db, k, { ...v, at: now + 50, sv: now + 50 }, now + 50));
  assert.ok(regras.allowed(db, k, { ...v, at: now + 120, sv: now + 120 }, now + 120));
  assert.ok(!regras.allowed(db, k, null, now + 500), 'apagou');
  // O mesmo texto está no arquivo publicável.
  const pub = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules.cruzadabotecos.bar;
  assert.ok(pub.vivo && pub.vgolpe && pub.npc);
  assert.match(pub.vivo.$player['.write'], />= 100/);
  assert.match(pub.vgolpe.$player.$slot['.write'], />= 1000/);
  assert.match(pub.npc.$player['.write'], />= 150/);
});

test('regras vgolpe e npc: golpe do jogo passa, mesma posição só depois de 1 s, NPC até 1500 caracteres a cada 150 ms', () => {
  const now = 3_000_000;
  const k = ['cruzadabotecos', 'bar', 'vgolpe', 'will', '4'];
  const g = { ...R.golpeDoEvento({ k: 'acerto', em: 'vini', dano: 14.4, kx: 0.6, ky: -0.8, arma: null, forte: true }), t: now };
  assert.deepEqual(g, { to: 'vini', d: 14, kx: 0.6, ky: -0.8, w: 'empurrao', f: true, t: now });
  assert.ok(regras.allowed({}, k, g, now));
  assert.ok(!regras.allowed({}, k, { ...g, to: 'will' }, now), 'bateu em si mesmo');
  assert.ok(!regras.allowed({}, k, { ...g, d: 41 }, now));
  assert.ok(!regras.allowed({}, k, { ...g, w: 'bazuca' }, now));
  assert.ok(!regras.allowed({}, ['cruzadabotecos', 'bar', 'vgolpe', 'will', '10'], g, now));
  const db = regras.setAt({}, k, g);
  assert.ok(!regras.allowed(db, k, { ...g, t: now + 900 }, now + 900));
  assert.ok(regras.allowed(db, k, { ...g, t: now + 1000 }, now + 1000));
  // Toda arma do jogo é aceita pela regra.
  for (const w of R.ARMAS_REDE) assert.ok(regras.allowed({}, k, { ...g, w }, now), w);
  const kn = ['cruzadabotecos', 'bar', 'npc', 'will'];
  assert.ok(regras.allowed({}, kn, { at: now, l: 'x'.repeat(1500) }, now));
  assert.ok(!regras.allowed({}, kn, { at: now, l: 'x'.repeat(1501) }, now));
  const dn = regras.setAt({}, kn, { at: now, l: '' });
  assert.ok(!regras.allowed(dn, kn, { at: now + 100, l: '' }, now + 100));
  assert.ok(regras.allowed(dn, kn, { at: now + 150, l: '' }, now + 150));
});

console.log(`\n${passed} testes da rede passaram`);
