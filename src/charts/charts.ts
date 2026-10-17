import { SvgPlane, colourOf, esc, clamp, r1, nice, niceTicks, easeOut, hashId, INK, FAINT, GRID, BG, type SvgPlaneOpts } from '../draw/svgplane.ts';
export { niceTicks };

/* ------------------------------------------------------------------ data */

/** A named list of values, with an optional colour. */
export interface Series {
  /** the name shown in the legend */
  name: string;
  /** one number per label */
  values: number[];
  /** a role (`accent`, `s3`) or any CSS colour */
  color?: string;
}
/** Chart data after normalising: the labels along the axis and one series per colour. */
export interface Table {
  /** the labels along the axis */
  labels: string[];
  /** one entry per colour */
  series: Series[];
}

/** What `data` can be. Every form ends up as labels and series. */
export type ChartData =
  | number[]
  | number[][]
  | Record<string, number[]>
  | { labels?: string[]; series: Series[] }
  | Array<{ label: string; value: number }>
  | Array<[string, number]>;

/** A point of a scatter plot. */
export interface Point2 {
  /** horizontal value */
  x: number;
  /** vertical value */
  y: number;
  /** size, for bubbles */
  r?: number;
  /** value that sets the colour */
  v?: number;
  /** series index or name */
  s?: number | string;
}

/** The kinds of chart `chart` can draw. */
export type ChartType = 'bar' | 'line' | 'area' | 'scatter' | 'pie' | 'donut' | 'histogram' | 'heatmap' | 'radar' | 'sparkline';

/** Options of `chart` and of the named chart factories (`bars`, `lines`, `pie`, and so on). Which ones apply depends on the chart type. */
export interface ChartOpts extends SvgPlaneOpts {
  /** which chart to draw, for `chart`; the named factories set it */
  type?: ChartType;
  /** bar, line, area, pie, donut, radar, sparkline */
  data?: ChartData;
  /** labels along the category axis */
  labels?: string[];
  /** scatter */
  points?: Point2[];
  /** histogram: the raw values, binned for you */
  values?: number[];
  /** histogram: number of bins */
  bins?: number;
  /** heatmap */
  matrix?: number[][];
  /** heatmap: label of each row */
  rowLabels?: string[];
  /** heatmap: label of each column */
  colLabels?: string[];
  /** text above the chart */
  title?: string;
  /** axes and grid: true, false, or pick parts */
  axes?: boolean | { x?: boolean; y?: boolean; grid?: boolean; xLabel?: string; yLabel?: string };
  /** lowest value on the value axis */
  yMin?: number;
  /** highest value on the value axis */
  yMax?: number;
  /** bars: side by side (default) or stacked. Areas and lines: overlapping (default) or stacked. */
  stack?: boolean;
  /** stacked values as shares of 100% */
  normalize?: boolean;
  /** bars: run left to right instead of bottom to top */
  horizontal?: boolean;
  /** lines: how the points are joined */
  curve?: 'linear' | 'smooth' | 'step';
  /** lines: draw a dot at each point (default true) */
  dots?: boolean;
  /** lines: shade the area under each line */
  fill?: boolean;
  /** show the values on bars, slices, points and cells (true), or format them yourself */
  labelValues?: boolean | ((v: number) => string);
  /** where to put the legend, or `false` */
  legend?: boolean | 'top' | 'bottom' | 'right';
  /** how colours are chosen. See `palette` below. */
  palette?: Palette;
  /** series (or categories, for a single series) to show in the accent colour while the others fade to grey */
  highlight?: number | string | Array<number | string>;
  /** donut hole, as a fraction of the radius */
  hole?: number;
  /** scatter: biggest dot radius in svg units. Heatmap: draw the numbers. */
  maxR?: number;
  /** extra margin inside the chart, in world units */
  pad?: number;
  /** how to print a number on the axes and as a value label (`labelValues` as a function takes precedence) */
  format?: (v: number) => string;
}

/**
 * Where series colours come from. The default, 'categorical', walks through the theme's series colours
 * (--c-s1 to --c-s8), which are derived from your accent. The others are built from the theme too, so no
 * palette is tied to a particular look:
 *   'categorical'  distinct hues             'sequential'  light to strong, one hue
 *   'diverging'    two hues around a quiet middle   'mono'  the accent in steps
 * or a list of roles and CSS colours, or a function (index, count) => colour.
 */
export type Palette = 'categorical' | 'sequential' | 'diverging' | 'mono' | string[] | ((i: number, n: number) => string);

/* ------------------------------------------------------------------ small helpers */

/** item i of n, revealed by a shared `grow` from 0 to 1, with each item a little after the last */
const staged = (grow: number, i: number, n: number) => easeOut(grow * 1.5 - (0.5 * i) / Math.max(1, n - 1));

/** the default number format: whole thousands as `k`, millions as `M`, otherwise at most two decimals */
const fmt = (v: number) => (Math.abs(v) >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e4 ? `${+(v / 1e3).toFixed(1)}k` : `${+v.toFixed(2)}`);

/** a smooth path through points that never overshoots (monotone cubic) */
function smooth(p: [number, number][]): string {
  const n = p.length;
  if (n < 3) return p.map((q, i) => `${i ? 'L' : 'M'}${r1(q[0])} ${r1(q[1])}`).join('');
  const d = p.slice(1).map((q, i) => (q[1] - p[i][1]) / ((q[0] - p[i][0]) || 1));
  const m = p.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let s = `M${r1(p[0][0])} ${r1(p[0][1])}`;
  for (let i = 0; i < n - 1; i++) { const h = (p[i + 1][0] - p[i][0]) / 3; s += `C${r1(p[i][0] + h)} ${r1(p[i][1] + m[i] * h)} ${r1(p[i + 1][0] - h)} ${r1(p[i + 1][1] - m[i + 1] * h)} ${r1(p[i + 1][0])} ${r1(p[i + 1][1])}`; }
  return s;
}
/** a path that moves along, then up or down, so each value holds until the next point */
const stepPath = (p: [number, number][]) => p.map((q, i) => (i ? `H${r1(q[0])}V${r1(q[1])}` : `M${r1(q[0])} ${r1(q[1])}`)).join('');
/** the path of one line through its points in the chosen curve style */
const linePath = (p: [number, number][], curve: string) => (curve === 'smooth' ? smooth(p) : curve === 'step' ? stepPath(p) : p.map((q, i) => `${i ? 'L' : 'M'}${r1(q[0])} ${r1(q[1])}`).join(''));

