import { Node, resolve, type NodeOpts, type Point, type Prim } from '../core/nodes.ts';
import { add, clamp, mul, norm, trimPolyline, type V3 } from '../core/math.ts';

/** Options of `pen`. */
export interface PenOpts extends NodeOpts {
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
  /** line width in svg units */
  width?: number;
  /** which way the pen leans from its tip. Default up and a little to the right. */
  lean?: V3;
  /** length of the pen in world units */
  length?: number;
  /** leave the pen drawn once the line is finished (default: it lifts away) */
  keep?: boolean;
  /** how many points a function is sampled at */
  samples?: number;
}

/**
 * A line being drawn by a pen. `draw` (0 to 1) is how much has been drawn: the trail follows the rail and a pen
 * rides at its tip. The rail is a list of points, or a function from 0..1 to a point.
 * `tween(p, { draw: 1 }, { duration: 2 })` writes it out.
 */
export class Pen extends Node {
  rail: Point[] | ((t: number) => V3);
  o: PenOpts;
  constructor(rail: Point[] | ((t: number) => V3), o: PenOpts = {}) {
    super(o);
    this.rail = rail; this.o = o;
    this.props.draw = 0;
  }
  /** the rail as dense points, in world space */
  private pts(): V3[] {
    const r = this.rail;
    if (typeof r === 'function') {
      const n = Math.max(1, Math.floor(this.o.samples ?? 120)); // 0 samples would divide by zero
      return Array.from({ length: n + 1 }, (_, i) => this.world(r(i / n)));
    }
    return r.map((p) => this.world(resolve(p)));
  }
  collect(out: Prim[]) {
    const op = this.opacityEff, d = clamp(this.props.draw as number);
    if (op <= 0 || !(d > 0)) return;
    const pts = this.pts();
    if (!pts.length) return;
    const trail = trimPolyline(pts, d);
    const role = this.o.role ?? 'ink';
    out.push({ key: `${this.id}:t`, kind: 'path', pts: trail, role, opacity: op, layer: this.layerEff, width: this.o.width, draw: 1 });
    if (d >= 1 && !this.o.keep) return;
    const tip = trail[trail.length - 1], dir = norm(this.o.lean ?? [0.45, 0, 1]), L = this.o.length ?? 0.7;
    const top = add(tip, mul(dir, L)), shoulder = add(tip, mul(dir, L * 0.16));
    // a pencil: a wooden cone at the tip, a body, and a band
    out.push({ key: `${this.id}:b`, kind: 'path', pts: [shoulder, top], role: 'ink', opacity: op, layer: this.layerEff + 2, width: 5, draw: 1 });
    out.push({ key: `${this.id}:c`, kind: 'path', pts: [tip, shoulder], role: 'accent', opacity: op, layer: this.layerEff + 3, width: 3.4, draw: 1 });
    out.push({ key: `${this.id}:e`, kind: 'path', pts: [add(tip, mul(dir, L * 0.9)), top], role: 'faint', opacity: op, layer: this.layerEff + 3, width: 5.4, draw: 1 });
  }
}

/**
 * A line being drawn by a pen: `pen(points)`, then tween `draw` from 0 to 1.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * const stroke = s.add(pen((t) => [-3 + 6 * t, 0, 0.9 * Math.sin(t * 2 * Math.PI)], { role: 'accent', width: 2.2 }));
 *
 * const tl = new Timeline();
 * tl.play(tween(stroke, { draw: 1 }, { duration: 2, from: { draw: 0 } }));
 */
export const pen = (rail: Point[] | ((t: number) => V3), o: PenOpts = {}) => new Pen(rail, o);
