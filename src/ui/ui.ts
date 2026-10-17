import { layoutRows } from '../draw/text.ts';
import { clamp } from '../core/math.ts';
import { SvgPlane, colourOf, esc, INK, BG, FAINT, ACC, SURF, type SvgPlaneOpts } from '../draw/svgplane.ts';

// Elements that live on a screen: a progress bar, a notification, a chat. All are drawn on a plane and fade and slide with their props.

/** Options shared by everything that lives on a screen. */
export type UiOpts = SvgPlaneOpts & {
  /** colour role or CSS colour of the highlights. Default accent. */
  role?: string;
};

/** Shared by everything below: an SVG plane with a highlight colour. */
abstract class UiNode extends SvgPlane {
  declare o: UiOpts;
  constructor(o: UiOpts, size: [number, number]) { super(o, size); }
  protected get tint() { return colourOf(this.o.role ?? 'accent'); }
}

/**
 * Word-wraps one line of text to `cols` characters. With `maxRows`, any extra text is dropped and the last row ends in an
 * ellipsis, so a long message shows that it was cut instead of stopping mid-sentence.
 */
function wrap(text: string, cols: number, maxRows = Infinity): string[] {
  cols = Math.max(1, cols);
  const rows = layoutRows([text], cols, 'word').map((r) => text.slice(r.start, r.end));
  if (rows.length <= maxRows) return rows;
  const out = rows.slice(0, maxRows), last = out[maxRows - 1];
  out[maxRows - 1] = (last.length >= cols ? last.slice(0, cols - 1) : last) + '\u2026';
  return out;
}
/** Cuts a single line to `cols` characters, ending in an ellipsis, so a long title stays inside its card. */
const clip = (text: string, cols: number) => wrap(text, cols, 1)[0];
/** the rounded, outlined card behind a notification, toast or dialog, drawn over the page colour so it stays opaque */
const card = (W: number, H: number, r: number) =>
  `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${r}" fill="${BG}"/><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${r}" fill="${SURF}" stroke="${INK}" stroke-opacity=".45" stroke-width="1.2"/>`;

/* ------------------------------------------------------------------ progress */

/** Options of `progress`. */
export interface ProgressOpts extends UiOpts {
  /** a bar, a ring, or a bar of separate segments */
  kind?: 'bar' | 'ring' | 'segments';
  /** how far along, 0 to 1. Animatable. */
  value?: number;
  /** show the percentage (true), or your own text */
  label?: boolean | string;
  /** number of segments, for kind 'segments' */
  segments?: number;
}

