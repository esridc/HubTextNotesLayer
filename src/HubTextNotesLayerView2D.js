import * as BaseLayerView2D from 'esri/views/2d/layers/BaseLayerView2D';
import * as Graphic from 'esri/Graphic';

// The layer view is resopnsible for creating and managing text note HTML elements to stay in sync with the map view
const HubTextNotesLayerView2D = BaseLayerView2D.createSubclass({
  declaredClass: 'HubTextNotesLayerView2D',

  constructor () {
    this._handles = [];
    this._dirty = false;
  },

  attach () {
    // process any notes already in the layer
    this.layer.hubNotes.forEach(note => this.addNoteTextElement(note));

    // add event handlers
    this._handles.push(this.layer.on('note-add', event => this.addNoteTextElement(event.note)));
    this._handles.push(this.layer.on('note-select', () => this.setDirty(true)));
    this._handles.push(this.view.watch('extent', () => this.setDirty(true)));
  },

  detach () {
    this._handles.forEach(handle => handle.remove());
  },

  setDirty (dirty) {
    this._dirty = dirty;
    if (this._dirty) {
      this.requestRender();
    }
  },

  addNoteTextElement (note) {
    note.createTextElement(this.view);
    this.setDirty(true);
  },

  // Implementation of LayerView method
  render () {
    // remove any empty notes
    this.layer.hubNotes
      .filter(note => note.empty)
      .forEach(note => this.layer.removeNoteForGraphic(note.graphic));

    // render calls much more frequently than we need to update, so only run collision and DOM updates when needed
    if (this._dirty) {
      this.setDirty(false);
      this.layer.updateNotePositions(this.view); // update text note positions in world/screen
      this.layer.collideNotes(); // update text note visibility based on collisions
    }
  },

  // Implement hitTest API, returning a single graphic for this feature.
  // Returns a graphic with a note ID and text attributes (the note can then obtained from the layer by ID),
  // and centerpoint as geometry.
  hitTest (x, y) {
    const notes = this.layer.hubNotes
      .filter(note => !note.hidden()) // ignore notes hidden by collision detection
      .filter(note => note.textElement && elementContainsPoint(note.textElement, { x, y })); // point is inside note

    const graphic = notes[0] && new Graphic({
      geometry: notes[0].mapPoint, // TODO: add full note extent if deemed necessary
      attributes: {
        id: notes[0].id,
        text: notes[0].text
      },
      layer: this.layer,
      sourceLayer: this.layer
    });
    return Promise.resolve(graphic);
  }

});

// determines if an element contains a point
function elementContainsPoint (element, { x, y }) {
  const parent = element.parentNode ? element.parentNode.getBoundingClientRect() : { left: 0, top: 0 };
  const child = element.getBoundingClientRect();
  const rect = {
    left: child.left - parent.left,
    right: child.right - parent.left,
    top: child.top - parent.top,
    bottom: child.bottom - parent.top
  };
  return (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
}

export default HubTextNotesLayerView2D;
