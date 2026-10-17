import { Face, Group, Path, type NodeOpts, type Point, type Prim } from '../core/nodes.ts';
import type { V3 } from '../core/math.ts';
import { SvgPlane, colourOf, esc, BG, K } from '../draw/svgplane.ts';
import { force, layered, reroute, tree as treeLayout, type Box2, type LayoutOpts, type P2, type TreeData } from './layout.ts';

export type { TreeData };

/* text is drawn on a plane, so it grows and shrinks with the diagram and always fits its box */
export const FS = 0.3, CW = FS * 0.6, LH = FS * 1.25;
const lines = (t: string) => t.split('\n');
export const widest = (t: string) => Math.max(1, ...lines(t).map((l) => l.length));

/** The look of a node. */
export type Shape = 'box' | 'round' | 'diamond' | 'circle';

/** Options of `Diagram.node`. */
export interface NodeSpec {
  /** `box` (default), `round` (start and end of a flow), `diamond` (a decision) or `circle` (a point in a network) */
  shape?: Shape;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
  /** how strongly the role colour fills the shape, 0 to 1. Animatable. */
  fill?: number;
}

/** Options of `Diagram.edge`. */
export interface EdgeSpec {
  /** a word on the line, such as `yes` */
  label?: string;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
  /** where to put arrowheads. `end` by default, `false` for a plain line. */
  arrow?: 'start' | 'end' | 'both' | false;
  /** an SVG dash pattern such as `'4 4'` */
  dash?: string;
  /** dashes travel along the edge, true or cycles per second */
  flow?: boolean | number;
}

/** Options of `diagram`. */
export interface DiagramOpts extends NodeOpts {
  /** `layered` (default) for flows with direction, `tree` for hierarchies, `force` for networks */
  layout?: 'layered' | 'tree' | 'force';
  /** the way things flow: `down` (default) or `right` */
  direction?: 'down' | 'right';
  /** space between boxes along the flow and across it, in world units. Default `[0.9, 0.5]`. */
  gap?: [number, number];
  /** `elbow` routes edges with right angles, `straight` draws lines. Elbows by default, straight lines for `force`. */
  edges?: 'elbow' | 'straight';
  /** colour role of everything that does not set its own */
  role?: string;
  /** starts the `force` layout from a different arrangement */
  seed?: number;
}

/** the width and height of a node, by what it says and how it looks */
export function sizeOf(label: string, shape: Shape): [number, number] {
  const n = widest(label), k = lines(label).length, text = n * CW, high = (k - 1) * LH;
  if (shape === 'diamond') return [Math.max(2, text * 1.5 + 0.8), 1.3 + high * 1.5];
  if (shape === 'circle') { const d = Math.max(0.9, text + 0.4, k * LH + 0.4); return [d, d]; }
  return [Math.max(1.4, text + 0.5), 0.8 + high];
}

/** the outline of a shape, centred on the origin of the page (x, z) */
function outline(shape: Shape, w: number, h: number): V3[] {
  const x = w / 2, z = h / 2, P = (a: number, b: number): V3 => [a, 0, b];
  if (shape === 'diamond') return [P(0, -z), P(x, 0), P(0, z), P(-x, 0)];
  if (shape === 'circle') return Array.from({ length: 40 }, (_, i) => P(Math.cos((i / 40) * 2 * Math.PI) * x, Math.sin((i / 40) * 2 * Math.PI) * z));
  if (shape === 'box') return [P(-x, -z), P(x, -z), P(x, z), P(-x, z)];
  const r = Math.min(h / 2, w / 2) * 0.7, out: V3[] = [];
  const corners: [number, number, number][] = [[x - r, z - r, 0], [-x + r, z - r, 90], [-x + r, -z + r, 180], [x - r, -z + r, 270]];
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= 6; i++) { const a = ((a0 + (i * 90) / 6) * Math.PI) / 180; out.push(P(cx + Math.cos(a) * r, cz + Math.sin(a) * r)); }
  return out;
}

