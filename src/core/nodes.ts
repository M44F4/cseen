import { Animatable } from './animatable.ts';
import { add, cross, mul, rotate, sub, unrotate, type V3 } from './math.ts';
import { parseSvg, type ParsedSvg } from './svg-import.ts';

/** A point that may follow something else: a fixed position, or a function evaluated each frame. */
export type Anchor = V3 | (() => V3);
/** A place in the scene: a plain `[x, y, z]`, an anchor of a node, or a node itself (its position). */
export type Point = Anchor | Node;
/** Reads a point's current position in the coordinates it was given in: a node gives its world position, an anchor is called. */
export const resolve = (p: Point): V3 => (p instanceof Node ? p.world([0, 0, 0]) : typeof p === 'function' ? p() : p);

/** What the renderer draws. Nodes turn themselves into these, in world coordinates. */
export interface Prim {
  /** a stable name, so a redraw replaces only what changed */
  key: string;
  /** what to draw */
  kind: 'path' | 'dot' | 'text' | 'plane' | 'ground';
  /** the points in world space */
  pts: V3[];
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role: string;
  /** transparency, 0 to 1 */
  opacity: number;
  /** draw order between groups of things, lower first */
  layer: number;
  /** join the last point back to the first */
  closed?: boolean;
  /** fill the polygon as a lit surface */
  face?: boolean;
  /** how strongly the role colour shows in a face, 0 to 1 (mixed into the background) */
  fill?: number;
  /** see-through amount of a face, 1 is solid */
  alpha?: number;
  /** 0 to 1: blend the face colour towards the accent, for value-coloured surfaces */
  mix?: number;
  /** light the face from the scene light */
  shade?: boolean;
  /** hide when the viewer is behind it. Needs a normal that points outwards. */
  cull?: boolean;
  /** the outward direction of a face, used for shading, culling and depth order */
  normal?: V3;
  /** line width in SVG units */
  width?: number;
  /** how much of the line is drawn, 0 to 1 */
  draw?: number;
  /** where to put arrowheads */
  arrow?: 'start' | 'end' | 'both';
  /** an SVG dash pattern */
  dash?: string;
  /** dashes travel along the line, this many cycles per second */
  flow?: number;
  /** radius in pixels, for a dot */
  r?: number;
  /** the characters, for text */
  text?: string;
  /** which end of the text sits at the point */
  anchor?: 'start' | 'middle' | 'end';
  /** nudge right in pixels */
  dx?: number;
  /** nudge down in pixels */
  dy?: number;
  /** font size in pixels */
  size?: number;
  /** leave out of the framing, so it never changes the size of the picture */
  noFit?: boolean;
  /** pieces of one object (a mesh, a box) are ordered among themselves by depth, not by plane tests */
  group?: string;
  /** an SVG to place on the plane through the first three points */
  plane?: { w: number; h: number; svg: ParsedSvg; cells: number; id: string };
  /** the lattice on the floor */
  ground?: { step?: number; extent?: number };
}

/** Options every node takes. */
export interface NodeOpts {
  /** position of the node's origin in its parent */
  at?: V3;
  /** Euler rotation in degrees */
  rot?: V3;
  /** uniform scale, 1 by default */
  scale?: number;
  /** transparency of the whole node, 0 to 1. Animatable. */
  opacity?: number;
  /** draw order between groups of things: lower first. Labels default to above geometry. */
  layer?: number;
  /** a name for finding the node later */
  name?: string;
}

/** Counter behind node ids (`n1`, `n2`, ...); ids are the renderer's keys, so they never repeat. */
let uid = 0;

/** The base of everything in a scene. A node has a position, rotation, scale and opacity, and animatable properties. */
export abstract class Node extends Animatable {
  id: string;
  name?: string;
  parent?: Group;
  layer: number;

  constructor(o: NodeOpts = {}) {
    super();
    this.id = `n${++uid}`;
    this.name = o.name;
    this.layer = o.layer ?? 0;
    this.props = { pos: o.at ?? [0, 0, 0], rot: o.rot ?? [0, 0, 0], scale: o.scale ?? 1, opacity: o.opacity ?? 1 };
  }

