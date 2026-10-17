/*
 * Brings a demo window to life: mounts the scene, wires orbit, view presets, playback, option
 * controls and the code tab. The markup comes from chrome.ts.
 */
import { mount, orbit, type Orbit, type Player, type Scene } from '../../../../src/index.ts';
import { highlight } from '../../lib/highlight.ts';
import { toPlayground } from '../../lib/links.ts';
import { scrubberSync } from '../../lib/scrubber.ts';
import { prepare } from '../../demos/prepare.ts';
import type { Control, Demo, Made, Opts } from '../../demos/types.ts';
import { ICONS, windowHtml } from './chrome.ts';
import { applyPreset } from './views.ts';

let counter = 0;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The HTML of a window for a demo in its starting state (also used to open floating windows). */
export function windowFor(d: Demo, o: { floating?: boolean } = {}): { html: string; uid: string } {
  const m = prepare(d.make(d.defaults), d);
  // the page may already hold server-rendered windows numbered from 1; windows opened in the browser get their own prefix
  const uid = `dm${typeof window === 'undefined' ? '' : 'w'}${++counter}`;
  if (m.tl) m.tl.seek(m.tl.duration);
  return { uid, html: windowHtml(d, { still: m.s.svg(), ratio: m.s.size, uid, floating: o.floating, hasTimeline: !!m.tl, duration: m.tl?.duration ?? 0, chapters: !!m.tl?.chapters.length, code: d.code(d.defaults), opts: d.defaults }) };
}

export { applyPreset };

export interface Wired { destroy(): void }

