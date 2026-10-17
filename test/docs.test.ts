import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../src/index.ts';
import * as devices from '../src/devices/index.ts';
import * as ui from '../src/ui/index.ts';
import * as charts from '../src/charts/index.ts';
import * as waves from '../src/waves/index.ts';
import * as optics from '../src/optics/index.ts';
import * as math from '../src/math/index.ts';
import * as flow from '../src/flow/index.ts';
import { run } from '../site/src/lib/run.ts';
import { site } from '../site/src/config.ts';

const docs = fileURLToPath(new URL('../site/src/content/docs/', import.meta.url));
const ns = { '': core, devices, ui, charts, waves, optics, math, flow } as never;

/** the hand-written pages: the reference folder is generated at build time and may not exist yet */
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'reference' ? [] : files(path.join(dir, e.name))) : /\.mdx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
}

interface Block { file: string; line: number; lang: string; meta: string; code: string }
function blocks(): Block[] {
  const out: Block[] = [];
  for (const file of files(docs)) {
    const text = readFileSync(file, 'utf8');
    const re = /^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      out.push({ file: path.relative(docs, file), line: text.slice(0, m.index).split('\n').length, lang: m[1], meta: m[2].trim(), code: m[3].replaceAll('@@pkg@@', site.pkg).replaceAll('@@name@@', site.name) });
    }
  }
  return out;
}

const all = blocks();
const runnable = all.filter((b) => /^(ts|js|typescript)$/.test(b.lang) && !b.meta.includes('norun') && /new Scene\(/.test(b.code));

test('the docs have code, and most scene examples are runnable', () => {
  assert.ok(all.length > 25, `${all.length} code blocks`);
  assert.ok(runnable.length >= 15, `${runnable.length} runnable blocks`);
});

for (const b of runnable) {
  test(`docs code runs: ${b.file}:${b.line}`, () => {
    const r = run(b.code, ns) as { scene?: core.Scene };
    assert.ok(r.scene instanceof core.Scene, 'defines a Scene named s');
    const svg = r.scene.svg();
    assert.ok(svg.startsWith('<svg') && svg.length > 100);
  });
}

test('no tokens, em dashes or stray names are left in the docs source', () => {
  for (const file of files(docs)) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!text.includes('\u2014'), `${file} has an em dash`);
    for (const m of text.matchAll(/@@(\w+)@@/g)) assert.ok(['name', 'pkg'].includes(m[1]), `${file}: unknown token ${m[0]}`);
  }
});

test('every demo id used in the docs exists', async () => {
  // the scene registry reads source with ?raw, which only the site's bundler understands, so read its ids from the text
  const { assetDemos } = await import('../site/src/demos/registry/assets.ts');
  const ids = new Set(assetDemos.map((d) => d.id));
  const src = readFileSync(new URL('../site/src/demos/registry/scenes.ts', import.meta.url), 'utf8');
  for (const m of src.matchAll(/scene\('(\w+)', '([\w-]+)'/g)) ids.add(`${m[1]}/${m[2]}`);
  assert.ok(ids.size > 70);
  for (const file of files(docs)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/<Demo id="([^"]+)"/g)) assert.ok(ids.has(m[1]), `${file}: unknown demo ${m[1]}`);
  }
});
