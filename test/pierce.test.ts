import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, box, rect, type Node } from '../src/all.ts';
import { overlap } from '../src/core/sort.ts';
import { clipPolygon, splitPierced, type SplitItem } from '../src/core/split.ts';

/** the outline of a drawn face in pixels, shrunk 10% towards its middle so pieces that only share the cut edge do not count as overlapping */
function shape(html: string) {
  const nums = [...html.match(/ d="([^"]*)"/)![1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m): [number, number] => [+m[1], +m[2]]);
  const cx = nums.reduce((a, p) => a + p[0], 0) / nums.length, cy = nums.reduce((a, p) => a + p[1], 0) / nums.length;
  const sp = nums.map((p): [number, number] => [cx + (p[0] - cx) * 0.9, cy + (p[1] - cy) * 0.9]);
  const xs = sp.map((p) => p[0]), ys = sp.map((p) => p[1]);
  return { shape: 'poly' as const, sp, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number] };
}
/** is `a` drawn before `b` in the frame, among pieces that cover a common spot? Pieces that do not meet may be in either order. */
function drawnBefore(items: { key: string; html: string }[], a: string, b: string): boolean | null {
  const ia = items.findIndex((i) => i.key === a), ib = items.findIndex((i) => i.key === b);
  return overlap(shape(items[ia].html), shape(items[ib].html)) ? ia < ib : null;
}
const own = (keys: string[], n: Node) => keys.filter((k) => k.startsWith(n.id));

test('a wall through a floor is cut along the floor (only the smaller of the two), and each piece is drawn on the right side', () => {
  for (const yaw of [0, 30, 75, 140, 200, 260, 320]) {
    const s = new Scene({ view: { yaw, pitch: 35 }, split: true });
    const floor = s.add(rect([-3, -3, 0], [6, 6], { role: 'faint' }));
    const wall = s.add(rect([-1.5, 0, -1], [3, 2], { plane: 'xz', role: 'accent' }));
    const f = s.frame();
    const keys = f.items.map((i) => i.key);
    const w = own(keys, wall), fl = own(keys, floor);
    // the wall was cut into the part above the floor (a) and the part below it (b)
    assert.ok(w.some((k) => k.endsWith('~a')) && w.some((k) => k.endsWith('~b')), `wall cut at yaw ${yaw}: ${w}`);
    assert.equal(fl.length, 1, `the big floor stays whole at yaw ${yaw}: ${fl}`);
    assert.ok(!fl[0].includes('~'));
    let met = 0;
    for (const k of w) {
      for (const g of fl) {
        const r = drawnBefore(f.items, k, g);
        if (r === null) continue;
        met++;
        assert.equal(r, k.endsWith('~b'), `${k} vs ${g} at yaw ${yaw}: below-floor pieces first, above-floor pieces after`);
      }
    }
    assert.ok(met >= 2, 'pieces meet on screen');
  }
});

test('pieces keep the look of the face: same fill, same shade, deterministic keys', () => {
  const build = () => {
    const s = new Scene({ view: { yaw: 30, pitch: 35 }, split: true });
    s.add(rect([-3, -3, 0], [6, 6], { role: 'faint' }));
    const wall = s.add(rect([-1.5, 0, -1], [3, 2], { plane: 'xz', role: 'accent', fill: 0.4 }));
    return { items: s.frame().items.filter((i) => i.key.startsWith(wall.id)) };
  };
  const a = build().items, b = build().items;
  assert.equal(a.length, 2);
  const style = (h: string) => h.match(/style="([^"]*)"/)![1];
  assert.equal(style(a[0].html), style(a[1].html), 'both pieces get the same fill colour');
  assert.deepEqual(a.map((i) => i.key.replace(/^n\d+/, '')), b.map((i) => i.key.replace(/^n\d+/, '')));
});

test('a box sunk into a floor: the sides above the floor draw after it, the sides below before it', () => {
  const s = new Scene({ view: { yaw: 35, pitch: 30 }, split: true });
  const floor = s.add(rect([-3, -3, 0], [6, 6], { role: 'faint' }));
  const b = s.add(box({ at: [-0.5, -0.5, -0.5], size: 1 }));
  const f = s.frame(), keys = f.items.map((i) => i.key), bx = own(keys, b), fl = own(keys, floor);
  const up = bx.filter((k) => k.endsWith('~a')), down = bx.filter((k) => k.endsWith('~b'));
  assert.ok(up.length && down.length, `sides are cut: ${bx}`);
  for (const k of bx) for (const g of fl) {
    const r = drawnBefore(f.items, k, g);
    if (r !== null) assert.equal(r, down.includes(k), `${k} vs ${g}`);
  }
});

test('three quads through each other (the axis planes) have no ordering cycle once cut', () => {
  for (const yaw of [20, 110, 200, 290]) {
    const s = new Scene({ view: { yaw, pitch: 30 }, split: true });
    s.add(rect([-1, -1, 0], [2, 2], { role: 'faint' }));
    s.add(rect([-1, 0, -1], [2, 2], { plane: 'xz', role: 'accent' }));
    s.add(rect([0, -1, -1], [2, 2], { plane: 'yz', role: 's2' }));
    assert.equal(s.frame().cycles, 0, `yaw ${yaw}`);
  }
});

