import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmationDialog from './ConfirmationDialog';

describe('ConfirmationDialog', () => {
    const mockOnClose = jest.fn();

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(
            <ConfirmationDialog
                isOpen={true}
                dialogTitle="test-message"
                onCloseDialog={mockOnClose}
                confirmText="confirm"
                rejectText="reject"
            />
        );

        const text = screen.getByText('test-message');
        const confirmText = screen.getByText('confirm');
        const rejectText = screen.getByText('reject');
        expect(text).toBeInTheDocument();
        expect(confirmText).toBeInTheDocument();
        expect(rejectText).toBeInTheDocument();
    });

    it('should signal false when cancel is clicked', () => {
        render(
            <ConfirmationDialog
                isOpen={true}
                dialogTitle="test-message"
                onCloseDialog={mockOnClose}
                confirmText="confirm"
                rejectText="reject"
            />
        );

        const rejectButton = screen.getByRole('button', { name: 'reject' });
        userEvent.click(rejectButton);
        expect(mockOnClose).toBeCalledWith(false, undefined);
    });

    it('should signal true when confirm is clicked', () => {
        render(
            <ConfirmationDialog
                isOpen={true}
                dialogTitle="test-message"
                onCloseDialog={mockOnClose}
                confirmText="confirm"
                rejectText="reject"
            />
        );

        const confirmButton = screen.getByRole('button', { name: 'confirm' });
        userEvent.click(confirmButton);
        expect(mockOnClose).toBeCalledWith(true, undefined);
    });

    it('should signal undefined when clicked away', async () => {
        render(
            <div>
                <ConfirmationDialog
                    isOpen={true}
                    dialogTitle="test-message"
                    onCloseDialog={mockOnClose}
                    confirmText="confirm"
                    rejectText="reject"
                />
                <button data-testid="trigger-click-outside">testing</button>
            </div>
        );

        // we need to trigger a click away by clicking the backdrop. For some reason,
        // the second presentation div accomplishes this
        userEvent.click(screen.getAllByRole('presentation')[1]);
        expect(mockOnClose).toBeCalledWith(undefined, undefined);
    });

    it('should close when close icon button is clicked', () => {
        render(
            <ConfirmationDialog
                isOpen={true}
                dialogTitle="test-message"
                onCloseDialog={mockOnClose}
                confirmText="confirm"
                rejectText="reject"
            />
        );

        userEvent.click(screen.getByTestId('CloseIcon'));
        expect(mockOnClose).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should be called with the data', () => {
        render(
            <ConfirmationDialog
                isOpen={true}
                dialogTitle="test-message"
                onCloseDialog={mockOnClose}
                confirmText="confirm"
                rejectText="reject"
                data={{ data: 'test-data' }}
            />
        );

        const confirmButton = screen.getByRole('button', { name: 'confirm' });
        userEvent.click(confirmButton);

        expect(mockOnClose).toHaveBeenCalledWith(true, { data: 'test-data' });
    });
});
