import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/HubTextNotesLayer.js',
  output: {
    file: 'dist/HubTextNotesLayer.js',
    format: 'amd'
  },
  plugins: [
    resolve(), // resolve and commonjs are needed for babel to incorporate corejs polyfills
    commonjs(),
    terser(),
    babel({
      presets: [
        [
          '@babel/preset-env', {
            targets: ['last 2 versions', 'ie >= 11'],
            useBuiltIns: 'usage',
            corejs: 3
          }
        ]
      ],
      plugins: ['@babel/plugin-proposal-class-properties'],
      exclude: 'node_modules/**'
    })    
  ]
};
