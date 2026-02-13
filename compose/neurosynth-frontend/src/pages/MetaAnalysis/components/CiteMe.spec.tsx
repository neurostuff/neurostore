import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CitationFormat } from 'hooks/useCitationCopy.consts';
import { vi } from 'vitest';
import CiteMe from './CiteMe';

const mockUseCitationCopy = vi.fn();

vi.mock('hooks/useCitationCopy', () => ({
    useCitationCopy: () => mockUseCitationCopy(),
}));

const mockCitationPayload: Record<CitationFormat, string> = {
    apa: 'APA citation text',
    bibtex: '@article{key,\n  title={BibTeX citation},\n}',
    vancouver: 'Vancouver citation text',
    harvard1: 'Harvard citation text',
};

describe('CiteMe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseCitationCopy.mockReturnValue({
            isCitationLoading: false,
            citationPayload: mockCitationPayload,
        });
    });

    it('renders loading spinner when citations are loading', () => {
        mockUseCitationCopy.mockReturnValue({
            isCitationLoading: true,
            citationPayload: undefined,
        });

        render(<CiteMe />);

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        expect(screen.queryByText('Copy citations in your preferred format:')).not.toBeInTheDocument();
    });

    it('renders nothing when citation payload is null', () => {
        mockUseCitationCopy.mockReturnValue({
            isCitationLoading: false,
            citationPayload: null,
        });

        const { container } = render(<CiteMe />);

        expect(container.firstChild).toBeNull();
    });

    it('renders heading, dropdown, and default APA citation when loaded', () => {
        render(<CiteMe />);

        expect(screen.getByText('Copy citations in your preferred format:')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByDisplayValue('apa')).toBeInTheDocument();
        expect(screen.getByText('APA citation text')).toBeInTheDocument();
    });

    it('shows all citation format options in dropdown with APA and BibTeX first', async () => {
        render(<CiteMe />);

        userEvent.click(screen.getByRole('combobox'));

        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(4);
        expect(options[0]).toHaveTextContent('APA');
        expect(options[1]).toHaveTextContent('BibTeX');
        expect(options[2]).toHaveTextContent('Vancouver');
        expect(options[3]).toHaveTextContent('Harvard');
    });

    it('updates displayed citation when selecting different format from dropdown', async () => {
        render(<CiteMe />);

        expect(screen.getByText('APA citation text')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('combobox'));
        await userEvent.click(screen.getByRole('option', { name: 'BibTeX' }));

        expect(screen.getByText('@article{key,')).toBeInTheDocument();
        expect(screen.getByText(/title=\{BibTeX citation\}/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('combobox'));
        await userEvent.click(screen.getByRole('option', { name: 'Vancouver' }));

        expect(screen.getByText('Vancouver citation text')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('combobox'));
        await userEvent.click(screen.getByRole('option', { name: 'Harvard' }));

        expect(screen.getByText('Harvard citation text')).toBeInTheDocument();
    });
});
