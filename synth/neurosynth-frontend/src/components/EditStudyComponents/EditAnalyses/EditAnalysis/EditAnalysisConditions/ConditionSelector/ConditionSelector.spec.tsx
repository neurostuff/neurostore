import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCreateCondition } from 'hooks';
import { mockConditions } from 'testing/mockData';
import ConditionSelector from './ConditionSelector';

jest.mock('@auth0/auth0-react');
jest.mock('components/Dialogs/CreateDetailsDialog/CreateDetailsDialog');
jest.mock('hooks');

describe('ConditionSelector', () => {
    const mockOnConditionSelected = jest.fn();

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);
    });

    it('should show all the conditions', () => {
        render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.click(autocomplete);
        expect(screen.getAllByRole('option').length).toBe(mockConditions().length);
    });

    it('should filter out other options', () => {
        render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.type(autocomplete, mockConditions()[0].name as string);

        expect(screen.getAllByRole('option').length).toBe(1);
    });

    it('should not show the add new condition option if the condition you input already exists', () => {
        render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.type(autocomplete, mockConditions()[0].name as string);

        expect(screen.queryByText(`Add "${mockConditions()[0].name as string}"`)).toBeFalsy();
    });

    it('should show the add new condition if the condition you input does not exist', () => {
        render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.type(autocomplete, 'non-existent-text');
        expect(screen.queryByText(`Add "non-existent-text"`)).toBeTruthy();
    });

    it('should select an option and call the function', () => {
        render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);

        const autocomplete = screen.getByLabelText('add a new condition');
        userEvent.type(autocomplete, mockConditions()[0].name as string);

        const option = screen.getByText(mockConditions()[0].name as string);
        userEvent.click(option);

        expect(mockOnConditionSelected).toBeCalledWith(mockConditions()[0]);
    });

    it('should open the dialog and create a new condition and display that condition', async () => {
        render(<ConditionSelector onConditionSelected={mockOnConditionSelected} />);

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

        const call = (useCreateCondition().mutate as jest.Mock).mock.calls[0][0];

        expect(call).toEqual({
            name: 'test name',
            description: 'test description',
        });
    });
});
