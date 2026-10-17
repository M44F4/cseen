import { rng } from '../core/math.ts';

/** A box to place. `w` is its size across the page (x), `h` down it (z), in world units. */
export interface Box2 {
  id: string;
  w: number;
  h: number;
  /** several edges may leave or enter at spread points of one side */
  ports?: boolean;
  /** a diamond: an edge that leaves off-centre stops short, on the slanted side */
  diamond?: boolean;
}
/** A directed link between two boxes, by id. */
export interface Link2 { from: string; to: string }
/** A point on the page: x to the right, z up. */
export type P2 = [number, number];

/** Where each box centre sits, and the route of each edge as a polyline from one box edge to the other. */
export interface Placed {
  pos: Map<string, P2>;
  routes: Map<number, P2[]>;
}

/** How a layout is asked to run. */
export interface LayoutOpts {
  /** the way things flow: `down` (first at the top) or `right` (first at the left) */
  direction: 'down' | 'right';
  /** space between boxes along the flow, and across it */
  gap: [number, number];
  /** `elbow` routes edges with right angles, `straight` draws them as lines */
  edges: 'elbow' | 'straight';
  /** the starting point of the force layout */
  seed: number;
}

/* a layout works in flow space: u across the flow, v along it. These map it to the page. */
const toPage = (dir: 'down' | 'right', u: number, v: number): P2 => (dir === 'down' ? [u, -v] : [v, -u]);
const across = (dir: 'down' | 'right', b: Box2) => (dir === 'down' ? b.w : b.h);
const along = (dir: 'down' | 'right', b: Box2) => (dir === 'down' ? b.h : b.w);

/** the point where a line from the middle of a box towards `to` leaves the box */
const clip = (c: P2, b: Box2, to: P2): P2 => {
  const dx = to[0] - c[0], dz = to[1] - c[1];
  if (!dx && !dz) return c;
  const k = Math.min(dx ? b.w / 2 / Math.abs(dx) : Infinity, dz ? b.h / 2 / Math.abs(dz) : Infinity);
  return [c[0] + dx * k, c[1] + dz * k];
};

/** a polyline through flow-space waypoints, with right angles between ranks */
function elbow(dir: 'down' | 'right', pts: [number, number][], a: Box2, b: Box2, su = 0, eu = 0): P2[] {
  const out: [number, number][] = [];
  // half the thickness of a box where an edge meets it: less than half for a diamond, off its point
  const half = (x: Box2, u: number) => (along(dir, x) / 2) * (x.diamond ? Math.max(0, 1 - Math.abs(u) / (across(dir, x) / 2)) : 1);
  const first = pts[0], last = pts[pts.length - 1], fwd = last[1] >= first[1] ? 1 : -1;
  out.push([first[0] + su, first[1] + fwd * half(a, su)]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], s = i === 0 ? out[0] : p;
    const e: [number, number] = i === pts.length - 2 ? [q[0] + eu, q[1] - fwd * half(b, eu)] : q;
    if (Math.abs(s[0] - e[0]) < 1e-9) { out.push(e); continue; }
    const mid = (s[1] + e[1]) / 2;
    out.push([s[0], mid], [e[0], mid], e);
  }
  const clean: [number, number][] = [];
  for (const p of out) { const l = clean[clean.length - 1]; if (!l || Math.abs(l[0] - p[0]) > 1e-9 || Math.abs(l[1] - p[1]) > 1e-9) clean.push(p); }
  return clean.map((p) => toPage(dir, p[0], p[1]));
}

/**
 * The route between two boxes that are where they are, whatever a layout did: a line, or with `elbow` a path with right
 * angles between the facing sides. `off` shifts it across, so that several edges between the same boxes do not overlap.
 * Boxes that overlap along the flow are joined by a line, since a right-angled path has no room between them.
 */
