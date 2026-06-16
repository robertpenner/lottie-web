// Minimal stand-in for SVGRenderer, used only so `CanvasRendererBase` can
// borrow `createNull` without dragging in the entire SVG element tree
// (SVGCompElement -> SVGShapeElement/SVGTextElement/... -> TextProperty ->
// FontManager). Canvas builds never render via SVG; they only reuse this one
// method. Aliasing `./SVGRenderer` to this stub in the CSL build drops the
// whole SVG element tree and the text/font code it transitively imports.
import NullElement from '../elements/NullElement';

function SVGRendererCreateNullOnly() {}

SVGRendererCreateNullOnly.prototype.createNull = function (data) {
  return new NullElement(data, this.globalData, this);
};

export default SVGRendererCreateNullOnly;