/** The name of the i-th series when you gave none, as a spreadsheet names columns: A to Z, then AA, AB and so on. */
export function seriesName(i: number): string {
  let n = Math.max(0, Math.floor(i)) + 1, s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** The table behind any form of data: the labels along the axis and one series per colour. */
export function toTable(data: ChartData | undefined, labels?: string[]): Table {
  if (!data) return { labels: labels ?? [], series: [] };
  const lab = (n: number) => labels ?? Array.from({ length: n }, (_, i) => String(i + 1));
  if (Array.isArray(data)) {
    if (!data.length) return { labels: [], series: [] };
    const first = data[0];
    if (typeof first === 'number') return { labels: lab(data.length), series: [{ name: '', values: data as number[] }] };
    if (Array.isArray(first) && typeof first[0] === 'string') return { labels: (data as [string, number][]).map((d) => d[0]), series: [{ name: '', values: (data as [string, number][]).map((d) => d[1]) }] };
    if (Array.isArray(first)) return { labels: lab((first as number[]).length), series: (data as number[][]).map((v, i) => ({ name: seriesName(i), values: v })) };
    return { labels: (data as { label: string; value: number }[]).map((d) => d.label), series: [{ name: '', values: (data as { label: string; value: number }[]).map((d) => d.value) }] };
  }
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.series)) {
    const series = obj.series as Series[];
    return { labels: (obj.labels as string[] | undefined) ?? lab(series[0]?.values.length ?? 0), series };
  }
  const map = data as Record<string, number[]>, names = Object.keys(map);
  return { labels: lab(map[names[0]]?.length ?? 0), series: names.map((name) => ({ name, values: map[name] })) };
}

/* ------------------------------------------------------------------ the chart */

/**
 * A chart drawn on a plane in the scene: flat on the page, standing up, or on a screen (`device.put`). It takes the
 * theme's colours and updates with them. `grow` (0 to 1) reveals it, and `data` (the numbers flattened) can be
 * tweened to morph from one dataset to another: `tween(c, { data: c.flatten(next) })`.
 */
export class Chart extends SvgPlane {
  declare o: ChartOpts;
  private table0: Table;
  private uid: string;
  constructor(o: ChartOpts = {}) {
    super(o, [4, 2.5]);
    this.table0 = o.matrix
      ? { labels: o.colLabels ?? (o.matrix[0] ?? []).map((_, i) => String(i + 1)), series: o.matrix.map((values, i) => ({ name: o.rowLabels?.[i] ?? String(i + 1), values })) }
      : toTable(o.data, o.labels);
    this.props.grow = 1;
    this.props.data = this.flatten(this.table0);
    this.uid = `szc${Math.abs(hashId(this.id))}`;
  }
  /** all the numbers of a table in one list: what the `data` property holds, and what you tween to */
  flatten(t: ChartData | Table): number[] {
    return toTable(t, this.o.labels).series.flatMap((x) => x.values);
  }
  /** the current table: the original shape with the numbers from the `data` property, which may be mid-tween. A value that is not a finite number counts as 0, so one bad entry cannot spoil the whole drawing. */
  table(): Table {
    const flat = this.props.data as number[];
    let k = 0;
    return { labels: this.table0.labels, series: this.table0.series.map((s) => ({ ...s, values: s.values.map((v) => { const x = flat[k++] ?? v; return Number.isFinite(x) ? x : 0; }) })) };
  }
  draw(W: number, H: number): string { return draw(this, W, H); }
  /** the id the line charts give their reveal clip path, unique to this chart. @internal */ get clipId() { return this.uid; }
}

/** A chart. `chart({ type: 'bar', data: [3, 5, 2] })`, or use the shortcuts `bars`, `lines`, `pie`... */
export const chart = (o: ChartOpts = {}) => new Chart(o);
/** makes a named factory that is `chart` with the type fixed */
const shortcut = (type: ChartType) => (o: Omit<ChartOpts, 'type'> = {}) => new Chart({ ...o, type });
/**
 * A bar chart. `data` can be numbers, several series, label and value pairs, or a map of series.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * s.add(bars({ data: [12, 19, 7, 15, 22, 9], labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], title: 'Signups', labelValues: true }));
 */
export const bars = shortcut('bar');
/**
 * A line chart. Several series are drawn together, joined linearly, smoothly or in steps.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * s.add(lines({ data: { Latency: [220, 180, 240, 190, 150, 170], Errors: [90, 110, 80, 60, 70, 40] }, curve: 'smooth' }));
 */
export const lines = shortcut('line');
/**
 * An area chart: overlapping filled areas, or stacked with `stack: true`.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * s.add(areas({ data: { A: [3, 5, 4, 7, 6, 8], B: [2, 3, 5, 4, 6, 5] }, stack: true }));
 */
export const areas = shortcut('area');
/**
 * A scatter plot. Points can carry a size `r` (bubbles), a value `v` for colour, and a series `s`.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * s.add(scatter({ points: [{ x: 1, y: 2 }, { x: 2, y: 3.5 }, { x: 3, y: 3 }, { x: 4, y: 5.2 }, { x: 5, y: 4.8 }], title: 'Scatter' }));
 */
export const scatter = shortcut('scatter');
/**
 * A pie chart of the shares in `data`.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * s.add(pie({ data: [['Chrome', 62], ['Safari', 20], ['Firefox', 8], ['Other', 10]], labelValues: true, legend: 'right' }));
 */
export const pie = shortcut('pie');
/**
 * A pie with a hole. Takes the same options as `pie`.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * s.add(donut({ data: [['Done', 70], ['Open', 20], ['Blocked', 10]], labelValues: true }));
 */
