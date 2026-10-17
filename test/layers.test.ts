import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';

// Packs may import downward only: core <- anim, draw <- devices and other packs. Never sideways.
const allowed: Record<string, string[]> = {
  core: [],
  draw: ['core'],
  anim: ['core'],
  devices: ['core', 'draw', 'anim'],
  ui: ['core', 'draw', 'anim'],
  waves: ['core', 'draw', 'anim'],
  optics: ['core', 'draw', 'anim'],
  charts: ['core', 'draw', 'anim'],
  math: ['core', 'draw', 'anim'],
  flow: ['core', 'draw', 'anim'],
};
const root = resolve(import.meta.dirname, '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

test('packs only import downward', () => {
  const bad: string[] = [];
  for (const file of files(root)) {
    const pack = relative(root, file).split(sep)[0];
    if (!(pack in allowed)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
      const target = relative(root, resolve(dirname(file), m[1])).split(sep)[0];
      if (target !== pack && !allowed[pack].includes(target)) bad.push(`${relative(root, file)} -> ${target}`);
    }
  }
  assert.deepEqual(bad, []);
});
