/*
 * Generates the API reference: one MDX page per pack in src/content/docs/reference/ (not committed).
 *   node scripts/api.ts            write the pages
 *   node scripts/api.ts --check    also list what has no description
 *   node scripts/api.ts --strict   as --check, and fail when anything is missing
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createProgram, extract, summaryOf, toMdx, undocumented } from './api-lib.ts';
import type { Entry } from './api-lib.ts';
import { withImports } from '../src/demos/code.ts';
import { assetDemos } from '../src/demos/registry/assets.ts';
import * as core from '../../src/index.ts';
import * as devices from '../../src/devices/index.ts';
import * as ui from '../../src/ui/index.ts';
import * as charts from '../../src/charts/index.ts';
import * as waves from '../../src/waves/index.ts';
import * as optics from '../../src/optics/index.ts';
import * as math from '../../src/math/index.ts';
import * as flow from '../../src/flow/index.ts';
import { site } from '../src/config.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = fileURLToPath(new URL('../src/content/docs/reference/', import.meta.url));

export const packs = [
  { id: 'core', title: 'Core', entry: 'src/index.ts', path: '', blurb: 'Scenes, cameras, nodes, shapes, text, animation, orbit controls and mounting.' },
  { id: 'devices', title: 'Devices', entry: 'src/devices/index.ts', path: 'devices', blurb: 'Screens, computers, peripherals, network gear and simple solids.' },
  { id: 'ui', title: 'UI on screens', entry: 'src/ui/index.ts', path: 'ui', blurb: 'Progress, notifications, dialogs, badges and chat that live on a screen.' },
  { id: 'charts', title: 'Charts', entry: 'src/charts/index.ts', path: 'charts', blurb: 'Bar, line, area, scatter, pie, histogram, heatmap, radar and sparkline charts.' },
  { id: 'waves', title: 'Waves', entry: 'src/waves/index.ts', path: 'waves', blurb: 'Transverse, longitudinal, standing, ring, sonar, spherical, plane, interference and echo waves.' },
  { id: 'optics', title: 'Optics', entry: 'src/optics/index.ts', path: 'optics', blurb: 'Pinhole camera frusta and stereo rigs.' },
  { id: 'math', title: 'Maths', entry: 'src/math/index.ts', path: 'math', blurb: 'Graphs, matrices, transforms, vector fields, number lines and the unit circle.' },
  { id: 'flow', title: 'Graphs and flow', entry: 'src/flow/index.ts', path: 'flow', blurb: 'Flowcharts, trees and networks that lay themselves out, with edges that trace on and carry pulses.' },
];

const mode = process.argv.includes('--strict') ? 'strict' : process.argv.includes('--check') ? 'check' : 'write';
const program = createProgram(root, packs.map((p) => path.join(root, p.entry)));
mkdirSync(out, { recursive: true });
// Pages are rewritten in place, and only when they changed. Deleting them first would make a running dev
// server briefly lose a page the sidebar names, and show an error on every page of the site.
const labels: Record<string, string> = { ui: 'UI', math: 'Maths' };
const written = new Set<string>(['index.mdx']);
const put = (file: string, text: string) => {
  const full = path.join(out, file);
  written.add(file);
  if (existsSync(full) && readFileSync(full, 'utf8') === text) return;
  writeFileSync(full, text);
};

const names = (ns: object) => Object.keys(ns).filter((k) => k !== 'default');
const NAMES: Record<string, string[]> = { '': names(core), devices: names(devices), ui: names(ui), charts: names(charts), waves: names(waves), optics: names(optics), math: names(math), flow: names(flow) };

// every pack first, so a type used in one pack can link to its page in another
const extracted = packs.map((p) => ({ p, entries: extract(program, path.join(root, p.entry), root) }));
const index: Record<string, string> = {};
for (const { p, entries } of [...extracted].reverse()) for (const e of entries) index[e.name] = p.id;
// the gallery card that shows a name, where there is one
const gallery: Record<string, string> = {};
// the first card of each function; charts and waves have several cards per function
for (const d of assetDemos) { const card = d.id.split('/')[1]; gallery[d.fn ?? card] ??= `/gallery/${d.pack}/#${card}`; }
{ const f = fileURLToPath(new URL('../src/demos/ref-index.json', import.meta.url)), text = JSON.stringify(index, null, 1); if (!existsSync(f) || readFileSync(f, 'utf8') !== text) writeFileSync(f, text); }

// an @example in a doc comment is written without imports; they are added here, so an example always imports what it uses
for (const { entries } of extracted) for (const e of entries) e.examples = e.examples.map((x) => (/^\s*import\b/m.test(x) ? x : withImports(x, NAMES)));

let total = 0, missing = 0;
const lines: string[] = [];
const all: { e: Entry; pack: string }[] = [];
for (const [i, { p, entries }] of extracted.entries()) {
  const importPath = p.path ? `${site.pkg}/${p.path}` : site.pkg;
  put(`${p.id}.mdx`, toMdx({ title: p.title, importPath, description: p.blurb, entries, index, pack: p.id, gallery }).replace(/^---\n/, `---\nsidebar:\n  label: ${labels[p.id] ?? p.title} API\n  order: ${i + 2}\n`));
  for (const e of entries) all.push({ e, pack: p.id });
  const gaps = undocumented(entries);
  total += entries.length;
  missing += gaps.length;
  if (mode !== 'write' && gaps.length) lines.push(`${p.id}: ${gaps.length} missing`, ...gaps.map((g) => `  ${g.symbol}${g.prop ? `.${g.prop}` : ''}`));
  console.log(`reference/${p.id}.mdx  ${entries.length} exports`);
}

// one table of everything, to scan or filter
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/[{}<]/g, (c) => `\\${c}`);
const kindLabel = (k: string) => (k === 'interface' || k === 'type' ? 'type' : k === 'const' || k === 'enum' ? 'value' : k);
const rows = all.sort((a, b) => a.e.name.localeCompare(b.e.name, 'en', { sensitivity: 'base' })).map(({ e, pack }) => `| [\`${e.name}\`](/reference/${pack}/#${e.name.toLowerCase()}) | ${kindLabel(e.kind)} | ${packs.find((p) => p.id === pack)!.title} | ${cell(summaryOf(e.doc))} |`);
put('all.mdx', `---\ntitle: All exports\ndescription: Every export of every pack in one list. Type to filter.\nsidebar:\n  label: All exports\n  order: 1\n---\n\nimport RefFilter from '../../../components/RefFilter.astro';\n\nEvery export of every pack in one list. Type in the box to filter by name or description.\n\n<RefFilter rows />\n\n| Name | Kind | Pack | What it does |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`);
// pages that no longer have a pack
for (const f of readdirSync(out)) if (!written.has(f)) rmSync(path.join(out, f));
if (mode !== 'write') console.log(lines.join('\n'));
console.log(`${total} exports, ${missing} without a description`);
if (mode === 'strict' && missing) process.exit(1);
