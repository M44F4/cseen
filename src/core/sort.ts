import type { Camera } from './camera.ts';
import { dot, sub, type V3 } from './math.ts';

/** What the sort needs to know about one primitive. */
export interface SortItem {
  /** world points of the item */
  pts: V3[];
  /** unit normal if the item is a flat polygon */
  normal?: V3;
  /** mean depth, larger is farther */
  depth: number;
  /** screen bounding box: x0, y0, x1, y1 */
  box: [number, number, number, number];
  /** layers are drawn one after the other, lowest first */
  layer: number;
  /** items of the same group are ordered by depth only */
  group?: string;
  /** the item on screen: a filled polygon, a polyline, a point, or 'any' (covers everything, like the ground) */
  shape: 'poly' | 'line' | 'point' | 'any';
  /** the points on screen */
  sp: [number, number][];
}

/* how far from a plane a point must be to count as on one side of it */
export const EPS = 1e-6;
/* above this many items in a layer, comparing every pair costs too much, so depth alone orders the layer */
export const MAX_PAIRWISE = 900;

/**
 * Which of two items must be drawn first: -1 if a first (a is behind b), 1 if b first, 0 if unknown.
 *
 * A flat polygon splits space in two. If everything of the other item is on the far side of that
 * plane from the eye, the other item is behind it. This is exact where sorting by centre is not,
 * for example a big floor with a small box on it.
 */
function behind(a: SortItem, b: SortItem, cam: Camera): -1 | 0 | 1 {
  const test = (p: SortItem, q: SortItem): -1 | 0 | 1 => {
    // is q entirely on one side of p's plane?
    if (!p.normal) return 0;
    const side = cam.eyeSide(p.pts[0], p.normal);
    if (Math.abs(side) < 1e-4) return 0; // seen edge-on, no information
    let near = 0, far = 0;
    for (const x of q.pts) {
      const d = dot(sub(x, p.pts[0]), p.normal) * Math.sign(side);
      if (d > EPS) near++;
      else if (d < -EPS) far++;
    }
    if (near && far) return 0;
    if (near) return 1; // q is in front of p, so p is drawn first
    if (far) return -1; // q is behind p
    return 0;
  };
  const r1 = test(a, b); // 1: b in front of a, a first
  const r2 = test(b, a); // 1: a in front of b, b first
  const aFirst = (r1 === 1 ? 1 : 0) + (r2 === -1 ? 1 : 0);
  const bFirst = (r1 === -1 ? 1 : 0) + (r2 === 1 ? 1 : 0);
  if (aFirst && !bFirst) return -1;
  if (bFirst && !aFirst) return 1;
  return 0;
}

type P2 = [number, number];
/** the part of an item that the screen overlap test reads */
type Geom = Pick<SortItem, 'box' | 'shape' | 'sp'>;
/** do the screen boxes of two items touch? A cheap first test before the exact ones */
const boxOverlap = (a: Geom, b: Geom) => a.box[0] <= b.box[2] && b.box[0] <= a.box[2] && a.box[1] <= b.box[3] && b.box[1] <= a.box[3];

/** is the point inside the polygon? (even-odd rule) */
function inside(p: P2, poly: P2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** which side of the line a→b the point c is on, as the sign of the result */
const orient = (a: P2, b: P2, c: P2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
/** do the segments a–b and c–d cross each other? */
function segCross(a: P2, b: P2, c: P2, d: P2): boolean {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}
/** do any edges of the two outlines cross? Open outlines have one edge fewer than points. */
function edgesCross(a: P2[], aClosed: boolean, b: P2[], bClosed: boolean): boolean {
  const na = aClosed ? a.length : a.length - 1, nb = bClosed ? b.length : b.length - 1;
  for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) if (segCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  return false;
}
/** do two convex polygons share area? */
function sat(a: P2[], b: P2[]): boolean {
  // separating axis test: exact for convex polygons, which faces and planes are; touching edges do not count as sharing
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = q[1] - p[1], ny = p[0] - q[0];
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const v of a) { const d = v[0] * nx + v[1] * ny; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
      for (const v of b) { const d = v[0] * nx + v[1] * ny; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
      if (aMax < bMin + 1e-9 || bMax < aMin + 1e-9) return false;
    }
  }
  return true;
}

/** Do two items cover any common spot on screen? Items that do not cannot hide each other, so they need no order. */
export function overlap(a: Geom, b: Geom): boolean {
  if (!boxOverlap(a, b)) return false;
  if (a.shape === 'any' || b.shape === 'any') return true;
  if (a.shape === 'poly' && b.shape === 'poly') return sat(a.sp, b.sp);
  if (a.shape === 'poly' || b.shape === 'poly') {
    const [poly, other] = a.shape === 'poly' ? [a, b] : [b, a];
    if (other.shape === 'point') return inside(other.sp[0], poly.sp);
    return other.sp.some((p) => inside(p, poly.sp)) || edgesCross(poly.sp, true, other.sp, false);
  }
  if (a.shape === 'line' && b.shape === 'line') return edgesCross(a.sp, false, b.sp, false);
  return false;
}

/**
 * Returns the indices in drawing order, far to near.
 *
 * Layers are drawn in order. Inside a layer, items are ordered by a topological sort over the
 * "must be behind" relation. If the relation has a cycle (three faces that overlap in a ring, which no
 * order can draw correctly) it falls back to depth for that part. Very large scenes use depth only.
 */
export function order(items: SortItem[], cam: Camera): { order: number[]; cycles: number; exact: boolean } {
  const idx = items.map((_, i) => i);
  const layers = [...new Set(items.map((i) => i.layer))].sort((a, b) => a - b);
  const result: number[] = [];
  let cycles = 0;
  let exact = true;

  for (const layer of layers) {
    const ids = idx.filter((i) => items[i].layer === layer);
    if (ids.length > MAX_PAIRWISE) {
      exact = false;
      result.push(...ids.sort((a, b) => items[b].depth - items[a].depth));
      continue;
    }
    const out = new Map<number, number[]>();
    const indeg = new Map<number, number>();
    for (const i of ids) { out.set(i, []); indeg.set(i, 0); }
    for (let x = 0; x < ids.length; x++) {
      for (let y = x + 1; y < ids.length; y++) {
        const i = ids[x], j = ids[y];
        // cheap tests first: two items without a plane say nothing about each other's order (see `behind`), nor do two of one group
        if (!items[i].normal && !items[j].normal) continue;
        if (items[i].group && items[i].group === items[j].group) continue;
        if (!overlap(items[i], items[j])) continue;
        const r = behind(items[i], items[j], cam);
        if (r === 0) continue;
        const [from, to] = r === -1 ? [i, j] : [j, i];
        out.get(from)!.push(to);
        indeg.set(to, indeg.get(to)! + 1);
      }
    }
    const left = new Set(ids);
    while (left.size) {
      let pick = -1;
      for (const i of left) if (indeg.get(i) === 0 && (pick < 0 || items[i].depth > items[pick].depth)) pick = i;
      if (pick < 0) {
        cycles++;
        for (const i of left) if (pick < 0 || items[i].depth > items[pick].depth) pick = i;
      }
      left.delete(pick);
      result.push(pick);
      for (const t of out.get(pick)!) indeg.set(t, indeg.get(t)! - 1);
    }
  }
  return { order: result, cycles, exact };
}
