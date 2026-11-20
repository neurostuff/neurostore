import { defineConfig } from '@playwright/test';

const PORT = 3105;

// CI installs Playwright's Chromium; locally the installed Chrome is used.
export default defineConfig({
    testDir: 'e2e',
    testMatch: '*.e2e.ts',
    timeout: 30_000,
    use: {
        baseURL: `http://localhost:${PORT}`,
        channel: process.env.CI ? undefined : 'chrome',
        viewport: { width: 1440, height: 900 },
    },
    webServer: {
        command: `npx vite --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/review/e2e/index.html`,
        reuseExistingServer: !process.env.CI,
    },
});
