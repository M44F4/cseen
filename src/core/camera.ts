import { Animatable } from './animatable.ts';
import { cross, dot, norm, rad, sub, type V3 } from './math.ts';

/** A camera preset (`iso`, `front`, `side`, `top`) or explicit `{ yaw, pitch }` angles in degrees. */
export type View = 'iso' | 'front' | 'side' | 'top' | { yaw: number; pitch: number };

/** Angles in degrees of the named views. */
const PRESETS = {
  iso: { yaw: 30, pitch: 28 }, // the default: x to the right, y into the scene, z up
  front: { yaw: 0, pitch: 0 },
  side: { yaw: 90, pitch: 0 },
  top: { yaw: 0, pitch: 90 },
};

/**
 * World axes: x to the right, y into the scene, z up. Every scene shares them, so a figure
 * never has to explain where "up" is.
 *
 * `project` returns [screenX, screenY (down), depth]. Larger depth means farther away.
 *
 * @example
 * const s = new Scene({
 *   view: Camera.perspective({ position: [5, -9, 5], target: [0, 0, 1], fov: 35 }),
 * });
 * s.add(ground(), box({ at: [0, 0, 0], size: 1.5, role: 'accent' }));
 */
export class Camera extends Animatable {
  kind: 'ortho' | 'persp';

  private constructor(kind: 'ortho' | 'persp', props: Record<string, number | number[]>) {
    super();
    this.kind = kind;
    this.props = props;
  }

  /** A parallel (axonometric) camera. This is the look of technical illustration. */
  static axonometric(view: View = 'iso'): Camera {
    const v = typeof view === 'string' ? PRESETS[view] : view;
    return new Camera('ortho', { yaw: v.yaw, pitch: v.pitch, zoom: 1 });
  }

  /** A pinhole camera with real perspective. */
  static perspective(o: { position: V3; target?: V3; fov?: number }): Camera {
    return new Camera('persp', { position: o.position, target: o.target ?? [0, 0, 0], fov: o.fov ?? 40, zoom: 1 });
  }

  /** Magnification applied after the picture is framed: 1 is the framed size, 2 is twice as large. Animatable. */
  get zoom(): number {
    return (this.props.zoom as number) ?? 1;
  }

  /** Screen size of one world unit at a given depth, relative to the framing (1 for a parallel camera). */
  scaleAt(depth: number): number {
    if (this.kind === 'ortho') return 1;
    return 1 / Math.tan(rad(this.props.fov as number) / 2) / Math.max(depth, 1e-3);
  }

  /** Unit vector of the direction the camera looks along (towards increasing depth), for the parallel camera. */
  viewDir(): V3 {
    const yaw = rad(this.props.yaw as number), pitch = rad(this.props.pitch as number);
    return [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), -Math.sin(pitch)];
  }

  /** The perspective camera's orthonormal axes: forward `f`, right `r`, up `u`, and `k`, the focal factor from the field of view. */
  private basis(): { pos: V3; f: V3; r: V3; u: V3; k: number } {
    const pos = this.props.position as V3, target = this.props.target as V3;
    let f = norm(sub(target, pos));
    if (Math.hypot(f[0], f[1], f[2]) < 1e-9) f = [0, 1, 0]; // standing on the target: look along y, like the orthographic views
    let r = cross(f, [0, 0, 1]);
    if (Math.hypot(r[0], r[1], r[2]) < 1e-6) r = [1, 0, 0]; // looking straight up or down
    r = norm(r);
    const u = cross(r, f);
    return { pos, f, r, u, k: 1 / Math.tan(rad(this.props.fov as number) / 2) };
  }

  /** World point to [screenX, screenY (down), depth]. Perspective divides by depth, clamped so a point behind the camera cannot flip or blow up. */
  project(p: V3): V3 {
    if (this.kind === 'ortho') {
      const yaw = rad(this.props.yaw as number), pitch = rad(this.props.pitch as number);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = p[0] * cy - p[1] * sy;
      const y1 = p[0] * sy + p[1] * cy;
      return [x1, -(p[2] * cp + y1 * sp), y1 * cp - p[2] * sp];
    }
    const { pos, f, r, u, k } = this.basis();
    const rel = sub(p, pos);
    const z = dot(rel, f);
    const zc = Math.max(z, 1e-3);
    return [(dot(rel, r) / zc) * k, -(dot(rel, u) / zc) * k, z];
  }

  /**
   * Which side of a plane the viewer is on: positive when the eye is on the side the normal
   * points to, negative on the other side, near zero when the plane is seen edge-on.
   */
  eyeSide(planePoint: V3, normal: V3): number {
    if (this.kind === 'ortho') return -dot(this.viewDir(), normal);
    return dot(sub(this.props.position as V3, planePoint), normal);
  }

  /** True when a point is in front of the camera (always true for a parallel camera). */
  visible(p: V3): boolean {
    return this.kind === 'ortho' || this.project(p)[2] > 0.05;
  }
}
