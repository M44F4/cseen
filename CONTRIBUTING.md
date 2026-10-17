# Contributing

Thanks for looking. cseen is early and the API still moves, so for anything larger than a fix, open an issue first and describe the figure you want to draw.

## Set up

```bash
npm install
npm test             # unit tests for the core, layering and every pack
npm run typecheck
npm run build        # compiles to dist/
```

Node 22.18 or newer runs the TypeScript sources and tests directly. The docs site has its own `package.json`:

```bash
npm --prefix site install
npm run docs:dev     # live site at http://localhost:4321/cseen/
npm run docs:api     # exports and options that still have no description
```

## Where things go

The core draws, sorts, animates and mounts; everything else is a pack that depends only on the core, never on another pack. A test fails on a sideways import. Physical objects are `devices`, things that live on a screen are `ui`, numbers turned into pictures are `charts`.

## What a change needs

- A test. Layering, edge cases and every example in the docs are tested; follow the nearest test file.
- A TSDoc comment on every new export and option. The API reference is generated from them.
- No runtime dependencies in the library.
- Comments in the style of the surrounding code: say why, briefly.
- If a figure in the README changed, run `npm run readme:art` and commit `docs/img/`. CI redraws them and fails on a difference.

## Commits and pull requests

One change per pull request, with a message that says what changed and why. Run `npm test` and `npm run typecheck` before you push.

## Licence

By contributing you agree that your work is released under the MIT licence of this repository.