/** A progress indicator. Animate `value` (0 to 1): `tween(p, { value: 1 }, { duration: 2 })`. */
export class Progress extends UiNode {
  declare o: ProgressOpts;
  constructor(o: ProgressOpts = {}) {
    super(o, o.kind === 'ring' ? [1, 1] : [3, 0.34]);
    this.props.value = o.value ?? 0;
  }
  draw(W: number, H: number): string {
    const v = clamp(this.props.value as number), kind = this.o.kind ?? 'bar', t = this.tint;
    // custom labels are shrunk to fit the room set aside for them (monospace glyphs are 0.6 of the font size wide)
    const text = this.o.label === undefined || this.o.label === false ? '' : typeof this.o.label === 'string' ? this.o.label : `${Math.round(v * 100)}%`;
    if (kind === 'ring') {
      const r = Math.max(0, Math.min(W, H) / 2 - 8), c = 2 * Math.PI * r, fs = Math.min(r * 0.5, (r * 1.6) / (0.6 * text.length));
      return `<circle cx="${W / 2}" cy="${H / 2}" r="${r}" fill="none" stroke="${INK}" stroke-opacity=".15" stroke-width="7"/>
        <circle cx="${W / 2}" cy="${H / 2}" r="${r}" fill="none" stroke="${t}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c * v} ${c}" transform="rotate(-90 ${W / 2} ${H / 2})"/>
        ${text ? `<text x="${W / 2}" y="${H / 2 + r * 0.17}" text-anchor="middle" font-size="${fs}" fill="${INK}">${esc(text)}</text>` : ''}`;
    }
    const labelW = text ? H * 2.2 : 0, labelFs = Math.min(H * 0.46, (labelW * 0.95) / (0.6 * text.length)), bw = W - labelW, bh = H * 0.5, y = (H - bh) / 2;
    let bar: string;
    if (kind === 'segments') {
      const n = this.o.segments ?? 10, gap = bw * 0.015, sw = (bw - gap * (n - 1)) / n;
      bar = Array.from({ length: n }, (_, i) => {
        const on = clamp(v * n - i);
        return `<rect x="${i * (sw + gap)}" y="${y}" width="${sw}" height="${bh}" rx="${bh * 0.2}" fill="${INK}" fill-opacity=".14"/>` +
          (on > 0 ? `<rect x="${i * (sw + gap)}" y="${y}" width="${sw * on}" height="${bh}" rx="${bh * 0.2}" fill="${t}"/>` : '');
      }).join('');
    } else {
      bar = `<rect x="0" y="${y}" width="${bw}" height="${bh}" rx="${bh / 2}" fill="${INK}" fill-opacity=".14"/>` +
        (v > 0 ? `<rect x="0" y="${y}" width="${Math.max(bh, bw * v)}" height="${bh}" rx="${bh / 2}" fill="${t}"/>` : '');
    }
    return bar + (text ? `<text x="${W}" y="${H / 2 + H * 0.17}" text-anchor="end" font-size="${labelFs}" fill="${INK}">${esc(text)}</text>` : '');
  }
}

/**
 * A progress indicator as a bar, a ring or separate segments. Animate `value` from 0 to 1.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const m = s.add(monitor({ at: [0, 0, 0], width: 3 }));
 * m.put(progress({ kind: 'bar', label: true }), { at: [0.1, 0.5], width: 0.8 });
 */
export const progress = (o: ProgressOpts = {}) => new Progress(o);

/* ------------------------------------------------------------------ notification, toast, dialog, badge */

/** Options of `notification`. */
export interface NotificationOpts extends UiOpts {
  /** the heading */
  title?: string;
  /** the message */
  body?: string;
  /** show an icon */
  icon?: boolean;
}

/** A notification card. `slide` (0 to 1) brings it in from above: animate it with `tween(n, { slide: 1 })`. */
export class Notification extends UiNode {
  declare o: NotificationOpts;
  constructor(o: NotificationOpts = {}) {
    super(o, [2.6, 0.8]);
    this.props.slide = 1;
  }
  draw(W: number, H: number): string {
    const s = clamp(this.props.slide as number), pad = H * 0.16, fs = H * 0.18, t = this.tint, icon = this.o.icon !== false;
    const x0 = pad + (icon ? H * 0.46 : 0), cols = Math.floor((W - x0 - pad) / (fs * 0.6));
    const body = wrap(this.o.body ?? '', cols, 2), title = clip(this.o.title ?? '', Math.floor(cols / 1.05));
    const ease = 1 - (1 - s) ** 3;
    return `<g opacity="${ease}" transform="translate(0 ${-(1 - ease) * H * 0.3})">${card(W, H, H * 0.14)}
      ${icon ? `<rect x="${pad}" y="${pad}" width="${H * 0.34}" height="${H * 0.34}" rx="${H * 0.08}" fill="${t}"/>` : ''}
      ${title ? `<text x="${x0}" y="${pad + fs}" font-size="${fs * 1.05}" font-weight="700" fill="${INK}">${esc(title)}</text>` : ''}
      ${body.map((l, i) => `<text x="${x0}" y="${pad + fs * 2.35 + i * fs * 1.3}" font-size="${fs}" fill="${FAINT}">${esc(l)}</text>`).join('')}</g>`;
  }
}

