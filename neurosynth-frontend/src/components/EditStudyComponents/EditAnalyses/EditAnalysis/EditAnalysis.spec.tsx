import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IEditAnalysis, IEditAnalysisDetails } from '..';
import EditAnalysis from './EditAnalysis';
import EditAnalysisDetails from './EditAnalysisDetails/EditAnalysisDetails';

// already tested child component
jest.mock('./EditAnalysisDetails/EditAnalysisDetails', () => {
    return {
        __esModule: true,
        default: (props: IEditAnalysisDetails) => {
            return (
                <div>
                    <input
                        onChange={() => {
                            props.onEditAnalysisDetails({ keyToUpdate: 'valueToUpdate' });
                        }}
                        data-testid="edit"
                    />
                    <button
                        onClick={() => {
                            props.onDeleteAnalysis('id-to-delete');
                        }}
                        data-testid="delete"
                    />
                </div>
            );
        },
    };
});

describe('EditAnalysis', () => {
    let mockEditAnalysis: IEditAnalysis;

    beforeEach(() => {
        mockEditAnalysis = {
            analysis: {
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
                        user: 'github|26612023',
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
                        user: 'github|26612023',
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
                        user: 'github|26612023',
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
                        user: 'github|26612023',
                        value: [],
                    },
                ],
                study: '6upUEk2RD6dN',
                user: 'github|26612023',
                weights: [],
            },
            onDeleteAnalysis: jest.fn(),
            onEditAnalysisDetails: jest.fn(),
            onEditAnalysisPoints: jest.fn(),
        };
        render(<EditAnalysis {...mockEditAnalysis} />);
    });

    it('should render', () => {
        const editAnalysisDetailsTab = screen.getByText('Details');
        const editAnalysisCoordinatesTab = screen.getByText('Coordinates');
        const editAnalysisConditionsTab = screen.getByText('Conditions');
        const editAnalysisImagesTab = screen.getByText('Images');

        expect(editAnalysisDetailsTab).toBeInTheDocument();
        expect(editAnalysisCoordinatesTab).toBeInTheDocument();
        expect(editAnalysisConditionsTab).toBeInTheDocument();
        expect(editAnalysisImagesTab).toBeInTheDocument();
    });

    it('should call the onEditAnalysisDetails prop func', () => {
        const input = screen.getByTestId('edit');
        userEvent.type(input, 'A');
        expect(mockEditAnalysis.onEditAnalysisDetails).toBeCalledWith('4hHczeSKK5wL', {
            keyToUpdate: 'valueToUpdate',
        });
    });

    it('should call the onDeleteAnalysis prop func', () => {
        const deleteButton = screen.getByTestId('delete');
        userEvent.click(deleteButton);
        expect(mockEditAnalysis.onDeleteAnalysis).toBeCalledWith('id-to-delete');
    });
});
