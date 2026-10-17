/*
 * Option-driven demos: devices, charts and waves. Each is one declaration; the scene that runs and
 * the code that is shown are both produced from it, so they cannot drift apart (a test checks it).
 */
import * as core from '../../../../src/index.ts';
import * as devices from '../../../../src/devices/index.ts';
import * as charts from '../../../../src/charts/index.ts';
import * as waves from '../../../../src/waves/index.ts';
import { call, lit, withImports } from '../code.ts';
import type { Control, Demo, Made, Opts, Pack } from '../types.ts';

const { Scene, Timeline, ground, tween } = core;

type Fn = (o?: never) => core.Node;
const factories: Record<string, Fn> = { ...(devices as unknown as Record<string, Fn>), ...(charts as unknown as Record<string, Fn>), ...(waves as unknown as Record<string, Fn>), paper: devices.document as unknown as Fn };

/** every export name per import path, so a snippet imports exactly what it uses */
export const namespaces: Record<string, string[]> = {
  '': Object.keys(core), devices: [...Object.keys(devices).filter((k) => k !== 'document'), 'paper'], ui: [], charts: Object.keys(charts), waves: Object.keys(waves),
};
const alias: Record<string, string> = { paper: 'document as paper' };

const num = (key: string, min: number, max: number, step = 0.1, label?: string): Control => ({ type: 'number', key, min, max, step, label });
const bool = (key: string, label?: string): Control => ({ type: 'boolean', key, label });
const sel = (key: string, options: string[], label?: string): Control => ({ type: 'select', key, options, label });
const txt = (key: string, label?: string): Control => ({ type: 'text', key, label });
const ROLES = ['accent', 'ink', 'faint', 's1', 's2', 's3', 's4'];
const role = () => sel('role', ROLES);

const imports = (body: string) => {
  let text = withImports(body, Object.fromEntries(Object.entries(namespaces).map(([k, v]) => [k, v])));
  return text.replace(/^import \{([^}]*)\} from/gm, (_m, names: string) => `import {${names.replace(/\bpaper\b/, alias.paper)}} from`);
};
const clean = (o: Opts, controls: Control[]) => {
  const out: Opts = {};
  for (const [k, v] of Object.entries(o)) { if (v === '' || v === undefined) continue; out[k] = typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v; }
  void controls;
  return out;
};

/* ------------------------------------------------------------------ devices */

interface AssetSpec { pack?: Pack; fn: string; title: string; summary: string; defaults: Opts; controls: Control[]; group: string }
const asset = (a: AssetSpec): Demo => {
  const body = (o: Opts) => `const s = new Scene({ view: 'iso' });\ns.add(ground(), ${call(a.fn, clean(o, a.controls))});`;
  return {
    id: `${a.pack ?? 'devices'}/${a.fn === 'paper' ? 'document' : a.fn}`, pack: a.pack ?? 'devices', fn: a.fn === 'paper' ? 'document' : a.fn, title: a.title, summary: a.summary, group: a.group, controls: a.controls, defaults: a.defaults, live: true,
    make(o): Made {
      const s = new Scene({ view: 'iso' });
      s.add(ground(), (factories[a.fn] as (o: unknown) => core.Node)(clean(o, a.controls)));
      return { s };
    },
    code: (o) => imports(body(o)),
  };
};

