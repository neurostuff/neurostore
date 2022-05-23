import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalysisPointsDeleteButton from './AnalysisPointsDeleteButton';

jest.mock('components/Dialogs/ConfirmationDialog/ConfirmationDialog');

describe('AnalysisPointsDeleteButton Component', () => {
    const mockOnDelete = jest.fn();

    beforeEach(() => {
        mockOnDelete.mockClear();
        render(<AnalysisPointsDeleteButton pointId={'test-id'} onDelete={mockOnDelete} />);
    });

    it('should render', () => {});

    it('should open the confirmation dialog when delete is clicked', () => {
        userEvent.click(screen.getByRole('button', { name: 'delete' }));
        expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
    });

    it('should delete', () => {
        userEvent.click(screen.getByRole('button', { name: 'delete' }));
        userEvent.click(screen.getByTestId('accept-close-confirmation'));
        expect(mockOnDelete).toHaveBeenCalledWith('test-id');
    });

    it('should not delete when no is clicked', () => {
        userEvent.click(screen.getByRole('button', { name: 'delete' }));
        userEvent.click(screen.getByTestId('deny-close-confirmation'));
        expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should not delete when clicked away', () => {
        userEvent.click(screen.getByRole('button', { name: 'delete' }));
        userEvent.click(screen.getByTestId('undecided-close-confirmation'));
        expect(mockOnDelete).not.toHaveBeenCalled();
    });
});
