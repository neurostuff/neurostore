import { render, screen } from '@testing-library/react';
import { useGetAnnotationById } from 'hooks';
import useGetSnapshotAnnotationById from 'hooks/annotations/useGetSnapshotAnnotationById';
import useGetMetaAnalysisById from 'hooks/metaAnalyses/useGetMetaAnalysisById';
import useGetSpecificationById from 'hooks/metaAnalyses/useGetSpecificationById';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { Mock, vi } from 'vitest';
import useSubmitMetaAnalysisJob from '../hooks/useSubmitMetaAnalysisJob';
import MetaAnalysisInstructions from './MetaAnalysisInstructions';

vi.mock('notistack');
vi.mock('hooks');
vi.mock('hooks/metaAnalyses/useGetMetaAnalysisById');
vi.mock('hooks/metaAnalyses/useGetSpecificationById');
vi.mock('hooks/annotations/useGetSnapshotAnnotationById');
vi.mock('../hooks/useSubmitMetaAnalysisJob');

const largeReferenceWarning = 'Specifying ALE subtraction with a large reference dataset is not recommended.';

describe('MetaAnalysisInstructions', () => {
    beforeEach(() => {
        (useSubmitMetaAnalysisJob as Mock).mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        });
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            data: {
                specification: 'spec-id',
                neurostore_annotation: 'annotation-id',
            },
        });
        (useGetSnapshotAnnotationById as Mock).mockReturnValue({
            data: { neurostore_id: 'neurostore-annotation-id' },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: { notes: [] },
        });
        (useGetSpecificationById as Mock).mockReturnValue({
            data: {
                estimator: { type: 'MKDADensity' },
                database_studyset: undefined,
                filter: 'included',
                conditions: [true],
            },
        });
    });

    it('should leave the cloud run enabled when the specification is not a large ALE subtraction', () => {
        render(<MetaAnalysisInstructions metaAnalysisId="meta-analysis-id" />);

        expect(screen.getByRole('button', { name: 'run meta-analysis' })).toBeEnabled();
        expect(screen.queryByText(largeReferenceWarning, { exact: false })).not.toBeInTheDocument();
    });

    it('should disable the cloud run for ALE subtraction against the neurostore reference dataset', () => {
        (useGetSpecificationById as Mock).mockReturnValue({
            data: {
                estimator: { type: 'ALESubtraction' },
                database_studyset: 'neurostore',
                filter: 'included',
                conditions: [true],
            },
        });

        render(<MetaAnalysisInstructions metaAnalysisId="meta-analysis-id" />);

        expect(screen.getByRole('button', { name: 'run meta-analysis' })).toBeDisabled();
        expect(screen.getByText(largeReferenceWarning, { exact: false })).toBeInTheDocument();
    });

    it('should disable the cloud run for ALE subtraction against a custom reference of 1000 or more studies', () => {
        const notes: NoteCollectionReturn[] = Array.from({ length: 1000 }, (_, index) => ({
            study: `study-${index}`,
            analysis: `analysis-${index}`,
            note: { included: 'reference-group' },
        }));
        (useGetSpecificationById as Mock).mockReturnValue({
            data: {
                estimator: { type: 'ALESubtraction' },
                database_studyset: undefined,
                filter: 'included',
                conditions: ['focus-group', 'reference-group'],
            },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: { notes },
        });

        render(<MetaAnalysisInstructions metaAnalysisId="meta-analysis-id" />);

        expect(screen.getByRole('button', { name: 'run meta-analysis' })).toBeDisabled();
        expect(screen.getByText(largeReferenceWarning, { exact: false })).toBeInTheDocument();
    });
});