const SCREENS = 'Screens and computers', GEAR = 'Peripherals and network', SOLIDS = 'Objects and solids';
export const deviceDemos: Demo[] = [
  asset({ fn: 'monitor', title: 'Monitor', summary: 'A desktop display with a stand. Empty by default; put things on the screen with put().', group: SCREENS, defaults: { width: 3 }, controls: [num('width', 1.5, 6)] }),
  asset({ fn: 'tv', title: 'TV', summary: 'A wide screen on a low stand.', group: SCREENS, defaults: { width: 4.4 }, controls: [num('width', 2, 7)] }),
  asset({ fn: 'tablet', title: 'Tablet', summary: 'A tablet lying flat or standing up.', group: SCREENS, defaults: { width: 2.5 }, controls: [num('width', 1.2, 4), num('ratio', 0.5, 1.6, 0.05)] }),
  asset({ fn: 'phone', title: 'Phone', summary: 'A phone, sized by height.', group: SCREENS, defaults: { height: 2.4 }, controls: [num('height', 1, 4)] }),
  asset({ fn: 'laptop', title: 'Laptop', summary: 'Screen, keyboard and trackpad. lean tilts the screen back.', group: SCREENS, defaults: { width: 3.2, lean: 16 }, controls: [num('width', 1.6, 5), num('lean', 0, 40, 1)] }),
  asset({ fn: 'browser', title: 'Browser window', summary: 'A window with a tab bar and an address.', group: SCREENS, defaults: { width: 4, url: 'example.com' }, controls: [num('width', 2, 6), txt('url')] }),
  asset({ fn: 'terminal', title: 'Terminal', summary: 'Stays dark in every theme unless light is set.', group: SCREENS, defaults: { width: 4, title: 'zsh', light: false }, controls: [num('width', 2, 6), txt('title'), bool('light')] }),
  asset({ fn: 'paper', title: 'Document', summary: 'A sheet of paper with lines of text.', group: SCREENS, defaults: { width: 1.6, title: 'notes' }, controls: [num('width', 0.8, 3), txt('title'), num('lines', 2, 14, 1)] }),
  asset({ fn: 'server', title: 'Server rack', summary: 'Rack units with indicator lights.', group: GEAR, defaults: { width: 1.8, units: 3 }, controls: [num('width', 1, 3), num('units', 1, 8, 1), role()] }),
  asset({ fn: 'database', title: 'Database', summary: 'The classic stacked cylinder.', group: GEAR, defaults: { r: 0.9, layers: 3 }, controls: [num('r', 0.4, 1.6), num('layers', 1, 6, 1), role()] }),
  asset({ fn: 'cloud', title: 'Cloud', summary: 'A cloud made of spheres, drawn flat.', group: GEAR, defaults: { size: 2.4 }, controls: [num('size', 1, 4), role()] }),
  asset({ fn: 'keyboard', title: 'Keyboard', summary: 'Built from real layouts. Keys can be pressed and lit by id.', group: GEAR, defaults: { layout: 'tkl' }, controls: [sel('layout', ['full', 'tkl', '75', '60']), bool('iso'), num('tilt', 0, 12, 0.5)] }),
  asset({ fn: 'mouse', title: 'Mouse', summary: 'Body, buttons and a wheel, with an optional cable.', group: GEAR, defaults: { length: 1 }, controls: [num('length', 0.5, 2), bool('cable'), role()] }),
  asset({ fn: 'router', title: 'Router', summary: 'Antennas, status lights and ports. Waves attach to its signal anchor.', group: GEAR, defaults: { width: 1.8 }, controls: [num('width', 1, 3), num('antennas', 0, 4, 1), num('leds', 0, 8, 1), num('ports', 0, 6, 1)] }),
  asset({ fn: 'antenna', title: 'Antenna', summary: 'A whip, a dish or a lattice tower, with a signal anchor at the feed.', group: GEAR, defaults: { kind: 'dish', height: 2 }, controls: [sel('kind', ['whip', 'dish', 'tower']), num('height', 1, 4), num('tilt', 0, 60, 1), num('yaw', -180, 180, 5)] }),
  asset({ fn: 'micStand', title: 'Microphone on a stand', summary: 'Base, pole, boom and capsule.', group: GEAR, defaults: { height: 2.2 }, controls: [num('height', 1, 3.5), role()] }),
  asset({ fn: 'micHand', title: 'Handheld microphone', summary: 'Head, body and grip.', group: GEAR, defaults: { height: 1.4 }, controls: [num('height', 0.8, 2.4), role()] }),
  asset({ fn: 'speaker', title: 'Speaker', summary: 'A cabinet with two drivers.', group: GEAR, defaults: { height: 1.8 }, controls: [num('height', 1, 3), role()] }),
  asset({ fn: 'photoCamera', title: 'Photo camera', summary: 'A body with a lens. Not the same as the scene camera.', group: GEAR, defaults: { size: 1.5 }, controls: [num('size', 0.8, 2.6), role()] }),
  asset({ pack: 'objects', fn: 'cylinder', title: 'Cylinder', summary: 'A plain solid; res sets how many sides it has.', group: SOLIDS, defaults: { r: 0.8, h: 1.2 }, controls: [num('r', 0.3, 1.6), num('h', 0.3, 2.4), num('res', 6, 48, 1), num('fill', 0, 1, 0.02), role()] }),
  asset({ pack: 'objects', fn: 'sphere', title: 'Sphere', summary: 'A surface sphere with flat shading.', group: SOLIDS, defaults: { r: 0.9 }, controls: [num('r', 0.3, 1.6), num('res', 6, 40, 1), num('fill', 0, 1, 0.02), role()] }),
];

