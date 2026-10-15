import { describe, expect, it } from 'vitest';
import { codePointPaper, fromCodePoints, toCodePoints, utf16Paper } from './offsets';

const TEXT = 'a𝛼b😀c';

describe('offsets between code points and UTF-16 units', () => {
    it('convert each position both ways, for characters outside the Basic Multilingual Plane', () => {
        expect(toCodePoints(TEXT, 0)).toBe(0);
        expect(toCodePoints(TEXT, 1)).toBe(1);
        expect(toCodePoints(TEXT, 3)).toBe(2);
        expect(toCodePoints(TEXT, 4)).toBe(3);
        expect(toCodePoints(TEXT, 6)).toBe(4);
        expect(toCodePoints(TEXT, 7)).toBe(5);
        expect(fromCodePoints(TEXT, 2)).toBe(3);
        expect(fromCodePoints(TEXT, 3)).toBe(4);
        expect(fromCodePoints(TEXT, 4)).toBe(6);
        expect(fromCodePoints(TEXT, 5)).toBe(7);
    });

    it('keeps positions past the end past the end, so bounds checks still fail', () => {
        expect(fromCodePoints(TEXT, 9)).toBe(11);
        expect(toCodePoints(TEXT, 9)).toBe(7);
    });
});

describe('paper text in code points', () => {
    it('measures and slices the paper in code points', () => {
        const paper = codePointPaper(TEXT);
        expect(paper.length).toBe(5);
        expect(paper.slice(1, 2)).toBe('𝛼');
        expect(paper.slice(3, 4)).toBe('😀');
    });

    it('measures and slices a UTF-16 paper in code units', () => {
        const paper = utf16Paper(TEXT);
        expect(paper.length).toBe(7);
        expect(paper.slice(1, 3)).toBe('𝛼');
    });
});
