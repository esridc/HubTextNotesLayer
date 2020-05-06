import * as geometryEngine from 'esri/geometry/geometryEngine';

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
  constructor ({ id, editable = false, graphic, text = '', textPlaceholder = '', textClass, onNoteEvent }) {
    Object.assign(this, { id, editable, graphic, text, textPlaceholder, textClass });
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

  createTextElement (view, focus) {
    // setup note element
    this.textElement = document.createElement('div');
    this.textElement.contentEditable = this.editable;
    this.textElement.innerText = this.text;
    this.textElement.setAttribute('data-placeholder', this.textPlaceholder);
    this.textElement.tabIndex = 1;
    this.textElement.classList.add(this.textClass); // apply user-supplied style
    this.textElement.style = NOTE_STYLE; // apply non-visual properties

    this.text = this.textElement.innerText;
    this.textElement.addEventListener('input', event => {
      // exit edit mode when a user hits enter
      if ((event.inputType === 'insertText' || event.inputType === 'insertParagraph') && event.data == null) {
        this.textElement.innerText = this.text; // revert to text before line break
        this.textElement.blur();
      }

      this.text = this.textElement.innerText;
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

    if (focus) {
      this.textElement.focus();
    }
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

    this.mapPoint = {
      type: 'point',
      spatialReference: this.graphic.geometry.spatialReference,
      x: point.x,
      y: point.y
    };
  }

  placePointNote (view) {
    if (!this.anchor) {
      this.anchor = this.graphic.geometry;
      this.buffer = 3; // space in pixels between marker and note
    }
    const graphicHeight = pt2px(
      this.graphic.symbol.type === 'picture-marker'
        ? this.graphic.symbol.height // height from picture marker
        : (this.graphic.symbol.size + this.graphic.symbol.outline.width) // height from simple marker
    );
    const elementHeight = this.textElement.offsetHeight; // height of text element
    const pixelDist = (graphicHeight + elementHeight) / 2 - this.graphic.symbol.yoffset + this.buffer;
    const textPoint = this.anchor.clone();
    textPoint.y -= view.resolution * pixelDist;
    return textPoint;
  }

  placeLineNote (view) {
    if (!this.anchor) {
      // find placement anchor and vector
      const line = this.graphic.geometry;
      const hull = geometryEngine.convexHull(line);

      if (hull.type === 'polygon') {
        this.center = hull.centroid;
        this.anchor = geometryEngine.nearestCoordinate(line, this.center).coordinate;
        this.vector = normalize([
          this.center.x - this.anchor.x,
          this.center.y - this.anchor.y
        ]);
      } else { // polyline
        // simple average of vertices
        this.center = hull.paths[0]
            .reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0])
            .map(p => p / hull.paths[0].length);
        this.center = {
          type: 'point',
          spatialReference: { wkid: 102100, latestWkid: 3857 },
          x: this.center[0],
          y: this.center[1]
        };

        this.anchor = this.center;

        // derive normal perpendicular to line from first to last point
        const first = hull.paths[0][0];
        const last = hull.paths[0][hull.paths[0].length - 1];
        this.vector = normalize([
          -(last[1] - first[1]),
          last[0] - first[0]
        ]);
      }
    }
    // keep text note at a variable pixel distance from the line based on its size
    let pixelDist = elementRadius(this.textElement) * 0.85;

    // but taper the distance as you zoom out from the scale the text note was placed in
    const zoomDecreaseRange = 3; // at this number of zooms out from original text note placement
    const zoomDecreaseFactor = 0.5; // reduce the original text note distance by this %
    const zoomDiff = Math.min(Math.max(this.initialZoom - view.zoom, 0), zoomDecreaseRange);
    pixelDist *= 1 - (zoomDiff / zoomDecreaseRange) * zoomDecreaseFactor;

    const lineDist = view.resolution * pixelDist;
    const textPoint = {
      x: this.anchor.x + this.vector[0] * lineDist * -1,
      y: this.anchor.y + this.vector[1] * lineDist * -1
    };
    return textPoint;
  }

  placePolygonNote () {
    if (!this.anchor) {
      this.anchor = this.graphic.geometry.centroid;
    }
    return this.anchor.clone();
  }

  // convert text note to an approximate TextSymbol representation
  toGraphic (view) {
    if (!this.textElement) return;

    const textStyle = window.getComputedStyle(this.textElement);

    // get font color from text element
    const textColor = convertElementColorProperty(this.textElement, 'color', false) || [0, 0, 0, 255];

    // use text element background color as font halo color,
    // because JSAPI TextSymbol doesn't support background color
    const textBackgroundColor = convertElementColorProperty(this.textElement, 'backgroundColor', false) || [255, 255, 255, 255];
    let fontWeight = convertFontWeightNumberToName(textStyle.fontWeight);

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
        color: textBackgroundColor,
        font: {
          size: textStyle.fontSize || '16px',
          style: textStyle.fontStyle || 'normal',
          weight: fontWeight || 'normal',
          family: textStyle.fontFamily || 'Arial', // TODO: what about limited JSAPI support for font families?
        },
        haloSize: 1,
        haloColor: textColor,
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

// radius of an element in pixels
function elementRadius (e) {
  const rect = e.getBoundingClientRect();
  const dx = rect.width / 2;
  const dy = rect.height / 2;
  return Math.sqrt(dx * dx + dy * dy);
}

// convert points to pixels
function pt2px (pt = 0) {
  return pt / 0.75;
}

function convertFontWeightNumberToName (fontWeight) {
  switch (fontWeight) {
    case '700':
      return 'bold';
    case '400':
    default:
      return 'normal';
  } // TextSymbol supports only bold and normal. Also bolder and lighter but not for 2D Feature Layers at the moment.
}

function convertElementColorProperty (element, prop, useAlpha) {
  const val = window.getComputedStyle(element)[prop];
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
