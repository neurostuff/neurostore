import { render, screen } from '@testing-library/react';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import EditStudyAnalysisIBMA from 'pages/StudyIBMA/components/EditStudyAnalysisIBMA';
import useEditStudyAnalysisBoardState from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState';
import { Mock, vi } from 'vitest';

vi.mock('pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState');
vi.mock('pages/StudyIBMA/components/UncategorizedImagesColumn');
vi.mock('pages/StudyIBMA/components/EditStudyAnalysisTable');
vi.mock('pages/StudyIBMA/components/BrainMapDetailPanel');

const img = (id: string): ImageReturn => ({
    id,
    filename: `${id}.nii`,
    public: true,
    created_at: '',
    updated_at: null,
    user: null,
    username: null,
    metadata: null,
    space: null,
    add_date: null,
    url: null,
    value_type: 'T',
    entities: undefined,
    analysis_name: null,
});

const mockToggleImageSelection = vi.fn();

const defaultBoardState = {
    table: {
        options: {
            meta: {
                analyses: [{ id: 'analysis-1', name: 'Contrast A', images: [img('nested-image')] }],
                selectedImageId: null as string | null,
                toggleImageSelection: mockToggleImageSelection,
                updateImage: vi.fn(),
            },
        },
    },
    tableMinWidth: 400,
    uncategorized: [] as ImageReturn[],
    noteKeys: [],
    isLoading: false,
};

describe('EditStudyAnalysisIBMA', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useEditStudyAnalysisBoardState as Mock).mockReturnValue(defaultBoardState);
    });

    it('renders loading skeletons while board data is loading', () => {
        (useEditStudyAnalysisBoardState as Mock).mockReturnValue({
            ...defaultBoardState,
            isLoading: true,
        });

        render(<EditStudyAnalysisIBMA />);

        expect(screen.getByTestId('edit-study-analysis-board')).toBeInTheDocument();
        expect(screen.queryByTestId('mock-uncategorized-images-column')).not.toBeInTheDocument();
        expect(screen.queryByTestId('edit-study-analysis-table')).not.toBeInTheDocument();
    });

    it('expands the uncategorized column when uncategorized images exist after initial load', () => {
        (useEditStudyAnalysisBoardState as Mock).mockReturnValue({
            ...defaultBoardState,
            uncategorized: [img('orphan-image')],
        });

        render(<EditStudyAnalysisIBMA />);

        expect(screen.getByTestId('mock-uncategorized-images-column')).toHaveAttribute('data-collapsed', 'false');
    });

    it('collapses the uncategorized column when there are no uncategorized images after initial load', () => {
        render(<EditStudyAnalysisIBMA />);

        expect(screen.getByTestId('mock-uncategorized-images-column')).toHaveAttribute('data-collapsed', 'true');
    });

    it('shows BrainMapDetailPanel for a selected uncategorized image', () => {
        (useEditStudyAnalysisBoardState as Mock).mockReturnValue({
            ...defaultBoardState,
            uncategorized: [img('orphan-image')],
            table: {
                options: {
                    meta: {
                        ...defaultBoardState.table.options.meta,
                        selectedImageId: 'orphan-image',
                    },
                },
            },
        });

        render(<EditStudyAnalysisIBMA />);

        expect(screen.getByTestId('mock-brain-map-detail-panel')).toBeInTheDocument();
        expect(screen.getByTestId('mock-brain-map-detail-panel')).toHaveAttribute('data-image-id', 'orphan-image');
    });

    it('resolves a selected nested analysis image for BrainMapDetailPanel', () => {
        (useEditStudyAnalysisBoardState as Mock).mockReturnValue({
            ...defaultBoardState,
            table: {
                options: {
                    meta: {
                        ...defaultBoardState.table.options.meta,
                        selectedImageId: 'nested-image',
                    },
                },
            },
        });

        render(<EditStudyAnalysisIBMA />);

        expect(screen.getByTestId('mock-brain-map-detail-panel')).toHaveAttribute('data-image-id', 'nested-image');
    });
});
