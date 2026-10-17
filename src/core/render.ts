import type { Camera } from './camera.ts';
import { add, clamp, dot, mul, newell, norm, sub, type V2, type V3 } from './math.ts';
import type { Prim } from './nodes.ts';
import { order, type SortItem } from './sort.ts';
import { splitPierced, type SplitItem } from './split.ts';

/** A framing: scale `s` and offset `tx`, `ty` that map projected points to pixels. */
export interface Fit { s: number; tx: number; ty: number }
/** A box on the screen, before fitting. */
export interface Bounds { x0: number; y0: number; x1: number; y1: number }
/** The part of the canvas a scene is drawn into. */
export interface Region { x: number; y: number; w: number; h: number }
/** One drawn primitive: its `key` keeps it matched between frames, `html` is its SVG. */
export interface Item { key: string; html: string }

/** What `buildFrame` needs besides the primitives and the camera. */
export interface RenderOpts {
  size: [number, number];
  padding: number;
  fit: 'auto' | 'sphere' | Fit;
  /** with fit 'sphere': use this sphere instead of measuring the scene each frame (see `lockSphere`) */
  sphere?: Sphere;
  region?: Region;
  light: V3;
  /** a hand-drawn look: lines wobble a little and are drawn twice */
  sketch?: { amp: number; seed: number };
  /** cut faces that pierce each other before sorting */
  split?: boolean;
}

/** One rendered picture: SVG items from back to front, with the framing they were drawn with. */
export interface Frame {
  items: Item[];
  fit: Fit;
  size: [number, number];
  /** groups of faces that overlap in a ring and cannot be ordered exactly */
  cycles: number;
  /** false when the scene was too large for exact ordering and fell back to depth */
  exact: boolean;
}

/* numbers in the SVG are rounded: one decimal for positions, four for scales and opacities */
const n1 = (n: number) => (Math.round(n * 10) / 10).toString();
const n4 = (n: number) => (Math.round(n * 10000) / 10000).toString();
/** Escapes text for use in SVG content and attributes. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The framing that centres `b` in the region and scales it to fill what is left after `padding`. */
export function fitOf(b: Bounds, size: [number, number], padding: number, region?: Region): Fit {
  const r = region ?? { x: 0, y: 0, w: size[0], h: size[1] };
  const bw = b.x1 - b.x0 || 1, bh = b.y1 - b.y0 || 1;
  const s = Math.min((r.w - 2 * padding) / bw, (r.h - 2 * padding) / bh);
  return { s, tx: r.x + r.w / 2 - (s * (b.x0 + b.x1)) / 2, ty: r.y + r.h / 2 - (s * (b.y0 + b.y1)) / 2 };
}

/** A sphere in world space: a centre `c` and a radius `r`. */
export interface Sphere {
  /** the centre */
  c: V3;
  /** the radius */
  r: number;
}

/** The box around every point that counts for framing (not `noFit` primitives or the ground), or null if there are none. It does not depend on the camera angle. */
export function worldBox(prims: Prim[]): { lo: V3; hi: V3 } | null {
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  let any = false;
  for (const p of prims) {
    if (p.noFit || p.kind === 'ground') continue;
    for (const q of p.pts) { any = true; for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } }
  }
  return any ? { lo, hi } : null;
}

/** The bounding sphere of the drawable nodes, used by `fit: 'sphere'`. Its centre is the middle of the box around the points, so it does not change with the camera angle. */
export function sphereOf(prims: Prim[]): Sphere | null {
  const box = worldBox(prims);
  if (!box) return null;
  const c: V3 = [(box.lo[0] + box.hi[0]) / 2, (box.lo[1] + box.hi[1]) / 2, (box.lo[2] + box.hi[2]) / 2];
  let r = 0;
  for (const p of prims) {
    if (p.noFit || p.kind === 'ground') continue;
    for (const q of p.pts) r = Math.max(r, Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]));
  }
  return { c, r };
}

/**
 * Frames the bounding sphere, so the object keeps its size on screen however the camera turns.
 * Returns null when there is nothing to frame, or when a perspective camera is inside the sphere.
 */
export function sphereFit(s: Sphere | null, cam: Camera, size: [number, number], padding: number, region?: Region): Fit | null {
  if (!s) return null;
  const q = cam.project(s.c);
  let rad = s.r;
  if (cam.kind === 'persp') {
    if (q[2] <= s.r * 1.02) return null;
    rad = s.r * cam.scaleAt(Math.sqrt(q[2] * q[2] - s.r * s.r));
  }
  const r = region ?? { x: 0, y: 0, w: size[0], h: size[1] };
  const k = Math.min(r.w - 2 * padding, r.h - 2 * padding) / (2 * (rad || 1));
  return { s: k, tx: r.x + r.w / 2 - k * q[0], ty: r.y + r.h / 2 - k * q[1] };
}