export const donut = shortcut('donut');
/**
 * A histogram of raw `values`, binned into `bins` bars.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * s.add(histogram({ values: [1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 5, 6, 7, 7, 8], bins: 6, title: 'Histogram' }));
 */
export const histogram = shortcut('histogram');
/**
 * A matrix coloured through the theme's sequential ramp, or a diverging ramp for values around zero.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * s.add(heatmap({ matrix: [[1, 3, 5, 2], [4, 6, 9, 3], [7, 2, 4, 8]], rowLabels: ['Mon', 'Tue', 'Wed'], colLabels: ['9', '10', '11', '12'], labelValues: true }));
 */
export const heatmap = shortcut('heatmap');
/**
 * A radar chart: one spoke per label, one polygon per series.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * s.add(radar({ data: { Alpha: [8, 6, 7, 5, 9], Beta: [5, 8, 4, 9, 6] }, labels: ['A', 'B', 'C', 'D', 'E'] }));
 */
export const radar = shortcut('radar');
/**
 * A small line chart with no axes, the size of a word.
 *
 * @example
 * const s = new Scene({ view: 'front' });
 * s.add(sparkline({ data: [3, 5, 4, 8, 6, 9, 7, 11], size: [4, 1.4] }));
 */
export const sparkline = shortcut('sparkline');

/* ------------------------------------------------------------------ colour */

/** the colour of item i of n, following the palette option. `names` lets `highlight` pick by name; `explicit` is the series' own colour. */
function paint(o: ChartOpts, i: number, n: number, names: string[], explicit?: string): string {
  if (n === 1 && !explicit && o.highlight === undefined && o.palette === undefined) return 'var(--c-s1)';
  const hi = o.highlight === undefined ? null : (Array.isArray(o.highlight) ? o.highlight : [o.highlight]);
  if (hi) return hi.some((h) => h === i || h === names[i]) ? 'var(--c-accent)' : 'color-mix(in oklab, var(--c-faint) 70%, var(--c-bg))';
  if (explicit) return colourOf(explicit);
  const p = o.palette ?? 'categorical', t = n <= 1 ? 1 : i / (n - 1);
  if (typeof p === 'function') return colourOf(p(i, n));
  if (Array.isArray(p)) return colourOf(p[i % p.length]);
  if (p === 'sequential') return `color-mix(in oklab, var(--c-hi) ${Math.round(28 + 72 * t)}%, var(--c-lo))`;
  if (p === 'mono') return `color-mix(in oklab, var(--c-accent) ${Math.round(100 - 60 * t)}%, var(--c-bg))`;
  if (p === 'diverging') return t < 0.5 ? `color-mix(in oklab, var(--c-s2) ${Math.round((1 - 2 * t) * 100)}%, var(--c-lo))` : `color-mix(in oklab, var(--c-hi) ${Math.round((2 * t - 1) * 100)}%, var(--c-lo))`;
  // categorical: the theme's eight, then the same eight softened
  const k = i % 8, c = `var(--c-s${k + 1})`;
  return i < 8 ? c : `color-mix(in oklab, ${c} 65%, var(--c-bg))`;
}
/** a value from 0 to 1 as a colour on the ramp, for heatmaps and value-coloured points */
function ramp(o: ChartOpts, t: number): string {
  if (o.palette === 'diverging') return paint({ ...o, highlight: undefined }, Math.round(clamp(t) * 100), 101, []);
  return `color-mix(in oklab, var(--c-hi) ${Math.round(clamp(t) * 100)}%, var(--c-lo))`;
}

/* ------------------------------------------------------------------ drawing */