/* ------------------------------------------------------------------ charts */

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const lcg = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rnd = lcg(11);
const scatterPts = Array.from({ length: 16 }, (_, i) => ({ x: Math.round(i * 5.2 + rnd() * 10), y: Math.round(20 + i * 1.8 + rnd() * 25), s: i % 3 }));
const bubblePts = Array.from({ length: 12 }, () => ({ x: Math.round(rnd() * 100) / 10, y: Math.round(rnd() * 100) / 10, r: Math.round(rnd() * 100), v: Math.round(rnd() * 100) / 100 }));
const samples = Array.from({ length: 60 }, () => { let t = 0; for (let i = 0; i < 6; i++) t += rnd(); return Math.round((t - 3) * 8 + 50); });

const CHART_SCENE = { view: 'front', size: [420, 262], padding: 6 };
interface ChartSpec { id: string; fn: string; title: string; summary: string; defaults: Opts; controls: Control[] }
const chart = (c: ChartSpec): Demo => ({
  id: `charts/${c.id}`, pack: 'charts', group: 'Chart types', title: c.title, summary: c.summary, controls: c.controls, defaults: c.defaults, live: true,
  make(o): Made {
    const s = new Scene(CHART_SCENE as never);
    s.add((factories[c.fn] as (o: unknown) => core.Node)(clean(o, c.controls)));
    return { s };
  },
  code: (o) => imports(`const s = new Scene(${lit(CHART_SCENE)});\ns.add(${call(c.fn, clean(o, c.controls))});`),
});
const legend = sel('legend', ['', 'top', 'bottom', 'left', 'right']);
const palette = sel('palette', ['', 'sequential', 'diverging']);

