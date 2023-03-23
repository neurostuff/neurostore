import { act, render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditAnalysisConditions from './EditAnalysisConditions';
import { mockConditions, mockWeights } from 'testing/mockData';
import { useUpdateAnalysis } from 'hooks';
import { SnackbarProvider } from 'notistack';

jest.mock('react-query');
jest.mock('./ConditionSelector/ConditionSelector');
jest.mock('hooks');

describe('EditAnalysisConditions Component', () => {
    let renderResult: RenderResult;

    expect(true).toBeTruthy();

    // afterAll(() => {
    //     jest.clearAllMocks();
    // });

    // afterEach(() => {
    //     (useUpdateAnalysis().mutate as jest.Mock).mockClear();
    // });

    // beforeEach(() => {
    //     conditionsDetails = {
    //         studyId: 'test-studyId',
    //         analysisId: 'test-analysisId',
    //         conditions: mockConditions(),
    //         weights: mockWeights(),
    //     };

    //     renderResult = render(
    //         <SnackbarProvider>
    //             <EditAnalysisConditions {...conditionsDetails} />
    //         </SnackbarProvider>
    //     );
    // });

    // it('should render', () => {
    //     const titleText = screen.getByText('Conditions for this analysis');
    //     expect(titleText).toBeInTheDocument();
    // });

    // it('should call the function when a new condition is selected', () => {
    //     const addConditionButton = screen.getByTestId('mock-condition-selector');
    //     userEvent.click(addConditionButton);

    //     expect(useUpdateAnalysis().mutate).toHaveBeenCalledWith({
    //         analysisId: conditionsDetails.analysisId,
    //         analysis: {
    //             conditions: [...mockConditions().map((x) => x?.id || ''), MockConditionSelected.id],
    //             weights: [...mockWeights(), 1],
    //         },
    //     });
    // });

    // it('should disable the first cell', () => {
    //     const disabledCell = screen.getAllByRole('cell')[0];
    //     expect(disabledCell).toHaveClass('readonly');
    // });

    // it('should update the weight when a cell is updated', async () => {
    //     const inputCell = screen.getAllByRole('cell')[1];
    //     await act(async () => {
    //         userEvent.dblClick(inputCell);
    //     });
    //     const input = screen.getByRole('spinbutton');
    //     userEvent.type(input, '{backspace}0.5');

    //     await act(async () => {
    //         userEvent.type(input, '{enter}');
    //     });

    //     const expectedWeights = conditionsDetails.weights as number[];
    //     expectedWeights[0] = 0.5;

    //     expect(useUpdateAnalysis().mutate).toHaveBeenCalledWith({
    //         analysisId: conditionsDetails.analysisId,
    //         analysis: {
    //             conditions: (conditionsDetails?.conditions || []).map((x) => x?.id || ''),
    //             weights: expectedWeights,
    //         },
    //     });
    // });

    // it('should not update the table if the condition already exists', () => {
    //     conditionsDetails = {
    //         ...conditionsDetails,
    //         conditions: [{ ...MockConditionSelected }],
    //         weights: [1],
    //     };

    //     renderResult.rerender(
    //         <SnackbarProvider>
    //             <EditAnalysisConditions {...conditionsDetails} />
    //         </SnackbarProvider>
    //     );

    //     const addConditionButton = screen.getByTestId('mock-condition-selector');
    //     userEvent.click(addConditionButton);

    //     expect(useUpdateAnalysis().mutate).not.toHaveBeenCalled();
    // });

    // it('should call the function when the delete button is clicked', async () => {
    //     conditionsDetails = {
    //         ...conditionsDetails,
    //         conditions: [{ ...MockConditionSelected }],
    //         weights: [1],
    //     };

    //     renderResult.rerender(
    //         <SnackbarProvider>
    //             <EditAnalysisConditions {...conditionsDetails} />
    //         </SnackbarProvider>
    //     );

    //     const deleteButton = screen.getByRole('button', { name: 'delete' });
    //     await act(async () => {
    //         userEvent.click(deleteButton);
    //     });

    //     expect(useUpdateAnalysis().mutate).toBeCalledWith({
    //         analysisId: conditionsDetails.analysisId,
    //         analysis: {
    //             conditions: [],
    //             weights: [],
    //         },
    //     });
    // });
});
