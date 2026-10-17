import { Animatable, type Value } from '../core/animatable.ts';
import type { V3 } from '../core/math.ts';
import { rd } from './geom.ts';
import { SvgPlane, colourOf, clamp, esc, K, type SvgPlaneOpts } from '../draw/svgplane.ts';

/** a number rounded to 3 decimals as text, to keep the SVG short */
const n3 = (n: number) => rd(n, 3);

/** Options of a part of a construction. */
export interface PartOpts {
  /** the outline as an SVG path, or a function of the part's properties that makes it, so a shape can be reshaped by animating `props`. Leave it out for a text label. */
  d?: string | ((p: Record<string, Value>) => string);
  /** makes the part a small text label instead of an outline, drawn at `at` in the colour of `stroke`. Fade it with `op`. */
  text?: string;
  /** where the label sits, in the drawing's coordinates. The text is centred on it unless `anchor` says otherwise. */
  at?: [number, number];
  /** the label's font size in svg units, 24 by default */
  size?: number;
  /** which end of the label sits at `at`: `start`, `middle` (default) or `end` */
  anchor?: 'start' | 'middle' | 'end';
  /** colour of the line: a role (`ink`, `faint`, `accent`, `s1` to `s8`) or any CSS colour. `ink` by default. */
  stroke?: string;
  /** colour of the fill: a role or any CSS colour. No fill by default. */
  paint?: string;
  /** line width in svg units of the drawing, 2 by default */
  width?: number;
  /** the point that `spin` and `scale` turn and grow about, the middle of the box by default */
  about?: [number, number];
  /** starting values of the part's properties (`draw`, `fill`, `line`, `spin`, `dx`, `dy`, `scale`, `op`, or your own) */
  props?: Record<string, Value>;
}

/**
 * One drawn shape of a construction. Everything that changes is in `props`, so a timeline can animate it:
 * `draw` (how much of the outline is drawn, 0 to 1), `fill` (the fill's opacity), `line` (the outline's opacity),
 * `spin` (degrees about `about`), `scale`, `dx`, `dy` and `op` (opacity of the whole part). Any property you
 * add through `props` is also animatable and is passed to `d` when `d` is a function.
 */
export class Part extends Animatable {
  o: PartOpts;
  constructor(o: PartOpts) {
    super();
    this.o = o;
    Object.assign(this.props, { draw: 1, fill: 0, line: 1, spin: 0, scale: 1, dx: 0, dy: 0, op: 1 });
    for (const k in o.props) this.set(k, o.props[k]);
  }
}

/** Options of a construction. */
export interface ConstructOpts extends SvgPlaneOpts {
  /** the part of the drawing's own coordinates to show: x, y, width, height. `[0, 0, 1000, 1000]` by default. */
  box?: [number, number, number, number];
}

/**
 * A drawing built from parts that each draw on, fill, turn, move and fade by themselves. It is the tool for
 * line constructions: guides, compass circles and outlines that trace, copy and turn into a finished shape.
 * Parts paint in the order they were added.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [360, 360], padding: 6 });
 * const c = s.add(new Construct({ box: [0, 0, 200, 200], size: [3.4, 3.4] }));
 * const ring = c.add({ d: circleD(100, 100, 70), stroke: 'faint', width: 1.5, props: { draw: 0 } });
 * const leaf = c.add({ d: segsD(arcSegs(160, 100, 80, 2.5, 3.78).concat(arcSegs(40, 100, 80, -0.64, 0.64)), true), paint: 'accent', width: 3, props: { draw: 0 } });
 *
 * const tl = new Timeline();
 * tl.play(tween(ring, { draw: 1 }, { duration: 1.2 }));
 * tl.play(tween(leaf, { draw: 1, fill: 0.4 }, { duration: 1.2 }));
 * tl.play(tween(leaf, { spin: 90 }, { duration: 1.2 }));
 */
