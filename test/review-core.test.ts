import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Timeline, Group, Curve, Surface, Path, Pen, Pulse, Link, parseSvg, rotateSegs, lineSegs, segsD, mount, box, curve, surface, pen, pulse, link, group, tween } from '../src/index.ts';
import { niceTicks } from '../src/all.ts';
import { Construct } from '../src/index.ts';

const prims = (n: { collect(o: never[]): void }) => { const o: any[] = []; n.collect(o as never[]); return o; };
const finite = (pts: number[][]) => pts.every((p) => p.every(Number.isFinite));

test('a group takes a node out of its old group when it adds it', () => {
  const a = new Group(), b = new Group(), x = box();
  a.add(x); b.add(x);
  assert.equal(a.children.length, 0);
  assert.equal(x.parent, b);
  b.add(x);
  assert.equal(b.children.length, 1, 'adding twice does not duplicate');
});

test('removing a node from a group it is not in leaves it where it is', () => {
  const a = new Group(), b = new Group(), x = a.add(box());
  b.remove(x);
  assert.equal(x.parent, a);
  assert.equal(a.children.length, 1);
  a.remove(x);
  assert.equal(x.parent, undefined);
});

test('zero samples or cells do not produce NaN points', () => {
  assert.ok(finite(prims(curve((t) => [t, 0, 0], { samples: 0 }))[0].pts));
  assert.ok(prims(surface((u, v) => [u, v, 0], { res: [0, 0] })).every((q) => finite(q.pts)));
  assert.ok(finite(prims(link([0, 0, 0], [1, 0, 0], { samples: 0 }))[0].pts));
  const p = pen((t) => [t, 0, 0], { samples: 0 });
  p.set('draw', 0.5);
  assert.ok(finite(prims(p)[0].pts));
});

test('a curve passes closed on to the renderer', () => {
  assert.equal(prims(curve((t) => [t, 0, 0], { closed: true }))[0].closed, true);
});

test('a pen with an empty rail draws nothing, and a pulse on one is hidden', () => {
  const p = pen([]);
  p.set('draw', 0.5);
  assert.deepEqual(prims(p), []);
  const q = pulse([]);
  q.set('along', 0.5);
  assert.deepEqual(prims(q), []);
});

test('svg import falls back to width and height for a broken viewBox', () => {
  assert.deepEqual(parseSvg('<svg viewBox="0 0 0 0" width="40" height="20"></svg>').box, [0, 0, 40, 20]);
  assert.deepEqual(parseSvg('<svg viewBox="a b c d"></svg>').box, [0, 0, 100, 100]);
  assert.deepEqual(parseSvg('<svg stroke-width="9" width="30" height="10"></svg>').box, [0, 0, 30, 10]);
});

test('svg import recolour treats $ in the replacement literally, and leaves data-id alone', () => {
  const r = parseSvg('<svg viewBox="0 0 1 1"><rect fill="#fff" data-id="k" id="a"/></svg>', { recolor: { '#fff': '$&x' } });
  assert.match(r.inner, /fill="\$&x"/);
  assert.match(r.inner, /data-id="k"/);
  assert.match(r.inner, / id="sz\d+-a"/);
});

test('rotating a line keeps it a line in the path', () => {
  assert.match(segsD(rotateSegs(lineSegs([0, 0], [10, 0]), [0, 0], Math.PI / 2)), /^M0 0L/);
});

test('niceTicks terminates for a tiny range far from zero', () => {
  const t = niceTicks(1e16, 1e16 + 1);
  assert.ok(t.length >= 2 && t.length < 100);
  assert.deepEqual(niceTicks(0, 10), [0, 2, 4, 6, 8, 10]);
});

test('a construct escapes its path data and colours', () => {
  const c = new Construct({ box: [0, 0, 10, 10] });
  c.add({ d: 'M0 0" onload="x', paint: 'red"', props: { fill: 1 } });
  const out: any[] = [];
  c.collect(out);
  assert.ok(!out[0].plane.svg.inner.includes('" onload="'));
});

test('lockFit with zero samples still frames the scene', () => {
  const s = new Scene({ fit: 'sphere' });
  const b = s.add(box({ size: 1 }));
  const tl = new Timeline().play(tween(b, { pos: [2, 0, 0] }));
  tl.lockFit(s, 0);
  assert.ok(Number.isFinite(s.sphere!.r));
});

test('mount with loop pause 0 restarts instead of sticking on the last frame', () => {
  const frames: ((t: number) => void)[] = [];
  const g = globalThis as any;
  const saved = { raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame, doc: g.document };
  const el = () => {
    const kids: any[] = [];
    const e: any = { kids, innerHTML: '', textContent: '', attrs: {}, setAttribute(k: string, v: string) { this.attrs[k] = v; }, remove() {}, replaceChildren() { kids.length = 0; },
      appendChild(c: any) { kids.push(c); return c; }, insertBefore(c: any) { kids.push(c); return c; }, get firstChild() { return kids[0] ?? null; }, nextSibling: null, tagName: 'svg' };
    return e;
  };
  g.document = { createElementNS: () => el() };
  g.requestAnimationFrame = (f: (t: number) => void) => { frames.push(f); return frames.length; };
  g.cancelAnimationFrame = () => {};
  try {
    const s = new Scene();
    const b = s.add(box());
    const tl = new Timeline().play(tween(b, { pos: [1, 0, 0] }, { duration: 1 }));
    const p = mount(el(), s, { timeline: tl, loop: { pause: 0 }, maxFps: 1000 });
    let now = 0;
    const step = (ms: number) => { now += ms; frames.splice(0).forEach((f) => f(now)); };
    step(10); step(600); step(600); // passes the end
    assert.ok(p.time < 0.5, `time ${p.time} should have restarted`);
    p.destroy();
  } finally {
    g.requestAnimationFrame = saved.raf; g.cancelAnimationFrame = saved.caf; g.document = saved.doc;
  }
});
