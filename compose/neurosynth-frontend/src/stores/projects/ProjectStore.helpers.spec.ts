import { EAnalysisType } from 'hooks/projects/Project.types';
import { getNextUntitledProjectName } from 'stores/projects/ProjectStore.helpers';

const CBMA = EAnalysisType.CBMA;
const IBMA = EAnalysisType.IBMA;

describe('getNextUntitledProjectName', () => {
    it('returns "Untitled {type}" when no existing names match for that type', () => {
        expect(getNextUntitledProjectName(CBMA, [])).toBe('Untitled CBMA');
        expect(getNextUntitledProjectName(CBMA, ['My Project', 'Other'])).toBe('Untitled CBMA');
        expect(getNextUntitledProjectName(IBMA, [])).toBe('Untitled IBMA');
        expect(getNextUntitledProjectName(IBMA, ['Untitled CBMA', 'Untitled CBMA 2'])).toBe('Untitled IBMA');
    });

    it('returns "Untitled {type} 2" when only "Untitled {type}" exists', () => {
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA'])).toBe('Untitled CBMA 2');
        expect(getNextUntitledProjectName(IBMA, ['Untitled IBMA'])).toBe('Untitled IBMA 2');
    });

    it('returns the next number after the max existing Untitled {type} N', () => {
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA', 'Untitled CBMA 2'])).toBe('Untitled CBMA 3');
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA 2', 'Untitled CBMA 3'])).toBe('Untitled CBMA 4');
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA', 'Untitled CBMA 2', 'Untitled CBMA 3'])).toBe(
            'Untitled CBMA 4'
        );
    });

    it('ignores non-matching names when computing the next number', () => {
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA', 'My Project', 'Untitled CBMA 2'])).toBe(
            'Untitled CBMA 3'
        );
        expect(getNextUntitledProjectName(CBMA, ['Other', 'Untitled CBMA 5'])).toBe('Untitled CBMA 6');
        expect(getNextUntitledProjectName(CBMA, ['Untitled IBMA', 'Untitled IBMA 3'])).toBe('Untitled CBMA');
    });

    it('handles gaps in numbering (uses max, not count)', () => {
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA', 'Untitled CBMA 3'])).toBe('Untitled CBMA 4');
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA 10'])).toBe('Untitled CBMA 11');
    });

    it('trims whitespace from project names before matching', () => {
        expect(getNextUntitledProjectName(CBMA, ['  Untitled CBMA  '])).toBe('Untitled CBMA 2');
        expect(getNextUntitledProjectName(CBMA, ['  Untitled CBMA 2  '])).toBe('Untitled CBMA 3');
    });

    it('handles null or undefined in the array by treating as non-matching', () => {
        expect(getNextUntitledProjectName(CBMA, [null as unknown as string, 'Untitled CBMA'])).toBe('Untitled CBMA 2');
        expect(getNextUntitledProjectName(CBMA, [undefined as unknown as string])).toBe('Untitled CBMA');
    });

    it('counts CBMA and IBMA names separately', () => {
        expect(getNextUntitledProjectName(CBMA, ['Untitled CBMA', 'Untitled IBMA', 'Untitled IBMA 2'])).toBe(
            'Untitled CBMA 2'
        );
        expect(getNextUntitledProjectName(IBMA, ['Untitled CBMA', 'Untitled CBMA 2', 'Untitled IBMA'])).toBe(
            'Untitled IBMA 2'
        );
    });
});
