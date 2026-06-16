/**
 * Worker-side message protocol for the light canvas worker player.
 *
 * Runs inside the Web Worker. It receives a transferred `OffscreenCanvas` plus
 * animation data, drives `lottie.loadAnimation` against the canvas 2D context,
 * and relays method calls / events over `postMessage`. Pair it with the
 * `LottieCanvasWorker` main-thread driver (canvas_light_worker_api.js).
 *
 * Animations are keyed by `id` so a single worker can host several canvases.
 */
export default function setupCanvasWorker(lottie) {
  if (typeof self === 'undefined' || typeof self.postMessage !== 'function') {
    return;
  }

  var animations = {};
  var subscriptions = {};

  function post(message) {
    self.postMessage(message);
  }

  function withAnimation(id, fn) {
    var entry = animations[id];
    if (entry) {
      fn(entry.animation, entry);
    }
  }

  function handleLoad(data) {
    var id = data.id;
    var canvas = data.canvas;
    var cfg = data.config || {};
    var animation = lottie.loadAnimation({
      renderer: 'canvas',
      loop: cfg.loop,
      autoplay: cfg.autoplay,
      animationData: data.animationData,
      rendererSettings: {
        context: canvas.getContext('2d'),
        clearCanvas: true,
      },
    });
    animations[id] = { animation: animation, canvas: canvas };
    if (cfg.speed !== undefined && cfg.speed !== null) {
      animation.setSpeed(cfg.speed);
    }
    if (cfg.direction !== undefined && cfg.direction !== null) {
      animation.setDirection(cfg.direction);
    }
    if (cfg.segment) {
      animation.playSegments(cfg.segment, true);
    }
    post({ type: 'ready', id: id });
  }

  var handlers = {
    load: handleLoad,
    play: function (d) {
      withAnimation(d.id, function (a) {
        a.play();
      });
    },
    pause: function (d) {
      withAnimation(d.id, function (a) {
        a.pause();
      });
    },
    stop: function (d) {
      withAnimation(d.id, function (a) {
        a.stop();
      });
    },
    setSpeed: function (d) {
      withAnimation(d.id, function (a) {
        a.setSpeed(d.speed);
      });
    },
    setDirection: function (d) {
      withAnimation(d.id, function (a) {
        a.setDirection(d.direction);
      });
    },
    setLoop: function (d) {
      withAnimation(d.id, function (a) {
        a.setLoop(d.loop);
      });
    },
    goToAndStop: function (d) {
      withAnimation(d.id, function (a) {
        a.goToAndStop(d.value, d.isFrame);
      });
    },
    goToAndPlay: function (d) {
      withAnimation(d.id, function (a) {
        a.goToAndPlay(d.value, d.isFrame);
      });
    },
    playSegments: function (d) {
      withAnimation(d.id, function (a) {
        a.playSegments(d.segments, d.forceFlag);
      });
    },
    setSubframe: function (d) {
      withAnimation(d.id, function (a) {
        a.setSubframe(d.useSubFrames);
      });
    },
    resize: function (d) {
      withAnimation(d.id, function (a, entry) {
        if (d.width) {
          entry.canvas.width = d.width;
        }
        if (d.height) {
          entry.canvas.height = d.height;
        }
        a.resize();
      });
    },
    subscribe: function (d) {
      withAnimation(d.id, function (a) {
        var subs = subscriptions[d.id] || (subscriptions[d.id] = {});
        if (subs[d.name]) {
          return;
        }
        var handler = function (args) {
          post({
            type: 'event',
            id: d.id,
            name: d.name,
            args: args,
          });
        };
        subs[d.name] = handler;
        a.addEventListener(d.name, handler);
      });
    },
    unsubscribe: function (d) {
      var subs = subscriptions[d.id];
      if (!subs || !subs[d.name]) {
        return;
      }
      withAnimation(d.id, function (a) {
        a.removeEventListener(d.name, subs[d.name]);
        delete subs[d.name];
      });
    },
    destroy: function (d) {
      withAnimation(d.id, function (a) {
        a.destroy();
      });
      delete animations[d.id];
      delete subscriptions[d.id];
      post({ type: 'destroyed', id: d.id });
    },
  };

  self.addEventListener('message', function (evt) {
    var data = evt.data;
    if (data && handlers[data.type]) {
      handlers[data.type](data);
    }
  });
}
