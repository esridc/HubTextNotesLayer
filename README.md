# HubTextNotesLayer

`HubTextNotesLayer` is a custom JSAPI layer for adding editable, HTML-based text notes to JSAPI graphics.

## Usage

Create a text notes layer and add it to the map:

```
const hubTextNotesLayer = new HubTextNotesLayer({
  editable: true, // indicates notes should be editable using the `contenteditable` attribute
  textPlaceholder: 'type something', // placeholder text displayed for an empty note
  cssClass: 'map-note' // CSS class used to style the note
});

view.map.add(hubTextNotesLayer);
```

To add a text note for a feature called `graphic`:

```
// create the note
const note = this.hubTextNotesLayer.addNoteForGraphic(graphic);

// mark it as currently selected (adds `note-select` CSS class)
hubTextNotesLayer.setSelectedNoteForGraphic(graphic);
```

To influence where the note is placed in relation to the graphic, use the `placementHint` point parameter, and specify initial text content with `text`:

```
this.hubTextNotesLayer.addNoteForGraphic(graphic, {
  text: 'This is my note.',
  placementHint: event.mapPoint // use the location the user clicked, for a `MapView` `click` event
});
```

To update text note hover and selection states in conjunction with their attached graphics, call `note.setHoveredNoteForGraphic(graphic)` and `note.setSelectedNoteForGraphic(graphic)` methods from the appropriate JSAPI `MapView` handlers (e.g. `pointer-move`, `click`).
To programmatically focus a note for editing, use the `note.focus()` method.


## Installation and Loading

`yarn add hub-text-notes-layer`

To load the layer for use with the JSAPI, you need to configure the Dojo loader with the location of the AMD package. An example using `esri-loader`:

```
import { loadModules, setDefaultOptions } from 'esri-loader';

setDefaultOptions({
  dojoConfig: {
    async: true,
    packages: [{
      name: 'hub',
      location: 'path/to/hub-text-notes-layer/dist'
    }]
  }
});

const [HubTextNotesLayer] = await loadModules(['hub/HubTextNotesLayer']);
```
