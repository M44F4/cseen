import { idFromHash } from '../../lib/share.ts';
import { LOADER } from '../../lib/loader.ts';

/*
 * Floating asset windows. Several can be open at once; each is draggable by its title bar and
 * wide enough to be useful. Opens from any element with data-open="<demo id>".
 */
const open = new Map<string, { host: HTMLElement }>();
/** ids whose window is still loading, so a second click meanwhile does not open a duplicate */
const loading = new Set<string>();
let layer: HTMLElement | undefined, z = 50, n = 0;

const raise = (host: HTMLElement) => { host.style.zIndex = String(++z); };

/** Opens the window for a demo, or raises it when it is already open. */
export async function openViewer(id: string) {
  const had = open.get(id);
  if (had) { raise(had.host); had.host.querySelector<HTMLElement>('.dm-view svg')?.focus(); return; }
  if (loading.has(id)) return;
  loading.add(id);
  let loaded: [typeof import('./window.ts'), typeof import('../../demos/index.ts')];
  // a quick load shows nothing; a slow one shows the loader, so a click is never met with silence
  const pill = document.createElement('div');
  pill.className = 'cn-loading-pill';
  pill.style.setProperty('--cn-loader-h', '3.4rem');
  pill.innerHTML = LOADER.replace('aria-label="Loading"', 'aria-label="Opening the figure"');
  const later = setTimeout(() => document.body.append(pill), 200);
  try { loaded = await Promise.all([import('./window.ts'), import('../../demos/index.ts')]); } finally { clearTimeout(later); pill.remove(); loading.delete(id); }
  const [{ windowFor, wire }, { byId }] = loaded;
  const d = byId.get(id);
  if (!d) return;
  if (!layer) { layer = document.createElement('div'); layer.className = 'dm-layer'; document.body.append(layer); }

  const host = document.createElement('div');
  host.className = 'dm-float';
  host.innerHTML = windowFor(d, { floating: true }).html;
  const k = n++ % 8;
  host.style.left = `${Math.max(8, Math.min(window.innerWidth - 920, window.innerWidth / 2 - 450 + k * 28))}px`;
  host.style.top = `${Math.max(8, 72 + k * 28)}px`;
  raise(host);
  layer.append(host);

  const close = () => { w.destroy(); host.remove(); open.delete(id); };
  const w = wire(host.querySelector<HTMLElement>('.dm')!, d, { onClose: close });
  open.set(id, { host });

  host.addEventListener('pointerdown', () => raise(host));

  // drag by the title bar
  const head = host.querySelector<HTMLElement>('.dm-head')!;
  head.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button') || window.innerWidth < 700) return;
    const r = host.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => {
      host.style.left = `${Math.min(Math.max(m.clientX - dx, 8 - r.width + 80), window.innerWidth - 80)}px`;
      host.style.top = `${Math.min(Math.max(m.clientY - dy, 0), window.innerHeight - 40)}px`;
    };
    const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up); };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', up);
  });
}

// Escape closes the window on top
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.fullscreenElement || !open.size) return;
  let top: [string, { host: HTMLElement }] | undefined;
  for (const entry of open) if (!top || Number(entry[1].host.style.zIndex) > Number(top[1].host.style.zIndex)) top = entry;
  if (top) top[1].host.querySelector<HTMLElement>('[data-act=close]')?.click();
});

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-open]');
  if (t) void openViewer(t.dataset.open!);
});

// a link to #name opens that asset
const fromHash = () => {
  const id = idFromHash(location.hash);
  const card = id && document.querySelector<HTMLElement>(`[data-open][id="${CSS.escape(id)}"]`);
  if (card) void openViewer(card.dataset.open!);
};
addEventListener('hashchange', fromHash);
fromHash();
