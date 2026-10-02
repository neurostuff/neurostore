import { useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGetMetaAnalysisResultById } from 'hooks';
import { CitationFormat } from 'hooks/useCitationCopy.consts';
import { mockMetaAnalysisResult } from 'testing/mockData';
import { Mock, vi } from 'vitest';
import CiteMe from './CiteMe';

const mockUseCitationCopy = vi.fn();

vi.mock('hooks/useCitationCopy', () => ({
    useCitationCopy: () => mockUseCitationCopy(),
}));
vi.mock('hooks');
vi.mock('@tanstack/react-query');

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
        (useGetMetaAnalysisResultById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: mockMetaAnalysisResult(),
        });
        (useQuery as Mock).mockReturnValue({ isLoading: false, isError: false, data: undefined });
    });

    it('renders loading spinner when citations are loading', async () => {
        mockUseCitationCopy.mockReturnValue({
            isCitationLoading: true,
            citationPayload: undefined,
        });

        render(<CiteMe metaAnalysis={undefined} />);

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        expect(screen.queryByText('Copy citations in your preferred format:')).not.toBeInTheDocument();
    });

    it('renders no citation formats when citation payload is null', async () => {
        mockUseCitationCopy.mockReturnValue({
            isCitationLoading: false,
            citationPayload: null,
        });

        render(<CiteMe metaAnalysis={undefined} />);

        expect(screen.queryByText('Copy citations in your preferred format:')).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('does not render the methods section when the result has no methods or version', async () => {
        render(<CiteMe metaAnalysis={undefined} />);

        expect(screen.queryByText('Methods')).not.toBeInTheDocument();
    });

    it('renders the compose-runner version and the methods with readable citations', async () => {
        (useGetMetaAnalysisResultById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: {
                ...mockMetaAnalysisResult(),
                cli_version: '0.6.6',
                method_description: 'An ALE meta-analysis was performed with NiMARE \\citep{Salo2023}.',
                method_references: '@article{Salo2023, ...}',
            },
        });
        (useQuery as Mock).mockReturnValue({
            isLoading: false,
            data: {
                description: 'An ALE meta-analysis was performed with NiMARE (Salo et al., 2023).',
                references: 'Salo, T. (2023). NiMARE. Aperture Neuro, 3.',
            },
        });

        render(<CiteMe metaAnalysis={undefined} />);

        expect(
            screen.getByText(
                'Run with compose-runner 0.6.6, which pins the NiMARE version used for this meta-analysis.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('An ALE meta-analysis was performed with NiMARE (Salo et al., 2023).')
        ).toBeInTheDocument();
        expect(screen.getByText('References')).toBeInTheDocument();
        expect(screen.getByText('Salo, T. (2023). NiMARE. Aperture Neuro, 3.')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Copy to clipboard' })).toHaveLength(3);
    });

    it('falls back to the raw method description when citations could not be formatted', async () => {
        (useGetMetaAnalysisResultById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: {
                ...mockMetaAnalysisResult(),
                method_description: 'An ALE meta-analysis \\citep{Salo2023}.',
            },
        });
        (useQuery as Mock).mockReturnValue({ isLoading: false, isError: true, data: undefined });

        render(<CiteMe metaAnalysis={undefined} />);

        expect(screen.getByText('An ALE meta-analysis \\citep{Salo2023}.')).toBeInTheDocument();
        expect(screen.queryByText('References')).not.toBeInTheDocument();
    });

    it('renders heading, dropdown, and default APA citation when loaded', async () => {
        render(<CiteMe metaAnalysis={undefined} />);

        expect(screen.getByText('Copy citations in your preferred format:')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByDisplayValue('apa')).toBeInTheDocument();
        expect(screen.getByText('APA citation text')).toBeInTheDocument();
    });

    it('shows all citation format options in dropdown with APA and BibTeX first', async () => {
        render(<CiteMe metaAnalysis={undefined} />);

        await userEvent.click(screen.getByRole('combobox'));

        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(4);
        expect(options[0]).toHaveTextContent('APA');
        expect(options[1]).toHaveTextContent('BibTeX');
        expect(options[2]).toHaveTextContent('Vancouver');
        expect(options[3]).toHaveTextContent('Harvard');
    });

    it('updates displayed citation when selecting different format from dropdown', async () => {
        render(<CiteMe metaAnalysis={undefined} />);

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
