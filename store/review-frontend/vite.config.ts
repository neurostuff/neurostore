import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

const fixturesDir = path.resolve(__dirname, 'fixtures');

function serveFixtures(): Plugin {
    const middleware = (req: { url?: string }, res: NodeJS.WritableStream & { statusCode: number; setHeader: (k: string, v: string) => void }, next: () => void) => {
        const match = req.url?.match(/^\/review\/fixtures\/([A-Za-z0-9_.-]+\.json)$/);
        const file = match && path.join(fixturesDir, match[1]);
        if (!file || !existsSync(file)) return next();
        res.setHeader('Content-Type', 'application/json');
        createReadStream(file).pipe(res);
    };
    return {
        name: 'review-fixtures',
        configureServer: (server) => void server.middlewares.use(middleware),
        configurePreviewServer: (server) => void server.middlewares.use(middleware),
    };
}

export default defineConfig({
    base: '/review/',
    plugins: [react(), serveFixtures()],
    server: { port: 3001, fs: { allow: ['.', '../../packages'] } },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: 'src/test/setup.ts',
    },
});
