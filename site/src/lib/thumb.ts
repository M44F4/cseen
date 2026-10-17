import { renderStill } from '../../../src/index.ts';

type Made = Parameters<typeof renderStill>;

/** A still for a card thumbnail: the scene is drawn to the thumbnail's own shape (16 by 10), so its ground fills the box instead of stopping at the scene's own edges. */
export function thumbStill(s: Made[0], tl?: Made[1], ratio = 1.6): string {
  const [w, h] = s.size;
  if (!s.region) s.size = w / h > ratio ? [w, w / ratio] : [h * ratio, h];
  return renderStill(s, tl);
}
