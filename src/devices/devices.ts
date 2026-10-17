import { Box, Dot, Face, Group, Node, Path, Plane, Spheres, Surface } from '../core/nodes.ts';
import type { NodeOpts } from '../core/nodes.ts';
import { TextBlock, type TextBlockOpts } from '../draw/text.ts';
import { nestSvg } from '../core/svg-import.ts';
import { add, rng, type V3 } from '../core/math.ts';
import { esc } from '../core/render.ts';

const INK = 'var(--c-ink)';
const ACC = 'var(--c-accent)';
const BG = 'var(--c-bg)';

/** An empty screen: the page colour with a faint tint. Things are not shown unless you ask for them. */
const BLANK = `<svg viewBox="0 0 160 100"><rect width="160" height="100" fill="${BG}"/><rect width="160" height="100" fill="${INK}" fill-opacity=".05"/></svg>`;

/** Cuts text to `max` characters, ending in an ellipsis, so a long url or title stays inside its bar. */
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(0, max - 1))}\u2026` : s);

/**
 * A thing with a screen. Its screen starts empty. Put anything on it with `write`, `code`, or by
 * passing an SVG as `screen`. `write` and `code` return the text, so you can animate it with `typeOn`.
 */
export class Device extends Group {
  /** where the screen is, in the device's own space: its bottom left corner and its size */
  screen: { at: V3; size: [number, number] } = { at: [0, 0, 0], size: [1, 1] };
  /** the group the screen lives in (a laptop's lid, for example) */
  host: Group = this;
  /** default text colour on this screen */
  ink?: string;

  /** a text block that fills the screen, added to the host group; the font size is chosen so the lines fit the height */
  private block(text: string | string[], o: Partial<TextBlockOpts>, code: boolean): TextBlock {
    const n = Array.isArray(text) ? text.length : text.split('\n').length, [w, h] = this.screen.size;
    const b = new TextBlock({
      pad: w * 0.04, fontSize: Math.min(h / (n + 2), w * 0.055), color: this.ink, cursor: code, code, ...o,
      text, at: add(this.screen.at, [0, -0.006, 0]), size: this.screen.size,
    });
    this.host.add(b);
    return b;
  }
  /**
   * puts an element (a notification, a chat, a progress bar) on the screen. `at` is where its bottom left corner goes
   * and `width` how wide it is, both as a fraction of the screen. It keeps its own proportions.
   */
  put<T extends Node>(el: T & { size: [number, number] }, o: { at?: [number, number]; width?: number } = {}): T {
    const [w, h] = this.screen.size, [fx, fy] = o.at ?? [0, 0], k = el.size[0] > 0 ? ((o.width ?? 1) * w) / el.size[0] : 1;
    el.set('pos', add(this.screen.at, [fx * w, -0.01, fy * h]));
    el.set('scale', k);
    this.host.add(el);
    return el;
  }
  /** writes text on the screen */
  write(text: string | string[], o: Partial<TextBlockOpts> = {}): TextBlock { return this.block(text, o, false); }
  /** writes coloured code on the screen */
  code(src: string | string[], o: Partial<TextBlockOpts> = {}): TextBlock { return this.block(src, o, true); }
}

/** Options shared by every device with a screen. */
interface ScreenOpts extends NodeOpts {
  /** what the screen shows: the text of an SVG (a logo, a chart, a screenshot). Empty by default. */
  screen?: string;
  /** swap colours inside the screen SVG for CSS variables */
  recolor?: Record<string, string>;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/** a flat panel with a bezel: the body box and the screen plane on its front face. Shared by monitors, phones, tablets, TVs. */
function panel(d: Device, o: ScreenOpts, at: V3, size: V3, margin: [number, number, number, number]): void {
  const [w, th, h] = size, [mt, mr, mb, ml] = margin;
  d.add(new Box({ at, size, role: o.role ?? 'ink' }));
  d.screen = { at: [at[0] - w / 2 + ml, at[1] - th / 2 - 0.004, at[2] + mb], size: [w - ml - mr, h - mt - mb] };
  d.add(new Plane({ svg: o.screen ?? BLANK, recolor: o.recolor, border: false, at: d.screen.at, size: d.screen.size }));
}

/** Options of `monitor`. */
export interface MonitorOpts extends ScreenOpts {
  /** width in world units */
  width?: number;
  /** height over width of the screen */
  ratio?: number;
}

/**
 * A desktop monitor on a stand. `at` is the centre of its base.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const m = s.add(monitor({ at: [0, 0, 0], width: 3 }));
 * m.write(['hello'], { fontSize: 0.3 });   // a screen is empty until you put something on it
 */
export function monitor(o: MonitorOpts = {}): Device {
  const w = o.width ?? 3, ratio = o.ratio ?? 16 / 10, role = o.role ?? 'ink';
  const bezel = w * 0.045, sh = (w - 2 * bezel) / ratio, H = sh + 2 * bezel, d = w * 0.07, baseH = w * 0.035, neckH = w * 0.16, z0 = baseH + neckH;
  const g = new Device(o);
  g.add(new Box({ size: [w * 0.34, w * 0.22, baseH], role }));
  g.add(new Box({ at: [0, 0, baseH], size: [w * 0.07, w * 0.05, neckH], role }));
  panel(g, o, [0, 0, z0], [w, d, H], [bezel, bezel, bezel, bezel]);
  return g;
}

/** Options of `tv`. */
export interface TvOpts extends ScreenOpts {
  /** width in world units */
  width?: number;
}

/**
 * A flat-screen television on two feet.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), tv({ at: [0, 0, 0], width: 4.4 }));
 */
export function tv(o: TvOpts = {}): Device {
  const w = o.width ?? 4.4, role = o.role ?? 'ink', bezel = w * 0.018, sh = ((w - 2 * bezel) * 9) / 16, H = sh + 2 * bezel, d = w * 0.022, leg = w * 0.05;
  const g = new Device(o);
  for (const x of [-0.34, 0.34]) g.add(new Box({ at: [x * w, 0, 0], size: [w * 0.07, w * 0.07, leg], role }));
  panel(g, o, [0, 0, leg], [w, d, H], [bezel, bezel, bezel, bezel]);
  return g;
}

/** Options of `tablet`. */
export interface TabletOpts extends ScreenOpts {
  /** width in world units */
  width?: number;
  /** height over width of the screen */
  ratio?: number;
}

/**
 * A tablet, landscape by default, standing on its edge.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), tablet({ at: [0, 0, 0], width: 2.5 }));
 */
export function tablet(o: TabletOpts = {}): Device {
  const w = o.width ?? 2.5, h = w / (o.ratio ?? 4 / 3), m = w * 0.045, g = new Device(o);
  panel(g, o, [0, 0, 0], [w, w * 0.035, h], [m, m, m, m]);
  return g;
}

/** Options of `phone`. */
export interface PhoneOpts extends ScreenOpts {
  /** height in world units */
  height?: number;
}

/**
 * A phone, upright.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const p = s.add(phone({ at: [0, 0, 0], height: 2.4 }));
 * p.put(notification({ title: 'Deploy finished', body: 'my.app is live.' }), { at: [0.05, 0.8], width: 0.9 });
 */
export function phone(o: PhoneOpts = {}): Device {
  const h = o.height ?? 2.4, w = h * 0.48, m = h * 0.035, g = new Device(o);
  panel(g, o, [0, 0, 0], [w, h * 0.045, h], [m * 1.5, m, m * 1.5, m]);
  g.add(new Dot({ at: [0, -h * 0.045 / 2 - 0.02, h - m * 0.8], r: 1.1, role: o.role ?? 'ink' }));
  return g;
}

/** the keys drawn on a laptop's deck: five rows of fourteen rounded squares, as one SVG */
const KEYS = (() => {
  let k = '';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) k += `<rect x="${c * 7.2 + 1}" y="${r * 7.4 + 1}" width="6" height="6" rx="1" fill="${INK}" fill-opacity=".14"/>`;
  return `<svg viewBox="0 0 102 38">${k}</svg>`;
})();

/** Options of `laptop`. */
export interface LaptopOpts extends ScreenOpts {
  /** width in world units */
  width?: number;
  /** how far the lid leans back from upright, in degrees */
  lean?: number;
}

/**
 * A laptop, open. `lean` is how far the lid leans back from upright, in degrees.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), laptop({ at: [0, 0, 0], width: 3.2, lean: 16 }));
 */
export function laptop(o: LaptopOpts = {}): Device {
  const w = o.width ?? 3.2, role = o.role ?? 'ink', baseD = w * 0.68, baseH = w * 0.035, t = w * 0.03, m = w * 0.035, lidH = w * 0.62;
  const g = new Device(o);
  g.add(new Box({ size: [w, baseD, baseH], role }));
  g.add(new Plane({ svg: KEYS, at: [-w * 0.45, -baseD * 0.02, baseH + 0.004], u: [1, 0, 0], v: [0, 1, 0], size: [w * 0.9, w * 0.3], border: false }));
  g.add(new Face([[-w * 0.11, -baseD * 0.42, baseH + 0.004], [w * 0.11, -baseD * 0.42, baseH + 0.004], [w * 0.11, -baseD * 0.14, baseH + 0.004], [-w * 0.11, -baseD * 0.14, baseH + 0.004]], { role, fill: 0.06, shade: false }));
  const lid = new Group({ at: [0, baseD / 2 - t, baseH], rot: [-(o.lean ?? 16), 0, 0] });
  lid.add(new Box({ size: [w, t, lidH], role }));
  g.screen = { at: [-w / 2 + m, -t / 2 - 0.004, m], size: [w - 2 * m, lidH - 2 * m] };
  lid.add(new Plane({ svg: o.screen ?? BLANK, recolor: o.recolor, border: false, at: g.screen.at, size: g.screen.size }));
  g.add(lid);
  g.host = lid;
  return g;
}

/** Options of `browser`. */
export interface BrowserOpts extends ScreenOpts {
  /** width in world units */
  width?: number;
  /** the address shown in the address bar */
  url?: string;
  /** height over width of the screen */
  ratio?: number;
  /** text shown inside the page */
  content?: string;
}

/**
 * A browser window. The page is empty unless you give `content` (any SVG) or use `write` / `code`.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), browser({ at: [0, 0, 0], width: 4, url: 'example.com' }));
 */
export function browser(o: BrowserOpts = {}): Device {
  const w = o.width ?? 4, ratio = o.ratio ?? 1.55, h = w / ratio, d = w * 0.03, role = o.role ?? 'ink';
  const W = 160, H = W / ratio, bar = 12;
  const chrome = `<svg viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <rect width="${W}" height="${bar}" fill="${INK}" fill-opacity=".07"/>
    <circle cx="7" cy="${bar / 2}" r="1.9" fill="${ACC}"/><circle cx="14" cy="${bar / 2}" r="1.9" fill="${INK}" fill-opacity=".3"/><circle cx="21" cy="${bar / 2}" r="1.9" fill="${INK}" fill-opacity=".3"/>
    <rect x="32" y="2.6" width="${W - 44}" height="6.8" rx="3.4" fill="${INK}" fill-opacity=".1"/>
    <text x="38" y="7.4" font-size="4.2" font-family="ui-monospace, monospace" fill="${INK}" fill-opacity=".75">${esc(clip(o.url ?? '', 40))}</text>
    ${o.content ? nestSvg(o.content, 0, bar, W, H - bar) : ''}
  </svg>`;
  const g = new Device(o);
  g.add(new Box({ size: [w, d, h], role }));
  g.add(new Plane({ svg: chrome, at: [-w / 2, -d / 2 - 0.004, 0], size: [w, h], border: false }));
  g.screen = { at: [-w / 2, -d / 2 - 0.004, 0], size: [w, (h * (H - bar)) / H] };
  return g;
}

/** Options of `terminal`. */
export interface TerminalOpts extends ScreenOpts {
  /** width in world units */
  width?: number;
  /** text in the title bar */
  title?: string;
  /** height over width of the screen */
  ratio?: number;
  /** a light terminal that follows the theme. By default a terminal stays dark in every theme. */
  light?: boolean;
}

/**
 * A terminal window with an empty body. Dark in every theme unless `light` is set. Use `write` or `code` to put commands in it.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * const t = s.add(terminal({ at: [0, 0, 0], width: 4, title: 'zsh' }));
 * t.write(['$ npm install', 'added 1 package'], { cursor: true });
 */
export function terminal(o: TerminalOpts = {}): Device {
  const w = o.width ?? 4, ratio = o.ratio ?? 1.6, h = w / ratio, d = w * 0.03, role = o.role ?? 'ink';
  const W = 160, H = W / ratio, bar = 11;
  const bg = o.light ? 'var(--c-surface)' : 'var(--c-term-bg)', fg = o.light ? INK : 'var(--c-term-fg)';
  const svg = `<svg viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${BG}"/><rect width="${W}" height="${H}" fill="${bg}"/>
    <rect width="${W}" height="${bar}" fill="${fg}" fill-opacity=".1"/>
    <circle cx="7" cy="${bar / 2}" r="1.8" fill="${ACC}"/><circle cx="13.5" cy="${bar / 2}" r="1.8" fill="${fg}" fill-opacity=".35"/><circle cx="20" cy="${bar / 2}" r="1.8" fill="${fg}" fill-opacity=".35"/>
    <text x="${W / 2}" y="7.2" text-anchor="middle" font-size="4.2" font-family="ui-monospace, monospace" fill="${fg}" fill-opacity=".7">${esc(clip(o.title ?? '', 40))}</text>
  </svg>`;
  const g = new Device(o);
  g.ink = fg;
  g.add(new Box({ size: [w, d, h], role }));
  g.add(new Plane({ svg, at: [-w / 2, -d / 2 - 0.004, 0], size: [w, h], border: false }));
  g.screen = { at: [-w / 2, -d / 2 - 0.004, 0], size: [w, (h * (H - bar)) / H] };
  return g;
}

/** Options of `document`. */
export interface DocumentOpts extends NodeOpts {
  /** width in world units */
  width?: number;
  /** height over width */
  ratio?: number;
  /** a heading line */
  title?: string;
  /** number of lines of text */
  lines?: number;
  /** changes the lengths of the lines of text */
  seed?: number;
}

/**
 * A sheet of paper with a folded corner and lines of text. Stands facing the viewer; rotate it with `rot`.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), document({ at: [0, 0, 0], width: 1.6, title: 'notes' }));
 */
export function document(o: DocumentOpts = {}): Plane {
  const w = o.width ?? 1.6, ratio = o.ratio ?? 0.74, W = 100, H = W / ratio, r = rng(o.seed ?? 7), n = o.lines ?? 9;
  let body = `<rect x="14" y="14" width="${W * 0.45}" height="7" rx="2" fill="${INK}" fill-opacity=".6"/>`;
  // monospace glyphs are 0.6 of the font size wide; shrink a long title to fit left of the folded corner
  if (o.title) body = `<text x="14" y="21" font-size="${Math.min(9, 64 / (0.6 * o.title.length))}" font-family="ui-monospace, monospace" fill="${INK}">${esc(o.title)}</text>`;
  for (let i = 0; i < n; i++) body += `<rect x="14" y="${34 + i * ((H - 56) / n)}" width="${(W - 28) * (i === n - 1 ? 0.5 : 0.78 + r() * 0.22)}" height="3.2" rx="1.6" fill="${INK}" fill-opacity=".2"/>`;
  const fold = 22;
  const svg = `<svg viewBox="0 0 ${W} ${H}"><path d="M0 0H${W - fold}L${W} ${fold}V${H}H0Z" fill="${BG}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M${W - fold} 0V${fold}H${W}" fill="${INK}" fill-opacity=".12" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>${body}</svg>`;
  return new Plane({ ...o, svg, size: [w, w / ratio], border: false });
}

/** Options of `cylinder`. */
export interface CylinderOpts extends NodeOpts {
  /** radius */
  r?: number;
  /** height */
  h?: number;
  /** number of sides */
  res?: number;
  /** colour strength, 0 to 1 */
  fill?: number;
  /** see-through amount, 0 to 1 */
  alpha?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/**
 * A cylinder standing on the point `at`.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), cylinder({ at: [0, 0, 0], r: 0.8, h: 1.2 }));
 */
export function cylinder(o: CylinderOpts = {}): Group {
  const r = o.r ?? 0.8, h = o.h ?? 1.2, res = Math.max(3, o.res ?? 32), role = o.role ?? 'ink', fill = o.fill ?? 0.3;
  // the cap outline at height z; `rev` flips the winding so the bottom faces down
  const ring = (z: number, rev = false): V3[] => {
    const p: V3[] = Array.from({ length: res }, (_, i) => [r * Math.cos((2 * Math.PI * i) / res), r * Math.sin((2 * Math.PI * i) / res), z]);
    return rev ? p.reverse() : p;
  };
  const g = new Group(o);
  g.add(new Surface((u, v) => [r * Math.cos(u), r * Math.sin(u), v * h], { u: [0, 2 * Math.PI], v: [0, 1], res: [res, 1], role, fill, alpha: o.alpha, outline: false }));
  g.add(new Face(ring(0, true), { role, fill, alpha: o.alpha }));
  g.add(new Face(ring(h), { role, fill: Math.min(1, fill * 1.15), alpha: o.alpha }));
  return g;
}

/** Options of `database`. */
export interface DatabaseOpts extends NodeOpts {
  /** radius */
  r?: number;
  /** number of stacked discs */
  layers?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/**
 * The classic database icon: stacked discs.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), database({ at: [0, 0, 0], r: 0.9, layers: 3 }));
 */
export function database(o: DatabaseOpts = {}): Group {
  const r = o.r ?? 0.9, layers = o.layers ?? 3, h = r * 0.42, gap = r * 0.1, g = new Group(o);
  for (let i = 0; i < layers; i++) g.add(cylinder({ at: [0, 0, i * (h + gap)], r, h, role: o.role }));
  return g;
}

/** Options of `sphere`. */
export interface SphereOpts extends NodeOpts {
  /** radius */
  r?: number;
  /** number of segments around */
  res?: number;
  /** colour strength, 0 to 1 */
  fill?: number;
  /** see-through amount, 0 to 1 */
  alpha?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/**
 * A shaded sphere resting on the point `at`.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), sphere({ at: [0, 0, 0], r: 0.9 }));
 */
export function sphere(o: SphereOpts = {}): Surface {
  const r = o.r ?? 0.9, res = o.res ?? 18;
  return new Surface((u, v) => [r * Math.cos(v) * Math.cos(u), r * Math.cos(v) * Math.sin(u), r + r * Math.sin(v)], {
    ...o, u: [0, 2 * Math.PI], v: [-Math.PI / 2, Math.PI / 2], res: [res, Math.round(res / 2)], fill: o.fill ?? 0.3, width: 0.3,
  });
}

/** Options of `cloud`. */
export interface CloudOpts extends NodeOpts {
  /** width in world units */
  size?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
  /** colour strength, 0 to 1 */
  fill?: number;
  /** see-through amount, 0 to 1 */
  alpha?: number;
}

/**
 * A cloud made of overlapping balls. Put it up in the air with `at: [x, y, z]`.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), cloud({ at: [0, 0, 1.5], size: 2.4 }));
 */
export function cloud(o: CloudOpts = {}): Spheres {
  const k = (o.size ?? 2) / 2;
  // x, y, z and radius of each ball, in units of half the cloud's width
  const shape: [number, number, number, number][] = [[-0.85, 0, 0.42, 0.46], [-0.3, 0.05, 0.7, 0.62], [0.45, 0, 0.62, 0.58], [0.95, 0, 0.38, 0.4], [0.1, -0.2, 0.36, 0.5]];
  const balls: [V3, number][] = shape
    .map(([x, y, z, r]) => [[x * k, y * k, z * k] as V3, r * k]);
  return new Spheres(balls, { ...o, role: o.role ?? 'faint', fill: o.fill ?? 0.5, outline: false, res: 16 });
}

/** Options of `server`. */
export interface ServerOpts extends NodeOpts {
  /** width in world units */
  width?: number;
  /** number of rack units */
  units?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/**
 * A rack of servers with indicator lights. `at` is the centre of its base.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), server({ at: [0, 0, 0], width: 1.8, units: 3 }));
 */
export function server(o: ServerOpts = {}): Group {
  const w = o.width ?? 1.8, units = o.units ?? 3, role = o.role ?? 'ink', h = w * 0.17, gap = w * 0.03, d = w * 0.9, g = new Group(o);
  for (let i = 0; i < units; i++) {
    const z = i * (h + gap), y = -d / 2 - 0.012;
    g.add(new Box({ at: [0, 0, z], size: [w, d, h], role }));
    g.add(new Path([[-w * 0.05, y, z + h / 2], [w * 0.42, y, z + h / 2]], { role: 'faint', width: 0.8 }));
    g.add(new Dot({ at: [-w * 0.4, y, z + h / 2], r: 1.5, role: i === 0 ? 'accent' : 'faint' }));
    g.add(new Dot({ at: [-w * 0.3, y, z + h / 2], r: 1.5, role: 'faint' }));
  }
  return g;
}

/** Options of `speaker`. */
export interface SpeakerOpts extends NodeOpts {
  /** height in world units */
  height?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/**
 * A loudspeaker cabinet with a woofer and a tweeter, facing the viewer.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), speaker({ at: [0, 0, 0], height: 1.8 }));
 */
export function speaker(o: SpeakerOpts = {}): Group {
  const h = o.height ?? 1.8, w = h * 0.58, d = w * 0.7, role = o.role ?? 'ink', g = new Group(o);
  g.add(new Box({ size: [w, d, h], role }));
  // n concentric circles, the innermost filled: a driver cone seen from the front
  const rings = (cx: number, cy: number, r: number, n: number) => Array.from({ length: n }, (_, i) => `<circle cx="${cx}" cy="${cy}" r="${r * (1 - i / n)}" fill="${i === n - 1 ? INK : 'none'}" fill-opacity=".35" stroke="${INK}" stroke-width="1.4" stroke-opacity=".8"/>`).join('');
  const svg = `<svg viewBox="0 0 100 ${100 / (w / h)}">${rings(50, (100 / (w / h)) * 0.7, 34, 3)}${rings(50, (100 / (w / h)) * 0.2, 13, 2)}</svg>`;
  g.add(new Plane({ svg, at: [-w / 2, -d / 2 - 0.004, 0], size: [w, h], border: false }));
  return g;
}

/** Options of `photoCamera`. */
export interface PhotoCameraOpts extends NodeOpts {
  /** size in world units */
  size?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/**
 * A photo camera with a lens, pointing at the viewer. For the abstract camera of a scene, see `cameraGlyph`.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), photoCamera({ at: [0, 0, 0], size: 1.5 }));
 */
export function photoCamera(o: PhotoCameraOpts = {}): Group {
  const s = o.size ?? 1.5, role = o.role ?? 'ink', w = s, d = s * 0.5, h = s * 0.6, g = new Group(o);
  g.add(new Box({ size: [w, d, h], role }));
  g.add(new Box({ at: [0, 0, h], size: [w * 0.3, d * 0.6, s * 0.14], role }));
  g.add(new Box({ at: [w * 0.32, 0, h], size: [w * 0.2, d * 0.5, s * 0.06], role: 'accent' }));
  const lens = new Group({ at: [0, -d / 2, h * 0.5], rot: [90, 0, 0] });
  lens.add(cylinder({ r: s * 0.27, h: s * 0.3, role }));
  lens.add(cylinder({ at: [0, 0, s * 0.3], r: s * 0.17, h: s * 0.02, role: 'accent', fill: 0.5 }));
  g.add(lens);
  return g;
}