export function reroute(dir: 'down' | 'right', mode: 'elbow' | 'straight', a: Box2, pa: P2, b: Box2, pb: P2, off = 0): P2[] {
  const dx = pb[0] - pa[0], dz = pb[1] - pa[1], len = Math.hypot(dx, dz) || 1;
  const toFlow = (p: P2): P2 => (dir === 'down' ? [p[0], -p[1]] : [-p[1], p[0]]);
  const fa = toFlow(pa), fb = toFlow(pb);
  if (mode === 'elbow' && Math.abs(fb[1] - fa[1]) >= (along(dir, a) + along(dir, b)) / 2) return elbow(dir, [fa, fb], a, b, off, off);
  const n: P2 = [(-dz / len) * off, (dx / len) * off], sa: P2 = [pa[0] + n[0], pa[1] + n[1]], sb: P2 = [pb[0] + n[0], pb[1] + n[1]];
  return [clip(sa, a, sb), clip(sb, b, sa)];
}

/* ------------------------------------------------------------------ layered */

/**
 * Places a directed graph in ranks: every edge points forward, boxes of one rank line up, and edges that skip a rank
 * are routed around the boxes in between. Cycles are broken by turning their back edges round for the layout only.
 */
export function layered(boxes: Box2[], edges: Link2[], o: LayoutOpts): Placed {
  const dir = o.direction, [gv, gu] = o.gap, idx = new Map(boxes.map((b, i) => [b.id, i]));
  const n = boxes.length, out: number[][] = boxes.map(() => []);
  edges.forEach((e, k) => out[idx.get(e.from)!].push(k));
  // break cycles: a depth first walk, edges into the walk's own path are reversed
  const state = new Array(n).fill(0), rev = new Set<number>();
  const walk = (i: number) => {
    state[i] = 1;
    for (const k of out[i]) {
      const j = idx.get(edges[k].to)!;
      if (state[j] === 1) rev.add(k);
      else if (state[j] === 0) walk(j);
    }
    state[i] = 2;
  };
  for (let i = 0; i < n; i++) if (!state[i]) walk(i);
  const dag = edges.map((e, k) => (rev.has(k) ? { a: idx.get(e.to)!, b: idx.get(e.from)! } : { a: idx.get(e.from)!, b: idx.get(e.to)! }));
  // rank: the longest path from a source
  const rank = new Array(n).fill(0);
  for (let pass = 0; pass < n; pass++) {
    let moved = false;
    for (const { a, b } of dag) if (rank[b] < rank[a] + 1) { rank[b] = rank[a] + 1; moved = true; }
    if (!moved) break;
  }
  // a dummy box for each rank an edge passes through, so the edge has room
  interface Item { box: Box2; rank: number; real: boolean; up: number[]; down: number[]; u: number }
  const items: Item[] = boxes.map((b, i) => ({ box: b, rank: rank[i], real: true, up: [], down: [], u: 0 }));
  const chains: number[][] = [];
  dag.forEach(({ a, b }) => {
    const chain = [a];
    for (let r = rank[a] + 1; r < rank[b]; r++) {
      items.push({ box: { id: '', w: 0.2, h: 0.2 }, rank: r, real: false, up: [], down: [], u: 0 });
      chain.push(items.length - 1);
    }
    chain.push(b);
    for (let i = 0; i < chain.length - 1; i++) { items[chain[i]].down.push(chain[i + 1]); items[chain[i + 1]].up.push(chain[i]); }
    chains.push(chain);
  });
  const nr = Math.max(0, ...items.map((t) => t.rank)) + 1, ranks: number[][] = Array.from({ length: nr }, () => []);
  items.forEach((t, i) => ranks[t.rank].push(i));
  // order within ranks: sweep by the mean position of the neighbours, keeping ties where they were
  const order = new Array(items.length).fill(0);
  const reindex = () => ranks.forEach((r) => r.forEach((i, p) => { order[i] = p; }));
  reindex();
  const sweep = (down: boolean) => {
    const seq = down ? ranks.slice(1) : ranks.slice(0, -1).reverse();
    for (const r of seq) {
      const bary = new Map(r.map((i) => {
        const nb = down ? items[i].up : items[i].down;
        return [i, nb.length ? nb.reduce((s, j) => s + order[j], 0) / nb.length : order[i]] as const;
      }));
      r.sort((a, b) => bary.get(a)! - bary.get(b)! || order[a] - order[b]);
      reindex();
    }
  };
  for (let k = 0; k < 4; k++) { sweep(true); sweep(false); }
  // across the flow: pack each rank left to right, then pull towards the neighbours without overlapping
  const sizeU = (i: number) => across(dir, items[i].box);
  const pack = (r: number[]) => {
    let u = 0;
    r.forEach((i) => { items[i].u = u + sizeU(i) / 2; u += sizeU(i) + gu; });
    const w = u - gu;
    r.forEach((i) => { items[i].u -= w / 2; });
  };
  ranks.forEach(pack);
  const relax = (r: number[], down: boolean) => {
    const want = r.map((i) => {
      const nb = down ? items[i].up : items[i].down;
      return nb.length ? nb.reduce((s, j) => s + items[j].u, 0) / nb.length : items[i].u;
    });
    // left to right push, then right to left push, so the order and the gap hold
    const u = want.slice();
    for (let p = 1; p < r.length; p++) u[p] = Math.max(u[p], u[p - 1] + (sizeU(r[p - 1]) + sizeU(r[p])) / 2 + gu);
    for (let p = r.length - 2; p >= 0; p--) u[p] = Math.min(u[p], u[p + 1] - (sizeU(r[p]) + sizeU(r[p + 1])) / 2 - gu);
    for (let p = 1; p < r.length; p++) u[p] = Math.max(u[p], u[p - 1] + (sizeU(r[p - 1]) + sizeU(r[p])) / 2 + gu);
    r.forEach((i, p) => { items[i].u = (items[i].u + u[p]) / 2; });
  };
  for (let k = 0; k < 6; k++) { for (const r of ranks.slice(1)) relax(r, true); for (const r of ranks.slice(0, -1).reverse()) relax(r, false); }
  // along the flow: ranks one after another, each as thick as its thickest box
  const vOf: number[] = [];
  let v = 0;
  ranks.forEach((r, k) => {
    const th = Math.max(...r.map((i) => along(dir, items[i].box)));
    vOf[k] = v + th / 2;
    v += th + gv;
  });
  // centre the picture on the page origin
  let lo = Infinity, hi = -Infinity;
  for (const t of items) { lo = Math.min(lo, t.u - across(dir, t.box) / 2); hi = Math.max(hi, t.u + across(dir, t.box) / 2); }
  const shift = (lo + hi) / 2, total = v - gv;
  const pos = new Map<string, P2>();
  items.forEach((t) => { if (t.real) pos.set(t.box.id, toPage(dir, t.u - shift, vOf[t.rank] - total / 2)); });
  const routes = new Map<number, P2[]>();
  // the waypoints of each edge in flow space, from its source to its target
  const wps = edges.map((_, k) => {
    // the chain runs from the lower rank to the higher, so a reversed edge is walked backwards
    const chain = chains[k];
    return (rev.has(k) ? chain.slice().reverse() : chain).map((i) => [items[i].u - shift, vOf[items[i].rank] - total / 2] as [number, number]);
  });
  // edges that share a side of a box leave or enter at spread points of it, in the order of where they go
  const side = new Map<string, { k: number; end: boolean; at: number }[]>();
  edges.forEach((e, k) => {
    const wp = wps[k], fwd = wp[wp.length - 1][1] >= wp[0][1] ? 'f' : 'n';
    const add = (id: string, tag: string, end: boolean, at: number) => { const key = `${id}:${tag}`; (side.get(key) ?? side.set(key, []).get(key)!).push({ k, end, at }); };
    add(e.from, fwd, false, wp[1][0]);
    add(e.to, fwd === 'f' ? 'n' : 'f', true, wp[wp.length - 2][0]);
  });
  const port = edges.map(() => [0, 0] as [number, number]);
  for (const [key, list] of side) {
    const b = boxes[idx.get(key.slice(0, key.lastIndexOf(':')))!];
    if (b.ports === false || list.length < 2) continue;
    list.sort((p, q) => p.at - q.at || p.k - q.k);
    const step = Math.min(0.3, (across(dir, b) * 0.7) / list.length);
    list.forEach((it, i) => { port[it.k][it.end ? 1 : 0] = (i - (list.length - 1) / 2) * step; });
  }
  edges.forEach((e, k) => {
    const wp = wps[k], a = boxes[idx.get(e.from)!], b = boxes[idx.get(e.to)!];
    if (o.edges === 'elbow') { routes.set(k, elbow(dir, wp, a, b, port[k][0], port[k][1])); return; }
    const pts = wp.map((p) => toPage(dir, p[0], p[1]));
    pts[0] = clip(pts[0], a, pts[1]);
    pts[pts.length - 1] = clip(pts[pts.length - 1], b, pts[pts.length - 2]);
    routes.set(k, pts);
  });
  return { pos, routes };
}

