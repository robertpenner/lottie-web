// Minimal no-op FontManager for builds that exclude text rendering (e.g. the
// Compositor-Safe Lottie Profile build). `BaseRenderer.setupGlobalData` always
// constructs a FontManager and calls `addChars`/`addFonts`, so a CSLP build
// that aliases away `CVTextElement` still needs a constructor with that surface
// — but none of the heavy font measurement / glyph machinery. `isLoaded` is
// true up front so playback never waits on font loading.
function FontManagerStub() {
  this.fonts = [];
  this.chars = null;
  this.typekitLoaded = 0;
  this.isLoaded = true;
  this.initTime = Date.now();
}

function noop() {}

FontManagerStub.prototype = {
  addChars: noop,
  addFonts: noop,
  getCharData: function () { return null; },
  getFontByName: function () { return null; },
  measureText: function () { return 0; },
  checkLoadedFonts: noop,
  setIsLoaded: function () { this.isLoaded = true; },
};

export default FontManagerStub;
