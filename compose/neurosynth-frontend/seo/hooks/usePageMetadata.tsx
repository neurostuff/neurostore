import { useEffect } from 'react';

type PageMetadata = {
    title: string;
    description: string;
    canonicalPath?: string;
    imagePath?: string;
    imageAlt?: string;
    type?: string;
    robots?: string;
    siteName?: string;
};

const DEFAULT_SITE_NAME = 'Neurosynth Compose';
const DEFAULT_IMAGE_PATH = '/static/brain-analysis.png';
const DEFAULT_IMAGE_ALT = 'Neurosynth Compose brain visualization';
const DEFAULT_OG_TYPE = 'website';

const normalizeUrl = (value: string) => value.replace(/\/$/, '');

const getBaseUrl = () => {
    const envValue = (import.meta.env?.VITE_APP_SITE_URL || '').trim();
    if (envValue) {
        return normalizeUrl(envValue);
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
        return normalizeUrl(window.location.origin);
    }
    return '';
};

const resolveUrl = (baseUrl: string, urlOrPath?: string) => {
    if (!urlOrPath) {
        return '';
    }
    if (/^https?:\/\//i.test(urlOrPath)) {
        return urlOrPath;
    }
    if (!baseUrl) {
        return urlOrPath;
    }
    const normalizedPath = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
    return `${baseUrl}${normalizedPath}`;
};

const ensureMetaTag = (selector: string, attributes: Record<string, string>) => {
    if (typeof document === 'undefined') {
        return;
    }
    let tag = document.head.querySelector(selector);
    if (!tag) {
        tag = document.createElement('meta');
        document.head.appendChild(tag);
    }
    Object.entries(attributes).forEach(([key, value]) => {
        tag?.setAttribute(key, value);
    });
};

const setMetaName = (name: string, content: string) => ensureMetaTag(`meta[name="${name}"]`, { name, content });

const setMetaProperty = (property: string, content: string) =>
    ensureMetaTag(`meta[property="${property}"]`, { property, content });

const setLinkTag = (rel: string, href: string) => {
    if (typeof document === 'undefined') {
        return;
    }
    let tag = document.head.querySelector(`link[rel="${rel}"]`);
    if (!tag) {
        tag = document.createElement('link');
        tag.setAttribute('rel', rel);
        document.head.appendChild(tag);
    }
    tag.setAttribute('href', href);
};

const usePageMetadata = ({
    title,
    description,
    canonicalPath,
    imagePath = DEFAULT_IMAGE_PATH,
    imageAlt = DEFAULT_IMAGE_ALT,
    type = DEFAULT_OG_TYPE,
    robots,
    siteName = DEFAULT_SITE_NAME,
}: PageMetadata) => {
    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const baseUrl = getBaseUrl();
        const canonical = resolveUrl(
            baseUrl,
            canonicalPath || (typeof window !== 'undefined' ? window.location.pathname : '')
        );
        const ogUrl = canonical || (typeof window !== 'undefined' ? window.location.href : '');
        const imageUrl = resolveUrl(baseUrl, imagePath);

        document.title = title;
        setMetaName('description', description);
        setMetaProperty('og:site_name', siteName);
        setMetaProperty('og:title', title);
        setMetaProperty('og:description', description);
        setMetaProperty('og:type', type);
        if (ogUrl) {
            setMetaProperty('og:url', ogUrl);
        }
        if (imageUrl) {
            setMetaProperty('og:image', imageUrl);
            setMetaProperty('og:image:alt', imageAlt);
            setMetaName('twitter:image', imageUrl);
            setMetaName('twitter:image:alt', imageAlt);
        }
        setMetaName('twitter:card', 'summary_large_image');
        setMetaName('twitter:title', title);
        setMetaName('twitter:description', description);

        if (canonical) {
            setLinkTag('canonical', canonical);
        }
        if (robots) {
            setMetaName('robots', robots);
        }
    }, [canonicalPath, description, imageAlt, imagePath, robots, siteName, title, type]);
};

export default usePageMetadata;
