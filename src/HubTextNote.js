import * as geometryEngine from 'esri/geometry/geometryEngine';
import * as Point from 'esri/geometry/Point';
import { getFontSettings } from './fonts';

// CSS classes added to text note elements to indicate hover and select states
const NOTE_TEXT_CLASS = 'note-text';
const NOTE_HOVER_CLASS = 'note-hover';
const NOTE_SELECT_CLASS = 'note-select';

// CSS applied directly to each text note element
// outer container, draggable
const NOTE_CONTAINER_STYLE = `
  position: absolute; /* position notes relative to map container */
`;

// added to outer container when drag-drop is available
const NOTE_DRAG_STYLE = `
  cursor: grab;
`;

// inner element, for editable text
const NOTE_TEXT_STYLE = `
  -webkit-user-select: auto; /* mobile safari needs this for contenteditable to work properly */
  cursor: auto;
`;

// Instances of HubTextNote manage an individual text note attached to a graphic, including handling text input
// and positioning (sometimes dynamically updated as the view changes) relative to the "anchor" graphic.
export default class HubTextNote {

  // NOTE: this is a workaround to allow these modules to be externally loaded in tests
  static Point = Point;
  static geometryEngine = geometryEngine;

  constructor ({ id, editable = false, graphic, text = '', textPlaceholder = '', cssClass, placementHint, onNoteEvent }) {
    Object.assign(this, { id, editable, graphic, text, textPlaceholder, cssClass });
    this.onNoteEvent = typeof onNoteEvent === 'function' ? onNoteEvent : function(){}; // provide an empty callback as fallback
    this.anchor = null; // a point on the graphic that the text note is positioned relative to
    this.mapPoint = null; // the current computed map point for the text note element
    if (placementHint) {
      // convert to Point instance if needed, so param will accept JSON or existing instance
      this.placementHint = new HubTextNote.Point(placementHint);
    }
    this._listeners = []; // DOM event listeners
    this._handles = []; // JSAPI handles
  }

  destroy () {
    this._listeners.forEach(([target, type, handler]) => target.removeEventListener(type, handler));
    this._listeners = [];

    this._handles.forEach(handle => handle.remove());

    if (this.container) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
    this.textElement = null;
  }

  addEventListener (target, type, handler) {
    target.addEventListener(type, handler);
    this._listeners.push([target, type, handler]);
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
    return this.container && this.container.classList.contains(NOTE_HOVER_CLASS);
  }

  selected () {
    return this.container && this.container.classList.contains(NOTE_SELECT_CLASS);
  }

  hidden () {
    return this.container && parseFloat(this.container.style.opacity) === 0;
  }

  draggable () {
    // points don't yet have drag support (need to determine best behavior)
    return this.editable && this.graphic.geometry.type !== 'point';
  }

  setVisibility (state) {
    if (this.container) {
      // TODO: consider allowing user-specified CSS class, might keep occluded notes visible but faded (e.g. opacity 50%)
      this.container.style.opacity = state ? 1 : 0;
      this.container.style.pointerEvents = state ? 'auto' : 'none';
      this.textElement.style.opacity = state ? 1 : 0;
      this.textElement.style.pointerEvents = state ? 'auto' : 'none';
    }
  }

  setHover (state) {
    if (this.container) {
      const hovered = this.hovered();
      if (state) {
        this.container.classList.add(NOTE_HOVER_CLASS);
      } else {
        this.container.classList.remove(NOTE_HOVER_CLASS);
      }

      if (state !== hovered) {
        this.onNoteEvent('hover', this, { type: 'hover' });
      }
    }
  }

  setSelect (state) {
    const selected = this.selected();
    if (this.container) {
      if (state) {
        this.container.classList.add(NOTE_SELECT_CLASS);
      } else {
        this.container.classList.remove(NOTE_SELECT_CLASS);
      }

      if (state !== selected) {
        this.onNoteEvent('select', this, { type: 'select' });
      }
    }
  }

  setDrag (state) {
    this.dragging = state;
    this.wasDragged = false; // reset
    if (this.dragging) {
      // save current cursor and activate drag cursor
      this.prevCursor = document.body.style.cursor;
      this.container.style.cursor = 'grabbing';
      document.body.style.cursor = 'grabbing';
    } else {
      this.container.style.cursor = 'grab';
      document.body.style.cursor = this.prevCursor; // restore cursor
    }
  }

