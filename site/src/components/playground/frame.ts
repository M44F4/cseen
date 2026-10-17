/*
 * The inside of the playground's sandbox (public/pg-frame.html). It is bundled by scripts/frame.ts, not by Astro.
 * This is the only place the visitor's code runs. The page that embeds it sends the code in a message and gets
 * back a result and the time; the figure is drawn here. Nothing from the parent is trusted beyond its shape:
 * a message is used only if it comes from the parent window and has the expected fields.
 */
import '../../../../src/theme/cseen.css';
import * as core from '../../../../src/index.ts';
import * as devices from '../../../../src/devices/index.ts';
import * as ui from '../../../../src/ui/index.ts';
import * as charts from '../../../../src/charts/index.ts';
import * as waves from '../../../../src/waves/index.ts';
import * as optics from '../../../../src/optics/index.ts';
import * as math from '../../../../src/math/index.ts';
import * as flow from '../../../../src/flow/index.ts';
import { RunError, run, type Namespaces } from '../../lib/run.ts';
import { applyPreset, isView } from '../demo/views.ts';

const ns: Namespaces = { '': core, devices, ui, charts, waves, optics, math, flow };
const view = document.getElementById('view')!;
const root = document.documentElement;
const parent = window.parent;
/* the frame has an opaque origin, so "*" is the only target there is; nothing posted out of here is secret */
const post = (m: object) => parent.postMessage(m, '*');

let player: core.Player | undefined, orb: core.Orbit | undefined;
let last = '';
/** what the current figure was built from, so a change of view can rebuild it */
let current: { code: string; orbit: boolean; calm: boolean; viewName: string | null } | undefined;
/** in full screen, the width over the height of the space to fill; the scene is drawn to that shape instead of its own */
let fill: number | null = null;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Runs the code and mounts the figure, in the named view when there is one. Returns the scene and timeline, or throws. */
function build(code: string, orbit: boolean, calm: boolean, viewName: string | null, at?: number) {
  const r = run(code, ns);
  if (!(r.scene instanceof core.Scene)) throw new RunError('Define a scene named s, for example: const s = new Scene();');
  const scene = r.scene, tl = r.timeline instanceof core.Timeline ? r.timeline : undefined;
  const ownSize: [number, number] = [scene.size[0], scene.size[1]];
  if (fill) scene.size = [scene.size[1] * fill, scene.size[1]];
  // Turning the figure needs a framing that keeps its size, so a sphere around the scene replaces the fit. A scene that sets
  // `region` has been framed by hand (the cube that folds up and ends off-centre of its own bounds), and a sphere would undo that.
  if (orbit && !scene.region) { scene.fit = 'sphere'; scene.sphere = undefined; tl?.lockFit(scene); }
  if (viewName) applyPreset(scene, viewName);
  const home = scene.camera.snapshot() as Record<string, number | number[]>;
  orb?.destroy();
  player?.destroy();
  player = core.mount(view, scene, { timeline: tl, loop: { pause: 1.2 }, autoplay: false });
  const p = player;
  // visitors who prefer reduced motion get the final frame and press play themselves
  if (tl) {
    if (at !== undefined) p.seek(Math.min(at, tl.duration)); else p.seek(calm ? tl.duration : 0);
    if (!calm) p.play();
  }
  if (orbit) orb = core.orbit(view.querySelector('svg')!, scene, { home, onChange: () => p.invalidate() });
  last = '';
  current = { code, orbit, calm, viewName };
  return { scene, tl, ownSize };
}

function runCode(id: number, code: string, orbit: boolean, calm: boolean, viewName: string | null) {
  try {
    const { ownSize, tl } = build(code, orbit, calm, viewName);
    post({ type: 'result', id, ok: true, size: ownSize, timeline: !!tl, duration: tl ? tl.duration : 0 });
  } catch (e) {
    const err = e instanceof RunError ? e : new RunError((e as Error)?.message ?? String(e));
    post({ type: 'result', id, ok: false, message: String(err.message).slice(0, 2000), line: err.line ?? null });
  }
}

/** Shows the figure from another view: it is rebuilt (the camera has to be set before the framing), keeping the time and play state. */
function setView(name: string | null) {
  if (!current || !player) return;
  const { time, playing } = player, { code, orbit, calm } = current;
  try {
    build(code, orbit, calm, name, time);
    if (!playing) player?.pause();
  } catch { /* the code ran a moment ago; if it fails now the figure stays as it was */ }
}

/** Colours from the page's theme. Only custom properties of the library's theme contract are accepted. */
function applyTheme(vars: unknown, dark: unknown) {
  if (isObj(vars)) for (const [k, v] of Object.entries(vars)) if (/^--cn-[a-z0-9-]+$/.test(k) && typeof v === 'string' && v.length < 200) root.style.setProperty(k, v);
  root.dataset.theme = dark ? 'dark' : 'light';
}

addEventListener('message', (e: MessageEvent) => {
  if (e.source !== parent || !isObj(e.data)) return;
  const m = e.data;
  switch (m.type) {
    case 'run':
      if (typeof m.id === 'number' && typeof m.code === 'string') runCode(m.id, m.code, m.orbit === true, m.calm === true, isView(m.view) ? m.view : null);
      break;
    case 'theme': applyTheme(m.vars, m.dark); break;
    case 'toggle':
      if (!player) break;
      if (player.playing) player.pause(); else { if (player.time >= player.duration - 0.01) player.seek(0); player.play(); }
      break;
    case 'fill':
      fill = typeof m.ratio === 'number' && m.ratio > 0.1 && m.ratio < 10 ? m.ratio : null;
      if (current) setView(current.viewName);
      break;
    case 'view': setView(isView(m.name) ? m.name : null); break;
    case 'pause': player?.pause(); break;
    case 'seek': if (typeof m.t === 'number' && Number.isFinite(m.t)) { player?.pause(); player?.seek(m.t); } break;
    case 'ping': post({ type: 'pong' }); break;
  }
});

/* the pointer, for the page's ring: the page gets no pointer events from inside this frame, so it is told where the pointer is and when it leaves */
let ptr: { x: number; y: number } | null | undefined, ptrRaf = 0;
const sendPtr = () => { ptrRaf = 0; if (ptr !== undefined) post({ type: 'pointer', x: ptr?.x ?? 0, y: ptr?.y ?? 0, over: !!ptr }); ptr = undefined; };
addEventListener('pointermove', (e) => { ptr = { x: e.clientX, y: e.clientY }; if (!ptrRaf) ptrRaf = requestAnimationFrame(sendPtr); }, { passive: true });
root.addEventListener('pointerleave', () => { ptr = null; if (!ptrRaf) ptrRaf = requestAnimationFrame(sendPtr); });

/* the time, for the parent's slider and clock: sent when it changes, not every frame */
const tick = () => {
  requestAnimationFrame(tick);
  if (!player) return;
  const s = `${player.time.toFixed(2)}|${player.duration}|${player.playing}`;
  if (s !== last) { last = s; post({ type: 'time', time: player.time, duration: player.duration, playing: player.playing }); }
};
requestAnimationFrame(tick);
post({ type: 'ready' });
