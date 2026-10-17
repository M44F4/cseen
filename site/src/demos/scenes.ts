/*
 * The scenes of the docs site. The code between "#region" and "#endregion" is exactly what the page
 * shows next to each figure, and exactly what runs to draw it.
 */
import {
  Scene, Timeline, arrow, axes, box, browser, circle, cloud, code, database, dot, fadeIn, draw, group, ground, label, laptop, pen, graph,
  product, transform2d, vectorField, numberLine, unitCircle, bars, lines, donut, radar, frustum, stereoRig, link, wave, radio, pulse,
  micStand, progress, notification, toast, dialog, badge, chat, router, monitor, moveBy, moveTo, phone, rect, seq, server, speaker, sphere, stagger, par,
  terminal, tween, typeOn, wait, write, cameraGlyph, line, Camera, polygon, path, curve, dimension, surface, heightField,
  Construct, arcSegs, lineSegs, segsD, circleD, lineD,
  diagram, flowchart, treeDiagram, sequence,
} from '../../../src/all.ts';
import type { V3, Pt, Anim, Group } from '../../../src/all.ts';
import type { Animatable } from '../../../src/core/animatable.ts';

export interface Made { s: Scene; tl?: Timeline }

/* ------------------------------------------------------------------ first steps */

export const hello = (): Made => {
  // #region hello
  const s = new Scene();
  s.add(ground(), axes({ at: [-2.5, -1.5, 0] }));
  s.add(box({ at: [0.5, 1, 0], size: 1.5, role: 'accent' }));
  // #endregion
  return { s };
};

export const coordinates = (): Made => {
  // #region coordinates
  const s = new Scene();
  s.add(ground(), axes({ length: 3.5 }));
  const mid = { anchor: 'middle' } as const;
  s.add(box({ at: [3, 0, 0], size: 0.8 }));
  s.add(label('x = 3', [3, 0, 1.3], mid));
  s.add(box({ at: [0, 3, 0], size: 0.8 }));
  s.add(label('y = 3', [0, 3, 1.3], mid));
  s.add(box({ at: [0, 0, 2], size: 0.8, role: 'accent' }));
  s.add(label('z = 2', [0, 0, 3.3], mid));
  // #endregion
  return { s };
};


export const firstMore = (): Made => {
  // #region firstMore
  const s = new Scene();
  s.add(ground(), axes({ at: [-4, -2, 0], length: 1.5 }));
  const a = s.add(box({ at: [-2, 0, 0], size: 1.2 }));
  const b = s.add(box({ at: [1.5, 1, 0], size: 1.5, role: 'accent' }));
  s.add(label('input', [-2, 0, 1.7], { anchor: 'middle' }));
  s.add(label('result', [1.5, 1, 2.2], { anchor: 'middle' }));
  s.add(arrow(a.anchor([0.6, 0, 0.6]), b.anchor([-0.75, 0, 0.75]), { role: 'accent' }));
  // #endregion
  return { s };
};

