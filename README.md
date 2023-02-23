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

`yarn add @esri/hub-text-notes-layer`

**NOTE: as of v2.0.0 this package has a peer dependency on `@arcgis/core@4.25`, so you must have that already installed**

Then you can `import` the layer class:

```js
import HubTextNotesLayer from '@esri/hub-text-notes-layer';
```

If you need to use this with an AMD build of the ArcGIS API, you should install a pre-1.0.0 version with `yarn add @esri/hub-text-notes-layer@^0.7` and then see [these instructions](https://github.com/esridc/HubTextNotesLayer/blob/f5a1afa3762617cb50f1cdd60dbc63f71373490e/README.md#installation-and-loading) for how you can configure Dojo to load the layer class.
