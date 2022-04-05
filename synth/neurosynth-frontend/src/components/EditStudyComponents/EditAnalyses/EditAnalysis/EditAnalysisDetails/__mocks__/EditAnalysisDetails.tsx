import { EAnalysisEdit, EAnalysisEditButtonType, IEditAnalysisDetails } from '../../..';

const mockEditAnalysisDetails: React.FC<IEditAnalysisDetails> = (props) => {
    return (
        <>
            <h1>mock edit analysis general</h1>
            <button
                data-testid="mock-on-edit-analysis-details"
                onClick={() => props.onEditAnalysisDetails('name', 'example name')}
            ></button>
            <button
                data-testid="mock-on-edit-analysis-details-button-press"
                onClick={(_event) =>
                    props.onEditAnalysisButtonPress(
                        EAnalysisEdit.DETAILS,
                        EAnalysisEditButtonType.SAVE
                    )
                }
            ></button>
        </>
    );
};

export default mockEditAnalysisDetails;
