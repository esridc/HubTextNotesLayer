var babel = require('rollup-plugin-babel');
var resolve = require('rollup-plugin-node-resolve');
var commonjs = require('rollup-plugin-commonjs');

module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: ['mocha'],
        files: [
            {
                pattern: 'test/**/*.js'
            },
            'test/notes.css'
        ],

        preprocessors: {
            'test/**/*.js' : ['rollup']
        },

        rollupPreprocessor: {
            output: {
                format: 'umd',
                name: 'HubNotesLayerTestSuite'
            },
            // treeshake: false, // treeshaking can remove test code we need!
            plugins: [
              resolve(),
              commonjs(),
              babel({
                exclude: ['node_modules/**'],
                plugins: ['@babel/plugin-proposal-class-properties']
              })
            ]
        },

        plugins: [
            'karma-rollup-preprocessor',
            'karma-mocha',
            'karma-chrome-launcher',
            'karma-mocha-reporter'
        ],
        reporters: ['mocha'],

        port: 9876,
        logLevel: config.LOG_INFO,
        browsers: ['Chrome'],
        autoWatch: false,
        singleRun: true
    });
};
