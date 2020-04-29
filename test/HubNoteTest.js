// const chai = require('chai');
// const HubNote = require('../src/HubNote');
import chai from 'chai';
import HubNote from '../src/HubNote';

const assert = chai.assert;

// TODO move to fixtures
const graphic = {
  "geometry": {
    "type": "polygon",
    "spatialReference": {
      "latestWkid": 3857,
      "wkid": 102100
    },
    "rings": [
      [
        [
          -8565347.170438128,
          4709851.849278797
        ],
        [
          -8565012.568093264,
          4710213.193386729
        ],
        [
          -8562596.889275528,
          4709556.014092763
        ],
        [
          -8561980.914317122,
          4708979.750559207
        ],
        [
          -8561634.111159492,
          4708100.874024999
        ],
        [
          -8561538.564874137,
          4707287.386979833
        ],
        [
          -8562456.107795699,
          4706358.199354743
        ],
        [
          -8563918.861708077,
          4705409.454599368
        ],
        [
          -8564760.714056708,
          4705500.223570457
        ],
        [
          -8565347.170438128,
          4709851.849278797
        ]
      ]
    ],
    // Shimmed data (result of centroid getter on polygon)
    "centroid": {
      "spatialReference": {
        "latestWkid": 3857,
        "wkid": 102100
      },
      "x": -8563600.549432032,
      "y": 4707872.199839918,
      // Shimmed method
      clone() {
        return {
          "x": -8563600.549432032,
          "y": 4707872.199839918,
        };
      } 
    }
  },
  "symbol": {
    "type": "esriSFS",
    "color": [
      0,
      118,
      201,
      20
    ],
    "outline": {
      "type": "esriSLS",
      "color": [
        0,
        118,
        201,
        255
      ],
      "width": 6.75,
      "style": "esriSLSSolid"
    },
    "style": "esriSFSSolid"
  },
  "attributes": {}
};

describe('HubNote', () => {

  it('returns an new instanceof', () => {
    const note = new HubNote({});
    assert.instanceOf(note, HubNote);
  });

  it('creates a text element', () => {
    const surface = document.createElement('div');
    const view = {
      surface,
      zoom: 10,
      resolution: 0.01,
      toScreen({ x, y }) { return { x: x/2, y: y/2} }
    };
 
    const note = new HubNote({ graphic, text: 'this is a test note' });
    note.createTextElement(view);

    assert.instanceOf(note.textElement, HTMLElement);
    assert.propertyVal(note, 'text', 'this is a test note');
  });

});
