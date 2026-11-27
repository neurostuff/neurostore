import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The author's page: its own bundle, so the public page ships none of the admin panel.
const apiProxy = process.env.OUTREACH_API_PROXY ?? 'http://localhost:8000';

export default defineConfig({
    root: path.resolve(__dirname, 'share'),
    base: '/share/',
    envDir: __dirname,
    plugins: [react()],
    resolve: { dedupe: ['react', 'react-dom', '@mui/material', '@emotion/react'] },
    build: { outDir: path.resolve(__dirname, 'dist-share'), emptyOutDir: true },
    server: {
        port: 3003,
        fs: { allow: [__dirname, path.resolve(__dirname, '../../packages')] },
        proxy: { '/api': { target: apiProxy, changeOrigin: true } },
    },
});
