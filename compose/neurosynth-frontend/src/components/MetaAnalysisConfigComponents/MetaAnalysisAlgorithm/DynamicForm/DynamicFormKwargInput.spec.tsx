import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DynamicFormKwargInput from './DynamicFormKwargInput';

jest.mock('../../../Tables/DisplayValuesTable/DisplayValuesTable');
jest.mock('../../../EditMetadata/EditMetadataRow/AddMetadataRow');

describe('DynamicFormKwargInput Component', () => {
    const mockOnUpdate = jest.fn();

    it('should render', () => {
        render(
            <DynamicFormKwargInput
                parameterName="**kwargs"
                parameter={{
                    type: null,
                    description: 'test-description',
                    default: null,
                }}
                value={null}
                onUpdate={mockOnUpdate}
            />
        );
    });

    it('should display the value', () => {
        render(
            <DynamicFormKwargInput
                parameterName="**kwargs"
                parameter={{
                    type: null,
                    description: 'test-description',
                    default: null,
                }}
                value={{
                    some_arg: 'abc',
                    another_arg: 'def',
                }}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.getByText('unique key: some_arg')).toBeInTheDocument();
        expect(screen.getByText('Argument: abc')).toBeInTheDocument();
        expect(screen.getByText('unique key: another_arg')).toBeInTheDocument();
        expect(screen.getByText('Argument: def')).toBeInTheDocument();
    });

    it('should update the table when a new kvp is added', () => {
        render(
            <DynamicFormKwargInput
                parameterName="**kwargs"
                parameter={{
                    type: null,
                    description: 'test-description',
                    default: null,
                }}
                value={{
                    some_arg: 'abc',
                    another_arg: 'def',
                }}
                onUpdate={mockOnUpdate}
            />
        );

        const addMetadataRow = screen.getByTestId('trigger-add');
        userEvent.click(addMetadataRow);

        expect(mockOnUpdate).toHaveBeenCalledWith({
            '**kwargs': {
                some_arg: 'abc',
                another_arg: 'def',
                'test-key': 'test-value',
            },
        });
    });

    it('should update the table when the action is triggered', () => {
        render(
            <DynamicFormKwargInput
                parameterName="**kwargs"
                parameter={{
                    type: null,
                    description: 'test-description',
                    default: null,
                }}
                value={{
                    'some-selected-id': 'abc',
                    another_arg: 'def',
                }}
                onUpdate={mockOnUpdate}
            />
        );

        userEvent.click(screen.getByTestId('simulate-trigger-action'));
        expect(mockOnUpdate).toBeCalledWith({
            '**kwargs': {
                another_arg: 'def',
            },
        });
    });

    it('should hide initially', () => {
        render(
            <DynamicFormKwargInput
                parameterName="**kwargs"
                parameter={{
                    type: null,
                    description: 'test-description',
                    default: null,
                }}
                value={{
                    some_arg: 'abc',
                    another_arg: 'def',
                }}
                onUpdate={mockOnUpdate}
            />
        );

        const addMetadataRow = screen.getByTestId('trigger-add');
        const table = screen.getByTestId('mock-table');
        expect(addMetadataRow).not.toBeVisible();
        expect(table).not.toBeVisible();
    });

    it('should become visible', () => {
        render(
            <DynamicFormKwargInput
                parameterName="**kwargs"
                parameter={{
                    type: null,
                    description: 'test-description',
                    default: null,
                }}
                value={{
                    some_arg: 'abc',
                    another_arg: 'def',
                }}
                onUpdate={mockOnUpdate}
            />
        );

        userEvent.click(screen.getByRole('button', { name: 'show advanced' }));
        const addMetadataRow = screen.getByTestId('trigger-add');
        const table = screen.getByTestId('mock-table');
        expect(addMetadataRow).toBeVisible();
        expect(table).toBeVisible();
    });
});
