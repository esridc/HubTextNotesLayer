
export function createView () {
  return {
    surface: document.createElement('div'),
    zoom: 10,
    resolution: 0.01,
    toScreen({ x, y }) { return { x: x/2, y: y/2} }
  };
}

export function createNote ({ graphic, text }) {
  const view = createView();
  const note = new HubNote({ graphic, text });
  note.createElements(view);
  return note;
}
