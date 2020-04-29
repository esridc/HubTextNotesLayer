import * as Layer from 'esri/layers/Layer';

import HubNote from './HubNote';
import HubNotesLayerView2D from './HubNotesLayerView2D';

// The layer is responsible for creating  and managing text notes that are attached to graphics
// (the latter are owned by other layers)
const HubNotesLayer = Layer.createSubclass({
  declaredClass: 'HubNotesLayer',
  noteId: 0, // incrementing ide to uniquely identify notes in the layer

  constructor ({ editable, text, textClass }) {
    Object.assign(this, { editable, text, textClass });
    this.hubNotes = [];
  },

  createLayerView (view) {
    if (view.type === '2d') {
      return new HubNotesLayerView2D({
        view: view,
        layer: this
      });
    }
  },

  // forward a subset of events from the layer view
  onNoteEvent (type, note, event) {
    this.emit(`note-${type}`, { note, ...event });
  },

  addNoteForGraphic (graphic) {
    const note = new HubNote({
      id: this.noteId++,
      editable: this.editable,
      graphic,
      text: this.text,
      textClass: this.textClass,
      onNoteEvent: this.onNoteEvent.bind(this)
    });
    this.hubNotes.push(note);
    this.emit('note-add', { note });
  },

  removeNoteForGraphic (graphic) {
    const note = this.findNoteForGraphic(graphic);
    if (!note) return;
    this.hubNotes = this.hubNotes.filter(n => n !== note);
    note.destroy();
    this.emit('note-remove', { note });
  },

  // retrieve note by unique id
  findNoteForId (id) {
    return this.hubNotes.find(note => note.id === id);
  },

  // retrieve note by referenced graphic
  findNoteForGraphic (graphic) {
    return this.hubNotes.find(note => note.graphic === graphic);
  },

  setHoveredNoteForGraphic (graphic) {
    const hoverNote = this.findNoteForGraphic(graphic);
    this.hubNotes.filter(note => note.textElement).forEach(note => {
      note.setHover(note === hoverNote);
    });
  },

  setSelectedNoteForGraphic (graphic) {
    const selectNote = this.findNoteForGraphic(graphic);
    this.hubNotes.filter(note => note.textElement).forEach(note => {
      note.setSelect(note === selectNote);
    });
  },

  updateNotePositions (view) {
    this.hubNotes.forEach(note => note.updatePosition(view));
  },

  // check notes for overlaps, and show/hide according to priority
  collideNotes () {
    const notesWithEls = this.hubNotes.filter(note => note.textElement);
    const hidden = new Set();
    for (let a = 0; a < notesWithEls.length; a++) {
      const noteA = notesWithEls[a];
      if (hidden.has(noteA)) {
        continue; // skip to-be-hidden elements
      }

      for (let b = a + 1; b < notesWithEls.length; b++) {
        const noteB = notesWithEls[b];

        // check for overlap of rendered DOM rects in screenspace
        if (elementsIntersect(noteA.textElement, noteB.textElement)) {
          // keep notes in priority of: focused (active editing), selected, hovered, most recently added
          // keep focused note, or the most recently added one
          if (noteA.focused()) {
            hidden.add(noteB);
          } else if (noteB.focused()) {
            hidden.add(noteA);
          } else if (noteA.selected()) {
            hidden.add(noteB);
          } else if (noteB.selected()) {
            hidden.add(noteA);
          // NOTE: disable hover priority for now and revisit, can be too distracting/frustrating with many notes
          // } else if (noteA.hovered()) {
          //   hidden.add(noteB);
          // } else if (noteB.hovered()) {
          //   hidden.add(noteA);
          } else {
            hidden.add(a >= b ? noteB : noteA);
          }
        }
      }
    }

    // hide/show each note
    this.hubNotes.forEach(note => note.setVisibility(!hidden.has(note)));
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

export default HubNotesLayer;