  /** point in this node's own space to the parent's space */
  private local(p: V3): V3 {
    const s = this.props.scale as number;
    return add(rotate(mul(p, s), this.props.rot as V3), this.props.pos as V3);
  }
  /** point in this node's own space to world space */
  world(p: V3): V3 {
    const q = this.local(p);
    return this.parent ? this.parent.world(q) : q;
  }
  /** a point in world space as a point in this node's own space: the inverse of `world` */
  toLocal(p: V3): V3 {
    const q = this.parent ? this.parent.toLocal(p) : p, s = (this.props.scale as number) || 1;
    return mul(unrotate(sub(q, this.props.pos as V3), this.props.rot as V3), 1 / s);
  }
  /** a direction in this node's own space as a direction in world space (rotation and scale, no translation) */
  worldDir(d: V3): V3 {
    const o = this.world([0, 0, 0]), p = this.world(d);
    return [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  }
  /** a point that stays attached to this node as it moves, rotates and scales */
  anchor(local: V3): () => V3 {
    return () => this.world(local);
  }
  /** opacity of this node times that of every group above it */
  get opacityEff(): number {
    return (this.props.opacity as number) * (this.parent ? this.parent.opacityEff : 1);
  }
  /** draw layer of this node plus that of every group above it */
  get layerEff(): number {
    return this.layer + (this.parent ? this.parent.layerEff : 0);
  }
  /** appends what this node draws right now to `out`, in world coordinates. Draws nothing when fully transparent. */
  abstract collect(out: Prim[]): void;
}

/** A node that holds other nodes and moves, turns and scales them together. */
export class Group extends Node {
  children: Node[] = [];
  /** adds nodes to the group. Adding one node returns it, so you can keep a handle: `const b = g.add(box())`. */
  add<T extends Node>(node: T): T;
  add(...nodes: Node[]): void;
  add(...nodes: Node[]): Node | void {
    for (const n of nodes) {
      if (n.parent && n.parent !== this) n.parent.remove(n); // a node lives in one group: moving it must not leave a second copy behind
      else if (n.parent === this) continue; // adding twice would draw it twice
      n.parent = this;
      this.children.push(n);
    }
    if (nodes.length === 1) return nodes[0];
  }
  /** takes a node out of the group. Does nothing for a node that is not in this group. */
  remove(n: Node) {
    if (n.parent !== this) return;
    this.children = this.children.filter((c) => c !== n);
    n.parent = undefined;
  }
  collect(out: Prim[]) {
    if (this.opacityEff <= 0) return;
    for (const c of this.children) c.collect(out);
  }
}

/** Colour and line width, shared by lines, faces and text. */
export interface StyleOpts {
  /** colour role: ink, faint, accent, warm, cool, s1 to s8, or any name you define in CSS as .cn-r-name */
  role?: string;
  /** line width in SVG units */
  width?: number;
}

/* ------------------------------------------------------------------ lines */

/** Options of lines and paths. */
export interface PathOpts extends NodeOpts, StyleOpts {
  /** join the last point back to the first */
  closed?: boolean;
  /** where to put arrowheads */
  arrow?: 'start' | 'end' | 'both';
  /** an SVG dash pattern such as `'3 3'` */
  dash?: string;
  /** dashes travel along the line (in the direction it is drawn): true, or cycles per second. Runs in CSS, so it works in a static SVG too. */
  flow?: boolean | number;
  /** how much of the line is drawn, 0 to 1. Animate it for a draw-on effect. */
  draw?: number;
}

/** the speed of a flow option in cycles per second, or undefined when off */
export const flowOf = (f: boolean | number | undefined): number | undefined => (f === true ? 1 : f ? f : undefined);

/** A line through points, drawn as one SVG path. */
export class Path extends Node {
  pts: Point[];
  o: PathOpts;
  constructor(pts: Point[], o: PathOpts = {}) {
    super(o);
    this.pts = pts;
    this.o = o;
    this.props.draw = o.draw ?? 1;
  }
  collect(out: Prim[]) {
    const op = this.opacityEff, draw = this.props.draw as number;
    if (op <= 0 || draw <= 0) return;
    out.push({
      key: this.id, kind: 'path', pts: this.pts.map((p) => this.world(resolve(p))), role: this.o.role ?? 'ink',
      opacity: op, layer: this.layerEff, closed: this.o.closed, width: this.o.width, draw, arrow: this.o.arrow, dash: this.o.dash, flow: flowOf(this.o.flow),
    });
  }
}

/** A line through the samples of a function, drawn as one SVG path. */
export class Curve extends Node {
  fn: (t: number) => V3;
  o: PathOpts & { range?: [number, number]; samples?: number };
  constructor(fn: (t: number) => V3, o: PathOpts & { range?: [number, number]; samples?: number } = {}) {
    super(o);
    this.fn = fn;
    this.o = o;
    this.props.draw = o.draw ?? 1;
  }
  collect(out: Prim[]) {
    const op = this.opacityEff, draw = this.props.draw as number;
    if (op <= 0 || draw <= 0) return;
    const [t0, t1] = this.o.range ?? [0, 1], n = Math.max(1, Math.floor(this.o.samples ?? 96)); // 0 samples would divide by zero
    const pts: V3[] = [];
    for (let i = 0; i <= n; i++) pts.push(this.world(this.fn(t0 + ((t1 - t0) * i) / n)));
    out.push({ key: this.id, kind: 'path', pts, role: this.o.role ?? 'ink', opacity: op, layer: this.layerEff, closed: this.o.closed, width: this.o.width, draw, arrow: this.o.arrow, dash: this.o.dash, flow: flowOf(this.o.flow) });
  }
}

/** A circle or arc in one of the coordinate planes. Angles are in degrees. */
export function arcPoints(r: number, plane: 'xy' | 'xz' | 'yz', a0 = 0, a1 = 360, seg = 64): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = ((a0 + ((a1 - a0) * i) / seg) * Math.PI) / 180, u = Math.cos(a) * r, v = Math.sin(a) * r;
    pts.push(plane === 'xy' ? [u, v, 0] : plane === 'xz' ? [u, 0, v] : [0, u, v]);
  }
  return pts;
}

