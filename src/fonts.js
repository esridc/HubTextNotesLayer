export function getFontSettings({ fontFamily, fontStyle, fontWeight, fontSize }) {
  // TextSymbol supports only bold and normal. Also bolder and lighter but not for 2D Feature Layers at the moment.
  fontWeight = fontWeight >= 700 ? 'bold' : DEFAULT_FONT.weight;
  fontStyle = fontStyle || DEFAULT_FONT.style;
  fontSize = fontSize || DEFAULT_FONT.size;
  
  // strip out extraneous characters such as quotes that interfere with matching below
  const stripFontFamily = fontFamily.match(/([\w\d\s]+)/);
  if (stripFontFamily) {
    fontFamily = stripFontFamily[0];
  }

  if (!isFontSupported({ family: fontFamily, style: fontStyle, weight: fontWeight })) {
    fontFamily = DEFAULT_FONT.family;
    fontSize = DEFAULT_FONT.size;
    fontStyle = DEFAULT_FONT.style;
    fontWeight = DEFAULT_FONT.weight;
  }
  return { fontFamily, fontStyle, fontWeight, fontSize };
}

function isFontSupported ({ family, style, weight }) {
  return Boolean(SUPPORTED_FONTS.find(font =>{
    return font.family === family && font.style === style && font.weight === weight;
  }));
}

const DEFAULT_FONT = {
  family: 'Arial', style: 'normal', weight: 'normal', size: '16px'
};

