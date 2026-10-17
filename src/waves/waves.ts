import { Node, type NodeOpts, type Prim } from '../core/nodes.ts';
import { add, cross, dot, len, mul, norm, sub, type V3 } from '../core/math.ts';

/** The kinds of wave `wave` can draw. */
export type WaveKind = 'sine' | 'longitudinal' | 'standing' | 'rings' | 'directional' | 'spherical' | 'plane' | 'interference' | 'echo';

/** Options of `wave`. */
export interface WaveOpts extends NodeOpts {
  /** which wave to draw */
  kind?: WaveKind;
  /** the direction the wave travels in. Default +y (into the scene). */
  direction?: V3;
  /** distance between crests, in world units */
  wavelength?: number;
  /** how far the wave reaches from its source (or its length, for a line wave) */
  reach?: number;
  /** directional and echo: the width of the beam in degrees. Default 60. */
  spread?: number;
  /** directional: draw the arcs as caps of a cone in 3D instead of flat arcs */
  cone?: boolean;
  /** sine, longitudinal, standing: the height of the wave, in world units */
  amplitude?: number;
  /** which plane a flat wave lies in. 'ground' lies on the floor, 'upright' stands facing the viewer. */
  plane?: 'ground' | 'upright';
  /** let the wave fade as it travels (default true) */
  fade?: boolean;
  /** interference: the two sources, relative to `at`. Default 1.6 either side. */
  sources?: [V3, V3];
  /** interference: draw the lines where the waves cancel */
  nodal?: boolean;
  /** echo: how far away the reflector is, along the direction */
  target?: number;
  /** echo: how strong the return is, 0 to 1 */
  reflect?: number;
  /** draw the edges of the beam */
  edges?: boolean;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
  /** line width in SVG units */
  width?: number;
}

/** up, and a sideways axis to fall back on when the direction is vertical */
const Z: V3 = [0, 0, 1], X: V3 = [1, 0, 0];

/**
 * Waves of many kinds. Everything is a function of `phase`: 0 to 1 moves the pattern by one wavelength, and the
 * pattern at 1 is the same as at 0, so a looping timeline gives a seamless animation:
 * `tween(w, { phase: 1 }, { duration: 1.5, ease: 'linear' })`.
 *
 *   sine, longitudinal, standing   a wave along a line
 *   rings                          circles spreading from a point
 *   directional                    arcs travelling in one direction, a sonar beam (flat, or a cone with `cone: true`)
 *   spherical                      shells spreading in 3D
 *   plane                          straight fronts moving along a direction
 *   interference                   two sources and the lines where they cancel
 *   echo                           a beam out, a reflector, and a weaker beam back
 */
export class Wave extends Node {
  o: WaveOpts;
  constructor(o: WaveOpts = {}) {
    super(o);
    this.o = o;
    this.props.phase = 0;
  }
  /** the point `d` along the wave's direction from its source, as an anchor that follows it */
  pt(d: number): () => V3 {
    return () => this.world(mul(norm(this.o.direction ?? [0, 1, 0]), d));
  }

  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    const o = this.o, kind = o.kind ?? 'directional', d = norm(o.direction ?? [0, 1, 0]);
    const R = o.reach ?? 4;
    // a wavelength of zero or less would never advance the ring loop, and a tiny one would draw thousands of rings
    const lam = Math.max(o.wavelength !== undefined && o.wavelength > 0 ? o.wavelength : 0.6, R / 300), phase = ((this.props.phase as number) % 1 + 1) % 1;
    const role = o.role ?? 'accent', fade = o.fade !== false, width = o.width;
    const plane = o.plane ?? (kind === 'sine' || kind === 'longitudinal' || kind === 'standing' ? 'upright' : 'ground');
    // the second axis of the plane the wave lies in
    let e: V3 = plane === 'upright' ? Z : norm(cross(Z, d));
    if (Math.abs(dot(e, d)) > 0.99 || len(cross(Z, d)) < 1e-6) e = X;
    e = norm(sub(e, mul(d, dot(e, d))));
    const e2 = norm(cross(d, e)); // third axis, for 3D shapes
    let n = 0;
    /** adds one path, in the wave's own space, unless it is too faint to see */
    const put = (pts: V3[], alpha: number, closed = false, r = role) => {
      if (alpha <= 0.01) return;
      out.push({ key: `${this.id}:${n++}`, kind: 'path', pts: pts.map((p) => this.world(p)), role: r, opacity: op * Math.min(1, alpha), layer: this.layerEff, closed, width, draw: 1 });
    };
    /** how much of its strength a front keeps at distance r: 1 at the source, 0 at `from` */
    const fall = (r: number, from = R) => (fade ? Math.max(0, 1 - r / from) ** 0.8 : 1);
    /** the point a along the direction and b along the second axis */
    const at = (a: number, b: number): V3 => add(mul(d, a), mul(e, b));
    /** an arc of radius r, `half` radians to each side of `dir` */
    const arcPts = (r: number, half: number, centre: V3 = [0, 0, 0], dir = d, side = e, n = 22): V3[] => {
      const pts: V3[] = [];
      for (let i = 0; i <= n; i++) { const a = -half + (2 * half * i) / n; pts.push(add(centre, add(mul(dir, r * Math.cos(a)), mul(side, r * Math.sin(a))))); }
      return pts;
    };
    /** the radii of the fronts between min and max: one every wavelength, shifted outward by the phase */
    const radii = (max: number, min = 0) => { const r: number[] = []; for (let k = 0; ; k++) { const v = (k + phase) * lam; if (v > max) break; if (v > min) r.push(v); } return r; };

