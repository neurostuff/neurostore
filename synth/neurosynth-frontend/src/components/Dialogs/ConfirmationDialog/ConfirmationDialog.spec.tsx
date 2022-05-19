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
        expect(mockOnClose).toBeCalledWith(false);
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
        expect(mockOnClose).toBeCalledWith(true);
    });

    it('should signal undefined when clicked away', () => {
        render(
            <>
                <ConfirmationDialog
                    isOpen={true}
                    dialogTitle="test-message"
                    onCloseDialog={mockOnClose}
                    confirmText="confirm"
                    rejectText="reject"
                />
            </>
        );

        const button = screen.getByRole('button', { name: 'confirm' });

        userEvent.type(button, '{esc}');
        expect(mockOnClose).toBeCalledWith(undefined);
    });

    it('should close when close icon button is clicked', () => {
        expect(true).toBeFalsy();
    });
});
