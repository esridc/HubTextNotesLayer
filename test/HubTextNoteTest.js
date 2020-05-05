import chai from 'chai';
import HubTextNote from '../src/HubTextNote';

import { createView } from './helpers';
import polygonGraphic from './fixtures/polygonGraphic';
import noteGraphic from './fixtures/noteGraphic';

const assert = chai.assert;

describe('HubNote', () => {

  let note, view;

  beforeEach(() => {
    view = createView();
    note = new HubTextNote({ graphic: polygonGraphic, text: 'this is a test note' });
    note.createTextElement(view);
  });

  it('returns an new note instance', () => {
    assert.instanceOf(note, HubTextNote);
  });

  it('creates a text element with expected values', () => {
    assert.instanceOf(note.textElement, HTMLElement);
    assert.equal(note.text, 'this is a test note');
    assert.equal(note.textElement.innerText, 'this is a test note');
  });

  it('sets the selection state', () => {
    assert.equal(note.selected(), false);
    note.setSelect(true);
    assert.equal(note.selected(), true);
  });

  it('sets the hover state', () => {
    assert.equal(note.hovered(), false);
    note.setHover(true);
    assert.equal(note.hovered(), true);
  });

  it('hides the note', () => {
    assert.equal(note.hidden(), false);
    note.setVisibility(false);
    assert.equal(note.hidden(), true);
  });

  it('converts the note to a graphic', () => {
    const graphic = note.toGraphic(view);
    assert.isTrue(JSON.stringify(graphic) === JSON.stringify(noteGraphic));
  });

});