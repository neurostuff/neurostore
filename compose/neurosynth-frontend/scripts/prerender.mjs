import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Prerenderer from '@prerenderer/prerenderer';
import PuppeteerRenderer from '@prerenderer/renderer-puppeteer';
import { loadEnv } from 'vite';
import { getPrerenderEvent, shouldGenerateSeoFiles } from '../seo.config.js';
import { SEO_ROUTES } from '../seo.routes.js';

const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const mode = modeIndex >= 0 ? args[modeIndex + 1] : process.env.NODE_ENV || 'production';
const outDirIndex = args.indexOf('--outDir');
const outDir = outDirIndex >= 0 ? args[outDirIndex + 1] : 'dist';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDir, '..');
const staticDir = path.resolve(projectRoot, outDir);
const env = { ...loadEnv(mode, projectRoot, ''), ...process.env };
const shouldSkip = env.VITE_SKIP_PRERENDER === 'true' || env.SKIP_PRERENDER === 'true';

if (shouldSkip) {
    console.log('Skipping prerender: SKIP_PRERENDER is enabled.');
    process.exit(0);
}
if (!shouldGenerateSeoFiles(env, mode)) {
    console.log('Skipping prerender: SEO output disabled for this mode.');
    process.exit(0);
}

const routes = SEO_ROUTES.map((route) => route.path);
const renderAfterDocumentEvent = getPrerenderEvent(env);
const fallbackMs = Number(env.VITE_PRERENDER_FALLBACK_MS || 10000);
const timeoutMs = Number(env.VITE_PRERENDER_TIMEOUT_MS || fallbackMs + 5000);

const prerenderer = new Prerenderer({
    staticDir,
    routes,
    renderer: new PuppeteerRenderer({
        renderAfterDocumentEvent,
        renderAfterTime: Number.isFinite(fallbackMs) ? fallbackMs : 10000,
        timeout: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }),
});

try {
    await prerenderer.initialize();
    await prerenderer.renderRoutes();
} finally {
    await prerenderer.destroy();
}