// List of supported JSAPI fonts for TextSymbol, from:
// https://developers.arcgis.com/javascript/latest/guide/labeling/index.html#fonts-for-featurelayer%2C-csvlayer%2C-and-streamlayer
const SUPPORTED_FONTS = [
  { family: 'Abril Fatface', style: 'normal', weight: 'normal' },
  { family: 'Alegreya', style: 'normal', weight: 'bold' },
  { family: 'Alegreya', style: 'italic', weight: 'bold' },
  { family: 'Alegreya', style: 'italic', weight: 'normal' },
  { family: 'Alegreya', style: 'normal', weight: 'normal' },
  { family: 'Alegreya Sans', style: 'italic', weight: 'normal' },
  { family: 'Alegreya SC', style: 'normal', weight: 'bold' },
  { family: 'Alegreya SC', style: 'italic', weight: 'normal' },
  { family: 'Alegreya SC', style: 'normal', weight: 'normal' },
  { family: 'Amarante', style: 'normal', weight: 'normal' },
  { family: 'Amatic SC', style: 'normal', weight: 'bold' },
  { family: 'Arial', style: 'normal', weight: 'bold' },
  { family: 'Arial', style: 'italic', weight: 'bold' },
  { family: 'Arial', style: 'italic', weight: 'normal' },
  { family: 'Arial', style: 'normal', weight: 'normal' },
  { family: 'Arial Unicode MS', style: 'normal', weight: 'bold' },
  { family: 'Arial Unicode MS', style: 'normal', weight: 'normal' },
  { family: 'Atomic Age', style: 'normal', weight: 'normal' },
  { family: 'Audiowide', style: 'normal', weight: 'normal' },
  { family: 'Avenir Next LT Pro', style: 'normal', weight: 'bold' },
  { family: 'Avenir Next LT Pro', style: 'italic', weight: 'bold' },
  { family: 'Avenir Next LT Pro Demi', style: 'italic', weight: 'normal' },
  { family: 'Avenir Next LT Pro', style: 'italic', weight: 'normal' },
  { family: 'Avenir Next LT Pro Light', style: 'italic', weight: 'normal' },
  { family: 'Avenir Next LT Pro', style: 'normal', weight: 'normal' },
  { family: 'Avenir Next LT Pro Light', style: 'italic', weight: 'normal' },
  { family: 'Avenir Next LT Pro Light', style: 'normal', weight: 'normal' },
  { family: 'Avenir Next LT Pro Medium', style: 'normal', weight: 'bold' },
  { family: 'Avenir Next LT Pro Medium', style: 'italic', weight: 'bold' },
  { family: 'Avenir Next LT Pro Regular', style: 'normal', weight: 'bold' },
  { family: 'Avenir Next LT Pro Regular', style: 'italic', weight: 'bold' },
  { family: 'Avenir Next LT Pro Regular', style: 'italic', weight: 'normal' },
  { family: 'Avenir Next LT Pro Regular', style: 'normal', weight: 'normal' },
  { family: 'Belleza', style: 'normal', weight: 'normal' },
  { family: 'Black Ops One', style: 'normal', weight: 'normal' },
  { family: 'Cabin Sketch', style: 'normal', weight: 'bold' },
  { family: 'Cabin Sketch', style: 'normal', weight: 'normal' },
  { family: 'Coming Soon', style: 'normal', weight: 'normal' },
  { family: 'CalciteWebCoreIcons', style: 'normal', weight: 'normal' },
  { family: 'Homemade Apple', style: 'normal', weight: 'normal' },
  { family: 'IM FELL DW Pica PRO', style: 'italic', weight: 'normal' },
  { family: 'IM FELL DW Pica PRO', style: 'normal', weight: 'normal' },
  { family: 'Josefin Sans', style: 'normal', weight: 'normal' },
  { family: 'Josefin Sans Semibold', style: 'italic', weight: 'normal' },
  { family: 'Josefin Slab', style: 'normal', weight: 'bold' },
  { family: 'Josefin Slab', style: 'italic', weight: 'bold' },
  { family: 'Josefin Slab', style: 'italic', weight: 'normal' },
  { family: 'Josefin Slab Light', style: 'italic', weight: 'normal' },
  { family: 'Josefin Slab', style: 'normal', weight: 'normal' },
  { family: 'Josefin Slab Semibold', style: 'italic', weight: 'normal' },
  { family: 'Josefin Slab Thin', style: 'italic', weight: 'normal' },
  { family: 'Just Another Hand', style: 'normal', weight: 'normal' },
  { family: 'Kranky', style: 'normal', weight: 'normal' },
  { family: 'Life Savers', style: 'normal', weight: 'bold' },
  { family: 'Loved By The King', style: 'normal', weight: 'normal' },
  { family: 'Merriweather', style: 'normal', weight: 'bold' },
  { family: 'Merriweather', style: 'italic', weight: 'bold' },
  { family: 'Merriweather', style: 'italic', weight: 'normal' },
  { family: 'Merriweather', style: 'normal', weight: 'normal' },
  { family: 'Montserrat', style: 'normal', weight: 'bold' },
  { family: 'Montserrat', style: 'italic', weight: 'normal' },
  { family: 'Montserrat Medium', style: 'italic', weight: 'normal' },
  { family: 'Montserrat', style: 'normal', weight: 'normal' },
  { family: 'Montserrat Semibold', style: 'italic', weight: 'normal' },
  { family: 'Noto Sans', style: 'normal', weight: 'bold' },
  { family: 'Noto Sans', style: 'italic', weight: 'bold' },
  { family: 'Noto Sans', style: 'italic', weight: 'normal' },
  { family: 'Noto Sans', style: 'normal', weight: 'normal' },
  { family: 'Noto Serif', style: 'normal', weight: 'bold' },
  { family: 'Noto Serif', style: 'italic', weight: 'bold' },
  { family: 'Noto Serif', style: 'italic', weight: 'normal' },
  { family: 'Noto Serif', style: 'normal', weight: 'normal' },
  { family: 'Old Standard TT', style: 'normal', weight: 'bold' },
  { family: 'Old Standard TT', style: 'italic', weight: 'normal' },
  { family: 'Old Standard TT', style: 'normal', weight: 'normal' },
  { family: 'Orbitron', style: 'normal', weight: 'bold' },
  { family: 'Orbitron', style: 'normal', weight: 'normal' },
  { family: 'Oregano', style: 'italic', weight: 'normal' },
  { family: 'Oregano', style: 'normal', weight: 'normal' },
  { family: 'Oswald', style: 'normal', weight: 'bold' },
  { family: 'Oswald', style: 'normal', weight: 'normal' },
  { family: 'Pacifico', style: 'normal', weight: 'normal' },
  { family: 'Palatino Linotype', style: 'normal', weight: 'normal' },
  { family: 'Playfair Display Black', style: 'normal', weight: 'normal' },
  { family: 'Playfair Display', style: 'normal', weight: 'bold' },
  { family: 'Playfair Display', style: 'italic', weight: 'bold' },
  { family: 'Playfair Display', style: 'italic', weight: 'normal' },
  { family: 'Playfair Display', style: 'normal', weight: 'normal' },
  { family: 'Playfair Display SC', style: 'normal', weight: 'bold' },
  { family: 'Playfair Display SC', style: 'normal', weight: 'normal' },
  { family: 'Redressed', style: 'normal', weight: 'normal' },
  { family: 'Risque', style: 'normal', weight: 'normal' },
  { family: 'Roboto Condensed', style: 'italic', weight: 'normal' },
  { family: 'Roboto Condensed Light', style: 'italic', weight: 'normal' },
  { family: 'Rye', style: 'normal', weight: 'normal' },
  { family: 'Special Elite', style: 'normal', weight: 'normal' },
  { family: 'Syncopate', style: 'normal', weight: 'bold' },
  { family: 'Syncopate', style: 'normal', weight: 'normal' },
  { family: 'Tangerine', style: 'normal', weight: 'normal' },
  { family: 'Ubuntu', style: 'normal', weight: 'bold' },
  { family: 'Ubuntu', style: 'italic', weight: 'bold' },
  { family: 'Ubuntu Condensed', style: 'normal', weight: 'normal' },
  { family: 'Ubuntu', style: 'italic', weight: 'normal' },
  { family: 'Ubuntu Light', style: 'normal', weight: 'bold' },
  { family: 'Ubuntu Light', style: 'italic', weight: 'bold' },
  { family: 'Ubuntu Light', style: 'italic', weight: 'normal' },
  { family: 'Ubuntu Light', style: 'normal', weight: 'normal' },
  { family: 'Ubuntu Medium', style: 'italic', weight: 'normal' },
  { family: 'Ubuntu Mono', style: 'normal', weight: 'bold' },
  { family: 'Ubuntu Mono', style: 'italic', weight: 'bold' },
  { family: 'Ubuntu Mono', style: 'italic', weight: 'normal' },
  { family: 'Ubuntu Mono', style: 'normal', weight: 'normal' },
  { family: 'Ubuntu', style: 'normal', weight: 'normal' },
  { family: 'UnifrakturCook', style: 'normal', weight: 'bold' },
  { family: 'Vast Shadow', style: 'normal', weight: 'normal' },
  { family: 'Walter Turncoat', style: 'normal', weight: 'normal' }
];
