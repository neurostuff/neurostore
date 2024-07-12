import { AnalysisReturn } from 'neurostore-typescript-sdk';
import { IStoreAnalysis } from 'pages/Study/store/StudyStore.helpers';

const MockEditAnalysesListItem: React.FC<{
    analysis: AnalysisReturn | IStoreAnalysis;
    selected: boolean;
    index: number;
    onSelectAnalysis: (analysisId: string, index: number) => void;
}> = (props) => {
    return (
        <div data-testid="mock-edit-analyses-list-item">
            <div data-testid="test-name">{props.analysis.name}</div>
            <div data-testid="test-description">{props.analysis.description}</div>
            <button
                data-testid="test-trigger-select-analysis"
                onClick={() => props.onSelectAnalysis(props.analysis.id || '', props.index)}
            ></button>
        </div>
    );
};

export default MockEditAnalysesListItem;
