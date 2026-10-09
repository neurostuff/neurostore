import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { useProjectAnalysisType } from 'stores/projects/ProjectStore';
import { Mock } from 'vitest';
import MoveToExtractionDialogSkipExtraction from './MoveToExtractionDialogSkipExtraction';

vi.mock('stores/projects/ProjectStore');

describe('MoveToExtractionDialogSkipExtraction', () => {
    beforeEach(() => {
        (useProjectAnalysisType as Mock).mockReturnValue(EAnalysisType.CBMA);
    });

    it('shows coordinates copy and navigation actions for a CBMA project', async () => {
        const onCancel = vi.fn();
        const onConfirm = vi.fn();
        render(<MoveToExtractionDialogSkipExtraction onCancel={onCancel} onConfirm={onConfirm} />);

        expect(screen.getByText('Skip extraction?')).toBeInTheDocument();
        expect(
            screen.getByText(
                'The extraction step allows you to confirm accurate coordinates, separate coordinates into distinct analyses and tag/group analyses via annotations.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('If you change your mind, you can always come back to this step later.')
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ingestion' })).toHaveAttribute(
            'href',
            'https://neurostuff.github.io/compose-docs/guide/glossary#ingestion'
        );

        await userEvent.click(screen.getByRole('button', { name: 'BACK' }));
        expect(onCancel).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole('button', { name: 'Yes, skip Extraction' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('shows images copy for an IBMA project', () => {
        (useProjectAnalysisType as Mock).mockReturnValue(EAnalysisType.IBMA);
        render(<MoveToExtractionDialogSkipExtraction onCancel={vi.fn()} onConfirm={vi.fn()} />);

        expect(
            screen.getByText(
                'The extraction step allows you to confirm accurate images, separate images into distinct analyses and tag/group analyses via annotations.'
            )
        ).toBeInTheDocument();
        expect(screen.queryByText(/accurate coordinates/)).not.toBeInTheDocument();
    });
});
