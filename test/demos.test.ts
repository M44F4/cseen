import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.ts';
import * as devices from '../src/devices/index.ts';
import * as charts from '../src/charts/index.ts';
import * as waves from '../src/waves/index.ts';
import { assetDemos } from '../site/src/demos/registry/assets.ts';
import { lit, region, withImports } from '../site/src/demos/code.ts';
import type { Demo, Opts } from '../site/src/demos/types.ts';

const ns: Record<string, unknown> = { ...core, ...devices, ...charts, ...waves, paper: devices.document };
const names = Object.keys(ns).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k) && k !== 'document');

/** runs the code a demo shows (imports removed) and returns the scene it builds */
function run(code: string): core.Scene {
  const body = code.split('\n').filter((l) => !l.startsWith('import ')).join('\n');
  return new Function(...names, `${body}\nreturn s;`)(...names.map((n) => ns[n])) as core.Scene;
}

/** element ids come from a global counter, so two identical scenes differ only there */
const norm = (svg: string) => svg.replace(/\b(szg|szp|szc)-?[\w-]*\d[\w-]*/g, "$1");

/** the defaults, then each control changed once */
function variants(d: Demo): Opts[] {
  const out: Opts[] = [d.defaults];
  for (const c of d.controls) {
    if (c.type === 'number') out.push({ ...d.defaults, [c.key]: Math.round(((c.min + c.max) / 2) / (c.step ?? 1)) * (c.step ?? 1) });
    else if (c.type === 'boolean') out.push({ ...d.defaults, [c.key]: !d.defaults[c.key] });
    else if (c.type === 'select') for (const o of c.options) out.push({ ...d.defaults, [c.key]: o });
    else out.push({ ...d.defaults, [c.key]: 'abc' });
  }
  return out;
}

test('ids are unique and every demo draws something', () => {
  assert.equal(new Set(assetDemos.map((d) => d.id)).size, assetDemos.length);
  for (const d of assetDemos) assert.ok(d.make(d.defaults).s.svg().length > 400, d.id);
});

test('the code a demo shows draws exactly what the demo draws', () => {
  let n = 0;
  for (const d of assetDemos) {
    for (const o of variants(d)) {
      const shown = norm(run(d.code(o)).svg()), drawn = norm(d.make(o).s.svg());
      assert.equal(shown, drawn, `${d.id} ${JSON.stringify(o).slice(0, 80)}`);
      n++;
    }
  }
  assert.ok(n > 150, `checked ${n} variants`);
});

test('shown code imports what it uses from the right pack', () => {
  const code = assetDemos.find((d) => d.id === 'devices/monitor')!.code({ width: 3 });
  assert.match(code, /import \{ Scene, ground \} from 'cseen';/);
  assert.match(code, /import \{ monitor \} from 'cseen\/devices';/);
  assert.match(assetDemos.find((d) => d.id === 'devices/document')!.code({}), /document as paper/);
  assert.match(assetDemos.find((d) => d.id === 'charts/bar')!.code({}), /from 'cseen\/charts'/);
});

test('literals: quotes, nesting and wrapping', () => {
  assert.equal(lit("it's"), "'it\\'s'");
  assert.equal(lit({ a: 1, 'b-c': [1, 2] }), "{ a: 1, 'b-c': [1, 2] }");
  assert.equal(lit({ a: undefined, b: 2 }), '{ b: 2 }');
  assert.ok(lit(Array.from({ length: 60 }, (_, i) => i * 7)).includes('\n'));
  assert.equal(withImports('a(ease: 1); b()', { '': ['a', 'ease', 'b'] }), "import { a, b } from 'cseen';\n\na(ease: 1); b()");
});

test('regions are extracted without their common indent', () => {
  const src = 'x\n  // #region r\n  const a = 1;\n    b();\n  // #endregion\n';
  assert.equal(region(src, 'r'), 'const a = 1;\n  b();');
  assert.throws(() => region(src, 'missing'));
});
