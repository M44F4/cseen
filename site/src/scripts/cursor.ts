/*
 * A ring that follows the pointer over figures you can drag. The system cursor stays: the ring is only a
 * hint, and it never appears on touch screens or when the visitor prefers less motion.
 */
/** Adds the ring and starts following the pointer; does nothing on touch screens or with reduced motion. */
export function startCursor() {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ring = document.createElement('div');
  ring.className = 'cn-ring';
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring);
  // only the full screen element and what it holds are drawn, so the ring moves in there while one is up
  document.addEventListener('fullscreenchange', () => (document.fullscreenElement ?? document.body).append(ring));

  const SEL = 'cseen-mini, .dm-view, .pg-view';
  let x = 0, y = 0, rx = 0, ry = 0, on = false, raf = 0;
  const tick = () => {
    rx += (x - rx) * 0.22; ry += (y - ry) * 0.22;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    raf = on || Math.abs(x - rx) + Math.abs(y - ry) > 0.5 ? requestAnimationFrame(tick) : 0;
  };
  const move = (cx: number, cy: number, over: boolean) => {
    x = cx; y = cy;
    if (over && !on) { rx = x; ry = y; }
    on = over;
    ring.classList.toggle('on', over);
    if (!raf) raf = requestAnimationFrame(tick);
  };
  document.addEventListener('pointermove', (e) => move(e.clientX, e.clientY, !!(e.target as HTMLElement).closest?.(SEL)), { passive: true });
  // the playground's sandboxed frame reports its own pointer, since the page gets no events from inside it
  document.addEventListener('cn:pointer', (e) => { const d = (e as CustomEvent<{ x: number; y: number; over: boolean }>).detail; move(d.x, d.y, d.over); });
  document.addEventListener('pointerdown', () => ring.classList.add('down'));
  document.addEventListener('pointerup', () => ring.classList.remove('down'));
  document.addEventListener('pointercancel', () => ring.classList.remove('down'));
  document.documentElement.addEventListener('pointerleave', () => { on = false; ring.classList.remove('on'); });
}
