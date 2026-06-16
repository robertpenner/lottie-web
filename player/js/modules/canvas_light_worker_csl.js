// Compositor-Safe Lottie (CSL) worker player. Same wiring as the
// no-modifiers worker entry, but the build that consumes this entry also
// aliases away text/image elements and the font manager (see the `csl` build
// flag in rollup.config.js). The result renders the CSL subset only —
// transform/opacity animation over static shape/solid content — and drops the
// text, font, image and shape-modifier code paths entirely.
import '../worker_dom_shim';
import lottie from './canvas_light_nomod';
import setupCanvasWorker from '../worker_canvas_bootstrap';

setupCanvasWorker(lottie);

export default lottie;
