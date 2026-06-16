// Minimal no-op audio controller factory for builds that exclude audio (e.g.
// the Compositor-Safe Lottie (CSL) build). `AnimationItem` always constructs an
// audio controller and forwards mute/volume/rate/pause calls to it, so a CSL
// build that aliases away `AudioElement` still needs a controller with that
// surface — but none of the Howler / playback machinery. Volume state is kept
// so `getVolume` round-trips, but nothing is ever played.
const audioControllerStubFactory = (function () {
  function AudioControllerStub() {
    this._volume = 1;
  }

  function noop() {}

  AudioControllerStub.prototype = {
    addAudio: noop,
    pause: noop,
    resume: noop,
    setRate: noop,
    setAudioFactory: noop,
    mute: noop,
    unmute: noop,
    setVolume: function (value) { this._volume = value; },
    getVolume: function () { return this._volume; },
  };

  return function () {
    return new AudioControllerStub();
  };
}());

export default audioControllerStubFactory;
