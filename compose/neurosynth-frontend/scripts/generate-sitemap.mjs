import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { getSiteUrl, shouldGenerateSeoFiles } from '../seo/seo.config.js';
import { SEO_ROUTES } from '../seo/seo.routes.js';

const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const mode = modeIndex >= 0 ? args[modeIndex + 1] : process.env.VITE_APP_ENV;
const outDirIndex = args.indexOf('--outDir');
const outDir = outDirIndex >= 0 ? args[outDirIndex + 1] : 'dist';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDir, '..');

const env = { ...loadEnv(mode, projectRoot, ''), ...process.env };

if (!shouldGenerateSeoFiles(env, mode)) {
    console.log(`Skipping sitemap/robots generation: SEO output disabled`);
    process.exit(0);
}

const baseUrl = getSiteUrl(env);

const lastmod = new Date().toISOString();
const urlEntries = SEO_ROUTES.map((route) => {
    const loc = new URL(route.path, `${baseUrl}/`).toString();
    const changefreq = route.changefreq ? `    <changefreq>${route.changefreq}</changefreq>\n` : '';
    const priority = route.priority !== undefined ? `    <priority>${route.priority}</priority>\n` : '';
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n${changefreq}${priority}  </url>`;
}).join('\n');

// https://www.sitemaps.org/protocol.html
const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
const robots = [
    '# https://www.robotstxt.org/robotstxt.html',
    'User-agent: *',
    'Disallow:',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
].join('\n');

const outputDir = path.resolve(projectRoot, outDir);
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'sitemap.xml'), sitemap, 'utf8');
await fs.writeFile(path.join(outputDir, 'robots.txt'), robots, 'utf8');
