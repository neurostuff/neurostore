import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import EditStudyAnalysisDialogIBMA from 'pages/StudyIBMA/components/EditStudyAnalysisDialogIBMA';
import { vi } from 'vitest';

vi.mock('components/Dialogs/BaseDialog');

const mockAnalysis = (overrides: Partial<AnalysisBoardRow> = {}): AnalysisBoardRow =>
    ({
        id: 'analysis-1',
        name: 'Contrast A',
        description: 'Original description',
        analysisAnnotation: {},
        conditions: [],
        points: [],
        images: [],
        ...overrides,
    }) as AnalysisBoardRow;

describe('EditStudyAnalysisDialogIBMA', () => {
    it('renders nothing when closed', () => {
        render(<EditStudyAnalysisDialogIBMA analysis={null} onClose={vi.fn()} onEditAnalysis={vi.fn()} />);
        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();
    });

    it('renders title and analysis fields when open', () => {
        render(<EditStudyAnalysisDialogIBMA analysis={mockAnalysis()} onClose={vi.fn()} onEditAnalysis={vi.fn()} />);
        expect(screen.getByTestId('mock-base-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent('Edit analysis');
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Contrast A');
        expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Original description');
    });

    it('calls onEditAnalysis and onClose when Save is clicked', async () => {
        const onClose = vi.fn();
        const onEditAnalysis = vi.fn();
        render(
            <EditStudyAnalysisDialogIBMA analysis={mockAnalysis()} onClose={onClose} onEditAnalysis={onEditAnalysis} />
        );
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onEditAnalysis).toHaveBeenCalledWith({
            analysisId: 'analysis-1',
            name: 'Contrast A',
            description: 'Original description',
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Cancel is clicked', async () => {
        const onClose = vi.fn();
        const onEditAnalysis = vi.fn();
        render(
            <EditStudyAnalysisDialogIBMA analysis={mockAnalysis()} onClose={onClose} onEditAnalysis={onEditAnalysis} />
        );
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onEditAnalysis).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('persists edited name and description on Save', async () => {
        const onEditAnalysis = vi.fn();
        render(
            <EditStudyAnalysisDialogIBMA analysis={mockAnalysis()} onClose={vi.fn()} onEditAnalysis={onEditAnalysis} />
        );
        await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
        await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Updated name');
        await userEvent.clear(screen.getByRole('textbox', { name: 'Description' }));
        await userEvent.type(screen.getByRole('textbox', { name: 'Description' }), 'Updated desc');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onEditAnalysis).toHaveBeenCalledWith({
            analysisId: 'analysis-1',
            name: 'Updated name',
            description: 'Updated desc',
        });
    });
});
