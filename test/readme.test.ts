import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');

test('every image and file the README points at is in the repository', () => {
  const paths = [...readme.matchAll(/(?:src|srcset)="(docs\/[^"]+)"/g)].map((m) => m[1]);
  paths.push(...[...readme.matchAll(/\]\(((?:docs\/|site\/)?[A-Za-z][^)#:\s]*)\)/g)].map((m) => m[1]));
  assert.ok(paths.length >= 10, 'the README shows its figures');
  for (const p of paths) assert.ok(existsSync(join(root, p)), `${p} is missing`);
});

test('every README figure has a light and a dark file', () => {
  const names = new Set([...readme.matchAll(/docs\/img\/([a-z]+)-(?:light|dark)\.svg/g)].map((m) => m[1]));
  assert.ok(names.size >= 5);
  for (const n of names) for (const m of ['light', 'dark']) assert.ok(existsSync(join(root, 'docs/img', `${n}-${m}.svg`)));
});

test('README figures are standalone: no script, no outside reference', () => {
  for (const f of ['hero', 'chart', 'flow', 'deploy', 'stereo']) {
    const svg = readFileSync(join(root, 'docs/img', `${f}-light.svg`), 'utf8');
    assert.ok(svg.includes('<style>'), `${f} carries its stylesheet`);
    assert.ok(!/<script|\son\w+=|href="https?:/i.test(svg), `${f} is self-contained`);
  }
});
