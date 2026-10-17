import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Timeline, tween, diagram, treeDiagram, flowchart, pulse, Diagram } from '../src/all.ts';
import type { V3 } from '../src/index.ts';

const pos = (d: Diagram, id: string) => d.nodes.get(id)!.props.pos as V3;
const overlap = (d: Diagram) => {
  const ns = [...d.nodes.values()];
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const a = ns[i], b = ns[j], pa = a.props.pos as V3, pb = b.props.pos as V3;
    if (Math.abs(pa[0] - pb[0]) < (a.box[0] + b.box[0]) / 2 - 1e-6 && Math.abs(pa[2] - pb[2]) < (a.box[1] + b.box[1]) / 2 - 1e-6) return `${a.label} and ${b.label}`;
  }
  return '';
};
const chain = () => {
  const d = diagram();
  for (const x of 'abcd') d.node(x, x);
  d.edge('a', 'b'); d.edge('b', 'c'); d.edge('a', 'd'); d.edge('d', 'c');
  return d;
};

test('a layered diagram puts every edge pointing forward, so the first node is the highest', () => {
  const d = chain();
  assert.ok(pos(d, 'a')[2] > pos(d, 'b')[2]);
  assert.ok(pos(d, 'b')[2] > pos(d, 'c')[2]);
  assert.equal(pos(d, 'b')[2], pos(d, 'd')[2]);
  assert.equal(overlap(d), '');
});

test('flowing right puts the first node on the left', () => {
  const d = diagram({ direction: 'right' });
  d.node('a', 'a'); d.node('b', 'b'); d.edge('a', 'b');
  assert.ok(pos(d, 'a')[0] < pos(d, 'b')[0]);
  assert.equal(pos(d, 'a')[2], pos(d, 'b')[2]);
});

test('a cycle is laid out without looping and still ends each edge on its target', () => {
  const d = diagram();
  for (const x of 'abc') d.node(x, x);
  d.edge('a', 'b'); d.edge('b', 'c'); d.edge('c', 'a');
  assert.equal(overlap(d), '');
  const back = d.edges[2].route, [bx, bz] = [pos(d, 'a')[0], pos(d, 'a')[2]], last = back[back.length - 1];
  assert.ok(Math.abs(last[0] - bx) < d.nodes.get('a')!.box[0] / 2 + 1e-6 && Math.abs(last[1] - bz) <= d.nodes.get('a')!.box[1] / 2 + 1e-6);
});

test('an edge that skips a rank goes around the box in between', () => {
  const d = diagram();
  for (const x of 'abc') d.node(x, x);
  d.edge('a', 'b'); d.edge('b', 'c'); d.edge('a', 'c');
  const mid = d.nodes.get('b')!, p = mid.props.pos as V3, [w, h] = mid.box;
  for (const [x, z] of d.edges[2].route) assert.ok(Math.abs(x - p[0]) >= w / 2 - 1e-6 || Math.abs(z - p[2]) >= h / 2 + 1e-6, `point ${x},${z} is inside b`);
  assert.equal(overlap(d), '');
});

test('a tree centres each parent over its children and keeps branches apart', () => {
  const d = treeDiagram({ label: 'app', children: [{ label: 'ui', children: [{ label: 'forms' }, { label: 'tables' }] }, { label: 'api' }] });
  const at = (l: string) => [...d.nodes.values()].find((n) => n.label === l)!.props.pos as V3;
  const w = (l: string) => [...d.nodes.values()].find((n) => n.label === l)!.box[0], lo = at('forms')[0] - w('forms') / 2, hi = at('tables')[0] + w('tables') / 2;
  assert.ok(Math.abs(at('ui')[0] - (lo + hi) / 2) < 1e-9);
  assert.ok(at('app')[2] > at('ui')[2] && at('ui')[2] > at('forms')[2]);
  assert.equal(overlap(d), '');
});

test('a force layout never lets two nodes touch, and the same graph lands in the same place', () => {
  const make = () => {
    const d = diagram({ layout: 'force' });
    for (const x of 'abcdefg') d.node(x, x);
    for (const [a, b] of ['ab', 'bc', 'cd', 'de', 'ea', 'fa', 'gc']) d.edge(a, b);
    return d;
  };
  assert.equal(overlap(make()), '');
  const sv = (d: Diagram) => { const s = new Scene({ view: 'front' }); s.add(d); return s.svg(); };
  assert.equal(sv(make()), sv(make()));
});

