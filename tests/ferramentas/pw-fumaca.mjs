// Teste de fumaça do Playwright (decisão 15, 27/11/2026): abre o jogo num Chromium isolado (perfil próprio, sem o
// localStorage de ninguém), confere que o Bar Vivo desenha e que o gancho de desenvolvimento existe.
// Uso: com o Vite ligado (npm run dev -- --port 5179), `node tests/ferramentas/pw-fumaca.mjs [url]`.
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:5179/';
// Só servidor local: no site publicado ele entraria como Will e gravaria no banco de verdade.
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error(`recusado: ${url} não é um servidor local`);
  process.exit(2);
}
const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage({ viewport: { width: 800, height: 700 } });
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(String(e)));
  await pagina.goto(url, { waitUntil: 'domcontentloaded' });
  // Perfil limpo: sem jogador salvo, o jogo pergunta quem é você antes do bar.
  const temCanvas = await pagina.waitForSelector('canvas.vivo-canvas', { timeout: 5000 }).catch(() => null);
  if (!temCanvas) {
    await pagina.locator('.pick-card', { has: pagina.locator('.pick-name', { hasText: /^Will$/ }) }).first().click();
    await pagina.getByRole('button', { name: 'Entrar no bar' }).first().click();
  }
  await pagina.waitForSelector('canvas.vivo-canvas', { timeout: 20000 });
  const r = await pagina.evaluate(() => {
    const c = document.querySelector('canvas.vivo-canvas');
    const v = window.__vivo;
    return { w: c.width, h: c.height, gancho: !!v, corpos: v ? v.m.corpos.length : 0 };
  });
  console.log(JSON.stringify({ ...r, erros }));
  if (!r.gancho || r.corpos < 10 || erros.length) process.exitCode = 1;
} finally {
  await navegador.close();
}
