const MockEditStudyAnalysisPointSpaceAndStatistic: React.FC<{ analysisId?: string }> = ({ analysisId }) => (
    <div data-testid="mock-point-space-and-statistic">{analysisId ?? ''}</div>
);

export default MockEditStudyAnalysisPointSpaceAndStatistic;
