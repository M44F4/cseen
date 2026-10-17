import { Box, Curve, Dot, Face, Ground, Group, Label, Path, Plane, Surface, arcPoints } from '../core/nodes.ts';
import type { BoxOpts, FaceOpts, Node, NodeOpts, PathOpts, PlaneOpts, Point, SurfaceOpts, TextOpts } from '../core/nodes.ts';
import { norm, sub, cross, add, mul, type V3 } from '../core/math.ts';

/* Short names for the building blocks. Everything returns a node you can keep and animate. */

/**
 * Groups nodes so they move, turn and scale together. Children keep their own positions relative to the group.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const g = s.add(group({ rot: [0, 0, 25] }));   // turn the whole group at once
 * g.add(box({ at: [-1, 0, 0], size: 1 }), box({ at: [1, 0, 0], size: 1, role: 'accent' }));
 */
export const group = (o: NodeOpts = {}, ...children: Node[]) => { const g = new Group(o); if (children.length) g.add(...children); return g; };
/**
 * A straight line through two or more points.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), line([-3, 0, 0], [3, 0, 2]));
 */
export const line = (a: Point, b: Point, o: PathOpts = {}) => new Path([a, b], o);
/**
 * A line with an arrowhead at the end. The same options as `line`, with `arrow: 'end'` already set.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), arrow([-3, 0, 0], [3, 0, 2], { role: 'accent' }));
 */
export const arrow = (a: Point, b: Point, o: PathOpts = {}) => new Path([a, b], { arrow: 'end', ...o });
/**
 * A line through any number of points, optionally closed. The general form of `line` and `polygon`.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), path([[-3, 0, 0], [-1, 0, 2], [1, 0, 0], [3, 0, 2]]));
 */
export const path = (pts: Point[], o: PathOpts = {}) => new Path(pts, o);
/**
 * A flat filled polygon through three or more points.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), polygon([[-2, 0, 0], [2, 0, 0], [0, 0, 2.5]], { role: 'accent' }));
 */
export const polygon = (pts: Point[], o: FaceOpts = {}) => new Face(pts, o);
/**
 * A dot at a point. `r` is its radius in pixels, so it stays the same size however the camera zooms.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), dot([0, 0, 1], { role: 'accent' }));
 */
export const dot = (at: V3, o: ConstructorParameters<typeof Dot>[0] = {}) => new Dot({ at, ...o });
/**
 * A box standing on the point `at`, the centre of its base. `size` is a number for a cube or `[x, y, z]`.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * s.add(box({ at: [-2, 0, 0], size: 1.2 }));                         // a cube
 * s.add(box({ at: [1, 0, 0], size: [2, 1, 0.6], role: 'accent' }));  // width, depth, height
 */
export const box = (o: BoxOpts = {}) => new Box(o);
/**
 * A curve through the points of a function `t => [x, y, z]`, sampled `samples` times between `t0` and `t1`.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), curve((t) => [-3 + 6 * t, 0, 1 + Math.sin(t * Math.PI * 2)], { role: 'accent' }));
 */
export const curve = (fn: (t: number) => V3, o: ConstructorParameters<typeof Curve>[1] = {}) => new Curve(fn, o);
/**
 * A parametric surface `(u, v) => [x, y, z]` drawn as a mesh of shaded quads.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * // half a cylinder: (u, v) in, a point out
 * s.add(surface((u, v) => [-2 + 4 * u, 1.3 * Math.cos(Math.PI * v), 1.3 * Math.sin(Math.PI * v)], { res: [8, 20] }));
 */
export const surface = (fn: (u: number, v: number) => V3, o: SurfaceOpts = {}) => new Surface(fn, o);
/**
 * A height field z = f(x, y) over a rectangle.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * s.add(heightField((x, y) => 0.6 * Math.sin(x) * Math.cos(y) + 0.7, { x: [-3, 3], y: [-2, 2], res: [24, 24], role: 'accent' }));
 */
export const heightField = (f: (x: number, y: number) => number, o: SurfaceOpts & { x?: [number, number]; y?: [number, number] } = {}) => {
  const [x0, x1] = o.x ?? [-2, 2], [y0, y1] = o.y ?? [-2, 2];
  return new Surface((u, v) => [u, v, f(u, v)], { u: [x0, x1], v: [y0, y1], ...o });
};
/**
 * Text that stays upright and readable, attached to a point in the scene. It always faces the viewer.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), box({ at: [0, 0, 0], size: 1.2 }));
 * s.add(label('a box', [0, 0, 1.8], { anchor: 'middle' }));
 */
export const label = (text: string, at: V3, o: TextOpts = {}) => new Label(text, { at, ...o });
/**
 * Lays an SVG (a logo, a chart, a screenshot) on any plane of the scene. Exact with a parallel camera, an approximation with perspective.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect width="100" height="60" fill="none" stroke="currentColor"/><circle cx="50" cy="30" r="18" fill="currentColor"/></svg>';
 * s.add(plane({ svg, size: [4, 2.4], at: [0, 0, 0] }));
 */