/** Magnifies a framing about the middle of the region it fills. */
export function zoomFit(f: Fit, z: number, size: [number, number], region?: Region): Fit {
  if (z === 1) return f;
  const cx = region ? region.x + region.w / 2 : size[0] / 2, cy = region ? region.y + region.h / 2 : size[1] / 2;
  return { s: f.s * z, tx: cx + (f.tx - cx) * z, ty: cy + (f.ty - cy) * z };
}

/** The box around two boxes; either may be null. */
export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/** A primitive after projection: screen points, mean depth, normal and screen box, plus its order of arrival as a tie-break. */
interface Proj { prim: Prim; sp: V3[]; depth: number; normal?: V3; box: [number, number, number, number]; ord: number;
  /** for a piece of a split face: which edges (point i to i+1) lie on the original outline, the others are cuts and get no stroke */
  real?: boolean[] }

/** Projects every primitive the camera can see and drops back faces of culled ones. The ground is always kept. */
function visibleProjs(prims: Prim[], cam: Camera): Proj[] {
  const out: Proj[] = [];
  for (const [ord, prim] of prims.entries()) {
    if (prim.kind === 'ground') {
      out.push({ prim, sp: [], depth: 1e9, box: [-1e9, -1e9, 1e9, 1e9], ord });
      continue;
    }
    if (prim.pts.some((p) => !cam.visible(p))) continue;
    let normal = prim.normal ? norm(prim.normal) : prim.face && prim.pts.length >= 3 ? newell(prim.pts) : undefined;
    if (prim.cull && normal && cam.eyeSide(prim.pts[0], normal) <= 1e-6) continue;
    if (prim.kind === 'plane' && !normal) normal = newell(prim.pts);
    const sp = prim.pts.map((p) => cam.project(p));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, d = 0;
    for (const q of sp) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); d += q[2]; }
    out.push({ prim, sp, depth: d / (sp.length || 1), normal, box: [x0, y0, x1, y1], ord });
  }
  return out;
}

/** the box around the projected points of everything that counts for framing */
function boundsOfProjs(projs: Proj[]): Bounds | null {
  let b: Bounds | null = null;
  for (const p of projs) {
    if (p.prim.noFit) continue;
    for (const q of p.sp) b = unionBounds(b, { x0: q[0], y0: q[1], x1: q[0], y1: q[1] });
  }
  return b;
}

/** The screen box around the visible primitives, before any fitting. Null when nothing is visible. */
export function boundsOf(prims: Prim[], cam: Camera): Bounds | null {
  return boundsOfProjs(visibleProjs(prims, cam));
}

/** What the sort needs to know about one projection. */
function sortItemOf(p: Proj): SortItem {
  return {
    pts: p.prim.pts, normal: p.normal, depth: p.depth, box: p.box, layer: p.prim.layer, group: p.prim.group,
    shape: p.prim.kind === 'ground' ? 'any' : p.prim.kind === 'dot' || p.prim.kind === 'text' ? 'point' : p.prim.kind === 'plane' || (p.prim.face && p.sp.length >= 3) ? 'poly' : 'line',
    sp: p.sp.map((q): [number, number] => [q[0], q[1]]),
  };
}

/**
 * Replaces each face that pierces another flat item by its pieces on either side of the cut.
 * A piece is the same primitive with fewer points and the key `<key>~a`, `~b`, ... (same normal, so same
 * shade; same order of arrival). Scenes where nothing pierces come back unchanged.
 */
function splitFaces(projs: Proj[], cam: Camera): Proj[] {
  const items: SplitItem[] = projs.map((p) => ({ ...sortItemOf(p), victim: p.prim.kind === 'path' && !!p.prim.face && p.sp.length >= 3 && !!p.normal }));
  const cuts = splitPierced(items);
  if (!cuts.some(Boolean)) return projs;
  return projs.flatMap((pr, i) => {
    const frags = cuts[i];
    if (!frags) return [pr];
    return frags.map((f): Proj => {
      const sp = f.pts.map((q) => cam.project(q));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, d = 0;
      for (const q of sp) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); d += q[2]; }
      return { ...pr, prim: { ...pr.prim, key: `${pr.prim.key}~${f.suffix}`, pts: f.pts, closed: true }, real: f.real, sp, depth: d / sp.length, box: [x0, y0, x1, y1] };
    });
  });
}

