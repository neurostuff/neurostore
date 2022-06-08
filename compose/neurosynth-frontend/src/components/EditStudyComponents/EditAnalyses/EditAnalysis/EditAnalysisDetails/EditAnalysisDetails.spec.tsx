import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDeleteAnalysis, useUpdateAnalysis } from 'hooks';
import { SnackbarProvider } from 'notistack';
import { IEditAnalysisDetails } from '../..';
import EditAnalysisDetails from './EditAnalysisDetails';

jest.mock('react-query');
jest.mock('components/Dialogs/ConfirmationDialog/ConfirmationDialog');
jest.mock('hooks');

describe('EditAnalysisDetails Component', () => {
    let mockAnalysisDetails: IEditAnalysisDetails;
    let renderResult: RenderResult;

    beforeEach(() => {
        mockAnalysisDetails = {
            name: 'test-name',
            description: 'test-description',
            studyId: 'test-studyid',
            analysisId: 'test-analyisId',
        };
        renderResult = render(
            <SnackbarProvider>
                <EditAnalysisDetails {...mockAnalysisDetails} />
            </SnackbarProvider>
        );
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const editNameTextbox = screen.getByDisplayValue(mockAnalysisDetails.name);
        expect(editNameTextbox).toBeInTheDocument();

        const editDescriptionTextbox = screen.getByDisplayValue(mockAnalysisDetails.description);
        expect(editDescriptionTextbox).toBeInTheDocument();
    });

    describe('buttons', () => {
        it('should initially disable the save button', () => {
            const saveButton = screen.getByRole('button', { name: 'save' });
            expect(saveButton).toBeDisabled();
        });
        it('should enable the save button when the state is updated', () => {
            renderResult.rerender(
                <SnackbarProvider>
                    <EditAnalysisDetails {...mockAnalysisDetails} />
                </SnackbarProvider>
            );
            userEvent.type(screen.getByLabelText('Edit Analysis Name'), 'abc');
            expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
        });

        it('should call the function when the save button is pressed', () => {
            userEvent.type(screen.getByLabelText('Edit Analysis Name'), 'abc');
            const saveButton = screen.getByRole('button', { name: 'save' });
            userEvent.click(saveButton);

            const call = (useUpdateAnalysis().mutate as jest.Mock).mock.calls[0][0];
            expect(call).toEqual({
                analysisId: mockAnalysisDetails.analysisId,
                analysis: {
                    name: mockAnalysisDetails.name + 'abc',
                    description: mockAnalysisDetails.description,
                },
            });
        });
    });

    it('should update the textfield when name is edited', () => {
        const analysisNameTextbox = screen.getByDisplayValue(mockAnalysisDetails.name);
        userEvent.type(analysisNameTextbox, 'abc');
        expect(screen.getByDisplayValue(mockAnalysisDetails.name + 'abc')).toBeInTheDocument();
    });

    it('should update the textfield when description is edited', () => {
        const analysisDescriptionTextbox = screen.getByDisplayValue(
            mockAnalysisDetails.description
        );
        userEvent.type(analysisDescriptionTextbox, 'abc');
        expect(
            screen.getByDisplayValue(mockAnalysisDetails.description + 'abc')
        ).toBeInTheDocument();
    });

    it('should call the function when the delete button is clicked', () => {
        const deleteAnalysisButton = screen.getByRole('button', { name: 'delete analysis' });
        userEvent.click(deleteAnalysisButton);

        userEvent.click(screen.getByTestId('accept-close-confirmation'));

        expect(useDeleteAnalysis().mutate).toHaveBeenCalledWith(mockAnalysisDetails.analysisId);
    });
});
