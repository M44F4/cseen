/* The named camera views of the demo windows and the playground, kept apart so the sandbox frame can import them without the window code. */
import { Camera, orbitPosition, sphereOf, type Scene } from '../../../../src/index.ts';

export const PRESET: Record<string, { yaw: number; pitch: number }> = { iso: { yaw: 30, pitch: 28 }, front: { yaw: 0, pitch: 0 }, side: { yaw: 90, pitch: 0 }, top: { yaw: 0, pitch: 90 } };

/** the names a view message may carry */
export const isView = (v: unknown): v is string => v === 'persp' || (typeof v === 'string' && Object.hasOwn(PRESET, v));

/** points a freshly built scene at a preset view; perspective looks at the scene's bounding sphere */
export function applyPreset(scene: Scene, name: string) {
  if (name === 'persp') {
    const sp = scene.sphere ?? sphereOf(scene.prims());
    if (sp) scene.camera = Camera.perspective({ position: orbitPosition(sp.c, PRESET.iso.yaw, PRESET.iso.pitch, sp.r * 3.3), target: sp.c, fov: 35 });
  } else scene.camera = Camera.axonometric(PRESET[name]);
}
