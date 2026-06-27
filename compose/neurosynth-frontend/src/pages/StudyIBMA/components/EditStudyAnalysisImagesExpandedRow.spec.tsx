import { Table, TableBody } from '@mui/material';
import type { Row, Table as TanstackTable } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import EditStudyAnalysisImagesExpandedRow from 'pages/StudyIBMA/components/EditStudyAnalysisImagesExpandedRow';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import { vi } from 'vitest';

vi.mock('react-query');

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

const analyses: AnalysisReturnNested[] = [
    { id: 'analysis-1', name: 'Contrast A', images: [] },
    { id: 'analysis-2', name: 'Contrast B', images: [] },
];

const buildTable = ({
    updateImage = vi.fn().mockResolvedValue(undefined),
    toggleImageSelection = vi.fn(),
    rowImages = [img('assigned-image')],
}: {
    updateImage?: ReturnType<typeof vi.fn>;
    toggleImageSelection?: ReturnType<typeof vi.fn>;
    rowImages?: ImageReturn[];
} = {}) => {
    const row = {
        id: 'analysis-1',
        original: {
            id: 'analysis-1',
            name: 'Contrast A',
            description: '',
            images: rowImages,
            analysisAnnotation: {},
        } as AnalysisBoardRow,
    } as Row<AnalysisBoardRow>;

    const table = {
        getVisibleLeafColumns: () => [{ id: 'analysis' }, { id: 'included' }],
        options: {
            meta: {
                analyses,
                toggleImageSelection,
                updateImage,
            },
        },
    } as unknown as TanstackTable<AnalysisBoardRow>;

    return { row, table, updateImage, toggleImageSelection };
};

const renderExpandedRow = (options?: Parameters<typeof buildTable>[0]) => {
    const built = buildTable(options);
    render(
        <Table>
            <TableBody>
                <EditStudyAnalysisImagesExpandedRow
                    row={built.row}
                    table={built.table}
                    selectedImageId={null}
                />
            </TableBody>
        </Table>
    );
    return built;
};

describe('EditStudyAnalysisImagesExpandedRow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows a message when the analysis has no images', () => {
        renderExpandedRow({ rowImages: [] });

        expect(screen.getByText('No images assigned to this analysis')).toBeInTheDocument();
    });

    it('calls toggleImageSelection when an image row is clicked', async () => {
        const { toggleImageSelection } = renderExpandedRow();

        await userEvent.click(screen.getByText('assigned-image.nii'));

        expect(toggleImageSelection).toHaveBeenCalledWith('assigned-image');
    });

    it('calls updateImage with a null analysis when remove is clicked', async () => {
        const { updateImage } = renderExpandedRow();

        await userEvent.click(screen.getByLabelText('Remove from analysis'));

        expect(updateImage).toHaveBeenCalledWith('assigned-image', { analysis: undefined });
    });

    it('assigns the image to another analysis via the move menu', async () => {
        const { updateImage } = renderExpandedRow();

        await userEvent.click(screen.getByLabelText('Move image to analysis'));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Contrast B' }));

        expect(updateImage).toHaveBeenCalledWith('assigned-image', { analysis: 'analysis-2' });
    });

    it('labels the current analysis in the move menu and does not reassign to it', async () => {
        const { updateImage } = renderExpandedRow();

        await userEvent.click(screen.getByLabelText('Move image to analysis'));

        const menu = screen.getByRole('menu');
        expect(within(menu).getByRole('menuitem', { name: 'Contrast A (current analysis)' })).toBeInTheDocument();

        await userEvent.click(screen.getByRole('menuitem', { name: 'Contrast A (current analysis)' }));

        expect(updateImage).not.toHaveBeenCalled();
    });
});
