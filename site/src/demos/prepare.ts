import type { Made } from './types.ts';

/**
 * Frames a demo so it can be turned: the bounding sphere of the whole timeline is fixed, so the
 * object keeps its size while the camera moves and nothing is cropped. Used when the page is built
 * and again in the browser, so the first paint and the live figure frame the scene the same way.
 * `tight` is for a figure that is never turned and is wide or flat: it is framed by its own bounds.
 */
export function prepare(m: Made, meta?: { title: string; summary?: string }, tight = false): Made {
  // a figure without a name is hidden from assistive technology, so give it the demo's
  if (meta && !m.s.title) { m.s.title = meta.title; m.s.desc ??= meta.summary; }
  // a tight figure is framed by its own bounds: a wide one then fills its box instead of sitting small in a sphere
  if (!tight) { m.s.fit = 'sphere'; m.s.sphere = undefined; }
  m.tl?.lockFit(m.s);
  return m;
}
