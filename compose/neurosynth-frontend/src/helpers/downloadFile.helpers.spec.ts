import { MockInstance } from 'vitest';
import { toCSV } from './downloadFile.helpers';

describe('toCSV', () => {
    it('returns only header row when data is empty', () => {
        const result = toCSV(['a', 'b', 'c'], []);
        expect(result).toBe('"a","b","c"');
    });

    it('returns header row and data rows with values in header order', () => {
        const result = toCSV(
            ['title', 'year'],
            [
                { title: 'Study A', year: 2020 },
                { title: 'Study B', year: 2021 },
            ]
        );
        expect(result).toBe('"title","year"\r\n"Study A","2020"\r\n"Study B","2021"');
    });

    it('escapes double quotes in values by doubling them', () => {
        const result = toCSV(['note'], [{ note: 'He said "hello"' }]);
        expect(result).toBe('"note"\r\n"He said ""hello"""');
    });

    it('wraps values with commas in quotes so they do not break columns', () => {
        const result = toCSV(['tags'], [{ tags: 'a, b, c' }]);
        expect(result).toBe('"tags"\r\n"a, b, c"');
    });

    it('uses empty string for missing keys in a row', () => {
        const result = toCSV(['a', 'b', 'c'], [{ a: 'only', c: 'present' }]);
        expect(result).toBe('"a","b","c"\r\n"only","","present"');
    });

    it('converts numbers and null/undefined to strings', () => {
        const result = toCSV(['n', 'x', 'z'], [{ n: 42, x: null, z: undefined }]);
        expect(result).toBe('"n","x","z"\r\n"42","",""');
    });
});
