// Teste de mutação (Fatia 7: versionado no repositório). Planta um erro de cada vez no código, roda os testes e
// confere se eles reprovam; o arquivo volta ao original sempre (inclusive com Ctrl+C).
// Uso: node scripts/mutacao.mjs [fatia6|fatia7|…|fatia20|todas] [comando de teste]   (padrão: todas, "npm test")
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** [arquivo, trecho original, trecho com o erro, o que o erro quebra]. Mutação equivalente vai marcada com `eq`. */
const MUTACOES = {
  fatia6: [
    ['src/vivo/poderes.ts', 'export const PRECO_PODER = 300;', 'export const PRECO_PODER = 250;', 'preço dos poderes'],
    ['src/vivo/poderes.ts', 'export const IMA_PUXA = 7;', 'export const IMA_PUXA = 0;', 'o Ímã não puxa'],
    ['src/vivo/poderes.ts', '      if (ao < -0.3 || ao > d.len || lado > def.p.largura!) return -1;', '      if (ao < -0.3 || ao > d.len) return -1;', 'onda sem largura'],
    ['src/vivo/poderes.ts', '      .slice(0, def.p.n!)', '      .slice(0, 99)', 'raio sem limite de alvos'],
    ['src/vivo/poderes.ts', '      if (Math.acos(Math.max(-1, Math.min(1, ao / dist))) > def.p.meioAngulo!) return -1;', '', 'cone sem abertura'],
    ['src/vivo/poderes.ts', '      if (ao > 0.3 && ao < ate && Math.abs(dx * uy - dy * ux) <= 0.7) ate = ao;', '', 'pinga atravessa todo mundo'],
    ['src/vivo/briga.ts', '        mover(o, (vx / dd) * passo, (vy / dd) * passo);', '', 'Ímã não arrasta'],
    ['src/vivo/briga.ts', "      const dano = def.dano >= 100 ? (o.quem === 'npc' && !deFora(o) ? Math.max(100, Math.ceil(o.vida) + 1) : 100) : def.dano;", '      const dano = def.dano;', 'nocaute garantido'],
    ['src/vivo/briga.ts', '        o.escorregouAte = m.t + 2000;', '        o.escorregouAte = 0;', 'eq: só a espera para escorregar de novo'],
    ['src/vivo/briga.ts', '        if (q >= 0 && vida >= q) quebrar(m, k, de, true);', '        if (false) quebrar(m, k, de, true);', 'poder não quebra móvel'],
    ['src/vivo/briga.ts', '      o.vida = Math.max(0, o.vida - FOGO_DANO_S * dt);', '      o.vida = o.vida;', 'fogo não queima'],
    ['src/vivo/rede.ts', '...(ehPoder(e.q) ? { q: e.q } : {})', '...{}', 'q perdido na leitura'],
    ['src/vivo/tacoGesto.ts', '  const forca = Math.max(0, Math.min(1, baixo / PUXADA_MAX));', '  const forca = Math.max(0, Math.min(1, -baixo / PUXADA_MAX));', 'sinuca carrega para cima'],
    ['src/vivo/gente.ts', '    ciclo: 60000,', '    ciclo: 180000,', 'Dona Maria lenta'],
    ['src/vivo/faixas.ts', '  return ((n % STEPS) + STEPS) % STEPS;', '  return 0;', 'jukebox fora do compasso'],
    ['src/gfa/simulacao.ts', '  return mortes * GRANA_POR_MORTE + bonusMarcos(mortes);', '  return mortes * GRANA_POR_MORTE;', 'GFA sem marcos'],
    ['src/gfa/simulacao.ts', '    if (g.boletos >= POLICIA_BOLETOS && dd <= POLICIA_ALCANCE) {', '    if (false) {', 'polícia não atira'],
    ['src/gfa/simulacao.ts', '  if (vit) quebrarVitrine(g, vit);', '', 'tiro não quebra vitrine'],
    ['database.rules.json', 'rajada|tampinhas|', 'rajada|', 'regra sem um poder'],
  ],
  fatia7: [
    ['src/vivo/movimento.ts', "  return pref === 'reduzido' || (pref === 'sistema' && sistema);", "  return pref === 'reduzido';", 'ignora o sistema'],
    ['src/vivo/movimento.ts', '      f = this.inicios.length < MAX_CLAROES_POR_S ? 1 : 0;', '      f = 1;', 'clarões sem limite'],
    ['src/vivo/movimento.ts', '      if (f) this.inicios.push(agora);', '', 'limite não conta'],
    ['src/vivo/movimento.ts', '    return reduzido ? Math.min(a, BRILHO_REDUZIDO) : a;', '    return a;', 'reduzido ainda clareia'],
    ['src/vivo/VivoScreen.tsx', '      const sh = reduzidoRef.current ? 0 : m.trauma * m.trauma * 6;', '      const sh = m.trauma * m.trauma * 6;', 'treme no reduzido'],
    ['src/gfa/GfaTela.tsx', '      const tr = calmo ? 0 : efx.tremor * efx.tremor * 0.9;', '      const tr = efx.tremor * efx.tremor * 0.9;', 'GFA treme no reduzido'],
    ['src/vivo/caixa.ts', '  dia[lado][origem] = (dia[lado][origem] ?? 0) + Math.round(v);', '  dia[lado][origem] = Math.round(v);', 'caixa não soma'],
    ['src/vivo/caixa.ts', '  if (!(v > 0) || !Number.isFinite(v)) return c;', '  if (false) return c;', 'caixa aceita lixo'],
    ['src/vivo/caixa.ts', '  for (const k of dias.slice(0, Math.max(0, dias.length - DIAS_GUARDADOS))) delete novo[k];', '', 'caixa cresce sem fim'],
    ['src/vivo/VivoScreen.tsx', "ganhar.current(r.grana, 'gfa')", "ganhar.current(r.grana, 'chao')", 'GFA lançado como chão'],
    ['src/vivo/medidor.ts', '    if (!(intervalo > 0) || intervalo > 1000) return;', '', 'medidor conta aba escondida'],
    ['src/vivo/medidor.ts', '      lentos: n ? this.intervalos.filter((x) => x > 34).length / n : 0,', '      lentos: 0,', 'medidor sem quadros lentos'],
    ['tests/mock-rules.mjs', '|pinga|ima)$/;', '|pinga)$/;', 'espelho sem um poder'],
  ],
  fatia8: [
    ['src/vivo/impacto.ts', '  return Math.max(0, Math.min(HITSTOP_MAX, g.hitstop));', '  return Math.max(0, g.hitstop);', 'congelamento sem teto'],
    ['src/vivo/impacto.ts', '  if (!g.forte) return 0;', '', 'golpe leve sacode'],
    ['src/vivo/briga.ts', '  sacudir(m, traumaDe(g));', '  sacudir(m, g.forte ? 0.45 : 0.25);', 'motor sacode em todo golpe'],
    ['src/vivo/briga.ts', '  m.hitstopAte = Math.max(m.hitstopAte, m.t + HITSTOP_FINAL);', '  m.hitstopAte = Math.max(m.hitstopAte, m.t + 110);', 'nocaute sem pausa maior'],
    ['src/vivo/VivoScreen.tsx', '              if (e.forte) m.trauma = Math.min(1, m.trauma + mv.tranco * 0.4);', '              m.trauma = Math.min(1, m.trauma + mv.tranco * 0.4);', 'tranco do item em todo golpe'],
    ['src/vivo/impacto.ts', '  const a = (forte ? 3 : 1) * (1 - u) * (1 - u);', '  const a = 3 * (1 - u) * (1 - u);', 'recuo igual no leve'],
    ['src/vivo/impacto.ts', '  if (calmo || !(idade >= 0) || idade >= RECUO_MS) return { x: 0, y: 0 };', '  if (!(idade >= 0) || idade >= RECUO_MS) return { x: 0, y: 0 };', 'recuo no reduzido'],
    ['src/vivo/impacto.ts', '  return { sx: 1 + s, sy: 1 / (1 + s) };', '  return { sx: 1 + s, sy: 1 };', 'esticar muda o volume'],
    ['src/vivo/impacto.ts', '  return QUEDAS[hashTexto(id) % 3];', '  return QUEDAS[0];', 'uma queda só'],
    ['src/vivo/impacto.ts', '  const passo30 = (k: number) => Math.min(90, Math.floor(k * 4) * 30);', '  const passo30 = (k: number) => Math.min(90, k * 90);', 'queda sem quadros de 30°'],
    ['src/vivo/impacto.ts', '  return fase < 700;', '  return fase < 3000;', 'olha para o lado demais'],
    ['src/vivo/impacto.ts', '  return idade < 60 ? 0 : idade < 280 ? 1 : 2;', '  return 1;', 'gota sem rampa'],
    ['src/vivo/decalques.ts', '  return Math.round(190 * (1 - k / PASSOS_PEGADA));', '  return 190;', 'pegada não some'],
    ['src/vivo/decalques.ts', '  for (const p of miolo.slice(0, 2)) {', '  for (const p of miolo.slice(0, 0)) {', 'poça sem brilho'],
    ['src/vivo/VivoScreen.tsx', '        if (m.t < mk.quando) continue;', '', 'torresmo marca antes de cair'],
  ],
  fatia9: [
    ['src/vivo/luz.ts', '  return BAYER4.map((v) => v < n);', '  return BAYER4.map((v) => v <= n);', 'Bayer acende uma casa a mais'],
    ['src/vivo/luz.ts', '  return ((((ms / 3_600_000 - 3) % 24) + 24) % 24);', '  return ((((ms / 3_600_000) % 24) + 24) % 24);', 'hora em UTC'],
    ['src/vivo/luz.ts', '  if (h >= 7 && h < 17) return null;', '', 'noite o dia inteiro'],
    ['src/vivo/luz.ts', '  if (p95 > ORCAMENTO_MS && atual < 2) return (atual + 1) as Nivel;', '', 'orçamento nunca desce'],
    ['src/vivo/luz.ts', '  if (p95 < FOLGA_MS && atual > 0) return (atual - 1) as Nivel;', '  if (p95 < ORCAMENTO_MS && atual > 0) return (atual - 1) as Nivel;', 'nível pula sem folga'],
    ['src/vivo/luz.ts', '  if (n < AMOSTRA_MIN) return atual;', '', 'decide sem amostra'],
    ['src/vivo/luz.ts', '  return { cor: v.cor, a: +(v.a * Math.min(1, k)).toFixed(3), modo: v.modo };', '  return { cor: v.cor, a: v.a, modo: v.modo };', 'véu sem força'],
    ['src/vivo/luz.ts', '  return { x0: Math.min(r.x0, x0), y0: Math.min(r.y0, y0), x1: Math.max(r.x1, x0 + tam), y1: Math.max(r.y1, y0 + tam) };', '  return { x0: Math.min(r.x0, x0), y0: Math.min(r.y0, y0), x1: Math.max(r.x1, x0 + 1), y1: Math.max(r.y1, y0 + 1) };', 'retângulo ignora o tamanho'],
    ['src/vivo/VivoScreen.tsx', '      ar.ret = sujar(ar.ret, Math.round(x), Math.round(y), tam);', '', 'mancha não suja o retângulo'],
    ['src/vivo/VivoScreen.tsx', '    const limiteGotas = () => (nivel === 2 ? MAX_GOTAS / 2 : MAX_GOTAS);', '    const limiteGotas = () => MAX_GOTAS;', 'nível 2 não corta gotas'],
  ],
  fatia10: [
    ['src/vivo/eventos.ts', '    if (sorteioBruto(e - 1, cfg)) return null;', '', 'dois eventos seguidos'],
    ['src/vivo/eventos.ts', '  return 1 + Math.floor(rng(hashTexto(`${SAL}|bloco|${b}`))() * (EPOCAS_POR_BLOCO - 2));', '  return 99;', 'bloco de 3 h sem garantia'],
    ['src/vivo/eventos.ts', '  if (!(cfg.mult > 0)) return null;', '', 'multiplicador 0 não desliga'],
    ['src/vivo/eventos.ts', '  return Math.round(base * (1 + 0.5 * (k - 1)));', '  return base;', 'vida não escala'],
    ['src/vivo/eventos.ts', '  return vezesHoje <= 0 ? base : Math.round(base / 2);', '  return base;', 'segunda vez paga cheio'],
    ['src/vivo/eventos.ts', '    if (t + ida + RATO_PAUSA + ms(c, porta) > dura) break;', '    if (false) break;', 'ratazana passa do fim'],
    ['src/vivo/briga.ts', '  if (d > alcance + ex.raio) return false;', '', 'golpe pega bicho longe'],
    ['tests/mock-rules.mjs', '    return cur === undefined || value >= cur;', '    return true;', 'dano pode diminuir'],
    ['tests/mock-rules.mjs', "    if (cur !== undefined || !exactKeys(value, ['n', 'at'])) return false;", "    if (!exactKeys(value, ['n', 'at'])) return false;", 'segunda abertura'],
    ['tests/mock-rules.mjs', '    return !ab || now - ab.at > 3600000;', '    return true;', 'apaga evento recente'],
    ['src/vivo/VivoScreen.tsx', '      if (toque.current.usa && apagado() && pertoDisjuntor() && religar()) toque.current.usa = false;', '', 'E no disjuntor não religa'],
  ],
  fatia11: [
    ['src/vivo/invasao.ts', '  if (somaLivro(livro) >= H) return \'derrubado\';', '', 'disco nunca cai'],
    ['src/vivo/invasao.ts', '  return tRel < t0 + FEIXE_MS ? \'feixe\' : \'levou\';', '  return \'feixe\';', 'disco nunca leva'],
    ['src/vivo/invasao.ts', '  if (u >= VARRE_AVISO + VARRE_ATIVO) return null;', '', 'raio sem pausa'],
    ['src/vivo/invasao.ts', '  return Math.abs((l.eixo === \'x\' ? x : y) - l.v) < 0.55;', '  return Math.abs((l.eixo === \'x\' ? y : x) - l.v) < 0.55;', 'raio no eixo trocado'],
    ['src/vivo/invasao.ts', '  if (grandeDerrubado && dentro) return \'vitoria\';', '  if (grandeDerrubado) return \'vitoria\';', 'vitória com cota estourada'],
    ['src/vivo/invasao.ts', '  if (d === \'vitoria\') return Math.max(PREMIO_PACIFICO + 5, Math.round(60 / k));', '  if (d === \'vitoria\') return Math.round(60 / k);', 'vitória paga menos que a paz'],
    ['src/vivo/invasao.ts', '  const fila = [...npcs].sort()', '  const fila = [...npcs]', 'alvos dependem da ordem da lista'],
    ['src/vivo/briga.ts', '  if (alvo.vida <= 0) nocautear(m, alvo, { ...alvo, id: \'evento\', quem: \'npc\' }, null, dano);', '  if (alvo.vida <= 0) nocautear(m, alvo, alvo, null, dano);', 'nocaute do raio conta para você'],
    ['tests/mock-rules.mjs', 'const ENTIDADES = /^(rato|alien|grande|disco[0-5]|dragao|dino)$/;', 'const ENTIDADES = /^(rato|alien|grande|disco[0-9]|dragao|dino)$/;', 'disco além do 5'],
    ['src/vivo/VivoScreen.tsx', '        soltarLevados();\n        ev = evNovo();', '        ev = evNovo();', 'NPC levado não volta se o evento acaba'],
    ['src/vivo/briga.ts', '    for (let i = alvos.length - 1; i >= 0; i--) if (prot.has(alvos[i].id)) alvos.splice(i, 1);', '', 'soco no disco acerta o NPC do feixe'],
    ['src/vivo/VivoScreen.tsx', "  const pisca = !reduzidoRef.current && Math.floor(agora / 120) % 2 === 0;", "  const pisca = Math.floor(agora / 120) % 2 === 0;", 'aviso pisca no movimento reduzido'],
    ['src/vivo/VivoScreen.tsx', '        if (lerVezes().p.includes(chave)) return 0;', '', 'recarregar paga de novo'],
    ['src/vivo/VivoScreen.tsx', '          if ((Number(livro[player]) || 0) > 0) {', '          if (ev.meuDano > 0) {', 'recarregar perde o prêmio da ratazana'],
    ['src/vivo/VivoScreen.tsx', '              if (h) h.segurando = null;\n', '', 'segura corpo levado'],
  ],
  fatia12: [
    ['src/vivo/status.ts', "  molhado: { queimando: 'apaga', molhado: null, eletrico: 'choque', grudento: null },", "  molhado: { queimando: 'apaga', molhado: null, eletrico: null, grudento: null },", 'tabela assimétrica'],
    ['src/vivo/status.ts', '    delete out.queimando;\n    delete out.molhado;\n    return { st: out, efeito };', '    delete out.queimando;\n    return { st: out, efeito };', 'apagar deixa o molhado'],
    ['src/vivo/status.ts', "  return (st.grudento ?? 0) > t ? GRUDE_VEL : 1;", '  return 1;', 'grudento não prende'],
    ['src/vivo/status.ts', '  return ms >= CARGA_2 ? 2 : ms >= CARGA_1 ? 1 : 0;', '  return ms >= CARGA_2 ? 2 : ms > 0 ? 1 : 0;', 'qualquer toque carrega'],
    ['src/vivo/status.ts', '    hitstop: Math.min(HITSTOP_CARGA_MAX, g.hitstop + (n === 2 ? 60 : 30)),', '    hitstop: g.hitstop + (n === 2 ? 60 : 30),', 'carga sem teto de congelamento'],
    ['src/vivo/status.ts', '  return d >= 0 && d <= APARA_MS;', '  return d >= 0 && d <= APARA_MS * 3;', 'janela de aparar larga'],
    ['src/vivo/briga.ts', "      if (o !== alvo && ((o.st.molhado ?? 0) <= m.t || Math.hypot(o.x - alvo.x, o.y - alvo.y) > CHOQUE.raio)) continue;", '      if (o !== alvo && Math.hypot(o.x - alvo.x, o.y - alvo.y) > CHOQUE.raio) continue;', 'choque pega o seco'],
    ['src/vivo/briga.ts', '    gastarArma(m, a); // custa um uso (a garrafa vira caco na hora)', '', 'aparar de graça'],
    ['src/vivo/briga.ts', '  if (ent.apara && eu0.estado', '  if (false && ent.apara && eu0.estado', 'aparar some no congelamento'],
    ['src/vivo/briga.ts', '    const usos = a.tipo === \'garrafa\' ? ARMAS.caco.usos : a.usos - 1;', '    const usos = a.tipo === \'garrafa\' ? ARMAS.caco.usos : a.usos;', 'arremesso não gasta'],
    ['src/vivo/briga.ts', '    if (baixo < 0 && anda(Math.floor(x), Math.floor(y))) {', '    if (true) {', 'item cai dentro do móvel ou fora do mapa'],
    ['src/vivo/briga.ts', '&& m.t - q.quica <= PEGA_MS &&', '&&', 'pega no ar a qualquer hora'],
    ['src/vivo/briga.ts', '  alvo.fase = \'nada\';\n  alvo.golpe = null;\n  m.hitstopAte = Math.max(m.hitstopAte, m.t + 90);', '  m.hitstopAte = Math.max(m.hitstopAte, m.t + 90);', 'raio não cancela a carga'],
  ],
  fatia13: [
    ['src/portais/moscas/sim.ts', '(m.armas[a] ?? 0) < NIVEL_MAX_ARMA).map', '(m.armas[a] ?? 0) <= NIVEL_MAX_ARMA).map', 'carta de arma no nível 4'],
    ['src/portais/moscas/sim.ts', '      m.moscas.splice(m.moscas.indexOf(longe), 1);\n', '', 'rainha fura o teto'],
    ['src/portais/moscas/sim.ts', '    if (m.moscas.filter((o) => o.vida > 0).length >= CURVA.tetoVivas) {', '    if (m.moscas.filter((o) => o.vida > 0).length > CURVA.tetoVivas) {', 'enxame passa do teto'],
    ['src/portais/moscas/sim.ts', '  if (d !== ultimo.d || e.grita || e.carta !== undefined) {', '  if (d !== ultimo.d || e.grita) {', 'gravação perde a carta'],
    ['src/portais/moscas/sim.ts', 'grav[i].passo <= m.passo', 'grav[i].passo < m.passo', 'replay atrasa um passo'],
    ['src/portais/portal.ts', '  if (hoje !== sorteia(dia - 1)) return hoje;', '  return hoje;', 'portal repete o de ontem'],
    ['src/portais/portal.ts', '  return !(ultima > 0) || agora - ultima >= ESPERA_MS;', '  return !(ultima > 0) || agora - ultima > ESPERA_MS;', 'espera com 1 ms a mais'],
    ['src/portais/portal.ts', '  if (comPity && p.semRaro + 1 >= PITY_DURO)', '  if (comPity && p.semRaro >= PITY_DURO)', 'pity duro atrasa um sorteio'],
    ['src/portais/portal.ts', '  if (runsHoje >= RUNS_COM_SORTEIO) return 0;', '  if (runsHoje > RUNS_COM_SORTEIO) return 0;', 'quarta run sorteia'],
    ['src/portais/portal.ts', '  return Math.max(0, Math.floor(pontos / 5)) +', '  return Math.min(200, Math.floor(pontos / 5)) +', 'moeda com teto'],
    ['src/portais/portal.ts', ' || s.length % 4 || s.length > FANTASMA_MAX) return [];', ' || s.length > FANTASMA_MAX) return [];', 'fantasma torto passa'],
    ['src/portais/inventario.ts', '  if (!premioPorId(id) || inv.itens.includes(id) || saldoPo(inv) < PO_PRECO) return null;', '  if (!premioPorId(id) || saldoPo(inv) < PO_PRECO) return null;', 'compra o que já tem'],
    ['src/portais/inventario.ts', 'Math.min(g, Math.max(a.po.s, b.po.s))', 'Math.min(g, Math.min(a.po.s, b.po.s))', 'juntar devolve Pó gasto'],
    ['tests/mock-rules.mjs', ' || !inteiro(value.s, 0, 1e7) || value.s > value.g || value.t !== now) return false;', ' || !inteiro(value.s, 0, 1e7) || value.t !== now) return false;', 'banco aceita gastar mais que ganhou'],
    ['tests/mock-rules.mjs', '  return !cur || cur.t < sod(now) || (now - cur.t >= 2000 && value.s >= cur.s);', '  return !cur || now - cur.t >= 2000;', 'placar baixa no mesmo dia'],
    ['src/portais/moscas/sim.ts', '  if (!m.rainha && t >= CURVA.rainhaEm) {', '  if (!m.rainha && t > CURVA.rainhaEm + 1) {', 'rainha atrasa'],
    ['src/portais/moscas/sim.ts', "  else if (m.rainhaMorta || m.passo >= PASSOS_RUN) m.fim = 'venceu';", "  else if (m.passo >= PASSOS_RUN) m.fim = 'venceu';", 'matar a rainha não vence'],
    ['src/portais/moscas/sim.ts', "  else if (m.rainhaMorta || m.passo >= PASSOS_RUN) m.fim = 'venceu';", "  else if (m.rainhaMorta) m.fim = 'venceu';", 'durar 100 s não vence'],
  ],
  fatia14: [
    ['src/portais/quermesse/regente.ts', '    if (i % CHEFE_CADA === 0) {', '    if (i % CHEFE_CADA === 1) {', 'chefe fora do lugar'],
    ['src/portais/quermesse/regente.ts', '    const opcoes = MICROS.filter((m) => m.id !== antes);', '    const opcoes = MICROS;', 'repete o microjogo anterior'],
    ['src/portais/quermesse/regente.ts', '        if (q.seguidos % 5 === 0) {', '        if (q.seguidos % 4 === 0) {', 'bônus de seguidos errado'],
    ['src/portais/quermesse/regente.ts', '        q.fogueiras--;\n', '', 'errar não apaga fogueira'],
    ['src/portais/quermesse/regente.ts', '  if (q.passo >= PASSOS_RUN && !q.fim)', '  if (q.passo >= PASSOS_RUN * 2 && !q.fim)', 'run sem teto de passos'],
    ['src/portais/quermesse/regente.ts', "  if (como === 'venceu') q.pontos += 2 * q.fogueiras;", '', 'fogueira que sobrou não pontua'],
    ['src/portais/quermesse/quebre.ts', '      if (Math.abs(x(e) - 0.5) < TOL) {', '      if (Math.abs(x(e) - 0.5) < TOL * 3) {', 'quebre aceita fora do meio'],
    ['src/portais/quermesse/salte.ts', '    if (toca(e.xf) && !noAr(e, e.t)) {', '    if (false) {', 'fogueira não queima'],
    ['src/portais/quermesse/pesque.ts', '      if (Math.abs(e.ax - boca(e)) < TOL) {', '      if (true) {', 'qualquer puxão fisga'],
    ['src/portais/quermesse/acerte.ts', '      if (perto(e)) {', '      if (perto(e, 3)) {', 'mira larga demais'],
    ['src/portais/quermesse/dance.ts', '  if (e.erros > N_SETAS - PRECISA)', '  if (e.erros > N_SETAS)', 'quadrilha perdoa erro demais'],
    ['src/portais/quermesse/dance.ts', '    const apertou = d !== 0 && d !== e.antes;', '    const apertou = d !== 0;', 'segurar a direção conta de novo'],
    ['src/portais/quermesse/tipos.ts', 'export const passosDe = (s: number, vel: number) => Math.round(s / vel / DT);', 'export const passosDe = (s: number, vel: number) => Math.round(s / DT);', 'tempo não encolhe com a velocidade'],
    ['src/portais/portal.ts', '  if (p[0] === bloco(b - 1)[n - 1]) [p[0], p[1]] = [p[1], p[0]];', '', 'portal repete na emenda do bloco'],
    ['src/portais/inventario.ts', "n: Object.fromEntries(PORTAIS_DO_DIA.map((p) => [p, inteiro(n[p], 1000)]))", 'n: { moscas: inteiro(n.moscas, 1000) }', 'gravar apaga a conta da Quermesse'],
  ],
  // Fatia 15: interação entre jogadores.
  fatia15: [
    ["src/vivo/interacoes.ts", "  if (ms >= REVIVE_MS) return", "  if (ms >= REVIVE_MS / 2) return", "reviver na metade do tempo"],
    ["src/vivo/interacoes.ts", "  const ms = (r.alvo === perto.id ? r.ms : 0) + dtMs;", "  const ms = r.ms + dtMs;", "trocar de alvo não zera o reviver"],
    ["src/vivo/interacoes.ts", "  if (!parado || !perto) return", "  if (!perto) return", "andar não zera o reviver"],
    ["src/vivo/interacoes.ts", "  Math.abs(a.t - b.t) <= BRINDE_JANELA_MS &&", "  Math.abs(a.t - b.t) <= BRINDE_JANELA_MS * 2 &&", "janela do brinde larga demais"],
    ["src/vivo/interacoes.ts", "Math.hypot(a.x - b.x, a.y - b.y) <= BRINDE_RAIO;", "Math.hypot(a.x - b.x, a.y - b.y) <= BRINDE_RAIO * 2;", "brinde de longe"],
    ["src/vivo/interacoes.ts", "n < PEGADINHA_MAX && feitas < PEGADINHAS_DIA;", "n < PEGADINHA_MAX;", "pegadinha sem limite do dia"],
    ["src/vivo/interacoes.ts", "Math.abs(x.t - f.t) < 30_000)", "Math.abs(x.t - f.t) < 0)", "reviver repetido enche o livro"],
    ["src/vivo/interacoes.ts", "Math.abs(x.t - f.t) < 10_000)", "Math.abs(x.t - f.t) < 0)", "brinde dos dois aparelhos vira 2 linhas"],
    ["src/vivo/interacoes.ts", "/^[0-9a-z-]{8,16}$/.test(lk)", "/^[0-9a-z-]{1,20}$/.test(lk)", "visual quebrado do amigo aceito"],
    ["src/vivo/interacoes.ts", ".sort((a, b) => b.t - a.t).slice(0, max)", ".sort((a, b) => a.t - b.t).slice(0, max)", "livro do mais velho para o mais novo"],
    ["src/vivo/briga.ts", "  if (c.quem === 'remoto' || c.quem === 'eu') return true;", "  if (c.quem === 'eu') return true;", "amigo online não pode ser levantado"],
    ["src/vivo/briga.ts", "  return c.quem === 'npc' && !!c.npc && FUNCIONARIOS.includes(c.npc.tipo);", "  return c.quem === 'npc';", "cliente ou bicho de evento levanta"],
    ["src/vivo/briga.ts", "!Number.isFinite(c.koAte) && c.quem !== 'remoto') return false;", "false) return false;", "KO infinito levanta"],
    ["src/vivo/briga.ts", "  if (!podeLevantar(c) || c.quem === 'remoto') return false;", "  if (c.quem === 'remoto') return false;", "levantar quem não pode"],
    ["src/arena/sprites.ts", "      const g = buildFront(L, 'stand');\n      inkFace(g, ink);", "      const g = buildFront(L, 'stand');", "de pé sem a pegadinha"],
    ["src/arena/sprites.ts", "  if (n >= 6) {", "  if (n >= 7) {", "jornal não aparece"],
    ["tests/mock-rules.mjs", "value.n < 0 || value.n > 6 || value.t !== now", "value.n < 0 || value.n > 7 || value.t !== now", "espelho deixa passar de 6"],
    ["tests/mock-rules.mjs", "|bola|brinde|reviver)$/;", "|bola|brinde)$/;", "espelho recusa o reviver"],
    ["database.rules.json", "newData.val() >= 0 && newData.val() <= 6\"", "newData.val() >= 0 && newData.val() <= 3\"", "banco volta ao teto 3"],
    ["src/vivo/VivoScreen.tsx", "< REVIVE_DE_NOVO_MS))", "< 0))", "reviver repetido no amigo online"],
    ["src/vivo/VivoScreen.tsx", "if (!podeZoar(antes, conta)) {", "if (false) {", "tela ignora o limite da pegadinha"],
  ],
  // Fatia 16: chapéu e título.
  fatia16: [
    ["src/arena/sprites.ts", "    paintFace();\n  }\n  drawHat(p, L, false);\n}", "    paintFace();\n  }\n}", "chapéu some de frente"],
    ["src/arena/sprites.ts", "  drawHat(p, L, true);\n", "", "chapéu some de costas"],
    ["src/arena/sprites.ts", "  drawHat(p, L, false);\n  drawArms(p, L, pose);", "  drawArms(p, L, pose);", "chapéu some no soco"],
    ["src/arena/sprites.ts", "      limpar(3);\n      p.rect(7, 0, 16, 3, c.base);", "      limpar(2);\n      p.rect(7, 0, 16, 3, c.base);", "cabelo aparece acima da aba da palha"],
    ["src/vivo/visual.ts", "const cauda = ch === undefined && ti === undefined ? '' : c(ch) + c(ti);", "const cauda = c(ch) + c(ti);", "código sempre com 10 (quebra quem não atualizou)"],
    ["src/vivo/visual.ts", "chapeu: s.length > 8 ? de(CHAPEUS, 8) : undefined,", "chapeu: s.length > 8 ? de(CHAPEUS, 9) : undefined,", "chapéu lido na posição errada"],
    ["src/vivo/visual.ts", "export const CODIGO_OK = /^[0-9a-z-]{8,16}$/;", "export const CODIGO_OK = /^[0-9a-z-]{8,10}$/;", "código de versão futura cai"],
    ["src/vivo/rede.ts", "!/^[0-9a-z-]{8,16}$/.test(e.lk)) continue;", "!/^[0-9a-z-]{8}$/.test(e.lk)) continue;", "rede derruba quem usa chapéu"],
    ["src/vivo/visual.ts", "return t && t.trofeu && temTrofeu(trofeusRaw, t.trofeu, jogador) ? t.nome : null;", "return t && t.trofeu ? t.nome : null;", "título sem o troféu"],
    ["src/vivo/visual.ts", "TITULOS.filter((t) => !t.trofeu || temTrofeu(trofeusRaw, t.trofeu, jogador));", "TITULOS.filter((t) => !!t);", "escolhe título sem troféu"],
    ["src/vivo/visual.ts", "    if (v.chapeu === 'nenhum') delete L.hat;", "    if (v.chapeu === 'nenhum') void L.hat;", "tirar o chapéu não tira"],
    ["database.rules.json", "\"newData.isString() && newData.val().matches(/^[0-9a-z-]{8,16}$/)\"", "\"newData.isString() && newData.val().matches(/^[0-9a-z-]{8}$/)\"", "banco recusa quem usa chapéu"],
    ["tests/mock-rules.mjs", "|mc-chapeu-bone|qm-chapeu-palha|qm-chapeu-cartola|ch-", "|ch-", "espelho recusa os chapéus"],
    ["src/portais/portal.ts", "  { id: 'qm-chapeu-palha', portal: 'quermesse', nome: 'Chapéu de palha da quadrilha', raridade: 'incomum', peca: 'chapeu', cor: 'palha' },\n", "", "palha some dos prêmios"],
    ["src/vivo/VivoScreen.tsx", "lista={CHAPEUS.filter((c) => c === 'nenhum' || liberadas.has(c) || c === value.chapeu)}", "lista={CHAPEUS}", "painel mostra chapéu não ganho"],
  ],
  // Fatia 17: dragão no telhado e dinossauro fugido do circo.
  fatia17: [
    ["src/vivo/eventos.ts", "quando: (h) => h >= 19 || h < 5, trofeu: 'dente'", "quando: (h) => h >= 0, trofeu: 'dente'", "dragão de dia"],
    ["src/vivo/eventos.ts", "dino: { nome: 'Dinossauro fugido do circo', dura: 90_000,", "dino: { nome: 'Dinossauro fugido do circo', dura: 590_000,", "dino não cabe na época"],
    ["src/vivo/feras.ts", "    if (k === ant) k = (k + 1) % DRAGAO_FUROS.length;\n", "", "furo repetido em seguida"],
    ["src/vivo/feras.ts", "Math.max(0, Math.min(furos.length - 1, Math.floor(dt / DRAGAO_TROCA_MS)))", "Math.max(0, Math.floor(dt / DRAGAO_TROCA_MS))", "cabeça some no fim"],
    ["src/vivo/feras.ts", "if (dt >= s.t0 - FOGO_AVISO_MS && dt < s.t0) return { s, fase: 'aviso' };", "if (dt >= s.t0 - 200 && dt < s.t0) return { s, fase: 'aviso' };", "aviso do fogo curto"],
    ["src/vivo/feras.ts", "return ao >= 0.4 && ao <= (s.alc ?? FOGO_COMPR) && lado <= FOGO_LARG;", "return ao <= (s.alc ?? FOGO_COMPR) && lado <= FOGO_LARG;", "fogo pega atrás da boca"],
    ["src/vivo/feras.ts", "      if (!anda(Math.floor(x), Math.floor(y))) break;", "      if (!anda(Math.floor(x), Math.floor(y))) continue;", "eq: poça atrás da parede (o alcance do sopro já para antes da parede)"],
    ["src/vivo/feras.ts", "if (dt < s.t0 || dt >= s.t0 + POCA_FOGO_MS) continue;", "if (dt < s.t0 || dt >= s.t0 + 2 * POCA_FOGO_MS) continue;", "poça não apaga"],
    ["src/vivo/feras.ts", "const a = Math.max(dtAnt, dt - 250);", "const a = dt;", "investida sem varredura (pula por cima)"],
    ["src/vivo/feras.ts", "if (tr.fase !== 'investe' || tr.t1 <= a || tr.t0 > dt) continue;", "if (tr.fase === 'anda' || tr.t1 <= a || tr.t0 > dt) continue;", "parado raspando a pata machuca"],
    ["src/vivo/feras.ts", "    if (f === ant) f = (f + 1) % FAIXAS_DINO.length;\n", "", "investe na mesma faixa em seguida"],
    ["src/vivo/feras.ts", "if (t + ida + DINO_PREPARA_MS + corre + DINO_TONTO_MS + ms(b, entrada, DINO_TROTE) > dura) break;", "if (t > dura) break;", "dino não sai antes do fim"],
    ["src/vivo/briga.ts", "    if (c.quem === 'eu') m.eventos.push({ k: 'geladeira', x: c.x, y: c.y });\n", "", "geladeira não avisa"],
    ["src/vivo/briga.ts", "    if (c.quem === 'eu') m.eventos.push({ k: 'geladeira', x: c.x, y: c.y });\n    if (m.t < m.cervejaAte) {\n      m.eventos.push({ k: 'aviso', texto: 'Seu Zé: — Calma, a geladeira não é infinita.' });\n      return;\n    }", "    if (m.t < m.cervejaAte) {\n      m.eventos.push({ k: 'aviso', texto: 'Seu Zé: — Calma, a geladeira não é infinita.' });\n      return;\n    }\n    if (c.quem === 'eu') m.eventos.push({ k: 'geladeira', x: c.x, y: c.y });", "geladeira só avisa com cerveja liberada"],
    ["database.rules.json", "$ent.matches(/^(rato|alien|grande|disco[0-5]|dragao|dino)$/)", "$ent.matches(/^(rato|alien|grande|disco[0-5])$/)", "banco recusa dano nas feras"],
    ["tests/mock-rules.mjs", "const TROFEUS = /^(rabo|vela|gorjeta|antena|sumiuze|dente|ovo)$/;", "const TROFEUS = /^(rabo|vela|gorjeta|antena|sumiuze)$/;", "espelho recusa os troféus novos"],
    ["src/vivo/VivoScreen.tsx", "if (s?.fase === 'ativo' && alcancavel && !ev.queimados.has(s.s.id) && naLinhaFogo(s.s, me.x, me.y)) {", "if (s?.fase === 'ativo' && alcancavel && naLinhaFogo(s.s, me.x, me.y)) {", "fogo queima a cada quadro"],
    ["src/vivo/VivoScreen.tsx", "pagarEvento(ag.tipo, ent === 'dragao' ? PREMIO_DRAGAO : PREMIO_DINO)", "pagarEvento(ag.tipo, PREMIO_DRAGAO)", "dino paga como dragão"],
    ["src/vivo/VivoScreen.tsx", "              ev.atordoaAte = m.t + ATORDOA_MS;\n", "", "geladeira não atordoa"],
    ["src/vivo/VivoScreen.tsx", "      if (z === 'bar') desenharChaoFera(t, agora, cx, cy, 'chao');\n", "", "aviso das feras some"],
    ["src/vivo/feras.ts", "  return ao >= 0.4 && ao <= (s.alc ?? FOGO_COMPR) && lado <= FOGO_LARG;", "  return ao >= 0.4 && ao <= FOGO_COMPR && lado <= FOGO_LARG;", "fogo atravessa parede"],
    ["src/vivo/feras.ts", "    const boas = dirs.filter((o) => o.alc >= FOGO_ALC_MIN);", "    const boas = dirs;", "sopro de cara na parede"],
    ["src/vivo/briga.ts", "      cai(lx, ly);\n      return;\n    }\n    // Só conta", "      void lx;\n    }\n    // Só conta", "molotov jogada passa pelo dragão"],
    ["src/vivo/VivoScreen.tsx", "ev.sustoId !== ev.dino.id && Math.hypot", "Math.hypot", "geladeira sem limite dá imunidade"],
  ],
  // Fatia 18: Mesa cheia enxuta (Porrinha, narrador, boatos).
  fatia18: [
    ["src/vivo/mesa.ts", "  if (e.palpites.some((p) => p.n === n)) return { ok: false, motivo: `${n} já foi cantado.` };\n", "", "palpite repetido aceito"],
    ["src/vivo/mesa.ts", "  if (vezDe(e) !== quem) return { ok: false, motivo: 'Não é a sua vez.' };", "  if (!quem) return { ok: false, motivo: 'Não é a sua vez.' };", "palpita fora da vez"],
    ["src/vivo/mesa.ts", "  if (!Number.isInteger(n) || n < 0 || n > PORRINHA_MAX_MAO * e.vivos.length) return", "  if (!Number.isInteger(n) || n < 0 || n > 99) return", "palpite acima do máximo"],
    ["src/vivo/mesa.ts", "  if (e.vivos.length === 1) e.perdedor = e.vivos[0];\n", "", "jogo não acaba"],
    ["src/vivo/mesa.ts", "e.comeca = i >= 0 ? (i + 1) % e.vivos.length", "e.comeca = i >= 0 ? i % e.vivos.length", "quem abre não roda"],
    ["src/vivo/mesa.ts", "v < 0 || v > PORRINHA_MAX_MAO) return", "v < 0 || v > 9) return", "mão com mais de 3"],
    ["src/vivo/mesa.ts", "  const pool = livres.length ? livres : palpitesLivres(e);", "  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];", "NPC canta número já cantado"],
    ["src/vivo/mesa.ts", ".filter((i) => !rec.slice(-janela).includes(i));", ".filter(() => true);", "narrador repete fala"],
    ["src/vivo/mesa.ts", "  if (n.fila.some((f) => f.g === g)) return false;\n", "", "mesmo gatilho dobra na fila"],
    ["src/vivo/mesa.ts", "  if (t < n.ate) return null;\n", "", "narrador fala por cima"],
    ["src/vivo/mesa.ts", "  n.fila = n.fila.filter((f) => t - f.t <= FALA_VENCE_MS);\n", "", "fala velha não vence"],
    ["src/vivo/mesa.ts", "return { texto: MOLDES_BOATO[i].replace('{f}', l.texto), fato: l.texto", "return { texto: MOLDES_BOATO[i].replace('{f}', 'alguém aprontou'), fato: l.texto", "boato sem o fato"],
    ["src/vivo/mesa.ts", "const pool = linhas.filter((l) => (vistos.has(l.texto) ? false : (vistos.add(l.texto), true))).slice(0, 20);", "const pool = linhas.slice(0, 20);", "mural repete fato"],
    ["src/vivo/mesa.ts", "  const novos = linhas.filter((l) => l.t > desde)", "  const novos = linhas.filter((l) => l.t >= 0)", "resumo conta o que você já viu"],
    ["src/vivo/VivoScreen.tsx", "'portal', 'jukebox', 'porrinha', 'mural'];", "'portal', 'jukebox'];", "E não abre a mesa"],
    ["src/vivo/VivoScreen.tsx", "if (contaPorrinha(player) < PORRINHA_PAGAS_DIA) {", "if (true) {", "Porrinha paga sem limite"],
    ["src/vivo/VivoScreen.tsx", "if (saldo(pontos, carteiraRef.current) >= PORRINHA_RODADA) {", "if (true) {", "cobra sem saldo"],
    ["src/vivo/VivoScreen.tsx", "      if (!livro.length && ++tentativas < 20) return;\n", "", "resumo não espera o livro"],
  ],
  // Fatia 20: o NPC lembra de você + Churrasco Jurássico.
  fatia20: [
    ["src/vivo/memoria.ts", "curativo: t - e.ultimo < CICATRIZ_MS", "curativo: true", "curativo nunca some"],
    ["src/vivo/memoria.ts", "apelido: e.n >= APELIDO_N ? apelidoDe(npc) : null", "apelido: e.n >= 1 ? apelidoDe(npc) : null", "apelido no 1º nocaute"],
    ["src/vivo/memoria.ts", "{ n: (e?.n ?? 0) + 1,", "{ n: 1,", "nocaute não soma"],
    ["src/vivo/memoria.ts", "ultimo: Math.max(t, e?.ultimo ?? 0)", "ultimo: e?.ultimo ?? t", "curativo não renova"],
    ["src/vivo/memoria.ts", "e.n >= 1 && emPe && dist <= RECONHECE_RAIO && t - ultimaFala >= RECONHECE_ESPERA_MS", "e.n >= 1 && emPe && t - ultimaFala >= RECONHECE_ESPERA_MS", "reconhece de longe"],
    ["src/vivo/memoria.ts", "e.n >= 1 && emPe && dist <= RECONHECE_RAIO && t - ultimaFala >= RECONHECE_ESPERA_MS", "e.n >= 1 && dist <= RECONHECE_RAIO && t - ultimaFala >= RECONHECE_ESPERA_MS", "reconhece deitado"],
    ["src/vivo/memoria.ts", "e.n >= 1 && emPe && dist <= RECONHECE_RAIO && t - ultimaFala >= RECONHECE_ESPERA_MS", "e.n >= 1 && emPe && dist <= RECONHECE_RAIO", "reconhece sem parar"],
    ["src/vivo/memoria.ts", "e.n >= 1 && emPe && dist <= RECONHECE_RAIO && t - ultimaFala >= RECONHECE_ESPERA_MS", "emPe && dist <= RECONHECE_RAIO && t - ultimaFala >= RECONHECE_ESPERA_MS", "reconhece quem nunca apanhou"],
    ["src/vivo/memoria.ts", "(e.n as number) < 1 || ", "", "memória com n zero passa"],
    ["src/vivo/memoria.ts", "if (!/^[a-z0-9_-]{1,24}$/.test(k) || !v", "if (!v", "chave torta passa"],
    ["src/vivo/memoria.ts", "  const e = mem[npc];\n  return { ...mem,", "  const e = mem[npc];\n  if (e) e.n += 0.5;\n  return { ...mem,", "registrar mexe na memória antiga"],
    ["src/vivo/memoria.ts", "export const CURATIVO_ALT = 24;", "export const CURATIVO_ALT = 30;", "curativo no alto do cabelo"],
    ["src/portais/churrasco/sim.ts", "const w = Math.max(1.2, Math.min(jl - 2.2, 1.2 + r() * (jl * 0.55 - 1.2)));", "const w = 1.2 + r() * jl;", "lava mais larga que o pulo"],
    ["src/portais/churrasco/sim.ts", "const reage = v * 0.9 + jl + 1.5;", "const reage = v * 0.2;", "obstáculos colados"],
    ["src/portais/churrasco/sim.ts", "x += 1.0 + v * 0.9 + 2.5 + r() * v * 0.6;", "x += 1.0 + r() * v * 0.6;", "pterodáctilo colado no próximo"],
    ["src/portais/churrasco/sim.ts", "c.buffer = pulo ? BUFFER_S : Math.max(0, c.buffer - dt);", "c.buffer = pulo ? dt / 2 : 0;", "sem buffer de pulo"],
    ["src/portais/churrasco/sim.ts", "c.coyote = c.noChao ? COYOTE_S : Math.max(0, c.coyote - dt);", "c.coyote = COYOTE_S;", "pulo no ar"],
    ["src/portais/churrasco/sim.ts", "        c.x = it.x + it.w + 0.2;\n", "", "lava não põe do outro lado"],
    ["src/portais/churrasco/sim.ts", "if (!c.pegos.includes(it.id) && sobre(", "if (sobre(", "picanha conta várias vezes"],
    ["src/portais/churrasco/sim.ts", "if (!inv && sobre(c.x, c.x + LARG, it.x, it.x + it.w) && sobre(c.y, c.y + ALT, it.y0, it.y1)) {", "if (sobre(c.x, c.x + LARG, it.x, it.x + it.w) && sobre(c.y, c.y + ALT, it.y0, it.y1)) {", "sem invulnerável depois do dano"],
    ["src/portais/churrasco/sim.ts", "+ 5 * c.picanhas;", "+ 50 * c.picanhas;", "picanha vale 50"],
    ["src/portais/churrasco/sim.ts", "export const PTERO_Y: readonly [number, number] = [2.0, 2.7];", "export const PTERO_Y: readonly [number, number] = [1.0, 2.7];", "pterodáctilo pega quem está no chão"],
    ["src/portais/churrasco/sim.ts", "  } else if (c.x >= FIM_X) {", "  } else if (c.x >= FIM_X * 2) {", "churrasqueira não chega"],
    ["src/portais/portal.ts", "export const PORTAIS_DO_DIA: readonly IdPortal[] = ['moscas', 'quermesse', 'churrasco'];", "export const PORTAIS_DO_DIA: readonly IdPortal[] = ['moscas', 'quermesse'];", "churrasco fora do rodízio"],
    ["src/portais/portal.ts", "  return Math.max(0, Math.floor(pontos / 3)) + (venceu ? 20 : 0);", "  return Math.max(0, Math.floor(pontos / 3));", "churrasco sem bônus de chegada"],
    ["src/portais/portal.ts", "quermesse: 8, churrasco: 30 };", "quermesse: 8, churrasco: 8 };", "limiar do sorteio errado"],
    ["src/portais/portal.ts", "  if (portal === 'churrasco') return moedaChurrasco(pontos, venceu);\n", "", "moeda do churrasco pela conta da Moscaria"],
    ["database.rules.json", "(moscas|quermesse|churrasco)", "(moscas|quermesse)", "banco recusa o placar do churrasco"],
    ["database.rules.json", "|ch-cabelo-brasa", "", "banco recusa o lendário"],
    ["src/vivo/visual.ts", "'#ff7a2a', '#9a9aa8', '#ff4a1a'];", "'#ff7a2a', '#9a9aa8'];", "cor do lendário fora do Visual"],
    ["src/vivo/VivoScreen.tsx", "narrRng.current);\n            else {\n", "narrRng.current);\n            if (e.de === eu(m).id) {} else {\n", "rádio calado no nocaute de NPC"],
    ["src/vivo/VivoScreen.tsx", "if (e.de === eu(m).id && NPCS.some((n) => n.id === e.em)) {", "if (false) {", "memória não registra"],
    ["src/vivo/VivoScreen.tsx", "              salvarMemoria(player, memoria.current);\n", "", "memória não salva"],
    ["src/vivo/VivoScreen.tsx", " && !facing(c.fx, c.fy).back", "", "curativo de costas"],
    ["src/portais/churrasco/sim.ts", "export const ALT = 1.85;", "export const ALT = 1.0;", "chapéu atravessa o pterodáctilo"],
    ["src/portais/churrasco/sim.ts", "export const PICANHA_ALTA: readonly [number, number] = [3.2, 3.6];", "export const PICANHA_ALTA: readonly [number, number] = [1.2, 1.6];", "picanha alta sem pulo"],
  ],
  // Abertura do código, Fase 2: turma configurável.
  turma: [
    ["scripts/gerar-regras.mjs", "if (ids.length < 2 || ids.length > 5) out.push", "if (false) out.push", "turma de qualquer tamanho"],
    ["scripts/gerar-regras.mjs", "if (new Set(ids).size !== ids.length) out.push('há id repetido na turma');", "", "id repetido aceito"],
    ["scripts/gerar-regras.mjs", "if (!ids.includes(t.admin)) out.push", "if (false) out.push", "admin fora da turma aceito"],
    ["scripts/gerar-regras.mjs", "for (const id of ids) if (/^bot[123]$/.test(id)) out.push", "for (const id of ids) if (false) out.push", "id de bot aceito"],
    ["scripts/gerar-regras.mjs", ".replaceAll('{{ADMIN}}', t.admin)", ".replaceAll('{{ADMIN}}', 'will')", "admin fixo nas regras"],
    ["src/turma/index.ts", "export const IDS_RE = new RegExp(`^(${IDS_ALT})$`);", "export const IDS_RE = /^[a-z0-9]+$/;", "regex aceita qualquer id"],
    ["tests/mock-rules.mjs", "export const PLAYERS = new RegExp(`^(${IDS_ALT})$`);", "export const PLAYERS = /^[a-z0-9]+$/;", "banco falso aceita qualquer id"],
    ["src/vivo/mapa.ts", "onde: c.onde[p.artigo === 'da' ? 1 : 0]", "onde: c.onde[0]", "canto sem feminino"],
    ["src/bar/music.ts", "`${ESTILOS[p.musica].titulo} ${p.artigo} ${p.name}`", "ESTILOS[p.musica].titulo", "música sem o nome"],
    ["src/bar/presence.ts", "    return this.me === ADMIN\n", "    return this.me === 'will'\n", "dono fixo no código"],
  ],
};