/** Lays out the margins, title, axes and legend of a chart, hands the plot rectangle to the drawer for its type, and adds the legend. W and H are in svg units. */
function draw(c: Chart, W: number, H: number): string {
  const o = c.o, type = o.type ?? 'bar', fs = Math.max(6, Math.min(W, H) * 0.046), grow = clamp(c.props.grow as number);
  const t = c.table(), nS = t.series.length, nC = t.labels.length;
  const names = type === 'pie' || type === 'donut' || (nS === 1 && type !== 'radar' && type !== 'heatmap') ? t.labels : t.series.map((s) => s.name);
  const axesOpt = o.axes === false ? { x: false, y: false, grid: false } : typeof o.axes === 'object' ? { x: true, y: true, grid: true, ...o.axes } : { x: true, y: true, grid: true };
  const bare = type === 'sparkline' || type === 'pie' || type === 'donut' || type === 'radar' || type === 'heatmap';
  const showAxes = !bare && o.axes !== false;
  const valFmt = typeof o.labelValues === 'function' ? o.labelValues : o.format ?? fmt;
  const pad = (o.pad ?? 0.08) * 100;
  const legendPos = o.legend === false ? null : o.legend === true || o.legend === undefined ? (((type === 'pie' || type === 'donut') ? nC > 1 : nS > 1 && type !== 'heatmap' && type !== 'scatter') || o.legend === true ? 'top' : null) : o.legend;
  let top = pad + (o.title ? fs * 2 : 0), bottom = pad, left = pad, right = pad;
  let svg = '';
  if (o.title) svg += `<text x="${pad}" y="${pad + fs * 1.15}" font-size="${fs * 1.2}" font-weight="700" fill="${INK}">${esc(o.title)}</text>`;
  if (legendPos === 'top') top += fs * 1.9;
  if (legendPos === 'bottom') bottom += fs * 1.9;
  const legendItems = (type === 'pie' || type === 'donut' || nS === 1 ? t.labels : t.series.map((s) => s.name)).map((name, i, all) => ({ name, colour: paint(o, i, all.length, all, t.series[type === 'pie' || type === 'donut' || nS === 1 ? 0 : i]?.color && nS > 1 ? t.series[i].color : undefined) }));
  if (legendPos === 'right' && legendItems.length) right += Math.max(...legendItems.map((l) => l.name.length)) * fs * 0.6 + fs * 2.4;

  // the plot rectangle, after leaving room for tick labels
  const horizontal = !!o.horizontal && (type === 'bar');
  const stacked = !!o.stack || !!o.normalize;
  let lo = 0, hi = 1, ticks: number[] = [];
  if (type === 'bar' || type === 'line' || type === 'area' || type === 'sparkline' || type === 'histogram') {
    const vals = type === 'histogram' ? histogramBins(o, t).counts : null;
    const colMax = (j: number) => stacked ? t.series.reduce((a, s) => a + Math.max(0, s.values[j] ?? 0), 0) : Math.max(...t.series.map((s) => s.values[j] ?? 0));
    const dmax = vals ? Math.max(...vals) : o.normalize ? 100 : Math.max(...Array.from({ length: nC }, (_, j) => colMax(j)), 0);
    const dmin = vals ? 0 : Math.min(0, ...t.series.flatMap((s) => s.values));
    const every = t.series.flatMap((s) => s.values);
    lo = o.yMin ?? (type === 'line' || type === 'sparkline' ? (every.length ? Math.min(...every) : 0) : dmin);
    hi = o.yMax ?? dmax;
    if (type === 'line' && o.yMin === undefined) { const span = hi - lo || 1; lo = lo - span * 0.08; }
    if (type !== 'sparkline') { ticks = niceTicks(lo, hi, 5); if (o.yMin === undefined) lo = Math.min(lo, ticks[0]); if (o.yMax === undefined) hi = Math.max(hi, ticks[ticks.length - 1]); if (type !== 'line') lo = Math.min(lo, ticks[0]); }
    if (hi <= lo) hi = lo + 1;
  }
  const catLabelW = horizontal ? Math.max(...t.labels.map((l) => l.length), 1) * fs * 0.6 + fs * 0.8 : 0;
  const valLabelW = Math.max(...ticks.map((v) => valFmt(v).length), 1) * fs * 0.6 + fs * 0.8;
  if (showAxes) { left += horizontal ? catLabelW : valLabelW; bottom += fs * (axesOpt.xLabel ? 3.6 : 2.2); if (axesOpt.yLabel) left += fs * 1.2; }
  const pw = W - left - right, ph = H - top - bottom, px = left, py = top;

  const body = (() => {
    switch (type) {
      case 'bar': return bars_(c, t, o, names, px, py, pw, ph, lo, hi, ticks, fs, grow, horizontal, stacked, valFmt, showAxes, axesOpt);
      case 'line': case 'area': case 'sparkline': return lines_(c, t, o, names, px, py, pw, ph, lo, hi, ticks, fs, grow, stacked, valFmt, showAxes, axesOpt, type);
      case 'histogram': return hist_(t, o, px, py, pw, ph, lo, hi, ticks, fs, grow, valFmt, showAxes, axesOpt);
      case 'scatter': return scatter_(o, px, py, pw, ph, fs, grow, valFmt, axesOpt, W, H, top, bottom, left, right);
      case 'pie': case 'donut': return pie_(t, o, names, W, H, top, bottom, left, right, fs, grow, valFmt, type === 'donut');
      case 'heatmap': return heat_(t, o, px, py, pw, ph, fs, grow, valFmt);
      case 'radar': return radar_(t, o, names, px, py, pw, ph, fs, grow);
    }
  })();
  svg += body;

  // legend
  if (legendPos) {
    let x = legendPos === 'right' ? W - right + fs : left, y = legendPos === 'bottom' ? H - pad - fs * 0.5 : legendPos === 'top' ? pad + (o.title ? fs * 2 : 0) + fs * 1.1 : top + fs;
    for (const l of legendItems) {
      svg += `<rect x="${r1(x)}" y="${r1(y - fs * 0.75)}" width="${fs * 0.9}" height="${fs * 0.9}" rx="${fs * 0.2}" fill="${l.colour}"/><text x="${r1(x + fs * 1.35)}" y="${r1(y)}" font-size="${fs * 0.95}" fill="${INK}">${esc(l.name)}</text>`;
      if (legendPos === 'right') y += fs * 1.6; else x += l.name.length * fs * 0.6 * 0.95 + fs * 2.6;
    }
  }
  return svg;
}

/** the object form of the `axes` option */
type AxesOpt = { x?: boolean; y?: boolean; grid?: boolean; xLabel?: string; yLabel?: string };

/** the y axis, grid lines and tick labels for a chart whose values run up the page */
function yAxis(px: number, py: number, pw: number, ph: number, lo: number, hi: number, ticks: number[], fs: number, a: AxesOpt, f: (v: number) => string): string {
  const Y = (v: number) => py + ph - ((v - lo) / (hi - lo)) * ph;
  let s = '';
  for (const v of ticks) {
    if (v < lo - 1e-9 || v > hi + 1e-9) continue;
    if (a.grid) s += `<line x1="${px}" y1="${r1(Y(v))}" x2="${px + pw}" y2="${r1(Y(v))}" stroke="${GRID}" stroke-width="${v === 0 ? 1.2 : 0.7}"/>`;
    if (a.y) s += `<text x="${px - fs * 0.6}" y="${r1(Y(v) + fs * 0.33)}" text-anchor="end" font-size="${fs * 0.9}" fill="${FAINT}">${esc(f(v))}</text>`;
  }
  if (a.yLabel) s += `<text transform="translate(${fs * 0.9} ${py + ph / 2}) rotate(-90)" text-anchor="middle" font-size="${fs * 0.95}" fill="${FAINT}">${esc(a.yLabel)}</text>`;
  return s;
}

/** the category labels under a bar or line chart, thinned out so they do not collide, the x axis line and its title. `bw` is the room for one label. */
function xLabels(labels: string[], xs: number[], y: number, fs: number, bw: number, a: AxesOpt, px: number, pw: number, py: number, ph: number): string {
  let s = '';
  const maxLen = Math.max(1, ...labels.map((l) => l.length)), fits = maxLen * fs * 0.6 * 0.9 <= bw * 1.05, every = fits ? 1 : Math.ceil((maxLen * fs * 0.6 * 0.9) / Math.max(1, bw));
  labels.forEach((l, i) => { if (i % every === 0) s += `<text x="${r1(xs[i])}" y="${r1(y + fs * 1.3)}" text-anchor="middle" font-size="${fs * 0.9}" fill="${FAINT}">${esc(l)}</text>`; });
  if (a.xLabel) s += `<text x="${px + pw / 2}" y="${r1(y + fs * 3.2)}" text-anchor="middle" font-size="${fs * 0.95}" fill="${FAINT}">${esc(a.xLabel)}</text>`;
  return s + `<line x1="${px}" y1="${py + ph}" x2="${px + pw}" y2="${py + ph}" stroke="${INK}" stroke-opacity=".55" stroke-width="1"/>`;
}

