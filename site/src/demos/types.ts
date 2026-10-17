import type { Scene, Timeline } from '../../../src/index.ts';

export type Pack = 'core' | 'shapes' | 'objects' | 'devices' | 'ui' | 'charts' | 'waves' | 'optics' | 'math' | 'flow';
export type Opts = Record<string, unknown>;
export interface Made { s: Scene; tl?: Timeline }

interface Base { key: string; label?: string }
export type Control =
  | (Base & { type: 'number'; min: number; max: number; step?: number })
  | (Base & { type: 'boolean' })
  | (Base & { type: 'select'; options: string[] })
  | (Base & { type: 'text' });

export interface Demo {
  /** `pack/name`, unique. Used in URLs and `<Demo id>` */
  id: string;
  pack: Pack;
  title: string;
  summary?: string;
  /** the export this demo shows, when it is one function of the library: links the card to its reference entry */
  fn?: string;
  /** a group inside the pack page, for headings */
  group?: string;
  controls: Control[];
  defaults: Opts;
  /** the scene for these option values */
  make(o: Opts): Made;
  /** the exact code that draws what make(o) draws */
  code(o: Opts): string;
  /** option-driven demos redraw on every change; others have nothing to change */
  live?: boolean;
}

/** `lib: false` marks a gallery section that is not an import of its own: its things come from the core and devices */
export const PACKS: { id: Pack; title: string; blurb: string; lib?: boolean }[] = [
  { id: 'core', title: 'Core', blurb: 'Scenes, cameras, shapes, text, animation and arrows.' },
  { id: 'shapes', title: 'Shapes', blurb: 'Lines, curves, circles and flat shapes.', lib: false },
  { id: 'objects', title: 'Objects and solids', blurb: 'Boxes, cylinders, spheres and surfaces.', lib: false },
  { id: 'devices', title: 'Devices', blurb: 'Screens, computers, peripherals and network gear.' },
  { id: 'ui', title: 'UI on screens', blurb: 'Progress, notifications, dialogs, badges and chat.' },
  { id: 'charts', title: 'Charts', blurb: 'Ten chart types drawn on a plane, coloured by the theme.' },
  { id: 'waves', title: 'Waves', blurb: 'Transverse, spherical, sonar, interference and echo.' },
  { id: 'optics', title: 'Optics', blurb: 'Pinhole camera, focal length and stereo depth.' },
  { id: 'math', title: 'Maths', blurb: 'Graphs, matrices, planes under a matrix, fields and circles.' },
  { id: 'flow', title: 'Graphs and flow', blurb: 'Flowcharts, trees and networks that lay themselves out.' },
];
