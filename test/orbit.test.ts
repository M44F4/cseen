import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Camera, box, dragToAngles, clampZoom, orbitPosition, anglesOf } from '../src/index.ts';
import { readAngles, writeAngles } from '../src/anim/orbit.ts';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('dragging right raises yaw, dragging down raises pitch, pitch is clamped', () => {
  const a = dragToAngles({ yaw: 10, pitch: 20 }, 50, 25, { sensitivity: 0.4 });
  near(a.yaw, 30);
  near(a.pitch, 30);
  assert.equal(dragToAngles({ yaw: 0, pitch: 80 }, 0, 1000).pitch, 90);
  assert.equal(dragToAngles({ yaw: 0, pitch: -80 }, 0, -1000).pitch, -89);
  assert.equal(dragToAngles({ yaw: 0, pitch: 0 }, 1000, 0, { limits: { yaw: [-45, 45] } }).yaw, 45);
});

test('zoom keeps inside its range', () => {
  assert.equal(clampZoom(1, 100), 6);
  assert.equal(clampZoom(1, 0.0001), 0.4);
  near(clampZoom(2, 1.5), 3);
});

test('orbitPosition and anglesOf are inverses, and match the parallel camera direction', () => {
  const t: [number, number, number] = [1, 2, 3];
  const pos = orbitPosition(t, 35, 20, 8);
  const a = anglesOf(pos, t);
  near(a.yaw, 35); near(a.pitch, 20); near(a.distance, 8);
  const d = Camera.axonometric({ yaw: 35, pitch: 20 }).viewDir();
  for (let i = 0; i < 3; i++) near((t[i] - pos[i]) / 8, d[i]);
});

test('a perspective camera keeps its distance and still looks at the target while orbiting', () => {
  const cam = Camera.perspective({ position: [0, -6, 2], target: [0, 0, 1] });
  const d0 = anglesOf(cam.props.position as [number, number, number], [0, 0, 1]).distance;
  const a = readAngles(cam);
  writeAngles(cam, a.yaw + 70, a.pitch - 10);
  near(anglesOf(cam.props.position as [number, number, number], [0, 0, 1]).distance, d0);
  const q = cam.project([0, 0, 1]);
  near(q[0], 0); near(q[1], 0);
});

test('sphere fit keeps the object the same size at every angle; auto fit does not', () => {
  const make = (fit: 'auto' | 'sphere') => {
    const s = new Scene({ fit });
    s.add(box({ at: [0, 0, 0], size: [3, 1, 1] }));
    return s;
  };
  const scale = (s: Scene, yaw: number) => { s.camera.set('yaw', yaw); return s.frame().fit.s; };
  const sp = make('sphere'), au = make('auto');
  near(scale(sp, 0), scale(sp, 60));
  assert.ok(Math.abs(scale(au, 0) - scale(au, 90)) > 0.5, 'auto fit changes with the angle');
});

test('sphere fit centres the object and keeps it inside the picture', () => {
  const s = new Scene({ fit: 'sphere', padding: 12 });
  s.add(box({ at: [4, 2, 0], size: 2 }));
  for (const yaw of [0, 45, 90, 200]) for (const pitch of [0, 30, 90]) {
    s.camera.set('yaw', yaw); s.camera.set('pitch', pitch);
    const b = s.bounds()!, f = s.frame().fit;
    assert.ok(b.x0 * f.s + f.tx >= 12 - 1e-6 && b.x1 * f.s + f.tx <= 320 - 12 + 1e-6, `x inside at ${yaw},${pitch}`);
    assert.ok(b.y0 * f.s + f.ty >= 12 - 1e-6 && b.y1 * f.s + f.ty <= 200 - 12 + 1e-6, `y inside at ${yaw},${pitch}`);
  }
});

test('zoom scales the framing about the middle and is animatable', () => {
  const s = new Scene({ fit: 'sphere' });
  s.add(box({ at: [0, 0, 0], size: 2 }));
  const f1 = s.frame().fit;
  s.camera.set('zoom', 2);
  const f2 = s.frame().fit;
  near(f2.s, f1.s * 2);
  near(f2.tx - 160, (f1.tx - 160) * 2);
  assert.equal(s.camera.get('zoom'), 2);
});

test('sphere fit works with a perspective camera and falls back when the eye is inside the sphere', () => {
  const s = new Scene({ fit: 'sphere', view: Camera.perspective({ position: [0, -10, 2], target: [0, 0, 0.5] }) });
  s.add(box({ at: [0, 0, 0], size: 2 }));
  assert.ok(s.frame().fit.s > 0);
  s.camera.set('position', [0, 0, 0.5]);
  assert.ok(Number.isFinite(s.frame().fit.s));
});

test('lockFit on a sphere-fit scene fixes one sphere for the whole timeline', async () => {
  const { Timeline, moveTo } = await import('../src/index.ts');
  const s = new Scene({ fit: 'sphere' });
  const b = s.add(box({ at: [0, 0, 0], size: 1 }));
  const tl = new Timeline();
  tl.play(moveTo(b, [6, 0, 0], 1));
  const free = s.frame().fit.s;
  tl.lockFit(s);
  assert.ok(s.sphere && s.sphere.r > 3, 'sphere covers the whole move');
  assert.equal(s.fit, 'sphere');
  const a = s.frame().fit.s;
  tl.seek(1);
  near(s.frame().fit.s, a);
  assert.ok(a < free, 'framing is wider than the starting position alone');
});
