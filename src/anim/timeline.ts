import { lerpValue, type Animatable, type Value } from '../core/animatable.ts';
import { clamp, type V3 } from '../core/math.ts';
import type { Node } from '../core/nodes.ts';
import type { Scene } from '../core/scene.ts';
import { unionBounds, type Bounds } from '../core/render.ts';

/** An easing function: maps progress 0 to 1 onto progress 0 to 1. */
export type Ease = (t: number) => number;
/** The named easing curves: `linear`, `in`, `out`, `inOut`, `smooth` and `back`. Each maps time 0 to 1 onto progress 0 to 1. */
export const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  smooth: (t) => t * t * (3 - 2 * t),
  back: (t) => { const c = 1.70158, c3 = c + 1; return 1 + c3 * (t - 1) ** 3 + c * (t - 1) ** 2; },
} satisfies Record<string, Ease>;
/** The name of a built-in easing curve. */
export type EaseName = keyof typeof ease;

type To = Value | ((current: Value) => Value);

/** One change of one object's properties over a span of time. */
export interface Tween {
  /** the animated object */
  target: Animatable;
  /** the values to reach, or functions of the current value */
  to: Record<string, To>;
  /** values set before the tween starts, so something can wait invisible until its moment */
  from?: Record<string, Value>;
  /** start time in seconds, relative to its animation */
  start: number;
  /** length in seconds */
  duration: number;
  /** the easing function */
  ease: Ease;
}

/** A piece of animation. It knows its length and its tweens (starting at 0), and can be combined with others. */
export interface Anim {
  /** length in seconds */
  duration: number;
  /** the tweens that make it up, with start times relative to its beginning */
  tweens: Tween[];
}

/** Options of `tween`. */
export interface TweenOpts {
  /** length in seconds, 1 by default */
  duration?: number;
  /** an easing name or function, `inOut` by default */
  ease?: EaseName | Ease;
  /** values set before the tween starts */
  from?: Record<string, Value>;
  /** seconds to wait before it starts */
  delay?: number;
}

/**
 * Animate any properties of a node or camera: `tween(cube, { opacity: 0.2, pos: [1, 0, 0] })`.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [-2, 0, 0], size: 1.2, role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(tween(b, { pos: [2, 0, 0], rot: [0, 0, 90] }, { duration: 1.6, ease: 'inOut' }));
 * tl.lockFit(s);
 */
export function tween(target: Animatable, to: Record<string, To>, o: TweenOpts = {}): Anim {
  const e = typeof o.ease === 'function' ? o.ease : ease[o.ease ?? 'inOut'];
  const delay = o.delay ?? 0, duration = o.duration ?? 1;
  return { duration: delay + duration, tweens: [{ target, to, from: o.from, start: delay, duration, ease: e }] };
}

/**
 * Fades a node in from invisible to its own opacity.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [0, 0, 0], size: 1.5, role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(fadeIn(b, 1));
 * tl.lockFit(s);
 */
export const fadeIn = (n: Node, duration = 0.6): Anim => tween(n, { opacity: n.props.opacity }, { duration, from: { opacity: 0 }, ease: 'out' });
/**
 * Fades a node out to invisible.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [0, 0, 0], size: 1.5, role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(wait(0.5));
 * tl.play(fadeOut(b, 1));
 * tl.lockFit(s);
 */
export const fadeOut = (n: Node, duration = 0.6): Anim => tween(n, { opacity: 0 }, { duration });
/**
 * Draws a line, curve or outline on from its start to its end.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const a = s.add(arrow([-3, 0, 0], [3, 0, 2], { role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(draw(a, 1.2));
 * tl.lockFit(s);
 */
export const draw = (n: Node, duration = 1): Anim => tween(n, { draw: 1 }, { duration, from: { draw: 0 }, ease: 'inOut' });
/**
 * Moves a node to a point.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [-3, 0, 0], size: 1.2, role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(moveTo(b, [3, 0, 0], 1.5));
 * tl.lockFit(s);
 */
export const moveTo = (n: Node, pos: V3, duration = 1, ease?: EaseName): Anim => tween(n, { pos }, { duration, ease });
/**
 * Moves a node by an offset from where it is when the animation starts.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [-2, 0, 0], size: 1.2, role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(moveBy(b, [4, 0, 0], 1.5));
 * tl.lockFit(s);
 */
export const moveBy = (n: Node, by: V3, duration = 1, ease?: EaseName): Anim =>
  tween(n, { pos: (c) => (c as number[]).map((x, i) => x + by[i]) }, { duration, ease });
/**
 * Rotates a node to Euler angles in degrees about x, y and z.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [0, 0, 0], size: [2, 1, 1], role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(rotateTo(b, [0, 0, 90], 1.5));
 * tl.lockFit(s);
 */
