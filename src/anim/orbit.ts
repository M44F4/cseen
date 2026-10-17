import type { Camera } from '../core/camera.ts';
import { rad, type V3 } from '../core/math.ts';
import type { Scene } from '../core/scene.ts';

/** How far the camera may turn and zoom. Pitch and yaw are in degrees. */
export interface OrbitLimits {
  /** degrees. Default [-89, 90]: from just below the ground to straight down. */
  pitch?: [number, number];
  /** degrees. Default: free. */
  yaw?: [number, number];
  /** magnification. Default [0.4, 6]. */
  zoom?: [number, number];
}

/** Options of `orbit`. */
export interface OrbitOpts {
  /** called after the camera changed. Pass `() => player.invalidate()` so the picture redraws. */
  onChange?: () => void;
  /** wheel and pinch zoom. Default true. */
  zoom?: boolean;
  /** how far the camera may turn and zoom */
  limits?: OrbitLimits;
  /** degrees per second of slow turning until the person touches the figure. Default off. Ignored for reduced motion. */
  autoRotate?: number;
  /** arrow keys turn, plus and minus zoom, 0 resets. Default true. */
  keyboard?: boolean;
  /** degrees per pixel of drag. Default 0.4. */
  sensitivity?: number;
  /** the camera state that reset returns to (a `camera.snapshot()`). Default: the camera as it is when orbit starts. */
  home?: Record<string, number | number[]>;
}

/** Handle to a running orbit control. */
export interface Orbit {
  /** back to the view the camera had when orbit was set up */
  reset(): void;
  /** removes the listeners and restores the element */
  destroy(): void;
}

/** Default pitch limits in degrees. */
const PITCH: [number, number] = [-89, 90];
/** Default zoom limits. */
const ZOOM: [number, number] = [0.4, 6];

/** `v` held inside `[lo, hi]`. */
const clampTo = (v: number, [lo, hi]: [number, number]) => Math.min(Math.max(v, lo), hi);

/**
 * New angles after a drag of (dx, dy) pixels, in degrees. Dragging right turns the scene so its
 * near side moves right; dragging down tips the top towards the viewer. Pitch is clamped.
 */
export function dragToAngles(a: { yaw: number; pitch: number }, dx: number, dy: number, o: { sensitivity?: number; limits?: OrbitLimits } = {}): { yaw: number; pitch: number } {
  const k = o.sensitivity ?? 0.4, l = o.limits ?? {};
  const yaw = a.yaw + dx * k;
  return { yaw: l.yaw ? clampTo(yaw, l.yaw) : yaw, pitch: clampTo(a.pitch + dy * k, l.pitch ?? PITCH) };
}

/** Multiplies a zoom by a factor and keeps it inside the limits. */
export function clampZoom(zoom: number, factor: number, range: [number, number] = ZOOM): number {
  return clampTo(zoom * factor, range);
}

/** Where a perspective camera sits when it looks at `target` from `distance` along the given angles (same angles as the parallel camera). */
export function orbitPosition(target: V3, yaw: number, pitch: number, distance: number): V3 {
  const y = rad(yaw), p = rad(pitch);
  return [target[0] - distance * Math.sin(y) * Math.cos(p), target[1] - distance * Math.cos(y) * Math.cos(p), target[2] + distance * Math.sin(p)];
}

/** The angles and distance of a perspective camera, the inverse of `orbitPosition`. */
export function anglesOf(position: V3, target: V3): { yaw: number; pitch: number; distance: number } {
  const v = [target[0] - position[0], target[1] - position[1], target[2] - position[2]];
  const distance = Math.hypot(v[0], v[1], v[2]) || 1;
  return { yaw: (Math.atan2(v[0], v[1]) * 180) / Math.PI, pitch: (Math.asin(Math.max(-1, Math.min(1, -v[2] / distance))) * 180) / Math.PI, distance };
}

/** Reads the current angles from either kind of camera. */
export function readAngles(cam: Camera): { yaw: number; pitch: number } {
  if (cam.kind === 'ortho') return { yaw: cam.props.yaw as number, pitch: cam.props.pitch as number };
  const a = anglesOf(cam.props.position as V3, cam.props.target as V3);
  return { yaw: a.yaw, pitch: a.pitch };
}

/** Points a camera along new angles. A perspective camera keeps its target and distance. */
export function writeAngles(cam: Camera, yaw: number, pitch: number) {
  if (cam.kind === 'ortho') { cam.set('yaw', yaw); cam.set('pitch', pitch); return; }
  const target = cam.props.target as V3, d = anglesOf(cam.props.position as V3, target).distance;
  cam.set('position', orbitPosition(target, yaw, pitch, d));
}

