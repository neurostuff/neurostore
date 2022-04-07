import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IUpdateState } from '..';
import EditAnalysis from './EditAnalysis';

jest.mock('./EditAnalysisDetails/EditAnalysisDetails');
jest.mock('./EditAnalysisConditions/EditAnalysisConditions');
jest.mock('./EditAnalysisImages/EditAnalysisImages');
jest.mock('./EditAnalysisPoints/EditAnalysisPoints');

describe('EditAnalysis', () => {
    let renderResult: RenderResult;

    const mockOnEditAnalysisButtonPress = jest.fn();
    const mockOnEditAnalysisConditions = jest.fn();
    const mockOnEditAnalysisDetails = jest.fn();
    const mockOnEditAnalysisPoints = jest.fn();

    let mockUpdateState: IUpdateState = {
        details: {
            name: false,
            description: false,
        },
        conditions: false,
    };

    const mockAnalysis = {
        conditions: [],
        created_at: '2021-11-10T19:44:59.542751+00:00',
        description: null,
        id: '4hHczeSKK5wL',
        images: [],
        name: '21341',
        points: [
            {
                analysis: '4hHczeSKK5wL',
                coordinates: [2.0, 50.0, 10.0],
                created_at: '2021-11-10T19:44:59.542751+00:00',
                id: '3z5KFVfsqyCY',
                image: null,
                kind: 'unknown',
                label_id: null,
                space: 'UNKNOWN',
                user: 'some-user',
                value: [],
            },
            {
                analysis: '4hHczeSKK5wL',
                coordinates: [-2.0, 50.0, 10.0],
                created_at: '2021-11-10T19:44:59.542751+00:00',
                id: '7nAM2Hf2XVmX',
                image: null,
                kind: 'unknown',
                label_id: null,
                space: 'UNKNOWN',
                user: 'some-user',
                value: [],
            },
            {
                analysis: '4hHczeSKK5wL',
                coordinates: [0.0, 54.0, 6.0],
                created_at: '2021-11-10T19:44:59.542751+00:00',
                id: '6Jv5gB37xVVD',
                image: null,
                kind: 'unknown',
                label_id: null,
                space: 'UNKNOWN',
                user: 'some-user',
                value: [],
            },
            {
                analysis: '4hHczeSKK5wL',
                coordinates: [-2.0, 68.0, 0.0],
                created_at: '2021-11-10T19:44:59.542751+00:00',
                id: 'A4n9Th2gpXCR',
                image: null,
                kind: 'unknown',
                label_id: null,
                space: 'UNKNOWN',
                user: 'some-user',
                value: [],
            },
        ],
        study: '6upUEk2RD6dN',
        user: 'some-user',
        weights: [],
    };

    beforeEach(() => {
        renderResult = render(
            <EditAnalysis
                analysis={mockAnalysis}
                updateState={mockUpdateState}
                onEditAnalysisDetails={mockOnEditAnalysisDetails}
                onEditAnalysisButtonPress={mockOnEditAnalysisButtonPress}
                onEditAnalysisConditions={mockOnEditAnalysisConditions}
            />
        );
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const editAnalysisDetailsTab = screen.getByText('General');
        const editAnalysisCoordinatesTab = screen.getByText('Coordinates');
        const editAnalysisConditionsTab = screen.getByText('Conditions');
        const editAnalysisImagesTab = screen.getByText('Images');

        expect(editAnalysisDetailsTab).toBeInTheDocument();
        expect(editAnalysisCoordinatesTab).toBeInTheDocument();
        expect(editAnalysisConditionsTab).toBeInTheDocument();
        expect(editAnalysisImagesTab).toBeInTheDocument();
    });

    it('should highlight the conditions tab if a change occurs', () => {
        const updatedState = {
            ...mockUpdateState,
            conditions: true,
        };

        renderResult.rerender(
            <EditAnalysis
                analysis={mockAnalysis}
                updateState={updatedState}
                onEditAnalysisDetails={mockOnEditAnalysisDetails}
                onEditAnalysisButtonPress={mockOnEditAnalysisButtonPress}
                onEditAnalysisConditions={mockOnEditAnalysisConditions}
            />
        );

        const conditionsTab = screen.getByRole('tab', { name: 'Conditions' });
        expect(conditionsTab).toHaveStyle('background-color: #ffd892');
    });

    it('should highlight the general tab if a change occurs', () => {
        const updatedState = {
            ...mockUpdateState,
            details: {
                name: true,
                description: false,
            },
        };

        renderResult.rerender(
            <EditAnalysis
                analysis={mockAnalysis}
                updateState={updatedState}
                onEditAnalysisDetails={mockOnEditAnalysisDetails}
                onEditAnalysisButtonPress={mockOnEditAnalysisButtonPress}
                onEditAnalysisConditions={mockOnEditAnalysisConditions}
            />
        );

        const conditionsTab = screen.getByRole('tab', { name: 'General' });
        expect(conditionsTab).toHaveStyle('background-color: #ffd892');
    });

    it('should handle changes with the conditions component', () => {
        const conditionsTab = screen.getByRole('tab', { name: 'Conditions' });
        userEvent.click(conditionsTab);

        const mockConditionsChange = screen.getByTestId('mock-on-edit-analysis-conditions');
        userEvent.click(mockConditionsChange);
        expect(mockOnEditAnalysisConditions).toBeCalled();
    });

    it('should handle button presses with the conditions component', () => {
        const conditionsTab = screen.getByRole('tab', { name: 'Conditions' });
        userEvent.click(conditionsTab);

        const mockConditionsChangeButton = screen.getByTestId(
            'mock-on-edit-analysis-conditions-button-press'
        );
        userEvent.click(mockConditionsChangeButton);
        expect(mockOnEditAnalysisButtonPress).toBeCalled();
    });

    it('should handle changes with the general component', () => {
        const generalTab = screen.getByRole('tab', { name: 'General' });
        userEvent.click(generalTab);

        const mockGeneralChange = screen.getByTestId('mock-on-edit-analysis-details');
        userEvent.click(mockGeneralChange);
        expect(mockOnEditAnalysisDetails).toBeCalled();
    });

    it('should handle button presses with the general component', () => {
        const generaltab = screen.getByRole('tab', { name: 'General' });
        userEvent.click(generaltab);

        const mockDetailsButtonPress = screen.getByTestId(
            'mock-on-edit-analysis-details-button-press'
        );
        userEvent.click(mockDetailsButtonPress);
        expect(mockOnEditAnalysisButtonPress).toBeCalled();
    });
});