  createElements (view) {
    // setup outer note element, which is draggable (when editing is enable)
    this.container = document.createElement('div');
    this.container.style = `${NOTE_CONTAINER_STYLE} ${this.draggable() ? NOTE_DRAG_STYLE : ''}`;
    if (this.cssClass) {
      this.container.classList.add(this.cssClass); // apply user-supplied style
    }

    // setup inner note element, which is provides editing capabilities (when enabled)
    this.textElement = document.createElement('div');
    this.textElement.contentEditable = this.editable;
    this.textElement.innerText = this.text;
    this.textElement.setAttribute('data-placeholder', this.textPlaceholder);
    this.textElement.tabIndex = 1;
    this.textElement.style = NOTE_TEXT_STYLE;
    this.textElement.classList.add(NOTE_TEXT_CLASS); // apply user-supplied style
    this.container.appendChild(this.textElement);

    // add input-related event handlers
    this.addEventListener(this.textElement, 'input', event => this.onInputEvent(event, view));
    this.addEventListener(this.textElement, 'paste', event => this.onPasteEvent(event, view));

    // add general cursor/focus/blur event handlers
    [this.container, this.textElement].forEach(element => {
      // we don't want these events interfering with the underlying map view
      ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click'].forEach(type => {
        this.addEventListener(element, type, e => e.stopPropagation());
      });

      // when we're already interacting w/the note, suppress hover events from bubbling to map view
      this.addEventListener(element, 'pointermove', (event) => {
        if (!this.dragging && (this.selected() || this.hovered())) {
          event.stopPropagation();
        }
      });

      this.addEventListener(element, 'focus', (event) => {
        this.onNoteEvent('focus', this, event);
      });

      this.addEventListener(element, 'blur', (event) => {
        // only mark as empty on blur, because we don't want notes removed while they're being edited
        this.empty = (!this.textElement.innerText || this.textElement.innerText.length === 0);
        this.onNoteEvent('blur', this, event);
      });
    });

    // add drag event handling when editing is enabled
    if (this.draggable()) {
      // start dragging when pressing on the outer container area
      // stop dragging when pressing the inner note area, or releasing elsewhere on screen
      this.addEventListener(this.container, 'pointerdown', () => this.setDrag(true));
      this.addEventListener(this.textElement, 'pointerdown', () => this.setDrag(false));

      this.addEventListener(this.container, 'pointerup', () => {
        const wasDragged = this.wasDragged;
        this.setDrag(false);
        if (!wasDragged) {
          this.focus(); // focus the note when the outer container is clicked, if not ending a drag
        }
      });
      this.addEventListener(this.textElement, 'pointerup', () => this.setDrag(false));
      this.addEventListener(window, 'pointerup', () => this.setDrag(false));
      this.addEventListener(window, 'pointerleave', () => this.setDrag(false));

      // when dragging the note in the map view, re-calculate its position (constrained by the graphic)
      this._handles.push(view.on('pointer-move', event => {
        if (this.dragging) {
          this.wasDragged = true;
          this.anchor = null;
          this.placementHint = view.toMap(event); // place closest to current pointer location
          this.onNoteEvent('drag', this, event);
        }
      }));
    }

    view.surface.appendChild(this.container); // add to view DOM
    this.updatePosition(view);
  }

  // handle input events
  onInputEvent (event, view) {
    // exit edit mode when a user hits enter
    if ((event.inputType === 'insertText' || event.inputType === 'insertParagraph') && event.data == null) {
      this.textElement.innerText = this.text; // revert to text before line break
      this.textElement.blur();
    }

    this.text = this.textElement.innerText; // update current text
    this.updatePosition(view);
    this.onNoteEvent('update-text', this, event);
  }

  // handle paste events
  onPasteEvent (event, view) {
    event.stopPropagation();
    event.preventDefault();

    // get the plain text version of pasted content, and insert it at the current cursor position
    // TODO: should this be an option in the future, e.g. if the clients wants to accept HTML?
    const pastedData = (event.clipboardData || window.clipboardData).getData('Text');
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    if (range) {
      range.insertNode(document.createTextNode(pastedData));
    }
    selection.removeAllRanges(); // de-select text

    this.text = this.textElement.innerText; // update current text
    this.updatePosition(view);
    this.onNoteEvent('update-text', this, event);
  }

  // Update text note position in world space and screenspace
  updatePosition (view) {
    if (this.updateMapPoint(view)) {
      this.updateTextElement(view);
      this.onNoteEvent('update-position', this, { type: 'update-position' });
    }
  }

  // Update position of the HTML div in screenspace
  updateTextElement (view) {
    if (!view.ready) return;
    const point = view.toScreen(this.mapPoint);

    point.x -= this.container.offsetWidth / 2;
    point.y -= this.container.offsetHeight / 2;
    point.x = Math.round(point.x);
    point.y = Math.round(point.y);

    this.container.style.left = `${point.x}px`;
    this.container.style.top = `${point.y}px`;
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

    const prevPoint = this.mapPoint && this.mapPoint.toJSON();

    this.mapPoint = new HubTextNote.Point({
      spatialReference: this.graphic.geometry.spatialReference,
      x: point.x,
      y: point.y
    });

    return this.mapPoint.toJSON() !== prevPoint;
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
    const elementHeight = this.container.offsetHeight; // height of text element
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
    const noteWidth = this.container.offsetWidth;
    const noteHeight = this.container.offsetHeight;
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
    if (!this.text ||
      !this.textElement ||
      !this.mapPoint ||
      !this.anchor) {
      return;
    }

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
