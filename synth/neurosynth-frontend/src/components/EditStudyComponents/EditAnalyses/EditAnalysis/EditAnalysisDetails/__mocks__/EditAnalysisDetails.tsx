import { IEditAnalysisDetails } from '../../..';

const mockEditAnalysisDetails: React.FC<IEditAnalysisDetails> = (props) => {
    return (
        <>
            <h1>mock edit analysis general</h1>
            <button data-testid="mock-on-edit-analysis-details"></button>
            <button
                data-testid="mock-on-edit-analysis-details-button-press"
                onClick={(_event) => {}}
            ></button>
        </>
    );
};

export default mockEditAnalysisDetails;
