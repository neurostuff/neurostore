import { mockPoints } from 'testing/mockData';
import { IAnalysisPointsHeader } from '../AnalysisPointsHeader';

const mockAnalysisPointsHeader: React.FC<IAnalysisPointsHeader> = (props) => {
    return (
        <div>
            <button data-testid="trigger-add-point" onClick={() => props.onCreatePoint()}></button>
            <button
                data-testid="trigger-move-point"
                onClick={() =>
                    props.onMovePoints(
                        'test-analysisId',
                        mockPoints().map((x) => x.id || '')
                    )
                }
            ></button>
        </div>
    );
};

export default mockAnalysisPointsHeader;
