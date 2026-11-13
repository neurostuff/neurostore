const MockEditStudyAnalysisCBMAPointsTableContainer = ({
    analysisId,
    onAllPointsHaveCoordinates,
}: {
    analysisId?: string;
    onAllPointsHaveCoordinates?: (pointsHaveCoordinates: boolean) => void;
}) => (
    <div>
        <div data-testid="mock-analysis-points-hot-table">{analysisId ?? ''}</div>
        <button
            type="button"
            data-testid="mock-report-complete-coordinates"
            onClick={() => onAllPointsHaveCoordinates?.(true)}
        >
            complete
        </button>
        <button
            type="button"
            data-testid="mock-report-incomplete-coordinates"
            onClick={() => onAllPointsHaveCoordinates?.(false)}
        >
            incomplete
        </button>
    </div>
);

export default MockEditStudyAnalysisCBMAPointsTableContainer;
