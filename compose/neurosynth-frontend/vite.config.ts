import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'url';

export default defineConfig({
    base: '',
    plugins: [react(), viteTsconfigPaths()],
    server: {
        open: true,
        port: 3000,
    },
    test: {
        globals: true,
        setupFiles: 'src/setupTests.ts',
        environment: 'jsdom',
    },
    // resolve: {
    //     alias: [
    //         {
    //             find: '', replacement: fileURLToPath(new URL('./src/', import.meta.url))
    //         }
    //     ]
    // }
});
