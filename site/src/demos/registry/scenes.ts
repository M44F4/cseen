/*
 * Scenes whose code is shown exactly as it runs: the text between `// #region` and `// #endregion`
 * in scenes.ts is both displayed and (through the function that contains it) executed.
 */
import source from '../scenes.ts?raw';
import * as core from '../../../../src/index.ts';
import * as devices from '../../../../src/devices/index.ts';
import * as ui from '../../../../src/ui/index.ts';
import * as charts from '../../../../src/charts/index.ts';
import * as waves from '../../../../src/waves/index.ts';
import * as optics from '../../../../src/optics/index.ts';
import * as math from '../../../../src/math/index.ts';
import * as flow from '../../../../src/flow/index.ts';
import * as S from '../scenes.ts';
import { region, withImports } from '../code.ts';
import type { Demo, Pack } from '../types.ts';

const names = (ns: object) => Object.keys(ns).filter((k) => k !== 'default');
const NAMES: Record<string, string[]> = { '': names(core), devices: [...names(devices).filter((k) => k !== 'document'), 'paper'], ui: names(ui), charts: names(charts), waves: names(waves), optics: names(optics), math: names(math), flow: names(flow) };

const scene = (pack: Pack, id: string, title: string, summary: string, make: () => S.Made, reg = id, group?: string): Demo => ({
  id: `${pack}/${id}`, pack, title, summary, group, controls: [], defaults: {}, make,
  code() {
    const body = region(source, reg);
    return withImports(body, NAMES).replace(/^import \{([^}]*)\} from/gm, (_m, n: string) => `import {${n.replace(/\bpaper\b/, 'document as paper')}} from`);
  },
});

