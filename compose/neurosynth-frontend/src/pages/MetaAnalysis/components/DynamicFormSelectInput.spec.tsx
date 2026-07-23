import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DynamicFormSelectInput from './DynamicFormSelectInput';

describe('DynamicFormSelectInput Component', () => {
    const mockOnUpdate = vi.fn();

    it('should render', async () => {
        render(
            <DynamicFormSelectInput
                value={null}
                parameterName="null_iter"
                parameter={{
                    type: '{"approximate", "montecarlo"}',
                    description: 'test-description',
                    default: null,
                }}
                onUpdate={mockOnUpdate}
            />
        );
    });

    it('should show the given value', async () => {
        render(
            <DynamicFormSelectInput
                value="approximate"
                parameterName="null_iter"
                parameter={{
                    type: '{"approximate", "montecarlo"}',
                    description: 'test-description',
                    default: null,
                }}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.getByDisplayValue('approximate')).toBeInTheDocument();
    });

    it('should have the given options', async () => {
        render(
            <DynamicFormSelectInput
                value="approximate"
                parameterName="null_iter"
                parameter={{
                    type: '{"approximate", "montecarlo", "some-other-option"}',
                    description: 'test-description',
                    default: null,
                }}
                onUpdate={mockOnUpdate}
            />
        );

        const select = screen.getByRole('combobox');
        await userEvent.click(select);

        expect(screen.getAllByRole('option').length).toEqual(3);
    });

    it('should send the update', async () => {
        render(
            <DynamicFormSelectInput
                value="approximate"
                parameterName="null_iter"
                parameter={{
                    type: '{"approximate", "montecarlo", "some-other-option"}',
                    description: 'test-description',
                    default: null,
                }}
                onUpdate={mockOnUpdate}
            />
        );

        const select = screen.getByRole('combobox');
        await userEvent.click(select);

        const option = screen.getByRole('option', { name: 'montecarlo' });
        await userEvent.click(option);

        expect(mockOnUpdate).toHaveBeenCalledWith({
            null_iter: 'montecarlo',
        });
    });
});
