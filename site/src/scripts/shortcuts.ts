/*
 * Keyboard shortcuts for the whole site. Never active while typing in a field or the code editor.
 *   /            search            ?            this list
 *   g then d     docs              g then g     gallery
 *   g then p     playground        g then e     examples
 *   g then r     reference         g then c     cheat sheet
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const go: Record<string, [string, string]> = {
  d: ['/docs/', 'Documentation'], g: ['/gallery/core/', 'Gallery'], p: ['/playground/', 'Playground'],
  e: ['/examples/', 'Examples'], r: ['/reference/', 'Reference'], c: ['/cheat-sheet/', 'Cheat sheet'],
};

/** true while the key is meant for a field, a menu or the code editor */
const typing = (t: EventTarget | null) => {
  const e = t as HTMLElement | null;
  return !!e && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) || e.isContentEditable || !!e.closest('.cm-editor'));
};

let dialog: HTMLDialogElement | null = null;
/** shows the shortcut list, building it on first use */
function help() {
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'cn-keys';
    dialog.setAttribute('aria-label', 'Keyboard shortcuts');
    const row = (k: string, d: string) => `<tr><td>${k}</td><td>${d}</td></tr>`;
    dialog.innerHTML = `<h2>Keyboard shortcuts</h2><table>${row('<kbd>/</kbd>', 'Search')}${row('<kbd>?</kbd>', 'This list')}${Object.entries(go).map(([k, [, label]]) => row(`<kbd>g</kbd> then <kbd>${k}</kbd>`, label)).join('')}${row('<kbd>Esc</kbd>', 'Close')}</table><button type="button" autofocus>Close</button>`;
    dialog.querySelector('button')!.addEventListener('click', () => dialog!.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog!.close(); });
    document.body.append(dialog);
  }
  if (!dialog.open) dialog.showModal();
}

/** Listens for the keys in the list at the top of this file. */
export function startShortcuts() {
  let chord = 0;
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('dialog[open]:not(.cn-keys)')) return;
    if (chord && go[e.key]) { e.preventDefault(); clearTimeout(chord); chord = 0; location.href = BASE + go[e.key][0]; return; }
    // a stale timer must not cut the next chord short
    clearTimeout(chord); chord = 0;
    if (e.key === '/') { e.preventDefault(); document.querySelector<HTMLButtonElement>('button[data-open-modal]')?.click(); }
    else if (e.key === '?') { e.preventDefault(); help(); }
    else if (e.key === 'g') chord = window.setTimeout(() => { chord = 0; }, 900);
  });
}