export const sceneDemos: Demo[] = [
  scene('core', 'hello', 'The smallest scene', 'A ground lattice, the axes and a box. at is the point the box stands on.', S.hello, 'hello', 'First steps'),
  scene('core', 'coordinates', 'Where things go', 'x runs right, y runs into the scene, z runs up. Always.', S.coordinates, 'coordinates', 'First steps'),
  scene('core', 'first-more', 'More than one thing', 'Two boxes, two labels and an arrow between them. Everything you add is drawn together.', S.firstMore, 'firstMore', 'First steps'),
  scene('core', 'first-move', 'Make it move', 'The same scene on a timeline: things fade in one after another, the arrow draws, then the result moves.', S.firstMove, 'firstMove', 'First steps'),
  scene('core', 'camera-parallel', 'A parallel camera', 'Yaw and pitch set the angle. Parallel lines stay parallel.', S.cameraParallel, 'cameraParallel', 'Cameras'),
  scene('core', 'camera-perspective', 'A perspective camera', 'The same scene from a pinhole camera: distant things get smaller.', S.cameraPerspective, 'cameraPerspective', 'Cameras'),
  scene('shapes', 'flat', 'Flat shapes', 'polygon, rect, circle and dot. Circles and rectangles lie in any of the three planes.', S.shapesFlat, 'shapesFlat'),
  scene('shapes', 'lines', 'Lines and curves', 'line, arrow, path, curve and dimension.', S.shapesLines, 'shapesLines'),
  scene('objects', 'boxes', 'Boxes', 'A box stands on the point you give it. Size, turn and fade it.', S.objectsBoxes, 'objectsBoxes'),
  scene('objects', 'surfaces', 'Surfaces', 'A height field draws z = f(x, y). A surface takes (u, v) to any point.', S.objectsSurfaces, 'objectsSurfaces'),
  scene('core', 'place', 'Position, rotation, scale', 'at, rot (degrees around x, y, z) and scale work on every object.', S.place, 'place', 'Controlling things'),
  scene('core', 'groups', 'Groups', 'Put things in a group to move, turn or scale them together.', S.groups, 'groups', 'Controlling things'),
  scene('core', 'roles', 'Colour roles', 'You pass a role, and CSS decides what it looks like. Change the theme to see everything follow.', S.roles, 'roles', 'Controlling things'),
  scene('objects', 'glass', 'See-through surfaces', 'alpha makes a surface see-through; opacity fades a whole object.', S.glass, 'glass', 'Controlling things'),
  scene('core', 'follow', 'Things that follow things', 'anchor() is a point that stays attached to an object, so an arrow between two anchors follows both.', S.follow, 'follow', 'Controlling things'),
  scene('shapes', 'arrows', 'Moving arrows', 'flow makes dashes travel along a line. link is a curved arrow between two objects, and pulse rides along it.', S.arrows, 'arrows', 'Arrows'),
  scene('core', 'flow', 'A flow of data', 'Arrows and pulses between devices, driven by one timeline.', S.flow, 'flow', 'Arrows'),
  scene('core', 'buildup', 'Building a scene up', 'fadeIn, draw, stagger and seq. A chapter marks a step you can jump to.', S.buildup, 'buildup', 'Animation'),
  scene('core', 'camera-move', 'Moving the camera', 'The camera animates with the same tween as everything else.', S.orbit, 'orbit', 'Animation'),
  scene('core', 'writing', 'Text on any plane', 'write(text, { at, u, v, size }). u and v are the directions of the text\'s right and up.', S.writing, 'writing', 'Text and code'),
  scene('core', 'typing', 'Typing code on a screen', 'Screens have code(), and typeOn types it letter by letter.', S.typing, 'typing', 'Text and code'),
  scene('core', 'shell', 'A terminal', 'Terminals start empty. write() puts lines in them.', S.shell, 'shell', 'Text and code'),
  scene('core', 'wrapping', 'Text that wraps', 'Text wraps to its box and marks colour chosen words.', S.wrapping, 'wrapping', 'Text and code'),
  scene('core', 'sizing', 'Sizes that fit', 'Sizes can be world units, sm, md, lg or a number of lines.', S.sizing, 'sizing', 'Text and code'),
  scene('core', 'sketch', 'A hand-drawn look', 'sketch: true makes lines wobble and draw twice, the same way every time, on the server and in the browser.', () => S.sketchy(true), 'sketch', 'Drawing'),
  scene('core', 'pen', 'A pen drawing', 'A line drawn by a pencil that follows it.', S.penDemo, 'penDemo', 'Drawing'),
  scene('core', 'cube-build', 'A cube, folded from its net', 'Six squares are drawn on the ground, each gets its letter, then the net folds shut into a cube that turns on its base. The home page uses it.', S.cubeBuild, 'cubeBuild', 'Drawing'),
  scene('core', 'reorder', 'Letters that trade places', 'The letters c s e e n stand on five squares, c and n in the accent colour. The c steps over the s and the n over an e, so the word reads s c e n e, then they swap back, in a loop.', S.reorder, 'reorder', 'Drawing'),
  scene('core', 'not-found', 'A 404, traced on the ground', 'Three digits written as strokes on the lattice, seen from an angle, then lifted off their footprints. The page for a missing address uses it.', S.notFound, 'notFound', 'Drawing'),
  scene('core', 'studio', 'A small studio', 'Several devices in one scene.', S.studio, 'studio', 'Whole scenes'),
  scene('core', 'deploy', 'A deploy', 'A terminal, a cloud and a status badge, told in steps.', S.deploy, 'deploy', 'Whole scenes'),
  scene('ui', 'loading', 'Progress and loading', 'Bars, rings and segments with an animatable value.', S.loading, 'loading'),
  scene('ui', 'messaging', 'A chat', 'Bubbles in and out, typing dots, typeOn per message.', S.messaging, 'messaging'),
  scene('ui', 'dialogs', 'Dialogs, toasts and badges', 'Things that live on a screen, placed with put().', S.dialogs, 'dialogs'),
  scene('charts', 'live-chart', 'A chart in a scene', 'A chart is a plane in the scene. It grows in, then morphs to new numbers.', S.chartLive, 'chartLive', 'In scenes'),
  scene('charts', 'dashboard', 'A dashboard on a screen', 'Four charts put on a monitor like any other element.', S.chartDash, 'chartDash', 'In scenes'),
  scene('waves', 'radio', 'Radio from a router', 'Arcs above the router; animating the phase moves them outward.', S.radioDemo, 'radioDemo', 'In scenes'),
  scene('waves', 'echo-scene', 'Sonar and an echo', 'Out, off a reflector, and a weaker beam back.', S.echoDemo, 'echoDemo', 'In scenes'),
  scene('optics', 'pinhole', 'Pinhole camera', 'The camera centre, the image plane at focal length f, and the rays through its corners. A longer focal length narrows the view.', S.pinhole, 'pinhole'),
  scene('optics', 'stereo', 'Stereo rig', 'Two cameras a baseline apart. Moving the point away shrinks the disparity: Z = f * b / d.', S.stereo, 'stereo'),
  scene('math', 'graph', 'A function graph', 'A function on axes with a tangent.', S.mathGraph, 'mathGraph'),
  scene('math', 'riemann', 'Riemann sums', 'Slices under a curve that refine into the integral.', S.mathRiemann, 'mathRiemann'),
  scene('math', 'product', 'A matrix product', 'Two matrices and their product, entry by entry.', S.mathProduct, 'mathProduct'),
  scene('math', 'transform', 'A plane under a matrix', 'The grid and basis vectors deform under a 2x2 matrix.', S.mathTransform, 'mathTransform'),
  scene('math', 'field', 'A vector field', 'Arrows over a plane.', S.mathField, 'mathField'),
  scene('math', 'number-line', 'A number line', 'Points and intervals on a line.', S.mathLine, 'mathLine'),
  scene('math', 'unit-circle', 'The unit circle', 'Sine and cosine from a point on the circle.', S.mathCircle, 'mathCircle'),
  scene('flow', 'decision', 'A flowchart', 'Start, a decision and two ways to the end. Edges trace on one after another.', S.flowDecision, 'flowDecision'),
  scene('flow', 'pipeline', 'A pipeline', 'Left to right, one box after another.', S.flowPipeline, 'flowPipeline'),
  scene('flow', 'tree', 'A tree', 'Parents sit centred over their children.', S.flowTree, 'flowTree'),
  scene('flow', 'network', 'A network', 'A force layout: linked nodes pull together, all nodes push apart.', S.flowNetwork, 'flowNetwork'),
  scene('flow', 'linked', 'Linked to a device', 'A diagram is made of scene nodes, so a link can end at one of its boxes.', S.flowLinked, 'flowLinked'),
  scene('flow', 'sequence', 'A sequence diagram', 'Lifelines under each participant, and messages in the order they happen. A pulse rides the request.', S.flowSequence, 'flowSequence'),
];
