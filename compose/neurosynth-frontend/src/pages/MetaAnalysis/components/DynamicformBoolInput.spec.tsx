import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DynamicFormBoolInput from './DynamicFormBoolInput';

describe('DynamicFormBoolInput', () => {
    const mockOnUpdate = vi.fn();

    it('should render', async () => {
        render(
            <DynamicFormBoolInput
                parameterName="null_iter"
                parameter={{
                    type: 'bool',
                    description: 'test-description',
                    default: false,
                }}
                value={null}
                onUpdate={mockOnUpdate}
            />
        );
    });

    it('should display the value when true', async () => {
        render(
            <DynamicFormBoolInput
                parameterName="null_iter"
                parameter={{
                    type: 'bool',
                    description: 'test-description',
                    default: false,
                }}
                value={true}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.getByText('true').className).toContain('Mui-selected');
    });

    it('should display the value when false', async () => {
        render(
            <DynamicFormBoolInput
                parameterName="null_iter"
                parameter={{
                    type: 'bool',
                    description: 'test-description',
                    default: false,
                }}
                value={false}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.getByText('false').className).toContain('Mui-selected');
    });

    it('should send an update', async () => {
        render(
            <DynamicFormBoolInput
                parameterName="null_iter"
                parameter={{
                    type: 'bool',
                    description: 'test-description',
                    default: false,
                }}
                value={false}
                onUpdate={mockOnUpdate}
            />
        );

        await userEvent.click(screen.getByText('true'));
        expect(mockOnUpdate).toHaveBeenCalledWith({
            null_iter: true,
        });
    });
});
