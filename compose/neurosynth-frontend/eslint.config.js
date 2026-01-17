import eslint from '@eslint/js';
import teslint from 'typescript-eslint';
import eslintHooks from 'eslint-plugin-react-hooks';
import eslintCypress from 'eslint-plugin-cypress/flat';
import globals from 'globals';
import eslintReactRefresh from 'eslint-plugin-react-refresh';

export default [
    eslint.configs.recommended,
    ...teslint.configs.recommended,
    eslintCypress.configs.recommended,
    {
        languageOptions: {
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': eslintHooks,
            'react-refresh': eslintReactRefresh,
        },
        rules: {
            ...eslintHooks.configs.recommended.rules,
            'react-refresh/only-export-components': 'warn',
        },
    },
];
