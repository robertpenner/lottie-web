/**
 * `LottieCanvasWorker` — streamlined main-thread driver for the light canvas
 * worker player.
 *
 * It transfers control of a canvas to an `OffscreenCanvas`, spins up the
 * worker (canvas_light_worker.js), loads the animation off the main thread, and
 * exposes a small dotLottie-style API:
 *
 *   import { LottieCanvasWorker } from 'lottie-web/light-canvas-worker';
 *
 *   const animation = new LottieCanvasWorker({
 *     canvas: document.getElementById('canvas'),
 *     src: 'url/to/animation.json',
 *     autoplay: true,
 *     loop: true,
 *   });
 *
 * Pass `workerUrl` to point at a self-hosted worker bundle when the default
 * sibling-file resolution does not fit your bundler/CSP setup.
 */

var instanceCounter = 0;

function fetchAnimationData(src) {
  return fetch(src).then(function (response) {
    if (!response.ok) {
      throw new Error(
        'LottieCanvasWorker: failed to load "'
          + src
          + '" ('
          + response.status
          + ')'
      );
    }
    return response.json();
  });
}

function resolveWorkerUrl(workerUrl) {
  if (workerUrl) {
    return workerUrl;
  }
  // Resolved at runtime relative to this module, so the worker bundle is picked
  // up as a sibling file (and detected by Vite/webpack for auto-bundling).
  return new URL('./lottie_light_canvas_worker.js', import.meta.url);
}

function LottieCanvasWorker(config) {
  if (!config || !config.canvas) {
    throw new Error('LottieCanvasWorker: a `canvas` element is required.');
  }
  if (typeof config.canvas.transferControlToOffscreen !== 'function') {
    throw new Error(
      'LottieCanvasWorker: OffscreenCanvas is not supported in this environment.'
    );
  }
  instanceCounter += 1;
  this._id = instanceCounter;
  this._listeners = {};
  this._ready = false;
  this._destroyed = false;
  this._queue = [];
  this._init(config);
}

LottieCanvasWorker.prototype = {
  _init: function (config) {
    var self = this;
    var offscreen = config.canvas.transferControlToOffscreen();
    var worker = new Worker(resolveWorkerUrl(config.workerUrl));
    this._worker = worker;
    worker.addEventListener('message', function (evt) {
      self._onMessage(evt.data);
    });

    var loadConfig = {
      loop: config.loop !== undefined ? config.loop : false,
      autoplay: config.autoplay !== undefined ? config.autoplay : true,
      speed: config.speed,
      direction: config.direction,
      segment: config.segment,
    };

    var dataPromise = config.animationData
      ? Promise.resolve(config.animationData)
      : fetchAnimationData(config.src);

    dataPromise
      .then(function (animationData) {
        if (self._destroyed) {
          return;
        }
        worker.postMessage(
          {
            type: 'load',
            id: self._id,
            canvas: offscreen,
            animationData: animationData,
            config: loadConfig,
          },
          [offscreen]
        );
        self._ready = true;
        self._flushQueue();
      })
      .catch(function (error) {
        self._emit('error', error);
      });
  },

  _post: function (message) {
    if (this._destroyed) {
      return;
    }
    message.id = this._id;
    if (this._ready) {
      this._worker.postMessage(message);
    } else {
      this._queue.push(message);
    }
  },

  _flushQueue: function () {
    var queue = this._queue;
    this._queue = [];
    for (var i = 0; i < queue.length; i += 1) {
      this._worker.postMessage(queue[i]);
    }
  },

  _onMessage: function (data) {
    if (!data) {
      return;
    }
    if (data.type === 'event') {
      this._emit(data.name, data.args);
    } else if (data.type === 'ready') {
      this._emit('load');
    } else if (data.type === 'destroyed') {
      this._teardown();
    }
  },

  _emit: function (name, args) {
    var listeners = this._listeners[name];
    if (!listeners) {
      return;
    }
    var copy = listeners.slice();
    for (var i = 0; i < copy.length; i += 1) {
      copy[i](args);
    }
  },

  addEventListener: function (name, callback) {
    var listeners = this._listeners[name] || (this._listeners[name] = []);
    var isFirst = listeners.length === 0;
    listeners.push(callback);
    // `load` and `error` are emitted locally, so they need no worker subscription.
    if (isFirst && name !== 'load' && name !== 'error') {
      this._post({ type: 'subscribe', name: name });
    }
    var self = this;
    return function () {
      self.removeEventListener(name, callback);
    };
  },

  removeEventListener: function (name, callback) {
    var listeners = this._listeners[name];
    if (!listeners) {
      return;
    }
    if (!callback) {
      delete this._listeners[name];
    } else {
      var index = listeners.indexOf(callback);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
      if (listeners.length === 0) {
        delete this._listeners[name];
      }
    }
    if (!this._listeners[name] && name !== 'load' && name !== 'error') {
      this._post({ type: 'unsubscribe', name: name });
    }
  },

  play: function () {
    this._post({ type: 'play' });
  },
  pause: function () {
    this._post({ type: 'pause' });
  },
  stop: function () {
    this._post({ type: 'stop' });
  },
  setSpeed: function (speed) {
    this._post({ type: 'setSpeed', speed: speed });
  },
  setDirection: function (direction) {
    this._post({ type: 'setDirection', direction: direction });
  },
  setLoop: function (loop) {
    this._post({ type: 'setLoop', loop: loop });
  },
  goToAndStop: function (value, isFrame) {
    this._post({ type: 'goToAndStop', value: value, isFrame: isFrame });
  },
  goToAndPlay: function (value, isFrame) {
    this._post({ type: 'goToAndPlay', value: value, isFrame: isFrame });
  },
  playSegments: function (segments, forceFlag) {
    this._post({
      type: 'playSegments',
      segments: segments,
      forceFlag: forceFlag,
    });
  },
  setSubframe: function (useSubFrames) {
    this._post({ type: 'setSubframe', useSubFrames: useSubFrames });
  },
  resize: function (width, height) {
    this._post({ type: 'resize', width: width, height: height });
  },

  destroy: function () {
    if (this._destroyed) {
      return;
    }
    this._post({ type: 'destroy' });
  },

  _teardown: function () {
    this._destroyed = true;
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._listeners = {};
    this._queue = [];
  },
};

export { LottieCanvasWorker };
export default LottieCanvasWorker;
