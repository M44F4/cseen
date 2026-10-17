import test from 'node:test';
import assert from 'node:assert/strict';
import { chart, Chart } from '../src/charts/index.ts';
import { numberLine, product, vectorField, graph, matrix } from '../src/math/index.ts';
import { wave } from '../src/waves/index.ts';
import { Scene } from '../src/index.ts';

const clean = (svg: string) => assert.ok(!/NaN|Infinity/.test(svg), 'no NaN or Infinity in the drawing');

test('charts survive empty and non-finite data', () => {
  for (const type of ['bar', 'line', 'area', 'pie', 'donut', 'histogram', 'radar', 'sparkline', 'scatter', 'heatmap'] as const) {
    assert.doesNotThrow(() => (chart({ type, data: [], points: [], values: [], matrix: type === 'heatmap' ? [] : undefined }) as Chart).draw(400, 250), type);
    assert.doesNotThrow(() => (chart({ type }) as Chart).draw(400, 250), type);
    if (type !== 'scatter' && type !== 'heatmap') clean(chart({ type, data: [1, NaN, 3], values: [1, NaN, 3] }).draw(400, 250));
  }
  clean(chart({ type: 'scatter', points: [] }).draw(400, 250));
  clean(chart({ type: 'scatter', points: [{ x: 1, y: 2 }, { x: NaN, y: 1 }] }).draw(400, 250));
});

test('a normalized stacked area is drawn as shares of 100', () => {
  const svg = chart({ type: 'area', data: { A: [1, 3], B: [3, 1] }, stack: true, normalize: true, dots: false }).draw(400, 250);
  // both columns total 100, so the top line of the stack sits on the same y at both ends
  const tops = [...svg.matchAll(/<path d="(M[^"]*)" fill="none"/g)].map((m) => m[1]);
  const top = tops[tops.length - 1].match(/-?\d+(\.\d+)?/g)!.map(Number);
  assert.equal(top[1], top[top.length - 1]);
});

test('a number line with a zero or negative step still draws, with ticks', () => {
  for (const step of [0, -1, NaN]) {
    const svg = numberLine({ step }).draw(500, 120);
    assert.ok((svg.match(/<text/g) ?? []).length > 3, `step ${step}`);
  }
});

test('a wave with a zero or negative wavelength terminates', () => {
  const s = new Scene();
  for (const wavelength of [0, -1, NaN, 1e-9]) {
    const w = wave({ kind: 'rings', wavelength });
    s.add(w);
    assert.doesNotThrow(() => s.svg());
  }
});

test('a product that fits in its box when the result is wider than A', () => {
  const p = product([[1, 2], [3, 4]], [[1, 2, 3, 4], [5, 6, 7, 8]], { size: [5.4, 2.2] });
  const xs = [...p.draw(540, 220).matchAll(/<text x="(-?[\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 540);
});

test('a product with mismatched sizes is refused', () => {
  assert.throws(() => product([[1, 2]], [[1, 2]]), RangeError);
});

test('maths figures cope with empty input', () => {
  assert.doesNotThrow(() => matrix([]).draw(200, 100));
  assert.doesNotThrow(() => graph({ fns: {} }).draw(400, 250));
  clean(graph({ fn: () => NaN }).draw(400, 250));
  clean(vectorField(() => [NaN, 1]).draw(400, 250));
});
