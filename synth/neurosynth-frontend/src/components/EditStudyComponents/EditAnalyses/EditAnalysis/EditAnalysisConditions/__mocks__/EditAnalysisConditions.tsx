import { EAnalysisEdit, EAnalysisEditButtonType, IEditAnalysisConditions } from '../../..';

const EditAnalysisConditions: React.FC<IEditAnalysisConditions> = (props) => {
    return (
        <>
            <h1>mock edit analysis conditions</h1>
            <button
                data-testid="mock-on-edit-analysis-conditions"
                // onClick={(_event) => props.onConditionWeightChange([], [])}
            ></button>
            <button
                data-testid="mock-on-edit-analysis-conditions-button-press"
                onClick={
                    (_event) => {}
                    // props.onEditAnalysisButtonPress(
                    //     EAnalysisEdit.CONDITIONS,
                    //     EAnalysisEditButtonType.SAVE
                    // )
                }
            ></button>
        </>
    );
};

export default EditAnalysisConditions;
