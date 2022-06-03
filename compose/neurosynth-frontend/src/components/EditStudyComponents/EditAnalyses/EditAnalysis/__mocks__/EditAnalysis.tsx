import { AnalysisReturn } from 'neurostore-typescript-sdk';
import { useState } from 'react';

const MockEditAnalysis: React.FC<{ analysis: AnalysisReturn | undefined }> = (props) => {
    const [tabIndex, setTabIndex] = useState(0);

    return (
        <div>
            <h1 data-testid="mock-edit-analysis-name">{props.analysis?.name || ''}</h1>
            <button
                data-testid="mock-edit-analysis-details"
                onClick={() => setTabIndex(0)}
            ></button>
            <button
                data-testid="mock-edit-analysis-conditions"
                onClick={() => setTabIndex(1)}
            ></button>
            <button data-testid="mock-edit-analysis-images" onClick={() => setTabIndex(2)}></button>
            <button
                data-testid="mock-edit-analysis-general"
                onClick={() => setTabIndex(3)}
            ></button>
            <div>
                {tabIndex === 0 && <div>mock-edit-analysis-details</div>}
                {tabIndex === 1 && <div>mock-edit-analysis-conditions</div>}
                {tabIndex === 2 && <div>mock-edit-analysis-images</div>}
                {tabIndex === 3 && <div>mock-edit-analysis-general</div>}
            </div>
        </div>
    );
};

export default MockEditAnalysis;
