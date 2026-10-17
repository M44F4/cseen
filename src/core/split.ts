import { cross, dot, len, sub, type V3 } from './math.ts';
import { EPS, MAX_PAIRWISE, overlap, type SortItem } from './sort.ts';

/** What the splitter needs to know about one projected primitive. */
export interface SplitItem extends Pick<SortItem, 'box' | 'shape' | 'sp' | 'layer' | 'group'> {
  pts: V3[];
  /** unit normal if the item is a flat polygon */
  normal?: V3;
  /** may be cut: a lit face. Planes and anything else only cut others. */
  victim: boolean;
}

/** One piece of a split face: a suffix for its key, its world points, and for each edge (point i to i+1) whether it lies on the original outline. */
export interface Fragment { suffix: string; pts: V3[]; real: boolean[] }

/** signed distance of a point from the plane through `o` with normal `n` */
const dist = (p: V3, o: V3, n: V3) => dot(sub(p, o), n);

/** how far into the polygon's own size a plane must cut for the polygon to count as piercing it; shallower grazing is not worth the extra pieces */
const DEPTH = 0.05;

/** does the polygon have points on both sides of the plane? Each side must reach past EPS, and past `depth` times the size of the polygon */
function straddles(pts: V3[], o: V3, n: V3, depth = 0): boolean {
  let pos = 0, neg = 0, ext = 0;
  for (const p of pts) { const d = dist(p, o, n); pos = Math.max(pos, d); neg = Math.max(neg, -d); ext = Math.max(ext, len(sub(p, pts[0]))); }
  const min = Math.max(EPS, depth * ext);
  return pos > min && neg > min;
}

/** twice the area of a planar polygon (the length of its summed edge cross products) */
function area2(pts: V3[]): number {
  let s: V3 = [0, 0, 0];
  for (let i = 1; i + 1 < pts.length; i++) {
    const c = cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0]));
    s = [s[0] + c[0], s[1] + c[1], s[2] + c[2]];
  }
  return len(s);
}

/** is the polygon flat and convex? Only those can be cut by one plane into two clean pieces. */
function flatConvex(pts: V3[], n: V3): boolean {
  let ext = 0;
  for (const p of pts) ext = Math.max(ext, len(sub(p, pts[0])));
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    if (Math.abs(dist(pts[i], pts[0], n)) > 1e-4 * (ext + 1e-9)) return false;
    const a = pts[i], b = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
    const t = dot(cross(sub(b, a), sub(c, b)), n);
    if (Math.abs(t) <= 1e-12 * (ext * ext + 1e-18)) continue;
    if (sign && Math.sign(t) !== sign) return false;
    sign = Math.sign(t);
  }
  return true;
}

/**
 * Cuts a convex polygon along a plane (Sutherland-Hodgman, once for each side).
 * Points within EPS of the plane count as on it and go to both pieces. A piece with fewer
 * than three points or next to no area is dropped. `real[i]` says whether edge i (point i to i+1)
 * is on the original outline; the result says the same for the pieces, so the new edges along the
 * cut are marked as not real.
 */
export function clipPolygon(pts: V3[], o: V3, n: V3, real: boolean[] = pts.map(() => true)): { pos: Piece; neg: Piece } {
  const pos: Piece = { pts: [], real: [] }, neg: Piece = { pts: [], real: [] };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], r = real[i];
    const da = dist(a, o, n), db = dist(b, o, n);
    const sa = da > EPS ? 1 : da < -EPS ? -1 : 0, sb = db > EPS ? 1 : db < -EPS ? -1 : 0;
    // a side keeps the edge from a when b is on that side too; if b is across, only the part up to the crossing is kept, unless a is on the plane, where the next edge runs along the cut
    if (sa >= 0) { pos.pts.push(a); pos.real.push(r && (sb >= 0 || sa > 0)); }
    if (sa <= 0) { neg.pts.push(a); neg.real.push(r && (sb <= 0 || sa < 0)); }
    if (sa * sb < 0) {
      // the edge crosses the plane: the crossing point is a corner of both pieces; the edge goes on from it on the side b is on
      const t = da / (da - db), x: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      pos.pts.push(x); pos.real.push(r && sa < 0);
      neg.pts.push(x); neg.real.push(r && sa > 0);
    }
  }
  const ok = (q: Piece) => q.pts.length >= 3 && area2(q.pts) > 1e-9;
  return { pos: ok(pos) ? pos : { pts: [], real: [] }, neg: ok(neg) ? neg : { pts: [], real: [] } };
}