export class Construct extends SvgPlane {
  declare o: ConstructOpts;
  parts: Part[] = [];
  constructor(o: ConstructOpts = {}) { super(o, [4, 4]); }
  /** adds a shape on top of the others and returns it, ready to animate */
  add(o: PartOpts): Part { const p = new Part(o); this.parts.push(p); return p; }
  /** the `box` of the drawing, with a width and height that are never zero, so the scale stays finite */
  private frame(): [number, number, number, number] {
    const [bx, by, bw, bh] = this.o.box ?? [0, 0, 1000, 1000];
    return [bx, by, Math.abs(bw) || 1, Math.abs(bh) || 1];
  }
  /**
   * Where a point of the drawing sits in the scene, in the plane's own space (world units from its corner), so lines, dots
   * and labels can be tied to the drawing: a drop line from a corner of a shape to where it lifted.
   */
  at(x: number, y: number): V3 {
    const [bx, by, bw, bh] = this.frame(), [w, h] = this.size, W = w * K, H = h * K, k = Math.min(W / bw, H / bh);
    const sx = (W - bw * k) / 2 - bx * k + x * k, sy = (H - bh * k) / 2 - by * k + y * k;
    const u = this.o.u ?? [1, 0, 0], v = this.o.v ?? [0, 0, 1], a = sx / K, b = (H - sy) / K;
    return [u[0] * a + v[0] * b, u[1] * a + v[1] * b, u[2] * a + v[2] * b];
  }
  /** all parts, in order, inside one group that maps the `box` onto the plane (centred, uniform scale) */
  draw(W: number, H: number): string {
    const [bx, by, bw, bh] = this.frame(), k = Math.min(W / bw, H / bh);
    const body = this.parts.map((p) => partSvg(p, bx + bw / 2, by + bh / 2)).join('');
    return `<g transform="translate(${n3((W - bw * k) / 2 - bx * k)} ${n3((H - bh * k) / 2 - by * k)}) scale(${n3(k)})" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  }
}

/** One part as SVG: an outline with fill, drawn-on dashes, and its move/spin/scale about `(mx, my)` (the middle of the box) unless the part sets `about`. Empty when invisible. */
function partSvg(part: Part, mx: number, my: number): string {
  if (part.o.text !== undefined) return textSvg(part);
  const v = part.props, o = part.o, op = v.op as number, draw = clamp(v.draw as number), fill = clamp(v.fill as number), line = clamp(v.line as number);
  const showLine = draw > 0.0005 && line > 0 && o.stroke !== 'none', showFill = fill > 0 && o.paint;
  if (op <= 0 || (!showLine && !showFill)) return '';
  const [cx, cy] = o.about ?? [mx, my], sc = v.scale as number;
  const tf = `translate(${n3(v.dx as number)} ${n3(v.dy as number)}) translate(${n3(cx)} ${n3(cy)}) rotate(${n3(v.spin as number)}) scale(${n3(sc)}) translate(${n3(-cx)} ${n3(-cy)})`;
  const d = typeof o.d === 'function' ? o.d(v) : (o.d ?? '');
  let a = `d="${esc(d)}" fill="${showFill ? esc(colourOf(o.paint!)) : 'none'}"`;
  if (showFill && fill < 1) a += ` fill-opacity="${n3(fill)}"`;
  if (showLine) {
    a += ` stroke="${esc(colourOf(o.stroke ?? 'ink'))}" stroke-width="${o.width ?? 2}"`;
    if (line < 1) a += ` stroke-opacity="${n3(line)}"`;
    if (draw < 1) a += ` pathLength="1" stroke-dasharray="1" stroke-dashoffset="${n3(1 - draw)}"`;
  }
  return `<g transform="${tf}"${op < 1 ? ` opacity="${n3(op)}"` : ''}><path ${a}/></g>`;
}

/** A text part as one `<text>` element; empty when invisible or when there is no text. */
function textSvg(part: Part): string {
  const o = part.o, v = part.props, op = v.op as number;
  if (op <= 0 || !o.text) return '';
  const [x, y] = o.at ?? [0, 0];
  return `<text x="${n3(x)}" y="${n3(y)}" font-size="${o.size ?? 24}" text-anchor="${o.anchor ?? 'middle'}" fill="${esc(colourOf(o.stroke ?? 'faint'))}"${op < 1 ? ` opacity="${n3(op)}"` : ''}>${esc(o.text)}</text>`;
}
