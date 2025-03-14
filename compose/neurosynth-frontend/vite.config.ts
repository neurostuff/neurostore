import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [react(), viteTsconfigPaths()],
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
});
