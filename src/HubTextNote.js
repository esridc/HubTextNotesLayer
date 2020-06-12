import * as geometryEngine from 'esri/geometry/geometryEngine';
import * as Point from 'esri/geometry/Point';
import { getFontSettings } from './fonts';

// CSS classes added to text note elements to indicate various states, for user-provided styling
// An explicit hover state is defined, instead of simply using :hover pseudo-selector, because a text note
// will hover in conjunction with its attached graphic, when either is hovered.
const NOTE_TEXT_CLASS = 'note-text'; // style the text div, which may be contenteditable
const NOTE_HOVER_CLASS = 'note-hover'; // style the hover state
const NOTE_SELECT_CLASS = 'note-select'; // style the selected state
const NOTE_DRAGGING_CLASS = 'note-dragging'; // style note while dragging

// CSS applied directly to each text note element
// outer container, draggable
const NOTE_CONTAINER_STYLE = `
  position: absolute; /* position notes relative to map container */
`;

// added to outer container when drag-drop is available
const NOTE_DRAGGABLE_STYLE = `
  cursor: grab;
`;

// inner element, for editable text
const NOTE_TEXT_STYLE = `
  -webkit-user-select: auto; /* mobile safari needs this for contenteditable to work properly */
  cursor: auto;
`;

// key codes that are allowed even when the text note is at max length (so user can select/delete text)
const MAX_LENGTH_ALLOWED_KEYS = [
  8, // backspace
  13, // enter
  16, // shift
  17, // control
  18, // alt
  46, // delete
  37, // left arrow
  38, // up arrow
  39, // right arrow
  40 // down arrow
];

// Instances of HubTextNote manage an individual text note attached to a graphic, including handling text input
// and positioning (sometimes dynamically updated as the view changes) relative to the "anchor" graphic.
export default class HubTextNote {

  // NOTE: this is a workaround to allow these modules to be externally loaded in tests
  static Point = Point;
  static geometryEngine = geometryEngine;

  static octantOffsets = [
    [1, 0], // right
    [1, 1], // top-right
    [0, 1], // top
    [-1, 1], // top-left
    [-1, 0], // left
    [-1, -1], // bottom-left
    [0, -1], // bottom
    [1, -1] // bottom-right
  ];

  static alignmentOctants = {
    'right': 0,
    'top-right': 1,
    'top': 2,
    'top-left': 3,
    'left': 4,
    'bottom-left': 5,
    'bottom': 6,
    'bottom-right': 7
  };

  constructor ({ id, editable = false, graphic, text = '', textPlaceholder = '', textMaxCharacters, cssClass, placementHint, placementAlignments, onNoteEvent }) {
    Object.assign(this, { id, editable, graphic, text, textPlaceholder, textMaxCharacters, cssClass });
    this.onNoteEvent = typeof onNoteEvent === 'function' ? onNoteEvent : function(){}; // provide an empty callback as fallback
    this.anchor = null; // a point on the graphic that the text note is positioned relative to
    this.mapPoint = null; // the current computed map point for the text note element
    if (placementHint) {
      // convert to Point instance if needed, so param will accept JSON or existing instance
      this.placementHint = new HubTextNote.Point(placementHint);
    }
    this.placementAlignments = placementAlignments || Object.keys(HubTextNote.alignmentOctants); // default to all alignments
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
    return this.editable === true;
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

  setDrag (state, view) {
    this.dragging = state;
    this.wasDragged = false; // reset
    if (this.dragging) {
      // save current cursor and activate drag cursor
      this.prevCursor = view.cursor;
      this.container.style.cursor = 'grabbing';
      this.textElement.style.cursor = 'inherit';
      view.cursor = 'grabbing';
      this.container.classList.add(NOTE_DRAGGING_CLASS);
    } else {
      // restore cursors
      this.container.style.cursor = 'grab';
      this.textElement.style.cursor = 'auto';
      view.cursor = this.prevCursor;
      this.container.classList.remove(NOTE_DRAGGING_CLASS);
    }
  }

  createElements (view) {
    // setup outer note element, which is draggable (when editing is enable)
    this.container = document.createElement('div');
    this.container.style = `${NOTE_CONTAINER_STYLE} ${this.draggable() ? NOTE_DRAGGABLE_STYLE : ''}`;
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
    this.addEventListener(this.textElement, 'input', event => this.onTextInputEvent(event, view));
    this.addEventListener(this.textElement, 'paste', event => this.onTextPasteEvent(event, view));
    this.addEventListener(this.textElement, 'keydown', event => this.onTextKeydownEvent(event, view));

    // add general cursor/focus/blur event handlers
    [this.container, this.textElement].forEach(element => {
      // we don't want these events interfering with the underlying map view
      ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click'].forEach(type => {
        this.addEventListener(element, type, e => e.stopPropagation());
      });

      // when we're already interacting w/the note, suppress hover events from bubbling to map view
      // we *do* want to allow events while dragging, otherwise the note div blocks the drag
      this.addEventListener(element, 'pointermove', (event) => {
        if (!this.dragging && (this.selected() || this.hovered())) {
          event.stopPropagation();
          event.preventDefault();
        }
      });

      this.addEventListener(element, 'focus', (event) => {
        this.onNoteEvent('focus', this, event);
      });

      this.addEventListener(element, 'blur', (event) => {
        // only mark as empty on blur, because we don't want notes removed while they're being edited
        this.empty = (!this.textElement.innerText || this.textElement.innerText.length === 0);
        // don't treat a blur when transitioning to a drag operation as a blur event extenrally (e.g. to the calling app)
        // we don't want it to trigger other changes such as a de-selection of the shape
        if (!this.dragging) {
          this.onNoteEvent('blur', this, event);
        }
      });
    });

