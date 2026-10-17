import type { Scene } from '../core/scene.ts';
import type { Timeline } from './timeline.ts';
import { esc } from '../core/render.ts';

/** Options of `mount`. */
export interface MountOpts {
  /** the timeline to play */
  timeline?: Timeline;
  /** play when mounted. Default true. */
  autoplay?: boolean;
  /** restart at the end. `true`, or `{ pause: seconds }` to hold the last frame first. Default true. */
  loop?: boolean | { pause: number };
  /** playback speed, 1 by default */
  speed?: number;
  /** time to show for people who prefer reduced motion, and before play. Defaults to the end of the timeline. */
  rest?: number;
  /** only animate while on screen. Default true. */
  onlyVisible?: boolean;
  /** upper limit of redraws per second, 60 by default */
  maxFps?: number;
}

/** Controls a mounted scene: play, pause, seek by time or by chapter, and redraw after a change made by hand. */
export interface Player {
  /** the current time in seconds */
  readonly time: number;
  /** the length of the timeline in seconds */
  readonly duration: number;
  /** starts or resumes playing */
  play(): void;
  /** stops playing, keeping the current frame */
  pause(): void;
  /** jumps to a time in seconds */
  seek(t: number): void;
  /** jumps to the start of the next (or previous) chapter */
  step(dir?: 1 | -1): void;
  /** stops and releases the scene */
  destroy(): void;
  /** whether it is playing */
  readonly playing: boolean;
  /**
   * Redraws the scene as it is now, without moving the timeline. Call it after changing the camera or a
   * node by hand (orbit controls do). Calls within one frame are merged, and `maxFps` still applies.
   */
  invalidate(): void;
}

/** SVG namespace, for creating elements. */
const NS = 'http://www.w3.org/2000/svg';

/**
 * Puts a scene in the page and plays it. The SVG is built once; each frame only the pieces that
 * changed are replaced, and the drawing pauses when it is off screen.
 *
 * @example
 * const s = new Scene({ view: 'iso' });
 * s.add(ground(), box({ at: [0, 0, 0], size: 1.5, role: 'accent' }));
 *
 * const player = mount(document.querySelector('#figure')!, s);
 * // player.invalidate() redraws after you change the scene yourself
 */
