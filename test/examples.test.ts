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
import { run } from '../site/src/lib/run.ts';
import { withImports } from '../site/src/demos/code.ts';
import { createProgram, extract } from '../site/scripts/api-lib.ts';
import type { Entry } from '../site/scripts/api-lib.ts';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/*
 * The examples live in the doc comments of the library (`@example`), next to the code they show. This
 * reads them with the same extractor the reference uses, adds the imports, and runs every one.
 */
const root = fileURLToPath(new URL('../', import.meta.url));
const ns = { '': core, devices, ui, charts, waves, optics, math, flow } as never;
const names = (m: object) => Object.keys(m).filter((k) => k !== 'default');
const NAMES = { '': names(core), devices: names(devices), ui: names(ui), charts: names(charts), waves: names(waves), optics: names(optics), math: names(math), flow: names(flow) };
const packs = { core: 'src/index.ts', devices: 'src/devices/index.ts', ui: 'src/ui/index.ts', charts: 'src/charts/index.ts', waves: 'src/waves/index.ts', optics: 'src/optics/index.ts', math: 'src/math/index.ts', flow: 'src/flow/index.ts' };
const program = createProgram(root, Object.values(packs).map((p) => path.join(root, p)));
const entries: Record<string, Entry[]> = Object.fromEntries(Object.entries(packs).map(([k, p]) => [k, extract(program, path.join(root, p), root)]));

// helpers that are not part of drawing a scene are documented without an example
const exempt = new Set(['core/sphereOf', 'core/parseSvg', 'core/nestSvg', 'core/rng', 'core/tokenize', 'core/layoutRows', 'core/dragToAngles', 'core/clampZoom', 'core/orbitPosition', 'core/anglesOf', 'core/colourOf', 'core/ease', 'devices/keyboardLayout', 'charts/niceTicks', 'charts/toTable', 'charts/chart']);

test('every function of every pack has an @example in its doc comment', () => {
  const missing: string[] = [];
  for (const [p, list] of Object.entries(entries)) for (const e of list) if (e.kind === 'function' && !e.examples.length && !exempt.has(`${p}/${e.name}`)) missing.push(`${p}/${e.name}`);
  assert.deepEqual(missing, []);
});

// examples that need a page (mount, orbit, the document) are shown but not run here
const needsPage = /document\.|mount\(|renderStill|orbit\(/;
for (const [p, list] of Object.entries(entries)) {
  for (const e of list) {
    e.examples.forEach((body, i) => {
      if (needsPage.test(body)) return;
      test(`example runs: ${p}/${e.name}${i ? ` (${i + 1})` : ''}`, () => {
        const r = run(/^\s*import\b/m.test(body) ? body : withImports(body, NAMES), ns) as { scene?: core.Scene; timeline?: core.Timeline };
        assert.ok(r.scene instanceof core.Scene, 'defines a Scene named s');
        // at the end of its timeline, if it has one: a pen or a fade has drawn nothing at the start
        const svg = core.renderStill(r.scene, r.timeline);
        assert.ok(svg.startsWith('<svg') && svg.length > 200, 'draws something');
      });
    });
  }
}
