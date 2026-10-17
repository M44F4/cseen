import { Node, pushPlane, type NodeOpts, type Prim } from '../core/nodes.ts';
import type { V3 } from '../core/math.ts';
import { esc } from '../core/render.ts';
import { ACC, FAINT, FONT, K } from './svgplane.ts';

/** What a token is: plain text, a keyword, a string, a number or a comment. */
export type TokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment';
/** A piece of a line of code with its kind, for colouring. */
export interface Token {
  /** the characters of the piece */
  text: string;
  /** what the piece is */
  kind: TokenKind;
}

/** Words coloured as keywords: a blend of JavaScript, Python and Rust, since snippets in illustrations come from all three. */
const KEYWORDS = new Set((
  'const let var function return if else for while do switch case break continue new this class extends import from export default async await try catch finally throw typeof in of ' +
  'def lambda pass with as yield raise elif fn pub use mut impl struct enum trait match loop mod where type interface true false null undefined None True False self'
).split(' '));

/** One match per piece worth colouring, by capture group: 1 comment, 2 string, 3 number, 4 identifier (coloured only if a keyword). */
const TOKEN = /(\/\/.*$|(?:^|\s)#.*$)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

/** Splits a line of code into coloured pieces. Deliberately small: it suits snippets in illustrations, not an editor. */
export function tokenize(line: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (m[4] && !KEYWORDS.has(m[4])) continue;
    if (at > last) out.push({ text: line.slice(last, at), kind: 'plain' });
    if (m[1]) {
      const lead = m[1].length - m[1].trimStart().length; // a '#' comment may carry the space before it
      if (lead) out.push({ text: m[1].slice(0, lead), kind: 'plain' });
      out.push({ text: m[1].slice(lead), kind: 'comment' });
    } else out.push({ text: m[0], kind: m[2] ? 'string' : m[3] ? 'number' : 'keyword' });
    last = at + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), kind: 'plain' });
  return out;
}

/** One drawn row of text: a slice [start, end) of the source, and the source line it came from. */
export interface Row {
  /** index of the first character in the source */
  start: number;
  /** index after the last character */
  end: number;
  /** the source line the row belongs to */
  line: number;
  /** whether it is the first row of its source line */
  first: boolean;
}

/**
 * Splits text into rows that fit `cols` characters. The source is the lines joined with newlines, and rows
 * point into it, so typing progress (a count of source characters) means the same thing before and after wrapping.
 * `word` breaks at spaces (a long word is split), `char` breaks anywhere, `none` never breaks.
 */
export function layoutRows(lines: string[], cols: number, wrap: 'word' | 'char' | 'none'): Row[] {
  const rows: Row[] = [];
  let off = 0;
  lines.forEach((text, line) => {
    const base = off;
    off += text.length + 1;
    if (wrap === 'none' || text.length <= cols) { rows.push({ start: base, end: base + text.length, line, first: true }); return; }
    let i = 0, first = true;
    while (i < text.length) {
      let end = Math.min(text.length, i + cols), next = end;
      if (end < text.length) {
        if (wrap === 'word') {
          const sp = text.lastIndexOf(' ', end);
          if (sp > i) { end = sp; next = sp + 1; while (text[next] === ' ') next++; }
        }
      }
      rows.push({ start: base + i, end: base + end, line, first });
      first = false;
      i = next;
    }
  });
  return rows;
}

/** What a mark can match: a word, a pattern, or a [start, end) range of the source text. */
export type MarkKey = string | RegExp | [number, number];
/** Words to colour in a text block: a map from the word to a role or CSS colour, or a list of `[match, colour]` pairs where the match is a string, a regular expression or a `[start, end]` range. */
export type Marks = Record<string, string> | Array<[MarkKey, string]>;

