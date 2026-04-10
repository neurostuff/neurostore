import type { ImageReturn } from 'neurostore-typescript-sdk';
import type { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import {
    imageToBrainMapListItem,
    moveBrainMapImageToAnalysis,
    partitionAnalysisImages,
    unassignBrainMapImageFromAnalysis,
} from './editStudyAnalysisBoard.helpers';

const img = (partial: Partial<ImageReturn> & { id: string }): ImageReturn => ({
    id: partial.id,
    filename: partial.filename ?? null,
    url: partial.url ?? null,
    value_type: partial.value_type ?? null,
    analysis: partial.analysis,
    public: true,
    created_at: '',
    updated_at: null,
    user: null,
    username: null,
    metadata: null,
    space: null,
    add_date: null,
    entities: undefined,
    analysis_name: null,
});

const analysis = (id: string, images: ImageReturn[]): IStoreAnalysis =>
    ({
        id,
        name: 'A',
        description: '',
        isNew: false,
        conditions: [],
        points: [],
        images,
        pointSpace: undefined,
        pointStatistic: undefined,
    }) as IStoreAnalysis;

describe('editStudyAnalysisBoard.helpers', () => {
    describe('partitionAnalysisImages', () => {
        it('groups images by analysis when FK matches a study analysis id', () => {
            const a1 = 'analysis-1';
            const a2 = 'analysis-2';
            const analyses = [
                analysis(a1, [img({ id: 'i1', analysis: a1, filename: 'a.nii' })]),
                analysis(a2, [img({ id: 'i2', analysis: a2, filename: 'b.nii' })]),
            ];
            const { uncategorized, byAnalysisId } = partitionAnalysisImages(analyses);
            expect(uncategorized).toHaveLength(0);
            expect(byAnalysisId[a1]).toHaveLength(1);
            expect(byAnalysisId[a2]).toHaveLength(1);
            expect(byAnalysisId[a1][0].id).toBe('i1');
        });

        it('treats missing or unknown analysis FK as uncategorized with holder id', () => {
            const a1 = 'analysis-1';
            const analyses = [analysis(a1, [img({ id: 'i1', analysis: undefined, filename: 'orphan.nii' })])];
            const { uncategorized, byAnalysisId } = partitionAnalysisImages(analyses);
            expect(Object.keys(byAnalysisId)).toHaveLength(0);
            expect(uncategorized).toEqual([
                expect.objectContaining({
                    holderAnalysisId: a1,
                    image: expect.objectContaining({ id: 'i1' }),
                }),
            ]);
        });
    });

    describe('moveBrainMapImageToAnalysis', () => {
        it('moves an image from one analysis to another', () => {
            const a1 = 'analysis-1';
            const a2 = 'analysis-2';
            const i1 = img({ id: 'i1', analysis: a1, filename: 'x.nii' });
            const analyses = [analysis(a1, [i1]), analysis(a2, [])];
            const next = moveBrainMapImageToAnalysis(analyses, 'i1', a2);
            expect(next).not.toBeNull();
            const a1Next = next!.find((x) => x.id === a1)!;
            const a2Next = next!.find((x) => x.id === a2)!;
            expect(a1Next.images).toHaveLength(0);
            expect(a2Next.images).toHaveLength(1);
            expect((a2Next.images as ImageReturn[])[0].analysis).toBe(a2);
        });
    });

    describe('unassignBrainMapImageFromAnalysis', () => {
        it('clears analysis FK on the image in place', () => {
            const a1 = 'analysis-1';
            const i1 = img({ id: 'i1', analysis: a1, filename: 'x.nii' });
            const analyses = [analysis(a1, [i1])];
            const next = unassignBrainMapImageFromAnalysis(analyses, a1, 'i1');
            const imgs = next[0].images as ImageReturn[];
            expect(imgs[0].analysis).toBeUndefined();
        });
    });

    describe('imageToBrainMapListItem', () => {
        it('maps value_type to DefaultMapTypes key', () => {
            expect(imageToBrainMapListItem(img({ id: '1', value_type: 'T', filename: 't.nii' })).mapType).toBe('T');
            expect(imageToBrainMapListItem(img({ id: '2', value_type: 'unknown', filename: 'u.nii' })).mapType).toBe(
                'OTHER'
            );
        });
    });
});
