import { Camera, type View } from './camera.ts';
import type { V3 } from './math.ts';
import { Group, type Node, type Prim } from './nodes.ts';
import { boundsOf, buildFrame, esc, fitOf, unionBounds, worldBox, type Bounds, type Fit, type Frame, type Region, type Sphere } from './render.ts';

/** Options of `new Scene`. */
export interface SceneOpts {
  /** a preset ('iso', 'front', 'side', 'top'), explicit angles, or a ready-made Camera */
  view?: View | Camera;
  /** drawing size in viewBox units. Defaults to 320 by 200. */
  size?: [number, number];
  /** space around the drawing in viewBox units, 12 by default */
  padding?: number;
  /** part of the picture the scene may use, leaving room for insets */
  region?: Region;
  /** direction towards the light, in world space */
  light?: V3;
  /** accessible name and description */
  title?: string;
  /** longer accessible description of the figure */
  desc?: string;
  /** a hand-drawn look: lines wobble a little and are drawn twice. `true`, or `{ roughness, seed }`. Repeatable: the same scene always wobbles the same way. */
  sketch?: boolean | { roughness?: number; seed?: number };
  /** 'auto' (default) fits the drawing each frame. 'sphere' fits the bounding sphere, so the object keeps its size while the camera turns. */
  fit?: 'auto' | 'sphere';
  /** cut faces that pierce each other along the crossing, so they sort correctly. Off by default: it costs time on every frame, and most scenes have nothing that pierces. */
  split?: boolean;
}

/**
 * A scene is a tree of nodes, a camera, and the settings to draw them.
 * It draws whatever state its nodes are in right now. A timeline changes that state over time.
 *
 * @example
 * const s = new Scene({ view: 'iso', title: 'A box on the ground' });
 * s.add(ground(), box({ at: [0, 0, 0], size: 1.5, role: 'accent' }));
 */
export class Scene {
  /** the top of the tree of nodes */
  root = new Group();
  camera: Camera;
  /** drawing size in viewBox units */
  size: [number, number];
  /** space around the drawing in viewBox units */
  padding: number;
  /** the part of the picture the scene may use */
  region?: Region;
  /** direction towards the light, in world space */
  light: V3;
  /** accessible name */
  title?: string;
  /** longer accessible description */
  desc?: string;
  /** 'auto' refits every frame. 'sphere' frames the bounding sphere. A locked fit keeps the picture steady while things move. */
  fit: 'auto' | 'sphere' | Fit = 'auto';
  /** with fit 'sphere': a sphere fixed ahead of time, so a moving scene keeps its framing (see `Timeline.lockFit`) */
  sphere?: Sphere;
  /** the hand-drawn look, if any */
  sketch?: { amp: number; seed: number };
  /** whether faces that pierce each other are cut before sorting */
  split: boolean;

  constructor(o: SceneOpts = {}) {
    this.camera = o.view instanceof Camera ? o.view : Camera.axonometric(o.view ?? 'iso');
    this.size = o.size ?? [320, 200];
    this.padding = o.padding ?? 12;
    this.region = o.region;
    this.light = o.light ?? [-0.5, -0.7, 1];
    this.fit = o.fit ?? 'auto';
    this.split = o.split ?? false;
    this.title = o.title;
    this.desc = o.desc;
    if (o.sketch) { const k = typeof o.sketch === 'object' ? o.sketch : {}; this.sketch = { amp: 1.3 * (k.roughness ?? 1), seed: k.seed ?? 3 }; }
  }

  /** Adds nodes to the scene. Adding one node returns it, so you can keep a reference to animate. */
  add<T extends Node>(node: T): T;
  add(...nodes: Node[]): void;
  add(...nodes: Node[]): Node | void {
    return this.root.add(...nodes);
  }

  /** Everything the nodes draw right now, flattened, in the order they were added. */
  prims(): Prim[] {
    const out: Prim[] = [];
    this.root.collect(out);
    return out;
  }

  /**
   * Where a point of the scene lands in the picture, in the scene's drawing units, with the framing as it is now.
   * Use it to line something up with the drawing, such as a grid on the page behind it.
   */
  screen(p: V3): [number, number] {
    const { fit } = this.frame(), q = this.camera.project(p);
    return [q[0] * fit.s + fit.tx, q[1] * fit.s + fit.ty];
  }

  /** Draws the scene as it is now: the items back to front and the framing used. `svg` and `mount` build on it. */
  frame(): Frame {
    return buildFrame(this.prims(), this.camera, { size: this.size, padding: this.padding, fit: this.fit, sphere: this.sphere, region: this.region, light: this.light, sketch: this.sketch, split: this.split });
  }

  /**
   * Keeps the picture still while things move. Pass the bounds of every moment you care about
   * (see `lockFit` on a timeline) so nothing is ever cropped.
   */
  lockTo(b: Bounds) {
    this.fit = fitOf(b, this.size, this.padding, this.region);
  }
  /** the box around every point in world space, for framing by sphere */
  box(): { lo: V3; hi: V3 } | null {
    return worldBox(this.prims());
  }
  /** the box around the drawing on screen, before fitting, or null when nothing is visible */
  bounds(): Bounds | null {
    return boundsOf(this.prims(), this.camera);
  }

  /** The scene as a complete, standalone SVG string. Safe to render on the server. */
  svg(o: { class?: string } = {}): string {
    const f = this.frame();
    const [w, h] = this.size;
    const label = this.title ? ` role="img" aria-label="${esc(this.title)}"` : ' aria-hidden="true"';
    const head = this.title ? `<title>${esc(this.title)}</title>${this.desc ? `<desc>${esc(this.desc)}</desc>` : ''}` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="cseen${o.class ? ` ${o.class}` : ''}" viewBox="0 0 ${w} ${h}"${label}>${head}${f.items.map((i) => i.html).join('')}</svg>`;
  }
}

export { unionBounds };
