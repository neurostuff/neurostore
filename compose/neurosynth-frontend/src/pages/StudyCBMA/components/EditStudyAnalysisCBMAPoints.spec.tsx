import { vi, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useProjectId } from 'stores/projects/ProjectStore';
import { useStudyCBMAContext } from 'pages/StudyCBMA/context/StudyCBMAContext';
import { useStudyAnalysisPoints } from 'stores/study/StudyStore';
import { IStorePoint } from 'stores/study/StudyStore.helpers';
import { mockStorePoints } from 'testing/mockData';
import EditStudyAnalysisCBMAPoints from './EditStudyAnalysisCBMAPoints';

vi.mock('stores/study/StudyStore.ts');
vi.mock('pages/StudyCBMA/context/StudyCBMAContext');
vi.mock('pages/StudyCBMA/components/EditStudyAnalysisCBMAPointsTableContainer');
vi.mock('pages/StudyCBMA/components/EditStudyAnalysisCBMAPointSpaceAndStatistic');
vi.mock('./RelegateExtractionStudyDialog');
vi.mock('react-router-dom');
vi.mock('stores/projects/ProjectStore');
vi.mock('notistack');

const RELEGATE_LINK_TEXT = /I couldn't find coordinates for this study/i;

const renderPoints = (analysisId = 'analysis-1') => render(<EditStudyAnalysisCBMAPoints analysisId={analysisId} />);

describe('EditStudyAnalysisPoints', () => {
    const mockNavigate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useNavigate as Mock).mockReturnValue(mockNavigate);
        (useProjectId as Mock).mockReturnValue('project-id');
        (useSnackbar as Mock).mockReturnValue({ enqueueSnackbar: vi.fn() });
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
        (useStudyCBMAContext as Mock).mockReturnValue({
            pointsTableRef: { current: null },
            pointsTableSeed: 0,
        });
    });

    it('renders the Analysis Coordinates heading', async () => {
        renderPoints();
        expect(screen.getByText('Analysis Coordinates')).toBeInTheDocument();
    });

    it('passes analysisId to coordinate subcomponents', async () => {
        renderPoints('analysis-xyz');
        expect(screen.getByTestId('mock-analysis-points-hot-table')).toHaveTextContent('analysis-xyz');
        expect(screen.getByTestId('mock-point-space-and-statistic')).toHaveTextContent('analysis-xyz');
    });

    it('shows the relegate link text when there are no coordinates (empty points)', async () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
        renderPoints();
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();
    });

    it('shows the relegate link when only empty placeholder rows exist (store initPointIfEmpty shape)', async () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([
            {
                id: 'placeholder-id',
                isNew: true,
                x: undefined,
                y: undefined,
                z: undefined,
                value: undefined,
                subpeak: undefined,
                cluster_size: undefined,
                deactivation: undefined,
            } as IStorePoint,
        ]);
        renderPoints();
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();
    });

    it('shows the relegate link when any point is missing a coordinate', async () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([
            {
                id: 'complete',
                isNew: false,
                x: 1,
                y: 2,
                z: 3,
            } as IStorePoint,
            {
                id: 'incomplete',
                isNew: false,
                x: 4,
                y: undefined,
                z: 6,
            } as IStorePoint,
        ]);
        renderPoints();
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();
    });

    it('shows the relegate link when a persisted row is missing a coordinate', async () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([
            {
                id: 'p1',
                isNew: false,
                x: 10,
                y: undefined,
                z: 30,
            } as IStorePoint,
        ]);
        renderPoints();
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();
    });

    it('does not show the relegate link when a new row has a full coordinate triple entered', async () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([
            {
                id: 'p1',
                isNew: true,
                x: 10,
                y: 20,
                z: 30,
                value: undefined,
            } as IStorePoint,
        ]);
        renderPoints();
        expect(screen.queryByText(RELEGATE_LINK_TEXT)).not.toBeInTheDocument();
    });

    it('shows the relegate link text when points is null', async () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue(null);
        renderPoints();
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();
    });

    it('does not show the relegate link text when points exist', async () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue(mockStorePoints());
        renderPoints();
        expect(screen.queryByText(RELEGATE_LINK_TEXT)).not.toBeInTheDocument();
    });

    it('reseeds the relegate link when the points table seed changes', () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
        const { rerender } = renderPoints('analysis-1');
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();

        (useStudyAnalysisPoints as Mock).mockReturnValue(mockStorePoints());
        (useStudyCBMAContext as Mock).mockReturnValue({
            pointsTableRef: { current: null },
            pointsTableSeed: 1,
        });
        rerender(<EditStudyAnalysisCBMAPoints analysisId="analysis-1" />);
        expect(screen.queryByText(RELEGATE_LINK_TEXT)).not.toBeInTheDocument();
    });

    it('hides the relegate link when the table reports that every point has coordinates', async () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
        renderPoints();
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('mock-report-complete-coordinates'));
        expect(screen.queryByText(RELEGATE_LINK_TEXT)).not.toBeInTheDocument();
    });

    it('shows the relegate link when the table reports that a point is missing coordinates', async () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue(mockStorePoints());
        renderPoints();
        expect(screen.queryByText(RELEGATE_LINK_TEXT)).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('mock-report-incomplete-coordinates'));
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();
    });

    it('opens the relegate dialog when the link is clicked', async () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
        renderPoints();

        expect(screen.getByTestId('mock-relegate-closed')).toBeInTheDocument();

        await userEvent.click(screen.getByText(RELEGATE_LINK_TEXT));

        expect(screen.getByTestId('mock-relegate-confirm')).toBeInTheDocument();
    });

    it('navigates to extraction and enqueues a snackbar when relegate is confirmed', async () => {
        const enqueueSnackbar = vi.fn();
        (useSnackbar as Mock).mockReturnValue({ enqueueSnackbar });
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
        renderPoints();

        await userEvent.click(screen.getByText(RELEGATE_LINK_TEXT));
        await userEvent.click(screen.getByTestId('mock-relegate-confirm'));

        expect(mockNavigate).toHaveBeenCalledWith('/projects/project-id/extraction');
        expect(enqueueSnackbar).toHaveBeenCalledWith(
            'Study removed from extraction phase and marked as "Insufficient details"',
            { variant: 'success' }
        );
    });
});
