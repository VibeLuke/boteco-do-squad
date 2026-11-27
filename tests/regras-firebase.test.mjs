// O console do Firebase só aceita um pedaço das expressões regulares do JavaScript: ^ só no começo, $ só no fim,
// sem olhar adiante/atrás nem retrovisor. O Firebase falso usa JavaScript e aceita tudo, então este teste confere o
// arquivo publicável antes de ir ao console (26/11: "(^|\|)V{5,7}$" passou no mock e o console recusou).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

/** Todas as expressões `.matches(/…/)` de um texto de regra. */
export function regexesOf(rule) {
  const out = [];
  const re = /\.matches\(\//g;
  let m;
  while ((m = re.exec(rule))) {
    let i = m.index + m[0].length;
    let body = '';
    let inClass = false;
    for (; i < rule.length; i++) {
      const c = rule[i];
      if (c === '\\') {
        body += c + rule[i + 1];
        i++;
        continue;
      }
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) break;
      body += c;
    }
    out.push(body);
  }
  return out;
}

/** Motivo da recusa do Firebase, ou null se a expressão passa. */
export function firebaseProblem(body) {
  let inClass = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\') {
      if (/[1-9]/.test(body[i + 1] ?? '')) return 'retrovisor (\\1) não existe no Firebase';
      i++;
      continue;
    }
    if (inClass) {
      if (c === ']') inClass = false;
      continue;
    }
    if (c === '[') {
      inClass = true;
      if (body[i + 1] === '^') i++; // [^…] é negação, vale
      continue;
    }
    if (c === '^' && i !== 0) return `^ fora do começo (posição ${i})`;
    if (c === '$' && i !== body.length - 1) return `$ fora do fim (posição ${i})`;
    if (c === '(' && body[i + 1] === '?') return 'grupo especial (?…) não existe no Firebase';
  }
  return null;
}

function walk(node, at, out) {
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string') out.push([`${at}/${k}`, v]);
    else if (v && typeof v === 'object') walk(v, `${at}/${k}`, out);
  }
  return out;
}

test('o medidor reprova o que o console recusou e aprova o que ele aceita', () => {
  assert.match(firebaseProblem('(^|\\|)V{5,7}$'), /\^ fora do começo/);
  assert.match(firebaseProblem('^a$b'), /\$ fora do fim/);
  assert.match(firebaseProblem('^(?=a)b$'), /grupo especial/);
  assert.match(firebaseProblem('^(a)\\1$'), /retrovisor/);
  assert.equal(firebaseProblem('^(vini|will|dani|bia|tati)$'), null);
  assert.equal(firebaseProblem('^[A-Za-z0-9_-]{3,64}$'), null);
  assert.equal(firebaseProblem('\\|V{5,7}$'), null);
  assert.equal(firebaseProblem('^[^a]$'), null);
  assert.equal(firebaseProblem('^\\$x\\^$'), null);
  assert.deepEqual(regexesOf("a.matches(/^[/]x$/) && b.matches(/\\|y$/)"), ['^[/]x$', '\\|y$']);
});

test('toda expressão de database.rules.json cabe no Firebase', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'));
  const found = [];
  for (const [where, text] of walk(rules, '', [])) {
    for (const body of regexesOf(text)) {
      found.push(body);
      const why = firebaseProblem(body);
      assert.equal(why, null, `${where}: /${body}/ → ${why}`);
    }
  }
  assert.ok(found.length >= 30, `achou só ${found.length} expressões: o leitor quebrou?`);
});

console.log(`\n${passed} testes das regras do Firebase passaram`);
