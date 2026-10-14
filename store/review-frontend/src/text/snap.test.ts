import { snapToWords } from './snap';

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
