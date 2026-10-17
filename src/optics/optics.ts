import { Node, resolve, type NodeOpts, type Point, type Prim } from '../core/nodes.ts';
import { add, cross, dot, len, mul, norm, rad, sub, type V3 } from '../core/math.ts';

/** a point as a position in the space of `node`: a plain position is already there, a node or an anchor is in world space and is brought in */
const inSpace = (node: Node, p: Point): V3 => (Array.isArray(p) ? p : node.toLocal(resolve(p)));

/** A pinhole camera's frame: where it is, where it looks, and which way is right and up on its image plane. */
interface Pose { apex: V3; axis: V3; right: V3; up: V3 }

/** the frame of a camera at `apex` looking along `look`, rolled by `roll` degrees about its axis. Right is kept level with the floor unless looking straight up or down. */
function poseOf(apex: V3, look: V3, roll = 0): Pose {
  const axis = norm(look);
  let right = cross(axis, [0, 0, 1]);
  if (len(right) < 1e-6) right = [1, 0, 0];
  right = norm(right);
  let up = cross(right, axis);
  if (roll) { const c = Math.cos(rad(roll)), s = Math.sin(rad(roll)); const r2 = add(mul(right, c), mul(up, s)); up = add(mul(up, c), mul(right, -s)); right = r2; }
  return { apex, axis, right, up };
}

/** where a point lands on the image plane (at distance f), in the plane's own coordinates, or null if it is behind the camera */
function imageCoords(p: Pose, f: number, P: V3): { x: number; y: number } | null {
  const d = sub(P, p.apex), z = dot(d, p.axis);
  if (z <= 1e-6) return null;
  return { x: (dot(d, p.right) * f) / z, y: (dot(d, p.up) * f) / z };
}