export const rotateTo = (n: Node, rot: V3, duration = 1): Anim => tween(n, { rot }, { duration });
/**
 * Scales a node to a factor.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [0, 0, 0], size: 1, role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(scaleTo(b, 2, 1.2));
 * tl.lockFit(s);
 */
export const scaleTo = (n: Node, scale: number, duration = 1): Anim => tween(n, { scale }, { duration });
/**
 * Types text or code onto a plane letter by letter.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * const t = s.add(write('Typed, letter by letter.', { at: [-3, 0, 0], size: [6, 1], fontSize: 0.5 }));
 *
 * const tl = new Timeline();
 * tl.play(typeOn(t, 2));
 * tl.lockFit(s);
 */
export const typeOn = (n: Node, duration = 2): Anim => tween(n, { type: 1 }, { duration, from: { type: 0 }, ease: 'linear' });
/**
 * Does nothing for a while. Use it to leave a gap between two animations.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [0, 0, 0], size: 1.2, role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(wait(1));          // nothing happens for a second
 * tl.play(moveBy(b, [2, 0, 0], 1));
 * tl.lockFit(s);
 */
export const wait = (duration: number): Anim => ({ duration, tweens: [] });

/**
 * Plays the animations one after another.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [-2, 0, 0], size: 1.2, role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(seq(moveBy(b, [4, 0, 0], 1), moveBy(b, [0, 3, 0], 1)));   // one, then the other
 * tl.lockFit(s);
 */
export function seq(...anims: Anim[]): Anim {
  let t = 0;
  const tweens: Tween[] = [];
  for (const a of anims) { for (const tw of a.tweens) tweens.push({ ...tw, start: tw.start + t }); t += a.duration; }
  return { duration: t, tweens };
}
/**
 * Plays the animations at the same time.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [-2, 0, 0], size: 1.2, role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(par(moveBy(b, [4, 0, 0], 1.5), rotateTo(b, [0, 0, 90], 1.5)));   // both at once
 * tl.lockFit(s);
 */
export function par(...anims: Anim[]): Anim {
  return { duration: Math.max(0, ...anims.map((a) => a.duration)), tweens: anims.flatMap((a) => a.tweens) };
}
/**
 * Starts each animation a little after the previous one.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const boxes = [-3, -1, 1, 3].map((x) => s.add(box({ at: [x, 0, 0], size: 1 })));
 *
 * const tl = new Timeline();
 * tl.play(stagger(0.25, ...boxes.map((b) => fadeIn(b, 0.6))));   // each starts a little after the last
 * tl.lockFit(s);
 */
export function stagger(gap: number, ...anims: Anim[]): Anim {
  return par(...anims.map((a, i) => seq(wait(gap * i), a)));
}

/**
 * Plays an animation backwards: every tween runs from its end value to its start value, last one first.
 * Each tween needs a literal `to` and a `from`, so there is something to return to. Put it after the
 * animation to take a construction apart again, or to make a loop that ends where it began.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [-3, 0, 0], size: 1.2, role: 'accent' }));
 *
 * const tl = new Timeline();
 * const there = tween(b, { pos: [3, 0, 0] }, { duration: 1.5, from: { pos: [-3, 0, 0] } });
 * tl.play(there);
 * tl.play(reverse(there));
 * tl.lockFit(s);
 */
export function reverse(a: Anim): Anim {
  return {
    duration: a.duration,
    tweens: a.tweens.map((tw) => {
      if (!tw.from) throw new Error('cseen: reverse needs a "from" on every tween');
      const to: Record<string, Value> = {};
      for (const k in tw.to) { const v = tw.to[k]; if (typeof v === 'function') throw new Error('cseen: reverse needs literal "to" values'); const f = tw.from[k]; if (f === undefined) throw new Error(`cseen: reverse needs a "from" for "${k}"`); to[k] = f; }
      const from: Record<string, Value> = {};
      for (const k in tw.to) from[k] = tw.to[k] as Value;
      const e = tw.ease;
      return { ...tw, to, from, start: a.duration - tw.start - tw.duration, ease: (t: number) => 1 - e(1 - t) };
    }),
  };
}

/**
 * A timeline is a list of tweens. `seek(t)` rewinds everything to its starting state and replays up
 * to t, so the result depends only on t. Playing, scrubbing and rendering a still frame all work the same way.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground());
 * const b = s.add(box({ at: [0, 0, 0], size: 1.5, role: 'accent' }));
 *
 * const tl = new Timeline();
 * tl.play(fadeIn(b, 1));
 * tl.chapter('move').play(moveBy(b, [2, 0, 0], 1.2));
 * tl.lockFit(s);
 */