    if (kind === 'sine' || kind === 'standing') {
      const A = o.amplitude ?? 0.3, N = 140, pts: V3[] = [], env: V3[] = [], envN: V3[] = [];
      for (let i = 0; i <= N; i++) {
        const x = (R * i) / N, k = (2 * Math.PI) / lam;
        const y = kind === 'sine' ? A * Math.sin(k * x - 2 * Math.PI * phase) * (fade ? Math.min(1, (1 - x / R) * 2.2) : 1) : A * Math.sin(k * x) * Math.cos(2 * Math.PI * phase);
        pts.push(at(x, y));
        if (kind === 'standing') { env.push(at(x, A * Math.sin(k * x))); envN.push(at(x, -A * Math.sin(k * x))); }
      }
      if (kind === 'standing') { put(env, 0.28, false, 'faint'); put(envN, 0.28, false, 'faint'); }
      put(pts, 1);
    } else if (kind === 'longitudinal') {
      // compressions and rarefactions: ticks that bunch up where the pressure is high
      const A = o.amplitude ?? 0.3, k = (2 * Math.PI) / lam, step = lam / 5;
      for (let x0 = step / 2; x0 < R; x0 += step) {
        const disp = (lam / (2 * Math.PI)) * 0.55 * Math.sin(k * x0 - 2 * Math.PI * phase), x = x0 + disp;
        put([at(x, -A), at(x, A)], fall(x));
      }
    } else if (kind === 'rings') {
      for (const r of radii(R)) put(Array.from({ length: 49 }, (_, i) => at(r * Math.cos((2 * Math.PI * i) / 48), r * Math.sin((2 * Math.PI * i) / 48))), fall(r), true);
    } else if (kind === 'directional' || kind === 'echo') {
      const half = ((o.spread ?? 60) * Math.PI) / 360;
      const D = kind === 'echo' ? (o.target ?? R * 0.6) : Infinity;
      const edges = (reach: number, alpha: number, from: V3 = [0, 0, 0], dir = d) => {
        if (!(o.edges ?? true)) return;
        for (const s of [-1, 1]) put([from, add(from, add(mul(dir, reach * Math.cos(half)), mul(e, s * reach * Math.sin(half))))], alpha, false, 'faint');
      };
      const cap = (r: number, centre: V3, dir: V3, alpha: number) => {
        if (o.cone) {
          // a ring on the cone's cap: all directions at angle `half` from the axis
          const ax = dir, s1 = norm(sub(e, mul(ax, dot(e, ax)))), s2 = cross(ax, s1);
          const ring = Array.from({ length: 41 }, (_, i) => { const t = (2 * Math.PI * i) / 40; return add(centre, add(mul(ax, r * Math.cos(half)), add(mul(s1, r * Math.sin(half) * Math.cos(t)), mul(s2, r * Math.sin(half) * Math.sin(t))))); });
          put(ring, alpha, true);
        } else put(arcPts(r, half, centre, dir, e), alpha);
      };
      edges(kind === 'echo' ? Math.min(R, D) : R, 0.4);
      for (const r of radii(Math.min(R, D))) cap(r, [0, 0, 0], d, fall(r));
      if (kind === 'echo') {
        const k = o.reflect ?? 0.5, back = mul(d, -1), T = mul(d, D);
        for (const r of radii(R, D)) cap(r - D, T, back, fall(r) * k);
        // the reflector
        put([add(T, mul(e, -D * Math.sin(half) * 1.05)), add(T, mul(e, D * Math.sin(half) * 1.05))], 1, false, 'ink');
      }
    } else if (kind === 'spherical') {
      for (const r of radii(R)) {
        const a = fall(r);
        for (const [p, q] of [[d, e], [d, e2], [e, e2]] as [V3, V3][]) put(Array.from({ length: 41 }, (_, i) => { const t = (2 * Math.PI * i) / 40; return add(mul(p, r * Math.cos(t)), mul(q, r * Math.sin(t))); }), a * 0.8, true);
      }
    } else if (kind === 'plane') {
      const W = o.amplitude ?? 1.4;
      for (const r of radii(R)) put([at(r, -W), at(r, W)], fall(r));
    } else if (kind === 'interference') {
      const [s1, s2] = o.sources ?? [[-1.6, 0, 0], [1.6, 0, 0]];
      const ring = (c: V3, r: number, role: string) => put(Array.from({ length: 49 }, (_, i) => add(c, at2(r * Math.cos((2 * Math.PI * i) / 48), r * Math.sin((2 * Math.PI * i) / 48)))), fall(r), true, role);
      // here the plane is spanned by the two sources and the axis perpendicular to them
      const ax = norm(sub(s2, s1)), perp = plane === 'upright' ? Z : norm(cross(Z, ax));
      const at2 = (a: number, b: number): V3 => add(mul(ax, a), mul(perp, b));
      for (const r of radii(R)) { ring(s1, r, role); ring(s2, r, 's2'); }
      if (o.nodal) {
        const c = len(sub(s2, s1)) / 2, mid = mul(add(s1, s2), 0.5);
        for (let m = 0; (m + 0.5) * lam < 2 * c; m++) {
          const a = ((m + 0.5) * lam) / 2, b = Math.sqrt(Math.max(0, c * c - a * a));
          for (const sx of [-1, 1]) {
            const pts: V3[] = [];
            for (let t = -2.2; t <= 2.2; t += 0.1) { const p = add(mid, at2(sx * a * Math.cosh(t), b * Math.sinh(t))); if (len(sub(p, mid)) <= R) pts.push(p); }
            put(pts, 0.5, false, 'faint');
          }
        }
      }
    }
  }
}

