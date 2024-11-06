module.exports = {
    root: true,
    env: { browser: true, es2020: true },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:react-hooks/recommended",
        "prettier",
        "plugin:cypress/recommended",
    ],
    plugins: ["@typescript-eslint", "prettier"],
    ignorePatterns: ["dist", ".eslintrc"],
    parser: "@typescript-eslint/parser",
    rules: {
        "react-refresh/only-export-components": [
            "warn",
            { allowConstantExport: true },
        ],
        indent: "off",
        "prettier/prettier": 4,
    },
};
