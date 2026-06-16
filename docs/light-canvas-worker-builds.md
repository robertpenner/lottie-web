# Light Canvas Worker Builds (fork additions)

This fork adds a family of size-optimized, off-main-thread canvas players on top
of upstream lottie-web. They render Lottie on an `OffscreenCanvas` inside a Web
Worker and progressively drop feature code that falls outside a constrained
rendering subset.

The end of the line is the **Compositor-Safe Lottie (CSL)** build: a canvas-only
worker player that renders transform/opacity animation over static shape and
solid content, and drops text, fonts, images, footage, and shape modifiers
entirely.

## Build matrix

All three are UMD worker bundles emitted to `build/player/` (`worker: true`,
`treeshake: false`). Sizes are gzip-9 of the bundle including the worker
bootstrap.

| Bundle                                    | Entry module                   | Drops                                                | gzip           |
| ----------------------------------------- | ------------------------------ | ---------------------------------------------------- | -------------- |
| `lottie_light_canvas_worker.min.js`       | `canvas_light_worker.js`       | — (baseline)                                         | 54.9 KB        |
| `lottie_light_canvas_worker_nomod.min.js` | `canvas_light_worker_nomod.js` | shape modifiers                                      | 49.3 KB (−10%) |
| `lottie_light_canvas_worker_csl.min.js`   | `canvas_light_worker_csl.js`   | modifiers + text + fonts + images + SVG element tree | 36.3 KB (−34%) |

All three already exclude expressions (they descend from the `*_light` family).

## Layering

Each tier reuses the one below it; only the entry module and (for CSL) a set of
build-time aliases change.

```
canvas_light.js                 full light canvas player (expressions excluded)
  └─ canvas_light_nomod.js       same, minus shape modifiers
       └─ canvas_light_worker_nomod.js   nomod + worker DOM shim + worker bootstrap
            └─ canvas_light_worker_csl.js   identical wiring; CSL drops happen at build time
```

`canvas_light_worker_csl.js` is wired **identically** to the nomod worker entry
(DOM shim → `canvas_light_nomod` → `setupCanvasWorker`). It does not import
anything special. The text/font/image/SVG code is removed by the build that
consumes it, via module aliasing — see below.

## Two carve-out mechanisms

### 1. Entry omission (shape modifiers)

Shape modifiers (`trim` / `repeater` / `offset-path` / `zigzag` / `pucker` /
`round-corners`) are imported **only** by `canvas_light.js`. So
`canvas_light_nomod.js` is just `canvas_light.js` with those imports removed:

```js
import lottie from './main';
import CanvasRenderer from '../renderers/CanvasRenderer';
import { registerRenderer } from '../renderers/renderersManager';

registerRenderer('canvas', CanvasRenderer);
export default lottie;
```

Because nothing else reaches the modifier modules, omitting them at the entry
keeps them out of the bundle even though tree-shaking is disabled. No edits to
shared runtime source.

### 2. Build-time module aliasing (text / fonts / images / SVG tree)

The remaining feature code can't be dropped by entry omission, because the
canvas renderer base hard-imports it at module top. In particular,
`CanvasRendererBase` imports the **entire `SVGRenderer`** just to borrow
`SVGRenderer.prototype.createNull`, which transitively drags in the whole SVG
element tree (`SVGCompElement → SVGTextElement → TextProperty → FontManager`,
~98 KB raw). That is why text and font code rides along even in canvas-only
builds.

To cut it out without touching shared source, the CSL build registers an inline
rollup plugin (`aliasModules`) that rewrites a handful of import specifiers to
no-op or minimal stand-ins. This is the same idea as upstream's existing
`*WorkerOverride` files, but kept entirely inside the build config and scoped to
one build via a `csl: true` flag.

```js
const cslAliases = [
  ['/SVGRenderer', 'player/js/renderers/SVGRendererCreateNullOnly.js'],
  ['canvasElements/CVTextElement', 'player/js/elements/NullElement.js'],
  ['canvasElements/CVImageElement', 'player/js/elements/NullElement.js'],
  ['utils/FontManager', 'player/js/utils/FontManagerStub.js'],
  ['utils/imagePreloader', 'player/js/utils/ImagePreloaderStub.js'],
];
```

`aliasModules` is prepended to the plugin list (it must run **before**
`nodeResolve`) only when `build.csl` is set:

