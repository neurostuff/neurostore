import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IEditAnalysisDetails } from '../..';
import EditAnalysisDetails from './EditAnalysisDetails';
import { useAuth0 } from '@auth0/auth0-react';
import API from '../../../../../utils/api';
import { act } from 'react-dom/test-utils';

jest.mock('@auth0/auth0-react');
jest.mock('../../../../../utils/api', () => {
    return {
        __esModule: true,
        default: {
            Services: {
                AnalysesService: {
                    analysesIdPut: jest.fn(() => {
                        return Promise.resolve();
                    }),
                },
            },
        },
    };
});

describe('EditAnalysisDetails Component', () => {
    let mockAnalysisDetails: IEditAnalysisDetails;
    let renderResult: RenderResult;

    beforeEach(() => {
        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: () => {},
        });

        mockAnalysisDetails = {
            analysisId: 'test-analysis-id',
            name: 'test-name',
            description: 'test-description',
            onEditAnalysisDetails: jest.fn(),
            onDeleteAnalysis: jest.fn(),
        };

        renderResult = render(<EditAnalysisDetails {...mockAnalysisDetails} />);
    });

    it('should render', () => {
        const editNameTextbox = screen.getByDisplayValue(mockAnalysisDetails.name);
        expect(editNameTextbox).toBeInTheDocument();

        const editDescriptionTextbox = screen.getByDisplayValue(mockAnalysisDetails.description);
        expect(editDescriptionTextbox).toBeInTheDocument();
    });

    it('should call onEditAnalysisDetails when analysis name is edited', () => {
        const analysisNameTextbox = screen.getByDisplayValue(mockAnalysisDetails.name);
        userEvent.type(analysisNameTextbox, 'A');
        expect(mockAnalysisDetails.onEditAnalysisDetails).toBeCalledWith({
            name: `${mockAnalysisDetails.name}A`,
        });
    });

    it('should call onEditAnalysisDetails when analysis description is edited', () => {
        const analysisNameDescription = screen.getByDisplayValue(mockAnalysisDetails.description);
        userEvent.type(analysisNameDescription, 'A');
        expect(mockAnalysisDetails.onEditAnalysisDetails).toBeCalledWith({
            description: `${mockAnalysisDetails.description}A`,
        });
    });

    it('should call the API when the update button is clicked', async () => {
        const analysisNameDescription = screen.getByDisplayValue(mockAnalysisDetails.description);
        userEvent.type(analysisNameDescription, 'A');

        // simulate parent props update of description
        mockAnalysisDetails.description = mockAnalysisDetails.description + 'A';
        renderResult.rerender(<EditAnalysisDetails {...mockAnalysisDetails} />);

        const updateButton = screen.getByRole('button', { name: 'Update' });

        await act(async () => {
            userEvent.click(updateButton);
        });

        expect(API.Services.AnalysesService.analysesIdPut).toBeCalledWith(
            mockAnalysisDetails.analysisId,
            {
                name: mockAnalysisDetails.name,
                description: mockAnalysisDetails.description,
            }
        );
    });

    it('should call the handleRevertChanges func when the revert changes button is clicked', () => {
        let analysisNameDescription = screen.getByDisplayValue(mockAnalysisDetails.description);
        userEvent.type(analysisNameDescription, 'A');

        // simulate parent props update of description
        mockAnalysisDetails.description = mockAnalysisDetails.description + 'A';
        renderResult.rerender(<EditAnalysisDetails {...mockAnalysisDetails} />);

        const revertChangesButton = screen.getByRole('button', { name: 'Revert Changes' });
        userEvent.click(revertChangesButton);

        analysisNameDescription = screen.getByDisplayValue(mockAnalysisDetails.description);
        expect(mockAnalysisDetails.onEditAnalysisDetails).toBeCalledWith({
            name: mockAnalysisDetails.name,
            description: mockAnalysisDetails.description.slice(
                0,
                mockAnalysisDetails.description.length - 1
            ),
        });
    });

    it('should call the onDeleteAnalysis func when the Delete this analysis button is clicked', () => {
        const deleteAnalysisButton = screen.getByRole('button', { name: 'Delete this analysis' });
        userEvent.click(deleteAnalysisButton);
        expect(mockAnalysisDetails.onDeleteAnalysis).toBeCalled();
    });
});
