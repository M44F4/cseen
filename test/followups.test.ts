import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Group, Camera, Construct, Spheres, box, parseSvg, pulse } from '../src/index.ts';
import { trimPolyline } from '../src/core/math.ts';
import { frustum } from '../src/optics/index.ts';
import { chat } from '../src/ui/index.ts';
import { antenna } from '../src/devices/index.ts';
import { scatter, toTable } from '../src/charts/index.ts';
import { seriesName } from '../src/charts/charts.ts';
import { unitCircle, graph } from '../src/math/index.ts';
import type { Prim, V3 } from '../src/index.ts';

const close = (a: V3, b: V3, msg = '') => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${msg} ${a} vs ${b}`));

test('toLocal undoes world, through nested groups with rotation and scale', () => {
  const outer = new Group({ at: [1, 2, 3], rot: [10, 20, 30], scale: 1.5 }), inner = new Group({ at: [-2, 0.5, 1], rot: [0, 45, 90], scale: 0.5 });
  outer.add(inner);
  for (const p of [[0, 0, 0], [1, 2, 3], [-4, 0.3, 2]] as V3[]) close(inner.toLocal(inner.world(p)), p, 'round trip');
});

test('a frustum projects a node or an anchor where it is in the scene, wherever the camera stands', () => {
  const dots = (cam: ReturnType<typeof frustum>) => { const s = new Scene({ view: 'front' }); s.add(cam); return s.prims().filter((p) => p.kind === 'dot').map((p) => p.pts[0]); };
  const home = dots(frustum({ target: [0, 1, 0], points: [[0, 3, 0.5]] }));
  const moved = dots(frustum({ at: [4, 0, 0], target: [0, 1, 0], points: [() => [4, 3, 0.5] as V3] }));
  assert.equal(home.length, moved.length);
  home.forEach((p, i) => close([p[0] + 4, p[1], p[2]], moved[i], 'the same picture, shifted with the camera'));
  const target = box({ at: [4, 3, 0.5] }), byNode = dots(frustum({ at: [4, 0, 0], target: [0, 1, 0], points: [target] }));
  moved.forEach((p, i) => close(p, byNode[i], 'node and anchor agree'));
});

test('scatter keeps its x axis labels inside the picture and uses the room it reserved', () => {
  const s = new Scene({ view: 'front', size: [400, 260] });
  s.add(scatter({ points: [{ x: 1, y: 2 }, { x: 3, y: 5 }, { x: 4, y: 1 }], axes: { xLabel: 'time' }, size: [4, 2.6] }));
  const svg = s.svg(), axis = [...svg.matchAll(/<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="\1" stroke="var\(--c-ink\)"/g)].map((m) => +m[1])[0];
  const label = +/y="([\d.]+)"[^>]*>time</.exec(svg)![1];
  assert.ok(label < 260 && label > axis, 'the label is below the axis and inside');
  assert.ok(axis > 200, `the plot is as tall as the room allows (axis at ${axis})`);
});

test('the unit circle names its angle between 0 and 359 degrees', () => {
  const read = (angle: number) => { const c = unitCircle({}); c.set('angle', angle); const s = new Scene({ view: 'front' }); s.add(c); return s.svg(); };
  assert.match(read(-30), />330°</);
  assert.match(read(400), />40°</);
});

test('a perspective camera standing on its target looks along y instead of seeing nothing', () => {
  const cam = Camera.perspective({ position: [1, 2, 3], target: [1, 2, 3] });
  assert.ok(cam.visible([1, 5, 3]));
  assert.ok(Math.abs(cam.project([1, 5, 3])[2] - 3) < 1e-9, 'a point 3 ahead is 3 deep');
});

test('a construct with an empty box still draws finite numbers', () => {
  for (const b of [[0, 0, 0, 0], [0, 0, 0, 100], [5, 5, -50, 50]] as [number, number, number, number][]) {
    const c = new Construct({ box: b, size: [3, 3] });
    c.add({ d: 'M0 0L10 10', width: 2 });
    const s = new Scene({ view: 'front' });
    s.add(c);
    assert.doesNotMatch(s.svg(), /NaN|Infinity/, `box ${b}`);
    for (const v of c.at(1, 1)) assert.ok(Number.isFinite(v));
  }
});

test('unnamed series are called A to Z and then AA, AB, like spreadsheet columns', () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52, 701, 702].map(seriesName), ['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
  const t = toTable(Array.from({ length: 30 }, (_, i) => [i, i + 1]));
  assert.deepEqual(t.series.slice(24, 28).map((s) => s.name), ['Y', 'Z', 'AA', 'AB']);
});

test('a graph breaks its line where the function is not a number, and draws the pieces on at the same pace', () => {
  const path = (grow: number, fn: (x: number) => number) => {
    const g = graph({ fn, x: [-2, 2], y: [-5, 5] });
    g.set('grow', grow);
    const s = new Scene({ view: 'front' });
    s.add(g);
    return [...s.svg().matchAll(/<path d="(M[^"]*)" fill="none" stroke="var\(--c-ink\)"/g)].map((m) => m[1])[0];
  };
  const gapped = path(1, (x) => (Math.abs(x) < 0.5 ? NaN : x));
  assert.equal(gapped.split('M').length - 1, 2, 'the finite part before the gap and the part after it are separate strokes');
  assert.doesNotMatch(gapped, /NaN/);
  const whole = path(1, (x) => x), half = path(0.4, (x) => x);
  assert.equal(whole.split('M').length - 1, 1, 'a function with no gap is still one stroke');
  assert.ok(half.length < whole.length, 'a partly grown line is shorter');
});

test('spheres can be drawn without shading', () => {
  const shaded = (o: { shade?: boolean }) => { const sp = new Spheres([[[0, 0, 0], 1]], o); const out: Prim[] = []; sp.collect(out); return out.every((p) => p.shade === (o.shade ?? true)); };
  assert.ok(shaded({}) && shaded({ shade: false }) && shaded({ shade: true }));
});

test('trimPolyline walks by length, and a pulse on a one-point rail does not crash', () => {
  const line: V3[] = [[0, 0, 0], [3, 0, 0], [3, 1, 0]];
  assert.deepEqual(trimPolyline(line, 0), [[0, 0, 0], [0, 0, 0]]);
  assert.deepEqual(trimPolyline(line, 0.75), [[0, 0, 0], [3, 0, 0]], 'three of the four units is exactly the corner');
  close(trimPolyline(line, 0.5).at(-1)!, [2, 0, 0]);
  assert.deepEqual(trimPolyline(line, 1), line);
  assert.deepEqual(trimPolyline(line, 7), line, 'beyond the end stays at the end');
  assert.deepEqual(trimPolyline([], 0.5), []);
  const s = new Scene({ view: 'front' }), p = s.add(pulse([[1, 0, 1]], { trail: 2 }));
  p.set('along', 0.5);
  assert.doesNotThrow(() => s.svg());
});

test('svg import keeps and renames a local href with a space inside the quotes, and still strips outside links', () => {
  const { inner } = parseSvg('<svg viewBox="0 0 10 10"><defs><g id="a"/></defs><use href=" #a"/><use href="https://x.test/a.svg#a"/><use href=" javascript:alert(1)"/></svg>');
  assert.match(inner, /<use href="#sz\d+-a"\/>/, 'the local one is kept and follows the renamed id');
  assert.doesNotMatch(inner, /x\.test|javascript/);
});

test('a chat too long for its screen scrolls: the newest messages stay and the oldest leave', () => {
  const messages = Array.from({ length: 80 }, (_, i) => ({ from: (i % 2 ? 'me' : 'them') as 'me' | 'them', text: `message number ${i}` }));
  const s = new Scene({ view: 'front', size: [300, 400] });
  s.add(chat({ messages }));
  const svg = s.svg();
  assert.match(svg, />message number 79</);
  assert.doesNotMatch(svg, />message number 0</);
  const ys = [...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].map((m) => +m[1] + +m[2]);
  assert.ok(ys.length > 2 && Math.max(...ys) < 400 * 1.5, 'every bubble sits inside the plane it is drawn on');
});

test('the dish signal is where the feed dot is drawn, for any placement, tilt and yaw', () => {
  const a = antenna({ kind: 'dish', at: [1, 2, 0.5], rot: [0, 0, 30], scale: 1.3, tilt: 40, yaw: 25 });
  const s = new Scene({ view: 'front' });
  s.add(a);
  const dot = s.prims().find((p) => p.kind === 'dot' && p.role === 'accent' && p.r === 2)!;
  close(a.signal()(), dot.pts[0], 'signal and feed dot');
});
