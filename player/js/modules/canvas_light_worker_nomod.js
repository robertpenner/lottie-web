// Light canvas player (no shape modifiers), prepared to run inside a Web Worker
// rendering to a transferred OffscreenCanvas. The DOM shim is imported first so
// it is installed before any renderer module-init code runs (ES import order).
import '../worker_dom_shim';
import lottie from './canvas_light_nomod';
import setupCanvasWorker from '../worker_canvas_bootstrap';

// Install the message protocol so a `LottieCanvasWorker` main-thread driver can
// drive this player over postMessage (load / play / events / etc.).
setupCanvasWorker(lottie);

export default lottie;
