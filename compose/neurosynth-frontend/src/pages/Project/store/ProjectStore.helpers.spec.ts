import { getNextUntitledProjectName } from './ProjectStore.helpers';

describe('getNextUntitledProjectName', () => {
    it('returns "Untitled" when no existing names match', () => {
        expect(getNextUntitledProjectName([])).toBe('Untitled');
        expect(getNextUntitledProjectName(['My Project', 'Other'])).toBe('Untitled');
    });

    it('returns "Untitled 2" when only "Untitled" exists', () => {
        expect(getNextUntitledProjectName(['Untitled'])).toBe('Untitled 2');
    });

    it('returns the next number after the max existing Untitled N', () => {
        expect(getNextUntitledProjectName(['Untitled', 'Untitled 2'])).toBe('Untitled 3');
        expect(getNextUntitledProjectName(['Untitled 2', 'Untitled 3'])).toBe('Untitled 4');
        expect(getNextUntitledProjectName(['Untitled', 'Untitled 2', 'Untitled 3'])).toBe('Untitled 4');
    });

    it('ignores non-matching names when computing the next number', () => {
        expect(getNextUntitledProjectName(['Untitled', 'My Project', 'Untitled 2'])).toBe('Untitled 3');
        expect(getNextUntitledProjectName(['Other', 'Untitled 5'])).toBe('Untitled 6');
    });

    it('handles gaps in numbering (uses max, not count)', () => {
        expect(getNextUntitledProjectName(['Untitled', 'Untitled 3'])).toBe('Untitled 4');
        expect(getNextUntitledProjectName(['Untitled 10'])).toBe('Untitled 11');
    });

    it('trims whitespace from project names before matching', () => {
        expect(getNextUntitledProjectName(['  Untitled  '])).toBe('Untitled 2');
        expect(getNextUntitledProjectName(['  Untitled 2  '])).toBe('Untitled 3');
    });

    it('handles null or undefined in the array by treating as non-matching', () => {
        expect(getNextUntitledProjectName([null as unknown as string, 'Untitled'])).toBe('Untitled 2');
        expect(getNextUntitledProjectName([undefined as unknown as string])).toBe('Untitled');
    });
});
