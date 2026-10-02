import React from 'react';

const CHUNK_RELOAD_KEY = 'chunk-reload-attempted';

/**
 * Wraps React.lazy to handle "Failed to fetch dynamically imported module" errors
 * that occur when a new deployment replaces old content-hashed chunk files.
 *
 * On the first chunk load failure it forces a hard page reload so the browser
 * fetches the fresh HTML and new chunk URLs. A sessionStorage guard prevents
 * infinite reload loops if the chunk is genuinely missing for other reasons.
 */
function lazyWithRetry<T extends React.ComponentType<any>>(
    factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
    return React.lazy(() =>
        factory().catch((error: unknown) => {
            const alreadyRetried = sessionStorage.getItem(CHUNK_RELOAD_KEY);
            if (!alreadyRetried) {
                sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
                window.location.reload();
            }
            return Promise.reject(error);
        })
    );
}

export function clearChunkReloadFlag(): void {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}

export default lazyWithRetry;
