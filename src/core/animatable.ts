/** What a prop can hold: a number, or a list of numbers such as a position. */
export type Value = number | number[];

/**
 * Anything a timeline can animate. All animatable state lives in `props`, so a timeline can
 * snapshot it, rewind it and replay it. That is what makes scrubbing deterministic.
 */
export class Animatable {
  props: Record<string, Value> = {};

  /** The value of a prop. Throws if the node has no such prop, which catches typos in `tween`. */
  get(key: string): Value {
    const v = this.props[key];
    if (v === undefined) throw new Error(`cseen: no animatable property "${key}"`);
    return v;
  }
  /** Sets a prop. Lists are copied, so later changes to yours do not reach the node. */
  set(key: string, value: Value) {
    this.props[key] = Array.isArray(value) ? value.slice() : value;
  }
  /** A copy of every prop, for a timeline to rewind to. */
  snapshot(): Record<string, Value> {
    const o: Record<string, Value> = {};
    for (const k in this.props) { const v = this.props[k]; o[k] = Array.isArray(v) ? v.slice() : v; }
    return o;
  }
  /** Puts props back from a snapshot. */
  restore(s: Record<string, Value>) {
    for (const k in s) this.set(k, s[k]);
  }
}

/** The value `t` of the way from `a` to `b`. Lists are blended item by item. */
export function lerpValue(a: Value, b: Value, t: number): Value {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => x + ((b[i] ?? x) - x) * t);
  throw new Error('cseen: cannot interpolate between a number and an array');
}
