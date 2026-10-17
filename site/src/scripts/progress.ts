/*
 * Two thin bars at the top of the window: how far down a long page you are, and a bar that creeps along
 * while the next page loads after you click a link.
 */
/** Adds the reading bar and the navigation bar to the page and keeps them current. */
export function startProgress() {
  const read = document.createElement('div');
  read.className = 'cn-read';
  read.setAttribute('aria-hidden', 'true');
  const nav = document.createElement('div');
  nav.className = 'cn-navbar';
  nav.setAttribute('aria-hidden', 'true');
  document.body.append(read, nav);

  let q = 0;
  const update = () => {
    cancelAnimationFrame(q);
    q = requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      // only on pages long enough to need it
      read.style.opacity = max > innerHeight ? '1' : '0';
      read.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    });
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest('a');
    if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin) return;
    if (a.pathname === location.pathname && a.hash) return;
    nav.classList.add('go');
    // a navigation that never happens (stopped, or the link did something else) must not leave the bar creeping
    setTimeout(() => nav.classList.remove('go'), 10000);
  });
  // coming back from the back-forward cache must not leave the bar showing
  addEventListener('pageshow', () => nav.classList.remove('go'));
}
