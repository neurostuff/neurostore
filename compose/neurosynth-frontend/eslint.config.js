import tsParser from '@typescript-eslint/parser';
import eslint from '@eslint/js';
import teslint from 'typescript-eslint';
import eslintHooks from 'eslint-plugin-react-hooks';
import eslintCypress from 'eslint-plugin-cypress/flat';
import eslintPrettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import eslintReactRefresh from 'eslint-plugin-react-refresh';

export default [
    eslint.configs.recommended,
    ...teslint.configs.recommended,
    eslintCypress.configs.recommended,
    eslintPrettier,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
            },
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: {
                    modules: true,
                },
                ecmaVersion: 2020,
                project: './tsconfig.json',
            },
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
