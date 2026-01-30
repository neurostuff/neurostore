export const DEFAULT_PRERENDER_EVENT = 'prerender-ready';

export const getSiteUrl = (env = {}) => {
    const raw = env.VITE_APP_SITE_URL || 'http://localhost:3000';
    return raw.replace(/\/$/, '');
};

export const shouldGenerateSeoFiles = (env = {}, mode) => {
    if (env.VITE_GENERATE_SEO === 'true') return true;
    else if (env.VITE_GENERATE_SEO === 'false') return false;
    else return mode === 'production' || env.VITE_APP_ENV === 'PROD';
};
