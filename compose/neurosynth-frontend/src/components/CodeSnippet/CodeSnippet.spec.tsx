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
        let writeTextMock: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            vi.useFakeTimers();
            writeTextMock = vi.fn(() => Promise.resolve());
            Object.defineProperty(window.navigator, 'clipboard', {
                value: {
                    writeText: writeTextMock,
                },
                configurable: true,
            });
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should change text to copied and back to copy', async () => {
            render(<CodeSnippet linesOfCode={['example 1']} />);
            const copybutton = screen.getByTestId('ContentCopyIcon');

            fireEvent.click(copybutton);
            await act(async () => {
                await Promise.resolve();
            });

            expect(screen.getByText('✓')).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(2500);
            });

            expect(screen.getByTestId('ContentCopyIcon')).toBeInTheDocument();
        });

        it('should write the text to clipboard when clicked', async () => {
            render(<CodeSnippet linesOfCode={['example 1', 'example 2']} />);

            const copybutton = screen.getByTestId('ContentCopyIcon');
            fireEvent.click(copybutton);
            await act(async () => {
                await Promise.resolve();
            });
            expect(writeTextMock).toHaveBeenCalledWith('example 1\nexample 2');
        });
    });
});
