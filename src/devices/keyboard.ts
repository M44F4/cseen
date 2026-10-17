import { Box, Group, Node, type NodeOpts, type Prim } from '../core/nodes.ts';
import type { V3 } from '../core/math.ts';
import { seq, tween, wait, type Anim } from '../anim/timeline.ts';

/* ------------------------------------------------------------------ layouts */

/** One key: its place on the board in key units (1 is a standard key), measured from the top left. */
export interface KeyDef {
  /** the key's name, for `press` and `lit` */
  id: string;
  /** distance from the left edge in key units */
  x: number;
  /** distance from the top edge in key units */
  y: number;
  /** width in key units */
  w: number;
  /** height in key units */
  h: number;
  /** the row it belongs to */
  row: number;
}

/**
 * A row is a list of tokens: `id` (a 1 unit key), `id:w` (a wider key), `id:w:h` (a taller key), `_n` (a gap of n units).
 * Keys do not carry legends, so ids are only names for finding keys: 'A', 'Enter', 'Space', 'LShift'...
 * Adds the keys to `out` and returns the x where the row ends.
 */
function parse(row: number, x0: number, y: number, spec: string, out: KeyDef[]): number {
  let x = x0;
  for (const tok of spec.split(/\s+/).filter(Boolean)) {
    if (tok[0] === '_' && tok.length > 1) { x += parseFloat(tok.slice(1)); continue; }
    const [id, w = '1', h = '1'] = tok.split(':');
    out.push({ id, x, y, w: parseFloat(w), h: parseFloat(h), row });
    x += parseFloat(w);
  }
  return x;
}

/** A keyboard layout: `full` (104 keys), `tkl` (87), `75` or `60`. */
export type KeyboardLayout = 'full' | 'tkl' | '75' | '60';

/** the standard ANSI rows, with an ISO variant of the left shift and the enter key */
function mainRows(iso: boolean): string[] {
  return [
    '` 1 2 3 4 5 6 7 8 9 0 - = Bksp:2',
    iso ? 'Tab:1.5 Q W E R T Y U I O P [ ] Enter:1.5' : 'Tab:1.5 Q W E R T Y U I O P [ ] \\:1.5',
    iso ? 'Caps:1.75 A S D F G H J K L ; \' # Enter2:1.25' : 'Caps:1.75 A S D F G H J K L ; \' Enter:2.25',
    iso ? 'LShift:1.25 \\ Z X C V B N M , . / RShift:2.75' : 'LShift:2.25 Z X C V B N M , . / RShift:2.75',
    'LCtrl:1.25 LWin:1.25 LAlt:1.25 Space:6.25 RAlt:1.25 RWin:1.25 Menu:1.25 RCtrl:1.25',
  ];
}

/** Every key of a layout, with its place. Exported so a layout can be inspected, tested or drawn some other way. */
export function keyboardLayout(layout: KeyboardLayout = 'full', iso = false): { keys: KeyDef[]; width: number; depth: number } {
  const keys: KeyDef[] = [];
  const main = mainRows(iso);
  let width = 15, depth: number;
  if (layout === '60') {
    main.forEach((r, i) => parse(i + 1, 0, i, r, keys));
    depth = 5;
  } else if (layout === '75') {
    parse(0, 0, 0, 'Esc F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 Prt Ins Del', keys);
    // the same rows as the main block, with a column of navigation keys added and a shorter right shift
    parse(1, 0, 1.25, main[0] + ' PgUp', keys);
    parse(2, 0, 2.25, main[1] + ' PgDn', keys);
    parse(3, 0, 3.25, main[2] + ' Home', keys);
    parse(4, 0, 4.25, main[3].replace('RShift:2.75', 'RShift:1.75') + ' Up End', keys);
    parse(5, 0, 5.25, 'LCtrl:1.25 LWin:1.25 LAlt:1.25 Space:6.25 RAlt RFn RCtrl Left Down Right', keys);
    width = 16; depth = 6.25;
  } else {
    // function row, a half key of space, then the five main rows
    parse(0, 0, 0, 'Esc _1 F1 F2 F3 F4 _0.5 F5 F6 F7 F8 _0.5 F9 F10 F11 F12', keys);
    main.forEach((r, i) => parse(i + 1, 0, 1.5 + i, r, keys));
    depth = 6.5;
    const nav = 15.25;
    parse(0, nav, 0, 'Prt Scr Pau', keys);
    parse(1, nav, 1.5, 'Ins Home PgUp', keys);
    parse(2, nav, 2.5, 'Del End PgDn', keys);
    parse(4, nav + 1, 4.5, 'Up', keys);
    parse(5, nav, 5.5, 'Left Down Right', keys);
    width = nav + 3;
    if (layout === 'full') {
      const np = nav + 3.25;
      parse(1, np, 1.5, 'NLk N/ N* N-', keys);
      parse(2, np, 2.5, 'N7 N8 N9 N+:1:2', keys);
      parse(3, np, 3.5, 'N4 N5 N6', keys);
      parse(4, np, 4.5, 'N1 N2 N3 NEnter:1:2', keys);
      parse(5, np, 5.5, 'N0:2 N.', keys);
      width = np + 4;
    }
  }
  return { keys, width, depth };
}

