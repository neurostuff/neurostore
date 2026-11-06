import { moveEdge, snapToWords, stepEdge } from './snap';

const TEXT = 'We scanned twenty-one patients (3 T), café users.';
const span = (s: string): [number, number] => [TEXT.indexOf(s), TEXT.indexOf(s) + s.length];

describe('snapToWords', () => {
    it('widens a selection that starts or ends inside a word to the word’s edges', () => {
        expect(snapToWords(TEXT, TEXT.indexOf('anned'), TEXT.indexOf('nty') + 2)).toEqual(span('scanned twenty'));
        expect(snapToWords(TEXT, TEXT.indexOf('af'), TEXT.indexOf('af') + 1)).toEqual(span('café'));
    });

    it('trims surrounding whitespace and keeps punctuation the selection covers', () => {
        expect(snapToWords(TEXT, TEXT.indexOf(' patients'), TEXT.indexOf('patients') + 9)).toEqual(span('patients'));
        expect(snapToWords(TEXT, TEXT.indexOf('(3'), TEXT.indexOf(')') + 1)).toEqual(span('(3 T)'));
    });

    it('returns null for a selection of only whitespace or nothing', () => {
        expect(snapToWords(TEXT, 2, 3)).toBeNull();
        expect(snapToWords(TEXT, 5, 5)).toBeNull();
    });
});

describe('moveEdge', () => {
    const patients = span('patients');

    it('snaps a dragged start to the start of the word it lands in, keeping the end', () => {
        expect(moveEdge(TEXT, patients, 'start', TEXT.indexOf('enty'))).toEqual([TEXT.indexOf('twenty'), patients[1]]);
        expect(moveEdge(TEXT, patients, 'start', TEXT.indexOf(' patients'))).toEqual(patients);
    });

    it('snaps a dragged end to the end of the word it lands in, keeping the start', () => {
        expect(moveEdge(TEXT, span('twenty'), 'end', TEXT.indexOf('tients'))).toEqual([
            TEXT.indexOf('twenty'),
            patients[1],
        ]);
    });

    it('keeps an exact end where it is when the start is dragged', () => {
        const exact: [number, number] = [patients[0], patients[0] + 4];
        expect(moveEdge(TEXT, exact, 'start', TEXT.indexOf('one'))).toEqual([TEXT.indexOf('one'), exact[1]]);
    });

    it('never lets a dragged end cross the other end, holding it at the word next to the other', () => {
        const wide = span('twenty-one patients');
        expect(moveEdge(TEXT, wide, 'start', TEXT.indexOf('café'))).toEqual(patients);
        expect(moveEdge(TEXT, wide, 'end', 0)).toEqual(span('twenty'));
    });
});

describe('stepEdge', () => {
    const patients = span('patients');

    it('moves the start one word left or right', () => {
        expect(stepEdge(TEXT, patients, 'start', -1)).toEqual([TEXT.indexOf('one'), patients[1]]);
        expect(stepEdge(TEXT, span('twenty-one patients'), 'start', 1)).toEqual([TEXT.indexOf('one'), patients[1]]);
    });

    it('moves the end one word right or left', () => {
        expect(stepEdge(TEXT, patients, 'end', 1)).toEqual([patients[0], TEXT.indexOf('3') + 1]);
        expect(stepEdge(TEXT, span('twenty-one patients'), 'end', -1)).toEqual(span('twenty-one'));
    });

    it('does not move an end past the other one, nor past the text', () => {
        expect(stepEdge(TEXT, patients, 'start', 1)).toEqual(patients);
        expect(stepEdge(TEXT, patients, 'end', -1)).toEqual(patients);
        expect(stepEdge(TEXT, span('We'), 'start', -1)).toEqual(span('We'));
        expect(stepEdge(TEXT, span('users.'), 'end', 1)).toEqual(span('users.'));
    });
});
