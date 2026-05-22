import { describe, expect, it } from 'vitest';
import { buildClonedStudyIdMap, buildStudySnapshot } from 'pages/StudyIBMA/hooks/buildWritableStudyIdMapping.helpers';

describe('buildWritableStudyIdMapping.helpers', () => {
    it('maps analyses and nested images by order', () => {
        const oldSnapshot = buildStudySnapshot(
            'study-old',
            [
                {
                    id: 'analysis-old-2',
                    name: 'B',
                    order: 2,
                    images: [{ id: 'img-old-b', filename: 'b.nii' }],
                },
                {
                    id: 'analysis-old-1',
                    name: 'A',
                    order: 1,
                    images: [
                        { id: 'img-old-a2', filename: 'z.nii' },
                        { id: 'img-old-a1', filename: 'a.nii' },
                    ],
                },
            ],
            [{ id: 'uncat-old', filename: 'free.nii' }]
        );

        const newSnapshot = buildStudySnapshot(
            'study-new',
            [
                {
                    id: 'analysis-new-1',
                    name: 'A',
                    order: 1,
                    images: [
                        { id: 'img-new-a1', filename: 'a.nii' },
                        { id: 'img-new-a2', filename: 'z.nii' },
                    ],
                },
                {
                    id: 'analysis-new-2',
                    name: 'B',
                    order: 2,
                    images: [{ id: 'img-new-b', filename: 'b.nii' }],
                },
            ],
            [{ id: 'uncat-new', filename: 'free.nii' }]
        );

        const idMap = buildClonedStudyIdMap(oldSnapshot, newSnapshot);

        expect(idMap.oldAnalysisIdsToNewIdsMap['analysis-old-1']).toBe('analysis-new-1');
        expect(idMap.oldImageIdToNewIdMap['img-old-a1']).toBe('img-new-a1');
        expect(idMap.oldImageIdToNewIdMap['uncat-old']).toBe('uncat-new');
    });

    it('throws when uncategorized image counts differ after clone', () => {
        const oldSnapshot = buildStudySnapshot('study-old', [], [{ id: 'uncat-old', filename: 'free.nii' }]);
        const newSnapshot = buildStudySnapshot('study-new', [], []);

        expect(() => buildClonedStudyIdMap(oldSnapshot, newSnapshot)).toThrow(/uncategorized images count mismatch/);
    });
});
