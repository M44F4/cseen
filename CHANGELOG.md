# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/), and the project will follow [Semantic Versioning](https://semver.org/) once it reaches 1.0.

## 0.1.0 - 2026-10-15

First public version.

- Core: scenes, parallel and perspective cameras, exact depth ordering, and cutting of faces that pierce each other (off by default, turn it on with `new Scene({ split: true })`)
- Shapes, text and code on planes, SVG on planes, a pen, arrows and pulses
- Animation: timeline with chapters, tweens, orbit controls, `mount` and `renderStill`
- Packs: `devices`, `ui`, `charts`, `waves`, `optics`, `math`, `flow` (layered, tree and force layouts, flowcharts, trees, sequence diagrams)
- Theming from up to three CSS variables
- Docs site with gallery, playground, guides and a generated API reference
- Playground security: the visitor's code runs in a sandboxed iframe (`sandbox="allow-scripts"`, opaque origin, a policy that closes the network), not on the site's page; code from a share link is shown but runs only when Run is pressed; a frame that stops answering is replaced; share links over 200 KB are refused
