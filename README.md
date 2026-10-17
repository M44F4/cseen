# cseen

Illustrations and animations for the web, in 2D and 3D, drawn as SVG that follows your CSS.

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

- **Colours come from your CSS.** Set up to three variables (ink, background, accent) and everything else, charts included, is derived. Light, dark or a theme you have not made yet.
- **One coordinate system for 2D and 3D.** A flat diagram is a scene seen from the front.
- **Static first, scrubbable.** A scene is a function of time, so playing, pausing, stepping and rendering one frame all work the same way.
- **Small and dependency free**, split into packs: devices, charts, flowcharts, waves, optics, maths.

## Example

The figure above, with the cseen mark as the SVG:

```ts
import { Scene, Timeline, ground, axes, plane, fadeIn, mount } from 'cseen';
import 'cseen/cseen.css';

const s = new Scene({ view: 'iso' });
s.add(ground({ extent: 3 }), axes({ at: [-2.75, -2.75, 0], length: 0.9 }));
const sheet = s.add(plane({
  svg: markSvgText,                 // any SVG: a logo, a chart, a screenshot
  size: [2.9, 4],
  at: [-1.45, -2, 0],
  u: [1, 0, 0], v: [0, 1, 0],       // lying on the ground
}));

const tl = new Timeline();
tl.play(fadeIn(sheet, 0.8));
tl.lockFit(s);

mount(document.querySelector('#figure')!, s, { timeline: tl });
```

Without a browser, `renderStill(s, tl)` returns a standalone `<svg>` string.

<table>
<tr>
<td width="50%">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/deploy-dark.svg">
  <img alt="A terminal, a cloud and a browser with a packet travelling between them" src="docs/img/deploy-light.svg">
</picture>
<br><sub><code>/devices</code>: a terminal, a cloud and a browser, with a packet in flight</sub>
</td>
<td width="50%">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/chart-dark.svg">
  <img alt="A bar chart of revenue by quarter for two years" src="docs/img/chart-light.svg">
</picture>
<br><sub><code>/charts</code>: a chart is a plane in the scene</sub>
</td>
</tr>
<tr>
<td width="50%">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/flow-dark.svg">
  <img alt="A flowchart that asks whether the user is signed in" src="docs/img/flow-light.svg">
</picture>
<br><sub><code>/flow</code>: automatic layout, edges trace on</sub>
</td>
<td width="50%">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/img/stereo-dark.svg">
  <img alt="A stereo rig: two cameras a baseline apart looking at one point" src="docs/img/stereo-light.svg">
</picture>
<br><sub><code>/optics</code>: depth from disparity</sub>
</td>
</tr>
</table>

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

## The name

cseen is a small pun: a **c** for CSS, since the colours of every figure come from your CSS, and *seen*, as in see the scene. You describe a scene, and it is seen.

## Licence

MIT. The docs site bundles three fonts under the SIL Open Font License 1.1: Orbitron, Instrument Sans and JetBrains Mono (see [`site/public/fonts/NOTICE.txt`](site/public/fonts/NOTICE.txt)). The library itself ships no fonts.
