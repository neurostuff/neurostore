import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// In development the API is proxied, so the panel and the API share an origin and the
// dev password needs no CORS. OUTREACH_API_PROXY names the store backend.
const apiProxy = process.env.OUTREACH_API_PROXY ?? 'http://localhost:8000';

export default defineConfig({
    base: '/outreach/',
    plugins: [react()],
    // The shared packages under ../../packages have no node_modules: their imports resolve from this app's.
    resolve: { dedupe: ['react', 'react-dom', '@mui/material', '@emotion/react'] },
    server: {
        port: 3002,
        fs: { allow: ['.', '../../packages'] },
        proxy: { '/api': { target: apiProxy, changeOrigin: true } },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: 'src/test/setup.ts',
    },
});