test('a flowchart goes to the next step unless a step says otherwise, and a decision is a diamond', () => {
  const d = flowchart([
    { label: 'start', kind: 'start' },
    { label: 'ok?', kind: 'decision', to: [['done', 'yes'], ['fix', 'no']] },
    { label: 'fix', to: ['ok?'] },
    { label: 'done', kind: 'end' },
  ]);
  assert.equal(d.nodes.get('ok?')!.shape, 'diamond');
  assert.equal(d.edges.length, 4);
  assert.deepEqual(d.edges.map((e) => `${e.from}>${e.to}`), ['start>ok?', 'ok?>done', 'ok?>fix', 'fix>ok?']);
});

test('edges and nodes can be traced on and faded with a timeline', () => {
  const d = chain();
  const s = new Scene({ view: 'front' });
  s.add(d);
  const e = d.edges[0], n = d.nodes.get('a')!, tl = new Timeline();
  tl.play(tween(e, { draw: 1 }, { duration: 1, from: { draw: 0 } }));
  tl.play(tween(n, { opacity: 0 }, { duration: 1 }));
  tl.seek(0);
  const before = s.svg();
  tl.seek(2);
  assert.notEqual(s.svg(), before);
  assert.equal(n.props.opacity, 0);
  assert.equal(e.props.draw, 1);
  tl.seek(0);
  assert.equal(s.svg(), before);
});

test('a pulse can ride an edge from one node to the other', () => {
  const d = chain(), s = new Scene({ view: 'front' });
  s.add(d);
  const ping = s.add(pulse(d.route('a', 'b')));
  const tl = new Timeline();
  tl.play(tween(ping, { along: 1 }, { duration: 1, from: { along: 0 }, ease: 'linear' }));
  tl.seek(0.5);
  assert.match(s.svg(), /<circle/);
});

test('at gives a point that follows its node, and unknown ids and self edges are refused', () => {
  const d = chain(), p = d.at('a', 'bottom');
  const before = p();
  d.nodes.get('a')!.set('pos', [1, 0, 0]);
  assert.notDeepEqual(p(), before);
  assert.throws(() => d.edge('a', 'zzz'), /no node "zzz"/);
  assert.throws(() => d.edge('a', 'a'), /two different nodes/);
  assert.throws(() => d.node('a', 'again'), /already has a node/);
});

test('two edges between the same pair, one each way, run side by side instead of on top of each other', () => {
  const d = flowchart([
    { label: 'start', kind: 'start' },
    { label: 'ok?', kind: 'decision', to: [['done', 'yes'], ['fix', 'no']] },
    { label: 'fix', to: ['ok?'] },
    { label: 'done', kind: 'end' },
  ]);
  const down = d.edges.find((e) => e.from === 'ok?' && e.to === 'fix')!.route, up = d.edges.find((e) => e.from === 'fix' && e.to === 'ok?')!.route;
  const xs = (r: [number, number][]) => r.map((p) => p[0]);
  assert.ok(Math.abs(xs(down)[0] - xs(up)[xs(up).length - 1]) > 0.1, 'they leave and enter the diamond at the same point');
  assert.ok(Math.abs(xs(down)[xs(down).length - 1] - xs(up)[0]) > 0.1, 'they meet the box at the same point');
});

test('a tree survives a cycle and a box with two parents, and keeps every box apart', () => {
  const loop = diagram({ layout: 'tree' });
  loop.node('a', 'a'); loop.node('b', 'b'); loop.node('c', 'c');
  loop.edge('a', 'b'); loop.edge('b', 'c'); loop.edge('c', 'a');
  assert.equal(overlap(loop), '');
  assert.ok(loop.edges.every((e) => e.route.length >= 2));
  const two = diagram({ layout: 'tree' });
  two.node('a', 'a'); two.node('b', 'b'); two.node('c', 'c');
  two.edge('a', 'c'); two.edge('b', 'c');
  assert.equal(overlap(two), '');
});

test('generated tree ids skip the ones you gave, and a repeated flowchart label asks for an id', () => {
  const d = treeDiagram({ label: 'x', children: [{ id: 't1', label: 'y' }, { label: 'z' }, { label: 'w' }] });
  assert.equal(d.nodes.size, 4);
  assert.throws(() => flowchart([{ label: 'go' }, { label: 'go' }]), /give one of them an `id`/);
});