/**
 * A wave of any kind: sine, longitudinal, standing, rings, directional (sonar), spherical, plane, interference, echo or radio. The animatable property `phase` moves it, and one unit of phase is one wavelength.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), wave({ kind: 'echo', at: [0, -2.4, 0.02], target: 3.8, reflect: 0.5, reach: 7, spread: 50, wavelength: 0.55 }));
 */
export const wave = (o: WaveOpts = {}) => new Wave(o);

/**
 * A sonar beam: arcs travelling in one direction, fading with distance.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), sonar({ at: [0, -2, 0.02], reach: 6, spread: 60, wavelength: 0.5 }));
 */
export const sonar = (o: Omit<WaveOpts, 'kind'> = {}) => new Wave({ ...o, kind: 'directional' });
/**
 * Circles spreading from a point, like a drop in water.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), ripple({ at: [0, 0, 0.02], reach: 4, wavelength: 0.5 }));
 */
export const ripple = (o: Omit<WaveOpts, 'kind'> = {}) => new Wave({ ...o, kind: 'rings' });
/**
 * The arcs above an antenna or a router. Points up and spreads wide by default.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const r = s.add(router({ at: [0, 0, 0], width: 1.8 }));
 * s.add(radio({ at: r.signal()(), reach: 3.2, wavelength: 0.6, spread: 110 }));
 */
export const radio = (o: Omit<WaveOpts, 'kind'> = {}) => new Wave({ direction: [0, 0, 1], plane: 'upright', spread: 120, edges: false, ...o, kind: 'directional' });