/**
 * Key heights by row. `tilt` is how much higher the back edge of a cap is than the front, in key units, which
 * gives the board its stepped, sculpted look from the side. Rows are 0 (function row) to 5 (space bar row).
 */
const PROFILE: Record<number, { front: number; tilt: number }> = {
  0: { front: 0.3, tilt: 0.05 }, 1: { front: 0.32, tilt: 0.17 }, 2: { front: 0.3, tilt: 0.1 },
  3: { front: 0.3, tilt: 0.04 }, 4: { front: 0.31, tilt: -0.02 }, 5: { front: 0.36, tilt: -0.1 },
};

/* ------------------------------------------------------------------ one key */

/** The shape of one keycap in board space: its footprint, the height of its front and back edges, and the inset `t` of the top face. */
interface Cap { x0: number; y0: number; x1: number; y1: number; zf: number; zb: number; t: number }

/** A single keycap. `press` (0 to 1) pushes it down, `lit` (0 to 1) tints it toward the accent colour. */
export class Key extends Node {
  /** where this key sits on the board and what it is called */
  def: KeyDef;
  private cap: Cap;
  private role: string;
  /** `z` is the height of the plate the key stands on */
  constructor(def: KeyDef, cap: Cap, role: string, z: number) {
    super({ at: [0, 0, z] });
    this.def = def; this.cap = cap; this.role = role;
    this.props.press = 0;
    this.props.lit = 0;
  }
  /** draws the cap as a top face and four sloped sides. Pressing shortens the cap; `lit` raises the fill and mixes in the accent. */
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    const { x0, y0, x1, y1, t } = this.cap;
    const k = 1 - 0.4 * (this.props.press as number), zf = this.cap.zf * k, zb = this.cap.zb * k;
    const lit = this.props.lit as number;
    const B = (x: number, y: number): V3 => [x, y, 0];
    const a = B(x0, y0), b = B(x1, y0), c = B(x1, y1), d = B(x0, y1);
    const A: V3 = [x0 + t, y0 + t, zf], Bt: V3 = [x1 - t, y0 + t, zf], C: V3 = [x1 - t, y1 - t, zb], D: V3 = [x0 + t, y1 - t, zb];
    const w = (n: V3): V3 => { const o = this.world([0, 0, 0]), p = this.world(n); return [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; };
    const faces: [V3, V3[]][] = [
      [[0, 0, 1], [A, Bt, C, D]],
      [[0, -1, 0.25], [a, b, Bt, A]],
      [[0, 1, 0.25], [c, d, D, C]],
      [[-1, 0, 0.25], [d, a, A, D]],
      [[1, 0, 0.25], [b, c, C, Bt]],
    ];
    faces.forEach(([n, pts], i) => out.push({
      key: `${this.id}:${i}`, kind: 'path', pts: pts.map((p) => this.world(p)), closed: true, face: true, role: this.role,
      opacity: op, layer: this.layerEff, fill: (i === 0 ? 0.1 : 0.16) + lit * 0.6, alpha: 1, shade: true, mix: lit || undefined,
      cull: true, normal: w(n), width: 0.7, group: this.id,
    }));
  }
}

