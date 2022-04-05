import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EAnalysisEdit, EAnalysisEditButtonType, IEditAnalysisDetails } from '../..';
import EditAnalysisDetails from './EditAnalysisDetails';

describe('EditAnalysisDetails Component', () => {
    let mockAnalysisDetails: IEditAnalysisDetails;
    let renderResult: RenderResult;

    beforeEach(() => {
        mockAnalysisDetails = {
            name: 'test-name',
            description: 'test-description',
            updateEnabled: {
                name: false,
                description: false,
            },
            onEditAnalysisDetails: jest.fn(),
            onEditAnalysisButtonPress: jest.fn(),
        };

        renderResult = render(<EditAnalysisDetails {...mockAnalysisDetails} />);
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
            const saveButton = screen.getByRole('button', { name: 'Save' });
            expect(saveButton).toBeDisabled();
        });
        it('should initially disable the cancel button', () => {
            const cancelButton = screen.getByRole('button', { name: 'Cancel' });
            expect(cancelButton).toBeDisabled();
        });
        it('should enable the save button when the state is updated', () => {
            mockAnalysisDetails = {
                name: 'test-name',
                description: 'test-description',
                updateEnabled: {
                    name: true,
                    description: false,
                },
                onEditAnalysisDetails: jest.fn(),
                onEditAnalysisButtonPress: jest.fn(),
            };

            renderResult.rerender(<EditAnalysisDetails {...mockAnalysisDetails} />);

            const saveButton = screen.getByRole('button', { name: 'Save' });
            expect(saveButton).toBeEnabled();
        });

        it('should enable the cancel button when the state is updated', () => {
            mockAnalysisDetails = {
                name: 'test-name',
                description: 'test-description',
                updateEnabled: {
                    name: false,
                    description: true,
                },
                onEditAnalysisDetails: jest.fn(),
                onEditAnalysisButtonPress: jest.fn(),
            };

            renderResult.rerender(<EditAnalysisDetails {...mockAnalysisDetails} />);

            const cancelButton = screen.getByRole('button', { name: 'Cancel' });
            expect(cancelButton).toBeEnabled();
        });

        it('should call the function when the save button is pressed', () => {
            mockAnalysisDetails = {
                name: 'test-name',
                description: 'test-description',
                updateEnabled: {
                    name: true,
                    description: true,
                },
                onEditAnalysisDetails: jest.fn(),
                onEditAnalysisButtonPress: jest.fn(),
            };
            renderResult.rerender(<EditAnalysisDetails {...mockAnalysisDetails} />);

            const analysisNameDescription = screen.getByDisplayValue(
                mockAnalysisDetails.description
            );
            userEvent.type(analysisNameDescription, 'A');

            const updateButton = screen.getByRole('button', { name: 'Save' });
            userEvent.click(updateButton);

            expect(mockAnalysisDetails.onEditAnalysisButtonPress).toBeCalledWith(
                EAnalysisEdit.DETAILS,
                EAnalysisEditButtonType.SAVE
            );
        });

        it('should call the function when the cancel button is pressed', () => {
            mockAnalysisDetails = {
                name: 'test-name',
                description: 'test-description',
                updateEnabled: {
                    name: true,
                    description: true,
                },
                onEditAnalysisDetails: jest.fn(),
                onEditAnalysisButtonPress: jest.fn(),
            };
            renderResult.rerender(<EditAnalysisDetails {...mockAnalysisDetails} />);

            let analysisNameDescription = screen.getByDisplayValue(mockAnalysisDetails.description);
            userEvent.type(analysisNameDescription, 'A');

            const updateButton = screen.getByRole('button', { name: 'Cancel' });
            userEvent.click(updateButton);

            expect(mockAnalysisDetails.onEditAnalysisButtonPress).toBeCalledWith(
                EAnalysisEdit.DETAILS,
                EAnalysisEditButtonType.CANCEL
            );
        });
    });

    it('should call onEditAnalysisDetails when analysis name is edited', () => {
        const analysisNameTextbox = screen.getByDisplayValue(mockAnalysisDetails.name);
        userEvent.type(analysisNameTextbox, 'A');
        expect(mockAnalysisDetails.onEditAnalysisDetails).toBeCalledWith(
            'name',
            mockAnalysisDetails.name + 'A'
        );
    });

    it('should call onEditAnalysisDetails when analysis description is edited', () => {
        const analysisNameDescription = screen.getByDisplayValue(mockAnalysisDetails.description);
        userEvent.type(analysisNameDescription, 'A');
        expect(mockAnalysisDetails.onEditAnalysisDetails).toBeCalledWith(
            'description',
            mockAnalysisDetails.description + 'A'
        );
    });

    it('should call the function when the delete button is clicked', () => {
        const deleteAnalysisButton = screen.getByRole('button', { name: 'Delete this analysis' });
        userEvent.click(deleteAnalysisButton);
        expect(mockAnalysisDetails.onEditAnalysisButtonPress).toBeCalledWith(
            EAnalysisEdit.DETAILS,
            EAnalysisEditButtonType.DELETE
        );
    });
});