/** Text centred on a plane, with an optional background so it can sit on a line. */
class Words extends SvgPlane {
  text: string;
  tone: string;
  back: boolean;
  constructor(text: string, size: [number, number], o: NodeOpts & { role?: string; back?: boolean }) {
    super({ ...o, size }, size);
    this.text = text;
    this.tone = o.role ?? 'ink';
    this.back = !!o.back;
  }
  draw(W: number, H: number): string {
    const ls = lines(this.text), fs = FS * K, lh = LH * K, y0 = H / 2 - ((ls.length - 1) * lh) / 2 + fs * 0.34;
    const bg = this.back ? `<rect x="0" y="0" width="${W}" height="${H}" rx="${H * 0.25}" fill="${BG}" fill-opacity="0.9"/>` : '';
    return bg + ls.map((l, i) => `<text x="${W / 2}" y="${y0 + i * lh}" text-anchor="middle" font-size="${fs}" fill="${colourOf(this.tone)}">${esc(l)}</text>`).join('');
  }
}

/**
 * One box of a diagram: a shape and the words in it. It sits where the layout put it. Animate `opacity`, `fill`, or
 * move it with `pos`, `scale` and `rot` as with any node.
 */
export class DiagramNode extends Group {
  /** the text of the node */
  label: string;
  /** the look of the node */
  shape: Shape;
  /** the width and height of the node in world units */
  box: [number, number];
  private face: Face;
  /** `min` makes the box at least that big (used by notes that span several lifelines) */
  constructor(label: string, o: NodeSpec & { role: string; min?: [number, number] }) {
    super({});
    this.label = label;
    this.shape = o.shape ?? 'box';
    const [sw, sh] = sizeOf(label, this.shape);
    this.box = [Math.max(sw, o.min?.[0] ?? 0), Math.max(sh, o.min?.[1] ?? 0)];
    const [w, h] = this.box;
    this.face = this.add(new Face(outline(this.shape, w, h), { role: o.role, fill: o.fill ?? 0.14, shade: false, layer: 0 }));
    this.add(new Words(label, [w, h], { at: [-w / 2, 0, -h / 2], layer: 2 }));
    this.props.fill = o.fill ?? 0.14;
  }
  collect(out: Prim[]) {
    this.face.props.fill = this.props.fill;
    super.collect(out);
  }
}

/**
 * A line between two nodes, routed by the layout. Animate `draw` from 0 to 1 to trace it on. If you move a node by
 * hand (`pos`), the edge is routed again between the nodes where they are now, and goes back to the layout's route when
 * both nodes are back where the layout put them.
 */
export class DiagramEdge extends Group {
  /** the id of the node it leaves */
  from: string;
  /** the id of the node it enters */
  to: string;
  /** the route on the page, from one node to the other, as `[x, z]` points. Set by the layout. */
  route: P2[] = [];
  /** where the label sits for a route, as the centre `[x, z]`. The layouts leave it unset; a sequence diagram sets it. */
  labelAt?: (route: P2[], w: number, h: number) => P2;
  /** the layout's own route, and the node positions `[xa, za, xb, zb]` it was made for and the ones last routed for */
  laid: P2[] = [];
  laidAt: number[] = [];
  seenAt: number[] = [];
  /** brings the route up to date with the nodes; set by the diagram that owns the edge */
  sync: () => void = () => {};
  private line: Path;
  private word?: Words;
  constructor(from: string, to: string, o: EdgeSpec & { role: string }) {
    super({ layer: -1 });
    this.from = from;
    this.to = to;
    this.line = this.add(new Path([], { role: o.role, arrow: o.arrow === false ? undefined : (o.arrow ?? 'end'), dash: o.dash, flow: o.flow, width: 1.4, layer: -1 }));
    if (o.label) {
      const w = widest(o.label) * CW + 0.3;
      this.word = this.add(new Words(o.label, [w, FS + 0.2], { role: o.role === 'ink' ? 'faint' : o.role, back: true, layer: 3 }));
    }
    this.props.draw = 1;
  }
  /** called by the diagram after every layout */
  setRoute(r: P2[]) {
    this.route = r;
    this.line.pts = r.map(([x, z]): Point => [x, 0, z]);
    if (this.word) {
      // on a horizontal run the word sits on the line; on a vertical one it sits beside it, outside, so it never covers a neighbour
      const [w, h] = this.word.size;
      if (this.labelAt) { const [x, z] = this.labelAt(r, w, h); this.word.set('pos', [x - w / 2, 0, z - h / 2]); return; }
      const [mx, mz, vertical] = midpoint(r), x = vertical ? mx + (mx <= 0 ? -1 : 1) * (w / 2 + 0.1) : mx;
      this.word.set('pos', [x - w / 2, 0, mz - h / 2]);
    }
  }
  /**
   * the route as points in the scene, for a `pulse` to ride: `pulse(edge.rail())`. The points read the route when they
   * are used, so the rail follows the edge if its nodes move; if the route then has a different number of corners, the
   * points are spread along it by length.
   */
  rail(): Point[] {
    const n = this.route.length;
    return this.route.map((_, i): Point => () => {
      this.sync();
      const r = this.route;
      if (r.length === n) return this.world([r[i][0], 0, r[i][1]]);
      const [x, z] = along(r, n > 1 ? i / (n - 1) : 0);
      return this.world([x, 0, z]);
    });
  }
  collect(out: Prim[]) {
    this.line.props.draw = this.props.draw;
    if (this.word) this.word.props.opacity = (this.props.draw as number) >= 1 ? 1 : 0;
    super.collect(out);
  }
}

