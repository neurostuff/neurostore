import { CHUNK_RELOAD_AT_KEY, handleVitePreloadError, installVitePreloadErrorHandler } from './vitePreloadError.helpers';

function createPreloadErrorEvent(): Event {
    return new Event('vite:preloadError', { cancelable: true });
}

describe('vite preload error', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });

    it('reloads on the first preload failure and cancels the error', () => {
        const reload = vi.fn();
        const event = createPreloadErrorEvent();

        handleVitePreloadError(event, reload);

        expect(reload).toHaveBeenCalledOnce();
        expect(event.defaultPrevented).toBe(true);
        expect(window.sessionStorage.getItem(CHUNK_RELOAD_AT_KEY)).not.toBeNull();
    });

    it('does not reload or cancel the error when a preload failed moments ago', () => {
        window.sessionStorage.setItem(CHUNK_RELOAD_AT_KEY, String(Date.now()));
        const reload = vi.fn();
        const event = createPreloadErrorEvent();

        handleVitePreloadError(event, reload);

        expect(reload).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('reloads again after the guard window has passed', () => {
        window.sessionStorage.setItem(CHUNK_RELOAD_AT_KEY, String(Date.now() - 60_000));
        const reload = vi.fn();
        const event = createPreloadErrorEvent();

        handleVitePreloadError(event, reload);

        expect(reload).toHaveBeenCalledOnce();
        expect(event.defaultPrevented).toBe(true);
    });

    it('cancels vite:preloadError only when the installed listener reloads', () => {
        const reload = vi.fn();
        vi.stubGlobal('location', { ...window.location, reload });
        let listener: EventListener | undefined;
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((type, callback) => {
            if (type === 'vite:preloadError' && typeof callback === 'function') {
                listener = callback;
            }
        });

        installVitePreloadErrorHandler();
        addEventListenerSpy.mockRestore();

        const firstEvent = createPreloadErrorEvent();
        listener?.(firstEvent);

        expect(reload).toHaveBeenCalledOnce();
        expect(firstEvent.defaultPrevented).toBe(true);

        const secondEvent = createPreloadErrorEvent();
        listener?.(secondEvent);

        expect(reload).toHaveBeenCalledOnce();
        expect(secondEvent.defaultPrevented).toBe(false);
        vi.unstubAllGlobals();
    });
});