/** Options of `frustum`. */
export interface FrustumOpts extends NodeOpts {
  /** the point the camera looks at, in the node's space. Default: straight ahead along +y. */
  target?: V3;
  /** focal length: how far the image plane is from the camera centre. Animatable. */
  f?: number;
  /** vertical field of view in degrees. Sets the size of the image plane. Animatable. */
  fov?: number;
  /** width over height of the image plane */
  aspect?: number;
  /** how far the rays reach */
  depth?: number;
  /** points to project. A plain `[x, y, z]` is in the camera's own space; a node or an anchor is wherever it is in the scene, and follows when either moves. Each gets a ray to the camera and a dot where it lands on the image plane */
  points?: Point[];
  /** draw the far end of the pyramid too */
  far?: boolean;
  /** write C, f, and the name of the image plane */
  labels?: boolean;
  /** draw a horizontal line across the image plane through each projected point (the epipolar line of a rectified pair) */
  epipolar?: boolean;
  /** tilt the camera about its own axis, in degrees */
  roll?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/** where `emit` writes, and how to place and fade what it writes */
interface Draw { out: Prim[]; id: string; world: (p: V3) => V3; op: number; layer: number }

/** draws one camera into `d`. Shared by the single camera and the stereo rig. */
function emit(d: Draw, pose: Pose, o: { f: number; fov: number; aspect: number; depth: number; points: V3[]; far: boolean; labels: boolean; epipolar: boolean; role: string; tag?: string }) {
  const { fov, aspect, depth, role } = o, f = Math.max(o.f, 1e-3), hh = f * Math.tan(rad(fov) / 2), hw = hh * aspect; // f > 0, since the far end is scaled by depth / f
  const at = (z: number, x: number, y: number): V3 => add(pose.apex, add(mul(pose.axis, z), add(mul(pose.right, x), mul(pose.up, y))));
  const corners: [number, number][] = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  const plane = corners.map(([sx, sy]) => at(f, sx * hw, sy * hh));
  let n = 0;
  const key = () => `${d.id}:${n++}`;
  const path = (pts: V3[], r: string, extra: Partial<Prim> = {}) => d.out.push({ key: key(), kind: 'path', pts: pts.map(d.world), role: r, opacity: d.op, layer: d.layer, ...extra });
  const text = (p: V3, t: string, extra: Partial<Prim> = {}) => d.out.push({ key: key(), kind: 'text', pts: [d.world(p)], role, opacity: d.op, layer: d.layer + 10, text: t, anchor: 'middle', ...extra });

  // the pyramid: four rays from the camera centre through the corners of the image plane
  const scale = depth / f;
  const farC = corners.map(([sx, sy]) => at(depth, sx * hw * scale, sy * hh * scale));
  // a very faint solid, so the pyramid reads as a volume
  farC.forEach((q, i) => d.out.push({ key: key(), kind: 'path', pts: [pose.apex, q, farC[(i + 1) % 4]].map(d.world), closed: true, face: true, role, opacity: d.op, layer: d.layer - 1, fill: 0.35, alpha: 0.06, shade: false, width: 0.5, draw: 0 }));
  farC.forEach((q) => path([pose.apex, q], 'faint', { width: 0.8 }));
  if (o.far) path(farC, 'faint', { closed: true, width: 0.7 });
  // the image plane
  d.out.push({ key: key(), kind: 'path', pts: plane.map(d.world), closed: true, face: true, role, opacity: d.op, layer: d.layer, fill: 0.5, alpha: 0.22, shade: false, width: 1.1 });
  // the optical axis and the focal length along it
  const pp = at(f, 0, 0);
  path([pp, at(depth, 0, 0)], 'faint', { dash: '3 3', width: 0.7 });
  path([pose.apex, pp], role, { arrow: 'both', width: 1.1 });
  d.out.push({ key: key(), kind: 'dot', pts: [d.world(pose.apex)], role: 'ink', opacity: d.op, layer: d.layer + 5, r: 3 });
  d.out.push({ key: key(), kind: 'dot', pts: [d.world(pp)], role: 'ink', opacity: d.op, layer: d.layer + 5, r: 1.8 });
  if (o.labels) {
    text(add(pose.apex, mul(pose.up, -hh * 0.35)), o.tag ? `C${o.tag}` : 'C', { dy: 11, role: 'ink' });
    text(add(mul(add(pose.apex, pp), 0.5), mul(pose.up, hh * 0.12)), 'f', { dy: -5 });
    if (o.tag !== 'R') text(at(f, 0, hh), 'image plane', { dy: -7, role: 'faint' });
  }
  // the points of the scene and where they land on the image plane
  for (const P of o.points) {
    const c = imageCoords(pose, f, P);
    if (!c) continue;
    const q = at(f, c.x, c.y), inside = Math.abs(c.x) <= hw && Math.abs(c.y) <= hh;
    path([pose.apex, P], 'accent', { dash: '3 3', width: 0.9 });
    d.out.push({ key: key(), kind: 'dot', pts: [d.world(P)], role: 'ink', opacity: d.op, layer: d.layer + 5, r: 3 });
    d.out.push({ key: key(), kind: 'dot', pts: [d.world(q)], role: 'accent', opacity: d.op * (inside ? 1 : 0.4), layer: d.layer + 6, r: 3.2 });
    if (o.epipolar) path([at(f, -hw, c.y), at(f, hw, c.y)], 'accent', { width: 0.8, dash: '2 2' });
  }
}

/**
 * The classic picture of a pinhole camera: the centre, the image plane at focal length `f`, the rays through its
 * corners and the optical axis. Give it `points` and it projects them. `f` and `fov` animate.
 */
export class Frustum extends Node {
  o: FrustumOpts;
  constructor(o: FrustumOpts = {}) {
    super(o);
    this.o = o;
    this.props.f = o.f ?? 1.6;
    this.props.fov = o.fov ?? 46;
  }
  /** the camera's frame in the node's space: at the origin, looking at `target` */
  private pose(): Pose { return poseOf([0, 0, 0], this.o.target ?? [0, 1, 0], this.o.roll); }
  /** the camera centre, as an anchor that follows the node */
  centre(): () => V3 { return () => this.world([0, 0, 0]); }
  /** where a point (in the node's space) lands on the image plane, in world space, or null if behind the camera */
  project(P: V3): V3 | null {
    const p = this.pose(), c = imageCoords(p, this.props.f as number, P);
    return c ? this.world(add(mul(p.axis, this.props.f as number), add(mul(p.right, c.x), mul(p.up, c.y)))) : null;
  }
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    const o = this.o;
    emit({ out, id: this.id, world: (p) => this.world(p), op, layer: this.layerEff }, this.pose(), {
      f: this.props.f as number, fov: this.props.fov as number, aspect: o.aspect ?? 4 / 3, depth: o.depth ?? 4.5,
      points: (o.points ?? []).map((p) => inSpace(this, p)), far: o.far ?? false, labels: o.labels ?? false, epipolar: o.epipolar ?? false, role: o.role ?? 'accent',
    });
  }
}

/**
 * A pinhole camera with its image plane and rays.
 *
 * @example
 * const s = new Scene({ view: { yaw: 62, pitch: 22 } });
 * s.add(ground(), box({ at: [1.4, 5, 0], size: [1, 1, 1.4], role: 'faint' }));
 * s.add(frustum({ at: [-1, -1, 1.6], target: [0.4, 5, 0.6], f: 1.6, fov: 46, depth: 4.6, labels: true }));
 */
