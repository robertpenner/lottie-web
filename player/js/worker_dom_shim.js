/**
 * Minimal DOM shim that lets the light canvas player run inside a Web Worker.
 *
 * Two spots in the canvas renderer assume a DOM:
 *   1. CanvasRendererBase always calls `setupGlobalData(animData, document.body)`.
 *   2. FontManager reaches for `document` to measure text.
 *
 * FontManager already has a no-DOM path: whenever `document.body` is falsy it
 * measures glyphs with an `OffscreenCanvas` 2D context instead of appending
 * elements. So the worker only needs `document` to *exist* (with a falsy
 * `body`), plus a `window` for the `devicePixelRatio` lookup. Importing this
 * module first installs that shim before any renderer module-init code runs.
 *
 * This is intentionally tiny — it is the OffscreenCanvas-transfer alternative to
 * lottie-web's heavyweight `worker_wrapper` proxy-DOM machinery. Pair it with a
 * canvas renderer pointed at `rendererSettings.context` (an OffscreenCanvas 2D
 * context) and no `container`.
 */
(function installWorkerDomShim() {
  if (typeof self === 'undefined') {
    return;
  }
  if (typeof self.window === 'undefined') {
    self.window = self;
  }
  if (typeof self.document === 'undefined') {
    self.document = {
      // Falsy on purpose: routes FontManager to its OffscreenCanvas path.
      body: null,
      createElement: function createElement(tag) {
        return tag === 'canvas' ? new OffscreenCanvas(1, 1) : {};
      },
      createElementNS: function createElementNS() {
        return {};
      },
      querySelectorAll: function querySelectorAll() {
        return [];
      },
      getElementsByTagName: function getElementsByTagName() {
        return [];
      },
    };
  }
}());
