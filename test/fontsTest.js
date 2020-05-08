import chai from 'chai';
import { getFontSettings } from '../src/fonts';

const assert = chai.assert;

describe('fonts', () => {

  it('accepts a valid font configuration w/all props', () => {
    const fontExpect = { fontFamily: 'Avenir Next LT Pro', fontStyle: 'italic', fontWeight: 'bold', fontSize: '12px' };
    const fontOut = getFontSettings(fontExpect);
    assert.deepEqual(fontOut, fontExpect);
  });

  it('accepts a valid font configuration w/numeric weight', () => {
    const fontIn = { fontFamily: 'Avenir Next LT Pro', fontStyle: 'italic', fontWeight: 700, fontSize: '12px' };
    const fontExpect = { fontFamily: 'Avenir Next LT Pro', fontStyle: 'italic', fontWeight: 'bold', fontSize: '12px' };
    const fontOut = getFontSettings(fontIn);
    assert.deepEqual(fontOut, fontExpect);
  });

  it('accepts a valid font configuration w/family and defaults', () => {
    const fontIn = { fontFamily: 'Abril Fatface' };
    const fontExpect = { fontFamily: 'Abril Fatface', fontStyle: 'normal', fontWeight: 'normal', fontSize: '16px' };
    const fontOut = getFontSettings(fontIn);
    assert.deepEqual(fontOut, fontExpect);
  });

  it('accepts a valid font configuration w/quotes in family name', () => {
    const fontIn = { fontFamily: '"Vast Shadow"' };
    const fontExpect = { fontFamily: 'Vast Shadow', fontStyle: 'normal', fontWeight: 'normal', fontSize: '16px' };
    const fontOut = getFontSettings(fontIn);
    assert.deepEqual(fontOut, fontExpect);
  });

  it('accepts a valid font configuration w/multiple family names', () => {
    const fontIn = { fontFamily: 'Montserrat, Helvetica, sans-serif' };
    const fontExpect = { fontFamily: 'Montserrat', fontStyle: 'normal', fontWeight: 'normal', fontSize: '16px' };
    const fontOut = getFontSettings(fontIn);
    assert.deepEqual(fontOut, fontExpect);
  });

  it('rejects an invalid font configuration and applies all defaults', () => {
    const fontIn = { fontFamily: 'Abril Fatface', fontStyle: 'italic', fontWeight: 200  };
    const fontExpect = { fontFamily: 'Arial', fontStyle: 'normal', fontWeight: 'normal', fontSize: '16px' };
    const fontOut = getFontSettings(fontIn);
    assert.deepEqual(fontOut, fontExpect);
  });

  it('rejects an invalid font configuration and applies defaults but preserves size', () => {
    const fontIn = { fontFamily: 'Abril Fatface', fontStyle: 'italic', fontWeight: 200, fontSize: '14px'  };
    const fontExpect = { fontFamily: 'Arial', fontStyle: 'normal', fontWeight: 'normal', fontSize: '14px' };
    const fontOut = getFontSettings(fontIn);
    assert.deepEqual(fontOut, fontExpect);
  });

  it('rejects an empty font configuration and applies all defaults', () => {
    const fontIn = {};
    const fontExpect = { fontFamily: 'Arial', fontStyle: 'normal', fontWeight: 'normal', fontSize: '16px' };
    const fontOut = getFontSettings(fontIn);
    assert.deepEqual(fontOut, fontExpect);
  });

});
