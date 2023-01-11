import babel from '@rollup/plugin-babel';

export default {
  input: 'src/HubTextNotesLayer.js',
  output: {
    file: 'dist/HubTextNotesLayer.mjs',
    format: 'es',
  },
  external: [
    /@arcgis\/core/
  ],
  plugins: [
    babel({
      presets: [
        [
          '@babel/preset-env', {
            targets: {
              // seems reasonable since this is meant to work w/ @arcgis/core
              esmodules: true,
            }
          }
        ]
      ],
      plugins: ['@babel/plugin-proposal-class-properties'],
      exclude: 'node_modules/**'
    })
  ]
};
