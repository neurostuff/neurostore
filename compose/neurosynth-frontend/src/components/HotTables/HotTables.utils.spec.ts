import { describe, expect, it } from 'vitest';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { noteKeyArrToObj, noteKeyObjToArr } from './HotTables.utils';

describe('HotTables utils - note key conversions', () => {
    it('converts note_keys object descriptors to a sorted array and reindexes order', () => {
        const input = {
            beta: { type: EPropertyType.STRING, order: 5 },
            alpha: { type: EPropertyType.NUMBER, order: 1 },
            gamma: { type: EPropertyType.BOOLEAN, order: 1 },
        };

        const result = noteKeyObjToArr(input);

        expect(result).toEqual([
            { key: 'alpha', type: EPropertyType.NUMBER, order: 0 },
            { key: 'gamma', type: EPropertyType.BOOLEAN, order: 1 },
            { key: 'beta', type: EPropertyType.STRING, order: 2 },
        ]);
    });

    it('throws if a note_key descriptor is missing a type', () => {
        const invalid = {
            alpha: { order: 0 },
        } as any;

        expect(() => noteKeyObjToArr(invalid)).toThrow(/missing type/i);
    });

    it('converts a note key array back to descriptor object preserving order', () => {
        const arr = [
            { key: 'first', type: EPropertyType.STRING, order: 2 },
            { key: 'second', type: EPropertyType.BOOLEAN, order: 0 },
            { key: 'third', type: EPropertyType.NUMBER, order: undefined as unknown as number },
        ];

        const result = noteKeyArrToObj(arr);

        expect(result).toEqual({
            first: { type: EPropertyType.STRING, order: 2 },
            second: { type: EPropertyType.BOOLEAN, order: 0 },
            third: { type: EPropertyType.NUMBER, order: 2 },
        });
    });
});