/** the point a fraction `t` of the way along a polyline, by length */
function along(r: P2[], t: number): P2 {
  if (r.length < 2) return r[0] ?? [0, 0];
  const len = r.slice(1).map((p, i) => Math.hypot(p[0] - r[i][0], p[1] - r[i][1])), total = len.reduce((a, b) => a + b, 0);
  let d = t * total;
  for (let i = 0; i < len.length; i++) {
    if (d <= len[i] || i === len.length - 1) { const k = len[i] ? Math.min(1, d / len[i]) : 0; return [r[i][0] + (r[i + 1][0] - r[i][0]) * k, r[i][1] + (r[i + 1][1] - r[i][1]) * k]; }
    d -= len[i];
  }
  return r[r.length - 1];
}

const pairKey = (e: DiagramEdge) => (e.from < e.to ? `${e.from}\0${e.to}` : `${e.to}\0${e.from}`);

/** the middle of the longest run of a polyline, and whether that run is vertical */
function midpoint(r: P2[]): [number, number, boolean] {
  let best = 0, len = -1;
  for (let i = 0; i + 1 < r.length; i++) { const l = Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]); if (l > len + 1e-9) { len = l; best = i; } }
  if (r.length < 2) return [r[0]?.[0] ?? 0, r[0]?.[1] ?? 0, false];
  const a = r[best], b = r[best + 1];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) < 1e-9];
}

/**
 * Boxes and arrows that place themselves. Add nodes and edges, and the diagram lays them out: `layered` for flows,
 * `tree` for hierarchies, `force` for networks. It lies on the page (x right, z up), so use `view: 'front'`.
 * Everything is a node of the scene: link a diagram to a device with `at`, send a `pulse` along an edge with
 * `rail`, trace edges on with `draw`.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [360, 260] });
 * const d = s.add(new Diagram());
 * d.node('in', 'request', { shape: 'round' });
 * d.node('ok', 'valid?', { shape: 'diamond', role: 'accent' });
 * d.node('go', 'handle');
 * d.node('no', 'reject');
 * d.edge('in', 'ok');
 * d.edge('ok', 'go', { label: 'yes' });
 * d.edge('ok', 'no', { label: 'no' });
 */
