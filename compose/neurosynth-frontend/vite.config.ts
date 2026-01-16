import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import { loadEnv } from 'vite';

export default ({ mode }) => {
    process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
    const isProduction = process.env.VITE_APP_ENV === 'PROD';

    return defineConfig({
        plugins: [
            react(),
            viteTsconfigPaths(),
            sentryVitePlugin({
                org: 'neurosynth',
                project: 'javascript-react',
                authToken: process.env.VITE_SENTRY_AUTH_TOKEN,
                telemetry: isProduction,
            }),
        ],

        server: {
            host: 'localhost',
            open: true,
            port: 3000,
        },

        test: {
            globals: true,
            setupFiles: 'src/setupTests.ts',
            environment: 'jsdom',
        },

        preview: {
            port: 3000,
            host: true,
        },

        build: {
            sourcemap: true,
        },
    });
};
