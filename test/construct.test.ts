import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Timeline, Construct, Part, arcSegs, lineSegs, rotateSegs, segsD, circleD, polar, measureD, tween, reverse, par } from '../src/index.ts';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

test('an arc starts and ends where its angles say, in quarter turn pieces', () => {
  const segs = arcSegs(10, 20, 5, 0, Math.PI);
  assert.equal(segs.length, 2);
  near(segs[0][0][0], 15); near(segs[0][0][1], 20);
  near(segs[1][3][0], 5); near(segs[1][3][1], 20);
});

test('rotating segments turns them clockwise on screen about a point', () => {
  const [seg] = rotateSegs(lineSegs([10, 0], [20, 0]), [0, 0], Math.PI / 2);
  near(seg[0][0], 0); near(seg[0][1], 10);
  near(seg[3][0], 0); near(seg[3][1], 20);
});

test('segsD starts a new subpath only where the line is broken, and draws lines as L', () => {
  const d = segsD([...lineSegs([0, 0], [10, 0]), ...lineSegs([10, 0], [10, 10]), ...lineSegs([50, 50], [60, 50])]);
  assert.equal(d, 'M0 0L10 0L10 10M50 50L60 50');
  assert.ok(segsD(lineSegs([0, 0], [1, 1]), true).endsWith('Z'));
  assert.match(circleD(0, 0, 10), /^M0 -10C/);
});

test('polar measures degrees from the right, upwards', () => {
  const [x, y] = polar([100, 100], 10, 90);
  near(x, 100); near(y, 90);
});

test('a part draws on with a dash, fills with an opacity and hides when nothing shows', () => {
  const c = new Construct({ box: [0, 0, 100, 100] });
  const p = c.add({ d: circleD(50, 50, 20), paint: 'accent', props: { draw: 0.5, fill: 0.25 } });
  assert.ok(p instanceof Part);
  const s1 = new Scene({ view: 'front' });
  s1.add(c);
  const svg = s1.svg();
  assert.match(svg, /stroke-dashoffset="0\.5"/);
  assert.match(svg, /fill-opacity="0\.25"/);
  p.props.draw = 0; p.props.fill = 0;
  const s2 = new Scene({ view: 'front' }); s2.add(c);
  assert.ok(!s2.svg().includes('stroke-dashoffset'), 'nothing is drawn');
});

test('a part reshapes from its own properties when d is a function', () => {
  const c = new Construct();
  const p = c.add({ d: (v) => circleD(0, 0, v.r as number), props: { r: 10 } });
  const seen: string[] = [];
  const probe = (r: number) => { p.props.r = r; const s = new Scene({ view: 'front' }); s.add(c); seen.push(s.svg()); };
  probe(10); probe(20);
  assert.notEqual(seen[0], seen[1]);
});

test('reverse plays an animation backwards and ends where it began', () => {
  const part = new Part({ d: 'M0 0L1 1', props: { draw: 0 } });
  const there = par(tween(part, { draw: 1 }, { duration: 1, from: { draw: 0 }, ease: 'linear' }));
  const tl = new Timeline();
  tl.play(there); tl.play(reverse(there));
  tl.seek(1); near(part.props.draw as number, 1);
  tl.seek(1.5); near(part.props.draw as number, 0.5);
  tl.seek(2); near(part.props.draw as number, 0);
});

test('reverse mirrors the order of staggered moves and flips the easing', () => {
  const a = new Part({ d: 'M0 0L1 1', props: { draw: 0 } }), b = new Part({ d: 'M0 0L1 1', props: { draw: 0 } });
  const there = par(tween(a, { draw: 1 }, { duration: 1, from: { draw: 0 } }), tween(b, { draw: 1 }, { duration: 1, delay: 1, from: { draw: 0 } }));
  const back = reverse(there);
  const first = back.tweens.find((t) => t.target === b)!, last = back.tweens.find((t) => t.target === a)!;
  near(first.start, 0); near(last.start, 1);
  near(first.ease(0.25), 1 - there.tweens[1].ease(0.75));
});

test('reverse says what is wrong when a tween cannot go back', () => {
  const part = new Part({ d: 'M0 0L1 1' });
  assert.throws(() => reverse(tween(part, { draw: 1 })), /from/);
  assert.throws(() => reverse(tween(part, { draw: () => 1 }, { from: { draw: 0 } })), /literal/);
});

test('a text part is a label: it shows with its opacity, escapes its text and hides at zero', () => {
  const c = new Construct({ box: [0, 0, 100, 100] });
  const label = c.add({ text: 'a<b', at: [10, 20], size: 12, props: { op: 0.5 } });
  const draw = () => { const s = new Scene({ view: 'front' }); s.add(c); return s.svg(); };
  const svg = draw();
  assert.match(svg, /<text x="10" y="20" font-size="12"[^>]*opacity="0\.5"[^>]*>a&lt;b<\/text>/);
  label.props.op = 0;
  assert.ok(!draw().includes('<text x="10"'), 'hidden at zero');
});

test('a measuring bracket is a line with a tick across each end', () => {
  const d = measureD([0, 0], [100, 0], 5);
  assert.equal(d, 'M0 0L100 0M0 -5L0 5M100 -5L100 5');
});