export class Diagram extends Group {
  o: DiagramOpts;
  /** the nodes by id */
  nodes = new Map<string, DiagramNode>();
  /** the edges in the order they were added */
  edges: DiagramEdge[] = [];
  private held = 0;
  /** the edges between each pair of nodes, so that edges routed again run side by side */
  private pairs = new Map<string, DiagramEdge[]>();
  constructor(o: DiagramOpts = {}) {
    super(o);
    this.o = o;
  }
  /** adds a node and places everything again. Returns the node so you can animate it. */
  node(id: string, label: string, o: NodeSpec = {}): DiagramNode {
    if (this.nodes.has(id)) throw new Error(`cseen: the diagram already has a node "${id}"`);
    const n = new DiagramNode(label, { ...o, role: o.role ?? this.o.role ?? 'ink', shape: o.shape ?? (this.o.layout === 'force' ? 'circle' : 'box') });
    this.nodes.set(id, n);
    this.add(n);
    this.place();
    return n;
  }
  /** adds an edge from one node to another and places everything again. Returns the edge so you can animate it. */
  edge(from: string, to: string, o: EdgeSpec = {}): DiagramEdge {
    for (const id of [from, to]) if (!this.nodes.has(id)) throw new Error(`cseen: the diagram has no node "${id}"`);
    if (from === to) throw new Error('cseen: an edge needs two different nodes');
    const e = new DiagramEdge(from, to, { ...o, role: o.role ?? this.o.role ?? 'ink' });
    this.edges.push(e);
    e.sync = () => this.follow(e);
    this.add(e);
    this.place();
    return e;
  }
  /** a point on a node that follows it: the `center` (default), or the middle of a side. Use it as the end of a `link`. */
  at(id: string, side: 'center' | 'top' | 'bottom' | 'left' | 'right' = 'center'): () => V3 {
    const n = this.nodeOf(id);
    return () => {
      const [w, h] = n.box;
      return n.world(side === 'top' ? [0, 0, h / 2] : side === 'bottom' ? [0, 0, -h / 2] : side === 'left' ? [-w / 2, 0, 0] : side === 'right' ? [w / 2, 0, 0] : [0, 0, 0]);
    };
  }
  /** the route of the first edge between two nodes, as points in the scene, for a `pulse` to ride */
  route(from: string, to: string): Point[] {
    const e = this.edges.find((x) => x.from === from && x.to === to);
    if (!e) throw new Error(`cseen: the diagram has no edge from "${from}" to "${to}"`);
    return e.rail();
  }
  /** the size of the diagram on the page, width and height in world units */
  extent(): [number, number] {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const n of this.nodes.values()) {
      const p = n.props.pos as V3, [w, h] = n.box;
      x0 = Math.min(x0, p[0] - w / 2); x1 = Math.max(x1, p[0] + w / 2); z0 = Math.min(z0, p[2] - h / 2); z1 = Math.max(z1, p[2] + h / 2);
    }
    return this.nodes.size ? [x1 - x0, z1 - z0] : [0, 0];
  }
  /**
   * Runs `build`, which adds nodes and edges, and places everything once at the end instead of after every call.
   * Use it when you add many things, since a `force` layout of a few dozen nodes takes noticeable time on each placing.
   */
  batch<T>(build: (d: this) => T): T {
    this.held++;
    try { return build(this); } finally { if (--this.held === 0) this.place(); }
  }
  collect(out: Prim[]) {
    for (const e of this.edges) e.sync();
    super.collect(out);
  }
  /**
   * Routes an edge again if one of its nodes is not where it was last routed for. An edge whose nodes are both where
   * the layout put them gets the layout's route back. The layout itself does not run: only edges that moved are touched.
   */
  private follow(e: DiagramEdge) {
    const a = this.nodes.get(e.from), b = this.nodes.get(e.to);
    if (!a || !b || !e.laidAt.length) return;
    const pa = a.props.pos as V3, pb = b.props.pos as V3, s = e.seenAt;
    if (s[0] === pa[0] && s[1] === pa[2] && s[2] === pb[0] && s[3] === pb[2]) return;
    e.seenAt = [pa[0], pa[2], pb[0], pb[2]];
    const l = e.laidAt;
    if (l[0] === pa[0] && l[1] === pa[2] && l[2] === pb[0] && l[3] === pb[2]) { e.setRoute(e.laid); return; }
    const { dir, edges } = this.settings(), mates = this.pairs.get(pairKey(e))!, m = mates.length;
    // edges between the same two nodes are spread across the boxes; straight ones measure the offset from a to b, so flip it for the reverse
    const step = Math.min(0.3, (Math.min(...a.box, ...b.box) * 0.7) / m), off = (mates.indexOf(e) - (m - 1) / 2) * step;
    const box = (n: DiagramNode): Box2 => ({ id: '', w: n.box[0], h: n.box[1], diamond: n.shape === 'diamond' });
    e.setRoute(reroute(dir, edges, box(a), [pa[0], pa[2]], box(b), [pb[0], pb[2]], edges === 'straight' && e.from > e.to ? -off : off));
  }
  private settings() {
    const kind = this.o.layout ?? 'layered';
    return { kind, dir: this.o.direction ?? 'down', edges: this.o.edges ?? (kind === 'force' ? 'straight' : 'elbow') } as const;
  }
  private nodeOf(id: string) {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`cseen: the diagram has no node "${id}"`);
    return n;
  }
  private place() {
    if (this.held || !this.nodes.size) return;
    const kind = this.o.layout ?? 'layered', o: LayoutOpts = {
      direction: this.o.direction ?? 'down',
      gap: this.o.gap ?? (kind === 'force' ? [0.7, 0.7] : [0.9, 0.5]),
      edges: this.o.edges ?? (kind === 'force' ? 'straight' : 'elbow'),
      seed: this.o.seed ?? 1,
    };
    const boxes: Box2[] = [...this.nodes].map(([id, n]) => ({ id, w: n.box[0], h: n.box[1], ports: n.shape !== 'circle', diamond: n.shape === 'diamond' }));
    const links = this.edges.map((e) => ({ from: e.from, to: e.to }));
    const r = (kind === 'tree' ? treeLayout : kind === 'force' ? force : layered)(boxes, links, o);
    for (const [id, n] of this.nodes) { const p = r.pos.get(id)!; n.set('pos', [p[0], 0, p[1]]); }
    this.pairs.clear();
    this.edges.forEach((e, k) => {
      const pa = r.pos.get(e.from)!, pb = r.pos.get(e.to)!;
      e.laid = r.routes.get(k)!;
      e.laidAt = e.seenAt = [pa[0], pa[1], pb[0], pb[1]];
      e.setRoute(e.laid);
      const key = pairKey(e);
      (this.pairs.get(key) ?? this.pairs.set(key, []).get(key)!).push(e);
    });
  }
}

