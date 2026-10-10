export const CHUNK_RELOAD_AT_KEY = 'chunk-reload-at';

const CHUNK_RELOAD_GUARD_MS = 10_000;

/**
 * Reloads once when Vite cannot fetch a content-hashed chunk after a deploy.
 * preventDefault stops Vite from rethrowing, so Sentry does not report that failure.
 * A second failure inside the guard window is left alone so a missing chunk
 * cannot reload the page in a loop.
 */
export function handleVitePreloadError(
    event: Pick<Event, 'preventDefault'>,
    reload: () => void = () => window.location.reload()
): void {
    const lastReloadAt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_AT_KEY) ?? '0');
    const reloadedRecently = Number.isFinite(lastReloadAt) && Date.now() - lastReloadAt < CHUNK_RELOAD_GUARD_MS;
    if (reloadedRecently) return;

    window.sessionStorage.setItem(CHUNK_RELOAD_AT_KEY, String(Date.now()));
    event.preventDefault();
    reload();
}

export function installVitePreloadErrorHandler(): void {
    window.addEventListener('vite:preloadError', (event) => {
        handleVitePreloadError(event);
    });
}
