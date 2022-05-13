import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import API, { ConditionApiResponse } from '../../../../../../utils/api';
import ConditionSelector from './ConditionSelector';

jest.mock('../../../../../../utils/api');
jest.mock('@auth0/auth0-react');
jest.mock('../../../../../Dialogs/CreateDetailsDialog/CreateDetailsDialog');

describe('ConditionSelector', () => {
    const mockOnConditionSelected = jest.fn();

    const mockConditions: ConditionApiResponse[] = [
        {
            name: 'condition-1',
            description: 'description of a condition 1',
            id: 'id-1',
            created_at: '',
            user: 'github|user-1',
        },
        {
            name: 'condition-2',
            description: 'description of a condition 2',
            id: 'id-2',
            created_at: '',
            user: 'github|user-1',
        },
        {
            name: 'condition-3',
            description: 'description of a condition 3',
            id: 'id-3',
            created_at: '',
            user: 'github|user-2',
        },
    ];

    beforeEach(() => {
        (API.NeurostoreServices.ConditionsService.conditionsGet as jest.Mock).mockReturnValue(
            Promise.resolve({
                data: {
                    results: mockConditions,
                },
            })
        );
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', async () => {
        await act(async () => {
            render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);
        });
    });

    it('should show all the conditions', async () => {
        await act(async () => {
            render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);
        });

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.click(autocomplete);
        expect(screen.getAllByRole('option').length).toBe(mockConditions.length);
    });

    it('should filter out other options', async () => {
        await act(async () => {
            render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);
        });

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.type(autocomplete, mockConditions[2].name as string);

        expect(screen.getAllByText(mockConditions[2].name as string).length).toBe(1);
    });

    it('should not show the add new condition option if the condition you input already exists', async () => {
        await act(async () => {
            render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);
        });

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.type(autocomplete, mockConditions[2].name as string);

        expect(screen.queryByText(`Add "${mockConditions[2].name as string}"`)).toBeFalsy();
    });

    it('should show the add new condition if the condition you input does not exist', async () => {
        await act(async () => {
            render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);
        });

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.type(autocomplete, 'non-existent-text');
        expect(screen.queryByText(`Add "non-existent-text"`)).toBeTruthy();
    });

    it('should select an option and call the function', async () => {
        await act(async () => {
            render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);
        });

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.type(autocomplete, mockConditions[0].name as string);

        const option = screen.getByText(mockConditions[0].name as string);
        userEvent.click(option);

        expect(mockOnConditionSelected).toBeCalledWith(mockConditions[0]);
    });

    it('should open the dialog and create a new condition and display that condition', async () => {
        (API.NeurostoreServices.ConditionsService.conditionsPost as jest.Mock).mockReturnValue(
            Promise.resolve({
                data: {
                    name: 'test-name',
                    description: 'test-description',
                    id: 'id-4',
                    created_at: '',
                    user: 'github|user-2',
                },
            })
        );

        await act(async () => {
            render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);
        });

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.type(autocomplete, 'non existent text');

        // click "add option" to make mock dialog appear
        const addNewOption = screen.getByText('Add "non existent text"');
        userEvent.click(addNewOption);

        // mock a create condition event which will trigger the API call
        const createButton = screen.getByTestId('mock-create-button');
        await act(async () => {
            userEvent.click(createButton);
        });

        expect(API.NeurostoreServices.ConditionsService.conditionsPost).toHaveBeenCalled();
        userEvent.click(autocomplete);
        expect(screen.getAllByRole('option').length).toBe(mockConditions.length + 1);
    });
});
