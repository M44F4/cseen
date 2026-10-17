/** `<cseen-demo>`: brings a statically rendered demo window to life when it scrolls into view. */
class CseenDemo extends HTMLElement {
  private stop?: () => void;
  private io?: IntersectionObserver;

  connectedCallback() {
    const root = this.querySelector<HTMLElement>('.dm');
    if (!root) return;
    this.io = new IntersectionObserver(async (e) => {
      if (!e.some((x) => x.isIntersecting)) return;
      this.io?.disconnect();
      const [{ wire }, { byId }] = await Promise.all([import('./window.ts'), import('../../demos/index.ts')]);
      const d = byId.get(this.dataset.id ?? '');
      // removed from the page while the code was loading: wiring it now would leak its player and listeners
      if (d && this.isConnected) this.stop = wire(root, d).destroy;
    }, { rootMargin: '200px' });
    this.io.observe(this);
  }

  disconnectedCallback() {
    this.io?.disconnect();
    this.stop?.();
    this.stop = undefined;
  }
}
if (!customElements.get('cseen-demo')) customElements.define('cseen-demo', CseenDemo);
