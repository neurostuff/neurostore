import { Mock, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getResultStatus } from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisResultById, useUserCanEdit } from 'hooks';
import MetaAnalysisStatusChip from './MetaAnalysisStatusChip';
import useGetMetaAnalysisJobById from '../hooks/useGetMetaAnalysisJobById';
import useGetMetaAnalysisJobsByMetaAnalysisId from '../hooks/useGetMetaAnalysisJobsByMetaAnalysisId';

vi.mock('hooks');
vi.mock('stores/projects/ProjectStore');
vi.mock('../hooks/useGetMetaAnalysisJobsByMetaAnalysisId');
vi.mock('../hooks/useGetMetaAnalysisJobById');
vi.mock('helpers/MetaAnalysis.helpers', async () => {
    const actual = await vi.importActual<typeof import('helpers/MetaAnalysis.helpers')>('helpers/MetaAnalysis.helpers');
    return {
        ...actual,
        getResultStatus: vi.fn(),
    };
});

const metaAnalysis = {
    id: 'meta-1',
    user: 'owner',
    results: ['result-1', 'result-2'],
};

const result = { id: 'result-2' };
const latestJob = { job_id: 'job-2', status: 'RUNNING' };

const status = {
    statusText: 'Custom status',
    status: 'NONE' as const,
    color: 'success' as const,
    severity: 'success' as const,
    description: 'Custom detail',
};

describe('MetaAnalysisStatusChip', () => {
    beforeEach(() => {
        (getResultStatus as Mock).mockReturnValue(status);
        (useUserCanEdit as Mock).mockReturnValue(true);
        (useGetMetaAnalysisResultById as Mock).mockReturnValue({
            data: result,
            isLoading: false,
            isError: false,
        });
        (useGetMetaAnalysisJobsByMetaAnalysisId as Mock).mockReturnValue({
            data: [{ job_id: 'job-1' }, latestJob],
            isLoading: false,
            isError: false,
        });
        (useGetMetaAnalysisJobById as Mock).mockReturnValue({
            data: latestJob,
            isLoading: false,
            isError: false,
        });
    });

    it('renders the status for the latest result and job', async () => {
        const user = userEvent.setup();
        render(<MetaAnalysisStatusChip metaAnalysis={metaAnalysis} />);

        expect(useGetMetaAnalysisResultById).toHaveBeenCalledWith('result-2');
        expect(useGetMetaAnalysisJobById).toHaveBeenCalledWith('job-2');
        expect(getResultStatus).toHaveBeenCalledWith(metaAnalysis, result, latestJob);

        const chip = screen.getByText('Custom status').closest('.MuiChip-root');
        expect(chip).toHaveClass('MuiChip-colorSuccess');
        await user.hover(screen.getByText('Custom status'));
        expect(await screen.findByRole('tooltip')).toHaveTextContent('Custom detail');
    });

    it('shows a progress indicator while the status is running', () => {
        (getResultStatus as Mock).mockReturnValue({ ...status, status: 'RUNNING', description: undefined });

        render(<MetaAnalysisStatusChip metaAnalysis={metaAnalysis} />);

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('does not show a progress indicator for other statuses', () => {
        render(<MetaAnalysisStatusChip metaAnalysis={metaAnalysis} />);

        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('renders nothing while status data is loading', () => {
        (useGetMetaAnalysisJobsByMetaAnalysisId as Mock).mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
        });

        const { container } = render(<MetaAnalysisStatusChip metaAnalysis={metaAnalysis} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('shows the chip when the resolved status is a failure', () => {
        (getResultStatus as Mock).mockReturnValue({ ...status, status: 'FAILED', color: 'error' });

        render(<MetaAnalysisStatusChip metaAnalysis={metaAnalysis} />);

        expect(screen.getByText('Custom status')).toBeInTheDocument();
    });

    it.each([
        [
            'jobs list',
            () =>
                (useGetMetaAnalysisJobsByMetaAnalysisId as Mock).mockReturnValue({
                    data: undefined,
                    isLoading: false,
                    isError: true,
                }),
        ],
        [
            'job detail',
            () =>
                (useGetMetaAnalysisJobById as Mock).mockReturnValue({
                    data: undefined,
                    isLoading: false,
                    isError: true,
                }),
        ],
        [
            'result',
            () =>
                (useGetMetaAnalysisResultById as Mock).mockReturnValue({
                    data: undefined,
                    isLoading: false,
                    isError: true,
                }),
        ],
    ])('renders nothing when the %s request fails', (_request, mockFailure) => {
        mockFailure();

        const { container } = render(<MetaAnalysisStatusChip metaAnalysis={metaAnalysis} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('loads jobs for the meta-analysis owner when they cannot edit the project', () => {
        (useUserCanEdit as Mock).mockImplementation((user?: string) => user === 'owner');

        render(<MetaAnalysisStatusChip metaAnalysis={metaAnalysis} />);

        expect(useGetMetaAnalysisJobsByMetaAnalysisId).toHaveBeenCalledWith('meta-1', true);
        expect(getResultStatus).toHaveBeenCalledWith(metaAnalysis, result, latestJob);
    });

    it('does not require jobs when the viewer cannot edit the project or the meta-analysis', () => {
        (useUserCanEdit as Mock).mockReturnValue(false);
        (useGetMetaAnalysisJobsByMetaAnalysisId as Mock).mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: true,
        });
        (useGetMetaAnalysisJobById as Mock).mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: false,
        });

        render(<MetaAnalysisStatusChip metaAnalysis={metaAnalysis} />);

        expect(useGetMetaAnalysisJobsByMetaAnalysisId).toHaveBeenCalledWith('meta-1', false);
        expect(getResultStatus).toHaveBeenCalledWith(metaAnalysis, result, undefined);
        expect(screen.getByText('Custom status')).toBeInTheDocument();
    });
});
