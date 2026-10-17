/*
 * The home page's signature: the pointer lights up the grid that cseen draws under everything.
 * Lattice lines near the pointer glow in the accent colour and fade out. It does nothing on touch screens
 * or when the visitor prefers less motion, and it stops drawing as soon as everything has faded.
 *
 * The glow covers the whole top of the page: from the very top (behind the transparent header) down past the
 * bottom of the hero (fading out), and from edge to edge, so it does not start at an arbitrary line under the header.
 *
 * The lattice is the ground of the hero's figure: when the page has a figure that lies on the ground
 * (`<cseen-mini data-grid>`), the lattice takes its origin and its two directions from that figure, so the
 * lines run exactly along the axes of the drawing. Without one it is a plain diamond lattice.
 */
type V2 = [number, number];

/** Lays the canvas over `hero` and lights the lattice lines under the pointer. */
export function startTrail(hero: HTMLElement) {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'cn-trail';
  canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const A = 30;              // half the width of a cell of the plain lattice, in pixels
  const BELOW = 160;         // how far the glow runs on below the hero, fading out, so it has no hard edge
  const FADE = 0.975;        // heat kept per frame: closer to 1 is a slower fade (0.94 was quick, 0.975 lingers about 2.5 times longer)
  const R = 120;             // how far the glow reaches
  const CELL = 0.5;          // a cell of the figure's lattice, in the figure's own units
  let w = 0, h = 0, raf = 0, accent = '#00a86b';
  let o: V2 = [0, 0], ex: V2 = [A, A / 2], ey: V2 = [-A, A / 2];     // origin and the step along i and along j
  let i0 = 0, j0 = 0, nI = 0, nJ = 0, heat = new Float32Array(0);
  let oI0 = 0, oJ0 = 0, oNI = 0, oNJ = 0;   // the range the current heat array was laid out for

  // where the lattice is: from the figure if there is one
  const basis = () => {
    const fig = hero.querySelector<HTMLElement>('cseen-mini[data-grid]');
    if (fig?.dataset.grid) {
      const g = fig.dataset.grid.split(',').map(Number), r = fig.getBoundingClientRect(), hr = canvas.getBoundingClientRect();
      if (r.width > 0 && g.length === 6 && g.every(Number.isFinite)) {
        o = [r.left - hr.left + g[0] * r.width, r.top - hr.top + g[1] * r.width];
        ex = [g[2] * r.width * CELL, g[3] * r.width * CELL];
        ey = [g[4] * r.width * CELL, g[5] * r.width * CELL];
        return;
      }
    }
    o = [w / 2, h / 2]; ex = [A, A / 2]; ey = [-A, A / 2];
  };
  const det = () => ex[0] * ey[1] - ex[1] * ey[0];
  // the lattice coordinates of a pixel, and the pixel of a lattice vertex
  const lat = (x: number, y: number): V2 => { const dx = x - o[0], dy = y - o[1], d = det(); return [(dx * ey[1] - dy * ey[0]) / d, (ex[0] * dy - ex[1] * dx) / d]; };
  const pos = (i: number, j: number): V2 => [o[0] + i * ex[0] + j * ey[0], o[1] + i * ex[1] + j * ey[1]];
  const at = (i: number, j: number) => (i - i0) * nJ + (j - j0);
  const inside = (i: number, j: number) => i >= i0 && j >= j0 && i < i0 + nI && j < j0 + nJ;

  const size = () => {
    // the canvas reaches past the hero: to the top of the page and to both edges of the window
    const r = hero.getBoundingClientRect();
    const left = -r.left, top = -(r.top + scrollY);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = document.documentElement.clientWidth; h = r.bottom + scrollY + BELOW;
    canvas.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    relattice();
  };
  // the lattice follows the figure when it moves or zooms
  const relattice = () => {
    basis();
    // the lattice range that covers the hero
    const c = [lat(0, 0), lat(w, 0), lat(0, h), lat(w, h)];
    i0 = Math.floor(Math.min(...c.map((p) => p[0]))) - 2; j0 = Math.floor(Math.min(...c.map((p) => p[1]))) - 2;
    nI = Math.ceil(Math.max(...c.map((p) => p[0]))) + 3 - i0; nJ = Math.ceil(Math.max(...c.map((p) => p[1]))) + 3 - j0;
    // the figure re-measures every frame while its camera zooms: keep the glow that is already there, it rides along with the lattice
    const old = heat, oi = oI0, oj = oJ0, onI = oNI, onJ = oNJ;
    heat = new Float32Array(nI * nJ);
    for (let i = Math.max(i0, oi); i < Math.min(i0 + nI, oi + onI); i++) {
      for (let j = Math.max(j0, oj); j < Math.min(j0 + nJ, oj + onJ); j++) heat[at(i, j)] = old[(i - oi) * onJ + (j - oj)];
    }
    oI0 = i0; oJ0 = j0; oNI = nI; oNJ = nJ;
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    let alive = false;
    for (let i = i0; i < i0 + nI - 1; i++) {
      for (let j = j0; j < j0 + nJ - 1; j++) {
        const k = at(i, j), v = heat[k];
        if (v < 0.02) continue;
        heat[k] = v * FADE;
        alive = true;
        const [x, y] = pos(i, j), [x1, y1] = pos(i + 1, j), [x2, y2] = pos(i, j + 1);
        ctx.globalAlpha = Math.min(0.5, v * 0.5);
        ctx.strokeStyle = accent;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    raf = alive ? requestAnimationFrame(draw) : 0;
  };

  const move = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (px < 0 || py < 0 || px > w || py > h) return;
    // the lattice vertices near the pointer pick up heat, more the closer they are
    const [ci, cj] = lat(px, py);
    const step = Math.min(Math.hypot(...ex), Math.hypot(...ey)), span = Math.ceil(R / Math.max(step, 4)) + 2;
    for (let i = Math.floor(ci) - span; i <= ci + span; i++) {
      for (let j = Math.floor(cj) - span; j <= cj + span; j++) {
        if (!inside(i, j)) continue;
        const [x, y] = pos(i, j), d = Math.hypot(x - px, y - py);
        if (d < R) heat[at(i, j)] = Math.max(heat[at(i, j)], 1 - d / R);
      }
    }
    if (!raf) { accent = getComputedStyle(document.documentElement).getPropertyValue('--cn-accent').trim() || accent; raf = requestAnimationFrame(draw); }
  };

  size();
  hero.addEventListener('cseen-grid', relattice);
  // a resize fires many times per frame and each call reallocates the canvas: once per frame is enough
  let sizing = 0;
  const sizeLater = () => { cancelAnimationFrame(sizing); sizing = requestAnimationFrame(size); };
  addEventListener('resize', sizeLater);
  addEventListener('pointermove', move, { passive: true });
  // the figure may settle after the first layout (fonts, images): measure again
  addEventListener('load', size);
}
