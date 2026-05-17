import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import { imageToBrainMapListItem, partitionAnalysisImages } from './useEditStudyAnalysisBoardState.helpers';

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

const analysis = (id: string, images: ImageReturn[]): AnalysisReturnNested => ({
    id,
    name: 'A',
    description: '',
    images,
});

describe('useEditStudyAnalysisBoardState.helpers', () => {
    describe('partitionAnalysisImages', () => {
        it('groups images by analysis when FK matches a study analysis id', () => {
            const a1 = 'analysis-1';
            const a2 = 'analysis-2';
            const analyses = [
                analysis(a1, [img({ id: 'i1', analysis: a1, filename: 'a.nii' })]),
                analysis(a2, [img({ id: 'i2', analysis: a2, filename: 'b.nii' })]),
            ];
            const { uncategorized, analysisIdToImageMap: byAnalysisId } = partitionAnalysisImages(analyses);
            expect(uncategorized).toHaveLength(0);
            expect(byAnalysisId[a1]).toHaveLength(1);
            expect(byAnalysisId[a2]).toHaveLength(1);
            expect(byAnalysisId[a1][0].id).toBe('i1');
        });

        it('treats missing or unknown analysis FK as uncategorized', () => {
            const a1 = 'analysis-1';
            const analyses = [analysis(a1, [img({ id: 'i1', analysis: undefined, filename: 'orphan.nii' })])];
            const { uncategorized, analysisIdToImageMap: byAnalysisId } = partitionAnalysisImages(analyses);
            expect(Object.keys(byAnalysisId)).toHaveLength(0);
            expect(uncategorized).toEqual([expect.objectContaining({ id: 'i1' })]);
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
