import { EAnalysisEdit, EAnalysisEditButtonType, IEditAnalysis } from '../..';
import { mockConditions, mockWeights } from '../../../../../testing/mockData';

const mockEditAnalysis = jest.fn().mockImplementation((props: IEditAnalysis) => {
    const conditions = mockConditions();
    const weights = mockWeights();

    return (
        <>
            <button
                data-testid="mock-edit-analysis-details"
                onClick={(_event) => props.onEditAnalysisDetails('name', 'new name')}
            ></button>
            <button
                data-testid="mock-edit-analysis-save-button-details"
                onClick={(_event) =>
                    props.onEditAnalysisButtonPress(
                        EAnalysisEdit.DETAILS,
                        EAnalysisEditButtonType.SAVE
                    )
                }
            ></button>
            <button
                data-testid="mock-edit-analysis-cancel-button-details"
                onClick={(_event) =>
                    props.onEditAnalysisButtonPress(
                        EAnalysisEdit.DETAILS,
                        EAnalysisEditButtonType.CANCEL
                    )
                }
            ></button>
            <button
                data-testid="mock-edit-analysis-conditions"
                onClick={(_event) => props.onEditAnalysisConditions(conditions, weights)}
            ></button>
            <button
                data-testid="mock-edit-analysis-save-button-conditions"
                onClick={(_event) =>
                    props.onEditAnalysisButtonPress(
                        EAnalysisEdit.CONDITIONS,
                        EAnalysisEditButtonType.SAVE
                    )
                }
            ></button>
            <button
                data-testid="mock-edit-analysis-cancel-button-conditions"
                onClick={(_event) =>
                    props.onEditAnalysisButtonPress(
                        EAnalysisEdit.CONDITIONS,
                        EAnalysisEditButtonType.CANCEL
                    )
                }
            ></button>
        </>
    );
});

export default mockEditAnalysis;
