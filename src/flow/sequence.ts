import { Group, type NodeOpts } from '../core/nodes.ts';
import { DiagramEdge, DiagramNode, CW, FS, sizeOf, widest } from './flow.ts';
import type { P2 } from './layout.ts';

/** One message of a sequence diagram: an arrow from one participant to another. */
export interface SequenceMessage {
  /** the id of the participant it leaves */
  from: string;
  /** the id of the participant it reaches. The same as `from` draws a loop back to itself. */
  to: string;
  /** a few words on the arrow */
  label?: string;
  /** a reply is drawn dashed, as the answer to an earlier call */
  reply?: boolean;
  /** colour role of this arrow */
  role?: string;
}

/** A note on a sequence diagram, in the list of messages where it happens. */
export interface SequenceNote {
  /** what the note says; `\n` breaks a line */
  note: string;
  /** the participant it sits on, or two, to stretch across them */
  over: string | [string, string];
}

/** What a sequence diagram shows. */
export interface SequenceSpec {
  /** the columns from left to right: an id, or `{ id, label }` when the box should say something else */
  participants: (string | { id: string; label?: string })[];
  /** the messages in time order, from the top down, with notes among them */
  messages: (SequenceMessage | SequenceNote)[];
}

/** Options of `sequence`. */
export interface SequenceOpts extends NodeOpts {
  /** colour role of everything that does not set its own */
  role?: string;
}

/* the page distances of a sequence diagram, in world units */
const ROW = 0.9, LOOP = [0.7, 0.5], HEAD_GAP = 0.3, NOTE_PAD = 0.4;

/** the width a label needs on the page, the same as the label of an edge */
const labelW = (t: string) => widest(t) * CW + 0.3;

/**
 * Participants as boxes along the top, each with a dashed lifeline below it, and messages as arrows between the lifelines
 * in the order they happen, time flowing down. The spacing is worked out from the labels, so none of them overlap. Every
 * part is a scene node: trace a message on with `draw`, fade a participant with `opacity`, ride a message with a `pulse`.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [360, 260] });
 * const q = s.add(sequence({
 *   participants: ['browser', 'api', 'db'],
 *   messages: [
 *     { from: 'browser', to: 'api', label: 'GET /user' },
 *     { from: 'api', to: 'db', label: 'select' },
 *     { from: 'db', to: 'api', label: 'row', reply: true },
 *     { from: 'api', to: 'api', label: 'render' },
 *     { from: 'api', to: 'browser', label: '200', reply: true },
 *   ],
 * }));
 */
