import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeSnippet } from '..';

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
        jest.useFakeTimers();
        beforeEach(() => {
            Object.assign(navigator, {
                clipboard: {
                    writeText: jest.fn(() => Promise.resolve()),
                },
            });
        });

        it('should change text to copied and back to copy', () => {
            render(<CodeSnippet linesOfCode={['example 1']} />);
            const copybutton = screen.getByRole('button', { name: 'copy' });

            userEvent.click(copybutton);

            let copyText = screen.queryByText('copied!');
            expect(copyText).toBeInTheDocument();

            act(() => {
                // set text back to copy
                jest.advanceTimersByTime(2500);
            });

            copyText = screen.queryByText('copy');
            expect(copyText).toBeInTheDocument();
        });

        it('should write the text to clipboard when clicked', () => {
            render(<CodeSnippet linesOfCode={['example 1', 'example 2']} />);

            const copybutton = screen.getByRole('button', { name: 'copy' });
            userEvent.click(copybutton);
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('\nexample 1\nexample 2');
        });
    });
});
