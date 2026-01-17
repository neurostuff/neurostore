import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavigationButtons, { ENavigationButton } from './NavigationButtons';

describe('NavigationButtons Component', () => {
    const mockOnButtonClick = vi.fn();

    it('should render', () => {
        render(<NavigationButtons onButtonClick={mockOnButtonClick} />);
    });

    it('should disable the previous button', () => {
        render(
            <NavigationButtons prevButtonText="previous" prevButtonDisabled={true} onButtonClick={mockOnButtonClick} />
        );
        const previousButton = screen.getByText('previous');
        expect(previousButton).toBeDisabled();
    });

    it('should not disable the previous button', () => {
        render(
            <NavigationButtons prevButtonText="previous" prevButtonDisabled={false} onButtonClick={mockOnButtonClick} />
        );
        const previousButton = screen.getByText('previous');
        expect(previousButton).not.toBeDisabled();
    });

    it('should disable the next button', () => {
        render(<NavigationButtons nextButtonDisabled={true} nextButtonText="next" onButtonClick={mockOnButtonClick} />);
        const previousButton = screen.getByText('next');
        expect(previousButton).toBeDisabled();
    });

    it('should not disable the next button', () => {
        render(
            <NavigationButtons nextButtonDisabled={false} nextButtonText="next" onButtonClick={mockOnButtonClick} />
        );
        const previousButton = screen.getByText('next');
        expect(previousButton).not.toBeDisabled();
    });

    it('should handle the previous button click', () => {
        render(<NavigationButtons prevButtonText="previous" onButtonClick={mockOnButtonClick} />);
        userEvent.click(screen.getByText('previous'));
        expect(mockOnButtonClick).toBeCalledWith(ENavigationButton.PREV);
    });

    it('should handle the next button click', () => {
        render(<NavigationButtons nextButtonText="next" onButtonClick={mockOnButtonClick} />);
        userEvent.click(screen.getByText('next'));
        expect(mockOnButtonClick).toBeCalledWith(ENavigationButton.NEXT);
    });

    describe('button style', () => {
        it('should be contained', () => {
            render(
                <NavigationButtons
                    prevButtonText="previous"
                    prevButtonStyle="contained"
                    onButtonClick={mockOnButtonClick}
                />
            );
            const prevButton = screen.getByText('previous');
            expect(prevButton).toHaveClass('MuiButton-contained');
        });

        it('should be outlined', () => {
            render(
                <NavigationButtons
                    prevButtonText="previous"
                    prevButtonStyle="outlined"
                    onButtonClick={mockOnButtonClick}
                />
            );
            const prevButton = screen.getByText('previous');
            expect(prevButton).toHaveClass('MuiButton-outlined');
        });

        it('should be text', () => {
            render(
                <NavigationButtons prevButtonText="previous" prevButtonStyle="text" onButtonClick={mockOnButtonClick} />
            );
            const prevButton = screen.getByText('previous');
            expect(prevButton).toHaveClass('MuiButton-text');
        });
    });
});