/** Turns primitives into one frame: project, frame, sort back to front, then write each as SVG. */
export function buildFrame(prims: Prim[], cam: Camera, o: RenderOpts): Frame {
  const visible = visibleProjs(prims, cam);
  let fit: Fit | null = null;
  if (o.fit === 'sphere') fit = sphereFit(o.sphere ?? sphereOf(prims), cam, o.size, o.padding, o.region);
  if (!fit && (o.fit === 'auto' || o.fit === 'sphere')) {
    const b = boundsOfProjs(visible);
    fit = b ? fitOf(b, o.size, o.padding, o.region) : { s: 1, tx: o.size[0] / 2, ty: o.size[1] / 2 };
  } else if (!fit) fit = o.fit as Fit;
  fit = zoomFit(fit!, cam.zoom, o.size, o.region);

  const projs = o.split ? splitFaces(visible, cam) : visible;

  const sortItems: SortItem[] = projs.map(sortItemOf);
  const { order: ord, cycles, exact } = order(sortItems, cam);

  const T = (p: V3): V2 => { const q = cam.project(p); return [q[0] * fit.s + fit.tx, q[1] * fit.s + fit.ty]; };
  const light = norm(o.light);
  const items: Item[] = [];
  for (const i of ord) {
    const html = emit(projs[i], fit, T, cam, light, o.size, o.sketch);
    if (html) items.push({ key: projs[i].prim.key, html });
  }
  return { items, fit, size: o.size, cycles, exact };
}

const pathD = (q: V2[], closed?: boolean) => `M${q.map(([x, y]) => `${n1(x)} ${n1(y)}`).join('L')}${closed ? 'Z' : ''}`;

/** a cheap repeatable noise in -1..1 */
const noise = (a: number, b: number, c: number) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (((h ^ (h >>> 16)) >>> 0) % 20001) / 10000 - 1; };

/** points along the line, nudged sideways a little, so the same drawing always wobbles the same way */
function rough(q: V2[], closed: boolean | undefined, amp: number, seed: number): V2[] {
  const pts = closed ? [...q, q[0]] : q, out: V2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0) || 1, n = Math.max(1, Math.min(10, Math.round(len / 14)));
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    for (let k = 0; k < n; k++) {
      const t = k / n, j = noise(seed, i, k) * amp, along = noise(seed + 1, i, k) * amp * 0.5;
      out.push([x0 + (x1 - x0) * t + nx * j + ((x1 - x0) / len) * along, y0 + (y1 - y0) * t + ny * j + ((y1 - y0) / len) * along]);
    }
  }
  const last = pts[pts.length - 1];
  if (!closed) out.push([last[0] + noise(seed, pts.length, 0) * amp * 0.6, last[1] + noise(seed, pts.length, 1) * amp * 0.6]);
  return out;
}