export const frustum = (o: FrustumOpts = {}) => new Frustum(o);

/* ------------------------------------------------------------------ stereo */

/** Options of `stereoRig`. */
export interface StereoOpts extends NodeOpts {
  /** distance between the two cameras. Animatable. */
  baseline?: number;
  /** focal length of both cameras */
  f?: number;
  /** vertical field of view in degrees */
  fov?: number;
  /** width over height of the image planes */
  aspect?: number;
  /** the point both cameras see, in the rig's space. Animatable. */
  point?: V3;
  /** how far the rays reach */
  depth?: number;
  /** write the names of the parts */
  labels?: boolean;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/**
 * Two parallel cameras a `baseline` apart looking at one point: both image planes, both rays, the horizontal
 * epipolar lines, and the depth Z = f * b / d. `baseline`, `f`, `fov` and `point` animate, so you can watch the
 * disparity shrink as the point moves away.
 */
export class StereoRig extends Node {
  o: StereoOpts;
  constructor(o: StereoOpts = {}) {
    super(o);
    this.o = o;
    this.props.baseline = o.baseline ?? 2;
    this.props.f = o.f ?? 1.5;
    this.props.fov = o.fov ?? 48;
    this.props.point = o.point ?? [0.3, 4.2, 0.4];
  }
  /** the two cameras, left then right, both looking along +y */
  private cams(): [Pose, Pose] {
    const b = this.props.baseline as number;
    return [poseOf([-b / 2, 0, 0], [0, 1, 0]), poseOf([b / 2, 0, 0], [0, 1, 0])];
  }
  /** disparity: how far apart the two image points are along x, in world units. The depth is f * b / disparity. */
  disparity(): number {
    const [l, r] = this.cams(), f = this.props.f as number, P = this.props.point as V3;
    const a = imageCoords(l, f, P), b = imageCoords(r, f, P);
    return a && b ? a.x - b.x : 0;
  }
  /** the depth recovered from the disparity, f * b / d. It equals the point's distance from the baseline. */
  depth(): number {
    const d = this.disparity();
    return d > 1e-9 ? ((this.props.f as number) * (this.props.baseline as number)) / d : Infinity;
  }
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    const o = this.o, [l, r] = this.cams(), P = this.props.point as V3, f = this.props.f as number, role = o.role ?? 'accent';
    const common = { f, fov: this.props.fov as number, aspect: o.aspect ?? 4 / 3, depth: o.depth ?? 5.2, points: [P], far: false, labels: o.labels ?? true, epipolar: true, role };
    const world = (p: V3) => this.world(p);
    emit({ out, id: `${this.id}l`, world, op, layer: this.layerEff }, l, { ...common, tag: 'L' });
    emit({ out, id: `${this.id}r`, world, op, layer: this.layerEff }, r, { ...common, tag: 'R' });
    // the baseline between the two centres, and the depth from it to the point
    const A = l.apex, B = r.apex, foot: V3 = [P[0], 0, 0];
    out.push({ key: `${this.id}b`, kind: 'path', pts: [A, B].map(world), role: 'ink', opacity: op, layer: this.layerEff, arrow: 'both', width: 1.1 });
    out.push({ key: `${this.id}z`, kind: 'path', pts: [foot, P].map(world), role: 'faint', opacity: op, layer: this.layerEff, dash: '2 3', width: 0.8 });
    if (o.labels ?? true) {
      out.push({ key: `${this.id}tb`, kind: 'text', pts: [world(add(mul(add(A, B), 0.5), [0, 0, -0.25]))], role: 'ink', opacity: op, layer: this.layerEff + 10, text: 'b', anchor: 'middle', dy: 10 });
      out.push({ key: `${this.id}tp`, kind: 'text', pts: [world(P)], role: 'ink', opacity: op, layer: this.layerEff + 10, text: 'P', anchor: 'start', dx: 6, dy: -5 });
      out.push({ key: `${this.id}tz`, kind: 'text', pts: [world(mul(add(foot, P), 0.5))], role: 'faint', opacity: op, layer: this.layerEff + 10, text: 'Z', anchor: 'start', dx: 5, dy: 0 });
    }
  }
}

/**
 * Two cameras looking at one point: the picture behind stereo vision and depth from disparity.
 *
 * @example
 * const s = new Scene({ view: { yaw: 20, pitch: 55 } });
 * s.add(ground(), stereoRig({ baseline: 2.4, f: 1.5, point: [0.4, 4.2, 0.5] }));
 */
export const stereoRig = (o: StereoOpts = {}) => new StereoRig(o);