/** bars, vertical or horizontal, grouped or stacked, grown in by `grow` */
function bars_(c: Chart, t: Table, o: ChartOpts, names: string[], px: number, py: number, pw: number, ph: number, lo: number, hi: number, ticks: number[], fs: number, grow: number, horizontal: boolean, stacked: boolean, f: (v: number) => string, showAxes: boolean, a: AxesOpt): string {
  const nC = t.labels.length, nS = t.series.length;
  const single = nS === 1;
  let s = '';
  if (horizontal) {
    // categories run down the page, values run across
    const X = (v: number) => px + ((v - lo) / (hi - lo)) * pw, band = ph / nC, group = band * 0.72, bh = stacked || single ? group : group / nS;
    if (showAxes) for (const v of ticks) { if (v < lo || v > hi) continue; if (a.grid) s += `<line x1="${r1(X(v))}" y1="${py}" x2="${r1(X(v))}" y2="${py + ph}" stroke="${GRID}" stroke-width="0.7"/>`; if (a.x) s += `<text x="${r1(X(v))}" y="${py + ph + fs * 1.3}" text-anchor="middle" font-size="${fs * 0.9}" fill="${FAINT}">${esc(f(v))}</text>`; }
    for (let j = 0; j < nC; j++) {
      const cy = py + band * (j + 0.5), g = staged(grow, j, nC);
      if (showAxes && a.y) s += `<text x="${px - fs * 0.6}" y="${r1(cy + fs * 0.33)}" text-anchor="end" font-size="${fs * 0.9}" fill="${FAINT}">${esc(t.labels[j])}</text>`;
      let acc = 0;
      t.series.forEach((se, i) => {
        const raw = se.values[j] ?? 0, v = o.normalize ? (raw / (t.series.reduce((q, z) => q + (z.values[j] ?? 0), 0) || 1)) * 100 : raw;
        const x0 = stacked ? X(lo + acc) : X(Math.max(lo, 0)), x1 = stacked ? X(lo + acc + v * g) : X(Math.max(lo, 0) + (v - Math.max(lo, 0)) * g);
        const y = stacked || single ? cy - bh / 2 : cy - group / 2 + i * bh;
        if (stacked) acc += v;
        s += `<rect x="${r1(Math.min(x0, x1))}" y="${r1(y)}" width="${r1(Math.abs(x1 - x0))}" height="${r1(bh * 0.92)}" rx="${r1(Math.min(3, bh * 0.2))}" fill="${paint(o, single && (o.palette !== undefined || o.highlight !== undefined) ? j : single ? 0 : i, single && (o.palette !== undefined || o.highlight !== undefined) ? nC : single ? 1 : nS, single ? t.labels : names, se.color)}"/>`;
        if (o.labelValues && g > 0.95) s += `<text x="${r1(x1 + fs * 0.4)}" y="${r1(y + bh * 0.5 + fs * 0.33)}" font-size="${fs * 0.85}" fill="${INK}">${esc(f(v))}</text>`;
      });
    }
    return s;
  }
  const Y = (v: number) => py + ph - ((v - lo) / (hi - lo)) * ph, band = pw / nC, group = band * 0.74, bw = stacked || single ? group : group / nS;
  if (showAxes) s += yAxis(px, py, pw, ph, lo, hi, ticks, fs, a, f);
  const xs: number[] = [];
  for (let j = 0; j < nC; j++) {
    const cx = px + band * (j + 0.5), g = staged(grow, j, nC);
    xs.push(cx);
    let acc = 0;
    const base = Math.max(lo, 0);
    t.series.forEach((se, i) => {
      const raw = se.values[j] ?? 0, v = o.normalize ? (raw / (t.series.reduce((q, z) => q + (z.values[j] ?? 0), 0) || 1)) * 100 : raw;
      const x = stacked || single ? cx - bw / 2 : cx - group / 2 + i * bw;
      const y0 = stacked ? Y(acc) : Y(base), y1 = stacked ? Y(acc + v * g) : Y(base + (v - base) * g);
      if (stacked) acc += v;
      s += `<rect x="${r1(x)}" y="${r1(Math.min(y0, y1))}" width="${r1(bw * 0.92)}" height="${r1(Math.abs(y1 - y0))}" rx="${r1(Math.min(3, bw * 0.16))}" fill="${paint(o, single && (o.palette !== undefined || o.highlight !== undefined) ? j : single ? 0 : i, single && (o.palette !== undefined || o.highlight !== undefined) ? nC : single ? 1 : nS, single ? t.labels : names, se.color)}"/>`;
      if (o.labelValues && g > 0.95) s += `<text x="${r1(x + bw * 0.46)}" y="${r1(Math.min(y0, y1) - fs * 0.4)}" text-anchor="middle" font-size="${fs * 0.85}" fill="${INK}">${esc(f(v))}</text>`;
    });
  }
  if (showAxes && a.x) s += xLabels(t.labels, xs, py + ph, fs, band, a, px, pw, py, ph);
  return s;
}

