import type { ImageReturn } from 'neurostore-typescript-sdk';
import { imageToBrainMapListItem } from './useEditStudyAnalysisBoardState.helpers';

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

describe('useEditStudyAnalysisBoardState.helpers', () => {
    describe('imageToBrainMapListItem', () => {
        it('maps value_type to DefaultMapTypes key', () => {
            expect(imageToBrainMapListItem(img({ id: '1', value_type: 'T', filename: 't.nii' })).mapType).toBe('T');
            expect(imageToBrainMapListItem(img({ id: '2', value_type: 'unknown', filename: 'u.nii' })).mapType).toBe(
                'OTHER'
            );
        });
    });
});