/* ------------------------------------------------------------------ tree */

/** The shape of a tree: a label and the branches below it. */
export interface TreeData {
  /** a name for the node, if you want to point at it later with `at`. Defaults to a generated one. */
  id?: string;
  /** the text of the node */
  label: string;
  /** the branches below it */
  children?: TreeData[];
}

/**
 * Places a tree: every parent is centred over its children, and branches never touch. The roots are the boxes nothing
 * points at; edges point from parent to child. A box with several parents hangs under the first edge that reaches it,
 * and a cycle with no root starts at its first box. The edges that are left out of the tree are still drawn, between
 * the places where their boxes ended up.
 */
export function tree(boxes: Box2[], edges: Link2[], o: LayoutOpts): Placed {
  const dir = o.direction, [gv, gu] = o.gap, by = new Map(boxes.map((b, i) => [b.id, b]));
  const out = new Map<string, string[]>(), isChild = new Set<string>();
  for (const e of edges) { (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to); isChild.add(e.to); }
  // walk from each root, claiming every box once; boxes left over (a cycle nobody points out of) start their own tree
  const kids = new Map<string, string[]>(), depth = new Map<string, number>();
  const claim = (id: string, d: number) => {
    depth.set(id, d);
    const mine: string[] = [];
    for (const c of out.get(id) ?? []) if (!depth.has(c)) { mine.push(c); claim(c, d + 1); }
    kids.set(id, mine);
  };
  const roots: string[] = [];
  for (const b of boxes) if (!isChild.has(b.id)) { roots.push(b.id); claim(b.id, 0); }
  for (const b of boxes) if (!depth.has(b.id)) { roots.push(b.id); claim(b.id, 0); }
  const width = new Map<string, number>(), u = new Map<string, number>();
  const measure = (id: string): number => {
    const cs = kids.get(id)!, own = across(dir, by.get(id)!);
    const w = cs.length ? Math.max(own, cs.reduce((s, c) => s + measure(c), 0) + gu * (cs.length - 1)) : own;
    width.set(id, w);
    return w;
  };
  let x = 0;
  const place = (id: string, left: number) => {
    const cs = kids.get(id)!, w = width.get(id)!;
    u.set(id, left + w / 2);
    let at = left + (w - (cs.reduce((s, c) => s + width.get(c)!, 0) + gu * (cs.length - 1))) / 2;
    for (const c of cs) { place(c, at); at += width.get(c)! + gu; }
  };
  for (const r of roots) { measure(r); place(r, x); x += width.get(r)! + gu; }
  const levels = Math.max(...depth.values()) + 1, th: number[] = new Array(levels).fill(0);
  for (const [id, d] of depth) th[d] = Math.max(th[d], along(dir, by.get(id)!));
  const vOf: number[] = [];
  let v = 0;
  th.forEach((t, d) => { vOf[d] = v + t / 2; v += t + gv; });
  const total = v - gv, span = x - gu, pos = new Map<string, P2>();
  for (const [id, d] of depth) pos.set(id, toPage(dir, u.get(id)! - span / 2, vOf[d] - total / 2));
  const routes = new Map<number, P2[]>();
  edges.forEach((e, k) => {
    const a = by.get(e.from)!, b = by.get(e.to)!;
    const wp = [e.from, e.to].map((id) => [u.get(id)! - span / 2, vOf[depth.get(id)!] - total / 2] as [number, number]);
    if (o.edges === 'elbow') { routes.set(k, elbow(dir, wp, a, b)); return; }
    const pts = wp.map((p) => toPage(dir, p[0], p[1]));
    routes.set(k, [clip(pts[0], a, pts[1]), clip(pts[1], b, pts[0])]);
  });
  return { pos, routes };
}

