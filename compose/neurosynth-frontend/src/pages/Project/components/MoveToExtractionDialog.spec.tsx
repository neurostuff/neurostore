import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useInitExtraction from 'pages/Project/hooks/useInitExtraction';
import { useNavigate } from 'react-router-dom';
import { Mock } from 'vitest';
import MoveToExtractionDialog from './MoveToExtractionDialog';

vi.mock('components/Dialogs/BaseDialog');
vi.mock('pages/Project/hooks/useInitExtraction');
vi.mock('react-router-dom');
vi.mock('stores/projects/ProjectStore');

const EXTRACTION_PROGRESS_STEPS = [
    { progress: 0, progressText: 'creating studyset...' },
    { progress: 100 / 3, progressText: 'creating annotations...' },
    { progress: 200 / 3, progressText: 'ingesting...' },
    { progress: 100, progressText: 'process complete' },
] as const;

const mockInitExtraction = (
    overrides: {
        doExtraction?: Mock;
        progress?: number;
        progressText?: string;
        isError?: boolean;
    } = {}
) => {
    (useInitExtraction as Mock).mockReturnValue({
        doExtraction: vi.fn().mockResolvedValue(true),
        reset: vi.fn(),
        progress: 0,
        progressText: 'creating studyset...',
        isError: false,
        ...overrides,
    });
};

describe('MoveToExtractionDialog', () => {
    beforeEach(() => {
        mockInitExtraction();
        (useNavigate() as Mock).mockClear();
    });

    it('does not show the skip page until skip is clicked', () => {
        render(<MoveToExtractionDialog isOpen onCloseDialog={vi.fn()} />);

        expect(screen.getByText(/Congratulations on completing the Curation phase/)).toBeInTheDocument();
        expect(screen.queryByText('Skip extraction?')).not.toBeInTheDocument();
    });

    it('shows the skip page when skip is clicked', async () => {
        render(<MoveToExtractionDialog isOpen onCloseDialog={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'Skip Extraction' }));

        expect(screen.getByText('Skip extraction?')).toBeInTheDocument();
        expect(screen.queryByText(/Congratulations on completing the Curation phase/)).not.toBeInTheDocument();
    });

    it('returns to the intro when skip is cancelled', async () => {
        render(<MoveToExtractionDialog isOpen onCloseDialog={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'Skip Extraction' }));
        await userEvent.click(screen.getByRole('button', { name: 'BACK' }));

        expect(screen.queryByText('Skip extraction?')).not.toBeInTheDocument();
        expect(screen.getByText(/Congratulations on completing the Curation phase/)).toBeInTheDocument();
        expect(screen.getByTestId('mock-base-dialog')).toBeInTheDocument();
    });

    it('navigates to the project page when skip extraction completes', async () => {
        const onCloseDialog = vi.fn();
        render(<MoveToExtractionDialog isOpen onCloseDialog={onCloseDialog} />);

        await userEvent.click(screen.getByRole('button', { name: 'Skip Extraction' }));
        await userEvent.click(screen.getByRole('button', { name: 'Yes, skip Extraction' }));

        expect(useInitExtraction().doExtraction).toHaveBeenCalledWith(true);
        expect(onCloseDialog).toHaveBeenCalled();
        expect(useNavigate()).toHaveBeenCalledWith('/projects/project-id/project', {
            state: {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
            },
        });
    });

    it('shows extraction details after NEXT and starts ingestion on START', async () => {
        render(<MoveToExtractionDialog isOpen onCloseDialog={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'NEXT' }));

        expect(screen.getByText('Your main tasks in this step')).toBeInTheDocument();
        expect(screen.getByText('Add & Review Study Data')).toBeInTheDocument();
        expect(screen.getByText('Annotate Analyses')).toBeInTheDocument();
        expect(screen.getByText('Once you start, the system will automatically:')).toBeInTheDocument();
        expect(screen.getByText('Create a studyset')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ingest' })).toBeInTheDocument();
        expect(screen.getByText('Create a default "included" annotation column')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'START' }));

        expect(useInitExtraction().doExtraction).toHaveBeenCalledWith(false);
        expect(screen.getByText('creating studyset...')).toBeInTheDocument();
        expect(screen.getByText('(This may take a minute)')).toBeInTheDocument();
    });

    it('returns to the intro from the extraction details page when BACK is clicked', async () => {
        render(<MoveToExtractionDialog isOpen onCloseDialog={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'NEXT' }));
        expect(screen.getByText('Your main tasks in this step')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'BACK' }));

        expect(screen.getByText(/Congratulations on completing the Curation phase/)).toBeInTheDocument();
        expect(screen.queryByText('Your main tasks in this step')).not.toBeInTheDocument();
        expect(useInitExtraction().doExtraction).not.toHaveBeenCalled();
    });

    it.each(EXTRACTION_PROGRESS_STEPS)(
        'shows progress $progress and "$progressText" during initialization',
        async ({ progress, progressText }) => {
            mockInitExtraction({ progress, progressText });
            render(<MoveToExtractionDialog isOpen onCloseDialog={vi.fn()} />);

            await userEvent.click(screen.getByRole('button', { name: 'NEXT' }));
            await userEvent.click(screen.getByRole('button', { name: 'START' }));

            expect(screen.getByText(progressText)).toBeInTheDocument();
            expect(screen.getByRole('progressbar', { value: { now: Math.round(progress) } })).toBeInTheDocument();
            expect(screen.getByText('(This may take a minute)')).toBeInTheDocument();
        }
    );
});
