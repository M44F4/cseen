import { SvgPlane, colourOf, esc, clamp, r1, niceTicks, easeOut, hashId, INK, FAINT, GRID, BG, type SvgPlaneOpts } from '../draw/svgplane.ts';

/* Mathematical figures drawn on a plane: a graph with a tangent and a Riemann sum, matrices and their product,
   the plane deforming under a matrix, a vector field, a number line, the unit circle. Each takes its numbers
   from props, so a timeline can move them. Colours are the theme's. */

/** a number for a label: at most `d` decimals, no trailing zeros, and a plain 0 for values too small to see */
const num = (v: number, d = 2) => (Math.abs(v) < 1e-9 ? '0' : `${+v.toFixed(d)}`);
/** a number with a real minus sign (−) rather than a hyphen */
const fmtSigned = (v: number) => (v < 0 ? `−${num(-v)}` : num(v));
/** a filled triangle with its tip at (x, y), pointing along (dx, dy) */
const arrowHead = (x: number, y: number, dx: number, dy: number, size: number, fill: string) => {
  const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, bx = x - ux * size, by = y - uy * size;
  return `<path d="M${r1(x)} ${r1(y)}L${r1(bx - uy * size * 0.45)} ${r1(by + ux * size * 0.45)}L${r1(bx + uy * size * 0.45)} ${r1(by - ux * size * 0.45)}Z" fill="${fill}"/>`;
};
/** an arrow from (x0, y0) to (x1, y1). Nothing is drawn below one svg unit, where the head would be bigger than the arrow. */
const vec = (x0: number, y0: number, x1: number, y1: number, colour: string, w = 2.2, head = 7) => {
  const l = Math.hypot(x1 - x0, y1 - y0);
  if (l < 1) return '';
  const k = Math.min(1, (l - head * 0.6) / l);
  return `<path d="M${r1(x0)} ${r1(y0)}L${r1(x0 + (x1 - x0) * k)} ${r1(y0 + (y1 - y0) * k)}" stroke="${colour}" stroke-width="${w}" stroke-linecap="round" fill="none"/>${arrowHead(x1, y1, x1 - x0, y1 - y0, head, colour)}`;
};

/* ------------------------------------------------------------------ graph */

