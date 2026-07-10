import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoadingButton from './LoadingButton';

describe('LoadingButton', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        user = userEvent.setup();
    });

    const mockOnClick = vi.fn();
    it('should render', () => {
        render(<LoadingButton text="test" variant="text" onClick={mockOnClick} />);
    });

    it('should be disabled', () => {
        render(<LoadingButton text="test" variant="text" disabled={true} onClick={mockOnClick} />);
        const button = screen.getByText('test');
        expect(button).toBeDisabled();
    });

    it('should not be disabled', () => {
        render(<LoadingButton text="test" variant="text" disabled={false} onClick={mockOnClick} />);
        const button = screen.getByText('test');
        expect(button).not.toBeDisabled();
    });

    it('should show a loading spinner when loading', () => {
        render(<LoadingButton text="test" variant="text" disabled={false} isLoading={true} onClick={mockOnClick} />);

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show the given text', () => {
        render(<LoadingButton text="test" variant="text" disabled={false} onClick={mockOnClick} />);
        expect(screen.getByText('test')).toBeInTheDocument();
    });

    it('should call the click handler when clicked', async () => {
        render(<LoadingButton text="test" variant="text" disabled={false} onClick={mockOnClick} />);
        const button = screen.getByText('test');
        await user.click(button);

        expect(mockOnClick).toHaveBeenCalled();
    });
});
