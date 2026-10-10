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
            ecmaVersion: 2022,
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2022,
            },
        },
        plugins: {
            'react-hooks': eslintHooks,
            'react-refresh': eslintReactRefresh,
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react-refresh/only-export-components': 'warn',
        },
    },
];