```js
const selectPlugins = build => {
  let selected = build.worker
    ? build.skipTerser
      ? workerPlugins
      : workerPluginsWithTerser
    : build.skipTerser
      ? plugins
      : pluginsWithTerser;
  if (build.csl) {
    return [aliasModules(cslAliases), ...selected]; // alias before nodeResolve
  }
  return selected;
};
```

The single highest-impact alias is `/SVGRenderer → SVGRendererCreateNullOnly`.
Without it, aliasing only the canvas text/image elements and the font manager
saves almost nothing, because the SVG tree (and its text/font deps) is still
pulled in for `createNull`.

## Alias targets

| Aliased module                  | Replacement                    | Why it's safe                                                                                                                                                                                   |
| ------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./SVGRenderer`                 | `SVGRendererCreateNullOnly.js` | Canvas builds use `SVGRenderer` only for `createNull`. The stub provides just that one method (returning a `NullElement`); aliasing it drops the whole SVG element tree and its text/font deps. |
| `canvasElements/CVTextElement`  | `NullElement.js`               | Text layers (`ty: 5`) are out of scope. `NullElement` is a graceful no-op with the full element lifecycle, and its deps are already in every build, so it costs **zero added bytes**.           |
| `canvasElements/CVImageElement` | `NullElement.js`               | Image layers (`ty: 2`) are out of scope; same no-op substitution.                                                                                                                               |
| `utils/FontManager`             | `FontManagerStub.js`           | `BaseRenderer.setupGlobalData` always constructs a FontManager and calls `addChars`/`addFonts`; the stub supplies that surface with `isLoaded = true` and no glyph/measurement machinery.       |
| `utils/imagePreloader`          | `ImagePreloaderStub.js`        | `AnimationItem` always constructs an ImagePreloader and gates playback on `loadedImages()`/`loadedFootages()`; the stub returns `true` immediately so playback never waits on absent assets.    |

### Why `NullElement` is the ideal stub

`player/js/elements/NullElement.js` already renders nothing while exposing the
full element lifecycle (`prepareFrame` / `renderFrame` / `getBaseElement` /
`destroy` / `sourceRectAtTime` / `hide`), and all of its dependencies
(`BaseElement`, `TransformElement`, `HierarchyElement`, `FrameElement`) are
present in every canvas build. Aliasing the text/image elements to it removes
their code without adding any.

> Do **not** reuse upstream's `FontManagerWorkerOverride.js` or
> `imagePreloaderWorkerOverride.js` as drop-ins — both are incomplete stubs
> (missing methods the runtime calls) and will throw. The `*Stub.js` files in
> this fork implement the full reachable surface.

## Runtime behavior of out-of-scope content

The CSL build does not validate input; it degrades gracefully:

- **Text layers** render as nothing (aliased to `NullElement`). Playback
  continues; no crash.
- **Image / footage layers** render as nothing; the stub preloader reports
  "loaded" so the play gate never blocks.
- **Shape modifiers**, if present in the JSON, are simply not registered, so the
  affected shapes render unmodified.

Smoke-tested in the worker demo against `bouncyCar` (shapes + strokes, renders
perfectly) and `twoBirdsSittingInATree` (shapes + gradient fills render; the
animated text layer is gracefully absent).

## Building

```bash
npx rollup -c
```

This emits all bundles, including `build/player/lottie_light_canvas_worker_csl.min.js`.
(`npm run build` additionally runs eslint and the worker task.)

## New / changed files in this fork

| File                                               | Role                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `player/js/modules/canvas_light_nomod.js`          | Light canvas entry minus shape modifiers                                               |
| `player/js/modules/canvas_light_worker_nomod.js`   | Worker wiring over the nomod entry                                                     |
| `player/js/modules/canvas_light_worker_csl.js`     | Worker entry consumed by the CSL build                                                 |
| `player/js/renderers/SVGRendererCreateNullOnly.js` | `createNull`-only stand-in for `SVGRenderer`                                           |
| `player/js/utils/FontManagerStub.js`               | No-op FontManager                                                                      |
| `player/js/utils/ImagePreloaderStub.js`            | No-op ImagePreloader                                                                   |
| `rollup.config.js`                                 | `aliasModules` plugin, `cslAliases`, `csl`/nomod build entries, `selectPlugins` wiring |

## Future direction (not implemented)

The build-time aliasing is a pragmatic carve-out that avoids editing shared
source. The clean long-term version is a **registry refactor**: make
`CanvasRendererBase` / `BaseRenderer.createItem` element creation pluggable (the
way `ShapeModifiers.registerModifier` already is) and enable tree-shaking, so a
named CSL build becomes opt-in without any aliasing.
