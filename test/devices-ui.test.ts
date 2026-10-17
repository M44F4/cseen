import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Node } from '../src/all.ts';
import { router, Scene, browser, terminal, document as paper, dialog, notification, progress, cylinder, monitor, chat } from '../src/all.ts';

const svgOf = (n: Node) => { const s = new Scene({ view: 'front' }); s.add(n); return s.svg(); };

test('router: any number of lights stays inside the body and clear of the ports', () => {
  const w = 1.8, r = router({ width: w, leds: 20 });
  assert.equal(r.leds.length, 20);
  for (const led of r.leds) {
    const x = led.world([0, 0, 0])[0];
    assert.ok(x >= -w / 2 && x <= 0.05 * w + 1e-9, `light at ${x}`);
  }
  const xs = router({ width: w }).leds.map((l) => l.world([0, 0, 0])[0]);
  assert.ok(Math.abs(xs[1] - xs[0] - w * 0.075) < 1e-9, 'the default spacing is unchanged');
});

test('browser, terminal and document keep a long url or title inside their bars', () => {
  const long = 'x'.repeat(200);
  assert.ok(!svgOf(browser({ url: long })).includes(long));
  assert.ok(svgOf(browser({ url: long })).includes('…'));
  assert.ok(!svgOf(terminal({ title: long })).includes(long));
  const fontOf = (title: string) => Number(/<text[^>]*font-size="([\d.]+)"/.exec(svgOf(paper({ title })))?.[1]);
  assert.equal(fontOf('notes'), 9, 'a short title keeps its size');
  assert.ok(fontOf(long) < 1, 'a long title shrinks to fit');
});

test('dialog: long body stops above the buttons and many wide buttons shrink to fit', () => {
  const svg = svgOf(dialog({ body: 'word '.repeat(80), buttons: ['Cancel', 'Remind me later', 'Delete everything'] }));
  const bodyRows = svg.match(/<text[^>]*>word/g) ?? [];
  assert.equal(bodyRows.length, 3);
  assert.ok(svg.includes('…'), 'cut text ends in an ellipsis');
  const xs = [...svg.matchAll(/<rect[^>]*x="(-?[\d.]+)"[^>]*rx="[\d.]+"[^>]*fill="none"/g)].map((m) => Number(m[1]));
  assert.ok(xs.length >= 2 && xs.every((x) => x >= 0), 'no button runs off the left edge');
});

test('notification and progress: long text is cut or shrunk instead of overflowing', () => {
  const long = 'y'.repeat(200);
  assert.ok(!svgOf(notification({ title: long, body: 'ok' })).includes(long));
  const fs = (label: string) => Number(/<text[^>]*font-size="([\d.]+)"/.exec(svgOf(progress({ value: 0.5, label })))?.[1]);
  assert.ok(fs('a much longer label than fits') < fs('50%'));
  assert.ok(fs('a much longer label than fits') * 0.6 * 'a much longer label than fits'.length <= 34 * 2.2 + 1e-6);
});

test('small guards: a tiny cylinder resolution, a zero-width element and an empty chat message', () => {
  assert.ok(svgOf(cylinder({ res: 1 })).length > 100);
  const el = Object.assign(progress(), { size: [0, 1] as [number, number] });
  monitor().put(el, { width: 0.5 });
  assert.ok(Number.isFinite(el.props.scale as number), 'scale stays finite');
  assert.ok(svgOf(chat({ messages: [{ from: 'me', text: '' }] })).length > 50);
});
