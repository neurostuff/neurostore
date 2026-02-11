import { describe, expect, it } from 'vitest';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { getDefaultForNoteKey, noteKeyArrToObj, noteKeyObjToArr } from './HotTables.utils';

describe('HotTables utils - note key conversions', () => {
    it('converts note_keys object descriptors to a sorted array and reindexes order', () => {
        const input = {
            beta: { type: EPropertyType.STRING, order: 5, default: 'demo' },
            alpha: { type: EPropertyType.NUMBER, order: 1 },
            gamma: { type: EPropertyType.BOOLEAN, order: 1, default: false },
        };

        const result = noteKeyObjToArr(input);

        expect(result).toEqual([
            { key: 'alpha', type: EPropertyType.NUMBER, order: 0, default: null },
            { key: 'gamma', type: EPropertyType.BOOLEAN, order: 1, default: false },
            { key: 'beta', type: EPropertyType.STRING, order: 2, default: 'demo' },
        ]);
    });

    it('throws if a note_key descriptor is missing a type', () => {
        const invalid: Record<string, { order: number }> = {
            alpha: { order: 0 },
        };

        expect(() => noteKeyObjToArr(invalid)).toThrow(/missing type/i);
    });

    it('converts a note key array back to descriptor object preserving order', () => {
        const arr = [
            { key: 'first', type: EPropertyType.STRING, order: 2, default: 'hello' },
            { key: 'second', type: EPropertyType.BOOLEAN, order: 0, default: false },
            { key: 'third', type: EPropertyType.NUMBER, order: undefined as unknown as number },
        ];

        const result = noteKeyArrToObj(arr);

        expect(result).toEqual({
            first: { type: EPropertyType.STRING, order: 2, default: 'hello' },
            second: { type: EPropertyType.BOOLEAN, order: 0, default: false },
            third: { type: EPropertyType.NUMBER, order: 2, default: null },
        });
    });

    it('returns the correct default for boolean note keys', () => {
        expect(getDefaultForNoteKey('included', EPropertyType.BOOLEAN)).toBe(true);
        expect(getDefaultForNoteKey('flag', EPropertyType.BOOLEAN)).toBe(false);
        expect(getDefaultForNoteKey('title', EPropertyType.STRING)).toBeUndefined();
    });
});
