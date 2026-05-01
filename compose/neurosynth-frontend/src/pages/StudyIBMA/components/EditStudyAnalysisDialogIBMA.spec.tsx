import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import { vi } from 'vitest';
import EditStudyAnalysisDialogIBMA from './EditStudyAnalysisDialogIBMA';

const addOrUpdateAnalysis = vi.fn();

vi.mock('components/Dialogs/BaseDialog', () => ({
    default: vi.fn(
        ({
            isOpen,
            onCloseDialog,
            children,
            dialogTitle,
        }: {
            isOpen: boolean;
            onCloseDialog: () => void;
            children: React.ReactNode;
            dialogTitle: string;
        }) =>
            isOpen ? (
                <div data-testid="mock-base-dialog">
                    <span data-testid="mock-dialog-title">{dialogTitle}</span>
                    <button type="button" data-testid="mock-dialog-close" onClick={onCloseDialog}>
                        close-header
                    </button>
                    {children}
                </div>
            ) : null
    ),
}));

vi.mock('stores/study/StudyStore', () => ({
    useAddOrUpdateAnalysis: vi.fn(() => addOrUpdateAnalysis),
}));

const mockAnalysis = (overrides: Partial<IStoreAnalysis> = {}): IStoreAnalysis =>
    ({
        id: 'analysis-1',
        name: 'Contrast A',
        description: 'Original description',
        isNew: false,
        conditions: [],
        points: [],
        images: [],
        pointSpace: undefined,
        pointStatistic: undefined,
        ...overrides,
    }) as IStoreAnalysis;

describe('EditStudyAnalysisDialogIBMA', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when closed', () => {
        render(<EditStudyAnalysisDialogIBMA analysis={null} onClose={vi.fn()} />);
        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();
    });

    it('renders title and analysis fields when open', () => {
        render(<EditStudyAnalysisDialogIBMA analysis={mockAnalysis()} onClose={vi.fn()} />);
        expect(screen.getByTestId('mock-base-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent('Edit analysis');
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Contrast A');
        expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Original description');
    });

    it('calls addOrUpdateAnalysis and onClose when Save is clicked', async () => {
        const onClose = vi.fn();
        render(<EditStudyAnalysisDialogIBMA analysis={mockAnalysis()} onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(addOrUpdateAnalysis).toHaveBeenCalledTimes(1);
        expect(addOrUpdateAnalysis).toHaveBeenCalledWith({
            id: 'analysis-1',
            name: 'Contrast A',
            description: 'Original description',
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Cancel is clicked', async () => {
        const onClose = vi.fn();
        render(<EditStudyAnalysisDialogIBMA analysis={mockAnalysis()} onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(addOrUpdateAnalysis).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('persists edited name and description on Save', async () => {
        const onClose = vi.fn();
        render(<EditStudyAnalysisDialogIBMA analysis={mockAnalysis()} onClose={onClose} />);
        await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
        await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Updated name');
        await userEvent.clear(screen.getByRole('textbox', { name: 'Description' }));
        await userEvent.type(screen.getByRole('textbox', { name: 'Description' }), 'Updated desc');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(addOrUpdateAnalysis).toHaveBeenCalledWith({
            id: 'analysis-1',
            name: 'Updated name',
            description: 'Updated desc',
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when dialog header close is used', async () => {
        const onClose = vi.fn();
        render(<EditStudyAnalysisDialogIBMA analysis={mockAnalysis()} onClose={onClose} />);
        await userEvent.click(screen.getByTestId('mock-dialog-close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
