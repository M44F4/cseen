import { Node, flowOf, resolve, type NodeOpts, type PathOpts, type Point, type Prim } from '../core/nodes.ts';
import { add, dot, len, lerp3, mul, norm, sub, trimPolyline, type V3 } from '../core/math.ts';

/** Options of `link`. */
export interface LinkOpts extends NodeOpts, Omit<PathOpts, 'closed'> {
  /** how far the line bows away from the straight line, as a fraction of its length. 0 is straight. Default 0.25. */
  bend?: number;
  /** the direction it bows toward. Default up (z). */
  toward?: V3;
  /** how many points the curve is sampled at */
  samples?: number;
}

/**
 * A curved arrow between two things. The ends can be objects or anchors, so the link follows them when they move.
 * `flow: true` makes dashes travel along it, and `.at(t)` gives the point at t (0 to 1) for a `pulse` to ride.
 */
export class Link extends Node {
  a: Point;
  b: Point;
  o: LinkOpts;
  constructor(a: Point, b: Point, o: LinkOpts = {}) {
    super(o);
    this.a = a; this.b = b; this.o = o;
    this.props.draw = o.draw ?? 1;
  }
  /** the point at t along the link, in world space */
  at(t: number): V3 {
    const A = resolve(this.a), B = resolve(this.b), d = sub(B, A), L = len(d) || 1;
    const out = norm(this.o.toward ?? [0, 0, 1]), dir = norm(d);
    // the bow direction, made perpendicular to the line
    const perp = sub(out, mul(dir, dot(out, dir)));
    const side = len(perp) < 1e-6 ? [0, 0, 1] as V3 : norm(perp);
    const C = add(lerp3(A, B, 0.5), mul(side, (this.o.bend ?? 0.25) * L));
    const u = 1 - t;
    return [u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1], u * u * A[2] + 2 * u * t * C[2] + t * t * B[2]];
  }
  collect(out: Prim[]) {
    const op = this.opacityEff, draw = this.props.draw as number;
    if (op <= 0 || draw <= 0) return;
    const n = Math.max(1, Math.floor(this.o.samples ?? 28)), pts: V3[] = [];
    for (let i = 0; i <= n; i++) pts.push(this.at(i / n));
    out.push({ key: this.id, kind: 'path', pts, role: this.o.role ?? 'ink', opacity: op, layer: this.layerEff, width: this.o.width, draw, arrow: this.o.arrow ?? 'end', dash: this.o.dash, flow: flowOf(this.o.flow) });
  }
}

/**
 * A curved arrow between two objects or points.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const a = s.add(box({ at: [-3, 0, 0], size: 1 }));
 * const b = s.add(box({ at: [3, 0, 0], size: 1, role: 'accent' }));
 * s.add(link(a.anchor([0, 0, 1]), b.anchor([0, 0, 1]), { bend: 0.3, flow: 1.5, role: 'accent' }));
 */
export const link = (a: Point, b: Point, o: LinkOpts = {}) => new Link(a, b, o);

/* ------------------------------------------------------------------ pulse */

/** Options of `pulse`. */
export interface PulseOpts extends NodeOpts {
  /** radius of the dot in pixels */
  r?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
  /** how many fading copies follow the pulse */
  trail?: number;
  /** how far apart the copies are, as a fraction of the path */
  spacing?: number;
}

/** What a pulse can ride: a link, a list of points (a polyline), or a function from 0..1 to a point. */
type Rail = Link | Point[] | ((t: number) => V3);

/**
 * A dot that rides along a link, a polyline or a function. Animate `along` from 0 to 1:
 * `tween(p, { along: 1 }, { duration: 2, from: { along: 0 } })`. It is hidden outside 0 to 1.
 */
export class Pulse extends Node {
  rail: Rail;
  o: PulseOpts;
  constructor(rail: Rail, o: PulseOpts = {}) {
    super(o);
    this.rail = rail; this.o = o;
    this.props.along = 0;
    this.props.r = o.r ?? 3;
  }
  /** the point a fraction `t` of the way along the rail; a polyline is walked by length, not by vertex count */
  private at(t: number): V3 {
    const r = this.rail;
    if (r instanceof Link) return r.at(t);
    if (typeof r === 'function') return r(t);
    const walked = trimPolyline(r.map(resolve), t);
    return walked[walked.length - 1];
  }
  collect(out: Prim[]) {
    const op = this.opacityEff, a = this.props.along as number;
    if (op <= 0 || !(a >= 0 && a <= 1) || (Array.isArray(this.rail) && !this.rail.length)) return;
    const trail = this.o.trail ?? 0, gap = this.o.spacing ?? 0.04, R = this.props.r as number;
    for (let k = trail; k >= 0; k--) {
      const t = a - k * gap;
      if (t < 0) continue;
      out.push({ key: `${this.id}:${k}`, kind: 'dot', pts: [this.at(t)], role: this.o.role ?? 'accent', opacity: op * (1 - k / (trail + 1)), layer: this.layerEff, r: R * (1 - (k * 0.5) / (trail + 1)) });
    }
  }
}

/**
 * A dot that rides along a link or a line.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const a = s.add(box({ at: [-3, 0, 0], size: 1 }));
 * const b = s.add(box({ at: [3, 0, 0], size: 1, role: 'accent' }));
 * const l = s.add(link(a.anchor([0, 0, 1]), b.anchor([0, 0, 1]), { bend: 0.3 }));
 * const ping = s.add(pulse(l, { trail: 4 }));
 *
 * const tl = new Timeline();
 * tl.play(tween(ping, { along: 1 }, { duration: 1.6, from: { along: 0 }, ease: 'linear' }));
 */
export const pulse = (rail: Rail, o: PulseOpts = {}) => new Pulse(rail, o);
