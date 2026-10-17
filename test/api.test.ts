import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProgram, extract, toMdx, undocumented } from '../site/scripts/api-lib.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const sample = path.join(root, 'test/fixtures/api-sample.ts');
const program = createProgram(root, [sample, path.join(root, 'src/index.ts'), path.join(root, 'src/devices/index.ts')]);
const entries = extract(program, sample, root);
const get = (n: string) => entries.find((e) => e.name === n)!;

test('functions: signature, description, params, returns and the options type', () => {
  const f = get('make');
  assert.equal(f.kind, 'function');
  assert.match(f.signatures[0], /^function make\(o\?: MakeOpts\): string\[\]$/);
  assert.equal(f.doc, 'Makes things.');
  assert.equal(f.params.o, 'what to make');
  assert.equal(f.returns, 'the things');
  assert.deepEqual(f.options, ['MakeOpts']);
});

test('interfaces: a property table with optional, default and inherited', () => {
  const o = get('MakeOpts');
  assert.equal(o.kind, 'interface');
  const kind = o.props.find((p) => p.name === 'kind')!;
  assert.equal(kind.optional, true);
  assert.equal(kind.default, "'plain'");
  assert.equal(kind.type, "'plain' | 'fancy'");
  assert.equal(o.props.find((p) => p.name === 'count')!.doc, 'how many to make');
  assert.equal(o.props.find((p) => p.name === 'at')!.inherited, 'BaseOpts');
  assert.deepEqual(o.extends, ['BaseOpts']);
});

test('classes: public members only, with statics', () => {
  const c = get('Counter');
  assert.equal(c.kind, 'class');
  const names = c.members.map((m) => m.name);
  assert.ok(names.includes('inc') && names.includes('value') && names.includes('from'));
  assert.ok(!names.includes('hidden'), 'private members are not listed');
  assert.equal(c.members.find((m) => m.name === 'from')!.static, true);
  assert.match(c.members.find((m) => m.name === 'inc')!.signature, /^inc\(by\?: number\): number$/);
});

test('types and constants', () => {
  assert.equal(get('Greeting').signatures[0], "type Greeting = 'hi' | 'hello'");
  assert.match(get('greeting').signatures[0], /^const greeting: Greeting$/);
});

test('undocumented lists symbols and properties without a description, not inherited ones', () => {
  const gaps = undocumented(entries).map((g) => (g.prop ? `${g.symbol}.${g.prop}` : g.symbol));
  assert.ok(gaps.includes('nodoc'));
  assert.ok(gaps.includes('MakeOpts.undocumented'));
  assert.ok(!gaps.includes('make') && !gaps.includes('MakeOpts.count'));
});

test('MDX: escapes table pipes and braces, and links option types', () => {
  const mdx = toMdx({ title: 'Sample', importPath: 'x', description: 'A {sample}.', entries });
  assert.match(mdx, /^---\ntitle: "Sample"/);
  assert.match(mdx, /\| `kind\?` \| `'plain' \\\| 'fancy'` \| `'plain'` \| which kind; one of a few \|/);
  assert.match(mdx, /Options: \[`MakeOpts`\]\(#makeopts\)/);
  assert.match(mdx, /A \\\{sample\\\}\./);
  assert.match(mdx, /### MakeOpts/);
});

test('the real packs: every export is described and the option tables are filled', () => {
  const core = extract(program, path.join(root, 'src/index.ts'), root);
  assert.ok(core.length > 80);
  assert.deepEqual(undocumented(core), []);
  const dev = extract(program, path.join(root, 'src/devices/index.ts'), root);
  assert.deepEqual(undocumented(dev), []);
  const monitor = dev.find((e) => e.name === 'monitor')!;
  assert.deepEqual(monitor.options, ['MonitorOpts']);
  const opts = dev.find((e) => e.name === 'MonitorOpts')!;
  assert.ok(opts.props.some((p) => p.name === 'width' && p.doc) && opts.props.some((p) => p.name === 'at' && p.inherited));
  assert.ok(core.find((e) => e.name === 'Scene')!.members.length > 5);
});