export class Timeline {
  /** every tween, with start times on the timeline's clock */
  tweens: Tween[] = [];
  /** named marks, in the order made, for step buttons and captions */
  chapters: { name: string; time: number }[] = [];
  /** where the next `play` starts: the end of everything so far */
  private cursor = 0;
  /** each animated object with its state before any tween ran, taken lazily and dropped whenever tweens are added */
  private bases: { target: Animatable; snap: Record<string, Value> }[] | null = null;

  /** appends an animation after everything so far */
  play(a: Anim): this {
    for (const tw of a.tweens) this.tweens.push({ ...tw, start: tw.start + this.cursor });
    this.cursor += a.duration;
    this.bases = null;
    return this;
  }
  /** places an animation at an absolute time without moving the cursor */
  at(time: number, a: Anim): this {
    for (const tw of a.tweens) this.tweens.push({ ...tw, start: tw.start + time });
    this.cursor = Math.max(this.cursor, time + a.duration);
    this.bases = null;
    return this;
  }
  /** leaves a gap: the next `play` starts `d` seconds later */
  wait(d: number): this { this.cursor += d; return this; }
  /** marks the current time as a named step, for "next step" buttons and captions */
  chapter(name: string): this { this.chapters.push({ name, time: this.cursor }); return this; }

  /** the length in seconds: where the cursor is, so a trailing `wait` counts */
  get duration(): number { return this.cursor; }

  /** remembers the starting state of every animated object, once */
  private init() {
    if (this.bases) return;
    this.bases = [];
    for (const tw of this.tweens) if (!this.bases.some((b) => b.target === tw.target)) this.bases.push({ target: tw.target, snap: tw.target.snapshot() });
  }

  /** puts every animated object in the state it has at time `t` (seconds) */
  seek(t: number) {
    this.init();
    for (const b of this.bases!) b.target.restore(b.snap);
    const ordered = [...this.tweens].sort((a, b) => a.start - b.start);
    // Things that fade in start hidden, from the very beginning: use the first `from` of each property.
    const seen = new Set<string>();
    const key = (tw: Tween, k: string) => `${this.bases!.findIndex((b) => b.target === tw.target)}:${k}`;
    const first = new Set<Tween>();
    for (const tw of ordered) if (tw.from) for (const k in tw.from) { const id = key(tw, k); if (!seen.has(id)) { seen.add(id); tw.target.set(k, tw.from[k]); first.add(tw); } }
    for (const tw of ordered) {
      if (t < tw.start) continue;
      if (tw.from && !first.has(tw)) for (const k in tw.from) tw.target.set(k, tw.from[k]);
      const p = tw.duration <= 0 ? 1 : clamp((t - tw.start) / tw.duration);
      const e = p >= 1 ? 1 : tw.ease(p);
      for (const k in tw.to) {
        const cur = tw.target.get(k);
        const raw = tw.to[k];
        const to = typeof raw === 'function' ? raw(cur) : raw;
        // Earlier tweens were replayed first, so `cur` is the value this tween starts from.
        tw.target.set(k, e >= 1 ? to : lerpValue(cur, to, e));
      }
    }
  }

  /**
   * Fixes the scene's framing to fit every moment of this timeline, so the picture does not
   * shift as things move. Call it once after building the timeline.
   */
  lockFit(scene: Scene, samples = 24): this {
    samples = Math.max(1, Math.floor(samples)); // 0 would divide by zero
    if (scene.fit === 'sphere') return this.lockSphere(scene, samples);
    let b: Bounds | null = null;
    for (let i = 0; i <= samples; i++) {
      this.seek((this.duration * i) / samples);
      b = unionBounds(b, scene.bounds());
    }
    this.seek(0);
    if (b) scene.lockTo(b);
    return this;
  }

  /** For `fit: 'sphere'`: one sphere around the scene at every moment, so orbiting a moving scene does not make it breathe. */
  private lockSphere(scene: Scene, samples: number): this {
    scene.sphere = undefined;
    const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
    const boxes: { lo: V3; hi: V3 }[] = [];
    for (let i = 0; i <= samples; i++) {
      this.seek((this.duration * i) / samples);
      const b = scene.box();
      if (!b) continue;
      boxes.push(b);
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], b.lo[k]); hi[k] = Math.max(hi[k], b.hi[k]); }
    }
    this.seek(0);
    if (!boxes.length) return this;
    const c: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    let r = 0;
    for (const b of boxes) for (const x of [b.lo[0], b.hi[0]]) for (const y of [b.lo[1], b.hi[1]]) for (const z of [b.lo[2], b.hi[2]]) r = Math.max(r, Math.hypot(x - c[0], y - c[1], z - c[2]));
    scene.sphere = { c, r };
    return this;
  }
}