/**
 * A notification card with a title, a body and an optional icon.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const p = s.add(phone({ at: [0, 0, 0], height: 2.4 }));
 * p.put(notification({ title: 'Deploy finished', body: 'my.app is live.' }), { at: [0.05, 0.8], width: 0.9 });
 */
export const notification = (o: NotificationOpts = {}) => new Notification(o);

/** Options of `toast`. */
export interface ToastOpts extends UiOpts {
  /** the message */
  text?: string;
}

/** A small pill with one line of text. `slide` (0 to 1) brings it up from below. */
export class Toast extends UiNode {
  declare o: ToastOpts;
  constructor(o: ToastOpts = {}) {
    super(o, [Math.max(1.2, (o.text ?? '').length * 0.075 + 0.7), 0.34]);
    this.props.slide = 1;
  }
  draw(W: number, H: number): string {
    const s = clamp(this.props.slide as number), e = 1 - (1 - s) ** 3;
    return `<g opacity="${e}" transform="translate(0 ${(1 - e) * H * 0.8})">${card(W, H, H / 2)}
      <circle cx="${H * 0.5}" cy="${H / 2}" r="${H * 0.14}" fill="${this.tint}"/>
      <text x="${H * 0.82}" y="${H / 2 + H * 0.13}" font-size="${H * 0.36}" fill="${INK}">${esc(this.o.text ?? '')}</text></g>`;
  }
}

/**
 * A short message in a pill, such as a confirmation.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const m = s.add(monitor({ at: [0, 0, 0], width: 3 }));
 * m.put(toast({ text: 'Saved' }), { at: [0.3, 0.45], width: 0.4 });
 */
export const toast = (o: ToastOpts = {}) => new Toast(o);

/** Options of `dialog`. */
export interface DialogOpts extends UiOpts {
  /** the heading */
  title?: string;
  /** the message */
  body?: string;
  /** button labels, the last one is the main action */
  buttons?: string[];
}

/** A dialog box with a title, text and buttons. The last button is the main one. `pop` (0 to 1) opens it. */
export class Dialog extends UiNode {
  declare o: DialogOpts;
  constructor(o: DialogOpts = {}) {
    super(o, [2.4, 1.4]);
    this.props.pop = 1;
  }
  draw(W: number, H: number): string {
    const p = clamp(this.props.pop as number), e = 1 - (1 - p) ** 3, k = 0.92 + 0.08 * e, pad = H * 0.09, fs = H * 0.095;
    const buttons = this.o.buttons ?? ['Cancel', 'OK'], bh = H * 0.2;
    // three lines of body is what fits above the buttons
    const cols = Math.floor((W - 2 * pad) / (fs * 0.6)), body = wrap(this.o.body ?? '', cols, 3), title = clip(this.o.title ?? '', Math.floor(cols / 1.25));
    // buttons are laid out from the right; if they are too wide for the card together, they and their text shrink to fit
    const widths = buttons.map((b) => b.length * fs * 0.62 + fs * 2), gapX = pad * 0.7;
    const need = widths.reduce((n, w) => n + w, 0) + gapX * Math.max(0, buttons.length - 1);
    const fit = need > W - 2 * pad ? (W - 2 * pad) / need : 1, bfs = fs * fit;
    let x = W - pad;
    const btn = buttons.map((b, i) => [b, i] as const).reverse().map(([b, i]) => {
      const bw = widths[i] * fit, main = i === buttons.length - 1;
      x -= bw;
      const r = `<rect x="${x}" y="${H - pad - bh}" width="${bw}" height="${bh}" rx="${bh * 0.25}" fill="${main ? this.tint : 'none'}" stroke="${main ? 'none' : INK}" stroke-opacity=".5" stroke-width="1.1"/>` +
        `<text x="${x + bw / 2}" y="${H - pad - bh / 2 + bfs * 0.34}" text-anchor="middle" font-size="${bfs}" fill="${main ? BG : INK}">${esc(b)}</text>`;
      x -= gapX * fit;
      return r;
    }).join('');
    return `<g opacity="${e}" transform="translate(${W / 2} ${H / 2}) scale(${k}) translate(${-W / 2} ${-H / 2})">${card(W, H, H * 0.06)}
      ${title ? `<text x="${pad}" y="${pad + fs * 1.1}" font-size="${fs * 1.25}" font-weight="700" fill="${INK}">${esc(title)}</text>` : ''}
      ${body.map((l, i) => `<text x="${pad}" y="${pad + fs * 3.1 + i * fs * 1.4}" font-size="${fs}" fill="${FAINT}">${esc(l)}</text>`).join('')}${btn}</g>`;
  }
}

