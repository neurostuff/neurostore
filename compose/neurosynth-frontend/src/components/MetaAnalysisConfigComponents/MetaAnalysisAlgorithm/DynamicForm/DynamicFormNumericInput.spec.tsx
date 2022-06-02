import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DynamicFormNumericInput from './DynamicFormNumericInput';

describe('DynamicFormNumericInput', () => {
    const mockOnUpdate = jest.fn();

    it('should render', () => {
        render(
            <DynamicFormNumericInput
                parameterName="null_iter"
                parameter={{
                    type: 'int',
                    description: 'test-description',
                    default: null,
                }}
                value={null}
                onUpdate={mockOnUpdate}
            />
        );
    });

    it('should show the given float', () => {
        render(
            <DynamicFormNumericInput
                parameterName="null_iter"
                parameter={{
                    type: 'float',
                    description: 'test-description',
                    default: null,
                }}
                value={0.12345}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.getByDisplayValue('0.12345')).toBeInTheDocument();
    });

    it('should show the given integer', () => {
        render(
            <DynamicFormNumericInput
                parameterName="null_iter"
                parameter={{
                    type: 'int',
                    description: 'test-description',
                    default: null,
                }}
                value={5}
                onUpdate={mockOnUpdate}
            />
        );
        expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    });

    it('should send the update', () => {
        render(
            <DynamicFormNumericInput
                parameterName="null_iter"
                parameter={{
                    type: 'int',
                    description: 'test-description',
                    default: null,
                }}
                value={5}
                onUpdate={mockOnUpdate}
            />
        );
        const input = screen.getByRole('spinbutton');
        userEvent.type(input, '3');

        expect(mockOnUpdate).toHaveBeenCalledWith({
            null_iter: '53',
        });
    });
});
