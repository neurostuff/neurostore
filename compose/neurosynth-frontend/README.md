# Introduction

Welcome to the neurosynth frontend.

# Testing

This repository is being tested using cypress and the react testing library.
Cypress is utilized for integration testing, while the react testing library is used for unit testing of individual components.
Cypress bundles other tools with it, such as mocha, sinon and chai.
In this application, we utilize the additional testing-library/user-event module in order to simulate user events such as typing and clicking.

### `npm run cy:e2e-headless` or `npm run cy:e2e-browser`

Integration tests can be run using the command: npm run cy:e2e-headless or npm run cy:e2e-browser.

### `npm test`

Unit tests can be run using the command: npm run test.

# Prettier

This project uses prettier and eslint in order to enforce uniform coding styles throughout the repo.
In order to take advantage of these features, you need to install the relevant node modules as specified
in the package.json devDependencies.

The rules for code styles are specified in the .eslintrc file.

This project has been setup and developed using vscode. Please note that other vscode settings may need to
be applied or will be helpful. In the settings.json, you may need to add the following settings:

```
"editor.formatOnSave": true,
"[typescriptreact]": {
    "editor.defaultFormatter": "dbaeumer.vscode-eslint"
},
"[typescript]": {
    "editor.defaultFormatter": "dbaeumer.vscode-eslint"
},
"editor.defaultFormatter": "dbaeumer.vscode-eslint",
"editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
}
```

# Getting Started

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

In order to get started locally, this project expects the following env config files:
`.env.dev`
`.env.staging`

## Available Scripts

In the project directory, you can run:

### `npm run start:dev`

This expects a `.env.dev` file at the root of the project.
See .env.example for an example .env file.

This should point to the development server.

Runs the app in the development mode with the local development configs.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm run start:staging`

This expects a `.env.staging` file at the root of the project.
See .env.example for an example .env file.

This should point to the neurosynth staging server to access the backend data.

Runs the app in the development mode with the local development configs.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build:dev`

This expects a `.env.dev` file at the root of the project.
See .env.example for an example .env file.

Builds the app for production to the `build` folder with the dev configs.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run build:staging`

This expects a `.env.staging` file at the root of the project.
See .env.example for an example .env file.

Builds the app for production to the `build` folder with the staging configs.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
