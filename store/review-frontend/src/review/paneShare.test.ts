import { readShare, writeShare } from './paneShare';

describe('the kept text pane share', () => {
    beforeEach(() => localStorage.clear());

    it('is read as written, for the viewer who wrote it', () => {
        writeShare('u1', 45);
        expect(readShare('u1')).toBe(45);
        expect(readShare('u2')).toBeUndefined();
    });

    it('is written without an error where the browser keeps nothing', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('full', 'QuotaExceededError');
        });
        expect(() => writeShare('u1', 45)).not.toThrow();
    });
});
