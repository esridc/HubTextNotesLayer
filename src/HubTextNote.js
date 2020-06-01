import * as geometryEngine from 'esri/geometry/geometryEngine';
import * as Point from 'esri/geometry/Point';
import { getFontSettings } from './fonts';

// CSS classes added to text note elements to indicate hover and select states
const NOTE_HOVER_CLASS = 'note-hover';
const NOTE_SELECT_CLASS = 'note-select';

// CSS applied to each text note element
const NOTE_STYLE = `
  position: absolute; /* position notes relative to map container */
  -webkit-user-select: auto; /* mobile safari needs this for contenteditable to work properly */
`;

// Instances of HubTextNote manage an individual text note attached to a graphic, including handling text input
// and positioning (sometimes dynamically updated as the view changes) relative to the "anchor" graphic.
export default class HubTextNote {

  // NOTE: this is a workaround to allow these modules to be externally loaded in tests
  static Point = Point;
  static geometryEngine = geometryEngine;

  constructor ({ id, editable = false, graphic, text = '', textPlaceholder = '', textClass, placementHint, onNoteEvent }) {
    Object.assign(this, { id, editable, graphic, text, textPlaceholder, textClass, placementHint });
    this.onNoteEvent = typeof onNoteEvent === 'function' ? onNoteEvent : function(){}; // provide an empty callback as fallback
    this.anchor = null; // a point on the graphic that the text note is positioned relative to
    this.mapPoint = null; // the current computed map point for the text note element
  }

  destroy () {
    if (this.textElement) {
      this.textElement.parentElement.removeChild(this.textElement);
    }
    // TODO: destroy event listeners
  }

  focus () {
    if (this.textElement) {
      this.textElement.focus();
    }
  }

  focused () {
    return this.textElement === document.activeElement;
  }

  hovered () {
    return this.textElement && this.textElement.classList.contains(NOTE_HOVER_CLASS);
  }

  selected () {
    return this.textElement && this.textElement.classList.contains(NOTE_SELECT_CLASS);
  }

  hidden () {
    return this.textElement && parseFloat(this.textElement.style.opacity) === 0;
  }

  setVisibility (state) {
    if (this.textElement) {
      // TODO: consider allowing user-specified CSS class, might keep occluded notes visible but faded (e.g. opacity 50%)
      this.textElement.style.opacity = state ? 1 : 0;
      this.textElement.style.pointerEvents = state ? 'auto' : 'none';
    }
  }

  setHover (state) {
    if (this.textElement) {
      const hovered = this.hovered();
      if (state) {
        this.textElement.classList.add(NOTE_HOVER_CLASS);
      } else {
        this.textElement.classList.remove(NOTE_HOVER_CLASS);
      }

      if (state !== hovered) {
        this.onNoteEvent('hover', this, { type: 'hover' });
      }
    }
  }

  setSelect (state) {
    const selected = this.selected();
    if (this.textElement) {
      if (state) {
        this.textElement.classList.add(NOTE_SELECT_CLASS);
      } else {
        this.textElement.classList.remove(NOTE_SELECT_CLASS);
      }

      if (state !== selected) {
        this.onNoteEvent('select', this, { type: 'select' });
      }
    }
  }

