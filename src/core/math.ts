/** A point or direction `[x, y, z]`. x runs right, y runs into the scene, z runs up. */
export type V3 = [number, number, number];
/** A point on the screen `[x, y]`. */
export type V2 = [number, number];

/* vector helpers on `V3` */
/** The sum of two vectors. */
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** The difference `a - b`. */
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** A vector scaled by `k`. */
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
/** The dot product of two vectors. */
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The cross product of two vectors. */
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** The length of a vector. */
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
/** A vector scaled to length 1; the zero vector stays zero. */
export const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
/** The point `t` of the way from `a` to `b`. */
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** `x` held between `a` and `b` (0 and 1 by default). */
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** Degrees to radians. */
export const rad = (d: number) => (d * Math.PI) / 180;

/** Rotates a point by Euler angles in degrees, applied about x, then y, then z. */
export function rotate(p: V3, r: V3): V3 {
  if (!r[0] && !r[1] && !r[2]) return p;
  let [x, y, z] = p;
  let c = Math.cos(rad(r[0])), s = Math.sin(rad(r[0]));
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(rad(r[1])); s = Math.sin(rad(r[1]));
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rad(r[2])); s = Math.sin(rad(r[2]));
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

/** The inverse of `rotate`: the same angles undone, last turn first. */
export function unrotate(p: V3, r: V3): V3 {
  if (!r[0] && !r[1] && !r[2]) return p;
  let [x, y, z] = p;
  let c = Math.cos(rad(-r[2])), s = Math.sin(rad(-r[2]));
  [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(rad(-r[1])); s = Math.sin(rad(-r[1]));
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rad(-r[0])); s = Math.sin(rad(-r[0]));
  [y, z] = [y * c - z * s, y * s + z * c];
  return [x, y, z];
}

/** Newell's method: a robust unit normal for any planar polygon, however it is wound. */
export function newell(pts: V3[]): V3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm([x, y, z]);
}

/** The average of some points. */
export function mean(pts: V3[]): V3 {
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n, pts.reduce((s, p) => s + p[2], 0) / n];
}

/**
 * The start of a polyline up to the fraction `t` of its length (0 to 1): its points, then the point on the last
 * segment where the length runs out. The last point is where a thing riding the line is at `t`.
 */
export function trimPolyline(pts: V3[], t: number): V3[] {
  if (!pts.length) return [];
  const seg = pts.slice(1).map((p, i) => len(sub(p, pts[i]))), total = seg.reduce((a, b) => a + b, 0) || 1;
  const f = clamp(t);
  let left = f * total;
  const out: V3[] = [pts[0]];
  for (let i = 0; i < seg.length; i++) {
    if (left >= seg[i] - 1e-12) {
      out.push(pts[i + 1]);
      left -= seg[i];
      if (left <= 1e-12 && i < seg.length - 1 && f < 1) break; // ended exactly on a vertex
    } else {
      out.push(lerp3(pts[i], pts[i + 1], left / (seg[i] || 1)));
      break;
    }
  }
  return out;
}

/** A small deterministic random generator, so generated scenes are identical on server and client. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
