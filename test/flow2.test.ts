import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Timeline, draw, sequence, pulse, tween } from '../src/all.ts';
import type { V3 } from '../src/index.ts';

const spec = {
  participants: ['browser', 'api', 'db'],
  messages: [
    { from: 'browser', to: 'api', label: 'GET /user' },
    { from: 'api', to: 'db', label: 'select' },
    { note: 'one round trip', over: ['api', 'db'] as [string, string] },
    { from: 'db', to: 'api', label: 'row', reply: true },
    { from: 'api', to: 'api', label: 'render the page' },
    { from: 'api', to: 'browser', label: '200 with a rather long label', reply: true },
  ],
};

test('messages come in order, top to bottom, between the right lifelines', () => {
  const q = sequence(spec);
  assert.equal(q.messages.length, 5);
  const zs = q.messages.map((m) => m.route[0][1]);
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] < zs[i - 1], 'time flows down');
  const xOf = (id: string) => (q.nodes.get(id)!.props.pos as V3)[0];
  assert.ok(xOf('browser') < xOf('api') && xOf('api') < xOf('db'));
  const first = q.messages[0].route;
  assert.equal(first[0][0], xOf('browser'));
  assert.equal(first[first.length - 1][0], xOf('api'));
  const back = q.messages[4].route;
  assert.equal(back[0][0], xOf('api'));
  assert.equal(back[1][0], xOf('browser'));
});

test('lifelines are vertical, dashed, start under their box and run past the last message', () => {
  const q = sequence(spec);
  for (const [id, l] of q.lifelines) {
    const n = q.nodes.get(id)!, p = n.props.pos as V3;
    assert.equal(l.route[0][0], p[0]);
    assert.equal(l.route[1][0], p[0]);
    assert.ok(Math.abs(l.route[0][1] - (p[2] - n.box[1] / 2)) < 1e-9);
    assert.ok(l.route[1][1] < Math.min(...q.messages.map((m) => Math.min(...m.route.map((r) => r[1])))));
  }
});

test('the picture is centred and no two labels or notes overlap', () => {
  const q = sequence(spec), s = new Scene({ view: 'front' });
  s.add(q);
  // boxes of every label: reading the word planes' placement through the route and the sizes the layout promises
  const rects: [number, number, number, number, string][] = [];
  for (const m of q.messages) {
    const w = (m as any).word, p = w.props.pos as V3;
    rects.push([p[0], p[2], p[0] + w.size[0], p[2] + w.size[1], m.to]);
  }
  for (const n of q.notes) { const p = n.props.pos as V3; rects.push([p[0] - n.box[0] / 2, p[2] - n.box[1] / 2, p[0] + n.box[0] / 2, p[2] + n.box[1] / 2, 'note']); }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    assert.ok(a[2] <= b[0] + 1e-9 || b[2] <= a[0] + 1e-9 || a[3] <= b[1] + 1e-9 || b[3] <= a[1] + 1e-9, `${i} and ${j} overlap`);
  }
  const xs = [...q.nodes.values()].map((n) => (n.props.pos as V3)[0]);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2) < 3);
});

test('every label sits between the lifelines it joins', () => {
  const q = sequence(spec);
  for (const m of q.messages.filter((m) => m.from !== m.to)) {
    const w = (m as any).word, p = w.props.pos as V3, [a, b] = [m.route[0][0], m.route[1][0]].sort((x, y) => x - y);
    assert.ok(p[0] > a && p[0] + w.size[0] < b, `${m.from}>${m.to}`);
  }
});

test('a reply is dashed, a call is not, and the same spec gives the same picture', () => {
  const sv = () => { const s = new Scene({ view: 'front' }); s.add(sequence(spec)); return s.svg(); };
  assert.equal(sv(), sv());
  const q = sequence(spec);
  assert.equal(q.messages[0].route.length, 2);
  assert.equal(q.messages[3].route.length, 4);
  assert.match(sv(), /stroke-dasharray:5 4/);
});

test('messages trace on with draw and a pulse rides one', () => {
  const q = sequence(spec), s = new Scene({ view: 'front' });
  s.add(q);
  const ping = s.add(pulse(q.messages[0].rail())), tl = new Timeline();
  tl.play(draw(q.messages[0], 1));
  tl.play(tween(ping, { along: 1 }, { duration: 1, from: { along: 0 }, ease: 'linear' }));
  tl.seek(0);
  const a = s.svg();
  tl.seek(1);
  assert.notEqual(s.svg(), a);
});

test('unknown and repeated participants are refused', () => {
  assert.throws(() => sequence({ participants: ['a'], messages: [{ from: 'a', to: 'z' }] }), /no participant "z"/);
  assert.throws(() => sequence({ participants: ['a', 'a'], messages: [] }), /two participants/);
});