/** Options of `graph`. */
export interface GraphOpts extends SvgPlaneOpts {
  /** the function (default sin) */
  fn?: (x: number) => number;
  /** several functions by name, each in its own series colour */
  fns?: Record<string, (x: number) => number>;
  /** the x range (default -3 to 3) */
  x?: [number, number];
  /** the y range, `[min, max]` (default: fitted to the function) */
  y?: [number, number];
  /** draw the axes */
  axes?: boolean;
  /** draw the grid */
  grid?: boolean;
  /** draw the tangent at the point `x` (a property: animate it to slide the point along) */
  tangent?: boolean;
  /** shade the area under the curve between the properties `a` and `b` */
  area?: [number, number];
  /** Riemann rectangles over [a, b]: `n` of them, with the rule picking the height. `n` is a property. */
  riemann?: { n?: number; rule?: 'left' | 'right' | 'mid' };
  /** mark the point at `x` */
  point?: boolean;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/**
 * A function plotted on axes. Properties: `x` (the point and its tangent), `a` and `b` (the shaded area),
 * `n` (the number of Riemann rectangles, which can grow toward the exact area) and `grow` (draws the curve in).
 */
export class Graph extends SvgPlane {
  declare o: GraphOpts;
  constructor(o: GraphOpts = {}) {
    super(o, [4, 2.8]);
    const [x0, x1] = o.x ?? [-3, 3];
    this.props.x = x0 + (x1 - x0) * 0.35;
    this.props.a = o.area?.[0] ?? x0;
    this.props.b = o.area?.[1] ?? x1;
    this.props.n = o.riemann?.n ?? 8;
    this.props.grow = 1;
  }
  /** the functions to draw by name; the first one is the one the tangent, area and Riemann sums use */
  private functions(): [string, (x: number) => number][] {
    const named = Object.entries(this.o.fns ?? {});
    return named.length ? named : [['f', this.o.fn ?? ((x: number) => Math.sin(x))]];
  }
  /** the area under the first function between a and b, to within a rounding error */
  integral(a = this.props.a as number, b = this.props.b as number): number {
    const f = this.functions()[0][1], n = 400, h = (b - a) / n;
    let s = (f(a) + f(b)) / 2;
    for (let i = 1; i < n; i++) s += f(a + i * h);
    return s * h;
  }
  /** the slope of the first function at x */
  slope(x = this.props.x as number): number {
    const f = this.functions()[0][1], h = 1e-4;
    return (f(x + h) - f(x - h)) / (2 * h);
  }
  draw(W: number, H: number): string {
    const o = this.o, fns = this.functions(), [x0, x1] = o.x ?? [-3, 3], grow = clamp(this.props.grow as number);
    const fs = Math.max(6, Math.min(W, H) * 0.045), pad = fs * 1.2;
    const samples = fns.map(([, f]) => Array.from({ length: 241 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / 240; return [x, f(x)] as [number, number]; }));
    const finite = samples.flat().map((p) => p[1]).filter(Number.isFinite);
    // a function that is never finite has no range to fit
    let [y0, y1] = o.y ?? (finite.length ? [Math.min(...finite), Math.max(...finite)] : [-1, 1]);
    if (!o.y) { const m = (y1 - y0 || 1) * 0.12; y0 -= m; y1 += m; }
    const L = pad + fs * 1.6, R = W - pad, T = pad, B = H - pad - fs * 0.6;
    const X = (x: number) => L + ((x - x0) / (x1 - x0)) * (R - L), Y = (y: number) => B - ((y - y0) / (y1 - y0 || 1)) * (B - T);
    let s = '';
    if (o.axes !== false) {
      const xt = niceTicks(x0, x1, 7), yt = niceTicks(y0, y1, 5);
      for (const v of xt) if (v >= x0 - 1e-9 && v <= x1 + 1e-9) { if (o.grid !== false) s += `<line x1="${r1(X(v))}" y1="${T}" x2="${r1(X(v))}" y2="${B}" stroke="${GRID}" stroke-width="0.7"/>`; s += `<text x="${r1(X(v))}" y="${r1(B + fs * 1.2)}" text-anchor="middle" font-size="${fs * 0.85}" fill="${FAINT}">${num(v)}</text>`; }
      for (const v of yt) if (v >= y0 - 1e-9 && v <= y1 + 1e-9) { if (o.grid !== false) s += `<line x1="${L}" y1="${r1(Y(v))}" x2="${R}" y2="${r1(Y(v))}" stroke="${GRID}" stroke-width="0.7"/>`; s += `<text x="${L - fs * 0.5}" y="${r1(Y(v) + fs * 0.3)}" text-anchor="end" font-size="${fs * 0.85}" fill="${FAINT}">${num(v)}</text>`; }
      const ax = Y(0), ay = X(0);
      if (ax > T && ax < B) s += `<line x1="${L}" y1="${r1(ax)}" x2="${R}" y2="${r1(ax)}" stroke="${INK}" stroke-opacity=".6" stroke-width="1.2"/>`;
      if (ay > L && ay < R) s += `<line x1="${r1(ay)}" y1="${T}" x2="${r1(ay)}" y2="${B}" stroke="${INK}" stroke-opacity=".6" stroke-width="1.2"/>`;
    }
    const f = fns[0][1], a = this.props.a as number, b = this.props.b as number, px = this.props.x as number;
    const base = clamp(0, y0, y1), clip = `szg${Math.abs(hashId(this.id))}`;
    s += `<clipPath id="${clip}"><rect x="${L}" y="${T}" width="${r1(R - L)}" height="${r1(B - T)}"/></clipPath><g clip-path="url(#${clip})">`;
    // the area, and Riemann rectangles
    if (o.area && !o.riemann) {
      const pts = samples[0].filter(([x, y]) => Number.isFinite(y) && x >= Math.min(a, b) && x <= Math.max(a, b));
      if (pts.length > 1) s += `<path d="M${r1(X(pts[0][0]))} ${r1(Y(base))}${pts.map(([x, y]) => `L${r1(X(x))} ${r1(Y(clamp(y, y0, y1)))}`).join('')}L${r1(X(pts[pts.length - 1][0]))} ${r1(Y(base))}Z" fill="${colourOf(o.role ?? 'accent')}" fill-opacity="0.22"/>`;
    }
    if (o.riemann) {
      const n = Math.max(1, Math.round(this.props.n as number)), rule = o.riemann.rule ?? 'left', dx = (b - a) / n;
      let total = 0;
      for (let i = 0; i < n; i++) {
        const xl = a + i * dx, h = f(rule === 'left' ? xl : rule === 'right' ? xl + dx : xl + dx / 2);
        total += h * dx;
        s += `<rect x="${r1(X(xl))}" y="${r1(Math.min(Y(h), Y(base)))}" width="${r1(Math.max(0.5, X(xl + dx) - X(xl)))}" height="${r1(Math.abs(Y(h) - Y(base)))}" fill="${colourOf(o.role ?? 'accent')}" fill-opacity="0.28" stroke="${colourOf(o.role ?? 'accent')}" stroke-opacity="0.7" stroke-width="0.8"/>`;
      }
      s += `<text x="${R}" y="${T + fs}" text-anchor="end" font-size="${fs}" fill="${INK}">n = ${n}   Σ ≈ ${num(total, 3)}</text>`;
    }
    // the curves
    fns.forEach(([name], i) => {
      const colour = i === 0 ? 'var(--c-ink)' : `var(--c-s${((i - 1) % 8) + 1})`, drawn = Math.max(2, Math.round(samples[i].filter((p) => Number.isFinite(p[1])).length * easeOut(grow)));
      // where the function is not a number (1/x at 0, log below 0) the stroke ends and a new one starts after the gap; `drawn` counts only real points, so the draw-on keeps its pace
      let d = '', k = 0, gap = true;
      for (const [x, y] of samples[i]) {
        if (!Number.isFinite(y)) { gap = true; continue; }
        if (k++ >= drawn) break;
        d += `${gap ? 'M' : 'L'}${r1(X(x))} ${r1(Y(clamp(y, y0 - (y1 - y0), y1 + (y1 - y0))))}`;
        gap = false;
      }
      s += `<path d="${d}" fill="none" stroke="${colour}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (fns.length > 1) s += `<text x="${R}" y="${T + fs * (i + 1.2)}" text-anchor="end" font-size="${fs}" fill="${colour}">${esc(name)}</text>`;
    });
    // the point and its tangent
    if (o.tangent || o.point) {
      const y = f(px), accent = colourOf(o.role ?? 'accent');
      if (o.tangent) {
        const m = this.slope(px), span = (x1 - x0) * 0.22, ta = px - span, tb = px + span;
        s += `<path d="M${r1(X(ta))} ${r1(Y(y + m * (ta - px)))}L${r1(X(tb))} ${r1(Y(y + m * (tb - px)))}" stroke="${accent}" stroke-width="1.8" stroke-linecap="round"/>`;
        s += `<text x="${L + fs * 0.4}" y="${T + fs}" font-size="${fs}" fill="${accent}">slope ${fmtSigned(m)}</text>`;
      }
      s += `<line x1="${r1(X(px))}" y1="${r1(Y(y))}" x2="${r1(X(px))}" y2="${r1(Y(base))}" stroke="${accent}" stroke-opacity=".5" stroke-dasharray="3 3"/><circle cx="${r1(X(px))}" cy="${r1(Y(y))}" r="4" fill="${accent}" stroke="${BG}" stroke-width="1.2"/>`;
    }
    return s + '</g>';
  }
}
/**
 * A function plotted on axes, with an optional tangent, shaded area and Riemann rectangles.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
 * s.add(graph({ fn: (x) => Math.sin(x) + 0.3 * x, x: [-4, 4], tangent: true, size: [4.4, 2.8] }));
 */
export const graph = (o: GraphOpts = {}) => new Graph(o);

/* ------------------------------------------------------------------ matrices */

/** A matrix as rows of numbers. */
export type Mat = number[][];

/** Options of `matrix`. */
export interface MatrixOpts extends SvgPlaneOpts {
  /** the rows of numbers */
  values: Mat;
  /** a row to highlight, -1 for none. Animatable, together with `col`. */
  row?: number;
  /** a column to highlight, -1 for none. Animatable. */
  col?: number;
  /** how to print a number */
  format?: (v: number) => string;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
  /** a name shown to the left, such as A */
  name?: string;
}

/** one square bracket of a matrix, at x, with its arms reaching `w` toward the numbers */
const bracket = (x: number, y0: number, y1: number, dir: 1 | -1, w: number) => `<path d="M${r1(x + dir * w)} ${r1(y0)}L${r1(x)} ${r1(y0)}L${r1(x)} ${r1(y1)}L${r1(x + dir * w)} ${r1(y1)}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;

/** The drawing of one matrix, with optional highlights, at a given place. Shared by `matrix` and `product`. */
function drawMatrix(m: Mat, x: number, y: number, cell: number, fs: number, o: { row?: number; col?: number; fmt: (v: number) => string; role: string; filled?: (i: number, j: number) => boolean }): string {
  const r = m.length, c = m[0]?.length ?? 0, w = c * cell, h = r * cell, accent = colourOf(o.role);
  let s = '';
  for (let i = 0; i < r; i++) {
    if (o.row === i) s += `<rect x="${r1(x - 4)}" y="${r1(y + i * cell + 2)}" width="${r1(w + 8)}" height="${r1(cell - 4)}" rx="4" fill="${accent}" fill-opacity=".2"/>`;
  }
  for (let j = 0; j < c; j++) if (o.col === j) s += `<rect x="${r1(x + j * cell + 2)}" y="${r1(y - 4)}" width="${r1(cell - 4)}" height="${r1(h + 8)}" rx="4" fill="${accent}" fill-opacity=".2"/>`;
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) {
    if (o.filled && !o.filled(i, j)) continue;
    const hot = o.row === i || o.col === j;
    s += `<text x="${r1(x + (j + 0.5) * cell)}" y="${r1(y + (i + 0.5) * cell + fs * 0.34)}" text-anchor="middle" font-size="${fs}" font-weight="${hot ? 700 : 400}" fill="${hot ? accent : INK}">${esc(o.fmt(m[i][j]))}</text>`;
  }
  return s + bracket(x - 6, y, y + h, 1, 7) + bracket(x + w + 6, y, y + h, -1, 7);
}

/** A matrix with brackets. The `row` and `col` properties move a highlight, so a timeline can walk across it. */
export class Matrix extends SvgPlane {
  declare o: MatrixOpts;
  constructor(o: MatrixOpts) {
    super(o, [Math.max(1, (o.values[0]?.length ?? 0) * 0.55 + 0.6), Math.max(0.8, o.values.length * 0.5 + 0.4)]);
    this.props.row = o.row ?? -1;
    this.props.col = o.col ?? -1;
  }
  draw(W: number, H: number): string {
    const m = this.o.values, r = m.length, c = m[0]?.length ?? 0, lead = this.o.name ? 34 : 0, cell = Math.min((W - 24 - lead) / c, (H - 12) / r), fs = cell * 0.42;
    const x = lead + (W - lead - c * cell) / 2, y = (H - r * cell) / 2, fmt = this.o.format ?? ((v: number) => fmtSigned(v));
    return (this.o.name ? `<text x="${r1(x - 16)}" y="${r1(H / 2 + fs * 0.34)}" text-anchor="end" font-size="${fs * 1.1}" font-style="italic" fill="${INK}">${esc(this.o.name)} =</text>` : '') +
      drawMatrix(m, x, y, cell, fs, { row: Math.round(this.props.row as number), col: Math.round(this.props.col as number), fmt, role: this.o.role ?? 'accent' });
  }
}
/**
 * A matrix with brackets. `row` and `col` highlight a line or a cell.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [300, 200], padding: 6 });
 * s.add(matrix([[1, 2], [3, 4]], { size: [2, 1.6] }));
 */
export const matrix = (values: Mat, o: Omit<MatrixOpts, 'values'> = {}) => new Matrix({ ...o, values });

/** Options of `product`. */
export interface ProductOpts extends SvgPlaneOpts {
  /** the left matrix */
  a: Mat;
  /** the right matrix */
  b: Mat;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
  /** how to print a number */
  format?: (v: number) => string;
}

/**
 * A times B, one entry at a time. `step` counts the entries of the result, from 0 to rows times columns:
 * at each one, the matching row of A and column of B light up, the sum is written below, and the entry appears.
 */
export class Product extends SvgPlane {
  declare o: ProductOpts;
  c: Mat;
  constructor(o: ProductOpts) {
    super(o, [5.4, 2.2]);
    const { a, b } = o;
    if (!a.length || !b.length || !b[0].length || a.some((row) => row.length !== b.length)) throw new RangeError('product: A must be rows by n and B n by columns, both non-empty');
    this.c = a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
    this.props.step = a.length * b[0].length;
  }
  draw(W: number, H: number): string {
    const { a, b } = this.o, rA = a.length, kk = b.length, cB = b[0].length, fmt = this.o.format ?? ((v: number) => fmtSigned(v)), role = this.o.role ?? 'accent';
    const total = rA * cB, step = clamp(this.props.step as number, 0, total), idx = Math.min(total - 1, Math.floor(step)), i = Math.floor(idx / cB), j = idx % cB;
    const running = step < total;
    const cell = Math.min(34, (W - 90) / (kk + cB + cB), (H - 50) / Math.max(rA, kk)), fs = cell * 0.4, gap = cell * 1.1;
    const wA = kk * cell, wB = cB * cell, wC = cB * cell;
    const total_w = wA + wB + wC + gap * 4, x0 = (W - total_w) / 2 + gap * 0.5, top = 14;
    const xA = x0, xB = xA + wA + gap * 1.2, xC = xB + wB + gap * 1.2;
    let s = drawMatrix(a, xA, top, cell, fs, { row: running ? i : -1, fmt, role }) + drawMatrix(b, xB, top, cell, fs, { col: running ? j : -1, fmt, role });
    s += `<text x="${r1(xA + wA + gap * 0.6)}" y="${r1(top + (Math.max(rA, kk) * cell) / 2 + fs * 0.34)}" text-anchor="middle" font-size="${fs * 1.3}" fill="${FAINT}">×</text>`;
    s += `<text x="${r1(xB + wB + gap * 0.6)}" y="${r1(top + (rA * cell) / 2 + fs * 0.34)}" text-anchor="middle" font-size="${fs * 1.3}" fill="${FAINT}">=</text>`;
    s += drawMatrix(this.c, xC, top, cell, fs, { fmt, role, filled: (r, c) => r * cB + c < Math.floor(step) || (r * cB + c === idx && step >= total) });
    if (running) {
      s += `<rect x="${r1(xC + j * cell + 3)}" y="${r1(top + i * cell + 3)}" width="${r1(cell - 6)}" height="${r1(cell - 6)}" rx="4" fill="none" stroke="${colourOf(role)}" stroke-width="1.6" stroke-dasharray="3 2"/>`;
      const terms = a[i].map((v, k) => `${fmtSigned(v)}·${fmtSigned(b[k][j])}`).join(' + '), sum = this.c[i][j];
      s += `<text x="${W / 2}" y="${r1(top + Math.max(rA, kk) * cell + fs * 2.2)}" text-anchor="middle" font-size="${fs * 1.05}" fill="${INK}">${esc(terms)} = <tspan fill="${colourOf(role)}" font-weight="700">${esc(fmt(sum))}</tspan></text>`;
    }
    return s;
  }
}
/**
 * Two matrices and their product, with the entry being computed highlighted.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
 * s.add(product([[1, 2], [3, 4]], [[5, 6], [7, 8]], { size: [5.4, 2] }));
 */
export const product = (a: Mat, b: Mat, o: Omit<ProductOpts, 'a' | 'b'> = {}) => new Product({ ...o, a, b });

/* ------------------------------------------------------------------ the plane under a matrix */

/** Options of `transform2d`. */
export interface Transform2dOpts extends SvgPlaneOpts {
  /** the matrix [[a, b], [c, d]] the plane ends up at (when `t` is 1) */
  matrix: Mat;
  /** the matrix it starts from. Default the identity. */
  from?: Mat;
  /** grid lines on each side of the origin */
  range?: number;
  /** draw the unit square, the basis vectors, the ghost of the original grid, and the eigenvector lines */
  square?: boolean;
  /** draw the basis vectors */
  basis?: boolean;
  /** draw the original grid faintly */
  ghost?: boolean;
  /** draw the eigenvector lines */
  eigen?: boolean;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/**
 * The plane, deformed by a 2 by 2 matrix. `t` runs from 0 (the `from` matrix, the identity by default) to 1
 * (`matrix`), so tweening it shows what the matrix does: the grid bends, the basis vectors land on its columns,
 * the unit square becomes a parallelogram whose area is the determinant. Rotations are interpolated as matrices,
 * so a quarter turn shrinks a little on the way, as it does in the linear algebra.
 */
export class Transform2d extends SvgPlane {
  declare o: Transform2dOpts;
  constructor(o: Transform2dOpts) {
    super(o, [4, 4]);
    this.props.t = 1;
  }
  /** the matrix at the current `t`: each entry a straight blend of `from` and `matrix` */
  current(): Mat {
    const A = this.o.from ?? [[1, 0], [0, 1]], B = this.o.matrix, t = this.props.t as number;
    return [[A[0][0] + (B[0][0] - A[0][0]) * t, A[0][1] + (B[0][1] - A[0][1]) * t], [A[1][0] + (B[1][0] - A[1][0]) * t, A[1][1] + (B[1][1] - A[1][1]) * t]];
  }
  draw(W: number, H: number): string {
    const o = this.o, m = this.current(), n = o.range ?? 4, fs = Math.max(6, Math.min(W, H) * 0.04), role = colourOf(o.role ?? 'accent');
    const cx = W / 2, cy = H / 2, scale = Math.min(W, H) / 2 / (n * 0.95);
    const P = (x: number, y: number): [number, number] => [cx + (m[0][0] * x + m[0][1] * y) * scale, cy - (m[1][0] * x + m[1][1] * y) * scale];
    const Q = (x: number, y: number): [number, number] => [cx + x * scale, cy - y * scale];
    let s = '';
    if (o.ghost !== false) for (let k = -n; k <= n; k++) s += `<path d="M${Q(k, -n).map(r1).join(' ')}L${Q(k, n).map(r1).join(' ')}M${Q(-n, k).map(r1).join(' ')}L${Q(n, k).map(r1).join(' ')}" stroke="${GRID}" stroke-opacity=".5" stroke-width="0.7" fill="none"/>`;
    for (let k = -n; k <= n; k++) {
      const axis = k === 0;
      s += `<path d="M${P(k, -n).map(r1).join(' ')}L${P(k, n).map(r1).join(' ')}" stroke="${axis ? INK : 'var(--c-s2)'}" stroke-opacity="${axis ? 0.7 : 0.55}" stroke-width="${axis ? 1.4 : 0.9}" fill="none"/>`;
      s += `<path d="M${P(-n, k).map(r1).join(' ')}L${P(n, k).map(r1).join(' ')}" stroke="${axis ? INK : 'var(--c-s2)'}" stroke-opacity="${axis ? 0.7 : 0.55}" stroke-width="${axis ? 1.4 : 0.9}" fill="none"/>`;
    }
    if (o.eigen) {
      const [a, b, c, d] = [m[0][0], m[0][1], m[1][0], m[1][1]], tr = a + d, det = a * d - b * c, disc = tr * tr / 4 - det;
      if (disc >= 0) for (const l of [tr / 2 + Math.sqrt(disc), tr / 2 - Math.sqrt(disc)]) {
        const v: [number, number] = Math.abs(b) > 1e-9 ? [b, l - a] : Math.abs(c) > 1e-9 ? [l - d, c] : Math.abs(l - a) < 1e-9 ? [1, 0] : [0, 1], k = n * 1.6 / (Math.hypot(...v) || 1);
        s += `<path d="M${r1(cx - v[0] * k * scale)} ${r1(cy + v[1] * k * scale)}L${r1(cx + v[0] * k * scale)} ${r1(cy - v[1] * k * scale)}" stroke="var(--c-s3)" stroke-width="1.6" stroke-dasharray="5 4" fill="none"/>`;
      }
    }
    if (o.square !== false) {
      const q = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
      s += `<path d="M${q.map((p) => p.map(r1).join(' ')).join('L')}Z" fill="${role}" fill-opacity="0.22" stroke="${role}" stroke-width="1.2"/>`;
      const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
      s += `<text x="${r1((q[0][0] + q[2][0]) / 2)}" y="${r1((q[0][1] + q[2][1]) / 2 + fs * 0.3)}" text-anchor="middle" font-size="${fs}" fill="${INK}">det ${num(det)}</text>`;
    }
    if (o.basis !== false) {
      const [ix, iy] = P(1, 0), [jx, jy] = P(0, 1);
      s += vec(cx, cy, ix, iy, 'var(--c-accent)', 2.6, 9) + vec(cx, cy, jx, jy, 'var(--c-s3)', 2.6, 9);
      s += `<text x="${r1(ix + (ix > cx ? 7 : -7))}" y="${r1(iy + (iy > cy ? fs * 1.2 : -4))}" text-anchor="${ix > cx ? 'start' : 'end'}" font-size="${fs}" font-style="italic" fill="var(--c-accent)">î</text>`;
      s += `<text x="${r1(jx + (jx > cx ? 7 : -7))}" y="${r1(jy + (jy > cy ? fs * 1.2 : -4))}" text-anchor="${jx > cx ? 'start' : 'end'}" font-size="${fs}" font-style="italic" fill="var(--c-s3)">ĵ</text>`;
    }
    return s;
  }
}
/**
 * The plane deformed by a 2 by 2 matrix, with the basis vectors, the unit square and the eigenvector lines.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
 * s.add(transform2d([[1, 1], [0, 1]], { eigen: true, size: [4, 4] }));
 */
export const transform2d = (matrix: Mat, o: Omit<Transform2dOpts, 'matrix'> = {}) => new Transform2d({ ...o, matrix });

/* ------------------------------------------------------------------ vector field */

/** Options of `vectorField`. */
export interface VectorFieldOpts extends SvgPlaneOpts {
  /** the field: a point to a vector */
  fn: (x: number, y: number) => [number, number];
  /** [x0, x1, y0, y1] */
  range?: [number, number, number, number];
  /** arrows across and up */
  cells?: [number, number];
  /** colour the arrows by strength, through the theme's ramp (default true) */
  strength?: boolean;
  /** draw the axes */
  axes?: boolean;
}

/** A grid of arrows: the direction and strength of a field at each point. `grow` brings the arrows in. */
export class VectorField extends SvgPlane {
  declare o: VectorFieldOpts;
  constructor(o: VectorFieldOpts) {
    super(o, [4, 3]);
    this.props.grow = 1;
  }
  draw(W: number, H: number): string {
    const o = this.o, [x0, x1, y0, y1] = o.range ?? [-3, 3, -2, 2], [nx, ny] = o.cells ?? [13, 9], grow = this.props.grow as number, pad = 12;
    const X = (x: number) => pad + ((x - x0) / (x1 - x0)) * (W - 2 * pad), Y = (y: number) => H - pad - ((y - y0) / (y1 - y0)) * (H - 2 * pad);
    const vs: { x: number; y: number; dx: number; dy: number; m: number }[] = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / nx, y = y0 + ((y1 - y0) * (j + 0.5)) / ny, [dx, dy] = o.fn(x, y);
      const m = Math.hypot(dx, dy);
      vs.push({ x, y, dx, dy, m: Number.isFinite(m) ? m : 0 }); // a point where the field is undefined gets no arrow
    }
    const mx = Math.max(...vs.map((v) => v.m), 1e-9), cell = Math.min((W - 2 * pad) / nx, (H - 2 * pad) / ny);
    let s = '';
    if (o.axes) s += `<line x1="${r1(X(0))}" y1="${pad}" x2="${r1(X(0))}" y2="${H - pad}" stroke="${GRID}"/><line x1="${pad}" y1="${r1(Y(0))}" x2="${W - pad}" y2="${r1(Y(0))}" stroke="${GRID}"/>`;
    vs.forEach((v, k) => {
      if (v.m < 1e-9) return;
      const g = easeOut(grow * 1.6 - (0.6 * k) / vs.length), len = (v.m / mx) * cell * 0.85 * g, ux = v.dx / v.m, uy = v.dy / v.m, cx = X(v.x), cy = Y(v.y);
      const colour = o.strength === false ? 'var(--c-ink)' : `color-mix(in oklab, var(--c-hi) ${Math.round(25 + 75 * (v.m / mx))}%, var(--c-lo))`;
      s += vec(cx - (ux * len) / 2, cy + (uy * len) / 2, cx + (ux * len) / 2, cy - (uy * len) / 2, colour, 1.8, Math.max(3, len * 0.28));
    });
    return s;
  }
}
/**
 * A grid of arrows showing the direction and strength of a field `(x, y) => [dx, dy]`.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
 * s.add(vectorField((x, y) => [-y, x], { range: [-3, 3, -2, 2], size: [4.4, 3] }));
 */
export const vectorField = (fn: VectorFieldOpts['fn'], o: Omit<VectorFieldOpts, 'fn'> = {}) => new VectorField({ ...o, fn });

/* ------------------------------------------------------------------ number line */

/** Options of `numberLine`. */
export interface NumberLineOpts extends SvgPlaneOpts {
  /** the lowest and highest value shown */
  range?: [number, number];
  /** distance between labelled ticks */
  step?: number;
  /** fixed points to mark */
  marks?: { value: number; label?: string; role?: string }[];
  /** arcs between values, with a label such as +3 */
  jumps?: { from: number; to: number; label?: string; role?: string }[];
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/** A number line. The property `value` is a marker that slides; `jump` (0 to the number of jumps) draws the arcs one by one. */
export class NumberLine extends SvgPlane {
  declare o: NumberLineOpts;
  constructor(o: NumberLineOpts = {}) {
    super(o, [5, 1.2]);
    this.props.value = o.range?.[0] ?? 0;
    this.props.jump = o.jumps?.length ?? 0;
  }
  draw(W: number, H: number): string {
    const o = this.o, [a, b] = o.range ?? [-5, 5], pad = 24, y = H * 0.62, fs = Math.max(7, H * 0.13);
    // a step that is not positive would never advance, and a tiny one would draw thousands of ticks
    const step = Math.max(o.step !== undefined && o.step > 0 ? o.step : 1, (b - a) / 200);
    const X = (v: number) => pad + ((v - a) / (b - a)) * (W - 2 * pad), accent = colourOf(o.role ?? 'accent');
    let s = `<line x1="${pad - 8}" y1="${r1(y)}" x2="${W - pad + 8}" y2="${r1(y)}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
    for (let k = Math.ceil(a / step - 1e-9); k * step <= b + 1e-9; k++) { const v = k * step; s += `<line x1="${r1(X(v))}" y1="${y - 5}" x2="${r1(X(v))}" y2="${y + 5}" stroke="${INK}" stroke-width="1.2"/><text x="${r1(X(v))}" y="${r1(y + fs * 1.5)}" text-anchor="middle" font-size="${fs}" fill="${FAINT}">${fmtSigned(v)}</text>`; }
    const shown = this.props.jump as number;
    (o.jumps ?? []).forEach((j, i) => {
      const g = clamp(shown - i); if (g <= 0) return;
      const x0 = X(j.from), x1 = X(j.to), h = Math.min(H * 0.5, Math.abs(x1 - x0) * 0.45), colour = colourOf(j.role ?? (j.to >= j.from ? 'accent' : 's3')), mx = (x0 + x1) / 2;
      const up = y - 6;
      s += `<path d="M${r1(x0)} ${up}Q${r1(mx)} ${r1(up - h * 2)} ${r1(x1)} ${up}" fill="none" stroke="${colour}" stroke-width="1.8" stroke-dasharray="${r1(Math.abs(x1 - x0) * 1.3)}" stroke-dashoffset="${r1(Math.abs(x1 - x0) * 1.3 * (1 - easeOut(g)))}"/>`;
      if (g > 0.95) s += arrowHead(x1, up, 0, 1, 7, colour) + (j.label ? `<text x="${r1(mx)}" y="${r1(up - h - 4)}" text-anchor="middle" font-size="${fs}" fill="${colour}">${esc(j.label)}</text>` : '');
    });
    for (const m of o.marks ?? []) s += `<circle cx="${r1(X(m.value))}" cy="${y}" r="4.5" fill="${colourOf(m.role ?? 'ink')}"/>${m.label ? `<text x="${r1(X(m.value))}" y="${r1(y - 12)}" text-anchor="middle" font-size="${fs}" fill="${colourOf(m.role ?? 'ink')}">${esc(m.label)}</text>` : ''}`;
    const v = this.props.value as number;
    s += `<circle cx="${r1(X(v))}" cy="${y}" r="6" fill="${accent}" stroke="${BG}" stroke-width="1.5"/>`;
    return s;
  }
}
/**
 * A number line with marks, a sliding marker and jumps between values.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
 * s.add(numberLine({ range: [-4, 6], size: [5.4, 1.5], jumps: [{ from: 1, to: 4, label: '+3' }], marks: [{ value: 1, label: 'start' }] }));
 */
export const numberLine = (o: NumberLineOpts = {}) => new NumberLine(o);

/* ------------------------------------------------------------------ unit circle */

/** Options of `unitCircle`. */
export interface UnitCircleOpts extends SvgPlaneOpts {
  /** also draw the sine wave unrolling to the right */
  wave?: boolean;
  /** show tangent */
  tangent?: boolean;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/** The unit circle with the angle in the property `angle` (degrees): its sine, cosine and, if asked, the wave they trace. */
export class UnitCircle extends SvgPlane {
  declare o: UnitCircleOpts;
  constructor(o: UnitCircleOpts = {}) {
    super(o, o.wave ? [6, 2.6] : [3, 3]);
    this.props.angle = 40;
  }
  draw(W: number, H: number): string {
    const o = this.o, th = ((this.props.angle as number) * Math.PI) / 180, fs = Math.max(6, Math.min(W, H) * 0.05);
    const R = Math.min(o.wave ? W * 0.28 : W * 0.38, H * 0.38), cx = o.wave ? R + 36 : W / 2, cy = H / 2, accent = colourOf(o.role ?? 'accent');
    const px = cx + R * Math.cos(th), py = cy - R * Math.sin(th), cos = 'var(--c-s2)', sin = accent;
    let s = `<line x1="${r1(cx - R * 1.25)}" y1="${cy}" x2="${r1(cx + R * 1.25)}" y2="${cy}" stroke="${GRID}"/><line x1="${cx}" y1="${r1(cy - R * 1.25)}" x2="${cx}" y2="${r1(cy + R * 1.25)}" stroke="${GRID}"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r1(R)}" fill="none" stroke="${INK}" stroke-opacity=".6" stroke-width="1.4"/>`;
    // the arc that marks the angle; the large-arc flag follows the angle taken modulo a full turn
    const ar = R * 0.28;
    s += `<path d="M${r1(cx + ar)} ${cy}A${ar} ${ar} 0 ${(((this.props.angle as number) % 360) + 360) % 360 > 180 ? 1 : 0} 0 ${r1(cx + ar * Math.cos(th))} ${r1(cy - ar * Math.sin(th))}" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
    s += `<line x1="${cx}" y1="${cy}" x2="${r1(px)}" y2="${r1(py)}" stroke="${INK}" stroke-width="1.8"/>`;
    s += `<line x1="${r1(px)}" y1="${r1(py)}" x2="${r1(px)}" y2="${cy}" stroke="${sin}" stroke-width="2.4"/><line x1="${cx}" y1="${cy}" x2="${r1(px)}" y2="${cy}" stroke="${cos}" stroke-width="2.4"/>`;
    if (o.tangent && Math.abs(Math.cos(th)) > 0.05) {
      const ty = cy - R * Math.tan(th);
      if (Math.abs(ty - cy) < R * 2.2) s += `<line x1="${r1(cx + R)}" y1="${cy}" x2="${r1(cx + R)}" y2="${r1(ty)}" stroke="var(--c-s3)" stroke-width="2"/><line x1="${cx}" y1="${cy}" x2="${r1(cx + R)}" y2="${r1(ty)}" stroke="var(--c-s3)" stroke-width="0.9" stroke-dasharray="3 3"/>`;
    }
    s += `<circle cx="${r1(px)}" cy="${r1(py)}" r="4.5" fill="${accent}" stroke="${BG}" stroke-width="1.4"/>`;
    s += `<text x="${r1(cx + R * 0.5 * Math.cos(th))}" y="${r1(cy + fs * 1.3)}" text-anchor="middle" font-size="${fs}" fill="${cos}">cos ${num(Math.cos(th))}</text>`;
    s += `<text x="${r1(px + (Math.cos(th) >= 0 ? 8 : -8))}" y="${r1((py + cy) / 2 + fs * 0.3)}" text-anchor="${Math.cos(th) >= 0 ? 'start' : 'end'}" font-size="${fs}" fill="${sin}">sin ${num(Math.sin(th))}</text>`;
    s += `<text x="${r1(cx + ar * 1.5)}" y="${r1(cy - ar * 0.45)}" font-size="${fs * 0.95}" fill="${INK}">${(((Math.round(this.props.angle as number) % 360) + 360) % 360)}°</text>`;
    if (o.wave) {
      const x0 = cx + R * 1.7, x1 = W - 14, k = (x1 - x0) / (2 * Math.PI);
      s += `<line x1="${r1(x0)}" y1="${cy}" x2="${x1}" y2="${cy}" stroke="${GRID}"/><line x1="${r1(x0)}" y1="${r1(cy - R * 1.25)}" x2="${r1(x0)}" y2="${r1(cy + R * 1.25)}" stroke="${GRID}"/>`;
      s += `<path d="${Array.from({ length: 121 }, (_, i) => { const t = (2 * Math.PI * i) / 120; return `${i ? 'L' : 'M'}${r1(x0 + t * k)} ${r1(cy - R * Math.sin(t))}`; }).join('')}" fill="none" stroke="${GRID}" stroke-width="1.2"/>`;
      const t = (((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)), n = Math.max(2, Math.round((t / (2 * Math.PI)) * 120));
      s += `<path d="${Array.from({ length: n + 1 }, (_, i) => { const u = (t * i) / n; return `${i ? 'L' : 'M'}${r1(x0 + u * k)} ${r1(cy - R * Math.sin(u))}`; }).join('')}" fill="none" stroke="${sin}" stroke-width="2.2" stroke-linecap="round"/>`;
      s += `<line x1="${r1(px)}" y1="${r1(py)}" x2="${r1(x0 + t * k)}" y2="${r1(py)}" stroke="${sin}" stroke-opacity=".5" stroke-dasharray="3 3"/><circle cx="${r1(x0 + t * k)}" cy="${r1(cy - R * Math.sin(t))}" r="4" fill="${sin}"/>`;
    }
    return s;
  }
}
/**
 * The unit circle, with the sine and cosine of an angle and, if asked, the wave they trace.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
 * s.add(unitCircle({ wave: true, tangent: false, size: [6, 2.6] }));
 */
export const unitCircle = (o: UnitCircleOpts = {}) => new UnitCircle(o);
