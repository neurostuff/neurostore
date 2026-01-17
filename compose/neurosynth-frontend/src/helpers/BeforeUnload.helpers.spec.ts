import { EUnloadStatus, hasUnsavedChanges, setUnloadHandler, unsetUnloadHandler } from './BeforeUnload.helpers';

describe('BeforeUnload helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
    });

    it('should set the unload handler for the project store', () => {
        const spy = vi.spyOn(window, 'addEventListener');
        setUnloadHandler('project');

        expect(window.sessionStorage.getItem(EUnloadStatus.PROJECTSTORE)).toBe('true');
        expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
        expect(spy).toHaveBeenCalledWith('unload', expect.any(Function));

        // cleanup
        unsetUnloadHandler('project');
    });

    it('should set the unload handler for the study store', () => {
        const spy = vi.spyOn(window, 'addEventListener');
        setUnloadHandler('study');

        expect(window.sessionStorage.getItem(EUnloadStatus.STUDYSTORE)).toBe('true');
        expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
        expect(spy).toHaveBeenCalledWith('unload', expect.any(Function));

        // cleanup
        unsetUnloadHandler('study');
    });

    it('should set the unload handler for the annotation store', () => {
        const spy = vi.spyOn(window, 'addEventListener');
        setUnloadHandler('annotation');

        expect(window.sessionStorage.getItem(EUnloadStatus.ANNOTATIONSTORE)).toBe('true');
        expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
        expect(spy).toHaveBeenCalledWith('unload', expect.any(Function));

        // cleanup
        unsetUnloadHandler('annotation');
    });

    it('should remove the unload handler when all stores are cleared', () => {
        const spy = vi.spyOn(window, 'removeEventListener');
        setUnloadHandler('project');
        setUnloadHandler('study');
        setUnloadHandler('annotation');

        unsetUnloadHandler('project');
        unsetUnloadHandler('study');
        unsetUnloadHandler('annotation');

        expect(window.sessionStorage.getItem(EUnloadStatus.PROJECTSTORE)).toBe(null);
        expect(window.sessionStorage.getItem(EUnloadStatus.STUDYSTORE)).toBe(null);
        expect(window.sessionStorage.getItem(EUnloadStatus.ANNOTATIONSTORE)).toBe(null);
        expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
        expect(spy).toHaveBeenCalledWith('unload', expect.any(Function));
    });

    it('should not remove the unload handler if there are still unsaved changes', () => {
        const spy = vi.spyOn(window, 'removeEventListener');
        setUnloadHandler('project');
        setUnloadHandler('study');

        unsetUnloadHandler('project');

        expect(window.sessionStorage.getItem(EUnloadStatus.PROJECTSTORE)).toBe(null);
        expect(window.sessionStorage.getItem(EUnloadStatus.STUDYSTORE)).toBe('true');
        expect(spy).not.toHaveBeenCalled(); // The handler should not be removed
    });

    it('should return true when there are unsaved changes in the project store', () => {
        setUnloadHandler('project');
        expect(hasUnsavedChanges()).toBe(true);
    });

    it('should return true when there are unsaved study changes', () => {
        setUnloadHandler('study');
        expect(hasUnsavedChanges()).toBe(true);
    });

    it('should return true when there are unsaved annotation changes', () => {
        setUnloadHandler('annotation');
        expect(hasUnsavedChanges()).toBe(true);
    });

    it('should return false when there are no unsaved changes', () => {
        expect(hasUnsavedChanges()).toBe(false);
    });
});
