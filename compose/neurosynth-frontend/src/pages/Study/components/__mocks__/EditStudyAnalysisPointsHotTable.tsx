const MockEditStudyAnalysisPointsHotTable: React.FC<{ analysisId?: string }> = ({ analysisId }) => (
    <div data-testid="mock-analysis-points-hot-table">{analysisId ?? ''}</div>
);

export default MockEditStudyAnalysisPointsHotTable;
