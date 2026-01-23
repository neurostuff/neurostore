const DEFAULT_PRERENDER_EVENT = 'prerender-ready';

const isTrue = (value) => value === 'true';

export const getPrerenderEvent = (env = {}) => {
    const eventName = env.VITE_PRERENDER_EVENT;
    return typeof eventName === 'string' && eventName.length > 0 ? eventName : DEFAULT_PRERENDER_EVENT;
};

export const getSiteUrl = (env = {}) => {
    const raw =
        env.VITE_APP_SITE_URL || env.VITE_SITE_URL || env.SITE_URL || env.PUBLIC_SITE_URL || 'http://localhost:3000';
    return raw.replace(/\/$/, '');
};

export const shouldGenerateSeoFiles = (env = {}, mode = 'production') => {
    if (isTrue(env.VITE_GENERATE_SEO) || isTrue(env.GENERATE_SEO)) {
        return true;
    }
    if (isTrue(env.VITE_SKIP_SEO) || isTrue(env.SKIP_SEO)) {
        return false;
    }

    const effectiveMode = mode || env.NODE_ENV || 'production';
    const appEnv = env.VITE_APP_ENV || env.APP_ENV;
    return effectiveMode === 'production' || appEnv === 'PROD';
};
