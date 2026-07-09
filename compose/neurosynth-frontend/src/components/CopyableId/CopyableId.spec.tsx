import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CopyableId from './CopyableId';

const mockCopy = vi.hoisted(() => vi.fn());
const hookState = vi.hoisted(() => ({ copied: false }));

vi.mock('hooks/useCopyToClipboard', () => ({
    default: () => ({ copied: hookState.copied, copyToClipboard: mockCopy }),
}));

describe('CopyableId', () => {
    beforeEach(() => {
        mockCopy.mockClear();
        hookState.copied = false;
    });

    it('renders the label and id', () => {
        render(<CopyableId label="Studyset ID" id="abc123" />);
        expect(screen.getByText('Studyset ID:')).toBeInTheDocument();
        expect(screen.getByText('abc123')).toBeInTheDocument();
    });

    it('renders nothing when id is empty', () => {
        const { container } = render(<CopyableId label="Studyset ID" id={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('copies the id when the copy button is clicked', () => {
        render(<CopyableId label="Studyset ID" id="abc123" />);
        userEvent.click(screen.getByRole('button', { name: 'Copy Studyset ID' }));
        expect(mockCopy).toHaveBeenCalledWith('abc123');
    });

    it('shows the copied state', () => {
        hookState.copied = true;
        render(<CopyableId label="Studyset ID" id="abc123" />);
        expect(screen.getByTestId('CheckIcon')).toBeInTheDocument();
    });
});