/** The SVG of one dot, text, path or face. Ground and planes have their own writers. */
function emit(pr: Proj, fit: Fit, T: (p: V3) => V2, cam: Camera, light: V3, size: [number, number], sketch?: { amp: number; seed: number }): string {
  const p = pr.prim;
  const q = pr.sp.map((s): V2 => [s[0] * fit.s + fit.tx, s[1] * fit.s + fit.ty]);
  const op = p.opacity < 1 ? `opacity:${n4(Math.max(0, p.opacity))}` : '';

  if (p.kind === 'dot') return `<circle class="cn-dot cn-r-${p.role}"${op ? ` style="${op}"` : ''} cx="${n1(q[0][0])}" cy="${n1(q[0][1])}" r="${n1(p.r ?? 2.6)}"/>`;

  if (p.kind === 'text') {
    const st = [op, p.size ? `font-size:${p.size}px` : ''].filter(Boolean).join(';');
    return `<text class="cn-t cn-r-${p.role}"${st ? ` style="${st}"` : ''} x="${n1(q[0][0] + (p.dx ?? 0))}" y="${n1(q[0][1] + (p.dy ?? 0))}" text-anchor="${p.anchor ?? 'start'}">${esc(p.text ?? '')}</text>`;
  }

  if (p.kind === 'ground') return emitGround(p, fit, T, cam, size);
  if (p.kind === 'plane') return emitPlane(pr, T, cam, op);

  // paths and faces
  const styles: string[] = [];
  if (op) styles.push(op);
  if (p.width) styles.push(`stroke-width:${p.width}`);
  let cls = `sz cn-r-${p.role}`;
  let extra = '';
  // a piece of a split face: its fill is drawn without outline, the outline is drawn apart from the real edges only
  const cuts = !!(p.face && pr.real && pr.real.some((r) => !r) && (p.draw ?? 1) > 0);
  if (p.face) {
    cls += ' cn-f';
    let k = 1;
    if (p.shade && pr.normal) {
      let n = pr.normal;
      if (cam.eyeSide(p.pts[0], n) < 0) n = mul(n, -1);
      k = 0.62 + 0.76 * Math.max(0, dot(n, light));
    }
    const pct = n1(clamp((p.fill ?? 0.14) * k, 0, 1) * 100);
    const base = p.mix !== undefined ? `color-mix(in oklab,var(--c),var(--c-accent) ${n1(clamp(p.mix) * 100)}%)` : 'var(--c)';
    styles.push(`fill:color-mix(in oklab,${base} ${pct}%,var(--c-bg))`);
    if (p.alpha !== undefined && p.alpha < 1) styles.push(`fill-opacity:${n4(p.alpha)}`);
    if ((p.draw ?? 1) <= 0 || cuts) styles.push('stroke:none');
  } else {
    const d = p.draw ?? 1;
    if (d < 1) { extra = ' pathLength="1"'; styles.push('stroke-dasharray:1', `stroke-dashoffset:${n4(1 - d)}`); }
    else if (p.flow) {
      const dash = p.dash ?? '3 3', period = dash.split(/[\s,]+/).map(Number).reduce((a, b) => a + b, 0) * (dash.split(/[\s,]+/).length % 2 ? 2 : 1);
      cls += ' cn-flow';
      styles.push(`stroke-dasharray:${dash}`, `--cn-flow-p:${n4(period)}`, `--cn-flow-t:${n4(1 / p.flow)}s`);
    } else if (p.dash) styles.push(`stroke-dasharray:${p.dash}`);
  }
  const sk = sketch && p.kind === 'path' && q.length >= 2 ? sketch : undefined, sd = sk ? Math.imul(pr.ord + 1, 2654435761) ^ sk.seed : 0;
  let html = `<path class="${cls}"${styles.length ? ` style="${styles.join(';')}"` : ''}${extra} d="${pathD(sk ? rough(q, p.closed, sk.amp, sd) : q, p.closed)}"/>`;
  if (cuts) {
    let d = '';
    const m = q.length, k = pr.real!.findIndex((r) => !r); // start after a cut edge, so no run of real edges wraps round
    for (let t = 1; t <= m; t++) {
      const i = (k + t) % m;
      if (!pr.real![i]) continue;
      const a = q[i], b = q[(i + 1) % m];
      d += pr.real![(i + m - 1) % m] ? `L${n1(b[0])} ${n1(b[1])}` : `M${n1(a[0])} ${n1(a[1])}L${n1(b[0])} ${n1(b[1])}`;
    }
    html += `<path class="sz cn-f cn-r-${p.role}"${[op, p.width ? `stroke-width:${p.width}` : ''].filter(Boolean).length ? ` style="${[op, p.width ? `stroke-width:${p.width}` : ''].filter(Boolean).join(';')}"` : ''} d="${d}"/>`;
  }
  // drawn twice, like a pen going over a line
  if (sk && (p.draw ?? 1) >= 1 && !p.flow) html += `<path class="sz cn-r-${p.role}" style="${[p.width ? `stroke-width:${p.width}` : '', `opacity:${n4(p.opacity * 0.55)}`].filter(Boolean).join(';')}" d="${pathD(rough(q, p.closed, sk.amp * 1.1, sd + 977), p.closed)}"/>`;

  if (p.arrow && (p.draw ?? 1) > 0.98 && q.length >= 2) {
    const head = (tip: V2, from: V2) => {
      const dx = tip[0] - from[0], dy = tip[1] - from[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const bx = tip[0] - ux * 5.5, by = tip[1] - uy * 5.5;
      return `<path class="cn-head cn-r-${p.role}"${op ? ` style="${op}"` : ''} d="M${n1(tip[0])} ${n1(tip[1])}L${n1(bx - uy * 2.5)} ${n1(by + ux * 2.5)}L${n1(bx + uy * 2.5)} ${n1(by - ux * 2.5)}Z"/>`;
    };
    if (p.arrow !== 'start') html += head(q[q.length - 1], q[q.length - 2]);
    if (p.arrow !== 'end') html += head(q[0], q[1]);
  }
  return html;
}

/** The ground grid: a tiled pattern under an orthographic camera, drawn lines under a perspective one. */
function emitGround(p: Prim, fit: Fit, T: (p: V3) => V2, cam: Camera, size: [number, number]): string {
  const g = p.ground ?? {};
  const O = T([0, 0, 0]);
  if (cam.kind === 'ortho' && !g.extent) {
    const X = T([1, 0, 0]), Y = T([0, 1, 0]);
    const px = (Math.hypot(X[0] - O[0], X[1] - O[1]) + Math.hypot(Y[0] - O[0], Y[1] - O[1])) / 2; // pixels per world unit
    const st = g.step ?? [0.25, 0.5, 1, 2, 4, 8].reduce((a, b) => (Math.abs(Math.log((b * px) / 16)) < Math.abs(Math.log((a * px) / 16)) ? b : a));
    const m = [(X[0] - O[0]) * st, (X[1] - O[1]) * st, (Y[0] - O[0]) * st, (Y[1] - O[1]) * st, O[0], O[1]].map(n4).join(' ');
    const w = n4(2 / (px * st)); // lines sit on tile edges, so they are drawn double width to survive tile clipping
    const id = `szg-${p.key}`;
    const op = p.opacity < 1 ? ` style="opacity:${n4(p.opacity)}"` : '';
    return `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="1" height="1" patternTransform="matrix(${m})"><path class="cn-gl" style="stroke-width:calc(${w} * var(--cn-k,1))" d="M0 0H1M0 0V1"/></pattern></defs><rect${op} x="0" y="0" width="${size[0]}" height="${size[1]}" fill="url(#${id})"/>`;
  }
  const ext = g.extent ?? 10, st = g.step ?? 1;
  let d = '';
  for (let v = -ext; v <= ext + 1e-6; v += st) {
    for (const [a, b] of [[[v, -ext, 0], [v, ext, 0]], [[-ext, v, 0], [ext, v, 0]]] as [V3, V3][]) {
      if (!cam.visible(a) || !cam.visible(b)) continue;
      const qa = T(a), qb = T(b);
      d += `M${n1(qa[0])} ${n1(qa[1])}L${n1(qb[0])} ${n1(qb[1])}`;
    }
  }
  return `<path class="cn-gl cn-gl-line" d="${d}"/>`;
}

/** An SVG laid on a plane: one matrix under an orthographic camera, many small pieces under a perspective one. */
function emitPlane(pr: Proj, T: (p: V3) => V2, cam: Camera, op: string): string {
  const p = pr.prim, pl = p.plane!;
  const [bx, by, bw, bh] = pl.svg.box;
  const O = p.pts[0], U = sub(p.pts[1], O), V = sub(p.pts[3], O);
  const P = (x: number, y: number): V3 => add(add(O, mul(U, (x - bx) / bw)), mul(V, 1 - (y - by) / bh));
  const matrix = (x0: number, y0: number, cw: number, ch: number) => {
    const q0 = T(P(x0, y0)), qx = T(P(x0 + cw, y0)), qy = T(P(x0, y0 + ch));
    const a = (qx[0] - q0[0]) / cw, b = (qx[1] - q0[1]) / cw, c = (qy[0] - q0[0]) / ch, d = (qy[1] - q0[1]) / ch;
    return [a, b, c, d, q0[0] - a * x0 - c * y0, q0[1] - b * x0 - d * y0].map(n4).join(' ');
  };
  const st = `color:var(--c-ink)${op ? `;${op}` : ''}`;
  if (cam.kind === 'ortho') {
    return `<g style="${st}" transform="matrix(${matrix(bx, by, bw, bh)})">${pl.svg.inner}</g>`;
  }
  // Perspective: an SVG can only shear, so approximate the foreshortening with small pieces.
  const n = Math.max(1, Math.round(pl.cells)), cw = bw / n, ch = bh / n, pad = Math.min(cw, ch) * 0.02;
  const id = `szp-${pl.id}`;
  let clips = '', cells = '';
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x0 = bx + i * cw, y0 = by + j * ch;
      clips += `<clipPath id="${id}-${i}-${j}"><rect x="${n4(x0 - pad)}" y="${n4(y0 - pad)}" width="${n4(cw + 2 * pad)}" height="${n4(ch + 2 * pad)}"/></clipPath>`;
      cells += `<g clip-path="url(#${id}-${i}-${j})" transform="matrix(${matrix(x0, y0, cw, ch)})"><use href="#${id}"/></g>`;
    }
  }
  return `<g style="${st}"><defs><g id="${id}">${pl.svg.inner}</g>${clips}</defs>${cells}</g>`;
}
