import chai from 'chai';
import { loadModules } from 'esri-loader';
import HubTextNote from '../src/HubTextNote';

import { createView } from './helpers';
import polygonGraphic from './fixtures/polygonGraphic';
import noteGraphic from './fixtures/noteGraphic';

const assert = chai.assert;

describe('HubNote', () => {

  let note, view, notesContainer;

  before(async () => {
    // load JSAPI dependencies
    const [Point, geometryEngine, screenUtils, symbolUtils, webMercatorUtils] = await loadModules([
      'esri/geometry/Point',
      'esri/geometry/geometryEngine',
      'esri/core/screenUtils',
      'esri/symbols/support/symbolUtils',
      'esri/geometry/support/webMercatorUtils'
    ]);
    Object.assign(HubTextNote, { Point, geometryEngine, screenUtils, symbolUtils, webMercatorUtils });
    return Promise.resolve(); // avoids some timeout errors (?)
  });

  beforeEach(() => {
    view = createView();
    notesContainer = document.createElement('div'); // created by layer view
    document.body.appendChild(notesContainer);

    note = new HubTextNote({ graphic: polygonGraphic, text: 'this is a test note', cssClass: 'map-note' });
    note.createElements(view, notesContainer);
    notesContainer.appendChild(note.container); // needs to be in DOM for some tests like focus
  });

  afterEach(() => {
    document.body.removeChild(notesContainer);
  });

  it('returns a new note instance', () => {
    assert.instanceOf(note, HubTextNote);
  });

  it('creates a container and text element with expected values', () => {
    assert.instanceOf(note.container, HTMLElement);
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

  it('sets the focused state', () => {
    assert.equal(note.focused(), false);
    note.focus();
    assert.equal(note.focused(), true);
  });

  it('occludes the note', () => {
    assert.equal(note.occluded(), false);
    note.setOccluded(false);
    assert.equal(note.occluded(), true);
  });

  it('converts the note to a graphic', () => {
    const graphic = note.toGraphic(view);
    assert.isTrue(JSON.stringify(graphic) === JSON.stringify(noteGraphic));
  });

});