  createTextElement (view) {
    // setup note element
    this.textElement = document.createElement('div');
    this.textElement.contentEditable = this.editable;
    this.textElement.innerText = this.text;
    this.textElement.setAttribute('data-placeholder', this.textPlaceholder);
    this.textElement.tabIndex = 1;
    if (this.textClass) {
      this.textElement.classList.add(this.textClass); // apply user-supplied style
    }
    this.textElement.style = NOTE_STYLE; // apply non-visual properties

    this.textElement.addEventListener('input', event => {
      // exit edit mode when a user hits enter
      if ((event.inputType === 'insertText' || event.inputType === 'insertParagraph') && event.data == null) {
        this.textElement.innerText = this.text; // revert to text before line break
        this.textElement.blur();
      }

      this.text = this.textElement.innerText; // update current text
      this.updatePosition(view);
      this.onNoteEvent('update-text', this, event);
    });

    // we don't want these events interfering with the underlying map view
    ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click'].forEach(type => {
      this.textElement.addEventListener(type, e => e.stopPropagation());
    });

    this.textElement.addEventListener('pointermove', (event) => {
      if (this.selected() || this.hovered()) {
        event.stopPropagation();
      }
    });

    this.textElement.addEventListener('focus', (event) => {
      if (this.hidden()) {
        event.stopPropagation();
        this.textElement.blur();
      } else {
        this.onNoteEvent('focus', this, event);
      }
    });

    this.textElement.addEventListener('blur', (event) => {
      // update position and empty check on blur
      this.empty = (!this.textElement.innerText || this.textElement.innerText.length === 0);
      this.setHover(false);
      this.updatePosition(view);
      this.onNoteEvent('blur', this, event);
    });

    view.surface.appendChild(this.textElement); // add to view DOM
    this.updatePosition(view);
  }

  // Update text note position in world space and screenspace
  updatePosition (view) {
    this.updateMapPoint(view);
    this.updateTextElement(view);
  }

  // Update position of the HTML div in screenspace
  updateTextElement (view) {
    if (!view.ready) return;
    const point = view.toScreen(this.mapPoint);

    point.x -= this.textElement.offsetWidth / 2;
    point.y -= this.textElement.offsetHeight / 2;
    point.x = Math.round(point.x);
    point.y = Math.round(point.y);

    this.textElement.style.left = `${point.x}px`;
    this.textElement.style.top = `${point.y}px`;
  }

  // Re-compute the position of the text note on the map, relative to its graphic
  updateMapPoint (view) {
    if (this.initialZoom == null) {
      this.initialZoom = view.zoom;
    }

    let point;
    if (this.graphic.geometry.type === 'point') {
      point = this.placePointNote(view);
    } else if (this.graphic.geometry.type === 'polyline') {
      point = this.placeLineNote(view);
    } else if (this.graphic.geometry.type === 'polygon') {
      point = this.placePolygonNote(view);
    }

    this.mapPoint = new HubTextNote.Point({
      spatialReference: this.graphic.geometry.spatialReference,
      x: point.x,
      y: point.y
    });
  }

  placePointNote (view) {
    if (!this.anchor) { // find placement anchor if this is the first time placing the note
      this.anchor = this.graphic.geometry.clone();
      this.buffer = 3; // space in pixels between marker and note
    }

    const graphicHeight = pt2px(
      this.graphic.symbol.type === 'picture-marker'
        ? this.graphic.symbol.height // height from picture marker
        : (this.graphic.symbol.size + this.graphic.symbol.outline.width) // height from simple marker
    );
    const elementHeight = this.textElement.offsetHeight; // height of text element
    const pixelDist = (graphicHeight + elementHeight) / 2 - this.graphic.symbol.yoffset + this.buffer;
    const textScreenPoint = view.toScreen(this.anchor);
    const textPoint = view.toMap({
      x: textScreenPoint.x,
      y: textScreenPoint.y + pixelDist
    });
    return textPoint;
  }

  placeLineNote (view) {
    if (!this.anchor) { // find placement anchor and vector if this is the first time placing the note
      const line = this.graphic.geometry;
      let nearPoint = this.placementHint;

      // if no "hint" location for note placement was provided, choose one based on geometry
      if (!nearPoint) {
        // use a simple average of the line's vertices as center (JSAPI doesn't have a line centerpoint out of the box)
        const centerCoords = line.paths[0]
          .reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0])
          .map(p => p / line.paths[0].length);

        const center = HubTextNote.Point({
          type: 'point',
          spatialReference: line.spatialReference,
          x: centerCoords[0],
          y: centerCoords[1]
        });
        this.anchor = HubTextNote.geometryEngine.nearestCoordinate(line, center).coordinate;

        // derive normal perpendicular to line from first to last point
        const first = line.paths[0][0];
        const last = line.paths[0][line.paths[0].length - 1];
        this.vector = normalize([
          -(last[1] - first[1]),
          last[0] - first[0]
        ]);
      } else {
        this.anchor = HubTextNote.geometryEngine.nearestCoordinate(line, nearPoint).coordinate;
        this.vector = normalize([
          this.anchor.x - nearPoint.x,
          this.anchor.y - nearPoint.y
        ]);
      }
    }

    return this.computeAnchoredPosition(view);
  }

  placePolygonNote (view) {
    if (!this.anchor) { // find placement anchor and vector if this is the first time placing the note
      const polygon = this.graphic.geometry;
      let nearPoint = this.placementHint;

      // if no "hint" location for note placement was provided, choose one based on geometry
      if (!nearPoint) {
        const extent = polygon.extent;
        if (extent.width > extent.height) { // if wider, place near bottom side
          nearPoint = {
            type: 'point',
            x: (extent.xmin + extent.xmax) / 2,
            y: extent.ymin,
            spatialReference: polygon.spatialReference
          };
        } else { // if taller, place near right side
          nearPoint = {
            type: 'point',
            x: extent.xmax,
            y: (extent.ymin + extent.ymax) / 2,
            spatialReference: polygon.spatialReference
          };
        }
      }

      // place along the polygon's outer ring
      const ring = {
        type: 'polyline',
        paths: [polygon.rings[0]],
        spatialReference: polygon.spatialReference
      };
      this.anchor = HubTextNote.geometryEngine.nearestCoordinate(ring, nearPoint).coordinate;
      // point vector away from centroid so note is pushed "out" from polygon edge
      this.vector = normalize([
        polygon.centroid.x - this.anchor.x,
        polygon.centroid.y - this.anchor.y
      ]);
    }

    return this.computeAnchoredPosition(view);
  }

  // find a note's position relative to an anchor point and direction, for the current zoom
  computeAnchoredPosition (view) {
    const noteWidth = this.textElement.offsetWidth;
    const noteHeight = this.textElement.offsetHeight;
    let pixelDist = 15; // starting buffer distance to maintain between note and anchor point

    // taper the distance as you zoom out from the scale the text note was placed in
    const zoomDecreaseRange = 3; // at this number of zooms out from original text note placement
    const zoomDecreaseFactor = 0.5; // reduce the original text note distance by this %
    const zoomDiff = Math.min(Math.max(this.initialZoom - view.zoom, 0), zoomDecreaseRange);
    pixelDist *= 1 - (zoomDiff / zoomDecreaseRange) * zoomDecreaseFactor;

    // initial vector pointing away from anchor, converting pixels to map units
    const textPoint = {
      x: this.anchor.x - this.vector[0] * pixelDist * view.resolution,
      y: this.anchor.y - this.vector[1] * pixelDist * view.resolution
    };

    // then offset the note based on the directional octant of its placement vector
    const octantOffsets = [
      [1, 0], // east
      [1, 1], // northeast
      [0, 1], // north
      [-1, 1], // northwest
      [-1, 0], // west
      [-1, -1], // southwest
      [0, -1], // south
      [1, -1] // southeast
    ];

    const angle = Math.atan2(this.vector[1], this.vector[0]);
    const octant = Math.round(8 * angle / (Math.PI*2) + 8) % 8;

    textPoint.x -= octantOffsets[octant][0] * noteWidth/2 * view.resolution;
    textPoint.y -= octantOffsets[octant][1] * noteHeight/2 * view.resolution;

    return textPoint;
  }

  // convert text note to an approximate TextSymbol representation
  toGraphic (view) {
    if (!this.textElement) return;

    const textStyle = window.getComputedStyle(this.textElement);

    // get font colors from text element
    // use text element background color as font halo color, because JSAPI TextSymbol doesn't support background color
    const textColor = convertElementColorProperty(textStyle, 'color', false) || [0, 0, 0, 255];
    const textBackgroundColor = convertElementColorProperty(textStyle, 'backgroundColor', false) || [255, 255, 255, 255];
    const textHasBackgroundColor = textColor.some((c, i) => textBackgroundColor[i] !== c); // is the background color different?

    // apply font defaults where needed for TextSymbol compatibility
    const font = getFontSettings(textStyle);

    // offset from current position to anchor on graphic
    const textOffset = {
      x: view.toScreen(this.mapPoint).x - view.toScreen(this.anchor).x,
      y: view.toScreen(this.mapPoint).y - view.toScreen(this.anchor).y
    };

    return {
      geometry: this.anchor, // use the anchor position, which is then offset below
      symbol: {
        type: 'esriTS',
        text: this.textElement.innerText,
        color: textColor,
        font: {
          size: font.fontSize,
          style: font.fontStyle,
          weight: font.fontWeight,
          family: font.fontFamily
        },
        haloSize: textHasBackgroundColor ? 2 : 0, // NOTE: fixed halo size is somewhat arbitrary
        haloColor: textHasBackgroundColor ? textBackgroundColor : null,
        horizontalAlignment: 'center',
        verticalAlignment: 'middle',
        xoffset: textOffset.x, // apply offset from the anchor to the current computed position
        yoffset: -textOffset.y,
      },
      attributes: {
        OBJECTID: this.id,
        text: this.text,
      }
    };
  }
}

// length of a vector
function length (v) {
  return Math.sqrt(v.map(x => x * x).reduce((a, b) => a + b));
}

// normalize a vector to unit length
function normalize (v) {
  const len = length(v);
  return len > 0 ? v.map(x => x / len) : v;
}

// convert points to pixels
function pt2px (pt = 0) {
  return pt / 0.75;
}

function convertElementColorProperty (computedStyle, prop, useAlpha) {
  const val = computedStyle[prop];
  if (!val) return;

  const match = val.match(/\((.*)\)/); // match rgb() or rgba() syntax
  if (match && match.length > 1) {
    let color = match[1].split(',').map(s => parseFloat(s.trim()));

    // optionally adjust alpha or use default
    // Web Map JSON expects alpha in 0-255 range (HTML range is 0-1)
    color[3] = (useAlpha && color[3] != null) ? (color[3] * 255) : 255;
    return color;
  }
}
