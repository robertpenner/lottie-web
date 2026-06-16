// Light canvas player, prepared to run inside a Web Worker rendering to a
// transferred OffscreenCanvas. The DOM shim is imported first so it is
// installed before any renderer module-init code runs (ES import order).
import '../worker_dom_shim';
import lottie from './canvas_light';

export default lottie;
