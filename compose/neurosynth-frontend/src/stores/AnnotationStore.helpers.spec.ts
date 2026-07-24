import { describe, expect, it } from 'vitest';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { noteKeyArrToDefaultNoteKeyObj } from 'stores/AnnotationStore.helpers';

describe('AnnotationStore helpers - default note values', () => {
    it('uses provided defaults and falls back to null when missing', () => {
        const noteKeys = [
            { key: 'included', type: EPropertyType.BOOLEAN, order: 0, default: true },
            { key: 'flag', type: EPropertyType.BOOLEAN, order: 1, default: false },
            { key: 'quality', type: EPropertyType.STRING, order: 2, default: 'low' },
            { key: 'score', type: EPropertyType.NUMBER, order: 3, default: 1.5 },
            { key: 'notes', type: EPropertyType.STRING, order: 4 },
        ];

        const result = noteKeyArrToDefaultNoteKeyObj(noteKeys);

        expect(result).toEqual({
            included: true,
            flag: false,
            quality: 'low',
            score: 1.5,
            notes: null,
        });
    });
});
