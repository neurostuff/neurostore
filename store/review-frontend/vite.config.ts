import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { configDefaults, defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

const fixturesDir = path.resolve(__dirname, 'fixtures');
const schemasDir = path.resolve(__dirname, 'src/test/golden/schemas');
const SERIAL = ['src/pages/ReviewPage.test.tsx'];
const PERF = ['src/**/*.perf.test.tsx'];
const PACKAGES = ['../../packages/coordinate-table/src/**/*.test.{ts,tsx}'];

function serveFixtures(): Plugin {
    const middleware = (req: { url?: string }, res: NodeJS.WritableStream & { statusCode: number; setHeader: (k: string, v: string) => void }, next: () => void) => {
        const match = req.url?.match(/^\/review\/fixtures\/(schemas\/)?([A-Za-z0-9_.-]+\.json)$/);
        const file = match && path.join(match[1] ? schemasDir : fixturesDir, match[2]);
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

const projects = (mode: string) =>
    mode === 'perf'
        ? [{ extends: true as const, test: { name: 'perf', include: PERF, fileParallelism: false } }]
        : [
              {
                  extends: true as const,
                  test: {
                      name: 'unit',
                      include: [...configDefaults.include, ...PACKAGES],
                      exclude: [...configDefaults.exclude, ...SERIAL, ...PERF],
                      sequence: { groupOrder: 0 },
                  },
              },
              {
                  extends: true as const,
                  test: { name: 'serial', include: SERIAL, sequence: { groupOrder: 1 }, fileParallelism: false },
              },
          ];

// The timing tests are a project only under `--mode perf` (npm run test:perf). As a third project they would run in a
// bare `vitest run`, and `npm run test` would need --project flags to leave them out, so the two would differ.
export default defineConfig(({ mode }) => ({
    base: '/review/',
    plugins: [react(), serveFixtures()],
    // The shared packages under ../../packages have no node_modules: their imports resolve from this app's.
    resolve: {
        dedupe: [
            'react',
            'react-dom',
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            'handsontable',
            '@handsontable/react-wrapper',
            '@testing-library/react',
        ],
    },
    server: { port: 3001, fs: { allow: ['.', '../../packages'] } },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: 'src/test/setup.ts',
        projects: projects(mode),
    },
}));