/** lines, areas and sparklines. A clip path that widens with `grow` draws them in from the left. */
function lines_(c: Chart, t: Table, o: ChartOpts, names: string[], px: number, py: number, pw: number, ph: number, lo: number, hi: number, ticks: number[], fs: number, grow: number, stacked: boolean, f: (v: number) => string, showAxes: boolean, a: AxesOpt, type: ChartType): string {
  const nC = t.labels.length, nS = t.series.length, curve = o.curve ?? 'linear';
  const X = (j: number) => px + (nC <= 1 ? pw / 2 : (pw * j) / (nC - 1)), Y = (v: number) => py + ph - ((v - lo) / (hi - lo)) * ph;
  const spark = type === 'sparkline', area = type === 'area' || !!o.fill, id = `${c.clipId}`;
  let s = '';
  if (showAxes) s += yAxis(px, py, pw, ph, lo, hi, ticks, fs, a, f);
  // a sparkline fits its own range, with no axis to keep honest
  if (spark) { const v = t.series[0]?.values ?? []; if (!v.length) return ''; lo = Math.min(...v); hi = Math.max(...v); if (hi === lo) hi = lo + 1; }
  const SY = spark ? (v: number) => py + ph * 0.1 + (ph * 0.8) * (1 - (v - lo) / (hi - lo)) : Y;
  // the reveal: a clip that grows from the left
  s += `<clipPath id="${id}"><rect x="${px - 4}" y="${py - 8}" width="${r1((pw + 8) * easeOut(grow))}" height="${ph + 16}"/></clipPath><g clip-path="url(#${id})">`;
  const base = Math.max(lo, Math.min(0, hi));
  const cum = Array.from({ length: nC }, () => 0);
  // with `normalize` every column is drawn as shares of its own total, as the bars do
  const totals = Array.from({ length: nC }, (_, j) => t.series.reduce((a, q) => a + (q.values[j] ?? 0), 0));
  for (let i = 0; i < nS; i++) {
    const se = t.series[i], colour = paint(o, nS === 1 ? 0 : i, nS, names, se.color);
    const bottom = stacked ? cum.slice() : null;
    const pts: [number, number][] = se.values.map((v, j) => { const u = o.normalize ? (v / (totals[j] || 1)) * 100 : v; if (stacked) cum[j] += u; return [X(j), SY(stacked ? cum[j] : u)]; });
    if (area) {
      const lower: [number, number][] = bottom ? bottom.map((v, j) => [X(j), SY(v)] as [number, number]).reverse() : [[X(nC - 1), SY(base)], [X(0), SY(base)]];
      s += `<path d="${linePath(pts, curve)}L${lower.map((q) => `${r1(q[0])} ${r1(q[1])}`).join('L')}Z" fill="${colour}" fill-opacity="${stacked ? 0.55 : 0.2}"/>`;
    }
    s += `<path d="${linePath(pts, curve)}" fill="none" stroke="${colour}" stroke-width="${spark ? 1.6 : 2}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (o.dots !== false && !spark && nC <= 40) s += pts.map((q) => `<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="${2.6}" fill="${BG}" stroke="${colour}" stroke-width="1.6"/>`).join('');
    if (spark) { const q = pts[pts.length - 1]; s += `<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="2.8" fill="${colour}"/>`; }
    if (o.labelValues && !spark) s += pts.map((q, j) => `<text x="${r1(q[0])}" y="${r1(q[1] - fs * 0.7)}" text-anchor="middle" font-size="${fs * 0.8}" fill="${INK}">${esc(f(se.values[j]))}</text>`).join('');
  }
  s += '</g>';
  if (showAxes && a.x) s += xLabels(t.labels, Array.from({ length: nC }, (_, j) => X(j)), py + ph, fs, pw / Math.max(1, nC - 1), a, px, pw, py, ph);
  return s;
}

/** the bins of a histogram: edges on round numbers, and how many values fall in each (a value on an edge goes to the bin above; the highest to the last). Non-finite values are ignored. */
function histogramBins(o: ChartOpts, t: Table): { edges: number[]; counts: number[] } {
  const vals = (o.values ?? t.series[0]?.values ?? []).filter(Number.isFinite);
  if (!vals.length) return { edges: [0, 1], counts: [0] };
  const mn = Math.min(...vals), mx = Math.max(...vals), n = o.bins ?? Math.max(4, Math.min(24, Math.ceil(Math.log2(vals.length) + 1)));
  const step = nice((mx - mn || 1) / n, true), a = Math.floor(mn / step) * step, nb = Math.max(1, Math.ceil((mx - a) / step + 1e-9));
  const edges = Array.from({ length: nb + 1 }, (_, i) => a + i * step), counts = new Array(nb).fill(0);
  for (const v of vals) counts[Math.min(nb - 1, Math.floor((v - a) / step))]++;
  return { edges, counts };
}

/** the bars of a histogram */
function hist_(t: Table, o: ChartOpts, px: number, py: number, pw: number, ph: number, lo: number, hi: number, ticks: number[], fs: number, grow: number, f: (v: number) => string, showAxes: boolean, a: AxesOpt): string {
  const { edges, counts } = histogramBins(o, t), nb = counts.length, bw = pw / nb, Y = (v: number) => py + ph - ((v - lo) / (hi - lo)) * ph;
  let s = showAxes ? yAxis(px, py, pw, ph, lo, hi, ticks, fs, a, f) : '';
  counts.forEach((n, j) => {
    const g = staged(grow, j, nb), y = Y(n * g);
    s += `<rect x="${r1(px + j * bw + 1)}" y="${r1(y)}" width="${r1(bw - 2)}" height="${r1(Y(0) - y)}" rx="2" fill="${paint(o, 0, 1, [])}"/>`;
    if (o.labelValues && n && g > 0.95) s += `<text x="${r1(px + (j + 0.5) * bw)}" y="${r1(y - fs * 0.4)}" text-anchor="middle" font-size="${fs * 0.8}" fill="${INK}">${n}</text>`;
  });
  if (showAxes && a.x) {
    const every = Math.ceil((f(edges[0]).length * fs * 0.6 * 1.2) / bw);
    edges.forEach((e, j) => { if (j % every === 0) s += `<text x="${r1(px + j * bw)}" y="${r1(py + ph + fs * 1.3)}" text-anchor="middle" font-size="${fs * 0.9}" fill="${FAINT}">${esc(f(e))}</text>`; });
    s += `<line x1="${px}" y1="${py + ph}" x2="${px + pw}" y2="${py + ph}" stroke="${INK}" stroke-opacity=".55"/>`;
    if (a.xLabel) s += `<text x="${px + pw / 2}" y="${r1(py + ph + fs * 3.2)}" text-anchor="middle" font-size="${fs * 0.95}" fill="${FAINT}">${esc(a.xLabel)}</text>`;
  }
  return s;
}

/** a scatter plot or bubble chart. It lays out its own axes, because both are numeric and the plot rectangle from `draw` only fits a category axis. */
function scatter_(o: ChartOpts, px: number, py: number, pw: number, ph: number, fs: number, grow: number, f: (v: number) => string, a: AxesOpt, W: number, H: number, top: number, bottom: number, left: number, right: number): string {
  const pts = (o.points ?? []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)), xs = pts.length ? pts.map((p) => p.x) : [0, 1], ys = pts.length ? pts.map((p) => p.y) : [0, 1];
  const xt = niceTicks(Math.min(...xs), Math.max(...xs), 6), yt = niceTicks(o.yMin ?? Math.min(...ys), o.yMax ?? Math.max(...ys), 5);
  const x0 = xt[0], x1 = xt[xt.length - 1], y0 = yt[0], y1 = yt[yt.length - 1];
  const showY = o.axes !== false, lw = Math.max(...yt.map((v) => f(v).length)) * fs * 0.6 + fs * 0.8;
  const L = showY ? left - pad(o) + lw : left, B = H - bottom; // `bottom` already holds the room for the tick labels and the x label
  const X = (v: number) => L + ((v - x0) / (x1 - x0 || 1)) * (W - right - L), Y = (v: number) => top + (1 - (v - y0) / (y1 - y0 || 1)) * (B - top);
  let s = '';
  if (showY) {
    for (const v of yt) { if (a.grid) s += `<line x1="${L}" y1="${r1(Y(v))}" x2="${W - right}" y2="${r1(Y(v))}" stroke="${GRID}" stroke-width="0.7"/>`; if (a.y) s += `<text x="${L - fs * 0.6}" y="${r1(Y(v) + fs * 0.33)}" text-anchor="end" font-size="${fs * 0.9}" fill="${FAINT}">${esc(f(v))}</text>`; }
    for (const v of xt) { if (a.grid) s += `<line x1="${r1(X(v))}" y1="${top}" x2="${r1(X(v))}" y2="${B}" stroke="${GRID}" stroke-width="0.7"/>`; if (a.x) s += `<text x="${r1(X(v))}" y="${r1(B + fs * 1.3)}" text-anchor="middle" font-size="${fs * 0.9}" fill="${FAINT}">${esc(f(v))}</text>`; }
    s += `<line x1="${L}" y1="${B}" x2="${W - right}" y2="${B}" stroke="${INK}" stroke-opacity=".55"/><line x1="${L}" y1="${top}" x2="${L}" y2="${B}" stroke="${INK}" stroke-opacity=".55"/>`;
    if (a.xLabel) s += `<text x="${(L + W - right) / 2}" y="${r1(B + fs * 3.2)}" text-anchor="middle" font-size="${fs * 0.95}" fill="${FAINT}">${esc(a.xLabel)}</text>`;
    if (a.yLabel) s += `<text transform="translate(${fs * 0.9} ${(top + B) / 2}) rotate(-90)" text-anchor="middle" font-size="${fs * 0.95}" fill="${FAINT}">${esc(a.yLabel)}</text>`;
  }
  const vs = pts.map((p) => p.v).filter((v): v is number => v !== undefined), vmin = Math.min(...vs), vmax = Math.max(...vs);
  const rs = pts.map((p) => p.r).filter((v): v is number => v !== undefined), rmax = Math.max(...rs, 1e-9), maxR = o.maxR ?? 11;
  const seriesNames = [...new Set(pts.map((p) => String(p.s ?? '')))];
  pts.forEach((p, i) => {
    const g = staged(grow, i, pts.length), si = Math.max(0, seriesNames.indexOf(String(p.s ?? '')));
    const colour = p.v !== undefined ? ramp(o, 0.22 + 0.78 * ((p.v - vmin) / (vmax - vmin || 1))) : paint(o, si, seriesNames.length, seriesNames);
    const r = (p.r !== undefined ? 3 + (maxR - 3) * Math.sqrt(p.r / rmax) : 4) * g;
    s += `<circle cx="${r1(X(p.x))}" cy="${r1(Y(p.y))}" r="${r1(r)}" fill="${colour}" fill-opacity="${p.r !== undefined ? 0.7 : 0.9}" stroke="${BG}" stroke-width="0.8"/>`;
  });
  return s;
}
/** the margin of the chart in svg units */
const pad = (o: ChartOpts) => (o.pad ?? 0.08) * 100;

/** a pie or donut, swept in clockwise from the top by `grow` */
function pie_(t: Table, o: ChartOpts, names: string[], W: number, H: number, top: number, bottom: number, left: number, right: number, fs: number, grow: number, f: (v: number) => string, donut: boolean): string {
  const vals = t.series[0]?.values.map((v) => Math.max(0, v)) ?? [], total = vals.reduce((a, b) => a + b, 0) || 1;
  const cx = (left + W - right) / 2, cy = (top + H - bottom) / 2, R = Math.min(W - left - right, H - top - bottom) / 2 - (o.labelValues ? fs * 1.6 : 4);
  const hole = donut ? (o.hole ?? 0.58) * R : 0, sweepMax = 2 * Math.PI * easeOut(grow);
  let a = -Math.PI / 2, s = '';
  vals.forEach((v, i) => {
    const a0 = a, span = (v / total) * 2 * Math.PI, a1 = Math.min(a + span, -Math.PI / 2 + sweepMax);
    a += span;
    if (a1 <= a0 + 1e-6) return;
    const big = a1 - a0 > Math.PI ? 1 : 0, P = (r: number, ang: number) => `${r1(cx + r * Math.cos(ang))} ${r1(cy + r * Math.sin(ang))}`;
    const d = vals.length === 1 && a1 - a0 > 2 * Math.PI - 1e-3
      ? `M${P(R, 0)}A${R} ${R} 0 1 1 ${P(R, Math.PI)}A${R} ${R} 0 1 1 ${P(R, 0)}${hole ? `M${P(hole, 0)}A${hole} ${hole} 0 1 0 ${P(hole, Math.PI)}A${hole} ${hole} 0 1 0 ${P(hole, 0)}` : ''}Z`
      : hole ? `M${P(R, a0)}A${R} ${R} 0 ${big} 1 ${P(R, a1)}L${P(hole, a1)}A${hole} ${hole} 0 ${big} 0 ${P(hole, a0)}Z` : `M${r1(cx)} ${r1(cy)}L${P(R, a0)}A${R} ${R} 0 ${big} 1 ${P(R, a1)}Z`;
    s += `<path d="${d}" fill="${paint(o, i, vals.length, names)}" stroke="${BG}" stroke-width="1.6" stroke-linejoin="round" fill-rule="evenodd"/>`;
    if (o.labelValues && a1 >= a0 + span - 1e-6) {
      const m = (a0 + a1) / 2, pct = f === fmt ? `${Math.round((v / total) * 100)}%` : f(v);
      s += `<text x="${r1(cx + (R + fs * 0.9) * Math.cos(m))}" y="${r1(cy + (R + fs * 0.9) * Math.sin(m) + fs * 0.3)}" text-anchor="${Math.cos(m) > 0.2 ? 'start' : Math.cos(m) < -0.2 ? 'end' : 'middle'}" font-size="${fs * 0.85}" fill="${INK}">${esc(pct)}</text>`;
    }
  });
  return s;
}

/** a grid of cells, one row per series, coloured along the ramp between the lowest and highest value */
function heat_(t: Table, o: ChartOpts, px: number, py: number, pw: number, ph: number, fs: number, grow: number, f: (v: number) => string): string {
  const nR = t.series.length, nC = t.labels.length, all = t.series.flatMap((x) => x.values), mn = o.yMin ?? Math.min(...all), mx = o.yMax ?? Math.max(...all);
  const rowW = Math.max(...t.series.map((r) => r.name.length), 1) * fs * 0.6 + fs * 0.8, x0 = px + rowW, cw = (pw - rowW) / nC, y0 = py + fs * 1.6, ch = (ph - fs * 1.6) / nR;
  let s = '';
  t.labels.forEach((l, j) => { s += `<text x="${r1(x0 + (j + 0.5) * cw)}" y="${r1(py + fs * 0.9)}" text-anchor="middle" font-size="${fs * 0.9}" fill="${FAINT}">${esc(l)}</text>`; });
  t.series.forEach((r, i) => {
    s += `<text x="${r1(x0 - fs * 0.5)}" y="${r1(y0 + (i + 0.5) * ch + fs * 0.33)}" text-anchor="end" font-size="${fs * 0.9}" fill="${FAINT}">${esc(r.name)}</text>`;
    r.values.forEach((v, j) => {
      const k = i * nC + j, g = staged(grow, k, nR * nC), tt = (v - mn) / (mx - mn || 1);
      s += `<rect x="${r1(x0 + j * cw + 1)}" y="${r1(y0 + i * ch + 1)}" width="${r1(cw - 2)}" height="${r1(ch - 2)}" rx="${r1(Math.min(3, cw * 0.1))}" fill="${ramp(o, tt)}" fill-opacity="${r1(g * 100) / 100}"/>`;
      if (o.labelValues && g > 0.9) s += `<text x="${r1(x0 + (j + 0.5) * cw)}" y="${r1(y0 + (i + 0.5) * ch + fs * 0.3)}" text-anchor="middle" font-size="${fs * 0.8}" fill="${tt > 0.6 ? BG : INK}">${esc(f(v))}</text>`;
    });
  });
  return s;
}

/** a radar chart: four grid rings, a spoke per label and a polygon per series, scaled to the highest value */
function radar_(t: Table, o: ChartOpts, names: string[], px: number, py: number, pw: number, ph: number, fs: number, grow: number): string {
  const n = t.labels.length, cx = px + pw / 2, cy = py + ph / 2, R = Math.min(pw, ph) / 2 - fs * 1.8, all = t.series.flatMap((s) => s.values), mx = o.yMax ?? Math.max(...all, 1e-9);
  const P = (i: number, r: number): [number, number] => [cx + r * Math.sin((2 * Math.PI * i) / n), cy - r * Math.cos((2 * Math.PI * i) / n)];
  let s = '';
  for (let k = 1; k <= 4; k++) s += `<path d="${Array.from({ length: n }, (_, i) => `${i ? 'L' : 'M'}${P(i, (R * k) / 4).map(r1).join(' ')}`).join('')}Z" fill="none" stroke="${GRID}" stroke-width="0.8"/>`;
  t.labels.forEach((l, i) => {
    const [x, y] = P(i, R), [lx, ly] = P(i, R + fs * 1.2);
    s += `<line x1="${r1(cx)}" y1="${r1(cy)}" x2="${r1(x)}" y2="${r1(y)}" stroke="${GRID}" stroke-width="0.8"/><text x="${r1(lx)}" y="${r1(ly + fs * 0.3)}" text-anchor="${Math.sin((2 * Math.PI * i) / n) > 0.3 ? 'start' : Math.sin((2 * Math.PI * i) / n) < -0.3 ? 'end' : 'middle'}" font-size="${fs * 0.9}" fill="${FAINT}">${esc(l)}</text>`;
  });
  const g = easeOut(grow);
  t.series.forEach((se, i) => {
    const colour = paint(o, i, t.series.length, names, se.color), pts = se.values.map((v, j) => P(j, (R * Math.max(0, v) * g) / mx));
    s += `<path d="${pts.map((q, j) => `${j ? 'L' : 'M'}${q.map(r1).join(' ')}`).join('')}Z" fill="${colour}" fill-opacity="0.2" stroke="${colour}" stroke-width="1.8" stroke-linejoin="round"/>` + pts.map((q) => `<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="2.4" fill="${colour}"/>`).join('');
  });
  return s;
}
