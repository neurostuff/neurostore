import { defineConfig } from 'cypress';

export default defineConfig({
    // component: {
    //     setupNodeEvents(on, config) {},
    //     supportFile: 'cypress/support/index.js',
    //     specPattern: 'src/**/*.spec.{js,ts,jsx,tsx}',
    // },
    projectId: 'ot8oex',
    e2e: {
        setupNodeEvents(on, config) {
            // implement node event listeners here
            on('task', {
                log(message) {
                    console.log(message);
                    return null;
                },
            });
        },
        baseUrl: 'http://localhost:3000',
        defaultCommandTimeout: 10000,
        requestTimeout: 10000,
    },
    env: {
        auth0Username: 'test-user@gmail.com',
        auth0Password: 'password',
        auth0ClientId: process.env.VITE_APP_AUTH0_CLIENT_ID,
        auth0ClientSecret: process.env.VITE_APP_AUTH0_CLIENT_SECRET,
        auth0Domain: process.env.VITE_APP_AUTH0_DOMAIN,
        auth0Audience: process.env.VITE_APP_AUTH0_AUDIENCE,
        neurostoreAPIBaseURL: process.env.VITE_APP_NEUROSTORE_API_DOMAIN,
        neurosynthAPIBaseURL: process.env.VITE_APP_NEUROSYNTH_API_DOMAIN,
    },
});