/** Makes the window markup in `root` work: mounts the figure, hooks every control, and returns a way to undo it. */
export function wire(root: HTMLElement, d: Demo, hooks: { onClose?: () => void } = {}): Wired {
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const view = $('.dm-view')!;
  const opts: Opts = { ...d.defaults };
  let scene: Scene, made: Made, player!: Player, orb: Orbit | undefined, raf = 0, dead = false;
  let preset: string | null = null; // null: the scene's own camera
  let kept: { yaw: number; pitch: number; zoom: number } | null = null; // what the person turned to, kept across option changes

  const pressed = () => root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === preset)));

  /** (re)mounts the scene for the current options, view and time */
  const build = () => {
    const t = player ? player.time : 0, playing = player ? player.playing : !reduced();
    orb?.destroy();
    player?.destroy();
    const first = !player;
    made = prepare(d.make(opts), d);
    scene = made.s;
    if (preset) applyPreset(scene, preset);
    const home = scene.camera.snapshot() as Record<string, number | number[]>;
    if (kept && scene.camera.kind === 'ortho') { scene.camera.set('yaw', kept.yaw); scene.camera.set('pitch', kept.pitch); scene.camera.set('zoom', kept.zoom); }
    view.style.aspectRatio = `${scene.size[0]} / ${scene.size[1]}`;
    player = mount(view, scene, { timeline: made.tl, loop: { pause: 1.2 }, autoplay: false, onlyVisible: true });
    if (made.tl) { player.seek(first && reduced() ? made.tl.duration : Math.min(t, made.tl.duration)); if (playing) player.play(); }
    const svg = view.querySelector('svg')!;
    orb = orbit(svg, scene, {
      home,
      onChange: () => {
        const c = scene.camera;
        if (c.kind === 'ortho') kept = { yaw: c.props.yaw as number, pitch: c.props.pitch as number, zoom: c.zoom };
        player.invalidate();
      },
    });
    syncPress();
    pressed();
    refreshCode();
  };

  const refreshCode = () => {
    const code = d.code(opts);
    const el = $('.dm-code code');
    if (el) el.innerHTML = highlight(code);
    const a = $<HTMLAnchorElement>('[data-act=playground]');
    if (a) a.href = toPlayground(code);
  };

  /* ---- playback */
  const playBtn = $<HTMLButtonElement>('[data-act=play]'), range = $<HTMLInputElement>('[data-act=scrub]'), clock = $('.dm-clock');
  const syncPress = () => {
    if (!playBtn) return;
    playBtn.innerHTML = player.playing ? ICONS.pause : ICONS.play;
    playBtn.setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
  };
  const sync = range ? scrubberSync(range, clock) : () => {};
  const tickUi = () => {
    if (dead) return;
    raf = requestAnimationFrame(tickUi);
    if (!range || document.activeElement === range) return;
    sync(player);
  };
  playBtn?.addEventListener('click', () => { if (player.playing) player.pause(); else { if (player.time >= player.duration - 0.01) player.seek(0); player.play(); } syncPress(); });
  root.querySelector('[data-act=step]')?.addEventListener('click', () => { player.pause(); player.step(1); syncPress(); });
  range?.addEventListener('input', () => { player.pause(); player.seek(Number(range.value)); syncPress(); });

  /* ---- views, reset, fullscreen, close */
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.addEventListener('click', () => { preset = b.dataset.view!; kept = null; build(); }));
  $('[data-act=reset-view]')?.addEventListener('click', () => { preset = null; kept = null; build(); });
  $('[data-act=fullscreen]')?.addEventListener('click', () => { if (document.fullscreenElement) void document.exitFullscreen(); else void root.requestFullscreen?.(); });
  $('[data-act=close]')?.addEventListener('click', () => hooks.onClose?.());

  /* ---- tabs */
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const showTab = (name: string) => {
    for (const t of tabs) { const on = t.dataset.tab === name; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; }
    root.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== name; });
  };
  tabs.forEach((t) => {
    t.addEventListener('click', () => showTab(t.dataset.tab!));
    t.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const n = tabs[(tabs.indexOf(t) + step + tabs.length) % tabs.length];
      n.focus();
      showTab(n.dataset.tab!);
    });
  });

  /* ---- code */
  $('[data-act=copy]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLElement, span = b.querySelector('span')!;
    try { await navigator.clipboard.writeText(d.code(opts)); span.textContent = 'Copied'; } catch { span.textContent = 'Press Ctrl+C'; }
    setTimeout(() => { span.textContent = 'Copy'; }, 1500);
  });

  /* ---- option controls: a change rebuilds the scene (rAF-coalesced) */
  let raf2 = 0;
  const later = () => { if (!raf2) raf2 = requestAnimationFrame(() => { raf2 = 0; build(); }); };
  const read = (el: HTMLInputElement | HTMLSelectElement, c: Control): unknown => (c.type === 'number' ? Number(el.value) : c.type === 'boolean' ? (el as HTMLInputElement).checked : el.value);
  const writeBack = (el: HTMLInputElement | HTMLSelectElement, c: Control, v: unknown) => {
    if (c.type === 'boolean') (el as HTMLInputElement).checked = !!v; else el.value = String(v ?? (c.type === 'select' ? '' : c.type === 'number' ? c.min : ''));
    const out = el.parentElement?.querySelector('output');
    if (out) out.textContent = el.value;
  };
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((el) => {
    const c = d.controls.find((x) => x.key === el.dataset.k)!;
    el.addEventListener('input', () => { opts[c.key] = read(el, c); const out = el.parentElement?.querySelector('output'); if (out) out.textContent = el.value; later(); });
  });
  $('[data-act=reset-opts]')?.addEventListener('click', () => {
    Object.assign(opts, d.defaults);
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((el) => writeBack(el, d.controls.find((x) => x.key === el.dataset.k)!, opts[el.dataset.k!]));
    later();
  });

  build();
  // only a window with a timeline has a scrubber to keep in step
  if (range) raf = requestAnimationFrame(tickUi);
  return { destroy() { dead = true; cancelAnimationFrame(raf); cancelAnimationFrame(raf2); orb?.destroy(); player?.destroy(); } };
}
