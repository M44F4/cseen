/*
 * The loader: the cseen cube, spinning on its vertical axis. It is the mark made solid: seen from a corner, the top face is
 * the c (accent) and the two sides are the e e (ink). The others are the n (accent, as in the word) and the s (ink), so a turn reads s e e n round the cube, c on top.
 * It turns the way a ticker moves: the face on the right comes round to the front, so the letters arrive in reading order.
 * The same markup serves the Astro pages (Loader.astro) and the code that loads things (windows, the editor).
 * The letters are the walks of scripts/mark.mjs on a unit square; the animation is in styles/custom.css.
 */
const T = 0.18, hw = T / 2, a = hw, b = 0.5, z = 1 - hw;
const WALKS: Record<'c' | 's' | 'e' | 'n', number[][]> = {
  c: [[1, a], [a, a], [a, z], [1, z]],
  s: [[1, a], [a, a], [a, b], [z, b], [z, z], [0, z]],
  n: [[a, 1], [a, a], [z, a], [z, 1]],
  e: [[a, b], [z, b], [z, a], [a, a], [a, z], [1, z]],
};

/** the rectangles of a walk: a stroke runs on through a joint and stops flat at the two ends */
function rects(pts: number[][]): string {
  return pts.slice(1).map((q, i) => {
    const p = pts[i], dx = Math.sign(q[0] - p[0]), dy = Math.sign(q[1] - p[1]);
    const s0 = [p[0] - (i > 0 ? dx * hw : 0), p[1] - (i > 0 ? dy * hw : 0)];
    const s1 = [q[0] + (i < pts.length - 2 ? dx * hw : 0), q[1] + (i < pts.length - 2 ? dy * hw : 0)];
    const nx = dy !== 0 ? hw : 0, ny = dx !== 0 ? hw : 0;
    const x0 = Math.min(s0[0], s1[0]) - nx, x1 = Math.max(s0[0], s1[0]) + nx;
    const y0 = Math.min(s0[1], s1[1]) - ny, y1 = Math.max(s0[1], s1[1]) + ny;
    return `<rect x="${+(x0 * 100).toFixed(2)}" y="${+(y0 * 100).toFixed(2)}" width="${+((x1 - x0) * 100).toFixed(2)}" height="${+((y1 - y0) * 100).toFixed(2)}"/>`;
  }).join('');
}
const face = (cls: string, letter: keyof typeof WALKS, fill: string) =>
  `<span class="cn-face ${cls}"><svg viewBox="0 0 100 100" fill="${fill}" aria-hidden="true">${rects(WALKS[letter])}</svg></span>`;

export const LOADER = `<span class="cn-loader" role="status" aria-label="Loading"><span class="cn-tilt"><span class="cn-cube">${
  face('f-top', 'c', 'var(--cn-logo-b)') + face('f-bottom', 'c', 'var(--cn-logo-b)') +
  face('f-front', 'e', 'var(--cn-logo-a)') + face('f-right', 'e', 'var(--cn-logo-a)') +
  face('f-back', 'n', 'var(--cn-logo-b)') + face('f-left', 's', 'var(--cn-logo-a)')
}</span></span></span>`;