/* ------------------------------------------------------------------ force */

/**
 * Places a network with springs: linked boxes pull together, all boxes push apart. It starts from a ring in a fixed
 * order and runs a fixed number of steps, so the same graph always lands in the same place. The result is then spread
 * until no two boxes touch.
 */
export function force(boxes: Box2[], edges: Link2[], o: LayoutOpts): Placed {
  const n = boxes.length, idx = new Map(boxes.map((b, i) => [b.id, i])), rand = rng(o.seed);
  const gap = Math.min(o.gap[0], o.gap[1]);
  const p = boxes.map((_, i): P2 => { const a = (2 * Math.PI * i) / Math.max(1, n); return [Math.cos(a) * 2 + (rand() - 0.5) * 0.1, Math.sin(a) * 2 + (rand() - 0.5) * 0.1]; });
  const k = 1.4 + gap;
  let temp = k;
  for (let it = 0; it < 220; it++) {
    const f: P2[] = p.map(() => [0, 0]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = p[i][0] - p[j][0], dz = p[i][1] - p[j][1], d = Math.hypot(dx, dz);
      if (d < 1e-6) { dx = 0.01 * (i - j); dz = 0.01; d = Math.hypot(dx, dz); }
      const r = (k * k) / d;
      f[i][0] += (dx / d) * r; f[i][1] += (dz / d) * r; f[j][0] -= (dx / d) * r; f[j][1] -= (dz / d) * r;
    }
    for (const e of edges) {
      const i = idx.get(e.from)!, j = idx.get(e.to)!, dx = p[i][0] - p[j][0], dz = p[i][1] - p[j][1], d = Math.hypot(dx, dz) || 1e-6, a = (d * d) / k;
      f[i][0] -= (dx / d) * a; f[i][1] -= (dz / d) * a; f[j][0] += (dx / d) * a; f[j][1] += (dz / d) * a;
    }
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(f[i][0], f[i][1]) || 1e-6, s = Math.min(d, temp) / d;
      p[i][0] += f[i][0] * s; p[i][1] += f[i][1] * s;
    }
    temp *= 0.97;
  }
  // spread until every pair clears the other's box by the gap
  let s = 1;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = Math.abs(p[i][0] - p[j][0]), dz = Math.abs(p[i][1] - p[j][1]);
    const nx = (boxes[i].w + boxes[j].w) / 2 + gap, nz = (boxes[i].h + boxes[j].h) / 2 + gap;
    s = Math.max(s, Math.min(dx > 1e-9 ? nx / dx : Infinity, dz > 1e-9 ? nz / dz : Infinity));
  }
  if (!isFinite(s)) s = 1;
  const cx = p.reduce((t, q) => t + q[0], 0) / (n || 1), cz = p.reduce((t, q) => t + q[1], 0) / (n || 1);
  const pos = new Map<string, P2>(boxes.map((b, i) => [b.id, [(p[i][0] - cx) * s, (p[i][1] - cz) * s] as P2]));
  const routes = new Map<number, P2[]>();
  edges.forEach((e, k2) => {
    const a = pos.get(e.from)!, b = pos.get(e.to)!;
    routes.set(k2, [clip(a, boxes[idx.get(e.from)!], b), clip(b, boxes[idx.get(e.to)!], a)]);
  });
  return { pos, routes };
}
