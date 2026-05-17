import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AnnotationColumnHeader from 'pages/StudyIBMA/components/AnnotationColumnHeader';

vi.mock('components/Dialogs/ConfirmationDialog');

describe('AnnotationColumnHeader', () => {
    it('shows Remove column and calls onRemoveColumn after confirm', async () => {
        const onRemoveColumn = vi.fn();
        render(<AnnotationColumnHeader headerName="included" onRemoveColumn={onRemoveColumn} />);

        await userEvent.click(screen.getByLabelText('included column options'));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Remove column' }));
        await userEvent.click(screen.getByTestId('accept-close-confirmation'));

        expect(onRemoveColumn).toHaveBeenCalledWith('included');
    });
});