test('scenes where nothing pierces get no extra items and no split keys', () => {
  const s = new Scene({ view: { yaw: 40, pitch: 30 }, split: true });
  s.add(rect([-4, -4, 0], [8, 8], { role: 'faint' }));
  s.add(box({ at: [1, 1, 0], size: 1 }));
  s.add(box({ at: [-2, 0, 0], size: 1.5 }));
  s.add(rect([2, -3, 0.5], [1, 1], { role: 's3' }));
  s.add(rect([-1, 2, 1], [2, 1], { plane: 'xz', role: 's4' })); // above the floor, touching nothing
  const f = s.frame();
  assert.ok(f.items.every((i) => !i.key.includes('~')));
  assert.equal(f.items.length, 1 + 3 + 3 + 1 + 1 - 0); // floor, two boxes of three visible faces, two rects
  assert.equal(f.cycles, 0);
});

test('faces that merely touch, or share a group, are not cut', () => {
  const quad = (z: number, group?: string): SplitItem => ({
    pts: [[0, 0, z], [1, 0, z], [1, 1, z], [0, 1, z]], normal: [0, 0, 1], layer: 0, group, victim: true,
    box: [0, 0, 1, 1], shape: 'poly', sp: [[0, 0], [1, 0], [1, 1], [0, 1]],
  });
  const wall = (group?: string): SplitItem => ({
    pts: [[0, 0.5, -1], [1, 0.5, -1], [1, 0.5, 1], [0, 0.5, 1]], normal: [0, 1, 0], layer: 0, group, victim: true,
    box: [0, 0, 1, 1], shape: 'poly', sp: [[0, 0], [1, 0], [1, 1], [0, 1]],
  });
  assert.deepEqual(splitPierced([quad(0), wall()]).map((x) => x?.length), [2, undefined], 'one of the two is cut, the first on a tie');
  const small = wall(); small.sp = [[0.2, 0.2], [0.6, 0.2], [0.6, 0.6], [0.2, 0.6]];
  assert.deepEqual(splitPierced([quad(0), small]).map((x) => x?.length), [undefined, 2], 'the smaller on screen is cut');
  const grazing = wall(); grazing.pts = grazing.pts.map((p) => [p[0], p[1], p[2] * 0.01 + 0.5 * 0.01]); // barely dips below the quad
  assert.deepEqual(splitPierced([quad(0), grazing]), [null, null], 'a shallow graze is not cut');
  assert.deepEqual(splitPierced([quad(0, 'g'), wall('g')]), [null, null], 'same group');
  const touching = wall(); touching.pts = touching.pts.map((p) => [p[0], p[1], p[2] + 1]); // wall now rests on the quad
  assert.deepEqual(splitPierced([quad(0), touching]), [null, null], 'touching only');
});

test('clipping never makes degenerate pieces', () => {
  const sq: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
  const mid = clipPolygon(sq, [0.5, 0, 0], [1, 0, 0]);
  assert.equal(mid.pos.pts.length, 4);
  assert.equal(mid.neg.pts.length, 4);
  const edge = clipPolygon(sq, [1, 0, 0], [1, 0, 0]); // the plane runs along an edge
  assert.equal(edge.pos.pts.length, 0);
  assert.equal(edge.neg.pts.length, 4);
  for (const q of [...mid.pos.pts, ...mid.neg.pts]) assert.ok(q.every(Number.isFinite));
});

test('only the edges of the original outline are stroked on a piece', () => {
  const sq: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
  const { pos, neg } = clipPolygon(sq, [0.5, 0, 0], [1, 0, 0]);
  for (const piece of [pos, neg]) {
    assert.equal(piece.real.filter(Boolean).length, 3, 'three real edges and one along the cut');
    assert.equal(piece.real.filter((r) => !r).length, 1);
  }
  // cutting again keeps the first cut marked
  const again = clipPolygon(pos.pts, [0, 0.5, 0], [0, 1, 0], pos.real);
  assert.equal(again.pos.real.filter((r) => !r).length, 2);
  const s = new Scene({ view: { yaw: 30, pitch: 35 }, split: true });
  s.add(rect([-3, -3, 0], [6, 6], { role: 'faint' }));
  const wall = s.add(rect([-1.5, 0, -1], [3, 2], { plane: 'xz', role: 'accent' }));
  for (const i of s.frame().items.filter((i) => i.key.startsWith(wall.id))) {
    assert.match(i.html, /^<path [^>]*stroke:none/, 'the fill has no outline');
    assert.equal((i.html.match(/<path/g) ?? []).length, 2, 'and the outline is a second path');
  }
});

test('a big face crossed by many small ones stays whole', () => {
  const s = new Scene({ view: { yaw: 30, pitch: 35 }, split: true });
  const floor = s.add(rect([-5, -5, 0], [10, 10], { role: 'faint' }));
  for (let i = 0; i < 5; i++) s.add(box({ at: [-3 + i * 1.3, 0, -0.5], size: 0.6 }));
  const keys = s.frame().items.map((i) => i.key);
  assert.deepEqual(own(keys, floor), [floor.id]);
});