/**
 * Boxes and arrows that place themselves.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [360, 200] });
 * const d = s.add(diagram({ direction: 'right' }));
 * d.node('a', 'source', { shape: 'round' });
 * d.node('b', 'build');
 * d.node('c', 'deploy', { role: 'accent' });
 * d.edge('a', 'b');
 * d.edge('b', 'c');
 */
export const diagram = (o: DiagramOpts = {}) => new Diagram(o);

/**
 * A tree from nested data: a label and its `children`. Parents sit centred over their children.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [360, 240] });
 * s.add(treeDiagram({ label: 'app', children: [{ label: 'ui', children: [{ label: 'forms' }, { label: 'tables' }] }, { label: 'api' }] }));
 */
export function treeDiagram(data: TreeData, o: DiagramOpts = {}): Diagram {
  const d = new Diagram({ ...o, layout: 'tree' });
  // generated ids skip the ones you gave, so a node of yours can be called `t1`
  const given = new Set<string>();
  const collect = (t: TreeData) => { if (t.id) given.add(t.id); t.children?.forEach(collect); };
  collect(data);
  let k = 0;
  const fresh = () => { while (given.has(`t${k}`)) k++; return `t${k++}`; };
  const walk = (t: TreeData, parent?: string) => {
    const id = t.id ?? fresh();
    d.node(id, t.label);
    if (parent) d.edge(parent, id);
    for (const c of t.children ?? []) walk(c, id);
  };
  d.batch(() => walk(data));
  return d;
}

/** One step of a flowchart. */
export interface FlowStep {
  /** a name other steps use to point here. Defaults to the label. */
  id?: string;
  /** what the step says */
  label: string;
  /** `start` and `end` are rounded, `step` is a box (default), `decision` is a diamond */
  kind?: 'start' | 'step' | 'decision' | 'end';
  /** where it goes next: ids, or `[id, word]` to put a word on the arrow. Default: the next step in the list, nothing after an `end`. */
  to?: (string | [string, string])[];
}

/**
 * A flowchart from a list of steps. Each step goes to the next one unless it says where else, and a decision lists its branches.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [360, 300] });
 * s.add(flowchart([
 *   { label: 'start', kind: 'start' },
 *   { label: 'logged in?', kind: 'decision', to: [['home', 'yes'], ['login', 'no']] },
 *   { label: 'login', to: ['home'] },
 *   { label: 'home', kind: 'end' },
 * ]));
 */
export function flowchart(steps: FlowStep[], o: DiagramOpts = {}): Diagram {
  const d = new Diagram({ ...o, layout: o.layout ?? 'layered' }), id = (s: FlowStep) => s.id ?? s.label;
  const shapes = { start: 'round', end: 'round', step: 'box', decision: 'diamond' } as const;
  d.batch(() => {
    for (const s of steps) {
      if (d.nodes.has(id(s))) throw new Error(`cseen: two steps are called "${id(s)}"; give one of them an \`id\``);
      d.node(id(s), s.label, { shape: shapes[s.kind ?? 'step'], role: s.kind === 'decision' ? 'accent' : undefined });
    }
    steps.forEach((s, i) => {
      const to = s.to ?? (s.kind === 'end' || i === steps.length - 1 ? [] : [id(steps[i + 1])]);
      for (const t of to) typeof t === 'string' ? d.edge(id(s), t) : d.edge(id(s), t[0], { label: t[1] });
    });
  });
  return d;
}
