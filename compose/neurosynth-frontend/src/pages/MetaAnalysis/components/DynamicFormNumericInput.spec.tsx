import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DynamicFormNumericInput from './DynamicFormNumericInput';

const baseParam = { type: 'float' as const, description: 'test-description', default: null };

describe('DynamicFormNumericInput', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        user = userEvent.setup();
    });

    const mockOnUpdate = vi.fn();
    beforeEach(() => mockOnUpdate.mockClear());

    it('should render', () => {
        render(
            <DynamicFormNumericInput
                parameterName="null_iter"
                parameter={{ ...baseParam, type: 'int' }}
                value={null}
                onUpdate={mockOnUpdate}
            />
        );
    });

    it('should show the given float', () => {
        render(
            <DynamicFormNumericInput
                parameterName="null_iter"
                parameter={baseParam}
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
                parameter={{ ...baseParam, type: 'int' }}
                value={5}
                onUpdate={mockOnUpdate}
            />
        );
        expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    });

    it('should send the update', async () => {
        render(
            <DynamicFormNumericInput
                parameterName="null_iter"
                parameter={{ ...baseParam, type: 'int' }}
                value={5}
                onUpdate={mockOnUpdate}
            />
        );
        const input = screen.getByRole('textbox');
        await user.type(input, '3');
        expect(mockOnUpdate).toHaveBeenCalledWith({ null_iter: 53 });
    });

    it('should display 0 instead of clearing (leading-zero regression)', () => {
        render(
            <DynamicFormNumericInput
                parameterName="voxel_thresh"
                parameter={baseParam}
                value={0}
                onUpdate={mockOnUpdate}
            />
        );
        expect(screen.getByDisplayValue('0')).toBeInTheDocument();
    });

    it('should let the user type a leading-zero decimal', async () => {
        render(
            <DynamicFormNumericInput
                parameterName="voxel_thresh"
                parameter={baseParam}
                value={null}
                onUpdate={mockOnUpdate}
            />
        );
        const input = screen.getByRole('textbox');
        await user.type(input, '0.001');
        expect(screen.getByDisplayValue('0.001')).toBeInTheDocument();
        expect(mockOnUpdate).toHaveBeenLastCalledWith({ voxel_thresh: 0.001 });
    });

    it('should let the user type a leading decimal point and numbers', async () => {
        render(
            <DynamicFormNumericInput
                parameterName="voxel_thresh"
                parameter={baseParam}
                value={null}
                onUpdate={mockOnUpdate}
            />
        );
        const input = screen.getByRole('textbox');
        await user.type(input, '.01');
        expect(screen.getByDisplayValue('.01')).toBeInTheDocument();
        expect(mockOnUpdate).toHaveBeenLastCalledWith({ voxel_thresh: 0.01 });
    });

    it('should emit null when cleared', async () => {
        render(
            <DynamicFormNumericInput
                parameterName="voxel_thresh"
                parameter={baseParam}
                value={5}
                onUpdate={mockOnUpdate}
            />
        );
        const input = screen.getByRole('textbox');
        await user.clear(input);
        expect(mockOnUpdate).toHaveBeenLastCalledWith({ voxel_thresh: null });
    });

    it('should ignore non-numeric input', async () => {
        render(
            <DynamicFormNumericInput
                parameterName="voxel_thresh"
                parameter={baseParam}
                value={null}
                onUpdate={mockOnUpdate}
            />
        );
        const input = screen.getByRole('textbox');
        await user.type(input, 'a');
        expect(screen.getByRole('textbox')).toHaveValue('');
        expect(mockOnUpdate).not.toHaveBeenCalled();
    });
});