export const chartDemos: Demo[] = [
  chart({ id: 'bar', fn: 'bars', title: 'Bar chart', summary: 'One series of values, labelled underneath.', defaults: { data: [12, 19, 7, 15, 22, 9], labels: months, title: 'Signups', labelValues: true }, controls: [txt('title'), bool('labelValues'), bool('horizontal'), num('highlight', 0, 5, 1)] }),
  chart({ id: 'grouped', fn: 'bars', title: 'Grouped bars', summary: 'A map of series gives side-by-side bars and a legend.', defaults: { data: { Web: [12, 19, 7, 15, 22, 9], App: [8, 11, 14, 9, 17, 13] }, labels: months, title: 'Grouped' }, controls: [txt('title'), bool('stack'), bool('normalize'), legend] }),
  chart({ id: 'stacked', fn: 'bars', title: 'Stacked bars', summary: 'stack: true piles the series on top of each other.', defaults: { data: { Web: [12, 19, 7, 15, 22, 9], App: [8, 11, 14, 9, 17, 13], API: [3, 5, 9, 4, 6, 7] }, labels: months, stack: true, title: 'Stacked' }, controls: [txt('title'), bool('stack'), bool('normalize'), legend] }),
  chart({ id: 'horizontal', fn: 'bars', title: 'Horizontal bars', summary: 'Label and value pairs, with one bar picked out.', defaults: { data: [['Rust', 82], ['Go', 64], ['TypeScript', 91], ['Python', 77]], horizontal: true, labelValues: true, highlight: 2 }, controls: [bool('horizontal'), bool('labelValues'), num('highlight', 0, 3, 1)] }),
  chart({ id: 'line', fn: 'lines', title: 'Line chart', summary: 'Several series, joined linearly, smoothly or in steps.', defaults: { data: { Latency: [220, 180, 240, 190, 150, 170], Errors: [90, 110, 80, 60, 70, 40] }, labels: months, curve: 'smooth', title: 'Smooth lines' }, controls: [txt('title'), sel('curve', ['linear', 'smooth', 'step']), bool('fill'), legend] }),
  chart({ id: 'area', fn: 'areas', title: 'Area chart', summary: 'Stacked or overlapping areas.', defaults: { data: { A: [3, 5, 4, 7, 6, 8], B: [2, 3, 5, 4, 6, 5], C: [1, 2, 2, 3, 4, 6] }, labels: months, stack: true, curve: 'smooth' }, controls: [bool('stack'), sel('curve', ['linear', 'smooth', 'step']), legend] }),
  chart({ id: 'step', fn: 'lines', title: 'Step line', summary: 'A line that steps, with the area under it filled.', defaults: { data: [4, 4, 7, 7, 7, 3, 9], curve: 'step', fill: true, title: 'Step' }, controls: [sel('curve', ['linear', 'smooth', 'step']), bool('fill'), txt('title')] }),
  chart({ id: 'scatter', fn: 'scatter', title: 'Scatter plot', summary: 'Points with a series index s and axis labels.', defaults: { points: scatterPts, title: 'Scatter', axes: { xLabel: 'hours', yLabel: 'score' } }, controls: [txt('title'), palette] }),
  chart({ id: 'bubbles', fn: 'scatter', title: 'Bubble chart', summary: 'Size from r and colour from v, through the sequential ramp.', defaults: { points: bubblePts, palette: 'sequential' }, controls: [palette] }),
  chart({ id: 'pie', fn: 'pie', title: 'Pie chart', summary: 'Shares of a whole, with a legend.', defaults: { data: [['Chrome', 62], ['Safari', 20], ['Firefox', 8], ['Edge', 6], ['Other', 4]], labelValues: true, legend: 'right' }, controls: [bool('labelValues'), legend] }),
  chart({ id: 'donut', fn: 'donut', title: 'Donut chart', summary: 'A pie with a hole. Colours picked by role.', defaults: { data: [['Done', 70], ['Open', 20], ['Blocked', 10]], labelValues: true, palette: ['accent', 's2', 'faint'] }, controls: [bool('labelValues'), legend] }),
  chart({ id: 'histogram', fn: 'histogram', title: 'Histogram', summary: 'Raw values, binned for you.', defaults: { values: samples, bins: 8, title: 'Histogram', axes: { xLabel: 'score' } }, controls: [num('bins', 3, 20, 1), txt('title')] }),
  chart({ id: 'heatmap', fn: 'heatmap', title: 'Heatmap', summary: 'A matrix coloured through the sequential ramp.', defaults: { matrix: [[1, 3, 5, 2, 8], [4, 6, 9, 3, 2], [7, 2, 4, 8, 6], [3, 9, 1, 5, 7]], rowLabels: ['Mon', 'Tue', 'Wed', 'Thu'], colLabels: ['9', '10', '11', '12', '13'], labelValues: true }, controls: [bool('labelValues'), palette] }),
  chart({ id: 'diverging', fn: 'heatmap', title: 'Diverging heatmap', summary: 'Values below and above zero run to opposite colours.', defaults: { matrix: [[-3, -1, 2, 4], [1, -4, 0, 3], [2, 2, -2, -1]], rowLabels: ['a', 'b', 'c'], colLabels: ['w', 'x', 'y', 'z'], palette: 'diverging', labelValues: true }, controls: [bool('labelValues'), palette] }),
  chart({ id: 'radar', fn: 'radar', title: 'Radar chart', summary: 'Several series over the same axes.', defaults: { data: { Alpha: [8, 6, 7, 5, 9], Beta: [5, 8, 4, 9, 6] }, labels: ['Speed', 'Power', 'Range', 'Armor', 'Magic'] }, controls: [legend] }),
  chart({ id: 'sparkline', fn: 'sparkline', title: 'Sparkline', summary: 'A word-sized chart without axes.', defaults: { data: [3, 5, 4, 8, 6, 9, 7, 11], size: [4, 1.4] }, controls: [] }),
];

/* ------------------------------------------------------------------ waves */

