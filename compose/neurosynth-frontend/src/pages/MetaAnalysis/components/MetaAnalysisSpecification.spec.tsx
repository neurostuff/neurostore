import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Mock, vi } from 'vitest';
import { useGetMetaAnalysisById } from 'hooks';
import useGetSnapshotStudysetById from 'hooks/studysets/useGetSnapshotStudysetById';
import useGetSnapshotAnnotationById from 'hooks/annotations/useGetSnapshotAnnotationById';
import useGetSpecificationById from 'hooks/metaAnalyses/useGetSpecificationById';
import QueryClientTestingWrapper from 'testing/QueryClientTestingWrapper';
import DisplayMetaAnalysisSpecification from './MetaAnalysisSpecification';

vi.mock('hooks');
vi.mock('hooks/studysets/useGetSnapshotStudysetById', () => ({
    default: vi.fn(),
}));
vi.mock('hooks/annotations/useGetSnapshotAnnotationById', () => ({
    default: vi.fn(),
}));
vi.mock('hooks/metaAnalyses/useGetSpecificationById', () => ({
    default: vi.fn(),
}));
vi.mock('pages/MetaAnalysis/components/SelectAnalysesSummaryComponent');
vi.mock('pages/MetaAnalysis/components/DynamicInputDisplay');

describe('DisplayMetaAnalysisSpecification', () => {
    beforeEach(() => {
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            data: {
                specification: 'spec-1',
                neurostore_studyset: 'ns-studyset-123',
                neurostore_annotation: 'ns-annotation-456',
            },
        });
        (useGetSpecificationById as Mock).mockReturnValue({
            data: { type: 'CBMA', estimator: { type: 'ALE', args: {} } },
        });
        // Snapshot intentionally has NO neurostore_id — reproduces the blank-link bug.
        (useGetSnapshotStudysetById as Mock).mockReturnValue({ data: {} });
        (useGetSnapshotAnnotationById as Mock).mockReturnValue({ data: {} });
    });

    const renderComponent = () =>
        render(
            <MemoryRouter>
                <QueryClientTestingWrapper>
                    <DisplayMetaAnalysisSpecification projectId="proj-1" metaAnalysisId="ma-1" />
                </QueryClientTestingWrapper>
            </MemoryRouter>
        );

    it('shows the neurostore studyset id even when the snapshot studyset lacks neurostore_id', () => {
        renderComponent();
        expect(screen.getByText('ns-studyset-123')).toBeInTheDocument();
    });

    it('renders the studyset id as a link', () => {
        renderComponent();
        expect(screen.getByRole('link', { name: 'ns-studyset-123' })).toBeInTheDocument();
    });
});
