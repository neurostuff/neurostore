import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { vi } from 'vitest';
import AnnotationColumnHeader from 'pages/StudyIBMA/components/AnnotationColumnHeader';
import QueryClientTestingWrapper from 'testing/QueryClientTestingWrapper';

vi.mock('components/Dialogs/ConfirmationDialog');

describe('AnnotationColumnHeader', () => {
    it('shows Remove column and calls onRemoveColumn after confirm', async () => {
        const onRemoveColumn = vi.fn();
        render(
            <QueryClientTestingWrapper>
                <AnnotationColumnHeader
                    headerName="notes"
                    columnType={EPropertyType.STRING}
                    onRemoveColumn={onRemoveColumn}
                />
            </QueryClientTestingWrapper>
        );

        await userEvent.click(screen.getByLabelText('notes column options'));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Remove column' }));
        await userEvent.click(screen.getByTestId('accept-close-confirmation'));

        expect(onRemoveColumn).toHaveBeenCalledWith('notes');
    });
});