export class Sequence extends Group {
  /** the participant boxes by id */
  nodes = new Map<string, DiagramNode>();
  /** the dashed line under each participant, by id */
  lifelines = new Map<string, DiagramEdge>();
  /** the arrows in the order they happen, from the top down */
  messages: DiagramEdge[] = [];
  /** the note boxes in the order they appear */
  notes: DiagramNode[] = [];
  constructor(spec: SequenceSpec, o: SequenceOpts = {}) {
    super(o);
    const role = o.role ?? 'ink', parts = spec.participants.map((p) => (typeof p === 'string' ? { id: p, label: p } : { id: p.id, label: p.label ?? p.id }));
    const col = new Map(parts.map((p, i) => [p.id, i]));
    for (const [i, p] of parts.entries()) if (col.get(p.id) !== i) throw new Error(`cseen: two participants are called "${p.id}"`);
    const at = (id: string) => { const i = col.get(id); if (i === undefined) throw new Error(`cseen: the sequence has no participant "${id}"`); return i; };
    const heads = parts.map((p) => new DiagramNode(p.label, { role }));
    const headH = Math.max(0, ...heads.map((h) => h.box[1]));
    // the distance between neighbouring lifelines: the boxes must clear each other, and every label must fit between its ends
    const gap = heads.slice(1).map((h, i) => (heads[i].box[0] + h.box[0]) / 2 + HEAD_GAP);
    const need: { a: number; b: number; w: number }[] = [];
    for (const m of spec.messages) {
      if ('note' in m) {
        const [a, b] = (Array.isArray(m.over) ? m.over : [m.over, m.over]).map(at).sort((x, y) => x - y);
        if (a !== b) need.push({ a, b, w: labelW(m.note) + NOTE_PAD });
      } else {
        const a = at(m.from), b = at(m.to);
        if (a === b) { if (a < gap.length) gap[a] = Math.max(gap[a], LOOP[0] + 0.3 + (m.label ? labelW(m.label) : 0) + 0.1); }
        else if (m.label) need.push({ a: Math.min(a, b), b: Math.max(a, b), w: labelW(m.label) + 0.5 });
      }
    }
    // short spans first: widening a gap only ever helps the spans that contain it
    for (const { a, b, w } of need.sort((x, y) => x.b - x.a - (y.b - y.a) || x.a - y.a || x.b - y.b)) {
      let have = 0;
      for (let k = a; k < b; k++) have += gap[k];
      if (have < w) for (let k = a; k < b; k++) gap[k] += (w - have) / (b - a);
    }
    const x: number[] = [];
    parts.forEach((_, i) => { x[i] = i ? x[i - 1] + gap[i - 1] : 0; });
    // time flows down: z is measured from the top of the boxes
    interface Row { z: number; a: number; b: number; m?: SequenceMessage; n?: SequenceNote; box?: [number, number] }
    const rows: Row[] = [];
    let z = -headH;
    const top = -headH / 2;
    for (const m of spec.messages) {
      if ('note' in m) {
        const [a, b] = (Array.isArray(m.over) ? m.over : [m.over, m.over]).map(at).sort((p, q) => p - q);
        const bx = sizeOf(m.note, 'box'), w = Math.max(bx[0], x[b] - x[a] + (a === b ? 0 : NOTE_PAD));
        z -= 0.5 + bx[1] / 2;
        rows.push({ z, a, b, n: m, box: [w, bx[1]] });
        z -= bx[1] / 2;
      } else {
        z -= ROW;
        const a = at(m.from), b = at(m.to);
        rows.push({ z, a, b, m });
        if (a === b) z -= LOOP[1];
      }
    }
    const bottom = z - 0.6;
    // the whole picture is centred on the origin
    let lo = x[0] - (heads[0]?.box[0] ?? 0) / 2, hi = lo;
    heads.forEach((h, i) => { lo = Math.min(lo, x[i] - h.box[0] / 2); hi = Math.max(hi, x[i] + h.box[0] / 2); });
    for (const r of rows) {
      if (r.n) { const cx = (x[r.a] + x[r.b]) / 2; lo = Math.min(lo, cx - r.box![0] / 2); hi = Math.max(hi, cx + r.box![0] / 2); }
      else if (r.a === r.b) hi = Math.max(hi, x[r.a] + LOOP[0] + 0.1 + (r.m!.label ? labelW(r.m!.label) : 0));
    }
    const cx = (lo + hi) / 2, cz = (top + bottom) / 2, X = (i: number) => x[i] - cx, Z = (v: number) => v - cz;
    parts.forEach((p, i) => {
      this.nodes.set(p.id, this.add(heads[i]));
      heads[i].set('pos', [X(i), 0, Z(top)]);
      const line = new DiagramEdge(p.id, p.id, { role: 'faint', arrow: false, dash: '3 4' });
      line.setRoute([[X(i), Z(-headH)], [X(i), Z(bottom)]]);
      this.lifelines.set(p.id, this.add(line));
    });
    for (const r of rows) {
      if (r.n) {
        const n = this.add(new DiagramNode(r.n.note, { role: 'accent', fill: 0.1, min: r.box }));
        n.set('pos', [X(r.a) / 2 + X(r.b) / 2, 0, Z(r.z)]);
        this.notes.push(n);
        continue;
      }
      const m = r.m!, e = new DiagramEdge(m.from, m.to, { role: m.role ?? role, label: m.label, dash: m.reply ? '5 4' : undefined });
      if (r.a === r.b) {
        const xs = X(r.a), zz = Z(r.z);
        // the loop leaves the lifeline, goes out, down and back; the word sits to its right
        e.labelAt = (rt: P2[], w: number) => [rt[1][0] + 0.1 + w / 2, (rt[1][1] + rt[2][1]) / 2];
        e.setRoute([[xs, zz], [xs + LOOP[0], zz], [xs + LOOP[0], zz - LOOP[1]], [xs, zz - LOOP[1]]]);
      } else {
        // the word sits just above its arrow
        e.labelAt = (rt: P2[], w: number, h: number) => [(rt[0][0] + rt[1][0]) / 2, rt[0][1] + 0.05 + h / 2];
        e.setRoute([[X(r.a), Z(r.z)], [X(r.b), Z(r.z)]]);
      }
      this.messages.push(this.add(e));
    }
  }
}

/**
 * A sequence diagram: who talks to whom, in order. See `Sequence`.
 *
 * @example
 * const s = new Scene({ view: 'front', size: [320, 220] });
 * s.add(sequence({
 *   participants: ['client', 'server'],
 *   messages: [{ from: 'client', to: 'server', label: 'hello' }, { note: 'checks the token', over: 'server' }, { from: 'server', to: 'client', label: 'ok', reply: true }],
 * }));
 */
export const sequence = (spec: SequenceSpec, o: SequenceOpts = {}) => new Sequence(spec, o);
