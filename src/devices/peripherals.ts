import { Box, Dot, Face, Group, Path, Surface, type NodeOpts } from '../core/nodes.ts';
import type { V3 } from '../core/math.ts';
import { cylinder, sphere } from './devices.ts';

/** n + 1 points of f(t) for t from a to b, evenly spaced: a curve to hand to `Path`, or an outline for `Face` */
const arc = (a: number, b: number, n: number, f: (t: number) => V3): V3[] => Array.from({ length: n + 1 }, (_, i) => f(a + ((b - a) * i) / n));

/* ------------------------------------------------------------------ mouse */

/** Options of `mouse`. */
export interface MouseOpts extends NodeOpts {
  /** length in world units */
  length?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
  /** draw a cable */
  cable?: boolean;
}

/**
 * A computer mouse, pointing away from the viewer (front is -y). `at` is the centre of its base. Move it with `moveTo`.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), mouse({ at: [0, 0, 0], length: 1 }));
 */
export function mouse(o: MouseOpts = {}): Group {
  const L = o.length ?? 0.9, b = L / 2, a = L * 0.27, h = L * 0.2, role = o.role ?? 'ink', g = new Group(o);
  // a low half ellipsoid, narrower at the front and higher toward the back where the palm rests; both change smoothly with u, so the outline has no corners
  const body = (u: number, v: number): V3 => {
    const narrow = 0.85 + 0.075 * (1 + Math.sin(u)), hump = 1 + 0.125 * (1 + Math.sin(u));
    return [a * narrow * Math.cos(v) * Math.cos(u), b * Math.cos(v) * Math.sin(u), h * hump * Math.sin(v)];
  };
  const lift = (p: V3): V3 => [p[0], p[1], p[2] + 0.004];
  g.add(new Surface(body, { u: [0, 2 * Math.PI], v: [0, Math.PI / 2], res: [40, 10], role, fill: 0.14, outline: false }));
  // the base is the same curve as the body's lowest ring, so the two meet exactly
  g.add(new Face(arc(0, 2 * Math.PI, 40, (u) => body(u, 0)).slice(0, -1).reverse(), { role, fill: 0.14 }));
  // the split between the two buttons runs up the centre line of the front half
  g.add(new Path(arc(0.08, 1.1, 12, (v) => lift(body(-Math.PI / 2, v))), { role, width: 0.9 }));
  // the line across the front where the buttons end
  g.add(new Path(arc(-0.8, 0.8, 12, (t) => lift(body(-Math.PI / 2 + t, 0.62))), { role, width: 0.9 }));
  // the wheel sits in the split, a little proud of the body
  const [, wy, wz] = body(-Math.PI / 2, 1.0), ww = L * 0.05;
  g.add(cylinder({ at: [-ww / 2, wy, wz + L * 0.005], rot: [0, 90, 0], r: L * 0.04, h: ww, role: 'accent', fill: 0.6 }));
  if (o.cable) g.add(new Path(arc(0, 1, 14, (t) => [Math.sin(t * 5) * 0.12 * t, -b - t * L * 1.1, 0.01] as V3), { role: 'faint', width: 1 }));
  return g;
}

/* ------------------------------------------------------------------ antennas */

