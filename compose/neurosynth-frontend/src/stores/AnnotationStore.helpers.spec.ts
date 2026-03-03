import { describe, expect, it } from 'vitest';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { buildAnnotationSavePlan, noteKeyArrToDefaultNoteKeyObj } from 'stores/AnnotationStore.helpers';

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

    it('builds a full annotation update when new notes are present', () => {
        const result = buildAnnotationSavePlan({
            annotationId: 'annotation-id',
            noteKeys: [{ key: 'included', type: EPropertyType.BOOLEAN, order: 0, default: true }],
            noteKeysHaveChanged: false,
            notes: [
                {
                    analysis: 'analysis-id',
                    study: 'study-id',
                    note: { included: true },
                    isNew: true,
                },
            ],
        });

        expect(result).toEqual({
            annotationUpdate: {
                notes: [
                    {
                        analysis: 'analysis-id',
                        study: 'study-id',
                        note: { included: true },
                    },
                ],
            },
            noteUpdates: [],
            hasChanges: true,
        });
    });

    it('builds split updates for persisted edited notes and note key changes', () => {
        const result = buildAnnotationSavePlan({
            annotationId: 'annotation-id',
            noteKeys: [{ key: 'included', type: EPropertyType.BOOLEAN, order: 0, default: true }],
            noteKeysHaveChanged: true,
            notes: [
                {
                    analysis: 'analysis-id',
                    study: 'study-id',
                    note: { included: false },
                    isEdited: true,
                },
            ],
        });

        expect(result).toEqual({
            annotationUpdate: {
                note_keys: {
                    included: {
                        type: EPropertyType.BOOLEAN,
                        order: 0,
                        default: true,
                    },
                },
            },
            noteUpdates: [
                {
                    id: 'annotation-id_analysis-id',
                    note: { included: false },
                },
            ],
            hasChanges: true,
        });
    });
});