interface WaveSpec { id: string; title: string; summary: string; at: [number, number, number]; o: Opts; controls: Control[]; loop?: number }
const wave = (w: WaveSpec): Demo => {
  const defaults: Opts = { ...w.o, phase: 0.3 };
  const loop = w.loop ?? 1;
  const opts = (o: Opts) => { const c = clean(o, w.controls); delete c.phase; return { at: w.at, phase: 0.25, ...c }; };
  const tail = (o: Opts) => `const w = s.add(${call('wave', opts(o))});\nw.set('phase', ${lit(o.phase ?? 0.3)});\n\nconst tl = new Timeline();\ntl.play(tween(w, { phase: ${lit(Math.round(((o.phase as number) ?? 0.3) * 100) / 100 + loop)} }, { duration: ${loop * 3}, ease: 'linear' }));`;
  return {
    id: `waves/${w.id}`, pack: 'waves', group: 'Wave kinds', title: w.title, summary: w.summary, controls: [...w.controls, num('phase', 0, 1, 0.01)], defaults, live: true,
    make(o): Made {
      const s = new Scene({ padding: 14 });
      const n = s.add(waves.wave(opts(o) as never));
      n.set('phase', (o.phase as number) ?? 0.3);
      const tl = new Timeline();
      tl.play(tween(n, { phase: Math.round(((o.phase as number) ?? 0.3) * 100) / 100 + loop }, { duration: loop * 3, ease: 'linear' }));
      return { s, tl };
    },
    code: (o) => imports(`const s = new Scene({ padding: 14 });\n${tail(o)}`),
  };
};
const wl = num('wavelength', 0.2, 2, 0.05), reach = (max: number) => num('reach', 1, max, 0.1), amp = num('amplitude', 0.1, 1.2, 0.05), spread = num('spread', 10, 180, 1);
export const waveDemos: Demo[] = [
  wave({ id: 'sine', title: 'Sine wave', summary: 'A transverse wave along a line.', at: [-2.5, 0, 1], o: { kind: 'sine', wavelength: 0.8, amplitude: 0.35, reach: 5, direction: [1, 0, 0] }, controls: [wl, amp, reach(8)] }),
  wave({ id: 'longitudinal', title: 'Longitudinal wave', summary: 'Compressions and gaps along the direction of travel.', at: [-2.5, 0, 1], o: { kind: 'longitudinal', wavelength: 1, reach: 5, direction: [1, 0, 0] }, controls: [wl, reach(8)] }),
  wave({ id: 'standing', title: 'Standing wave', summary: 'Nodes that stay put and antinodes that swing.', at: [-3, 0, 1], o: { kind: 'standing', wavelength: 2, reach: 6, amplitude: 0.5, direction: [1, 0, 0] }, controls: [wl, amp, reach(9)] }),
  wave({ id: 'rings', title: 'Ripples', summary: 'Circles spreading on a plane.', at: [0, 0, 0.02], o: { kind: 'rings', wavelength: 0.5, reach: 3 }, controls: [wl, reach(6), bool('fade')] }),
  wave({ id: 'directional', title: 'Sonar beam', summary: 'Arcs travelling in one direction inside a sector.', at: [0, -2.4, 0.02], o: { kind: 'directional', wavelength: 0.6, reach: 5, spread: 60 }, controls: [wl, reach(8), spread, bool('edges')] }),
  wave({ id: 'cone', title: 'Sonar cone', summary: 'The same beam as caps of a cone in 3D.', at: [0, -2.4, 0.6], o: { kind: 'directional', wavelength: 0.6, reach: 5, spread: 50, cone: true, direction: [0, 1, 0.1] }, controls: [wl, reach(8), spread, bool('cone')] }),
  wave({ id: 'spherical', title: 'Spherical wave', summary: 'Shells of a sound spreading in 3D.', at: [0, 0, 1.2], o: { kind: 'spherical', wavelength: 0.6, reach: 2.4 }, controls: [wl, reach(5)] }),
  wave({ id: 'plane', title: 'Plane wave', summary: 'Parallel fronts along a vector.', at: [-2, 0, 0.02], o: { kind: 'plane', wavelength: 0.6, reach: 4, amplitude: 1.6, direction: [1, 0, 0] }, controls: [wl, amp, reach(8)] }),
  wave({ id: 'interference', title: 'Interference', summary: 'Two sources, with the lines where the waves cancel.', at: [0, 0, 0.02], o: { kind: 'interference', wavelength: 0.7, reach: 4.4, nodal: true }, controls: [wl, reach(7), bool('nodal')] }),
  wave({ id: 'echo', title: 'Echo', summary: 'Out, off a reflector, and a weaker beam back.', at: [0, -2.8, 0.02], o: { kind: 'echo', wavelength: 0.5, reach: 5, spread: 56, target: 3.2, reflect: 0.55 }, controls: [wl, reach(8), spread, num('target', 1, 6, 0.1), num('reflect', 0, 1, 0.05)], loop: 3 }),
];

export const assetDemos: Demo[] = [...deviceDemos, ...chartDemos, ...waveDemos];
export type { Pack };
