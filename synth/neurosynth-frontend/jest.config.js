/**
 * This config file is for jest runner, as CRA does not support the rootDir, roots, or modulePaths properties.
 * Without this config, jest runner cannot recognize absolute imports where our root directory is neurosynth-frontend/src.
 */

module.exports = {
    moduleNameMapper: {
        '\\.(css|less)$': '<rootDir>/testing/stylemock.js',
    },
    resetMocks: false,
    rootDir: 'src',
    roots: ['<rootDir>'],
    modulePaths: ['<rootDir>'],
};
