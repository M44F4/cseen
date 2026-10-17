/** A point in svg units. */
export type Pt = [number, number];
/** One cubic Bezier segment: start, two control points, end. Lines are cubics with the controls on the ends. */
export type Seg = [Pt, Pt, Pt, Pt];

/** a number rounded to `digits` decimals as text, to keep paths and attributes short */
export const rd = (n: number, digits: number) => { const k = 10 ** digits; return String(Math.round(n * k) / k); };

/**
 * A circular arc as cubic segments, none longer than a quarter turn. Angles are in radians with
 * x = cos and y = sin, and y points down like in SVG, so a positive sweep turns clockwise on screen.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [320, 320], padding: 6 });
 * const c = new Construct({ box: [0, 0, 200, 200], size: [3, 3] });
 * c.add({ d: segsD(arcSegs(100, 100, 70, -Math.PI / 2, Math.PI / 3)), width: 4 });
 * s.add(c);
 */
export function arcSegs(cx: number, cy: number, r: number, a0: number, a1: number): Seg[] {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9)), d = (a1 - a0) / n, k = (4 / 3) * Math.tan(d / 4), out: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const s = a0 + i * d, e = a0 + (i + 1) * d;
    out.push([
      [cx + r * Math.cos(s), cy + r * Math.sin(s)],
      [cx + r * Math.cos(s) - k * r * Math.sin(s), cy + r * Math.sin(s) + k * r * Math.cos(s)],
      [cx + r * Math.cos(e) + k * r * Math.sin(e), cy + r * Math.sin(e) - k * r * Math.cos(e)],
      [cx + r * Math.cos(e), cy + r * Math.sin(e)],
    ]);
  }
  return out;
}

/**
 * A straight segment between two points.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [320, 200], padding: 6 });
 * const c = new Construct({ box: [0, 0, 200, 100], size: [3, 1.5] });
 * const up = lineSegs([20, 80], [100, 20]), down = lineSegs([100, 20], [180, 80]);
 * c.add({ d: segsD(up.concat(down)), width: 4 });
 * s.add(c);
 */
export const lineSegs = (a: Pt, b: Pt): Seg[] => [[a, a, b, b]];

/**
 * Turns segments about a point. The angle is in radians, clockwise on screen.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [320, 320], padding: 6 });
 * const c = new Construct({ box: [0, 0, 200, 200], size: [3, 3] });
 * const leaf = lineSegs([100, 100], [100, 20]);
 * for (let k = 0; k < 6; k++) c.add({ d: segsD(rotateSegs(leaf, [100, 100], (k * Math.PI) / 3)), width: 4 });
 * s.add(c);
 */
export function rotateSegs(segs: Seg[], c: Pt, ang: number): Seg[] {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const r = (p: Pt): Pt => { const x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca]; };
  // keep a line a line: `segsD` tells lines from curves by whether the controls are the very same points as the ends
  return segs.map((s) => { const a = r(s[0]), b = r(s[3]); return [a, s[1] === s[0] ? a : r(s[1]), s[2] === s[3] ? b : r(s[2]), b]; });
}

/**
 * Writes segments as an SVG path string. A new subpath starts wherever a segment does not begin
 * where the last one ended, and `close` ends with Z.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [320, 200], padding: 6 });
 * const c = new Construct({ box: [0, 0, 200, 100], size: [3, 1.5] });
 * const lens = arcSegs(100, 50, 60, -0.6, 0.6).concat(arcSegs(100, 50, 60, Math.PI - 0.6, Math.PI + 0.6));
 * c.add({ d: segsD(lens, true), paint: 'accent', width: 3, props: { fill: 0.3 } });
 * s.add(c);
 */
export function segsD(segs: Seg[], close = false, digits = 2): string {
  let d = '', end: Pt | null = null;
  for (const [p0, c1, c2, p3] of segs) {
    if (!end || Math.hypot(end[0] - p0[0], end[1] - p0[1]) > 1e-6) d += `M${rd(p0[0], digits)} ${rd(p0[1], digits)}`;
    d += c1 === p0 && c2 === p3 ? `L${rd(p3[0], digits)} ${rd(p3[1], digits)}` : `C${rd(c1[0], digits)} ${rd(c1[1], digits)} ${rd(c2[0], digits)} ${rd(c2[1], digits)} ${rd(p3[0], digits)} ${rd(p3[1], digits)}`;
    end = p3;
  }
  return close ? d + 'Z' : d;
}

/**
 * A full circle as a path, starting at the top and going clockwise, so it draws on like a compass.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [320, 320], padding: 6 });
 * const c = new Construct({ box: [0, 0, 200, 200], size: [3, 3] });
 * c.add({ d: circleD(100, 100, 80), width: 3 });
 * s.add(c);
 */
export const circleD = (cx: number, cy: number, r: number): string => segsD(arcSegs(cx, cy, r, -Math.PI / 2, (3 * Math.PI) / 2), true);

/**
 * A straight line as a path.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [320, 200], padding: 6 });
 * const c = new Construct({ box: [0, 0, 200, 100], size: [3, 1.5] });
 * c.add({ d: lineD([10, 50], [190, 50]), width: 3 });
 * s.add(c);
 */
export const lineD = (a: Pt, b: Pt): string => segsD(lineSegs(a, b));

/**
 * The point at a distance and an angle (degrees, 0 to the right, 90 up) from a centre.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [320, 320], padding: 6 });
 * const c = new Construct({ box: [0, 0, 200, 200], size: [3, 3] });
 * for (let k = 0; k < 8; k++) c.add({ d: lineD([100, 100], polar([100, 100], 80, k * 45)), width: 3 });
 * s.add(c);
 */
export const polar = (c: Pt, r: number, deg: number): Pt => [c[0] + r * Math.cos((deg * Math.PI) / 180), c[1] - r * Math.sin((deg * Math.PI) / 180)];

/**
 * A measuring bracket between two points: a line with a short tick across each end, for showing a length.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [320, 200], padding: 6 });
 * const c = new Construct({ box: [0, 0, 200, 100], size: [3, 1.5] });
 * c.add({ d: measureD([30, 50], [170, 50]), width: 2 });
 * s.add(c);
 */
export function measureD(a: Pt, b: Pt, tick = 8): string {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * tick, ny = (dx / l) * tick;
  const at = (p: Pt, k: number): Pt => [p[0] + nx * k, p[1] + ny * k];
  return segsD([...lineSegs(a, b), ...lineSegs(at(a, -1), at(a, 1)), ...lineSegs(at(b, -1), at(b, 1))]);
}