/**
 * A dialog box with a title, a body and buttons.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const m = s.add(monitor({ at: [0, 0, 0], width: 3.4 }));
 * m.put(dialog({ title: 'Delete project?', body: 'This cannot be undone.', buttons: ['Cancel', 'Delete'], size: [2.4, 1.4] }), { at: [0.2, 0.2], width: 0.6 });
 */
export const dialog = (o: DialogOpts = {}) => new Dialog(o);

/** Options of `badge`. */
export interface BadgeOpts extends UiOpts {
  /** the number shown */
  count?: number;
}

/** The little count on an icon. Animate `count`; it hides at 0. */
export class Badge extends UiNode {
  declare o: BadgeOpts;
  constructor(o: BadgeOpts = {}) {
    super(o, [0.3, 0.3]);
    this.props.count = o.count ?? 1;
  }
  draw(W: number, H: number): string {
    const n = Math.round(this.props.count as number);
    if (n <= 0) return '';
    const label = n > 99 ? '99+' : String(n), w = Math.max(H, H * 0.34 * label.length + H * 0.45);
    return `<rect x="${W / 2 - w / 2}" y="0" width="${w}" height="${H}" rx="${H / 2}" fill="${this.tint}"/>
      <text x="${W / 2}" y="${H / 2 + H * 0.17}" text-anchor="middle" font-size="${H * 0.5}" font-weight="700" fill="${BG}">${label}</text>`;
  }
}

/**
 * A small round badge with a count, such as an unread marker.
 *
 * @example
 * const s = new Scene();
 * s.add(ground(), badge({ count: 3, at: [0, 0, 1.5], size: [0.5, 0.5] }));
 */
export const badge = (o: BadgeOpts = {}) => new Badge(o);

/* ------------------------------------------------------------------ chat */

/** One chat message: who sent it and what it says. */
export interface Message {
  /** who wrote it: `me` is on the right, `them` on the left */
  from: 'me' | 'them';
  /** what it says */
  text: string;
}
/** Options of `chat`. */
export interface ChatOpts extends UiOpts {
  /** the conversation so far */
  messages?: Message[];
  /** show typing dots after the last message */
  typing?: boolean;
}

/**
 * A conversation: messages from `me` on the right in the accent colour, from `them` on the left.
 * `shown` counts how many messages are visible, so `tween(chat, { shown: 3 })` brings them in one by one.
 * While the next message from `them` has not arrived, three typing dots show where it will appear, then the message replaces them.
 * A long conversation scrolls like a real chat: when the text is already at its smallest and still does not fit, the oldest messages leave.
 */