test('batch places once at the end and gives the same picture as placing after every call', () => {
  const build = (d: Diagram) => { for (const id of 'abcde') d.node(id, id); d.edge('a', 'b'); d.edge('a', 'c'); d.edge('c', 'd'); d.edge('c', 'e'); };
  const each = diagram({ layout: 'force' }), once = diagram({ layout: 'force' });
  build(each);
  once.batch(build);
  for (const id of 'abcde') assert.deepEqual(pos(once, id), pos(each, id));
});

/* ------------------------------------------------------------ edges follow nodes */

const touches = (p: [number, number], d: Diagram, id: string) => {
  const n = d.nodes.get(id)!, c = n.props.pos as V3, [w, h] = n.box, dx = Math.abs(p[0] - c[0]), dz = Math.abs(p[1] - c[2]);
  return dx <= w / 2 + 1e-6 && dz <= h / 2 + 1e-6 && (Math.abs(dx - w / 2) < 1e-6 || Math.abs(dz - h / 2) < 1e-6);
};
const rt = (d: Diagram, from: string, to: string) => d.edges.find((e) => e.from === from && e.to === to)!.route;

for (const edges of ['elbow', 'straight'] as const) {
  test(`${edges} edges end on the new box edge of a node that was moved`, () => {
    const d = diagram({ edges }), s = new Scene({ view: 'front' });
    for (const x of 'abc') d.node(x, x);
    d.edge('a', 'b'); d.edge('b', 'c');
    s.add(d);
    d.nodes.get('b')!.set('pos', [4, 0, -5]);
    s.svg();
    for (const [f, t] of [['a', 'b'], ['b', 'c']]) {
      const r = rt(d, f, t);
      assert.ok(touches(r[0], d, f), `${f}>${t} start`);
      assert.ok(touches(r[r.length - 1], d, t), `${f}>${t} end`);
    }
  });
}

test('a moved node leaves the others and the layout alone, and putting it back restores the layout route', () => {
  const d = chain(), s = new Scene({ view: 'front' });
  s.add(d);
  const home = d.nodes.get('b')!.props.pos as V3, before = JSON.stringify(d.edges.map((e) => e.route)), cd = JSON.stringify(rt(d, 'd', 'c'));
  d.nodes.get('b')!.set('pos', [6, 0, home[2]]);
  s.svg();
  assert.equal(JSON.stringify(rt(d, 'd', 'c')), cd);
  assert.notEqual(JSON.stringify(d.edges.map((e) => e.route)), before);
  assert.deepEqual(pos(d, 'a'), d.nodes.get('a')!.props.pos);
  d.nodes.get('b')!.set('pos', [...home] as V3);
  s.svg();
  assert.equal(JSON.stringify(d.edges.map((e) => e.route)), before);
});

test('a tween of pos drags the edge and its label with it, and rail follows the route', () => {
  const d = diagram({ direction: 'right' }), s = new Scene({ view: 'front' });
  d.node('a', 'a'); d.node('b', 'b'); d.edge('a', 'b', { label: 'go' });
  s.add(d);
  const rail = d.edges[0].rail(), tl = new Timeline();
  tl.play(tween(d.nodes.get('b')!, { pos: [3, 0, -4] }, { duration: 1 }));
  tl.seek(1);
  const svg = s.svg(), e = d.edges[0], end = rail[rail.length - 1] as () => V3;
  assert.ok(touches(e.route[e.route.length - 1], d, 'b'));
  const w = end();
  assert.ok(Math.abs(w[0] - e.route[e.route.length - 1][0]) < 1e-9 && Math.abs(w[2] - e.route[e.route.length - 1][1]) < 1e-9);
  assert.match(svg, /go/);
});

test('moving a node does not run the layout again, and a still frame does no routing', () => {
  const d = chain(), s = new Scene({ view: 'front' });
  s.add(d);
  d.nodes.get('d')!.set('pos', [5, 0, -1]);
  s.svg();
  assert.deepEqual(pos(d, 'd'), [5, 0, -1]);
  const e = d.edges[2];
  let calls = 0;
  const set = e.setRoute.bind(e);
  e.setRoute = (r) => { calls++; set(r); };
  s.svg(); s.svg();
  assert.equal(calls, 0);
});

test('edges between the same two moved nodes run side by side', () => {
  const d = diagram(), s = new Scene({ view: 'front' });
  d.node('a', 'a'); d.node('b', 'b'); d.edge('a', 'b'); d.edge('b', 'a');
  s.add(d);
  d.nodes.get('b')!.set('pos', [3, 0, -4]);
  s.svg();
  assert.ok(Math.abs(d.edges[0].route[0][0] - d.edges[1].route[d.edges[1].route.length - 1][0]) > 0.1);
});
