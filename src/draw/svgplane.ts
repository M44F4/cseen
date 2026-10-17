import { Node, pushPlane, type NodeOpts, type Prim } from '../core/nodes.ts';
import { clamp, type V3 } from '../core/math.ts';
import { esc } from '../core/render.ts';

// shared with the core, re-exported here for the packs that draw on planes
export { clamp, esc };

/** svg units per world unit on an SVG plane. 100 means a 4 by 2.5 chart is drawn in a 400 by 250 box. */
export const K = 100;

/** the theme's colours as CSS variables, so a drawing follows the theme and light or dark */
export const INK = 'var(--c-ink)', FAINT = 'var(--c-faint)', GRID = 'var(--c-grid)', BG = 'var(--c-bg)', ACC = 'var(--c-accent)', SURF = 'var(--c-surface)';
/** the font of text on planes; monospace, so box sizes can be worked out from the number of characters */
export const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** rounds to one decimal, to keep the SVG short */
export const r1 = (n: number) => Math.round(n * 10) / 10;
/** slows toward the end: 0 to 1 along a cubic ease-out, clamped. Used to reveal drawings with a `grow` property. */
export const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3;
/** a small integer from a string, so a drawing can give its SVG clip paths and gradients ids that differ per node */
export const hashId = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
/** a colour role (ink, faint, accent, grid, s1 to s8) or any CSS colour, as a CSS colour */
export const colourOf = (c: string) => (/^(ink|faint|accent|grid|s[1-8])$/.test(c) ? `var(--c-${c})` : c);

/** Options shared by everything that is an SVG drawing placed on a plane: charts, screens and maths figures. */
export interface SvgPlaneOpts extends NodeOpts {
  /** size in world units */
  size?: [number, number];
  /** directions of the drawing's right and up. Default: a wall facing the viewer. */
  u?: V3;
  /** direction of the plane's upward axis */
  v?: V3;
  /** hide the plane when it is seen from behind, so a face of a closed shape does not show through the faces in front. Off by default. */
  cull?: boolean;
}

/**
 * Anything drawn as SVG on a plane in the scene: charts, screen elements, maths figures. A subclass says how to
 * draw itself from its current props, and gets the plane, fading and placement for free.
 */
export abstract class SvgPlane extends Node {
  size: [number, number];
  o: SvgPlaneOpts;
  constructor(o: SvgPlaneOpts, fallback: [number, number]) {
    super(o);
    this.o = o;
    this.size = o.size ?? fallback;
  }
  /** the drawing, in svg units: W wide and H tall, origin at the top left */
  abstract draw(W: number, H: number): string;
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    const [w, h] = this.size, W = w * K, H = h * K;
    const inner = `<svg x="0" y="0" width="${W}" height="${H}" overflow="visible"><g font-family="${FONT}">${this.draw(W, H)}</g></svg>`;
    pushPlane(this, { size: [w, h], u: this.o.u, v: this.o.v, svg: { box: [0, 0, W, H], inner }, cells: 6, border: false, cull: this.o.cull, opacity: op }, out);
  }
}

/** A "nice" number near x: 1, 2 or 5 times a power of ten. `round` picks the nearest one, otherwise the next one at or above x. Anything that is not a positive number gives 1. */
export function nice(x: number, round: boolean): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const e = Math.floor(Math.log10(x)), f = x / 10 ** e;
  const n = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
  return n * 10 ** e;
}
/** round tick values that cover [lo, hi] */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (hi <= lo) hi = lo + 1;
  const step = nice((hi - lo) / Math.max(1, count - 1), true), a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t: number[] = [];
  // beyond float precision a step cannot move the value, and counting would never end
  if (a + step === a || b - step === b) return [lo, hi];
  // count in whole steps rather than adding, so rounding does not build up
  for (let i = Math.round(a / step), end = Math.round(b / step); i <= end; i++) t.push(i * step);
  return t;
}