export function mount(target: Element, scene: Scene, o: MountOpts = {}): Player {
  const tl = o.timeline;
  const dur = tl?.duration ?? 0;
  let svg = target.tagName.toLowerCase() === 'svg' ? (target as SVGSVGElement) : (target.querySelector('svg.cseen') as SVGSVGElement | null);
  if (!svg) {
    svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
    svg.setAttribute('class', 'cseen');
    target.appendChild(svg);
  }
  svg.setAttribute('viewBox', `0 0 ${scene.size[0]} ${scene.size[1]}`);
  svg.replaceChildren(); // take over from any server-rendered markup of the same scene
  let head: Element | null = null;
  if (scene.title) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', scene.title);
    const t = document.createElementNS(NS, 'title');
    t.textContent = scene.title;
    svg.appendChild(t);
    head = t;
    if (scene.desc) { const d = document.createElementNS(NS, 'desc'); d.textContent = scene.desc; svg.appendChild(d); head = d; }
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }

  // Each drawn item keeps its own element. A frame only replaces the ones whose markup changed.
  const els = new Map<string, { html: string; el: SVGGElement }>();
  /** brings the page's elements in line with the scene's current frame, replacing only items whose markup changed */
  const draw = () => {
    const f = scene.frame();
    const wanted: SVGGElement[] = [];
    const seen = new Set<string>();
    for (const it of f.items) {
      seen.add(it.key);
      let rec = els.get(it.key);
      if (!rec || rec.html !== it.html) {
        rec?.el.remove();
        const g = document.createElementNS(NS, 'g') as SVGGElement;
        g.innerHTML = it.html;
        rec = { html: it.html, el: g };
        els.set(it.key, rec);
      }
      wanted.push(rec.el);
    }
    for (const [k, rec] of els) if (!seen.has(k)) { rec.el.remove(); els.delete(k); }
    let ref: ChildNode | null = head ? head.nextSibling : svg!.firstChild;
    for (const el of wanted) {
      if (el === ref) ref = ref.nextSibling;
      else svg!.insertBefore(el, ref);
    }
  };

  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rest = o.rest ?? dur;
  const speed = o.speed ?? 1;
  const loop = o.loop ?? true;
  const pause = typeof loop === 'object' ? loop.pause : 1.2;
  const minGap = 1000 / (o.maxFps ?? 60);
  // frame times come in a hair off the exact gap (16.66 ms, not 16.67), so a strict test would drop every other frame at 60 Hz
  const tooSoon = (now: number, since: number) => now - since < minGap - 1.5;
  let time = 0, playing = false, raf = 0, last = 0, hold = 0, visible = true;
  let dirty = false, dirtyRaf = 0, dirtyAt = 0;

  /** moves the timeline to `t` and draws it; clears any pending redraw, since this one covers it */
  const show = (t: number) => { time = t; dirty = false; tl?.seek(t); draw(); };
  /** draws a change made by hand (`invalidate`) while paused, no more often than `maxFps` */
  const flush = (now: number) => {
    dirtyRaf = 0;
    if (!dirty) return;
    if (tooSoon(now, dirtyAt)) { dirtyRaf = requestAnimationFrame(flush); return; }
    dirty = false;
    dirtyAt = now;
    draw();
  };
  /** one animation frame: advance time by the real time passed (times `speed`), hold at the end, then loop or stop */
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    // a frame that advances time redraws everything anyway; otherwise (held at the end, throttled) draw the pending change
    if (dirty && visible && (hold > 0 || tooSoon(now, last)) && !tooSoon(now, dirtyAt)) { dirty = false; dirtyAt = now; draw(); }
    if (!visible || tooSoon(now, last)) return;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (hold > 0) { hold -= dt; if (hold <= 0) show(0); return; }
    const t = time + dt * speed;
    if (t >= dur) {
      show(dur);
      if (!loop) p.pause();
      else if (pause > 0) hold = pause;
      else show(0); // no pause: restart now, or the next frame would show the last one again forever
    } else show(t);
  };

  const p: Player = {
    get time() { return time; },
    get duration() { return dur; },
    get playing() { return playing; },
    play() { if (playing || !dur) return; playing = true; last = 0; raf = requestAnimationFrame(tick); },
    pause() { playing = false; cancelAnimationFrame(raf); },
    seek(t) { show(Math.min(Math.max(t, 0), dur)); },
    step(dir = 1) {
      const times = [0, ...(tl?.chapters.map((c) => c.time) ?? []), dur];
      const next = dir > 0 ? times.find((x) => x > time + 1e-6) : [...times].reverse().find((x) => x < time - 1e-6);
      show(next ?? (dir > 0 ? dur : 0));
    },
    invalidate() {
      dirty = true;
      if (!playing && !dirtyRaf) dirtyRaf = requestAnimationFrame(flush);
    },
    destroy() { p.pause(); cancelAnimationFrame(dirtyRaf); dirty = false; io?.disconnect(); },
  };

  let io: IntersectionObserver | undefined;
  if ((o.onlyVisible ?? true) && typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; }, { rootMargin: '60px' });
    io.observe(svg);
  }

  show(reduce || o.autoplay === false ? rest : 0);
  if (!reduce && o.autoplay !== false) p.play();
  return p;
}

/**
 * The static markup of a scene at one moment: render on the server, then `mount` in the browser to bring it to life.
 *
 * @example
 * const s = new Scene({ view: 'iso' });
 * s.add(ground(), box({ at: [0, 0, 0], size: 1.5, role: 'accent' }));
 *
 * const svg = renderStill(s);   // a standalone <svg> string: on the server, or anywhere without a browser
 */
export function renderStill(scene: Scene, timeline?: Timeline, t?: number): string {
  if (timeline) timeline.seek(t ?? timeline.duration);
  return scene.svg();
}

export { esc };