/** Options of `antenna`. */
export interface AntennaOpts extends NodeOpts {
  /** 'whip' (a pole), 'dish' (a parabolic dish on a mount) or 'tower' (a lattice mast) */
  kind?: 'whip' | 'dish' | 'tower';
  /** height in world units */
  height?: number;
  /** dish only: how far the dish is tipped from pointing straight up, in degrees */
  tilt?: number;
  /** dish only: the direction it faces, in degrees around z (0 faces -y, toward the viewer) */
  yaw?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/** An antenna. `signal` is the point waves start from: the tip of a whip, the feed of a dish, the top of a tower. */
export class Antenna extends Group {
  /** the signal point in the antenna's own space */
  private feed: V3 = [0, 0, 0];
  /** where a signal leaves from (and arrives at), as an anchor that follows the antenna */
  signal(): () => V3 { return () => this.world(this.feed); }
  /** sets the signal point, in the antenna's own space */
  setFeed(p: V3) { this.feed = p; }
}

/**
 * An antenna: a whip on a base, a parabolic dish on a mount, or a lattice tower. Has a `signal` anchor at the feed that waves attach to.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), antenna({ at: [0, 0, 0], kind: 'dish', height: 2 }));
 */
export function antenna(o: AntennaOpts = {}): Antenna {
  const H = o.height ?? 2, role = o.role ?? 'ink', g = new Antenna(o), kind = o.kind ?? 'whip';
  if (kind === 'whip') {
    g.add(cylinder({ r: H * 0.12, h: H * 0.05, role }));
    g.add(cylinder({ at: [0, 0, H * 0.05], r: H * 0.022, h: H * 0.9, role }));
    g.add(sphere({ at: [0, 0, H * 0.93], r: H * 0.03, role, res: 10 }));
    g.setFeed([0, 0, H * 0.99]);
  } else if (kind === 'dish') {
    const R = H * 0.34, depth = R * 0.42, tilt = o.tilt ?? 40, yaw = o.yaw ?? 0;
    g.add(cylinder({ r: H * 0.16, h: H * 0.05, role }));
    g.add(cylinder({ at: [0, 0, H * 0.05], r: H * 0.03, h: H * 0.5, role }));
    const turn = new Group({ at: [0, 0, H * 0.58], rot: [0, 0, yaw] });
    const dish = new Group({ rot: [tilt, 0, 0] });
    dish.add(new Surface((u, v) => [R * v * Math.cos(u), R * v * Math.sin(u), depth * v * v], { u: [0, 2 * Math.PI], v: [0, 1], res: [20, 5], role, fill: 0.2, alpha: 0.85, outline: false }));
    const feedP: V3 = [0, 0, depth * 1.9];
    for (const a of [0, 120, 240]) dish.add(new Path([[R * 0.82 * Math.cos((a * Math.PI) / 180), R * 0.82 * Math.sin((a * Math.PI) / 180), depth * 0.82 * 0.82], feedP], { role: 'faint', width: 0.8 }));
    dish.add(new Dot({ at: feedP, r: 2, role: 'accent' }));
    turn.add(dish);
    g.add(turn);
    // the feed point in the antenna's own space, through the dish's tilt and the mount's yaw
    g.setFeed(g.toLocal(dish.world(feedP)));
  } else {
    const w0 = H * 0.2, w1 = H * 0.05, n = 5, level = (i: number): [number, number] => [(H * 0.9 * i) / n, w0 + ((w1 - w0) * i) / n];
    const corner = (i: number, sx: number, sy: number): V3 => { const [z, w] = level(i); return [sx * w, sy * w, z]; };
    const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sy] of corners) g.add(new Path([corner(0, sx, sy), corner(n, sx, sy)], { role, width: 1.1 }));
    for (let i = 0; i <= n; i++) g.add(new Path(corners.map(([sx, sy]) => corner(i, sx, sy)), { role, closed: true, width: 0.8 }));
    for (let i = 0; i < n; i++) corners.forEach(([sx, sy], k) => { const [nx, ny] = corners[(k + 1) % 4]; g.add(new Path([corner(i, sx, sy), corner(i + 1, nx, ny)], { role: 'faint', width: 0.7 })); });
    g.add(new Path([[0, 0, H * 0.9], [0, 0, H]], { role, width: 1.1 }));
    g.add(new Dot({ at: [0, 0, H], r: 2, role: 'accent' }));
    g.setFeed([0, 0, H]);
  }
  return g;
}

/* ------------------------------------------------------------------ router */

