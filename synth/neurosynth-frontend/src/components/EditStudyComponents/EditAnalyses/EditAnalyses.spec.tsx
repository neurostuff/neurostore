import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import { mockAnalyses, mockConditions, mockWeights } from '../../../testing/mockData';
import API, { AnalysisApiResponse } from '../../../utils/api';
import EditAnalyses from './EditAnalyses';
import EditAnalysis from './EditAnalysis/EditAnalysis';

// already tested child component
jest.mock('./EditAnalysis/EditAnalysis');
jest.mock('../../Dialogs/ConfirmationDialog/ConfirmationDialog');
jest.mock('@auth0/auth0-react');
jest.mock('../../../utils/api');

// we do a mock of the edit analysis component here because we want more fine grained access
// in order to spy on the arguments passed to it
jest.mock('./EditAnalysis/EditAnalysis');

describe('DisplayMetadataTableRow Component', () => {
    const mockOnUpdateAnalysis = jest.fn();
    let analyses: AnalysisApiResponse[] = [];
    let renderResult: RenderResult;

    beforeEach(() => {
        analyses = mockAnalyses();
        renderResult = render(
            <EditAnalyses analyses={analyses} onUpdateAnalysis={mockOnUpdateAnalysis} />
        );
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const title = screen.getByText('Edit Analyses');
        expect(title).toBeInTheDocument();
    });

    it('should show a no analyses message if there are no analyses', () => {
        renderResult.rerender(
            <EditAnalyses analyses={[]} onUpdateAnalysis={mockOnUpdateAnalysis} />
        );

        expect(screen.getByText('No analyses for this study')).toBeInTheDocument();
    });

    it('should show the correct number of tabs for the given analyses', () => {
        const tabs = screen.getAllByRole('tab');
        expect(tabs.length).toEqual(analyses.length);
    });

    it('should default to the first tab being selected', () => {
        // can use aria-selected
        const firstTab = screen.getAllByRole('tab')[0];
        expect(firstTab).toHaveClass('Mui-selected');
    });

    it('should update the analysis with the new details when an update is provided', () => {
        const mockDetailsUpdate = screen.getByTestId('mock-edit-analysis-details');
        userEvent.click(mockDetailsUpdate);

        /**
         * calls are stored as an array of arrays in this format:
         * [
         *     [
         *         { id: ..., name: ... },
         *         {}
         *     ],
         *     [
         *         { id: ..., name: ... },
         *         {}
         *     ],
         *     ...etc
         * ]
         */
        const mockCalls = (EditAnalysis as jest.Mock).mock.calls;
        const lastCall = (EditAnalysis as jest.Mock).mock.calls[mockCalls.length - 1][0];
        expect(lastCall.analysis.name).toEqual('new name');
        expect(lastCall.updateState.details.name).toBeTruthy();
    });

    it('should update the analysis with the new conditions/weights when an update is provided', () => {
        const mockDetailsUpdate = screen.getByTestId('mock-edit-analysis-conditions');
        const weights = mockWeights();
        const conditions = mockConditions();
        userEvent.click(mockDetailsUpdate);

        /**
         * calls are stored as an array of arrays in this format:
         * [
         *     [
         *         { id: ..., name: ... },
         *         {}
         *     ],
         *     [
         *         { id: ..., name: ... },
         *         {}
         *     ],
         *     ...etc
         * ]
         */
        const mockCalls = (EditAnalysis as jest.Mock).mock.calls;
        const lastCall = (EditAnalysis as jest.Mock).mock.calls[mockCalls.length - 1][0];
        expect(lastCall.analysis.conditions).toEqual(conditions);
        expect(lastCall.analysis.weights).toEqual(weights);
        expect(lastCall.updateState.conditions).toBeTruthy();
    });

    describe('on save', () => {
        beforeEach(() => {
            // in the component itself, we disregard the actual response so we do not need to mock it here
            (API.Services.AnalysesService.analysesIdPut as jest.Mock).mockReturnValue(
                Promise.resolve({
                    data: {},
                })
            );
        });

        it('should save and update the state appropriately for details', async () => {
            // mock an update to details
            const mockDetailsUpdate = screen.getByTestId('mock-edit-analysis-details');
            userEvent.click(mockDetailsUpdate);

            const mockSaveButton = screen.getByTestId('mock-edit-analysis-save-button-details');
            await act(async () => {
                userEvent.click(mockSaveButton);
            });

            expect(API.Services.AnalysesService.analysesIdPut).toBeCalledWith(analyses[0].id, {
                name: 'new name',
                description: 'Some description I am putting here',
            });
            expect(mockOnUpdateAnalysis).toBeCalledWith(analyses[0].id, {
                ...analyses[0],
                name: 'new name',
            });
        });

        it('should save and update the state appropriately just for conditions/weights', async () => {
            const conditions = mockConditions();
            const weights = mockWeights();

            // mock an update to conditions
            const mockConditionsUpdate = screen.getByTestId('mock-edit-analysis-conditions');
            userEvent.click(mockConditionsUpdate);

            const mockSaveButton = screen.getByTestId('mock-edit-analysis-save-button-conditions');
            await act(async () => {
                userEvent.click(mockSaveButton);
            });

            expect(API.Services.AnalysesService.analysesIdPut).toBeCalledWith(analyses[0].id, {
                conditions: conditions.map((x) => x.id),
                weights: weights,
            });
            expect(mockOnUpdateAnalysis).toBeCalledWith(analyses[0].id, {
                ...analyses[0],
                conditions: conditions,
                weights: weights,
            });
        });

        it('should update the original details when something is saved', async () => {
            const mockSaveButton = screen.getByTestId('mock-edit-analysis-save-button-details');
            await act(async () => {
                userEvent.click(mockSaveButton);
            });

            const newMockAnalyses = [...analyses];
            analyses[0].name = 'some new updated special name';

            await act(async () => {
                renderResult.rerender(
                    <EditAnalyses
                        analyses={newMockAnalyses}
                        onUpdateAnalysis={mockOnUpdateAnalysis}
                    />
                );
            });

            const cancelButton = screen.getByTestId('mock-edit-analysis-cancel-button-details');
            userEvent.click(cancelButton);

            const mockCalls = (EditAnalysis as jest.Mock).mock.calls;
            const lastCall = (EditAnalysis as jest.Mock).mock.calls[mockCalls.length - 1][0];
            expect(lastCall.analysis.name).toEqual('some new updated special name');
            expect(lastCall.updateState.details.name).toBeFalsy();
        });
    });

    describe('on cancel', () => {
        it('should cancel the changes for details', () => {
            // mock an update to details
            const mockDetailsUpdate = screen.getByTestId('mock-edit-analysis-details');
            userEvent.click(mockDetailsUpdate);

            const cancelButton = screen.getByTestId('mock-edit-analysis-cancel-button-details');
            userEvent.click(cancelButton);

            const mockCalls = (EditAnalysis as jest.Mock).mock.calls;
            const lastCall = (EditAnalysis as jest.Mock).mock.calls[mockCalls.length - 1][0];
            expect(lastCall.analysis.name).toEqual(analyses[0].name);
            expect(lastCall.updateState.details.name).toBeFalsy();
        });

        it('should cancel the changes for conditions/weights', () => {
            // mock an update to conditions/weights
            const mockConditionsUpdate = screen.getByTestId('mock-edit-analysis-conditions');
            userEvent.click(mockConditionsUpdate);

            const cancelButton = screen.getByTestId('mock-edit-analysis-cancel-button-conditions');
            userEvent.click(cancelButton);

            const mockCalls = (EditAnalysis as jest.Mock).mock.calls;
            const lastCall = (EditAnalysis as jest.Mock).mock.calls[mockCalls.length - 1][0];
            expect(lastCall.analysis.conditions).toEqual(analyses[0].conditions);
            expect(lastCall.analysis.weights).toEqual(analyses[0].weights);
            expect(lastCall.updateState.conditions).toBeFalsy();
        });
    });

    describe('on tab change', () => {
        it('should change the tab correctly', () => {
            const secondTab = screen.getAllByRole('tab')[1];
            userEvent.click(secondTab);

            const mockCalls = (EditAnalysis as jest.Mock).mock.calls;
            const lastCall = (EditAnalysis as jest.Mock).mock.calls[mockCalls.length - 1][0];
            expect(lastCall.analysis).toEqual(analyses[1]);
            expect(lastCall.updateState).toEqual({
                details: {
                    name: false,
                    description: false,
                },
                conditions: false,
            });
        });

        it('should show a dialog if there are unsaved changes', () => {
            // mock an update to details
            const mockDetailsUpdate = screen.getByTestId('mock-edit-analysis-details');
            userEvent.click(mockDetailsUpdate);

            const secondTab = screen.getAllByRole('tab')[1];
            userEvent.click(secondTab);

            const dialog = screen.getByTestId('mock-confirmation-dialog');
            expect(dialog).toBeInTheDocument();
        });

        it('should save all the changes if that option is selected in the dialog', async () => {
            // in the component itself, we disregard the actual response so we do not need to mock it here
            (API.Services.AnalysesService.analysesIdPut as jest.Mock).mockReturnValue(
                Promise.resolve({
                    data: {},
                })
            );

            // mock an update to details
            const mockDetailsUpdate = screen.getByTestId('mock-edit-analysis-details');
            userEvent.click(mockDetailsUpdate);

            const secondTab = screen.getAllByRole('tab')[1];
            userEvent.click(secondTab);

            const dialogButton = screen.getByTestId('accept-close-confirmation');
            await act(async () => {
                userEvent.click(dialogButton);
            });

            expect(API.Services.AnalysesService.analysesIdPut).toBeCalled();
            expect(mockOnUpdateAnalysis).toBeCalled();
        });

        it('should discard all the changes if that option is selected in the dialog', async () => {
            // mock an update to details
            const mockDetailsUpdate = screen.getByTestId('mock-edit-analysis-details');
            userEvent.click(mockDetailsUpdate);

            const secondTab = screen.getAllByRole('tab')[1];
            userEvent.click(secondTab);

            const dialogButton = screen.getByTestId('deny-close-confirmation');
            await act(async () => {
                userEvent.click(dialogButton);
            });

            const mockCalls = (EditAnalysis as jest.Mock).mock.calls;
            const lastCall = (EditAnalysis as jest.Mock).mock.calls[mockCalls.length - 1][0];
            expect(lastCall.analysis).toEqual(analyses[0]);
            expect(lastCall.updateState).toEqual({
                details: {
                    name: false,
                    description: false,
                },
                conditions: false,
            });
        });
    });
});
