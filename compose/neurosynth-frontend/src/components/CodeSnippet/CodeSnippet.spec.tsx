import { act, fireEvent, render, screen } from '@testing-library/react';
import CodeSnippet from './CodeSnippet';

describe('CodeSnippet', () => {
    it('should render', () => {
        render(<CodeSnippet linesOfCode={[]} />);
    });

    it('should display the text', () => {
        render(<CodeSnippet linesOfCode={['example 1', 'example 2']} />);
        expect(screen.getByText('example 1')).toBeInTheDocument();
        expect(screen.getByText('example 2')).toBeInTheDocument();
    });

    describe('copy action', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                    writeText: vi.fn(() => Promise.resolve()),
                },
            });
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should change text to copied and back to copy', async () => {
            render(<CodeSnippet linesOfCode={['example 1']} />);
            const copybutton = screen.getByTestId('ContentCopyIcon');

            await act(async () => {
                fireEvent.click(copybutton);
            });

            expect(screen.getByText('✓')).toBeInTheDocument();

            await act(async () => {
                vi.advanceTimersByTime(2500);
            });

            expect(screen.getByTestId('ContentCopyIcon')).toBeInTheDocument();
        });

        it('should write the text to clipboard when clicked', async () => {
            render(<CodeSnippet linesOfCode={['example 1', 'example 2']} />);

            const copybutton = screen.getByTestId('ContentCopyIcon');
            await act(async () => {
                fireEvent.click(copybutton);
            });
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('example 1\nexample 2');
        });
    });
});
