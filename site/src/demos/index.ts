import { assetDemos } from './registry/assets.ts';
import { sceneDemos } from './registry/scenes.ts';
import type { Demo, Pack } from './types.ts';

/** every demo, in page order: option-driven ones first inside their pack, then the whole scenes */
export const demos: Demo[] = [...assetDemos, ...sceneDemos];
export const byId = new Map(demos.map((d) => [d.id, d]));
export const inPack = (p: Pack) => demos.filter((d) => d.pack === p);
export { PACKS } from './types.ts';
export type { Demo, Pack, Control, Made, Opts } from './types.ts';
