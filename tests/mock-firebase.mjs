// Servidor de teste que imita o Firebase Realtime Database REST (GET/PUT/PATCH .json + streaming SSE)
// e aplica as mesmas regras de database.rules.json (placar e bar; ver mock-rules.mjs).
// Uso: node tests/mock-firebase.mjs [porta]   (encerra sozinho após 15 min)
import http from 'node:http';
import { allowed, applyUpdate, setAt } from './mock-rules.mjs';

const PORT = Number(process.argv[2] ?? 5180);
let tree = {};
const clients = new Set();

const split = (p) => p.split('/').filter(Boolean);
const getAt = (keys) => keys.reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), tree);
const resolve = (v, now) =>
  v && typeof v === 'object'
    ? v['.sv'] === 'timestamp'
      ? now
      : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, now)]))
    : v;

/** Avisa quem escuta um caminho que contém (ou é) o caminho gravado. */
function broadcast(kind, keys, data) {
  const full = keys.join('/');
  for (const c of clients) {
    const base = c.keys.join('/');
    if (base && !(full === base || full.startsWith(base + '/'))) continue;
    const rel = '/' + full.slice(base.length).replace(/^\//, '');
    c.res.write(`event: ${kind}\ndata: ${JSON.stringify({ path: rel, data })}\n\n`);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url, 'http://x');
  const keys = split(decodeURIComponent(url.pathname.replace(/\.json$/, '')));
  if (req.method === 'GET' && (req.headers.accept ?? '').includes('text/event-stream')) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`event: put\ndata: ${JSON.stringify({ path: '/', data: getAt(keys) ?? null })}\n\n`);
    const c = { res, keys };
    clients.add(c);
    req.on('close', () => clients.delete(c));
    return;
  }
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(getAt(keys) ?? null));
  }
  if (req.method === 'PUT' || req.method === 'PATCH') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      const now = Date.now();
      let value;
      try {
        value = resolve(JSON.parse(body || 'null'), now);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end('{"error":"Invalid data"}');
      }
      const deny = () => {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end('{"error":"Permission denied"}');
      };
      if (req.method === 'PUT') {
        if (!allowed(tree, keys, value, now)) return deny();
        tree = setAt(tree, keys, value);
        broadcast('put', keys, value);
      } else {
        const next = applyUpdate(tree, keys, value, now);
        if (!next) return deny();
        tree = next;
        broadcast('patch', keys, value);
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(value));
    });
    return;
  }
  res.writeHead(405).end();
});

server.listen(PORT, () => console.log(`mock-firebase ouvindo em http://localhost:${PORT} (pid ${process.pid})`));
setTimeout(() => {
  console.log('mock-firebase: prazo de 15 min atingido, encerrando');
  process.exit(0);
}, 15 * 60 * 1000).unref();