/** Options of `router`. */
export interface RouterOpts extends NodeOpts {
  /** width in world units */
  width?: number;
  /** number of antennas */
  antennas?: number;
  /** number of status lights */
  leds?: number;
  /** number of ports */
  ports?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/** A wifi router with antennas, indicator lights and ports. `leds` are Dots you can animate; `signal` is above the antennas. */
export class RouterDevice extends Group {
  leds: Dot[] = [];
  /** the signal point in the router's own space */
  private top: V3 = [0, 0, 1];
  /** where a signal leaves from (and arrives at), above the antennas, as an anchor that follows the router */
  signal(): () => V3 { return () => this.world(this.top); }
  /** sets the signal point, in the router's own space */
  setTop(p: V3) { this.top = p; }
}

/**
 * A router with antennas, status lights and ports. Has a `signal` anchor for waves, and `leds` you can animate.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), router({ at: [0, 0, 0], width: 1.8 }));
 */
export function router(o: RouterOpts = {}): RouterDevice {
  const w = o.width ?? 1.8, d = w * 0.55, h = w * 0.13, role = o.role ?? 'ink', g = new RouterDevice(o);
  const nAnt = o.antennas ?? 3, nLed = o.leds ?? 4, nPort = o.ports ?? 4, front = -d / 2 - 0.012;
  // antennas stand at the back, leaning slightly outward
  for (let i = 0; i < nAnt; i++) {
    const t = nAnt === 1 ? 0 : i / (nAnt - 1) - 0.5, lean = t * 28;
    const ant = new Group({ at: [t * w * 0.7, d * 0.36, h * 0.8], rot: [0, lean, 0] });
    ant.add(cylinder({ r: w * 0.03, h: w * 0.04, role }));
    ant.add(cylinder({ at: [0, 0, w * 0.04], r: w * 0.018, h: w * 0.55, role }));
    g.add(ant);
  }
  g.add(new Box({ size: [w, d, h], role }));
  // lights run from -0.4w and stop short of the ports at 0.05w, so a long row tightens instead of spilling past the body
  const ledPitch = Math.min(w * 0.075, (w * 0.4) / Math.max(1, nLed - 1));
  for (let i = 0; i < nLed; i++) {
    const led = new Dot({ at: [-w * 0.4 + i * ledPitch, front, h * 0.66], r: 1.6, role: i === 0 ? 'accent' : 'faint' });
    g.leds.push(led);
    g.add(led);
  }
  for (let i = 0; i < nPort; i++) {
    // ports share the right part of the front, from 0.05w to 0.45w, so they stay inside the body for any count
    const pitch = (w * 0.4) / nPort, x = w * 0.05 + pitch * (i + 0.5), pw = Math.min(w * 0.1, pitch * 0.7), ph = h * 0.34, z = h * 0.2;
    g.add(new Face([[x - pw / 2, front, z], [x + pw / 2, front, z], [x + pw / 2, front, z + ph], [x - pw / 2, front, z + ph]], { role: 'faint', fill: 0.5, shade: false, width: 0.7 }));
  }
  g.setTop([0, d * 0.36, h * 0.8 + w * 0.6]);
  return g;
}

/* ------------------------------------------------------------------ microphones */

/** Options of `micStand` and `micHand`. */
export interface MicOpts extends NodeOpts {
  /** height in world units */
  height?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/**
 * A microphone on a stand: a round base, a pole, a boom arm and the capsule. `at` is the centre of the base.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), micStand({ at: [0, 0, 0], height: 2.2 }));
 */
export function micStand(o: MicOpts = {}): Group {
  const H = o.height ?? 2.2, role = o.role ?? 'ink', g = new Group(o);
  g.add(cylinder({ r: H * 0.17, h: H * 0.03, role }));
  g.add(cylinder({ at: [0, 0, H * 0.03], r: H * 0.017, h: H * 0.7, role }));
  // the boom leans out toward the viewer; the capsule hangs on its end, facing the viewer
  const top: V3 = [0, 0, H * 0.73], tip: V3 = [0, -H * 0.3, H * 0.82];
  g.add(new Path([top, tip], { role, width: 2.2 }));
  g.add(new Dot({ at: top, r: 2.2, role }));
  const cap = new Group({ at: [tip[0], tip[1] + H * 0.02, tip[2] - H * 0.07], rot: [70, 0, 0] });
  cap.add(cylinder({ r: H * 0.06, h: H * 0.2, role }));
  cap.add(cylinder({ at: [0, 0, H * 0.04], r: H * 0.064, h: H * 0.03, role: 'accent', fill: 0.6 }));
  cap.add(sphere({ at: [0, 0, H * 0.2 - H * 0.06], r: H * 0.06, role, res: 12, fill: 0.2 }));
  g.add(cap);
  return g;
}

/**
 * A handheld microphone, lying upright with its head on top. Pick it up with `moveTo` and `rotateTo`. `at` is the bottom of the handle.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), micHand({ at: [0, 0, 0], height: 1.4 }));
 */
export function micHand(o: MicOpts = {}): Group {
  const H = o.height ?? 1.4, role = o.role ?? 'ink', g = new Group(o), r = H * 0.075;
  g.add(new Surface((u, v) => [(r * 0.8 + r * 0.2 * v) * Math.cos(u), (r * 0.8 + r * 0.2 * v) * Math.sin(u), v * H * 0.55], { u: [0, 2 * Math.PI], v: [0, 1], res: [16, 1], role, fill: 0.3, outline: false }));
  g.add(cylinder({ at: [0, 0, H * 0.4], r: r * 1.05, h: H * 0.04, role: 'accent', fill: 0.6 }));
  g.add(sphere({ at: [0, 0, H * 0.55 - r * 0.2], r: r * 1.5, role, res: 14, fill: 0.22 }));
  g.add(new Dot({ at: [0, -r * 0.95, H * 0.22], r: 1.5, role: 'accent' }));
  return g;
}
