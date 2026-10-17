/** Pure logic of the docs site: share links, the playground's import rewriting, code literals, escaping and theme maths. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCode, encodeCode, idFromHash, playgroundHref } from '../site/src/lib/share.ts';
import { RunError, compile, guardLoops, rewriteImports, run } from '../site/src/lib/run.ts';
import { esc, highlight } from '../site/src/lib/highlight.ts';
import { lit, region, withImports } from '../site/src/demos/code.ts';
import { contrast, fromSeed, logoFor, THEMES } from '../site/src/theme.ts';

test('share links: code survives the round trip, including unicode and long input', () => {
  for (const code of ['', 'const s = new Scene();', 'héllo ✓ 𝄞\n\ttab', 'x'.repeat(5000), "a'b\"c<d>&"]) {
    const back = decodeCode(`#code=${encodeCode(code)}`);
    if (code === '') assert.equal(back, null);
    else assert.equal(back, code);
  }
  assert.match(playgroundHref('a', '/base'), /^\/base\/playground\/#code=/);
});

test('share links: padding, extra parameters and a missing # are tolerated, damage is rejected', () => {
  const b = encodeCode('hello world!');
  assert.equal(decodeCode(`code=${b}`), 'hello world!');
  assert.equal(decodeCode(`#code=${b}==`), 'hello world!');
  assert.equal(decodeCode(`#code=${b}&utm=1`), 'hello world!');
  assert.equal(decodeCode('#code='), null);
  assert.equal(decodeCode('#other=1'), null);
  assert.equal(decodeCode('#code=%%%'), null);
  assert.equal(decodeCode('#code=A'), null, 'a length of 1 mod 4 is not base64');
  // valid base64 of bytes that are not UTF-8: not loaded into the editor as replacement characters
  assert.equal(decodeCode(`#code=${Buffer.from([0xff, 0xfe, 0xfd]).toString('base64url')}`), null);
});

test('hash ids: percent-encoding is decoded and a broken one is ignored instead of throwing', () => {
  assert.equal(idFromHash('#monitor'), 'monitor');
  assert.equal(idFromHash('#a%20b'), 'a b');
  assert.equal(idFromHash('#%E0%A4%A'), '');
  assert.equal(idFromHash(''), '');
});

test('playground imports: only the library, packs map to namespaces, line count is kept', () => {
  const known = ['', 'devices', 'charts'];
  assert.equal(rewriteImports("import { a, b as c } from 'cseen/charts';\nx", known), 'const { a, b: c } = __ns["charts"];\nx');
  assert.equal(rewriteImports("import * as S from 'cseen';", known), 'const S = __ns[""];');
  assert.equal(rewriteImports("import {\n  a,\n  b,\n} from 'cseen';\nz", known).split('\n').length, 5);
  assert.throws(() => rewriteImports("import _ from 'lodash';", known), RunError);
  assert.throws(() => rewriteImports("import 'evil';", known), /Cannot import/);
  assert.throws(() => rewriteImports("import { a } from 'cseen/nope';", known), /Cannot import/);
});

test('playground imports: a css import above a library import is dropped, not merged into the next statement', () => {
  const out = rewriteImports("import './x.css';\nimport { Scene } from 'cseen';\nconst s = new Scene();", ['']);
  assert.equal(out, '\nconst { Scene } = __ns[""];\nconst s = new Scene();');
  assert.equal(rewriteImports("import 'a.css'; import 'b.css';\nimport { Scene } from 'cseen';", ['']).includes('const { Scene }'), true);
});

test('playground imports: type-only imports vanish', () => {
  assert.equal(rewriteImports("import type { Scene } from 'cseen';\nlet s;", ['']), '\nlet s;');
  assert.equal(rewriteImports("import { type Scene, box } from 'cseen';", ['']), 'const { Scene, box } = __ns[""];');
});

test('playground run: errors carry a line, and a missing import is named', () => {
  const ns = { '': { Scene: class {} }, charts: { barChart: () => 1 } };
  assert.throws(() => run('const a = 1;\nnull.boom;', ns), (e: unknown) => e instanceof RunError && e.line === 2);
  assert.throws(() => run('const s = new Scene(;', ns), (e: unknown) => e instanceof RunError && e.line === 1);
  assert.throws(() => run('barChart();', ns), /Add: import \{ barChart \} from 'cseen\/charts';/);
  assert.equal(compile('const a: number = 1;', ['']).includes(': number'), false);
  const r = run("import { Scene } from 'cseen';\nconst s = new Scene();", ns);
  assert.ok(r.scene instanceof ns[''].Scene);
});

test('escaping: text, quotes and angle brackets never reach the page as markup', () => {
  assert.equal(esc(`<img src=x onerror="a()">&`), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;');
  const html = highlight(`const s = '</script><b>';\n// <i>"x"</i>`);
  assert.equal(/<(?!\/?span\b)/.test(html), false, html);
  assert.equal(html.includes('"x"'), false);
});

test('code literals: keys that are not valid bare keys are quoted, strings are one line', () => {
  assert.equal(lit({ 1: 'a', '01': 'b', 'a-b': 1, ok: 2 }), "{ 1: 'a', '01': 'b', 'a-b': 1, ok: 2 }");
  assert.equal(lit('a\r\nb '), "'a\\r\\nb\\u2028'");
  assert.equal(lit(-0), '0');
});

test('code helpers: names with regex characters are matched literally', () => {
  assert.equal(withImports('a$b$c(1)', { '': ['a$b$c'] }).startsWith("import { a$b$c } from 'cseen';"), true);
  assert.equal(withImports('xaybyc(1)', { '': ['a$b$c'] }), 'xaybyc(1)');
  const src = '// #region a.b\nfoo\n// #endregion\n// #region axb\nbar\n// #endregion';
  assert.equal(region(src, 'a.b'), 'foo');
  assert.equal(region(src, 'axb'), 'bar');
  assert.throws(() => region(src, 'a.*'), /no region/);
});

test('theme: every preset logo and random palette is legible', () => {
  for (const t of Object.values(THEMES)) for (const p of [t.light, t.dark]) {
    assert.ok(contrast(p.ink, p.bg) > 7, `${t.label} ink on background`);
    assert.equal(logoFor(p).mono === false || contrast(p.accent, p.bg) < 2, true);
  }
  for (let i = 0; i < 50; i++) {
    const seed = { h: Math.random() * 360, a: (150 + Math.random() * 60) % 360 };
    for (const dark of [false, true]) {
      const p = fromSeed(seed, dark);
      assert.match(p.bg + p.ink + p.accent, /^(#[0-9a-f]{6}){3}$/);
      assert.ok(contrast(p.ink, p.bg) > 7);
    }
  }
});

/* ------------------------------------------------------------------ loop guard */