export const plane = (o: PlaneOpts) => new Plane(o);
/**
 * A square lattice lying on the floor (z = 0). With a parallel camera it is drawn as one repeating pattern, so it is exact and cheap.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 */
export const ground = (o: ConstructorParameters<typeof Ground>[0] = {}) => new Ground(o);

/**
 * A circle or arc in a coordinate plane, centred on `at`. Angles are in degrees.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), circle([0, 0, 0], 1.5, { plane: 'xy', role: 'accent' }));
 */
export function circle(at: V3, r: number, o: PathOpts & { plane?: 'xy' | 'xz' | 'yz'; from?: number; to?: number } = {}) {
  return new Path(arcPoints(r, o.plane ?? 'xy', o.from ?? 0, o.to ?? 360).map((p) => add(p, at)), o);
}

/**
 * A flat rectangle standing in a coordinate plane, as a filled face.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), rect([0, 0, 0], [3, 2], { plane: 'xy' }));
 */
export function rect(at: V3, size: [number, number], o: FaceOpts & { plane?: 'xy' | 'xz' | 'yz' } = {}) {
  const [w, h] = size, pl = o.plane ?? 'xy';
  const c: V3[] = pl === 'xy' ? [[0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0]] : pl === 'xz' ? [[0, 0, 0], [w, 0, 0], [w, 0, h], [0, 0, h]] : [[0, 0, 0], [0, w, 0], [0, w, h], [0, 0, h]];
  return new Face(c.map((p) => add(p, at)), o);
}

/**
 * The coordinate frame: three arrows along x, y and z with labels. This is how a reader learns
 * which way is which. Put it near the origin of a figure.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), axes({ at: [-3, -2, 0], length: 2 }));
 */
export function axes(o: NodeOpts & { length?: number; labels?: [string, string, string] | false; role?: string } = {}) {
  const L = o.length ?? 2, g = new Group(o), role = o.role ?? 'faint';
  const dirs: V3[] = [[L, 0, 0], [0, L, 0], [0, 0, L]];
  dirs.forEach((d, i) => {
    g.add(new Path([[0, 0, 0], d], { arrow: 'end', role }));
    if (o.labels !== false) g.add(new Label((o.labels ?? ['x', 'y', 'z'])[i], { at: mul(d, 1.08), role, dx: 3, dy: -2 }));
  });
  return g;
}

/**
 * A measured distance: a line with end ticks and a label, offset to one side so it does not cover the thing measured.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), dimension([-3, 0, 0], [3, 0, 0], '6 units'));
 */
export function dimension(a: V3, b: V3, text: string, o: { offset?: V3; role?: string } = {}) {
  const off = o.offset ?? [0, 0, 0.35], role = o.role ?? 'accent', g = new Group();
  const p = add(a, off), q = add(b, off);
  g.add(new Path([a, p], { role: 'faint', width: 0.6 }), new Path([b, q], { role: 'faint', width: 0.6 }));
  g.add(new Path([p, q], { role, arrow: 'both' }));
  g.add(new Label(text, { at: mul(add(p, q), 0.5), role, anchor: 'middle', dy: -4 }));
  return g;
}

/**
 * A pinhole camera: its apex, image plane and the rays through the corners, aimed at a target.
 * The glyph's own origin is the lens, so `cam.anchor([0, 0, 0])` is where rays should start.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), box({ at: [2, 3, 0], size: 1.4, role: 'accent' }));
 * s.add(cameraGlyph([-3, -3, 1.4], [2, 3, 0.8]));
 */
export function cameraGlyph(pos: V3, target: V3, o: { dist?: number; w?: number; h?: number; hot?: boolean; role?: string } = {}) {
  const f = norm(sub(target, pos));
  let r = cross(f, [0, 0, 1]);
  if (Math.hypot(...r) < 1e-6) r = [1, 0, 0];
  r = norm(r);
  const u = cross(r, f), { dist = 1.1, w = 0.7, h = 0.5 } = o;
  const c = mul(f, dist), role = o.role ?? (o.hot ? 'accent' : 'ink');
  const corners: V3[] = [add(add(c, mul(r, -w)), mul(u, h)), add(add(c, mul(r, w)), mul(u, h)), add(add(c, mul(r, w)), mul(u, -h)), add(add(c, mul(r, -w)), mul(u, -h))];
  const g = new Group({ at: pos });
  g.add(new Face(corners, { role, fill: o.hot ? 0.3 : 0.1, shade: false }));
  corners.forEach((q) => g.add(new Path([[0, 0, 0], q], { role: o.hot ? 'accent' : 'faint', width: 0.7 })));
  g.add(new Dot({ role, r: 2.6 }));
  return g;
}
