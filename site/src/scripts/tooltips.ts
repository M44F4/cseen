/*
 * Replaces the browser's slow, plain tooltips on icon buttons. The first time a button with a title is
 * hovered or focused, the title moves to data-tip (and to aria-label, so it is still read out), and a
 * small themed label shows after a short delay.
 */
let tip: HTMLElement | null = null;
let timer = 0;

/** hides the label and cancels one that is about to show */
const hide = () => { clearTimeout(timer); tip?.classList.remove('show'); };

/** puts the label above the target (below it near the top of the window), kept inside the window's width */
function show(target: HTMLElement) {
  const text = target.dataset.tip;
  if (!text) return;
  tip ??= Object.assign(document.createElement('div'), { className: 'cn-tip', role: 'tooltip' });
  if (!tip.isConnected) document.body.append(tip);
  tip.textContent = text;
  const r = target.getBoundingClientRect();
  tip.style.left = '0px'; tip.style.top = '0px';
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const below = r.top < h + 12;
  tip.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8)}px`;
  tip.style.top = `${below ? r.bottom + 8 : r.top - h - 8}px`;
  tip.classList.add('show');
}

/** moves a target's title to data-tip and schedules its label */
function arm(e: Event) {
  const t = (e.target as HTMLElement | null)?.closest<HTMLElement>('button[title], a[title], [data-tip]');
  if (!t) return;
  if (t.hasAttribute('title')) {
    t.dataset.tip = t.getAttribute('title')!;
    if (!t.getAttribute('aria-label') && !t.textContent?.trim()) t.setAttribute('aria-label', t.dataset.tip);
    t.removeAttribute('title');
  }
  clearTimeout(timer);
  timer = window.setTimeout(() => show(t), e.type === 'focusin' ? 0 : 350);
}

/** Turns on themed labels for icon buttons; mouse and keyboard only, so not on touch screens. */
export function startTooltips() {
  if (!matchMedia('(hover: hover)').matches) return;
  document.addEventListener('pointerover', arm);
  document.addEventListener('focusin', arm);
  document.addEventListener('pointerout', hide);
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide);
  document.addEventListener('scroll', hide, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}
