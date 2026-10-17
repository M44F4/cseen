/*
 * The playground's sandbox, seen from the page. The visitor's code never runs on the page: it runs in an iframe
 * with sandbox="allow-scripts" (and no allow-same-origin), so it has an opaque origin and cannot reach the page's
 * DOM, storage or cookies, cannot navigate the page, open windows or submit forms, and the frame's own policy
 * closes the network (public/pg-frame.html). What is left is the page's side of the conversation:
 *   - messages are accepted only from this iframe's window, and only in the shapes below; the text in them is
 *     shown with textContent and never as HTML
 *   - a frame that stops answering (code that never gives control back) or navigates away is thrown out and
 *     replaced by a fresh one, so the page and the editor stay usable
 */
export type Outcome =
  | { ok: true; size: [number, number]; timeline: boolean; duration: number }
  | { ok: false; message: string; line: number | null };

export interface Tick { time: number; duration: number; playing: boolean }

/** how long the frame may stay silent before it is replaced, in milliseconds (the code itself is stopped at 3 s) */
const SILENCE_MS = 8000;
const PING_EVERY_MS = 2500;
/** the theme values the frame needs, from the library's theme contract */
const THEME_VARS = ['ink', 'bg', 'accent', 'warm', 'cool', 'faint', 'grid', 'surface', 'term-bg', 'term-fg', 'w', 'font', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((n) => `--cn-${n}`);

const num = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Reads a result message; anything that does not have the expected shape becomes an error instead of being used. */
function parseOutcome(m: Record<string, unknown>): Outcome {
  if (m.ok === true) {
    const size = m.size;
    if (Array.isArray(size) && num(size[0], 1, 20000) && num(size[1], 1, 20000) && num(m.duration, 0, 1e6)) return { ok: true, size: [size[0], size[1]], timeline: m.timeline === true, duration: m.duration };
    return { ok: false, message: 'The preview sent back something that could not be read.', line: null };
  }
  return { ok: false, message: typeof m.message === 'string' ? m.message.slice(0, 2000) : 'The code failed.', line: num(m.line, 1, 1e6) ? Math.floor(m.line) : null };
}

export function createSandbox(host: HTMLElement, url: string, on: { time(t: Tick): void; reset(why: string): void }) {
  let frame: HTMLIFrameElement | undefined;
  let ready = false, loads = 0, destroyed = false;
  let queue: object[] = [];
  let runId = 0, waiting: { id: number; resolve(o: Outcome | null): void } | undefined;
  let silence = 0, pinging = false;

  const armSilence = () => { clearTimeout(silence); silence = window.setTimeout(() => replace('The preview stopped responding, so it was reset.'), SILENCE_MS); };
  const disarmSilence = () => { clearTimeout(silence); silence = 0; };

  const send = (m: object) => {
    if (!ready) { queue.push(m); return; }
    frame?.contentWindow?.postMessage(m, '*');
  };

  const theme = () => {
    const el = document.documentElement, cs = getComputedStyle(el), vars: Record<string, string> = {};
    for (const n of THEME_VARS) { const v = cs.getPropertyValue(n).trim(); if (v) vars[n] = v; }
    send({ type: 'theme', vars, dark: el.dataset.theme === 'dark' || (!el.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches) });
  };

  const spawn = () => {
    const f = document.createElement('iframe');
    // allow-scripts only: no allow-same-origin, allow-top-navigation, allow-popups, allow-forms, allow-modals, allow-downloads
    f.setAttribute('sandbox', 'allow-scripts');
    f.setAttribute('allow', '');
    f.referrerPolicy = 'no-referrer';
    f.className = 'pg-frame';
    f.title = 'Preview of the code';
    ready = false; loads = 0; queue = [];
    f.addEventListener('load', () => {
      // a frame loads once; a second load means the code sent it somewhere else
      if (frame === f && ++loads > 1) replace('The preview tried to leave the page, so it was reset.');
    });
    f.src = url;
    frame = f;
    host.append(f);
  };

  /** Throws the frame away and starts a new one. Whatever was running is reported as stopped. */
  const replace = (why: string) => {
    if (destroyed) return;
    disarmSilence(); pinging = false;
    frame?.remove();
    const w = waiting; waiting = undefined;
    w?.resolve({ ok: false, message: why, line: null });
    spawn();
    theme();
    on.reset(why);
  };

  const onMessage = (e: MessageEvent) => {
    if (!frame || e.source !== frame.contentWindow || typeof e.data !== 'object' || e.data === null) return;
    const m = e.data as Record<string, unknown>;
    switch (m.type) {
      case 'ready': {
        if (ready) break;   // a second "ready" is not from our script
        ready = true;
        const q = queue; queue = [];
        theme();
        for (const x of q) frame.contentWindow!.postMessage(x, '*');
        break;
      }
      case 'result':
        if (waiting && m.id === waiting.id) { const w = waiting; waiting = undefined; disarmSilence(); w.resolve(parseOutcome(m)); }
        break;
      case 'time':
        if (num(m.time, 0, 1e6) && num(m.duration, 0, 1e6)) on.time({ time: m.time, duration: m.duration, playing: m.playing === true });
        break;
      case 'pointer':
        // where the pointer is inside the frame, in the page's coordinates, for the cursor ring
        if (num(m.x, -1e5, 1e5) && num(m.y, -1e5, 1e5)) {
          const r = frame.getBoundingClientRect();
          document.dispatchEvent(new CustomEvent('cn:pointer', { detail: { x: r.left + m.x, y: r.top + m.y, over: m.over === true } }));
        }
        break;
      case 'pong':
        if (pinging && !waiting) { pinging = false; disarmSilence(); }
        break;
    }
  };
  addEventListener('message', onMessage);

  /* a heartbeat catches code that locks the frame up after it has reported back (a timer that never ends) */
  const beat = window.setInterval(() => {
    if (!ready || waiting || pinging) return;
    pinging = true; armSilence(); send({ type: 'ping' });
  }, PING_EVERY_MS);

  const mo = new MutationObserver(() => { if (ready) theme(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme', 'class'] });

  spawn();

  return {
    /** Runs the code in the frame. Resolves with the outcome, or with null when a newer run took its place. */
    run(code: string, orbit: boolean, calm: boolean, view: string | null = null): Promise<Outcome | null> {
      waiting?.resolve(null);
      const id = ++runId;
      return new Promise((resolve) => {
        waiting = { id, resolve };
        pinging = false;
        armSilence();
        send({ type: 'run', id, code, orbit, calm, view });
      });
    },
    toggle: () => send({ type: 'toggle' }),
    view: (name: string | null) => send({ type: 'view', name }),
    fill: (ratio: number | null) => send({ type: 'fill', ratio }),
    pause: () => send({ type: 'pause' }),
    seek: (t: number) => send({ type: 'seek', t }),
    destroy() {
      destroyed = true;
      removeEventListener('message', onMessage);
      clearInterval(beat); disarmSilence(); mo.disconnect();
      frame?.remove(); frame = undefined;
      waiting?.resolve(null); waiting = undefined;
    },
  };
}
