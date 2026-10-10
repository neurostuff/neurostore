import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MoveToExtractionDialogIntroPart2 from './MoveToExtractionDialogIntroPart2';

vi.mock('pages/Project/components/MoveToExtractionDialogSection');

describe('MoveToExtractionDialogIntroPart2', () => {
    it('should render tasks, setup steps, and navigation actions', async () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();
        render(<MoveToExtractionDialogIntroPart2 onPrev={onPrev} onNext={onNext} />);

        expect(screen.getByText('Your main tasks in this step')).toBeInTheDocument();
        expect(screen.getByText('Add & Review Study Data')).toBeInTheDocument();
        expect(screen.getByText('Annotate Analyses')).toBeInTheDocument();
        expect(screen.getByText('Create a studyset')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Extraction' })).toHaveAttribute(
            'href',
            'https://neurostuff.github.io/compose-docs/guide/Project/Extraction'
        );
        expect(screen.getByRole('link', { name: 'studyset' })).toHaveAttribute(
            'href',
            'https://neurostuff.github.io/compose-docs/guide/glossary#studyset'
        );
        expect(screen.getAllByRole('link', { name: 'analyses' })[0]).toHaveAttribute(
            'href',
            'https://neurostuff.github.io/compose-docs/guide/glossary#analysis'
        );

        await userEvent.click(screen.getByRole('button', { name: 'BACK' }));
        expect(onPrev).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole('button', { name: 'START' }));
        expect(onNext).toHaveBeenCalledTimes(1);
    });
});
