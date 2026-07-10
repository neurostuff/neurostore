import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Prerenderer from '@prerenderer/prerenderer';
import PuppeteerRenderer from '@prerenderer/renderer-puppeteer';
import { loadEnv } from 'vite';
import { shouldGenerateSeoFiles, DEFAULT_PRERENDER_EVENT } from '../seo/seo.config.js';
import { SEO_ROUTES } from '../seo/seo.routes.js';

const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const mode = modeIndex >= 0 ? args[modeIndex + 1] : process.env.NODE_ENV || 'production';
const outDirIndex = args.indexOf('--outDir');
const outDir = outDirIndex >= 0 ? args[outDirIndex + 1] : 'dist';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDir, '..');
const staticDir = path.resolve(projectRoot, outDir);
const env = { ...loadEnv(mode, projectRoot, ''), ...process.env };

if (!shouldGenerateSeoFiles(env, mode)) {
    console.log(`Skipping prerender: SEO output disabled`);
    process.exit(0);
}

const routes = SEO_ROUTES.map((route) => route.path);
const fallbackMs = Number(env.VITE_PRERENDER_FALLBACK_MS || 10000);
const timeoutMs = Number(env.VITE_PRERENDER_TIMEOUT_MS || fallbackMs + 5000);

const prerenderer = new Prerenderer({
    staticDir,
    renderer: new PuppeteerRenderer({
        renderAfterDocumentEvent: DEFAULT_PRERENDER_EVENT,
        renderAfterTime: Number.isFinite(fallbackMs) ? fallbackMs : 10000,
        timeout: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }),
});

try {
    await prerenderer.initialize();
    const renderedRoutes = await prerenderer.renderRoutes(routes);

    for (const route of routes) {
        const renderedRoute = renderedRoutes.find((r) => r.route === route);
        if (renderedRoute) {
            let filePath;
            if (route === '/') {
                filePath = path.join(staticDir, 'index.html');
            } else {
                const routePath = route.replace(/^\//, '').replace(/\/$/, '');
                filePath = path.join(staticDir, routePath, 'index.html');
            }

            const dirPath = path.dirname(filePath);

            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            fs.writeFileSync(filePath, renderedRoute.html);
            console.log(`Written: ${filePath}`);
        }
    }
} finally {
    await prerenderer.destroy();
}