const runCode = run;

const ranIn = (code: string, ms = 150) => { const t = Date.now(); try { runCode(code, { '': {} }, ms); } catch (e) { return { error: e as Error, took: Date.now() - t }; } return { error: null, took: Date.now() - t }; };
const value = (code: string) => (runCode(code, { '': {} }) as { scene: unknown }).scene;

test('loops that never end are stopped with a message, whatever shape they take', () => {
  for (const code of ['while (true) {}', 'for (;;) {}', 'for (;;);', 'while (1);', 'let i = 0; do { i++; } while (true);', 'let i = 0; while (true) i++;', 'for (let i = 0; ; i++) { for (let j = 0; j < 3; j++) {} }', 'const f = () => { while (true) {} }; f();', 'while (true) /* c */ {}', 'let n = 0; while (true) n++, n--;']) {
    const r = ranIn(code);
    assert.ok(r.error instanceof RunError, `${code}: ${r.error}`);
    assert.match(r.error!.message, /ran for more than/, code);
    assert.ok(r.took < 2000, `${code} took ${r.took} ms`);
  }
});

test('the guard leaves working code alone: results, lines, strings, comments, regexes and do-while', () => {
  assert.equal(value('let t = 0; for (let i = 0; i < 1000; i++) { t += i; } const s = t;'), 499500);
  assert.equal(value('let i = 0; do { i++; } while (i < 5); const s = i;'), 5);
  assert.equal(value('let i = 0; do { i++; } while (i < 5)\nconst s = i;'), 5);
  assert.equal(value('let n = 0; for (const a of [1, 2, 3]) n += a; const s = n;'), 6);
  assert.equal(value('let n = 0; for (const k in { a: 1, b: 2 }) { n++; } const s = n;'), 2);
  assert.equal(value('let n = 0, i = 0; while (i < 4) if (i++ % 2) n++; const s = n;'), 2);
  assert.equal(value('const s = "while (true) {}" + `for (;;) {}` + /while (x) {/.source + 4 / 2 / 1;'), 'while (true) {}for (;;) {}while (x) {2');
  assert.equal(value('// while (true) {}\n/* for (;;) {} */ const s = 7;'), 7);
  assert.equal(value('const o = { while: 1, for: 2 }; const s = o.while + o.for;'), 3);
  const src = 'let a = 0;\nwhile (a < 3) {\n  a++;\n}\nfor (;;) {\n  break;\n}\n';
  assert.equal(guardLoops(src).split('\n').length, src.split('\n').length, 'the lines stay where they were');
  assert.equal(guardLoops('const s = 1;'), 'const s = 1;', 'code with no loops is returned as it is');
  assert.ok(ranIn('let t = 0; for (let i = 0; i < 2_000_000; i++) t += i;', 5000).error === null, 'a long but finite loop is fine');
});

test('a loop inside a callback that the scene keeps is not timed after the run', () => {
  const f = runCode('const s = (n) => { let t = 0; for (let i = 0; i < n; i++) t += i; return t; };', { '': {} }, 50) as { scene: (n: number) => number };
  const t0 = Date.now();
  while (Date.now() - t0 < 80) { /* let the run's limit pass */ }
  assert.equal(f.scene(20000), 199990000);
});

test('a share link that is far too large is refused before it is decoded', () => {
  assert.equal(decodeCode(`#code=${'A'.repeat(300_000)}`), null);
  assert.equal(decodeCode(`#code=${encodeCode('x'.repeat(50_000))}`), 'x'.repeat(50_000));
});
