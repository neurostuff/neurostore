import { render, screen } from '@testing-library/react';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { useGetAnnotationById, useGetStudysetSummaryById } from 'hooks';
import { EAnalysisType } from 'hooks/projects/Project.types';
import SelectAnalysesSummaryComponent from 'pages/MetaAnalysis/components/SelectAnalysesSummaryComponent';
import { useProjectAnalysisType } from 'stores/projects/ProjectStore';
import { Mock, vi } from 'vitest';

vi.mock('hooks');
vi.mock('stores/projects/ProjectStore');

const selectedValue = {
    selectionKey: 'included',
    type: EPropertyType.BOOLEAN,
    selectionValue: true,
};

describe('SelectAnalysesSummaryComponent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useProjectAnalysisType as Mock).mockReturnValue(EAnalysisType.CBMA);
        (useGetAnnotationById as Mock).mockReturnValue({
            data: {
                notes: [
                    { study: 'study-1', analysis: 'a1', note: { included: true } },
                    { study: 'study-1', analysis: 'a2', note: { included: true } },
                ],
            },
        });
        (useGetStudysetSummaryById as Mock).mockReturnValue({
            data: {
                studies: [
                    {
                        id: 'study-1',
                        analyses: [
                            { id: 'a1', point_count: 3, image_count: 2 },
                            { id: 'a2', point_count: 1, image_count: 4 },
                        ],
                    },
                ],
            },
        });
    });

    const renderSummary = () =>
        render(
            <SelectAnalysesSummaryComponent
                annotationdId="annotation-id"
                studysetId="studyset-id"
                selectedValue={selectedValue}
            />
        );

    it('shows included coordinate counts for CBMA projects', async () => {
        renderSummary();

        expect(await screen.findByText('4 coordinates')).toBeInTheDocument();
        expect(screen.getByText('1 studies')).toBeInTheDocument();
        expect(screen.getByText('2 analyses')).toBeInTheDocument();
        expect(screen.queryByText(/images/)).not.toBeInTheDocument();
    });

    it('shows included image counts for IBMA projects', async () => {
        (useProjectAnalysisType as Mock).mockReturnValue(EAnalysisType.IBMA);
        renderSummary();

        expect(await screen.findByText('6 images')).toBeInTheDocument();
        expect(screen.queryByText(/coordinates/)).not.toBeInTheDocument();
    });
});
