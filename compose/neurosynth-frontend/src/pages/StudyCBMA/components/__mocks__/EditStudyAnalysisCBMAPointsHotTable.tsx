const MockEditStudyAnalysisPointsHotTable = ({  analysisId  }: { analysisId?: string }) => (
    <div data-testid="mock-analysis-points-hot-table">{analysisId ?? ''}</div>
);

export default MockEditStudyAnalysisPointsHotTable;
