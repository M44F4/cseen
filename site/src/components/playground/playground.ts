/* The playground: an editor on the left, the figure on the right, running the visitor's own code. */
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history as cmHistory, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { tags as t } from '@lezer/highlight';
import { scrubberSync } from '../../lib/scrubber.ts';
import { decodeCode, encodeCode } from '../../lib/share.ts';
import { byId, demos } from '../../demos/index.ts';
import { ICONS } from '../demo/chrome.ts';
import { pickList } from './picklist.ts';
import { createSandbox, type Outcome, type Tick } from './sandbox.ts';

/** The address of the sandbox page, under the site's base path. */
const FRAME_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}pg-frame.html`;

/* ---- editor look: every colour comes from the page palette */
const theme = EditorView.theme({
  '&': { color: 'var(--sl-color-text)', backgroundColor: 'var(--sl-color-gray-7)', height: '100%', fontSize: '0.82rem' },
  '.cm-scroller': { fontFamily: 'var(--sl-font-system-mono)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--cn-accent)', padding: '0.6rem 0' },
  '.cm-cursor': { borderLeftColor: 'var(--cn-accent)' },
  '.cm-gutters': { backgroundColor: 'var(--sl-color-gray-7)', color: 'var(--sl-color-gray-4)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--cn-ink) 5%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--sl-color-gray-2)' },
  '&.cm-focused': { outline: 'none', boxShadow: 'inset 0 0 0 2px var(--cn-accent)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in oklab, var(--cn-accent) 28%, transparent) !important' },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in oklab, var(--cn-accent) 25%, transparent)', outline: 'none' },
  '.cm-errline': { backgroundColor: 'color-mix(in oklab, #d93b3b 22%, transparent)' },
});
const style = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword], color: 'var(--cn-accent)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--cn-accent)' },
  { tag: [t.string, t.regexp], color: 'color-mix(in oklab, var(--cn-accent) 60%, var(--cn-ink))' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--sl-color-gray-3)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--sl-color-white)', fontWeight: '600' },
  { tag: [t.typeName, t.className], color: 'var(--sl-color-accent-high)' },
]);

const setErrorLine = StateEffect.define<number | null>();
const errorLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setErrorLine)) {
      if (e.value === null || e.value < 1 || e.value > tr.state.doc.lines) return Decoration.none;
      return Decoration.set([Decoration.line({ class: 'cm-errline' }).range(tr.state.doc.line(e.value).from)]);
    }
    return tr.docChanged ? Decoration.none : v;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Wires the playground inside `root`; returns a function that tears everything down again. */
export function start(root: HTMLElement) {
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const view = $('.pg-view'), errBox = $('.pg-error'), status = $('.pg-status'), select = $<HTMLSelectElement>('.pg-examples'), orbitBox = $<HTMLInputElement>('.pg-orbit');
  const playRow = $('.pg-play'), playBtn = $<HTMLButtonElement>('[data-act=play]'), range = $<HTMLInputElement>('[data-act=scrub]'), clock = $('.dm-clock');
  const notice = $('.pg-notice');
  /** the camera view picked with the buttons; null leaves the scene's own */
  let viewName: string | null = null;
  const viewBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const setPressed = () => viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === viewName)));
  let timer = 0, raf = 0, shown: Tick = { time: 0, duration: 0, playing: false };
  /** code that arrived in a link and has not been run: it is shown, and runs only when the visitor says so */
  let held = false;
  /** true while the editor's text is being replaced by the page and not typed by the visitor */
  let loading = false;

  const sandbox = createSandbox(view, FRAME_URL, {
    time: (t) => { shown = t; },
    reset: (why) => { playRow.hidden = true; shown = { time: 0, duration: 0, playing: false }; showError(why); },
  });

  /** the message goes in as text, never as HTML */
  const showError = (message: string, line: number | null = null) => {
    errBox.hidden = false;
    errBox.textContent = `${line ? `Line ${line}: ` : ''}${message}`;
    view.classList.add('pg-stale');
    editor.dispatch({ effects: setErrorLine.of(line) });
  };
  const clearError = () => { errBox.hidden = true; view.classList.remove('pg-stale'); editor.dispatch({ effects: setErrorLine.of(null) }); };
  const hold = (on: boolean) => { held = on; notice.hidden = !on; if (on) { clearTimeout(timer); status.textContent = 'Not run yet'; } };

  const execute = async () => {
    clearTimeout(timer);
    hold(false);
    const code = editor.state.doc.toString();
    try { window.history.replaceState(null, '', `#code=${encodeCode(code)}`); } catch { /* some sandboxes forbid it */ }
    // visitors who prefer reduced motion get the final frame and press play themselves
    const out: Outcome | null = await sandbox.run(code, orbitBox.checked, matchMedia('(prefers-reduced-motion: reduce)').matches, viewName);
    if (!out) return;   // a newer run took its place, or the page is gone
    if (!out.ok) { showError(out.message, out.line); return; }
    view.style.aspectRatio = `${out.size[0]} / ${out.size[1]}`;
    view.style.setProperty('--pg-ratio', String(out.size[0] / out.size[1]));
    playRow.hidden = !out.timeline;
    if (out.timeline) range.max = out.duration.toFixed(2);
    clearError();
    status.textContent = '';
  };
  const later = () => { clearTimeout(timer); timer = window.setTimeout(execute, 350); status.textContent = 'Editing...'; };

  /* ---- playback: the frame reports the time, the buttons here send commands back */
  const sync = scrubberSync(range, clock);
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (playRow.hidden) return;
    playBtn.textContent = shown.playing ? 'Pause' : 'Play';
    sync(shown, document.activeElement === range);
  };
  playBtn.addEventListener('click', () => sandbox.toggle());
  range.addEventListener('input', () => { shown = { ...shown, time: Number(range.value), playing: false }; sandbox.seek(Number(range.value)); });
  viewBtns.forEach((b) => b.addEventListener('click', () => { viewName = b.dataset.view!; setPressed(); if (!held) sandbox.view(viewName); }));
  orbitBox.addEventListener('change', () => { if (!held) execute(); });
  root.querySelectorAll('[data-act=run]').forEach((b) => b.addEventListener('click', () => { execute(); }));

  /* ---- editor */
  const shared = decodeCode(location.hash);
  const initial = shared ?? byId.get('core/hello')!.code({});
  const editor = new EditorView({
    parent: $('.pg-editor'),
    state: EditorState.create({
      doc: initial,
      extensions: [
        lineNumbers(), cmHistory(), drawSelection(), highlightActiveLine(), indentOnInput(), bracketMatching(),
        keymap.of([{ key: 'Mod-Enter', run: () => { execute(); return true; } }, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        javascript({ typescript: true }), syntaxHighlighting(style), theme, errorLine,
        EditorView.contentAttributes.of({ 'aria-label': 'Code editor. Press Control or Command and Enter to run now.' }),
        // typing counts as the visitor having read the code; code placed by the page waits for Run when it came from a link
        EditorView.updateListener.of((u) => { if (u.docChanged && !loading) { hold(false); later(); } }),
      ],
    }),
  });
  $('.pg-editor').querySelector('.cn-loading-fill')?.remove();   // the loader goes once the editor is there

  /** Puts code in the editor. Code from a link (`trusted` false) is not run until the visitor presses Run. */
  const load = (code: string, trusted: boolean) => {
    loading = true;
    try { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: code } }); } finally { loading = false; }
    viewName = null; setPressed();
    if (trusted) { hold(false); later(); } else hold(true);
  };
  const fromId = (id: string) => { const d = byId.get(id); return d ? d.code(d.defaults) : null; };
  /** the example whose code this is exactly; a link carries only code, so this is how the list finds its title again */
  const idFor = (code: string) => demos.find((d) => d.code(d.defaults).trim() === code.trim())?.id ?? '';
  const sharedId = shared ? idFor(shared) : '';
  select.value = shared ? sharedId : 'core/hello';
  const picker = pickList($('.pg-pick'), select);
  select.addEventListener('change', () => { const c = select.value && fromId(select.value); if (c) load(c, true); });
  $('[data-act=reset]').addEventListener('click', () => { const c = select.value && fromId(select.value); load(c || initial, true); });
  $('[data-act=share]').addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLElement, old = (b.dataset.label ??= b.textContent ?? '');
    try { await navigator.clipboard.writeText(location.href); b.textContent = 'Link copied'; } catch { b.textContent = 'Copy it from the address bar'; }
    setTimeout(() => { b.textContent = old; }, 1600);
  });
  const onHash = () => { const c = decodeCode(location.hash); if (c && c !== editor.state.doc.toString()) { select.value = idFor(c); picker.sync(); load(c, !!select.value); } };
  addEventListener('hashchange', onHash);

  /* ---- full screen: the preview, the code, or both with the toolbar */
  const fullBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-full]')];
  const target = (k: string) => (k === 'pg' ? root : $(`.pg-${k === 'out' ? 'out' : 'editor'}`));
  fullBtns.forEach((b) => b.addEventListener('click', () => {
    const el = target(b.dataset.full!);
    if (document.fullscreenElement === el) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }));
  let fillWatch: ResizeObserver | undefined;
  const onFull = () => {
    const fe = document.fullscreenElement;
    fullBtns.forEach((b) => {
      const on = fe === target(b.dataset.full!), what = ({ out: 'preview', code: 'code', pg: 'code and preview' } as Record<string, string>)[b.dataset.full!];
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${on ? 'Exit full screen' : 'Full screen'}: ${what}`);
      b.title = b.getAttribute('aria-label')!;
      b.innerHTML = on ? ICONS.exitFull : ICONS.full;
    });
    editor.requestMeasure();
    // the preview in full screen is drawn to the shape of the space it has, so the grid fills it (the space settles after the change, so it is watched)
    fillWatch?.disconnect(); fillWatch = undefined;
    if (fe === $('.pg-out')) {
      let raf = 0;
      fillWatch = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const r = view.getBoundingClientRect(); if (r.height > 0) sandbox.fill(r.width / r.height); }); });
      fillWatch.observe(view);
    } else sandbox.fill(null);
  };
  document.addEventListener('fullscreenchange', onFull);


  // code that is one of the site's own examples is as safe as picking it from the list, so it runs at once
  if (shared && !sharedId) hold(true); else execute();
  raf = requestAnimationFrame(tick);
  return () => { removeEventListener('hashchange', onHash); document.removeEventListener('fullscreenchange', onFull); fillWatch?.disconnect(); picker.destroy(); cancelAnimationFrame(raf); clearTimeout(timer); sandbox.destroy(); editor.destroy(); };
}