    // add drag event handling when editing is enabled
    if (this.draggable()) {
      // start dragging when pressing on the outer container area
      // stop dragging when pressing the inner note area, or releasing elsewhere on screen
      this.addEventListener(this.container, 'pointerdown', () => this.setDrag(true, view));
      this.addEventListener(this.textElement, 'pointerdown', () => this.setDrag(false, view));

      this.addEventListener(this.container, 'pointerup', () => {
        const wasDragged = this.wasDragged;
        this.setDrag(false, view);
        if (!wasDragged) {
          this.focus(); // focus the note when the outer container is clicked, if not ending a drag
        }
      });
      this.addEventListener(this.textElement, 'pointerup', () => this.setDrag(false, view));
      this.addEventListener(window, 'pointerup', () => this.setDrag(false, view));
      this.addEventListener(window, 'pointerleave', () => this.setDrag(false, view));

      // update note position
      this._handles.push(view.on('pointer-move', event => this.onDragEvent(event, view)));
    }

    view.surface.appendChild(this.container); // add to view DOM
    this.updatePosition(view);
  }

  // handle input key down events to enforce max character limit
  onTextKeydownEvent (event, view) {
    if (!this.textMaxCharacters) {
      return; // nothing to do if not max note length defined
    }

    // always allow input if text is selected (because the next input will replace the selection)
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      return;
    }

    // otherwise enforce max character length on notes
    // input from keys that allow the user to navigate/select/delete text are allowed
    if (this.textElement.innerText.length >= this.textMaxCharacters &&
        !MAX_LENGTH_ALLOWED_KEYS.includes(event.keyCode)) {
      event.preventDefault(); // don't allow input to pass through
    }
  }

  // handle input events
  onTextInputEvent (event, view) {
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
  onTextPasteEvent (event, view) {
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

    // optional max character length on notes
    if (this.textMaxCharacters && this.textElement.innerText.length > this.textMaxCharacters) {
      this.textElement.innerText = this.textElement.innerText.slice(0, this.textMaxCharacters);
    }

    this.text = this.textElement.innerText; // update current text
    this.updatePosition(view);
    this.onNoteEvent('update-text', this, event);
  }

  // re-calculate note's position (constrained by the graphic) as it is dragged
  onDragEvent (event, view) {
    if (this.dragging) {
      this.wasDragged = true;
      this.anchor = null; // will be re-calculated on next update
      this.placementHint = view.toMap(event); // place closest to the current pointer location
      this.onNoteEvent('drag', this, event); // layer view will request a re-render
    }
  }

  // Update text note position in world space and screenspace
  updatePosition (view) {
    const changed = this.updateMapPoint(view);
    this.updateTextElement(view);
    if (changed) {
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

    const prevPoint = JSON.stringify(this.mapPoint && this.mapPoint.toJSON());

    this.mapPoint = new HubTextNote.Point({
      spatialReference: this.graphic.geometry.spatialReference,
      x: point.x,
      y: point.y
    });

    return JSON.stringify(this.mapPoint.toJSON()) !== prevPoint;
  }

  placePointNote (view) {
    if (!this.anchor) { // set placement anchor if this is the first time placing the note
      this.anchor = this.graphic.geometry.clone();
      this.buffer = [6, 3]; // space in pixels between marker and note
    }

    // get note and marker size
    const noteSize = [this.container.offsetWidth, this.container.offsetHeight];
    const symbol = this.graphic.symbol;
    const graphicSize = symbol.type === 'picture-marker' ?
      [pt2px(symbol.width), pt2px(symbol.height)] : // width/height from picture marker
      [pt2px(symbol.size + symbol.outline.width), pt2px(symbol.size + symbol.outline.width)]; // size from simple marker

    // get candidate locations for note based on configured alignment options
    const candidates = this.placementAlignments.map(alignment => {
      // get current screen position and adjust center-point for symbol's offset
      const textScreenPoint = view.toScreen(this.anchor);
      textScreenPoint.x -= symbol.xoffset;
      textScreenPoint.y -= symbol.yoffset;

      // move the position in the offset direction using its current dimensions and desired buffer
      const offset = HubTextNote.octantOffsets[HubTextNote.alignmentOctants[alignment]];
      textScreenPoint.x += offset[0] * ((graphicSize[0] + noteSize[0]) / 2 + this.buffer[0]);
      textScreenPoint.y -= offset[1] * ((graphicSize[1] + noteSize[1]) / 2 + this.buffer[1]);

      // convert back to map coords and get distance from hint location
      const textPoint = view.toMap(textScreenPoint);
      const dist = this.placementHint ? length([
        textPoint.x - this.placementHint.x,
        textPoint.y - this.placementHint.y
      ]) : 0;

      return { alignment, textPoint, dist };
    });

    // don't snap to a new alignment while the user is editing (note is focused)
    if (!this.lastAlignment || !this.focused()) {
      if (!this.placementHint) { // if no hint provided, just use first alignment
        this.lastAlignment = this.placementAlignments[0];
      } else {
        // find candidate closest to placement hint
        const [closest] = candidates.sort((a, b) => a.dist === b.dist ? 1 : a.dist - b.dist);
        this.lastAlignment = closest.alignment;
      }
    }

    // return current location
    const location = candidates.find(c => c.alignment === this.lastAlignment) || candidates[0];
    return location.textPoint;
  }

  placeLineNote (view) {
    // find placement anchor and vector if new note location is being calculated (first placement, or being dragged))
    if (!this.anchor) {
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
    // find placement anchor and vector if new note location is being calculated (first placement, or being dragged))
    if (!this.anchor) {
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
    const noteSize = [this.container.offsetWidth, this.container.offsetHeight];
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
    const angle = Math.atan2(this.vector[1], this.vector[0]);
    const octant = Math.round(8 * angle / (Math.PI*2) + 8) % 8;
    const offset = HubTextNote.octantOffsets[octant];

    textPoint.x -= offset[0] * noteSize[0]/2 * view.resolution;
    textPoint.y -= offset[1] * noteSize[1]/2 * view.resolution;


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
    const containerStyle = window.getComputedStyle(this.container);

    // get font colors from text element
    // use text element background color as font halo color, because JSAPI TextSymbol doesn't support background color
    const textColor = convertElementColorProperty(textStyle, 'color') || [0, 0, 0, 255];
    let textBackgroundColor = convertElementColorProperty(textStyle, 'backgroundColor');
    if (!textBackgroundColor || textBackgroundColor[3] === 0) { // fallback to container background color
      textBackgroundColor = convertElementColorProperty(containerStyle, 'backgroundColor') || textColor;
    }
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

function convertElementColorProperty (computedStyle, prop, useAlpha = true) {
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
