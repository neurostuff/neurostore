import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CellContext } from '@tanstack/react-table';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import AnalysisNameCell from 'pages/StudyIBMA/components/AnalysisNameCell';
import { vi } from 'vitest';

vi.mock('pages/StudyIBMA/components/EditStudyAnalysisDialogIBMA');
vi.mock('components/Dialogs/ConfirmationDialog');
vi.mock('react-query');

const mockDeleteAnalysis = vi.fn();
const mockUpdateAnalysis = vi.fn();
const mockToggleExpanded = vi.fn();
const mockToggleImageSelection = vi.fn();

const mockRow = (overrides: Partial<AnalysisBoardRow> = {}): AnalysisBoardRow =>
    ({
        id: 'analysis-1',
        name: 'Contrast A',
        description: 'Motor contrast',
        analysisAnnotation: {},
        images: [],
        ...overrides,
    }) as AnalysisBoardRow;

const buildCellProps = ({
    rowData = mockRow(),
    isExpanded = false,
}: {
    rowData?: AnalysisBoardRow;
    isExpanded?: boolean;
} = {}) =>
    ({
        row: {
            id: rowData.id,
            original: rowData,
            getIsExpanded: () => isExpanded,
            toggleExpanded: mockToggleExpanded,
        },
        table: {
            options: {
                meta: {
                    deleteAnalysis: mockDeleteAnalysis,
                    updateAnalysis: mockUpdateAnalysis,
                    selectedImageId: null,
                    toggleImageSelection: mockToggleImageSelection,
                },
            },
        },
    }) as unknown as CellContext<AnalysisBoardRow, unknown>;

describe('AnalysisNameCell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders analysis name and description', () => {
        render(<AnalysisNameCell {...buildCellProps()} />);
        expect(screen.getByText('Contrast A')).toBeInTheDocument();
        expect(screen.getByText('Motor contrast')).toBeInTheDocument();
    });

    it('renders placeholders when name and description are empty', () => {
        render(
            <AnalysisNameCell
                {...buildCellProps({
                    rowData: mockRow({ name: '', description: '' }),
                })}
            />
        );
        expect(screen.getByText('Untitled')).toBeInTheDocument();
        expect(screen.getByText('No description')).toBeInTheDocument();
    });

    it('calls row.toggleExpanded when the expand control is clicked', async () => {
        render(<AnalysisNameCell {...buildCellProps({ isExpanded: false })} />);
        await userEvent.click(screen.getByLabelText('See images'));
        expect(mockToggleExpanded).toHaveBeenCalledTimes(1);
    });

    it('calls row.toggleExpanded when the collapse control is clicked', async () => {
        render(<AnalysisNameCell {...buildCellProps({ isExpanded: true })} />);
        await userEvent.click(screen.getByLabelText('Hide images'));
        expect(mockToggleExpanded).toHaveBeenCalledTimes(1);
    });

    it('opens edit dialog from menu and calls updateAnalysis on save', async () => {
        render(<AnalysisNameCell {...buildCellProps()} />);
        await userEvent.click(screen.getByLabelText('Analysis options'));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Edit analysis' }));
        expect(screen.getByTestId('edit-analysis-dialog')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'dialog-save' }));
        expect(mockUpdateAnalysis).toHaveBeenCalledWith({
            analysisId: 'analysis-1',
            name: 'Saved',
            description: '',
        });
    });

    it('closes edit dialog when dialog-close is clicked', async () => {
        render(<AnalysisNameCell {...buildCellProps()} />);
        await userEvent.click(screen.getByLabelText('Analysis options'));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Edit analysis' }));
        expect(screen.getByTestId('edit-analysis-dialog')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'dialog-close' }));
        expect(screen.queryByTestId('edit-analysis-dialog')).not.toBeInTheDocument();
        expect(mockUpdateAnalysis).not.toHaveBeenCalled();
    });

    it('confirms delete and calls deleteAnalysis', async () => {
        render(<AnalysisNameCell {...buildCellProps()} />);
        await userEvent.click(screen.getByLabelText('Analysis options'));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete analysis' }));
        await userEvent.click(screen.getByTestId('accept-close-confirmation'));
        expect(mockDeleteAnalysis).toHaveBeenCalledWith('analysis-1');
    });

    it('does not call deleteAnalysis when delete is cancelled', async () => {
        render(<AnalysisNameCell {...buildCellProps()} />);
        await userEvent.click(screen.getByLabelText('Analysis options'));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete analysis' }));
        await userEvent.click(screen.getByTestId('deny-close-confirmation'));
        expect(mockDeleteAnalysis).not.toHaveBeenCalled();
    });

    it('clears image selection when deleting an analysis that owns the selected map', async () => {
        const map = { id: 'map-1' } as ImageReturn;
        const props = buildCellProps({
            rowData: mockRow({ images: [map] }),
        });
        props.table.options.meta!.selectedImageId = 'map-1';

        render(<AnalysisNameCell {...props} />);
        await userEvent.click(screen.getByLabelText('Analysis options'));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete analysis' }));
        await userEvent.click(screen.getByTestId('accept-close-confirmation'));

        expect(mockDeleteAnalysis).toHaveBeenCalledWith('analysis-1');
        expect(mockToggleImageSelection).toHaveBeenCalledWith('map-1');
    });
});