const qual = process.argv[2] ?? 'todas';
const comando = process.argv[3] ?? 'npm test';
const lista = qual === 'todas' ? Object.values(MUTACOES).flat() : MUTACOES[qual];
if (!lista) {
  console.error(`não conheço "${qual}"; use ${Object.keys(MUTACOES).join(', ')} ou todas`);
  process.exit(2);
}

let aberto = null;
const restaurar = () => {
  if (aberto) fs.writeFileSync(aberto.p, aberto.original);
  aberto = null;
};
process.on('SIGINT', () => {
  restaurar();
  process.exit(130);
});

let mortas = 0;
const escaparam = [];
for (const [arq, a, b, oque] of lista) {
  const p = path.join(RAIZ, arq);
  const original = fs.readFileSync(p, 'utf8');
  if (!original.includes(a)) {
    console.log(`NÃO ACHEI  ${arq}: ${a.trim().slice(0, 60)}`);
    escaparam.push(`${arq} (trecho sumiu)`);
    continue;
  }
  aberto = { p, original };
  fs.writeFileSync(p, original.replaceAll(a, b));
  let morta = false;
  try {
    execSync(comando, { cwd: RAIZ, stdio: 'ignore', timeout: 600_000 });
  } catch {
    morta = true;
  } finally {
    restaurar();
  }
  if (morta) mortas++;
  else escaparam.push(`${arq}: ${oque}`);
  console.log(`${morta ? 'MORTA  ' : 'ESCAPOU'}  ${arq}: ${oque}`);
}
const eq = escaparam.filter((x) => x.includes('eq:')).length;
console.log(`\n${mortas}/${lista.length} mutações mortas (${eq} equivalente${eq === 1 ? '' : 's'} conhecida${eq === 1 ? '' : 's'} entre as que escaparam)`);
process.exit(lista.length - mortas - eq > 0 ? 1 : 0);
