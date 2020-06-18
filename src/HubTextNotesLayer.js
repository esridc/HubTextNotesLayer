import * as Layer from 'esri/layers/Layer';

import HubTextNote from './HubTextNote';
import HubTextNotesLayerView2D from './HubTextNotesLayerView2D';

// The layer is responsible for creating  and managing text notes that are attached to graphics
// (the latter are owned by other layers)
const HubTextNotesLayer = Layer.createSubclass({
  declaredClass: 'HubTextNotesLayer',
  noteId: 0, // incrementing ide to uniquely identify notes in the layer

  constructor ({ editable, textPlaceholder, textMaxCharacters, cssClass }) {
    Object.assign(this, { editable, textPlaceholder, textMaxCharacters, cssClass });
    this.hubNotes = [];
  },

  // TODO: destroy

  createLayerView (view) {
    if (view.type === '2d') {
      return new HubTextNotesLayerView2D({
        view: view,
        layer: this
      });
    }
  },

  // forward a subset of events from the layer view
  onNoteEvent (type, note, event) {
    this.emit(`note-${type}`, { note, ...event });
  },

  addNoteForGraphic (graphic, { text, placement } = {}) {
    const note = new HubTextNote({
      id: this.noteId++,
      editable: this.editable,
      graphic,
      text,
      textPlaceholder: this.textPlaceholder,
      textMaxCharacters: this.textMaxCharacters,
      cssClass: this.cssClass,
      placement,
      onNoteEvent: this.onNoteEvent.bind(this)
    });
    this.hubNotes.push(note);
    this.emit('note-add', { note });
    return note;
  },

  removeNoteForGraphic (graphic) {
    const note = this.findNoteForGraphic(graphic);
    if (!note) {
      return;
    }
    this.hubNotes = this.hubNotes.filter(n => n !== note);
    const noteId = note.id;
    note.destroy();
    this.emit('note-remove', { noteId, graphic });
  },

  // retrieve note by unique id
  findNoteForId (id) {
    return this.hubNotes.find(note => note.id === id);
  },

  // retrieve note by referenced graphic
  findNoteForGraphic (graphic) {
    // first look for a note with same graphic identity, should work for GraphicsLayer
    let note = this.hubNotes.find(note => note.graphic === graphic);
    if (note) {
      return note;
    }

    // then fallback to comparing by object id, necessary for features from a FeatureLayer.hitTest()
    return this.hubNotes
      .filter(note => note.graphic.getObjectId() != null)
      .find(note => note.graphic.getObjectId() === graphic.getObjectId());
  },

  setHoveredNoteForGraphic (graphic) {
    const hoverNote = this.findNoteForGraphic(graphic);
    this.hubNotes.filter(note => note.container).forEach(note => {
      note.setHover(note === hoverNote);
    });
  },

  setSelectedNoteForGraphic (graphic) {
    const selectNote = this.findNoteForGraphic(graphic);
    this.hubNotes.filter(note => note.container).forEach(note => {
      note.setSelect(note === selectNote);
    });
  },

  async updateNotePositions (view) {
    await Promise.all(this.hubNotes.map(note => note.updatePosition(view)));
  },

  dragging () {
    // is a text note currently being dragged
    return this.hubNotes.filter(note => note.dragging).length > 0;
  },

  // check notes for overlaps, and mark as occluded according to priority
  collideNotes () {
    const notesWithEls = this.hubNotes.filter(note => note.container);
    const occluded = new Set();
    for (let a = 0; a < notesWithEls.length; a++) {
      const noteA = notesWithEls[a];
      if (occluded.has(noteA)) {
        continue; // skip to-be-occluded elements
      }

      for (let b = a + 1; b < notesWithEls.length; b++) {
        const noteB = notesWithEls[b];

        // check for overlap of rendered DOM rects in screenspace
        if (elementsIntersect(noteA.container, noteB.container)) {
          // keep notes in priority of: dragging, focused, selected, hovered, most recently added
          if (noteA.dragging) {
            occluded.add(noteB);
          } else if (noteB.dragging) {
            occluded.add(noteA);
          } else if (noteA.focused()) {
            occluded.add(noteB);
          } else if (noteB.focused()) {
            occluded.add(noteA);
          } else if (noteA.selected()) {
            occluded.add(noteB);
          } else if (noteB.selected()) {
            occluded.add(noteA);
          // NOTE: disable hover priority for now and revisit, can be too distracting/frustrating with many notes
          } else if (noteA.hovered()) {
            occluded.add(noteB);
          } else if (noteB.hovered()) {
            occluded.add(noteA);
          } else {
            occluded.add(a >= b ? noteB : noteA);
          }
        }
      }
    }

    this.hubNotes.forEach(note => note.setOccluded(!occluded.has(note)));
  },

  // convert all notes to TextSymbol graphics
  toGraphics (view) {
    return this.hubNotes.map(note => note.toGraphic(view)).filter(x => x);
  }
});

// check if two DOM elements overlap
function elementsIntersect (a, b) {
  const rectA = a.getBoundingClientRect();
  const rectB = b.getBoundingClientRect();

  if (rectA.right < rectB.left || // a is left of b
    rectA.left > rectB.right || // a is right of b
    rectA.bottom < rectB.top || // a is above b
    rectA.top > rectB.bottom) { // a is below b
    return false;
  }
  return true;
}

export default HubTextNotesLayer;
