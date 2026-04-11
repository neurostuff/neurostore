import { vi, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useProjectId } from 'pages/Project/store/ProjectStore';
import { useStudyAnalysisPoints } from 'pages/Study/store/StudyStore';
import { IStorePoint } from 'pages/Study/store/StudyStore.helpers';
import { mockStorePoints } from 'testing/mockData';
import EditStudyAnalysisPoints from './EditStudyAnalysisPoints';

vi.mock('pages/Study/components/EditStudyAnalysisPointsHotTable.tsx');
vi.mock('pages/Study/components/EditStudyAnalysisPointSpaceAndStatistic.tsx');
vi.mock('./RelegateExtractionStudyDialog.tsx');
vi.mock('react-router-dom');
vi.mock('pages/Project/store/ProjectStore.ts');
vi.mock('pages/Study/store/StudyStore.ts');
vi.mock('notistack');

const RELEGATE_LINK_TEXT = /I couldn't find coordinates for this study/i;

describe('EditStudyAnalysisPoints', () => {
    const mockNavigate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useNavigate as Mock).mockReturnValue(mockNavigate);
        (useProjectId as Mock).mockReturnValue('project-id');
        (useSnackbar as Mock).mockReturnValue({ enqueueSnackbar: vi.fn() });
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
    });

    it('renders the Analysis Coordinates heading', () => {
        render(<EditStudyAnalysisPoints analysisId="analysis-1" />);
        expect(screen.getByText('Analysis Coordinates')).toBeInTheDocument();
    });

    it('passes analysisId to coordinate subcomponents', () => {
        render(<EditStudyAnalysisPoints analysisId="analysis-xyz" />);
        expect(screen.getByTestId('mock-analysis-points-hot-table')).toHaveTextContent('analysis-xyz');
        expect(screen.getByTestId('mock-point-space-and-statistic')).toHaveTextContent('analysis-xyz');
    });

    it('calls useStudyAnalysisPoints with the current analysisId', () => {
        render(<EditStudyAnalysisPoints analysisId="analysis-abc" />);
        expect(useStudyAnalysisPoints).toHaveBeenCalledWith('analysis-abc');
    });

    it('shows the relegate link text when there are no coordinates (empty points)', () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
        render(<EditStudyAnalysisPoints analysisId="analysis-1" />);
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();
    });

    it('shows the relegate link when only empty placeholder rows exist (store initPointIfEmpty shape)', () => {
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
        render(<EditStudyAnalysisPoints analysisId="analysis-1" />);
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();
    });

    it('does not show the relegate link when a new row has a full coordinate triple entered', () => {
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
        render(<EditStudyAnalysisPoints analysisId="analysis-1" />);
        expect(screen.queryByText(RELEGATE_LINK_TEXT)).not.toBeInTheDocument();
    });

    it('shows the relegate link text when points is null', () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue(null);
        render(<EditStudyAnalysisPoints analysisId="analysis-1" />);
        expect(screen.getByText(RELEGATE_LINK_TEXT)).toBeInTheDocument();
    });

    it('does not show the relegate link text when points exist', () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue(mockStorePoints());
        render(<EditStudyAnalysisPoints analysisId="analysis-1" />);
        expect(screen.queryByText(RELEGATE_LINK_TEXT)).not.toBeInTheDocument();
    });

    it('opens the relegate dialog when the link is clicked', () => {
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
        render(<EditStudyAnalysisPoints analysisId="analysis-1" />);

        expect(screen.getByTestId('mock-relegate-closed')).toBeInTheDocument();

        userEvent.click(screen.getByText(RELEGATE_LINK_TEXT));

        expect(screen.getByTestId('mock-relegate-confirm')).toBeInTheDocument();
    });

    it('navigates to extraction and enqueues a snackbar when relegate is confirmed', () => {
        const enqueueSnackbar = vi.fn();
        (useSnackbar as Mock).mockReturnValue({ enqueueSnackbar });
        (useStudyAnalysisPoints as Mock).mockReturnValue([]);
        render(<EditStudyAnalysisPoints analysisId="analysis-1" />);

        userEvent.click(screen.getByText(RELEGATE_LINK_TEXT));
        userEvent.click(screen.getByTestId('mock-relegate-confirm'));

        expect(mockNavigate).toHaveBeenCalledWith('/projects/project-id/extraction');
        expect(enqueueSnackbar).toHaveBeenCalledWith(
            'Study removed from extraction phase and marked as "Insufficient details"',
            { variant: 'success' }
        );
    });
});