const ROLES = new Set(['ink', 'faint', 'accent', 'grid', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']);
/** a role name (accent, faint, s3...) or any CSS colour */
const markColor = (c: string) => (ROLES.has(c) ? `var(--c-${c})` : c);

/** Options of `write` and `code`. */
export interface TextBlockOpts extends NodeOpts {
  /** the text, or an array of lines */
  text: string | string[];
  /** size of the plane in world units. Text is laid out inside it from the top left. */
  size?: [number, number];
  /** direction of the text's x axis and of its (upward) y axis. Defaults to a wall facing the viewer. */
  u?: V3;
  /** direction of the text's upward y axis */
  v?: V3;
  /** height of a line of text: world units, or 'sm' | 'md' | 'lg' relative to the box. Default fits the box. */
  fontSize?: number | 'sm' | 'md' | 'lg';
  /** or: this many lines fill the box */
  lines?: number;
  /** colour the pieces of code (keywords, strings, numbers, comments) */
  code?: boolean;
  /** show line numbers */
  numbers?: boolean;
  /** CSS colour of ordinary text. Defaults to the theme ink. */
  color?: string;
  /** margin inside the plane, in world units */
  pad?: number;
  /** distance between lines as a multiple of the font size */
  lineHeight?: number;
  /** show a cursor while typing, or always */
  cursor?: boolean | 'always';
  /** horizontal alignment inside the box */
  align?: 'start' | 'middle' | 'end';
  /** colour role of a line drawn around the plane (e.g. 'faint'), or false for none */
  border?: string | false;
  /** how to break long lines: at spaces (default), anywhere, or not at all */
  wrap?: 'word' | 'char' | 'none';
  /** when the text does not fit: make it smaller (default) or cut it off at the edge */
  overflow?: 'shrink' | 'clip';
  /** colour chosen words: { deploy: 'accent' } or [[/\d+/, 's2'], [[0, 4], 'faint']]. A role name or any CSS colour. */
  mark?: Marks;
  /** width of a character as a fraction of the font size. 0.6 suits the default monospace font. */
  charWidth?: number;
}

/** `fontSize: 'sm' | 'md' | 'lg'` as a fraction of the box height. */
const SIZES = { sm: 0.09, md: 0.14, lg: 0.22 };

/**
 * Text laid on a plane in the scene: a wall, the floor, a screen. It can be code, with colours.
 * It wraps to the plane and shrinks to fit, so it never runs past the edge.
 * `type` (0 to 1) is how much has been typed, so `typeOn(block)` animates it appearing letter by letter.
 */
export class TextBlock extends Node {
  o: TextBlockOpts;
  lines: string[];
  private cache?: { key: string; fs: number; rows: Row[]; kind: TokenKind[]; mark: (string | undefined)[] };
  constructor(o: TextBlockOpts) {
    super(o);
    this.o = o;
    this.lines = (Array.isArray(o.text) ? o.text : o.text.split('\n'));
    this.props.type = 1;
  }
  /** characters in the source, counting a newline after every line: the scale of `type` */
  get length(): number { return this.lines.reduce((n, l) => n + l.length + 1, 0); }

  /** the layout of the whole text: font size, rows, and the colour kind of every character */
  private layout() {
    const o = this.o, [w, h] = o.size ?? [2, 1], W = w * K, H = h * K;
    const key = JSON.stringify([w, h, o.fontSize, o.lines, o.pad, o.lineHeight, o.numbers, o.wrap, o.overflow, o.charWidth, this.lines, o.code, o.mark && JSON.stringify(o.mark, (_k, v) => (v instanceof RegExp ? `/${v.source}/${v.flags}` : v))]);
    if (this.cache?.key === key) return this.cache;
    const cw = o.charWidth ?? 0.6, lhk = o.lineHeight ?? 1.45, pad = (o.pad ?? 0.08) * K, wrap = o.wrap ?? 'word';
    const availH = H - 2 * pad;
    const asked = typeof o.fontSize === 'number' ? o.fontSize * K
      : o.fontSize ? SIZES[o.fontSize] * H
      : o.lines ? availH / (o.lines * lhk)
      : Math.min(0.14, h / Math.max(this.lines.length + 1, 6)) * K;
    let fs = asked, rows: Row[] = [];
    const longest = Math.max(1, ...this.lines.map((l) => l.length));
    for (let i = 0; i < 40; i++) {
      const gutter = o.numbers ? fs * 2.4 : 0, availW = W - 2 * pad - gutter;
      rows = layoutRows(this.lines, Math.max(1, Math.floor(availW / (cw * fs))), wrap);
      const fits = rows.length * fs * lhk - fs * (lhk - 1) <= availH + 0.01 && (wrap !== 'none' || longest * cw * fs <= availW + 0.01);
      if (fits || o.overflow === 'clip') break;
      fs *= 0.93;
    }
    // colour kind per character of the source
    const flat = this.lines.join('\n'), kind: TokenKind[] = new Array(flat.length).fill('plain');
    if (o.code) {
      let off = 0;
      for (const line of this.lines) {
        let at = off;
        for (const t of tokenize(line)) { kind.fill(t.kind, at, at + t.text.length); at += t.text.length; }
        off += line.length + 1;
      }
    }
    const mark: (string | undefined)[] = new Array(flat.length).fill(undefined);
    const pairs: Array<[MarkKey, string]> = !o.mark ? [] : Array.isArray(o.mark) ? o.mark : Object.entries(o.mark);
    for (const [k, c] of pairs) {
      const col = markColor(c);
      if (Array.isArray(k)) mark.fill(col, k[0], k[1]);
      else if (typeof k === 'string') { if (k) for (let i = flat.indexOf(k); i >= 0; i = flat.indexOf(k, i + k.length)) mark.fill(col, i, i + k.length); }
      else for (const m of flat.matchAll(new RegExp(k.source, k.flags.includes('g') ? k.flags : k.flags + 'g'))) if (m[0]) mark.fill(col, m.index!, m.index! + m[0].length);
    }
    return (this.cache = { key, fs, rows, kind, mark });
  }

  /** draws the rows typed so far, one `<text>` per row with a `<tspan>` per run of one colour */
  collect(out: Prim[]) {
    const op = this.opacityEff;
    if (op <= 0) return;
    const o = this.o, [w, h] = o.size ?? [2, 1];
    const W = w * K, H = h * K, { fs, rows, kind, mark } = this.layout(), lh = fs * (o.lineHeight ?? 1.45), pad = (o.pad ?? 0.08) * K;
    const color = o.color ?? 'var(--c-ink)', flat = this.lines.join('\n');
    const typed = Math.round((this.props.type as number) * this.length);
    const gutter = o.numbers ? fs * 2.4 : 0;
    const anchor = o.align ?? 'start';
    const x0 = anchor === 'start' ? pad + gutter : anchor === 'middle' ? W / 2 : W - pad;
    const fillOf = (k: TokenKind, m: string | undefined) =>
      m ?? (k === 'keyword' || k === 'number' ? ACC : k === 'string' ? `color-mix(in oklab, ${ACC} 55%, ${color})` : k === 'comment' ? FAINT : color);
    let body = '';
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], y = pad + fs + i * lh, nextStart = i + 1 < rows.length ? rows[i + 1].start : Infinity;
      if (typed < r.start) break; // nothing typed on this row yet
      const stop = Math.min(r.end, typed);
      const active = typed < this.length && typed >= r.start && typed < nextStart;
      let spans = '';
      for (let a = r.start; a < stop;) {
        let b = a + 1;
        while (b < stop && kind[b] === kind[a] && mark[b] === mark[a]) b++;
        spans += `<tspan fill="${fillOf(kind[a], mark[a])}">${esc(flat.slice(a, b))}</tspan>`;
        a = b;
      }
      if (o.cursor && (active || (o.cursor === 'always' && i === rows.length - 1))) spans += `<tspan fill="${ACC}">█</tspan>`;
      if (o.numbers && r.first) body += `<text x="${pad + gutter - fs * 0.8}" y="${y}" text-anchor="end" fill="${FAINT}" font-size="${fs * 0.85}">${r.line + 1}</text>`;
      if (spans) body += `<text x="${x0}" y="${y}" text-anchor="${anchor}" xml:space="preserve">${spans}</text>`;
    }
    const inner = `<svg x="0" y="0" width="${W}" height="${H}" overflow="hidden"><g font-family="${FONT}" font-size="${fs}">${body}</g></svg>`;
    pushPlane(this, { size: [w, h], u: o.u, v: o.v, svg: { box: [0, 0, W, H], inner }, cells: 6, border: o.border ?? false, opacity: op }, out);
  }
}

/**
 * Text on any plane: `write('hello', { at, size, u, v })`. Put it on a floor, a wall, or a screen.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * s.add(write(['Hello,', 'floor.'], { at: [-2, -1, 0], size: [4, 1.6], fontSize: 0.7, u: [1, 0, 0], v: [0, 1, 0] }));
 */
export const write = (text: string | string[], o: Omit<TextBlockOpts, 'text'> = {}) => new TextBlock({ ...o, text });
/**
 * Code on any plane, coloured, optionally numbered. Animate it with `typeOn`.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * const src = s.add(code(['let total = 0;', 'for (const n of list) {', '  total += n;', '}'], { at: [-3, 0, -1], size: [6, 2.4], fontSize: 0.5 }));
 *
 * const tl = new Timeline();
 * tl.play(typeOn(src, 3));
 * tl.lockFit(s);
 */
export const code = (src: string | string[], o: Omit<TextBlockOpts, 'text' | 'code'> = {}) => new TextBlock({ cursor: true, ...o, text: src, code: true });