/** A dot of fixed size on the screen at a point of the scene. */
export class Dot extends Node {
  o: StyleOpts & { r?: number };
  constructor(o: NodeOpts & StyleOpts & { r?: number } = {}) {
    super(o);
    this.o = o;
    this.props.r = o.r ?? 2.6;
  }
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    out.push({ key: this.id, kind: 'dot', pts: [this.world([0, 0, 0])], role: this.o.role ?? 'ink', opacity: op, layer: this.layerEff, r: this.props.r as number });
  }
}

/* ------------------------------------------------------------------ surfaces */

/** Options of filled surfaces. */
export interface FaceOpts extends NodeOpts, StyleOpts {
  /** colour strength, 0 to 1. Low values are a tint, 1 is the full role colour. */
  fill?: number;
  /** see-through amount. 1 is solid, 0.2 is a faint pane of glass. */
  alpha?: number;
  /** light the face from the scene's light, darker or lighter by angle */
  shade?: boolean;
  /** draw the outline */
  outline?: boolean;
}

/** One flat polygon. */
export class Face extends Node {
  pts: Point[];
  o: FaceOpts;
  constructor(pts: Point[], o: FaceOpts = {}) {
    super(o);
    this.pts = pts;
    this.o = o;
    this.props.alpha = o.alpha ?? 1;
    this.props.fill = o.fill ?? 0.14;
    this.props.draw = 1;
  }
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    out.push({
      key: this.id, kind: 'path', pts: this.pts.map((p) => this.world(resolve(p))), closed: true, face: true, role: this.o.role ?? 'ink',
      opacity: op, layer: this.layerEff, fill: this.props.fill as number, alpha: this.props.alpha as number,
      shade: this.o.shade ?? true, width: this.o.width, draw: this.o.outline === false ? 0 : (this.props.draw as number),
    });
  }
}

type BoxSize = number | [number, number, number];
/** Options of `box`. */
export interface BoxOpts extends FaceOpts {
  /** [width (x), depth (y), height (z)], or one number for a cube */
  size?: BoxSize;
}

/** A box standing on the point `at`: the centre of its base. */
export class Box extends Node {
  o: BoxOpts;
  constructor(o: BoxOpts = {}) {
    super(o);
    this.o = o;
    const sz = o.size ?? 1;
    this.props.size = typeof sz === 'number' ? [sz, sz, sz] : sz;
    this.props.alpha = o.alpha ?? 1;
    this.props.fill = o.fill ?? 0.14;
  }
  /** named points on the box, in world space, that follow it when it moves */
  pt(name: 'top' | 'bottom' | 'center' | 'front' | 'back' | 'left' | 'right'): () => V3 {
    return () => {
      const [w, d, h] = this.props.size as V3;
      const m: Record<string, V3> = {
        top: [0, 0, h], bottom: [0, 0, 0], center: [0, 0, h / 2], front: [0, -d / 2, h / 2], back: [0, d / 2, h / 2], left: [-w / 2, 0, h / 2], right: [w / 2, 0, h / 2],
      };
      return this.world(m[name]);
    };
  }
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    const [w, d, h] = this.props.size as V3, x = w / 2, y = d / 2;
    const alpha = this.props.alpha as number;
    const faces: [V3, V3[]][] = [
      [[0, 0, 1], [[-x, -y, h], [x, -y, h], [x, y, h], [-x, y, h]]],
      [[0, 0, -1], [[-x, -y, 0], [-x, y, 0], [x, y, 0], [x, -y, 0]]],
      [[0, -1, 0], [[-x, -y, 0], [x, -y, 0], [x, -y, h], [-x, -y, h]]],
      [[0, 1, 0], [[x, y, 0], [-x, y, 0], [-x, y, h], [x, y, h]]],
      [[-1, 0, 0], [[-x, y, 0], [-x, -y, 0], [-x, -y, h], [-x, y, h]]],
      [[1, 0, 0], [[x, -y, 0], [x, y, 0], [x, y, h], [x, -y, h]]],
    ];
    faces.forEach(([n, pts], i) => {
      out.push({
        key: `${this.id}:${i}`, kind: 'path', pts: pts.map((p) => this.world(p)), closed: true, face: true, role: this.o.role ?? 'ink',
        opacity: op, layer: this.layerEff, fill: this.props.fill as number, alpha, shade: this.o.shade ?? true,
        cull: alpha >= 0.999, normal: this.worldDir(n), width: this.o.width, group: this.id,
      });
    });
  }
}

