import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import NewAnnotationColumnDialog from './NewAnnotationColumnDialog';

vi.mock('components/Dialogs/BaseDialog', () => ({
    default: vi.fn(
        ({
            isOpen,
            onCloseDialog,
            children,
        }: {
            isOpen: boolean;
            onCloseDialog: () => void;
            children: React.ReactNode;
        }) =>
            isOpen ? (
                <div data-testid="mock-base-dialog">
                    <button type="button" data-testid="mock-dialog-close" onClick={onCloseDialog}>
                        x
                    </button>
                    {children}
                </div>
            ) : null
    ),
}));

describe('NewAnnotationColumnDialog', () => {
    it('calls onAddColumn with key, type, and default then closes when Save succeeds', async () => {
        const onAddColumn = vi.fn();
        const onClose = vi.fn();
        render(
            <NewAnnotationColumnDialog isOpen onClose={onClose} existingKeys={['included']} onAddColumn={onAddColumn} />
        );

        await userEvent.type(screen.getByRole('textbox', { name: /column key/i }), 'my_key');
        const booleanDefaultSelect = screen
            .getByTestId('new-annotation-column-default-boolean')
            .querySelector('[role="combobox"]');
        expect(booleanDefaultSelect).toBeTruthy();
        await userEvent.click(booleanDefaultSelect as HTMLElement);
        await userEvent.click(await screen.findByRole('option', { name: 'true' }));

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onAddColumn).toHaveBeenCalledWith({
            key: 'my_key',
            type: EPropertyType.BOOLEAN,
            default: true,
        });
        expect(onClose).toHaveBeenCalled();
    });

    it('shows duplicate key error and does not call onAddColumn', async () => {
        const onAddColumn = vi.fn();
        render(
            <NewAnnotationColumnDialog
                isOpen
                onClose={vi.fn()}
                existingKeys={['included', 'dup']}
                onAddColumn={onAddColumn}
            />
        );

        await userEvent.type(screen.getByRole('textbox', { name: /column key/i }), 'dup');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onAddColumn).not.toHaveBeenCalled();
        expect(screen.getByText('A column with this key already exists')).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', async () => {
        const onClose = vi.fn();
        render(<NewAnnotationColumnDialog isOpen onClose={onClose} existingKeys={[]} onAddColumn={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalled();
    });
});
