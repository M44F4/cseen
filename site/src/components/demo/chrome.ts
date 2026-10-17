/*
 * The markup of a demo window, as a plain string. The page build uses it for the first paint and
 * the browser uses it for floating windows, so a window never jumps when it comes alive.
 */
import { highlight, esc } from '../../lib/highlight.ts';
import { BASE, toPlayground } from '../../lib/links.ts';
import refIndex from '../../demos/ref-index.json';
import type { Control, Demo, Opts } from '../../demos/types.ts';

/** a 16px line icon from its path data */
const ic = (d: string) => `<svg class="dm-ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONS = {
  reset: ic('<path d="M3 8a5 5 0 1 0 1.8-3.8"/><path d="M3 2.5v3h3"/>'),
  full: ic('<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>'),
  exitFull: ic('<path d="M6 2.5V6H2.5M10 2.5V6h3.5M10 13.5V10h3.5M6 13.5V10H2.5"/>'),
  close: ic('<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>'),
  play: ic('<path d="M5 3l8 5-8 5z" fill="currentColor"/>'),
  pause: ic('<path d="M5 3v10M11 3v10"/>'),
  step: ic('<path d="M3 3l7 5-7 5zM13 3v10"/>'),
  copy: ic('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>'),
  open: ic('<path d="M9 2.5h4.5V7M13.5 2.5L7 9M11 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3"/>'),
};

/** the camera presets, as [key, button label] */
export const VIEWS: [string, string][] = [['iso', 'Iso'], ['front', 'Front'], ['side', 'Side'], ['top', 'Top'], ['persp', 'Perspective']];

/** The label and input for one option control. `uid` keeps the element ids apart between windows. */
export function controlHtml(c: Control, value: unknown, uid: string): string {
  const id = `${uid}-${c.key}`, label = esc(c.label ?? c.key);
  if (c.type === 'number') {
    const v = typeof value === 'number' ? value : c.min;
    return `<div class="dm-row"><label for="${id}">${label}</label><input id="${id}" data-k="${esc(c.key)}" type="range" min="${c.min}" max="${c.max}" step="${c.step ?? 1}" value="${v}"><output for="${id}">${v}</output></div>`;
  }
  if (c.type === 'boolean') return `<div class="dm-row dm-check"><input id="${id}" data-k="${esc(c.key)}" type="checkbox"${value ? ' checked' : ''}><label for="${id}">${label}</label></div>`;
  if (c.type === 'select') return `<div class="dm-row"><label for="${id}">${label}</label><select id="${id}" data-k="${esc(c.key)}">${c.options.map((o) => `<option value="${esc(o)}"${o === (value ?? '') ? ' selected' : ''}>${esc(o || 'default')}</option>`).join('')}</select></div>`;
  return `<div class="dm-row"><label for="${id}">${label}</label><input id="${id}" data-k="${esc(c.key)}" type="text" value="${esc(String(value ?? ''))}"></div>`;
}

export interface ChromeOpts { still: string; ratio: [number, number]; uid: string; floating?: boolean; hasTimeline: boolean; duration: number; chapters: boolean; code: string; opts: Opts }

/** a link to the reference entry of the thing this demo shows, when its id is the name of an export */
const refLink = (d: Demo) => {
  const name = d.fn ?? d.id.split('/')[1];
  const pack = (refIndex as Record<string, string>)[name];
  return pack ? `<a data-act="reference" href="${esc(`${BASE}/reference/${pack}/#${name.toLowerCase()}`)}">${ICONS.open}<span>Reference</span></a>` : '';
};

/** The whole window as an HTML string: header, figure and tools, code tab, option panel. */
export function windowHtml(d: Demo, o: ChromeOpts): string {
  const [w, h] = o.ratio;
  const play = o.hasTimeline
    ? `<div class="dm-play" role="group" aria-label="Playback"><button type="button" data-act="play" aria-label="Pause" title="Play or pause">${ICONS.pause}</button>${o.chapters ? `<button type="button" data-act="step" aria-label="Next step" title="Next step">${ICONS.step}</button>` : ''}<input type="range" data-act="scrub" min="0" max="${o.duration.toFixed(2)}" step="0.01" value="0" aria-label="Time"><span class="dm-clock" aria-hidden="true"></span></div>`
    : '';
  const side = d.controls.length
    ? `<aside class="dm-side" aria-label="Options">${d.controls.map((c) => controlHtml(c, o.opts[c.key], o.uid)).join('')}<button type="button" class="dm-link" data-act="reset-opts">Reset options</button></aside>`
    : '';
  return `<section class="dm${o.floating ? ' dm-floating' : ''}" data-id="${esc(d.id)}" aria-label="${esc(d.title)}">
  <header class="dm-head"><span class="dm-title">${esc(d.title)}</span><span class="dm-btns"><button type="button" data-act="reset-view" aria-label="Reset view" title="Reset view">${ICONS.reset}</button><button type="button" data-act="fullscreen" aria-label="Full screen" title="Full screen">${ICONS.full}</button>${o.floating ? `<button type="button" data-act="close" aria-label="Close" title="Close">${ICONS.close}</button>` : ''}</span></header>
  <div class="dm-body${side ? ' dm-has-side' : ''}">
    <div class="dm-main">
      <div class="dm-tabs" role="tablist" aria-label="Figure or code"><button type="button" role="tab" id="${o.uid}-t-fig" aria-controls="${o.uid}-p-fig" aria-selected="true" data-tab="fig">Figure</button><button type="button" role="tab" id="${o.uid}-t-code" aria-controls="${o.uid}-p-code" aria-selected="false" data-tab="code" tabindex="-1">Code</button></div>
      <div class="dm-pane" role="tabpanel" id="${o.uid}-p-fig" aria-labelledby="${o.uid}-t-fig" data-pane="fig">
        <div class="dm-view" style="aspect-ratio:${w} / ${h}">${o.still}</div>
        <div class="dm-tools"><div class="dm-views" role="group" aria-label="View">${VIEWS.map(([k, t]) => `<button type="button" data-view="${k}" aria-pressed="false">${t}</button>`).join('')}</div>${play}</div>
        <p class="dm-hint">Drag to turn, scroll or pinch to zoom, double click to reset.</p>
      </div>
      <div class="dm-pane" role="tabpanel" id="${o.uid}-p-code" aria-labelledby="${o.uid}-t-code" data-pane="code" hidden>
        <div class="dm-codebar"><button type="button" data-act="copy">${ICONS.copy}<span>Copy</span></button><a data-act="playground" href="${esc(toPlayground(o.code))}">${ICONS.open}<span>Open in playground</span></a>${refLink(d)}</div>
        <pre class="dm-code" tabindex="0"><code>${highlight(o.code)}</code></pre>
      </div>
    </div>
    ${side}
  </div>
</section>`;
}