/** points of a polygon with the real-edge flags that go with them */
interface Piece { pts: V3[]; real: boolean[] }

/** area of a polygon on screen, to tell a small face from a big one */
function screenArea(sp: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < sp.length; i++) { const a = sp[i], b = sp[(i + 1) % sp.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}

/**
 * Finds the faces that pierce another flat item and cuts them along the plane of the other.
 *
 * Two flat polygons can only cross if each has points on both sides of the other's plane, so only such
 * pairs that also overlap on screen are considered (never inside one `group`, never across layers).
 * Cutting ONE of the two is enough: its pieces lie wholly on one side of the other's plane, so the sort's
 * plane test orders them against the uncut one. The smaller on screen is cut, so a big face is not
 * chopped up because many small ones cross its plane; if the smaller cannot be cut (not a flat convex
 * face) the other one is. One pass suffices: a piece never straddles a plane its parent did not.
 * The result has one entry per item: null when it stays whole, else its pieces (suffix `a` for the
 * side the cutting normal points to, `b` for the other). The number of extra pieces is capped at the
 * number of items plus 16 (and a layer never grows past what the sort can pair up).
 */
export function splitPierced(items: SplitItem[]): (Fragment[] | null)[] {
  const out: (Fragment[] | null)[] = items.map(() => null);
  const byLayer = new Map<number, number[]>();
  items.forEach((it, i) => { if (it.shape === 'poly' && it.normal && it.pts.length >= 3) (byLayer.get(it.layer) ?? byLayer.set(it.layer, []).get(it.layer)!).push(i); });
  const area = items.map((it) => screenArea(it.sp));
  const cuttable = new Map<number, boolean>();
  const can = (i: number) => { let c = cuttable.get(i); if (c === undefined) { c = items[i].victim && flatConvex(items[i].pts, items[i].normal!); cuttable.set(i, c); } return c; };
  const cutters = new Map<number, number[]>(); // victim index -> indices whose planes cut it
  for (const ids of byLayer.values()) {
    if (ids.length > MAX_PAIRWISE || !ids.some((i) => items[i].victim)) continue;
    for (let x = 0; x < ids.length; x++) {
      for (let y = x + 1; y < ids.length; y++) {
        const i = ids[x], j = ids[y], a = items[i], b = items[j];
        if (!a.victim && !b.victim) continue;
        if (a.group && a.group === b.group) continue;
        // the plane tests cost less than the exact overlap, so they come first
        if (!straddles(a.pts, b.pts[0], b.normal!, DEPTH) || !straddles(b.pts, a.pts[0], a.normal!, DEPTH)) continue;
        if (!overlap(a, b)) continue;
        const [small, big] = area[i] <= area[j] ? [i, j] : [j, i];
        const victim = can(small) ? small : can(big) ? big : -1;
        if (victim < 0) continue;
        (cutters.get(victim) ?? cutters.set(victim, []).get(victim)!).push(victim === i ? j : i);
      }
    }
  }
  // a layer that grows past MAX_PAIRWISE would lose exact ordering altogether, so pieces also stay within that
  const room = new Map<number, number>();
  for (const it of items) room.set(it.layer, (room.get(it.layer) ?? 0) + 1);
  let budget = items.length + 16; // extra pieces allowed in total: about 2x in a big scene, with a floor so a handful of faces can all be cut
  for (const i of [...cutters.keys()].sort((p, q) => p - q)) {
    const it = items[i];
    let frags: Fragment[] = [{ suffix: '', pts: it.pts, real: it.pts.map(() => true) }];
    for (const c of cutters.get(i)!) {
      const o = items[c].pts[0], n = items[c].normal!, next: Fragment[] = [];
      for (const f of frags) {
        if (budget <= 0 || room.get(it.layer)! >= MAX_PAIRWISE || !straddles(f.pts, o, n)) { next.push(f); continue; }
        const { pos, neg } = clipPolygon(f.pts, o, n, f.real);
        if (!pos.pts.length || !neg.pts.length) { next.push(f); continue; }
        budget--;
        room.set(it.layer, room.get(it.layer)! + 1);
        next.push({ suffix: f.suffix + 'a', ...pos }, { suffix: f.suffix + 'b', ...neg });
      }
      frags = next;
    }
    if (frags.length > 1) out[i] = frags;
  }
  return out;
}
