import * as GraphicsLayerView2D from 'esri/views/2d/layers/GraphicsLayerView2D';
import GraphicsView2D from 'esri/views/2d/layers/graphics/GraphicsView2D';
import GraphicContainer from 'esri/views/2d/layers/graphics/GraphicContainer';
import * as Graphic from 'esri/Graphic';

const NOTES_CONTAINER_STYLE = `
  z-index: 0;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
`;

// The layer view is responsible for creating and managing text note HTML elements to stay in sync with the map view
const HubTextNotesLayerView2D = GraphicsLayerView2D.createSubclass({
  declaredClass: 'HubTextNotesLayerView2D',

  constructor () {
    this._handles = [];
    this._dirty = false;
  },

  attach () {
    // prior to 4.23, graphicsView was created in GraphicsLayerView2D initialize lifecycle method.
    // since 4.23, the initialize lifecycle has been deprecated and graphicsView is now created
    // in attach method, which is being overridden here. so we must create the graphicsView here
    // when one does not already exist.
    if (!this.graphicsView) {
      this.graphicsView = new GraphicsView2D({
        requestUpdateCallback: () => this.requestUpdate(),
        view: this.view,
        graphics: this.layer.graphics,
        container: new GraphicContainer(this.view.featuresTilingScheme)
      });
    }

    // create container for notes and attach to map view DOM
    this.notesContainer = document.createElement('div');
    this.notesContainer.classList.add('hub-text-notes');
    this.notesContainer.style = NOTES_CONTAINER_STYLE;
    this.view.surface.appendChild(this.notesContainer);

    // process any notes already in the layer
    this.layer.hubNotes.forEach(note => this.addNoteElements(note));

    // add event handlers
    this._handles.push(this.layer.on('note-add', event => this.addNoteElements(event.note)));
    this._handles.push(this.layer.on(['note-select', 'note-hover', 'note-drag', 'note-blur'], () => this.setDirty(true)));
    this._handles.push(this.view.watch('extent', () => this.setDirty(true)));
  },

  detach () {
    this._handles.forEach(handle => handle.remove());
  },

  setDirty (dirty) {
    this._dirty = dirty;
    if (this._dirty) {
      this.requestUpdate();
    }
  },

  addNoteElements (note) {
    note.createElements(this.view, this.notesContainer);
    this.setDirty(true);
  },

  // Implementation of LayerView method
  processUpdate () {
    if (!this.updateRequested) {
      return;
    }
    this.updateRequested = false;

    // remove any empty notes
    this.layer.hubNotes
      .filter(note => note.empty)
      .forEach(note => this.layer.removeNoteForGraphic(note.graphic));

    // render calls much more frequently than we need to update, so only run collision and DOM updates when needed
    if (this._dirty) {
      this.setDirty(false);
      // update text note positions in world/screen
      this.layer.updateNotePositions(this.view).then(() => {
        if (this.view.stationary) {
          this.layer.collideNotes(); // update text note visibility based on collisions
        }
      });
    }
  },

  // Implement hitTest API, returning a single graphic for this feature.
  // Returns a graphic with a note ID and text attributes (the note can then obtained from the layer by ID),
  // and centerpoint as geometry.
  hitTest (x, y) {
    const notes = this.layer.hubNotes
      .filter(note => note.container && elementContainsPoint(note.container, { x, y })); // point is inside note

    const graphic = notes[0] && new Graphic({
      geometry: notes[0].mapPoint, // TODO: add full note extent if deemed necessary
      attributes: {
        id: notes[0].id,
        text: notes[0].text,
        graphicObjectId: notes[0].graphic.getObjectId(),
        graphicLayerId: notes[0].graphic.layer.id
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
