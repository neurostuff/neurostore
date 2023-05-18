import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DynamicFormStringInput from './DynamicFormStringInput';

describe('DynamicFormStringInput Component', () => {
    const mockOnUpdate = jest.fn();

    it('should render', () => {
        render(
            <DynamicFormStringInput
                value={null}
                parameterName="null_iter"
                parameter={{ type: 'str', description: 'test-description', default: null }}
                onUpdate={mockOnUpdate}
            />
        );
    });

    it('should show the given value', () => {
        render(
            <DynamicFormStringInput
                value="abc"
                parameterName="null_iter"
                parameter={{ type: 'str', description: 'test-description', default: null }}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
    });

    it('should send the update', () => {
        render(
            <DynamicFormStringInput
                value=""
                parameterName="null_iter"
                parameter={{ type: 'str', description: 'test-description', default: null }}
                onUpdate={mockOnUpdate}
            />
        );

        const inputElement = screen.getByLabelText('text');

        // focus on input element
        userEvent.click(inputElement);

        userEvent.type(inputElement, 'a');
        expect(mockOnUpdate).toHaveBeenCalledWith({
            null_iter: 'a',
        });
    });
});
