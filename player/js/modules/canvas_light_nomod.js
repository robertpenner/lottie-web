// Light canvas player WITHOUT shape modifiers (trim/repeater/offset-path/
// zigzag/pucker/round-corners). Shape modifiers are out of the
// Compositor-Safe Lottie (CSL) subset (static content only), so a CSL-targeted
// build can drop their code entirely. Because the modifiers are imported only
// by `canvas_light.js`, omitting them here keeps them out of the bundle even
// with tree-shaking disabled.
import lottie from './main';
import CanvasRenderer from '../renderers/CanvasRenderer';
import {
  registerRenderer,
} from '../renderers/renderersManager';

// Registering renderers
registerRenderer('canvas', CanvasRenderer);

export default lottie;