export const firstMove = (): Made => {
  // #region firstMove
  const s = new Scene();
  s.add(ground(), axes({ at: [-4, -2, 0], length: 1.5 }));
  const a = s.add(box({ at: [-2, 0, 0], size: 1.2 }));
  const b = s.add(box({ at: [1.5, 1, 0], size: 1.5, role: 'accent' }));
  const tag = s.add(label('result', [1.5, 1, 2.2], { anchor: 'middle' }));
  const flow = s.add(arrow(a.anchor([0.6, 0, 0.6]), b.anchor([-0.75, 0, 0.75]), { role: 'accent' }));

  const tl = new Timeline();
  tl.play(stagger(0.25, fadeIn(a), fadeIn(b), fadeIn(tag)));   // one after another
  tl.chapter('flow').play(draw(flow, 0.9));                   // a named step you can jump to
  tl.chapter('move').play(moveBy(b, [0, 1.5, 0], 1.2));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const cameraParallel = (): Made => {
  // #region cameraParallel
  // parallel: lines that are parallel in the scene stay parallel on the page
  const s = new Scene({ view: { yaw: 40, pitch: 20 } });
  s.add(ground(), axes({ at: [-3, -2, 0], length: 1.5 }));
  s.add(laptop({ at: [-1.5, 0, 0], width: 2.6 }));
  s.add(phone({ at: [1.6, -0.6, 0], height: 1.5 }));
  // #endregion
  return { s };
};

export const cameraPerspective = (): Made => {
  // #region cameraPerspective
  // perspective: things shrink with distance, and lines meet at a vanishing point
  const s = new Scene({ view: Camera.perspective({ position: [5, -9, 5], target: [0, 0, 1], fov: 35 }) });
  s.add(ground(), axes({ at: [-3, -2, 0], length: 1.5 }));
  s.add(laptop({ at: [-1.5, 0, 0], width: 2.6 }));
  s.add(phone({ at: [1.6, -0.6, 0], height: 1.5 }));
  // #endregion
  return { s };
};


/* ------------------------------------------------------------------ shapes, objects and solids */

export const shapesFlat = (): Made => {
  // #region shapesFlat
  const s = new Scene();
  s.add(ground(), axes({ at: [-5, -2.5, 0], length: 1.2 }));
  s.add(polygon([[-3.8, 0, 0], [-1.8, 0, 0], [-2.8, 0, 1.8]], { role: 'accent' }));   // any number of points
  s.add(rect([0, 0, 0], [2.4, 1.6], { plane: 'xy' }));                                 // a flat rectangle on the ground
  s.add(circle([3.4, 0, 0], 1.1, { plane: 'xy', role: 'accent' }));                    // a circle, in any of the three planes
  s.add(circle([3.4, 0, 0], 0.5, { plane: 'xz', role: 'ink' }));
  s.add(dot([0, 0, 1.2]));
  // #endregion
  return { s };
};

export const shapesLines = (): Made => {
  // #region shapesLines
  const s = new Scene();
  s.add(ground());
  s.add(line([-4, -1, 0], [-1.5, -1, 2]));                                              // a straight line
  s.add(arrow([-4, 0.4, 0], [-1.5, 0.4, 2], { role: 'accent' }));                       // with an arrowhead
  s.add(path([[0, -1, 0], [1, 0, 1.6], [2, -1, 0], [3, 0, 1.6]]));                      // through as many points as you like
  s.add(curve((t) => [-4 + 8 * t, 2, 1 + Math.sin(t * Math.PI * 2)], { role: 'accent' })); // a function of t from 0 to 1
  s.add(dimension([-4, -2.6, 0], [4, -2.6, 0], '8 units'));                             // a measured distance
  // #endregion
  return { s };
};

export const objectsBoxes = (): Made => {
  // #region objectsBoxes
  const s = new Scene();
  s.add(ground());
  s.add(box({ at: [-4.2, 0, 0], size: 1.2 }));                                  // one number is a cube
  s.add(box({ at: [-1.8, 0, 0], size: [2, 1, 0.6], role: 'accent' }));          // width, depth and height
  s.add(box({ at: [1, 0, 0], size: 1.2, rot: [0, 0, 30] }));                    // turned 30 degrees
  s.add(box({ at: [3.8, 0, 0], size: 1.4, alpha: 0.25 }));                      // see-through
  // #endregion
  return { s };
};

export const objectsSurfaces = (): Made => {
  // #region objectsSurfaces
  const s = new Scene();
  s.add(ground());
  // a function z = f(x, y)
  s.add(heightField((x, y) => 0.6 * Math.sin(x) * Math.cos(y) + 0.7, { x: [-4.5, -0.5], y: [-2, 2], res: [24, 24], role: 'accent' }));
  // a parametric surface: (u, v) in, a point out. Here a half cylinder
  s.add(surface((u, v) => [1.2 + 3 * u, 1.3 * Math.cos(Math.PI * v), 1.3 * Math.sin(Math.PI * v)], { res: [8, 20] }));
  // #endregion
  return { s };
};

/* ------------------------------------------------------------------ controlling things */

export const place = (): Made => {
  // #region place
  const s = new Scene();
  s.add(ground());
  s.add(laptop({ at: [-3.2, 0, 0], width: 2.4 }));
  s.add(laptop({ at: [0, 0, 0], width: 2.4, rot: [0, 0, 35] }));  // turned 35 degrees
  s.add(laptop({ at: [3.2, 0, 0], width: 2.4, scale: 0.6 }));     // smaller
  // #endregion
  return { s };
};

export const groups = (): Made => {
  // #region groups
  const s = new Scene();
  s.add(ground());
  const desk = group({ rot: [0, 0, 18] });   // turn the whole group at once
  desk.add(box({ at: [0, 0, 0.8], size: [4.4, 2.2, 0.12], fill: 0.1 }));
  for (const [x, y] of [[-2, -0.9], [2, -0.9], [-2, 0.9], [2, 0.9]]) {
    desk.add(box({ at: [x, y, 0], size: [0.12, 0.12, 0.8] }));
  }
  desk.add(monitor({ at: [-0.8, 0.2, 0.92], width: 1.9 }));
  desk.add(phone({ at: [1.4, -0.3, 0.92], height: 0.9 }));
  s.add(desk);
  // #endregion
  return { s };
};

export const roles = (): Made => {
  // #region roles
  const s = new Scene();
  s.add(ground());
  ['ink', 'faint', 'accent', 'warm', 'cool'].forEach((role, i) => {
    const x = (i - 2) * 1.8;
    s.add(box({ at: [x, 0, 0], size: 1.2, role, fill: 0.5 }));
    s.add(label(role, [x, 0, 1.6], { anchor: 'middle' }));
  });
  // #endregion
  return { s };
};

export const glass = (): Made => {
  // #region glass
  const s = new Scene();
  s.add(ground());
  [1, 0.5, 0.2].forEach((alpha, i) => {
    const x = -3.6 + i * 2.6;
    s.add(sphere({ at: [x + 0.8, 1.4, 0], r: 0.6, role: 'ink' }));
    s.add(rect([x, -0.4, 0], [1.6, 2], { plane: 'xz', role: 'accent', fill: 1, alpha }));
    s.add(label(`alpha ${alpha}`, [x + 0.8, -0.4, 2.4], { anchor: 'middle' }));
  });
  // #endregion
  return { s };
};

export const follow = (): Made => {
  // #region follow
  const s = new Scene();
  s.add(ground());
  const p = s.add(phone({ at: [-3, 0, 0], height: 1.6 }));
  const c = s.add(cloud({ at: [3, 2, 2.4], size: 2 }));
  // the arrow is attached to both objects, so it follows them
  s.add(arrow(p.anchor([0, 0, 1.7]), c.anchor([-1, 0, 0.5]), { role: 'accent' }));

  const tl = new Timeline();
  tl.play(moveTo(p, [-3, 2.5, 0], 1.6));
  tl.play(moveTo(c, [3, -1, 2.4], 1.6));
  tl.play(wait(0.6));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const buildup = (): Made => {
  // #region buildup
  const s = new Scene();
  s.add(ground());
  const mic = s.add(micStand({ at: [-3, 0, 0] }));
  const mon = s.add(monitor({ at: [0, 1, 0], width: 3 }));
  const spk = s.add(speaker({ at: [3.2, 0, 0] }));
  const a = s.add(arrow(mic.anchor([0, 0, 1.6]), mon.anchor([-1.4, -0.1, 1.1]), { role: 'accent' }));
  const b = s.add(arrow(mon.anchor([1.4, -0.1, 1.1]), spk.anchor([0, -0.3, 1.2]), { role: 'accent' }));

  const tl = new Timeline();
  tl.play(stagger(0.35, fadeIn(mic), fadeIn(mon), fadeIn(spk)));
  tl.chapter('connect').play(seq(draw(a, 0.8), draw(b, 0.8)));
  tl.play(wait(0.8));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const orbit = (): Made => {
  // #region orbit
  const s = new Scene();
  s.add(ground(), axes({ at: [-3, -2, 0], length: 1.5 }));
  s.add(laptop({ at: [-1.5, 0, 0], width: 2.6 }));
  s.add(phone({ at: [1.6, -0.6, 0], height: 1.5 }));
  s.add(cloud({ at: [0.4, 3, 2.4], size: 2 }));

  const tl = new Timeline();
  // the camera is animated like anything else
  tl.play(tween(s.camera, { yaw: 150, pitch: 24 }, { duration: 5 }));
  tl.play(wait(0.8));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

/* ------------------------------------------------------------------ text and code on planes */

export const writing = (): Made => {
  // #region writing
  const s = new Scene();
  s.add(ground());
  // u and v: the directions of the text's right and up
  s.add(write(['Hello,', 'floor.'], {
    at: [-4.5, -2.2, 0.01], u: [1, 0, 0], v: [0, 1, 0], size: [3.4, 2], fontSize: 0.7, border: 'faint',
  }));
  s.add(write('A wall', { at: [0, 3, 0], size: [3.2, 1.3], fontSize: 0.8 }));   // default: x right, z up
  s.add(write('A slope', {
    at: [1.5, -2, 0], u: [1, 0, 0], v: [0, 0.5, 0.87], size: [3, 1.2], fontSize: 0.7, color: 'var(--cn-accent)',
  }));
  // #endregion
  return { s };
};

export const typing = (): Made => {
  // #region typing
  const s = new Scene();
  const lap = s.add(laptop({ width: 4.2 }));
  const src = lap.code([
    'const s = new Scene();',
    's.add(ground(), laptop());',
    '',
    '// animate it',
    'tl.play(fadeIn(laptop));',
  ], { numbers: true });

  const tl = new Timeline();
  tl.play(typeOn(src, 5));
  tl.play(wait(1.2));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const shell = (): Made => {
  // #region shell
  const s = new Scene();
  const term = s.add(terminal({ width: 4.4, title: 'zsh' }));
  const out = term.write(['$ npm install', 'added 1 package', '$ npm run build', 'done in 0.4s'], { cursor: true });

  const tl = new Timeline();
  tl.play(typeOn(out, 4));
  tl.play(wait(1.2));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const wrapping = (): Made => {
  // #region wrapping
  const s = new Scene();
  const win = s.add(browser({ width: 4.4, url: 'status.example.com' }));
  // long lines wrap to the window and shrink to fit, so nothing runs past the edge
  const msg = win.write(
    'Deploying the new version to production. This takes about two minutes, and nothing needs to be restarted.',
    { fontSize: 0.22, mark: { production: 'accent', 'two minutes': 's2', restarted: 'faint' }, cursor: true },
  );

  const tl = new Timeline();
  tl.play(typeOn(msg, 4));
  tl.play(wait(1.2));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const sizing = (): Made => {
  // #region sizing
  const s = new Scene({ view: 'front' });
  const text = 'Size text by preset, by lines, or in world units.';
  // 'sm' | 'md' | 'lg' are relative to the box, so they work at any scale
  s.add(write(text, { at: [-4.8, 0, 0.9], size: [3, 1.6], fontSize: 'sm', border: 'faint' }));
  s.add(write(text, { at: [-1.5, 0, 0.9], size: [3, 1.6], fontSize: 'md', border: 'faint' }));
  s.add(write(text, { at: [1.8, 0, 0.9], size: [3, 1.6], fontSize: 'lg', border: 'faint' }));
  // "lines: 2" means two lines fill the box
  s.add(write(text, { at: [-4.8, 0, -1.0], size: [3, 1.6], lines: 2, border: 'faint' }));
  // #endregion
  return { s };
};

/* ------------------------------------------------------------------ drawing */

export const sketchy = (sketch: boolean): Made => {
  // #region sketch
  // sketch: true gives the whole scene a hand-drawn look. It wobbles the same way every time.
  const s = new Scene({ sketch });
  s.add(ground(), laptop({ at: [-2.2, 0, 0], width: 2.4 }), server({ at: [2.4, 0.4, 0], width: 1.4 }), cloud({ at: [0, 2.2, 1.8], size: 1.8 }));
  // #endregion
  return { s };
};

export const penDemo = (): Made => {
  // #region penDemo
  const s = new Scene({ view: 'front' });
  // a pen draws a curve; draw runs from 0 to 1 and the pen rides at the tip
  const trace = s.add(pen((t) => [-3 + 6 * t, 0, 0.9 * Math.sin(t * 2 * Math.PI) + 1], { role: 'accent', width: 2.2 }));
  const frame = s.add(pen([[-3, 0, -0.6], [3, 0, -0.6], [3, 0, -1.8], [-3, 0, -1.8], [-3, 0, -0.6]], { role: 'ink' }));

  const tl = new Timeline();
  tl.play(tween(trace, { draw: 1 }, { duration: 2.4, ease: 'inOut' }));
  tl.play(tween(frame, { draw: 1 }, { duration: 2, ease: 'inOut' }));
  tl.play(wait(1));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

/* ------------------------------------------------------------------ maths */

export const mathGraph = (): Made => {
  // #region mathGraph
  const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
  const g = s.add(graph({ fn: (x) => Math.sin(x) + 0.3 * x, x: [-4, 4], tangent: true, size: [4.4, 2.8] }));
  g.set('x', -3.6);

  const tl = new Timeline();
  // slide the point: the tangent follows, and its slope is read out
  tl.play(tween(g, { x: 3.6 }, { duration: 5, ease: 'inOut' }));
  // #endregion
  return { s, tl };
};

export const mathRiemann = (): Made => {
  // #region mathRiemann
  const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
  const g = s.add(graph({ fn: (x) => x * x / 4 + 0.5, x: [0, 4], area: [0.5, 3.5], riemann: { n: 3, rule: 'mid' }, size: [4.4, 2.8] }));

  const tl = new Timeline();
  // more rectangles, and the sum closes in on the exact area
  tl.play(tween(g, { n: 40 }, { duration: 5, ease: 'out' }));
  tl.play(wait(1));
  // #endregion
  return { s, tl };
};

export const mathProduct = (): Made => {
  // #region mathProduct
  const A = [[1, 2], [3, 4]], B = [[5, 6], [7, 8]];
  const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
  const p = s.add(product(A, B, { size: [5.4, 2] }));
  p.set('step', 0);

  const tl = new Timeline();
  // one entry of the result per second: a row of A meets a column of B
  tl.play(tween(p, { step: 4 }, { duration: 6, ease: 'linear' }));
  tl.play(wait(1));
  // #endregion
  return { s, tl };
};

export const mathTransform = (): Made => {
  // #region mathTransform
  const shear = [[1, 1], [0, 1]], turn = [[0, -1], [1, 0]];
  const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
  const t = s.add(transform2d(shear, { eigen: true, size: [4, 4] }));
  t.set('t', 0);

  const tl = new Timeline();
  // the grid bends, the basis vectors land on the matrix columns, the unit square keeps its area
  tl.play(tween(t, { t: 1 }, { duration: 3 }));
  tl.play(wait(1));
  // #endregion
  void turn;
  return { s, tl };
};

export const mathField = (): Made => {
  // #region mathField
  const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
  const f = s.add(vectorField((x, y) => [-y, x], { range: [-3, 3, -2, 2], size: [4.4, 3] }));
  f.set('grow', 0);

  const tl = new Timeline();
  tl.play(tween(f, { grow: 1 }, { duration: 2 }));
  tl.play(wait(1));
  // #endregion
  return { s, tl };
};

export const mathLine = (): Made => {
  // #region mathLine
  const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
  const n = s.add(numberLine({ range: [-4, 6], size: [5.4, 1.5], jumps: [{ from: 1, to: 4, label: '+3' }, { from: 4, to: -2, label: '\u22126' }], marks: [{ value: 1, label: 'start' }] }));
  n.set('value', 1);
  n.set('jump', 0);

  const tl = new Timeline();
  tl.play(par(tween(n, { jump: 1 }, { duration: 1.2 }), tween(n, { value: 4 }, { duration: 1.2 })));
  tl.play(par(tween(n, { jump: 2 }, { duration: 1.4 }), tween(n, { value: -2 }, { duration: 1.4 })));
  tl.play(wait(1));
  // #endregion
  return { s, tl };
};

export const mathCircle = (): Made => {
  // #region mathCircle
  const s = new Scene({ view: 'front', size: [420, 262], padding: 6 });
  const c = s.add(unitCircle({ wave: true, tangent: false, size: [6, 2.6] }));
  c.set('angle', 0);

  const tl = new Timeline();
  // the point goes round; its height is sine, and the wave unrolls to the right
  tl.play(tween(c, { angle: 360 }, { duration: 6, ease: 'linear' }));
  // #endregion
  return { s, tl };
};

/* ------------------------------------------------------------------ charts */

export const chartLive = (): Made => {
  // #region chartLive
  const s = new Scene({ view: 'iso' });
  s.add(ground());
  // a chart is a plane in the scene: here it stands up on the floor
  const c = s.add(bars({
    data: { 2023: [12, 19, 7, 15], 2024: [14, 22, 11, 19] }, labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    title: 'Revenue', size: [4.4, 2.8], at: [-2.2, 0, 0], legend: 'top',
  }));
  c.set('grow', 0);

  const tl = new Timeline();
  tl.play(tween(c, { grow: 1 }, { duration: 1.6 }));
  // morph to new numbers: tween the flattened data
  tl.play(tween(c, { data: c.flatten({ 2023: [20, 8, 17, 6], 2024: [9, 25, 13, 22] }) }, { duration: 1.4 }));
  tl.play(wait(1));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const chartDash = (): Made => {
  // #region chartDash
  const s = new Scene({ view: 'front' });
  const mon = s.add(monitor({ width: 6 }));
  // charts sit on a screen like any other element
  mon.put(lines({ data: [3, 5, 4, 8, 6, 9, 7, 11], curve: 'smooth', fill: true, title: 'Traffic', size: [3, 1.6] }), { at: [0.04, 0.5], width: 0.55 });
  mon.put(donut({ data: [['Web', 60], ['App', 30], ['API', 10]], size: [2, 1.6], legend: 'bottom' }), { at: [0.62, 0.5], width: 0.34 });
  mon.put(bars({ data: [4, 7, 5, 9, 6], axes: false, size: [3, 1.2], highlight: 3 }), { at: [0.04, 0.06], width: 0.55 });
  mon.put(radar({ data: [6, 8, 5, 7, 9], labels: ['A', 'B', 'C', 'D', 'E'], size: [2, 1.2] }), { at: [0.62, 0.06], width: 0.34 });
  // #endregion
  return { s };
};

/* ------------------------------------------------------------------ construction */

export const cubeBuild = (): Made => {
  // #region cubeBuild
  // A cube drawn flat on the ground, folded shut, turned, and taken apart. The camera is at the true isometric angle, so the ground is a lattice of equal rhombi
  // and the squares sit on its cells. Each face has its own hinge, and a hinge is a group that turns.
  // The camera zooms about the middle of the region, so the region is shifted to put the finished cube (centre one unit above the origin) there.
  const ISO = (Math.atan(1 / Math.SQRT2) * 180) / Math.PI;
  const s = new Scene({ view: { yaw: 45, pitch: ISO }, size: [520, 440], padding: 0, region: { x: 33, y: 70, w: 520, h: 440 } });
  s.camera.props.zoom = 1.25;
  const SIDE = 2, H = SIDE / 2, ZOOM = 2.4;
  const INK = 'ink', ACCENT = 'accent';

  // Letters as outlines on a 100 x 100 grid: strokes 0.18 thick, one outline per letter (the e has a hole). Faces leave a gap at the edge.
  const GAP = 0.035, FACE = 1000;
  const glyphs: Record<string, string[]> = {
    c: ['0 0 100 0 100 18 18 18 18 82 100 82 100 100 0 100'],
    s: ['0 0 100 0 100 18 18 18 18 41 100 41 100 100 0 100 0 82 82 82 82 59 0 59'],
    e: ['0 0 100 0 100 59 18 59 18 82 100 82 100 100 0 100', '18 18 18 41 82 41 82 18'],
    n: ['0 0 100 0 100 100 82 100 82 18 18 18 18 100 0 100'],
  };
  // the centre line each letter is written along
  const walks: Record<string, string> = { c: '100 9 9 9 9 91 100 91', s: '100 9 9 9 9 50 91 50 91 91 0 91', e: '9 50 91 50 91 9 9 9 9 91 100 91', n: '9 100 9 9 91 9 91 100' };
  const pts = (l: string) => { const n = l.split(' ').map((v) => +v / 100); return n.filter((_, i) => i % 2).map((y, i): Pt => [n[2 * i], y]); };
  // a letter on a 1000 x 1000 face (y down), mirrored if `flip`, turned by `turn` quarter turns
  const place = ([x, y]: Pt, turn: number, flip = false): Pt => { if (flip) x = 1 - x; for (let i = 0; i < turn; i++) [x, y] = [1 - y, x]; return [(GAP + x * (1 - 2 * GAP)) * FACE, (GAP + y * (1 - 2 * GAP)) * FACE]; };
  const letterD = (name: string, turn = 0, flip = false) => glyphs[name].map((l) => 'M' + pts(l).map((p) => place(p, turn, flip).join(' ')).join('L') + 'Z').join('');
  const walkD = (name: string, turn: number, flip: boolean) => 'M' + pts(walks[name]).map((p) => place(p, turn, flip).join(' ')).join('L');
  const dotsD = (name: string, turn: number, flip: boolean) => pts(walks[name]).map((p) => `M${place(p, turn, flip).join(' ')}h0`).join('');
  const squareD = `M0 0H${FACE}V${FACE}H0Z`;
  const stage = s.add(group());
  // the net is longer one way, so it lies one unit to the side of the cube it folds into
  const SLIDE: V3 = [-1, 0, 0];

  // faint guides through the whole net, in the plane's own units (100 to the world unit)
  const floor = stage.add(new Construct({ box: [0, 0, 1000, 800], size: [10, 8], at: [-4, -4, 0], u: [1, 0, 0], v: [0, 1, 0] }));
  const fl = (x: number, y: number): Pt => [(x + 4) * 100, (4 - y) * 100];
  const guide = (a: Pt, b: Pt, width = 1.4) => floor.add({ d: lineD(a, b), stroke: 'faint', width, props: { draw: 0 } });
  const centre = floor.add({ d: circleD(...fl(0, 0), 7), paint: 'accent', stroke: 'none', props: { fill: 0 } });
  const axes2 = [guide(fl(-4, 0), fl(6, 0), 1.8), guide(fl(0, -4), fl(0, 4), 1.8)];
  const cols = [-3, -1, 1, 3, 5].map((x) => guide(fl(x, -4), fl(x, 4)));
  const rows = [-3, -1, 1, 3].map((y) => guide(fl(-4, y), fl(6, y)));

  // spin turns the whole cube about the vertical line through the middle of its base. Four sides rise from its edges; the sixth square hangs off one of them and closes the top.
  const spin = stage.add(group());
  const face = (g: Group, at: V3, u: V3, v: V3) => g.add(new Construct({ box: [0, 0, 1000, 1000], size: [SIDE, SIDE], at, u, v, cull: true }));
  // The parts of a square on each plane: paper (opaque, so nothing shows through the cube), the letter's centre line with a dot at each point,
  // the square's outline, and the letter. On the flat net the letter is mirrored, since it is printed on the outside.
  const dress = (planes: Construct[], name: string, paint: string, turns: number[]) => ({
    paper: planes.map((f) => f.add({ d: squareD, paint: 'color-mix(in oklab, var(--c-accent) 8%, var(--c-bg))', stroke: 'none', props: { fill: 0 } })),
    spine: planes.map((f, i) => f.add({ d: walkD(name, turns[i], !i), stroke: 'accent', width: 4, props: { draw: 0 } })),
    dots: planes.map((f, i) => f.add({ d: dotsD(name, turns[i], !i), stroke: 'accent', width: 20, props: { op: 0 } })),
    square: planes.map((f) => f.add({ d: squareD, stroke: 'ink', width: 7, props: { draw: 0 } })),
    letter: planes.map((f, i) => f.add({ d: letterD(name, turns[i], !i), paint, stroke: 'ink', width: 5, props: { draw: 0, fill: 0 } })),
  });
  type Dressed = ReturnType<typeof dress>;
  // A square on a hinge, reaching SIDE away from it in direction d. Two planes back to back, each shown only while it faces the camera:
  // the upper while the square lies open, the outer once it is on the cube.
  const leaf = (hinge: Group, d: [number, number], name: string, paint: string, turns: [number, number] = [0, 0]) => {
    const up: V3 = [d[1], -d[0], 0], out: V3 = [-d[1], d[0], 0], v: V3 = [d[0], d[1], 0], from = (u: V3): V3 => [-u[0] * H, -u[1] * H, 0];
    return dress([face(hinge, from(up), up, v), face(hinge, from(out), out, v)], name, paint, turns);
  };
  const baseFace = dress([face(spin, [-H, -H, 0], [1, 0, 0], [0, 1, 0])], 'c', ACCENT, [1]);   // a quarter turn, so it differs from the square on top
  // a flap hangs off `parent` at `at` (in the parent's own frame), reaching away in direction d
  const flap = (parent: Group, at: V3, d: [number, number], name: string, paint: string, turns: [number, number] = [0, 0]) => {
    const hinge = parent.add(group({ at }));
    return { hinge, up: [90 * d[1], -90 * d[0], 0] as V3, dressed: leaf(hinge, d, name, paint, turns) };
  };
  // The net is a column of four squares along x (e, c, n, top c) with the two other sides hung off the middle pair, one each way: s off the base, the second e off the n.
  // Anticlockwise around the base, so the turning cube shows e e n s e e n s
  const sideS = flap(spin, [0, H, 0], [0, 1], 's', INK);
  const sideW = flap(spin, [-H, 0, 0], [-1, 0], 'e', INK);
  const sideN = flap(spin, [H, 0, 0], [1, 0], 'n', ACCENT);
  // it hangs off the n, so its letter is turned to stand as it did when it hung off the base
  const sideE = flap(sideN.hinge, [H, -H, 0], [0, -1], 'e', INK, [3, 1]);
  const flaps = [sideS, sideW, sideE, sideN];
  const folds = [sideS, sideW, sideN, sideE];   // the order they rise: a flap on the n waits for the n
  const topHinge = sideN.hinge.add(group({ at: [SIDE, 0, 0] })), CLOSE: V3 = [0, -90, 0];
  const dressed: Dressed[] = [baseFace, ...flaps.map((f) => f.dressed), leaf(topHinge, [1, 0], 'c', ACCENT, [2, 2])];
  const pick = (k: keyof Dressed) => dressed.map((d) => d[k]);

  const soft = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
  const run = (p: Animatable, to: Record<string, number | number[]>, from: Record<string, number | number[]>, at: number, len: number): Anim => tween(p, to, { from, delay: at, duration: len, ease: soft });
  // one property of several parts, from a to b, each starting `gap` after the last
  const each = (ps: (Animatable | Animatable[])[], prop: string, a: number, b: number, at: number, len: number, gap = 0) =>
    ps.flatMap((p, i) => [p].flat().map((q) => run(q, { [prop]: b }, { [prop]: a }, at + i * gap, len)));
  const build = (): Anim => par(
    tween(spin, { rot: [0, 0, 0] }, { from: { rot: [0, 0, 0] }, duration: 0 }),
    // 1  guidelines: the middle, the two axes, then the lines the squares will lie between
    ...each([centre], 'fill', 0, 1, 0.2, 0.5), ...each(axes2, 'draw', 0, 1, 0.5, 1.2, 0.4), ...each(cols, 'draw', 0, 1, 1.5, 1, 0.15), ...each(rows, 'draw', 0, 1, 2.6, 1, 0.15),
    // 2  outlines: the six squares, c first, then the four around it, then the last
    ...each(pick('square'), 'draw', 0, 1, 4.2, 0.9, 0.4), ...each([...axes2, ...cols, ...rows, centre], 'op', 1, 0, 6.9, 0.8),
    // 3  the letters: each square gets the centre line of its letter, the letter is traced around it, then the paper and the colour come in
    ...each(pick('spine'), 'draw', 0, 1, 7.2, 0.8, 0.1), ...each(pick('dots'), 'op', 0, 1, 7.2, 0.8, 0.1), ...each(pick('letter'), 'draw', 0, 1, 8, 1, 0.45), ...each(pick('spine'), 'op', 1, 0, 11.2, 0.6), ...each(pick('dots'), 'op', 1, 0, 11.2, 0.6),
    ...each(dressed.map((d) => [...d.paper, ...d.letter]), 'fill', 0, 1, 11.6, 0.6, 0.15), ...each(pick('letter'), 'line', 1, 0, 12.2, 0.6, 0.15),
    // 4  the fold, by hand: the four sides are raised one after another, then the last square closes over the top
    run(stage, { pos: [0, 0, 0] }, { pos: SLIDE }, 13.6, 4.4), run(s.camera, { zoom: ZOOM }, { zoom: 1.25 }, 14.8, 3),
    ...folds.map((f, i) => run(f.hinge, { rot: f.up }, { rot: [0, 0, 0] }, 13.6 + i * 0.6, 1.4)), run(topHinge, { rot: CLOSE }, { rot: [0, 0, 0] }, 16.6, 1.6),
    ...each(pick('square'), 'line', 1, 0, 18.4, 0.8),
  );

  // the finished and the empty state of every part, found by running the build to its end and back
  const built = build();
  const probe = new Timeline().play(built);
  const targets = [...new Set(built.tweens.map((t) => t.target))];
  probe.seek(built.duration); const done = targets.map((t) => t.snapshot());
  probe.seek(0); const empty = targets.map((t) => t.snapshot());
  const setAll = (states: Record<string, number | number[]>[], from: boolean) => par(...targets.map((t, i) => tween(t, states[i], { duration: 0, from: from ? states[i] : undefined })));

  // two slow turns, so the letters pass e e n s e e n s ...
  const turn = (): Anim => tween(spin, { rot: [0, 0, -720] }, { from: { rot: [0, 0, 0] }, duration: 20, ease: soft });
  // the fold in reverse, then the colour drains from the letters and everything fades
  const apart = (): Anim => par(
    run(topHinge, { rot: [0, 0, 0] }, { rot: CLOSE }, 0, 1.4), ...[...folds].reverse().map((f, i) => run(f.hinge, { rot: [0, 0, 0] }, { rot: f.up }, 0.8 + i * 0.5, 1.4)),
    run(stage, { pos: SLIDE }, { pos: [0, 0, 0] }, 0.8, 3.4), run(s.camera, { zoom: 1.25 }, { zoom: ZOOM }, 0.6, 3),
    ...each(pick('square'), 'line', 0, 1, 0, 0.8), ...each(pick('letter'), 'fill', 1, 0, 4.6, 0.9, 0.1), ...each(pick('letter'), 'line', 0, 1, 4.6, 0.9, 0.1),
    ...dressed.flatMap((d, i) => [...d.letter, ...d.square, ...d.paper].map((q) => run(q, { op: 0 }, { op: 1 }, 6 + i * 0.25, 0.7))),
  );

  const tl = new Timeline();
  // starts finished, so the first frame is the logo: it turns, comes apart, then is built again
  tl.play(setAll(done, true));
  tl.wait(1.4);
  tl.play(turn());
  tl.wait(0.4);
  tl.play(apart());
  tl.wait(0.5);
  tl.play(setAll(empty, false));
  tl.play(built);
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const reorder = (): Made => {
  // #region reorder
  // The letters of the logo, c s e e n, stand on five invisible squares. They trade places to spell s c e n e, then trade back, again and again.
  const s = new Scene({ view: { yaw: -16, pitch: 40 }, size: [640, 250], padding: 16 });
  s.add(ground());
  const stage = s.add(group());
  const flat = { u: [1, 0, 0] as V3, v: [0, 1, 0] as V3 };
  // five squares of 120 with 30 between, 100 to the world unit; the letters move over them (the squares themselves are not drawn)
  const row = stage.add(new Construct({ ...flat, box: [0, 0, 720, 120], size: [7.2, 1.2] }));
  const [rx, ry] = row.at(360, 60);
  stage.props.pos = [-rx, -ry, 0];

  // each letter is outlines on a square of 100 (y runs down), with the strokes 18 thick, like the mark of the logo; the e has a hole
  const glyphs: Record<string, string[]> = {
    c: ['0 0 100 0 100 18 18 18 18 82 100 82 100 100 0 100'],
    s: ['0 0 100 0 100 18 18 18 18 41 100 41 100 100 0 100 0 82 82 82 82 59 0 59'],
    e: ['0 0 100 0 100 59 18 59 18 82 100 82 100 100 0 100', '18 18 18 41 82 41 82 18'],
    n: ['0 0 100 0 100 100 82 100 82 18 18 18 18 100 0 100'],
  };
  const points = (l: string) => { const n = l.split(' ').map(Number); return n.filter((_, i) => i % 2 === 0).map((x, i): Pt => [x, n[2 * i + 1]]); };
  // two colours, as in the logo: c and n in the accent, s and both e in ink
  const INK = 'ink', ACCENT = 'accent';
  const word = 'cseen', colours = [ACCENT, INK, INK, INK, ACCENT], after = [1, 0, 2, 4, 3];   // after[i] is the square that letter i swaps to
  const PITCH = 1.5, SIDE = 1.2, K = SIDE / 100, THICK = 0.3;
  const sample = new Construct({ ...flat, box: [0, 0, 100, 100], size: [SIDE, SIDE] });
  const [cx, cy] = sample.at(50, 50);
  const letters = [...word].map((name, i) => {
    const [wx, wy] = row.at(60 + 150 * i, 60);
    const lift = stage.add(group());                                 // lifts the letter over the others
    const home: V3 = [wx - cx, wy - cy, 0], slide = lift.add(group({ at: home }));    // carries it to its other square
    const goal: V3 = [home[0] + (after[i] - i) * PITCH, home[1], 0];
    const shade = `color-mix(in oklab, var(--c-${colours[i]}) 70%, var(--c-bg))`;
    // the top of the letter, raised by its thickness, and a wall standing on each edge of its outline
    const top = slide.add(new Construct({ ...flat, box: [0, 0, 100, 100], size: [SIDE, SIDE], at: [0, 0, THICK] }));
    top.add({ d: glyphs[name].map((l) => 'M' + points(l).map((q) => q.join(' ')).join('L') + 'Z').join(''), paint: colours[i], stroke: 'none', props: { fill: 1 } });
    for (const l of glyphs[name]) {
      const ring = points(l);
      ring.forEach(([x, y], k) => {
        const [x2, y2] = ring[(k + 1) % ring.length], dx = (x2 - x) * K, dy = -(y2 - y) * K, len = Math.hypot(dx, dy);
        const wall = slide.add(new Construct({ box: [0, 0, len * 100, THICK * 100], size: [len, THICK], at: [x * K, (100 - y) * K, 0], u: [dx / len, dy / len, 0], v: [0, 0, 1] }));
        wall.add({ d: `M0 0H${len * 100}V${THICK * 100}H0Z`, paint: shade, stroke: shade, width: 1, props: { fill: 1 } });
      });
    }
    return { lift, slide, home, goal };
  });

  const soft = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
  const t = (p: Animatable, to: Record<string, number | number[]>, from: Record<string, number | number[]>, at: number, len: number) =>
    tween(p, to, { from, delay: at, duration: len, ease: soft });
  // all the letters swap in pairs: the c steps over the s, and the n over the second e; `flip` is which way
  const swap = (flip: boolean): Anim => par(...letters.flatMap((l, i) => {
    if (l.goal[0] === l.home[0]) return [];
    const [a, b] = flip ? [l.home, l.goal] : [l.goal, l.home], at = i > 2 ? 0.5 : 0, over = l.goal[0] > l.home[0];
    return [t(l.slide, { pos: b }, { pos: a }, at, 1.6), ...(over ? [t(l.lift, { pos: [0, 0, 1.1] }, { pos: [0, 0, 0] }, at, 0.8), t(l.lift, { pos: [0, 0, 0] }, { pos: [0, 0, 1.1] }, at + 0.8, 0.8)] : [])];
  }));

  const tl = new Timeline();
  // c s e e n  ->  s c e n e  ->  c s e e n, and round again
  tl.wait(1.6);
  tl.play(swap(true));
  tl.wait(1.6);
  tl.play(swap(false));
  tl.wait(0.4);
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const notFound = (): Made => {
  // #region notFound
  // "404" is written on the ground in strokes, seen from an angle: two guide lines first, then each digit is traced and lifted off its footprint.
  const s = new Scene({ view: { yaw: -16, pitch: 40 }, size: [640, 250], padding: 16 });
  s.add(ground());
  const stage = s.add(group());
  const flat = { box: [0, 0, 780, 360] as [number, number, number, number], size: [7.8, 3.6] as [number, number], u: [1, 0, 0] as V3, v: [0, 1, 0] as V3 };
  const floor = stage.add(new Construct(flat));                  // guides and footprints stay on the ground
  const digits = stage.add(new Construct({ ...flat, layer: 1 })); // the digits themselves are what rises
  const [fx, fy] = floor.at(390, 180);
  stage.props.pos = [-fx, -fy, 0];

  // each digit is 200 wide and 300 tall; the stroke of a 4 is two lines, a 0 is two half circles and two sides
  const TOP = 30, BASE = 330, W = 200, STEP = 260, X0 = 60;
  const four = (x: number) => [segsD([...lineSegs([x + 140, TOP], [x, TOP + 210]), ...lineSegs([x, TOP + 210], [x + W, TOP + 210])]), lineD([x + 140, TOP], [x + 140, BASE])];
  const zero = (x: number) => segsD([...arcSegs(x + W / 2, TOP + W / 2, W / 2, 0, -Math.PI), ...lineSegs([x, TOP + W / 2], [x, BASE - W / 2]),
    ...arcSegs(x + W / 2, BASE - W / 2, W / 2, Math.PI, 0), ...lineSegs([x + W, BASE - W / 2], [x + W, TOP + W / 2])], true);
  const shapes = [four(X0), [zero(X0 + STEP)], four(X0 + 2 * STEP)];
  const strokes = shapes.map((ds) => ds.map((d) => digits.add({ d, stroke: 'accent', width: 9, props: { draw: 1 } })));
  const prints = shapes.map((ds) => ds.map((d) => floor.add({ d, stroke: 'faint', width: 2, props: { draw: 1, op: 1 } })));
  const guides = [TOP, BASE].map((y) => floor.add({ d: lineD([0, y], [780, y]), stroke: 'faint', width: 1.4, props: { draw: 1 } }));

  const RISE = 0.7, soft = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
  const t = (p: Animatable, to: Record<string, number | number[]>, from: Record<string, number | number[]>, at: number, len: number, ease?: 'out' | 'back') =>
    tween(p, to, { from, delay: at, duration: len, ease: ease ?? soft });
  const all = strokes.flat(), foot = prints.flat();
  digits.props.pos = [0, 0, RISE];

  const tl = new Timeline();
  tl.wait(2.4);
  // it starts finished: the first frame is the whole 404. It sinks onto its footprint and is rubbed out, then written again.
  tl.play(par(t(digits, { pos: [0, 0, 0] }, { pos: [0, 0, RISE] }, 0, 0.9), ...all.map((p, i) => t(p, { draw: 0 }, { draw: 1 }, 1 + i * 0.12, 0.7)),
    ...foot.map((p, i) => t(p, { op: 0 }, { op: 1 }, 1.4 + i * 0.1, 0.6)), ...guides.map((p) => t(p, { draw: 0 }, { draw: 1 }, 1.8, 0.8))));
  tl.wait(0.4);
  tl.play(par(...guides.map((p, i) => t(p, { draw: 1 }, { draw: 0 }, i * 0.2, 0.9))));
  // each digit is traced in turn and its footprint appears under it; when all three are down the whole 404 lifts off the ground
  strokes.forEach((ds, i) => ds.forEach((p, j) => tl.play(par(t(p, { draw: 1 }, { draw: 0 }, 0, 0.9), t(prints[i][j], { op: 1 }, { op: 0 }, 0.2, 0.7)))));
  tl.play(t(digits, { pos: [0, 0, RISE] }, { pos: [0, 0, 0] }, 0.2, 1.1, 'back'));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

/* ------------------------------------------------------------------ cameras and optics */

export const pinhole = (): Made => {
  // #region pinhole
  const s = new Scene({ view: { yaw: 62, pitch: 22 } });
  s.add(ground());
  const thing = s.add(box({ at: [1.4, 5, 0], size: [1, 1, 1.4], role: 'faint' }));
  // the camera centre, the image plane at focal length f, the rays through its corners, and the points it sees
  const cam = s.add(frustum({ at: [-1, -1, 1.6], target: [0.4, 5, 0.6], f: 1.6, fov: 46, depth: 4.6, labels: true, points: [[1, 4.5, 1.4], [1.9, 5.5, 1.4], [1.4, 5, 0]] }));

  const tl = new Timeline();
  // a longer focal length narrows the view: same plane distance, smaller field of view
  tl.play(par(tween(cam, { f: 2.8 }, { duration: 2 }), tween(cam, { fov: 26 }, { duration: 2 })));
  tl.play(par(tween(cam, { f: 1.6 }, { duration: 2 }), tween(cam, { fov: 46 }, { duration: 2 })));
  // #endregion
  void thing;
  tl.lockFit(s);
  return { s, tl };
};

export const stereo = (): Made => {
  // #region stereo
  const s = new Scene({ view: { yaw: 12, pitch: 58 }, split: true });   // some faces here pierce each other: cut them where they cross
  s.add(ground());
  // two parallel cameras a baseline apart; the point is where both rays meet
  const rig = s.add(stereoRig({ baseline: 2.4, f: 1.5, point: [0.4, 4.2, 0.5] }));

  const tl = new Timeline();
  // moving the point away shrinks the disparity: Z = f * b / d
  tl.play(tween(rig, { point: [0.4, 6.8, 0.5] }, { duration: 2.5 }));
  tl.play(tween(rig, { baseline: 3.4 }, { duration: 2 }));
  tl.play(tween(rig, { point: [0.4, 4.2, 0.5], baseline: 2.4 }, { duration: 2.5 }));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

/* ------------------------------------------------------------------ waves */

export const radioDemo = (): Made => {
  // #region radioDemo
  const s = new Scene({ split: true });   // some faces here pierce each other: cut them where they cross
  s.add(ground());
  const rt = s.add(router({ at: [-2, 0, 0], width: 1.8 }));
  s.add(laptop({ at: [3, 0.4, 0], width: 2, rot: [0, 0, -30] }));
  // arcs above the router; animating the phase moves them outward
  const w = s.add(radio({ at: rt.signal()(), reach: 3.2, wavelength: 0.6, spread: 110 }));

  const tl = new Timeline();
  tl.play(tween(w, { phase: 2 }, { duration: 3, ease: 'linear' }));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const echoDemo = (): Made => {
  // #region echoDemo
  const s = new Scene();
  s.add(ground());
  s.add(speaker({ at: [0, -3, 0], height: 1.2, rot: [0, 0, 180] }));
  s.add(box({ at: [0, 1.4, 0], size: [2.6, 0.2, 1.4], role: 'ink' }));
  // out, a reflector at 4 units, and a weaker beam back
  const w = s.add(wave({ kind: 'echo', at: [0, -2.4, 0.02], target: 3.8, reflect: 0.5, reach: 7, spread: 50, wavelength: 0.55 }));

  const tl = new Timeline();
  tl.play(tween(w, { phase: 3 }, { duration: 4.5, ease: 'linear' }));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

/* ------------------------------------------------------------------ flow */

export const flowDecision = (): Made => {
  // #region flowDecision
  const s = new Scene({ view: 'front', size: [420, 262], padding: 8 });
  const d = s.add(flowchart([
    { label: 'start', kind: 'start' },
    { label: 'signed in?', kind: 'decision', to: [['home', 'yes'], ['sign in', 'no']] },
    { label: 'sign in', to: ['signed in?'] },
    { label: 'home', kind: 'end' },
  ]));

  const tl = new Timeline();
  // every edge traces on, one after another
  tl.play(stagger(0.5, ...d.edges.map((e) => draw(e, 0.7))));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const flowPipeline = (): Made => {
  // #region flowPipeline
  const s = new Scene({ view: 'front', size: [420, 150], padding: 8 });
  const d = s.add(diagram({ direction: 'right' }));
  d.node('src', 'source', { shape: 'round' });
  d.node('build', 'build');
  d.node('test', 'test');
  d.node('ship', 'ship', { role: 'accent' });
  d.edge('src', 'build'); d.edge('build', 'test'); d.edge('test', 'ship');
  // #endregion
  return { s };
};

export const flowTree = (): Made => {
  // #region flowTree
  const s = new Scene({ view: 'front', size: [420, 262], padding: 8 });
  s.add(treeDiagram({ label: 'app', children: [
    { label: 'ui', children: [{ label: 'forms' }, { label: 'tables' }] },
    { label: 'api', children: [{ label: 'auth' }, { label: 'data' }] },
  ] }));
  // #endregion
  return { s };
};

export const flowNetwork = (): Made => {
  // #region flowNetwork
  const s = new Scene({ view: 'front', size: [420, 262], padding: 8 });
  const d = s.add(diagram({ layout: 'force' }));
  for (const id of ['api', 'db', 'cache', 'queue', 'worker', 'mail']) d.node(id, id);
  d.edge('api', 'db'); d.edge('api', 'cache'); d.edge('api', 'queue');
  d.edge('queue', 'worker'); d.edge('worker', 'db'); d.edge('worker', 'mail');

  const tl = new Timeline();
  // the nodes appear one by one, then the lines between them trace on
  tl.play(stagger(0.2, ...[...d.nodes.values()].map((n) => fadeIn(n, 0.5))));
  tl.play(stagger(0.15, ...d.edges.map((e) => draw(e, 0.5))));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const flowLinked = (): Made => {
  // #region flowLinked
  const s = new Scene({ view: 'front', size: [420, 262], padding: 8 });
  const d = s.add(diagram({ direction: 'right', gap: [3, 0.6] }));
  d.node('api', 'api', { role: 'accent' });
  d.node('db', 'database');
  d.node('log', 'logs');
  d.edge('api', 'db', { label: 'sql' }); d.edge('api', 'log');

  // a diagram is made of scene nodes, so a device can be linked to it like to any other
  const lt = s.add(laptop({ at: [-5.4, 0, -0.6], width: 2.2 }));
  s.add(link(lt.anchor([0.4, 0, 0.9]), d.at('api', 'left'), { bend: 0.3, role: 'accent', flow: 1 }));
  // #endregion
  return { s };
};

export const flowSequence = (): Made => {
  // #region flowSequence
  const s = new Scene({ view: 'front', size: [420, 340], padding: 8 });
  const q = s.add(sequence({
    participants: ['browser', 'api', 'db'],
    messages: [
      { from: 'browser', to: 'api', label: 'GET /user' },
      { from: 'api', to: 'db', label: 'select' },
      { from: 'db', to: 'api', label: 'row', reply: true },
      { from: 'api', to: 'api', label: 'render' },
      { note: 'cached for 60 s', over: 'api' },
      { from: 'api', to: 'browser', label: '200', reply: true },
    ],
  }));

  const tl = new Timeline();
  // the messages trace on in the order they happen, and a pulse rides the first request
  tl.play(stagger(0.5, ...q.messages.map((m) => draw(m, 0.6))));
  const ping = s.add(pulse(q.messages[0].rail(), { trail: 4 }));
  tl.play(tween(ping, { along: 1 }, { duration: 1, from: { along: 0 }, ease: 'linear' }));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

/* ------------------------------------------------------------------ moving arrows */

export const arrows = (): Made => {
  // #region arrows
  const s = new Scene();
  s.add(ground());
  s.add(laptop({ at: [-4.2, 0, 0], width: 2.2 }));
  const net = s.add(cloud({ at: [0, 2.4, 2], size: 2.2 }));
  s.add(server({ at: [4.2, 0, 0], width: 1.4 }));

  // dashes that travel: runs in CSS, so it moves even in a static SVG
  s.add(arrow([-4.2, -1.6, 0.02], [4.2, -1.6, 0.02], { role: 'faint', flow: true }));
  // curved arrows between objects, which follow them if they move
  const up = s.add(link([-3.2, 0, 1.4], net, { bend: 0.2, flow: 1.5, role: 'accent' }));
  const down = s.add(link(net, [4, 0, 1.2], { bend: 0.2, role: 'ink', dash: '2 3', flow: 1 }));
  // a pulse rides a link; you decide when and how fast
  const ping = s.add(pulse(up, { trail: 4, r: 3.4 }));
  const pong = s.add(pulse(down, { trail: 4, r: 3.4, role: 'ink' }));

  const tl = new Timeline();
  tl.play(par(draw(up, 0.8), draw(down, 0.8)));
  tl.play(tween(ping, { along: 1 }, { duration: 1.6, from: { along: 0 }, ease: 'linear' }));
  tl.play(tween(pong, { along: 1 }, { duration: 1.6, from: { along: 0 }, ease: 'linear' }));
  tl.play(wait(0.6));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

/* ------------------------------------------------------------------ ui on screens */

export const loading = (): Made => {
  // #region loading
  const s = new Scene();
  const mon = s.add(monitor({ width: 4.2 }));
  const bar = mon.put(progress({ kind: 'bar', label: true }), { at: [0.1, 0.62], width: 0.8 });
  const ring = mon.put(progress({ kind: 'ring', label: true, size: [1, 1] }), { at: [0.12, 0.08], width: 0.22 });
  const steps = mon.put(progress({ kind: 'segments', segments: 8 }), { at: [0.42, 0.18], width: 0.46 });
  const done = mon.put(toast({ text: 'Done' }), { at: [0.3, 0.42], width: 0.4 });

  const tl = new Timeline();
  tl.play(par(tween(bar, { value: 1 }, { duration: 3 }), tween(ring, { value: 1 }, { duration: 3, ease: 'linear' }), tween(steps, { value: 1 }, { duration: 3, ease: 'linear' })));
  tl.play(tween(done, { slide: 1 }, { duration: 0.5, from: { slide: 0 } }));
  tl.play(wait(1.2));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const messaging = (): Made => {
  // #region messaging
  const s = new Scene();
  const ph = s.add(phone({ height: 3.4 }));
  const talk = ph.put(chat({
    messages: [
      { from: 'them', text: 'Is the deploy done?' },
      { from: 'me', text: 'Almost. Two more minutes.' },
      { from: 'them', text: 'Great, ping me when it is live.' },
      { from: 'me', text: 'Live now.' },
    ],
    typing: true, size: [1.4, 2.5],
  }), { at: [0.05, 0.04], width: 0.9 });
  const alert = ph.put(notification({ title: 'Deploy finished', body: 'my.app is live.' }), { at: [0.05, 0.82], width: 0.9 });
  const count = s.add(badge({ count: 0, at: [0.32, -0.12, 2.75], size: [0.28, 0.28] }));
  talk.set('shown', 0);

  const tl = new Timeline();
  tl.play(tween(talk, { shown: 4 }, { duration: 6, ease: 'linear' }));
  tl.play(par(tween(alert, { slide: 1 }, { duration: 0.5, from: { slide: 0 } }), tween(count, { count: 3 }, { duration: 0.4 })));
  tl.play(wait(1.5));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const dialogs = (): Made => {
  // #region dialogs
  const s = new Scene();
  const mon = s.add(monitor({ width: 4.2 }));
  const box = mon.put(dialog({ title: 'Delete project?', body: 'This removes every file and cannot be undone.', buttons: ['Cancel', 'Delete'], size: [2.4, 1.4] }), { at: [0.2, 0.2], width: 0.6 });

  const tl = new Timeline();
  tl.play(tween(box, { pop: 1 }, { duration: 0.5, from: { pop: 0 } }));
  tl.play(wait(1.5));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

/* ------------------------------------------------------------------ small scenes */

export const flow = (): Made => {
  // #region flow
  const s = new Scene();
  s.add(ground());
  s.add(laptop({ at: [-4.5, 0, 0], width: 2.4 }));
  s.add(cloud({ at: [0, 2.5, 2.2], size: 2.6 }));
  s.add(server({ at: [4.5, 1, 0], width: 1.4 }));
  s.add(database({ at: [4.5, 3.8, 0], r: 0.7 }));

  const A: V3 = [-4.5, 0, 1.5], B: V3 = [-1.2, 2.5, 2.7], C: V3 = [3.7, 1, 0.9], D: V3 = [4.5, 3.8, 0.5];
  const path = { role: 'faint', dash: '3 3' };
  s.add(arrow(A, B, path), arrow(B, C, path), arrow(C, D, path));
  const packet = s.add(dot(A, { role: 'accent', r: 3.6 }));

  const tl = new Timeline();
  tl.chapter('request').play(seq(moveTo(packet, B, 1.2), moveTo(packet, C, 1.2), moveTo(packet, D, 1)));
  tl.chapter('response').play(seq(moveTo(packet, C, 0.9), moveTo(packet, B, 1.2), moveTo(packet, A, 1.2)));
  tl.play(wait(0.5));
    // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const studio = (): Made => {
  // #region studio
  const s = new Scene();
  s.add(ground());
  s.add(micStand({ at: [-3.2, 0, 0] }));
  const mon = s.add(monitor({ at: [0, 1.6, 0], width: 3 }));
  mon.write(['recording...'], { fontSize: 0.2 });
  s.add(speaker({ at: [3.2, 0, 0] }));
  const rings = [0, 1, 2].map(() => s.add(circle([0, 0, 0], 1, { at: [3.2, -0.4, 0.02], role: 'accent' })));

  // each ring grows and fades; they start a little apart
  const spread = (r: typeof rings[0]) => tween(r, { scale: 3.4, opacity: 0 }, { duration: 2.4, from: { scale: 0.3, opacity: 0.9 }, ease: 'out' });
  const tl = new Timeline();
  tl.play(stagger(0.9, ...rings.map(spread)));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export const deploy = (): Made => {
  // #region deploy
  const s = new Scene();
  s.add(ground());
  const term = s.add(terminal({ at: [-4, 0, 0], width: 3.6, title: 'zsh' }));
  const cmd = term.write(['$ git push', 'deploying...', 'done.']);
  s.add(cloud({ at: [0, 2.2, 2], size: 2.4 }));
  const site = s.add(browser({ at: [4, 1, 0], width: 3.4, url: 'my.app' }));
  const hello = site.write('Hello, world', { fontSize: 0.32 });
  const packet = s.add(dot([-3, -0.2, 1.4], { role: 'accent', r: 3.6 }));

  const tl = new Timeline();
  tl.play(typeOn(cmd, 2.2));
  tl.chapter('upload').play(moveTo(packet, [-0.9, 2.2, 2.4], 1.3));
  tl.play(moveTo(packet, [3.2, 0.9, 1.2], 1.3));
  tl.chapter('live').play(fadeIn(hello, 0.8));
  tl.play(wait(1.4));
  // #endregion
  tl.lockFit(s);
  return { s, tl };
};

export { cameraGlyph, line, code };
