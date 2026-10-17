import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.ts';
import * as devices from '../src/devices/index.ts';
import * as ui from '../src/ui/index.ts';
import * as charts from '../src/charts/index.ts';
import * as waves from '../src/waves/index.ts';
import * as optics from '../src/optics/index.ts';
import * as math from '../src/math/index.ts';
import * as flow from '../src/flow/index.ts';
import { run, compile, rewriteImports, RunError } from '../site/src/lib/run.ts';
import { encodeCode, decodeCode } from '../site/src/lib/share.ts';
import { assetDemos } from '../site/src/demos/registry/assets.ts';
import { region, withImports } from '../site/src/demos/code.ts';
import { readFileSync } from 'node:fs';

const ns = { '': core, devices, ui, charts, waves, optics, math, flow } as never;
const norm = (svg: string) => svg.replace(/\b(szg|szp|szc)-?[\w-]*\d[\w-]*/g, '$1');
const fails = (code: string): RunError => { try { run(code, ns); } catch (e) { return e as RunError; } throw new Error('expected an error'); };

test('every shown example runs in the playground and draws what the demo draws', () => {
  for (const d of assetDemos) {
    const r = run(d.code(d.defaults), ns) as { scene: core.Scene };
    assert.equal(norm(r.scene.svg()), norm(d.make(d.defaults).s.svg()), d.id);
  }
});

test('the hand-written examples run in the playground exactly as they are shown', () => {
  // their code is cut out of the demo file, so a helper left outside the cut shows up here as an undefined name
  const source = readFileSync(new URL('../site/src/demos/scenes.ts', import.meta.url), 'utf8');
  const names = (o: object) => Object.keys(o).filter((k) => k !== 'default');
  const packs = { '': names(core), devices: [...names(devices).filter((k) => k !== 'document'), 'paper'], ui: names(ui), charts: names(charts), waves: names(waves), optics: names(optics), math: names(math), flow: names(flow) };
  let seen = 0;
  for (const m of source.matchAll(/export const \w+ = \(\): Made => \{\n\s*\/\/ #region (\w+)/g)) {
    const code = withImports(region(source, m[1]), packs).replace(/^import \{([^}]*)\} from/gm, (_x, n: string) => `import {${n.replace(/\bpaper\b/, 'document as paper')}} from`);
    const r = run(code, ns) as { scene: core.Scene };
    assert.ok(r.scene instanceof core.Scene, m[1]);
    seen++;
  }
  assert.ok(seen > 40, `found only ${seen} examples`);
});

test('TypeScript syntax is stripped and the timeline is returned', () => {
  const r = run(`import { Scene, Timeline, box, fadeIn } from 'cseen';
interface Opts { size: number }
const o: Opts = { size: 1 as number };
const s = new Scene();
const b = s.add(box({ at: [0, 0, 0] as [number, number, number], size: o.size }));
const tl = new Timeline();
tl.play(fadeIn(b));`, ns);
  assert.ok(r.scene instanceof core.Scene);
  assert.ok(r.timeline instanceof core.Timeline);
});

test('imports of every pack, aliases and namespaces work; css imports are ignored', () => {
  const r = run(`import * as z from 'cseen';
import { monitor as mon } from 'cseen/devices';
import { bars } from 'cseen/charts';
import 'cseen/cseen.css';
const s = new z.Scene();
s.add(mon(), bars({ data: [1, 2] }));`, ns);
  assert.ok(r.scene instanceof core.Scene);
});

test('rewriting keeps the line count, so errors point at the right line', () => {
  const src = `import {\n  Scene,\n  box,\n} from 'cseen';\nconst s = new Scene();\nconsole.log(0);\nnull.x;`;
  assert.equal(rewriteImports(src, ['']).split('\n').length, src.split('\n').length);
  assert.equal(fails(src).line, 7);
  assert.match(fails(src).message, /null|Cannot read/);
});

test('bad code gives a readable error', () => {
  assert.match(fails(`import fs from 'node:fs';`).message, /Only 'cseen' and its packs/);
  assert.match(fails(`import 'lodash';`).message, /Cannot import "lodash"/);
  const syn = fails(`const s = new Scene(;\n`);
  assert.ok(syn instanceof RunError && syn.message.length > 3, syn.message);
  assert.equal(syn.line, 1);
  assert.match(fails(`const s = nothing();`).message, /nothing is not defined/);
  assert.match(fails(`const s = new Scene();`).message, /Add: import \{ Scene \} from 'cseen';/);
  assert.match(fails(`const s = bars({});`).message, /from 'cseen\/charts'/);
  assert.equal(run('const x = 1;', ns).scene, undefined);
});

test('compile output is plain JavaScript', () => {
  const js = compile(`const a: number = 1; type T = string; export {};`, ['']);
  assert.ok(!/: number|type T/.test(js));
});

test('code travels in the URL hash and back, including non-ASCII', () => {
  const code = `// héllo ✓\nconst s = new Scene({ title: 'x' });\n`;
  const h = encodeCode(code);
  assert.match(h, /^[A-Za-z0-9_-]+$/);
  assert.equal(decodeCode(`#code=${h}`), code);
  assert.equal(decodeCode('#code=%%%'), null);
  assert.equal(decodeCode(''), null, 'no hash means no code');
  assert.equal(decodeCode('#other'), null);
});