/** Options of `surface`. */
export interface SurfaceOpts extends FaceOpts {
  /** parameter ranges */
  u?: [number, number];
  /** range of the second parameter, `[min, max]` */
  v?: [number, number];
  /** number of cells along u and v */
  res?: [number, number];
  /** returns 0 to 1 per point, blending the colour from the role towards the accent */
  color?: (p: V3, u: number, v: number) => number;
}

/** A parametric surface (u, v) to a point, drawn as a mesh of shaded quads. A function z = f(x, y) is a special case. */
export class Surface extends Node {
  fn: (u: number, v: number) => V3;
  o: SurfaceOpts;
  constructor(fn: (u: number, v: number) => V3, o: SurfaceOpts = {}) {
    super(o);
    this.fn = fn;
    this.o = o;
    this.props.alpha = o.alpha ?? 1;
    this.props.fill = o.fill ?? 0.5;
  }
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    const [u0, u1] = this.o.u ?? [0, 1], [v0, v1] = this.o.v ?? [0, 1], [ru, rv] = this.o.res ?? [16, 16];
    const nu = Math.max(1, Math.floor(ru)), nv = Math.max(1, Math.floor(rv)); // 0 cells would divide by zero
    const grid: V3[][] = [];
    for (let i = 0; i <= nu; i++) {
      const row: V3[] = [];
      for (let j = 0; j <= nv; j++) row.push(this.fn(u0 + ((u1 - u0) * i) / nu, v0 + ((v1 - v0) * j) / nv));
      grid.push(row);
    }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
        const c = this.o.color ? this.o.color(grid[i][j], i / nu, j / nv) : undefined;
        out.push({
          key: `${this.id}:${i}:${j}`, kind: 'path', pts: q.map((p) => this.world(p)), closed: true, face: true, role: this.o.role ?? 'ink',
          opacity: op, layer: this.layerEff, fill: this.props.fill as number, alpha: this.props.alpha as number, mix: c, shade: this.o.shade ?? true, width: this.o.width, group: this.id,
          draw: this.o.outline === false ? 0 : 1,
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ text and imported svg */

/** Options of `label`. */
export interface TextOpts extends NodeOpts, StyleOpts {
  /** which end of the text sits at the point */
  anchor?: 'start' | 'middle' | 'end';
  /** nudge in final pixels (a text always faces the viewer) */
  dx?: number;
  /** nudge down in pixels */
  dy?: number;
  /** font size in pixels */
  size?: number;
}

/** Text that stays upright and readable, attached to a point in the scene. */
export class Label extends Node {
  text: string;
  o: TextOpts;
  constructor(text: string, o: TextOpts = {}) {
    super({ layer: 10, ...o });
    this.text = text;
    this.o = o;
  }
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    out.push({
      key: this.id, kind: 'text', pts: [this.world([0, 0, 0])], role: this.o.role ?? 'ink', opacity: op, layer: this.layerEff,
      text: this.text, anchor: this.o.anchor, dx: this.o.dx, dy: this.o.dy, size: this.o.size,
    });
  }
}

/** Options of `plane`. */
export interface PlaneOpts extends NodeOpts {
  /** the SVG to place: its source text */
  svg: string;
  /** size of the plane in world units: [width along u, height along v] */
  size: [number, number];
  /** direction of the SVG's x axis, and of its (upward) y axis, in the node's space. Defaults to the x and z axes: a wall facing you. */
  u?: V3;
  /** direction of the SVG's upward y axis in the node's space */
  v?: V3;
  /** swap hard-coded colours in the SVG for CSS variables, e.g. { '#ffffff': 'var(--c-bg)' } */
  recolor?: Record<string, string>;
  /** a line around the plane */
  border?: string | false;
  /** pieces per side when the camera has perspective. More is smoother and slower. */
  cells?: number;
  /** see-through amount of the SVG, 0 to 1 */
  alpha?: number;
}

/**
 * Any SVG laid on a plane in 3D. With a parallel camera the placement is exact. With perspective
 * it is a close approximation, built from small pieces (an SVG can only be sheared, not foreshortened).
 */
export class Plane extends Node {
  parsed: ParsedSvg;
  o: PlaneOpts;
  constructor(o: PlaneOpts) {
    super(o);
    this.o = o;
    this.parsed = parseSvg(o.svg, { recolor: o.recolor });
    this.props.alpha = o.alpha ?? 1;
  }
  collect(out: Prim[]) {
    const op = this.opacityEff * (this.props.alpha as number);
    if (op <= 0) return;
    pushPlane(this, { size: this.o.size, u: this.o.u, v: this.o.v, svg: this.parsed, cells: this.o.cells, border: this.o.border, opacity: op }, out);
  }
}

/** Shared by everything that lays flat 2D content on a plane: emits the plane and its optional outline. */
export function pushPlane(node: Node, o: { size: [number, number]; u?: V3; v?: V3; svg: ParsedSvg; cells?: number; border?: string | false; cull?: boolean; opacity: number }, out: Prim[]) {
  const [w, h] = o.size, u = o.u ?? [1, 0, 0], v = o.v ?? [0, 0, 1];
  const corners = [[0, 0, 0] as V3, mul(u, w), add(mul(u, w), mul(v, h)), mul(v, h)].map((p) => node.world(p));
  const normal = node.worldDir(cross(u, v));
  out.push({
    key: node.id, kind: 'plane', pts: corners, role: 'ink', opacity: o.opacity, layer: node.layerEff, normal, cull: o.cull,
    plane: { w, h, svg: o.svg, cells: o.cells ?? 8, id: node.id },
  });
  if (o.border !== false) out.push({ key: `${node.id}:b`, kind: 'path', pts: corners, closed: true, role: o.border || 'faint', opacity: o.opacity, layer: node.layerEff, width: 0.8 });
}

/** Several spheres drawn as one body: overlapping balls, like a cloud, are ordered together by depth. */
export class Spheres extends Node {
  list: [V3, number][];
  o: StyleOpts & { fill?: number; alpha?: number; res?: number; outline?: boolean; /** light the balls from the scene's light, on by default */ shade?: boolean };
  constructor(list: [V3, number][], o: NodeOpts & StyleOpts & { fill?: number; alpha?: number; res?: number; outline?: boolean; /** light the balls from the scene's light, on by default */ shade?: boolean } = {}) {
    super(o);
    this.list = list;
    this.o = o;
    this.props.alpha = o.alpha ?? 1;
    this.props.fill = o.fill ?? 0.4;
  }
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    const nu = this.o.res ?? 16, nv = Math.max(4, Math.round(nu / 2));
    this.list.forEach(([c, r], si) => {
      const P = (i: number, j: number): V3 => {
        const u = (2 * Math.PI * i) / nu, v = -Math.PI / 2 + (Math.PI * j) / nv;
        return this.world([c[0] + r * Math.cos(v) * Math.cos(u), c[1] + r * Math.cos(v) * Math.sin(u), c[2] + r * Math.sin(v)]);
      };
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        out.push({
          key: `${this.id}:${si}:${i}:${j}`, kind: 'path', pts: [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], closed: true, face: true, role: this.o.role ?? 'ink',
          opacity: op, layer: this.layerEff, fill: this.props.fill as number, alpha: this.props.alpha as number, shade: this.o.shade ?? true, width: this.o.width, group: this.id,
          draw: this.o.outline === false ? 0 : 1,
        });
      }
    });
  }
}

/** The ground lattice. With a parallel camera it fills the whole picture. */
export class Ground extends Node {
  o: { step?: number; extent?: number };
  constructor(o: NodeOpts & { step?: number; extent?: number } = {}) {
    super({ layer: -10, ...o });
    this.o = o;
  }
  collect(out: Prim[]) {
    if (this.opacityEff <= 0) return;
    out.push({ key: this.id, kind: 'ground', pts: [], role: 'grid', opacity: this.opacityEff, layer: this.layerEff, noFit: true, ground: { step: this.o.step, extent: this.o.extent } });
  }
}
