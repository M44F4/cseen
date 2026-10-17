# cseen

Describe a scene in TypeScript and get SVG that follows your CSS theme, rendered on the server or played live in the browser.

<p align="center">
  <a href="https://m44f4.github.io/cseen/"><img alt="Website" src="https://img.shields.io/badge/Website-064E3B?style=for-the-badge&logoColor=white"></a>
  <a href="https://m44f4.github.io/cseen/docs/"><img alt="Docs" src="https://img.shields.io/badge/Docs-064E3B?style=for-the-badge"></a>
  <a href="https://m44f4.github.io/cseen/gallery/core/"><img alt="Gallery" src="https://img.shields.io/badge/Gallery-064E3B?style=for-the-badge"></a>
  <a href="https://m44f4.github.io/cseen/playground/"><img alt="Playground" src="https://img.shields.io/badge/Playground-C4A052?style=for-the-badge"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cseen"><img alt="npm version" src="https://img.shields.io/npm/v/cseen"></a>
  <a href="LICENSE"><img alt="licence: MIT" src="https://img.shields.io/badge/licence-MIT-blue.svg"></a>
</p>

<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/hero-dark.svg">
  <img alt="The cseen mark laid on a plane, seen from an isometric camera" src="docs/img/hero-light.svg" width="640">
</picture>
</p>

cseen is for the figure in an article, a portfolio or documentation. You describe a scene in a few lines of TypeScript, animate it on a timeline, and put it on a page. The same scene renders to a plain SVG on the server and plays live in the browser.

The name is meant to be said aloud: the **c** is *see*, and *seen* sounds like *scene*, so **cseen** says **see scene**. Rearrange its letters and you get **scene** itself. You describe a scene, and you see it.

## What it does

- **Colours come from your CSS.** Set up to three variables (ink, background, accent) and everything else, charts included, is derived. Light, dark or a theme you have not made yet.
- **One coordinate system for 2D and 3D.** A flat diagram is a scene seen from the front.
- **Static first, scrubbable.** A scene is a function of time, so playing, pausing, stepping and rendering one frame all work the same way.
- **Small and dependency free**, split into packs: devices, charts, flowcharts, waves, optics, maths.
- **Not a 3D engine.** The output is SVG, so it suits figures and diagrams, not games, textured meshes or scenes with thousands of objects.

## Example

A terminal, a cloud and a browser, with a packet that travels from one to the other (the first figure below). This runs as pasted:

```ts
import { Scene, Timeline, ground, dot, typeOn, moveTo, fadeIn, mount } from 'cseen';
import { terminal, cloud, browser } from 'cseen/devices';
import 'cseen/cseen.css';

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
tl.play(moveTo(packet, [-0.9, 2.2, 2.4], 1.3));
tl.play(moveTo(packet, [3.2, 0.9, 1.2], 1.3));
tl.play(fadeIn(hello, 0.8));
tl.lockFit(s);

mount(document.querySelector('#figure')!, s, { timeline: tl });
```

Without a browser, `renderStill(s, tl)` returns a standalone `<svg>` string.

## The packs

Each pack adds ready-made parts. A chart or a flowchart is one call, and it takes its colours from the same three CSS variables:

```ts
import { bars } from 'cseen/charts';
import { flowchart } from 'cseen/flow';

s.add(bars({
  data: { 2023: [12, 19, 7, 15], 2024: [14, 22, 11, 19] },
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  title: 'Revenue', size: [4.4, 2.8],
}));

s.add(flowchart([
  { label: 'start', kind: 'start' },
  { label: 'signed in?', kind: 'decision', to: [['home', 'yes'], ['sign in', 'no']] },
  { label: 'sign in', to: ['signed in?'] },
  { label: 'home', kind: 'end' },
]));
```

The figures below are drawn with these packs.

<div align="center">
<table>
<tr>
<td width="50%" align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/deploy-dark.svg">
  <img alt="A terminal, a cloud and a browser with a packet travelling between them" src="docs/img/deploy-light.svg">
</picture>
<br><sub><code>/devices</code>: a terminal, a cloud and a browser, with a packet in flight</sub>
</td>
<td width="50%" align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/chart-dark.svg">
  <img alt="A bar chart of revenue by quarter for two years" src="docs/img/chart-light.svg">
</picture>
<br><sub><code>/charts</code>: a chart is a plane in the scene</sub>
</td>
</tr>
<tr>
<td width="50%" align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/flow-dark.svg">
  <img alt="A flowchart that asks whether the user is signed in" src="docs/img/flow-light.svg">
</picture>
<br><sub><code>/flow</code>: automatic layout, edges trace on</sub>
</td>
<td width="50%" align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/stereo-dark.svg">
  <img alt="A stereo rig: two cameras a baseline apart looking at one point" src="docs/img/stereo-light.svg">
</picture>
<br><sub><code>/optics</code>: depth from disparity</sub>
</td>
</tr>
</table>
</div>

## Playground

The [playground](https://m44f4.github.io/cseen/playground/) lets you try cseen without installing anything. Pick any example from the list, or write your own scene in TypeScript, then run it with the button or Ctrl/Cmd+Enter. Drag the figure to turn it, and play or scrub its timeline. "Copy link" puts your code in the URL, so a link is a complete example you can send to someone.

## Install

```bash
npm install cseen
```

The API may still change before 1.0. There are no runtime dependencies.

## Documentation

The docs site is at **<https://m44f4.github.io/cseen/>**, and its source lives in [`site/`](site/): written guides, a gallery where every figure opens in a window you can turn, edit and read the code of, an editable playground, and an API reference generated from the source. It runs against the current source:

```bash
npm --prefix site install
npm run docs:dev     # http://localhost:4321/cseen/
```

## Develop

```bash
npm test
npm run typecheck
npm run build
npm run readme:art   # redraws the figures of this README into docs/img/
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT. The docs site bundles three fonts under the SIL Open Font License 1.1: Orbitron, Instrument Sans and JetBrains Mono (see [`site/public/fonts/NOTICE.txt`](site/public/fonts/NOTICE.txt)). The library itself ships no fonts.
