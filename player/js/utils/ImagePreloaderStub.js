// Minimal no-op ImagePreloader for builds that exclude image/footage layers
// (e.g. the Compositor-Safe Lottie Profile build). `AnimationItem` always
// constructs an ImagePreloader and gates playback on `loadedImages()` /
// `loadedFootages()`, so a CSLP build that aliases away `CVImageElement` still
// needs this surface — but none of the asset-loading machinery. Both gates
// report "loaded" immediately so playback never waits on absent assets.
function ImagePreloaderStub() {
  this.imagesLoadedCb = null;
}

function noop() {}

ImagePreloaderStub.prototype = {
  setCacheType: noop,
  setAssetsPath: noop,
  setPath: noop,
  loadAssets: function (assets, cb) { this.imagesLoadedCb = cb; },
  loadedImages: function () { return true; },
  loadedFootages: function () { return true; },
  getAsset: function () { return null; },
  destroy: function () { this.imagesLoadedCb = null; },
};

export default ImagePreloaderStub;