/**
 * Turns the camera of a scene with the pointer, wheel, touch and keyboard. The scene needs
 * `fit: 'sphere'` (or a locked fit) so the object keeps its size while it turns.
 *
 *     const player = mount(el, scene, { timeline });
 *     orbit(el, scene, { onChange: () => player.invalidate() });
 *
 * If a timeline animates the camera, the timeline wins while it plays.
 *
 * @example
 * const s = new Scene({ fit: 'sphere' });
 * s.add(ground(), box({ at: [0, 0, 0], size: 1.5, role: 'accent' }));
 *
 * const el = document.querySelector('#figure')!;
 * const player = mount(el, s);
 * orbit(el.querySelector('svg')!, s, { onChange: () => player.invalidate() });   // drag, wheel, pinch and arrow keys
 */
export function orbit(target: Element, scene: Scene, o: OrbitOpts = {}): Orbit {
  const cam = scene.camera, el = target as HTMLElement;
  const limits = o.limits ?? {}, zr = limits.zoom ?? ZOOM, zoomOn = o.zoom ?? true, keys = o.keyboard ?? true;
  const sens = o.sensitivity ?? 0.4, start = o.home ?? cam.snapshot();
  const changed = () => o.onChange?.();
  /** turns the camera as if dragged by (dx, dy) pixels */
  const turn = (dx: number, dy: number) => {
    const a = dragToAngles(readAngles(cam), dx, dy, { sensitivity: sens, limits });
    writeAngles(cam, a.yaw, a.pitch);
    changed();
  };
  const zoomBy = (f: number) => { cam.set('zoom', clampZoom(cam.zoom, f, zr)); changed(); };
  const reset = () => { cam.restore(start); changed(); };

  const prev = { touchAction: el.style.touchAction, cursor: el.style.cursor, tabindex: el.getAttribute('tabindex') };
  el.style.touchAction = 'none';
  el.style.cursor = 'grab';
  if (keys && prev.tabindex === null) el.setAttribute('tabindex', '0');

  const pts = new Map<number, { x: number; y: number }>();
  let pinch = 0, idleUntil = 0;
  /** notes that the person is interacting, so auto-rotate waits 2.5 s */
  const touch = () => { idleUntil = performance.now() + 2500; };
  /** distance in pixels between the first two pointers (for pinch) */
  const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

  const down = (e: PointerEvent) => {
    if (e.button > 0) return;
    el.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) pinch = gap();
    el.style.cursor = 'grabbing';
    touch();
  };
  const move = (e: PointerEvent) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) turn(dx, dy);
    else if (pts.size === 2 && zoomOn) { const g = gap(); if (pinch > 0 && g > 0) zoomBy(g / pinch); pinch = g; }
    touch();
  };
  const up = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    pinch = pts.size === 2 ? gap() : 0;
    if (!pts.size) el.style.cursor = 'grab';
  };
  const wheel = (e: WheelEvent) => {
    if (!zoomOn) return;
    e.preventDefault();
    zoomBy(Math.exp(-e.deltaY * 0.0015));
    touch();
  };
  /** keyboard control: arrows turn, plus/minus zoom, 0 or Home resets */
  const key = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = (e.shiftKey ? 15 : 5) / sens; // degrees, as pixels of drag
    const k = e.key;
    if (k === 'ArrowLeft') turn(-step, 0);
    else if (k === 'ArrowRight') turn(step, 0);
    else if (k === 'ArrowUp') turn(0, -step);
    else if (k === 'ArrowDown') turn(0, step);
    else if (zoomOn && (k === '+' || k === '=')) zoomBy(1.2);
    else if (zoomOn && (k === '-' || k === '_')) zoomBy(1 / 1.2);
    else if (k === '0' || k === 'Home') reset();
    else return;
    e.preventDefault();
    touch();
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('dblclick', reset);
  el.addEventListener('wheel', wheel, { passive: false });
  if (keys) el.addEventListener('keydown', key);

  let raf = 0, lastT = 0;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** auto-rotate frame; the step is capped so a background tab does not jump when it wakes */
  const spin = (now: number) => {
    raf = requestAnimationFrame(spin);
    const dt = lastT ? Math.min((now - lastT) / 1000, 0.1) : 0;
    lastT = now;
    if (pts.size || performance.now() < idleUntil || !dt) return;
    const a = readAngles(cam);
    writeAngles(cam, a.yaw + (o.autoRotate as number) * dt, a.pitch);
    changed();
  };
  if (o.autoRotate && !reduce) raf = requestAnimationFrame(spin);

  return {
    reset,
    destroy() {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('dblclick', reset);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('keydown', key);
      el.style.touchAction = prev.touchAction;
      el.style.cursor = prev.cursor;
      if (keys && prev.tabindex === null) el.removeAttribute('tabindex');
    },
  };
}