export class Chat extends UiNode {
  declare o: ChatOpts;
  messages: Message[];
  constructor(o: ChatOpts = {}) {
    super(o, [2, 2.2]);
    this.messages = o.messages ?? [];
    this.props.shown = this.messages.length;
  }
  draw(W: number, H: number): string {
    const shown = this.props.shown as number, pad = W * 0.04, gapY = H * 0.022;
    const maxBubble = W * 0.78;
    // font size that lets every message fit the height, found once for the whole conversation
    let fs = Math.min(W * 0.075, H * 0.07), rows: string[][] = [];
    // height of a bubble with this many lines of text
    const bubbleH = (lines: number) => lines * fs * 1.35 + fs * 1.1;
    for (let i = 0; i < 30; i++) {
      const cols = Math.floor((maxBubble - fs * 1.4) / (fs * 0.6));
      rows = this.messages.map((m) => wrap(m.text, cols));
      // the extra fs * 2.4 leaves room for the typing dots
      const total = rows.reduce((n, r) => n + bubbleH(r.length) + gapY, 0) + fs * 2.4;
      if (total <= H - 2 * pad) break;
      fs *= 0.93;
    }
    // the first message that is still on screen: older ones scroll off when even the smallest text does not fit
    let first = 0, used = rows.reduce((n, r) => n + bubbleH(r.length) + gapY, 0) + fs * 2.4;
    while (first < rows.length - 1 && used > H - 2 * pad) { used -= bubbleH(rows[first].length) + gapY; first++; }
    let y = pad, out = '';
    const t = this.tint, typing = this.o.typing === true;
    // a message from them waits behind its typing dots for the first half of its turn
    const wait = (m: Message) => (typing && m.from === 'them' ? 0.5 : 0);
    this.messages.forEach((m, i) => {
      if (i < first) return;
      const a = clamp((shown - i - wait(m)) / (1 - wait(m))), lines = rows[i], bh = bubbleH(lines.length);
      const bw = Math.min(maxBubble, Math.max(...lines.map((l) => l.length)) * fs * 0.6 + fs * 1.4);
      const x = m.from === 'me' ? W - pad - bw : pad, e = 1 - (1 - a) ** 3;
      if (a > 0) {
        const fill = m.from === 'me' ? t : SURF;
        out += `<g opacity="${e}" transform="translate(0 ${(1 - e) * fs * 0.8})">
          <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${fs * 0.7}" fill="${BG}"/>
          <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${fs * 0.7}" fill="${fill}" ${m.from === 'me' ? '' : `stroke="${INK}" stroke-opacity=".3" stroke-width="1"`}/>
          ${lines.map((l, j) => `<text x="${x + fs * 0.7}" y="${y + fs * 1.15 + j * fs * 1.35}" font-size="${fs}" fill="${m.from === 'me' ? BG : INK}">${esc(l)}</text>`).join('')}</g>`;
      }
      y += bh + gapY;
    });
    // typing dots after the last visible message
    const next = this.messages[Math.floor(shown)];
    if (typing && next && next.from === 'them' && shown - Math.floor(shown) < wait(next)) {
      const bw = fs * 3.2, bh = fs * 1.9, x = pad, yy = this.messages.slice(first, Math.floor(shown)).reduce((n, _m, i) => n + bubbleH(rows[first + i].length) + gapY, pad);
      out += `<rect x="${x}" y="${yy}" width="${bw}" height="${bh}" rx="${bh / 2}" fill="${SURF}" stroke="${INK}" stroke-opacity=".3" stroke-width="1"/>` +
        [0, 1, 2].map((d) => `<circle cx="${x + bw * (0.27 + d * 0.23)}" cy="${yy + bh / 2}" r="${fs * 0.2}" fill="${FAINT}"/>`).join('');
    }
    return out;
  }
}

/**
 * A chat: bubbles from you and from them, with typing dots. Animate `typeOn` per message.
 *
 * @example
 * const s = new Scene();
 * s.add(ground());
 * const p = s.add(phone({ at: [0, 0, 0], height: 2.6 }));
 * p.put(chat({ messages: [{ from: 'them', text: 'Is it live?' }, { from: 'me', text: 'Yes, just now.' }] }), { at: [0.05, 0.1], width: 0.9 });
 */
export const chat = (o: ChatOpts = {}) => new Chat(o);