/* ------------------------------------------------------------------ the board */

/** Options of `keyboard`. */
export interface KeyboardOpts extends NodeOpts {
  /** 'full' (104 keys), 'tkl' (87), '75' or '60' */
  layout?: KeyboardLayout;
  /** the ISO shape for the left shift and the enter key */
  iso?: boolean;
  /** total width in world units. Default is 0.18 per key unit. */
  width?: number;
  /** how far the back of the board is raised, in degrees. Desk keyboards have a little. */
  tilt?: number;
  /** colour role (`ink`, `faint`, `accent`, `s1` to `s8`) or a role you define in CSS */
  role?: string;
}

/** characters that type a named key rather than the key with the same letter */
const CHARS: Record<string, string> = { ' ': 'Space', '\n': 'Enter', '\t': 'Tab' };

/** A keyboard with accurate key sizes and positions and no legends. Keys are found by id: `kb.key('A')`. */
export class Keyboard extends Group {
  /** every key by id */
  keys = new Map<string, Key>();
  /** width and depth of the board in world units */
  size: [number, number];
  /** `width` sets the scale: one key unit is `width` over the layout's width plus a half unit of rim on each side */
  constructor(o: KeyboardOpts = {}) {
    super(o);
    const L = keyboardLayout(o.layout ?? 'full', o.iso), role = o.role ?? 'ink';
    const margin = 0.5, U = (o.width ?? (L.width + margin * 2) * 0.18) / (L.width + margin * 2), plateH = 0.22 * U, gap = 0.055 * U, taper = 0.1 * U;
    const W = (L.width + margin * 2) * U, D = (L.depth + margin * 2) * U;
    this.size = [W, D];
    const tilted = new Group({ at: [0, -D / 2, 0], rot: [o.tilt ?? 5, 0, 0] });
    tilted.add(new Box({ at: [0, D / 2, 0], size: [W, D, plateH], role, fill: 0.1 }));
    for (const def of L.keys) {
      const x0 = (margin + def.x) * U + gap, x1 = (margin + def.x + def.w) * U - gap;
      const yTop = D - (margin + def.y) * U, y0 = yTop - def.h * U + gap, y1 = yTop - gap;
      const p = PROFILE[def.row] ?? PROFILE[3];
      const flat = def.id === 'Space' ? 0.5 : 1, hf = p.front * U, hb = hf + p.tilt * U * flat;
      const key = new Key(def, { x0: x0 - W / 2, x1: x1 - W / 2, y0, y1, t: taper, zf: hf, zb: hb }, role, plateH);
      tilted.add(key);
      this.keys.set(def.id, key);
    }
    this.add(tilted);
  }
  /** a key by id, e.g. 'A', 'Enter', 'Space', 'LShift', 'F5'. Throws if there is no such key. */
  key(id: string): Key {
    const k = this.keys.get(id) ?? this.keys.get(id.toUpperCase());
    if (!k) throw new Error(`cseen: no key "${id}" on this keyboard`);
    return k;
  }
  /** presses a key down and up again (as an animation) */
  press(id: string, hold = 0.12): Anim {
    const k = this.key(id);
    return seq(tween(k, { press: 1 }, { duration: hold * 0.5, ease: 'out' }), tween(k, { press: 0 }, { duration: hold * 0.9, ease: 'inOut' }));
  }
  /** types a string: one press per character, so a keyboard can drive a typing animation. Letters and digits map to keys; keys it cannot find are skipped. */
  type(text: string, o: { gap?: number; hold?: number } = {}): Anim {
    const gap = o.gap ?? 0.08, steps: Anim[] = [];
    for (const ch of text) {
      const id = CHARS[ch] ?? ch.toUpperCase();
      if (!this.keys.has(id)) { steps.push(wait(gap)); continue; }
      steps.push(this.press(id, o.hold), wait(gap));
    }
    return seq(...steps);
  }
}

/**
 * A keyboard. `keyboard({ layout: 'tkl' })`, then `kb.press('A')` or `kb.type('hello')` to animate it.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), keyboard({ at: [0, 0, 0], layout: 'tkl' }));
 */
export const keyboard = (o: KeyboardOpts = {}) => new Keyboard(o);
